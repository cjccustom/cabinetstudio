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

/** A router or shaper profile run along an edge, on one face of the part or both. */
export interface EdgeCut {
  kind: EdgeCutKind;
  /** The bit's size: the radius of a roundover, cove, bead or ogee, the leg of a chamfer, the width (and depth) of a rabbet. */
  size: number;
  /** Which face it's cut on, looking at the part from the front: the left face, the right, or both. */
  faces: 'both' | 'left' | 'right';
}
export type EdgeCutKind = 'chamfer' | 'roundover' | 'cove' | 'ogee' | 'bead' | 'rabbet';
export const edgeCutLabel: Record<EdgeCutKind, string> = {
  chamfer: 'Chamfer (45°)', roundover: 'Roundover', cove: 'Cove', ogee: 'Roman ogee', bead: 'Bead (roundover with a quirk)', rabbet: 'Rabbet',
};

export interface PartPoint {
  x: number; y: number;
  /** Bow of the edge from here to the next point (0 = straight). */ bulge?: number;
  /** A profile run along the edge from here to the next point. */ cut?: EdgeCut;
}
export interface CustomPart {
  id: string;
  name: string;
  /** cutout: the outline cut through a thickness (a corbel). moulding: the outline is a cross-section run along a length. */
  kind: 'cutout' | 'moulding';
  /** Mouldings: which kind of moulding it is, so the pickers offer it in the right places (Crown, Base Board and Base Cap…). */
  category?: string;
  /** Mouldings: the shop's cost per lineal foot to mill it (stock and machine time), used as the job's price for it. */
  costPerFoot?: number;
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

/** The outline as a polyline with, for each piece of it, which drawn edge (corner index) it belongs to. */
export function outlineEdges(part: Pick<CustomPart, 'points'>, perHalfCircle = 24): { pts: P[]; edgeOf: number[] } {
  const src = part.points;
  const pts: P[] = [], edgeOf: number[] = [];
  src.forEach((p, i) => {
    const q = src[(i + 1) % src.length];
    if (i === 0) pts.push([p.x, p.y]);
    const next = arcPoints([p.x, p.y], [q.x, q.y], p.bulge ?? 0, perHalfCircle);
    if (i === src.length - 1) next.pop();
    for (const _ of next) edgeOf.push(i);
    pts.push(...next);
  });
  // The closing piece (last point back to the first) belongs to the last edge
  edgeOf.push(src.length - 1);
  return { pts, edgeOf };
}

/**
 * How far a profile cuts back from the original edge, at a depth z into the face (0 at the face).
 * Zero once past the profile's depth.
 */
export function cutInset(kind: EdgeCutKind, s: number, z: number): number {
  if (z < 0) return cutInset(kind, s, 0);
  switch (kind) {
    case 'chamfer': return Math.max(0, s - z);
    case 'roundover': return z >= s ? 0 : s - Math.sqrt(Math.max(0, s * s - (s - z) * (s - z)));
    case 'cove': return z >= s ? 0 : Math.sqrt(Math.max(0, s * s - z * z));
    // A roman ogee: an S from the face to the edge, rounding over near the face and coving into the edge
    case 'ogee': return z >= s ? 0 : s * (0.5 + 0.5 * Math.cos((Math.PI * z) / s));
    // A bead: a small flat quirk at the face, then a roundover of the bit's radius
    case 'bead': { const q = s * 0.2; if (z >= s + q) return 0; if (z < q) return s; const t = z - q; return s - Math.sqrt(Math.max(0, s * s - (s - t) * (s - t))); }
    case 'rabbet': return z >= s ? 0 : s;
  }
}
/** How deep into the face a profile goes. */
export const cutDepth = (c: EdgeCut) => (c.kind === 'bead' ? c.size * 1.2 : c.size);

/**
 * The outline moved in by a different amount along each piece (its profile's cut-back at this depth),
 * the corners found where neighboring pieces' moved lines meet. Counter-clockwise in, counter-clockwise out.
 */
export function offsetOutline(pts: P[], insets: number[]): P[] {
  const n = pts.length;
  const line = (k: number) => {
    const a = pts[k], b = pts[(k + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L; // left of travel: inside, for a counter-clockwise outline
    return { a: [a[0] + nx * insets[k], a[1] + ny * insets[k]] as P, d: [dx / L, dy / L] as P };
  };
  return pts.map((p, j) => {
    const k0 = (j - 1 + n) % n, k1 = j;
    if (!insets[k0] && !insets[k1]) return p;
    const l0 = line(k0), l1 = line(k1);
    const cross = l0.d[0] * l1.d[1] - l0.d[1] * l1.d[0];
    // Nearly straight on (along a curve, or where two curves meet tangent): meet halfway between the two
    // moved points rather than at a far-off intersection
    if (Math.abs(cross) < 0.35) {
      const n0: P = [-l0.d[1], l0.d[0]], n1: P = [-l1.d[1], l1.d[0]];
      return [p[0] + (n0[0] * insets[k0] + n1[0] * insets[k1]) / 2, p[1] + (n0[1] * insets[k0] + n1[1] * insets[k1]) / 2] as P;
    }
    const t = ((l1.a[0] - l0.a[0]) * l1.d[1] - (l1.a[1] - l0.a[1]) * l1.d[0]) / cross;
    const q: P = [l0.a[0] + l0.d[0] * t, l0.a[1] + l0.d[1] * t];
    // A very sharp corner can shoot the point far off: hold it within reach
    const reach = Math.max(insets[k0], insets[k1]) * 2.5;
    return Math.hypot(q[0] - p[0], q[1] - p[1]) > reach ? [l1.a[0], l1.a[1]] as P : q;
  });
}

/** The profiles on a part, in words for the shop drawing: "1/4" roundover, both faces: edges 4, 5". */
export function edgeCutNotes(part: CustomPart): string[] {
  const groups = new Map<string, number[]>();
  part.points.forEach((p, i) => { if (p.cut) { const k = `${inches(p.cut.size)} ${edgeCutLabel[p.cut.kind].replace(/ \(.*\)$/, '').toLowerCase()}, ${p.cut.faces === 'both' ? 'both faces' : `${p.cut.faces} face`}`; groups.set(k, [...(groups.get(k) ?? []), i + 1]); } });
  return [...groups].map(([k, e]) => `${k.charAt(0).toUpperCase()}${k.slice(1)}: edge${e.length > 1 ? 's' : ''} ${e.join(', ')}`);
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

// Mouldings, drawn the way they sit: the back (against the cabinet or wall) on the left, the top at the top
const mould = (name: string, category: string, costPerFoot: number, points: PartPoint[]) => (): Omit<CustomPart, 'id' | 'updatedAt'> =>
  ({ name, kind: 'moulding', category, costPerFoot, thickness: 0.75, hoursEach: 0, templateHours: 1, points });
/** The kinds a drawn moulding can be, as the moulding pickers group them. */
export const mouldingCategories = ['Crown', 'Base Board and Base Cap', 'Shoe Moulding', 'Window and Door Casing', 'Back Band', 'Header Cap', 'Chair Rail', 'Panel', 'Band', 'Scotia', 'Picture Moulding', 'Stool Cap', 'Apron', 'Brick Mould', 'Miscellaneous'];
export const mouldingPresets: { id: string; label: string; make: () => Omit<CustomPart, 'id' | 'updatedAt'> }[] = [
  { id: 'm-cove-crown', label: 'Cove crown (sprung, one big cove)', make: mould('Cove crown', 'Crown', 6, [{ x: 0, y: 0 }, { x: 0.625, y: 0, bulge: 0.32 }, { x: 3, y: 2.375 }, { x: 3, y: 3 }, { x: 0, y: 3 }]) },
  { id: 'm-ogee-crown', label: 'Ogee crown (sprung, S-curve with fillets)', make: mould('Ogee crown', 'Crown', 7, [{ x: 0, y: 0 }, { x: 0.75, y: 0 }, { x: 0.75, y: 0.25, bulge: 0.3 }, { x: 2.25, y: 1.75, bulge: -0.3 }, { x: 3.25, y: 3 }, { x: 3.5, y: 3 }, { x: 3.5, y: 3.5 }, { x: 0, y: 3.5 }]) },
  { id: 'm-base', label: 'Baseboard with an ogee cap', make: mould('Ogee-cap base', 'Base Board and Base Cap', 5, [{ x: 0, y: 0 }, { x: 0.75, y: 0 }, { x: 0.75, y: 4.25 }, { x: 0.625, y: 4.375, bulge: -0.35 }, { x: 0.3125, y: 4.875, bulge: 0.35 }, { x: 0.25, y: 5.5 }, { x: 0, y: 5.5 }]) },
  { id: 'm-casing', label: 'Casing with a bead on the inside edge', make: mould('Bead casing', 'Window and Door Casing', 4, [{ x: 0, y: 0 }, { x: 0.6875, y: 0 }, { x: 0.6875, y: 3.25, bulge: 0.75 }, { x: 0.5, y: 3.5 }, { x: 0, y: 3.5 }]) },
  { id: 'm-cap', label: 'Cap moulding (base cap, chair rail cap)', make: mould('Cap moulding', 'Base Board and Base Cap', 2.5, [{ x: 0, y: 0 }, { x: 0.6875, y: 0, bulge: 0.3 }, { x: 0.375, y: 0.75, bulge: -0.3 }, { x: 0.25, y: 1.125 }, { x: 0, y: 1.125 }]) },
  { id: 'm-blank', label: 'Rectangle (draw your own cross-section)', make: mould('Custom moulding', 'Panel', 3, [{ x: 0, y: 0 }, { x: 0.75, y: 0 }, { x: 0.75, y: 2 }, { x: 0, y: 2 }]) },
];

export const newPart = (presetId = 'scroll'): CustomPart => ({ ...([...partPresets, ...mouldingPresets].find((p) => p.id === presetId) ?? partPresets[0]).make(), id: uid('part'), updatedAt: Date.now() });

/** A moulding drawn in the part builder, as Cabinet Studio's moulding number: custom:<category>:<h>x<d>:shop:<part id>. */
export function mouldingNum(part: CustomPart): string {
  const s = partSize(part);
  const r = (v: number) => Math.round(v * 10000) / 10000;
  return `custom:${part.category ?? 'Panel'}:${r(s.h)}x${r(s.w)}:shop:${part.id}`;
}
/** The drawn shape a job keeps for that moulding number (back at 0, up from 0). */
export const mouldingDrawing = (part: CustomPart) => ({ name: part.name, pts: partOutline(normalized(part), 24), ...(part.templateHours > 0 ? { setupHours: part.templateHours } : {}) });

/**
 * A moulding from the library changed: everywhere the job uses it takes the new shape and price. Its
 * number carries its size, so a new size is a new number; every reference to the old one moves over.
 */
export function retargetMoulding<T extends { profiles?: Record<string, { name?: string; pts: [number, number][]; setupHours?: number }>; moldPrices?: Record<string, number> }>(p: T, olds: string[], part: CustomPart): T {
  const num = mouldingNum(part);
  let json = JSON.stringify(p);
  for (const o of olds) if (o !== num) json = json.split(JSON.stringify(o)).join(JSON.stringify(num));
  const next = JSON.parse(json) as T;
  return { ...next, profiles: { ...next.profiles, [num]: mouldingDrawing(part) }, moldPrices: part.costPerFoot != null ? { ...next.moldPrices, [num]: part.costPerFoot } : next.moldPrices };
}
