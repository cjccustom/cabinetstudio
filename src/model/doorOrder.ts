// Reeb interior doors for the openings in a design: which slab or prehung unit, its size and
// handing, and what it costs at the price entered for this job.
import type { Opening, Project } from './types';
import { inScope } from './room';
import { catalogPrice, designByCode, stockSlab, tradeSize, type ReebDesign } from './reeb';

export const doorOf = (o: Opening) => ({ hinge: 'left' as const, leaves: 1 as const, prehung: true, ...o.door });

export interface DoorLine { key: string; design: ReebDesign; /** Where the price came from. */ priceFrom: 'job' | 'catalog' | null; w: number; h: number; hinge: 'left' | 'right'; leaves: 1 | 2; prehung: boolean; qty: number; openings: string[]; fits: boolean; price: number | null; cost: number }

/** Trade description of one door, also the key its price is saved under. */
export const doorKey = (code: string, w: number, h: number, leaves: number, prehung: boolean) =>
  `${code} ${leaves > 1 ? 'pair ' : ''}${tradeSize(w)}x${tradeSize(h)} ${prehung ? 'prehung' : 'slab'}`;

export function doorOrder(p: Project): DoorLine[] {
  if (!inScope(p, 'doors')) return [];
  const lines = new Map<string, DoorLine>();
  for (const o of p.openings ?? []) {
    if (o.kind !== 'door') continue;
    const d = doorOf(o);
    const design = designByCode(d.design);
    if (!design) continue;
    const slab = stockSlab(o.width, o.height, d.leaves);
    const key = doorKey(design.code, slab.w, slab.h, d.leaves, d.prehung);
    const id = `${key}|${d.hinge}`;
    // A price entered for the job beats Reeb's catalog price; a pair is two doors (catalog lists single units)
    const own = p.doorPrices?.[key];
    const cat = own == null && d.leaves === 1 ? catalogPrice(design, slab.w, slab.h, d.prehung) : null;
    const price = own ?? (cat != null ? cat * (1 + (p.doorAdjust ?? 0)) : null);
    const priceFrom = own != null ? 'job' as const : cat != null ? 'catalog' as const : null;
    const line = lines.get(id) ?? { key, design, priceFrom, w: slab.w, h: slab.h, hinge: d.hinge, leaves: d.leaves, prehung: d.prehung, qty: 0, openings: [], fits: slab.fits, price, cost: 0 };
    line.qty++;
    line.openings.push(o.name);
    line.fits = line.fits && slab.fits;
    line.cost = price == null ? 0 : price * line.qty;
    lines.set(id, line);
  }
  return [...lines.values()];
}
