// Case pieces: nightstands, dressers, chests, sideboards and media consoles. A plywood case with a
// solid wood top, standing on legs or a set-back plinth, its face divided into rows of drawers,
// doors or open shelves (a row can be split two or three across). Fronts are full overlay with
// 1/8" gaps, or inset in a face frame. The hours are starting standards for one-off case furniture
// in a cabinet shop, to be adjusted as Cody builds them.
//
// Piece-local coordinates: x across the width (0 at the middle), y up from the floor, z front to
// back (0 at the middle, the front at +z).
import type { Project } from './types';
import { uid } from './defaults';
import { amPerBF } from './faceframe';
import { eaglePrice } from './eagle';
import type { TableBox, TablePart } from './tableParts';
import type { TableFinish } from './furniture';
import { tableFinishLabel } from './furniture';
import { fmt } from '../units';
import { applyEdits, editHours } from './pieceEdits';

export type CaseKind = 'nightstand' | 'dresser' | 'chest' | 'sideboard' | 'media';
export interface CaseRow {
  id: string;
  type: 'drawer' | 'doors' | 'open';
  /** Height on the face, front edge to front edge; null = share what's left with the other null rows. */
  h: number | null;
  /** Side by side across the width: 1, 2 or 3. */
  split: 1 | 2 | 3;
  /** Doors and open rows: adjustable shelves inside. */
  shelves?: number;
}

export interface CasePiece {
  /** Hand changes after the builder laid it out (see pieceEdits.ts). */
  edits?: import('./pieceEdits').PieceEdits['edits'];
  added?: import('./pieceEdits').PieceEdits['added'];
  id: string;
  name: string;
  kind: CaseKind;
  /** How many alike (a pair of nightstands): the second and later ones go faster, layout and setups done once. */
  qty?: number;
  /** Overall, top included. */
  width: number;
  depth: number;
  height: number;
  /** legs: the case stands on four legs. plinth: a base set back under the case. */
  base: 'legs' | 'plinth';
  /** Floor to the bottom of the case. */
  baseH: number;
  leg: 'tapered' | 'square' | 'turned';
  legSize: number;
  /** Solid top: thickness and how far it overhangs the case at the front and sides. */
  topT: number;
  overhang: number;
  /** The face, top to bottom. */
  rows: CaseRow[];
  /** overlay: fronts cover the case edges. inset: fronts set into a face frame, flush. */
  fronts: 'overlay' | 'inset';
  frontStyle: 'slab' | 'shaker';
  hardware: 'knobs' | 'pulls' | 'none';
  species: string;
  grade: 'paint' | 'stain';
  finish: TableFinish;
  finishPrice: number;
  /** Lumber price per board foot typed in; 0 = A&M's list price for the species. */
  pricePerBF: number;
  notes: string;
  /** Where it stands: its back against a wall (unset = the back wall), its center along it. */
  wall?: 'back' | 'left' | 'right' | 'front';
  offset?: number;
}

const row = (type: CaseRow['type'], h: number | null, split: CaseRow['split'] = 1, shelves?: number): CaseRow => ({ id: uid('crow'), type, h, split, ...(shelves != null ? { shelves } : {}) });

const base = (): Omit<CasePiece, 'kind' | 'name' | 'width' | 'depth' | 'height' | 'rows'> => ({
  id: uid('case'), base: 'legs', baseH: 6, leg: 'tapered', legSize: 1.5, topT: 0.875, overhang: 0.75,
  fronts: 'overlay', frontStyle: 'slab', hardware: 'knobs', species: 'Poplar', grade: 'paint', finish: 'paint', finishPrice: 0, pricePerBF: 0, notes: '',
});

/** Each kind starts at sizes and a face that suit it. */
export function newCase(kind: CaseKind): CasePiece {
  switch (kind) {
    case 'dresser': return { ...base(), kind, name: 'Dresser', width: 60, depth: 20, height: 34, base: 'plinth', baseH: 3.5, rows: [row('drawer', 7, 2), row('drawer', null), row('drawer', null), row('drawer', null)] };
    case 'chest': return { ...base(), kind, name: 'Chest of drawers', width: 36, depth: 20, height: 50, base: 'plinth', baseH: 3.5, rows: [row('drawer', 6.5, 2), row('drawer', 7.5), row('drawer', 8.5), row('drawer', 9.5), row('drawer', null)] };
    case 'sideboard': return { ...base(), kind, name: 'Sideboard', width: 66, depth: 18, height: 36, baseH: 8, legSize: 2, rows: [row('drawer', 5, 3), row('doors', null, 3, 1)] };
    case 'media': return { ...base(), kind, name: 'Media console', width: 72, depth: 18, height: 24, base: 'plinth', baseH: 3, rows: [row('open', 6, 3), row('doors', null, 3, 1)] };
    default: return { ...base(), kind: 'nightstand', name: 'Nightstand', width: 22, depth: 16, height: 26, baseH: 8, rows: [row('drawer', 5.5), row('drawer', null)] };
  }
}

export const casesOf = (p: Project): CasePiece[] => (p.cases ?? []).map((c) => ({ ...newCase((c.kind as CaseKind) ?? 'nightstand'), ...c } as CasePiece));

/** Plywood, back, gaps and the face frame's stiles and rails. */
const PLY = 0.75, BACK = 0.25, GAP = 0.125, FF = 1.5, FRONT_T = 0.75, SETBACK = 1;

const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): TableBox => ({ min: [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)], size: [Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)] });

/** The case: outside width and depth (the top overhangs it), bottom and top of the case. */
export function caseSize(c: CasePiece): { cw: number; cd: number; y0: number; y1: number; faceZ: number } {
  const cw = c.width - 2 * c.overhang, cd = c.depth - c.overhang;
  return { cw, cd, y0: c.baseH, y1: c.height - c.topT, faceZ: c.depth / 2 - c.overhang };
}

/** Each row's height on the face (fixed rows as set, the rest sharing what's left), top to bottom. */
export function rowHeights(c: CasePiece): number[] {
  const { y0, y1 } = caseSize(c);
  const face = y1 - y0;
  const fixed = c.rows.reduce((t, r) => t + (r.h ?? 0), 0);
  const free = c.rows.filter((r) => r.h == null).length;
  const each = free ? Math.max(0, (face - fixed) / free) : 0;
  return c.rows.map((r) => r.h ?? each);
}

/** One opening on the face: its row, its place across, and its rectangle on the case face. */
export interface CaseOpening { row: number; col: number; type: CaseRow['type']; x0: number; x1: number; y0: number; y1: number }
export function caseOpenings(c: CasePiece): CaseOpening[] {
  const { cw, y1 } = caseSize(c);
  const hs = rowHeights(c);
  const out: CaseOpening[] = [];
  let top = y1;
  c.rows.forEach((r, i) => {
    const bottom = top - hs[i];
    for (let k = 0; k < r.split; k++) out.push({ row: i, col: k, type: r.type, x0: -cw / 2 + (k * cw) / r.split, x1: -cw / 2 + ((k + 1) * cw) / r.split, y0: bottom, y1: top });
    top = bottom;
  });
  return out;
}

/** The piece's parts, placed: the 3D draws them, the estimate counts them. */
export function caseParts(c: CasePiece): TablePart[] {
  const { cw, cd, y0, y1, faceZ } = caseSize(c);
  const out: TablePart[] = [];
  const back = faceZ - cd, hw = cw / 2, inset = c.fronts === 'inset';
  // The case's front edges sit behind the overlay fronts, or behind the face frame
  const caseFront = faceZ - FRONT_T;
  const sheet = c.grade === 'paint' ? 'paint-grade birch' : `${c.species.toLowerCase()}`;
  // Top: solid, glued up, overhanging the case
  out.push({ role: 'top', name: 'Top', qty: 1, length: c.width, width: c.depth, thick: c.topT, note: 'glued up from boards about 5" wide; fastened with figure-8s or buttons so it can move', boxes: [box(-c.width / 2, y1, -c.depth / 2, c.width / 2, c.height, c.depth / 2)] });
  // Case: sides, bottom, sub-top, back
  out.push({ role: 'apron', name: 'Case side', qty: 2, length: cd - FRONT_T, width: y1 - y0, thick: PLY, note: `3/4" ${sheet} plywood, front edge banded solid`, boxes: [box(-hw, y0, back, -hw + PLY, y1, caseFront), box(hw - PLY, y0, back, hw, y1, caseFront)] });
  out.push({ role: 'apron', name: 'Case bottom and sub-top', qty: 2, length: cw - 2 * PLY, width: cd - FRONT_T - BACK, thick: PLY, note: `3/4" ${sheet} plywood, dadoed into the sides`, boxes: [box(-hw + PLY, y0, back + BACK, hw - PLY, y0 + PLY, caseFront), box(-hw + PLY, y1 - PLY, back + BACK, hw - PLY, y1, caseFront)] });
  out.push({ role: 'apron', name: 'Back', qty: 1, length: cw - 2 * PLY, width: y1 - y0, thick: BACK, note: '1/4" plywood in a rabbet', boxes: [box(-hw + PLY, y0, back, hw - PLY, y1, back + BACK)] });
  if (inset) {
    // Face frame: stiles full height, rails at the top, bottom and between rows
    out.push({ role: 'stretcher', name: 'Face frame stile', qty: 2, length: y1 - y0, width: FF, thick: FRONT_T, note: 'solid, glued to the case front', boxes: [box(-hw, y0, caseFront, -hw + FF, y1, faceZ), box(hw - FF, y0, caseFront, hw, y1, faceZ)] });
  }
  // Dividers between rows and within split rows (web frames in plywood), and the openings' fronts
  const ops = caseOpenings(c);
  const rowsY = [...new Set(ops.map((o) => o.y0))].filter((y) => y > y0 + 0.01);
  if (rowsY.length) out.push({ role: inset ? 'stretcher' : 'shelf', name: inset ? 'Face frame rail and web frame' : 'Divider between rows', qty: rowsY.length, length: cw - 2 * PLY, width: cd - FRONT_T - BACK, thick: PLY, note: inset ? 'web frame with a solid rail at the front, flush with the frame' : 'plywood web frame, dadoed into the sides; drawers run on slides', boxes: rowsY.map((y) => box(-hw + PLY, y - PLY / 2, back + BACK, hw - PLY, y + PLY / 2, inset ? faceZ : caseFront)) });
  if (inset) out.push({ role: 'stretcher', name: 'Face frame top and bottom rail', qty: 2, length: cw - 2 * FF, width: FF, thick: FRONT_T, boxes: [box(-hw + FF, y1 - FF, caseFront, hw - FF, y1, faceZ), box(-hw + FF, y0, caseFront, hw - FF, y0 + FF, faceZ)] });
  const vdiv = ops.filter((o) => o.col > 0);
  if (vdiv.length) out.push({ role: inset ? 'stretcher' : 'shelf', name: inset ? 'Face frame mid stile and divider' : 'Divider between openings', qty: vdiv.length, length: Math.max(...vdiv.map((o) => o.y1 - o.y0 - PLY)), width: cd - FRONT_T - BACK, thick: PLY, note: 'plywood, between the web frames', boxes: vdiv.map((o) => box(o.x0 - PLY / 2, o.y0 + PLY / 2, back + BACK, o.x0 + PLY / 2, o.y1 - PLY / 2, inset ? faceZ : caseFront)) });
  // Fronts: overlay ones cover the opening with half a gap all round; inset ones sit inside the frame with a 3/32" reveal
  type Front = { o: CaseOpening; b: TableBox; w: number; h: number; knob: -1 | 1 };
  const fronts: Front[] = [];
  const doorsIn: Front[] = [];
  for (const o of ops) {
    if (o.type === 'open') continue;
    const inX = (x: number, side: -1 | 1) => (inset ? x + side * ((Math.abs(x) > hw - 0.01 ? FF : PLY / 2) + 0.09375) : x + side * GAP / 2);
    const inY = (y: number, side: -1 | 1) => (inset ? y + side * ((y >= y1 - 0.01 || y <= y0 + 0.01 ? FF : PLY / 2) + 0.09375) : y + side * GAP / 2);
    const fx0 = inX(o.x0, 1), fx1 = inX(o.x1, -1), fy0 = inY(o.y0, 1), fy1 = inY(o.y1, -1);
    // A door wider than 24" becomes a pair
    const pair = o.type === 'doors' && fx1 - fx0 > 24;
    const pieces = pair ? [[fx0, (fx0 + fx1) / 2 - GAP / 2], [(fx0 + fx1) / 2 + GAP / 2, fx1]] : [[fx0, fx1]];
    pieces.forEach(([a, b2], k) => {
      const bx = box(a, fy0, inset ? caseFront : faceZ, b2, fy1, inset ? faceZ : faceZ + FRONT_T);
      // Knob on the free edge: a pair meets in the middle; a single door hinges on the side nearer the piece's end
      const knob: -1 | 1 = pair ? (k === 0 ? 1 : -1) : (a + b2) / 2 < 0 ? 1 : -1;
      (o.type === 'drawer' ? fronts : doorsIn).push({ o, b: bx, w: b2 - a, h: fy1 - fy0, knob });
    });
  }
  const styleNote = c.frontStyle === 'shaker' ? 'five-piece, flat recessed panel' : `solid ${c.grade === 'paint' ? 'poplar or MDF' : c.species.toLowerCase()}, slab`;
  if (fronts.length) out.push({ role: 'breadboard', name: 'Drawer front', qty: fronts.length, length: Math.max(...fronts.map((f) => f.w)), width: Math.max(...fronts.map((f) => f.h)), thick: FRONT_T, note: `${styleNote}; ${c.fronts}`, boxes: fronts.map((f) => f.b) });
  if (doorsIn.length) out.push({ role: 'breadboard', name: 'Door', qty: doorsIn.length, length: Math.max(...doorsIn.map((f) => f.h)), width: Math.max(...doorsIn.map((f) => f.w)), thick: FRONT_T, note: `${styleNote}; ${c.fronts}, concealed hinges`, boxes: doorsIn.map((f) => f.b) });
  // Shelves in open and door rows
  const shelfBoxes: TableBox[] = [];
  c.rows.forEach((r, i) => {
    if (r.type === 'drawer' || !r.shelves) return;
    for (const o of ops.filter((x) => x.row === i)) for (let k = 1; k <= r.shelves; k++) {
      const y = o.y0 + ((o.y1 - o.y0) * k) / (r.shelves + 1);
      shelfBoxes.push(box(o.x0 + (o.col ? PLY / 2 : PLY), y - PLY / 2, back + BACK, o.x1 - (o.col < r.split - 1 ? PLY / 2 : PLY), y + PLY / 2, caseFront - 0.25));
    }
  });
  if (shelfBoxes.length) out.push({ role: 'shelf', name: 'Adjustable shelf', qty: shelfBoxes.length, length: Math.max(...shelfBoxes.map((b) => b.size[0])), width: cd - FRONT_T - BACK - 0.25, thick: PLY, note: 'plywood, solid edge, on shelf pins', boxes: shelfBoxes });
  // Hardware: a knob per front (two on a drawer over 20" wide), or a pull
  if (c.hardware !== 'none') {
    const hb: TableBox[] = [];
    const z = (inset ? faceZ : faceZ + FRONT_T);
    for (const f of fronts) {
      const cy = f.b.min[1] + f.h / 2, cx = f.b.min[0] + f.w / 2;
      const xs = f.w > 24 ? [cx - f.w / 4, cx + f.w / 4] : [cx];
      for (const x of xs) hb.push(c.hardware === 'knobs' ? box(x - 0.6, cy - 0.6, z, x + 0.6, cy + 0.6, z + 1.1) : box(x - 2.5, cy - 0.25, z + 0.6, x + 2.5, cy + 0.25, z + 1.1));
    }
    for (const d of doorsIn) {
      // On the free edge, a few inches down from the top
      const x = d.knob > 0 ? d.b.min[0] + d.w - 1.5 : d.b.min[0] + 1.5, cy = d.b.min[1] + d.h - Math.min(4, d.h / 3);
      hb.push(c.hardware === 'knobs' ? box(x - 0.6, cy - 0.6, z, x + 0.6, cy + 0.6, z + 1.1) : box(x - 0.25, cy - 2.5, z + 0.6, x + 0.25, cy + 2.5, z + 1.1));
    }
    if (hb.length) out.push({ role: 'post', name: c.hardware === 'knobs' ? 'Knob' : 'Pull', qty: hb.length, length: c.hardware === 'knobs' ? 1.25 : 5, width: 1, thick: 1, note: 'by the homeowner, or an allowance', boxes: hb });
  }
  // Base: four legs at the case corners, or a set-back plinth
  if (c.base === 'legs' && c.baseH > 0) {
    const s = c.legSize, tz = c.leg === 'tapered' ? Math.max(0.75, s * 0.55) : undefined;
    const lz0 = back, lz1 = faceZ - (inset ? 0 : FRONT_T);
    out.push({ role: 'leg', name: `Leg${c.leg === 'tapered' ? ', tapered' : c.leg === 'turned' ? ', turned' : ''}`, qty: 4, length: c.baseH, width: s, thick: s, note: 'bolted up through a corner block in the case bottom',
      ...(tz ? { taperTo: tz } : {}), ...(c.leg === 'turned' ? { turned: true } : {}),
      boxes: [box(-hw, 0, lz0, -hw + s, c.baseH, lz0 + s), box(hw - s, 0, lz0, hw, c.baseH, lz0 + s), box(-hw, 0, lz1 - s, -hw + s, c.baseH, lz1), box(hw - s, 0, lz1 - s, hw, c.baseH, lz1)] });
  } else if (c.base === 'plinth' && c.baseH > 0) {
    const px = hw - SETBACK, pz1 = faceZ - SETBACK - (inset ? 0 : FRONT_T);
    out.push({ role: 'apron', name: 'Plinth', qty: 1, length: 2 * px * 2 + 2 * (pz1 - back), width: c.baseH, thick: PLY, note: `set back ${fmt(SETBACK)} at the front and sides, mitered at the front corners, leveled`, boxes: [box(-px, 0, pz1 - PLY, px, c.baseH, pz1), box(-px, 0, back, -px + PLY, c.baseH, pz1), box(px - PLY, 0, back, px, c.baseH, pz1)] });
  }
  return applyEdits(out, c);
}

/** Drawer slides come in 3" steps; the longest that fits the case depth. */
export function slideLength(c: CasePiece): number {
  const { cd } = caseSize(c);
  return Math.max(12, Math.floor((cd - FRONT_T - BACK - 1) / 3) * 3);
}

/** Things to check on the design, in plain words. */
export function caseChecks(c: CasePiece): string[] {
  const out: string[] = [];
  const ops = caseOpenings(c);
  const low = ops.filter((o) => o.type === 'drawer' && o.y1 - o.y0 - 2 < 2.5);
  if (low.length) out.push(`A drawer row is only ${fmt(Math.min(...low.map((o) => o.y1 - o.y0)))} on the face; under about 4-1/2" the box inside holds little.`);
  if (rowHeights(c).some((h) => h < 0.01)) out.push('The rows set by height use up the whole face: lower one so the others have room.');
  if (c.kind === 'nightstand' && (c.height < 22 || c.height > 30)) out.push(`At ${fmt(c.height)} high, check it against the bed: a nightstand top usually sits within 2" of the mattress top (about 24"–28").`);
  if (c.kind === 'media' && c.height > 30) out.push('A media console above about 30" puts the TV high for seated viewing.');
  if (ops.some((o) => o.type === 'drawer' && o.x1 - o.x0 > 36)) out.push('A drawer over 36" wide racks when pulled from one side: split the row, or use two knobs and a heavier slide.');
  if (c.depth < 14 && ops.some((o) => o.type === 'drawer')) out.push(`A ${fmt(c.depth)} deep case takes a ${slideLength(c)}" slide; drawers that short hold little.`);
  if (c.base === 'legs' && c.baseH > 0 && c.width > 48 && c.legSize < 2) out.push('A case this wide on four slim legs: go to 2" legs, or add a fifth and sixth leg under the middle.');
  if (c.kind === 'chest' || c.height > 40) out.push('Tall and narrow: anchor it to the wall with a furniture strap so it can’t tip with drawers open.');
  return out;
}

/** Labor standards for case pieces, in hours. */
export const caseStandards = {
  layout: 1.5,
  caseBase: 3, casePerSqFt: 0.08, divider: 0.4, faceFrame: 2, faceFramePerOpening: 0.3,
  top: 1.5, topPerSqFt: 0.12,
  drawerFit: 1.25, insetFit: 0.5, frontSlab: 0.4, frontShaker: 1.25, doorFit: 0.75, doorSlab: 0.6, doorShaker: 2,
  shelf: 0.3, legs: 1.5, legTaper: 0.75, legTurned: 1.5, plinth: 1.5,
  sandPerSqFt: 0.05, finishBase: { clear: 1.5, stain: 2.5, paint: 2.5, oil: 1, painter: 0 } as Record<TableFinish, number>, finishPerSqFt: 0.06,
  /** Each one after the first, as a share of the first one's hours (layout once, setups shared). */
  repeat: 0.6,
  delivery: 1, deliveryPerCuFt: 0.06,
};

/** Hours and materials for one case piece. */
export function caseEstimate(c: CasePiece, p: Project): { hours: { label: string; hours: number }[]; materials: { label: string; cost: number; detail: string; missing?: string }[] } {
  const s = caseStandards;
  const { cw, cd, y0, y1 } = caseSize(c);
  const parts = caseParts(c);
  const caseSqFt = (2 * (cd * (y1 - y0)) + 2 * (cw * cd) + cw * (y1 - y0)) / 144;
  const topSqFt = (c.width * c.depth) / 144;
  const ops = caseOpenings(c);
  const drawers = parts.find((x) => x.name === 'Drawer front')?.qty ?? 0;
  const doors = parts.find((x) => x.name === 'Door')?.qty ?? 0;
  const shelves = parts.find((x) => x.name === 'Adjustable shelf')?.qty ?? 0;
  const dividers = parts.filter((x) => x.name.includes('ivider') || x.name.includes('web frame') || x.name.includes('mid stile')).reduce((t, x) => t + x.qty, 0);
  const shaker = c.frontStyle === 'shaker';
  const hours: { label: string; hours: number }[] = [{ label: 'Layout, drawings and stock selection', hours: s.layout }];
  hours.push({ label: `Case: sides, bottom, sub-top, back (${caseSqFt.toFixed(1)} sq ft)`, hours: s.caseBase + s.casePerSqFt * caseSqFt });
  if (dividers) hours.push({ label: `${dividers} divider${dividers > 1 ? 's' : ''} and web frame${dividers > 1 ? 's' : ''}`, hours: dividers * s.divider });
  if (c.fronts === 'inset') hours.push({ label: 'Face frame', hours: s.faceFrame + s.faceFramePerOpening * ops.length });
  hours.push({ label: `Solid top, glued up and flattened (${topSqFt.toFixed(1)} sq ft)`, hours: s.top + s.topPerSqFt * topSqFt });
  if (drawers) hours.push({ label: `${drawers} drawer${drawers > 1 ? 's' : ''}: ${shaker ? 'five-piece' : 'slab'} fronts, slides and fitting${c.fronts === 'inset' ? ' (inset)' : ''}`, hours: drawers * (s.drawerFit + (shaker ? s.frontShaker : s.frontSlab) + (c.fronts === 'inset' ? s.insetFit : 0)) });
  if (doors) hours.push({ label: `${doors} door${doors > 1 ? 's' : ''}: ${shaker ? 'five-piece' : 'slab'}, hinged and fitted${c.fronts === 'inset' ? ' (inset)' : ''}`, hours: doors * (s.doorFit + (shaker ? s.doorShaker : s.doorSlab) + (c.fronts === 'inset' ? s.insetFit : 0)) });
  if (shelves) hours.push({ label: `${shelves} adjustable shel${shelves > 1 ? 'ves' : 'f'}`, hours: shelves * s.shelf });
  if (c.base === 'legs' && c.baseH > 0) hours.push({ label: `Legs${c.leg === 'tapered' ? ', tapered' : c.leg === 'turned' ? ', turned' : ''}`, hours: s.legs + (c.leg === 'tapered' ? s.legTaper : c.leg === 'turned' ? s.legTurned : 0) });
  else if (c.base === 'plinth' && c.baseH > 0) hours.push({ label: 'Plinth base, leveled', hours: s.plinth });
  const finishArea = caseSqFt * 1.2 + topSqFt * 2 + ((drawers + doors) * ((parts.find((x) => x.name === 'Drawer front')?.length ?? 0) * (parts.find((x) => x.name === 'Drawer front')?.width ?? 0))) / 144;
  hours.push({ label: 'Sanding', hours: s.sandPerSqFt * finishArea + 1 });
  if (c.finish !== 'painter') hours.push({ label: tableFinishLabel[c.finish], hours: s.finishBase[c.finish] + s.finishPerSqFt * finishArea });
  hours.push(...editHours(c));
  const n = Math.max(1, Math.round(c.qty ?? 1));
  if (n > 1) {
    // The others alike: everything but the layout again, faster
    const one = hours.slice(1).reduce((t, h) => t + h.hours, 0);
    hours.push({ label: `${n - 1} more alike (${Math.round(s.repeat * 100)}% each: setups and layout already done)`, hours: one * s.repeat * (n - 1) });
  }
  hours.push({ label: `Delivery and set in place${n > 1 ? ` (${n})` : ''}`, hours: n * (s.delivery + s.deliveryPerCuFt * ((c.width * c.depth * c.height) / 1728)) });

  // Materials: plywood by area, solid stock by board foot, drawer boxes and slides, hinges, hardware
  const plyArea = parts.filter((x) => x.thick === PLY && x.qty > 0).reduce((t, x) => t + x.qty * x.length * x.width, 0) * 1.25;
  const sheets = Math.max(1, Math.ceil(plyArea / (48 * 96)));
  const sheetMat = c.grade === 'paint' ? '3/4" paint-grade birch plywood' : `3/4" ${c.species.toLowerCase()} plywood`;
  const sheetPrice = p.sheetPrices?.[sheetMat] ?? p.cutlist?.stock.find((x) => x.material === sheetMat)?.price ?? 0;
  const solid = parts.filter((x) => x.qty > 0 && (x.role === 'top' || x.role === 'leg' || x.role === 'breadboard' || (x.role === 'stretcher' && x.thick !== PLY)));
  const solidBF = solid.reduce((t, x) => t + (x.qty * x.length * x.width * Math.max(1, x.thick + 0.25)) / 144, 0) * 1.35 + (cd * 2 + cw) * 0.1 / 12; // plus edge banding stock
  const sp = c.grade === 'paint' ? 'Poplar' : c.species;
  const perBF = c.pricePerBF || amPerBF(sp)?.perBF || 0;
  const materials: { label: string; cost: number; detail: string; missing?: string }[] = [
    { label: `Plywood (${sheetMat.replace(/^3\/4" /, '')})`, cost: sheets * sheetPrice + 45, detail: `${sheets} sheet${sheets > 1 ? 's' : ''}, plus a 1/4" back`, ...(sheetPrice ? {} : { missing: `Enter a price for ${sheetMat} (price book or Sheet cutlist)` }) },
    { label: `${sp} lumber`, cost: solidBF * perBF, detail: `about ${Math.ceil(solidBF)} BF${perBF ? ` at $${perBF.toFixed(2)}/BF${c.pricePerBF ? '' : ' (A&M list)'}` : ''}`, ...(perBF ? {} : { missing: `Enter a $/BF for ${sp.toLowerCase()}` }) },
    { label: 'Glue, fasteners, abrasives', cost: 25 + 5 * (drawers + doors), detail: 'screws, glue, sandpaper, shelf pins, figure-8s' },
  ];
  if (drawers) {
    const f = parts.find((x) => x.name === 'Drawer front')!;
    const slide = slideLength(c);
    const boxEach = eaglePrice('drawerBox', Math.max(6, f.length - 1.5), Math.max(3, f.width - 1.5), slide);
    materials.push({ label: 'Drawer boxes (Eagle dovetail) and full-extension soft-close slides', cost: drawers * (boxEach + 38), detail: `${drawers} × about $${Math.round(boxEach)} box + $38 slides (${slide}")` });
  }
  if (doors) materials.push({ label: 'Concealed hinges', cost: doors * 2 * 7, detail: `${doors * 2} soft-close hinges` });
  if (c.hardware !== 'none') {
    const n = parts.find((x) => x.role === 'post' && (x.name === 'Knob' || x.name === 'Pull'))?.qty ?? 0;
    if (n) materials.push({ label: `${c.hardware === 'knobs' ? 'Knobs' : 'Pulls'} (allowance)`, cost: n * 8, detail: `${n} × $8; less if the homeowner supplies them` });
  }
  if (c.finish === 'painter') materials.push({ label: 'Finishing (by others)', cost: c.finishPrice, detail: 'Finisher’s price' });
  else materials.push({ label: 'Finish materials', cost: finishArea * 0.9 + 15, detail: tableFinishLabel[c.finish] });
  // Several alike: the materials for each (sheet goods share sheets; this rounds up per piece)
  if (n > 1) for (const m of materials) if (!(c.finish === 'painter' && m.label.startsWith('Finishing'))) { m.cost *= n; m.detail = `${m.detail} (× ${n})`; }
  return { hours, materials };
}

/** The face in words: "2 drawers over 2 doors". */
export function faceWords(c: CasePiece): string {
  const n = (t: CaseRow['type']) => c.rows.filter((r) => r.type === t).reduce((s, r) => s + r.split, 0);
  const d = n('drawer'), o = n('open');
  const doors = caseParts(c).find((x) => x.name === 'Door')?.qty ?? 0;
  return [d ? `(${d}) drawer${d > 1 ? 's' : ''}` : '', doors ? `(${doors}) door${doors > 1 ? 's' : ''}` : '', o ? `${o > 1 ? `(${o}) ` : ''}open shel${o > 1 ? 'ves' : 'f'}` : ''].filter(Boolean).join(', ');
}

/** The scope line, in the wording of the quotes. */
export function caseScope(c: CasePiece): string {
  const kind = { nightstand: 'nightstand', dresser: 'dresser', chest: 'chest of drawers', sideboard: 'sideboard', media: 'media console' }[c.kind];
  const n = Math.max(1, Math.round(c.qty ?? 1));
  const kinds = { nightstand: 'nightstands', dresser: 'dressers', chest: 'chests of drawers', sideboard: 'sideboards', media: 'media consoles' }[c.kind];
  return [
    `${c.name}: ${n > 1 ? `(${n}) matching custom ${kinds}, each` : `custom ${kind},`} approx ${fmt(c.width)}W x ${fmt(c.depth)}D x ${fmt(c.height)}H`,
    c.grade === 'paint' ? 'paint grade' : `${c.species.toLowerCase()}`,
    faceWords(c),
    `${c.frontStyle === 'shaker' ? 'five-piece' : 'slab'} ${c.fronts} fronts${c.rows.some((r) => r.type === 'drawer') ? ', dovetailed drawer boxes on full-extension soft-close slides' : ''}`,
    `solid ${c.grade === 'paint' ? '' : `${c.species.toLowerCase()} `}top`.replace('  ', ' '),
    c.base === 'legs' ? `on ${c.leg} legs` : 'on a set-back plinth base',
    c.hardware === 'none' ? 'no hardware' : `${c.hardware} (allowance)`,
    c.finish === 'painter' ? 'finish by others' : tableFinishLabel[c.finish].replace(' (shop)', '').toLowerCase() + ' finish',
    'delivered and set in place',
  ].filter(Boolean).join('; ');
}
