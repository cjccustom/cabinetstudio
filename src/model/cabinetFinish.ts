// A cabinet finished differently from the rest of the job: an accent paint color (the island, a
// bank of cabinets on another wall), or stain grade on a painted job (a stained island), or
// painted on a stain-grade job. Stain or paint here rides on the cabinet's overrides, so its
// parts, pricing, Eagle order and drawings all follow; the accent color is its own field.
import type { Cabinet, Project } from './types';
import { eff } from './parts';
import { setJobFinish } from './pricebook';
import type { PriceItem } from '../shop/shop';
import { colorText, type NamedColor } from './paintColors';
import { stainCoatOf } from './finishing';

/** The settings a finish change touches, cleared when the cabinet goes back to the job's finish. */
const FINISH_KEYS = ['finish', 'woodSpecies', 'doorMaterial', 'moldSpecies', 'exposedPlywood', 'doorStyleId'] as const;

export type CabinetFinish = 'job' | 'paint' | 'stain';

/** Change one cabinet's finish: back to the job's, painted, or stain grade in a species. */
export function cabinetFinishPatch(p: Project, c: Cabinet, to: CabinetFinish, species: string, book: PriceItem[], doorMaterials: string[], moldSpecies: string[]): Partial<Cabinet> {
  const keep: Record<string, unknown> = { ...c.overrides };
  for (const k of FINISH_KEYS) delete keep[k];
  const diff: Record<string, unknown> = {};
  if (to !== 'job') {
    // Work it out as if the whole job changed, then keep only what differs from the job
    const job = setJobFinish({ ...p, cabinets: [] }, to, species, book, doorMaterials, moldSpecies).settings;
    for (const k of FINISH_KEYS) if (job[k] !== p.settings[k]) diff[k] = job[k];
    if ('finish' in diff && to === 'paint') diff.finish = 'paint';
  }
  const overrides = { ...keep, ...diff } as Cabinet['overrides'];
  return { overrides: Object.keys(overrides!).length ? overrides : undefined, ...(to === 'stain' ? { paint: undefined } : {}) };
}

/** How a cabinet is finished, and whether that's different from the job. */
export function cabinetFinishOf(p: Project, c: Cabinet): { finish: 'paint' | 'stain'; species: string; color?: NamedColor; accent: boolean; text: string } {
  const s = eff(c, p.settings);
  const finish = s.finish === 'stain' ? 'stain' : 'paint';
  const jobFinish = p.settings.finish === 'stain' ? 'stain' : 'paint';
  if (finish === 'stain') {
    const coat = stainCoatOf(p) === 'clear' ? 'clear coated' : 'stained and clear coated';
    return { finish, species: s.woodSpecies, accent: jobFinish !== 'stain' || s.woodSpecies !== p.settings.woodSpecies, text: `stain grade ${s.woodSpecies.toLowerCase()}, ${coat}` };
  }
  const color = c.paint?.named ?? (c.paint ? undefined : p.finishes.named?.paint);
  return { finish, species: s.woodSpecies, color, accent: jobFinish !== 'paint' || !!c.paint, text: c.paint ? `painted ${c.paint.named ? colorText(c.paint.named) : 'an accent color'}` : 'painted' };
}

/** The cabinets finished apart from the job, grouped by finish, for the proposal: "Island (B6): painted Benjamin Moore Hale Navy HC-154". */
export function accentFinishes(p: Project, cabs = p.cabinets): { label: string; value: string }[] {
  const groups = new Map<string, Cabinet[]>();
  for (const c of cabs) {
    if (c.kind === 'pilaster' || c.kind === 'mantel' || c.kind === 'shelf') continue;
    const f = cabinetFinishOf(p, c);
    if (!f.accent) continue;
    groups.set(f.text, [...(groups.get(f.text) ?? []), c]);
  }
  return [...groups].map(([text, list]) => {
    const islands = list.every((c) => c.island);
    const who = islands ? (list.length > 1 ? 'Islands' : 'Island') : list.length > 3 ? `${list.length} cabinets (${list[0].name}–${list[list.length - 1].name})` : list.map((c) => c.name).join(', ');
    return { label: who, value: text.charAt(0).toUpperCase() + text.slice(1) };
  });
}
