// Pilasters for built-ins like libraries: a plywood box the full height of the run, its face made of
// recessed panels ordered from Eagle in the door style, split by solid bands at the breaks, standing
// on a plinth block and topped with a capital under the frieze.
import type { Cabinet, Part, PilasterSpec, ShopSettings } from './types';
import { eff, frontBoxes, vb } from './parts';
import { panelByCode, styleById } from './eagle';
import { fmt } from '../units';

export const defaultPilaster: PilasterSpec = { plinth: 6, capital: 3.5, breaks: [], band: 1.5, proud: 0.25 };
export const pilasterOf = (c: Cabinet): PilasterSpec => ({ ...defaultPilaster, ...c.pilaster });

/** Panel sections between the plinth, bands and capital, bottom to top. */
export function pilasterSections(c: Cabinet): { y0: number; y1: number }[] {
  const ps = pilasterOf(c);
  const cuts = [...ps.breaks].filter((b) => b > ps.plinth + ps.band && b < c.height - ps.capital - ps.band).sort((a, b) => a - b);
  const out: { y0: number; y1: number }[] = [];
  let y = ps.plinth;
  for (const b of cuts) {
    out.push({ y0: y, y1: b - ps.band / 2 });
    y = b + ps.band / 2;
  }
  out.push({ y0: y, y1: c.height - ps.capital });
  return out.filter((x) => x.y1 - x.y0 > 1);
}

export function pilasterParts(c: Cabinet, settings: ShopSettings): Part[] {
  const s = eff(c, settings);
  const ps = pilasterOf(c);
  const W = c.width, H = c.height;
  const pt = s.endPanelThickness;
  const nt = s.boxActualThickness;
  const back = c.depth - pt;
  const style = styleById(s.doorStyleId);
  const raised = !!style.panelChoice && !!panelByCode(s.centerPanel).raised;
  // Narrow pilasters can't carry full-width stiles; Eagle builds down to 1 1/2"
  const stile = style.fixedStile ? style.stile : Math.min(s.doorStile, Math.max(1.5, (W - 2) / 2));
  const material = style.line === 'MDF' ? 'MDF' : s.doorMaterial;
  const spec = style.profile === 'slab' ? `Slab, ${material}, pilaster panel` : `${style.name}, ${material}, ${fmt(stile)} stiles, pilaster panel`;
  const parts: Part[] = [];
  for (const side of ['Left', 'Right'] as const) {
    parts.push({ name: 'Pilaster side', role: 'side', material: 'box', length: H, width: back, thickness: s.boxThickness, cut: true, note: side,
      boxes: [vb(side === 'Left' ? 0 : W - nt, 0, 0, nt, H, back)] });
  }
  parts.push({ name: 'Pilaster nailer', role: 'nailer', material: 'box', length: W - 2 * nt, width: s.nailerWidth, thickness: s.boxThickness, cut: true, note: 'top and bottom, holds the sides apart',
    boxes: [vb(nt, 0, back - nt, W - 2 * nt, s.nailerWidth, nt)] });
  parts.push({ name: 'Pilaster nailer', role: 'nailer', material: 'box', length: W - 2 * nt, width: s.nailerWidth, thickness: s.boxThickness, cut: true,
    boxes: [vb(nt, H - s.nailerWidth, back - nt, W - 2 * nt, s.nailerWidth, nt)] });
  for (const sec of pilasterSections(c)) {
    const h = sec.y1 - sec.y0;
    parts.push({
      name: 'Pilaster panel', role: 'endPanel', material: 'door', length: h, width: W, thickness: pt, cut: false, note: `${fmt(sec.y0)} off the floor`,
      order: { item: 'endPanel', w: W, h, spec, ...(style.profile === 'slab' ? {} : { rail: stile, stile }) },
      boxes: frontBoxes(0, sec.y0, back, W, h, pt, style.profile, stile, raised),
    });
  }
  const block = (name: string, y0: number, h: number, note: string): Part => ({
    name, role: 'trim', material: 'faceframe', length: W, width: h, thickness: pt + ps.proud, cut: true, note,
    boxes: [vb(0, y0, back, W, h, pt + ps.proud)],
  });
  if (ps.plinth > 0) parts.push(block('Plinth block', 0, ps.plinth, 'base moulding wraps it'));
  for (const b of pilasterSections(c).slice(1)) parts.push(block('Pilaster band', b.y0 - ps.band, ps.band, `at ${fmt(b.y0 - ps.band / 2)}`));
  if (ps.capital > 0) parts.push(block('Capital block', H - ps.capital, ps.capital, 'under the frieze'));
  return parts;
}
