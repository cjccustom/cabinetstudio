// What the portal keeps, in one Cloudflare KV namespace bound as PORTAL:
//   shop                 the shop profile: about blurb, terms, company lines, document list
//   doc:<id>             a shop document's bytes (license, insurance certificate, terms PDF)
//   job:<jobId>          one client job: who, what was published, views, signature, cancellation
//   tok:<token>          the private link's token, pointing at its job
//   img:<jobId>:<id>     a rendering's bytes

export interface KV {
  get(key: string, type: 'json'): Promise<unknown>;
  get(key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>;
  getWithMetadata(key: string, type: 'arrayBuffer'): Promise<{ value: ArrayBuffer | null; metadata: unknown }>;
  put(key: string, value: string | ArrayBuffer, opts?: { metadata?: unknown }): Promise<void>;
  delete(key: string): Promise<void>;
  list(opts?: { prefix?: string; cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
}

export interface Env { PORTAL: KV; SHOP_KEY?: string; QB_CLIENT_ID?: string; QB_CLIENT_SECRET?: string; QB_ENV?: string }

export interface ShopDoc { id: string; title: string; kind: 'license' | 'insurance' | 'terms' | 'other'; mimeType: string; size: number; expires?: string; uploadedAt: number }
export interface Shop {
  /** Company name, address, phone, license line, as on the quote. */
  company: string[];
  /** A few paragraphs about Cody and the shop. */
  about: string;
  /** Terms and conditions the client agrees to, as plain text with blank lines between sections. */
  terms: string;
  docs: ShopDoc[];
  /** Where the client can reach the shop about the job. */
  contactEmail?: string;
}

export interface Signature { name: string; image: string; at: number; ip: string; ua: string; hash: string; version: number; consent: true }
export interface Job {
  jobId: string;
  token: string;
  client: { first?: string; last?: string; email?: string; phone?: string; address?: string };
  project: string;
  stage: 'proposal';
  proposal: { agreementHtml: string; total: number; deposit: number; publishedAt: number; version: number; hash: string; /** The terms as published with this version: what the client signs. Older jobs fall back to the shop's. */ terms?: string };
  renderings: { id: string; name: string; mimeType: string }[];
  views: number[];
  signature?: Signature;
  cancelled?: { at: number; ip: string };
  /** Signatures on earlier versions, kept when a new version replaces them. */
  history?: (Signature & { cancelled?: { at: number; ip: string } })[];
  /** QuickBooks invoices for this job, newest last. */
  invoices?: import('./qb').QbInvoice[];
  /** Why the automatic deposit invoice didn't go out, until it does. */
  invoiceError?: string;
}

export const emptyShop: Shop = { company: [], about: '', terms: '', docs: [] };

export async function getShop(env: Env): Promise<Shop> {
  return { ...emptyShop, ...((await env.PORTAL.get('shop', 'json')) as Partial<Shop> | null) };
}
export const putShop = (env: Env, s: Shop) => env.PORTAL.put('shop', JSON.stringify(s));
export const getJob = async (env: Env, jobId: string) => (await env.PORTAL.get(`job:${jobId}`, 'json')) as Job | null;
export const putJob = (env: Env, j: Job) => env.PORTAL.put(`job:${j.jobId}`, JSON.stringify(j));
export async function jobByToken(env: Env, token: string): Promise<Job | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const id = (await env.PORTAL.get(`tok:${token}`, 'json')) as string | null;
  return id ? getJob(env, id) : null;
}

export function randomToken(bytes = 18): string {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256(text: string): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function b64ToBytes(b64: string): ArrayBuffer {
  const bin = atob(b64.replace(/^data:[^,]+,/, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
