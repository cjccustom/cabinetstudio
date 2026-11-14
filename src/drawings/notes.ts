// What a drawing should point out about each cabinet: things the design already knows (end
// panels, scribes, decorative bases, mouldings, tops) plus Cody's own notes, each marked for the
// customer, the shop, or both.
import { accentLabel, cabinetFixtures, hafeleOf, lightingJobOf } from '../model/cabinetLighting';
import { colorText } from '../model/paintColors';
import { cabinetFinishOf } from '../model/cabinetFinish';
import type { Cabinet, CabinetNote, Project } from '../model/types';
import { applianceNotes } from '../model/appliances';
import { cofferOf, fasciaBacking } from '../model/coffer';
import { mantelNotes } from '../model/mantel';
import { eff, panelOn } from '../model/parts';
import { resolveEnds } from '../model/layout';
import { profileByNum, profileLabel } from '../model/moldings';
import { fingerPullNote, hasFingerPulls, hasHardware } from '../model/pulls';
import { edgeLabel } from '../model/edgeProfiles';
import { baseLabel } from '../model/cabinetBase';
import { styleById } from '../model/eagle';
import { fmt } from '../units';
import { cabinetSwings, RESTRICT_TO } from '../model/doorSwing';

export type Audience = 'customer' | 'shop';
/** How the shop note for a hinge restrictor starts: it's hardware, so cabinets built alike still share a drawing. */
export const RESTRICTOR_NOTE = 'Hinge opening restrictor';
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
    else if (ends[side] && c.kind !== 'pilaster' && c.kind !== 'shelf' && c.kind !== 'mantel') out.push({ text: `Exposed ${side} end, finished case side`, for: 'both' });
    const scribe = side === 'left' ? c.scribeLeft : c.scribeRight;
    if (scribe) out.push({ text: `${side === 'left' ? 'Left' : 'Right'} stile extended ${fmt(scribe)}, scribe to the wall`, for: 'shop' });
  }
  // Shop only: the customer never hears about the separate base
  if (c.kind !== 'wall' && c.base?.style === 'kick' && c.base.separate) out.push({ text: `Separate toe kick base (ladder, ${fmt(s.toeKickHeight)}): built and leveled once for the run; case has no toe notch and sits on it`, for: 'shop' });
  const base = baseLabel(c);
  if (base) out.push({ text: base.charAt(0).toUpperCase() + base.slice(1), for: 'both' });
  if (c.countertop && c.kind === 'base') out.push({ text: c.topKind === 'wood' ? `${fmt(c.topThickness ?? 1.25)} solid wood top, ${edgeLabel(c.topProfile).toLowerCase()} edge` : c.topKind === 'paint' ? `3/4" paint-grade plywood top, ${(c.topEdge ?? 'poplar').toLowerCase()} edging 3/4" × 1 1/4" dropping 1/2" over the top rail` : 'Stone countertop by others', for: c.topKind === 'stone' || !c.topKind ? 'customer' : 'both' });
  if (c.crown) out.push({ text: `${c.kind === 'mantel' ? 'Bed moulding under the shelf' : 'Crown'}: ${mold(c.crown)}${c.crownBuild?.subCrown ? ` on a ${fmt(c.crownBuild.subCrown)} flat sub-crown` : ''}`, for: 'both' });
  if (c.seamCover && !ends.right) out.push({ text: `${fmt(c.seamCover.width)} seam batten over the joint with the next cabinet, up ${c.crownBuild?.subCrown ? 'into the sub-crown' : 'to the top'}`, for: 'both' });
  for (const d of cabinetSwings(p, c).filter((x) => x.fix === 'restrictor')) {
    out.push({ text: `${RESTRICTOR_NOTE} on the ${d.label}: stops it at ${RESTRICT_TO}° (it would hit ${d.hits} at about ${d.at}°)`, for: 'shop' });
  }
  if (c.lightRail) out.push({ text: `Light rail: ${mold(c.lightRail)}`, for: 'both' });
  const fin = cabinetFinishOf(p, c);
  if (fin.accent && c.kind !== 'pilaster' && c.kind !== 'mantel' && c.kind !== 'shelf') out.push({ text: `Finish: ${fin.text}${fin.finish === 'stain' ? ` (doors ${eff(c, p.settings).doorMaterial.toLowerCase()})` : ''}`, for: 'both' });
  if (c.lighting?.length) {
    const job = lightingJobOf(p);
    const route = job.wireRoute ?? 'dado';
    const to = job.driverSpot === 'top' ? 'up to the driver on top of the bookcase' : 'down to the driver in the base cabinet';
    out.push({ text: route === 'dado'
      ? `LED leads: rout a 3/8" x 3/8" wire dado up the inside of the case back (or side) to the lights, and drill a pass-through ${to}`
      : `LED leads run behind the case: drill pass-throughs at each light and ${to}`, for: 'shop' });
    const fx = cabinetFixtures(c, p, job);
    const H = hafeleOf(p);
    const hf = fx.filter((f) => f.kind === 'shelves');
    if (hf.length) {
      out.push({ text: `Häfele shelf lighting: groove each lit shelf underneath ${fmt(H.profileW)} W × ${fmt(H.profileD)} D, ${fmt(H.profileBack)} behind the drop edge, through end to end; light bar = shelf length (spring contacts each end); solid drop edge, top flush, ${fmt(H.drop)} below the shelf`, for: 'shop' });
      out.push({ text: `Häfele bus bar channel ${fmt(H.railW)} W × ${fmt(H.railD)} D in each case side (both faces of a divider) of the open section, ${fmt(H.railBack)} from the front edge, lined up with the shelf grooves, full height of the opening; power supply kit 833.88.986 at the top or bottom of each bay; shelf pin holes as usual`, for: 'shop' });
      out.push({ text: `Häfele LED lighting under every shelf (${hf.reduce((t, f) => t + f.count, 0)} lights, ${job.kelvin}K): shelves stay adjustable`, for: 'customer' });
    }
    if (fx.some((f) => f.kind === 'topAccent')) out.push({ text: `Accent uplight on top of the case: ${accentLabel[job.accent ?? 'white'].toLowerCase()}`, for: 'both' });
  }
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
  if (c.kind === 'mantel') out.push(...mantelNotes(c));
  const fb = fasciaBacking(p, c);
  if (fb) out.push({ text: fb.short > 0.01 ? `Extend the top rail ${fmt(fb.short)} or more to back the coffer fascia` : `Top rail backs the coffer fascia (${fmt(fb.lap)} behind it); fascia ${fmt(cofferOf(p).fascia)} proud of the face frame`, for: 'shop' });
  if (c.overrides && Object.keys(c.overrides).length) {
    // Say what's different, in the shop standard's own words, so the builder doesn't use the usual size
    const said = Object.entries(c.overrides).map(([k, v]) => `${settingLabel[k] ?? k.replace(/([A-Z])/g, ' $1').toLowerCase()} ${typeof v === 'number' ? fmt(v) : String(v)}`);
    out.push({ text: `Differs from the shop standard: ${said.join(', ')} (the parts list is already sized for it)`, for: 'shop' });
  }
  for (const n of c.notes ?? []) if (n.text.trim()) out.push({ text: n.text.trim(), for: n.for });
  return out;
}

/** Shop standards in plain words, for notes on a cabinet built differently. */
const settingLabel: Record<string, string> = {
  boxThickness: 'case stock', boxActualThickness: 'case stock (actual)', dadoDepth: 'dado and rabbet depth', bottomReveal: 'bottom below the rail',
  backThickness: 'back', backRabbetWidth: 'back rabbet width', stretcherWidth: 'stretcher width', ffOverhang: 'face frame overhang per side',
  ffThickness: 'face frame thickness', stileWidth: 'stiles', topRailWidth: 'top rail', bottomRailWidth: 'bottom rail', midRailWidth: 'mid rails',
  toeKickHeight: 'toe kick height', toeKickDepth: 'toe kick depth', shelfClearance: 'shelf clearance', shelfSetback: 'shelf setback',
  counterThickness: 'counter thickness', counterOverhang: 'counter overhang', doorOverlay: 'door overlay', doorGap: 'door gap', insetReveal: 'inset reveal',
};

export const forAudience = (list: Callout[], a: Audience) => list.filter((n) => n.for === 'both' || n.for === a);

/** Notes that apply to the whole job, at the top of the list. */
export function jobCallouts(p: Project, a: Audience): string[] {
  const s = p.settings;
  const style = styleById(s.doorStyleId);
  // Only jobs with face frame cabinets get the door style and hardware lines
  const boxes = p.cabinets.some((c) => c.kind === 'base' || c.kind === 'wall' || c.kind === 'tall');
  if (!boxes) return [];
  const pc = s.finish !== 'stain' ? p.finishes.named?.paint : undefined;
  const paint = pc ? [`Paint: ${colorText(pc)}${p.finishes.paintSheen ? `, ${p.finishes.paintSheen.toLowerCase()}` : ''}${a === 'customer' ? ' (confirmed from a sample before finishing)' : ''}`] : [];
  if (a === 'customer') {
    return [...paint,
      `${style.name} style doors and drawer fronts, ${s.doorMount === 'inset' ? 'inset' : 'overlay'}`,
      ...(hasHardware(p) ? ['Knobs and pulls supplied by the homeowner and installed by CJC; shown at typical locations until chosen'] : []),
      ...(hasFingerPulls(p) ? [hasHardware(p) ? 'Integrated finger pulls where shown, no hardware there' : 'Integrated finger pulls on the doors and drawer fronts; no knobs or pulls'] : []),
    ];
  }
  return [...paint,
    `Face frames ${fmt(s.ffThickness)} ${s.woodSpecies}; doors ${style.name} ${s.doorMount}`,
    ...(hasHardware(p) ? ['Hardware supplied by the customer; locations shown are assumed until it is selected'] : []),
    ...(hasFingerPulls(p) ? [fingerPullNote(s)] : []),
  ];
}
