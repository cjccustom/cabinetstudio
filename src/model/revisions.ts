// Drawing revisions: what changed since the set last went out, so a revised set says so the way
// architects' and the design programs' sets do: a revision list on the cover and a numbered
// triangle beside every cabinet that changed.
import type { Cabinet, Project } from './types';
import { fmt } from '../units';

export interface Revision {
  rev: number;
  /** MM/DD/YYYY */
  date: string;
  /** What changed, a line each, as it prints. */
  note: string;
  /** Cabinet tags that changed, marked on the drawings. */
  tags: string[];
}

/** Everything about a cabinet that shows on the drawings, without its ids. */
function cabKey(c: Cabinet): string {
  return JSON.stringify({ ...c, id: undefined, rows: c.rows.map((r) => ({ ...r, id: undefined })) });
}
const ROOM_KEY = '·room';

/** The design as it went out: each cabinet by tag, plus the room and everything that isn't a cabinet. */
export function revSnapshot(p: Project): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of p.cabinets) out[c.name] = cabKey(c);
  // Only what's drawn: the room and the work that isn't a cabinet, not prices, client or portal state
  const drawn = { room: p.room, settings: p.settings, finishes: p.finishes, panels: p.panels, openings: p.openings, roomTrim: p.roomTrim, wallFinishes: p.wallFinishes, lights: p.lights, floor: p.floor, profiles: p.profiles, details: p.details, furniture: p.furniture, beds: p.beds, cases: p.cases, ceiling: p.ceiling, ladder: p.ladder, cabLighting: p.cabLighting };
  out[ROOM_KEY] = JSON.stringify(drawn);
  return out;
}

const sizeWords = (a: Cabinet, b: Cabinet) => (['width', 'height', 'depth'] as const)
  .filter((k) => Math.abs(a[k] - b[k]) > 1 / 64)
  .map((k) => `${k} ${fmt(a[k])} to ${fmt(b[k])}`);

/** What changed from the snapshot to now, a line each, and the cabinet tags to mark. */
export function revChanges(base: Record<string, string> | undefined, p: Project): { lines: string[]; tags: string[] } {
  if (!base) return { lines: [], tags: [] };
  const lines: string[] = [], tags: string[] = [];
  const now = new Map(p.cabinets.map((c) => [c.name, c]));
  for (const c of p.cabinets) {
    const was = base[c.name];
    if (was == null) { lines.push(`${c.name} added`); tags.push(c.name); continue; }
    if (was === cabKey(c)) continue;
    let old: Cabinet | null = null;
    try { old = JSON.parse(was) as Cabinet; } catch { /* unreadable: say it changed */ }
    const size = old ? sizeWords(old, c) : [];
    const moved = old && (old.wall !== c.wall || Math.abs(old.offset - c.offset) > 1 / 64 || Math.abs(old.elevation - c.elevation) > 1 / 64);
    const rows = old && JSON.stringify(old.rows.map((r) => ({ ...r, id: undefined }))) !== JSON.stringify(c.rows.map((r) => ({ ...r, id: undefined })));
    const what = [...size, ...(rows ? ['doors, drawers or shelves'] : []), ...(moved && !size.length ? ['moved'] : [])];
    lines.push(`${c.name} ${what.length ? what.join(', ') : 'construction or trim changed'}`);
    tags.push(c.name);
  }
  for (const tag of Object.keys(base)) if (tag !== ROOM_KEY && !now.has(tag)) lines.push(`${tag} removed`);
  if (base[ROOM_KEY] != null && base[ROOM_KEY] !== revSnapshot(p)[ROOM_KEY]) lines.push('Room, finishes or other work changed');
  return { lines, tags };
}

export const revDate = () => new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
