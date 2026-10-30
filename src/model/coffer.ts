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
import { footprint, wallLength } from './layout';
import { defaultPilaster } from './pilaster';
import { mantelOf, upperTop } from './mantel';

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
  /**
   * The perimeter soffit's underside built as stile-and-rail panels on a wall (a deep soffit along a
   * fireplace wall, say) instead of a flat board: frame width, rail width, and the panel length aimed for.
   */
  panels?: Partial<Record<WallId, SoffitPanels>>;
  /** Which beams run through; the others are cut between them. */
  through: 'across' | 'deep';
  crown?: string;
  bead?: string;
  picture?: string;
  beadboard: boolean;
  species: string;
}

export interface SoffitPanels { stile: number; rail: number; size: number }
export const defaultSoffitPanels: SoffitPanels = { stile: 2.5, rail: 2.5, size: 24 };

export const defaultCoffer: CofferCeiling = {
  on: false, across: 3, deep: 3, layout: 'even', outer: 24,
  beamWidth: 5.5, drop: 5.5, fascia: 0.75, soffit: 0.75, tongue: 0.25, tongueDepth: 0.25, reveal: 0.25, nailer: 1.5, joint: 'tongue', blocking: 16,
  perimeter: true, perimeterWidth: 4, through: 'across', beadboard: false, species: 'Poplar',
};
export const cofferOf = (p: Project): CofferCeiling => ({ ...defaultCoffer, ...p.ceiling });

/** Wall to the perimeter fascia face on one wall. */
export const perimOf = (c: CofferCeiling, wall: WallId) => (c.perimeter ? c.walls?.[wall] ?? c.perimeterWidth : 0);
export const opposite: Record<WallId, WallId> = { back: 'front', front: 'back', left: 'right', right: 'left' };

/** Full-height cabinets on a wall: tops within a foot of the beam bottoms. */
/** Mantels on a wall whose faux chimney runs full height, up to the given height or near it. */
export const chimneysOn = (p: Project, wall: WallId, under: number) => p.cabinets.filter((k) => {
  if (k.wall !== wall || k.kind !== 'mantel') return false;
  const m = mantelOf(k);
  return m.chimney && m.upper.on && k.elevation + upperTop(k, m) >= under - 6;
});

/** Panels in one run of soffit underside: as many as come out nearest the length aimed for. */
export function soffitPanelLayout(pan: SoffitPanels, len: number, width: number) {
  const n = Math.max(1, Math.round((len - pan.stile) / (pan.size + pan.stile)));
  return { n, w: (len - (n + 1) * pan.stile) / n, d: width - 2 * pan.rail };
}

/**
 * A run of soffit underside built as a frame and panels: rails the length of the run (the one at the
 * fascia carries the tongue), stiles between them at each end and between panels, and 1/4" MDF panels
 * let into a rabbet from the top. at(w0, w, y, h, a0, l) places a box: w0 out from the wall, a0 along the run.
 */
function soffitPanelParts(run: string, pan: SoffitPanels, len: number, width: number, t: number, sp: string, edge: string, tail: string,
  at: (w0: number, w: number, y: number, h: number, a0: number, l: number) => VisualBox, y: number): Part[] {
  const L = soffitPanelLayout(pan, len, width);
  const rb = defaultPilaster.rabbet;
  const out: Part[] = [];
  if (L.w < 1 || L.d < 1) {
    return [{ name: `${run} soffit`, role: 'trim', material: 'faceframe', species: sp, length: len, width, thickness: t, cut: true, note: `Too small for panels; a flat board. ${edge}` + tail, boxes: [at(0, width, y, t, 0, len)] }];
  }
  out.push({ name: `${run} soffit rail`, role: 'rail', material: 'faceframe', species: sp, length: len, width: pan.rail, thickness: t, cut: true, note: `At the wall; scribed to it` + tail, boxes: [at(0, pan.rail, y, t, 0, len)] });
  out.push({ name: `${run} soffit rail`, role: 'rail', material: 'faceframe', species: sp, length: len, width: pan.rail, thickness: t, cut: true, note: `At the fascia; ${edge}` + tail, boxes: [at(width - pan.rail, pan.rail, y, t, 0, len)] });
  for (let i = 0; i <= L.n; i++) {
    out.push({ name: `${run} soffit stile`, role: 'stile', material: 'faceframe', species: sp, length: L.d, width: pan.stile, thickness: t, cut: true,
      note: (i === 0 || i === L.n ? 'End' : 'Between panels') + '; between the rails', boxes: [at(pan.rail, L.d, y, t, i * (pan.stile + L.w), pan.stile)] });
  }
  for (let i = 0; i < L.n; i++) {
    out.push({ name: `${run} soffit panel`, role: 'back', material: 'back', look: 'paint', sheet: '1/4" MDF', length: L.w + 2 * rb - 0.0625, width: L.d + 2 * rb - 0.0625, thickness: 0.25, cut: true,
      note: `${i + 1} of ${L.n}; set into a ${fmt(rb)} rabbet from the top`, boxes: [at(pan.rail, L.d, y + 0.1875, 0.25, pan.stile + i * (pan.stile + L.w), L.w)] });
  }
  return out;
}

const fullHeight = (p: Project, wall: WallId, c: CofferCeiling) => p.cabinets.filter((k) => k.wall === wall && k.kind !== 'shelf' && k.elevation + k.height >= p.room.height - c.drop - 12);

/** How tall the picture moulding under the perimeter fascia is (0 without one). */
export const pictureHeight = (c: CofferCeiling) => (c.perimeter && c.picture ? moldHeight(c.picture) : 0);

/** The underside of the perimeter: fascia, then picture moulding below it. */
export const perimeterBottom = (p: Project, c = cofferOf(p)) => p.room.height - fasciaHeight(c) - pictureHeight(c);

/**
 * The drop that brings the fascia and its picture moulding down to the top of the full-height
 * cabinets and pilasters, so the picture moulding runs across their fronts sitting right on top
 * of them. One drop serves every beam and the perimeter. Null without full-height casework.
 */
export function fittedDrop(p: Project, c = cofferOf(p)): number | null {
  const tops = p.cabinets.filter((k) => !k.island && k.kind !== 'shelf' && k.kind !== 'mantel' && k.kind !== 'base' && k.elevation + k.height >= p.room.height - c.drop - 12 && perimOf(c, k.wall) > 0).map((k) => k.elevation + k.height);
  if (!tops.length) return null;
  const top = Math.max(...tops);
  const bead = c.joint === 'bead' ? beadCorner(c) : 0;
  const drop = p.room.height - top - pictureHeight(c) + bead;
  return drop > 0.5 ? Math.round(drop * 16) / 16 : null;
}

/** Over bookcases: the 2x nailer the fascia's top is fastened to (a 2x4 on the flat), and how far the top rail runs up past the fascia's bottom edge. */
export const OVER_NAILER = 3.5;
export const RAIL_LAP = 1;

const leftOf: Record<WallId, WallId> = { back: 'left', left: 'front', front: 'right', right: 'back' };
const rightOf: Record<WallId, WallId> = { back: 'right', right: 'front', front: 'left', left: 'back' };

/**
 * Where picture moulding runs under the perimeter fascia, along each wall (from its left end):
 * corner to corner, except where full-height cabinets come up under the fascia and their own crown
 * takes over. Each run says whether its ends meet a room corner (an inside miter) or a cabinet.
 */
export function pictureRuns(p: Project, c = cofferOf(p)): { wall: WallId; a: number; b: number; corner: [boolean, boolean] }[] {
  if (!c.on || !c.perimeter || !c.picture) return [];
  const out: { wall: WallId; a: number; b: number; corner: [boolean, boolean] }[] = [];
  for (const wall of ['back', 'right', 'front', 'left'] as WallId[]) {
    const len = wallLength(p.room, wall);
    const a0 = perimOf(c, leftOf[wall]), b0 = len - perimOf(c, rightOf[wall]);
    // Cabinets that stop at (or below) the picture moulding's bottom carry it across their tops; only ones rising into it break it
    const under = perimeterBottom(p, c);
    const covered = fullHeight(p, wall, c).filter((k) => k.elevation + k.height > under + 0.125).map((k) => [k.offset, k.offset + k.width] as [number, number]).sort((x, y) => x[0] - y[0]);
    let at = a0, fromCorner = true;
    for (const [a, b] of covered) {
      if (b <= at || a >= b0) continue;
      if (a > at + 0.5) out.push({ wall, a: at, b: a, corner: [fromCorner, false] });
      at = Math.max(at, b); fromCorner = false;
    }
    if (b0 > at + 0.5) out.push({ wall, a: at, b: b0, corner: [fromCorner, true] });
  }
  return out;
}

/**
 * A cabinet that runs up under the coffer's perimeter fascia: the fascia laps its top rail and the
 * ceiling crown goes on the fascia, so the cabinet takes no crown of its own.
 */
export function underFascia(p: Project, k: Project['cabinets'][number], c = cofferOf(p)): boolean {
  // A pilaster keeps its capital's crown: that's part of its design, not the run's ceiling crown
  if (!c.on || !c.perimeter || k.island || k.kind === 'base' || k.kind === 'shelf' || k.kind === 'mantel' || k.kind === 'pilaster') return false;
  const P = perimOf(c, k.wall);
  // Up to the fascia, or to the picture moulding under it
  return P > 0 && k.elevation + k.height >= perimeterBottom(p, c) - 0.5 && (k.wallInset ?? 0) + k.depth <= P + 0.01;
}

/**
 * Where the perimeter fascia goes over full-height cabinets on a wall: proud of the deepest face
 * frame by the fascia's own thickness, so its back laps the cabinets' extended top rail. Null if
 * there are no full-height cabinets on that wall.
 */
export function cabinetLine(p: Project, wall: WallId, c = cofferOf(p)): number | null {
  // The fascia goes tight against the bookcases' extended top rail; pilasters stop below the fascia
  // (under the picture moulding), so their faces don't push it out. Pilasters alone set it only with no bookcases.
  const full = fullHeight(p, wall, c);
  const cases = full.filter((k) => k.kind !== 'pilaster');
  const d = (cases.length ? cases : full).map((k) => (k.wallInset ?? 0) + k.depth);
  return d.length ? Math.max(...d) + c.fascia : null;
}

/**
 * A full-height cabinet under a perimeter fascia lined up with it: its top rail backs the fascia.
 * lap is how much of the rail is behind the fascia; short is how far the cabinet top falls below
 * the fascia bottom (extend the top rail that much, and a little more to fasten to).
 */
export function fasciaBacking(p: Project, cab: Project['cabinets'][number], c = cofferOf(p)): { lap: number; short: number } | null {
  if (!c.on || !c.perimeter) return null;
  const line = cabinetLine(p, cab.wall, c);
  if (line == null || Math.abs(perimOf(c, cab.wall) - line) > 0.01 || !fullHeight(p, cab.wall, c).includes(cab)) return null;
  const fasciaBottom = p.room.height - fasciaHeight(c);
  const top = cab.elevation + cab.height;
  return { lap: Math.max(0, top - fasciaBottom), short: Math.max(0, fasciaBottom - top) };
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
  for (const k of p.cabinets) {
    const fb = fasciaBacking(p, k, c);
    if (fb && fb.short > 0.01) warnings.push(`${k.name}'s top is ${fmt(fb.short)} below the perimeter fascia; extend its top rail up behind the fascia to back it.`);
  }
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
      const len = r.r1 - r.r0;
      const box = (w0: number, w: number, y: number, h: number, a = r.r0, l = len) => (r.along === 'z' ? vb(w0, y, a, w, h, l) : vb(a, y, w0, l, h, w));
      const wall0 = r.wallSide < 0 ? 0 : r.at + t;
      const nailW = r.P - t;
      const ps = nailW + tongueW;
      const wallId = r.name.split(', ')[1] as WallId;
      // Over the bookcases when the fascia sits on their line, give or take an inch (it's applied to their extended top rail)
      const backed = cabinetLine(p, wallId, c) != null && Math.abs(cabinetLine(p, wallId, c)! - r.P) <= 1;
      const sized = (r.P !== c.perimeterWidth ? ` (${fmt(r.P)} wall to fascia face)` : '') + (backed ? `; over the cabinets, proud of the face frame by ${fmt(t)} and fastened to their extended top rail` : '');
      out.push({ name: `${r.name} fascia`, role: 'trim', material: 'faceframe', species: sp, length: len, width: fh, thickness: t, cut: true, note: r.P > t + 0.01 ? dadoNote + sized : 'Fastened directly to the wall; no soffit' + (backed ? '; over the cabinets' : ''), boxes: [box(r.at, t, fy, fh)] });
      // Over full-height cabinets the cabinet top closes it off: no soffit, nailer or blocking there
      const span = (k: Project['cabinets'][number], pad = 0) => { const f = footprint(p.room, k); return (r.along === 'x' ? [f.x0 - pad, f.x1 + pad] : [f.z0 - pad, f.z1 + pad]) as [number, number]; };
      // A full-height faux chimney runs up to the soffit and closes it off too (its sides are 3/4" MDF outside the mantel)
      const chimneys = chimneysOn(p, wallId, H - c.drop).map((k) => span(k, 0.75));
      const covered = [...(backed ? fullHeight(p, wallId, c).map((k) => span(k)) : []), ...chimneys].sort((a, b) => a[0] - b[0]);
      const segs: [number, number][] = [];
      let at = r.s0;
      for (const [a, b] of covered) { if (a > at + 0.5) segs.push([at, Math.min(a, r.s1)]); at = Math.max(at, b); }
      if (r.s1 > at + 0.5) segs.push([at, r.s1]);
      // Over the bookcases: no soffit, but the fascia's top still needs a 2x nailer on the ceiling behind it
      // (its bottom laps the bookcases' top rail, run up about 1" past the fascia's bottom edge)
      if (backed) for (const k of fullHeight(p, wallId, c)) {
        const [a, b] = span(k);
        const lo = Math.max(a, r.s0), hi = Math.min(b, r.s1);
        if (hi - lo < 0.5) continue;
        out.push({ name: `${r.name} nailer over the cabinets (2x)`, role: 'nailer', material: 'faceframe', species: '2x framing', length: hi - lo, width: OVER_NAILER, thickness: c.nailer, cut: true,
          note: `On the ceiling behind the fascia, over ${k.name}; the fascia's bottom laps the top rail`, boxes: [box(r.wallSide < 0 ? r.at - OVER_NAILER : r.at + t, OVER_NAILER, H - c.nailer, c.nailer, lo, hi - lo)] });
      }
      const beside = chimneys.length && !backed ? 'the chimney' : chimneys.length ? 'the cabinets and chimney' : 'the cabinets';
      const part = segs.length > 1 || covered.length ? (k: number) => ` (${k + 1} of ${segs.length}, beside ${beside})` : () => '';
      // A fascia set right against the wall has no soffit behind it
      (r.P > t + 0.01 ? segs : []).forEach(([a, b], k) => {
        const slen = b - a;
        out.push({ name: `${r.name} nailer (2x)`, role: 'nailer', material: 'faceframe', species: '2x framing', length: slen, width: nailW, thickness: c.nailer, cut: true, note: 'Ripped from 2x stock; against the wall' + part(k), boxes: [box(wall0, nailW, H - c.nailer, c.nailer, a, slen)] });
        const edge = bead ? `hangs ${fmt(g)} below the fascia on the blocking, ${beadName} bead in the corner` : `${fmt(c.tongue)} tongue on the bottom face at the fascia edge`;
        const pan = c.panels?.[wallId];
        if (pan) out.push(...soffitPanelParts(r.name, pan, slen, ps, c.soffit, sp, edge, sized + part(k), (w0, w, y, h, a0, l) => box(r.wallSide < 0 ? wall0 + w0 : wall0 + nailW - w0 - w, w, y, h, a + a0, l), soffitY));
        else out.push({ name: `${r.name} soffit`, role: 'trim', material: 'faceframe', species: sp, length: slen, width: ps, thickness: c.soffit, cut: true, note: (bead ? `Wall to the fascia; ${edge}; scribed to the wall` : `${edge}; scribed to the wall`) + sized + part(k), boxes: [box(wall0, nailW, soffitY, c.soffit, a, slen)] });
        blocks(r.name, slen, nailW, (u) => (r.along === 'z' ? vb(wall0, soffitY + c.soffit, a + u, nailW, blockH, 1.5) : vb(a + u, soffitY + c.soffit, wall0, 1.5, blockH, nailW)));
      });
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
  // Beams by their soffits (one per beam); the perimeter by its fascias, which run even where cabinets close it off
  const all = cofferParts(p, c);
  const beams = all.filter((x) => x.name.endsWith('soffit') && !x.name.startsWith('Perimeter')).reduce((t, x) => t + x.length, 0) / 12;
  const perimeter = all.filter((x) => x.name.endsWith('fascia') && x.name.startsWith('Perimeter')).reduce((t, x) => t + x.length, 0) / 12;
  return { beams, perimeter };
}
