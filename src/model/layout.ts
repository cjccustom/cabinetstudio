import type { EndInfo } from './parts';
import type { Cabinet, Room, ShopSettings, WallId } from './types';
import { crownFit, panelExtents } from './parts';
import { fmt } from '../units';

export const wallNames: Record<WallId, string> = { back: 'Back wall', left: 'Left wall', right: 'Right wall', front: 'Front wall' };
export const wallOrder: WallId[] = ['back', 'left', 'right', 'front'];

export function wallLength(room: Room, wall: WallId): number {
  return wall === 'back' || wall === 'front' ? room.width : room.depth;
}

/**
 * Room coordinates: x = 0..width along the back wall, z = 0 (back wall) .. depth (front), y up.
 * Offsets along a wall are measured from its left end as you stand in the room facing it.
 */
export function wallTransform(room: Room, wall: WallId, offset: number, inset = 0): { pos: [number, number, number]; rotY: number } {
  inset = +inset || 0;
  switch (wall) {
    case 'back': return { pos: [offset, 0, inset], rotY: 0 };
    case 'left': return { pos: [inset, 0, room.depth - offset], rotY: Math.PI / 2 };
    case 'right': return { pos: [room.width - inset, 0, offset], rotY: -Math.PI / 2 };
    case 'front': return { pos: [room.width - offset, 0, room.depth - inset], rotY: Math.PI };
  }
}

/** Room-plan directions (x, z) for a wall: running along it, left to right facing it, and out from it into the room. */
export const wallAxes: Record<WallId, { along: [number, number]; out: [number, number] }> = {
  back: { along: [1, 0], out: [0, 1] },
  front: { along: [-1, 0], out: [0, -1] },
  left: { along: [0, -1], out: [1, 0] },
  right: { along: [0, 1], out: [-1, 0] },
};

/**
 * Move a cabinet by (dx, dz) in the room's plan, whatever wall it hangs off: the part along its wall
 * changes its offset, the part across it how far it stands off the wall.
 */
export function shiftInRoom(c: Cabinet, dx: number, dz: number): Pick<Cabinet, 'offset' | 'wallInset'> {
  const a = wallAxes[c.wall];
  const inset = (c.wallInset ?? 0) + dx * a.out[0] + dz * a.out[1];
  return { offset: c.offset + dx * a.along[0] + dz * a.along[1], wallInset: inset > 1e-6 ? inset : undefined };
}

/** Position along a wall for a point on the floor. */
export function alongWall(room: Room, wall: WallId, x: number, z: number): number {
  switch (wall) {
    case 'back': return x;
    case 'left': return room.depth - z;
    case 'right': return z;
    case 'front': return room.width - x;
  }
}

export interface Footprint { x0: number; x1: number; z0: number; z1: number; y0: number; y1: number }

/** Room-space bounding box of the case, face frame and any end panels (doors and counters excluded). */
export function footprint(room: Room, c: Cabinet, ext = { left: 0, right: 0 }): Footprint {
  const { pos, rotY } = wallTransform(room, c.wall, c.offset, c.wallInset);
  const cos = Math.round(Math.cos(rotY));
  const sin = Math.round(Math.sin(rotY));
  const l = -ext.left;
  const r = c.width + ext.right;
  const d = c.corner ? Math.max(c.depth, c.corner.width2) : c.depth;
  // A two-sided island's far case sits behind this one, toward the wall
  const z0 = c.island && c.islandSides === 2 ? -c.depth : 0;
  const pts: [number, number][] = [[l, z0], [r, z0], [l, d], [r, d]].map(([lx, lz]) => [
    pos[0] + lx * cos + lz * sin,
    pos[2] - lx * sin + lz * cos,
  ]);
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  return {
    x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs),
    y0: c.elevation, y1: c.elevation + c.height,
  };
}

const EPS = 0.01;
const overlaps = (a: Footprint, b: Footprint) =>
  a.x0 < b.x1 - EPS && b.x0 < a.x1 - EPS && a.z0 < b.z1 - EPS && b.z0 < a.z1 - EPS && a.y0 < b.y1 - EPS && b.y0 < a.y1 - EPS;

/** echo marks the second half of a pair (B2 overlaps B1) so the summary lists each problem once. */
export interface Issue { cabinetId: string; message: string; echo?: boolean }

/** Layout problems worth flagging before anything gets built. */
export function findIssues(room: Room, cabinets: Cabinet[], s: ShopSettings): Issue[] {
  const issues: Issue[] = [];
  const exts = cabinets.map((c) => extentsOf(room, cabinets, c, s));
  const fps = cabinets.map((c, i) => footprint(room, c, exts[i]));
  cabinets.forEach((c, i) => {
    const len = wallLength(room, c.wall);
    if (c.offset - exts[i].left < -EPS || c.offset + c.width + exts[i].right > len + EPS) issues.push({ cabinetId: c.id, message: `${c.name} runs past the end of the wall` });
    if (c.corner) {
      const f = fps[i];
      if (f.x0 < -EPS || f.z0 < -EPS || f.x1 > room.width + EPS || f.z1 > room.depth + EPS) issues.push({ cabinetId: c.id, message: `${c.name} runs past the corner wall` });
    }
    if (c.elevation + c.height > room.height + EPS) issues.push({ cabinetId: c.id, message: `${c.name} is taller than the ceiling (top ${fmt(c.elevation + c.height)}, ceiling ${fmt(room.height)})` });
    else {
      const cf = crownFit(c, s, room.height);
      if (cf && cf.over > EPS) issues.push({ cabinetId: c.id, message: `${c.name}'s crown is ${fmt(cf.over)} too tall: case top at ${fmt(cf.caseTop)}, crown drop ${fmt(cf.drop)} puts its top at ${fmt(cf.top)}, ceiling ${fmt(room.height)}. Shorten the cabinet ${fmt(cf.over)} or pick a crown with a drop under ${fmt(Math.max(0, cf.drop - cf.over))}.` });
    }
    for (let j = i + 1; j < cabinets.length; j++) {
      if (overlaps(fps[i], fps[j])) issues.push({ cabinetId: c.id, message: `${c.name} overlaps ${cabinets[j].name}` }, { cabinetId: cabinets[j].id, message: `${cabinets[j].name} overlaps ${c.name}`, echo: true });
    }
  });
  return issues;
}

/**
 * First open spot on a wall for a new cabinet. Counts cabinets on this wall plus any on the
 * neighbouring walls that reach into the strip of floor the new cabinet would sit on (corners).
 */
export function nextFreeOffset(room: Room, cabinets: Cabinet[], wall: WallId, width: number, y0: number, y1: number, depth = 24): number {
  const len = wallLength(room, wall);
  const band = (f: Footprint): [number, number] | null => {
    // Distance from this wall, and position along it, for the footprint's corners
    const pts = [[f.x0, f.z0], [f.x1, f.z0], [f.x0, f.z1], [f.x1, f.z1]];
    const off = pts.map(([x, z]) => (wall === 'back' ? z : wall === 'front' ? room.depth - z : wall === 'left' ? x : room.width - x));
    if (Math.min(...off) >= depth - EPS) return null;
    const along = pts.map(([x, z]) => alongWall(room, wall, x, z));
    return [Math.min(...along), Math.max(...along)];
  };
  const taken = cabinets
    .filter((c) => c.elevation < y1 && y0 < c.elevation + c.height)
    .map((c) => (c.wall === wall ? ([c.offset, c.offset + c.width] as [number, number]) : band(footprint(room, c))))
    .filter((x): x is [number, number] => !!x)
    .sort((a, b) => a[0] - b[0]);
  let x = 0;
  for (const [a, b] of taken) {
    if (a - x >= width - EPS) return x;
    x = Math.max(x, b);
  }
  return x + width <= len + EPS ? x : Math.max(0, len - width);
}

/** End panel extents for a cabinet as it sits in the layout. */
export function extentsOf(room: Room, cabinets: Cabinet[], c: Cabinet, s: ShopSettings) {
  return panelExtents(c, s, resolveEnds(room, cabinets, c));
}

/** Snap a dragged cabinet's left edge to wall ends and neighbouring cabinet edges, end panels included. */
export function snapOffset(room: Room, cabinets: Cabinet[], moving: Cabinet, raw: number, s: ShopSettings, tol = 1.5): number {
  const len = wallLength(room, moving.wall);
  const edges = [0, len];
  for (const c of cabinets) {
    if (c.id === moving.id || c.wall !== moving.wall) continue;
    const e = extentsOf(room, cabinets, c, s);
    edges.push(c.offset - e.left, c.offset + c.width + e.right);
  }
  const own = extentsOf(room, cabinets, { ...moving, offset: raw }, s);
  let best = Math.round(raw * 16) / 16;
  let bestD = tol;
  for (const e of edges) {
    for (const cand of [e + own.left, e - moving.width - own.right]) {
      const d = Math.abs(raw - cand);
      if (d < bestD) { bestD = d; best = cand; }
    }
  }
  return best;
}

/** Room coordinates of a point given in a cabinet's own coordinates. */
function toRoom(room: Room, c: Cabinet, lx: number, lz: number): [number, number] {
  const { pos, rotY } = wallTransform(room, c.wall, c.offset, c.wallInset);
  const cos = Math.round(Math.cos(rotY));
  const sin = Math.round(Math.sin(rotY));
  return [pos[0] + lx * cos + lz * sin, pos[2] - lx * sin + lz * cos];
}

/**
 * Which case sides show. Looks just past each end: if that point is past a wall or inside
 * another cabinet (on any wall, so corners count), the side is hidden; otherwise it's a
 * finished end, unless the cabinet says otherwise.
 */
export function resolveEnds(room: Room, cabinets: Cabinet[], c: Cabinet): EndInfo {
  const probe = 0.0625;
  if (c.kind === 'pilaster') {
    // A side tight to a wall (the probe lands outside the room): the room's base dies into the wall there
    const past = ([x, z]: [number, number]) => x < 0 || z < 0 || x > room.width || z > room.depth;
    return {
      left: true, right: true, faceAt: (side, y) => neighbourFace(cabinets, c, side, y),
      wall: { left: past(toRoom(room, c, -probe, c.depth / 2)), right: past(toRoom(room, c, c.width + probe, c.depth / 2)) },
    };
  }
  const tol = 0.125;
  const others = cabinets
    .filter((o) => o.id !== c.id && o.elevation < c.elevation + c.height && c.elevation < o.elevation + o.height)
    .map((o) => footprint(room, o));
  const covered = ([x, z]: [number, number]) =>
    x < 0 || z < 0 || x > room.width || z > room.depth ||
    others.some((f) => x >= f.x0 - tol && x <= f.x1 + tol && z >= f.z0 - tol && z <= f.z1 + tol);
  const D = c.depth;
  let leftPt: [number, number] = [-probe, D / 2];
  let rightPt: [number, number] = [c.width + probe, D / 2];
  if (c.corner) {
    // An L-corner's ends are the end of the leg on this wall and the end of the leg on the other wall
    const legEnd: [number, number] = [c.corner.side === 'left' ? D / 2 : c.width - D / 2, c.corner.width2 + probe];
    if (c.corner.side === 'left') leftPt = legEnd;
    else rightPt = legEnd;
  }
  const autoLeft = !covered(toRoom(room, c, ...leftPt));
  const autoRight = !covered(toRoom(room, c, ...rightPt));
  const pick = (mode: Cabinet['leftEnd'], auto: boolean) => (mode === 'exposed' ? true : mode === 'hidden' ? false : auto);
  return { left: pick(c.leftEnd, autoLeft), right: pick(c.rightEnd, autoRight) };
}

/** Front of whatever butts against a cabinet's side at a height: face frame plus an overlay door, or 0. */
export function neighbourFace(cabinets: Cabinet[], c: Cabinet, side: 'left' | 'right', y: number, tol = 0.25): number {
  const edge = side === 'left' ? c.offset : c.offset + c.width;
  let face = 0;
  for (const o of cabinets) {
    if (o.id === c.id || o.wall !== c.wall || y < o.elevation - 1e-6 || y > o.elevation + o.height + 1e-6) continue;
    const touch = side === 'left' ? Math.abs(o.offset + o.width - edge) <= tol : Math.abs(o.offset - edge) <= tol;
    if (!touch) continue;
    const front = o.kind === 'pilaster' ? o.depth : o.depth + 0.75;
    face = Math.max(face, front);
  }
  return Math.min(face, c.depth);
}

/**
 * Open space between a cabinet's face frame edge and whatever is next to it on that side
 * (a neighbour, its end panel, or the wall end). null when nothing is within reach.
 */
export function gapBeside(room: Room, cabinets: Cabinet[], c: Cabinet, side: 'left' | 'right', s: ShopSettings, reach = 12): number | null {
  const len = wallLength(room, c.wall);
  const edge = side === 'left' ? c.offset : c.offset + c.width;
  let best: number | null = side === 'left' ? edge : len - edge;
  for (const o of cabinets) {
    if (o.id === c.id || o.wall !== c.wall || !(o.elevation < c.elevation + c.height && c.elevation < o.elevation + o.height)) continue;
    const e = extentsOf(room, cabinets, o, s);
    const g = side === 'left' ? edge - (o.offset + o.width + e.right) : o.offset - e.left - edge;
    if (g > -0.01 && g < best!) best = g;
  }
  return best != null && best > 0.01 && best <= reach ? Math.round(best * 16) / 16 : null;
}

/** Cabinets that share wall space with c at some height (the ones it could run into). */
const sameBand = (cabinets: Cabinet[], c: Cabinet) => cabinets.filter((o) => o.id !== c.id && o.wall === c.wall && o.elevation < c.elevation + c.height && c.elevation < o.elevation + o.height);
const r16 = (x: number) => Math.round(x * 16) / 16;

/**
 * The open stretch of wall a cabinet sits in: from the cabinet (or wall end) on its left to the one
 * on its right, end panels counted.
 */
export function openSpan(room: Room, cabinets: Cabinet[], c: Cabinet, s: ShopSettings): { left: number; right: number } {
  const mid = c.offset + c.width / 2;
  let left = 0, right = wallLength(room, c.wall);
  for (const o of sameBand(cabinets, c)) {
    const e = extentsOf(room, cabinets, o, s);
    if (o.offset + o.width / 2 < mid) left = Math.max(left, o.offset + o.width + e.right);
    else right = Math.min(right, o.offset - e.left);
  }
  return { left, right };
}

/**
 * Widen or narrow a cabinet so it fills its open stretch on one side (or both). A filled side ends
 * against the wall or a neighbour, so it's a hidden end with no end panel to allow for.
 */
export function fillSpan(room: Room, cabinets: Cabinet[], c: Cabinet, s: ShopSettings, side: 'left' | 'right' | 'both'): Pick<Cabinet, 'offset' | 'width'> {
  const span = openSpan(room, cabinets, c, s);
  const l = side === 'right' ? c.offset : span.left;
  const r = side === 'left' ? c.offset + c.width : span.right;
  return { offset: r16(l), width: r16(r - l) };
}

/**
 * The run c belongs to: the cabinets of the same kind, height and elevation beside it on the wall,
 * end to end, left to right.
 */
export function runOf(cabinets: Cabinet[], c: Cabinet): Cabinet[] {
  const like = cabinets.filter((o) => o.wall === c.wall && o.kind === c.kind && Math.abs(o.elevation - c.elevation) < 0.5 && Math.abs(o.height - c.height) < 0.5).sort((a, b) => a.offset - b.offset);
  const i = like.findIndex((o) => o.id === c.id);
  let a = i, b = i;
  // Neighbours within a pilaster's width count as the same run (a pilaster may sit between them)
  const touches = (x: Cabinet, y: Cabinet) => y.offset - (x.offset + x.width) < 8;
  while (a > 0 && touches(like[a - 1], like[a])) a--;
  while (b < like.length - 1 && touches(like[b], like[b + 1])) b++;
  return like.slice(a, b + 1);
}

/**
 * Make every cabinet in c's run the same width so the run fills its open stretch of wall, keeping
 * whatever sits between them (pilasters) where it belongs. Returns the new offset and width by id.
 */
export function evenRun(room: Room, cabinets: Cabinet[], c: Cabinet, s: ShopSettings): Map<string, Pick<Cabinet, 'offset' | 'width'>> {
  const run = runOf(cabinets, c);
  const ids = new Set(run.map((x) => x.id));
  const all = cabinets, cur = run;
  const first = cur[0], last = cur[cur.length - 1];
  // The run fills wall to wall (or to whatever bounds it): its two ends are hidden, no end panels
  const left = openSpan(room, all.filter((o) => !ids.has(o.id) || o.id === first.id), first, s).left;
  const right = openSpan(room, all.filter((o) => !ids.has(o.id) || o.id === last.id), last, s).right;
  // Whatever isn't one of the run's cabinets but sits between them keeps its width (pilasters, fillers)
  const between = all.filter((o) => !ids.has(o.id) && o.wall === c.wall && o.offset >= first.offset - 0.01 && o.offset + o.width <= last.offset + last.width + 0.01 && sameBand([o], { ...c, id: '' }).length);
  const fixed = between.reduce((t, o) => t + o.width, 0);
  // In sixteenths: any left over go one each on the first cabinets, so none differs by more than 1/16
  const units = Math.round((right - left - fixed) * 16);
  const base = Math.floor(units / cur.length), extra = units - base * cur.length;
  const widthOf = new Map(cur.map((o, i) => [o.id, (base + (i < extra ? 1 : 0)) / 16]));
  const order = [...cur, ...between].sort((a, b) => a.offset - b.offset);
  const next = new Map<string, Pick<Cabinet, 'offset' | 'width'>>();
  let x = left;
  for (const o of order) {
    if (ids.has(o.id)) { const width = widthOf.get(o.id)!; next.set(o.id, { offset: r16(x), width }); x += width; }
    else { next.set(o.id, { offset: r16(x), width: o.width }); x += o.width; }
  }
  return next;
}
