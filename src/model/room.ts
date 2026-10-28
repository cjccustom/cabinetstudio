// The room around the cabinets: doors, windows and cased openings with their casing, and the
// crown, baseboard and chair rail that run each wall, broken wherever a cabinet or a door casing
// gets in the way. Everything here is in wall coordinates: x along the wall from its left end
// (as you face it), y up from the floor, z out from the wall into the room.
import type { Cabinet, Floor, Opening, Project, RoomTrim, VisualBox, WallId } from './types';
import { footprint, wallLength, wallOrder, type Issue } from './layout';
import { mountShape, profileByNum, type MoldPiece } from './moldings';
import { uid } from './defaults';

export const defaultRoomTrim: RoomTrim = { chairHeight: 34, walls: ['back', 'left', 'right', 'front'] };
export const defaultFloor: Floor = { kind: 'hardwood', color: '#b98b5e', size: 3.25 };
export const roomTrimOf = (p: Project): RoomTrim => ({ ...defaultRoomTrim, ...p.roomTrim });
export const floorOf = (p: Project): Floor => ({ ...defaultFloor, ...p.floor });

/** Whether this job supplies and installs its doors or room trim, rather than only showing them in the design. */
export const inScope = (p: Project, what: 'doors' | 'roomTrim') => !!p.scope?.[what];

export const openingKinds = { door: 'Door', window: 'Window', cased: 'Cased opening', open: 'Wall opening, no trim' } as const;

export function newOpening(kind: Opening['kind'], wall: WallId, p: Project): Opening {
  const n = (p.openings ?? []).filter((o) => o.kind === kind).length + 1;
  const size = kind === 'door' ? { width: 32, height: 80, sill: 0 } : kind === 'window' ? { width: 36, height: 54, sill: 32 } : kind === 'open' ? { width: 36, height: p.room.height, sill: 0 } : { width: 48, height: 84, sill: 0 };
  const len = wallLength(p.room, wall);
  const name = kind === 'open' ? `Wall opening ${n}` : `${openingKinds[kind]} ${n}`;
  return { id: uid('open'), name, kind, wall, offset: Math.max(0, Math.round((len - size.width) / 2)), ...size, trim: { flat: kind === 'open' ? 0 : 3.5 } };
}

const thicknessOf = (num?: string) => { const p = profileByNum(num); return p ? mountShape(p) : null; };

/** How far the casing reaches out past the opening on each side, and above the head. */
export function casingReach(o: Opening): { side: number; head: number } {
  const t = o.trim;
  const c = thicknessOf(t.casing);
  const side = (c ? c.height : t.flat) + (thicknessOf(t.backBand)?.height ?? 0) * (t.casing ? 0 : 1);
  const head = side + (thicknessOf(t.headCap)?.height ?? 0);
  return { side, head };
}

/** Flat stock and mouldings for an opening's casing, in wall coordinates. */
export function openingTrim(o: Opening): { boxes: VisualBox[]; pieces: MoldPiece[]; flat: { label: string; length: number; width: number }[] } {
  const t = o.trim;
  const boxes: VisualBox[] = [];
  const pieces: MoldPiece[] = [];
  const flat: { label: string; length: number; width: number }[] = [];
  const x0 = o.offset, x1 = o.offset + o.width;
  const top = o.sill + o.height;
  const ft = 0.75;
  const legBottom = o.kind === 'window' ? o.sill : 0;
  const casing = profileByNum(t.casing);
  // Casing width: the profile's face, or the flat board's
  const cw = casing ? mountShape(casing).height : t.flat;
  if (cw <= 0) return { boxes, pieces, flat };
  const legLen = top + cw - legBottom;
  if (casing) {
    pieces.push({ kind: 'casing', num: casing.num, along: 'x', facing: 'front', vertical: 'left', x: x0, y: legBottom, z: 0, length: legLen });
    pieces.push({ kind: 'casing', num: casing.num, along: 'x', facing: 'front', vertical: 'right', x: x1, y: legBottom, z: 0, length: legLen });
    pieces.push({ kind: 'casing', num: casing.num, along: 'x', facing: 'front', x: x0 - cw, y: top, z: 0, length: o.width + 2 * cw });
  } else {
    // Flat stock: legs run up past the head; the head board sits between them, New England style
    boxes.push({ min: [x0 - cw, legBottom, 0], size: [cw, legLen, ft] }, { min: [x1, legBottom, 0], size: [cw, legLen, ft] });
    boxes.push({ min: [x0, top, 0], size: [o.width, cw, ft] });
    flat.push({ label: `${o.name} casing leg`, length: legLen, width: cw }, { label: `${o.name} casing leg`, length: legLen, width: cw }, { label: `${o.name} head casing`, length: o.width, width: cw });
    const bb = profileByNum(t.backBand);
    if (bb) {
      pieces.push({ kind: 'backBand', num: bb.num, along: 'x', facing: 'front', vertical: 'left', x: x0 - cw, y: legBottom, z: 0, length: legLen });
      pieces.push({ kind: 'backBand', num: bb.num, along: 'x', facing: 'front', vertical: 'right', x: x1 + cw, y: legBottom, z: 0, length: legLen });
      if (!t.headCap) pieces.push({ kind: 'backBand', num: bb.num, along: 'x', facing: 'front', x: x0 - cw - mountShape(bb).height, y: top + cw, z: 0, length: o.width + 2 * (cw + mountShape(bb).height) });
    }
  }
  const cap = profileByNum(t.headCap);
  const reach = cw + (casing ? 0 : thicknessOf(t.backBand)?.height ?? 0);
  // Header cap sits on the head and runs past the casing by 1/2" a side
  if (cap) pieces.push({ kind: 'headCap', num: cap.num, along: 'x', facing: 'front', x: x0 - reach - 0.5, y: top + cw, z: 0, length: o.width + 2 * (reach + 0.5) });
  if (o.kind === 'window') {
    const stool = profileByNum(t.stool);
    const st = stool ? Math.max(stool.t, 0.75) : 0;
    if (stool) {
      // Stool lies flat across the sill, with horns past the casing
      boxes.push({ min: [x0 - reach - 1, o.sill - st, -3], size: [o.width + 2 * (reach + 1), st, 3 + Math.min(stool.w, 4)] });
    }
    const apron = profileByNum(t.apron);
    if (apron) pieces.push({ kind: 'apron', num: apron.num, along: 'x', facing: 'front', x: x0 - cw, y: o.sill - st - mountShape(apron).height, z: 0, length: o.width + 2 * cw });
  }
  return { boxes, pieces, flat };
}

/** Lengths of A&M stool cap, which lies flat and so isn't drawn as an extruded profile. */
const stoolPieces = (o: Opening): MoldPiece[] => {
  const s = profileByNum(o.trim.stool);
  if (o.kind !== 'window' || !s) return [];
  const reach = casingReach(o).side;
  return [{ kind: 'stool', num: s.num, along: 'x', facing: 'front', x: 0, y: 0, z: 0, length: o.width + 2 * (reach + 1) }];
};

/** Stretches of a wall, between y0 and y1, that a cabinet, panel or opening's casing already covers. */
export function blockedAlong(p: Project, wall: WallId, y0: number, y1: number, opts: { windows: boolean } = { windows: true }): [number, number][] {
  const { width: W, depth: D } = p.room;
  const out: [number, number][] = [];
  const near = 1;
  const block = (c: Cabinet) => {
    if (c.elevation >= y1 || c.elevation + c.height <= y0) return;
    const f = footprint(p.room, c);
    if (wall === 'back' && f.z0 < near) out.push([f.x0, f.x1]);
    if (wall === 'front' && f.z1 > D - near) out.push([W - f.x1, W - f.x0]);
    if (wall === 'left' && f.x0 < near) out.push([D - f.z1, D - f.z0]);
    if (wall === 'right' && f.x1 > W - near) out.push([f.z0, f.z1]);
  };
  p.cabinets.forEach(block);
  for (const w of p.panels ?? []) if (w.wall === wall && w.bottom < y1 && w.bottom + w.height > y0) out.push([w.offset, w.offset + w.width]);
  for (const o of p.openings ?? []) {
    if (o.wall !== wall || (o.kind === 'window' && !opts.windows)) continue;
    const r = casingReach(o);
    const bottom = o.kind === 'window' ? o.sill - 1 : 0;
    if (bottom < y1 && o.sill + o.height + r.head > y0) out.push([o.offset - r.side, o.offset + o.width + r.side]);
  }
  return out;
}

/** What's left of a wall once the blocked stretches are taken out. */
export function freeRuns(len: number, blocked: [number, number][], min = 2): [number, number][] {
  const b = blocked.map(([a, c]) => [Math.max(0, a), Math.min(len, c)] as [number, number]).filter(([a, c]) => c > a).sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [];
  let x = 0;
  for (const [a, c] of b) {
    if (a - x >= min) out.push([x, a]);
    x = Math.max(x, c);
  }
  if (len - x >= min) out.push([x, len]);
  return out;
}

/** Room crown, base and chair rail for one wall, in its wall coordinates. */
export function roomMoldings(p: Project, wall: WallId): MoldPiece[] {
  const t = roomTrimOf(p);
  if (!t.walls.includes(wall)) return [];
  const len = wallLength(p.room, wall);
  const out: MoldPiece[] = [];
  const run = (kind: MoldPiece['kind'], num: string | undefined, y: (h: number) => number, windows: boolean) => {
    const prof = profileByNum(num);
    if (!prof) return;
    const m = mountShape(prof);
    const yy = y(m.height);
    for (const [a, b] of freeRuns(len, blockedAlong(p, wall, yy, yy + m.height, { windows }))) {
      out.push({ kind, num: prof.num, along: 'x', facing: 'front', x: a, y: yy, z: 0, length: b - a });
    }
  };
  run('roomCrown', t.crown, (h) => p.room.height - h, true);
  // Base and chair rail run under windows
  run('roomBase', t.base, () => 0, false);
  run('chairRail', t.chairRail, (h) => t.chairHeight - h, true);
  return out;
}

/** Every room moulding and casing piece, for ordering. */
export function roomMoldingPieces(p: Project): MoldPiece[] {
  const out: MoldPiece[] = [];
  for (const w of wallOrder) out.push(...roomMoldings(p, w));
  for (const o of p.openings ?? []) out.push(...openingTrim(o).pieces, ...stoolPieces(o));
  return out;
}

/** Flat casing boards, ripped from the trim stock along with the face frames. */
export const roomFlatStock = (p: Project) => (p.openings ?? []).flatMap((o) => openingTrim(o).flat);

/** Cabinets that run into a door, window or cased opening. */
export function openingIssues(p: Project): Issue[] {
  const out: Issue[] = [];
  for (const o of p.openings ?? []) {
    const r = casingReach(o);
    const top = o.sill + o.height + r.head;
    const bottom = o.kind === 'window' ? o.sill - 1 : 0;
    for (const c of p.cabinets) {
      if (c.wall !== o.wall) continue;
      if (c.elevation >= top || c.elevation + c.height <= bottom) continue;
      const a = Math.max(c.offset, o.offset - r.side), b = Math.min(c.offset + c.width, o.offset + o.width + r.side);
      if (b - a > 0.0625) out.push({ cabinetId: c.id, message: `Runs into ${o.name}${b - a < r.side + 0.01 ? ' casing' : ''} by ${Math.round((b - a) * 16) / 16}"` });
    }
  }
  return out;
}
