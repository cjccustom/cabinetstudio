// Beds and case pieces (dressers, nightstands, chests) on paper: front and side elevations and a plan,
// drawn from the same parts as the 3D view and the estimate, with the overall sizes dimensioned. Used on
// their sheets in the drawing sets and, standalone, as a picture on the proposal.
import type { Project } from '../model/types';
import type { TableBox, TablePart } from '../model/tableParts';
import { bedParts, bedScope, bedsOf, bedChecks, bedSize, type Bed } from '../model/bed';
import { caseParts, caseScope, casesOf, caseChecks, type CasePiece } from '../model/casePiece';
import { drawingCss, fitScale, inView, View, type Frame } from './draw';
import { drawParts } from './tableViews';
import { tableParts } from '../model/tableParts';
import { furnitureOf, tableScope, tableChecks, type DiningTable } from '../model/furniture';

export interface Piece { id: string; name: string; kind: 'bed' | 'case' | 'table'; parts: TablePart[]; scope: string; checks: string[]; notes: string; heights: number[]; size: string }

const fmtIn = (v: number) => { const w = Math.floor(v + 1e-6), f = Math.round((v - w) * 16); const g = (a: number, b: number): number => (b ? g(b, a % b) : a); return f === 0 ? `${w}"` : f === 16 ? `${w + 1}"` : `${w ? `${w} ` : ''}${f / g(f, 16)}/${16 / g(f, 16)}"`; };

/** A table or bench, drawn the same way (its length across the page). */
export function tablePiece(t: DiningTable): Piece {
  return { id: t.id, name: t.name, kind: 'table', parts: tableParts(t), scope: tableScope(t), checks: tableChecks(t), notes: t.notes ?? '', heights: [t.height], size: `${fmtIn(t.length)} L × ${fmtIn(t.width)} W × ${fmtIn(t.height)} H` };
}

/** Everything that gets a drawing on the proposal: tables and benches, beds, case pieces. */
export const proposalPieces = (p: Project): Piece[] => [...furnitureOf(p).map(tablePiece), ...piecesOf(p)];

/** The beds and case pieces on a job, ready to draw. */
export function piecesOf(p: Project): Piece[] {
  const bed = (b: Bed): Piece => {
    const s = bedSize(b), parts = bedParts(b);
    const hb = b.headboard !== 'none' ? [b.headH] : [];
    return { id: b.id, name: b.name, kind: 'bed', parts, scope: bedScope(b), checks: bedChecks(b), notes: b.notes, heights: [b.deckH, s.top, ...hb], size: `${fmtIn(s.W)} W × ${fmtIn(s.L + (b.headboard !== 'none' ? b.headT ?? 1.25 : 0))} L${b.headboard !== 'none' ? ` × ${fmtIn(b.headH)} H at the headboard` : ''}` };
  };
  const kase = (c: CasePiece): Piece => ({ id: c.id, name: c.name, kind: 'case', parts: caseParts(c), scope: caseScope(c), checks: caseChecks(c), notes: c.notes, heights: [c.height], size: `${fmtIn(c.width)} W × ${fmtIn(c.depth)} D × ${fmtIn(c.height)} H` });
  return [...bedsOf(p).map(bed), ...casesOf(p).map(kase)];
}

const swap = (parts: TablePart[], map: (b: TableBox) => TableBox) => parts.map((p) => ({ ...p, boxes: p.boxes.map(map) }));
const bounds = (parts: TablePart[]) => {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const p of parts) for (const b of p.boxes) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], b.min[i]); hi[i] = Math.max(hi[i], b.min[i] + b.size[i]); }
  return { lo, hi };
};

/** Front and side elevations and a plan in three frames, one scale; the mattress (a bed's) dashed for scale. */
export function pieceViews(pc: Piece, f: { front: Frame; side: Frame; plan?: Frame }, fixed?: number): { svg: string; scale: number } {
  const built = pc.parts.filter((x) => x.qty > 0), ghost = pc.parts.filter((x) => x.qty === 0);
  const { lo, hi } = bounds(built.length ? built : pc.parts);
  const W = hi[0] - lo[0], H = hi[1], D = hi[2] - lo[2];
  const scale = fixed ?? inView(`piece:${pc.id}`, pc.name, () => Math.min(
    fitScale(W, H, f.front.w - 1.4, f.front.h - 1.1),
    fitScale(D, H, f.side.w - 1.4, f.side.h - 1.1),
    ...(f.plan ? [fitScale(W, D, f.plan.w - 1.4, f.plan.h - 1.1)] : []),
  ));
  const out: string[] = [];
  const dashed = (v: View, u: 0 | 2, w: 1 | 2) => { for (const x of ghost) for (const b of x.boxes) v.rect(b.min[u], b.min[w], b.size[u], b.size[w], 'hid'); };
  const heights = [...new Set([0, ...pc.heights.map((h) => Math.round(h * 16) / 16), H].filter((h) => h >= 0 && h <= H + 0.01))].sort((a, b) => a - b);

  // Front: seen from the foot of the bed / the front of the piece (+z)
  const fv = new View(f.front, { x0: lo[0], y0: 0, x1: hi[0], y1: H }, scale);
  drawParts(fv, built, { u: 0, v: 1, depth: 2, near: 1 });
  dashed(fv, 0, 1);
  fv.line(lo[0] - 4, 0, hi[0] + 4, 0, 'heavy');
  fv.dimH(lo[0], hi[0], 0, -0.4);
  fv.chainV(heights, hi[0], 0.4);
  if (heights.length > 2) fv.dimV(0, H, hi[0], 0.8);
  fv.text((lo[0] + hi[0]) / 2, -fv.p(0.85), pc.kind === 'bed' ? 'FOOT ELEVATION' : pc.kind === 'table' ? 'SIDE ELEVATION' : 'FRONT ELEVATION', 0.12, 'middle', 'lbl');
  out.push(fv.svg());

  // Side: seen from the right (+x), depth along the page
  const sideParts = (ps: TablePart[]) => swap(ps, (b) => ({ min: [b.min[2], b.min[1], b.min[0]], size: [b.size[2], b.size[1], b.size[0]] }));
  const sv = new View(f.side, { x0: lo[2], y0: 0, x1: hi[2], y1: H }, scale);
  drawParts(sv, sideParts(built), { u: 0, v: 1, depth: 2, near: 1 });
  for (const x of sideParts(ghost)) for (const b of x.boxes) sv.rect(b.min[0], b.min[1], b.size[0], b.size[1], 'hid');
  sv.line(lo[2] - 4, 0, hi[2] + 4, 0, 'heavy');
  sv.dimH(lo[2], hi[2], 0, -0.4);
  sv.text((lo[2] + hi[2]) / 2, -sv.p(0.85), pc.kind === 'table' ? 'END ELEVATION' : 'SIDE ELEVATION', 0.12, 'middle', 'lbl');
  out.push(sv.svg());

  if (!f.plan) return { svg: out.join(''), scale };
  // Plan: from above, the back (headboard) at the top of the page
  const pv = new View(f.plan, { x0: lo[0], y0: lo[2], x1: hi[0], y1: hi[2] }, scale, false);
  const planParts = swap(built, (b) => ({ min: [b.min[0], b.min[2], b.min[1]], size: [b.size[0], b.size[2], b.size[1]] }));
  drawParts(pv, planParts, { u: 0, v: 1, depth: 2, near: 1 });
  dashed(pv, 0, 2);
  pv.dimH(lo[0], hi[0], hi[2], -0.4);
  pv.dimV(lo[2], hi[2], hi[0], 0.4);
  pv.text((lo[0] + hi[0]) / 2, lo[2] - pv.p(0.3), 'PLAN', 0.12, 'middle', 'lbl');
  out.push(pv.svg());
  return { svg: out.join(''), scale };
}

/** One piece drawn on its own, for the proposal: the front (or foot) and side elevations, as large as fits about 7" wide. */
export function pieceDrawingSvg(pc: Piece, width = 7.2, height = 2.8): string {
  const built = pc.parts.filter((x) => x.qty > 0);
  const { lo, hi } = bounds(built.length ? built : pc.parts);
  const W = hi[0] - lo[0], D = hi[2] - lo[2], H = hi[1];
  // Room for dimensions: about 0.7" beside each view, 1.1" under them
  const k = Math.min((width - 2.6) / (W + D), (height - 1.25) / H);
  const fw = W * k + 1.3, hk = H * k;
  // Each view centers in its frame: a frame 2.1" taller than the drawing, starting above the picture, leaves 0.15" over it and room under it for the dimension and title
  const v = pieceViews(pc, { front: { x: 0, y: -0.9, w: fw, h: hk + 2.1 }, side: { x: fw, y: -0.9, w: width - fw, h: hk + 2.1 } }, k * 12);
  height = hk + 1.25;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="dwg" viewBox="0 0 ${width} ${height}" width="${width}in" height="${height}in" style="max-width:100%;height:auto;background:#fff"><style>${drawingCss.replace(/\.dwg /g, '')}</style>${v.svg}</svg>`;
}

/** The proposal's drawings of the custom furniture (beds, dressers and the like): name, size, front and side. */
export function furnitureDrawingsHtml(p: Project, heading = 'h3'): string {
  const pcs = proposalPieces(p);
  if (!pcs.length) return '';
  const e = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<${heading}>Furniture drawings</${heading}>` + pcs.map((pc) => `<div style="break-inside:avoid;margin:6px 0 12px"><p style="margin:0 0 4px"><b>${e(pc.name)}</b> · ${e(pc.size)}${pc.kind === 'bed' ? ' (the mattress is shown dashed, for size)' : ''}</p>${pieceDrawingSvg(pc)}</div>`).join('')
    + '<p style="font-size:9pt;color:#555">Drawings show the design and approximate sizes; final sizes are confirmed before the lumber is milled.</p>';
}
