// Where the room's light comes from in 3D: recessed cans in the ceiling, the way the finished room
// is lit. With a coffered ceiling it's one can centered in each coffer; otherwise cans on a grid
// about every 5 feet. Daylight is the old even light from above, for looking at the work flat.
import type { Project } from './types';
import { cofferOf, coffers } from './coffer';

export interface RoomLights {
  /** Recessed cans, or a high daylight. */
  kind: 'recessed' | 'daylight';
  /** Grid spacing for the cans when there's no coffered ceiling. */
  spacing: number;
  /** How bright, 1 = normal. */
  brightness: number;
}
export const defaultLights: RoomLights = { kind: 'recessed', spacing: 60, brightness: 1 };
export const lightsOf = (p: Project): RoomLights => ({ ...defaultLights, ...p.lights });

/** Can centers on the ceiling plane (room coordinates: x along the back wall, z out from it). */
export function canSpots(p: Project): { x: number; z: number }[] {
  const L = lightsOf(p);
  if (L.kind !== 'recessed') return [];
  const c = cofferOf(p);
  if (c.on) return coffers(p, c).map((k) => ({ x: (k.x0 + k.x1) / 2, z: (k.z0 + k.z1) / 2 }));
  const { width: W, depth: D } = p.room;
  const nx = Math.max(1, Math.round(W / L.spacing)), nz = Math.max(1, Math.round(D / L.spacing));
  const out: { x: number; z: number }[] = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) out.push({ x: (W * (i + 0.5)) / nx, z: (D * (j + 0.5)) / nz });
  return out;
}
