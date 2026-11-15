// One wall's work in 3D, as a clean line drawing for the customer: seen from the room, a little to
// the right and above, in the paint color. Each cabinet is drawn as one solid with its face on the
// front (frame, doors and drawer fronts outlined, open sections dark), whatever stands proud of it
// (overlay doors, tops, plinths) as solids, and the mouldings swept along their runs with their real
// profiles showing at the ends, so it reads like the 3D view without the parts inside.
import type { Part, Project, WallId } from '../model/types';
import { eff } from '../model/parts';
import { resolveEnds } from '../model/layout';
import { cabinetMoldings, mountShape, profileByNum, type MoldPiece } from '../model/moldings';
import { underFascia } from '../model/coffer';
import { mantelOf } from '../model/mantel';
import { partsOf } from './views';
import type { Frame } from './draw';

const COS = Math.cos(Math.PI / 6), SIN = 0.5;
type V3 = [number, number, number];

/** Lighten (amt > 0) or darken a hex color. */
function shade(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(amt > 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return `#${[ch(n >> 16), ch((n >> 8) & 255), ch(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Each moulding run as world-space polygons: its swept faces, shaded by which way they face, and its end profiles. */
function moldingPolys(pc: MoldPiece, at: (x: number, y: number, z: number) => V3): { pts: V3[]; light: number; edge: boolean }[] {
  const p = profileByNum(pc.num);
  if (!p || pc.length <= 0) return [];
  const m = mountShape(p);
  const flip = pc.kind === 'casing';
  const pts = m.pts.map(([u, v]) => [u, pc.hang ? -v : flip ? m.height - v : v] as [number, number]);
  // Profile (u out from the face, v up) at w along the run, to the cabinet's coordinates
  const map = (u: number, v: number, w: number): V3 => {
    if (pc.vertical === 'left') return at(pc.x - v, pc.y + w, pc.z + u);
    if (pc.vertical === 'right') return at(pc.x + v, pc.y + w, pc.z + u);
    switch (pc.facing) {
      case 'front': return at(pc.x + w, pc.y + v, pc.z + u);
      case 'back': return at(pc.x - w, pc.y + v, pc.z - u);
      case 'left': return at(pc.x - u, pc.y + v, pc.z + w);
      default: return at(pc.x + u, pc.y + v, pc.z + w);
    }
  };
  const out: { pts: V3[]; light: number; edge: boolean }[] = [];
  // Wind the outline the same way, so "out" is the same side of every segment
  let area = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
  const ring = area < 0 ? [...pts].reverse() : pts;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const du = b[0] - a[0], dv = b[1] - a[1];
    const len = Math.hypot(du, dv);
    if (len < 1e-6) continue;
    // Outward normal of a counterclockwise ring: (dv, -du); light from up and out of the face
    const nu = dv / len, nv = -du / len;
    if (nu < -0.05 && Math.abs(nv) < 0.9) continue; // faces the wall: never seen
    const light = 0.55 + 0.45 * Math.max(0, 0.45 * nu + 0.85 * nv);
    out.push({ pts: [map(a[0], a[1], 0), map(b[0], b[1], 0), map(b[0], b[1], pc.length), map(a[0], a[1], pc.length)], light, edge: false });
  }
  // The end caps show the profile
  out.push({ pts: ring.map(([u, v]) => map(u, v, 0)), light: 0.82, edge: true });
  out.push({ pts: ring.map(([u, v]) => map(u, v, pc.length)), light: 0.82, edge: true });
  return out;
}

export function wallIso(p: Project, wall: WallId, f: Frame, L: number, H: number): string {
  const cabs = p.cabinets.filter((c) => c.wall === wall);
  const paint = p.finishes.paint || '#ece8de';
  const wood = '#b98a5a';
  type Solid = { kind: 'box'; min: V3; max: V3; fill: string } | { kind: 'face'; pts: V3[]; fill: string; stroke: number } | { kind: 'poly'; pts: V3[]; fill: string; edge: boolean };
  const items: { order: number; sub: number; s: Solid }[] = [];
  let maxZ = 18;
  const depthKey = (x: number, y: number, z: number) => (L - x) + (40 - z) * 1.2 - y * 0.02;
  cabs.forEach((c) => {
    const parts = partsOf(p, c).filter((x) => x.boxes.length && !['rod', 'cushion', 'nailer', 'back', 'drawerBox'].includes(x.role));
    const z0 = c.wallInset ?? 0;
    const at = (x: number, y: number, z: number): V3 => [c.offset + x, c.elevation + y, z0 + z];
    const colorOf = (x: Part) => (x.role === 'counter' ? '#9a9a9a' : x.look === 'wood' || x.role === 'woodTop' ? wood : paint);
    // The case body: the sides, top, bottom and face frame make one solid; its front is the face frame's face
    const body = parts.filter((x) => ['side', 'top', 'bottom', 'stile', 'rail', 'endPanel', 'toekick', 'stretcher', 'divider', 'shelf'].includes(x.role));
    const bb = (list: Part[]) => {
      const bs = list.flatMap((x) => x.boxes);
      return { min: [Math.min(...bs.map((b) => b.min[0])), Math.min(...bs.map((b) => b.min[1])), Math.min(...bs.map((b) => b.min[2]))] as V3, max: [Math.max(...bs.map((b) => b.min[0] + b.size[0])), Math.max(...bs.map((b) => b.min[1] + b.size[1])), Math.max(...bs.map((b) => b.min[2] + b.size[2]))] as V3 };
    };
    const order = depthKey(c.offset + c.width, c.elevation, z0 + c.depth);
    if (body.length) {
      const k = bb(body);
      const front = Math.max(...parts.filter((x) => x.role === 'stile' || x.role === 'rail' || x.role === 'side').flatMap((x) => x.boxes.map((b) => b.min[2] + b.size[2])), k.min[2]);
      // The solid, its front dark: whatever isn't covered by frame, doors or shelves reads as open
      items.push({ order, sub: 0, s: { kind: 'box', min: at(k.min[0], k.min[1], k.min[2]), max: at(k.max[0], k.max[1], front), fill: paint } });
      // A mantel's face is solid but for the firebox opening; casework's is open where nothing covers it
      const isMantel = c.kind === 'mantel';
      items.push({ order, sub: 1, s: { kind: 'face', pts: [at(k.min[0], k.min[1], front), at(k.max[0], k.min[1], front), at(k.max[0], k.max[1], front), at(k.min[0], k.max[1], front)], fill: isMantel ? paint : shade(paint, -0.3), stroke: 0.006 } });
      if (isMantel) {
        const m = mantelOf(c);
        const ox0 = (c.width - m.openingW) / 2;
        items.push({ order, sub: 1.5, s: { kind: 'face', pts: [at(ox0, m.openingY, front), at(ox0 + m.openingW, m.openingY, front), at(ox0 + m.openingW, m.openingY + m.openingH, front), at(ox0, m.openingY + m.openingH, front)], fill: '#3d3a36', stroke: 0.006 } });
      }
      // Flush faces: the frame, inset doors and fronts, shelf edges in the openings
      const flush = parts.filter((x) => x.boxes.every((b) => b.min[2] + b.size[2] <= front + 0.1) && ['stile', 'rail', 'door', 'drawerFront', 'shelf', 'divider', 'endPanel', 'trim', 'bottom', 'top'].includes(x.role));
      for (const x of flush) for (const b of x.boxes) {
        const zf = b.min[2] + b.size[2];
        if (zf < front - 2.5) continue; // well behind the face: shelves deep in an opening stay in the dark
        const recess = Math.max(0, front - zf);
        const fill = recess > 0.05 ? shade(colorOf(x), -Math.min(0.3, recess * 0.15)) : colorOf(x);
        items.push({ order, sub: 2 + zf / 100, s: { kind: 'face', pts: [at(b.min[0], b.min[1], zf), at(b.min[0] + b.size[0], b.min[1], zf), at(b.min[0] + b.size[0], b.min[1] + b.size[1], zf), at(b.min[0], b.min[1] + b.size[1], zf)], fill, stroke: 0.004 } });
      }
      maxZ = Math.max(maxZ, z0 + front);
    }
    // Proud of the face, or a piece with no case (pilaster faces, shelves, mantels): solids
    const frontOf = body.length ? Math.max(...parts.filter((x) => x.role === 'stile' || x.role === 'rail' || x.role === 'side').flatMap((x) => x.boxes.map((b) => b.min[2] + b.size[2])), 0) : -1;
    const proud = parts.filter((x) => !body.includes(x) && x.boxes.some((b) => b.min[2] + b.size[2] > frontOf + 0.1));
    for (const x of proud) for (const b of x.boxes) {
      const mn = at(b.min[0], b.min[1], b.min[2]), mx = at(b.min[0] + b.size[0], b.min[1] + b.size[1], b.min[2] + b.size[2]);
      items.push({ order: depthKey(mx[0], mn[1], mx[2]), sub: 3, s: { kind: 'box', min: mn, max: mx, fill: colorOf(x) } });
      maxZ = Math.max(maxZ, mx[2]);
    }
    // Mouldings with their real profiles
    for (const pc of cabinetMoldings(c, eff(c, p.settings), resolveEnds(p.room, p.cabinets, c), { noCrown: underFascia(p, c) })) {
      const polys = moldingPolys(pc, at);
      if (!polys.length) continue;
      const far = (q: V3[]) => Math.min(...q.map((v) => depthKey(v[0], v[1], v[2])));
      const near = Math.min(...polys.flatMap((q) => q.pts.map((v) => depthKey(v[0], v[1], v[2]))));
      // The whole run draws after what's behind it; its own faces, back ones first
      polys.sort((a, b) => far(b.pts) - far(a.pts));
      polys.forEach((q, i) => items.push({ order: near - 0.5, sub: 10 + i / 1000, s: { kind: 'poly', pts: q.pts, fill: shade(paint, q.light - 1), edge: q.edge } }));
      maxZ = Math.max(maxZ, ...polys.flatMap((q) => q.pts.map((v) => v[2])));
    }
  });
  const D = maxZ + 18;
  const P = (q: V3): [number, number] => [(q[0] + (D - q[2])) * COS, -q[1] - ((L - q[0]) + (D - q[2])) * SIN];
  const corners: V3[] = [[0, 0, 0], [L, 0, 0], [0, H, 0], [L, H, 0], [0, 0, D], [L, 0, D]];
  const pc = corners.map(P);
  const ux0 = Math.min(...pc.map((q) => q[0])), ux1 = Math.max(...pc.map((q) => q[0]));
  const uy0 = Math.min(...pc.map((q) => q[1])), uy1 = Math.max(...pc.map((q) => q[1]));
  const k = Math.min((f.w - 0.2) / (ux1 - ux0), (f.h - 0.2) / (uy1 - uy0));
  const ox = f.x + (f.w - (ux1 - ux0) * k) / 2 - ux0 * k, oy = f.y + (f.h - (uy1 - uy0) * k) / 2 - uy0 * k;
  const S = (q: V3) => { const [a, b] = P(q); return `${(ox + a * k).toFixed(3)},${(oy + b * k).toFixed(3)}`; };
  const poly = (q: V3[], fill: string, stroke = '#2b2b2b', sw = 0.006) => `<polygon points="${q.map(S).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  const out: string[] = [];
  // The floor in front of the wall, the wall, its doors and windows
  out.push(poly([[0, 0, 0], [L, 0, 0], [L, 0, D], [0, 0, D]], '#efe9de', '#aaa', 0.005));
  out.push(poly([[0, 0, 0], [L, 0, 0], [L, H, 0], [0, H, 0]], '#f6f5f2', '#aaa', 0.005));
  for (const o of (p.openings ?? []).filter((x) => x.wall === wall)) {
    const y0 = o.kind === 'window' ? o.sill : 0;
    out.push(poly([[o.offset, y0, 0.1], [o.offset + o.width, y0, 0.1], [o.offset + o.width, y0 + o.height, 0.1], [o.offset, y0 + o.height, 0.1]], o.kind === 'window' ? '#dfe8ee' : '#e4e1da', '#999', 0.005));
  }
  // Far to near: whole cabinets, then within each its solid, its face, its flush parts
  items.sort((a, b) => b.order - a.order || a.sub - b.sub);
  for (const { s } of items) {
    if (s.kind === 'box') {
      const [x0, y0, z0] = s.min, [x1, y1, z1] = s.max;
      out.push(poly([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], shade(s.fill, 0.3)));
      out.push(poly([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], shade(s.fill, -0.16)));
      out.push(poly([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], s.fill));
    } else if (s.kind === 'face') out.push(poly(s.pts, s.fill, '#2b2b2b', s.stroke));
    else out.push(poly(s.pts, s.fill, s.edge ? '#2b2b2b' : s.fill, s.edge ? 0.005 : 0.002));
  }
  return out.join('');
}
