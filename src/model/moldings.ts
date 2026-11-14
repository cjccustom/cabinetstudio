// Mouldings from the Anderson & McQuaid catalog: crown, light rail and base on cabinets, caps on
// beadboard. Each run follows the cabinet face and returns along exposed ends.
import { roomProjects } from './rooms';
import type { Cabinet, Project, ShopSettings, WallPanel } from './types';
import { mantelLayout, mantelOf, neckAt, upperSetback, upperTop } from './mantel';
import { amCatalog, type AMProfile } from './andersonMcquaid';
import { broscoCatalog } from './brosco';
import { nextDayCatalog } from './nextDay';
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

/** Cabinets that can take a light rail under them: uppers, and any cabinet hung off the floor (a tall upper section, a raised bookcase). */
export const takesLightRail = (c: Cabinet) => c.kind === 'wall' || (c.kind === 'tall' && c.elevation > 6);

/** Catalog categories that make sense for each spot, listed first in the picker. */
export const moldCategories: Record<MoldKind, string[]> = {
  crown: ['Crown', 'Scotia', 'Header Cap', 'Band'],
  lightRail: ['Back Band', 'Base Board and Base Cap', 'Panel', 'Scotia', 'Band', 'Crown'],
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
export type Profile = AMProfile & { supplier?: Supplier; code?: string; name?: string; wm?: string; custom?: CustomProfile; url?: string; lengths?: string; fit?: { depth: number; height: number } };
export type Supplier = 'am' | 'brosco' | 'nextday' | 'custom';
export const supplierName: Record<Supplier, string> = { am: 'Anderson & McQuaid', brosco: 'Brosco', nextday: 'Next Day', custom: 'Custom-milled' };

/**
 * A profile milled to match the house's existing trim, from a sample: no catalog number, just its
 * size as installed and who mills it. Stored in place of a catalog number as custom:<category>:<h>x<d>:<by>.
 */
export interface CustomProfile { category: string; height: number; projection: number; by: 'shop' | 'supplier'; pts?: [number, number][]; /** Drawn in the part builder: its part id. */ part?: string }

/** The open job's drawings of its custom profiles; the store keeps this in step with the design. */
let drawn: Project['profiles'] = {};
export const setCustomDrawings = (p: Project['profiles']) => { drawn = p ?? {}; };
export const customNum = (c: CustomProfile) => `custom:${c.category}:${c.height}x${c.projection}:${c.by}${c.part ? `:${c.part}` : ''}`;
export function parseCustom(num: string): CustomProfile | null {
  // custom:<category>:<h>x<d>:<by>, with the part builder's part id after it for a drawn moulding
  const m = /^custom:([^:]+):([\d.]+)x([\d.]+):(shop|supplier)(?::([\w-]+))?$/.exec(num);
  return m ? { category: m[1], height: +m[2], projection: +m[3], by: m[4] as CustomProfile['by'], ...(m[5] ? { part: m[5] } : {}) } : null;
}
function customProfile(num: string): Profile | undefined {
  const c = parseCustom(num);
  if (!c) return undefined;
  const d = drawn?.[num];
  return { num, category: c.category, t: c.projection, w: c.height, prices: {}, supplier: 'custom', custom: d && Array.isArray(d.pts) && d.pts.length > 2 ? { ...c, pts: d.pts } : c,
    name: d?.name || (c.by === 'shop' ? 'Milled in the shop to match' : 'Milled by the supplier to match') };
}
export const catalog: Profile[] = [...amCatalog, ...broscoCatalog, ...nextDayCatalog];
export const supplierOf = (p: Profile): Supplier => p.supplier ?? 'am';
/** How a profile is named on an order: "A&M 1827" or "Brosco 8712". */
export const profileLabel = (p: Profile) => (p.custom ? (p.name && (p.custom.part || drawn?.[p.num]?.name) ? p.name : `Custom ${p.custom.category.toLowerCase()}`) : supplierOf(p) === 'brosco' ? `Brosco ${p.code}` : supplierOf(p) === 'nextday' ? `Next Day ${p.code}` : `A&M ${p.num}`);

/** A profile as the customer sees it: its number, not who sells it. */
export const customerProfile = (p: Profile) => (p.custom ? 'custom profile, milled to match' : `profile ${supplierOf(p) === 'am' ? p.num : p.code}`);

/**
 * Customer-facing text with the suppliers taken out: moulding profiles by number alone, and no door
 * maker's name. Cody doesn't hide that he buys doors and mouldings, but the customer doesn't need to
 * know from whom. The shop's drawings and orders keep the names.
 */
export function forCustomer(text: string): string {
  return text
    .replace(/\bBrosco (?=[A-Z]{0,3}-?\d)/gi, 'profile ')
    .replace(/\bNext Day (?=\d)/gi, 'profile ')
    .replace(/\bA(?:&|&amp;)M (?=[A-Z]{0,3}-?\d)/gi, 'profile ')
    .replace(/\bEagle(?:’s|'s|&#39;s)? /gi, '')
    .replace(/\bEagle\b/gi, 'the door maker');
}

export const profileByNum = (num?: string): Profile | undefined => (num ? catalog.find((p) => p.num === num) ?? customProfile(num) : undefined);

export const amSpecies = [...new Set([...amCatalog, ...nextDayCatalog].flatMap((p) => Object.keys(p.prices)))].sort();

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
  const m = rawMount(p);
  return p.category === 'Base Board and Base Cap' && p.shape && !p.custom ? baseUpright(m) : m;
}

/**
 * Stand a baseboard or base cap the way it goes on, whatever way its supplier drew it: the full
 * thickness flat edge at the bottom (on the floor, or on the board it caps), and the back as the
 * side that runs straight up to the top edge against the wall, the moulding on the room side.
 */
function baseUpright(m: { pts: [number, number][]; depth: number; height: number }) {
  const { depth: d, height: h } = m;
  let pts = m.pts;
  const run = (y: number) => {
    let len = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if (Math.abs(a[1] - y) < 0.03 && Math.abs(b[1] - y) < 0.03) len += Math.abs(b[0] - a[0]);
    }
    return len;
  };
  // Only a full baseboard is turned over by its flat foot; caps that hook over the board keep their drawing's way up
  if (h >= 2.5 && run(h) > run(0) + 0.02) pts = pts.map(([x, y]) => [x, h - y]);
  const mirror = () => { pts = pts.map(([x, y]) => [d - x, y]); };
  // The surest sign of the back: a relief kerf, a shallow recess down the middle of one side with that
  // side back at the edge above and below it
  const kerf = (atRight: boolean) => {
    const edge = (x: number) => (atRight ? d - x : x);
    // Up-and-down edges set in from this side by a kerf's depth, at least 30% of the height between them
    let len = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const ea = edge(a[0]), eb = edge(b[0]);
      if (ea >= 0.03 && ea <= 0.2 && eb >= 0.03 && eb <= 0.2 && Math.abs(ea - eb) < 0.02 && Math.abs(b[1] - a[1]) > Math.abs(b[0] - a[0]) * 4) len += Math.abs(b[1] - a[1]);
    }
    const lo = pts.some(([x, y]) => y < h * 0.25 && edge(x) < 0.03), hi = pts.some(([x, y]) => y > h * 0.75 && edge(x) < 0.03);
    return lo && hi && len >= h * 0.3 ? len : 0;
  };
  const kl = kerf(false), kr = kerf(true);
  if (kr > 0 && !kl) { mirror(); return { pts, depth: d, height: h }; }
  if (kl > 0 && !kr) return { pts, depth: d, height: h };
  // No kerf to go by: the back runs up to the top edge against the wall, the moulding falls away from it
  const top = pts.filter(([, y]) => y > h * 0.9);
  if (top.length) {
    const lo = Math.min(...top.map(([x]) => x)), hi = Math.max(...top.map(([x]) => x));
    if (lo > d * 0.15 && hi > d * 0.85) mirror();
  }
  return { pts, depth: d, height: h };
}

function rawMount(p: Profile): { pts: [number, number][]; depth: number; height: number } {
  // Milled to match: its size as installed, height down the wall (a crown's drop) by projection
  if (p.custom) {
    const { height: h, projection: d } = p.custom;
    if (p.custom.pts) return { pts: p.custom.pts, depth: d, height: h };
    const pts: [number, number][] = p.category === 'Crown' ? [[0, 0], [0.25, 0], [d, h - 0.25], [d, h], [0, h]] : [[0, 0], [d, 0], [d, h], [0, h]];
    return { pts, depth: d, height: h };
  }
  if (!p.shape || !p.sw || !p.sh) {
    // A crown with its projection and drop known (Next Day lists them): a sprung crown of that size
    if (p.fit && p.category === 'Crown') {
      const { depth: d, height: h } = p.fit;
      const t = Math.min(p.t, d / 2, h / 2);
      return { pts: [[0, 0], [t, 0], [d, h - t], [d, h], [0, h]], depth: d, height: h };
    }
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
  /** Ends that butt the same moulding on the next cabinet: drawn without an end line, so the run reads as one piece. */
  joined?: [boolean, boolean];
  /** Run straight up from (x, y) instead of along x: a casing leg, its face widening to the left or right. */
  vertical?: 'left' | 'right';
  /** For the shop's cut list: what this moulding is here ("Bed moulding under the shelf") and where the piece goes. */
  label?: string;
  where?: string;
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
    // Crown turning a room's inside corner with the cabinet on the next wall: both runs end where
    // their backs meet, inside-mitered, instead of crossing
    const inCorner = (side: 'left' | 'right') => {
      if ((r.kind !== 'crown' && r.kind !== 'lightRail' && r.kind !== 'baseMold') || ends[side]) return null;
      const k = ends.corner?.(side);
      if (!k) return null;
      const o = k.other;
      // Where the other cabinet's run of the same moulding sits: off its wall, and its height in the room
      let back: number, oy: number, my: number;
      if (r.kind === 'crown') {
        if (o.crown !== r.num) return null;
        const Lo = crownLayout(o, s);
        back = Lo.face; oy = o.elevation + Lo.crownTop; my = c.elevation + crownLayout(c, s).crownTop;
      } else if (r.kind === 'lightRail') {
        if (o.lightRail !== r.num) return null;
        back = o.depth; oy = o.elevation; my = c.elevation;
      } else {
        if (o.baseMold !== r.num || baseLayout(o, s).style !== 'baseboard' || bl.style !== 'baseboard') return null;
        back = o.depth; oy = o.elevation + baseLayout(o, s).flat; my = c.elevation + bl.flat;
      }
      if (Math.abs(oy - my) > 0.5) return null;
      back += o.wallInset ?? 0;
      return side === 'right' ? k.wallX - back : k.wallX + back;
    };
    const cl = inCorner('left'), cr = inCorner('right');
    const corner = (side: 'left' | 'right'): MiterCut => (ends[side] ? 'out' : (side === 'left' ? cl : cr) != null || (side === 'left' ? wrapL : wrapR) != null ? 'in' : 'square');
    const sx0 = cl ?? x0, sx1 = cr ?? x1;
    // The same moulding carrying on into the cabinet beside it, at the same height and depth: one continuous run
    const carries = (side: 'left' | 'right') => {
      if (ends[side] || (side === 'left' ? cl : cr) != null) return false;
      const o = ends.beside?.(side);
      if (!o) return false;
      // Crown: the same profile at the same height off the floor on the same face, whatever the cabinets' own sizes
      if (r.kind === 'crown') {
        if (o.crown !== r.num) return false;
        const Lo = crownLayout(o, s), Lc = crownLayout(c, s);
        return Math.abs(o.elevation + Lo.crownTop - (c.elevation + Lc.crownTop)) < 1 / 32 && Math.abs(Lo.face + (o.wallInset ?? 0) - (Lc.face + (c.wallInset ?? 0))) < 1 / 32;
      }
      if (o.depth !== c.depth || o.elevation !== c.elevation) return false;
      if (r.kind === 'baseMold') return o.baseMold === r.num && baseLayout(o, s).flat === bl.flat && baseLayout(o, s).style === bl.style;
      if (r.kind === 'lightRail') return o.lightRail === r.num;
      return false;
    };
    out.push({ kind: r.kind, num: p.num, along: 'x', facing: 'front', x: sx0, y, z: r.z, length: sx1 - sx0, hang: r.hang, cut: [corner('left'), corner('right')], joined: [carries('left'), carries('right')] });
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
  const W = c.width, D = c.depth;
  const zc = D - m.stock;
  /** Around one leg: across its face, mitered at both corners, and back along each side to `back` (or to the frieze on the inside). */
  const aroundLeg = (kind: MoldKind, num: string, y: number, x0: number, w: number, face: number, back: number, inner: number | null, label?: string) => {
    const d = mountShape(profileByNum(num)!).depth;
    const left = x0 < W / 2;
    out.push({ kind, num, along: 'x', facing: 'front', x: x0 - d, y, z: face, length: w + 2 * d, cut: ['out', 'out'], label, where: 'each leg, across its face' });
    const outer = left ? x0 : x0 + w, innerX = left ? x0 + w : x0;
    out.push({ kind, num, along: 'z', facing: left ? 'left' : 'right', x: outer, y, z: back, length: face + d - back, cut: ['square', 'out'], label, where: 'each leg, outer side, back to the chimney' });
    const ib = inner ?? back;
    out.push({ kind, num, along: 'z', facing: left ? 'right' : 'left', x: innerX, y, z: ib, length: face + d - ib, cut: [inner != null ? 'in' : 'square', 'out'], label, where: inner != null ? 'each leg, inner side, back to the frieze' : 'each leg, inner side, back to the chimney' });
  };
  // Bed moulding on pilaster legs proud of the frieze: around each leg, and across the frieze between
  const bed = profileByNum(c.crown);
  const stepped = !!bed && m.legs !== 'none' && L.proud > 0.01 && L.legW > 0.5;
  if (stepped) {
    const y = L.shelfBottom - mountShape(bed).height;
    for (const x0 of [0, W - L.legW]) aroundLeg('crown', bed.num, y, x0, L.legW, L.legFace, 0, D, 'Bed moulding under the shelf');
    out.push({ kind: 'crown', num: bed.num, along: 'x', facing: 'front', x: L.legW, y, z: D, length: W - 2 * L.legW, cut: ['in', 'in'], label: 'Bed moulding under the shelf', where: 'across the frieze, between the legs' });
  }
  // Neck moulding around the legs where their panels break
  const neck = profileByNum(m.neckMold), ny = neckAt(c, m);
  if (neck && ny != null && L.legW > 0.5) for (const x0 of [0, W - L.legW]) aroundLeg('panel', neck.num, ny - mountShape(neck).height / 2, x0, L.legW, L.legFace, m.chimney ? zc : 0, L.proud > 0.01 ? D : null, 'Neck moulding around the legs');
  // Cap around the tops of the upper pilasters
  const cap = profileByNum(m.upper.capMold);
  if (cap && m.upper.on && L.legW > 0.5) {
    const sb = upperSetback(m);
    for (const x0 of [0, W - L.legW]) aroundLeg('crown', cap.num, upperTop(c, m) - mountShape(cap).height, x0, L.legW, L.legFace - sb, m.chimney ? zc - sb : 0, null, 'Cap moulding atop the upper pilasters');
  }
  const runs: { kind: MoldKind; num?: string; y: (h: number) => number; z: number; x0: number; x1: number }[] = [
    ...(stepped ? [] : [{ kind: 'crown' as MoldKind, num: c.crown, y: (h: number) => L.shelfBottom - h, z: L.legFace, x0: 0, x1: c.width }]),
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

export interface MoldOrderLine { num: string; supplier: Supplier; profile: Profile; kinds: MoldKind[]; inches: number; feet: number; species: string; price: number | null; cost: number; /** A Brosco profile priced from the Next Day item it's bought as. */ via?: Profile }

/**
 * The Next Day item a Brosco profile is bought as: the one picked for this job, or the one Next Day
 * lists under that Brosco number ("5089 B665 Basecap").
 */
export function nextDayFor(p: { moldSource?: Record<string, string> }, prof: Profile): Profile | undefined {
  if (supplierOf(prof) !== 'brosco') return undefined;
  const picked = p.moldSource?.[prof.num];
  if (picked === '') return undefined;
  if (picked) return profileByNum(picked);
  const code = (prof as Profile & { code?: string }).code;
  return code ? nextDayCatalog.find((n) => new RegExp(`(^|\\W)${code}(\\W|$)`, 'i').test(n.name)) : undefined;
}

/** Next Day items that could stand in for a Brosco profile: same kind of moulding, nearest in size first. */
export function nextDayChoices(prof: Profile): Profile[] {
  return nextDayCatalog.filter((n) => n.category === prof.category)
    .sort((a, b) => Math.abs(a.t - prof.t) + Math.abs(a.w - prof.w) - (Math.abs(b.t - prof.t) + Math.abs(b.w - prof.w)));
}

/** Lineal feet to order from Anderson & McQuaid, by profile, with waste for miters and defects. */
export function moldingOrder(job: Project): MoldOrderLine[] {
  const totals = new Map<string, { inches: number; kinds: Set<MoldKind> }>();
  const add = (pc: MoldPiece) => {
    const t = totals.get(pc.num) ?? { inches: 0, kinds: new Set<MoldKind>() };
    t.inches += pc.length;
    t.kinds.add(pc.kind);
    totals.set(pc.num, t);
  };
  // Every room's mouldings, one line per profile for the whole job
  for (const p of roomProjects(job)) collectMoldings(p, add);
  return moldLines(job, totals);
}

function collectMoldings(p: Project, add: (pc: MoldPiece) => void) {
  const s = p.settings;
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
}

function moldLines(p: Project, totals: Map<string, { inches: number; kinds: Set<MoldKind> }>): MoldOrderLine[] {
  const s = p.settings;
  return [...totals].map(([num, t]) => {
    const profile = profileByNum(num)!;
    const feet = Math.ceil((t.inches / 12) * (1 + s.moldWaste));
    // A price entered for the job (Brosco, or an A&M quote) beats the list price
    const own = p.moldPrices?.[num];
    // A Brosco profile bought from Next Day takes Next Day's price
    const via = own == null ? nextDayFor(p, profile) : undefined;
    const pr = own != null ? { species: s.moldSpecies, price: own } : via ? priceOf(via, s.moldSpecies) : priceOf(profile, s.moldSpecies);
    return { num, supplier: supplierOf(profile), profile, kinds: [...t.kinds], inches: t.inches, feet, species: pr?.species ?? s.moldSpecies, price: pr?.price ?? null, cost: pr ? pr.price * feet : 0, via };
  });
}
