// A small drawing kit for true-scale sheets: world coordinates in inches go in, SVG in paper
// inches comes out, so a printed 1/2" = 1'-0" elevation scales with a tape measure.
import { fmt } from '../units';

/** Architectural scales, as paper inches per foot, largest first. */
export const scales = [3, 1.5, 1, 0.75, 0.5, 0.375, 0.25, 0.1875, 0.125, 0.09375, 0.0625];
const scaleNames: Record<number, string> = {
  3: '3" = 1\'-0"', 1.5: '1-1/2" = 1\'-0"', 1: '1" = 1\'-0"', 0.75: '3/4" = 1\'-0"', 0.5: '1/2" = 1\'-0"', 0.375: '3/8" = 1\'-0"',
  12: 'Full size', 6: 'Half size', 0.25: '1/4" = 1\'-0"', 0.1875: '3/16" = 1\'-0"', 0.125: '1/8" = 1\'-0"', 0.09375: '3/32" = 1\'-0"', 0.0625: '1/16" = 1\'-0"',
};
export const scaleName = (perFoot: number) => scaleNames[perFoot] ?? `1:${Math.round(12 / perFoot)}`;

/**
 * Changes made to the drawings themselves (never the design): a view's scale, and each dimension
 * hidden, retyped or moved out. Views are named by a key that stays put as the design changes
 * (elev:back, plan, ff:<cabinet id>...); a dimension by its view and where it measures.
 */
export interface DimEdit { hidden?: boolean; text?: string; /** Paper inches further out (+) or in (−). */ off?: number }
export interface DrawingEdits { scales?: Record<string, number>; dims?: Record<string, DimEdit> }
export interface ViewInfo { key: string; label: string; scale: number; fit: number }

let ctx: { edits: DrawingEdits; key: string; label: string; views: ViewInfo[] } | null = null;
/** Start drawing a set with these edits applied; views drawn are recorded for the viewer. */
export function beginEdits(edits: DrawingEdits | undefined) { ctx = { edits: edits ?? {}, key: '', label: '', views: [] }; }
export function endEdits() { ctx = null; revMark = null; }
/** The latest revision's changed cabinets, marked with a numbered triangle beside their tags. */
let revMark: { n: number; tags: Set<string> } | null = null;
export function markRevision(n: number, tags: string[]) { revMark = n && tags.length ? { n, tags: new Set(tags) } : null; }
/** A revision triangle with its number, centered at a paper point. */
export function revTriangle(x: number, y: number, n: number, r = 0.09): string {
  const pts = [[x, y - r], [x + r * 0.95, y + r * 0.62], [x - r * 0.95, y + r * 0.62]].map((q) => q.map((v) => +v.toFixed(4)).join(',')).join(' ');
  return `<polygon points="${pts}" fill="#fff" stroke="#c0392b" stroke-width="0.012"/><text x="${+x.toFixed(4)}" y="${+(y + r * 0.45).toFixed(4)}" font-size="${+(r * 0.95).toFixed(4)}" font-weight="700" fill="#c0392b" text-anchor="middle">${n}</text>`;
}
/** The views drawn since the last call (for the sheet they're on). */
export function takeViews(): ViewInfo[] { if (!ctx) return []; const v = ctx.views; ctx.views = []; return v; }
/** Draw one named view: its scale can be set by hand, its dimensions edited. */
export function inView<T>(key: string, label: string, draw: () => T): T {
  if (!ctx) return draw();
  const prev = [ctx.key, ctx.label];
  ctx.key = key; ctx.label = label;
  try { return draw(); } finally { [ctx.key, ctx.label] = prev; }
}

/** The largest standard scale that fits w × h (world inches) into aw × ah (paper inches), or the one set for this view. */
export function fitScale(w: number, h: number, aw: number, ah: number): number {
  const fit = Math.min(aw / Math.max(w, 1), ah / Math.max(h, 1)) * 12;
  const auto = scales.find((s) => s <= fit) ?? scales[scales.length - 1];
  if (!ctx?.key) return auto;
  const set = ctx.edits.scales?.[ctx.key];
  const prior = ctx.views.find((v) => v.key === ctx!.key);
  const fitted = prior ? Math.min(prior.fit, auto) : auto;
  const scale = set ?? fitted;
  if (prior) Object.assign(prior, { fit: fitted, scale }); else ctx.views.push({ key: ctx.key, label: ctx.label, scale, fit: fitted });
  return scale;
}

const n = (v: number) => +v.toFixed(4);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// In an attribute, quotes too: a dimension like 59" left bare there breaks the whole sheet as an image
const escAttr = (s: string) => esc(s).replace(/"/g, '&quot;');

/** Inches as a drawing shows them: 34 1/2", with feet added on long runs: 158" (13'-2"). */
export function dimText(v: number, feet = false) {
  const s = fmt(v);
  if (!feet || v < 48) return s;
  const ft = Math.floor(Math.round(v * 16) / 16 / 12);
  return `${s} (${ft}'-${fmt(v - ft * 12)})`;
}

export interface Frame { x: number; y: number; w: number; h: number }

/**
 * One view on a sheet. World x runs right; world y runs up (elevations and sections) or down
 * (plans, where y is the room's depth from the back wall).
 */
export class View {
  out: string[] = [];
  /** Paper inches per world inch. */
  k: number;
  /** The view's name for drawing edits, and its edited dimensions. */
  vkey = ctx?.key ?? '';
  private dimEdits = ctx?.edits.dims ?? {};
  constructor(public frame: Frame, public world: { x0: number; y0: number; x1: number; y1: number }, public perFoot: number, public yUp = true) {
    this.k = perFoot / 12;
    // Center the drawing in its frame
    this.ox = frame.x + (frame.w - (world.x1 - world.x0) * this.k) / 2 - world.x0 * this.k;
    this.oy = yUp ? frame.y + (frame.h + (world.y1 - world.y0) * this.k) / 2 + world.y0 * this.k : frame.y + (frame.h - (world.y1 - world.y0) * this.k) / 2 - world.y0 * this.k;
  }
  ox: number;
  oy: number;
  X = (x: number) => n(this.ox + x * this.k);
  Y = (y: number) => n(this.yUp ? this.oy - y * this.k : this.oy + y * this.k);
  /** Paper inches as world inches, for sizes that stay the same on paper (text, offsets). */
  p = (paper: number) => paper / this.k;

  rect(x: number, y: number, w: number, h: number, cls = 'o', extra = '') {
    if (w <= 0 || h <= 0) return;
    const top = this.yUp ? y + h : y;
    this.out.push(`<rect class="${cls}" x="${this.X(x)}" y="${this.Y(top)}" width="${n(w * this.k)}" height="${n(h * this.k)}"${extra}/>`);
  }
  line(x1: number, y1: number, x2: number, y2: number, cls = 'o') {
    this.out.push(`<line class="${cls}" x1="${this.X(x1)}" y1="${this.Y(y1)}" x2="${this.X(x2)}" y2="${this.Y(y2)}"/>`);
  }
  poly(pts: [number, number][], cls = 'o') {
    this.out.push(`<polygon class="${cls}" points="${pts.map(([x, y]) => `${this.X(x)},${this.Y(y)}`).join(' ')}"/>`);
  }
  path(d: string, cls = 'o') { this.out.push(`<path class="${cls}" d="${d}"/>`); }
  circle(x: number, y: number, r: number, cls = 'o') { this.out.push(`<circle class="${cls}" cx="${this.X(x)}" cy="${this.Y(y)}" r="${n(r * this.k)}"/>`); }
  /** Text at a world point; size in paper inches. */
  text(x: number, y: number, s: string, size = 0.1, anchor: 'start' | 'middle' | 'end' = 'middle', cls = 't', rotate = 0) {
    const X = this.X(x), Y = this.Y(y);
    // Dimension figures go on last, over a thin white mask, so no line drawn after them strikes through them
    (cls === 'dt' ? this.late : this.out).push(`<text class="${cls}" x="${X}" y="${Y}" font-size="${size}" text-anchor="${anchor}"${rotate ? ` transform="rotate(${rotate} ${X} ${Y})"` : ''}>${esc(s)}</text>`);
  }
  /** A cabinet tag: its name in a small circle. */
  tag(x: number, y: number, s: string) {
    const r = Math.max(0.09, 0.035 * s.length + 0.05);
    this.out.push(`<circle class="tag" cx="${this.X(x)}" cy="${this.Y(y)}" r="${n(r)}"/>`);
    this.out.push(`<text class="tagt" x="${this.X(x)}" y="${n(this.Y(y) + 0.032)}" font-size="0.085" text-anchor="middle">${esc(s)}</text>`);
    if (revMark?.tags.has(s)) this.out.push(revTriangle(this.X(x) + r + 0.1, this.Y(y) - r * 0.6, revMark.n));
  }

  /** A horizontal dimension from x1 to x2, measured at world height y, drawn `off` paper inches away (+ above, − below). */
  /** A dimension's name for drawing edits: its view, direction and where it measures, to 1/16". */
  private dimId(dir: 'h' | 'v', a: number, b: number, at: number) {
    const r = (v: number) => Math.round(v * 16) / 16;
    return `${this.vkey}|${dir}|${r(Math.min(a, b))}|${r(Math.max(a, b))}|${r(at)}`;
  }
  dimH(x1: number, x2: number, y: number, off: number, label?: string, feet = false, lift = 0, slide = 0) {
    if (Math.abs(x2 - x1) < 0.01) return;
    const id = this.dimId('h', x1, x2, y);
    const ed = this.dimEdits[id];
    if (ed?.off) off += Math.sign(off || 1) * ed.off;
    const yd0 = y + (this.yUp ? 1 : -1) * this.p(off);
    if (this.vkey) this.hit(Math.min(x1, x2), yd0 - this.p(0.07), Math.abs(x2 - x1), this.p(0.17), { dim: id, text: ed?.text ?? label ?? dimText(Math.abs(x2 - x1), feet), measured: dimText(Math.abs(x2 - x1), feet), ...(ed?.hidden ? { hidden: 1 } : {}) });
    if (ed?.hidden) return;
    if (ed?.text) label = ed.text;
    const yd = yd0;
    const gap = this.p(0.04) * Math.sign(off) * (this.yUp ? 1 : -1);
    this.line(x1, y + gap, x1, yd + gap * 1.5, 'd');
    this.line(x2, y + gap, x2, yd + gap * 1.5, 'd');
    this.line(x1, yd, x2, yd, 'd');
    this.tick(x1, yd); this.tick(x2, yd);
    const text = label ?? dimText(Math.abs(x2 - x1), feet);
    const fits = Math.abs(x2 - x1) * this.k > 0.09 * text.length * 0.55;
    const size = fits ? 0.09 : 0.072;
    // Text on the far side of the line from the work. Placed by its baseline, so text hanging below
    // the line drops by its own height too, or its figures sit on the line and get struck through
    const below = (off || 1) < 0;
    // Wider than the space it measures: the figures run out past the extension lines, so they also
    // stand clear of the lines' overrun and the ticks
    const tight = Math.abs(x2 - x1) * this.k < size * text.length * 0.5 + 0.06;
    const clear = (tight ? 0.09 : 0.035) + lift + (below ? size * 0.75 : 0);
    this.text((x1 + x2) / 2 + this.p(slide), yd + (this.yUp ? 1 : -1) * this.p(clear) * Math.sign(off || 1), text, size, 'middle', 'dt');
    if (lift) this.line((x1 + x2) / 2, yd, (x1 + x2) / 2, yd + (this.yUp ? 1 : -1) * this.p(lift) * Math.sign(off || 1), 'd');
  }
  /** A vertical dimension from y1 to y2 at world x, drawn `off` paper inches to the right (+) or left (−). */
  dimV(y1: number, y2: number, x: number, off: number, label?: string, feet = false, lift = 0) {
    if (Math.abs(y2 - y1) < 0.01) return;
    const id = this.dimId('v', y1, y2, x);
    const ed = this.dimEdits[id];
    if (ed?.off) off += Math.sign(off || 1) * ed.off;
    const xd = x + this.p(off);
    if (this.vkey) this.hit(xd - this.p(0.1), Math.min(y1, y2), this.p(0.17), Math.abs(y2 - y1), { dim: id, text: ed?.text ?? label ?? dimText(Math.abs(y2 - y1), feet), measured: dimText(Math.abs(y2 - y1), feet), ...(ed?.hidden ? { hidden: 1 } : {}) });
    if (ed?.hidden) return;
    if (ed?.text) label = ed.text;
    const gap = this.p(0.04) * Math.sign(off);
    this.line(x + gap, y1, xd + gap * 1.5, y1, 'd');
    this.line(x + gap, y2, xd + gap * 1.5, y2, 'd');
    this.line(xd, y1, xd, y2, 'd');
    this.tickV(xd, y1); this.tickV(xd, y2);
    const text = label ?? dimText(Math.abs(y2 - y1), feet);
    const fits = Math.abs(y2 - y1) * this.k > 0.09 * text.length * 0.55;
    const side = Math.sign(off || 1);
    const size = fits ? 0.09 : 0.072;
    // Turned to read from the right, the figures stand to the left of their baseline: on the right of
    // the line the baseline moves out past them so they clear it
    // Too long for its space it would cross the extension lines coming in from the work: it goes
    // outside the line instead, clear of their overrun
    const tight = Math.abs(y2 - y1) * this.k < size * text.length * 0.5 + 0.06;
    const c0 = tight ? 0.09 : 0.035;
    const bx = side > 0 && (lift > 0 || tight) ? xd + this.p(c0 + lift + size * 0.75) : xd - this.p(c0 + (side < 0 ? lift : 0));
    this.text(bx, (y1 + y2) / 2, text, size, 'middle', 'dt', -90);
  }
  /** A chain of dimensions between sorted points along x. */
  /** A chain of dimensions between points; text on short pieces is lifted clear of its neighbors, alternately. */
  chainH(xs: number[], y: number, off: number) {
    // Along a horizontal chain a crowded figure slides along the line beside its neighbor rather than
    // stepping out, where it would run into the overall dimension above it
    const pts = [...new Set(xs.map((v) => Math.round(v * 64) / 64))].sort((a, b) => a - b);
    // ...and the figures at its ends stay inside it, off the overall dimension's extension lines
    const place = this.chainLevels(0, true, [pts[0] * this.k, pts[pts.length - 1] * this.k]);
    for (let i = 1; i < pts.length; i++) {
      const d = pts[i] - pts[i - 1];
      if (d <= 0.1) continue;
      this.dimH(pts[i - 1], pts[i], y, off, undefined, false, 0, place(pts[i - 1], pts[i]));
    }
  }
  chainV(ys: number[], x: number, off: number) {
    const place = this.chainLevels(0.13);
    const pts = [...new Set(ys.map((v) => Math.round(v * 64) / 64))].sort((a, b) => a - b);
    for (let i = 1; i < pts.length; i++) {
      const d = pts[i] - pts[i - 1];
      if (d <= 0.1) continue;
      this.dimV(pts[i - 1], pts[i], x, off, undefined, false, place(pts[i - 1], pts[i]));
    }
  }
  /**
   * For a chain: how far to step each figure out from the line so it doesn't land on a neighbor's.
   * Each figure takes the first level (on the line, one step out, two...) where nothing already
   * placed overlaps it along the line, with a little air between.
   */
  private chainLevels(step: number, slide = false, ends?: [number, number]) {
    const taken: [number, number][][] = [];
    return (a: number, b: number) => {
      const len = Math.abs(b - a) * this.k;
      const t = dimText(Math.abs(b - a));
      const size = len > 0.09 * t.length * 0.55 ? 0.09 : 0.072;
      const half = (size * t.length * 0.5) / 2 + 0.03;
      const mid = ((a + b) / 2) * this.k;
      const span: [number, number] = [mid - half, mid + half];
      if (slide) {
        const row = (taken[0] ??= []);
        let dx = 0;
        if (ends) {
          if (span[0] < ends[0] + 0.02) dx = ends[0] + 0.02 - span[0];
          else if (span[1] > ends[1] - 0.02) dx = ends[1] - 0.02 - span[1];
        }
        for (let hit = row.find(([p, q]) => span[0] + dx < q && p < span[1] + dx), guard = 0; hit && guard < 64; hit = row.find(([p, q]) => span[0] + dx < q && p < span[1] + dx), guard++) dx = Math.max(dx + 1e-4, hit[1] - span[0] + 1e-4);
        row.push([span[0] + dx, span[1] + dx]);
        return dx;
      }
      let lvl = 0;
      while ((taken[lvl] ?? []).some(([p, q]) => span[0] < q && p < span[1])) lvl++;
      (taken[lvl] ??= []).push(span);
      return lvl * step;
    };
  }
  private tick(x: number, y: number) {
    const X = this.X(x), Y = this.Y(y), t = 0.035;
    this.out.push(`<line class="tk" x1="${n(X - t)}" y1="${n(Y + t)}" x2="${n(X + t)}" y2="${n(Y - t)}"/>`);
  }
  private tickV(x: number, y: number) {
    const X = this.X(x), Y = this.Y(y), t = 0.035;
    this.out.push(`<line class="tk" x1="${n(X - t)}" y1="${n(Y + t)}" x2="${n(X + t)}" y2="${n(Y - t)}"/>`);
  }
  /**
   * An invisible target over part of the drawing, for the in-app viewer: click to edit, drag to move.
   * It never shows on paper (the sheet styles leave it unpainted).
   */
  hit(x: number, y: number, w: number, h: number, data: Record<string, string | number>) {
    if (w <= 0 || h <= 0) return;
    const top = this.yUp ? y + h : y;
    const attrs = Object.entries(data).map(([k, v]) => ` data-${k}="${escAttr(String(v))}"`).join('');
    this.hits.push(`<rect class="hit" x="${this.X(x)}" y="${this.Y(top)}" width="${n(w * this.k)}" height="${n(h * this.k)}"${attrs}/>`);
  }
  private hits: string[] = [];
  /** Paper inches per world inch, with the sign of y on paper (for dragging in the viewer). */
  get scaleAttrs() { return { k: n(this.k), yup: this.yUp ? 1 : 0 }; }
  private late: string[] = [];
  svg() { return this.out.join('') + this.late.join('') + this.hits.join(''); }
}

/** Line weights and text styles, in paper inches. */
export const drawingCss = `
.dwg svg{display:block}
.dwg .o{fill:#fff;stroke:#111;stroke-width:.009}
.dwg .f{fill:none;stroke:#111;stroke-width:.009}
.dwg .heavy{fill:none;stroke:#111;stroke-width:.022}
.dwg .wall{fill:#d9d6cf;stroke:#111;stroke-width:.012}
.dwg .cut{fill:#ece9e2;stroke:#111;stroke-width:.012}
.dwg .ghost{fill:#f2f1ee;stroke:#888;stroke-width:.006}
.dwg .sec-o{fill:#cfccc4;stroke:#111;stroke-width:.02}
.dwg .sec{fill:#cfccc4;stroke:none}
.dwg .hid{fill:none;stroke:#555;stroke-width:.007;stroke-dasharray:.05 .035}
.dwg .thin{fill:none;stroke:#666;stroke-width:.005}
.dwg .glass{fill:#e8eef3;stroke:#111;stroke-width:.007}
.dwg .appl{fill:#d9d9d9;stroke:#111;stroke-width:.009}
.dwg .firebox{fill:#3a3a3a;stroke:#111;stroke-width:.007}
.dwg .d{stroke:#333;stroke-width:.005}
.dwg .tk{stroke:#111;stroke-width:.011}
.dwg .tag{fill:#fff;stroke:#111;stroke-width:.008}
.dwg .hw{fill:#555;stroke:#111;stroke-width:.004}
.dwg .hw.finger{fill:#bbb;stroke:#333;stroke-width:.004;stroke-dasharray:.03 .02}
.dwg text{font-family:"Helvetica Neue",Arial,sans-serif;fill:#111}
.dwg .dt{font-weight:500;paint-order:stroke;stroke:#fff;stroke-width:.025;stroke-linejoin:round}
.dwg .tagt{font-weight:700}
.dwg .lbl{font-weight:700;letter-spacing:.02em}
.dwg .hit{fill:none;stroke:none}
.dwg .cutline{fill:none;stroke:#111;stroke-width:.014;stroke-dasharray:.18 .05 .03 .05}
`;
