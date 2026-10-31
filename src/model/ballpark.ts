// The ballpark rate card from Cody's meeting calculator (CJC_Cabinet_Ballpark_Calculator_v5.xlsx):
// a price per lineal foot by kind of cabinetry, unfinished or painted, at low / typical / high, plus
// per-unit adders. Cabinet Studio sorts a design into the same categories so the calculated quote
// can be checked against the range Cody would have given at the first meeting.
import type { Cabinet, Project } from './types';
import { buildParts, isOpenRow } from './parts';
import { paintEstimate, priceQuote, quoteOf } from './quote';
import { resolveEnds } from './layout';
import { baseOf } from './cabinetBase';

export type Tier = 'low' | 'typical' | 'high';
export type Band = [number, number, number];
export type BallparkCategory = 'base' | 'shallowBase' | 'wall' | 'tall' | 'shortCubby' | 'cubby' | 'bookcase60' | 'bookcase96' | 'locker';
export type BallparkFeature = 'inset' | 'drawer' | 'decorativeEnd' | 'archKick' | 'premiumTop' | 'mapleTop' | 'shelf' | 'divider';

export interface RateCard {
  unfinished: Record<BallparkCategory, Band>;
  painted: Record<BallparkCategory, Band>;
  features: Record<BallparkFeature, Band>;
  /** The spread quoted around the working estimate, and what it rounds to. */
  range: number;
  roundTo: number;
}

export const categoryLabel: Record<BallparkCategory, string> = {
  base: 'Standard base (18–24" deep)', shallowBase: 'Shallow base (up to 16" deep)', wall: 'Wall / upper cabinetry', tall: 'Full-height / tall cabinetry',
  shortCubby: 'Short open cubbies (up to 24" high)', cubby: 'Open cubbies / bench (up to 36")', bookcase60: 'Open upper bookcase (up to 60")',
  bookcase96: 'Full-height open bookcase (up to 96")', locker: 'Tall open lockers (up to 96")',
};
export const featureLabel: Record<BallparkFeature, string> = {
  inset: 'Inset doors / drawers (per LF)', drawer: 'Drawers beyond the usual mix (each)', decorativeEnd: 'Decorative / inset ends (each)', archKick: 'Arched toe kicks (each opening)',
  premiumTop: 'Premium / wide hardwood tops (per LF)', mapleTop: 'Shallow maple top, ≤18" deep (per LF)', shelf: 'Additional bookcase shelf (each)', divider: 'Extra cubby divider (each)',
};

/** The rate card as it was in the v5 spreadsheet. */
export const defaultRateCard: RateCard = {
  unfinished: {
    base: [650, 800, 950], shallowBase: [425, 550, 700], wall: [475, 600, 750], tall: [1100, 1375, 1650], shortCubby: [225, 300, 400],
    cubby: [450, 600, 750], bookcase60: [525, 700, 875], bookcase96: [750, 1000, 1250], locker: [850, 1150, 1450],
  },
  painted: {
    base: [850, 1025, 1200], shallowBase: [600, 725, 875], wall: [650, 800, 950], tall: [1500, 1800, 2100], shortCubby: [300, 400, 525],
    cubby: [625, 825, 1025], bookcase60: [750, 1000, 1250], bookcase96: [1050, 1350, 1650], locker: [1150, 1500, 1900],
  },
  features: {
    inset: [100, 150, 225], drawer: [125, 175, 250], decorativeEnd: [125, 225, 325], archKick: [125, 200, 300],
    premiumTop: [150, 225, 325], mapleTop: [110, 125, 160], shelf: [75, 110, 150], divider: [125, 175, 250],
  },
  range: 0.1,
  roundTo: 250,
};

export const rateCardOf = (p: Project): RateCard => ({ ...defaultRateCard, ...p.quote?.rateCard });

/** Which ballpark category a cabinet falls in. Pilasters, mantels, shelves and panels aren't on the card. */
export function categoryOf(c: Cabinet): BallparkCategory | null {
  if (c.kind === 'pilaster' || c.kind === 'mantel' || c.kind === 'shelf') return null;
  const open = c.rows.length > 0 && c.rows.every((r) => isOpenRow(r.type, r.covered));
  if (c.kind === 'base') return open ? (c.height <= 24 ? 'shortCubby' : 'cubby') : c.depth <= 16 ? 'shallowBase' : 'base';
  if (c.kind === 'wall') return open ? (c.height <= 24 ? 'shortCubby' : 'bookcase60') : 'wall';
  // Tall: open all the way is a bookcase (deep ones are lockers); a closed or mixed one is tall cabinetry
  if (open) return c.depth >= 16 ? 'locker' : c.height <= 60 ? 'bookcase60' : 'bookcase96';
  return 'tall';
}

/**
 * The card lines a cabinet is priced on. A tall unit with doors below and open shelves above (a
 * bookcase over a cabinet base) counts as both: the base by its depth and the bookcase by its height,
 * the way it would be ballparked at the table. Anything else is its one category.
 */
export function categoriesOf(c: Cabinet): BallparkCategory[] {
  const cat = categoryOf(c);
  if (cat !== 'tall' || c.rows.length < 2) return cat ? [cat] : [];
  // Rows run top to bottom: open shelves on top, then only closed rows to the floor
  const firstClosed = c.rows.findIndex((r) => !isOpenRow(r.type, r.covered));
  const closedBelow = c.rows.slice(firstClosed);
  const opensAbove = firstClosed > 0 && closedBelow.every((r) => !isOpenRow(r.type, r.covered));
  const lowH = closedBelow.reduce((t, r) => t + (r.height ?? 0), 0);
  if (!opensAbove || lowH <= 0 || lowH > 42) return ['tall'];
  const openH = c.height - lowH;
  return [c.depth <= 16 ? 'shallowBase' : 'base', openH <= 60 ? 'bookcase60' : 'bookcase96'];
}

export interface BallparkLine { label: string; qty: number; unit: string; rate: Band; amount: Band }
export interface Ballpark { lines: BallparkLine[]; total: Band; low: number; high: number; painted: boolean }

const times = (b: Band, q: number): Band => [b[0] * q, b[1] * q, b[2] * q];
const roundTo = (v: number, step: number) => (step > 0 ? Math.round(v / step) * step : v);

/** The design priced off the rate card: lineal feet by category, plus the adders it calls for. */
export function ballpark(p: Project): Ballpark {
  const rc = rateCardOf(p);
  const painted = (p.quote?.paintWhen ?? 'prefinish') !== 'none' && p.settings.finish !== 'stain';
  const table = painted ? rc.painted : rc.unfinished;
  const lf = new Map<BallparkCategory, number>();
  const count: Record<BallparkFeature, number> = { inset: 0, drawer: 0, decorativeEnd: 0, archKick: 0, premiumTop: 0, mapleTop: 0, shelf: 0, divider: 0 };
  for (const c of p.cabinets) {
    const cats = categoriesOf(c);
    if (!cats.length) continue;
    const cat = cats[0];
    const ft = (c.width / 12) * (c.island && c.islandSides === 2 ? 2 : 1);
    for (const k of cats) lf.set(k, (lf.get(k) ?? 0) + ft);
    const parts = buildParts(c, p.settings, resolveEnds(p.room, p.cabinets, c));
    if ((c.overrides?.doorMount ?? p.settings.doorMount) === 'inset' && parts.some((x) => x.role === 'door' || x.role === 'drawerFront')) count.inset += ft;
    // The card's base rate assumes the usual drawer over door; shallow bases assume doors only
    const drawers = parts.filter((x) => x.role === 'drawerBox').length;
    count.drawer += cat === 'shallowBase' ? drawers : cat === 'base' ? Math.max(0, drawers - 1) : 0;
    count.decorativeEnd += parts.filter((x) => x.role === 'endPanel').length;
    if (baseOf(c).style === 'arch') count.archKick += 1;
    if (c.countertop && c.topKind === 'wood') count[c.depth <= 18 ? 'mapleTop' : 'premiumTop'] += ft;
    count.divider += parts.filter((x) => x.role === 'divider').length;
  }
  const lines: BallparkLine[] = [];
  for (const [cat, q] of lf) lines.push({ label: categoryLabel[cat], qty: q, unit: 'LF', rate: table[cat], amount: times(table[cat], q) });
  for (const k of Object.keys(count) as BallparkFeature[]) if (count[k] > 0) lines.push({ label: featureLabel[k], qty: count[k], unit: k === 'inset' || k === 'premiumTop' || k === 'mapleTop' ? 'LF' : 'ea', rate: rc.features[k], amount: times(rc.features[k], count[k]) });
  const total = lines.reduce<Band>((t, l) => [t[0] + l.amount[0], t[1] + l.amount[1], t[2] + l.amount[2]], [0, 0, 0]);
  // The verbal range: the typical estimate, give or take the card's spread
  return { lines, total, low: roundTo(total[1] * (1 - rc.range), rc.roundTo), high: roundTo(total[1] * (1 + rc.range), rc.roundTo), painted };
}

/**
 * The calculated quote for just what the card covers: the cabinetry it has categories for, with its
 * painting when painted. Ceilings, mantels, pilasters, shelves, room trim, furniture and extras out.
 */
export function comparableQuote(p: Project): { amount: number; paintEstimated: boolean } {
  const q = p.quote ?? {};
  const only: Project = {
    ...p, cabinets: p.cabinets.filter((c) => categoryOf(c) != null), panels: [], ceiling: { ...p.ceiling, on: false }, furniture: [],
    scope: { ...p.scope, doors: false, roomTrim: false },
    quote: { ...q, extras: [], adjustment: 0, roundTo: 0, linePrices: undefined },
  };
  const r = priceQuote(only);
  const painted = ballpark(p).painted;
  if (!painted) return { amount: r.total - r.painter, paintEstimated: false };
  // No painter's number in yet: the card's painted rates include painting, so use the size-based estimate
  if (r.painter <= 0) return { amount: r.total + paintEstimate(only, quoteOf(only)).amount, paintEstimated: true };
  return { amount: r.total, paintEstimated: false };
}
