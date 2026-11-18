// CNC output: the same sheet parts the table saw cuts, laid out for a router and written as DXF, one
// file per sheet. Each part carries what the router does to it: its outline (a toe notch included),
// dados and rabbets pocketed into the inside face of the sides, and shelf pin holes. Operations go on
// their own layers, named with their depth, so any CAM program (the one that comes with the machine,
// Vectric, or Cabinet Studio's own toolpaths later) can pick each layer and assign a tool to it.
// The table saw cut list is left exactly as it was: this is a second way to cut the same parts.
import type { Cabinet, Part, Project, VisualBox } from './types';
import { buildParts, eff } from './parts';
import { resolveEnds } from './layout';
import { jobRooms } from './rooms';
import { cutStock, defaultCutlist, materialThickness, optimizerParts, type CutlistData } from './cutlist';
import { optimize, type MaterialResult, type OptimizerOptions, type SheetLayout } from './optimizer';
import { PINS } from '../drawings/views';

export interface CncSettings {
  /** Cutting bit diameter: parts are laid out at least this far apart. */
  bit: number;
  /** Kept clear of each factory edge. */
  edge: number;
  /** How far a through cut goes past the bottom of the part, into the spoilboard. */
  through: number;
  /** Shelf pin holes: diameter and depth. */
  pinDia: number;
  pinDepth: number;
  /** The DXF's units: the controllers quoted all run in millimetres. */
  units: 'mm' | 'in';
}

export const defaultCnc: CncSettings = { bit: 0.375, edge: 0.25, through: 1 / 64, pinDia: 5 / 25.4, pinDepth: 0.375, units: 'mm' };
export const cncOf = (data: CutlistData): CncSettings => ({ ...defaultCnc, ...data.cnc });

type Pt = [number, number];
/** What the router does to a part, in the part's own inches: u along its length (from its bottom or end), v across its width (from its back edge). */
export type CncOp =
  | { kind: 'outline'; pts: Pt[] }
  | { kind: 'pocket'; pts: Pt[]; depth: number; what: string }
  | { kind: 'drill'; at: Pt; dia: number; depth: number; what: string };

/** The rectilinear outline of rectangles that touch or overlap (a side with its toe notch): one closed loop. */
export function unionOutline(rects: { u0: number; u1: number; v0: number; v1: number }[]): Pt[] {
  const r6 = (x: number) => Math.round(x * 1e4) / 1e4;
  const us = [...new Set(rects.flatMap((r) => [r6(r.u0), r6(r.u1)]))].sort((a, b) => a - b);
  const vs = [...new Set(rects.flatMap((r) => [r6(r.v0), r6(r.v1)]))].sort((a, b) => a - b);
  const filled = (i: number, j: number) => {
    if (i < 0 || j < 0 || i >= us.length - 1 || j >= vs.length - 1) return false;
    const cu = (us[i] + us[i + 1]) / 2, cv = (vs[j] + vs[j + 1]) / 2;
    return rects.some((r) => cu > r.u0 && cu < r.u1 && cv > r.v0 && cv < r.v1);
  };
  // Boundary edges with the filled cell on their left, so they chain counter-clockwise
  const next = new Map<string, Pt>();
  const key = (p: Pt) => `${p[0]},${p[1]}`;
  for (let i = 0; i < us.length - 1; i++) for (let j = 0; j < vs.length - 1; j++) {
    if (!filled(i, j)) continue;
    if (!filled(i, j - 1)) next.set(key([us[i], vs[j]]), [us[i + 1], vs[j]]);
    if (!filled(i + 1, j)) next.set(key([us[i + 1], vs[j]]), [us[i + 1], vs[j + 1]]);
    if (!filled(i, j + 1)) next.set(key([us[i + 1], vs[j + 1]]), [us[i], vs[j + 1]]);
    if (!filled(i - 1, j)) next.set(key([us[i], vs[j + 1]]), [us[i], vs[j]]);
  }
  if (!next.size) return [];
  const start = [...next.keys()][0];
  const loop: Pt[] = [];
  let k = start;
  for (let guard = 0; guard < 10000; guard++) {
    const [a, b] = k.split(',').map(Number);
    loop.push([a, b]);
    const n = next.get(k)!;
    k = key(n);
    if (k === start) break;
  }
  // Drop points in the middle of a straight run
  return loop.filter((p, i) => {
    const a = loop[(i - 1 + loop.length) % loop.length], c = loop[(i + 1) % loop.length];
    return !((a[0] === p[0] && p[0] === c[0]) || (a[1] === p[1] && p[1] === c[1]));
  });
}

const rect = (u0: number, v0: number, u1: number, v1: number): Pt[] => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];

/**
 * A cabinet side's machining, laid out with its inside face up (the face the router works on):
 * u up the side from its bottom, v from its back edge to its front. The right-hand side is the mirror
 * of the left, so its front is at v = 0.
 */
function sideOps(c: Cabinet, parts: Part[], side: Part, st: ReturnType<typeof eff>, cnc: CncSettings): CncOp[] {
  const xs = side.boxes.map((b) => [b.min[0], b.min[0] + b.size[0]]);
  const cx = c.width / 2;
  const left = xs[0][0] < cx;
  const inner = left ? Math.min(...xs.map((x) => x[1])) : Math.max(...xs.map((x) => x[0]));
  const Y0 = Math.min(...side.boxes.map((b) => b.min[1]));
  const D = Math.max(...side.boxes.map((b) => b.min[2] + b.size[2]));
  const Z0 = Math.min(...side.boxes.map((b) => b.min[2]));
  // Inside face up: the left side reads back→front, the right side front→back
  const V = (z: number) => (left ? z - Z0 : D - z);
  const box2 = (b: VisualBox) => { const a = V(b.min[2]), e = V(b.min[2] + b.size[2]); return { u0: b.min[1] - Y0, u1: b.min[1] + b.size[1] - Y0, v0: Math.min(a, e), v1: Math.max(a, e) }; };
  const ops: CncOp[] = [{ kind: 'outline', pts: unionOutline(side.boxes.map(box2)) }];
  const dd = st.dadoDepth;
  const meets = (b: VisualBox) => (left ? Math.abs(b.min[0] - inner) < 0.05 : Math.abs(b.min[0] + b.size[0] - inner) < 0.05) && b.size[0] > 1;
  const joints: { y0: number; y1: number }[] = [];
  const pinShelves: number[] = [];
  for (const x of parts) {
    if (x === side || x.role === 'side') continue;
    const b = x.boxes.find(meets);
    if (!b) continue;
    const note = x.note ?? '';
    const r = box2(b);
    if (/dado/i.test(note) || x.role === 'bottom' || (x.role === 'top' && !/rabbet/i.test(note))) {
      ops.push({ kind: 'pocket', pts: rect(r.u0, r.v0, r.u1, r.v1), depth: dd, what: `dado for the ${x.name.toLowerCase()}` });
      joints.push({ y0: b.min[1], y1: b.min[1] + b.size[1] });
    } else if (/rabbet/i.test(note) && x.role !== 'back') {
      ops.push({ kind: 'pocket', pts: rect(r.u0, r.v0, r.u1, r.v1), depth: dd, what: `rabbet for the ${x.name.toLowerCase()}` });
      joints.push({ y0: b.min[1], y1: b.min[1] + b.size[1] });
    } else if (x.role === 'shelf') pinShelves.push(b.min[1]);
  }
  // The back's rabbet, along the back edge
  const back = parts.find((x) => x.role === 'back');
  const H = Math.max(...side.boxes.map((b) => b.min[1] + b.size[1]));
  let rw = 0;
  if (back?.boxes[0]) {
    const bb = back.boxes[0];
    rw = bb.min[2] + bb.size[2] - Z0;
    const a = V(Z0), e = V(Z0 + rw);
    ops.push({ kind: 'pocket', pts: rect(bb.min[1] - Y0, Math.min(a, e), Math.min(H, bb.min[1] + bb.size[1]) - Y0, Math.max(a, e)), depth: dd, what: 'rabbet for the back' });
  }
  // Shelf pin rows between the fixed parts above and below each adjustable shelf (as on the shop drawing)
  const fixed = joints.map((j) => [j.y0, j.y1] as const).sort((a, b) => a[0] - b[0]);
  const zones = new Map<string, [number, number]>();
  for (const y of pinShelves) {
    const below = fixed.filter((f) => f[1] <= y + 0.01).pop();
    const above = fixed.find((f) => f[0] >= y + 0.5);
    const lo = (below ? below[1] : Y0) + PINS.clear, hi = (above ? above[0] : H) - PINS.clear;
    if (hi > lo) zones.set(`${lo.toFixed(3)}|${hi.toFixed(3)}`, [lo, hi]);
  }
  for (const [lo, hi] of zones.values()) {
    const n = Math.floor((hi - lo) / PINS.pitch) + 1;
    const start = lo + ((hi - lo) - (n - 1) * PINS.pitch) / 2;
    for (let i = 0; i < n; i++) for (const z of [Z0 + rw + PINS.inset, D - PINS.inset]) ops.push({ kind: 'drill', at: [start + i * PINS.pitch - Y0, V(z)], dia: cnc.pinDia, depth: cnc.pinDepth, what: 'shelf pin' });
  }
  return ops;
}

/** Every cut part's machining, by the cut list's part id (cabinet id : part name : count). Parts with only an outline aren't listed. */
export function partOps(p: Project, cnc: CncSettings): Map<string, CncOp[]> {
  const out = new Map<string, CncOp[]>();
  for (const r of jobRooms(p)) {
    const rp = r.project;
    for (const c of rp.cabinets) {
      if (c.kind === 'pilaster' || c.kind === 'shelf' || c.kind === 'mantel' || c.corner) continue;
      const parts = buildParts(c, rp.settings, resolveEnds(rp.room, rp.cabinets, c));
      const st = eff(c, rp.settings);
      const counts = new Map<string, number>();
      for (const part of parts) {
        if (!part.cut) continue;
        const n = (counts.get(part.name) ?? 0) + 1;
        counts.set(part.name, n);
        if (part.role !== 'side' || !part.boxes.length) continue;
        out.set(`${c.id}:${part.name}:${n}`, sideOps(c, parts, part, st, cnc));
      }
    }
  }
  return out;
}

/** The parts laid out for the router: the table saw's layout rules, with the bit in place of the blade and a margin at the sheet edges. */
export function cncLayouts(p: Project, data = p.cutlist ?? defaultCutlist(p)): MaterialResult[] {
  const cnc = cncOf(data);
  const opts: OptimizerOptions = { ...data.options, kerf: cnc.bit, trim: cnc.edge };
  return optimize(optimizerParts(p, data), cutStock(p, data, undefined, { offcuts: true }), opts);
}

/** A sheet's operations in sheet coordinates (inches): x along the sheet's length, y across it. */
export function sheetOps(sh: SheetLayout, ops: Map<string, CncOp[]>): { label: string; n: number; ops: CncOp[] }[] {
  return sh.placed.map((pl) => {
    const L = pl.part.length, W = pl.part.width;
    const own = ops.get(pl.part.id) ?? [{ kind: 'outline', pts: rect(0, 0, L, W) } as CncOp];
    // Unturned, the part's length runs along the sheet; turned, along its width
    const T = (q: Pt): Pt => (pl.rotated ? [pl.x + q[1], pl.y + q[0]] : [pl.x + q[0], pl.y + q[1]]);
    const moved = own.map((o): CncOp => (o.kind === 'drill' ? { ...o, at: T(o.at) } : { ...o, pts: o.pts.map(T) }));
    return { label: pl.part.label, n: pl.n, ops: moved };
  });
}

/* ---------- DXF ---------- */

const num = (v: number) => (Math.round(v * 1e4) / 1e4).toString();
/** A layer name with a depth in it, in the file's units: POCKET_6.4MM, DRILL_5MM_D9.5MM. */
const depthName = (inches: number, units: 'mm' | 'in') => (units === 'mm' ? `${(Math.round(inches * 254) / 10).toFixed(1)}MM` : `${inches.toFixed(3)}IN`);

/**
 * One sheet as a DXF (R12 ASCII, which every CAM program reads): the sheet's outline, each part's
 * outline on a through-cut layer, pockets and holes on layers named for their depth, and the part
 * numbers as text on a layer that isn't cut. Origin at the sheet's corner; X along its length.
 */
export function sheetDxf(sh: SheetLayout, ops: Map<string, CncOp[]>, cnc: CncSettings, title = ''): string {
  const k = cnc.units === 'mm' ? 25.4 : 1;
  const thick = materialThickness(sh.stock.material) ?? 0.75;
  const out: string[] = [];
  const g = (code: number, v: string | number) => out.push(String(code), typeof v === 'number' ? num(v) : v);
  const layers = new Map<string, number>([['SHEET', 8], ['LABELS', 3]]);
  const through = `PROFILE_THRU_${depthName(thick + cnc.through, cnc.units)}`;
  layers.set(through, 1);
  const body: (() => void)[] = [];
  const poly = (layer: string, pts: Pt[]) => body.push(() => {
    g(0, 'POLYLINE'); g(8, layer); g(66, '1'); g(70, '1'); g(10, 0); g(20, 0); g(30, 0);
    for (const [x, y] of pts) { g(0, 'VERTEX'); g(8, layer); g(10, x * k); g(20, y * k); g(30, 0); }
    g(0, 'SEQEND'); g(8, layer);
  });
  poly('SHEET', rect(0, 0, sh.stock.length, sh.stock.width));
  for (const part of sheetOps(sh, ops)) {
    for (const o of part.ops) {
      if (o.kind === 'outline') poly(through, o.pts);
      else if (o.kind === 'pocket') { const l = `POCKET_${depthName(o.depth, cnc.units)}`; layers.set(l, 5); poly(l, o.pts); }
      else {
        const l = `DRILL_${cnc.units === 'mm' ? `${Math.round(o.dia * 25.4)}MM` : `${o.dia.toFixed(3)}IN`}_D${depthName(o.depth, cnc.units)}`;
        layers.set(l, 4);
        body.push(() => { g(0, 'CIRCLE'); g(8, l); g(10, o.at[0] * k); g(20, o.at[1] * k); g(30, 0); g(40, (o.dia / 2) * k); });
      }
    }
    // The part number where the label goes, small, on a layer that isn't cut
    const outline = part.ops.find((o) => o.kind === 'outline') as { pts: Pt[] } | undefined;
    if (outline) {
      const xs = outline.pts.map((q) => q[0]), ys = outline.pts.map((q) => q[1]);
      const cxp = (Math.min(...xs) + Math.max(...xs)) / 2, cyp = (Math.min(...ys) + Math.max(...ys)) / 2;
      const h = Math.min(1, (Math.max(...ys) - Math.min(...ys)) / 4);
      body.push(() => { g(0, 'TEXT'); g(8, 'LABELS'); g(10, cxp * k); g(20, cyp * k); g(30, 0); g(40, h * k); g(1, `${part.n} ${part.label}`.replace(/[^\x20-\x7e]/g, '')); });
    }
  }
  // Header: units (4 = mm, 1 = inches) and the drawing's extents
  g(999, `Cabinet Studio${title ? `: ${title}` : ''}`);
  g(0, 'SECTION'); g(2, 'HEADER');
  g(9, '$ACADVER'); g(1, 'AC1009');
  g(9, '$INSUNITS'); g(70, cnc.units === 'mm' ? '4' : '1');
  g(9, '$MEASUREMENT'); g(70, cnc.units === 'mm' ? '1' : '0');
  g(9, '$EXTMIN'); g(10, 0); g(20, 0); g(30, 0);
  g(9, '$EXTMAX'); g(10, sh.stock.length * k); g(20, sh.stock.width * k); g(30, 0);
  g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'TABLES');
  g(0, 'TABLE'); g(2, 'LAYER'); g(70, String(layers.size));
  for (const [name, color] of layers) { g(0, 'LAYER'); g(2, name); g(70, '0'); g(62, String(color)); g(6, 'CONTINUOUS'); }
  g(0, 'ENDTAB'); g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'ENTITIES');
  for (const b of body) b();
  g(0, 'ENDSEC'); g(0, 'EOF');
  return out.join('\r\n') + '\r\n';
}

/** What a sheet's DXF holds, in words, for the shop: the layers and what goes on each. */
export function layerGuide(cnc: CncSettings): string[] {
  const u = cnc.units === 'mm' ? 'millimetres' : 'inches';
  return [
    `Units: ${u}. Origin at the sheet's corner, X along the sheet's length.`,
    'PROFILE_THRU_<depth>: each part\'s outline, cut through (the depth includes a little into the spoilboard). Cut these last, outside the line.',
    'POCKET_<depth>: dados and rabbets on the inside face of the sides. Pocket them out at the depth in the layer name.',
    'DRILL_5MM_D<depth>: shelf pin holes, 5 mm, drilled to the depth in the layer name.',
    'LABELS and SHEET: part numbers and the sheet edge, for reference only. Not cut.',
  ];
}
