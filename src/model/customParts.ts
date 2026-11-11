// Custom parts: shapes the shop makes itself because nobody sells them (corbels, brackets, appliqués).
// A part is an outline drawn to scale, cut through a thickness, the way it's laid out for the bandsaw
// and the template router: x runs out from the wall (the back of the part at 0), y runs up (the bottom
// at 0). Each corner can bow its next edge into an arc (a "bulge", the way CAD and CNC files store
// arcs: 0 straight; + turns counterclockwise, so it bows out to the right of the direction of travel,
// - clockwise, bowing to the left; 1 is a half circle).
//
// From the outline: the part in 3D and the drawings, a full-size template to print and trace, a DXF
// for the CNC, and its hours on the quote.
import { uid } from './defaults';

export interface PartPoint { x: number; y: number; /** Bow of the edge from here to the next point (0 = straight). */ bulge?: number }
export interface CustomPart {
  id: string;
  name: string;
  kind: 'cutout';
  /** The outline, closed back to the first point, in inches. */
  points: PartPoint[];
  /** Through the outline (a corbel's width across the front). */
  thickness: number;
  species?: string;
  /** Shop hours to make one from the template, sand and fit it. */
  hoursEach: number;
  /** Hours to make the master template once, for this design. */
  templateHours: number;
  note?: string;
  updatedAt: number;
}

type P = [number, number];

/** The points along an arc from a to b with this bulge, a excluded, b included. */
function arcPoints(a: P, b: P, bulge: number, n: number): P[] {
  if (!bulge) return [b];
  const theta = 4 * Math.atan(bulge);
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const c = Math.hypot(dx, dy);
  if (c < 1e-9) return [b];
  const r = c / (2 * Math.sin(theta / 2));
  // Center: from the chord midpoint, along the chord's left normal
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const h = r * Math.cos(theta / 2);
  const nx = -dy / c, ny = dx / c;
  const cx = mx + nx * h, cy = my + ny * h;
  const a0 = Math.atan2(a[1] - cy, a[0] - cx);
  const steps = Math.max(2, Math.ceil(n * Math.abs(theta) / Math.PI));
  const out: P[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = a0 + (theta * i) / steps;
    out.push([cx + Math.abs(r) * Math.cos(t), cy + Math.abs(r) * Math.sin(t)]);
  }
  out[out.length - 1] = b;
  return out;
}

/** The outline as a closed polyline, arcs broken into short straight pieces. */
export function partOutline(part: Pick<CustomPart, 'points'>, perHalfCircle = 24): P[] {
  const pts = part.points;
  const out: P[] = [];
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    if (i === 0) out.push([p.x, p.y]);
    const next = arcPoints([p.x, p.y], [q.x, q.y], p.bulge ?? 0, perHalfCircle);
    if (i === pts.length - 1) next.pop(); // back at the start
    out.push(...next);
  });
  return out;
}

/** Overall size: depth out from the wall (x), height (y). */
export function partSize(part: Pick<CustomPart, 'points'>): { w: number; h: number; minX: number; minY: number } {
  const o = partOutline(part);
  const xs = o.map((p) => p[0]), ys = o.map((p) => p[1]);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  return { w: Math.max(...xs) - minX, h: Math.max(...ys) - minY, minX, minY };
}

/** The outline moved so its lower-left corner sits at 0,0. */
export function normalized(part: CustomPart): CustomPart {
  const { minX, minY } = partSize(part);
  if (Math.abs(minX) < 1e-9 && Math.abs(minY) < 1e-9) return part;
  return { ...part, points: part.points.map((p) => ({ ...p, x: p.x - minX, y: p.y - minY })) };
}

/** Area of the outline, square inches (for board feet and weight). */
export function partArea(part: Pick<CustomPart, 'points'>): number {
  const o = partOutline(part);
  let a = 0;
  for (let i = 0; i < o.length; i++) { const [x1, y1] = o[i], [x2, y2] = o[(i + 1) % o.length]; a += x1 * y2 - x2 * y1; }
  return Math.abs(a) / 2;
}

/** As a cut shape for the 3D and the drawings: the outline through its thickness, at a spot in a cabinet. */
export function partCutShape(part: CustomPart, x: number, y: number, z: number, along: 'x' | 'z' = 'z') {
  const n = normalized(part);
  return { along, min: [x, y, z] as [number, number, number], thickness: part.thickness, outline: partOutline(n) };
}

/** The outline as a DXF for the CNC or laser: one closed polyline with true arcs, inches. */
export function partDxf(part: CustomPart): string {
  const n = normalized(part);
  const L: (string | number)[] = [0, 'SECTION', 2, 'HEADER', 9, '$INSUNITS', 70, 1, 9, '$MEASUREMENT', 70, 0, 0, 'ENDSEC',
    0, 'SECTION', 2, 'ENTITIES', 0, 'LWPOLYLINE', 8, 'OUTLINE', 90, n.points.length, 70, 1];
  for (const p of n.points) { L.push(10, +p.x.toFixed(5), 20, +p.y.toFixed(5)); if (p.bulge) L.push(42, +p.bulge.toFixed(6)); }
  L.push(0, 'ENDSEC', 0, 'EOF');
  return L.join('\n') + '\n';
}

const fmtIn = (v: number) => {
  const neg = v < 0; v = Math.abs(v);
  let w = Math.floor(v + 1e-6), f = Math.round((v - w) * 16);
  if (f === 16) { w++; f = 0; }
  const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
  const k = f ? g(f, 16) : 1;
  return `${neg ? '-' : ''}${w || !f ? w : ''}${f ? `${w ? '-' : ''}${f / k}/${16 / k}` : ''}"`;
};
export const inches = fmtIn;

/**
 * A full-size template to print and tape together: the outline at 1:1, tiled across letter pages
 * (portrait, 1/2" margins), each page numbered with its row and column, alignment ticks on the
 * overlaps, a 1" square to check the printer didn't scale it, and the part's size and name.
 */
export function templateHtml(part: CustomPart, job = ''): string {
  const n = normalized(part);
  const { w, h } = partSize(n);
  const o = partOutline(n, 48);
  const pageW = 7.5, pageH = 10, lap = 0.5, pad = 0.75;
  const totalW = w + 2 * pad, totalH = h + 2 * pad;
  const cols = Math.max(1, Math.ceil((totalW - lap) / (pageW - lap))), rows = Math.max(1, Math.ceil((totalH - lap) / (pageH - lap)));
  // Drawing space: y down for SVG, the part's bottom at the bottom
  const X = (x: number) => x + pad, Y = (y: number) => totalH - pad - y;
  const path = `M${o.map(([x, y]) => `${X(x).toFixed(4)},${Y(y).toFixed(4)}`).join(' L')} Z`;
  const grid: string[] = [];
  for (let gx = 0; gx <= Math.ceil(totalW); gx++) grid.push(`<line x1="${gx}" y1="0" x2="${gx}" y2="${totalH}" class="g"/>`);
  for (let gy = 0; gy <= Math.ceil(totalH); gy++) grid.push(`<line x1="0" y1="${gy}" x2="${totalW}" y2="${gy}" class="g"/>`);
  const label = `<text x="${pad}" y="${(pad * 0.6).toFixed(2)}" class="t">${esc(part.name)}: ${fmtIn(h)} H × ${fmtIn(w)} D × ${fmtIn(part.thickness)} thick${job ? ` · ${esc(job)}` : ''} · back edge on the left, bottom at the bottom</text>`;
  const pages: string[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const vx = c * (pageW - lap), vy = r * (pageH - lap);
    pages.push(`<div class="page"><svg width="${pageW}in" height="${pageH}in" viewBox="${vx} ${vy} ${pageW} ${pageH}">
${grid.join('')}<path d="${path}" class="o"/>${label}
<rect x="${vx + 0.25}" y="${vy + pageH - 1.35}" width="1" height="1" class="sq"/><text x="${vx + 1.35}" y="${vy + pageH - 0.75}" class="s">1" square: check it measures 1" before cutting</text>
<text x="${vx + pageW - 0.25}" y="${vy + pageH - 0.2}" class="s" text-anchor="end">Page ${r * cols + c + 1} of ${rows * cols} (row ${r + 1}, column ${c + 1}) · overlap ${fmtIn(lap)}</text>
${c > 0 ? `<line x1="${vx + lap}" y1="${vy}" x2="${vx + lap}" y2="${vy + pageH}" class="lap"/>` : ''}${r > 0 ? `<line x1="${vx}" y1="${vy + lap}" x2="${vx + pageW}" y2="${vy + lap}" class="lap"/>` : ''}
</svg></div>`);
  }
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(part.name)} template</title><style>
@page{size:letter portrait;margin:0.5in}body{margin:0}.page{width:7.5in;height:10in;page-break-after:always;overflow:hidden}.page:last-child{page-break-after:auto}
svg{display:block}.g{stroke:#ddd;stroke-width:0.01}.o{fill:none;stroke:#000;stroke-width:0.02}.lap{stroke:#c2410c;stroke-width:0.01;stroke-dasharray:0.1 0.08}
.sq{fill:none;stroke:#000;stroke-width:0.015}.t{font:0.16px sans-serif}.s{font:0.12px sans-serif;fill:#444}
@media screen{body{background:#eee}.page{background:#fff;margin:12px auto;box-shadow:0 1px 4px rgba(0,0,0,.2)}}
</style></head><body>${pages.join('')}</body></html>`;
}
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Starting shapes to adjust: the outline with the back against x = 0. */
export const partPresets: { id: string; label: string; make: () => Omit<CustomPart, 'id' | 'updatedAt'> }[] = [
  {
    // Like the mantel corbels in the photos: a flat block at the top, a deep cove curling down to a rounded toe
    id: 'scroll', label: 'Scroll corbel (flat top block, deep cove, rounded toe)',
    make: () => ({ name: 'Scroll corbel', kind: 'cutout', thickness: 3.5, hoursEach: 1.5, templateHours: 2,
      points: [{ x: 0, y: 0 }, { x: 0, y: 9 }, { x: 5, y: 9 }, { x: 5, y: 7.5 }, { x: 4.25, y: 7.5, bulge: 0.42 }, { x: 1.75, y: 1.75, bulge: -0.55 }, { x: 0.875, y: 0 }] }),
  },
  {
    id: 'cove', label: 'Cove bracket (one concave curve)',
    make: () => ({ name: 'Cove bracket', kind: 'cutout', thickness: 3, hoursEach: 1, templateHours: 1,
      points: [{ x: 0, y: 0 }, { x: 0, y: 8 }, { x: 5, y: 8 }, { x: 5, y: 7.25, bulge: 0.38 }, { x: 0.75, y: 0 }] }),
  },
  {
    id: 'ogee', label: 'Ogee bracket (S-curve)',
    make: () => ({ name: 'Ogee bracket', kind: 'cutout', thickness: 3, hoursEach: 1.25, templateHours: 1.5,
      points: [{ x: 0, y: 0 }, { x: 0, y: 8 }, { x: 5, y: 8 }, { x: 5, y: 7.25, bulge: -0.35 }, { x: 2.75, y: 3.75, bulge: 0.35 }, { x: 0.75, y: 0 }] }),
  },
  {
    id: 'block', label: 'Rectangle (draw your own from a block)',
    make: () => ({ name: 'Custom part', kind: 'cutout', thickness: 1.5, hoursEach: 1, templateHours: 1,
      points: [{ x: 0, y: 0 }, { x: 0, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 0 }] }),
  },
];

export const newPart = (presetId = 'scroll'): CustomPart => ({ ...(partPresets.find((p) => p.id === presetId) ?? partPresets[0]).make(), id: uid('part'), updatedAt: Date.now() });
