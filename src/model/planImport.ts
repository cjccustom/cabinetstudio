// Turn a CAD floor plan (Chief Architect's DWG/DXF export) into Cabinet Studio's room: the
// rectangle inside the walls, doors from their swing arcs, windows from the window layer, and
// cabinets from their outlines, with the gaps between full-height cabinets read as pilasters.
// Chief names layers like "Walls,  Normal", "Doors", "Windows", "Cabinets,  Full", "3D Solids";
// DWG/DXF turns the commas into underscores. Plans carry no heights, so those start as defaults.
import type { CadDrawing, CadEnt, Pt } from '../import/cad';
import type { Cabinet, CabinetKind, Opening, Project, Room, WallId } from './types';
import { alongWall } from './layout';
import { cabinetFromPreset, presets, uid } from './defaults';
import { defaultPilaster } from './pilaster';

/** Which side of the plan becomes the back wall (as drawn: top is +y). */
export type PlanSide = 'top' | 'bottom' | 'left' | 'right';

export interface PlanRect { L: number; R: number; B: number; T: number }

export interface PlanFound {
  rect: PlanRect;
  doors: { hinge: Pt; end: Pt; r: number }[];
  windows: { a: Pt; b: Pt }[];
  cabinets: { x0: number; x1: number; y0: number; y1: number; layer: string; label: string }[];
  solids: { x0: number; x1: number; y0: number; y1: number }[];
  roomName: string;
  /** Cabinet length along each side, to pick the back wall. */
  cabinetRun: Record<PlanSide, number>;
}

const isLayer = (re: RegExp) => (e: CadEnt) => re.test(e.layer.replace(/_/g, ','));
const near = (a: number, b: number, t = 0.05) => Math.abs(a - b) <= t;

/** Find the room's inside faces: per side, the long wall line nearest the middle. */
function roomRect(walls: CadEnt[]): PlanRect | null {
  const vert = new Map<number, number>(), horz = new Map<number, number>();
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const key = (v: number) => Math.round(v * 1000) / 1000;
  for (const e of walls) {
    const segs: [Pt, Pt][] = e.kind === 'line' ? [[e.a, e.b]] : e.kind === 'poly' ? e.pts.slice(1).map((p, i) => [e.pts[i], p] as [Pt, Pt]).concat(e.closed && e.pts.length > 2 ? [[e.pts[e.pts.length - 1], e.pts[0]]] : []) : [];
    for (const [a, b] of segs) {
      for (const p of [a, b]) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
      if (near(a[0], b[0])) vert.set(key(a[0]), (vert.get(key(a[0])) ?? 0) + Math.abs(a[1] - b[1]));
      else if (near(a[1], b[1])) horz.set(key(a[1]), (horz.get(key(a[1])) ?? 0) + Math.abs(a[0] - b[0]));
    }
  }
  if (!isFinite(minX)) return null;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const long = (m: Map<number, number>, span: number) => [...m].filter(([, len]) => len >= span * 0.3).map(([v]) => v);
  const xs = long(vert, maxY - minY), ys = long(horz, maxX - minX);
  const L = Math.max(...xs.filter((x) => x < cx)), R = Math.min(...xs.filter((x) => x > cx));
  const B = Math.max(...ys.filter((y) => y < cy)), T = Math.min(...ys.filter((y) => y > cy));
  if (![L, R, B, T].every(isFinite) || R - L < 24 || T - B < 24) return null;
  return { L, R, B, T };
}

/** The side of the room rectangle a point is on, if it's within a wall's thickness of it. */
function sideOf(r: PlanRect, p: Pt, band = 14): PlanSide | null {
  const d: [PlanSide, number][] = [['left', Math.abs(p[0] - r.L)], ['right', Math.abs(p[0] - r.R)], ['bottom', Math.abs(p[1] - r.B)], ['top', Math.abs(p[1] - r.T)]];
  const [s, dist] = d.sort((a, b) => a[1] - b[1])[0];
  return dist <= band ? s : null;
}

/** Everything the plan shows, in drawing units scaled to inches. */
export function readPlan(dwg: CadDrawing): PlanFound | null {
  const k = dwg.scale;
  const ents: CadEnt[] = dwg.ents.map((e) => {
    const s = (p: Pt): Pt => [p[0] * k, p[1] * k];
    if (e.kind === 'line') return { ...e, a: s(e.a), b: s(e.b) };
    if (e.kind === 'poly') return { ...e, pts: e.pts.map(s) };
    if (e.kind === 'arc') return { ...e, c: s(e.c), r: e.r * k };
    return { ...e, at: s(e.at) };
  });
  const walls = ents.filter(isLayer(/^walls?\b/i)).filter((e) => !/railing|foundation|invisible/i.test(e.layer));
  const rect = roomRect(walls);
  if (!rect) return null;
  // Doors: each swing arc is a leaf, hinged at its center; the end on the wall is the latch side
  const doors: PlanFound['doors'] = [];
  for (const e of ents.filter(isLayer(/^doors?\b/i))) {
    if (e.kind !== 'arc' || e.r < 12 || e.r > 48) continue;
    const ends: Pt[] = [e.a0, e.a1].map((a) => [e.c[0] + e.r * Math.cos(a), e.c[1] + e.r * Math.sin(a)]);
    const side = sideOf(rect, e.c);
    if (!side) continue;
    const onWall = (p: Pt) => (side === 'left' || side === 'right' ? Math.abs(p[0] - e.c[0]) : Math.abs(p[1] - e.c[1]));
    const end = ends.sort((a, b) => onWall(a) - onWall(b))[0];
    doors.push({ hinge: e.c, end, r: e.r });
  }
  // Windows: the window layer's lines, grouped along each wall
  const groups: { side: PlanSide; lo: number; hi: number }[] = [];
  for (const e of ents.filter(isLayer(/^windows?\b/i))) {
    const pts = e.kind === 'line' ? [e.a, e.b] : e.kind === 'poly' ? e.pts : [];
    if (!pts.length) continue;
    const mid: Pt = [pts.reduce((t, p) => t + p[0], 0) / pts.length, pts.reduce((t, p) => t + p[1], 0) / pts.length];
    const side = sideOf(rect, mid);
    if (!side) continue;
    const along = (p: Pt) => (side === 'left' || side === 'right' ? p[1] : p[0]);
    const lo = Math.min(...pts.map(along)), hi = Math.max(...pts.map(along));
    const g = groups.find((x) => x.side === side && lo <= x.hi + 1 && hi >= x.lo - 1);
    if (g) { g.lo = Math.min(g.lo, lo); g.hi = Math.max(g.hi, hi); } else groups.push({ side, lo, hi });
  }
  // Pieces found out of order can leave a window in two groups; join any that touch
  for (let merged = true; merged;) {
    merged = false;
    for (const g of groups) for (const h of groups) {
      if (g !== h && g.side === h.side && h.lo <= g.hi + 1 && h.hi >= g.lo - 1) { g.lo = Math.min(g.lo, h.lo); g.hi = Math.max(g.hi, h.hi); groups.splice(groups.indexOf(h), 1); merged = true; break; }
    }
  }
  const windows = groups.filter((g) => g.hi - g.lo >= 12).map((g) => {
    const at = (v: number): Pt => (g.side === 'left' ? [rect.L, v] : g.side === 'right' ? [rect.R, v] : g.side === 'top' ? [v, rect.T] : [v, rect.B]);
    return { a: at(g.lo), b: at(g.hi) };
  });
  // Cabinets: rectangles on the cabinet layers; labels are the text inside them
  const rects = (pred: (e: CadEnt) => boolean) => {
    const out: { x0: number; x1: number; y0: number; y1: number; layer: string }[] = [];
    for (const e of ents.filter(pred)) {
      if (e.kind !== 'poly' || e.pts.length < 4) continue;
      const xs = e.pts.map((p) => p[0]), ys = e.pts.map((p) => p[1]);
      const r = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), layer: e.layer };
      if (!out.some((o) => near(o.x0, r.x0, 0.1) && near(o.x1, r.x1, 0.1) && near(o.y0, r.y0, 0.1) && near(o.y1, r.y1, 0.1))) out.push(r);
    }
    return out;
  };
  const labels = ents.filter((e) => e.kind === 'text' && /cabinet/i.test(e.layer) && /label/i.test(e.layer)) as Extract<CadEnt, { kind: 'text' }>[];
  const cabinets = rects((e) => /cabinet/i.test(e.layer) && !/label|indicator|module|countertop|backsplash|door|soffit/i.test(e.layer))
    .filter((r) => r.x1 - r.x0 >= 4 && r.y1 - r.y0 >= 4)
    .map((r) => ({ ...r, label: labels.find((t) => t.at[0] >= r.x0 && t.at[0] <= r.x1 && t.at[1] >= r.y0 && t.at[1] <= r.y1)?.text ?? '' }));
  const solids = rects(isLayer(/3d solid/i));
  const roomName = (ents.find((e) => e.kind === 'text' && /room label/i.test(e.layer) && !/sq ?ft|ft²/i.test(e.text)) as { text?: string } | undefined)?.text ?? '';
  const cabinetRun: Record<PlanSide, number> = { top: 0, bottom: 0, left: 0, right: 0 };
  for (const c of cabinets) {
    const s = sideOf(rect, [(c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2], 40);
    if (s) cabinetRun[s] += s === 'left' || s === 'right' ? c.y1 - c.y0 : c.x1 - c.x0;
  }
  return { rect, doors, windows, cabinets, solids, roomName, cabinetRun };
}

/** The side with the most cabinets becomes the back wall. */
export const defaultBack = (f: PlanFound): PlanSide => (['top', 'bottom', 'left', 'right'] as PlanSide[]).sort((a, b) => f.cabinetRun[b] - f.cabinetRun[a] || (a === 'top' ? -1 : 1))[0];

/** Plan point to room coordinates, with `back` turned to the back wall. */
function transform(r: PlanRect, back: PlanSide) {
  switch (back) {
    case 'top': return { width: r.R - r.L, depth: r.T - r.B, f: (p: Pt): Pt => [p[0] - r.L, r.T - p[1]] };
    case 'bottom': return { width: r.R - r.L, depth: r.T - r.B, f: (p: Pt): Pt => [r.R - p[0], p[1] - r.B] };
    case 'left': return { width: r.T - r.B, depth: r.R - r.L, f: (p: Pt): Pt => [r.T - p[1], p[0] - r.L] };
    case 'right': return { width: r.T - r.B, depth: r.R - r.L, f: (p: Pt): Pt => [p[1] - r.B, r.R - p[0]] };
  }
}

/** Which room wall an (x, z) point is against. */
function wallAt(room: Room, x: number, z: number): WallId {
  const d: [WallId, number][] = [['back', z], ['front', room.depth - z], ['left', x], ['right', room.width - x]];
  return d.sort((a, b) => a[1] - b[1])[0][0];
}

const kindOf = (layer: string, label: string): CabinetKind => {
  const l = layer.replace(/_/g, ',');
  if (/full|tall/i.test(l)) return 'tall';
  if (/wall|upper/i.test(l)) return 'wall';
  if (/base/i.test(l)) return 'base';
  return /^[UW]/i.test(label) ? 'wall' : /^[FT]/i.test(label) ? 'tall' : 'base';
};

/** Chief labels run type, width, depth, height ("U321299" is 32 W × 12 D × 99 H); take the height if it reads that way. */
function labelHeight(label: string, w: number, d: number): number | null {
  const digits = label.replace(/^[A-Za-z]+/, '').match(/^\d+/)?.[0];
  if (!digits) return null;
  const W = String(Math.round(w)), D = String(Math.round(d));
  if (digits.startsWith(W + D)) { const h = Number(digits.slice(W.length + D.length)); return h >= 6 && h <= 144 ? h : null; }
  return null;
}

export interface PlanResult {
  room: Pick<Room, 'width' | 'depth'>;
  openings: Opening[];
  cabinets: Cabinet[];
  notes: string[];
  roomName: string;
}

/** Build the room, openings and cabinets, with the chosen side as the back wall. */
export function planToProject(f: PlanFound, back: PlanSide, height: number): PlanResult {
  const t = transform(f.rect, back);
  const room: Room = { width: round(t.width), depth: round(t.depth), height } as Room;
  const notes: string[] = [`Room ${fmtIn(room.width)} × ${fmtIn(room.depth)} inside the walls.`];
  const place = (p: Pt) => { const [x, z] = t.f(p); const wall = wallAt(room, x, z); return { wall, along: alongWall(room, wall, x, z) }; };
  const alongOn = (wall: WallId, p: Pt) => { const [x, z] = t.f(p); return alongWall(room, wall, x, z); };
  const openings: Opening[] = [];
  // Doors: the leaf plus a 3/4" jamb each side; hinges on the side nearer the start of the wall
  f.doors.forEach((d, i) => {
    const h = place(d.hinge), e = place(d.end);
    const lo = Math.min(h.along, e.along), hi = Math.max(h.along, e.along);
    openings.push({ id: uid('open'), name: `Door ${i + 1}`, kind: 'door', wall: h.wall, offset: round(lo - 0.75), width: round(hi - lo + 1.5), height: 80, sill: 0, trim: { flat: 3.5 },
      door: { hinge: h.along < e.along ? 'left' : 'right', leaves: 1, prehung: false } });
  });
  f.windows.forEach((w, i) => {
    const a = place(w.a), b = place(w.b);
    openings.push({ id: uid('open'), name: `Window ${i + 1}`, kind: 'window', wall: a.wall, offset: round(Math.min(a.along, b.along)), width: round(Math.abs(b.along - a.along)), height: 54, sill: 32, trim: { flat: 3.5 } });
  });
  if (f.doors.length || f.windows.length) notes.push(`${f.doors.length} door${f.doors.length === 1 ? '' : 's'} and ${f.windows.length} window${f.windows.length === 1 ? '' : 's'}; widths and positions from the plan, heights are defaults (80" doors, 54" windows on a 32" sill) until you set them.`);
  // Cabinets: width along the wall they back onto, depth out from it
  const cabs: Cabinet[] = [];
  const placedCabs: { c: Cabinet; lo: number; hi: number }[] = [];
  for (const r of f.cabinets) {
    const corners: Pt[] = [[r.x0, r.y0], [r.x1, r.y1]].map((p) => t.f(p as Pt));
    const x0 = Math.min(corners[0][0], corners[1][0]), x1 = Math.max(corners[0][0], corners[1][0]);
    const z0 = Math.min(corners[0][1], corners[1][1]), z1 = Math.max(corners[0][1], corners[1][1]);
    const dist: [WallId, number][] = [['back', z0], ['front', room.depth - z1], ['left', x0], ['right', room.width - x1]];
    const wall = dist.sort((a, b) => a[1] - b[1])[0][0];
    const alongs = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].map(([x, z]) => alongWall(room, wall, x, z));
    const along0 = Math.min(...alongs), along1 = Math.max(...alongs);
    const w = along1 - along0, dpt = wall === 'back' || wall === 'front' ? z1 - z0 : x1 - x0;
    const kind = kindOf(r.layer, r.label);
    const preset = presets.find((p) => p.id === (kind === 'tall' ? 'tall-open' : kind === 'wall' ? (w > 24 ? 'wall-2' : 'wall-1') : w > 24 ? 'base-1dr2' : 'base-1dr'))!;
    const c = cabinetFromPreset(preset, wall, round(along0), [...cabs]);
    c.width = round(w); c.depth = round(dpt);
    const h = labelHeight(r.label, w, dpt);
    if (h) c.height = h;
    if (r.label) c.notes = [{ id: uid('note'), text: `Chief label ${r.label}`, for: 'shop' }];
    cabs.push(c);
    placedCabs.push({ c, lo: c.offset, hi: c.offset + c.width });
  }
  // Pilasters: a gap between full-height cabinets on one wall with a 3D solid face in it (Chief's pilaster fronts)
  const pil: Cabinet[] = [];
  for (const wall of ['back', 'left', 'right', 'front'] as WallId[]) {
    const run = placedCabs.filter((p) => p.c.wall === wall && p.c.kind === 'tall').sort((a, b) => a.lo - b.lo);
    const edges = run.length ? [0, ...run.flatMap((p) => [p.lo, p.hi]), wallLength(room, wall)] : [];
    for (let i = 0; i + 1 < edges.length; i += 2) {
      const lo = edges[i], hi = edges[i + 1];
      if (hi - lo < 2 || hi - lo > 12) continue;
      const nb = run.find((p) => near(p.hi, lo, 0.1) || near(p.lo, hi, 0.1))!.c;
      const off = (pt: Pt) => { const [x, z] = t.f(pt); return wall === 'back' ? z : wall === 'front' ? room.depth - z : wall === 'left' ? x : room.width - x; };
      const solid = f.solids.find((s) => {
        const a = alongOn(wall, [s.x0, s.y0]), b = alongOn(wall, [s.x1, s.y1]);
        return Math.min(a, b) <= lo + 0.5 && Math.max(a, b) >= hi - 0.5 && Math.max(off([s.x0, s.y0]), off([s.x1, s.y1])) <= nb.depth + 3;
      });
      if (!solid && lo > 0.1 && hi < wallLength(room, wall) - 0.1) continue;
      const proud = solid ? round(Math.min(solid.x1 - solid.x0, solid.y1 - solid.y0)) : 0.75;
      const p = cabinetFromPreset(presets.find((x) => x.id === 'pilaster')!, wall, round(lo), [...cabs, ...pil]);
      Object.assign(p, { width: round(hi - lo), height: nb.height, depth: nb.depth, pilaster: { ...defaultPilaster, proud } });
      pil.push(p);
    }
  }
  if (cabs.length) notes.push(`${cabs.length} cabinet${cabs.length === 1 ? '' : 's'}${pil.length ? ` and ${pil.length} pilaster${pil.length === 1 ? '' : 's'}` : ''}: widths, depths and places from the plan; heights from Chief's labels where they read clearly, otherwise defaults. Openings, doors and drawers are defaults to edit.`);
  return { room, openings, cabinets: [...pil, ...cabs].sort((a, b) => a.wall.localeCompare(b.wall) || a.offset - b.offset), notes, roomName: f.roomName };
}

const wallLength = (room: Room, wall: WallId) => (wall === 'back' || wall === 'front' ? room.width : room.depth);
const round = (v: number) => Math.round(v * 1000) / 1000;
const fmtIn = (v: number) => {
  const s = Math.round(v * 16), w = Math.floor(s / 16);
  let r = s % 16, d = 16;
  while (r && r % 2 === 0) { r /= 2; d /= 2; }
  return r ? `${w} ${r}/${d}"` : `${w}"`;
};

/** Apply an import to a project: room size, openings and cabinets replaced; everything else kept. */
export function applyPlan(p: Project, r: PlanResult, name?: string): Project {
  return { ...p, name: name || p.name, room: { ...p.room, width: r.room.width, depth: r.room.depth }, openings: r.openings, cabinets: r.cabinets };
}
