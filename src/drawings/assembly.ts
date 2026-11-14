// A cabinet's assembly view, the way CNC cabinet programs print an assembly sheet: the case drawn in
// isometric from the front right and above, pulled apart a little so every part shows, each part
// ballooned with its number from the parts list.
import type { Cabinet, Part, Project } from '../model/types';
import { partNumbers, partRowKey } from '../model/parts';
import { partsOf } from './views';
import type { Frame } from './draw';

const COS = Math.cos(Math.PI / 6), SIN = 0.5;

/** How far each kind of part moves out from its place, in inches: sides out, top up, back back, the face and doors forward. */
function explode(part: Part, cx: number, W: number): [number, number, number] {
  const e = Math.max(4, Math.min(10, W * 0.18));
  switch (part.role) {
    case 'side': case 'endPanel': return [cx < W / 2 ? -e : e, 0, 0];
    case 'top': case 'stretcher': case 'nailer': return [0, e * 0.9, 0];
    case 'back': return [0, 0, -e * 1.4];
    case 'stile': case 'rail': return [0, 0, e * 1.4];
    case 'door': case 'drawerFront': return [0, 0, e * 2.6];
    case 'drawerBox': return [0, 0, e * 1.9];
    case 'shelf': return [0, 0, e * 0.5];
    default: return [0, 0, 0];
  }
}

export function assemblyView(p: Project, c: Cabinet, f: Frame): { svg: string; legend: { n: number; name: string; qty: number }[] } {
  const parts = partsOf(p, c).filter((x) => x.boxes.length && !['counter', 'rod', 'cushion'].includes(x.role));
  const nums = partNumbers(partsOf(p, c));
  const W = c.width, D = c.depth;
  // Every box with its part, moved out
  const boxes = parts.flatMap((part) => part.boxes.map((b) => {
    const cx = b.min[0] + b.size[0] / 2;
    const [dx, dy, dz] = explode(part, cx, W);
    return { part, min: [b.min[0] + dx, b.min[1] + dy, b.min[2] + dz] as const, size: b.size };
  }));
  // Model to sheet: x right, y up, z out of the front; seen from the front right, above
  const P = (x: number, y: number, z: number): [number, number] => {
    const a = x, back = D - z;
    return [(a + back) * COS, -y - ((W - a) + back) * SIN];
  };
  const pts = boxes.flatMap((b) => {
    const [x0, y0, z0] = b.min, [sx, sy, sz] = b.size;
    return [P(x0, y0, z0), P(x0 + sx, y0, z0), P(x0, y0 + sy, z0), P(x0, y0, z0 + sz), P(x0 + sx, y0 + sy, z0 + sz), P(x0 + sx, y0 + sy, z0), P(x0 + sx, y0, z0 + sz), P(x0, y0 + sy, z0 + sz)];
  });
  if (!pts.length) return { svg: '', legend: [] };
  const ux0 = Math.min(...pts.map((q) => q[0])), ux1 = Math.max(...pts.map((q) => q[0]));
  const uy0 = Math.min(...pts.map((q) => q[1])), uy1 = Math.max(...pts.map((q) => q[1]));
  const k = Math.min((f.w - 0.4) / (ux1 - ux0), (f.h - 0.4) / (uy1 - uy0));
  const ox = f.x + (f.w - (ux1 - ux0) * k) / 2 - ux0 * k, oy = f.y + (f.h - (uy1 - uy0) * k) / 2 - uy0 * k;
  const S = (q: [number, number]) => `${(ox + q[0] * k).toFixed(3)},${(oy + q[1] * k).toFixed(3)}`;
  // Far parts first: further left, further back and lower are further away
  const far = (b: (typeof boxes)[number]) => (W - (b.min[0] + b.size[0])) + (D - (b.min[2] + b.size[2])) - (b.min[1] + b.size[1]) * 0.5;
  const order = [...boxes].sort((a, b) => far(b) - far(a));
  const shade = (part: Part) => (part.role === 'door' || part.role === 'drawerFront' ? ['#eef2f6', '#dde4ec', '#c9d3de'] : part.material === 'faceframe' ? ['#f6efe0', '#ece0c6', '#dccba8'] : ['#f7f5ef', '#ebe7dd', '#dad4c6']);
  const faces: string[] = [];
  for (const b of order) {
    const [x0, y0, z0] = b.min, [sx, sy, sz] = b.size;
    const x1 = x0 + sx, y1 = y0 + sy, z1 = z0 + sz;
    const [top, front, right] = shade(b.part);
    const poly = (q: [number, number][], fill: string) => `<polygon points="${q.map(S).join(' ')}" fill="${fill}" stroke="#222" stroke-width="0.008" stroke-linejoin="round"/>`;
    faces.push(poly([P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], top));
    faces.push(poly([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], front));
    faces.push(poly([P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0)], right));
  }
  // One balloon per parts-list line, on the first of its pieces, with a short leader up and out
  const done = new Set<number>();
  const balloons: string[] = [];
  const legend = new Map<number, { n: number; name: string; qty: number }>();
  for (const b of boxes) {
    const n = nums.get(partRowKey(b.part));
    if (!n) continue;
    const l = legend.get(n);
    if (l) l.qty++; else legend.set(n, { n, name: b.part.name, qty: 1 });
    if (done.has(n)) continue;
    done.add(n);
    const [x0, y0, z0] = b.min, [sx, sy, sz] = b.size;
    const at = P(x0 + sx / 2, y0 + sy / 2, z0 + sz);
    const ax = ox + at[0] * k, ay = oy + at[1] * k;
    const bx = ax + 0.18, by = ay - 0.16;
    balloons.push(`<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="#c0392b" stroke-width="0.008"/><circle cx="${ax}" cy="${ay}" r="0.018" fill="#c0392b"/>`
      + `<circle cx="${bx}" cy="${by}" r="0.085" fill="#fff" stroke="#c0392b" stroke-width="0.012"/><text x="${bx}" y="${by + 0.03}" font-size="0.085" font-weight="700" text-anchor="middle" fill="#c0392b">${n}</text>`);
  }
  return { svg: faces.join('') + balloons.join(''), legend: [...legend.values()].sort((a, b) => a.n - b.n) };
}

/** Lighten (amt > 0) or darken a hex color. */
function shadeHex(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(amt > 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return `#${[ch(n >> 16), ch((n >> 8) & 255), ch(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * One wall's cabinetry in isometric, for the customer: seen from the room, a little to the right and
 * above, in the job's paint color, with the wall, the floor in front of it and its doors and windows.
 * Line drawing, so it prints and scales like the rest of the set.
 */
export function wallIso(p: Project, wall: import('../model/types').WallId, f: Frame, L: number, H: number): string {
  const cabs = p.cabinets.filter((c) => c.wall === wall);
  const paint = p.finishes.paint || '#ece8de';
  type B = { min: [number, number, number]; size: [number, number, number]; fill: string };
  const boxes: B[] = [];
  for (const c of cabs) {
    const z0 = c.wallInset ?? 0;
    for (const part of partsOf(p, c)) {
      if (['counter', 'rod', 'cushion', 'nailer', 'back'].includes(part.role)) continue;
      const fill = part.role === 'counter' ? '#9a9a9a' : part.look === 'wood' ? '#b98a5a' : paint;
      for (const b of part.boxes) boxes.push({ min: [c.offset + b.min[0], c.elevation + b.min[1], z0 + b.min[2]], size: b.size, fill });
    }
  }
  const D = Math.max(18, ...boxes.map((b) => b.min[2] + b.size[2])) + 18;
  const P = (x: number, y: number, z: number): [number, number] => [(x + (D - z)) * COS, -y - ((L - x) + (D - z)) * SIN];
  const corners = [P(0, 0, 0), P(L, 0, 0), P(0, H, 0), P(L, H, 0), P(0, 0, D), P(L, 0, D)];
  const ux0 = Math.min(...corners.map((q) => q[0])), ux1 = Math.max(...corners.map((q) => q[0]));
  const uy0 = Math.min(...corners.map((q) => q[1])), uy1 = Math.max(...corners.map((q) => q[1]));
  const k = Math.min((f.w - 0.2) / (ux1 - ux0), (f.h - 0.2) / (uy1 - uy0));
  const ox = f.x + (f.w - (ux1 - ux0) * k) / 2 - ux0 * k, oy = f.y + (f.h - (uy1 - uy0) * k) / 2 - uy0 * k;
  const S = (q: [number, number]) => `${(ox + q[0] * k).toFixed(3)},${(oy + q[1] * k).toFixed(3)}`;
  const poly = (q: [number, number][], fill: string, stroke = '#333', sw = 0.006) => `<polygon points="${q.map(S).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  const out: string[] = [];
  // The floor in front of the wall, then the wall itself, with its openings
  out.push(poly([P(0, 0, 0), P(L, 0, 0), P(L, 0, D), P(0, 0, D)], '#efe9de', '#999'));
  out.push(poly([P(0, 0, 0), P(L, 0, 0), P(L, H, 0), P(0, H, 0)], '#f6f5f2', '#999'));
  for (const o of (p.openings ?? []).filter((x) => x.wall === wall)) {
    const y0 = o.kind === 'window' ? o.sill : 0;
    out.push(poly([P(o.offset, y0, 0.1), P(o.offset + o.width, y0, 0.1), P(o.offset + o.width, y0 + o.height, 0.1), P(o.offset, y0 + o.height, 0.1)], o.kind === 'window' ? '#dfe8ee' : '#e4e1da', '#888'));
  }
  const far = (b: B) => (L - (b.min[0] + b.size[0])) + (D - (b.min[2] + b.size[2])) - (b.min[1] + b.size[1]) * 0.5;
  for (const b of [...boxes].sort((a, c) => far(c) - far(a))) {
    const [x0, y0, z0] = b.min, [sx, sy, sz] = b.size;
    const x1 = x0 + sx, y1 = y0 + sy, z1 = z0 + sz;
    out.push(poly([P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], shadeHex(b.fill, 0.35)));
    out.push(poly([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], b.fill));
    out.push(poly([P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0)], shadeHex(b.fill, -0.18)));
  }
  return out.join('');
}
