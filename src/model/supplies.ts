// Shop supplies: screws, glue, staples, edgebanding, abrasives and install sundries, each
// counted from the design by what drives it (face frame joints, hinges, drawers, feet of banding).
import type { Project } from './types';
import { buildParts } from './parts';
import { resolveEnds } from './layout';
import { defaultCutlist, optimizerParts } from './cutlist';
import { woodPieces } from './faceframe';
import { hardwareOrder } from './hardware';
import { uid } from './defaults';

export type SupplyDriver = 'cabinet' | 'ffJoint' | 'hinge' | 'drawer' | 'bracket' | 'endPanel' | 'bandFt' | 'woodTop' | 'panelSqFt' | 'job';
export type SupplyGroup = 'cabinets' | 'tops' | 'paneling';

export const driverLabel: Record<SupplyDriver, string> = {
  cabinet: 'per cabinet',
  ffJoint: 'per face frame joint',
  hinge: 'per hinge',
  drawer: 'per drawer',
  bracket: 'per rear bracket',
  endPanel: 'per end panel',
  bandFt: 'per ft of edgebanding',
  woodTop: 'per wood top or seat',
  panelSqFt: 'per sq ft of paneling',
  job: 'per job',
};
const driverGroup: Record<SupplyDriver, SupplyGroup> = {
  cabinet: 'cabinets', ffJoint: 'cabinets', hinge: 'cabinets', drawer: 'cabinets', bracket: 'cabinets', endPanel: 'cabinets', bandFt: 'cabinets', job: 'cabinets',
  woodTop: 'tops', panelSqFt: 'paneling',
};

export interface SupplyItem {
  id: string;
  label: string;
  driver: SupplyDriver;
  /** How many units each driver uses, e.g. 2 pocket screws per joint. */
  qtyPer: number;
  /** What one unit costs, e.g. $0.04 a screw. */
  unitCost: number;
  unit: string;
}

const item = (label: string, driver: SupplyDriver, qtyPer: number, unit: string, unitCost: number): SupplyItem => ({ id: `sup-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, label, driver, qtyPer, unit, unitCost });

/** Starting points from typical retail prices, Oct 2026. Replace them with what you pay. */
export const defaultSupplies: SupplyItem[] = [
  item('Pocket screws, face frames', 'ffJoint', 2, 'screw', 0.04),
  item('Staples & pocket screws, boxes', 'cabinet', 40, 'fastener', 0.02),
  item('Wood glue', 'cabinet', 3, 'oz', 0.25),
  item('Hinge screws', 'hinge', 4, 'screw', 0.03),
  item('Slide & locking device screws', 'drawer', 10, 'screw', 0.03),
  item('Rear bracket screws', 'bracket', 2, 'screw', 0.03),
  item('End panel screws & glue', 'endPanel', 8, 'screw', 0.05),
  item('Birch edgebanding', 'bandFt', 1.1, 'ft', 0.12),
  item('Sandpaper & abrasives', 'cabinet', 1, 'cabinet', 2.5),
  item('Install screws, wall & cabinet-to-cabinet', 'cabinet', 8, 'screw', 0.12),
  item('Shims, filler, caulk, tape', 'job', 1, 'job', 30),
  item('Glue, biscuits & fasteners for tops', 'woodTop', 1, 'top', 6),
  item('Brads & construction adhesive', 'panelSqFt', 1, 'sq ft', 0.15),
];

export const newSupply = (): SupplyItem => ({ id: uid('sup'), label: 'New item', driver: 'cabinet', qtyPer: 1, unit: 'each', unitCost: 0 });

/** How many of each driver the design has. */
export function supplyDrivers(p: Project): Record<SupplyDriver, number> {
  let ffJoint = 0, endPanel = 0;
  for (const c of p.cabinets) {
    for (const part of buildParts(c, p.settings, resolveEnds(p.room, p.cabinets, c))) {
      // Every rail end, and each end of a center stile, is a pocket-screwed joint
      if (part.material === 'faceframe' && (part.role === 'rail' || part.name === 'Center stile')) ffJoint += 2;
      if (part.order?.item === 'endPanel') endPanel++;
    }
  }
  const hw = hardwareOrder(p);
  const bracket = hw.lines.filter((l) => l.part.part === '295.3750.02').reduce((t, l) => t + l.qty, 0);
  const data = p.cutlist ?? defaultCutlist(p);
  const bandFt = optimizerParts(p, data).reduce((t, x) => t + (x.band * x.length) / 12, 0);
  const panelSqFt = (p.panels ?? []).reduce((t, w) => t + (w.width * w.height) / 144, 0);
  return {
    cabinet: p.cabinets.length, ffJoint, hinge: hw.hinges, drawer: hw.drawers, bracket, endPanel,
    bandFt: Math.ceil(bandFt), woodTop: woodPieces(p).length, panelSqFt: Math.ceil(panelSqFt), job: p.cabinets.length || p.panels?.length ? 1 : 0,
  };
}

export interface SupplyLine { item: SupplyItem; group: SupplyGroup; count: number; qty: number; cost: number }

export function supplyLines(p: Project, items: SupplyItem[]): SupplyLine[] {
  const d = supplyDrivers(p);
  return items.map((it) => {
    const count = d[it.driver];
    const qty = count * it.qtyPer;
    return { item: it, group: driverGroup[it.driver], count, qty, cost: qty * it.unitCost };
  });
}
