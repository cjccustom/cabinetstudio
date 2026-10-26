// QuickBooks Online, from the portal: Cody connects his company once (OAuth, through Intuit's
// own sign-in page), and the portal keeps the tokens in KV. It finds or adds the client as a
// customer, makes the deposit and final invoices with online card/ACH payment turned on, has
// QuickBooks email them, and records checks and cash against them.
//
// Secrets in Cloudflare: QB_CLIENT_ID and QB_CLIENT_SECRET from Cody's app at developer.intuit.com.
// Optional variable QB_ENV = "sandbox" to work against Intuit's test company first.
import type { Env, Job } from './store';
import { randomToken } from './store';

export interface QbConn {
  realmId: string;
  access: string; accessExp: number;
  refresh: string; refreshExp: number;
  companyName?: string;
  connectedAt: number;
}
export interface QbSettings {
  /** The product/service every invoice line uses (QuickBooks needs one). */
  itemId?: string; itemName?: string;
  /** Make and send the deposit invoice the moment the client signs. */
  autoDeposit: boolean;
  /** Have QuickBooks email invoices to the client (with its Pay now button). */
  email: boolean;
}
export interface QbInvoice {
  kind: 'deposit' | 'final' | 'change';
  id: string; docNumber?: string; amount: number; balance: number;
  /** The client's QuickBooks payment page, when online payments are on for the company. */
  link?: string;
  createdAt: number; checkedAt: number; emailed?: boolean;
  payments?: { method: 'check' | 'cash' | 'other'; amount: number; ref?: string; at: number; id: string }[];
}

export const defaultQbSettings: QbSettings = { autoDeposit: true, email: true };
export const qbReady = (env: Env) => Boolean(env.QB_CLIENT_ID && env.QB_CLIENT_SECRET);
const sandbox = (env: Env) => String(env.QB_ENV || '').toLowerCase() === 'sandbox';
const apiBase = (env: Env) => (sandbox(env) ? 'https://sandbox-quickbooks.api.intuit.com' : 'https://quickbooks.api.intuit.com');
const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const REVOKE_URL = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke';
const MINOR = '75';

export const redirectUri = (origin: string) => `${origin}/qb/callback`;
export const getConn = async (env: Env) => (await env.PORTAL.get('qb', 'json')) as QbConn | null;
export async function getQbSettings(env: Env): Promise<QbSettings> {
  return { ...defaultQbSettings, ...((await env.PORTAL.get('qb-settings', 'json')) as Partial<QbSettings> | null) };
}
export const putQbSettings = (env: Env, s: QbSettings) => env.PORTAL.put('qb-settings', JSON.stringify(s));

/** Start connecting: a one-time state value, then Intuit's sign-in page. */
export async function connectUrl(env: Env, origin: string): Promise<string> {
  const state = randomToken(18);
  await env.PORTAL.put(`qbstate:${state}`, JSON.stringify(Date.now() + 10 * 60e3));
  const q = new URLSearchParams({ client_id: env.QB_CLIENT_ID!, response_type: 'code', scope: 'com.intuit.quickbooks.accounting', redirect_uri: redirectUri(origin), state });
  return `https://appcenter.intuit.com/connect/oauth2?${q}`;
}

const basic = (env: Env) => `Basic ${btoa(`${env.QB_CLIENT_ID}:${env.QB_CLIENT_SECRET}`)}`;

async function tokenCall(env: Env, body: Record<string, string>) {
  const res = await fetch(TOKEN_URL, { method: 'POST', headers: { authorization: basic(env), accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(`QuickBooks sign-in failed: ${j.error_description || j.error || res.status}`);
  return j as { access_token: string; refresh_token: string; expires_in: number; x_refresh_token_expires_in: number };
}

/** Intuit sends Cody back here after he approves. */
export async function finishConnect(env: Env, url: URL): Promise<string> {
  const state = url.searchParams.get('state') || '';
  const exp = (await env.PORTAL.get(`qbstate:${state}`, 'json')) as number | null;
  await env.PORTAL.delete(`qbstate:${state}`);
  if (!exp || exp < Date.now()) throw new Error('That connect link expired. Start again from the QuickBooks page.');
  if (url.searchParams.get('error')) throw new Error(`QuickBooks said: ${url.searchParams.get('error')}`);
  const code = url.searchParams.get('code') || '';
  const realmId = url.searchParams.get('realmId') || '';
  if (!code || !realmId) throw new Error('QuickBooks didn’t send the company back. Try again.');
  const t = await tokenCall(env, { grant_type: 'authorization_code', code, redirect_uri: redirectUri(url.origin) });
  const now = Date.now();
  const conn: QbConn = { realmId, access: t.access_token, accessExp: now + t.expires_in * 1000, refresh: t.refresh_token, refreshExp: now + t.x_refresh_token_expires_in * 1000, connectedAt: now };
  await env.PORTAL.put('qb', JSON.stringify(conn));
  try {
    const info = (await qb(env, 'GET', `companyinfo/${realmId}`)) as { CompanyInfo?: { CompanyName?: string } };
    conn.companyName = info.CompanyInfo?.CompanyName;
    await env.PORTAL.put('qb', JSON.stringify(conn));
  } catch { /* the name is only for show */ }
  return conn.companyName || 'your company';
}

export async function disconnect(env: Env) {
  const c = await getConn(env);
  if (c) await fetch(REVOKE_URL, { method: 'POST', headers: { authorization: basic(env), accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify({ token: c.refresh }) }).catch(() => undefined);
  await env.PORTAL.delete('qb');
}

/** A current access token, refreshing it (and storing the new refresh token Intuit hands back) when it's within a minute of expiring. */
async function access(env: Env): Promise<QbConn> {
  const c = await getConn(env);
  if (!c) throw new Error('QuickBooks isn’t connected. Connect it from the portal’s QuickBooks page.');
  if (c.accessExp - Date.now() > 60e3) return c;
  if (c.refreshExp < Date.now()) throw new Error('The QuickBooks connection expired. Connect it again from the portal’s QuickBooks page.');
  const t = await tokenCall(env, { grant_type: 'refresh_token', refresh_token: c.refresh });
  const now = Date.now();
  const next = { ...c, access: t.access_token, accessExp: now + t.expires_in * 1000, refresh: t.refresh_token, refreshExp: now + t.x_refresh_token_expires_in * 1000 };
  await env.PORTAL.put('qb', JSON.stringify(next));
  return next;
}

type Raw = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** One QuickBooks API call. `path` is under /v3/company/<realm>/. */
export async function qb(env: Env, method: 'GET' | 'POST', path: string, body?: unknown, query: Record<string, string> = {}): Promise<Raw> {
  const c = await access(env);
  const q = new URLSearchParams({ minorversion: MINOR, ...query });
  const res = await fetch(`${apiBase(env)}/v3/company/${c.realmId}/${path}?${q}`, {
    method,
    headers: { authorization: `Bearer ${c.access}`, accept: 'application/json', ...(body !== undefined ? { 'content-type': typeof body === 'string' ? 'application/octet-stream' : 'application/json' } : {}) },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const j = (await res.json().catch(() => ({}))) as Raw;
  if (!res.ok || j.Fault) {
    const e = j.Fault?.Error?.[0] ?? j.fault?.error?.[0];
    throw Object.assign(new Error(`QuickBooks: ${e?.Message || e?.message || res.status}${e?.Detail || e?.detail ? ` (${e.Detail || e.detail})` : ''}`), { qbCode: e?.code });
  }
  return j;
}

const quote = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
export const select = async (env: Env, sql: string) => ((await qb(env, 'GET', 'query', undefined, { query: sql })).QueryResponse ?? {}) as Raw;

/** Service items to pick from for invoice lines. */
export async function listItems(env: Env) {
  const r = await select(env, "select Id, Name, Type, Active from Item where Type = 'Service' maxresults 200");
  return ((r.Item ?? []) as Raw[]).filter((i) => i.Active !== false).map((i) => ({ id: String(i.Id), name: String(i.Name) }));
}

/** The client as a QuickBooks customer: found by name (or email), else added. */
export async function customerFor(env: Env, j: Job): Promise<{ id: string; name: string }> {
  const name = [j.client.first, j.client.last].filter(Boolean).join(' ').trim() || j.project;
  const byName = await select(env, `select Id, DisplayName from Customer where DisplayName = ${quote(name)}`);
  if (byName.Customer?.[0]) return { id: String(byName.Customer[0].Id), name };
  if (j.client.email) {
    const byEmail = await select(env, `select Id, DisplayName, PrimaryEmailAddr from Customer where PrimaryEmailAddr = ${quote(j.client.email)}`);
    if (byEmail.Customer?.[0]) return { id: String(byEmail.Customer[0].Id), name: String(byEmail.Customer[0].DisplayName) };
  }
  const addr = parseAddress(j.client.address || '');
  const body = (display: string) => ({
    DisplayName: display, GivenName: j.client.first || undefined, FamilyName: j.client.last || undefined,
    PrimaryEmailAddr: j.client.email ? { Address: j.client.email } : undefined,
    PrimaryPhone: j.client.phone ? { FreeFormNumber: j.client.phone } : undefined,
    BillAddr: addr, ShipAddr: addr,
  });
  try {
    const r = await qb(env, 'POST', 'customer', body(name));
    return { id: String(r.Customer.Id), name };
  } catch (e) {
    // Names are unique across customers, vendors and employees in QuickBooks
    if ((e as { qbCode?: string }).qbCode !== '6240') throw e;
    const r = await qb(env, 'POST', 'customer', body(`${name} (client)`));
    return { id: String(r.Customer.Id), name: `${name} (client)` };
  }
}

/** "12 Main St, Sterling, MA 01564" into QuickBooks' address fields, as far as it goes. */
export function parseAddress(s: string) {
  const parts = s.split(',').map((x) => x.trim()).filter(Boolean);
  if (!parts.length) return undefined;
  const out: Raw = { Line1: parts[0] };
  const tail = parts.slice(1).join(' ');
  const m = tail.match(/^(.*?)\s*,?\s*\b([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  if (m) Object.assign(out, { City: m[1].replace(/,$/, '').trim() || undefined, CountrySubDivisionCode: m[2], PostalCode: m[3] });
  else if (parts[1]) Object.assign(out, { City: parts[1], CountrySubDivisionCode: 'MA' });
  return out;
}

const due = (days: number) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);

/** Make an invoice for the job and (optionally) have QuickBooks email it. Lines are non-taxable: Cody pays the tax on materials. */
export async function makeInvoice(env: Env, j: Job, kind: QbInvoice['kind'], amount: number, description: string): Promise<QbInvoice> {
  const s = await getQbSettings(env);
  if (!s.itemId) throw new Error('Pick the QuickBooks product/service for invoices first (Portal settings → QuickBooks).');
  if (!(amount > 0)) throw new Error('The invoice amount is $0.');
  const cust = await customerFor(env, j);
  const r = await qb(env, 'POST', 'invoice', {
    CustomerRef: { value: cust.id },
    Line: [{ Amount: round2(amount), DetailType: 'SalesItemLineDetail', Description: description, SalesItemLineDetail: { ItemRef: { value: s.itemId }, Qty: 1, UnitPrice: round2(amount), TaxCodeRef: { value: 'NON' } } }],
    BillEmail: j.client.email ? { Address: j.client.email } : undefined,
    AllowOnlineCreditCardPayment: true, AllowOnlineACHPayment: true,
    DueDate: due(kind === 'deposit' ? 3 : 10),
    CustomerMemo: { value: `${j.project}. Thank you!` },
    PrivateNote: `Client portal job ${j.jobId}, agreement version ${j.proposal.version}.`,
  });
  const inv: QbInvoice = { kind, id: String(r.Invoice.Id), docNumber: r.Invoice.DocNumber, amount: round2(amount), balance: Number(r.Invoice.Balance ?? amount), createdAt: Date.now(), checkedAt: Date.now() };
  if (s.email && j.client.email) {
    await qb(env, 'POST', `invoice/${inv.id}/send`, '', { sendTo: j.client.email }).then(() => { inv.emailed = true; }, () => undefined);
  }
  await refreshInvoice(env, inv);
  return inv;
}

/** Balance and payment link, as QuickBooks has them now. */
export async function refreshInvoice(env: Env, inv: QbInvoice): Promise<QbInvoice> {
  const r = await qb(env, 'GET', `invoice/${inv.id}`, undefined, { include: 'invoiceLink' });
  inv.balance = Number(r.Invoice?.Balance ?? inv.balance);
  if (r.Invoice?.InvoiceLink) inv.link = String(r.Invoice.InvoiceLink);
  inv.checkedAt = Date.now();
  return inv;
}

/** A check or cash payment received, applied to the invoice in QuickBooks. */
export async function recordPayment(env: Env, j: Job, inv: QbInvoice, method: 'check' | 'cash' | 'other', amount: number, ref?: string): Promise<QbInvoice> {
  if (!(amount > 0)) throw new Error('The payment amount is $0.');
  const cust = await customerFor(env, j);
  const pm = method === 'other' ? null : (await select(env, `select Id, Name from PaymentMethod where Name = ${quote(method === 'check' ? 'Check' : 'Cash')}`)).PaymentMethod?.[0];
  const r = await qb(env, 'POST', 'payment', {
    CustomerRef: { value: cust.id }, TotalAmt: round2(amount),
    PaymentMethodRef: pm ? { value: String(pm.Id) } : undefined,
    PaymentRefNum: ref ? ref.slice(0, 21) : undefined,
    Line: [{ Amount: round2(amount), LinkedTxn: [{ TxnId: inv.id, TxnType: 'Invoice' }] }],
    PrivateNote: `Recorded from Cabinet Studio (${method}${ref ? ` #${ref}` : ''}).`,
  });
  inv.payments = [...(inv.payments ?? []), { method, amount: round2(amount), ref, at: Date.now(), id: String(r.Payment?.Id ?? '') }];
  return refreshInvoice(env, inv);
}

const round2 = (v: number) => Math.round(v * 100) / 100;
