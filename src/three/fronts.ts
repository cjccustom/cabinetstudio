// How each door and drawer front moves when a cabinet is opened in the 3D view: doors swing out
// on the hinge edge, drawers slide out with their box. Cabinet-local inches (x across, y up,
// z out from the wall).
import type { Cabinet, Part, Project } from '../model/types';
import { bbox, opensRight, type Box, type PullSpot } from '../model/pulls';
import { wallLength } from '../model/layout';
import { cabinetSwings } from '../model/doorSwing';

export interface FrontMotion {
  part: Part;
  /** Doors: the hinge line (x, z) and the swing in radians. Drawers: how far it slides out. */
  pivot: [number, number];
  angle: number;
  /** Lift-up doors swing up on a hinge line along the top: (y, z) in pivot, about the x axis. */
  lift?: boolean;
  slide: number;
  /** The drawer box behind a drawer front, to draw while it's out. */
  box?: { x0: number; y0: number; z0: number; w: number; h: number; d: number };
  pulls: PullSpot[];
}

const SWING = (105 * Math.PI) / 180;
const inside = (h: PullSpot, b: Box) => h.x >= b.x0 - 0.5 && h.x <= b.x1 + 0.5 && h.y >= b.y0 - 0.5 && h.y <= b.y1 + 0.5;

export function frontMotions(p: Project, c: Cabinet, parts: Part[], spots: PullSpot[]): FrontMotion[] {
  const L = wallLength(p.room, c.wall);
  const doors = parts.filter((x) => x.role === 'door' && x.boxes.length);
  const doorBoxes = doors.map(bbox);
  const out: FrontMotion[] = [];
  const stops = new Map(cabinetSwings(p, c).map((d) => [d.door, (d.stop * Math.PI) / 180]));
  let hinged = 0;
  doors.forEach((part, i) => {
    const b = doorBoxes[i];
    const back = Math.min(...part.boxes.map((x) => x.min[2]));
    if (part.name === 'Lift-up door') {
      out.push({ part, pivot: [b.y1, back], angle: -(100 * Math.PI) / 180, slide: 0, lift: true, pulls: spots.filter((h) => inside(h, b)) });
      return;
    }
    const right = opensRight(c, L, doorBoxes.filter((_, j) => doors[j].name !== 'Lift-up door'), b);
    // Hinged on the far edge from the pull, swinging out toward the room, as far as it can go
    const swing = Math.min(SWING, stops.get(hinged++) ?? SWING);
    out.push({ part, pivot: [right ? b.x0 : b.x1, back], angle: right ? -swing : swing, slide: 0, pulls: spots.filter((h) => inside(h, b)) });
  });
  // Each drawer box follows its front in the parts list
  const boxes = parts.filter((x) => x.role === 'drawerBox');
  const fronts = parts.filter((x) => x.role === 'drawerFront' && x.boxes.length && x.name !== 'False front');
  fronts.forEach((part, i) => {
    const b = bbox(part);
    const back = Math.min(...part.boxes.map((x) => x.min[2]));
    const db = boxes[i];
    const d = db?.length || Math.max(8, back - 2);
    const w = db?.width || b.x1 - b.x0 - 2;
    const h = Math.min(db?.thickness || (b.y1 - b.y0) * 0.7, b.y1 - b.y0 - 0.5);
    out.push({
      part, pivot: [0, 0], angle: 0, slide: Math.min(d * 0.75, 16),
      box: { x0: (b.x0 + b.x1) / 2 - w / 2, y0: (b.y0 + b.y1) / 2 - h / 2 - 0.25, z0: back - d, w, h, d },
      pulls: spots.filter((s) => inside(s, b)),
    });
  });
  return out;
}

/** The parts that stay put when the fronts move. */
export const fixedParts = (parts: Part[]) => parts.filter((x) => !((x.role === 'door' || (x.role === 'drawerFront' && x.name !== 'False front')) && x.boxes.length));
