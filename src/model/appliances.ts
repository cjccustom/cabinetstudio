// Appliances built into the cabinetry: a microwave on its own shelf in a bank of tall cabinets, a
// wall oven or microwave drawer behind a trim kit, an electric fireplace insert in a built-in.
// They live in a face frame row of type 'appliance'. They're bought by the owner, never cut or
// ordered, so they stay out of the parts list: the shop cuts the opening and the fixed shelf
// the appliance sits on. Sizes start as typical placeholders until the model's spec sheet is in.
import type { Cabinet, FaceRow, ShopSettings } from './types';
import { eff, layoutRows } from './parts';
import { fmt } from '../units';

export type ApplianceKind = 'microwave' | 'builtInMicrowave' | 'microwaveDrawer' | 'oven' | 'fireplace' | 'beverage' | 'tv' | 'other';

export interface Appliance {
  kind: ApplianceKind;
  /** Make and model, once picked. */
  model?: string;
  /** The appliance's own size (for a trim kit or a fireplace with a frame: the part that goes in the opening). */
  w: number;
  h: number;
  d: number;
  /** Clearance it needs each side, above, and behind (venting, cords). */
  side: number;
  top: number;
  back: number;
  /** shelf: sits back on an open shelf (front 1" behind the face frame); flush: its face or trim at the face frame. */
  mount: 'shelf' | 'flush';
}

/** Each kind with typical sizes to start from. Every one gets checked against the spec sheet. */
export const applianceKinds: Record<ApplianceKind, { label: string; short: string; size: Omit<Appliance, 'kind' | 'model'>; note: string }> = {
  microwave: { label: 'Microwave on a shelf', short: 'Microwave', size: { w: 22, h: 13, d: 17, side: 1, top: 2, back: 1, mount: 'shelf' }, note: 'Countertop microwave in its own open space; keep its venting clearance and put an outlet in the space' },
  builtInMicrowave: { label: 'Built-in microwave with trim kit', short: 'Microwave', size: { w: 24, h: 13.5, d: 18, side: 1.5, top: 2, back: 1, mount: 'flush' }, note: 'Built-in microwave; the trim kit covers the gap to the face frame. Size the opening to the trim kit cutout' },
  microwaveDrawer: { label: 'Microwave drawer', short: 'Microwave drawer', size: { w: 30, h: 15, d: 23, side: 0, top: 0, back: 1, mount: 'flush' }, note: 'Microwave drawer; size the opening to its cutout and give it an outlet behind' },
  oven: { label: 'Wall oven', short: 'Wall oven', size: { w: 28.5, h: 27.75, d: 23.5, side: 0, top: 0, back: 0, mount: 'flush' }, note: 'Wall oven; the fixed shelf has to carry the oven, and the cutout follows the oven\'s spec' },
  fireplace: { label: 'Electric fireplace insert', short: 'Fireplace', size: { w: 36, h: 24, d: 12, side: 0, top: 0, back: 1, mount: 'flush' }, note: 'Electric fireplace insert; frame the opening to its spec, outlet inside, and keep any clearance it calls for above the opening' },
  beverage: { label: 'Beverage / wine fridge', short: 'Beverage fridge', size: { w: 23.5, h: 33.75, d: 23, side: 0.25, top: 0.25, back: 1, mount: 'flush' }, note: 'Undercounter fridge; front-venting, outlet in the next cabinet' },
  tv: { label: 'TV in an open space', short: 'TV', size: { w: 49, h: 28.5, d: 3, side: 1, top: 1, back: 0, mount: 'shelf' }, note: 'TV in an open space; low-voltage box and outlet behind it' },
  other: { label: 'Other appliance', short: 'Appliance', size: { w: 24, h: 18, d: 18, side: 0.5, top: 0.5, back: 1, mount: 'shelf' }, note: 'Owner\'s appliance; check the spec sheet for clearances' },
};

export const newAppliance = (kind: ApplianceKind): Appliance => ({ kind, ...applianceKinds[kind].size });
export const applianceName = (a: Appliance) => applianceKinds[a.kind].short + (a.model ? ` (${a.model})` : '');

/** The opening height that fits it: the appliance plus its top clearance. */
export const openingFor = (a: Appliance) => a.h + a.top;

export interface PlacedAppliance {
  row: FaceRow;
  a: Appliance;
  /** Cabinet-local box, x across, y up, z wall to front. */
  min: [number, number, number];
  size: [number, number, number];
  /** The face frame opening it sits in. */
  opening: { x0: number; x1: number; y0: number; y1: number };
  problems: string[];
}

/** Where each appliance sits in its cabinet, and anything that doesn't fit. */
export function placedAppliances(c: Cabinet, s: ShopSettings): PlacedAppliance[] {
  if (c.corner || c.kind === 'pilaster' || c.kind === 'shelf') return [];
  s = eff(c, s);
  const { rows } = layoutRows(c, s);
  const sw = s.stileWidth;
  const ox0 = (c.scribeLeft ?? 0) + (c.stileLeftWidth ?? sw);
  const ox1 = c.width - (c.scribeRight ?? 0) - (c.stileRightWidth ?? sw);
  const out: PlacedAppliance[] = [];
  c.rows.forEach((row, i) => {
    const a = row.type === 'appliance' ? row.appliance : undefined;
    const r = rows[i];
    if (!a || !r) return;
    const recess = a.mount === 'shelf' ? 1 : 0;
    const zFront = c.depth - recess;
    const problems: string[] = [];
    const name = applianceKinds[a.kind].short.toLowerCase();
    const openW = ox1 - ox0;
    if (a.w + 2 * a.side > openW + 0.01) problems.push(`The ${name} needs ${fmt(a.w + 2 * a.side)} wide with clearance; the opening is ${fmt(openW)}.`);
    if (a.h + a.top > r.height + 0.01) problems.push(`The ${name} needs ${fmt(a.h + a.top)} high with clearance; the opening is ${fmt(r.height)}.`);
    if (a.d + a.back + recess > c.depth + 0.01) problems.push(`The ${name} needs ${fmt(a.d + a.back + recess)} deep; the cabinet is ${fmt(c.depth)}.`);
    out.push({
      row, a, problems,
      min: [(ox0 + ox1) / 2 - a.w / 2, r.y0, zFront - a.d],
      size: [a.w, a.h, a.d],
      opening: { x0: ox0, x1: ox1, y0: r.y0, y1: r.y1 },
    });
  });
  return out;
}

/** Notes for the drawings and the shop: what goes in each opening and what it needs. */
export function applianceNotes(c: Cabinet, s: ShopSettings): string[] {
  return placedAppliances(c, s).map((p) => {
    const k = applianceKinds[p.a.kind];
    const o = p.opening;
    return `${applianceName(p.a)} by owner, ${fmt(p.a.w)} W × ${fmt(p.a.h)} H × ${fmt(p.a.d)} D, in a ${fmt(o.x1 - o.x0)} × ${fmt(o.y1 - o.y0)} opening. ${k.note}. Verify with the spec sheet before building.`;
  });
}
