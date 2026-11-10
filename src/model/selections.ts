// The customer's selections at a later meeting: door style, finish, species, door mounting, knobs
// and pulls. Each choice changes the design the same way the shop settings do, and shows what it
// does to the price, so the customer sees the cost of a choice as they make it.
import type { Project, ShopSettings } from './types';
import { doorMaterials, doorStyles, styleById } from './eagle';
import { lumberNames, priceBook, setJobFinish } from './pricebook';
import { amSpecies } from './moldings';
import { priceQuote } from './quote';
import { pullFinishes, pullStyles } from './pulls';
import { contractTotal } from './contract';
import { cardOf, checkDiscountOf } from './payDiscount';
import type { PriceItem } from '../shop/shop';

export interface SelOption { v: string; label: string }
export interface Selection {
  id: string;
  label: string;
  /** Shown when it applies (species only with stain, material only on wood doors...). */
  shown: (p: Project) => boolean;
  options: (p: Project) => SelOption[];
  current: (p: Project) => string;
  apply: (p: Project, v: string, book: PriceItem[]) => Project;
  /** Choices that don't change the price (hardware color): no price shown. */
  free?: boolean;
}

const set = (p: Project, patch: Partial<ShopSettings>): Project => ({ ...p, settings: { ...p.settings, ...patch } });

export const selections: Selection[] = [
  {
    id: 'doorStyle', label: 'Door style', shown: () => true,
    options: () => doorStyles.map((d) => ({ v: d.id, label: d.bead ? `${d.name} (${d.bead})` : d.name })),
    current: (p) => p.settings.doorStyleId,
    apply: (p, v) => {
      const s = p.settings, next = styleById(v);
      return set(p, { doorStyleId: next.id, doorStile: next.fixedStile ? next.stile : s.doorStile, doorMaterial: next.line === 'MDF' ? 'MDF' : s.doorMaterial === 'MDF' ? 'Paint-grade maple' : s.doorMaterial });
    },
  },
  {
    id: 'mount', label: 'Doors and drawer fronts', shown: () => true,
    options: () => [{ v: 'overlay', label: 'Overlay (doors sit on the frame)' }, { v: 'inset', label: 'Inset (doors sit flush inside the frame)' }],
    current: (p) => p.settings.doorMount,
    apply: (p, v) => {
      const s = p.settings;
      const panel = v === 'inset' ? (s.endPanel === 'none' ? 'none' : 'inset') : s.endPanel === 'inset' ? 'flush' : s.endPanel;
      return v === 'inset' ? set(p, { doorMount: 'inset', endPanel: panel, ...(s.hingeType === 'compact' ? { hingeType: 'cliptop' as const } : {}) }) : set(p, { doorMount: 'overlay', endPanel: panel });
    },
  },
  {
    id: 'finish', label: 'Finish', shown: () => true,
    options: () => [{ v: 'paint', label: 'Painted' }, { v: 'stain', label: 'Stained or natural wood' }],
    current: (p) => (p.settings.finish === 'stain' ? 'stain' : 'paint'),
    apply: (p, v, book) => setJobFinish(p, v === 'stain' ? 'stain' : 'paint', p.settings.woodSpecies, book, doorMaterials, amSpecies),
  },
  {
    id: 'species', label: 'Wood species', shown: (p) => p.settings.finish === 'stain',
    options: (p) => [...new Set([p.settings.woodSpecies, ...lumberNames()])].map((x) => ({ v: x, label: x })),
    current: (p) => p.settings.woodSpecies,
    apply: (p, v, book) => setJobFinish(p, 'stain', v, book, doorMaterials, amSpecies),
  },
  {
    id: 'doorMaterial', label: 'Door material', shown: (p) => styleById(p.settings.doorStyleId).line !== 'MDF' && p.settings.finish !== 'stain',
    options: () => doorMaterials.filter((m) => m !== 'MDF').map((m) => ({ v: m, label: m })),
    current: (p) => p.settings.doorMaterial,
    apply: (p, v) => set(p, { doorMaterial: v }),
  },
  {
    id: 'pulls', label: 'Knobs and pulls', shown: () => true,
    options: () => pullStyles.map((x) => ({ v: x.v, label: x.label })),
    current: (p) => p.settings.pulls ?? 'standard',
    apply: (p, v) => set(p, { pulls: v as ShopSettings['pulls'] }),
  },
  {
    id: 'pullFinish', label: 'Knob and pull color', shown: (p) => (p.settings.pulls ?? 'standard') !== 'finger', free: true,
    options: () => pullFinishes.map((x) => ({ v: x.v, label: x.label })),
    current: (p) => p.settings.pullFinish ?? 'nickel',
    apply: (p, v) => set(p, { pullFinish: v as ShopSettings['pullFinish'] }),
  },
];

/** The price the customer sees: the card price when the job lists a check discount. */
export const listedPrice = (p: Project) => { const t = priceQuote(p).total; return cardOf(t, checkDiscountOf(p)); };

/** What a signed job was agreed at, if it's signed. */
export const signedPrice = (p: Project) => (p.contract ? contractTotal(p.contract) : null);

/** Each option's effect on the listed price, against the design as it is now. */
export function optionDeltas(p: Project, sel: Selection, book: PriceItem[] = priceBook({})): Map<string, number> {
  const base = listedPrice(p);
  const out = new Map<string, number>();
  for (const o of sel.options(p)) {
    if (o.v === sel.current(p)) { out.set(o.v, 0); continue; }
    try { out.set(o.v, listedPrice(sel.apply(p, o.v, book)) - base); } catch { /* an option that can't be priced shows no price */ }
  }
  return out;
}

/** The selections as words, for the visit record. */
export function selectionText(p: Project): string[] {
  return selections.filter((s) => s.shown(p)).map((s) => `${s.label}: ${s.options(p).find((o) => o.v === s.current(p))?.label ?? s.current(p)}`);
}
