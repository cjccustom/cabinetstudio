// What the portal keeps, in one Cloudflare KV namespace bound as PORTAL:
//   shop                 the shop profile: about blurb, terms, company lines, document list
//   doc:<id>             a shop document's bytes (license, insurance certificate, terms PDF)
//   job:<jobId>          one client job: who, what was published, views, signature, cancellation
//   tok:<token>          the private link's token, pointing at its job
//   img:<jobId>:<id>     a rendering's bytes
//   dwg:<jobId>          the drawing set (HTML, for printing), shared after signing
//   dwgs:<jobId>         the same set as separate sheets (JSON), for marking up

export interface KV {
  get(key: string, type: 'json'): Promise<unknown>;
  get(key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>;
  getWithMetadata(key: string, type: 'arrayBuffer'): Promise<{ value: ArrayBuffer | null; metadata: unknown }>;
  put(key: string, value: string | ArrayBuffer, opts?: { metadata?: unknown; expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(opts?: { prefix?: string; cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
}

export interface Env { PORTAL: KV; SHOP_KEY?: string; RESEND_API_KEY?: string; MAIL_FROM?: string; QB_CLIENT_ID?: string; QB_CLIENT_SECRET?: string; QB_ENV?: string; DBX_APP_KEY?: string; DBX_APP_SECRET?: string }

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

export interface Signature {
  name: string; image: string; at: number; ip: string; ua: string; hash: string; version: number; consent: true;
  /** Options ticked when signing, and the total and deposit that came to. */
  options?: string[]; total?: number; deposit?: number;
  /** How the client said they'd pay: by card at the listed price, or by check or bank transfer with the discount. */
  payBy?: 'card' | 'check';
}
/** A discount for paying by check or bank transfer: the listed prices are the card prices. */
export interface PayDiscount { discount: number; checkTotal: number; checkDeposit: number; optionCheck?: Record<string, number> }
export interface ProposalOption { id: string; label: string; price: number; items: string[] }
export interface ProposalSummary { areas: { title: string; items: string[] }[]; materials: { label: string; value: string }[] }
export interface Job {
  jobId: string;
  token: string;
  client: { first?: string; last?: string; email?: string; phone?: string; address?: string };
  project: string;
  stage: 'proposal';
  proposal: {
    agreementHtml: string; total: number; deposit: number; publishedAt: number; version: number; hash: string;
    /** The terms as published with this version: what the client signs. Older jobs fall back to the shop's. */ terms?: string;
    /** The plain-language page (older jobs show only the agreement). */
    summary?: ProposalSummary; sections?: { label: string; price: number }[]; options?: ProposalOption[];
    /** The check / bank transfer price, when there's a discount for paying that way. */ pay?: PayDiscount;
  };
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
  /** The drawing set, shared once the agreement is signed (its HTML is under dwg:<jobId>). */
  drawings?: { publishedAt: number; version: number; title: string };
  /** The 3D model shared with the drawings (glb:<jobId>), for the client to look around and comment on. */
  model?: { publishedAt: number; version: number };
  /** Questions and change requests from the client, and the shop's answers. */
  comments?: PortalComment[];
  /** Written changes to the signed agreement, each approved (signed) or declined by the client. */
  changeOrders?: ChangeOrder[];
}

/** A change to the signed agreement: what changes, what it costs (or credits), and its effect on the schedule. */
export interface ChangeOrder {
  id: string; number: number; title: string;
  lines: { label: string; amount: number }[];
  /** The lines added up: positive adds to the contract, negative is a credit. */
  amount: number;
  /** Working days it adds to the schedule (0: none; unset: not stated). */
  days?: number;
  note?: string;
  /** Invoiced on its own once approved, or carried into the final payment. Credits always go to the final. */
  billing: 'now' | 'final';
  publishedAt: number; hash: string;
  signature?: { name: string; image: string; at: number; ip: string; ua: string };
  declined?: { at: number; reason?: string };
  /** Taken back by the shop before the client answered. */
  voided?: number;
  /** The QuickBooks invoice that billed it, when billed on its own. */
  invoiceId?: string;
}

export interface PortalComment {
  id: string; at: number; from: 'client' | 'shop'; name: string; text: string; about: string; read?: boolean;
  /** A spot marked on a drawing sheet: the sheet's index and the area, as fractions of the sheet. */
  mark?: { sheet: number; x: number; y: number; w: number; h: number };
  /** A spot pinned on the 3D model, in the model's own inches. */
  pin?: [number, number, number];
}
/** The drawing set split into sheets, for the proof page (dwgs:<jobId>). */
export interface DrawingSheets { css: string; sheets: { number: string; title: string; svg: string }[] }

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

/** Change orders the client approved, added up. */
export const approvedChanges = (j: Job) => (j.changeOrders ?? []).filter((c) => c.signature && !c.voided).reduce((t, c) => t + c.amount, 0);
/** The contract total now: what was signed plus approved change orders. */
export const adjustedTotal = (j: Job) => signedTotals(j).total + approvedChanges(j);

/** What the client signed for: the base proposal plus any options ticked (the proposal itself before signing). */
export function signedTotals(j: Job): { total: number; deposit: number } {
  const s = j.signature;
  return s?.total != null ? { total: s.total, deposit: s.deposit ?? j.proposal.deposit } : { total: j.proposal.total, deposit: j.proposal.deposit };
}
