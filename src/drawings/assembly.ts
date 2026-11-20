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
  // A shelf's solid front stays with its shelf
  if (/shelf/i.test(part.name) && part.role !== 'shelf') return [0, 0, e * 0.5];
  switch (part.role) {
    case 'side': case 'endPanel': return [cx < W / 2 ? -e : e, 0, 0];
    case 'top': case 'stretcher': case 'nailer': return [0, e * 0.9, 0];
    case 'back': return [0, 0, -e * 1.4];
    case 'stile': case 'rail': return [0, 0, e * 1.4];
    // Well out in front, clear of the face frame they cover (and the bottom rail under them)
    case 'door': case 'drawerFront': return [0, 0, e * 4.6];
    case 'trim': case 'toekick': return [0, 0, e * 2.2];
    case 'drawerBox': return [0, 0, e * 1.9];
    case 'shelf': return [0, 0, e * 0.5];
    default: return [0, 0, 0];
  }
}

export function assemblyView(p: Project, c: Cabinet, f: Frame): { svg: string; legend: { n: number; name: string; qty: number }[] } {
  // A base built once for the whole run (separate toe kick or base) isn't part of this case: it has its own lines
  const runBase = (x: Part) => /^(Toe kick base|Base (front|back) rail|Base cross piece)/.test(x.name);
  const parts = partsOf(p, c).filter((x) => x.boxes.length && !['counter', 'rod', 'cushion'].includes(x.role) && !runBase(x));
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
  // Drawn in the layers they're pulled apart into, back to front as seen from the front right: the back, the
  // left side, what's inside (bottom, shelves, dividers), the top, the right side, the face frame, the trim on it,
  // then the doors and fronts. Within a layer, further left, further back and lower first.
  const layer = (b: (typeof boxes)[number]) => {
    const r = b.part.role, cx = b.min[0] + b.size[0] / 2;
    if (r === 'back') return 0;
    if (r === 'side' || r === 'endPanel') return cx < W / 2 ? 1 : 5;
    if (r === 'top' || r === 'stretcher' || r === 'nailer') return 4;
    if (r === 'stile' || r === 'rail') return 6;
    if (r === 'door' || r === 'drawerFront') return 9;
    if (r === 'drawerBox') return 8;
    if (/shelf/i.test(b.part.name)) return 2;
    if (r === 'trim' || r === 'toekick') return 7;
    return 2;
  };
  const far = (b: (typeof boxes)[number]) => (W - (b.min[0] + b.size[0])) + (D - (b.min[2] + b.size[2])) - (b.min[1] + b.size[1]) * 0.5;
  const order = [...boxes].sort((a, b) => layer(a) - layer(b) || far(b) - far(a));
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
  // Each box's outline on the sheet (its three faces seen), to tell what a later box hides
  const outline = (b: (typeof boxes)[number]) => {
    const [x0, y0, z0] = b.min, [sx, sy, sz] = b.size;
    const x1 = x0 + sx, y1 = y0 + sy, z1 = z0 + sz;
    return [[P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], [P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0)]];
  };
  const inside = (q: [number, number], poly: [number, number][]) => {
    let hit = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > q[1]) !== (yj > q[1]) && q[0] < ((xj - xi) * (q[1] - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  };
  const rank = new Map(order.map((b, i) => [b, i]));
  const outlines = order.map(outline);
  const hidden = (q: [number, number], b: (typeof boxes)[number]) => {
    for (let i = (rank.get(b) ?? 0) + 1; i < order.length; i++) if (outlines[i].some((poly) => inside(q, poly))) return true;
    return false;
  };
  // One balloon per parts-list line, its leader on a spot of the part that shows (not under a door or the face
  // frame), the balloon up and out from it and clear of the others
  const done = new Set<number>();
  const balloons: string[] = [];
  const placed: [number, number][] = [];
  const legend = new Map<number, { n: number; name: string; qty: number }>();
  const R = 0.085;
  for (const b of boxes) {
    const n = nums.get(partRowKey(b.part));
    if (!n) continue;
    const l = legend.get(n);
    if (l) l.qty++; else legend.set(n, { n, name: b.part.name, qty: 1 });
  }
  for (const b0 of boxes) {
    const n = nums.get(partRowKey(b0.part));
    if (!n || done.has(n)) continue;
    done.add(n);
    // Spots along each of this line's pieces, on the front face, then the top: the first one that shows
    const mine = boxes.filter((x) => nums.get(partRowKey(x.part)) === n);
    let at: [number, number] | null = null;
    for (const b of mine) {
      const [x0, y0, z0] = b.min, [sx, sy, sz] = b.size;
      for (const t of [0.5, 0.7, 0.3, 0.85, 0.15]) for (const u of [0.5, 0.75, 0.25]) {
        const front = P(x0 + sx * t, y0 + sy * u, z0 + sz), top = P(x0 + sx * t, y0 + sy, z0 + sz * u);
        for (const q of [front, top]) if (!at && !hidden(q, b)) at = q;
      }
      if (at) break;
    }
    if (!at) { const [x0, y0, z0] = b0.min, [sx, sy, sz] = b0.size; at = P(x0 + sx / 2, y0 + sy / 2, z0 + sz); }
    const ax = ox + at[0] * k, ay = oy + at[1] * k;
    // Up and to the right; if that lands on another balloon, further out
    const tries: [number, number][] = [[0.18, -0.16], [0.3, -0.06], [0.18, -0.34], [0.36, -0.24], [-0.2, -0.16], [0.3, 0.12], [0.48, -0.1], [-0.3, -0.06]];
    let bx = ax + 0.18, by = ay - 0.16;
    for (const [dx, dy] of tries) {
      const x = ax + dx, y = ay + dy;
      if (placed.every(([px, py]) => Math.hypot(px - x, py - y) > 2 * R + 0.03)) { bx = x; by = y; break; }
    }
    placed.push([bx, by]);
    balloons.push(`<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="#c0392b" stroke-width="0.008"/><circle cx="${ax}" cy="${ay}" r="0.018" fill="#c0392b"/>`
      + `<circle cx="${bx}" cy="${by}" r="${R}" fill="#fff" stroke="#c0392b" stroke-width="0.012"/><text x="${bx}" y="${by + 0.03}" font-size="0.085" font-weight="700" text-anchor="middle" fill="#c0392b">${n}</text>`);
  }
  return { svg: faces.join('') + balloons.join(''), legend: [...legend.values()].sort((a, b) => a.n - b.n) };
}
