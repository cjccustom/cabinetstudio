// Where the hinge plates and drawer slides go, for the shop drawings, the way CNC cabinet programs
// print hardware locations on every part.
//   Hinges: Eagle bores the cups 3" from the top and bottom of each door (to the cup center) unless
//   asked otherwise, with middle hinges evenly between on taller doors (count from Eagle's table).
//   The face frame plates line up with them.
//   Slides: on overlay jobs the runner's front screws to the face frame and its back sits in a Blum
//   rear bracket on the case back; on inset jobs the case side is blocked out to the opening and the
//   runner screws to the blocking. (The shop's way, Nov 2026.)
import type { Cabinet, Part, Project } from './types';
import { buildParts, eff, isFrameless, layoutRows } from './parts';
import { hingeHoles } from './eagle';
import { bbox, opensRight } from './pulls';
import { resolveEnds, wallLength } from './layout';

const partsOf = (p: Project, c: Cabinet) => buildParts(c, p.settings, resolveEnds(p.room, p.cabinets, c));

/** Eagle's cup position from the top and bottom of a door, to the cup center. */
export const HINGE_FROM_END = 3;

/** Hinge centers up a door this tall, from its bottom edge. */
export function hingeCenters(h: number, fromEnd = HINGE_FROM_END): number[] {
  const n = Math.max(2, hingeHoles(h));
  const span = h - 2 * fromEnd;
  return Array.from({ length: n }, (_, i) => fromEnd + (span * i) / (n - 1));
}

export interface DoorHinges { name: string; edge: 'left' | 'right'; x: number; y0: number; y1: number; ys: number[] }

/** Each hinged door: which edge its hinges are on and their heights (cabinet coordinates). */
export function doorHinges(p: Project, c: Cabinet, parts: Part[] = partsOf(p, c)): DoorHinges[] {
  const doors = parts.filter((x) => x.role === 'door' && x.boxes.length && x.name !== 'Lift-up door');
  const boxes = doors.map(bbox);
  const L = wallLength(p.room, c.wall);
  return doors.map((d, i) => {
    const b = boxes[i];
    const left = opensRight(c, L, boxes, b);
    return { name: d.name, edge: left ? 'left' : 'right', x: left ? b.x0 : b.x1, y0: b.y0, y1: b.y1, ys: hingeCenters(b.y1 - b.y0).map((y) => b.y0 + y) };
  });
}

export type SlideMount = 'rear' | 'blocked' | 'side';

/** How this cabinet's drawer slides are held. */
export function slideMount(p: Project, c: Cabinet): SlideMount {
  const s = eff(c, p.settings);
  if (isFrameless(c, p.settings)) return 'side';
  const inset = s.doorMount === 'inset';
  const rear = s.drawerSlide === 'tandem' && (s.tandemRearBrackets === 'always' || (s.tandemRearBrackets === 'overlay' && !inset));
  return rear ? 'rear' : 'blocked';
}

/** Each drawer opening's bottom (the runner's bottom edge sits level with it), cabinet coordinates. */
export function slideLines(p: Project, c: Cabinet): number[] {
  const rows = layoutRows(c, p.settings).rows;
  return c.rows.map((r, i) => (r.type === 'drawer' ? rows[i]?.y0 : undefined)).filter((y): y is number => y != null);
}

/** How thick the blocking is that brings a case side out flush with the face frame opening. */
export function blockingThickness(p: Project, c: Cabinet, parts: Part[] = partsOf(p, c)): number {
  const sides = parts.filter((x) => x.role === 'side' && x.boxes.length);
  const stiles = parts.filter((x) => x.role === 'stile' && x.material === 'faceframe' && x.boxes.length);
  if (!sides.length || !stiles.length) return 0;
  const sideIn = Math.min(...sides.map((x) => Math.max(...x.boxes.map((b) => b.min[0] + b.size[0]))));
  const stileIn = Math.min(...stiles.map((x) => Math.max(...x.boxes.map((b) => b.min[0] + b.size[0]))));
  return Math.max(0, stileIn - sideIn);
}
