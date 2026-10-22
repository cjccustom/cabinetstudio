// Wall paneling (beadboard backsplash, wainscot) and what to order for it.
// Nantucket Beadboard Co. sells 4×8 sheets and 1/2" shiplap strips in four bead profiles.
import type { Cabinet, Project, WallId, WallPanel } from './types';
import { uid } from './defaults';
import { fmt } from '../units';

export const profiles: Record<WallPanel['profile'], { name: string; spacing: number; sheetOnly?: boolean }> = {
  standard: { name: 'Standard Bead', spacing: 2 },
  vbead: { name: 'V-Bead', spacing: 1.625 },
  vgroove: { name: 'V-Groove', spacing: 1.625 },
  channel: { name: 'Channel Bead', spacing: 2, sheetOnly: true },
};

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
    profile: 'standard', material: 'MDF', format: 'sheet', cap: true, capHeight: 1, capDepth: 2.5,
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

/** Sheets or strips to order for one panel. Sheets are cut into rows when the panel is short. */
export function panelOrder(w: WallPanel): PanelOrderLine {
  const prof = profiles[w.profile];
  const spec = `${prof.name}, ${panelMaterials[w.material]}`;
  const sqft = (w.width * w.height) / 144;
  if (w.format === 'sheet' || prof.sheetOnly) {
    const cols = Math.ceil(w.width / 48 - 1e-6);
    const perSheet = Math.max(1, Math.floor(96 / w.height + 1e-6));
    const sheets = w.height > 96 ? cols * Math.ceil(w.height / 96) : Math.ceil(cols / perSheet);
    return { panel: w, item: `4×8 sheet, ${spec}`, qty: sheets, detail: `${fmt(w.width)} × ${fmt(w.height)} (${sqft.toFixed(1)} sq ft)` };
  }
  // Shiplap strips cover about 9 1/2" each once lapped
  const strips = Math.ceil(w.width / 9.5);
  return { panel: w, item: `1/2" shiplap strips, ${spec}`, qty: strips, detail: `${strips} strips at least ${fmt(w.height)} long (${sqft.toFixed(1)} sq ft)` };
}
