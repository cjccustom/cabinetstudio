// The To quote folder, split by where each job stands with no new Dropbox folders: proposals still
// to build, and proposals sent and waiting on the customer (or signed, ready to move to Sold).
// A folder is matched to its portal page by name: the portal's job id starts with the client's
// last name, the way Cabinet Studio makes it.
import type { JobStatus } from '../portal';
import { parseFolderName } from './client';

export type QuoteState = { kind: 'build' } | { kind: 'sent'; job?: JobStatus; file?: string; at: number; days: number; followUp: boolean } | { kind: 'signed'; job: JobStatus };

/** A proposal sent outside the portal: a Word or PDF quote in the folder, or the note Mark as sent leaves. */
export const MARK_PREFIX = 'Proposal sent ';
/** Cody writes quotes in Word, so any Word file counts; a PDF only when it's named as one (the rest are drawings). */
export const isSentFile = (name: string) => name.startsWith(MARK_PREFIX) || /\.(docx?|pages)$/i.test(name)
  || (/(^|[^a-z])(quote|proposal|estimate)([^a-z]|$)/i.test(name) && /\.pdf$/i.test(name));

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
/** The client part of a portal job id ("smith-ab12cd" → "smith"). */
const jobBase = (id: string) => id.replace(/-[a-z0-9]{6}$/, '');

/** Days a sent proposal can wait before it's flagged for a follow-up call. */
export const FOLLOW_UP_DAYS = 7;

export function quoteStates(folders: { id: string; name: string }[], jobs: JobStatus[], files: Map<string, { name: string; modified: number }[]> = new Map(), now = Date.now()): Map<string, QuoteState> {
  const out = new Map<string, QuoteState>();
  // Last names that more than one To quote folder shares can't be told apart by id: match those by the folder name only
  const lastCount = new Map<string, number>();
  for (const f of folders) { const l = slug(parseFolderName(f.name).last ?? ''); lastCount.set(l, (lastCount.get(l) ?? 0) + 1); }
  for (const f of folders) {
    const last = slug(parseFolderName(f.name).last ?? '');
    const mine = jobs.filter((j) => !j.cancelled && (j.project === f.name || (last && lastCount.get(last) === 1 && jobBase(j.job_id) === last)))
      .sort((a, b) => b.publishedAt - a.publishedAt);
    const j = mine[0];
    if (j?.signed?.current) { out.set(f.id, { kind: 'signed', job: j }); continue; }
    // Not on the portal: a quote file in the folder (or the Mark as sent note) counts as sent, from when it was saved
    const sentFile = (files.get(f.name) ?? []).filter((x) => isSentFile(x.name)).sort((a, b) => b.modified - a.modified)[0];
    const at = j ? j.publishedAt : sentFile?.modified;
    if (!at) { out.set(f.id, { kind: 'build' }); continue; }
    const days = Math.floor((now - at) / 86400000);
    out.set(f.id, { kind: 'sent', job: j, file: j ? undefined : sentFile!.name, at, days, followUp: days >= FOLLOW_UP_DAYS });
  }
  return out;
}

/** "Sent Oct 30 (6 days) · opened 3× · last Nov 2" */
export function sentText(s: QuoteState): string {
  if (s.kind === 'build') return '';
  const d = (t: number) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (s.kind === 'signed') return `Signed ${s.job.signed ? d(s.job.signed.at) : ''} by ${s.job.signed?.name ?? 'the client'}: move to Sold Jobs`;
  const how = s.job ? (s.job.views ? `opened ${s.job.views}×${s.job.lastViewed ? `, last ${d(s.job.lastViewed)}` : ''}` : 'not opened yet') : s.file?.startsWith(MARK_PREFIX) ? 'marked sent' : `${s.file} in the folder`;
  return `Sent ${d(s.at)} (${s.days} day${s.days === 1 ? '' : 's'}) · ${how}${s.followUp ? ' · follow up' : ''}`;
}
