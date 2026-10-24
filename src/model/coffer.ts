// Coffered ceilings, built the way CJC builds them: a 2x nailer on the ceiling ripped to fit
// between the fascias, poplar fascias with a dado, and a soffit whose 1/4" tongue is on its
// bottom face (so if it ever creeps out of the groove it doesn't open a gap), sitting a reveal
// above the bottom edge of the fascias. With a corner bead (A&M #9554) the soffit instead hangs
// below the fascias on internal blocking, leaving a square corner the bead fills. An optional
// perimeter fascia runs around the room. Every coffer gets crown; beadboard is an option.
// Everything is in room coordinates: x along the back wall, z out from it, y up from the floor.
import type { Part, Project, VisualBox, WallId } from './types';
import { fmt } from '../units';
import { mountShape, profileByNum } from './moldings';

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
  /**
   * How fascia meets soffit. tongue: the soffit's tongue in a dado, a reveal above the fascia
   * bottom. bead: the soffit hangs below the fascias, cut to fit between them and fastened to
   * blocking, with a corner bead filling the square corner on each side.
   */
  joint: 'tongue' | 'bead';
  /** 2x blocking spacing inside beaded beams. */
  blocking: number;
  /** A fascia around the room, this far off the wall to its face. */
  perimeter: boolean;
  perimeterWidth: number;
  /**
   * A different wall-to-fascia-face on one wall, e.g. brought out over full-height bookcases, and
   * the same on the opposite wall so the coffers stay centered on that wall's windows.
   */
  walls?: Partial<Record<WallId, number>>;
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
  beamWidth: 5.5, drop: 5.5, fascia: 0.75, soffit: 0.75, tongue: 0.25, tongueDepth: 0.25, reveal: 0.25, nailer: 1.5, joint: 'tongue', blocking: 16,
  perimeter: true, perimeterWidth: 4, through: 'across', beadboard: false, species: 'Poplar',
};
export const cofferOf = (p: Project): CofferCeiling => ({ ...defaultCoffer, ...p.ceiling });

/** Wall to the perimeter fascia face on one wall. */
export const perimOf = (c: CofferCeiling, wall: WallId) => (c.perimeter ? c.walls?.[wall] ?? c.perimeterWidth : 0);
export const opposite: Record<WallId, WallId> = { back: 'front', front: 'back', left: 'right', right: 'left' };

/**
 * Where the perimeter fascia lines up with the face frames of full-height cabinets on a wall
 * (tops within a foot of the beam bottoms): the deepest one's front, or null if there are none.
 */
export function cabinetLine(p: Project, wall: WallId, c = cofferOf(p)): number | null {
  const top = p.room.height - c.drop - 12;
  const d = p.cabinets.filter((k) => k.wall === wall && k.kind !== 'shelf' && k.elevation + k.height >= top).map((k) => k.depth);
  return d.length ? Math.max(...d) : null;
}

/** The square corner left for the bead, beside the soffit and under the fascia: the bead's own size. */
export function beadCorner(c: CofferCeiling): number {
  const b = profileByNum(c.bead);
  return b ? Math.max(b.t, b.w) : 0.75;
}
/** Bead profiles that fill a square corner (drawn square, like A&M #9554): picking one switches the joint to bead. */
export const isCornerBead = (num?: string) => { const b = profileByNum(num); return !!b && Math.abs(b.t - b.w) < 0.02 && b.t <= 1.25; };

/** How tall the fascia face is inside a coffer, ceiling down to its bottom edge. */
export const fasciaHeight = (c: CofferCeiling) => (c.joint === 'bead' ? c.drop - beadCorner(c) : c.drop);
/** Crown in a coffer shouldn't be more than half the fascia's height. */
export const crownLimit = (c: CofferCeiling) => fasciaHeight(c) / 2;
export const moldHeight = (num?: string) => { const m = profileByNum(num); return m ? mountShape(m).height : 0; };

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
  const field = { x0: perimOf(c, 'left'), x1: W - perimOf(c, 'right'), z0: perimOf(c, 'back'), z1: D - perimOf(c, 'front') };
  const sx = split(field.x0, field.x1, c.across, c.beamWidth, c.layout, c.outer);
  const sz = split(field.z0, field.z1, c.deep, c.beamWidth, c.layout, c.outer);
  const warnings = [sx.warn, sz.warn].filter((w): w is string => !!w);
  const ch = moldHeight(c.crown);
  if (ch > crownLimit(c) + 0.01) warnings.push(`The crown is ${fmt(ch)} tall, more than half the ${fmt(fasciaHeight(c))} fascia; pick one ${fmt(crownLimit(c))} or less, or drop the beams more.`);
  if (c.joint === 'bead' && c.soffit < beadCorner(c) - 0.01) warnings.push(`The soffit is thinner than the ${fmt(beadCorner(c))} bead corner, so its edge won't close the corner; use ${fmt(beadCorner(c))} stock.`);
  return { xs: sx.open, zs: sz.open, beamsX: sx.beams, beamsZ: sz.beams, field, warnings };
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
  const bead = c.joint === 'bead';
  const g = bead ? beadCorner(c) : 0;
  // Fascia bottom; with a bead the soffit hangs this far below it
  const fy = yBot + g, fh = c.drop - g;
  const soffitY = bead ? yBot : yBot + c.reveal;
  const tongueW = bead ? 0 : c.tongueDepth;
  const soffitW = c.beamWidth - 2 * t + 2 * tongueW;
  const beadName = profileByNum(c.bead) ? `#${c.bead}` : 'the';
  const dadoNote = bead ? 'No dado; fastened to the nailer and blocking' : `${fmt(c.tongue)} × ${fmt(c.tongueDepth)} dado, ${fmt(c.reveal)} up from the bottom edge, for the soffit tongue`;
  const soffitNote = bead
    ? `Fits between the fascias; hangs ${fmt(g)} below them on the blocking, leaving a ${fmt(g)} × ${fmt(g)} corner each side for ${beadName} bead`
    : `${fmt(c.tongue)} tongue on the bottom face, ${fmt(c.tongueDepth)} long, both edges; sits ${fmt(c.reveal)} above the fascia bottom`;
  const blockH = H - c.nailer - (soffitY + c.soffit);
  /** 2x blocks across the inside of a beaded beam, holding the fascias and the soffit. */
  const blocks = (label: string, len: number, width: number, at: (along: number) => VisualBox) => {
    if (!bead || blockH <= 0.25 || width <= 0.25) return;
    const n = Math.max(2, Math.ceil(len / c.blocking) + 1);
    for (let i = 0; i < n; i++) {
      const along = Math.min(len - 1.5, Math.max(0, (i * (len - 1.5)) / (n - 1)));
      out.push({ name: `${label} blocking (2x)`, role: 'nailer', material: 'faceframe', species: '2x framing', length: width, width: blockH, thickness: 1.5, cut: true, note: `Ripped from 2x; about ${fmt(c.blocking)} apart, fascias and soffit fastened to it`, boxes: [at(along)] });
    }
  };
  const sp = c.species;
  /** A beam over [a, b] across its width, running from r0 to r1 the other way; along = which axis it runs on. */
  const beam = (a: number, b: number, r0: number, r1: number, along: 'x' | 'z', label: string) => {
    const len = r1 - r0;
    if (len <= 0.1) return;
    const box = (w0: number, w: number, y: number, h: number) => (along === 'z' ? vb(w0, y, r0, w, h, len) : vb(r0, y, w0, len, h, w));
    out.push({ name: `${label} nailer (2x)`, role: 'nailer', material: 'faceframe', species: '2x framing', length: len, width: b - a - 2 * t, thickness: c.nailer, cut: true, note: 'Ripped from 2x stock; fastened to the ceiling framing', boxes: [box(a + t, b - a - 2 * t, H - c.nailer, c.nailer)] });
    for (const w0 of [a, b - t]) out.push({ name: `${label} fascia`, role: 'trim', material: 'faceframe', species: sp, length: len, width: fh, thickness: t, cut: true, note: dadoNote, boxes: [box(w0, t, fy, fh)] });
    out.push({ name: `${label} soffit`, role: 'trim', material: 'faceframe', species: sp, length: len, width: soffitW, thickness: c.soffit, cut: true, note: soffitNote, boxes: [box(a + t, b - a - 2 * t, soffitY, c.soffit)] });
    blocks(label, len, b - a - 2 * t, (u) => (along === 'z' ? vb(a + t, soffitY + c.soffit, r0 + u, b - a - 2 * t, blockH, 1.5) : vb(r0 + u, soffitY + c.soffit, a + t, 1.5, blockH, b - a - 2 * t)));
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
    const Pb = perimOf(c, 'back'), Pf = perimOf(c, 'front'), Pl = perimOf(c, 'left'), Pr = perimOf(c, 'right');
    // Back and front soffits run wall to wall; the side ones fit between them. Fascias meet at the corners.
    const runs: { name: string; along: 'x' | 'z'; P: number; at: number; r0: number; r1: number; s0: number; s1: number; wallSide: -1 | 1 }[] = [
      { name: 'Perimeter, back', along: 'x', P: Pb, at: Pb - t, r0: Pl - t, r1: W - Pr + t, s0: 0, s1: W, wallSide: -1 },
      { name: 'Perimeter, front', along: 'x', P: Pf, at: D - Pf, r0: Pl - t, r1: W - Pr + t, s0: 0, s1: W, wallSide: 1 },
      { name: 'Perimeter, left', along: 'z', P: Pl, at: Pl - t, r0: Pb, r1: D - Pf, s0: Pb - t, s1: D - Pf + t, wallSide: -1 },
      { name: 'Perimeter, right', along: 'z', P: Pr, at: W - Pr, r0: Pb, r1: D - Pf, s0: Pb - t, s1: D - Pf + t, wallSide: 1 },
    ];
    for (const r of runs) {
      const len = r.r1 - r.r0, slen = r.s1 - r.s0;
      const box = (w0: number, w: number, y: number, h: number, a = r.r0, l = len) => (r.along === 'z' ? vb(w0, y, a, w, h, l) : vb(a, y, w0, l, h, w));
      const wall0 = r.wallSide < 0 ? 0 : r.at + t;
      const nailW = r.P - t;
      const ps = nailW + tongueW;
      const sized = r.P !== c.perimeterWidth ? ` (${fmt(r.P)} wall to fascia face)` : '';
      out.push({ name: `${r.name} nailer (2x)`, role: 'nailer', material: 'faceframe', species: '2x framing', length: slen, width: nailW, thickness: c.nailer, cut: true, note: 'Ripped from 2x stock; against the wall', boxes: [box(wall0, nailW, H - c.nailer, c.nailer, r.s0, slen)] });
      out.push({ name: `${r.name} fascia`, role: 'trim', material: 'faceframe', species: sp, length: len, width: fh, thickness: t, cut: true, note: dadoNote + sized, boxes: [box(r.at, t, fy, fh)] });
      out.push({ name: `${r.name} soffit`, role: 'trim', material: 'faceframe', species: sp, length: slen, width: ps, thickness: c.soffit, cut: true, note: (bead ? `Wall to the fascia; hangs ${fmt(g)} below it on the blocking, ${beadName} bead in the corner; scribed to the wall` : `${fmt(c.tongue)} tongue on the bottom face at the fascia edge; scribed to the wall`) + sized, boxes: [box(wall0, nailW, soffitY, c.soffit, r.s0, slen)] });
      blocks(r.name, slen, nailW, (u) => (r.along === 'z' ? vb(wall0, soffitY + c.soffit, r.s0 + u, nailW, blockH, 1.5) : vb(r.s0 + u, soffitY + c.soffit, wall0, 1.5, blockH, nailW)));
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
