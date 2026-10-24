// A small drawing kit for true-scale sheets: world coordinates in inches go in, SVG in paper
// inches comes out, so a printed 1/2" = 1'-0" elevation scales with a tape measure.
import { fmt } from '../units';

/** Architectural scales, as paper inches per foot, largest first. */
export const scales = [3, 1.5, 1, 0.75, 0.5, 0.375, 0.25, 0.1875, 0.125, 0.09375, 0.0625];
const scaleNames: Record<number, string> = {
  3: '3" = 1\'-0"', 1.5: '1-1/2" = 1\'-0"', 1: '1" = 1\'-0"', 0.75: '3/4" = 1\'-0"', 0.5: '1/2" = 1\'-0"', 0.375: '3/8" = 1\'-0"',
  0.25: '1/4" = 1\'-0"', 0.1875: '3/16" = 1\'-0"', 0.125: '1/8" = 1\'-0"', 0.09375: '3/32" = 1\'-0"', 0.0625: '1/16" = 1\'-0"',
};
export const scaleName = (perFoot: number) => scaleNames[perFoot] ?? `1:${Math.round(12 / perFoot)}`;

/** The largest standard scale that fits w × h (world inches) into aw × ah (paper inches). */
export function fitScale(w: number, h: number, aw: number, ah: number): number {
  const fit = Math.min(aw / Math.max(w, 1), ah / Math.max(h, 1)) * 12;
  return scales.find((s) => s <= fit) ?? scales[scales.length - 1];
}

const n = (v: number) => +v.toFixed(4);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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
    this.out.push(`<text class="${cls}" x="${X}" y="${Y}" font-size="${size}" text-anchor="${anchor}"${rotate ? ` transform="rotate(${rotate} ${X} ${Y})"` : ''}>${esc(s)}</text>`);
  }
  /** A cabinet tag: its name in a small circle. */
  tag(x: number, y: number, s: string) {
    const r = Math.max(0.09, 0.035 * s.length + 0.05);
    this.out.push(`<circle class="tag" cx="${this.X(x)}" cy="${this.Y(y)}" r="${n(r)}"/>`);
    this.out.push(`<text class="tagt" x="${this.X(x)}" y="${n(this.Y(y) + 0.032)}" font-size="0.085" text-anchor="middle">${esc(s)}</text>`);
  }

  /** A horizontal dimension from x1 to x2, measured at world height y, drawn `off` paper inches away (+ above, − below). */
  dimH(x1: number, x2: number, y: number, off: number, label?: string, feet = false, lift = 0) {
    if (Math.abs(x2 - x1) < 0.01) return;
    const yd = y + (this.yUp ? 1 : -1) * this.p(off);
    const gap = this.p(0.04) * Math.sign(off) * (this.yUp ? 1 : -1);
    this.line(x1, y + gap, x1, yd + gap * 1.5, 'd');
    this.line(x2, y + gap, x2, yd + gap * 1.5, 'd');
    this.line(x1, yd, x2, yd, 'd');
    this.tick(x1, yd); this.tick(x2, yd);
    const text = label ?? dimText(Math.abs(x2 - x1), feet);
    const fits = Math.abs(x2 - x1) * this.k > 0.09 * text.length * 0.55;
    this.text((x1 + x2) / 2, yd + (this.yUp ? 1 : -1) * this.p(0.035 + lift) * Math.sign(off || 1), text, fits ? 0.09 : 0.072, 'middle', 'dt');
    if (lift) this.line((x1 + x2) / 2, yd, (x1 + x2) / 2, yd + (this.yUp ? 1 : -1) * this.p(lift) * Math.sign(off || 1), 'd');
  }
  /** A vertical dimension from y1 to y2 at world x, drawn `off` paper inches to the right (+) or left (−). */
  dimV(y1: number, y2: number, x: number, off: number, label?: string, feet = false, lift = 0) {
    if (Math.abs(y2 - y1) < 0.01) return;
    const xd = x + this.p(off);
    const gap = this.p(0.04) * Math.sign(off);
    this.line(x + gap, y1, xd + gap * 1.5, y1, 'd');
    this.line(x + gap, y2, xd + gap * 1.5, y2, 'd');
    this.line(xd, y1, xd, y2, 'd');
    this.tickV(xd, y1); this.tickV(xd, y2);
    const text = label ?? dimText(Math.abs(y2 - y1), feet);
    const fits = Math.abs(y2 - y1) * this.k > 0.09 * text.length * 0.55;
    const side = Math.sign(off || 1);
    this.text(xd - this.p(0.035) + (side > 0 ? this.p(lift) : -this.p(lift)), (y1 + y2) / 2, text, fits ? 0.09 : 0.072, 'middle', 'dt', -90);
  }
  /** A chain of dimensions between sorted points along x. */
  /** A chain of dimensions between points; text on short pieces is lifted clear of its neighbors, alternately. */
  chainH(xs: number[], y: number, off: number) {
    const pts = [...new Set(xs.map((v) => Math.round(v * 64) / 64))].sort((a, b) => a - b);
    let small = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = pts[i] - pts[i - 1];
      if (d <= 0.1) continue;
      const tight = d * this.k < 0.42;
      this.dimH(pts[i - 1], pts[i], y, off, undefined, false, tight ? (small++ % 2 ? 0.12 : 0) : 0);
      if (!tight) small = 0;
    }
  }
  chainV(ys: number[], x: number, off: number) {
    const pts = [...new Set(ys.map((v) => Math.round(v * 64) / 64))].sort((a, b) => a - b);
    let small = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = pts[i] - pts[i - 1];
      if (d <= 0.1) continue;
      const tight = d * this.k < 0.42;
      this.dimV(pts[i - 1], pts[i], x, off, undefined, false, tight ? (small++ % 2 ? 0.13 : 0) : 0);
      if (!tight) small = 0;
    }
  }
  private tick(x: number, y: number) {
    const X = this.X(x), Y = this.Y(y), t = 0.035;
    this.out.push(`<line class="tk" x1="${n(X - t)}" y1="${n(Y + t)}" x2="${n(X + t)}" y2="${n(Y - t)}"/>`);
  }
  private tickV(x: number, y: number) {
    const X = this.X(x), Y = this.Y(y), t = 0.035;
    this.out.push(`<line class="tk" x1="${n(X - t)}" y1="${n(Y + t)}" x2="${n(X + t)}" y2="${n(Y - t)}"/>`);
  }
  svg() { return this.out.join(''); }
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
.dwg .hid{fill:none;stroke:#555;stroke-width:.007;stroke-dasharray:.05 .035}
.dwg .thin{fill:none;stroke:#666;stroke-width:.005}
.dwg .glass{fill:#e8eef3;stroke:#111;stroke-width:.007}
.dwg .d{stroke:#333;stroke-width:.005}
.dwg .tk{stroke:#111;stroke-width:.011}
.dwg .tag{fill:#fff;stroke:#111;stroke-width:.008}
.dwg .hw{fill:#555;stroke:#111;stroke-width:.004}
.dwg text{font-family:"Helvetica Neue",Arial,sans-serif;fill:#111}
.dwg .dt{font-weight:500}
.dwg .tagt{font-weight:700}
.dwg .lbl{font-weight:700;letter-spacing:.02em}
`;
