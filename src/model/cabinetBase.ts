// What a floor-standing cabinet sits on: the usual recessed toe kick, a baseboard wrapped around
// the face frame and exposed ends, or a decorative skirt with an arch or bracket feet cut into it.
// Whatever the base, the cabinet keeps its height and a full bottom rail shows above the base;
// the openings get shorter to make room.
import type { Cabinet, CabinetBase, CutShape, ShopSettings } from './types';
import { mountShape, profileByNum } from './moldings';

export const defaultBase: CabinetBase = { style: 'kick', height: 4.5, build: 'faceframe', shape: 'bracket', rise: 3, foot: 2.25 };
export const baseOf = (c: Cabinet): CabinetBase => ({ ...defaultBase, ...c.base });

/** Cabinets that stand on the floor and can take a baseboard or decorative base. */
export const floorStanding = (c: Cabinet) => (c.kind === 'base' || c.kind === 'tall') && !c.corner && c.elevation < 0.5;

export const baseStyles = { kick: 'Toe kick', baseboard: 'Baseboard wrap', arch: 'Decorative' } as const;
export const archShapes = { bracket: 'Bracket feet', arch: 'Arch', straight: 'Straight feet' } as const;
export const archBuilds = { faceframe: 'Shaped face frame', applied: 'Applied skirt' } as const;

/** Thickness of applied baseboard and skirt stock. */
export const boardT = 0.75;

export interface BaseLayout {
  style: CabinetBase['style'];
  /** Height of the recessed toe kick behind the base (0 for none). */
  kick: number;
  /** Where the face frame stiles start off the floor. */
  stileY: number;
  /** Bottom rail: where it starts and how wide it is. The openings start above it. */
  railY: number;
  railW: number;
  /** Top of the flat board or skirt, where a base cap sits. */
  flat: number;
  /** Top of the whole base treatment, cap included. A full bottom rail shows above this. */
  top: number;
  /** Height cut out of the skirt or rail (decorative base). */
  rise: number;
  /** Applied board in front of the face frame, and how far it stands out. */
  applied: boolean;
  out: number;
  b: CabinetBase;
}

export function baseLayout(c: Cabinet, s: ShopSettings): BaseLayout {
  const R = s.bottomRailWidth;
  const b = baseOf(c);
  if (!floorStanding(c) || b.style === 'kick') {
    const k = c.kind === 'wall' || c.kind === 'shelf' || c.kind === 'pilaster' || c.kind === 'mantel' ? 0 : s.toeKickHeight;
    // A bookcase standing on a countertop has no case bottom, and by default no bottom rail either
    const rail = c.kind !== 'base' && c.noBottom ? c.bottomRail ?? false : true;
    return { style: 'kick', kick: k, stileY: k, railY: k, railW: rail ? R : 0, flat: 0, top: k, rise: 0, applied: false, out: 0, b };
  }
  const cap = profileByNum(c.baseMold);
  const flat = Math.max(0, b.height);
  const top = flat + (cap ? mountShape(cap).height : 0);
  if (b.style === 'baseboard') {
    return { style: 'baseboard', kick: 0, stileY: 0, railY: 0, railW: top + R, flat, top, rise: 0, applied: true, out: boardT, b };
  }
  if (b.build === 'applied') {
    // The skirt laps the face frame by what's left above the cutout; behind the cutout, a recessed toe kick
    const rise = Math.max(0.5, Math.min(b.rise, flat - 0.75));
    return { style: 'arch', kick: rise, stileY: rise, railY: rise, railW: top - rise + R, flat, top, rise, applied: true, out: boardT, b };
  }
  // Shaped face frame: stiles run to the floor as feet, and the arch is cut into a wide bottom rail
  const rise = Math.max(0.5, Math.min(b.rise, top + R - 1.5));
  return { style: 'arch', kick: rise, stileY: 0, railY: 0, railW: top + R, flat, top, rise, applied: false, out: 0, b };
}

/**
 * How high the cutout reaches at u, for a cutout running from a to b.
 * Bracket feet: a rounded corner, a small step, then flat. Arch: half an ellipse.
 */
export function cutHeight(shape: CabinetBase['shape'], rise: number, a: number, b: number, u: number): number {
  if (u <= a || u >= b) return 0;
  if (shape === 'straight') return rise;
  if (shape === 'arch') {
    const h = (b - a) / 2;
    const t = (u - (a + h)) / h;
    return rise * Math.sqrt(Math.max(0, 1 - t * t));
  }
  const step = Math.min(0.5, rise / 3);
  const r = Math.min(rise - step, (b - a) / 4);
  const stepW = 0.75;
  const d = Math.min(u - a, b - u);
  if (d < r) return Math.sqrt(Math.max(0, r * r - (r - d) * (r - d)));
  if (d < r + stepW) return r;
  return rise;
}

/** The outline of a piece len long and h high with the cutout running from a to b along its bottom edge. */
export function cutOutline(len: number, h: number, a: number, b: number, shape: CabinetBase['shape'], rise: number): [number, number][] {
  const step = 0.125;
  const n = Math.max(1, Math.ceil(len / step));
  const pts: [number, number][] = [[0, h], [len, h]];
  let prev = -1;
  // Back along the bottom edge from right to left, standing straight up wherever the cut steps
  for (let i = n; i >= 0; i--) {
    const u = (i * len) / n;
    const y = Math.min(h, cutHeight(shape, rise, a, b, u));
    if (prev >= 0 && Math.abs(y - prev) > 0.2) pts.push([u + step / 2, prev], [u + step / 2, y]);
    pts.push([u, y]);
    prev = y;
  }
  // Drop points along straight runs
  return pts.filter((p, i) => {
    const q = pts[i - 1], r = pts[i + 1];
    if (!q || !r) return true;
    return Math.abs((p[0] - q[0]) * (r[1] - q[1]) - (p[1] - q[1]) * (r[0] - q[0])) > 1e-9;
  });
}

/** A shaped piece placed in the cabinet, running along x or z from min. */
export const cutShape = (along: 'x' | 'z', min: [number, number, number], len: number, h: number, t: number, a: number, b: number, shape: CabinetBase['shape'], rise: number): CutShape =>
  ({ along, min, thickness: t, outline: cutOutline(len, h, a, b, shape, rise) });

/** A few words on the base for notes and the quote. */
export function baseLabel(c: Cabinet): string | null {
  if (!floorStanding(c)) return null;
  const b = baseOf(c);
  if (b.style === 'baseboard') return 'baseboard wrapped around the base';
  if (b.style === 'arch') return `${archShapes[b.shape].toLowerCase()} ${b.build === 'applied' ? 'on an applied skirt' : 'cut into the face frame'}`;
  return null;
}
