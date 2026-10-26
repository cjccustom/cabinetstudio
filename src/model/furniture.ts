// Free-standing furniture, starting with dining tables: size and seating, top and base, leaves,
// species, and the board feet, hours and materials that price it. The hours are starting
// standards for a one-off table in a cabinet shop, meant to be adjusted as Cody builds them.
import type { Project } from './types';
import { uid } from './defaults';
import { roughQuarters } from './faceframe';

export type TableBase = 'legs' | 'trestle' | 'pedestal' | 'double-pedestal';
export type TableLeg = 'square' | 'tapered' | 'turned';
export type TableFinish = 'clear' | 'stain' | 'paint' | 'oil' | 'painter';

export interface DiningTable {
  id: string;
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
}

export const newTable = (): DiningTable => ({
  id: uid('tbl'), name: 'Dining table', length: 84, width: 40, height: 30, top: 1.25, species: 'White oak', pricePerBF: 0,
  base: 'legs', leg: 'tapered', legSize: 3, apron: 4, breadboard: false, leaves: 0, leafWidth: 18, edge: 'eased',
  finish: 'clear', finishPrice: 0, turningEach: 0, notes: '',
});

export const tableBaseLabel: Record<TableBase, string> = { legs: 'Four legs and aprons', trestle: 'Trestle', pedestal: 'Single pedestal', 'double-pedestal': 'Double pedestal' };
export const tableFinishLabel: Record<TableFinish, string> = { clear: 'Clear coat (shop)', stain: 'Stain and clear coat (shop)', paint: 'Paint (shop)', oil: 'Hardwax oil (shop)', painter: 'By the painter / finisher' };

/** Labor standards for tables, in hours. */
export const tableStandards = {
  layout: 2, // drawings, cut list, stock selection
  topBase: 2, topPerSqFt: 0.15, // milling, glue-up, flattening
  breadboard: 5,
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
};

/** Tangential shrinkage per 1% change in moisture content (flatsawn), from the USDA Wood Handbook. */
const movement: Record<string, number> = {
  'white oak': 0.00365, 'red oak': 0.00369, 'hard maple': 0.00353, 'soft maple': 0.00289, cherry: 0.00248,
  walnut: 0.00274, ash: 0.00274, hickory: 0.00411, poplar: 0.00289, 'white pine': 0.00212, mahogany: 0.00172, birch: 0.00338,
};
export const movementCoef = (species: string) => movement[species.toLowerCase().replace(/^(rift|quartersawn|qs|flatsawn|plain sawn)\s+/, '')] ?? 0.0033;

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
  const out: string[] = [];
  const knee = t.height - t.top - (t.base === 'legs' ? t.apron : 0);
  if (t.base === 'legs' && knee < 24.5) out.push(`Only ${knee.toFixed(2)}" from floor to apron: aim for 24 1/2" or more so knees clear (a narrower apron or thinner top helps).`);
  if (t.height < 28.5 || t.height > 30.5) out.push(`Dining height is usually 29"–30"; this is ${t.height}".`);
  if (t.width < 36) out.push('Under 36" wide gets tight with place settings on both sides and leaves no room for end seats.');
  if (t.width > 48) out.push('Over 48" wide makes it hard to reach across and to pass dishes.');
  if (t.base === 'trestle' && t.length < 60) out.push('A trestle base wants a table about 60" or longer so the feet stay out of the way.');
  if ((t.base === 'pedestal') && t.length > 60) out.push('A single pedestal is best up to about 60" long; use a double pedestal or trestle for longer tables.');
  if (t.leaves && t.breadboard) out.push('Breadboard ends and extension leaves don’t mix well: the leaves need their own breadboards to match, and the slides fight the breadboard movement.');
  out.push(`A ${t.width}" wide ${t.species.toLowerCase()} top moves about ${topMovement(t).toFixed(2)}" across its width between winter and summer: attach it with buttons or figure-8s${t.breadboard ? ', and peg the breadboard ends through elongated holes' : ''}.`);
  out.push('Allow 36" (42"–48" is comfortable) from the table edge to walls and furniture for chairs to pull out.');
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
  if (t.edge === 'profile') hours.push({ label: 'Edge profile', hours: s.edgeProfile });
  if (t.edge === 'live') hours.push({ label: 'Live edge cleanup', hours: s.liveEdge });
  if (t.leaves) hours.push({ label: `${t.leaves} ${t.leaves > 1 ? 'leaves' : 'leaf'} and table slides`, hours: s.leafEach * t.leaves + s.slides + s.topPerSqFt * leafSqft(t) });
  if (t.base === 'legs') {
    const each = t.leg === 'square' ? s.legSquare : t.leg === 'tapered' ? s.legTapered : s.legTurned;
    hours.push({ label: `Four ${t.leg} legs`, hours: 4 * each }, { label: 'Four aprons, mortise and tenon', hours: 4 * s.apronEach });
  } else {
    hours.push({ label: tableBaseLabel[t.base] + ' base', hours: t.base === 'trestle' ? s.trestle : t.base === 'pedestal' ? s.pedestal : s.doublePedestal });
  }
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
  const total = topBF + baseBF;
  const price = t.pricePerBF || p.speciesPrices?.[t.species] || 0;
  const materials: TableMaterial[] = [
    { label: `${t.species} lumber`, cost: total * price, detail: `${Math.ceil(total)} BF rough (top ${Math.ceil(topBF)}, base ${Math.ceil(baseBF)})${price ? ` at $${price}/BF` : ' — enter a $/BF price'}` },
    { label: 'Glue, fasteners, abrasives', cost: 35 + area * 1.5, detail: 'Buttons or figure-8s, glue, sandpaper' },
  ];
  if (t.leaves) materials.push({ label: 'Table slides and leaf hardware', cost: 180, detail: 'Wooden or aluminum slides, alignment pins, leaf locks' });
  if (t.base === 'legs' && t.leg === 'turned' && t.turningEach) materials.push({ label: 'Leg turning', cost: 4 * t.turningEach, detail: `4 legs at $${t.turningEach}` });
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
  const bits = [
    `${t.name}: solid ${t.species.toLowerCase()} dining table, approx ${fmt(t.length)}L x ${fmt(t.width)}W x ${fmt(t.height)}H`,
    `${fmt(t.top)} thick top${t.breadboard ? ' with breadboard ends' : ''}${t.edge === 'profile' ? ', profiled edge' : t.edge === 'live' ? ', live edge' : ''}`,
    t.base === 'legs' ? `${t.leg} legs with aprons` : tableBaseLabel[t.base].toLowerCase() + ' base',
    t.leaves ? `(${t.leaves}) ${fmt(t.leafWidth)} extension ${t.leaves > 1 ? 'leaves' : 'leaf'}; seats ${seats(t)}–${seats(t, true)}` : `seats ${seats(t)}`,
    t.finish === 'painter' ? 'finish by others' : tableFinishLabel[t.finish].replace(' (shop)', '').toLowerCase() + ' finish',
    'delivered and set in place',
  ];
  return bits.join('; ');
}
