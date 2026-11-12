// Floating shelves built with miter folds: 3/4" plywood top and bottom, a solid face (and end caps on
// exposed ends) mitered to them, and the space between left open for a floating shelf bracket.
import { corbelByCode } from './corbels';
import { corbelShape } from './mantel';
import { edgeCutNotes, partCutShape, partSize } from './customParts';
import type { Cabinet, FloatingShelfSpec, Part, ShopSettings } from './types';
import type { EndInfo } from './parts';
import { eff, vb } from './parts';
import { fmt } from '../units';
import { closetRod } from './parts';

export const defaultFloating: FloatingShelfSpec = { grade: 'paint', face: 0.75 };
export const floatingOf = (c: Cabinet): FloatingShelfSpec => ({ ...defaultFloating, ...c.floating });

/** Sheet stock for the top and bottom: paint-grade plywood, or veneer plywood in the job's wood species. */
/** The price book's paint-grade sheet, so its price applies. */
export const PAINT_PLY = 'Paint-grade birch';
export const shelfPly = (c: Cabinet, s: ShopSettings) => (floatingOf(c).grade === 'paint' ? `${fmt(s.boxThickness)} ${PAINT_PLY.toLowerCase()} plywood` : `${fmt(s.boxThickness)} ${s.woodSpecies.toLowerCase()} plywood`);

/** Open space left between the top and bottom for the bracket. */
export const bracketGap = (c: Cabinet, s: ShopSettings) => c.height - 2 * eff(c, s).boxThickness;

/** A closet shelf on cleats rather than a floating shelf. */
export const isCleatShelf = (c: Cabinet) => c.kind === 'shelf' && floatingOf(c).support === 'cleat';

/**
 * A closet shelf: 3/4" plywood with a solid nosing on its front, on 1x2 cleats screwed into the wall
 * behind it and at any end that meets a wall or another shelf. The cabinet's height is the nosing.
 */
function cleatShelfParts(c: Cabinet, settings: ShopSettings, ends: EndInfo): Part[] {
  const s = eff(c, settings);
  const f = floatingOf(c);
  const W = c.width, D = c.depth;
  const t = s.boxActualThickness, nt = 0.75;
  const nose = Math.max(t, c.height);
  const solid = f.grade === 'paint' ? 'faceframe' as const : 'solidWood' as const;
  // Paint grade: the nosing and cleats are poplar (priced from A&M's list), like a paint-grade top's edging
  const sp = f.grade === 'paint' ? { species: 'Poplar' } : {};
  // The cleats are as tall as the nosing hangs below the plywood, so their bottoms line up with it and
  // nothing shows below the shelf's front edge: a 1x2 on the flat under a 1-1/2" nosing
  const ch = Math.max(0.5, nose - t), cw = ch < 1.25 ? 1.5 : 0.75;
  const cy = nose - t - ch;
  const cut = `${fmt(cw)} × ${fmt(ch)}`;
  const out: Part[] = [
    { name: 'Shelf', role: 'shelf', material: 'box', sheet: shelfPly(c, settings), look: f.grade === 'paint' ? 'paint' : 'wood', length: W, width: D - nt, thickness: s.boxThickness, cut: true,
      note: `on cleats; nosing glued and nailed to the front${f.slopeEnd ? `; ${f.slopeEnd} end cut to the slope's angle` : ''}`, boxes: [vb(0, nose - t, 0, W, t, D - nt)] },
    { name: 'Shelf nosing', role: 'trim', material: solid, ...sp, length: W, width: nose, thickness: nt, cut: true, note: `flush with the top, hangs ${fmt(nose - t)} below`, boxes: [vb(0, 0, D - nt, W, nose, nt)] },
    { name: 'Shelf cleat', role: 'nailer', material: solid, ...sp, length: W, width: ch, thickness: cw, cut: true, note: `${cut}, along the wall behind, screwed into the studs; bottom flush with the nosing`, boxes: [vb(0, cy, 0, W, ch, cw, 0.9)] },
  ];
  if (f.rod) {
    // A closet rod under the shelf, in a socket at each end, 12" off the wall (or mid-depth on a shallow shelf)
    const d = closetRod.diameter, drop = s.rodDrop ?? closetRod.drop;
    const zc = Math.min(closetRod.fromWall, D - d);
    const y = nose - t - drop;
    out.push({ name: 'Closet rod', role: 'rod', material: 'hardware', length: W - 0.125, width: d, thickness: d, cut: false,
      note: `${fmt(d)} round ${s.closetRod === 'wood' ? 'wood' : 'chrome'} rod in 2 sockets, center ${fmt(drop)} below the shelf (${fmt(c.elevation + y)} off the floor) and ${fmt(zc)} off the wall`,
      boxes: [vb(0.0625, y - d / 2, zc - d / 2, W - 0.125, d, d, 0.35)] });
  }
  for (const side of ['left', 'right'] as const) {
    const slope = f.slopeEnd === side;
    if (ends[side] && !slope) continue;
    out.push({ name: 'Shelf cleat', role: 'nailer', material: solid, ...sp, length: D - nt - cw, width: ch, thickness: cw, cut: true,
      note: slope ? `${cut}, ${side} end, beveled to the slope and screwed up into the framing` : `${cut}, ${side} end, on the wall (or the shelf) it meets`,
      boxes: [vb(side === 'left' ? 0 : W - cw, cy, cw, cw, ch, D - nt - cw, 0.9)] });
  }
  return out;
}

export function floatingShelfParts(c: Cabinet, settings: ShopSettings, ends: EndInfo): Part[] {
  if (isCleatShelf(c)) return cleatShelfParts(c, settings, ends);
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
  // Corbels under the shelf, evenly spaced with the end ones 4" in (or centered when there's one)
  const nCorb = f.corbels ?? 0;
  if (nCorb > 0) {
    const part = f.corbelPart;
    const bought = part ? undefined : corbelByCode(f.corbelCode);
    const ps = part ? partSize(part) : null;
    const cw = part ? part.thickness : bought?.w ?? 3.5, ch = ps ? ps.h : bought?.h ?? 7, cd = ps ? ps.w : Math.min(D, bought?.d ?? D - 1);
    const xs = nCorb === 1 ? [W / 2] : Array.from({ length: nCorb }, (_, i) => 4 + cw / 2 + (i * (W - 8 - cw)) / (nCorb - 1));
    for (const cx of xs) out.push({ name: 'Corbel', role: 'trim', material: solid, length: ch, width: cd, thickness: cw, cut: !bought,
      note: part ? `${part.name}: shop-made from the template${edgeCutNotes(part).length ? ` (${edgeCutNotes(part).join('; ')})` : ''}; screwed to the wall, glued and screwed up into the shelf` : bought ? `Next Day ${bought.code} (${bought.name}); screwed to the wall through its back, glued and screwed up into the shelf` : 'Shop-made; screwed to the wall, glued and screwed up into the shelf',
      boxes: [], shapes: [part ? partCutShape(part, cx - cw / 2, -ch, 0) : corbelShape(cx - cw / 2, -ch, 0, cw, ch, cd)] });
  }
  for (const side of ['left', 'right'] as const) {
    if (!ends[side]) continue;
    out.push({ name: 'Shelf end cap', role: 'trim', material: solid, length: D, width: H, thickness: ft, cut: true,
      note: `${side}, mitered to the face`,
      boxes: [vb(side === 'left' ? 0 : W - ft, 0, 0, ft, H, D - ft)] });
  }
  return out;
}

/** Brackets for a floating shelf: what's set, or one per stud at 16" centers with 2" clear at each end. */
export const bracketCount = (c: Cabinet) => (isCleatShelf(c) ? 0 : floatingOf(c).brackets ?? Math.max(2, Math.floor((c.width - 4) / 16) + 1));

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
