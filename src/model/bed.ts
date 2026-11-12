// Beds: a platform bed on a set-back plywood base (drawers in its sides if wanted), or a frame bed on
// legs with rails and slats; a headboard (flat panel, slab, or upholstered by others) on the bed or
// hung on the wall; a footboard for a frame bed. Sized from the mattress. The hours are starting
// standards for a one-off bed in a cabinet shop, to be adjusted as Cody builds them.
//
// Bed-local coordinates: x across the width (0 at the middle), y up from the floor, z along the
// length from the headboard face (0) toward the foot.
import type { Project } from './types';
import { uid } from './defaults';
import { amPerBF } from './faceframe';
import { eaglePrice } from './eagle';
import type { TableBox, TablePart } from './tableParts';
import type { TableFinish } from './furniture';
import { tableFinishLabel } from './furniture';
import { fmt } from '../units';
import { applyEdits, editHours } from './pieceEdits';

export type MattressSize = 'twin' | 'twinxl' | 'full' | 'queen' | 'king' | 'calking' | 'custom';
export const mattressSizes: Record<Exclude<MattressSize, 'custom'>, { label: string; w: number; l: number }> = {
  twin: { label: 'Twin (38 × 75)', w: 38, l: 75 },
  twinxl: { label: 'Twin XL (38 × 80)', w: 38, l: 80 },
  full: { label: 'Full (54 × 75)', w: 54, l: 75 },
  queen: { label: 'Queen (60 × 80)', w: 60, l: 80 },
  king: { label: 'King (76 × 80)', w: 76, l: 80 },
  calking: { label: 'California king (72 × 84)', w: 72, l: 84 },
};

export interface Bed {
  /** Hand changes after the builder laid it out (see pieceEdits.ts). */
  edits?: import('./pieceEdits').PieceEdits['edits'];
  added?: import('./pieceEdits').PieceEdits['added'];
  id: string;
  name: string;
  mattress: MattressSize;
  /** Custom mattress size (width × length) when mattress is 'custom'. */
  mattressW?: number;
  mattressL?: number;
  /** How thick the mattress is: where its top lands, and how much headboard shows above it. */
  mattressH: number;
  /** platform: a deck on a set-back plywood base. frame: legs, rails and slats. */
  style: 'platform' | 'frame';
  /** Top of the deck (platform) or the slats (frame) off the floor. */
  deckH: number;
  /** Platform: drawers in the base under each side (0 = none). */
  drawers: number;
  drawerSides: 'both' | 'left' | 'right';
  headboard: 'none' | 'panel' | 'slab' | 'upholstered';
  /** Top of the headboard off the floor. */
  headH: number;
  /** On the bed, or hung on the wall on a French cleat (no posts). */
  headMount: 'bed' | 'wall';
  /** Frame beds: a footboard and its height. */
  footboard: boolean;
  footH: number;
  species: string;
  /** Paint grade: plywood and poplar, painted. Stain grade: veneer plywood and the species. */
  grade: 'paint' | 'stain';
  finish: TableFinish;
  finishPrice: number;
  /** Lumber price per board foot typed in; 0 = A&M's list price for the species. */
  pricePerBF: number;
  /** The upholsterer's price for an upholstered headboard. */
  upholsteryPrice: number;
  notes: string;
  /** Where it stands: the headboard against a wall (unset = the back wall, centered). */
  wall?: 'back' | 'left' | 'right' | 'front';
  offset?: number;
}

export const newBed = (): Bed => ({
  id: uid('bed'), name: 'Bed', mattress: 'queen', mattressH: 12, style: 'platform', deckH: 14, drawers: 0, drawerSides: 'both',
  headboard: 'panel', headH: 50, headMount: 'bed', footboard: false, footH: 22, species: 'Poplar', grade: 'paint', finish: 'paint', finishPrice: 0,
  pricePerBF: 0, upholsteryPrice: 0, notes: '',
});

export const bedsOf = (p: Project): Bed[] => (p.beds ?? []).map((b) => ({ ...newBed(), ...b }));

/** The mattress the bed is sized to. */
export function mattressOf(b: Bed): { w: number; l: number } {
  if (b.mattress === 'custom') return { w: b.mattressW ?? 60, l: b.mattressL ?? 80 };
  return mattressSizes[b.mattress];
}

/** Clearance around the mattress, each side; the frame's members. */
const CLEAR = 0.5, BORDER = 1.5, SETBACK = 3, LEG = 3, RAIL_T = 1.5, RAIL_H = 7, HB_T = 1.25, PLY = 0.75;

/** Outside size: width across, length from the headboard face to the foot, and where the mattress sits. */
export function bedSize(b: Bed): { W: number; L: number; innerW: number; innerL: number; top: number } {
  const m = mattressOf(b);
  const innerW = m.w + 2 * CLEAR, innerL = m.l + 2 * CLEAR;
  const side = b.style === 'platform' ? BORDER : LEG;
  return { W: innerW + 2 * side, L: innerL + (b.style === 'platform' ? BORDER : LEG) + (b.headboard !== 'none' && b.headMount === 'bed' ? 0 : b.style === 'platform' ? BORDER : LEG), innerW, innerL, top: b.deckH + b.mattressH };
}

const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): TableBox => ({ min: [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)], size: [Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)] });

/** The bed's parts, placed: the 3D draws them, the estimate counts them. Roles reuse the table's so the 3D colors them alike. */
export function bedParts(b: Bed): TablePart[] {
  const { W, L, innerW, innerL } = bedSize(b);
  const out: TablePart[] = [];
  const hw = W / 2;
  const headZ = b.headboard !== 'none' && b.headMount === 'bed' ? 0 : b.style === 'platform' ? BORDER : LEG;
  const z0 = b.headboard !== 'none' && b.headMount === 'bed' ? 0 : 0;
  const footZ = L;
  if (b.style === 'platform') {
    // Deck: 3/4" plywood with a solid border band all around, the mattress sitting on it
    const deckY = b.deckH - PLY;
    out.push({ role: 'top', name: 'Deck', qty: 1, length: L, width: W, thick: PLY, note: `3/4" ${b.grade === 'paint' ? 'paint-grade birch' : b.species.toLowerCase()} plywood, edged with ${fmt(BORDER)} solid stock`, boxes: [box(-hw, deckY, z0, hw, b.deckH, footZ)] });
    out.push({ role: 'lip', name: 'Mattress stop', qty: 3, length: innerW, width: 1.5, thick: 0.75, note: 'solid, around the foot and sides, keeps the mattress from sliding', boxes: [box(-hw, b.deckH, footZ - BORDER, hw, b.deckH + 1.5, footZ), box(-hw, b.deckH, z0, -hw + BORDER, b.deckH + 1.5, footZ), box(hw - BORDER, b.deckH, z0, hw, b.deckH + 1.5, footZ)] });
    // Base: a plywood box set back from the deck edge, with a center spine and cross supports
    const bx = hw - SETBACK, bz0 = z0 + (headZ ? 0 : 1), bz1 = footZ - SETBACK, bh = deckY;
    out.push({ role: 'apron', name: 'Base side', qty: 2, length: bz1 - bz0, width: bh, thick: PLY, note: b.drawers ? `cut out for ${b.drawers} drawer${b.drawers > 1 ? 's' : ''}` : '3/4" plywood', boxes: [box(-bx, 0, bz0, -bx + PLY, bh, bz1), box(bx - PLY, 0, bz0, bx, bh, bz1)] });
    out.push({ role: 'apron', name: 'Base end', qty: 2, length: 2 * bx, width: bh, thick: PLY, note: '3/4" plywood', boxes: [box(-bx, 0, bz0, bx, bh, bz0 + PLY), box(-bx, 0, bz1 - PLY, bx, bh, bz1)] });
    out.push({ role: 'stretcher', name: 'Center spine and cross supports', qty: 1, length: bz1 - bz0, width: bh, thick: PLY, note: 'spine down the middle, a cross support every 24"', boxes: [box(-PLY / 2, 0, bz0, PLY / 2, bh, bz1)] });
    // Drawers: fronts in the base sides
    if (b.drawers > 0) {
      const sides = b.drawerSides === 'both' ? [-1, 1] : b.drawerSides === 'left' ? [-1] : [1];
      const run = bz1 - bz0 - 2 * PLY - 2, fw = run / b.drawers - 0.125, fh = Math.max(3, bh - 2);
      for (const sd of sides) for (let i = 0; i < b.drawers; i++) {
        const z = bz0 + PLY + 1 + i * (fw + 0.125);
        out.push({ role: 'shelf', name: 'Drawer front', qty: 1, length: fw, width: fh, thick: 0.75, note: `drawer under the ${sd < 0 ? 'left' : 'right'} side`, boxes: [box(sd * bx, 1, z, sd * (bx + 0.75), 1 + fh, z + fw)] });
      }
    }
  } else {
    // Frame: four legs, side and end rails, cleats and slats; a center rail on legs for wide beds
    const legH = Math.max(b.deckH + 4, b.footboard ? b.footH : 0);
    for (const [x, z] of [[-hw, z0], [hw - LEG, z0], [-hw, footZ - LEG], [hw - LEG, footZ - LEG]] as const) {
      const headPost = z === z0 && b.headboard !== 'none' && b.headMount === 'bed';
      out.push({ role: 'leg', name: headPost ? 'Headboard post' : b.footboard && z !== z0 ? 'Footboard post' : 'Leg', qty: 1, length: headPost ? b.headH : legH, width: LEG, thick: LEG, boxes: [box(x, 0, z, x + LEG, headPost ? b.headH : legH, z + LEG)] });
    }
    const ry0 = b.deckH - 3.5, ry1 = ry0 + RAIL_H;
    out.push({ role: 'apron', name: 'Side rail', qty: 2, length: footZ - z0 - 2 * LEG, width: RAIL_H, thick: RAIL_T, note: 'bed rail fasteners into the posts; a cleat inside carries the slats', boxes: [box(-hw, ry0, z0 + LEG, -hw + RAIL_T, ry1, footZ - LEG), box(hw - RAIL_T, ry0, z0 + LEG, hw, ry1, footZ - LEG)] });
    out.push({ role: 'apron', name: 'End rail', qty: b.headboard !== 'none' && b.headMount === 'bed' ? 1 : 2, length: W - 2 * LEG, width: RAIL_H, thick: RAIL_T, boxes: [box(-hw + LEG, ry0, footZ - RAIL_T, hw - LEG, ry1, footZ), ...(b.headboard !== 'none' && b.headMount === 'bed' ? [] : [box(-hw + LEG, ry0, z0, hw - LEG, ry1, z0 + RAIL_T)])] });
    const n = Math.ceil(innerL / 6);
    out.push({ role: 'slat', name: 'Slat', qty: n, length: innerW + 1, width: 3.5, thick: 0.75, note: 'about 2-1/2" apart, screwed to the cleats', boxes: Array.from({ length: n }, (_, i) => { const z = z0 + LEG + i * (innerL / n); return box(-innerW / 2 - 0.5, b.deckH - 0.75, z, innerW / 2 + 0.5, b.deckH, z + 3.5); }) });
    if (innerW > 50) out.push({ role: 'stretcher', name: 'Center rail on legs', qty: 1, length: innerL, width: 3.5, thick: 1.5, note: 'down the middle under the slats, with two legs to the floor', boxes: [box(-0.75, 0, z0 + LEG, 0.75, b.deckH - 0.75, footZ - LEG)] });
    if (b.footboard) out.push({ role: 'breadboard', name: 'Footboard panel', qty: 1, length: W - 2 * LEG, width: b.footH - ry1, thick: HB_T, note: 'frame and flat panel between the posts', boxes: [box(-hw + LEG, ry1, footZ - HB_T, hw - LEG, b.footH - 1, footZ)] });
  }
  // Headboard: across the full width at the head, from the deck (or the wall cleat) up to its height
  if (b.headboard !== 'none') {
    const y0 = b.headMount === 'wall' ? b.deckH + 2 : b.style === 'platform' ? 0 : b.deckH - 3.5;
    const x0 = b.style === 'frame' && b.headMount === 'bed' ? -hw + LEG : -hw, x1 = -x0;
    out.push({ role: b.headboard === 'upholstered' ? 'cushion' : 'breadboard', name: b.headboard === 'upholstered' ? 'Upholstered headboard' : b.headboard === 'panel' ? 'Headboard, frame and flat panels' : 'Headboard, solid slab',
      qty: 1, length: x1 - x0, width: b.headH - y0, thick: HB_T,
      note: b.headMount === 'wall' ? 'hung on the wall on a French cleat, its bottom just above the mattress' : b.style === 'platform' ? 'fastened to the base and deck' : 'between the headboard posts',
      boxes: [box(x0, y0, -HB_T, x1, b.headH, 0)] });
  }
  // The mattress, for scale in the 3D (not built, not priced)
  const mz0 = b.style === 'platform' ? 0 : LEG, mw = mattressOf(b).w, ml = mattressOf(b).l;
  out.push({ role: 'cushion', name: 'Mattress (for scale)', qty: 0, length: ml, width: mw, thick: b.mattressH, boxes: [box(-mw / 2, b.deckH, mz0 + CLEAR, mw / 2, b.deckH + b.mattressH, mz0 + CLEAR + ml)] });
  return applyEdits(out, b);
}

/** Things to check on the design, in plain words. */
export function bedChecks(b: Bed): string[] {
  const out: string[] = [];
  const { top } = bedSize(b);
  if (top < 20 || top > 27) out.push(`The mattress top is ${fmt(top)} off the floor; 20"–25" is comfortable to sit on and get in and out (lower for a low platform look).`);
  if (b.headboard !== 'none') {
    const shows = b.headH - top;
    if (shows < 10) out.push(`Only ${fmt(shows)} of headboard shows above the mattress; 14"–24" is typical, more to sit up against.`);
  }
  if (b.style === 'platform' && b.drawers > 0) {
    const fh = b.deckH - PLY - 2;
    if (fh < 6) out.push(`The base is only ${fmt(b.deckH - PLY)} tall: drawers ${fmt(fh)} high hold little; raise the deck to 16"+ for useful drawers.`);
    out.push('Leave about 22" clear beside the bed for the drawers to open, plus room to stand.');
  }
  if (b.style === 'frame' && mattressOf(b).w > 50) out.push('A bed this wide gets a center rail on two legs under the slats so the slats don’t sag.');
  if (b.headboard === 'upholstered') out.push('Upholstered headboard by the upholsterer: fabric to be selected; the shop builds the plywood back and the mounting.');
  if (b.headMount === 'wall') out.push('A wall-hung headboard goes on a French cleat screwed into the studs; locate them before setting its width.');
  return out;
}

/** Labor standards for beds, in hours. */
export const bedStandards = {
  layout: 2,
  platformBase: 6, deckPerSqFt: 0.06, drawerEach: 1.5,
  legs: 3, rails: 4, slats: 2, centerRail: 1, footboard: 5,
  headPanel: 6, headSlab: 3, headUpholstered: 2, wallCleat: 0.5, headPerSqFt: 0.06,
  sandPerSqFt: 0.04, finishBase: { clear: 3, stain: 4, paint: 4, oil: 2, painter: 0 } as Record<TableFinish, number>, finishPerSqFt: 0.05,
  delivery: 3,
};

/** Hours and materials for one bed. */
export function bedEstimate(b: Bed, p: Project): { hours: { label: string; hours: number }[]; materials: { label: string; cost: number; detail: string; missing?: string }[] } {
  const s = bedStandards;
  const { W, L } = bedSize(b);
  const parts = bedParts(b);
  const deckSqFt = (W * L) / 144;
  const hb = parts.find((x) => x.name.startsWith('Headboard') || x.name.startsWith('Upholstered'));
  const hbSqFt = hb ? (hb.length * hb.width) / 144 : 0;
  const fronts = parts.filter((x) => x.name === 'Drawer front');
  const hours: { label: string; hours: number }[] = [{ label: 'Layout, drawings and stock selection', hours: s.layout }];
  if (b.style === 'platform') {
    hours.push({ label: `Platform base and deck (${deckSqFt.toFixed(1)} sq ft)`, hours: s.platformBase + s.deckPerSqFt * deckSqFt });
    if (fronts.length) hours.push({ label: `${fronts.length} drawers: fronts, slides and fitting`, hours: fronts.length * s.drawerEach });
  } else {
    hours.push({ label: 'Legs and posts', hours: s.legs }, { label: 'Rails with bed rail fasteners, cleats', hours: s.rails }, { label: 'Slats', hours: s.slats });
    if (parts.some((x) => x.name === 'Center rail on legs')) hours.push({ label: 'Center rail on legs', hours: s.centerRail });
    if (b.footboard) hours.push({ label: 'Footboard', hours: s.footboard });
  }
  if (b.headboard !== 'none') {
    const base = b.headboard === 'panel' ? s.headPanel : b.headboard === 'slab' ? s.headSlab : s.headUpholstered;
    hours.push({ label: b.headboard === 'upholstered' ? 'Headboard back and mounting (upholstered by others)' : `Headboard, ${b.headboard === 'panel' ? 'frame and flat panels' : 'solid slab'}`, hours: base + (b.headboard === 'upholstered' ? 0 : s.headPerSqFt * hbSqFt) });
    if (b.headMount === 'wall') hours.push({ label: 'French cleat, hung on the wall', hours: s.wallCleat });
  }
  const finishArea = deckSqFt * 1.5 + hbSqFt * 2;
  hours.push({ label: 'Sanding', hours: s.sandPerSqFt * finishArea + 1 });
  if (b.finish !== 'painter') hours.push({ label: tableFinishLabel[b.finish], hours: s.finishBase[b.finish] + s.finishPerSqFt * finishArea });
  hours.push(...editHours(b));
  hours.push({ label: 'Delivery, assembly and set in place', hours: s.delivery });

  // Materials: sheet goods by area, solid stock by board foot, drawer boxes and slides, hardware
  // A paneled headboard is about 40% solid frame and 60% plywood panels; an upholstered one is a plywood back
  const built = parts.filter((x) => x.qty > 0);
  const hbSolid = (x: TablePart) => (x.name.startsWith('Upholstered') ? 0 : x.name.includes('flat panel') || x.name.includes('Footboard') ? 0.4 : 1);
  const sheetArea = (built.filter((x) => x.thick === PLY && x.role !== 'lip' && x.role !== 'slat' && x.name !== 'Drawer front').reduce((t, x) => t + x.qty * x.length * x.width, 0)
    + built.filter((x) => x.role === 'breadboard' || x.role === 'cushion').reduce((t, x) => t + (1 - hbSolid(x)) * x.length * x.width, 0)) * 1.2;
  const sheets = Math.max(1, Math.ceil(sheetArea / (48 * 96)));
  const sheetMat = b.grade === 'paint' ? '3/4" paint-grade birch plywood' : `3/4" ${b.species.toLowerCase()} plywood`;
  const sheetPrice = p.sheetPrices?.[sheetMat] ?? p.cutlist?.stock.find((x) => x.material === sheetMat)?.price ?? 0;
  const solidBF = built.filter((x) => x.thick !== PLY || x.role === 'lip' || x.role === 'slat').reduce((t, x) => t + ((x.role === 'breadboard' || x.role === 'cushion' ? hbSolid(x) : 1) * x.qty * x.length * x.width * Math.max(1, x.thick + 0.25)) / 144, 0) * 1.3;
  const sp = b.grade === 'paint' ? 'Poplar' : b.species;
  const perBF = b.pricePerBF || amPerBF(sp)?.perBF || 0;
  const materials: { label: string; cost: number; detail: string; missing?: string }[] = [
    { label: `Plywood (${sheetMat.replace(/^3\/4" /, '')})`, cost: sheets * sheetPrice, detail: `${sheets} sheet${sheets > 1 ? 's' : ''}`, ...(sheetPrice ? {} : { missing: `Enter a price for ${sheetMat} (price book or Sheet cutlist)` }) },
    { label: `${sp} lumber`, cost: solidBF * perBF, detail: `about ${Math.ceil(solidBF)} BF${perBF ? ` at $${perBF.toFixed(2)}/BF${b.pricePerBF ? '' : ' (A&M list)'}` : ''}`, ...(perBF ? {} : { missing: `Enter a $/BF for ${sp.toLowerCase()}` }) },
    { label: 'Glue, fasteners, abrasives', cost: 40, detail: b.style === 'frame' ? 'plus bed rail fasteners' : 'screws, glue, sandpaper' },
  ];
  if (b.style === 'frame') materials.push({ label: 'Bed rail fasteners', cost: 30, detail: '4 sets' });
  if (fronts.length) {
    const fw = fronts[0].length, fh = fronts[0].width;
    const boxEach = eaglePrice('drawerBox', fw - 1, Math.max(3, fh - 1.5), 21);
    materials.push({ label: 'Drawer boxes (Eagle dovetail) and full-extension slides', cost: fronts.length * (boxEach + 38), detail: `${fronts.length} × about $${Math.round(boxEach)} box + $38 slides` });
  }
  if (b.headboard === 'upholstered') materials.push({ label: 'Headboard upholstery (upholsterer)', cost: b.upholsteryPrice, detail: b.upholsteryPrice ? 'upholsterer’s price' : 'enter the upholsterer’s price', ...(b.upholsteryPrice ? {} : { missing: 'Get the upholsterer’s price for the headboard' }) });
  if (b.finish === 'painter') materials.push({ label: 'Finishing (by others)', cost: b.finishPrice, detail: 'Finisher’s price' });
  else materials.push({ label: 'Finish materials', cost: finishArea * 0.9 + 25, detail: tableFinishLabel[b.finish] });
  return { hours, materials };
}

/** The scope line, in the wording of the quotes. */
export function bedScope(b: Bed): string {
  const m = mattressOf(b);
  const { W, L, top } = bedSize(b);
  const size = b.mattress === 'custom' ? `${fmt(m.w)} × ${fmt(m.l)} mattress` : `${mattressSizes[b.mattress].label.replace(/ \(.*/, '').toLowerCase()} mattress`;
  return [
    `${b.name}: custom ${b.style === 'platform' ? 'platform bed' : 'bed frame'} for a ${size}, approx ${fmt(W)}W x ${fmt(L)}L, mattress top about ${fmt(top)} off the floor`,
    b.grade === 'paint' ? 'paint grade' : `${b.species.toLowerCase()}`,
    b.style === 'platform' ? `solid deck on a set-back base${b.drawers ? ` with (${b.drawers * (b.drawerSides === 'both' ? 2 : 1)}) drawers` : ''}` : `legs, rails and slats${b.footboard ? ' with a footboard' : ''}`,
    b.headboard === 'none' ? '' : `${b.headboard === 'panel' ? 'flat panel' : b.headboard === 'slab' ? 'solid' : 'upholstered (fabric to be selected)'} headboard about ${fmt(b.headH)} high${b.headMount === 'wall' ? ', wall mounted' : ''}`,
    b.finish === 'painter' ? 'finish by others' : tableFinishLabel[b.finish].replace(' (shop)', '').toLowerCase() + ' finish',
    'delivered and assembled in place',
  ].filter(Boolean).join('; ');
}
