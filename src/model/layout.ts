import type { Cabinet, Room, ShopSettings, WallId } from './types';

export const wallNames: Record<WallId, string> = { back: 'Back wall', left: 'Left wall', right: 'Right wall', front: 'Front wall' };
export const wallOrder: WallId[] = ['back', 'left', 'right', 'front'];

export function wallLength(room: Room, wall: WallId): number {
  return wall === 'back' || wall === 'front' ? room.width : room.depth;
}

/**
 * Room coordinates: x = 0..width along the back wall, z = 0 (back wall) .. depth (front), y up.
 * Offsets along a wall are measured from its left end as you stand in the room facing it.
 */
export function wallTransform(room: Room, wall: WallId, offset: number): { pos: [number, number, number]; rotY: number } {
  switch (wall) {
    case 'back': return { pos: [offset, 0, 0], rotY: 0 };
    case 'left': return { pos: [0, 0, room.depth - offset], rotY: Math.PI / 2 };
    case 'right': return { pos: [room.width, 0, offset], rotY: -Math.PI / 2 };
    case 'front': return { pos: [room.width - offset, 0, room.depth], rotY: Math.PI };
  }
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

/** Room-space bounding box of the cabinet carcass and face frame (doors and counters excluded). */
export function footprint(room: Room, c: Cabinet): Footprint {
  const { pos, rotY } = wallTransform(room, c.wall, c.offset);
  const cos = Math.round(Math.cos(rotY));
  const sin = Math.round(Math.sin(rotY));
  const pts: [number, number][] = [[0, 0], [c.width, 0], [0, c.depth], [c.width, c.depth]].map(([lx, lz]) => [
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
export function findIssues(room: Room, cabinets: Cabinet[], _s: ShopSettings): Issue[] {
  const issues: Issue[] = [];
  const fps = cabinets.map((c) => footprint(room, c));
  cabinets.forEach((c, i) => {
    const len = wallLength(room, c.wall);
    if (c.offset < -EPS || c.offset + c.width > len + EPS) issues.push({ cabinetId: c.id, message: `${c.name} runs past the end of the wall` });
    if (c.elevation + c.height > room.height + EPS) issues.push({ cabinetId: c.id, message: `${c.name} is taller than the ceiling` });
    for (let j = i + 1; j < cabinets.length; j++) {
      if (overlaps(fps[i], fps[j])) issues.push({ cabinetId: c.id, message: `${c.name} overlaps ${cabinets[j].name}` }, { cabinetId: cabinets[j].id, message: `${cabinets[j].name} overlaps ${c.name}`, echo: true });
    }
  });
  return issues;
}

/** First open spot on a wall for a new cabinet at the given height range. */
export function nextFreeOffset(room: Room, cabinets: Cabinet[], wall: WallId, width: number, y0: number, y1: number): number {
  const len = wallLength(room, wall);
  const taken = cabinets
    .filter((c) => c.wall === wall && c.elevation < y1 && y0 < c.elevation + c.height)
    .map((c) => [c.offset, c.offset + c.width] as const)
    .sort((a, b) => a[0] - b[0]);
  let x = 0;
  for (const [a, b] of taken) {
    if (a - x >= width - EPS) return x;
    x = Math.max(x, b);
  }
  return x + width <= len + EPS ? x : Math.max(0, len - width);
}

/** Snap a dragged cabinet's left edge to wall ends and neighbouring cabinet edges. */
export function snapOffset(room: Room, cabinets: Cabinet[], moving: Cabinet, raw: number, tol = 1.5): number {
  const len = wallLength(room, moving.wall);
  const edges = [0, len];
  for (const c of cabinets) {
    if (c.id === moving.id || c.wall !== moving.wall) continue;
    edges.push(c.offset, c.offset + c.width);
  }
  let best = Math.round(raw * 16) / 16;
  let bestD = tol;
  for (const e of edges) {
    for (const cand of [e, e - moving.width]) {
      const d = Math.abs(raw - cand);
      if (d < bestD) { bestD = d; best = cand; }
    }
  }
  return best;
}

/**
 * Which case sides show. A side is hidden when it butts a wall end or a neighbouring cabinet
 * that overlaps it in height; anything else is a finished end unless the cabinet says otherwise.
 */
export function resolveEnds(room: Room, cabinets: Cabinet[], c: Cabinet): { left: boolean; right: boolean } {
  const tol = 0.125;
  const len = wallLength(room, c.wall);
  const neighbours = cabinets.filter(
    (o) => o.id !== c.id && o.wall === c.wall && o.elevation < c.elevation + c.height && c.elevation < o.elevation + o.height,
  );
  const autoLeft = c.offset > tol && !neighbours.some((o) => Math.abs(o.offset + o.width - c.offset) <= tol);
  const right = c.offset + c.width;
  const autoRight = right < len - tol && !neighbours.some((o) => Math.abs(o.offset - right) <= tol);
  const pick = (mode: Cabinet['leftEnd'], auto: boolean) => (mode === 'exposed' ? true : mode === 'hidden' ? false : auto);
  return { left: pick(c.leftEnd, autoLeft), right: pick(c.rightEnd, autoRight) };
}
