// Details and sections: the drawings an architect adds to show how the important parts are built.
// A coffer beam section, a section through one cabinet, and a wall section cut straight through a
// wall at a point (everything on that wall at that spot: base and upper cases, tops, crown, the
// coffer's perimeter soffit, a ladder rail), each labeled and dimensioned. You pick which ones a
// job gets; they go on Details sheets in the customer set, the shop set, or both.
import type { Cabinet, Project, WallId } from '../model/types';
import { resolveEnds, wallLength, wallNames } from '../model/layout';
import { cabinetMoldings, mountShape, profileByNum } from '../model/moldings';
import { eff } from '../model/parts';
import { cofferOf, fasciaHeight, perimOf } from '../model/coffer';
import { ladderOf } from '../model/ladder';
import { View, dimText, fitScale, type Frame } from './draw';
import { beamSection, cabinetsOn, partsOf, sideSection } from './views';
import { uid } from '../model/defaults';

export type DetailKind = 'beam' | 'wall' | 'cabinet';
export interface Detail {
  id: string;
  kind: DetailKind;
  /** A wall section: which wall, and where along it (from its left end) the cut is. */
  wall?: WallId;
  at?: number;
  /** A cabinet section: which cabinet. */
  cabinetId?: string;
  /** Your title and a note under it; unset = a title from what it shows. */
  title?: string;
  note?: string;
  /** Which drawing sets it goes in. Unset = both. */
  sets?: 'both' | 'customer' | 'shop';
}

export const detailsOf = (p: Project): Detail[] => p.details ?? [];
export const newDetail = (d: Omit<Detail, 'id'>): Detail => ({ id: uid('det'), ...d });
export const inSet = (d: Detail, set: 'customer' | 'shop') => (d.sets ?? 'both') === 'both' || d.sets === set;

/** What a detail is called on the sheet. */
export function detailTitle(p: Project, d: Detail): string {
  if (d.title?.trim()) return d.title.trim();
  if (d.kind === 'beam') return 'Coffer beam section';
  if (d.kind === 'cabinet') { const c = p.cabinets.find((x) => x.id === d.cabinetId); return c ? `${c.name} section` : 'Cabinet section'; }
  const c = d.wall ? cutCabinets(p, d.wall, d.at ?? 0)[0] : undefined;
  return `${d.wall ? wallNames[d.wall] : 'Wall'} section${c ? ` at ${c.name}` : ''}`;
}

/** Whether it can still be drawn (its cabinet or ceiling may be gone). */
export function detailOk(p: Project, d: Detail): boolean {
  if (d.kind === 'beam') return cofferOf(p).on;
  if (d.kind === 'cabinet') { const c = p.cabinets.find((x) => x.id === d.cabinetId); return !!c && c.kind !== 'shelf' && c.kind !== 'pilaster' && c.kind !== 'mantel'; }
  return !!d.wall;
}

/** The cabinets a wall section at `at` passes through, back to front, bottom to top. */
export function cutCabinets(p: Project, wall: WallId, at: number): Cabinet[] {
  return p.cabinets.filter((c) => c.wall === wall && !c.island && c.offset <= at && at <= c.offset + c.width).sort((a, b) => a.elevation - b.elevation);
}

/** A good place for a wall section: the middle of the widest cabinet that reaches up off the floor, else the wall's middle. */
export function suggestedCut(p: Project, wall: WallId): number {
  const cabs = cabinetsOn(p, wall).filter((c) => c.kind !== 'pilaster');
  const best = [...cabs].sort((a, b) => b.height * b.width - a.height * a.width)[0];
  // Through a mantel's leg, where its depth shows; through anything else a third of the way in
  if (best?.kind === 'mantel') return Math.round((best.offset + 3) * 4) / 4;
  return best ? Math.round((best.offset + best.width * 0.35) * 4) / 4 : wallLength(p.room, wall) / 2;
}

const label = (v: View, x: number, y: number, tx: number, ty: number, text: string) => {
  v.line(x, y, tx, ty, 'thin');
  v.circle(x, y, v.p(0.012), 'hw');
  v.text(tx + v.p(0.04), ty - v.p(0.03), text, 0.085, 'start', 'dt');
};

/** A section straight through a wall at `at`: what's against it, cut, seen from the left end. */
export function wallSection(p: Project, wall: WallId, at: number, frame: Frame): { svg: string; scale: number } {
  const H = p.room.height;
  const T = 4.5;
  const cabs = cutCabinets(p, wall, at);
  const c = cofferOf(p);
  const L = p.ladder?.on && ladderOf(p).wall === wall ? ladderOf(p) : null;
  const P = c.on && c.perimeter ? perimOf(c, wall) : 0;
  const deep = Math.max(24, ...cabs.map((k) => (k.wallInset ?? 0) + k.depth + 6), P + 6, L ? L.railZ + L.footOut + 6 : 0);
  const perFoot = fitScale(deep + T + 22, H + 2, frame.w - 1, frame.h - 1);
  const v = new View(frame, { x0: -T, y0: 0, x1: deep + 22, y1: H }, perFoot);
  // Wall, floor and ceiling
  v.rect(-T, 0, T, H, 'wall');
  v.line(-T - 2, 0, deep, 0, 'heavy');
  v.line(-T - 2, H, deep, H, 'heavy');
  const notes: { x: number; y: number; text: string }[] = [];
  const zs = [0];
  const ys = [0, H];
  for (const k of cabs) {
    const s = eff(k, p.settings);
    const z0 = k.wallInset ?? 0;
    const lx = at - k.offset;
    const parts = partsOf(p, k);
    // Ghost the case side beyond the cut, then everything the cut passes through
    // A mantel shows its whole profile from the side (legs, frieze, shelf, overmantel); a case just its far side
    for (const part of parts) for (const b of part.boxes) if (k.kind === 'mantel' || (part.role === 'side' && b.min[0] < lx)) v.rect(z0 + b.min[2], k.elevation + b.min[1], b.size[2], b.size[1], k.kind === 'mantel' ? 'o' : 'ghost');
    const cut = parts.flatMap((part) => part.boxes.map((b) => ({ part, b }))).filter(({ b }) => b.min[0] <= lx && lx <= b.min[0] + b.size[0]);
    for (const { part, b } of cut) v.rect(z0 + b.min[2], k.elevation + b.min[1], b.size[2], b.size[1], part.role === 'door' || part.role === 'drawerFront' || part.role === 'counter' ? 'o' : 'cut');
    // Mouldings the cut crosses, in profile
    for (const m of cabinetMoldings(k, s, resolveEnds(p.room, p.cabinets, k))) {
      if (m.along !== 'x' || m.facing !== 'front' || lx < m.x || lx > m.x + m.length) continue;
      const prof = profileByNum(m.num);
      if (!prof) continue;
      const sh = mountShape(prof);
      v.poly(sh.pts.map(([u, q]) => [z0 + m.z + u, k.elevation + m.y + (m.hang ? sh.height - q : q)]), 'o');
      if (m.kind === 'crown') notes.push({ x: z0 + m.z + sh.depth * 0.6, y: k.elevation + m.y + sh.height * 0.5, text: `Crown, A&M #${prof.num}` });
    }
    const top = k.elevation + k.height;
    zs.push(z0 + k.depth);
    if (z0 > 0.1) zs.push(z0);
    ys.push(k.elevation, top);
    const counter = cut.find(({ part }) => part.role === 'counter');
    if (counter) ys.push(k.elevation + counter.b.min[1] + counter.b.size[1]);
    const kind = k.kind === 'base' ? 'base cabinet' : k.kind === 'wall' ? 'wall cabinet' : k.kind === 'tall' ? 'tall cabinet' : k.kind;
    notes.push({ x: z0 + k.depth * 0.5, y: k.elevation + k.height * 0.55, text: `${k.name}: ${kind}, ${dimText(k.depth)} deep` });
    if (counter) notes.push({ x: z0 + k.depth * 0.7, y: k.elevation + counter.b.min[1] + counter.b.size[1] * 0.5, text: counter.part.name });
  }
  // The coffer's perimeter soffit along this wall: fascia, soffit and nailer, crown on the fascia
  if (P > c.fascia) {
    const fh = fasciaHeight(c);
    const over = cabs.some((k) => k.elevation + k.height >= H - c.drop - 0.5);
    v.rect(P - c.fascia, H - fh, c.fascia, fh, 'cut');
    if (!over) {
      v.rect(0, H - c.drop + c.reveal, P - c.fascia, c.soffit, 'cut');
      v.rect(0, H - c.nailer, P - c.fascia, c.nailer, 'ghost');
    }
    const crown = profileByNum(c.crown);
    if (crown) { const sh = mountShape(crown); v.poly(sh.pts.map(([u, q]) => [P + u, H - sh.height + q]), 'o'); }
    notes.push({ x: P - c.fascia / 2, y: H - fh / 2, text: over ? 'Perimeter fascia over the cabinets' : 'Coffer perimeter: fascia, soffit, 2x nailer' });
    zs.push(P);
    ys.push(H - fh);
  }
  // A rolling ladder's rail on its bracket, and the ladder leaning to it
  if (L) {
    const r = L.railDia / 2;
    v.line(L.face, L.railHeight, L.railZ, L.railHeight, 'o');
    v.circle(L.railZ, L.railHeight, r, 'hw');
    const foot = L.railZ + L.footOut + L.stileDepth / 2;
    v.poly([[foot - L.stileDepth / 2, 0], [foot + L.stileDepth / 2, 0], [L.railZ + r + L.stileDepth + 0.25, L.railHeight + 3], [L.railZ + r + 0.25, L.railHeight + 3]], 'o');
    notes.push({ x: L.railZ, y: L.railHeight, text: `${L.model} rail, ${dimText(L.railHeight)} to center` });
    ys.push(L.railHeight);
  }
  // Depths along the floor, heights up the right, the room's height on the left
  const zMax = Math.max(...zs);
  v.chainH(zs, 0, -0.35);
  v.chainV(ys, zMax + 2, 0.3);
  v.dimV(0, H, -T, -0.35, undefined, true);
  // Labels stacked in a column to the right, in order of height
  const lx = zMax + 2 + v.p(0.75);
  const sorted = notes.sort((a, b) => b.y - a.y);
  const gap = v.p(0.2);
  let last = Infinity;
  for (const n of sorted) {
    const ty = Math.min(n.y, last - gap);
    label(v, n.x, n.y, lx, ty, n.text);
    last = ty;
  }
  return { svg: v.svg(), scale: perFoot };
}

/** One detail drawn into a frame. */
export function drawDetail(p: Project, d: Detail, frame: Frame): { svg: string; scale: number } | null {
  if (!detailOk(p, d)) return null;
  if (d.kind === 'beam') return beamSection(p, frame);
  if (d.kind === 'cabinet') return sideSection(p, p.cabinets.find((x) => x.id === d.cabinetId)!, frame);
  return wallSection(p, d.wall!, d.at ?? suggestedCut(p, d.wall!), frame);
}
