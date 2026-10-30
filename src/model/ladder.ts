// A rolling library ladder on a rail across the face of the bookcases, like the Putnam Classic No. 1:
// a sloped wood ladder that hooks over a round rail at the top and rolls on wheels at the floor.
// Turned on and off like the coffered ceiling. Sizes default to Putnam's No. 1 instruction manual
// (putnamrollingladder.com): rail heights by ladder length, 7" clear from the rail's center to the
// ceiling or crown, brackets no more than 36" apart, the foot cut at 12 degrees, 7 steps on the 92"
// ladder and 8 on the 107", 6" tall hook hardware. Width (16") and the side rail and step sizes come
// from Putnam's older No. 1 catalog; every size can be changed to match the ladder as ordered.
// Coordinates are along the wall it runs on: x from the wall's left end, z out from the wall.
import type { Cabinet, Project, WallId } from './types';
import { wallLength } from './layout';
import type { Issue } from './layout';
import { cofferOf, fasciaHeight, perimOf } from './coffer';

export interface RollingLadder {
  on: boolean;
  /** The wall whose bookcases carry the rail. */
  wall: WallId;
  /** Rail ends, along the wall; unset = the run of cabinets the rail crosses. */
  railFrom?: number;
  railTo?: number;
  /** Floor to the center of the rail. */
  railHeight: number;
  /** Rail diameter and how far its center stands off the face of the cabinets (the bracket). */
  railDia: number;
  standoff: number;
  /** Ladder width outside the side rails, and the side rails' depth and thickness. */
  width: number;
  stileDepth: number;
  stileThick: number;
  /** Step depth, and how many steps (unset = Putnam's count for the length). */
  stepDepth: number;
  steps?: number;
  /** The ladder's lean from vertical: Putnam cuts the foot at 12 degrees. */
  leanDeg: number;
  /** Where it's parked along the rail: the ladder's center, from the wall's left end. */
  at: number;
  /** Finish: wood species of the ladder, and the rail and hardware. */
  wood: string;
  hardware: 'black' | 'brass' | 'nickel' | 'bronze';
  /** Clearance the hook needs above the rail. */
  clearAbove: number;
  model: string;
}

export const defaultLadder: RollingLadder = {
  on: false, wall: 'back', railHeight: 89, railDia: 1, standoff: 2.5,
  width: 16, stileDepth: 3.25, stileThick: 1.0625, stepDepth: 4.25,
  leanDeg: 12, at: 0, wood: 'Red oak', hardware: 'black', clearAbove: 7, model: 'Putnam Classic No. 1',
};

/** Putnam's rail heights (floor to the rail) by ladder, from the No. 1 instruction manual. */
export const putnamRails = [
  { label: '8\' ladder (92")', rail: 89, range: '88 1/4" to 89 1/4" (8\' ladders 90" to 92")' },
  { label: '9\' ladder (107")', rail: 103.75, range: '103 1/4" to 104 1/4" (9\' ladders 102" to 104")' },
  { label: '10\' ladder', rail: 115, range: '114" to 116"' },
];

const onRail = (c: Cabinet, y: number) => !c.island && c.kind !== 'shelf' && c.kind !== 'mantel' && c.elevation <= y && c.elevation + c.height >= y;

/** The cabinets the rail crosses on its wall, at rail height. */
export function railCabinets(p: Project, L: RollingLadder): Cabinet[] {
  return p.cabinets.filter((c) => c.wall === L.wall && onRail(c, L.railHeight));
}

/** Everything placed: rail span, rail line out from the wall, the ladder's lean. */
export function ladderOf(p: Project): RollingLadder & { from: number; to: number; railZ: number; face: number; length: number; lean: number; footOut: number; stepAt: number[] } {
  const L = { ...defaultLadder, ...p.ladder };
  const cabs = railCabinets(p, L);
  const len = wallLength(p.room, L.wall);
  const from = L.railFrom ?? (cabs.length ? Math.min(...cabs.map((c) => c.offset)) : 0);
  const to = L.railTo ?? (cabs.length ? Math.max(...cabs.map((c) => c.offset + c.width)) : len);
  const face = cabs.length ? Math.max(...cabs.map((c) => (c.wallInset ?? 0) + c.depth)) : 0;
  const railZ = face + L.standoff;
  // The ladder leans from its wheels on the floor up to the rail, hooking over it; the top runs about
  // 3" past the rail's center (the hook hardware sits 1 1/2" down from the top)
  const rise = L.railHeight + L.railDia / 2;
  const lean = (L.leanDeg * Math.PI) / 180;
  const footOut = rise * Math.tan(lean);
  const length = rise / Math.cos(lean) + 3;
  const n = L.steps ?? Math.max(3, Math.round(length / 13));
  // Steps evenly up the side rails, the turned rung at the top
  const stepAt = Array.from({ length: n }, (_, i) => ((i + 1) * (length - 3)) / (n + 1));
  const half = L.width / 2;
  const at = Math.min(Math.max(L.at || (from + to) / 2, from + half), to - half);
  return { ...L, from, to, at, railZ, face, length, lean, footOut, stepAt };
}

/** What would stop it working: the hook hitting the ceiling or a soffit, the foot leaving the room, too short a rail. */
export function ladderIssues(p: Project): Issue[] {
  if (!p.ladder?.on) return [];
  const L = ladderOf(p);
  const out: Issue[] = [];
  const say = (message: string) => out.push({ cabinetId: 'ladder', message: `Rolling ladder: ${message}` });
  let over = p.room.height;
  // A coffered ceiling's perimeter soffit over the rail line is what the hook has to clear
  const c = cofferOf(p);
  if (c.on && c.perimeter && perimOf(c, L.wall) > L.railZ - 3) over = p.room.height - fasciaHeight(c);
  if (L.railHeight + L.clearAbove > over + 1e-3) say(`needs ${L.clearAbove}" clear above the rail; there's ${Math.round((over - L.railHeight) * 16) / 16}" up to the ${over < p.room.height ? 'soffit' : 'ceiling'}. Lower the rail or use a shorter ladder.`);
  const deep = L.wall === 'back' || L.wall === 'front' ? p.room.depth : p.room.width;
  if (L.railZ + L.footOut > deep - 24) say(`the foot rolls out ${Math.round(L.railZ + L.footOut)}" from the wall, leaving under 24" to the opposite wall.`);
  if (L.to - L.from < L.width + 12) say('the rail is barely longer than the ladder is wide.');
  if (!railCabinets(p, L).length) say(`nothing on the ${L.wall} wall reaches the rail height to carry it; the brackets need solid wood behind them, not drywall.`);
  return out;
}
