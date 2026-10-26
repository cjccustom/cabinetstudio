// What a job sold for: the contract lines (with options the client chose between), allowances,
// the scope as written, and the payment schedule with what's been received. Jobs sold before
// Cabinet Studio come in from Cody's Word quote (Project Scope of Work + Purchase Agreement);
// new jobs can lock in Cabinet Studio's own quote.
import type { Project } from './types';
import { uid } from './defaults';

export interface ContractLine { id: string; label: string; price: number; option: boolean; chosen: boolean }
export interface Allowance { id: string; label: string; amount: number }
export interface ScopeItem { num: string; title: string; text: string }
export interface Payment { id: string; label: string; amount: number; received?: { on: string; method: 'check' | 'cash' | 'card' | 'ach' | 'other'; ref?: string } }

export interface Contract {
  source: 'word' | 'studio' | 'portal';
  /** The Dropbox file it came from. */
  file?: string;
  importedAt: number;
  agreementDate: string;
  title: string;
  scope: ScopeItem[];
  allowances: Allowance[];
  lines: ContractLine[];
  /** The agreed total when it isn't just the chosen lines added up (a discount, a price settled on site). */
  totalOverride?: number;
  schedule: Payment[];
  notes: string;
}

export const contractTotal = (c: Contract) => c.totalOverride ?? c.lines.filter((l) => l.chosen).reduce((t, l) => t + l.price, 0);
export const received = (c: Contract) => c.schedule.reduce((t, p) => t + (p.received ? p.amount : 0), 0);
export const contractOf = (p: Project) => p.contract;

/** The usual schedule: deposit at signing, balance on completion. */
export const defaultSchedule = (total: number, deposit = 0.3): Payment[] => [
  { id: uid('pay'), label: 'Deposit due at agreement', amount: Math.round(total * deposit) },
  { id: uid('pay'), label: 'Balance due upon completion', amount: total - Math.round(total * deposit) },
];

export interface ParsedQuote {
  client: { names?: string; address?: string; phones: string[]; email?: string };
  contract: Contract;
  warnings: string[];
}

const money = (s: string) => { const m = s.match(/\$\s*([\d,]+(?:\.\d+)?)/); return m ? Number(m[1].replace(/,/g, '')) : null; };
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Read the text of a quote made from Cody's Word template. */
export function parseWordQuote(text: string, file?: string): ParsedQuote {
  const lines = text.replace(/\r/g, '').split('\n');
  const L = lines.map((l) => l.trim());
  const warnings: string[] = [];
  const after = (label: RegExp, from = 0) => {
    const i = L.findIndex((l, k) => k >= from && label.test(l));
    if (i < 0) return { i: -1, v: '' };
    const j = L.findIndex((l, k) => k > i && l !== '');
    return { i: j, v: j >= 0 ? L[j] : '' };
  };

  const names = after(/^Client Name$/i).v;
  const address = after(/^Project Address$/i).v;
  const phoneAt = L.findIndex((l) => /^Cell Phone$/i.test(l));
  const emailAt = L.findIndex((l) => /^E-?Mail$/i.test(l));
  const phones = phoneAt >= 0 ? L.slice(phoneAt + 1, emailAt > phoneAt ? emailAt : phoneAt + 3).filter((l) => /\d{3}.*\d{4}/.test(l)) : [];
  const email = emailAt >= 0 ? after(/^E-?Mail$/i, emailAt).v : undefined;

  // The purchase agreement starts at its heading; the scope runs from the first numbered item to there
  const paAt = L.findIndex((l) => /^PURCHASE AGREEMENT$/i.test(l));
  const scopeEnd = (() => {
    const header = L.findIndex((l, k) => k > 10 && /^CJC Custom Carpentry LLC$/i.test(l));
    return header > 0 ? header : paAt > 0 ? paAt : L.length;
  })();
  const firstItem = L.findIndex((l) => /^\d+[A-Z]?\.\s+\S/.test(l));
  const title = (() => {
    if (firstItem < 0) return '';
    for (let k = firstItem - 1; k > (emailAt >= 0 ? emailAt + 1 : 0); k--) if (L[k] && !/@/.test(L[k])) return L[k];
    return '';
  })();

  const scope: ScopeItem[] = [];
  const allowances: Allowance[] = [];
  if (firstItem >= 0) {
    let cur: ScopeItem | null = null;
    for (let k = firstItem; k < scopeEnd; k++) {
      const l = L[k];
      if (!l) continue;
      const num = l.match(/^(\d+[A-Z]?)\.\s+(.+)$/);
      const isHeading = !num && l.length < 48 && !/[.:]$/.test(l) && !/^[·•\-]/.test(l) && L[k + 1] !== '' && /^[A-Z]/.test(l) && cur && cur.text;
      if (num || isHeading) {
        cur = { num: num ? num[1] : '', title: clean(num ? num[2] : l), text: '' };
        scope.push(cur);
        continue;
      }
      if (/:$/.test(l) && l.length < 60 && !L.slice(k + 1, k + 3).some((x) => x)) continue; // a picture caption
      if (cur) cur.text += (cur.text ? '\n' : '') + l;
      for (const m of l.matchAll(/allowance (?:of \$[\d,.]+ )?for (.+?)\.(?=\s+[A-Z]|\s*$)/gi)) allowances.push({ id: uid('alw'), label: clean(m[1]), amount: money(m[0]) ?? 0 });
    }
  }

  // Price lines: a label followed by a dollar amount
  const priced: ContractLine[] = [];
  let total: number | undefined;
  const dateRaw = after(/^Agreement Date$/i).v;
  for (let k = Math.max(paAt, 0); k < L.length; k++) {
    const l = L[k];
    if (!l || /^\$/.test(l)) continue;
    const next = L.findIndex((x, j) => j > k && x !== '');
    if (next < 0 || !/^\$/.test(L[next])) continue;
    const price = money(L[next]);
    if (/^Total Project Investment/i.test(l)) { total = price ?? undefined; continue; }
    if (price == null) continue;
    priced.push({ id: uid('cl'), label: clean(l), price, option: /\b(option|alternate|alt\.)\b/i.test(l), chosen: !/\b(option|alternate|alt\.)\b/i.test(l) });
  }
  const options = priced.filter((p) => p.option);
  if (options.length) warnings.push(`${options.length} options (${options.map((o) => o.label).join('; ')}): tick the one${options.length > 2 ? 's' : ''} the client chose.`);
  if (total == null) warnings.push('The total isn’t filled in on the agreement: check the chosen lines add up to what you agreed, or type the agreed total.');
  if (!priced.length) warnings.push('No prices found on the purchase agreement.');

  const schedule: Payment[] = [];
  const schedAt = L.findIndex((l) => /^Project Payment Schedule/i.test(l));
  if (schedAt >= 0) {
    for (let k = schedAt + 1; k < Math.min(L.length, schedAt + 8); k++) {
      const m = L[k].match(/^(.+?)\s*[–-]\s*(\$[\d,.]+)?\s*$/);
      if (!m || /supersedes/i.test(L[k])) continue;
      schedule.push({ id: uid('pay'), label: clean(m[1]), amount: m[2] ? money(m[2]) ?? 0 : 0 });
    }
  }
  if (schedule.length && schedule.every((p) => !p.amount)) warnings.push('The payment schedule has no amounts: fill in what you agreed.');

  return {
    client: { names: names || undefined, address: address || undefined, phones, email: email || undefined },
    contract: {
      source: 'word', file, importedAt: Date.now(), agreementDate: toIsoDate(dateRaw), title,
      scope, allowances, lines: priced, totalOverride: total ?? undefined, schedule, notes: '',
    },
    warnings,
  };
}

/** "10/04/26" or "10/4/2026" to 2026-10-04; anything else kept as typed. */
export function toIsoDate(s: string): string {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!m) return s;
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return `${y}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

/** "Melissa & Michael Pope" to first, partner and last name. */
export function splitNames(names: string): { first: string; partner: string; last: string } {
  const parts = names.split(/\s+(?:&|and)\s+/i);
  const lastWords = parts[parts.length - 1].trim().split(/\s+/);
  const last = lastWords.length > 1 ? lastWords.pop()! : '';
  const tidy = (s: string) => s.trim().split(/\s+/).filter((w) => w !== last).join(' ');
  return { first: tidy(parts[0] ?? ''), partner: parts.length > 1 ? tidy(lastWords.join(' ')) : '', last };
}
