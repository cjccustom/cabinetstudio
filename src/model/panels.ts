// Wall paneling (beadboard backsplash, wainscot) and what to order for it.
// Nantucket Beadboard Co. sells 4×8 sheets and 1/2" shiplap strips in four bead profiles.
import { topThick } from './parts';
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
  const topT = cab.countertop ? topThick(cab, p.settings.counterThickness) : 0;
  const bottom = cab.elevation + cab.height + topT;
  const upper = p.cabinets
    .filter((o) => o.wall === cab.wall && o.elevation > bottom && o.offset < cab.offset + cab.width && cab.offset < o.offset + o.width)
    .sort((a, b) => a.elevation - b.elevation)[0];
  const height = upper ? upper.elevation - bottom : 30;
  // Running up to an upper cabinet, the cabinet finishes the top edge; a cap only goes on a free edge
  return { ...newPanel(cab.wall, cab.offset, cab.width, bottom, Math.max(6, height), p.panels ?? []), cap: !upper };
}

/** The top of a cabinet as the wall sees it: its countertop or bench seat included. */
const topOf = (p: Project, c: Cabinet) => c.elevation + c.height + (c.countertop ? topThick(c, p.settings.counterThickness) : 0);
const overlaps = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 - 0.5 && b0 < a1 - 0.5;

/**
 * The wall between cabinets below and cabinets above on the same wall, over a span: a mudroom
 * bench and the cubbies over it, or the base cabinets and uppers of an entertainment center.
 * Bottom at the highest top below (seat or countertop included), top at the lowest upper above.
 */
export function gapBetween(p: Project, wall: WallId, x0: number, x1: number, near: number): { bottom: number; top: number | null; x0: number; x1: number } | null {
  const on = p.cabinets.filter((c) => c.wall === wall && c.kind !== 'mantel' && overlaps(c.offset, c.offset + c.width, x0, x1));
  const below = on.filter((c) => topOf(p, c) <= near + 0.5);
  const above = on.filter((c) => c.elevation >= near - 0.5);
  if (!below.length) return null;
  const bottom = Math.max(...below.map((c) => topOf(p, c)));
  const up = above.filter((c) => c.elevation >= bottom - 0.01);
  const top = up.length ? Math.min(...up.map((c) => c.elevation)) : null;
  // Across the cabinets below, kept within the uppers' span when they're narrower
  let a = Math.min(...below.map((c) => c.offset)), b = Math.max(...below.map((c) => c.offset + c.width));
  if (up.length) { a = Math.max(a, Math.min(...up.map((c) => c.offset))); b = Math.min(b, Math.max(...up.map((c) => c.offset + c.width))); }
  return b - a > 1 ? { bottom, top, x0: a, x1: b } : null;
}

/** Beadboard filling the wall between the picked cabinets and what's above (or below) them. */
export function panelBetween(p: Project, picked: Cabinet[]): WallPanel | null {
  if (!picked.length) return null;
  const wall = picked[0].wall;
  const same = picked.filter((c) => c.wall === wall);
  const x0 = Math.min(...same.map((c) => c.offset)), x1 = Math.max(...same.map((c) => c.offset + c.width));
  // Picked the uppers (cubbies)? Look down from their bottom; else up from the tops of the lowers
  const uppers = same.every((c) => c.kind === 'wall' || c.elevation > 12);
  const near = uppers ? Math.min(...same.map((c) => c.elevation)) : Math.max(...same.map((c) => topOf(p, c)));
  const g = gapBetween(p, wall, x0, x1, near);
  if (!g) return null;
  const height = g.top != null ? g.top - g.bottom : 30;
  if (height < 2) return null;
  return { ...newPanel(wall, g.x0, g.x1 - g.x0, g.bottom, height, p.panels ?? []), cap: g.top == null };
}

/** Refit a panel to the cabinets below and above it where it is now. */
export function fitPanel(p: Project, w: WallPanel): Partial<WallPanel> | null {
  const g = gapBetween(p, w.wall, w.offset, w.offset + w.width, w.bottom + 1);
  if (!g) return null;
  return { offset: g.x0, width: g.x1 - g.x0, bottom: g.bottom, ...(g.top != null ? { height: g.top - g.bottom, cap: false } : {}) };
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
