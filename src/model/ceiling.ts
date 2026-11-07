// Sloped ceilings: attic closets, knee walls, hip ceilings. Each wall can carry a slope: the ceiling
// meets that wall at the knee-wall height and rises into the room at the pitch (inches of rise per
// 12 of run) until it reaches the flat ceiling (the room's height). A hip ceiling is all four walls
// sloped to a flat center; an attic closet is one or two. The ceiling over any spot is the lowest of
// the flat ceiling and every slope there.
import type { Cabinet, Room, WallId } from './types';
import { wallTransform } from './layout';

export interface CeilingSlope {
  /** Height where the slope meets this wall (the knee wall, or the plate). */
  knee: number;
  /** Rise per 12" of run, like a roof pitch: 8 means 8/12. */
  pitch: number;
}

export const WALLS: WallId[] = ['back', 'left', 'right', 'front'];
export const slopesOf = (room: Room): Partial<Record<WallId, CeilingSlope>> => room.slopes ?? {};
export const hasSlopes = (room: Room) => Object.values(slopesOf(room)).some((s) => s && s.pitch > 0);

/** How far a point (room plan x, z) is from a wall, into the room. */
export function fromWall(room: Room, wall: WallId, x: number, z: number): number {
  return wall === 'back' ? z : wall === 'front' ? room.depth - z : wall === 'left' ? x : room.width - x;
}

/** Ceiling height over a point in the room plan. */
export function ceilingAt(room: Room, x: number, z: number): number {
  let h = room.height;
  for (const w of WALLS) {
    const s = slopesOf(room)[w];
    if (!s || s.pitch <= 0) continue;
    h = Math.min(h, s.knee + (s.pitch / 12) * Math.max(0, fromWall(room, w, x, z)));
  }
  return h;
}

/** How far a slope runs in from its wall before it meets the flat ceiling. */
export const slopeRun = (room: Room, s: CeilingSlope) => (s.pitch > 0 ? (Math.max(0, room.height - s.knee) * 12) / s.pitch : 0);
/** The slope's angle from level, in degrees. */
export const slopeAngle = (s: CeilingSlope) => (Math.atan2(s.pitch, 12) * 180) / Math.PI;

/** A point along a wall (from its left end, facing it) and out from it, in the room plan. */
export function roomPoint(room: Room, wall: WallId, along: number, out: number): [number, number] {
  const { pos } = wallTransform(room, wall, along, out);
  return [pos[0], pos[2]];
}

/** The ceiling along a wall's face, as points (along, height): enough to draw it in an elevation or build the wall's outline. */
export function wallCeiling(room: Room, wall: WallId): [number, number][] {
  const L = wall === 'back' || wall === 'front' ? room.width : room.depth;
  const xs = new Set<number>([0, L]);
  // Where slopes on the walls either side start and stop along this one
  for (const w of WALLS) {
    const s = slopesOf(room)[w];
    if (!s || s.pitch <= 0) continue;
    const run = slopeRun(room, s);
    for (const t of [run, L - run]) if (t > 0 && t < L) xs.add(t);
  }
  return [...xs].sort((a, b) => a - b).map((t) => { const [x, z] = roomPoint(room, wall, t, 0.01); return [t, ceilingAt(room, x, z)]; });
}

/** The ceiling over a cabinet's four top corners (cabinet left/right as you face it, back at the wall, front at its face). */
export function cabinetCeiling(room: Room, c: Cabinet): { backLeft: number; backRight: number; frontLeft: number; frontRight: number; low: number } {
  const inset = c.wallInset ?? 0;
  const at = (along: number, out: number) => { const [x, z] = roomPoint(room, c.wall, along, out); return ceilingAt(room, x, z); };
  const backLeft = at(c.offset + 0.01, inset + 0.01), backRight = at(c.offset + c.width - 0.01, inset + 0.01);
  const frontLeft = at(c.offset + 0.01, inset + c.depth), frontRight = at(c.offset + c.width - 0.01, inset + c.depth);
  return { backLeft, backRight, frontLeft, frontRight, low: Math.min(backLeft, backRight, frontLeft, frontRight) };
}

/** Space left between a cabinet top and the slope, so it can be tipped up into place and scribed. */
export const SLOPE_CLEAR = 0.5;

/**
 * Whether a cabinet can have its top cut to the slope: the ceiling falls toward its back (the slope
 * on its own wall) and is level across its width. Gives the case heights that fit, back and front.
 */
export function slopeFit(room: Room, c: Cabinet): { back: number; front: number; across: boolean } | null {
  const k = cabinetCeiling(room, c);
  if (k.low >= room.height - 0.01) return null;
  const back = Math.min(k.backLeft, k.backRight) - c.elevation - SLOPE_CLEAR;
  const front = Math.min(k.frontLeft, k.frontRight) - c.elevation - SLOPE_CLEAR;
  const across = Math.abs(k.backLeft - k.backRight) > 0.25 || Math.abs(k.frontLeft - k.frontRight) > 0.25;
  return { back, front, across };
}
