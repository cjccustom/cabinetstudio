// Interior doors from Reeb Millwork (reeb.com): the popular primed and wood stile & rail designs,
// described by their panel layout so they can be drawn and ordered. Layouts are read from Reeb's
// design pictures (Oct 2026); stile and rail sizes come from Reeb's In-Stock Dimensions cut sheets
// (see reebData.ts). Doors are for the design only: they aren't priced or ordered here.
import type { VisualBox } from './types';
import { reebDims } from './reebData';

export type PanelFill = 'raised' | 'flat' | 'glass' | 'louver' | 'plank';

export interface DoorRow {
  /** Share of the height between the top and bottom rails. */
  h: number;
  cols: number;
  fill: PanelFill;
  /** Arched top on the top panel(s). */
  arch?: boolean;
  /** Lites per panel, across x down, for glass. */
  lites?: [number, number];
  /** Diagonal brace across plank doors. */
  brace?: 'Z' | 'K';
}

export interface ReebDesign {
  code: string;
  name: string;
  line: 'primed' | 'wood';
  /** Species for wood doors. */
  species?: string;
  rows: DoorRow[];
  /** Catalog code for cut sheet lookups, when it differs (Reeb lists PR180 as 180). */
  ref?: string;
}

const r = (h: number, cols: number, fill: PanelFill, extra: Partial<DoorRow> = {}): DoorRow => ({ h, cols, fill, ...extra });

export const reebDesigns: ReebDesign[] = [
  // Primed stile & rail
  { code: 'PR8730', name: '3 panel shaker', line: 'primed', rows: [r(1, 1, 'flat'), r(1, 1, 'flat'), r(1, 1, 'flat')] },
  { code: 'PR8740', name: '4 panel shaker', line: 'primed', rows: [r(1, 1, 'flat'), r(1, 1, 'flat'), r(1, 1, 'flat'), r(1, 1, 'flat')], ref: 'PR8744' },
  { code: 'PR8082', name: '2 panel shaker', line: 'primed', rows: [r(1.6, 1, 'flat'), r(1, 1, 'flat')] },
  { code: 'PR8020', name: '1 panel shaker', line: 'primed', rows: [r(1, 1, 'flat')] },
  { code: 'PR8760', name: 'Craftsman, 3 panel', line: 'primed', rows: [r(0.45, 1, 'flat'), r(1.6, 2, 'flat')] },
  { code: 'PR8762', name: 'Craftsman, 4 panel', line: 'primed', rows: [r(0.45, 2, 'flat'), r(1.6, 2, 'flat')] },
  { code: 'PR82R', name: '2 panel raised', line: 'primed', rows: [r(1.6, 1, 'raised'), r(1, 1, 'raised')] },
  { code: 'PR82A', name: '2 panel arch top, raised', line: 'primed', rows: [r(1.6, 1, 'raised', { arch: true }), r(1, 1, 'raised')] },
  { code: 'PR66', name: '6 panel colonial, raised', line: 'primed', rows: [r(0.32, 2, 'raised'), r(1.05, 2, 'raised'), r(0.95, 2, 'raised')] },
  { code: 'PR7321L', name: 'Panel over louver', line: 'primed', rows: [r(1.6, 1, 'raised'), r(1, 1, 'louver')], ref: 'PR732L' },
  { code: 'PR732', name: 'Louver over panel', line: 'primed', rows: [r(1.6, 1, 'louver'), r(1, 1, 'raised')] },
  { code: 'PR730F', name: 'Full louver', line: 'primed', rows: [r(1.6, 1, 'louver'), r(1, 1, 'louver')], ref: 'PR730' },
  { code: 'PR8001', name: 'Full lite', line: 'primed', rows: [r(1, 1, 'glass')] },
  { code: 'PR8010', name: '10 lite French', line: 'primed', rows: [r(1, 1, 'glass', { lites: [2, 5] })] },
  { code: 'PR8015', name: '15 lite French', line: 'primed', rows: [r(1, 1, 'glass', { lites: [3, 5] })] },
  { code: 'PR8733F', name: '3 lite shaker, frosted', line: 'primed', rows: [r(1, 1, 'glass'), r(1, 1, 'glass'), r(1, 1, 'glass')] },
  { code: 'PR180', name: 'Barn, Z brace', line: 'primed', rows: [r(1, 1, 'plank', { brace: 'Z' })], ref: '180' },
  { code: 'PR181', name: 'Barn, K brace', line: 'primed', rows: [r(1, 1, 'plank'), r(1, 1, 'plank', { brace: 'K' })], ref: '181' },
  // Wood stile & rail
  { code: 'MP1022', name: 'Maple 2 panel shaker', line: 'wood', species: 'Maple', rows: [r(1.6, 1, 'flat'), r(1, 1, 'flat')] },
  { code: 'MP1033', name: 'Maple craftsman, 3 panel', line: 'wood', species: 'Maple', rows: [r(0.45, 1, 'flat'), r(1.6, 2, 'flat')] },
  { code: 'O66', name: 'Oak 6 panel', line: 'wood', species: 'Red oak', rows: [r(0.32, 2, 'raised'), r(1.05, 2, 'raised'), r(0.95, 2, 'raised')] },
  { code: 'O1515', name: 'Oak 15 lite French', line: 'wood', species: 'Red oak', rows: [r(1, 1, 'glass', { lites: [3, 5] })] },
  { code: 'F760', name: 'Fir craftsman, 3 panel', line: 'wood', species: 'Fir', rows: [r(0.45, 1, 'flat'), r(1.6, 2, 'flat')] },
  { code: 'F55', name: 'Fir 5 panel', line: 'wood', species: 'Fir', rows: [r(1, 1, 'flat'), r(1, 1, 'flat'), r(1, 1, 'flat'), r(1, 1, 'flat'), r(1, 1, 'flat')] },
  { code: 'F9266', name: 'Fir 6 panel', line: 'wood', species: 'Fir', rows: [r(0.32, 2, 'raised'), r(1.05, 2, 'raised'), r(0.95, 2, 'raised')] },
  { code: 'F82A', name: 'Fir 2 panel arch top', line: 'wood', species: 'Fir', rows: [r(1.6, 1, 'raised', { arch: true }), r(1, 1, 'raised')] },
  { code: 'F1315', name: 'Fir 15 lite French', line: 'wood', species: 'Fir', rows: [r(1, 1, 'glass', { lites: [3, 5] })] },
  { code: 'KA5082ARP', name: 'Knotty alder 2 panel raised', line: 'wood', species: 'Knotty alder', rows: [r(1.6, 1, 'raised'), r(1, 1, 'raised')], ref: 'KA82ASRR' },
  { code: 'KA5082APRP', name: 'Knotty alder 2 panel arch, plank', line: 'wood', species: 'Knotty alder', rows: [r(1.6, 1, 'plank', { arch: true }), r(1, 1, 'plank')], ref: 'KA82ASRP' },
  { code: 'KA180PLK', name: 'Knotty alder barn, Z brace', line: 'wood', species: 'Knotty alder', rows: [r(1, 1, 'plank', { brace: 'Z' })], ref: '180' },
  { code: 'KA181PLK', name: 'Knotty alder barn, K brace', line: 'wood', species: 'Knotty alder', rows: [r(1, 1, 'plank'), r(1, 1, 'plank', { brace: 'K' })], ref: '181' },
  { code: 'P3912', name: 'Pine 15 lite French', line: 'wood', species: 'Pine', rows: [r(1, 1, 'glass', { lites: [3, 5] })] },
  { code: 'P1053', name: 'Pine 4 panel', line: 'wood', species: 'Pine', rows: [r(1.25, 2, 'raised'), r(1, 2, 'raised')] },
];

export const designByCode = (code?: string) => reebDesigns.find((d) => d.code === code);

/** Reeb's stock interior slab widths and heights. */
export const stockWidths = [18, 20, 24, 28, 30, 32, 36];
export const stockHeights = [80, 84, 96];
/** Door sizes the trade way: 2/8 x 6/8 is 32" x 80". */
export const tradeSize = (inches: number) => `${Math.floor(inches / 12)}/${Math.round(inches % 12)}`;

/** Nearest stock slab for a finished opening (1/8" clearance each side and at the head). */
export function stockSlab(openingW: number, openingH: number, leaves = 1) {
  const each = (openingW - 0.25 - (leaves > 1 ? 0.125 : 0)) / leaves;
  const w = stockWidths.reduce((a, b) => (Math.abs(b - each) < Math.abs(a - each) ? b : a));
  const h = stockHeights.reduce((a, b) => (Math.abs(b - (openingH - 0.125)) < Math.abs(a - (openingH - 0.125)) ? b : a));
  return { w, h, fits: Math.abs(w - each) < 0.6 && Math.abs(h - (openingH - 0.125)) < 1 };
}

export interface DoorProportions { stile: number; top: number; lock: number; bottom: number; rail: number; mullion: number; thickness: number }
/** Typical interior stile & rail proportions, for designs Reeb's cut sheet doesn't list. */
export const reebProportions: DoorProportions = { stile: 4.5, top: 4.5, lock: 7.75, bottom: 9, rail: 4.5, mullion: 4.5, thickness: 1.375 };

/** Trade height of a door: 80" is 6/8. */
const heightKey = (h: number) => tradeSize(h);
const lookup = <T,>(table: Record<string, T>, d: ReebDesign) => table[d.code] ?? (d.ref ? table[d.ref] : undefined);

/** Stile and rail sizes from Reeb's cut sheet for this design and height, or typical ones. */
export function proportionsFor(d: ReebDesign, h: number): DoorProportions & { fromSheet: boolean } {
  const byH = lookup(reebDims, d);
  const r = byH?.[heightKey(h)] ?? byH?.['6/8'];
  if (!r || r.stile == null || r.top == null || r.bottom == null) return { ...reebProportions, fromSheet: false };
  // No lock rail listed means the intermediate rails match the top rail
  return { stile: r.stile, top: r.top, lock: r.lock ?? r.top, bottom: r.bottom, rail: r.lock ?? r.top, mullion: Math.min(r.stile, 4.5), thickness: 1.375, fromSheet: true };
}


export interface DoorDrawing { boxes: VisualBox[]; glass: VisualBox[]; braces: { a: [number, number]; b: [number, number]; w: number; z: number; t: number }[] }

/**
 * A door slab drawn face-on: x across, y up from its bottom, z from its back face (0) to its face (t).
 * Rails between rows get the lock rail width when they fall near lockset height.
 */
export function doorDrawing(d: ReebDesign, W: number, H: number, p: DoorProportions = reebProportions): DoorDrawing {
  const t = p.thickness;
  const boxes: VisualBox[] = [];
  const glass: VisualBox[] = [];
  const braces: DoorDrawing['braces'] = [];
  const vb = (x: number, y: number, z: number, sx: number, sy: number, sz: number, shade?: number): VisualBox => ({ min: [x, y, z], size: [sx, sy, sz], shade });
  const plankOnly = d.rows.every((r) => r.fill === 'plank' && r.brace);
  if (plankOnly) {
    // Barn doors: a plank field inside the frame, a mid rail on K braces, and the brace on the face
    boxes.push(vb(0, 0, 0, p.stile, H, t), vb(W - p.stile, 0, 0, p.stile, H, t));
    boxes.push(vb(p.stile, H - p.top, 0, W - 2 * p.stile, p.top, t), vb(p.stile, 0, 0, W - 2 * p.stile, p.bottom, t));
    boxes.push(vb(p.stile, p.bottom, t / 2 - 0.375, W - 2 * p.stile, H - p.top - p.bottom, 0.75, 0.97));
    const n = Math.max(3, Math.round((W - 2 * p.stile) / 5));
    for (let i = 1; i < n; i++) boxes.push(vb(p.stile + ((W - 2 * p.stile) * i) / n - 0.06, p.bottom, t / 2 + 0.375, 0.12, H - p.top - p.bottom, 0.02, 0.8));
    const bw = 4.5, x0 = p.stile, x1 = W - p.stile, y0 = p.bottom, y1 = H - p.top;
    if (d.rows.length === 1) braces.push({ a: [x0 + bw / 2, y0 + bw], b: [x1 - bw / 2, y1 - bw], w: bw, z: t / 2 + 0.375, t: 0.75 });
    else {
      const ym = (y0 + y1) / 2;
      boxes.push(vb(p.stile, ym - p.rail / 2, 0, W - 2 * p.stile, p.rail, t));
      braces.push({ a: [x0 + bw / 2, ym], b: [x1 - bw / 2, y1 - bw], w: bw, z: t / 2 + 0.375, t: 0.75 }, { a: [x0 + bw / 2, ym], b: [x1 - bw / 2, y0 + bw], w: bw, z: t / 2 + 0.375, t: 0.75 });
    }
    return { boxes, glass, braces };
  }
  // Stiles full height
  boxes.push(vb(0, 0, 0, p.stile, H, t), vb(W - p.stile, 0, 0, p.stile, H, t));
  const inner = H - p.top - p.bottom;
  const nRails = d.rows.length - 1;
  // Estimate rails, then share what's left between the rows by their weights
  const railW = (y: number) => (y > 30 && y < 44 ? p.lock : p.rail);
  const total = d.rows.reduce((s, r) => s + r.h, 0);
  let guess = inner - nRails * p.rail;
  let y = H - p.top;
  boxes.push(vb(p.stile, H - p.top, 0, W - 2 * p.stile, p.top, t));
  boxes.push(vb(p.stile, 0, 0, W - 2 * p.stile, p.bottom, t));
  const lockRow = (() => {
    // Rail closest to 36" off the floor carries the lockset
    let acc = H - p.top, best = -1, bestD = Infinity;
    for (let i = 0; i < nRails; i++) { acc -= (guess * d.rows[i].h) / total; const dd = Math.abs(acc - 36); if (dd < bestD) { bestD = dd; best = i; } }
    return bestD < 14 ? best : -1;
  })();
  guess = inner - nRails * p.rail - (lockRow >= 0 ? p.lock - p.rail : 0);
  d.rows.forEach((row, i) => {
    const h = (guess * row.h) / total;
    const y0 = y - h;
    const colW = (W - 2 * p.stile - (row.cols - 1) * p.mullion) / row.cols;
    for (let c = 0; c < row.cols; c++) {
      const x0 = p.stile + c * (colW + p.mullion);
      if (c > 0) boxes.push(vb(x0 - p.mullion, y0, 0, p.mullion, h, t));
      panel(row, x0, y0, colW, h);
    }
    y = y0;
    if (i < nRails) {
      const rw = i === lockRow ? p.lock : railW(-1);
      boxes.push(vb(p.stile, y - rw, 0, W - 2 * p.stile, rw, t));
      y -= rw;
    }
  });
  function panel(row: DoorRow, x0: number, y0: number, w: number, h: number) {
    const back = t / 2 - 0.25;
    if (row.fill === 'glass') {
      glass.push(vb(x0, y0, t / 2 - 0.05, w, h, 0.1));
      if (row.lites) {
        const [cx, cy] = row.lites;
        const m = 0.875;
        for (let i = 1; i < cx; i++) boxes.push(vb(x0 + (w * i) / cx - m / 2, y0, t / 2 - 0.4, m, h, 0.8));
        for (let j = 1; j < cy; j++) boxes.push(vb(x0, y0 + (h * j) / cy - m / 2, t / 2 - 0.4, w, m, 0.8));
      }
    } else if (row.fill === 'louver') {
      boxes.push(vb(x0, y0, back, w, h, 0.25, 0.75));
      for (let s = y0 + 0.75; s < y0 + h - 0.75; s += 1.25) boxes.push(vb(x0, s, back, w, 0.4, t - back - 0.15, 0.92));
    } else if (row.fill === 'plank') {
      boxes.push(vb(x0, y0, back, w, h, 0.75, 0.97));
      const n = Math.max(2, Math.round(w / 4));
      for (let i = 1; i < n; i++) boxes.push(vb(x0 + (w * i) / n - 0.06, y0, back + 0.75, 0.12, h, 0.02, 0.8));
    } else {
      // Flat panels sit back from the frame face; raised panels bring a field forward
      boxes.push(vb(x0, y0, back, w, h, 0.5, 0.93));
      if (row.fill === 'raised' && w > 4 && h > 4) boxes.push(vb(x0 + 1.5, y0 + 1.5, back + 0.5, w - 3, h - 3, 0.375, 1));
    }
    if (row.arch) {
      // Arch: the top rail drops into the panel at the stiles
      const rise = Math.min(4, h * 0.15);
      const steps = 6;
      for (let k = 0; k < steps; k++) {
        const fx = k / steps, fx2 = (k + 1) / steps;
        const drop = (u: number) => rise * (1 - Math.sin(Math.PI * u));
        const hh = Math.max(drop(fx), drop(fx2));
        if (hh > 0.05) boxes.push(vb(x0 + w * fx, y0 + h - hh, 0, w / steps, hh, t));
      }
    }
  }
  return { boxes, glass, braces };
}
