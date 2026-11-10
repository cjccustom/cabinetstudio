// Where a hinged door stops: swing it open in plan, past square, and find the first thing it (or its
// pull) runs into: a wall, a deeper cabinet or appliance beside it, a countertop's overhang. A door
// that hits at or just past 90° gets a hinge opening restrictor so it stops short; one that hits
// before it's open square needs a filler or its hinges moved.
//
// The model: the door turns about the front corner of its hinge edge (a concealed hinge carries the
// door forward as it opens, so a neighbour flush with the door face is cleared), in the cabinet's own
// plan coordinates: x across the face, z out from the wall.
import type { Cabinet, Project, WallId } from './types';
import { buildParts, eff } from './parts';
import { extentsOf, resolveEnds, wallLength, wallNames, wallTransform, type Issue } from './layout';
import { bbox, opensRight, pullSpots } from './pulls';

/** Where a restricted door stops. */
export const RESTRICT_TO = 86;
/** How far each hinge opens on its own (Blum Compact 107°, Clip Top 110°). */
export const hingeMax = (type: string) => (type === 'compact' ? 107 : 110);
/** Contact up to here is "at or just past square": a restrictor. Beyond it the door opens well past square first. */
const RESTRICT_UP_TO = 100;
/** Hitting before this, the door doesn't open far enough to use: a layout problem. */
const BLOCKED_BELOW = RESTRICT_TO + 1;
/** How far a knob or pull stands off the door face. */
const PULL_PROJECTION = 1.25;

export interface DoorSwing {
  cabinetId: string;
  /** Which door, counting the cabinet's hinged doors in parts order. */
  door: number;
  /** "left-hinged door", "upper right-hinged door"... */
  label: string;
  hits: string;
  /** The angle it first touches. */
  at: number;
  fix: 'restrictor' | 'blocked';
  /** Where it stops: the restrictor's angle, or just before it hits. */
  stop: number;
}

interface Obstacle { x0: number; x1: number; z0: number; z1: number; y0: number; y1: number; name: string }

const rot = (room: Project['room'], c: Cabinet) => {
  const { pos, rotY } = wallTransform(room, c.wall, c.offset, c.wallInset);
  return { pos, cos: Math.round(Math.cos(rotY)), sin: Math.round(Math.sin(rotY)) };
};
/** A cabinet's own (x, z) to the room's plan, and back. */
const toRoom = (r: ReturnType<typeof rot>, lx: number, lz: number): [number, number] => [r.pos[0] + lx * r.cos + lz * r.sin, r.pos[2] - lx * r.sin + lz * r.cos];
const toLocal = (r: ReturnType<typeof rot>, X: number, Z: number): [number, number] => {
  const dx = X - r.pos[0], dz = Z - r.pos[2];
  return [dx * r.cos - dz * r.sin, dx * r.sin + dz * r.cos];
};
const boxOf = (pts: [number, number][], y0: number, y1: number, name: string): Obstacle => {
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), y0, y1, name };
};

/** Everything around a cabinet a door could swing into, in that cabinet's own plan coordinates. */
function obstacles(p: Project, c: Cabinet): Obstacle[] {
  const room = p.room, me = rot(room, c), BIG = 1e4;
  const out: Obstacle[] = [];
  // The room's walls, as solid beyond the room
  const walls: [WallId, number, number, number, number][] = [
    ['left', -BIG, 0, -BIG, BIG], ['right', room.width, BIG, -BIG, BIG], ['back', -BIG, BIG, -BIG, 0], ['front', -BIG, BIG, room.depth, BIG],
  ];
  for (const [w, x0, x1, z0, z1] of walls) out.push(boxOf([[x0, z0], [x1, z0], [x0, z1], [x1, z1]].map(([X, Z]) => toLocal(me, X, Z)), -BIG, BIG, wallNames[w].toLowerCase()));
  for (const o of p.cabinets) {
    if (o.id === c.id) continue;
    const s = eff(o, p.settings);
    const r = rot(room, o), ext = extentsOf(room, p.cabinets, o, p.settings);
    const z0 = o.island && o.islandSides === 2 ? -o.depth : 0;
    const d = o.corner ? Math.max(o.depth, o.corner.width2) : o.depth;
    // Overlay doors and drawer fronts stand proud of the case
    const face = d + (s.doorMount === 'inset' ? 0 : s.doorThickness);
    const corners = (zFront: number, xl = -ext.left, xr = o.width + ext.right) => [[xl, z0], [xr, z0], [xl, zFront], [xr, zFront]].map(([lx, lz]) => toLocal(me, ...toRoom(r, lx, lz)));
    out.push(boxOf(corners(face), o.elevation, o.elevation + o.height, o.name));
    // A countertop overhangs the doors below it
    if (o.countertop && o.kind === 'base') {
      const top = o.elevation + o.height;
      out.push(boxOf(corners(d + p.settings.counterOverhang), top, top + p.settings.counterThickness, `the top on ${o.name}`));
    }
  }
  return out;
}

/** Each hinged door on a cabinet that runs into something when it opens. */
export function cabinetSwings(p: Project, c: Cabinet): DoorSwing[] {
  const parts = buildParts(c, p.settings, resolveEnds(p.room, p.cabinets, c));
  const doors = parts.filter((x) => x.role === 'door' && x.boxes.length && x.name !== 'Lift-up door');
  if (!doors.length) return [];
  const s = eff(c, p.settings);
  const max = hingeMax(s.hingeType);
  const L = wallLength(p.room, c.wall);
  const boxes = doors.map(bbox);
  const spots = pullSpots(p, c, parts);
  const all = obstacles(p, c);
  const rows = new Set(boxes.map((b) => Math.round(b.y0))).size;
  const out: DoorSwing[] = [];
  doors.forEach((part, i) => {
    const b = boxes[i];
    const right = opensRight(c, L, boxes, b);
    const sgn = right ? 1 : -1;
    const hx = right ? b.x0 : b.x1;
    const front = b.z, back = Math.min(...part.boxes.map((x) => x.min[2]));
    const W = b.x1 - b.x0, t = Math.max(0.25, front - back);
    const y0 = c.elevation + b.y0, y1 = c.elevation + b.y1;
    // Only what stands proud of the door face, on the hinge side, within the door's reach
    const near = all.filter((o) => o.y0 < y1 - 0.01 && y0 < o.y1 - 0.01 && o.z1 > front + 1 / 32 && o.z0 < front + W + 2
      && (right ? o.x0 < hx + 0.01 && o.x1 > hx - W - 2 : o.x1 > hx - 0.01 && o.x0 < hx + W + 2));
    if (!near.length) return;
    // The pulls on this door: how far along the door from the hinge edge, standing off the face
    const pulls = spots.filter((h) => h.kind !== 'finger' && h.x >= b.x0 - 0.5 && h.x <= b.x1 + 0.5 && h.y >= b.y0 - 0.5 && h.y <= b.y1 + 0.5).map((h) => Math.abs(h.x - hx));
    const inside = (o: Obstacle, x: number, z: number) => x > o.x0 + 1 / 32 && x < o.x1 - 1 / 32 && z > o.z0 + 1 / 32 && z < o.z1 - 1 / 32;
    const touches = (deg: number): Obstacle | undefined => {
      const a = (deg * Math.PI) / 180;
      const d: [number, number] = [sgn * Math.cos(a), Math.sin(a)], n: [number, number] = [sgn * Math.sin(a), -Math.cos(a)];
      const pts: [number, number][] = [];
      for (let u = 0; u <= W + 1e-6; u += 0.25) for (const v of [0, t]) pts.push([hx + u * d[0] + v * n[0], front + u * d[1] + v * n[1]]);
      for (const u of pulls) pts.push([hx + u * d[0] - PULL_PROJECTION * n[0], front + u * d[1] - PULL_PROJECTION * n[1]]);
      return near.find((o) => pts.some(([x, z]) => inside(o, x, z)));
    };
    // Anything the closed door already sits in is drawn that way on purpose (or a layout issue of its own)
    const closed = touches(0);
    if (closed) return;
    for (let deg = 5; deg <= max; deg++) {
      const o = touches(deg);
      if (!o) continue;
      if (deg > RESTRICT_UP_TO) return;
      const where = rows > 1 ? (b.y0 + c.elevation > c.elevation + c.height / 2 ? 'upper ' : 'lower ') : '';
      const label = `${where}${right ? 'left' : 'right'}-hinged door`;
      out.push({ cabinetId: c.id, door: i, label, hits: o.name, at: deg, fix: deg < BLOCKED_BELOW ? 'blocked' : 'restrictor', stop: deg < BLOCKED_BELOW ? deg - 1 : RESTRICT_TO });
      return;
    }
  });
  return out;
}

export const doorSwings = (p: Project): DoorSwing[] => p.cabinets.flatMap((c) => cabinetSwings(p, c));
export const restrictorCount = (p: Project) => doorSwings(p).filter((d) => d.fix === 'restrictor').length;

/** For the problems list. */
export function doorSwingIssues(p: Project): Issue[] {
  const name = new Map(p.cabinets.map((c) => [c.id, c.name]));
  return doorSwings(p).map((d) => ({
    cabinetId: d.cabinetId,
    message: d.fix === 'restrictor'
      ? `${name.get(d.cabinetId)}: the ${d.label} hits ${d.hits} at about ${d.at}°. It gets a hinge opening restrictor to stop it at ${RESTRICT_TO}° (in the quote and the drawings).`
      : `${name.get(d.cabinetId)}: the ${d.label} hits ${d.hits} at about ${d.at}°, before it's open square. Add a filler on that side, hinge it on the other side, or use a pull that stands off less.`,
  }));
}
