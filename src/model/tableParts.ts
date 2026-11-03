// A table's parts, sized and placed: one list that the 3D view draws, the shop drawing dimensions
// and the cut list counts. Table-local coordinates: x along the length (0 at the middle), y up from
// the floor, z across the width (0 at the middle).
import type { Project } from './types';
import { fmt } from '../units';
import { furnitureOf, lipStock, type DiningTable } from './furniture';
import { amSizes, boardSize } from './amLumber';

export type TableRole = 'top' | 'breadboard' | 'lip' | 'leg' | 'apron' | 'post' | 'foot' | 'cleat' | 'stretcher' | 'column' | 'leaf';
export interface TableBox { min: [number, number, number]; size: [number, number, number] }
export interface TablePart {
  role: TableRole;
  name: string;
  qty: number;
  /** Finished length (with the grain), width, thickness. */
  length: number;
  width: number;
  thick: number;
  note?: string;
  /** Where each piece sits (one per qty); a leaf is listed but not drawn (it's stored). */
  boxes: TableBox[];
  /** Legs: tapered to this size at the floor on the two inside faces; turned legs are round. */
  taperTo?: number;
  turned?: boolean;
}

const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): TableBox => ({ min: [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)], size: [Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)] });

/** Leg inset from the edge of the top, and the apron's setback from the leg face. */
export const LEG_INSET = 1.5, APRON_SET = 0.75, APRON_T = 0.875, BB_W = 3;

export function tableParts(t: DiningTable): TablePart[] {
  const L = t.length, W = t.width, H = t.height, T = t.top;
  const out: TablePart[] = [];
  const lip = !!t.lip, ls = lipStock(t), lw = ls.w, edge = (t.lipStyle ?? 'edge') === 'edge';
  // The top panel: inside the lip rails when they wrap the edge
  const tl = lip && edge ? L - 2 * lw : L, tw = lip && edge ? W - 2 * lw : W;
  const bb = t.breadboard ? BB_W : 0;
  const topY = H - T;
  out.push({ role: 'top', name: 'Top', qty: 1, length: tl - 2 * bb, width: tw, thick: T, note: `Glued up from boards about 5"–6" wide, alternating growth rings${t.edge === 'profile' && !lip ? '; profile the edge' : ''}`, boxes: [box(-tl / 2 + bb, topY, -tw / 2, tl / 2 - bb, H, tw / 2)] });
  if (bb) out.push({ role: 'breadboard', name: 'Breadboard end', qty: 2, length: tw, width: bb, thick: T, note: 'Tongue on the top, pegged through elongated holes outboard of the middle', boxes: [box(-tl / 2, topY, -tw / 2, -tl / 2 + bb, H, tw / 2), box(tl / 2 - bb, topY, -tw / 2, tl / 2, H, tw / 2)] });
  if (lip) {
    const y0 = edge ? topY : H, y1 = (edge ? topY : H) + ls.h;
    const note = edge ? `Mitered at the corners; fastened to the top's edge${t.lipHeight ? `, stands ${fmtIn(t.lipHeight)} above the surface` : ''}; ease the inside top edge` : 'Mitered at the corners; glued and screwed down at the top\'s edge; ease the inside top edge';
    out.push({ role: 'lip', name: 'Lip, long side', qty: 2, length: L, width: ls.h, thick: lw, note, boxes: [box(-L / 2, y0, -W / 2, L / 2, y1, -W / 2 + lw), box(-L / 2, y0, W / 2 - lw, L / 2, y1, W / 2)] });
    out.push({ role: 'lip', name: 'Lip, end', qty: 2, length: W, width: ls.h, thick: lw, note: `${note}. Across the top's grain: slotted screw holes, glue at the middle only`, boxes: [box(-L / 2, y0, -W / 2 + lw, -L / 2 + lw, y1, W / 2 - lw), box(L / 2 - lw, y0, -W / 2 + lw, L / 2, y1, W / 2 - lw)] });
  }
  if (t.leaves) out.push({ role: 'leaf', name: 'Leaf', qty: t.leaves, length: tw, width: t.leafWidth, thick: T, note: 'Alignment pins and leaf locks; stored off the table', boxes: [] });

  const legH = H - T;
  if (t.base === 'legs') {
    const s = t.legSize;
    const lx = L / 2 - LEG_INSET - s, lz = W / 2 - LEG_INSET - s;
    const legs = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => box(a < 0 ? -L / 2 + LEG_INSET : lx, 0, b < 0 ? -W / 2 + LEG_INSET : lz, a < 0 ? -L / 2 + LEG_INSET + s : lx + s, legH, b < 0 ? -W / 2 + LEG_INSET + s : lz + s));
    out.push({ role: 'leg', name: `Leg, ${t.leg}`, qty: 4, length: legH, width: s, thick: s, note: t.leg === 'tapered' ? `Taper the two inside faces from below the apron to ${fmtIn(s * 0.6)} at the floor` : t.leg === 'turned' ? 'Turned; leave the top square to the bottom of the apron' : 'Square; chamfer the foot', boxes: legs, ...(t.leg === 'tapered' ? { taperTo: s * 0.6 } : {}), ...(t.leg === 'turned' ? { turned: true } : {}) });
    const ay0 = topY - t.apron;
    const between = (span: number) => span - 2 * LEG_INSET - 2 * s;
    const longA = between(L), endA = between(W);
    out.push({ role: 'apron', name: 'Apron, long side', qty: 2, length: longA + 2, width: t.apron, thick: APRON_T, note: `${longA.toFixed(2).replace(/\.00$/, '')}" between legs plus 1" tenons each end`, boxes: [-1, 1].map((b) => box(-L / 2 + LEG_INSET + s, ay0, b * (W / 2 - LEG_INSET - APRON_SET), L / 2 - LEG_INSET - s, topY, b * (W / 2 - LEG_INSET - APRON_SET - APRON_T))) });
    out.push({ role: 'apron', name: 'Apron, end', qty: 2, length: endA + 2, width: t.apron, thick: APRON_T, note: `${endA.toFixed(2).replace(/\.00$/, '')}" between legs plus 1" tenons each end`, boxes: [-1, 1].map((a) => box(a * (L / 2 - LEG_INSET - APRON_SET), ay0, -W / 2 + LEG_INSET + s, a * (L / 2 - LEG_INSET - APRON_SET - APRON_T), topY, W / 2 - LEG_INSET - s)) });
  } else if (t.base === 'trestle') {
    const at = L / 2 - 14, footL = W - 6, cleatL = W - 8, postW = 6, postT = 3;
    out.push({ role: 'foot', name: 'Trestle foot', qty: 2, length: footL, width: 3, thick: 3, boxes: [-1, 1].map((a) => box(a * at - 1.5, 0, -footL / 2, a * at + 1.5, 3, footL / 2)) });
    out.push({ role: 'post', name: 'Trestle post', qty: 2, length: legH - 3 - 2, width: postW, thick: postT, note: 'Through-tenoned into the foot and cleat', boxes: [-1, 1].map((a) => box(a * at - postT / 2, 3, -postW / 2, a * at + postT / 2, topY - 2, postW / 2)) });
    out.push({ role: 'cleat', name: 'Top cleat', qty: 2, length: cleatL, width: 2, thick: 3, note: 'Slotted screw holes to the top', boxes: [-1, 1].map((a) => box(a * at - 1.5, topY - 2, -cleatL / 2, a * at + 1.5, topY, cleatL / 2)) });
    const sy = 3 + (legH - 5) * 0.45;
    out.push({ role: 'stretcher', name: 'Stretcher', qty: 1, length: 2 * at + 2 * postT, width: 3, thick: 1.5, note: 'Through the posts, wedged or keyed', boxes: [box(-at, sy, -0.75, at, sy + 3, 0.75)] });
  } else {
    const cols = t.base === 'pedestal' ? [0] : [-L * 0.23, L * 0.23];
    out.push({ role: 'column', name: 'Pedestal column', qty: cols.length, length: legH - 3 - 2, width: 6, thick: 6, note: 'Glued up hollow or solid; turned or square', boxes: cols.map((x) => box(x - 3, 3, -3, x + 3, topY - 2, 3)) });
    out.push({ role: 'foot', name: 'Pedestal foot', qty: cols.length * 2, length: 24, width: 3, thick: 3, note: 'Half-lapped in a cross', boxes: cols.flatMap((x) => [box(x - 12, 0, -1.5, x + 12, 3, 1.5), box(x - 1.5, 0, -12, x + 1.5, 3, 12)]) });
    out.push({ role: 'cleat', name: 'Top cleat', qty: cols.length * 2, length: Math.min(24, W - 10), width: 2, thick: 3, note: 'Half-lapped; slotted screw holes to the top', boxes: cols.flatMap((x) => [box(x - 1.5, topY - 2, -Math.min(12, W / 2 - 5), x + 1.5, topY, Math.min(12, W / 2 - 5)), box(x - Math.min(12, W / 2 - 5), topY - 2, -1.5, x + Math.min(12, W / 2 - 5), topY, 1.5)]) });
    if (cols.length > 1) out.push({ role: 'stretcher', name: 'Stretcher', qty: 1, length: cols[1] - cols[0] + 6, width: 3, thick: 1.5, boxes: [box(cols[0], 6, -0.75, cols[1], 9, 0.75)] });
  }
  return out;
}

const fmtIn = (v: number) => fmt(Math.round(v * 16) / 16);

/** A table's footprint in the room: center, and the length's direction (along x, or along z when turned). */
export function tablePlace(p: Project, t: DiningTable): { x: number; z: number; turned: boolean } {
  return { x: t.roomX ?? p.room.width / 2, z: t.roomZ ?? p.room.depth / 2, turned: !!t.turned };
}

export const tablesOf = (p: Project) => furnitureOf(p).map((t) => ({ t, parts: tableParts(t), place: tablePlace(p, t) }));

/** The A&M species a table can be made from (they stock both 1-1/4" and 1-5/8"), with what to call each. */
export const tableSpecies: { name: string; label: string }[] = [
  { name: 'White oak', label: 'White oak' }, { name: 'Red oak', label: 'Red oak' }, { name: 'Cherry', label: 'Cherry' },
  { name: 'Walnut', label: 'Walnut' }, { name: 'Sapele', label: 'Mahogany (A&M sapele)' }, { name: 'Hard maple', label: 'Hard maple' }, { name: 'Poplar', label: 'Poplar (paint grade)' },
];

export interface TableStock { part: string; board: string; lf: number; perLF: number; cost: number; how: string }

/**
 * What to buy from A&M for each part, by the lineal foot of their surfaced (D4S) boards: the top
 * glued up from 1-1/4" (flattened to about 1-1/8"), legs glued up from 1-5/8", aprons and the
 * like from the next thickness up, ripped or glued edge to edge as the width needs. Each length
 * gets 2" to trim, and 15% is added for defects and grain matching.
 */
export function tableStock(t: DiningTable, waste = 0.15): { lines: TableStock[]; missing: boolean } {
  const sizes = amSizes(t.species) ?? {};
  const boards = Object.entries(sizes).map(([k, perLF]) => ({ k, perLF, ...boardSize(k)! })).filter((b) => b.t && b.w);
  const thicks = [...new Set(boards.map((b) => b.t))].sort((a, b) => a - b);
  const lines: TableStock[] = [];
  let missing = !boards.length;
  for (const part of tableParts(t)) {
    // Thickness: the top from 1-1/4"; anything thicker than A&M's thickest is glued up in layers
    const want = part.role === 'top' || part.role === 'breadboard' || part.role === 'leaf' ? Math.max(1.25, part.thick) : part.thick;
    const thick = thicks.find((x) => x >= want - 1e-6 && x <= 1.625) ?? thicks.filter((x) => x <= 1.625).pop();
    if (thick == null) { missing = true; continue; }
    const layers = thick >= want - 1e-6 ? 1 : Math.ceil(want / (thick - 0.0625));
    const ofT = boards.filter((b) => b.t === thick).sort((a, b) => a.w - b.w);
    if (!ofT.length) { missing = true; continue; }
    const need = part.width + 0.125;
    let board = ofT.find((b) => b.w >= need), across = 1, perBoard = 1, how = '';
    if (board) {
      // Ripped: as many as fit across the board
      perBoard = Math.max(1, Math.floor((board.w + 0.125) / need));
      how = perBoard > 1 ? `${perBoard} ripped from each board` : 'ripped to width';
    } else {
      // Glued edge to edge from 5-1/2" boards (or the widest stocked), 1/4" lost to jointing each
      board = ofT.find((b) => Math.abs(b.w - 5.5) < 0.01) ?? ofT[ofT.length - 1];
      across = Math.ceil((part.width + 0.5) / (board.w - 0.25));
      how = `${across} boards glued edge to edge`;
    }
    if (layers > 1) how = `${layers} layers face-glued, ${how}`;
    const lf = (part.qty * layers * across * ((part.length + 2) / 12)) / perBoard * (1 + waste);
    lines.push({ part: part.name, board: board.k, lf, perLF: board.perLF, cost: lf * board.perLF, how });
  }
  return { lines, missing };
}
