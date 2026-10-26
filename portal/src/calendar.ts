// Appointments: Cody sets them in Cabinet Studio, the portal keeps them (KV appt:<id>) and
// publishes them as a private calendar feed his iPhone subscribes to. A visit can also be
// shown on the client's project page with its own add-to-calendar file.
import type { Env } from './store';
import { randomToken, sha256 } from './store';

export type ApptKind = 'measure' | 'design' | 'review' | 'install' | 'delivery' | 'other';
export const apptLabel: Record<ApptKind, string> = { measure: 'Measure', design: 'Design meeting', review: 'Review & sign', install: 'Install', delivery: 'Delivery', other: 'Appointment' };

export interface Appointment {
  id: string;
  /** The portal job it belongs to, when there is one. */
  jobId?: string;
  /** Who: the client's name, or what it's for. */
  who: string;
  kind: ApptKind;
  /** ISO time (UTC). */
  start: string;
  minutes: number;
  location?: string;
  phone?: string;
  /** Cody's own notes: what to bring, what to ask. Never shown to the client. */
  notes?: string;
  /** A note for the client, shown on their page and in their calendar file. */
  clientNote?: string;
  /** Alerts, in minutes before the start. */
  remind: number[];
  /** Show it on the client's project page. */
  share: boolean;
  /** The client's Dropbox folder, so Cabinet Studio can open them from the schedule. */
  folder?: { id: string; stage: string };
  cancelled?: boolean;
  updatedAt: number;
}

export async function listAppts(env: Env): Promise<Appointment[]> {
  const out: Appointment[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.PORTAL.list({ prefix: 'appt:', cursor });
    for (const k of page.keys) { const a = (await env.PORTAL.get(k.name, 'json')) as Appointment | null; if (a) out.push(a); }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

export async function saveAppt(env: Env, a: Partial<Appointment> & { start: string }): Promise<Appointment> {
  const old = a.id ? ((await env.PORTAL.get(`appt:${a.id}`, 'json')) as Appointment | null) : null;
  if (Number.isNaN(Date.parse(a.start))) throw new Error('The appointment needs a date and time.');
  const appt: Appointment = {
    id: old?.id ?? randomToken(9),
    jobId: a.jobId ?? old?.jobId,
    who: String(a.who ?? old?.who ?? '').slice(0, 120) || 'Appointment',
    kind: (a.kind ?? old?.kind ?? 'other') as ApptKind,
    start: new Date(a.start).toISOString(),
    minutes: Math.max(5, Math.min(24 * 60, Number(a.minutes ?? old?.minutes ?? 60))),
    location: a.location ?? old?.location,
    phone: a.phone ?? old?.phone,
    notes: a.notes ?? old?.notes,
    clientNote: a.clientNote ?? old?.clientNote,
    remind: (a.remind ?? old?.remind ?? [60]).filter((m) => Number.isFinite(m) && m >= 0).slice(0, 3),
    share: a.share ?? old?.share ?? false,
    folder: a.folder && typeof a.folder.id === 'string' ? { id: a.folder.id.slice(0, 80), stage: String(a.folder.stage).slice(0, 20) } : old?.folder,
    cancelled: a.cancelled ?? old?.cancelled,
    updatedAt: Date.now(),
  };
  await env.PORTAL.put(`appt:${appt.id}`, JSON.stringify(appt));
  return appt;
}

export const deleteAppt = (env: Env, id: string) => env.PORTAL.delete(`appt:${id}`);

/** The feed's private address part, worked out from SHOP_KEY like the connector's. */
export const feedCode = async (key: string) => (await sha256(`cjc-portal-calendar:${key}`)).slice(0, 32);

/* ---------- iCalendar ---------- */

const stamp = (t: number | string) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const text = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
/** Lines over 75 octets fold onto continuation lines starting with a space. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  for (const ch of line) {
    if (new TextEncoder().encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = ''; }
    cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}

function vevent(a: Appointment, forClient: boolean, shop: string): string[] {
  const end = new Date(Date.parse(a.start) + a.minutes * 60e3).toISOString();
  const summary = forClient ? `${apptLabel[a.kind]} with ${shop}` : a.kind === 'other' ? a.who : `${a.who} – ${apptLabel[a.kind]}`;
  const desc = forClient
    ? [a.clientNote].filter(Boolean).join('\n')
    : [a.phone && `Phone: ${a.phone}`, a.notes].filter(Boolean).join('\n');
  const lines = [
    'BEGIN:VEVENT',
    `UID:${a.id}@cjc-portal`,
    `DTSTAMP:${stamp(a.updatedAt)}`,
    `LAST-MODIFIED:${stamp(a.updatedAt)}`,
    `DTSTART:${stamp(a.start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${text(summary)}`,
    ...(a.location ? [`LOCATION:${text(a.location)}`] : []),
    ...(desc ? [`DESCRIPTION:${text(desc)}`] : []),
    'STATUS:CONFIRMED',
  ];
  for (const m of forClient ? [24 * 60] : a.remind) {
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${text(summary)}`, `TRIGGER:-PT${m}M`, 'END:VALARM');
  }
  lines.push('END:VEVENT');
  return lines;
}

export function calendar(appts: Appointment[], name: string, forClient = false, shop = 'CJC Custom Carpentry'): string {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CJC Custom Carpentry//Client portal//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${text(name)}`, 'X-WR-TIMEZONE:America/New_York', 'REFRESH-INTERVAL;VALUE=DURATION:PT15M', 'X-PUBLISHED-TTL:PT15M',
    ...appts.flatMap((a) => vevent(a, forClient, shop)),
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** "Tuesday, October 28, 9:00 AM", in Massachusetts time. */
export const whenEastern = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
