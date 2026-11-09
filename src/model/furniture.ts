// Free-standing furniture, starting with dining tables: size and seating, top and base, leaves,
// species, and the board feet, hours and materials that price it. The hours are starting
// standards for a one-off table in a cabinet shop, meant to be adjusted as Cody builds them.
import type { Project } from './types';
import { uid } from './defaults';
import { roughQuarters } from './faceframe';
import { tableStock } from './tableParts';

export type TableBase = 'legs' | 'trestle' | 'pedestal' | 'double-pedestal';
export type TableLeg = 'square' | 'tapered' | 'turned';
export type TableFinish = 'clear' | 'stain' | 'paint' | 'oil' | 'painter';

export interface DiningTable {
  id: string;
  /** A table (the default) or a bench: a bench is built the same way, as a seat on legs and aprons, with its own checks and options. */
  kind?: 'table' | 'bench';
  /** Bench: a lower shelf on rails between the legs (shoes, baskets), slatted or a solid panel, and the height of its top off the floor. */
  shelf?: 'none' | 'slats' | 'solid';
  shelfHeight?: number;
  /**
   * Four-leg bases: low stretchers between the legs to stiffen them. H: one across each end and one
   * down the middle between them; box: one on every side. A bench's shelf rails already do this.
   */
  stretchers?: 'none' | 'h' | 'box';
  /** Top of the stretchers off the floor. Unset = 6". */
  stretcherHeight?: number;
  /** Bench: an upholstered cushion on the seat, by the upholsterer, and its thickness. */
  cushion?: boolean;
  cushionThick?: number;
  name: string;
  length: number;
  width: number;
  height: number;
  /** Finished top thickness. */
  top: number;
  species: string;
  /** Price per board foot for the rough lumber; 0 = use the job's species price. */
  pricePerBF: number;
  base: TableBase;
  leg: TableLeg;
  /** Leg size (square, at the top) for a four-leg base. */
  legSize: number;
  apron: number;
  breadboard: boolean;
  /** Extension leaves and their width; leaves need table slides. */
  leaves: number;
  leafWidth: number;
  edge: 'eased' | 'profile' | 'live';
  finish: TableFinish;
  /** A painter's or finisher's price, when finish is "painter". */
  finishPrice: number;
  /** Turning (outsourced or not) per leg, when legs are turned. */
  turningEach: number;
  notes: string;
  /** What it's for, as the proposal says it: "dining table", "puzzle table". */
  use?: string;
  /** A raised lip around the top (a puzzle or game table), so pieces stay on. */
  lip?: boolean;
  /** How far the lip stands above the playing surface, and its thickness. */
  lipHeight?: number;
  lipWidth?: number;
  /** edge: rails applied around the top's edge, rising above it; onTop: rails glued on the top at its edge. */
  lipStyle?: 'edge' | 'onTop';
  /** Where it stands, its center from the left and back walls (unset = the middle of the room), and turned 90°. */
  roomX?: number;
  roomZ?: number;
  turned?: boolean;
}

export const newTable = (): DiningTable => ({
  id: uid('tbl'), name: 'Dining table', length: 84, width: 40, height: 30, top: 1.125, species: 'White oak', pricePerBF: 0,
  base: 'legs', leg: 'tapered', legSize: 3, apron: 4, breadboard: false, leaves: 0, leafWidth: 18, edge: 'eased',
  finish: 'clear', finishPrice: 0, turningEach: 0, notes: '',
  use: 'dining table', lip: false, lipHeight: 0.75, lipWidth: 0.75, lipStyle: 'edge',
});

/** A bench: a seat on four legs and aprons, about 18" high; a lower shelf and a cushion are options. */
export const newBench = (): DiningTable => ({
  ...newTable(), id: uid('bench'), kind: 'bench', name: 'Bench', use: 'bench', length: 48, width: 16, height: 18, top: 1.125,
  leg: 'square', legSize: 2, apron: 3, shelf: 'none', shelfHeight: 5, cushion: false, cushionThick: 2,
});
export const isBench = (t: DiningTable) => t.kind === 'bench';
/** The stretchers a table or bench actually gets: four-leg bases only, and not under a bench shelf (its rails brace the legs). */
export const stretchersOf = (t: DiningTable): 'none' | 'h' | 'box' => (t.base !== 'legs' || (isBench(t) && t.shelf && t.shelf !== 'none') ? 'none' : t.stretchers ?? 'none');
const stretcherWords = (t: DiningTable) => ({ none: '', h: ' and an H stretcher', box: ' and stretchers all around' })[stretchersOf(t)];
/** Where you sit: the seat, plus the cushion. */
export const seatHeight = (t: DiningTable) => t.height + (t.cushion ? t.cushionThick ?? 2 : 0);

export const tableBaseLabel: Record<TableBase, string> = { legs: 'Four legs and aprons', trestle: 'Trestle', pedestal: 'Single pedestal', 'double-pedestal': 'Double pedestal' };
export const tableFinishLabel: Record<TableFinish, string> = { clear: 'Clear coat (shop)', stain: 'Stain and clear coat (shop)', paint: 'Paint (shop)', oil: 'Hardwax oil (shop)', painter: 'By the painter / finisher' };

/** Labor standards for tables, in hours. */
export const tableStandards = {
  layout: 2, // drawings, cut list, stock selection
  topBase: 2, topPerSqFt: 0.15, // milling, glue-up, flattening
  breadboard: 5,
  lipBase: 2, lipPerFt: 0.08, // mill, miter, fit and fasten the rails; ease the inside edge
  edgeProfile: 1.5, liveEdge: 3,
  leafEach: 3, slides: 3,
  legSquare: 1, legTapered: 1.5, legTurned: 1, // turned: plus the turning cost
  apronEach: 1.25, // with mortise-and-tenon joinery
  attach: 1.5, // buttons or figure-8s, corner blocks
  trestle: 19, pedestal: 14, doublePedestal: 24,
  assembly: 2,
  sandPerSqFt: 0.1, sandBase: 3,
  finishPerSqFt: { clear: 0.12, stain: 0.18, paint: 0.16, oil: 0.08, painter: 0 } as Record<TableFinish, number>,
  finishBase: { clear: 3, stain: 4, paint: 4, oil: 2, painter: 0 } as Record<TableFinish, number>,
  delivery: 2,
  // Bench lower shelf: four rails tenoned into the legs, then slats or a solid panel on cleats
  shelfRails: 3, shelfSlats: 2, shelfSolid: 1.5,
  // Low stretchers between the legs, mortise and tenon, each
  stretcherEach: 1,
};

/** Tangential shrinkage per 1% change in moisture content (flatsawn), from the USDA Wood Handbook. */
const movement: Record<string, number> = {
  'white oak': 0.00365, 'red oak': 0.00369, 'hard maple': 0.00353, 'soft maple': 0.00289, cherry: 0.00248,
  walnut: 0.00274, ash: 0.00274, hickory: 0.00411, poplar: 0.00289, 'white pine': 0.00212, mahogany: 0.00172, sapele: 0.00278, birch: 0.00338,
};
export const movementCoef = (species: string) => movement[species.toLowerCase().replace(/^(rift|quartersawn|qs|flatsawn|plain sawn)\s+/, '')] ?? 0.0033;

const perimeter = (t: DiningTable) => 2 * (t.length + t.width);
/** The lip rails' finished section: height (top to bottom of the rail) by thickness. */
export const lipStock = (t: DiningTable) => ({ h: (t.lipStyle ?? 'edge') === 'edge' ? t.top + (t.lipHeight ?? 0.75) : (t.lipHeight ?? 0.75), w: t.lipWidth ?? 0.75 });
const sqft = (t: DiningTable) => (t.length * t.width) / 144;
const leafSqft = (t: DiningTable) => (t.leaves * t.leafWidth * t.width) / 144;

/** How many people it seats: 24" a place along the sides, and an end seat where the table is at least 36" wide. Corner legs cost a little side room. */
export function seats(t: DiningTable, withLeaves = false): number {
  const len = t.length + (withLeaves ? t.leaves * t.leafWidth : 0);
  const sideUsable = len - (t.base === 'legs' ? 2 * t.legSize : 0);
  const perSide = Math.max(1, Math.floor(sideUsable / 24));
  return perSide * 2 + (t.width >= 36 ? 2 : 0);
}

/** Seasonal width change of a solid top: a 4% swing in moisture content, about a New England year indoors. */
export const topMovement = (t: DiningTable) => t.width * movementCoef(t.species) * 4;

/** Things to check on the design, in plain words. */
export function tableChecks(t: DiningTable): string[] {
  if (isBench(t)) return benchChecks(t);
  const out: string[] = [];
  const knee = t.height - t.top - (t.base === 'legs' ? t.apron : 0);
  if (t.base === 'legs' && knee < 24.5) out.push(`Only ${knee.toFixed(2)}" from floor to apron: aim for 24 1/2" or more so knees clear (a narrower apron or thinner top helps).`);
  const dining = /dining/i.test(t.use ?? 'dining table');
  if (dining && (t.height < 28.5 || t.height > 30.5)) out.push(`Dining height is usually 29"–30"; this is ${t.height}".`);
  if (dining && t.width < 36) out.push('Under 36" wide gets tight with place settings on both sides and leaves no room for end seats.');
  if (t.width > 48) out.push(dining ? 'Over 48" wide makes it hard to reach across and to pass dishes.' : `Over 48" wide is a long reach to the middle from one side (about ${Math.round(t.width / 2)}").`);
  if (t.lip) {
    out.push(`The lip across the ends runs across the top's grain: ${t.lipStyle === 'onTop' ? 'glue only the middle few inches and screw through slotted holes toward the corners' : 'fasten the end rails through slotted holes (or glue only at the middle)'} so the ${topMovement(t).toFixed(2)}" of seasonal movement doesn't crack the top or open the miters.`);
    if (t.leaves) out.push('A lip with extension leaves needs lip pieces on each leaf and breaks at every joint; most puzzle tables skip the leaves.');
    if (t.breadboard) out.push('With a lip applied around the edge, the breadboard ends sit inside the lip; consider leaving them off.');
  }
  if (t.base === 'trestle' && t.length < 60) out.push('A trestle base wants a table about 60" or longer so the feet stay out of the way.');
  if ((t.base === 'pedestal') && t.length > 60) out.push('A single pedestal is best up to about 60" long; use a double pedestal or trestle for longer tables.');
  if (t.leaves && t.breadboard) out.push('Breadboard ends and extension leaves don’t mix well: the leaves need their own breadboards to match, and the slides fight the breadboard movement.');
  out.push(`A ${t.width}" wide ${t.species.toLowerCase()} top moves about ${topMovement(t).toFixed(2)}" across its width between winter and summer: attach it with buttons or figure-8s${t.breadboard ? ', and peg the breadboard ends through elongated holes' : ''}.`);
  out.push('Allow 36" (42"–48" is comfortable) from the table edge to walls and furniture for chairs to pull out.');
  return out;
}

/** A bench's checks: seat height and depth, a long seat's sag, the shoe shelf's clearance. */
export function benchChecks(t: DiningTable): string[] {
  const out: string[] = [];
  const sh = seatHeight(t);
  if (sh < 16.5 || sh > 19.5) out.push(`Seat height is ${sh}"${t.cushion ? ' with the cushion' : ''}; 17"–19" is comfortable for sitting to put on shoes.`);
  if (t.width < 13) out.push(`At ${t.width}" deep the seat is narrow; 14"–18" is typical (15"–16" in a closet).`);
  if (t.width > 20) out.push(`At ${t.width}" deep it sits more like a daybed; 14"–18" is typical.`);
  const span = t.length - 2 * (1.5 + t.legSize);
  if (span > 54 && t.top < 1.25) out.push(`The seat spans ${Math.round(span)}" between legs: a ${t.top}" seat will flex under two people; go to 1-1/4" or add a center stretcher or leg.`);
  if (t.shelf && t.shelf !== 'none') {
    const clear = t.height - t.top - t.apron - (t.shelfHeight ?? 5);
    if (clear < 7) out.push(`Only ${clear.toFixed(1)}" between the shoe shelf and the apron: boots and taller shoes want 8" or more.`);
  }
  if (t.cushion) out.push('Cushion by the upholsterer: fabric to be selected; a 1/4" reveal around the seat keeps it from looking oversized.');
  out.push(`A ${t.width}" ${t.species.toLowerCase()} seat moves about ${topMovement(t).toFixed(2)}" across its depth through the year: fasten it with buttons or figure-8s.`);
  return out;
}

export interface TableLine { label: string; hours: number }
export interface TableMaterial { label: string; cost: number; detail: string }

/** Hours and materials for one table. Lumber is priced from the table's own $/BF or the job's species price. */
export function tableEstimate(t: DiningTable, p: Project): { hours: TableLine[]; materials: TableMaterial[]; bf: number } {
  const s = tableStandards;
  const area = sqft(t);
  const hours: TableLine[] = [
    { label: 'Layout, drawings and stock selection', hours: s.layout },
    { label: `Top: mill, glue up and flatten (${area.toFixed(1)} sq ft)`, hours: s.topBase + s.topPerSqFt * area },
  ];
  if (t.breadboard) hours.push({ label: 'Breadboard ends', hours: s.breadboard });
  if (t.lip) hours.push({ label: `Raised lip around the top, mitered corners (${Math.round(perimeter(t) / 12)} lf)`, hours: s.lipBase + s.lipPerFt * perimeter(t) / 12 });
  if (t.edge === 'profile') hours.push({ label: 'Edge profile', hours: s.edgeProfile });
  if (t.edge === 'live') hours.push({ label: 'Live edge cleanup', hours: s.liveEdge });
  if (t.leaves) hours.push({ label: `${t.leaves} ${t.leaves > 1 ? 'leaves' : 'leaf'} and table slides`, hours: s.leafEach * t.leaves + s.slides + s.topPerSqFt * leafSqft(t) });
  if (t.base === 'legs') {
    const each = t.leg === 'square' ? s.legSquare : t.leg === 'tapered' ? s.legTapered : s.legTurned;
    hours.push({ label: `Four ${t.leg} legs`, hours: 4 * each }, { label: 'Four aprons, mortise and tenon', hours: 4 * s.apronEach });
  } else {
    hours.push({ label: tableBaseLabel[t.base] + ' base', hours: t.base === 'trestle' ? s.trestle : t.base === 'pedestal' ? s.pedestal : s.doublePedestal });
  }
  const st = stretchersOf(t);
  if (st !== 'none') hours.push({ label: st === 'h' ? 'H stretcher: two end stretchers and a center one, mortise and tenon' : 'Four stretchers around the legs, mortise and tenon', hours: 3 * s.stretcherEach + (st === 'box' ? s.stretcherEach : 0) });
  if (isBench(t) && t.shelf && t.shelf !== 'none') hours.push({ label: `Lower shelf: rails and ${t.shelf === 'slats' ? 'slats' : 'a solid panel'}`, hours: s.shelfRails + (t.shelf === 'slats' ? s.shelfSlats : s.shelfSolid) });
  hours.push(
    { label: 'Top attachment', hours: s.attach },
    { label: 'Dry fit and assembly', hours: s.assembly },
    { label: 'Sanding', hours: s.sandPerSqFt * (area + leafSqft(t)) * 2 + s.sandBase },
  );
  if (t.finish !== 'painter') hours.push({ label: tableFinishLabel[t.finish], hours: s.finishPerSqFt[t.finish] * (area + leafSqft(t)) * 2 + s.finishBase[t.finish] });
  hours.push({ label: 'Delivery and setup', hours: s.delivery });

  // Board feet, rough, with waste for selection and defects
  const bf = (l: number, w: number, finished: number) => (l * w * (roughQuarters(finished) / 4)) / 144;
  const topBF = (bf(t.length + 2, t.width + 1, t.top) + (t.leaves ? t.leaves * bf(t.leafWidth + 1, t.width + 1, t.top) : 0) + (t.breadboard ? 2 * bf(t.width + 2, 4, t.top) : 0)) * 1.35;
  const legLen = t.height - t.top;
  const baseBF = t.base === 'legs'
    ? (4 * ((legLen + 2) * (t.legSize + 0.5) * (t.legSize + 0.5)) / 144 + bf(2 * (t.length + t.width), t.apron + 0.5, 0.875)) * 1.3
    : (t.base === 'trestle' ? 16 + (t.length / 12) * 1.5 : t.base === 'pedestal' ? 22 : 36) * 1.2;
  const lipBF = t.lip ? bf(perimeter(t) + 8, lipStock(t).h + 0.5, lipStock(t).w) * 1.25 : 0;
  const total = topBF + baseBF + lipBF;
  // A&M's surfaced boards by the lineal foot, part by part, unless a $/BF price is typed for the table
  const stock = tableStock(t);
  const own = t.pricePerBF || 0;
  const amLine: TableMaterial | null = !own && !stock.missing
    ? { label: `${t.species} lumber (A&M)`, cost: stock.lines.reduce((x, l) => x + l.cost, 0), detail: stock.lines.map((l) => `${l.part}: ${Math.ceil(l.lf)} lf of ${l.board} at $${l.perLF.toFixed(2)}`).join('; ') }
    : null;
  const price = own || p.speciesPrices?.[t.species] || 0;
  const materials: TableMaterial[] = [
    amLine ?? { label: `${t.species} lumber`, cost: total * price, detail: `${Math.ceil(total)} BF rough (top ${Math.ceil(topBF)}, base ${Math.ceil(baseBF)}${lipBF ? `, lip ${Math.ceil(lipBF)}` : ''})${price ? ` at $${price}/BF` : ' — enter a $/BF price'}` },
    { label: 'Glue, fasteners, abrasives', cost: 35 + area * 1.5, detail: 'Buttons or figure-8s, glue, sandpaper' },
  ];
  if (t.leaves) materials.push({ label: 'Table slides and leaf hardware', cost: 180, detail: 'Wooden or aluminum slides, alignment pins, leaf locks' });
  if (t.base === 'legs' && t.leg === 'turned' && t.turningEach) materials.push({ label: 'Leg turning', cost: 4 * t.turningEach, detail: `4 legs at $${t.turningEach}` });
  if (isBench(t) && t.cushion) {
    const per = p.quote?.cushionPerSqFt ?? 0;
    materials.push({ label: 'Upholstered seat cushion (upholsterer)', cost: area * per, detail: `${area.toFixed(1)} sq ft${per ? ` at $${per}/sq ft` : ': enter the upholsterer’s price under Quote → Prices'}` });
  }
  if (t.finish === 'painter') materials.push({ label: 'Finishing (by others)', cost: t.finishPrice, detail: 'Finisher’s price' });
  else materials.push({ label: 'Finish materials', cost: (area + leafSqft(t)) * 2 * (t.finish === 'oil' ? 1.2 : 0.9) + 25, detail: tableFinishLabel[t.finish] });
  return { hours, materials, bf: total };
}

export const furnitureOf = (p: Project): DiningTable[] => (p.furniture ?? []).map((t) => ({ ...newTable(), ...t }));

const fmt = (v: number) => (Number.isInteger(v) ? `${v}"` : `${Math.floor(v)} ${fraction(v - Math.floor(v))}"`.replace(/^0 /, ''));
const fraction = (f: number) => { const n = Math.round(f * 16); const g = gcd(n, 16); return `${n / g}/${16 / g}`; };
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/** The scope line, in the wording of the quotes. */
export function tableScope(t: DiningTable): string {
  if (isBench(t)) return [
    `${t.name}: solid ${/sapele/i.test(t.species) ? 'sapele mahogany' : t.species.toLowerCase()} ${t.use || 'bench'}, approx ${fmt(t.length)}L x ${fmt(t.width)}D x ${fmt(seatHeight(t))} seat height`,
    `${fmt(t.top)} thick seat${t.edge === 'profile' ? ', profiled edge' : ''}`,
    `${t.leg} legs with aprons${stretcherWords(t)}`,
    ...(t.shelf && t.shelf !== 'none' ? [`${t.shelf === 'slats' ? 'slatted' : 'solid'} lower shelf for shoes`] : []),
    ...(t.cushion ? [`upholstered ${fmt(t.cushionThick ?? 2)} seat cushion (fabric to be selected)`] : []),
    t.finish === 'painter' ? 'finish by others' : tableFinishLabel[t.finish].replace(' (shop)', '').toLowerCase() + ' finish',
    'delivered and set in place',
  ].join('; ');
  const bits = [
    `${t.name}: solid ${/sapele/i.test(t.species) ? "sapele mahogany" : t.species.toLowerCase()} ${t.use || 'dining table'}, approx ${fmt(t.length)}L x ${fmt(t.width)}W x ${fmt(t.height)}H`,
    `${fmt(t.top)} thick top${t.breadboard ? ' with breadboard ends' : ''}${t.edge === 'profile' ? ', profiled edge' : t.edge === 'live' ? ', live edge' : ''}`,
    ...(t.lip ? [`raised ${fmt(t.lipHeight ?? 0.75)} lip around the perimeter${t.lipStyle === 'onTop' ? '' : ' (applied to the edge of the top)'}, mitered corners`] : []),
    t.base === 'legs' ? `${t.leg} legs with aprons${stretcherWords(t)}` : tableBaseLabel[t.base].toLowerCase() + ' base',
    ...(/dining/i.test(t.use ?? 'dining table') ? [t.leaves ? `(${t.leaves}) ${fmt(t.leafWidth)} extension ${t.leaves > 1 ? 'leaves' : 'leaf'}; seats ${seats(t)}–${seats(t, true)}` : `seats ${seats(t)}`] : t.leaves ? [`(${t.leaves}) ${fmt(t.leafWidth)} extension ${t.leaves > 1 ? 'leaves' : 'leaf'}`] : []),
    t.finish === 'painter' ? 'finish by others' : tableFinishLabel[t.finish].replace(' (shop)', '').toLowerCase() + ' finish',
    'delivered and set in place',
  ];
  return bits.join('; ');
}
