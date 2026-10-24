// What a drawing should point out about each cabinet: things the design already knows (end
// panels, scribes, decorative bases, mouldings, tops) plus Cody's own notes, each marked for the
// customer, the shop, or both.
import type { Cabinet, CabinetNote, Project } from '../model/types';
import { applianceNotes } from '../model/appliances';
import { eff, panelOn } from '../model/parts';
import { resolveEnds } from '../model/layout';
import { profileByNum, profileLabel } from '../model/moldings';
import { baseLabel } from '../model/cabinetBase';
import { styleById } from '../model/eagle';
import { fmt } from '../units';

export type Audience = 'customer' | 'shop';
export interface Callout { text: string; for: CabinetNote['for'] }

const panelWords: Record<string, string> = { flush: 'flush with the doors', reveal: 'held back from the door face', inset: 'inset in the face frame' };
const mold = (num?: string) => { const p = profileByNum(num); return p ? profileLabel(p) : ''; };

export function cabinetCallouts(p: Project, c: Cabinet): Callout[] {
  const s = eff(c, p.settings);
  const ends = resolveEnds(p.room, p.cabinets, c);
  const out: Callout[] = [];
  for (const side of ['left', 'right'] as const) {
    const mode = panelOn(c, s, side, ends[side]);
    if (mode !== 'none') out.push({ text: `Finished end panel, ${side}, ${panelWords[mode] ?? mode}`, for: 'both' });
    else if (ends[side] && c.kind !== 'pilaster' && c.kind !== 'shelf') out.push({ text: `Exposed ${side} end, finished case side`, for: 'both' });
    const scribe = side === 'left' ? c.scribeLeft : c.scribeRight;
    if (scribe) out.push({ text: `${side === 'left' ? 'Left' : 'Right'} stile extended ${fmt(scribe)}, scribe to the wall`, for: 'shop' });
  }
  const base = baseLabel(c);
  if (base) out.push({ text: base.charAt(0).toUpperCase() + base.slice(1), for: 'both' });
  if (c.countertop && c.kind === 'base') out.push({ text: c.topKind === 'wood' ? `${fmt(c.topThickness ?? 1.25)} solid wood top` : 'Stone countertop by others', for: c.topKind === 'wood' ? 'both' : 'customer' });
  if (c.crown) out.push({ text: `Crown: ${mold(c.crown)}${c.crownBuild?.subCrown ? ` on a ${fmt(c.crownBuild.subCrown)} flat sub-crown` : ''}`, for: 'both' });
  if (c.lightRail) out.push({ text: `Light rail: ${mold(c.lightRail)}`, for: 'both' });
  if (c.baseMold) out.push({ text: `Base moulding: ${mold(c.baseMold)}`, for: 'both' });
  if (c.shelfFront) out.push({ text: `Shelves with ${fmt(c.shelfFront.height)} × ${fmt(c.shelfFront.thickness)} solid fronts`, for: 'both' });
  if (c.noBottom) out.push({ text: c.bottomRail ? 'No case bottom: sides stand on the top below' : 'No case bottom or bottom rail: sides stand on the top below', for: 'shop' });
  if (c.blind) out.push({ text: `Blind corner, ${c.blind.side} side: ${fmt(c.blind.dead)} dead space, ${fmt(c.blind.clearance)} clearance`, for: 'shop' });
  if (c.corner?.lazySusan) out.push({ text: 'Lazy susan corner', for: 'both' });
  if (c.stileLeftWidth != null || c.stileRightWidth != null || c.rows.some((r) => r.railAbove != null)) {
    const bits = [c.stileLeftWidth != null && `left stile ${fmt(c.stileLeftWidth)}`, c.stileRightWidth != null && `right stile ${fmt(c.stileRightWidth)}`, ...c.rows.map((r, i) => r.railAbove != null && `rail above row ${i + 1} ${fmt(r.railAbove)}`)].filter(Boolean);
    out.push({ text: `Face frame: ${bits.join(', ')}`, for: 'shop' });
  }
  for (const n of applianceNotes(c, p.settings)) out.push({ text: n, for: 'both' });
  if (c.overrides && Object.keys(c.overrides).length) out.push({ text: `Built to its own construction settings (${Object.keys(c.overrides).length} changed)`, for: 'shop' });
  for (const n of c.notes ?? []) if (n.text.trim()) out.push({ text: n.text.trim(), for: n.for });
  return out;
}

export const forAudience = (list: Callout[], a: Audience) => list.filter((n) => n.for === 'both' || n.for === a);

/** Notes that apply to the whole job, at the top of the list. */
export function jobCallouts(p: Project, a: Audience): string[] {
  const s = p.settings;
  const style = styleById(s.doorStyleId);
  if (a === 'customer') {
    return [
      `${style.name} style doors and drawer fronts, ${s.doorMount === 'inset' ? 'inset' : 'overlay'}`,
      'Hardware shown at typical locations; final hardware and placement to be selected',
    ];
  }
  return [
    `Face frames ${fmt(s.ffThickness)} ${s.woodSpecies}; doors ${style.name} ${s.doorMount}`,
    'Hardware locations shown are assumed until the customer selects hardware',
  ];
}
