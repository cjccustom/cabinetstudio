// Mouldings from the Anderson & McQuaid catalog: crown, light rail and base on cabinets, caps on
// beadboard. Each run follows the cabinet face and returns along exposed ends.
import type { Cabinet, Project, ShopSettings, WallPanel } from './types';
import { mantelLayout, mantelOf } from './mantel';
import { amCatalog, type AMProfile } from './andersonMcquaid';
import { broscoCatalog } from './brosco';
import { crownLayout, panelExtents, type EndInfo } from './parts';
import { pilasterOf, pilasterOpenings } from './pilaster';
import { inScope, roomMoldingPieces } from './room';
import { resolveEnds } from './layout';
import { cofferMoldings, cofferOf, underFascia } from './coffer';
import { baseLayout } from './cabinetBase';

export type MoldKind = 'crown' | 'lightRail' | 'baseMold' | 'cap' | 'panel' | 'roomCrown' | 'roomBase' | 'chairRail' | 'casing' | 'backBand' | 'headCap' | 'stool' | 'apron' | 'cofferCrown' | 'cofferBead' | 'picture';

/** Room trim, as opposed to mouldings on the cabinets themselves. */
export const roomKinds: MoldKind[] = ['roomCrown', 'roomBase', 'chairRail', 'casing', 'backBand', 'headCap', 'stool', 'apron'];

export const moldLabel: Record<MoldKind, string> = {
  crown: 'Crown', lightRail: 'Light rail', baseMold: 'Base', cap: 'Beadboard cap', panel: 'Panel moulding',
  roomCrown: 'Crown', roomBase: 'Baseboard', chairRail: 'Chair rail', casing: 'Casing', backBand: 'Back band', headCap: 'Header cap', stool: 'Stool', apron: 'Apron', cofferCrown: 'Coffer crown', cofferBead: 'Coffer bead', picture: 'Picture moulding',
};

/** Catalog categories that make sense for each spot, listed first in the picker. */
export const moldCategories: Record<MoldKind, string[]> = {
  crown: ['Crown', 'Scotia', 'Header Cap', 'Band'],
  lightRail: ['Base Board and Base Cap', 'Panel', 'Scotia', 'Crown', 'Band'],
  baseMold: ['Base Board and Base Cap', 'Shoe Moulding'],
  cap: ['Chair Rail', 'Panel', 'Base Board and Base Cap', 'Header Cap'],
  panel: ['Panel', 'Base Board and Base Cap', 'Band'],
  roomCrown: ['Crown', 'Header Cap', 'Band'],
  roomBase: ['Base Board and Base Cap', 'Shoe Moulding'],
  chairRail: ['Chair Rail', 'Panel', 'Picture Moulding'],
  casing: ['Window and Door Casing', 'Brick Mould'],
  backBand: ['Back Band', 'Panel'],
  headCap: ['Header Cap', 'Crown'],
  stool: ['Stool Cap'],
  apron: ['Apron', 'Window and Door Casing'],
  cofferCrown: ['Crown', 'Header Cap', 'Band'],
  cofferBead: ['Panel', 'Band', 'Miscellaneous', 'Back Band'],
  picture: ['Picture Moulding', 'Panel', 'Band'],
};
export const ceilingKinds: MoldKind[] = ['cofferCrown', 'cofferBead', 'picture'];

/** A moulding profile from either supplier. Brosco numbers are stored as BR-<number> so they never collide with A&M's. */
export type Profile = AMProfile & { supplier?: Supplier; code?: string; name?: string; wm?: string; custom?: CustomProfile };
export type Supplier = 'am' | 'brosco' | 'custom';
export const supplierName: Record<Supplier, string> = { am: 'Anderson & McQuaid', brosco: 'Brosco', custom: 'Custom-milled' };

/**
 * A profile milled to match the house's existing trim, from a sample: no catalog number, just its
 * size as installed and who mills it. Stored in place of a catalog number as custom:<category>:<h>x<d>:<by>.
 */
export interface CustomProfile { category: string; height: number; projection: number; by: 'shop' | 'supplier'; pts?: [number, number][] }

/** The open job's drawings of its custom profiles; the store keeps this in step with the design. */
let drawn: Project['profiles'] = {};
export const setCustomDrawings = (p: Project['profiles']) => { drawn = p ?? {}; };
export const customNum = (c: CustomProfile) => `custom:${c.category}:${c.height}x${c.projection}:${c.by}`;
export function parseCustom(num: string): CustomProfile | null {
  const m = /^custom:([^:]+):([\d.]+)x([\d.]+):(shop|supplier)$/.exec(num);
  return m ? { category: m[1], height: +m[2], projection: +m[3], by: m[4] as CustomProfile['by'] } : null;
}
function customProfile(num: string): Profile | undefined {
  const c = parseCustom(num);
  if (!c) return undefined;
  const d = drawn?.[num];
  return { num, category: c.category, t: c.projection, w: c.height, prices: {}, supplier: 'custom', custom: d && Array.isArray(d.pts) && d.pts.length > 2 ? { ...c, pts: d.pts } : c,
    name: d?.name || (c.by === 'shop' ? 'Milled in the shop to match' : 'Milled by the supplier to match') };
}
export const catalog: Profile[] = [...amCatalog, ...broscoCatalog];
export const supplierOf = (p: Profile): Supplier => p.supplier ?? 'am';
/** How a profile is named on an order: "A&M 1827" or "Brosco 8712". */
export const profileLabel = (p: Profile) => (p.custom ? `Custom ${p.custom.category.toLowerCase()}` : supplierOf(p) === 'brosco' ? `Brosco ${p.code}` : `A&M ${p.num}`);

export const profileByNum = (num?: string): Profile | undefined => (num ? catalog.find((p) => p.num === num) ?? customProfile(num) : undefined);

export const amSpecies = [...new Set(amCatalog.flatMap((p) => Object.keys(p.prices)))].sort();

/** Price per lineal foot in the job's species, or the closest thing A&M lists. */
export function priceOf(p: AMProfile, species: string): { species: string; price: number } | null {
  if (p.prices[species] != null) return { species, price: p.prices[species] };
  const first = Object.entries(p.prices)[0];
  return first ? { species: first[0], price: first[1] } : null;
}

/**
 * The profile turned so its flat back (the side that goes against the cabinet or wall) is at u = 0,
 * with u running out into the room and v up. Profiles without a traced shape fall back to a rectangle.
 */
export function mountShape(p: Profile): { pts: [number, number][]; depth: number; height: number } {
  // Milled to match: its size as installed, height down the wall (a crown's drop) by projection
  if (p.custom) {
    const { height: h, projection: d } = p.custom;
    if (p.custom.pts) return { pts: p.custom.pts, depth: d, height: h };
    const pts: [number, number][] = p.category === 'Crown' ? [[0, 0], [0.25, 0], [d, h - 0.25], [d, h], [0, h]] : [[0, 0], [d, 0], [d, h], [0, h]];
    return { pts, depth: d, height: h };
  }
  if (!p.shape || !p.sw || !p.sh) {
    // Crowns stand at about 45°; everything else lies flat against the face
    const [d, h] = p.category === 'Crown' ? [p.w * 0.7, p.w * 0.7] : [p.t, p.w];
    return { pts: [[0, 0], [d, 0], [d, h], [0, h]], depth: d, height: h };
  }
  const { sw, sh } = p;
  // Casings, baseboards and the like are often drawn lying down (wide and thin, back on the
  // bottom). Stand those up: the drawing's width becomes the face, its thickness the projection.
  if (lyingDown(p)) {
    const along = (axis: 0 | 1, at: number) => edgeRun(p.shape!, axis, at);
    const backBottom = along(1, 0) >= along(1, sh);
    // The thicker end goes at the bottom (a baseboard's foot, a casing's outer edge)
    const thick = (lo: boolean) => Math.max(0, ...p.shape!.filter(([x]) => (lo ? x < sw * 0.1 : x > sw * 0.9)).map(([, y]) => (backBottom ? y : sh - y)));
    const thickLeft = thick(true) >= thick(false);
    return {
      pts: p.shape!.map(([x, y]) => [backBottom ? y : sh - y, thickLeft ? x : sw - x]),
      depth: sh, height: sw,
    };
  }
  const flat = (atX: number) => {
    let len = 0;
    for (let i = 0; i < p.shape!.length; i++) {
      const [x1, y1] = p.shape![i];
      const [x2, y2] = p.shape![(i + 1) % p.shape!.length];
      if (Math.abs(x1 - atX) < 0.02 && Math.abs(x2 - atX) < 0.02) len += Math.abs(y2 - y1);
    }
    return len;
  };
  const backRight = flat(sw) > flat(0);
  return { pts: p.shape.map(([x, y]) => [backRight ? sw - x : x, y]), depth: sw, height: sh };
}

/** Total length of the outline's edges lying on one line (x = at, or y = at). */
function edgeRun(shape: [number, number][], axis: 0 | 1, at: number) {
  let len = 0;
  for (let i = 0; i < shape.length; i++) {
    const a = shape[i], b = shape[(i + 1) % shape.length];
    if (Math.abs(a[axis] - at) < 0.02 && Math.abs(b[axis] - at) < 0.02) len += Math.abs(b[1 - axis] - a[1 - axis]);
  }
  return len;
}

/** Kinds of moulding that lie flat on a wall, and whose drawings are sometimes made lying down. */
const flatKinds = ['Window and Door Casing', 'Base Board and Base Cap', 'Chair Rail', 'Apron', 'Back Band', 'Band', 'Panel', 'Brick Mould', 'Window Stops'];
function lyingDown(p: AMProfile) {
  if (!p.shape || !p.sw || !p.sh || !flatKinds.includes(p.category)) return false;
  if (p.sw < p.sh * 1.5) return false;
  const vertical = Math.max(edgeRun(p.shape, 0, 0), edgeRun(p.shape, 0, p.sw));
  const horizontal = Math.max(edgeRun(p.shape, 1, 0), edgeRun(p.shape, 1, p.sh));
  return horizontal > vertical;
}

export type MiterCut = 'square' | 'out' | 'in';
export interface MoldPiece {
  kind: MoldKind;
  num: string;
  /** Cabinet-local (or panel-local) start of the run and its direction. */
  along: 'x' | 'z';
  /** Which way the profile faces: out from the front (+z), a left (-x) or right (+x) end, or an island's back (-z, run right to left from x). */
  facing: 'front' | 'left' | 'right' | 'back';
  x: number;
  y: number;
  z: number;
  length: number;
  /** Turn the profile upside down (light rail hanging under a cabinet). */
  hang?: boolean;
  /**
   * How each end is cut, start then end: square, or a 45° miter. 'out' for an outside corner (the
   * length is measured on the moulding's face, its back shorter), 'in' for an inside corner (the
   * length is measured on its back, its face shorter). Unset = square.
   */
  cut?: [MiterCut, MiterCut];
  /** Run straight up from (x, y) instead of along x: a casing leg, its face widening to the left or right. */
  vertical?: 'left' | 'right';
}

/** Moulding pieces for one cabinet, in its own coordinates. */
/** A cabinet's mouldings. noCrown: it runs up under a coffer's perimeter fascia, which carries the crown instead. */
export function cabinetMoldings(c: Cabinet, s: ShopSettings, ends: EndInfo, opts: { noCrown?: boolean } = {}): MoldPiece[] {
  const out: MoldPiece[] = [];
  if (c.kind === 'mantel') return mantelMoldings(c, ends);
  const ext = panelExtents(c, s, ends);
  // Base runs on the door faces, or on a pilaster's plinth block
  const doorFace = c.kind === 'pilaster' ? c.depth + pilasterOf(c).proud : c.depth + s.doorThickness * (s.doorMount === 'inset' ? 0 : 1);
  const runs: { kind: MoldKind; num?: string; y: (h: number) => number; z: number; hang?: boolean; out?: number }[] = [
    // Light rail hangs below the bottom, on the face frame
    { kind: 'lightRail', num: c.lightRail, y: () => 0, z: c.depth, hang: true },
  ];
  const bl = baseLayout(c, s);
  const ps = c.kind === 'pilaster' ? pilasterOf(c) : null;
  if (ps?.wrap && ps.wrap.h > 0) {
    // A pilaster's wrapped base: the cap is the same moulding as the casework beside it, carried
    // across the pilaster's face; where the pilaster stands out past its neighbours it returns
    // back to theirs at an inside corner, so the cap reads as one continuous run
    const num = c.baseMold ?? ends.baseBeside?.('left')?.num ?? ends.baseBeside?.('right')?.num;
    const p = profileByNum(num);
    if (p) {
      const m = mountShape(p);
      const { h } = ps.wrap;
      // On top of the wrapped baseboard, its back against the pilaster's face (or plinth block)
      const face = ps.plinth > 0 ? c.depth + ps.proud : c.depth;
      const wall = ends.wall ?? { left: false, right: false };
      const back = (side: 'left' | 'right') => ends.baseBeside?.(side)?.z ?? 0;
      const ret = { left: !wall.left && face - back('left') > 0.01, right: !wall.right && face - back('right') > 0.01 };
      const x0 = ret.left ? -m.depth : 0, x1 = c.width + (ret.right ? m.depth : 0);
      out.push({ kind: 'baseMold', num: p.num, along: 'x', facing: 'front', x: x0, y: h, z: face, length: x1 - x0, cut: [ret.left ? 'out' : 'square', ret.right ? 'out' : 'square'] });
      for (const side of ['left', 'right'] as const) {
        if (!ret[side]) continue;
        const z0 = back(side);
        out.push({ kind: 'baseMold', num: p.num, along: 'z', facing: side, x: side === 'left' ? 0 : c.width, y: h, z: z0, length: face + m.depth - z0, cut: [z0 > 0.01 ? 'in' : 'square', 'out'] });
      }
    }
  } else if (bl.style === 'kick') {
    // Base runs along the floor across the door faces, furniture style
    runs.push({ kind: 'baseMold', num: c.baseMold, y: () => 0, z: doorFace });
  } else {
    // A cap on top of the baseboard or skirt, wrapping its returns
    // The cap sits on top of the baseboard or skirt, its back against the face the board is fastened to
    runs.push({ kind: 'baseMold', num: c.baseMold, y: () => bl.flat, z: c.depth });
  }
  if (c.kind !== 'base' && !opts.noCrown) {
    // Crown and any extra mouldings stack down from the top of the build, on the sub-crown's face
    const L = crownLayout(c, s);
    let cursor = L.crownTop;
    for (const num of [c.crown, ...L.build.extra]) {
      const p = profileByNum(num);
      if (!p) continue;
      const top = cursor;
      runs.push({ kind: 'crown', num, y: (h) => top - h, z: L.face, out: L.subT });
      cursor -= mountShape(p).height;
    }
  }
  for (const r of runs) {
    const p = profileByNum(r.num);
    if (!p) continue;
    const m = mountShape(p);
    const y = r.y(m.height);
    const o = r.out ?? 0;
    const xl = -ext.left - (ends.left ? o : 0);
    const xr = c.width + ext.right + (ends.right ? o : 0);
    const x0 = xl - (ends.left ? m.depth : 0);
    const x1 = xr + (ends.right ? m.depth : 0);
    // Beside a proud pilaster with a wrapped base, the base cap stops at the wrap's return, inside-mitered
    const wrapL = r.kind === 'baseMold' && !ends.left ? ends.wrapBeside?.('left') ?? null : null;
    const wrapR = r.kind === 'baseMold' && !ends.right ? ends.wrapBeside?.('right') ?? null : null;
    const corner = (side: 'left' | 'right'): MiterCut => (ends[side] ? 'out' : (side === 'left' ? wrapL : wrapR) != null ? 'in' : 'square');
    const sx0 = x0, sx1 = x1;
    out.push({ kind: r.kind, num: p.num, along: 'x', facing: 'front', x: sx0, y, z: r.z, length: sx1 - sx0, hang: r.hang, cut: [corner('left'), corner('right')] });
    // An island's base wraps its finished back too
    const zb = !c.island || r.kind !== 'baseMold' ? null : c.islandSides === 2 ? -r.z - m.depth : -s.endPanelThickness - o - m.depth;
    if (zb != null) out.push({ kind: r.kind, num: p.num, along: 'x', facing: 'back', x: x1, y, z: zb + m.depth, length: x1 - x0, cut: [corner('right'), corner('left')] });
    // Returns back to the wall on exposed ends, or back to the neighbour's face beside a pilaster
    for (const side of ['left', 'right'] as const) {
      if (!ends[side]) continue;
      const z0 = zb ?? (ends.faceAt ? ends.faceAt(side, y + m.height / 2) : 0);
      const len = r.z + m.depth - z0;
      // Mitered to the front run; at the back it dies into the wall, or meets the run beside it at an inside corner
      if (len > 0.01) out.push({ kind: r.kind, num: p.num, along: 'z', facing: side, x: side === 'left' ? xl : xr, y, z: z0, length: len, hang: r.hang, cut: [zb != null ? 'out' : z0 > 0.01 ? 'in' : 'square', 'out'] });
    }
  }
  return out;
}

/** A mantel's bed moulding under the shelf, across the legs and frieze, and base around the plinths; both return to the wall. */
function mantelMoldings(c: Cabinet, ends: EndInfo): MoldPiece[] {
  const L = mantelLayout(c);
  const m = mantelOf(c);
  const out: MoldPiece[] = [];
  const runs: { kind: MoldKind; num?: string; y: (h: number) => number; z: number; x0: number; x1: number }[] = [
    { kind: 'crown', num: c.crown, y: (h) => L.shelfBottom - h, z: L.legFace, x0: 0, x1: c.width },
    { kind: 'baseMold', num: c.baseMold, y: () => 0, z: L.legFace + (m.plinth > 0 ? m.blockProud : 0), x0: -(m.plinth > 0 ? m.blockProud : 0), x1: c.width + (m.plinth > 0 ? m.blockProud : 0) },
  ];
  for (const r of runs) {
    const p = profileByNum(r.num);
    if (!p) continue;
    const mm = mountShape(p);
    const y = r.y(mm.height);
    const x0 = r.x0 - (ends.left ? mm.depth : 0), x1 = r.x1 + (ends.right ? mm.depth : 0);
    out.push({ kind: r.kind, num: p.num, along: 'x', facing: 'front', x: x0, y, z: r.z, length: x1 - x0, cut: [ends.left ? 'out' : 'square', ends.right ? 'out' : 'square'] });
    for (const side of ['left', 'right'] as const) {
      if (!ends[side]) continue;
      out.push({ kind: r.kind, num: p.num, along: 'z', facing: side, x: side === 'left' ? r.x0 : r.x1, y, z: 0, length: r.z + mm.depth, cut: ['square', 'out'] });
    }
  }
  return out;
}

/** Cap moulding along the top of a beadboard panel, in the panel's wall coordinates. */
export function panelMoldings(w: WallPanel): MoldPiece[] {
  const p = profileByNum(w.capProfile);
  if (!w.cap || !p) return [];
  return [{ kind: 'cap', num: p.num, along: 'x', facing: 'front', x: 0, y: w.bottom + w.height, z: 0, length: w.width }];
}

export interface MoldOrderLine { num: string; supplier: Supplier; profile: Profile; kinds: MoldKind[]; inches: number; feet: number; species: string; price: number | null; cost: number }

/** Lineal feet to order from Anderson & McQuaid, by profile, with waste for miters and defects. */
export function moldingOrder(p: Project): MoldOrderLine[] {
  const s = p.settings;
  const totals = new Map<string, { inches: number; kinds: Set<MoldKind> }>();
  const add = (pc: MoldPiece) => {
    const t = totals.get(pc.num) ?? { inches: 0, kinds: new Set<MoldKind>() };
    t.inches += pc.length;
    t.kinds.add(pc.kind);
    totals.set(pc.num, t);
  };
  for (const c of p.cabinets) {
    if (!c.crown && !c.lightRail && !c.baseMold && !c.crownBuild?.extra.length) continue;
    cabinetMoldings(c, s, resolveEnds(p.room, p.cabinets, c), { noCrown: underFascia(p, c) }).forEach(add);
  }
  for (const w of p.panels ?? []) panelMoldings(w).forEach(add);
  // Room trim and casing are design-only unless the job includes them
  if (inScope(p, 'roomTrim')) roomMoldingPieces(p).forEach(add);
  // Coffered ceiling: crown in every coffer, bead on the fascia edges, picture moulding around the room
  const cc = cofferOf(p);
  if (cc.on) {
    const m = cofferMoldings(p, cc);
    const piece = (kind: MoldKind, num: string | undefined, length: number) => { if (num && profileByNum(num) && length > 0) add({ kind, num, along: 'x', facing: 'front', x: 0, y: 0, z: 0, length }); };
    piece('cofferCrown', cc.crown, m.crown);
    piece('cofferBead', cc.bead, m.bead);
    piece('picture', cc.picture, m.picture);
  }
  // Panel moulding mitered around each opening of a shop-built pilaster
  for (const c of p.cabinets) {
    const ps = c.kind === 'pilaster' ? pilasterOf(c) : null;
    if (!ps?.panelMold || ps.face !== 'shop' || !profileByNum(ps.panelMold)) continue;
    for (const o of pilasterOpenings(c)) add({ kind: 'panel', num: ps.panelMold, along: 'x', facing: 'front', x: 0, y: 0, z: 0, length: 2 * (o.w + o.h) });
  }
  return [...totals].map(([num, t]) => {
    const profile = profileByNum(num)!;
    const feet = Math.ceil((t.inches / 12) * (1 + s.moldWaste));
    // A price entered for the job (Brosco, or an A&M quote) beats the list price
    const own = p.moldPrices?.[num];
    const pr = own != null ? { species: s.moldSpecies, price: own } : priceOf(profile, s.moldSpecies);
    return { num, supplier: supplierOf(profile), profile, kinds: [...t.kinds], inches: t.inches, feet, species: pr?.species ?? s.moldSpecies, price: pr?.price ?? null, cost: pr ? pr.price * feet : 0 };
  });
}
