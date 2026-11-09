// A visit with the customer, on the iPad: notes, sketches, what's on the walls (outlets, switches,
// vents, plumbing) and the site conditions that change how the job goes. Measurements of the room
// itself go straight into the design (room size and openings); this keeps the rest.
import type { WallId } from './types';
import { fmt } from '../units';

export type UtilityKind = 'outlet' | 'switch' | 'vent' | 'water' | 'drain' | 'gas' | 'thermostat' | 'other';
export const utilityKinds: Record<UtilityKind, string> = {
  outlet: 'Outlet', switch: 'Switch', vent: 'Heat / AC vent', water: 'Water supply', drain: 'Drain', gas: 'Gas', thermostat: 'Thermostat', other: 'Other',
};
export interface Utility { id: string; kind: UtilityKind; wall: WallId; /** Center, from the left corner of the wall (facing it). */ offset: number | null; /** Center, off the floor. */ height: number | null; note: string }

export type SiteState = 'ok' | 'issue' | 'na';
export interface Visit {
  id: string;
  /** When it started (ms). */
  at: number;
  notes: string;
  site: Record<string, { state?: SiteState; note?: string }>;
  utilities: Utility[];
  /** Sketches saved to the client's folder (Dropbox paths). */
  sketches: string[];
  /** Claude's read of the notes: a short summary, scope lines, questions to answer, follow-ups. */
  summary?: VisitSummary;
}
export interface VisitSummary { summary: string; scope: string[]; questions: string[]; followUps: string[] }

/** What to look at on site: things that change the price, the schedule or install day. */
export const siteChecks: { group: string; items: { id: string; label: string; hint?: string }[] }[] = [
  { group: 'House', items: [
    { id: 'pre1978', label: 'Built before 1978', hint: 'Lead-safe (EPA RRP) practices if we disturb painted surfaces' },
    { id: 'occupied', label: 'Lived in during the work', hint: 'Dust control, daily cleanup, working hours' },
    { id: 'pets', label: 'Pets or kids around the work area' },
  ] },
  { group: 'Floors, walls, ceiling', items: [
    { id: 'floorLevel', label: 'Floor level along the run', hint: 'How far out over the run' },
    { id: 'flooring', label: 'Finished floor under the cabinets', hint: 'Type; going in before or after us' },
    { id: 'wallsPlumb', label: 'Walls plumb and flat', hint: 'Scribe allowance' },
    { id: 'corners', label: 'Corners square' },
    { id: 'wallType', label: 'Wall type for mounting', hint: 'Drywall, plaster, brick; studs found' },
    { id: 'ceiling', label: 'Ceiling level / soffits / slopes' },
  ] },
  { group: 'Existing work', items: [
    { id: 'demo', label: 'Anything to remove first', hint: 'Old built-ins, shelving, cabinets' },
    { id: 'trim', label: 'Baseboard, crown or casing to remove and reinstall' },
    { id: 'heat', label: 'Radiators, baseboard heat or registers in the way' },
  ] },
  { group: 'Electrical and plumbing', items: [
    { id: 'elecMove', label: 'Outlets or switches to move' },
    { id: 'electrician', label: 'Electrician needed', hint: 'Lighting, new outlets' },
    { id: 'plumbing', label: 'Plumbing in the way or to move' },
  ] },
  { group: 'Getting in', items: [
    { id: 'access', label: 'Path in: stairs, turns, tight halls' },
    { id: 'narrowest', label: 'Narrowest door on the way in', hint: 'Width, for the longest pieces' },
    { id: 'parking', label: 'Parking and unloading' },
  ] },
];

export const newVisit = (id: string): Visit => ({ id, at: Date.now(), notes: '', site: {}, utilities: [], sketches: [] });

/** Today's visit, if one was started today. */
export const visitToday = (visits: Visit[] | undefined, now = Date.now()) =>
  (visits ?? []).find((v) => new Date(v.at).toDateString() === new Date(now).toDateString());

/**
 * A measurement as a laser or a person types it, in inches: 92 5/16, 92.3125, 7' 8 1/2", 7'8",
 * 2.345 m, 2345 mm, 234.5 cm, 7.69 ft. Null when it can't be read.
 */
export function parseMeasure(text: string): number | null {
  let s = text.trim().toLowerCase().replace(/[”″]/g, '"').replace(/[’′]/g, "'").replace(/,/g, '.');
  if (!s) return null;
  const metric = s.match(/^(-?\d+(?:\.\d+)?)\s*(mm|cm|m)$/);
  if (metric) { const v = parseFloat(metric[1]); return v * (metric[2] === 'mm' ? 1 / 25.4 : metric[2] === 'cm' ? 1 / 2.54 : 1000 / 25.4); }
  const ftDec = s.match(/^(-?\d+(?:\.\d+)?)\s*(ft|feet)$/);
  if (ftDec) return parseFloat(ftDec[1]) * 12;
  s = s.replace(/\s*(in|inch|inches)$/, '"');
  // 7'8 1/2" and the like
  let total = 0;
  const feet = s.match(/^(\d+(?:\.\d+)?)\s*'\s*-?\s*/);
  if (feet) { total += parseFloat(feet[1]) * 12; s = s.slice(feet[0].length); }
  s = s.replace(/"$/, '').trim();
  if (!s) return feet ? total : null;
  const m = s.match(/^(\d+(?:\.\d+)?)?(?:\s+|-)?(?:(\d+)\/(\d+))?$/);
  if (!m || (!m[1] && !m[2])) return null;
  if (m[1]) total += parseFloat(m[1]);
  if (m[2]) { const den = parseInt(m[3], 10); if (!den) return null; total += parseInt(m[2], 10) / den; }
  return total;
}

const wallWord: Record<WallId, string> = { back: 'Back wall', left: 'Left wall', right: 'Right wall', front: 'Front wall' };

/** What Claude gets to summarize a visit: the notes and everything measured and checked, and what to give back. */
export function summaryRequest(v: Visit, scope: string, room: { width: number; depth: number; height: number }, openings: number): string {
  const flagged = siteChecks.flatMap((g) => g.items).filter((i) => v.site[i.id]?.state === 'issue' || v.site[i.id]?.note?.trim())
    .map((i) => `- ${i.label}${v.site[i.id]?.state === 'issue' ? ' (CONCERN)' : ''}${v.site[i.id]?.note?.trim() ? `: ${v.site[i.id]!.note!.trim()}` : ''}`);
  const walls = v.utilities.map((u) => `- ${utilityKinds[u.kind]} on the ${wallWord[u.wall].toLowerCase()}${u.offset != null ? `, ${fmt(u.offset)} from the left corner` : ''}${u.height != null ? `, ${fmt(u.height)} up` : ''}${u.note ? ` (${u.note})` : ''}`);
  return [
    'You help a one-man custom cabinetry and finish carpentry shop (CJC Custom Carpentry, Massachusetts) after a site visit with a homeowner.',
    'From the notes below, write:',
    '- "summary": two or three plain sentences on what the customer wants.',
    '- "scope": short lines for the project scope, in the shop owner\'s plain trade wording (e.g. "Painted built-in bookcases either side of the fireplace, adjustable shelves"). Only what the notes support; no prices.',
    '- "questions": what still has to be decided or asked before a proposal (finish, hardware, timing, budget, unclear sizes...).',
    '- "followUps": things the shop has to do next (order samples, check with the electrician, send photos...).',
    'Keep every line short. Use the customer\'s own words where they matter. Do not invent sizes, products or prices that are not in the notes.',
    'Answer with JSON only: {"summary": string, "scope": string[], "questions": string[], "followUps": string[]}.',
    '',
    '## Notes from the visit', v.notes.trim() || '(none)',
    '', '## Project scope written so far', scope.trim() || '(none)',
    '', '## Room', `${fmt(room.width)} back wall, ${fmt(room.depth)} side walls, ${fmt(room.height)} ceiling; ${openings} windows/doors entered`,
    ...(flagged.length ? ['', '## Site conditions noted', ...flagged] : []),
    ...(walls.length ? ['', '## On the walls', ...walls] : []),
  ].join('\n');
}

/** Claude's answer, made safe to use. */
export function readSummary(raw: unknown): VisitSummary | null {
  const o = (raw && typeof raw === 'object' ? raw : null) as Record<string, unknown> | null;
  if (!o) return null;
  const list = (x: unknown) => (Array.isArray(x) ? x.filter((s) => typeof s === 'string' && s.trim()).map((s) => (s as string).trim()) : []);
  const out = { summary: typeof o.summary === 'string' ? o.summary.trim() : '', scope: list(o.scope), questions: list(o.questions), followUps: list(o.followUps) };
  return out.summary || out.scope.length || out.questions.length || out.followUps.length ? out : null;
}

/** The visits, for the client info sheet in Dropbox. */
export function visitsDoc(visits: Visit[] | undefined): string[] {
  const out: string[] = [];
  for (const v of [...(visits ?? [])].sort((a, b) => b.at - a.at)) {
    out.push('', `## Visit ${new Date(v.at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}`);
    if (v.summary?.summary) out.push('', `_Summary:_ ${v.summary.summary}`);
    if (v.notes.trim()) out.push('', v.notes.trim());
    if (v.summary?.questions.length) out.push('', '### Still to decide', ...v.summary.questions.map((q) => `- ${q}`));
    const flagged = siteChecks.flatMap((g) => g.items).filter((i) => v.site[i.id]?.state === 'issue' || v.site[i.id]?.note?.trim());
    if (flagged.length) {
      out.push('', '### Site conditions', ...flagged.map((i) => `- ${v.site[i.id]?.state === 'issue' ? '**' + i.label + '**' : i.label}${v.site[i.id]?.note?.trim() ? `: ${v.site[i.id]!.note!.trim()}` : ''}`));
    }
    if (v.utilities.length) {
      out.push('', '### On the walls', '', '| What | Wall | From left | Height | Notes |', '|---|---|---|---|---|',
        ...v.utilities.map((u) => `| ${utilityKinds[u.kind]} | ${wallWord[u.wall]} | ${u.offset != null ? fmt(u.offset) : ''} | ${u.height != null ? fmt(u.height) : ''} | ${u.note} |`));
    }
    if (v.sketches.length) out.push('', '### Sketches', ...v.sketches.map((p) => `- ${p.slice(p.lastIndexOf('/') + 1)}`));
  }
  return out;
}
