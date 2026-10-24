// Coffered ceilings, built the way CJC builds them: a 2x nailer on the ceiling ripped to fit
// between the fascias, poplar fascias with a dado, and a soffit whose 1/4" tongue is on its
// bottom face (so if it ever creeps out of the groove it doesn't open a gap), sitting a reveal
// above the bottom edge of the fascias. An optional perimeter fascia runs around the room. Every
// coffer gets crown; beadboard in the field and a bead on the fascia's bottom corner are options.
// Everything is in room coordinates: x along the back wall, z out from it, y up from the floor.
import type { Part, Project, VisualBox } from './types';
import { fmt } from '../units';

export interface CofferCeiling {
  on: boolean;
  /** Coffers across the room (along the back wall) and deep (toward the front wall). */
  across: number;
  deep: number;
  /** Even coffers, or smaller perimeter coffers so the middle ones are bigger. */
  layout: 'even' | 'bigCenter';
  /** Clear size of the perimeter coffers when they're smaller. */
  outer: number;
  /** Overall beam width, fascia face to fascia face, and how far it drops from the ceiling. */
  beamWidth: number;
  drop: number;
  /** Fascia and soffit stock. */
  fascia: number;
  soffit: number;
  /** The soffit's tongue: its thickness (on the bottom face) and how far it goes into the fascia's dado. */
  tongue: number;
  tongueDepth: number;
  /** Soffit bottom up from the bottom edge of the fascia. */
  reveal: number;
  /** 2x nailer thickness. */
  nailer: number;
  /** A fascia around the room, this far off the wall to its face. */
  perimeter: boolean;
  perimeterWidth: number;
  /** Which beams run through; the others are cut between them. */
  through: 'across' | 'deep';
  crown?: string;
  bead?: string;
  picture?: string;
  beadboard: boolean;
  species: string;
}

export const defaultCoffer: CofferCeiling = {
  on: false, across: 3, deep: 3, layout: 'even', outer: 24,
  beamWidth: 5.5, drop: 5.5, fascia: 0.75, soffit: 0.75, tongue: 0.25, tongueDepth: 0.25, reveal: 0.25, nailer: 1.5,
  perimeter: true, perimeterWidth: 4, through: 'across', beadboard: false, species: 'Poplar',
};
export const cofferOf = (p: Project): CofferCeiling => ({ ...defaultCoffer, ...p.ceiling });

export interface Span { a: number; b: number }
export interface CofferLayout {
  /** Clear openings along x and z, beam to beam. */
  xs: Span[];
  zs: Span[];
  /** Beams: positions across (along x) and deep (along z). */
  beamsX: Span[];
  beamsZ: Span[];
  /** Where the field starts and ends (inside the perimeter fascia, or the walls). */
  field: { x0: number; x1: number; z0: number; z1: number };
  warnings: string[];
}

function split(a: number, b: number, n: number, beam: number, layout: CofferCeiling['layout'], outer: number): { open: Span[]; beams: Span[]; warn?: string } {
  n = Math.max(1, Math.round(n));
  const len = b - a;
  const clear = len - (n - 1) * beam;
  let sizes = Array(n).fill(clear / n) as number[];
  let warn: string | undefined;
  if (layout === 'bigCenter' && n >= 3) {
    const inner = (clear - 2 * outer) / (n - 2);
    if (inner <= outer) warn = `Perimeter coffers of ${fmt(outer)} leave the middle ones ${fmt(Math.max(0, inner))}, no bigger; they're shown even instead.`;
    else sizes = sizes.map((_, i) => (i === 0 || i === n - 1 ? outer : inner));
  }
  if (clear / n < 6) warn = 'The coffers come out smaller than 6"; use fewer, or narrower beams.';
  // Cut to the sixteenth; whatever's left over goes to the middle coffer
  sizes = sizes.map((v) => Math.floor(v * 16) / 16);
  sizes[Math.floor((n - 1) / 2)] += clear - sizes.reduce((t, v) => t + v, 0);
  const open: Span[] = [], beams: Span[] = [];
  let x = a;
  sizes.forEach((s, i) => {
    open.push({ a: x, b: x + s });
    x += s;
    if (i < n - 1) { beams.push({ a: x, b: x + beam }); x += beam; }
  });
  return { open, beams, warn };
}

export function cofferLayout(p: Project, c = cofferOf(p)): CofferLayout {
  const { width: W, depth: D } = p.room;
  const P = c.perimeter ? c.perimeterWidth : 0;
  const field = { x0: P, x1: W - P, z0: P, z1: D - P };
  const sx = split(field.x0, field.x1, c.across, c.beamWidth, c.layout, c.outer);
  const sz = split(field.z0, field.z1, c.deep, c.beamWidth, c.layout, c.outer);
  return { xs: sx.open, zs: sz.open, beamsX: sx.beams, beamsZ: sz.beams, field, warnings: [sx.warn, sz.warn].filter((w): w is string => !!w) };
}

const vb = (x: number, y: number, z: number, sx: number, sy: number, sz: number): VisualBox => ({ min: [x, y, z], size: [sx, sy, sz] });

/**
 * Every piece of the ceiling, with its place in the room. Beams one way run through between the
 * perimeter fascias (or walls); beams the other way are cut to fit between them.
 */
export function cofferParts(p: Project, c = cofferOf(p)): Part[] {
  if (!c.on) return [];
  const H = p.room.height;
  const L = cofferLayout(p, c);
  const out: Part[] = [];
  const t = c.fascia, yBot = H - c.drop;
  const soffitW = c.beamWidth - 2 * t + 2 * c.tongueDepth;
  const dadoNote = `${fmt(c.tongue)} × ${fmt(c.tongueDepth)} dado, ${fmt(c.reveal)} up from the bottom edge, for the soffit tongue`;
  const soffitNote = `${fmt(c.tongue)} tongue on the bottom face, ${fmt(c.tongueDepth)} long, both edges; sits ${fmt(c.reveal)} above the fascia bottom`;
  const sp = c.species;
  /** A beam over [a, b] across its width, running from r0 to r1 the other way; along = which axis it runs on. */
  const beam = (a: number, b: number, r0: number, r1: number, along: 'x' | 'z', label: string) => {
    const len = r1 - r0;
    if (len <= 0.1) return;
    const box = (w0: number, w: number, y: number, h: number) => (along === 'z' ? vb(w0, y, r0, w, h, len) : vb(r0, y, w0, len, h, w));
    out.push({ name: `${label} nailer (2x)`, role: 'nailer', material: 'faceframe', species: '2x framing', length: len, width: b - a - 2 * t, thickness: c.nailer, cut: true, note: 'Ripped from 2x stock; fastened to the ceiling framing', boxes: [box(a + t, b - a - 2 * t, H - c.nailer, c.nailer)] });
    for (const w0 of [a, b - t]) out.push({ name: `${label} fascia`, role: 'trim', material: 'faceframe', species: sp, length: len, width: c.drop, thickness: t, cut: true, note: dadoNote, boxes: [box(w0, t, yBot, c.drop)] });
    out.push({ name: `${label} soffit`, role: 'trim', material: 'faceframe', species: sp, length: len, width: soffitW, thickness: c.soffit, cut: true, note: soffitNote, boxes: [box(a + t, b - a - 2 * t, yBot + c.reveal, c.soffit)] });
  };
  const { field: f } = L;
  // Through beams first, wall to wall inside the perimeter; then the cross pieces between them
  if (c.through === 'across') {
    for (const bz of L.beamsZ) beam(bz.a, bz.b, f.x0, f.x1, 'x', 'Through beam');
    for (const bx of L.beamsX) for (const z of L.zs) beam(bx.a, bx.b, z.a, z.b, 'z', 'Cross beam');
  } else {
    for (const bx of L.beamsX) beam(bx.a, bx.b, f.z0, f.z1, 'z', 'Through beam');
    for (const bz of L.beamsZ) for (const x of L.xs) beam(bz.a, bz.b, x.a, x.b, 'x', 'Cross beam');
  }
  if (c.perimeter) {
    const { width: W, depth: D } = p.room;
    const P = c.perimeterWidth;
    const ps = P - t + c.tongueDepth;
    const runs: { name: string; along: 'x' | 'z'; at: number; r0: number; r1: number; wallSide: -1 | 1 }[] = [
      { name: 'Perimeter, back', along: 'x', at: P - t, r0: P - t, r1: W - P + t, wallSide: -1 },
      { name: 'Perimeter, front', along: 'x', at: D - P, r0: P - t, r1: W - P + t, wallSide: 1 },
      { name: 'Perimeter, left', along: 'z', at: P - t, r0: P, r1: D - P, wallSide: -1 },
      { name: 'Perimeter, right', along: 'z', at: W - P, r0: P, r1: D - P, wallSide: 1 },
    ];
    for (const r of runs) {
      const len = r.r1 - r.r0;
      const box = (w0: number, w: number, y: number, h: number) => (r.along === 'z' ? vb(w0, y, r.r0, w, h, len) : vb(r.r0, y, w0, len, h, w));
      const wall0 = r.wallSide < 0 ? 0 : r.at + t;
      const nailW = P - t;
      out.push({ name: `${r.name} nailer (2x)`, role: 'nailer', material: 'faceframe', species: '2x framing', length: len, width: nailW, thickness: c.nailer, cut: true, note: 'Ripped from 2x stock; against the wall', boxes: [box(wall0, nailW, H - c.nailer, c.nailer)] });
      out.push({ name: `${r.name} fascia`, role: 'trim', material: 'faceframe', species: sp, length: len, width: c.drop, thickness: t, cut: true, note: dadoNote, boxes: [box(r.at, t, yBot, c.drop)] });
      out.push({ name: `${r.name} soffit`, role: 'trim', material: 'faceframe', species: sp, length: len, width: ps, thickness: c.soffit, cut: true, note: `${fmt(c.tongue)} tongue on the bottom face at the fascia edge; scribed to the wall`, boxes: [box(wall0, nailW, yBot + c.reveal, c.soffit)] });
    }
  }
  return out;
}

/** Every coffer opening, and which of its four sides are fascia (the rest are wall). */
export function coffers(p: Project, c = cofferOf(p)) {
  const L = cofferLayout(p, c);
  return L.xs.flatMap((x, i) => L.zs.map((z, j) => ({
    x0: x.a, x1: x.b, z0: z.a, z1: z.b,
    sides: {
      back: c.perimeter || j > 0, front: c.perimeter || j < L.zs.length - 1,
      left: c.perimeter || i > 0, right: c.perimeter || i < L.xs.length - 1,
    },
  })));
}

/** Lineal inches of crown (around every coffer), bead (on fascia bottom edges) and picture moulding, and the field area. */
export function cofferMoldings(p: Project, c = cofferOf(p)) {
  if (!c.on) return { crown: 0, bead: 0, picture: 0, fieldSqFt: 0, count: 0 };
  const list = coffers(p, c);
  const crown = list.reduce((t, k) => t + 2 * (k.x1 - k.x0) + 2 * (k.z1 - k.z0), 0);
  const bead = list.reduce((t, k) => t + (k.sides.back ? k.x1 - k.x0 : 0) + (k.sides.front ? k.x1 - k.x0 : 0) + (k.sides.left ? k.z1 - k.z0 : 0) + (k.sides.right ? k.z1 - k.z0 : 0), 0);
  const { width: W, depth: D } = p.room;
  const picture = c.perimeter ? 2 * (W + D) : 0;
  const fieldSqFt = list.reduce((t, k) => t + ((k.x1 - k.x0) * (k.z1 - k.z0)) / 144, 0);
  return { crown, bead, picture, fieldSqFt, count: list.length };
}

/** Beam length for labor: through beams, cross pieces and the perimeter, in feet. */
export function cofferFeet(p: Project, c = cofferOf(p)) {
  const parts = cofferParts(p, c).filter((x) => x.name.endsWith('soffit'));
  const beams = parts.filter((x) => !x.name.startsWith('Perimeter')).reduce((t, x) => t + x.length, 0) / 12;
  const perimeter = parts.filter((x) => x.name.startsWith('Perimeter')).reduce((t, x) => t + x.length, 0) / 12;
  return { beams, perimeter };
}
