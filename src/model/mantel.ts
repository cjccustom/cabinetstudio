// Fireplace mantels and surrounds, built up from parts the way CJC builds them: a leg each side
// (a pilaster standing proud, or a flat leg), plinth and capital blocks, a frieze across the top of
// the opening, a shelf with a bed moulding under it, brackets under the shelf, and an optional
// pediment on top. The firebox is an electric or gas insert, or an existing wood-burning firebox.
// Cabinet-local coordinates like every cabinet: x across from the left leg, y up, z out from the wall.
// width is the outside of the legs, height the top of the shelf, depth the wall to the frieze face.
import type { Cabinet, CutShape, Part, ShopSettings } from './types';
import type { Appliance } from './appliances';
import { vb } from './parts';
import { fmt } from '../units';
import { mountShape, profileByNum } from './moldings';

export type Fuel = 'electric' | 'gas' | 'wood';

export interface MantelSpec {
  fuel: Fuel;
  /** The opening the surround frames: an insert's framing opening, or the masonry firebox opening. */
  openingW: number;
  openingH: number;
  /** Bottom of the opening off the floor (a raised electric insert, or the hearth). */
  openingY: number;
  /** Surround's inside edge to the opening; wood-burning needs 6" of noncombustible facing. */
  margin: number;
  /** The insert, for electric and gas (sizes from its manual). */
  insert?: Appliance;
  legs: 'pilaster' | 'flat' | 'none';
  /** Pilaster legs stand proud of the frieze by this much. */
  legProud: number;
  plinth: number;
  capital: number;
  /** How far plinth and capital blocks stand proud of the leg face. */
  blockProud: number;
  shelfThickness: number;
  /** Wall to the front of the shelf. */
  shelfDepth: number;
  /** Shelf past the outside of the legs, each end. */
  shelfOverhang: number;
  corbels: 0 | 2 | 4;
  corbelW: number;
  corbelH: number;
  pediment: 'none' | 'triangle' | 'arch';
  pedimentH: number;
  stock: number;
  species: string;
  /**
   * masonry: a site-built masonry fireplace (or an insert set into one), under IRC R1001.
   * factory: a listed factory-built or zero-clearance fireplace (IRC R1004, UL 127), installed per its listing.
   */
  install: 'masonry' | 'factory';
  /** Hearth extension in front of the opening and past each side, and its thickness (masonry wood-burning). */
  hearthFront: number;
  hearthSide: number;
  hearthThickness: number;
  /**
   * The insert or fireplace manual's mantel chart: combustible trim kept this far from the opening's
   * sides, and each row allows trim up to maxDepth deep once it's at least `above` over the opening top.
   */
  manual: { sideGap: number; rows: { above: number; maxDepth: number }[] };
}

export const fuelLabel: Record<Fuel, string> = { electric: 'Electric insert', gas: 'Gas insert', wood: 'Existing wood-burning firebox' };

export const defaultMantel: MantelSpec = {
  fuel: 'electric', openingW: 36.625, openingH: 26.25, openingY: 12, margin: 0,
  insert: { kind: 'fireplace', model: 'Dimplex RBF36', w: 36.625, h: 26.25, d: 12.125, side: 0, top: 0, back: 0, mount: 'flush' },
  legs: 'pilaster', legProud: 0.75, plinth: 6, capital: 4, blockProud: 0.5,
  shelfThickness: 2, shelfDepth: 10, shelfOverhang: 2, corbels: 2, corbelW: 3.5, corbelH: 7,
  pediment: 'none', pedimentH: 8, stock: 0.75, species: 'Poplar',
  install: 'factory', hearthFront: 20, hearthSide: 12, hearthThickness: 2, manual: { sideGap: 0, rows: [] },
};
export const mantelOf = (c: Cabinet): MantelSpec => ({ ...defaultMantel, ...c.mantel, manual: { ...defaultMantel.manual, ...c.mantel?.manual } });

/** IRC R1001.10: 16" in front and 8" past each side, or 20" and 12" for an opening of 6 sq ft or more. */
export function hearthRequired(m: MantelSpec): { front: number; side: number; thickness: number; big: boolean } {
  const big = (m.openingW * m.openingH) / 144 >= 6;
  return { front: big ? 20 : 16, side: big ? 12 : 8, thickness: 2, big };
}
/** Which rules govern: the masonry fireplace sections, the appliance's listing, or both. */
export const usesMasonryRules = (m: MantelSpec) => m.install === 'masonry' && m.fuel === 'wood';
export const usesListing = (m: MantelSpec) => m.fuel !== 'wood' || m.install === 'factory';

/** Each leg's width, from the overall width, the opening and the margin. */
export const legWidth = (c: Cabinet, m = mantelOf(c)) => (m.legs === 'none' ? 0 : Math.max(0, (c.width - m.openingW - 2 * m.margin) / 2));
/** The overall width that gives legs of a given width. */
export const widthFor = (m: MantelSpec, legW: number) => m.openingW + 2 * m.margin + (m.legs === 'none' ? 0 : 2 * legW);

/** The heights everything hangs off. */
export function mantelLayout(c: Cabinet, m = mantelOf(c)) {
  const bed = profileByNum(c.crown);
  const bedH = bed ? mountShape(bed).height : 0;
  const shelfBottom = c.height - m.shelfThickness;
  const openTop = m.openingY + m.openingH;
  const friezeBottom = openTop + m.margin;
  const legW = legWidth(c, m);
  const proud = m.legs === 'pilaster' ? m.legProud : 0;
  return { bedH, shelfBottom, openTop, friezeBottom, legW, proud, legFace: c.depth + proud, capTop: shelfBottom - bedH };
}

/** A bracket under the shelf, seen from the side: flat top and back, a curve between. */
function corbelShape(x: number, y: number, z: number, w: number, h: number, d: number): CutShape {
  const outline: [number, number][] = [[0, 0], [0, h], [d, h], [d, h * 0.82]];
  for (let i = 1; i <= 10; i++) {
    const a = (i / 10) * (Math.PI / 2);
    outline.push([0.5 + (d - 0.5) * Math.cos(a), h * 0.82 * (1 - Math.sin(a))]);
  }
  return { along: 'z', min: [x, y, z], thickness: w, outline };
}

export function mantelParts(c: Cabinet, _s: ShopSettings): Part[] {
  const m = mantelOf(c);
  const L = mantelLayout(c, m);
  const W = c.width, D = c.depth, t = m.stock;
  const sp = m.species;
  const out: Part[] = [];
  const piece = (name: string, length: number, width: number, thickness: number, boxes: Part['boxes'], note?: string, shapes?: CutShape[]): Part =>
    ({ name, role: 'trim', material: 'faceframe', species: sp, length, width, thickness, cut: true, note, boxes, shapes });
  if (m.legs !== 'none' && L.legW > 0.5) {
    for (const side of ['Left', 'Right'] as const) {
      const x0 = side === 'Left' ? 0 : W - L.legW;
      const h = L.capTop;
      out.push(piece('Leg face', h, L.legW, t, [vb(x0, 0, L.legFace - t, L.legW, h, t)], side));
      // Boxed leg: a return each side back to the wall
      for (const [xr, which] of [[x0, 'outside'], [x0 + L.legW - t, 'inside']] as const) {
        out.push(piece('Leg return', h, L.legFace - t, t, [vb(xr, 0, 0, t, h, L.legFace - t)], `${side}, ${which === 'outside' ? 'outside, to the wall' : 'inside, beside the opening'}`));
      }
      // Plinth and capital blocks wrap the leg: a front and both returns, from stock as thick as they stand proud
      const block = (name: string, y0: number, bh: number, note: string) => {
        const p = m.blockProud;
        if (p <= 0) return;
        const outX = side === 'Left' ? x0 - p : x0 + L.legW, inX = side === 'Left' ? x0 + L.legW : x0 - p;
        out.push(piece(`${name} front`, L.legW + 2 * p, bh, p, [vb(x0 - p, y0, L.legFace, L.legW + 2 * p, bh, p)], note));
        out.push(piece(`${name} return`, L.legFace + p, bh, p, [vb(outX, y0, 0, p, bh, L.legFace + p)], `${side} outside, to the wall, mitered at the front`));
        out.push(piece(`${name} return`, L.proud + p, bh, p, [vb(inX, y0, c.depth, p, bh, L.proud + p)], `${side} inside, back to the facing, mitered at the front`));
      };
      if (m.plinth > 0) block('Plinth', 0, m.plinth, 'base moulding wraps it');
      if (m.capital > 0) block('Capital', L.capTop - m.capital, m.capital, 'under the bed moulding');
    }
  }
  // Frieze between the legs, from the top of the opening (plus the margin) up under the shelf
  const fx0 = L.legW, fw = W - 2 * L.legW;
  const fh = L.shelfBottom - L.friezeBottom;
  if (fh > 0.5 && fw > 0.5) out.push(piece('Frieze', fw, fh, t, [vb(fx0, L.friezeBottom, D - t, fw, fh, t)], L.bedH ? 'bed moulding applied along its top' : undefined));
  // Below a raised opening, a panel between the legs down to the floor
  const lowH = m.openingY - m.margin;
  if (lowH > 1 && fw > 0.5) out.push(piece('Lower panel', fw, lowH, t, [vb(fx0, 0, D - t, fw, lowH, t)], m.fuel === 'wood' ? 'hearth below the opening; check it is noncombustible' : 'below the insert'));
  // Masonry wood-burning: the noncombustible hearth extension in front, by others
  if (usesMasonryRules(m) && m.hearthThickness > 0) {
    const hw = m.openingW + 2 * m.hearthSide;
    out.push({ name: 'Hearth extension', role: 'counter', material: 'counter', length: hw, width: m.hearthFront, thickness: m.hearthThickness, cut: false,
      note: 'stone or tile, noncombustible, by others', boxes: [vb(W / 2 - hw / 2, 0, D, hw, m.hearthThickness, m.hearthFront)] });
  }
  // The shelf, past the legs each end; thick shelves are built up
  const sw = W + 2 * m.shelfOverhang;
  out.push(piece('Mantel shelf', sw, m.shelfDepth, m.shelfThickness, [vb(-m.shelfOverhang, L.shelfBottom, 0, sw, m.shelfThickness, m.shelfDepth)],
    m.shelfThickness > 1.25 ? `built up to ${fmt(m.shelfThickness)}: ${fmt(t)} top with an edge band front and ends, or glued up` : undefined));
  // Brackets under the shelf, centered on the legs (two each on wide legs)
  if (m.corbels > 0 && L.legW > 0) {
    const d = Math.max(1.5, m.shelfDepth - L.legFace - 0.5);
    const xs = m.corbels === 2 ? [L.legW / 2, W - L.legW / 2] : [L.legW * 0.28, L.legW * 0.72, W - L.legW * 0.72, W - L.legW * 0.28];
    for (const cx of xs) {
      out.push({ ...piece('Corbel', m.corbelH, d, m.corbelW, [], 'shop-made or bought; glued and screwed under the shelf', [corbelShape(cx - m.corbelW / 2, L.shelfBottom - m.corbelH, L.legFace, m.corbelW, m.corbelH, d)]) });
    }
  }
  // Pediment standing on the shelf, set back to the frieze line
  if (m.pediment !== 'none' && m.pedimentH > 0) {
    const pw = Math.min(sw - 4, W);
    const x0 = (W - pw) / 2;
    const outline: [number, number][] = m.pediment === 'triangle'
      ? [[0, 0], [pw, 0], [pw / 2, m.pedimentH]]
      : [[0, 0], [pw, 0], ...Array.from({ length: 13 }, (_, i) => { const a = Math.PI * (i / 12); return [pw / 2 + (pw / 2) * Math.cos(a), m.pedimentH * Math.sin(a)] as [number, number]; })];
    out.push(piece(m.pediment === 'triangle' ? 'Pediment' : 'Arched pediment', pw, m.pedimentH, t, [], 'on the shelf, set back to the frieze; mouldings run its rake',
      [{ along: 'x', min: [x0, c.height, D - t], thickness: t, outline }]));
  }
  return out;
}

/**
 * Clearance checks for the surround, by the rules that govern it.
 * - Masonry fireplaces (wood, or a gas insert set into one), IRC R1001.11 as adopted in
 *   Massachusetts (780 CMR 51.00, 10th ed.): combustible trim at least 6" from the opening, and
 *   within 12" of it no more than 1/8" of projection per inch of distance; hearth extension per R1001.10.
 * - Listed appliances (gas and electric inserts, factory-built fireplaces, IRC R1004): the manual's
 *   mantel chart, as entered. With a gas insert in a masonry fireplace both apply, and the stricter wins.
 * Projection is measured from the facing, taken as flush with the frieze face.
 */
export function mantelClearances(c: Cabinet): string[] {
  const m = mantelOf(c);
  const L = mantelLayout(c, m);
  const out: string[] = [];
  const masonry = usesMasonryRules(m), listing = usesListing(m);
  /** From the opening's nearest edge or corner to a part beside it (side gap) and starting at y. */
  const from = (side: number, y: number) => (y >= L.openTop ? Math.hypot(side, y - L.openTop) : side);
  const bed = profileByNum(c.crown);
  const items: { what: string; side: number; y: number; dist: number; projects: number }[] = [];
  const add = (what: string, side: number, y: number, projects: number) => items.push({ what, side, y, dist: from(side, y), projects });
  if (m.legs !== 'none') {
    add('pilaster leg', m.margin, 0, L.proud);
    if (m.plinth > 0) add('plinth', m.margin, 0, L.proud + m.blockProud);
    if (m.capital > 0) add('capital', m.margin, L.capTop - m.capital, L.proud + m.blockProud);
  }
  add('frieze', 0, L.friezeBottom, 0);
  if (bed) add('bed moulding', 0, L.shelfBottom - L.bedH, L.proud + mountShape(bed).depth);
  add('shelf', 0, L.shelfBottom, m.shelfDepth - c.depth);
  if (m.corbels) add('corbels', 0, L.shelfBottom - m.corbelH, m.shelfDepth - c.depth - 0.5);
  if (masonry) {
    const who = m.fuel === 'gas' ? 'Gas insert in a masonry fireplace' : 'Wood-burning';
    if (m.margin < 6) out.push(`${who}: the surround is ${fmt(m.margin)} from the opening; combustible trim needs 6" or more (IRC R1001.11).`);
    for (const it of items) {
      if (it.dist >= 12 || it.projects <= 0) continue;
      const allowed = Math.max(0, it.dist) / 8;
      if (it.projects > allowed + 0.01) out.push(`${who}: the ${it.what} is ${fmt(it.dist)} from the opening and projects ${fmt(it.projects)}; within 12" it can project ${fmt(allowed)} at most (1/8" per inch, IRC R1001.11).`);
    }
    const need = hearthRequired(m);
    if (m.hearthFront < need.front - 0.01) out.push(`Hearth extension is ${fmt(m.hearthFront)} in front; ${need.big ? 'an opening of 6 sq ft or more' : 'it'} needs ${fmt(need.front)} (IRC R1001.10).`);
    if (m.hearthSide < need.side - 0.01) out.push(`Hearth extension runs ${fmt(m.hearthSide)} past each side; it needs ${fmt(need.side)} (IRC R1001.10).`);
    if (m.hearthThickness < need.thickness - 0.01) out.push(`Hearth extension is ${fmt(m.hearthThickness)} thick; it needs 2" of noncombustible material (IRC R1001.9.2).`);
  }
  if (listing) {
    const who = m.fuel === 'wood' ? 'Factory-built fireplace' : m.fuel === 'gas' ? 'Gas insert' : 'Electric insert';
    const rows = [...m.manual.rows].sort((a, b) => a.above - b.above);
    if (m.margin < m.manual.sideGap - 0.01) out.push(`${who}: the surround is ${fmt(m.margin)} from the opening; the manual calls for ${fmt(m.manual.sideGap)}.`);
    if (rows.length) {
      for (const it of items) {
        if (it.y < L.openTop || it.projects <= 0) continue;
        const above = it.y - L.openTop;
        const allowed = rows.filter((r) => r.above <= above + 0.01).reduce((mx, r) => Math.max(mx, r.maxDepth), 0);
        if (it.projects > allowed + 0.01) out.push(`${who}: the ${it.what} is ${fmt(above)} above the opening and projects ${fmt(it.projects)}; the manual's chart allows ${fmt(allowed)} there.`);
      }
    }
  }
  return out;
}

/** Listed appliances are checked against their manual's chart, once it's entered. */
export const needsManualChart = (m: MantelSpec) => usesListing(m) && !m.manual.rows.length && m.manual.sideGap === 0;

/** What governs this fireplace, for the notes: code sections and Massachusetts specifics. */
export function mantelCodeBasis(m: MantelSpec): string[] {
  const out: string[] = [];
  if (usesMasonryRules(m)) {
    const h = hearthRequired(m);
    out.push(`Masonry fireplace, 780 CMR 51.00 (2021 IRC with MA amendments) R1001: combustible trim 6" or more from the opening, and within 12" no more than 1/8" projection per inch; hearth extension ${fmt(h.front)} in front and ${fmt(h.side)} past each side, 2" thick noncombustible; framing 2" off the masonry front and sides, 4" off the back`);
  }
  if (m.fuel === 'gas' && m.install === 'masonry') out.push('Gas insert in an existing masonry fireplace: the insert\'s listing sets the trim and mantel clearances around it; the masonry fireplace\'s own hearth and R1001.11 limits stay with the fireplace, so confirm with the inspector which governs the surround');
  if (m.fuel === 'wood' && m.install === 'factory') out.push('Factory-built fireplace (IRC R1004, UL 127): mantel, trim and hearth extension per its listing and manual');
  if (m.fuel === 'gas') out.push('Gas insert or fireplace: installed per its listing and manual; in Massachusetts gas work falls under 248 CMR (NFPA 54 as amended) and is done by a licensed plumber or gas fitter, with CO detection and signage where it vents through a side wall low to grade (248 CMR 5.08)');
  if (m.fuel === 'electric') out.push('Electric insert: installed per its listing and manual, on its own circuit if the manual calls for one');
  return out;
}

/** Notes for the drawings: what the opening is for and what it needs. */
export function mantelNotes(c: Cabinet): { text: string; for: 'both' | 'shop' | 'customer' }[] {
  const m = mantelOf(c);
  const out: { text: string; for: 'both' | 'shop' | 'customer' }[] = [];
  const open = `${fmt(m.openingW)} × ${fmt(m.openingH)} opening, ${fmt(m.openingY)} off the floor`;
  if (m.fuel === 'wood') out.push({ text: `Existing wood-burning firebox, ${open}; ${fmt(m.margin)} of noncombustible facing to the surround`, for: 'both' });
  else out.push({ text: `${fuelLabel[m.fuel]}${m.insert?.model ? ` (${m.insert.model})` : ''} by owner, ${open}. Mantel clearances and framing per its installation manual`, for: 'both' });
  if (m.fuel !== 'wood' && m.insert && m.insert.d + m.insert.back > c.depth + 0.01) {
    out.push({ text: `The insert needs ${fmt(m.insert.d + m.insert.back)} deep and the surround is ${fmt(c.depth)}: frame a chase or bump-out ${fmt(m.insert.d + m.insert.back - c.depth)} deeper behind it`, for: 'both' });
  }
  if (m.fuel !== 'wood') out.push({ text: `Frame the surround box behind the face (2x or 3/4" ply) to carry the legs, frieze and shelf; outlet${m.fuel === 'gas' ? ' and gas line' : ''} inside per the manual`, for: 'shop' });
  if (usesMasonryRules(m)) out.push({ text: `Hearth extension: ${fmt(m.hearthFront)} in front, ${fmt(m.hearthSide)} past each side, ${fmt(m.hearthThickness)} thick, noncombustible (by others)`, for: 'both' });
  for (const t of mantelCodeBasis(m)) out.push({ text: t, for: 'shop' });
  if (needsManualChart(m)) out.push({ text: 'Mantel clearances not yet checked against the manual\'s chart; confirm before building', for: 'shop' });
  for (const w of mantelClearances(c)) out.push({ text: w, for: 'both' });
  return out;
}
