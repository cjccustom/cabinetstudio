// What the customer reads about the finish: one word on each cabinet ("painted", "stained and
// clear coated"), and a Finishing section that says how it's done, when, and what they choose.
// The section's wording is Cabinet Studio's starting point; your own replaces it on the Quote tab.
import type { Cabinet, Project } from './types';
import { eff } from './parts';
import { quoteOf } from './quote';
import { colorText } from './paintColors';

export type StainCoat = 'stain' | 'clear';
export const stainCoatOf = (p: Project): StainCoat => (p.quote?.stainCoat === 'clear' ? 'clear' : 'stain');

/** The finish in a word or three, for a cabinet's line. */
export function finishWord(p: Project, c: Cabinet): string {
  if (c.kind === 'mantel' || c.kind === 'pilaster') return 'painted';
  if (c.kind === 'shelf') return (c.floating?.grade ?? 'paint') === 'paint' ? 'painted' : stainCoatOf(p) === 'clear' ? 'clear coated' : 'stained and clear coated';
  const s = eff(c, p.settings);
  return s.finish === 'stain' ? (stainCoatOf(p) === 'clear' ? 'clear coated' : 'stained and clear coated') : 'painted';
}

/** Cabinet Studio's starting wording for the Finishing section, from the job's finish and when it's done. */
export function defaultFinishing(p: Project): string[] {
  const q = quoteOf(p);
  const stain = p.settings.finish === 'stain';
  const clear = stainCoatOf(p) === 'clear';
  const sp = p.settings.woodSpecies.toLowerCase();
  if (q.paintWhen === 'none') {
    return [stain
      ? `Cabinets are built in stain grade ${sp} and installed unfinished, sanded and ready for your finisher`
      : 'Cabinets are built in paint grade materials and installed unfinished, ready for your painter',
      'Finishing is not part of this agreement'];
  }
  const site = q.paintWhen === 'site';
  if (stain) {
    return [
      clear
        ? `Clear coated to keep the natural color of the ${sp}, in the sheen of your choice (matte, satin or semi-gloss)`
        : `Stained in your choice of color and clear coated, in the sheen of your choice (matte, satin or semi-gloss)`,
      clear ? 'A sample on the actual wood for your approval before finishing' : `Stain samples on the actual ${sp} for your approval before finishing`,
      site ? 'Finished on site after installation, with the area protected' : 'Finished in the shop before installation; touch-up after install',
    ];
  }
  const pc = p.finishes.named?.paint;
  return [
    pc ? `Painted ${colorText(pc)}${p.finishes.paintSheen ? ` in a ${p.finishes.paintSheen.toLowerCase()} finish` : ''} as proposed; the color and sheen can be changed to your choice before finishing` : 'Painted in your choice of color and sheen (matte, satin or semi-gloss)',
    site
      ? 'Painted on site after installation: filled, caulked, sanded, primed and finished with two coats of cabinet-grade paint'
      : 'Sprayed before installation: sanded, primed and finished with two coats of cabinet-grade paint; nail holes, caulk and touch-up after install',
    ...(/prefinished/i.test(p.settings.plywood ?? 'Prefinished birch') ? [`Cabinet interiors are ${(p.settings.plywood ?? 'Prefinished birch').toLowerCase()} plywood, left in their clear factory finish`] : []),
  ];
}

/** The Finishing section as the proposal shows it: your wording if you've written it, else the default. */
export function finishingItems(p: Project): string[] {
  const mine = p.quote?.finishingText;
  if (mine != null) return mine.split('\n').map((x) => x.trim()).filter(Boolean);
  return defaultFinishing(p);
}

/** For paint grade: why the wood is what it is, so "can the maple be left natural?" is answered up front. */
export function paintGradeNote(p: Project): string | null {
  if (p.settings.finish === 'stain' || !p.cabinets.length) return null;
  const st = p.settings;
  const door = /mdf/i.test(st.doorMaterial) ? 'MDF' : st.doorMaterial.toLowerCase();
  return `Paint grade means the doors (${door}), face frames (${st.woodSpecies.toLowerCase()}) and finished ends are chosen to paint smoothly and stay stable. The wood is mixed in color and grain and has filled spots, so it is meant to be painted rather than left natural. A natural (clear coated) or stained finish uses stain grade wood, priced separately on request.`;
}
