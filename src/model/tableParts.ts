// A table's parts, sized and placed: one list that the 3D view draws, the shop drawing dimensions
// and the cut list counts. Table-local coordinates: x along the length (0 at the middle), y up from
// the floor, z across the width (0 at the middle).
import type { Project } from './types';
import { fmt } from '../units';
import { baseFootprint, furnitureOf, isBench, lipStock, stretchersOf, topOutline, type DiningTable } from './furniture';
import { metalMembers } from './metalBase';
import { amSizes, boardSize } from './amLumber';

export type TableRole = 'top' | 'breadboard' | 'lip' | 'leg' | 'apron' | 'post' | 'foot' | 'cleat' | 'stretcher' | 'column' | 'leaf' | 'shelf' | 'slat' | 'cushion' | 'metal';
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
  /** A shaped top: its outline in plan (x, z), extruded through its thickness. */
  outline?: [number, number][];
  /** A metal base: members as centerlines, with the stock, and plates. */
  metal?: { members: import('./metalBase').MetalMember[]; plates: import('./metalBase').MetalPlate[]; stock: import('./metalBase').MetalStock; size: number; color: string };
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
  const shaped = topOutline(t);
  out.push({ role: 'top', name: shaped ? `Top, ${t.shape === 'racetrack' ? 'racetrack' : t.shape}` : 'Top', qty: 1, length: tl - 2 * bb, width: t.shape === 'round' ? tl : tw, thick: T, note: `Glued up from boards about 5"–6" wide, alternating growth rings${shaped ? '; cut to shape from a full-size template or on the CNC' : ''}${t.edge === 'profile' && !lip ? '; profile the edge' : ''}`, boxes: [box(-tl / 2 + bb, topY, -(t.shape === 'round' ? tl : tw) / 2, tl / 2 - bb, H, (t.shape === 'round' ? tl : tw) / 2)], ...(shaped ? { outline: shaped } : {}) });
  if (bb) out.push({ role: 'breadboard', name: 'Breadboard end', qty: 2, length: tw, width: bb, thick: T, note: 'Tongue on the top, pegged through elongated holes outboard of the middle', boxes: [box(-tl / 2, topY, -tw / 2, -tl / 2 + bb, H, tw / 2), box(tl / 2 - bb, topY, -tw / 2, tl / 2, H, tw / 2)] });
  if (lip) {
    const y0 = edge ? topY : H, y1 = (edge ? topY : H) + ls.h;
    const note = edge ? `Mitered at the corners; fastened to the top's edge${t.lipHeight ? `, stands ${fmtIn(t.lipHeight)} above the surface` : ''}; ease the inside top edge` : 'Mitered at the corners; glued and screwed down at the top\'s edge; ease the inside top edge';
    out.push({ role: 'lip', name: 'Lip, long side', qty: 2, length: L, width: ls.h, thick: lw, note, boxes: [box(-L / 2, y0, -W / 2, L / 2, y1, -W / 2 + lw), box(-L / 2, y0, W / 2 - lw, L / 2, y1, W / 2)] });
    out.push({ role: 'lip', name: 'Lip, end', qty: 2, length: W, width: ls.h, thick: lw, note: `${note}. Across the top's grain: slotted screw holes, glue at the middle only`, boxes: [box(-L / 2, y0, -W / 2 + lw, -L / 2 + lw, y1, W / 2 - lw), box(L / 2 - lw, y0, -W / 2 + lw, L / 2, y1, W / 2 - lw)] });
  }
  if (t.leaves) out.push({ role: 'leaf', name: 'Leaf', qty: t.leaves, length: tw, width: t.leafWidth, thick: T, note: 'Alignment pins and leaf locks; stored off the table', boxes: [] });

  const legH = H - T;
  if (t.metal) {
    const m = metalMembers(t.metal, t.length, t.shape === 'round' ? t.length : t.width, topY, t.shape === 'round' || t.shape === 'oval');
    out.push({ role: 'metal', name: 'Metal base (fabricator)', qty: 1, length: t.length, width: legH, thick: t.metal.size, note: 'Fabricated and finished by the metal shop; attached with threaded inserts in the top', boxes: [], metal: { ...m, stock: t.metal.form === 'hairpin' ? 'round' : t.metal.stock, size: t.metal.form === 'hairpin' ? Math.min(t.metal.size, 0.625) : t.metal.size, color: t.metal.finish === 'raw' ? '#8d8f92' : t.metal.finish === 'blackened' ? '#2b2b2d' : metalColor(t.metal.color) } });
  } else {
  // A wood base under a shaped top stands inside the curve
  const { L, W } = baseFootprint(t);
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
    // Low stretchers to stiffen the legs: tenoned into the legs, centered on them
    const stv = stretchersOf(t);
    if (stv !== 'none') {
      const SH = 1.75, ST = 1, top = Math.min(t.stretcherHeight ?? 6, legH - t.apron - 2), y0 = top - SH;
      const xi = L / 2 - LEG_INSET - s, zi = W / 2 - LEG_INSET - s;
      const xc = L / 2 - LEG_INSET - s / 2, zc = W / 2 - LEG_INSET - s / 2;
      out.push({ role: 'stretcher', name: 'Stretcher, end', qty: 2, length: endA + 2, width: SH, thick: ST, note: '1" tenons each end into the legs, centered on the leg', boxes: [-1, 1].map((a) => box(a * xc - ST / 2, y0, -zi, a * xc + ST / 2, top, zi)) });
      if (stv === 'h') out.push({ role: 'stretcher', name: 'Stretcher, center', qty: 1, length: 2 * (xc - ST / 2) + 2, width: SH, thick: ST, note: '1" tenons each end into the middle of the end stretchers', boxes: [box(-xc + ST / 2, y0, -ST / 2, xc - ST / 2, top, ST / 2)] });
      // The long ones 1 1/2" lower, so their mortises miss the end stretchers' in the leg
      else out.push({ role: 'stretcher', name: 'Stretcher, long side', qty: 2, length: longA + 2, width: SH, thick: ST, note: '1" tenons each end into the legs, centered on the leg, 1 1/2" below the end stretchers so the mortises don\'t meet', boxes: [-1, 1].map((b) => box(-xi, y0 - 1.5, b * zc - ST / 2, xi, top - 1.5, b * zc + ST / 2)) });
    }
    // A bench's lower shelf: rails between the legs, then slats along its length or a solid panel
    if (t.shelf && t.shelf !== 'none') {
      const RH = 2, RT = 0.875, sy = (t.shelfHeight ?? 5) - 0.75, ry0 = sy - RH + 0.75;
      const xi = L / 2 - LEG_INSET - s, zi = W / 2 - LEG_INSET - s;
      out.push({ role: 'stretcher', name: 'Shelf rail, long side', qty: 2, length: longA + 2, width: RH, thick: RT, note: '1" tenons each end into the legs; the shelf rests on it', boxes: [-1, 1].map((b) => box(-xi, ry0, b * (zi - RT + 0.001), xi, ry0 + RH, b * zi)) });
      out.push({ role: 'stretcher', name: 'Shelf rail, end', qty: 2, length: endA + 2, width: RH, thick: RT, note: '1" tenons each end into the legs', boxes: [-1, 1].map((a) => box(a * xi, ry0, -zi, a * (xi - RT), ry0 + RH, zi)) });
      const iw = 2 * zi, il = 2 * xi;
      if (t.shelf === 'slats') {
        const sw = 2.5, gap = 0.75, n = Math.max(2, Math.floor((iw - 2 * RT + gap) / (sw + gap)));
        const step = (iw - 2 * RT - sw) / (n - 1);
        out.push({ role: 'slat', name: 'Shelf slat', qty: n, length: il, width: sw, thick: 0.75, note: `Run the length, ${gap}" gaps; notched around the legs at the ends, screwed to the end rails`, boxes: Array.from({ length: n }, (_, i) => box(-xi, sy, -zi + RT + i * step, xi, sy + 0.75, -zi + RT + i * step + sw)) });
      } else {
        out.push({ role: 'shelf', name: 'Shelf panel', qty: 1, length: il, width: iw, thick: 0.75, note: 'Solid, notched around the legs; on cleats inside the rails, screwed through slotted holes so it can move', boxes: [box(-xi, sy, -zi, xi, sy + 0.75, zi)] });
      }
    }
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
  }
  // The seat cushion, by the upholsterer: drawn, not cut
  if (isBench(t) && t.cushion) {
    const ct = t.cushionThick ?? 2, r = 0.25;
    out.push({ role: 'cushion', name: 'Seat cushion (upholsterer)', qty: 1, length: L - 2 * r, width: W - 2 * r, thick: ct, note: 'Foam and fabric by the upholsterer', boxes: [box(-L / 2 + r, H, -W / 2 + r, L / 2 - r, H + ct, W / 2 - r)] });
  }
  return out;
}

const fmtIn = (v: number) => fmt(Math.round(v * 16) / 16);

/** A powder coat color by name, roughly, for the 3D. */
export function metalColor(name: string): string {
  const n = name.toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(n)) return n;
  const named: Record<string, string> = { black: '#232325', 'matte black': '#262628', white: '#eceae4', bronze: '#5b4632', 'oil rubbed bronze': '#3e2f24', gray: '#6d6f72', grey: '#6d6f72', silver: '#b5b7ba', gold: '#a9894a', brass: '#b08d4a', copper: '#9a5a36', green: '#3f5a44', navy: '#24324a', blue: '#33507a', red: '#7a2a24' };
  return named[n] ?? Object.entries(named).find(([k]) => n.includes(k))?.[1] ?? '#3a3a3c';
}

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
    if (part.role === 'cushion' || part.role === 'metal') continue;
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
