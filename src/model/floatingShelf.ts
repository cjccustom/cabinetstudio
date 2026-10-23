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

/**
 * The bracket CJC buys: Amazon B088PQTYJT, black solid steel, 12 mm rod on a 2" x 1-1/8" plate,
 * 120 lb on a stud, sold in packs of 8 ($16.16 for the 10" pack, checked Oct 23, 2026).
 */
export const bracketProduct = {
  name: 'Solid steel floating shelf bracket',
  url: 'https://www.amazon.com/dp/B088PQTYJT',
  rods: [4, 5, 6, 8, 10, 11, 12],
  perPack: 8,
};

/** Rod length for a shelf: the longest that's at least 2" shorter than the shelf is deep (12" shelf, 10" rod). */
export const bracketLength = (c: Cabinet) => [...bracketProduct.rods].reverse().find((r) => r <= c.depth - 2) ?? bracketProduct.rods[0];

/** Finished ends on a shelf: each exposed end gets a mitered end cap. */
export const finishedEnds = (ends: EndInfo) => Number(ends.left) + Number(ends.right);
