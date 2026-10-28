// Appliances built into the cabinetry: a microwave on its own shelf in a bank of tall cabinets, a
// wall oven or microwave drawer behind a trim kit, an electric fireplace insert in a built-in.
// They live in a face frame row of type 'appliance'. They're bought by the owner, never cut or
// ordered, so they stay out of the parts list: the shop cuts the opening and the fixed shelf
// the appliance sits on. Sizes start as typical placeholders until the model's spec sheet is in.
import type { Cabinet, FaceRow, ShopSettings } from './types';
import { eff, layoutRows } from './parts';
import { fmt } from '../units';
import { mantelOf } from './mantel';

export type ApplianceKind = 'fridge' | 'microwave' | 'builtInMicrowave' | 'microwaveDrawer' | 'oven' | 'fireplace' | 'gasInsert' | 'masonry' | 'beverage' | 'tv' | 'other';

export interface Appliance {
  kind: ApplianceKind;
  /** Make and model, once picked. */
  model?: string;
  /** Where the size came from (a common-size pick), shown with it. */
  source?: string;
  /** The maker's 3D model, for the 3D view only. */
  model3d?: Model3D;
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
  fridge: { label: 'Refrigerator, full height (in a surround)', short: 'Refrigerator', size: { w: 35.75, h: 70, d: 29.25, side: 0.375, top: 1, back: 1, mount: 'flush' }, note: 'Full-size fridge standing on the floor between the surround sides; leave the door swing and hinge clearance the spec sheet asks for' },
  microwave: { label: 'Microwave on a shelf', short: 'Microwave', size: { w: 22, h: 13, d: 17, side: 1, top: 2, back: 1, mount: 'shelf' }, note: 'Countertop microwave in its own open space; keep its venting clearance and put an outlet in the space' },
  builtInMicrowave: { label: 'Built-in microwave with trim kit', short: 'Microwave', size: { w: 24, h: 13.5, d: 18, side: 1.5, top: 2, back: 1, mount: 'flush' }, note: 'Built-in microwave; the trim kit covers the gap to the face frame. Size the opening to the trim kit cutout' },
  microwaveDrawer: { label: 'Microwave drawer', short: 'Microwave drawer', size: { w: 30, h: 15, d: 23, side: 0, top: 0, back: 1, mount: 'flush' }, note: 'Microwave drawer; size the opening to its cutout and give it an outlet behind' },
  oven: { label: 'Wall oven', short: 'Wall oven', size: { w: 28.5, h: 27.75, d: 23.5, side: 0, top: 0, back: 0, mount: 'flush' }, note: 'Wall oven; the fixed shelf has to carry the oven, and the cutout follows the oven\'s spec' },
  fireplace: { label: 'Electric fireplace insert', short: 'Fireplace', size: { w: 36, h: 24, d: 12, side: 0, top: 0, back: 1, mount: 'flush' }, note: 'Electric fireplace insert; frame the opening to its spec, outlet inside, and keep any clearance it calls for above the opening' },
  gasInsert: { label: 'Gas fireplace insert', short: 'Gas insert', size: { w: 36, h: 26, d: 16, side: 0, top: 0, back: 0, mount: 'flush' }, note: 'Gas insert; framing, venting and mantel clearances per its installation manual, with the gas line and outlet inside' },
  masonry: { label: 'Existing masonry firebox', short: 'Firebox', size: { w: 36, h: 30, d: 20, side: 0, top: 0, back: 0, mount: 'flush' }, note: 'Existing wood-burning firebox' },
  beverage: { label: 'Beverage / wine fridge', short: 'Beverage fridge', size: { w: 23.5, h: 33.75, d: 23, side: 0.25, top: 0.25, back: 1, mount: 'flush' }, note: 'Undercounter fridge; front-venting, outlet in the next cabinet' },
  tv: { label: 'TV in an open space', short: 'TV', size: { w: 49, h: 28.5, d: 3, side: 1, top: 1, back: 0, mount: 'shelf' }, note: 'TV in an open space; low-voltage box and outlet behind it' },
  other: { label: 'Other appliance', short: 'Appliance', size: { w: 24, h: 18, d: 18, side: 0.5, top: 0.5, back: 1, mount: 'shelf' }, note: 'Owner\'s appliance; check the spec sheet for clearances' },
};

export const newAppliance = (kind: ApplianceKind): Appliance => ({ kind, ...applianceKinds[kind].size });

/** A manufacturer's 3D model, stored with the artifact as glTF JSON. */
export interface Model3D {
  /** The stored asset; its display path is "/_blob/" + assetId. */
  assetId?: string;
  /** Where to load it in this view (an asset path, or a memory key when it couldn't be stored). */
  url: string;
  name: string;
  units: 'mm' | 'cm' | 'm' | 'in' | 'ft';
  /** Which way is up in the file: most CAD exports are Z-up, glTF is Y-up. */
  up: 'y' | 'z';
  /** Turn so its front faces the room. */
  turn: 0 | 90 | 180 | 270;
  /** Its size in its own units, Y-up, before turning. */
  size: [number, number, number];
  /** Kept only in this browser tab (the view couldn't store assets). */
  local?: boolean;
  texturesDropped?: boolean;
}
export const modelUrl = (m: Model3D) => (m.assetId ? `/_blob/${m.assetId}` : m.url);

/**
 * Common sizes to start from. Named models come from the maker's sheets or retailer listings
 * (Oct 2026) and say so; "typical" ones are class sizes. Every one still gets checked against the
 * installation manual for the exact model before the opening is built.
 */
export interface AppliancePreset { kind: ApplianceKind; label: string; model?: string; size: Omit<Appliance, 'kind' | 'model'>; note: string }
export const appliancePresets: AppliancePreset[] = [
  { kind: 'fridge', label: '36" French door (typical)', size: { w: 35.75, h: 70, d: 29.25, side: 0.375, top: 1, back: 1, mount: 'flush' }, note: 'Typical 36" French door, standard depth; case depth without doors and handles' },
  { kind: 'fridge', label: '36" counter depth (typical)', size: { w: 35.75, h: 70, d: 24.5, side: 0.375, top: 1, back: 1, mount: 'flush' }, note: 'Typical 36" counter-depth; case depth without doors' },
  { kind: 'fridge', label: '30" top freezer (typical)', size: { w: 29.75, h: 66.25, d: 28.75, side: 0.375, top: 1, back: 1, mount: 'flush' }, note: 'Typical 30" top-freezer' },
  { kind: 'microwave', label: 'Compact countertop (typical)', size: { w: 18, h: 10.5, d: 14, side: 1, top: 2, back: 1, mount: 'shelf' }, note: 'Typical 0.7 cu ft class' },
  { kind: 'microwave', label: 'Mid-size countertop (typical)', size: { w: 22, h: 13, d: 17, side: 1, top: 2, back: 1, mount: 'shelf' }, note: 'Typical 1.2–1.6 cu ft class' },
  { kind: 'microwave', label: 'Large countertop (typical)', size: { w: 24, h: 14.25, d: 19.5, side: 1, top: 2, back: 1, mount: 'shelf' }, note: 'Typical 2.0–2.2 cu ft class' },
  { kind: 'builtInMicrowave', label: 'GE 30" trim kit (JX830)', model: 'GE JX830 trim kit', size: { w: 24.875, h: 15, d: 18, side: 0, top: 0, back: 0, mount: 'flush' }, note: 'Cutout 24 7/8 W × 15 H, 16" deep minimum (18" with the outlet in the cutout); trim 29 7/8 × 16 1/2 covers it. Bottom of trim 36" or more off the floor (GE install sheet)' },
  { kind: 'microwaveDrawer', label: 'Sharp 24" drawer (SMD2470ASY)', model: 'Sharp SMD2470ASY', size: { w: 22.125, h: 15.5625, d: 23.5, side: 0, top: 0, back: 0, mount: 'flush' }, note: 'Retailer cutout 22 1/8 × 15 9/16 × 23 1/2; Sharp\'s guide says 14 13/16 high, so check the manual. Unit 23 7/8 × 15 7/8 × 23; needs about 41" in front to open' },
  { kind: 'microwaveDrawer', label: 'Sharp 30" drawer (SMD3070ASY)', model: 'Sharp SMD3070ASY', size: { w: 29.875, h: 15.875, d: 23, side: 0, top: 0, back: 0, mount: 'flush' }, note: 'Unit size 29 7/8 × 15 7/8 × 23 (Sharp); cutout not published where I looked; get it from the manual' },
  { kind: 'oven', label: '27" single wall oven (typical)', size: { w: 25.5, h: 28, d: 23.5, side: 0, top: 0, back: 0, mount: 'flush' }, note: 'Typical 27" cutout; varies by brand' },
  { kind: 'oven', label: '30" single wall oven (typical)', size: { w: 28.5, h: 28, d: 23.5, side: 0, top: 0, back: 0, mount: 'flush' }, note: 'Typical 30" cutout; varies by brand' },
  { kind: 'oven', label: '30" double wall oven (typical)', size: { w: 28.5, h: 50.5, d: 23.5, side: 0, top: 0, back: 0, mount: 'flush' }, note: 'Typical 30" double cutout; varies by brand' },
  { kind: 'fireplace', label: 'Dimplex Revillusion 30" (RBF30)', model: 'Dimplex RBF30', size: { w: 31.25, h: 26.625, d: 12.125, side: 0, top: 2, back: 0, mount: 'flush' }, note: 'Outside 31 1/4 W × 26 5/8 H × 12 1/8 D (retailer listing); 2" above the top. Frame to the manual\'s opening' },
  { kind: 'fireplace', label: 'Dimplex Revillusion 36" (RBF36)', model: 'Dimplex RBF36', size: { w: 36.625, h: 26.25, d: 12.125, side: 0, top: 0, back: 0, mount: 'flush' }, note: 'Framing opening 36 5/8 × 26 1/4 from the sell sheet (unit 37 1/4 wide with a 1/2" self-trimming flange); 12 1/8 deep' },
  { kind: 'fireplace', label: 'Dimplex Revillusion 42" (RBF42)', model: 'Dimplex RBF42', size: { w: 43.25, h: 31, d: 12.125, side: 0, top: 2, back: 0, mount: 'flush' }, note: 'Outside 43 1/4 W × 31 H × 12 1/8 D (retailer; brochure may show 30 1/4 high); 2" above the top. Frame to the manual\'s opening' },
  { kind: 'beverage', label: '15" undercounter (typical)', size: { w: 14.875, h: 34, d: 23.5, side: 0.125, top: 0.25, back: 1, mount: 'flush' }, note: 'Typical 15" beverage center or ice maker' },
  { kind: 'beverage', label: '24" undercounter (typical)', size: { w: 23.875, h: 34, d: 23.5, side: 0.125, top: 0.25, back: 1, mount: 'flush' }, note: 'Typical 24" beverage or wine fridge' },
  { kind: 'tv', label: '55" TV (typical)', size: { w: 48.5, h: 28, d: 3, side: 1, top: 1, back: 0, mount: 'shelf' }, note: 'Typical 55" set without the stand' },
  { kind: 'tv', label: '65" TV (typical)', size: { w: 57.25, h: 33, d: 3, side: 1, top: 1, back: 0, mount: 'shelf' }, note: 'Typical 65" set without the stand' },
  { kind: 'tv', label: '75" TV (typical)', size: { w: 66.25, h: 38, d: 3, side: 1, top: 1, back: 0, mount: 'shelf' }, note: 'Typical 75" set without the stand' },
];
export const applianceName = (a: Appliance) => applianceKinds[a.kind].short + (a.model ? ` (${a.model})` : '');

/** The opening height that fits it: the appliance plus its top clearance. */
export const openingFor = (a: Appliance) => a.h + a.top;

export interface PlacedAppliance {
  /** The face frame row it's in; none for a mantel's firebox. */
  row?: FaceRow;
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
  if (c.kind === 'mantel') return mantelFirebox(c);
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

/** A mantel's firebox: the insert flush with the frieze face, or the masonry firebox behind the opening. */
function mantelFirebox(c: Cabinet): PlacedAppliance[] {
  const m = mantelOf(c);
  const a: Appliance | undefined = m.fuel === 'wood' ? { kind: 'masonry', w: m.openingW, h: m.openingH, d: 18 + c.depth, side: 0, top: 0, back: 0, mount: 'flush' } : m.insert;
  if (!a) return [];
  const problems: string[] = [];
  if (m.fuel !== 'wood' && (a.w > m.openingW + 0.01 || a.h > m.openingH + 0.01)) problems.push(`The insert (${fmt(a.w)} × ${fmt(a.h)}) is bigger than the ${fmt(m.openingW)} × ${fmt(m.openingH)} opening.`);
  return [{ a, problems, min: [c.width / 2 - a.w / 2, m.openingY, c.depth - a.d], size: [a.w, a.h, a.d],
    opening: { x0: c.width / 2 - m.openingW / 2, x1: c.width / 2 + m.openingW / 2, y0: m.openingY, y1: m.openingY + m.openingH } }];
}

/** Notes for the drawings and the shop: what goes in each opening and what it needs. */
export function applianceNotes(c: Cabinet, s: ShopSettings): string[] {
  if (c.kind === 'mantel') return [];
  return placedAppliances(c, s).map((p) => {
    const k = applianceKinds[p.a.kind];
    const o = p.opening;
    return `${applianceName(p.a)} by owner, ${fmt(p.a.w)} W × ${fmt(p.a.h)} H × ${fmt(p.a.d)} D, in a ${fmt(o.x1 - o.x0)} × ${fmt(o.y1 - o.y0)} opening. ${p.a.source ? `${p.a.source}. ` : ''}${k.note}. Verify with the spec sheet before building.`;
  });
}
