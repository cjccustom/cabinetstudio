// A table or bench in 3D on paper: its parts (the same ones the 3D view and the cut list use) as shaded
// solids in the wood's color, seen from above at a three-quarter angle, from the front right or the
// front left. Exact to the design, unlike a rendering.
import type { TablePart } from '../model/tableParts';
import type { Frame } from './draw';

type V3 = [number, number, number];
const COS = Math.cos(Math.PI / 6), SIN = 0.5;

/** Lighten (amt > 0) or darken a hex color. */
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * The parts in iso (x along the length, y up, z toward the viewer, all centered), from the front right
 * or, mirrored, the front left; fitted into the frame with a floor shadow under it.
 */
export function furnitureIso(parts: TablePart[], f: Frame, wood: string, from: 'right' | 'left' = 'right'): string {
  const m = from === 'right' ? 1 : -1;
  const boxes = parts.flatMap((part) => part.boxes.map((b) => {
    // Mirrored for the left view: x flips, so the faces seen are the top, the front and the left end
    const x0 = m > 0 ? b.min[0] : -(b.min[0] + b.size[0]);
    return { part, min: [x0, b.min[1], b.min[2]] as V3, max: [x0 + b.size[0], b.min[1] + b.size[1], b.min[2] + b.size[2]] as V3 };
  }));
  if (!boxes.length) return '';
  // Seen from the front right and above: x to the right goes up-right, z toward us goes down-right
  const P = (q: V3): [number, number] => [(q[0] + q[2]) * COS, -q[1] - (q[0] - q[2]) * SIN];
  const pts = boxes.flatMap((b) => [b.min, b.max, [b.min[0], b.max[1], b.max[2]], [b.max[0], b.min[1], b.min[2]], [b.min[0], b.min[1], b.max[2]], [b.max[0], b.max[1], b.min[2]]] as V3[]).map(P);
  const ux0 = Math.min(...pts.map((q) => q[0])), ux1 = Math.max(...pts.map((q) => q[0]));
  const uy0 = Math.min(...pts.map((q) => q[1])), uy1 = Math.max(...pts.map((q) => q[1]));
  const k = Math.min((f.w - 0.3) / (ux1 - ux0), (f.h - 0.3) / (uy1 - uy0));
  const ox = f.x + (f.w - (ux1 - ux0) * k) / 2 - ux0 * k, oy = f.y + (f.h - (uy1 - uy0) * k) / 2 - uy0 * k;
  const S = (q: V3) => { const [a, b] = P(q); return `${(ox + a * k).toFixed(3)},${(oy + b * k).toFixed(3)}`; };
  const poly = (q: V3[], fill: string) => `<polygon points="${q.map(S).join(' ')}" fill="${fill}" stroke="#2b2b2b" stroke-width="0.006" stroke-linejoin="round"/>`;
  const out: string[] = [];
  // A soft shadow on the floor under the whole piece
  const xs = boxes.map((b) => [b.min[0], b.max[0]]).flat(), zs = boxes.map((b) => [b.min[2], b.max[2]]).flat();
  const [sx0, sx1, sz0, sz1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  out.push(`<polygon points="${([[sx0 - 2, 0, sz0], [sx1 + 4, 0, sz0], [sx1 + 4, 0, sz1 + 4], [sx0 - 2, 0, sz1 + 4]] as V3[]).map(S).join(' ')}" fill="#000" fill-opacity="0.07"/>`);
  // Far to near: the back, the left and the low pieces first
  const depth = (b: typeof boxes[number]) => (b.max[0] + b.max[2]) - (b.max[1] * 0.02);
  for (const b of [...boxes].sort((a, c) => depth(a) - depth(c))) {
    const [x0, y0, z0] = b.min, [x1, y1, z1] = b.max;
    const col = b.part.role === 'cushion' ? '#9aa1a8' : wood;
    out.push(poly([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], shade(col, 0.18)));
    out.push(poly([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], col));
    out.push(poly([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], shade(col, -0.22)));
  }
  return out.join('');
}
