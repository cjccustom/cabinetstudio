// Wall paneling (beadboard backsplash, wainscot) and what to order for it.
// Nantucket Beadboard Co. sells 4×8 sheets and 1/2" shiplap strips in four bead profiles.
import type { Cabinet, Project, WallId, WallPanel } from './types';
import { uid } from './defaults';
import { fmt } from '../units';
import { beadboardCatalog, type BeadboardOption, type BeadboardProduct } from './nantucket';

const legacy: Record<string, string> = { standard: 'standard-bead', vbead: 'v-bead', vgroove: 'v-groove', channel: '1-4-x-1-8-channel' };

export const productOf = (w: WallPanel): BeadboardProduct =>
  beadboardCatalog.find((p) => p.id === (legacy[w.profile] ?? w.profile)) ?? beadboardCatalog[0];

/** The catalog option matching the panel's spacing and thickness, or the closest one the product comes in. */
export function optionOf(w: WallPanel): BeadboardOption {
  const opts = productOf(w).options;
  return (
    opts.find((o) => o.oc === w.spacing && o.thickness === (w.thickness ?? 0.5)) ??
    opts.find((o) => o.oc === w.spacing) ??
    opts.find((o) => o.thickness === (w.thickness ?? 0.5)) ??
    opts[0]
  );
}

export const spacingOf = (w: WallPanel) => optionOf(w).oc ?? 4;

export const panelMaterials: Record<WallPanel['material'], string> = {
  MDF: 'Primed MDF (interior)',
  MRI: 'MRI moisture-resistant MDF',
  MRX: 'MRX exterior MDF',
  PVC: 'PVC',
};

export function newPanel(wall: WallId, offset: number, width: number, bottom: number, height: number, existing: WallPanel[]): WallPanel {
  let n = 1;
  while (existing.some((p) => p.name === `P${n}`)) n++;
  return {
    id: uid('panel'), name: `P${n}`, wall, offset, width, bottom, height,
    profile: 'standard-bead', spacing: 2, thickness: 0.5, material: 'MDF', cap: true, capHeight: 1, capDepth: 2.5,
  };
}

/** Beadboard sized to the wall above a cabinet: from its top up to the upper cabinet, or 30". */
export function panelAbove(p: Project, cab: Cabinet): WallPanel {
  const topT = cab.countertop ? cab.topThickness ?? (cab.topKind === 'wood' ? 1.25 : p.settings.counterThickness) : 0;
  const bottom = cab.elevation + cab.height + topT;
  const upper = p.cabinets
    .filter((o) => o.wall === cab.wall && o.elevation > bottom && o.offset < cab.offset + cab.width && cab.offset < o.offset + o.width)
    .sort((a, b) => a.elevation - b.elevation)[0];
  const height = upper ? upper.elevation - bottom : 30;
  // Running up to an upper cabinet, the cabinet finishes the top edge; a cap only goes on a free edge
  return { ...newPanel(cab.wall, cab.offset, cab.width, bottom, Math.max(6, height), p.panels ?? []), cap: !upper };
}

export interface PanelOrderLine { panel: WallPanel; item: string; qty: number; detail: string }

/** Sheets or strips to order for one panel. Short panels are cut from sheets in rows. */
export function panelOrder(w: WallPanel): PanelOrderLine {
  const prod = productOf(w);
  const opt = optionOf(w);
  const code = !opt.code ? '' : w.material === 'MDF' ? ` (${opt.code})` : ` (MDF code ${opt.code}; ask for the ${w.material} code)`;
  const spec = `${prod.name}${opt.oc ? `, ${fmt(opt.oc)} o.c.` : ''}, ${fmt(opt.thickness)} ${panelMaterials[w.material]}${code}`;
  const sqft = (w.width * w.height) / 144;
  if (prod.family === 'sheet') {
    const cols = Math.ceil(w.width / 48 - 1e-6);
    const perSheet = Math.max(1, Math.floor(96 / w.height + 1e-6));
    const sheets = w.height > 96 ? cols * Math.ceil(w.height / 96) : Math.ceil(cols / perSheet);
    return { panel: w, item: `4×8 sheet, ${spec}`, qty: sheets, detail: `${fmt(w.width)} × ${fmt(w.height)} (${sqft.toFixed(1)} sq ft)` };
  }
  const face = opt.face ?? 9.5;
  const strips = Math.ceil(w.width / face - 1e-6);
  const length = w.height <= 96 ? 96 : w.height <= 120 ? 120 : w.height <= 144 ? 144 : 192;
  return { panel: w, item: `${fmt(face)} face strip, ${length / 12}' long, ${spec}`, qty: strips, detail: `${strips} strips at ${fmt(face)} face cover ${fmt(w.width)}; cut to ${fmt(w.height)} (${sqft.toFixed(1)} sq ft)` };
}
