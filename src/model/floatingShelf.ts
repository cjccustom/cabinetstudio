// Floating shelves built with miter folds: 3/4" plywood top and bottom, a solid face (and end caps on
// exposed ends) mitered to them, and the space between left open for a floating shelf bracket.
import type { Cabinet, FloatingShelfSpec, Part, ShopSettings } from './types';
import type { EndInfo } from './parts';
import { eff, vb } from './parts';
import { fmt } from '../units';

export const defaultFloating: FloatingShelfSpec = { grade: 'paint', face: 0.75 };
export const floatingOf = (c: Cabinet): FloatingShelfSpec => ({ ...defaultFloating, ...c.floating });

/** Sheet stock for the top and bottom: paint-grade plywood, or veneer plywood in the job's wood species. */
export const shelfPly = (c: Cabinet, s: ShopSettings) => (floatingOf(c).grade === 'paint' ? `${fmt(s.boxThickness)} paint-grade plywood` : `${fmt(s.boxThickness)} ${s.woodSpecies.toLowerCase()} plywood`);

/** Open space left between the top and bottom for the bracket. */
export const bracketGap = (c: Cabinet, s: ShopSettings) => c.height - 2 * eff(c, s).boxThickness;

export function floatingShelfParts(c: Cabinet, settings: ShopSettings, ends: EndInfo): Part[] {
  const s = eff(c, settings);
  const f = floatingOf(c);
  const W = c.width, D = c.depth, H = c.height;
  const t = s.boxActualThickness;
  const ft = f.face;
  // Paint grade edges come from the face frame stock; stain grade from the job's wood species
  const solid = f.grade === 'paint' ? 'faceframe' as const : 'solidWood' as const;
  const sheet = shelfPly(c, settings);
  const xl = ends.left ? ft : 0, xr = W - (ends.right ? ft : 0);
  const miter = ['front', ...(ends.left ? ['left'] : []), ...(ends.right ? ['right'] : [])].join(', ');
  const out: Part[] = [];
  for (const [name, y] of [['Shelf top', H - t], ['Shelf bottom', 0]] as const) {
    out.push({ name, role: 'shelf', material: 'box', sheet, look: f.grade === 'paint' ? 'paint' : 'wood', length: W, width: D, thickness: s.boxThickness, cut: true,
      note: `45° miter on the ${miter} edge${miter.includes(',') ? 's' : ''}; sizes to the long point`,
      boxes: [vb(xl, y, 0, xr - xl, t, D - ft)] });
  }
  out.push({ name: 'Shelf face', role: 'trim', material: solid, length: W, width: H, thickness: ft, cut: true,
    note: 'mitered top and bottom to fold over the plywood',
    boxes: [vb(0, 0, D - ft, W, H, ft)] });
  for (const side of ['left', 'right'] as const) {
    if (!ends[side]) continue;
    out.push({ name: 'Shelf end cap', role: 'trim', material: solid, length: D, width: H, thickness: ft, cut: true,
      note: `${side}, mitered to the face`,
      boxes: [vb(side === 'left' ? 0 : W - ft, 0, 0, ft, H, D - ft)] });
  }
  return out;
}

/** Brackets for a floating shelf: what's set, or one per stud at 16" centers with 2" clear at each end. */
export const bracketCount = (c: Cabinet) => floatingOf(c).brackets ?? Math.max(2, Math.floor((c.width - 4) / 16) + 1);
