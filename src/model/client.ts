// The customer side of a job: who they are, what they want, what was measured on site, and where
// their folder lives in Dropbox (/CJC/Jobs/<stage>/<Last, First - Location>). The documents written
// into that folder are built here as plain text so they read well in the Dropbox app.
import type { Project } from './types';
import { cofferScope, priceQuote, quoteOf, scopeLine, groupLabel } from './quote';
import { eagleRequests, requestText } from './eagleRequest';
import { hardwareOrder, hardwareText } from './hardware';
import { releaseOf } from './release';
import { LOGO } from '../drawings/logo';

export const JOBS_ROOT = '/CJC/Jobs';

/** Cody's stage folders, in the order a job moves through them. */
export const stages = [
  { id: 'quote', folder: 'To quote', label: 'To quote' },
  { id: 'sold', folder: 'Sold Jobs', label: 'Sold' },
  { id: 'progress', folder: 'In Progress', label: 'In progress' },
  { id: 'completed', folder: 'Completed', label: 'Completed' },
  { id: 'notsold', folder: 'Not sold', label: 'Not sold' },
  { id: 'tm', folder: 'T&M', label: 'T&M' },
  { id: 'notcompleted', folder: 'Not Completed', label: 'Not completed' },
] as const;
export type StageId = (typeof stages)[number]['id'];
export const stageById = (id: StageId) => stages.find((s) => s.id === id)!;
export const stageByFolder = (folder: string) => stages.find((s) => s.folder.toLowerCase() === folder.toLowerCase());

export interface Measurement { id: string; what: string; size: string; note: string }
export interface ClientTodo { id: string; text: string; done: boolean }

export interface ClientInfo {
  first: string;
  last: string;
  /** Second person on the job, e.g. "Michael". */
  partner: string;
  /** Town for the folder name. */
  location: string;
  address: string;
  phone: string;
  phone2: string;
  email: string;
  /** How they found CJC. */
  source: string;
  /** The project in Cody's words, from the first meeting. */
  scope: string;
  notes: string;
  measurements: Measurement[];
  todos: ClientTodo[];
  metOn: string;
}

export interface DropboxLink {
  /** Dropbox's id for the folder; it stays the same when the folder moves. */
  id: string;
  /** Where it was last seen. */
  path: string;
  stage: StageId;
  /** When each document was last written. */
  saved?: Record<string, number>;
}

export const emptyClient: ClientInfo = { first: '', last: '', partner: '', location: '', address: '', phone: '', phone2: '', email: '', source: '', scope: '', notes: '', measurements: [], todos: [], metOn: '' };
export const clientOf = (p: Project): ClientInfo => ({ ...emptyClient, ...p.client });

const clean = (s: string) => s.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
/** "Pope, Melissa - West Boylston". */
export function folderName(c: ClientInfo): string {
  const name = [clean(c.last), clean(c.first)].filter(Boolean).join(', ');
  const loc = clean(c.location);
  return loc ? `${name} - ${loc}` : name;
}
export const clientName = (c: ClientInfo) => [c.first, c.partner].filter(Boolean).join(' & ') + (c.last ? ` ${c.last}` : '');

/** Read "Last, First - Location" back, for folders made before the app (often just "Last"). */
export function parseFolderName(name: string): Partial<ClientInfo> {
  const [who, location = ''] = name.split(/\s+-\s+/);
  const [last, first = ''] = who.split(/\s*,\s*/);
  return { last: last.trim(), first: first.trim(), location: location.trim() };
}

export const COMPANY = ['CJC Custom Carpentry LLC', '50 Beaman Rd, Sterling, MA 01564', 'Phone: (508) 215-6295', 'CSL License #CS-119119 · HIC License #207489'];
const date = (t = Date.now()) => new Date(t).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });

/** The client info sheet, as Markdown: readable as plain text on a phone. */
export function clientInfoDoc(p: Project): string {
  const c = clientOf(p);
  const lines = [
    `# ${clientName(c) || 'Client'}`,
    '',
    `| | |`, `|---|---|`,
    `| Address | ${c.address} |`,
    `| Cell | ${c.phone}${c.phone2 ? ` · ${c.phone2}` : ''} |`,
    `| Email | ${c.email} |`,
    ...(c.source ? [`| Found us | ${c.source} |`] : []),
    ...(c.metOn ? [`| First meeting | ${c.metOn} |`] : []),
    '',
    '## Project scope',
    c.scope || '_Not written yet._',
  ];
  if (c.measurements.length) {
    lines.push('', '## Measurements', '', '| What | Size | Notes |', '|---|---|---|', ...c.measurements.map((m) => `| ${m.what} | ${m.size} | ${m.note} |`));
  }
  if (c.notes) lines.push('', '## Notes', c.notes);
  if (c.todos.length) lines.push('', '## To do', ...c.todos.map((t) => `- [${t.done ? 'x' : ' '}] ${t.text}`));
  lines.push('', `_Updated ${date()} by Cabinet Studio._`);
  return lines.join('\n');
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const money = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;

/** Scope of work and purchase agreement, laid out like Cody's Word template; opens in a browser or Word and prints to PDF. */
export function quoteDoc(p: Project): string {
  const c = clientOf(p);
  const q = quoteOf(p);
  const r = priceQuote(p);
  const adj = 1 + q.workloadAdj[q.workload];
  const lines = [
    ...r.groups.map((g) => ({ label: groupLabel[g.group], price: g.price * adj })),
    ...r.extras.map((e) => ({ label: e.label, price: e.price * adj })),
    ...(r.painter ? [{ label: 'Cabinet prefinishing', price: r.painter }] : []),
  ];
  const sum = lines.reduce((t, l) => t + l.price, 0) || 1;
  const rounded = lines.map((l) => ({ ...l, price: Math.round(((l.price / sum) * r.total) / 10) * 10 }));
  if (rounded.length) rounded[0].price += r.total - rounded.reduce((t, l) => t + l.price, 0);
  const deposit = Math.round(r.total * 0.3);
  const head = `<div class="co"><img src="${LOGO}" alt="CJC Custom Carpentry" style="height:.62in;display:block;margin-bottom:6px">${COMPANY.slice(1).map(esc).join('<br>')}</div>`;
  const who = `<table class="who"><tr><th>Client Name</th><td>${esc(clientName(c))}</td></tr><tr><th>Project Address</th><td>${esc(c.address)}</td></tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(clientName(c) || 'Quote')} - ${esc(p.name)}</title>
<style>body{font:11pt/1.45 Georgia,serif;max-width:7.5in;margin:.6in auto;color:#111}.co{font-size:10pt;margin-bottom:18px}h1{font-size:15pt;text-align:center;letter-spacing:.06em;margin:18px 0}
table{border-collapse:collapse;width:100%;margin:8px 0}th,td{border:1px solid #999;padding:6px 8px;text-align:left;vertical-align:top}th{width:34%;background:#f3f1ec;font-weight:600}
.price td:last-child{text-align:right;white-space:nowrap}.total td{font-weight:700}ol li{margin:6px 0}.sign{margin-top:48px;display:grid;grid-template-columns:2fr 1fr;gap:28px 24px}.sign div{border-top:1px solid #111;padding-top:4px;font-size:10pt}
.page{page-break-after:always}@media print{body{margin:0}}</style></head><body>
<section class="page">${head}<h1>PROJECT SCOPE OF WORK</h1>${who}<tr><th>Cell Phone</th><td>${esc(c.phone)}</td></tr><tr><th>E-Mail</th><td>${esc(c.email)}</td></tr></table>
<h2>${esc(p.name)}</h2>
${c.scope ? `<p>${esc(c.scope).replace(/\n/g, '<br>')}</p>` : ''}
<ol>${p.cabinets.map((cab) => `<li>${esc(scopeLine(cab, p))}</li>`).join('')}${cofferScope(p) ? `<li>${esc(cofferScope(p)!)}</li>` : ''}</ol>
${r.extras.length ? `<p><b>Additional work:</b> ${r.extras.map((e) => esc(e.label)).join('; ')}</p>` : ''}
<p>Final dimensions will be field verified. The homeowner will approve door style, finish and hardware before ordering.</p></section>
<section>${head}<h1>PURCHASE AGREEMENT</h1>${who}<tr><th>Agreement Date</th><td>${date()}</td></tr><tr><th>Estimated Start Date</th><td></td></tr><tr><th>Project Duration</th><td></td></tr></table>
<p style="font-size:9.5pt">The above Estimated Start Date is an approximation valid on the above listed Agreement Date and is used for planning purposes only. CJC Custom Carpentry, LLC cannot be held responsible for delays caused by weather or other unforeseen circumstances before or during the project. All pricing is valid for (14) days from agreement date.</p>
<table class="price">${rounded.map((l) => `<tr><th>${esc(l.label)}</th><td>${money(l.price)}</td></tr>`).join('')}<tr class="total"><th>Total Project Investment</th><td>${money(r.total)}</td></tr></table>
<p><b>Project Payment Schedule</b><br>30% Deposit Due at Agreement – ${money(deposit)}<br>70% Final Payment Due Upon Completion – ${money(r.total - deposit)}</p>
<p style="font-size:9.5pt">This agreement supersedes all conversations, statements, and agreements expressed or implied between the parties, their agents and representatives.</p>
<div class="sign"><div>Owner</div><div>Date</div><div>CJC Custom Carpentry, LLC</div><div>Date</div></div></section></body></html>`;
}

/** Eagle requests and the Woodworker Express hardware list, once the job is released. */
export function ordersDoc(p: Project): string {
  const rel = releaseOf(p);
  const hw = hardwareOrder(p);
  const job = clientOf(p).last || p.name;
  const out = [`# Orders: ${clientName(clientOf(p)) || p.name}`, '', `Deposit: ${rel.depositDate || 'not recorded'}${rel.depositAmount ? ` (${money(rel.depositAmount)})` : ''}`, ''];
  for (const req of eagleRequests(p)) out.push('```', requestText(job, req), '```', '');
  if (hw.lines.length) out.push('```', hardwareText(job, hw), '```', '');
  return out.join('\n');
}
