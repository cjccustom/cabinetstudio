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
import { pullColor, pullSpots } from '../model/pulls';
import { finishColors, woodColor } from '../model/woodColors';

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
  const woodAll = '#b98a5a';
  type IBox = { min: V3; max: V3; fill: string; edge?: string };
  type Solid = { kind: 'box'; min: V3; max: V3; fill: string } | { kind: 'face'; pts: V3[]; fill: string; stroke: number } | { kind: 'poly'; pts: V3[]; fill: string; edge: boolean }
    // Seen through the face: the inside of the open sections (back, sides, shelves, dividers, rods), clipped to the face
    | { kind: 'inside'; clip: V3[]; boxes: IBox[] }
    | { kind: 'knob'; at: V3; r: number; fill: string } | { kind: 'bar'; a: V3; b: V3; w: number; fill: string };
  const metal = pullColor(p.settings);
  // Floor shadows under the floor-standing pieces, drawn on the floor before anything stands on it
  const shadows: V3[][] = [];
  const items: { order: number; sub: number; s: Solid }[] = [];
  let maxZ = 18;
  const depthKey = (x: number, y: number, z: number) => (L - x) + (40 - z) * 1.2 - y * 0.02;
  cabs.forEach((c) => {
    const allParts = partsOf(p, c);
    // This cabinet's finish: the paint, or on stain grade the species (and stain); interiors the case plywood
    const fc = finishColors(eff(c, p.settings), p.finishes, c.paint);
    const paint = fc.paint;
    const plyColor = fc.box;
    const wood = woodColor(c.topSpecies) ?? woodColor(p.settings.woodSpecies) ?? p.finishes.wood ?? woodAll;
    const ends = resolveEnds(p.room, p.cabinets, c);
    // A piece the run shares (the one-piece top, a continuous sub-crown) is carried by the first cabinet but
    // lies over the rest: it draws with the run's last cabinet, after the cabinets it sits on
    const runOrder = (x1: number) => depthKey(c.offset + x1, c.elevation, z0run + c.depth);
    const z0run = c.wallInset ?? 0;
    const subEnd = ends.subRun ? ends.subRun.last.offset + ends.subRun.last.width : null;
    const parts = allParts.filter((x) => x.boxes.length && !['rod', 'cushion', 'nailer', 'back', 'drawerBox'].includes(x.role));
    if (c.elevation < 1) shadows.push([[c.offset - 1, 0, (c.wallInset ?? 0)], [c.offset + c.width + 2, 0, (c.wallInset ?? 0)], [c.offset + c.width + 4, 0, (c.wallInset ?? 0) + c.depth + 5], [c.offset + 1, 0, (c.wallInset ?? 0) + c.depth + 5]]);
    const z0 = c.wallInset ?? 0;
    const at = (x: number, y: number, z: number): V3 => [c.offset + x, c.elevation + y, z0 + z];
    const colorOf = (x: Part) => (x.role === 'counter' ? '#9a9a9a' : x.look === 'wood' || x.role === 'woodTop' ? wood : paint);
    // The case body: the sides, top, bottom and face frame make one solid; its front is the face frame's
    // face. A mantel is two: the surround below the shelf and the overmantel above, set back from it.
    type PB = { part: Part; b: Part['boxes'][number] };
    const all: PB[] = parts.flatMap((part) => part.boxes.map((b) => ({ part, b })));
    const bodyRoles = ['side', 'top', 'bottom', 'stile', 'rail', 'endPanel', 'toekick', 'stretcher', 'divider', 'shelf'];
    // A mantel's mass is the chimney: its face is the chimney sides' front, and the legs, frieze and
    // pilasters stand out from it as pieces of their own
    const frontRoles = c.kind === 'mantel' ? ['side'] : ['stile', 'rail', 'side'];
    const shelf = c.kind === 'mantel' ? all.find((x) => x.part.name === 'Mantel shelf') : undefined;
    const cuts = shelf ? [-Infinity, shelf.b.min[1] + shelf.b.size[1], Infinity] : [-Infinity, Infinity];
    // Bottom up: each part's body, face and the pieces on it before the part above it
    const bandOf = (y: number) => Math.max(0, cuts.findIndex((v, i) => i + 1 < cuts.length && y >= v && y < cuts[i + 1]));
    const midY = (x: PB) => x.b.min[1] + x.b.size[1] / 2;
    const zTop = (x: PB) => x.b.min[2] + x.b.size[2];
    const order = depthKey(c.offset + c.width, c.elevation, z0 + c.depth);
    const used = new Set<PB>();
    const bandFront: { y0: number; y1: number; front: number }[] = [];
    let bodyX0: number | null = null;
    for (let i = 0; i + 1 < cuts.length; i++) {
      const inBand = (x: PB) => midY(x) >= cuts[i] && midY(x) < cuts[i + 1];
      const body = all.filter((x) => inBand(x) && (c.kind === 'mantel' ? x.part.name.startsWith('Chimney side') : bodyRoles.includes(x.part.role)));
      if (!body.length) continue;
      const k = {
        min: [Math.min(...body.map((x) => x.b.min[0])), Math.min(...body.map((x) => x.b.min[1])), Math.min(...body.map((x) => x.b.min[2]))] as V3,
        max: [Math.max(...body.map((x) => x.b.min[0] + x.b.size[0])), Math.max(...body.map((x) => x.b.min[1] + x.b.size[1]))] as [number, number],
      };
      const fr = body.filter((x) => frontRoles.includes(x.part.role));
      const front = fr.length ? Math.max(...fr.map(zTop)) : Math.max(...body.map(zTop));
      bandFront.push({ y0: cuts[i], y1: cuts[i + 1], front });
      bodyX0 = bodyX0 == null ? k.min[0] : Math.min(bodyX0, k.min[0]);
      body.forEach((x) => used.add(x));
      const sub0 = i * 100;
      // The solid, its front dark: whatever isn't covered by frame, doors or shelves reads as open
      items.push({ order, sub: sub0, s: { kind: 'box', min: at(k.min[0], k.min[1], k.min[2]), max: at(k.max[0], k.max[1], front), fill: paint } });
      // A mantel's face is solid but for the firebox opening; casework's is open where nothing covers it
      const isMantel = c.kind === 'mantel';
      items.push({ order, sub: sub0 + 1, s: { kind: 'face', pts: [at(k.min[0], k.min[1], front), at(k.max[0], k.min[1], front), at(k.max[0], k.max[1], front), at(k.min[0], k.max[1], front)], fill: isMantel ? paint : shade(paint, -0.3), stroke: 0.006 } });
      if (!isMantel) {
        // The inside, back to front: the case back, then the sides, dividers, shelves and rods, each lit as it faces
        const inside = allParts.filter((x) => ['back', 'side', 'divider', 'shelf', 'top', 'bottom', 'stretcher', 'rod'].includes(x.role))
          .flatMap((part) => part.boxes.filter((b) => { const m = b.min[1] + b.size[1] / 2; return m >= cuts[i] && m < cuts[i + 1]; }).map((b) => ({ part, b })));
        const ib: IBox[] = inside.map(({ part, b }) => ({ min: at(b.min[0], b.min[1], b.min[2]), max: at(b.min[0] + b.size[0], b.min[1] + b.size[1], Math.min(front, b.min[2] + b.size[2])),
          fill: part.role === 'rod' ? metal : part.role === 'back' ? shade(plyColor, -0.22) : shade(plyColor, -0.08), edge: part.role === 'rod' ? '#555' : undefined }));
        ib.sort((a, b) => depthKey(b.max[0], b.min[1], b.max[2]) - depthKey(a.max[0], a.min[1], a.max[2]));
        items.push({ order, sub: sub0 + 1.2, s: { kind: 'inside', clip: [at(k.min[0], k.min[1], front), at(k.max[0], k.min[1], front), at(k.max[0], k.max[1], front), at(k.min[0], k.max[1], front)], boxes: ib } });
      }
      if (isMantel && i === 0) {
        const m = mantelOf(c);
        const ox0 = (c.width - m.openingW) / 2;
        items.push({ order, sub: sub0 + 1.5, s: { kind: 'face', pts: [at(ox0, m.openingY, front), at(ox0 + m.openingW, m.openingY, front), at(ox0 + m.openingW, m.openingY + m.openingH, front), at(ox0, m.openingY + m.openingH, front)], fill: '#3d3a36', stroke: 0.006 } });
      }
      // Flush faces: the frame, inset doors and fronts, shelf edges in the openings, each at its own depth
      const flush = all.filter((x) => inBand(x) && zTop(x) <= front + 0.1 && zTop(x) >= front - 2.5 && ['stile', 'rail', 'door', 'drawerFront', 'shelf', 'divider', 'endPanel', 'trim', 'bottom', 'top'].includes(x.part.role));
      for (const x of flush) {
        const zf = zTop(x), b = x.b;
        used.add(x);
        const recess = Math.max(0, front - zf);
        const fill = recess > 0.05 ? shade(colorOf(x.part), -Math.min(0.3, recess * 0.15)) : colorOf(x.part);
        items.push({ order, sub: sub0 + 2 + zf / 100, s: { kind: 'face', pts: [at(b.min[0], b.min[1], zf), at(b.min[0] + b.size[0], b.min[1], zf), at(b.min[0] + b.size[0], b.min[1] + b.size[1], zf), at(b.min[0], b.min[1] + b.size[1], zf)], fill, stroke: 0.004 } });
      }
      maxZ = Math.max(maxZ, z0 + front);
    }
    // Proud of the face, or a piece with no case (pilaster faces, shelves, the mantel shelf): solids
    const frontAt = (x: PB) => bandFront.find((f) => midY(x) >= f.y0 && midY(x) < f.y1)?.front ?? -1;
    for (const x of all.filter((y) => !used.has(y) && (c.kind === 'mantel' || !bodyRoles.includes(y.part.role)) && zTop(y) > frontAt(y) + 0.1)) {
      const b = x.b;
      const mn = at(b.min[0], b.min[1], b.min[2]), mx = at(b.min[0] + b.size[0], b.min[1] + b.size[1], b.min[2] + b.size[2]);
      // After the body it stands on, nearest last; but whatever runs along the far (left) side of the
      // body is behind it from this side, so it goes first
      const farSide = bodyX0 != null && b.min[0] + b.size[0] <= bodyX0 + 0.01;
      const run = b.min[0] + b.size[0] > c.width + 0.5;
      items.push({ order: run ? runOrder(b.min[0] + b.size[0]) : order, sub: run ? 40 : bandOf(midY(x)) * 100 + (farSide ? -10 : 30) + (5000 - depthKey(mx[0], mn[1], mx[2])) / 10000, s: { kind: 'box', min: mn, max: mx, fill: colorOf(x.part) } });
      maxZ = Math.max(maxZ, mx[2]);
    }
    // A bench's seat cushion, in a fabric gray
    for (const part of allParts.filter((x) => x.role === 'cushion')) for (const b of part.boxes) {
      const mn = at(b.min[0], b.min[1], b.min[2]), mx = at(b.min[0] + b.size[0], b.min[1] + b.size[1], b.min[2] + b.size[2]);
      items.push({ order, sub: 900, s: { kind: 'box', min: mn, max: mx, fill: '#9aa1a8' } });
      maxZ = Math.max(maxZ, mx[2]);
    }
    // Knobs and pulls on the doors and drawer fronts
    for (const sp of pullSpots(p, c, allParts)) {
      if (sp.kind === 'finger') continue;
      const z = sp.z + 0.6;
      if (sp.kind === 'knob') items.push({ order, sub: 950, s: { kind: 'knob', at: at(sp.x, sp.y, z), r: 0.65, fill: metal } });
      else items.push({ order, sub: 950, s: { kind: 'bar', a: at(sp.x - (sp.vertical ? 0 : sp.len / 2), sp.y - (sp.vertical ? sp.len / 2 : 0), z), b: at(sp.x + (sp.vertical ? 0 : sp.len / 2), sp.y + (sp.vertical ? sp.len / 2 : 0), z), w: 0.5, fill: metal } });
    }
    // Mouldings with their real profiles
    for (const pc of cabinetMoldings(c, eff(c, p.settings), resolveEnds(p.room, p.cabinets, c), { noCrown: underFascia(p, c) })) {
      const polys = moldingPolys(pc, at);
      if (!polys.length) continue;
      const far = (q: V3[]) => Math.min(...q.map((v) => depthKey(v[0], v[1], v[2])));
      const near = Math.min(...polys.flatMap((q) => q.pts.map((v) => depthKey(v[0], v[1], v[2]))));
      // The whole run draws after what's behind it; its own faces, back ones first
      polys.sort((a, b) => far(b.pts) - far(a.pts));
      // On the cabinet, after its body and face (they sit on them), before whatever stands nearer
      const leftOfBody = bodyX0 != null && Math.max(...polys.flatMap((q) => q.pts.map((v) => v[0]))) <= c.offset + bodyX0 + 0.01;
      const sub = bandOf(pc.y) * 100 + (leftOfBody ? -10 : 30) + (5000 - near) / 10000;
      const onRun = subEnd != null && c.elevation > 0;
      polys.forEach((q, i) => items.push({ order: onRun ? depthKey(subEnd!, c.elevation, z0run + c.depth) : order, sub: (onRun ? 60 : 0) + sub + i / 1e7, s: { kind: 'poly', pts: q.pts, fill: shade(paint, q.light - 1), edge: q.edge } }));
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
    const y0 = o.kind === 'window' ? o.sill : 0, y1 = y0 + o.height, x0 = o.offset, x1 = o.offset + o.width;
    out.push(poly([[x0, y0, 0.1], [x1, y0, 0.1], [x1, y1, 0.1], [x0, y1, 0.1]], o.kind === 'window' ? '#d6e3ec' : '#e4e1da', '#999', 0.005));
    if (o.kind === 'window') {
      // Sash: the meeting rail across the middle, a sky-lit pane above
      const ym = (y0 + y1) / 2;
      out.push(poly([[x0 + 2, ym + 0.75, 0.2], [x1 - 2, ym + 0.75, 0.2], [x1 - 2, y1 - 2, 0.2], [x0 + 2, y1 - 2, 0.2]], '#e6eef4', '#9aa6ae', 0.004));
      out.push(poly([[x0 + 2, y0 + 2, 0.2], [x1 - 2, y0 + 2, 0.2], [x1 - 2, ym - 0.75, 0.2], [x0 + 2, ym - 0.75, 0.2]], '#dce7ee', '#9aa6ae', 0.004));
      out.push(poly([[x0 + 2, ym - 0.75, 0.3], [x1 - 2, ym - 0.75, 0.3], [x1 - 2, ym + 0.75, 0.3], [x0 + 2, ym + 0.75, 0.3]], '#ffffff', '#9aa6ae', 0.004));
    }
    // Casing around it, standing off the wall, with a stool under a window
    const w = 3.5, t = 0.75;
    const casing = (a: V3, b: V3) => {
      const [ax, ay] = [a[0], a[1]], [bx, by] = [b[0], b[1]];
      out.push(poly([[ax, by, 0], [bx, by, 0], [bx, by, t], [ax, by, t]], '#ffffff', '#888', 0.004));
      out.push(poly([[bx, ay, 0], [bx, ay, t], [bx, by, t], [bx, by, 0]], shade(p.finishes.trim ?? '#f4f1ea', -0.1), '#888', 0.004));
      out.push(poly([[ax, ay, t], [bx, ay, t], [bx, by, t], [ax, by, t]], '#fbfaf7', '#888', 0.004));
    };
    casing([x0 - w, y0, 0], [x0, y1, 0]);
    casing([x1, y0, 0], [x1 + w, y1, 0]);
    casing([x0 - w, y1, 0], [x1 + w, y1 + w, 0]);
    if (o.kind === 'window') casing([x0 - w - 0.75, y0 - 0.75, 0], [x1 + w + 0.75, y0, 0]);
  }
  // One soft shadow on the floor for everything standing on it (overlaps don't darken)
  if (shadows.length) out.push(`<g opacity="0.08">${shadows.map((q) => `<polygon points="${q.map(S).join(' ')}" fill="#000" stroke="none"/>`).join('')}</g>`);
  // Far to near: whole cabinets, then within each its solid, its face, its flush parts
  items.sort((a, b) => b.order - a.order || a.sub - b.sub);
  let clipN = 0;
  for (const { s } of items) {
    if (s.kind === 'box') {
      const [x0, y0, z0] = s.min, [x1, y1, z1] = s.max;
      out.push(poly([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], shade(s.fill, 0.3)));
      out.push(poly([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], shade(s.fill, -0.16)));
      out.push(poly([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], s.fill));
    } else if (s.kind === 'inside') {
      const id = `isoclip-${wall}-${clipN++}`;
      out.push(`<clipPath id="${id}"><polygon points="${s.clip.map(S).join(' ')}"/></clipPath><g clip-path="url(#${id})">`);
      for (const b of s.boxes) {
        const [x0, y0, z0] = b.min, [x1, y1, z1] = b.max;
        const st = b.edge ?? '#4a4a4a';
        out.push(poly([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], shade(b.fill, 0.18), st, 0.003));
        out.push(poly([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], shade(b.fill, -0.12), st, 0.003));
        out.push(poly([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], b.fill, st, 0.003));
      }
      out.push('</g>');
    } else if (s.kind === 'knob') {
      const [cx, cy] = S(s.at).split(',').map(Number);
      out.push(`<ellipse cx="${cx}" cy="${cy}" rx="${(s.r * k).toFixed(3)}" ry="${(s.r * k * 0.85).toFixed(3)}" fill="${s.fill}" stroke="#222" stroke-width="0.003"/>`);
    } else if (s.kind === 'bar') {
      const [ax, ay] = S(s.a).split(',').map(Number), [bx, by] = S(s.b).split(',').map(Number);
      out.push(`<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="#222" stroke-width="${(s.w * k + 0.008).toFixed(3)}" stroke-linecap="round"/><line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="${s.fill}" stroke-width="${(s.w * k).toFixed(3)}" stroke-linecap="round"/>`);
    } else if (s.kind === 'face') out.push(poly(s.pts, s.fill, '#2b2b2b', s.stroke));
    else out.push(poly(s.pts, s.fill, s.edge ? '#2b2b2b' : s.fill, s.edge ? 0.005 : 0.002));
  }
  return out.join('');
}
