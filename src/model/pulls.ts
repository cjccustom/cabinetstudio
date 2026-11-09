// Knobs, pulls and finger pulls on the doors and drawer fronts. The shop doesn't sell hardware:
// the customer supplies it and we install it. The design only needs to show where it goes, and
// what kind (knobs, bar pulls, or integrated finger pulls routed into the fronts instead).
import type { Cabinet, Part, Project, ShopSettings } from './types';
import { wallLength } from './layout';
import { eff } from './parts';
import { fmt } from '../units';

export type PullStyle = NonNullable<ShopSettings['pulls']>;
export type PullFinish = NonNullable<ShopSettings['pullFinish']>;

export const pullStyles: { v: PullStyle; label: string }[] = [
  { v: 'standard', label: 'Knobs on doors, pulls on drawers' },
  { v: 'knobs', label: 'Knobs on everything' },
  { v: 'bars', label: 'Pulls on everything' },
  { v: 'finger', label: 'Integrated finger pulls (no hardware)' },
];

export const pullFinishes: { v: PullFinish; label: string; color: string }[] = [
  { v: 'nickel', label: 'Satin nickel', color: '#b9bcc0' },
  { v: 'black', label: 'Matte black', color: '#26272a' },
  { v: 'brass', label: 'Brass', color: '#b8933f' },
  { v: 'bronze', label: 'Oil-rubbed bronze', color: '#4a3528' },
];

export const pullStyleOf = (s: ShopSettings): PullStyle => s.pulls ?? 'standard';
export const fingerLengthOf = (s: ShopSettings) => s.fingerPullLength ?? 6;
export const pullColor = (s: ShopSettings) => (pullFinishes.find((f) => f.v === s.pullFinish) ?? pullFinishes[0]).color;

/**
 * One knob, pull or finger grip, in the cabinet's own coordinates: x along the face, y up, z the
 * face of the front it's on. A bar or grip runs `len` along x, or along y when vertical.
 */
export interface PullSpot { kind: 'knob' | 'bar' | 'finger'; x: number; y: number; z: number; len: number; vertical: boolean }

export interface Box { x0: number; x1: number; y0: number; y1: number; z: number }
export const bbox = (part: Part): Box => {
  const xs = part.boxes.flatMap((b) => [b.min[0], b.min[0] + b.size[0]]), ys = part.boxes.flatMap((b) => [b.min[1], b.min[1] + b.size[1]]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), z: Math.max(...part.boxes.map((b) => b.min[2] + b.size[2])) };
};

/** A finger grip's length on a front this wide: the set length, or the full width less 1" each end. */
const gripLen = (s: ShopSettings, w: number) => { const L = fingerLengthOf(s); return L > 0 ? Math.min(L, w - 2) : w - 2; };

/**
 * Which edge of a door opens (the other is hinged): a pair opens at the meeting edges; a single
 * door is hinged toward the nearer end of the wall.
 */
export function opensRight(c: Cabinet, wallLen: number, doors: Box[], d: Box): boolean {
  const mate = doors.find((o) => o !== d && Math.abs(o.y0 - d.y0) < 1 && Math.abs(o.y1 - d.y1) < 1);
  return mate ? mate.x0 > d.x0 : c.offset + c.width / 2 < wallLen / 2;
}

/** Where the hardware (or finger pulls) go on a cabinet's doors and drawer fronts. */
export function pullSpots(p: Project, c: Cabinet, parts: Part[]): PullSpot[] {
  const s = eff(c, p.settings);
  const style = pullStyleOf(s);
  const out: PullSpot[] = [];
  const doors = parts.filter((x) => x.role === 'door' && x.boxes.length).map((x) => bbox(x));
  const L = wallLength(p.room, c.wall);
  const upper = c.elevation > 30;
  for (const d of doors) {
    const openRight = opensRight(c, L, doors, d);
    const h = d.y1 - d.y0, w = d.x1 - d.x0;
    const tall = h > 40;
    if (style === 'finger') {
      // A grip on the edge you reach: the top of a base door, the bottom of an upper, the opening side of a tall door
      if (tall) out.push({ kind: 'finger', x: openRight ? d.x1 - 0.25 : d.x0 + 0.25, y: Math.min(d.y1 - 3, Math.max(d.y0 + 3, 36 - c.elevation)) - gripLen(s, 40) / 2, z: d.z, len: gripLen(s, 40), vertical: true });
      else {
        const len = gripLen(s, w);
        // Toward the opening side, unless it runs full width
        const x0 = fingerLengthOf(s) > 0 ? (openRight ? d.x1 - 1 - len : d.x0 + 1) : d.x0 + 1;
        out.push({ kind: 'finger', x: x0, y: upper ? d.y0 + 0.25 : d.y1 - 0.25, z: d.z, len, vertical: false });
      }
      continue;
    }
    const x = openRight ? d.x1 - 2.5 : d.x0 + 2.5;
    const y = upper ? d.y0 + 3 : tall ? Math.min(d.y1 - 3, Math.max(d.y0 + 3, 36 - c.elevation)) : d.y1 - 3;
    if (style === 'bars') {
      // A vertical pull running away from the corner it sits in
      const len = tall ? 8 : 4;
      out.push({ kind: 'bar', x, y: upper ? y : tall ? y - len / 2 : y - len, z: d.z, len, vertical: true });
    } else out.push({ kind: 'knob', x, y, z: d.z, len: 0, vertical: false });
  }
  for (const f of parts.filter((x) => x.role === 'drawerFront' && x.boxes.length && x.name !== 'False front')) {
    const b = bbox(f);
    const w = b.x1 - b.x0, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    if (style === 'finger') {
      const len = gripLen(s, w);
      out.push({ kind: 'finger', x: cx - len / 2, y: b.y1 - 0.25, z: b.z, len, vertical: false });
    } else if (style === 'knobs') {
      // Two knobs on a wide drawer
      if (w >= 24) out.push({ kind: 'knob', x: b.x0 + w / 4, y: cy, z: b.z, len: 0, vertical: false }, { kind: 'knob', x: b.x1 - w / 4, y: cy, z: b.z, len: 0, vertical: false });
      else out.push({ kind: 'knob', x: cx, y: cy, z: b.z, len: 0, vertical: false });
    } else if (w >= 12 || style === 'bars') {
      const len = w >= 30 ? 8 : w >= 12 ? 4 : 3;
      out.push({ kind: 'bar', x: cx - len / 2, y: cy, z: b.z, len, vertical: false });
    } else out.push({ kind: 'knob', x: cx, y: cy, z: b.z, len: 0, vertical: false });
  }
  return out;
}

/** True when any cabinet on the job gets finger pulls. */
export const hasFingerPulls = (p: Project) => p.cabinets.some((c) => pullStyleOf(eff(c, p.settings)) === 'finger');
/** True when any cabinet on the job gets knobs or pulls. */
export const hasHardware = (p: Project) => p.cabinets.some((c) => (c.kind === 'base' || c.kind === 'wall' || c.kind === 'tall') && pullStyleOf(eff(c, p.settings)) !== 'finger');

/** The scope line about hardware, for the proposal and agreement. */
export function hardwareScope(p: Project): string[] {
  const out: string[] = [];
  if (hasFingerPulls(p)) out.push(hasHardware(p)
    ? 'Integrated finger pulls routed into the doors and drawer fronts where shown; no knobs or pulls there'
    : 'Integrated finger pulls routed into the doors and drawer fronts; no knobs or pulls');
  if (hasHardware(p)) out.push('Customer responsible for providing knobs/pulls. CJC responsible for installation');
  return out;
}

/** The shop's note on how the finger pulls are cut. */
export function fingerPullNote(s: ShopSettings): string {
  const L = fingerLengthOf(s);
  const len = L > 0 ? `${fmt(L)} long` : 'full width (1" short each end)';
  return s.doorMount === 'inset'
    ? `Finger pulls: inset fronts sit flush with the frame, so cut a finger scoop into the face at the pull edge, ${len}; tops of base doors and drawer fronts, bottoms of upper doors, opening edge of tall doors`
    : `Finger pulls: rout a finger grip on the back of the pull edge, ${len} (about 3/4" deep, eased so it's comfortable); tops of base doors and drawer fronts, bottoms of upper doors, opening edge of tall doors`;
}
