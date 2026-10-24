// Mouldings from the Anderson & McQuaid catalog: crown, light rail and base on cabinets, caps on
// beadboard. Each run follows the cabinet face and returns along exposed ends.
import type { Cabinet, Project, ShopSettings, WallPanel } from './types';
import { amCatalog, type AMProfile } from './andersonMcquaid';
import { broscoCatalog } from './brosco';
import { crownLayout, panelExtents, type EndInfo } from './parts';
import { pilasterOf, pilasterOpenings } from './pilaster';
import { inScope, roomMoldingPieces } from './room';
import { resolveEnds } from './layout';
import { cofferMoldings, cofferOf } from './coffer';
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
  crown: ['Crown', 'Header Cap', 'Band'],
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
export type Profile = AMProfile & { supplier?: 'am' | 'brosco'; code?: string; name?: string; wm?: string };
export type Supplier = 'am' | 'brosco';
export const supplierName: Record<Supplier, string> = { am: 'Anderson & McQuaid', brosco: 'Brosco' };
export const catalog: Profile[] = [...amCatalog, ...broscoCatalog];
export const supplierOf = (p: Profile): Supplier => p.supplier ?? 'am';
/** How a profile is named on an order: "A&M 1827" or "Brosco 8712". */
export const profileLabel = (p: Profile) => (supplierOf(p) === 'brosco' ? `Brosco ${p.code}` : `A&M ${p.num}`);

export const profileByNum = (num?: string): Profile | undefined => (num ? catalog.find((p) => p.num === num) : undefined);

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
export function mountShape(p: AMProfile): { pts: [number, number][]; depth: number; height: number } {
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

export interface MoldPiece {
  kind: MoldKind;
  num: string;
  /** Cabinet-local (or panel-local) start of the run and its direction. */
  along: 'x' | 'z';
  /** Which way the profile faces: out from the front (+z), or out from a left (-x) or right (+x) end. */
  facing: 'front' | 'left' | 'right';
  x: number;
  y: number;
  z: number;
  length: number;
  /** Turn the profile upside down (light rail hanging under a cabinet). */
  hang?: boolean;
  /** Run straight up from (x, y) instead of along x: a casing leg, its face widening to the left or right. */
  vertical?: 'left' | 'right';
}

/** Moulding pieces for one cabinet, in its own coordinates. */
export function cabinetMoldings(c: Cabinet, s: ShopSettings, ends: EndInfo): MoldPiece[] {
  const out: MoldPiece[] = [];
  const ext = panelExtents(c, s, ends);
  // Base runs on the door faces, or on a pilaster's plinth block
  const doorFace = c.kind === 'pilaster' ? c.depth + pilasterOf(c).proud : c.depth + s.doorThickness * (s.doorMount === 'inset' ? 0 : 1);
  const runs: { kind: MoldKind; num?: string; y: (h: number) => number; z: number; hang?: boolean; out?: number }[] = [
    // Light rail hangs below the bottom, on the face frame
    { kind: 'lightRail', num: c.lightRail, y: () => 0, z: c.depth, hang: true },
  ];
  const bl = baseLayout(c, s);
  if (bl.style === 'kick') {
    // Base runs along the floor across the door faces, furniture style
    runs.push({ kind: 'baseMold', num: c.baseMold, y: () => 0, z: doorFace });
  } else {
    // A cap on top of the baseboard or skirt, wrapping its returns
    runs.push({ kind: 'baseMold', num: c.baseMold, y: () => bl.flat, z: c.depth + bl.out, out: bl.out });
  }
  if (c.kind !== 'base') {
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
    out.push({ kind: r.kind, num: p.num, along: 'x', facing: 'front', x: x0, y, z: r.z, length: x1 - x0, hang: r.hang });
    // Returns back to the wall on exposed ends, or back to the neighbour's face beside a pilaster
    for (const side of ['left', 'right'] as const) {
      if (!ends[side]) continue;
      const z0 = ends.faceAt ? ends.faceAt(side, y + m.height / 2) : 0;
      const len = r.z + m.depth - z0;
      if (len > 0.01) out.push({ kind: r.kind, num: p.num, along: 'z', facing: side, x: side === 'left' ? xl : xr, y, z: z0, length: len, hang: r.hang });
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
    cabinetMoldings(c, s, resolveEnds(p.room, p.cabinets, c)).forEach(add);
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
