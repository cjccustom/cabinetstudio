// Blum hinges, slides and locking devices for a job, picked from the Woodworker Express price list.
import { roomProjects } from './rooms';
import type { Project } from './types';
import { buildParts, eff } from './parts';
import { resolveEnds } from './layout';
import { hingeHoles } from './eagle';
import { wweParts, type WWEPart } from './woodworkerExpress';
import { fmt } from '../units';

export interface HardwareLine { part: WWEPart; qty: number; each: number; total: number; use: string; group: 'hinges' | 'slides' }
export interface HardwareProblem { group: HardwareLine['group']; text: string }
export interface HardwareOrder { lines: HardwareLine[]; problems: HardwareProblem[]; hinges: number; drawers: number; cost: number; /** Lift-up doors, each on a Blum Aventos HK top bought separately. */ lifts: number }

const byPart = (n: string) => wweParts.find((p) => p.part === n);

/** Price for the whole job's quantity of one SKU, with Woodworker Express's quantity breaks. */
export function tierPrice(p: WWEPart, qty: number): number {
  let price = p.price;
  for (const t of p.tiers) if (qty >= t.min) price = t.price;
  return price;
}

export function hardwareOrder(p: Project): HardwareOrder {
  const need = new Map<string, { part: WWEPart; qty: number; uses: Set<string>; group: HardwareLine['group'] }>();
  const problems = new Map<string, HardwareLine['group']>();
  const flag = (text: string, group: HardwareLine['group']) => problems.set(text, group);
  const add = (part: WWEPart | undefined, qty: number, use: string, group: HardwareLine['group'], missing: string) => {
    if (!part) { flag(missing, group); return; }
    const row = need.get(part.sku) ?? { part, qty: 0, uses: new Set<string>(), group };
    row.qty += qty;
    row.uses.add(use);
    need.set(part.sku, row);
  };
  let hinges = 0, drawers = 0, lifts = 0;
  // Every room's cabinets, each against its own room's walls
  for (const rp of roomProjects(p)) for (const c of rp.cabinets) {
    const s = eff(c, p.settings);
    const inset = s.doorMount === 'inset';
    for (const part of buildParts(c, p.settings, resolveEnds(rp.room, rp.cabinets, c))) {
      const o = part.order;
      if (!o) continue;
      if (o.item === 'door') {
        const n = hingeHoles(o.h);
        if (o.spec.includes('lift-up')) {
          lifts += 1;
          flag(`Lift-up door in ${c.name}: Blum Aventos HK top, sized to the door's height and weight; not in the Woodworker Express list, order it separately`, 'hinges');
          // An HK top suits doors up to about 24" high; taller ones want a bi-fold (HF) or vertical lift (HL)
          if (o.h > 24) flag(`${c.name}: a ${fmt(o.h)} high lift-up door is taller than an Aventos HK top takes (about 24"); use an HF bi-fold or HL lift, or split the opening`, 'hinges');
          continue;
        }
        if (o.spec.includes('bifold')) { flag(`Bifold corner doors in ${c.name} need their own hinges (not in the price list)`, 'hinges'); continue; }
        hinges += n;
        if (s.hingeType === 'compact') {
          if (inset) { flag(`${c.name}: Blum Compact hinges are overlay only; inset doors need Clip Top`, 'hinges'); continue; }
          const h = wweParts.find((x) => x.category === 'hinge' && x.series.startsWith('COMPACT') && Math.abs((x.overlay ?? 0) - s.doorOverlay) < 1e-3);
          add(h, n, c.name, 'hinges', `No Blum Compact hinge for a ${fmt(s.doorOverlay)} overlay in the price list`);
        } else if (inset) {
          // Inset on a face frame: half-crank hinge on the 9 mm face frame adapter
          add(byPart('71B3650'), n, c.name, 'hinges', 'Clip Top half-crank hinge missing from the price list');
          add(byPart('175H5030.21'), n, c.name, 'hinges', '9 mm face frame plate missing from the price list');
        } else {
          add(byPart('71B3550'), n, c.name, 'hinges', 'Clip Top full overlay hinge missing from the price list');
          add(byPart('175H6000'), n, c.name, 'hinges', 'Face frame plate missing from the price list');
          flag('Clip Top on overlay doors: check the plate gives your overlay before ordering', 'hinges');
        }
      }
      if (o.item === 'drawerBox') {
        drawers++;
        if (s.drawerSlide !== 'tandem') { flag('Only Blum Tandem slides are in the price list so far', 'slides'); continue; }
        const family = s.drawerSide <= 0.625 ? 'TANDEM 563H' : 'TANDEM 563F';
        const slide = wweParts.find((x) => x.series === family && x.length === o.d);
        add(slide, 1, c.name, 'slides', `No ${family} slide for a ${fmt(o.d ?? 0)} box`);
        const clip = inset ? 'T51.1901.PS' : 'T51.1901';
        add(byPart(`${clip} L`), 1, c.name, 'slides', `${clip} L locking device missing from the price list`);
        add(byPart(`${clip} R`), 1, c.name, 'slides', `${clip} R locking device missing from the price list`);
        if (s.tandemRearBrackets === 'always' || (s.tandemRearBrackets === 'overlay' && !inset)) add(byPart('295.3750.02'), 2, c.name, 'slides', 'Tandem rear bracket missing from the price list');
      }
    }
  }
  const lines = [...need.values()].map((r) => {
    const each = tierPrice(r.part, r.qty);
    return { part: r.part, qty: r.qty, each, total: each * r.qty, use: [...r.uses].join(', '), group: r.group };
  }).sort((a, b) => (a.group === b.group ? 0 : a.group === 'hinges' ? -1 : 1) || a.part.part.localeCompare(b.part.part));
  return { lines, problems: [...problems].map(([text, group]) => ({ text, group })), hinges, drawers, lifts, cost: lines.reduce((t, l) => t + l.total, 0) };
}

/** Lines to paste into an order or keep with the job: SKU, quantity, part number. */
export const hardwareText = (job: string, h: HardwareOrder) =>
  [`${job}: Woodworker Express order`, '', 'SKU\tQty\tBlum part\tDescription', ...h.lines.map((l) => `${l.part.sku}\t${l.qty}\t${l.part.part}\t${l.part.description}`)].join('\n');
