// Sheet optimizer: guillotine layouts that cut the way a table saw does.
// Rip full-length strips first, crosscut each strip into columns, then rip columns into parts.

export interface CutPart {
  id: string;
  /** What gets written on the part: "B1 Side". */
  label: string;
  material: string;
  /** Along the grain. */
  length: number;
  width: number;
  /** Grain must run with the sheet's length. */
  grain: boolean;
  /** Long edges to edge band (0–2). */
  band: number;
}

export interface Stock {
  id: string;
  label: string;
  material: string;
  length: number;
  width: number;
  /** null = as many as needed. */
  qty: number | null;
  price: number;
}

export interface OptimizerOptions {
  kerf: number;
  /** Cleaned off each factory edge before the first cut. */
  trim: number;
  considerGrain: boolean;
  /** Smallest leftover worth keeping, in either direction. */
  minOffcut: number;
}

export interface Placed { part: CutPart; x: number; y: number; l: number; w: number; rotated: boolean; n: number }
export interface Cut { n: number; kind: 'rip' | 'cross'; x1: number; y1: number; x2: number; y2: number; text: string }
export interface Offcut { x: number; y: number; l: number; w: number }
export interface SheetLayout { stock: Stock; placed: Placed[]; cuts: Cut[]; offcuts: Offcut[]; usedArea: number }
export interface MaterialResult { material: string; sheets: SheetLayout[]; unplaced: CutPart[] }

interface Item { part: CutPart; l: number; w: number; rotated: boolean }
interface Column { x: number; l: number; pieces: { item: Item; y: number }[] }
interface Strip { y: number; w: number; columns: Column[] }
interface OpenSheet { stock: Stock; strips: Strip[]; freeY: number }

const EPS = 1e-6;

function orient(p: CutPart, o: OptimizerOptions, pref: 'grain' | 'long' | 'wide'): Item {
  if ((o.considerGrain && p.grain) || pref === 'grain') return { part: p, l: p.length, w: p.width, rotated: false };
  const long = Math.max(p.length, p.width);
  const short = Math.min(p.length, p.width);
  const [l, w] = pref === 'long' ? [long, short] : [short, long];
  return { part: p, l, w, rotated: l !== p.length };
}

/** One packing pass with a given sort order and orientation preference. */
function pack(parts: CutPart[], stocks: Stock[], o: OptimizerOptions, order: (a: Item, b: Item) => number, pref: 'grain' | 'long' | 'wide') {
  const k = o.kerf;
  let items = parts.map((p) => orient(p, o, pref)).sort(order);
  const used = new Map<string, number>();
  const sheets: OpenSheet[] = [];
  const unplaced: CutPart[] = [];

  const usable = (s: Stock) => ({ L: s.length - 2 * o.trim, W: s.width - 2 * o.trim });
  const fits = (it: Item, s: Stock) => it.l <= usable(s).L + EPS && it.w <= usable(s).W + EPS;
  // Parts that could fit rotated (grain-free) get turned rather than left out
  items = items.map((it) => {
    if (stocks.some((s) => fits(it, s))) return it;
    const turned = { ...it, l: it.w, w: it.l, rotated: !it.rotated };
    return !(o.considerGrain && it.part.grain) && stocks.some((s) => fits(turned, s)) ? turned : it;
  });

  const newSheet = (it: Item): OpenSheet | null => {
    const stock = stocks.find((s) => (s.qty == null || (used.get(s.id) ?? 0) < s.qty) && fits(it, s));
    if (!stock) return null;
    used.set(stock.id, (used.get(stock.id) ?? 0) + 1);
    const sh = { stock, strips: [], freeY: 0 };
    sheets.push(sh);
    return sh;
  };

  while (items.length) {
    const first = items[0];
    const SW = first.w;
    // A strip goes on the first open sheet with enough width left, else a new sheet
    let sheet = sheets.find((sh) => {
      const { L, W } = usable(sh.stock);
      return first.l <= L + EPS && sh.freeY + SW <= W + EPS;
    });
    if (!sheet) sheet = newSheet(first) ?? undefined;
    if (!sheet) {
      unplaced.push(first.part);
      items.shift();
      continue;
    }
    const { L } = usable(sheet.stock);
    const strip: Strip = { y: sheet.freeY, w: SW, columns: [] };
    let x = 0;
    for (;;) {
      // Widest part that still fits the strip's remaining length starts the next column
      const idx = items.findIndex((it) => it.w <= SW + EPS && it.l <= L - x + EPS);
      if (idx < 0) break;
      const lead = items.splice(idx, 1)[0];
      const col: Column = { x, l: lead.l, pieces: [{ item: lead, y: 0 }] };
      let usedW = lead.w;
      // Stack narrower, no-longer parts across the rest of the strip width
      for (;;) {
        const room = SW - usedW - k;
        const j = items.findIndex((it) => it.l <= col.l + EPS && it.w <= room + EPS);
        if (j < 0) break;
        const it = items.splice(j, 1)[0];
        col.pieces.push({ item: it, y: usedW + k });
        usedW += k + it.w;
      }
      strip.columns.push(col);
      x += lead.l + k;
    }
    sheet.strips.push(strip);
    sheet.freeY += SW + k;
  }
  return { sheets, unplaced };
}

/** Turn packed strips into placed parts, a numbered cut sequence and leftover offcuts. */
function finish(sh: OpenSheet, o: OptimizerOptions, startN: number): SheetLayout {
  const t = o.trim;
  const k = o.kerf;
  const L = sh.stock.length - 2 * t;
  const W = sh.stock.width - 2 * t;
  const placed: Placed[] = [];
  const cuts: Cut[] = [];
  const offcuts: Offcut[] = [];
  let n = 1;
  let pn = startN;
  const keep = (x: number, y: number, l: number, w: number) => {
    if (l >= o.minOffcut && w >= o.minOffcut) offcuts.push({ x, y, l, w });
  };
  sh.strips.forEach((st) => {
    const y0 = t + st.y;
    const y1 = y0 + st.w;
    if (y1 < t + W - EPS) cuts.push({ n: n++, kind: 'rip', x1: t, y1, x2: t + L, y2: y1, text: `Rip ${fmtIn(st.w)} strip` });
    let endX = 0;
    st.columns.forEach((col) => {
      const cx = t + col.x + col.l;
      if (cx < t + L - EPS) cuts.push({ n: n++, kind: 'cross', x1: cx, y1: y0, x2: cx, y2: y1, text: `Crosscut at ${fmtIn(col.l)}` });
      col.pieces.forEach((pc, i) => {
        placed.push({ part: pc.item.part, x: t + col.x, y: y0 + pc.y, l: pc.item.l, w: pc.item.w, rotated: pc.item.rotated, n: pn++ });
        const bottom = pc.y + pc.item.w;
        const more = i < col.pieces.length - 1;
        if (bottom < st.w - EPS) {
          cuts.push({ n: n++, kind: 'rip', x1: t + col.x, y1: y0 + bottom, x2: cx, y2: y0 + bottom, text: `Rip to ${fmtIn(pc.item.w)}` });
          if (!more) keep(t + col.x, y0 + bottom + k, col.l, st.w - bottom - k);
        }
      });
      endX = col.x + col.l + k;
    });
    keep(t + endX, y0, L - endX, st.w);
  });
  keep(t, t + sh.freeY, L, W - sh.freeY);
  const usedArea = placed.reduce((s, p) => s + p.l * p.w, 0);
  return { stock: sh.stock, placed, cuts, offcuts, usedArea };
}

const fmtIn = (v: number) => {
  const s = Math.round(v * 16);
  const whole = Math.floor(s / 16);
  let r = s % 16;
  if (!r) return `${whole}"`;
  let d = 16;
  while (r % 2 === 0) { r /= 2; d /= 2; }
  return whole ? `${whole} ${r}/${d}"` : `${r}/${d}"`;
};

const orders: ((a: Item, b: Item) => number)[] = [
  (a, b) => b.w - a.w || b.l - a.l,
  (a, b) => b.l - a.l || b.w - a.w,
  (a, b) => b.l * b.w - a.l * a.w,
];

/**
 * Lay out every material on its stock. Tries several sort orders and orientations and keeps the
 * one using the fewest sheets, then the one leaving the biggest clean leftover.
 */
export function optimize(parts: CutPart[], stock: Stock[], o: OptimizerOptions): MaterialResult[] {
  const materials = [...new Set(parts.map((p) => p.material))];
  return materials.map((material) => {
    const ps = parts.filter((p) => p.material === material);
    const ss = stock.filter((s) => s.material === material);
    // Remnants first, so offcuts get used before new sheets are opened
    const ordered = [...ss].sort((a, b) => (a.qty == null ? 1 : 0) - (b.qty == null ? 1 : 0) || a.length * a.width - b.length * b.width);
    let best: ReturnType<typeof pack> | null = null;
    let bestScore = Infinity;
    for (const order of orders) {
      for (const pref of ['grain', 'long', 'wide'] as const) {
        const r = pack(ps, ordered, o, order, pref);
        const area = r.sheets.reduce((s, sh) => s + sh.stock.length * sh.stock.width, 0);
        const last = r.sheets[r.sheets.length - 1];
        const lastFree = last ? last.stock.width - last.freeY : 0;
        // Fewest sheets first; then keep parts in their natural orientation (easier to follow at the saw); then the biggest leftover
        const turned = r.sheets.reduce((s, sh) => s + sh.strips.reduce((t, st) => t + st.columns.reduce((u, c) => u + c.pieces.filter((p) => p.item.rotated).length, 0), 0), 0);
        const score = r.unplaced.length * 1e9 + area * 1e3 + turned * 10 - lastFree / 100;
        if (score < bestScore) { bestScore = score; best = r; }
      }
    }
    let n = 1;
    const sheets = (best?.sheets ?? []).map((sh) => {
      const lay = finish(sh, o, n);
      n += lay.placed.length;
      return lay;
    });
    return { material, sheets, unplaced: best?.unplaced ?? ps };
  });
}
