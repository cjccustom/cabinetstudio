// Cabinet Studio's reach into the client portal (the Cloudflare Worker in portal/), through the
// claude.ai connector Cody adds as "CJC Portal". Every call runs from a button he pressed.
import { capability, type Mcp } from './runtime';

export const PORTAL = 'CJC Portal';

export class PortalError extends Error { constructor(message: string, public code?: string) { super(message); } }

export interface ShopDoc { id: string; title: string; kind: 'license' | 'insurance' | 'terms' | 'other'; mimeType: string; size: number; expires?: string; uploadedAt: number }
export interface Shop { company: string[]; about: string; terms: string; docs: ShopDoc[]; contactEmail?: string }
export interface JobStatus {
  job_id: string; project: string; url: string; version: number; publishedAt: number;
  views: number; lastViewed: number | null;
  signed: { name: string; at: number; version: number; current: boolean; /** Options ticked, and the total and deposit signed for. */ options?: string[]; total?: number; deposit?: number } | null;
  cancelDeadline: string | null;
  cancelled: { at: number } | null;
  invoices?: Invoice[];
  invoiceError?: string | null;
  drawings?: { publishedAt: number; version: number; title: string } | null;
  model?: { publishedAt: number; version: number } | null;
  comments?: PortalComment[];
  unread?: number;
}
export interface PortalComment { id: string; at: number; from: 'client' | 'shop'; name: string; text: string; about: string; read?: boolean; mark?: { sheet: number; x: number; y: number; w: number; h: number } }
export interface Invoice {
  id: string; kind: 'deposit' | 'final' | 'change'; number: string | null; amount: number; balance: number; paid: boolean;
  emailed: boolean; payLink: boolean; createdAt: number;
  payments: { method: 'check' | 'cash' | 'other'; amount: number; ref?: string; at: number }[];
}
export interface QbStatus {
  configured: boolean; connected: boolean; company: string | null; sandbox: boolean; connectPage: string; redirectUri: string;
  settings: { itemId?: string; itemName?: string; autoDeposit: boolean; email: boolean }; expiresAt: number | null;
}
export interface Proposal {
  job_id: string; project: string;
  client: { first?: string; last?: string; email?: string; phone?: string; address?: string };
  agreement_html: string; total: number; deposit: number;
  /** The plain-language page: the work by area, materials, the price in sections, and options to tick. */
  summary?: { areas: { title: string; items: string[] }[]; materials: { label: string; value: string }[] };
  sections?: { label: string; price: number }[];
  options?: { id: string; label: string; price: number; items: string[] }[];
  renderings?: { name: string; mimeType: string; data: string }[];
  keep_renderings?: boolean; replace_signed?: boolean;
}

type Raw = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function call<T = Raw>(tool: string, input: Raw = {}): Promise<T> {
  const mcp = await capability<Mcp>('mcp');
  if (!mcp) throw new PortalError('The client portal works when Cabinet Studio is open on claude.ai with the CJC Portal connector added.', 'unavailable');
  try {
    const res = await mcp.callTool(PORTAL, tool, input, { cache: false });
    const payload = res.payload ?? res.content.find((c) => c.text)?.text;
    return (typeof payload === 'string' ? JSON.parse(payload) : payload) as T;
  } catch (e) {
    const err = e as { code?: string; message?: string; result?: { content?: { text?: string }[] } };
    if (err instanceof PortalError) throw err;
    const text = err.result?.content?.find((c) => c.text)?.text || err.message || '';
    throw new PortalError(friendly(err.code, text), err.code);
  }
}

function friendly(code: string | undefined, text: string): string {
  switch (code) {
    case 'server_not_connected': case 'server_not_found': return 'The CJC Portal connector isn’t added. Follow the portal setup steps, then add it in claude.ai Settings → Connectors.';
    case 'needs_reauth': return 'Reconnect CJC Portal in claude.ai Settings → Connectors.';
    case 'not_in_manifest': case 'approval_required': case 'not_granted': return 'CJC Portal isn’t allowed for this page yet. Try again and choose Allow when claude.ai asks.';
    case 'server_unavailable': return 'The portal didn’t answer. Check the Worker is deployed in Cloudflare, then try again.';
    case 'tool_error': return text.slice(0, 300);
    default: return text ? `Portal: ${text.slice(0, 300)}` : 'Something went wrong reaching the portal.';
  }
}

export const getShop = async () => (await call<{ shop: Shop }>('get_shop')).shop;
export const updateShop = async (patch: Partial<Omit<Shop, 'docs'>>) => (await call<{ shop: Shop }>('update_shop', patch)).shop;
export const uploadShopDoc = async (doc: { id?: string; title: string; kind: ShopDoc['kind']; mimeType?: string; expires?: string; data?: string; source_url?: string }) =>
  (await call<{ doc: ShopDoc }>('upload_shop_doc', doc)).doc;
export const deleteShopDoc = (id: string) => call('delete_shop_doc', { id });
export const publishProposal = (p: Proposal) => call<JobStatus>('publish_proposal', p as unknown as Raw);
export const jobStatus = (jobId: string) => call<JobStatus>('job_status', { job_id: jobId });
export const listJobs = async () => (await call<{ jobs: JobStatus[] }>('list_jobs')).jobs;
export const publishDrawings = (jobId: string, html: string, title: string, css: string, sheets: { number: string; title: string; svg: string }[]) =>
  call<JobStatus>('publish_drawings', { job_id: jobId, html, title, css, sheets } as unknown as Raw);
export const replyComment = (jobId: string, text: string, about = 'proposal') => call<JobStatus>('reply_comment', { job_id: jobId, text, about });
export const markCommentsRead = (jobId: string) => call<JobStatus>('mark_comments_read', { job_id: jobId });
export type ApptKind = 'measure' | 'design' | 'review' | 'install' | 'delivery' | 'other';
export const apptKinds: { v: ApptKind; label: string }[] = [
  { v: 'measure', label: 'Measure' }, { v: 'design', label: 'Design meeting' }, { v: 'review', label: 'Review & sign' },
  { v: 'install', label: 'Install' }, { v: 'delivery', label: 'Delivery' }, { v: 'other', label: 'Other' },
];
export interface Appointment {
  id: string; jobId?: string; who: string; kind: ApptKind; start: string; minutes: number;
  location?: string; phone?: string; notes?: string; clientNote?: string; remind: number[]; share: boolean;
  /** The client's Dropbox folder, to open them from the schedule. */
  folder?: { id: string; stage: string };
  updatedAt: number;
}
export const listAppointments = async (from?: string) => (await call<{ appointments: Appointment[] }>('list_appointments', from ? { from } : {})).appointments;
export const saveAppointment = async (a: Partial<Appointment> & { start: string }) => {
  const { jobId, clientNote, ...rest } = a;
  return (await call<{ appointment: Appointment }>('save_appointment', { ...rest, ...(jobId !== undefined ? { job_id: jobId } : {}), ...(clientNote !== undefined ? { client_note: clientNote } : {}) })).appointment;
};
export const deleteAppointment = (id: string) => call('delete_appointment', { id });
export const calendarFeed = () => call<{ url: string; webcal: string }>('calendar_feed');

export interface DbxStatus { configured: boolean; connected: boolean; name: string | null; email: string | null; connectPage: string; redirectUri: string }
export const dropboxStatus = () => call<DbxStatus>('dropbox_status');
/** One photo into a Dropbox folder, through the portal (Cabinet Studio's own Dropbox connector can't write pictures). */
/**
 * A file's base64 into a Dropbox folder: in one call when it's small, otherwise in pieces (each
 * call from the page is limited to 1 MB). Pieces are a multiple of 4 characters, so each decodes alone.
 */
const PIECE_B64 = 600_000;
export async function savePhoto(folder: string, name: string, data: string): Promise<{ path: string; size: number }> {
  if (data.length <= PIECE_B64) return call<{ path: string; size: number }>('save_photo', { folder, name, data });
  let session: string | undefined, offset = 0;
  for (let i = 0; i < data.length; i += PIECE_B64) {
    const last = i + PIECE_B64 >= data.length;
    const r = await saveVideoChunk({ session, offset, data: data.slice(i, i + PIECE_B64), ...(last ? { folder, name } : {}) });
    session = r.session || session; offset = r.offset;
    if (last) return { path: r.path ?? `${folder}/${name}`, size: r.size ?? offset };
  }
  throw new PortalError('Nothing to save.', 'empty');
}
/** The 3D model (.glb, base64) onto a signed job's page, in pieces under the 1 MB call limit. */
export async function publishModel(jobId: string, b64: string, onProgress?: (done: number, of: number) => void): Promise<JobStatus> {
  const parts = Math.max(1, Math.ceil(b64.length / PIECE_B64));
  let last: unknown = null;
  for (let i = 0; i < parts; i++) {
    last = await call('publish_model', { job_id: jobId, part: i, parts, data: b64.slice(i * PIECE_B64, (i + 1) * PIECE_B64) });
    onProgress?.(i + 1, parts);
  }
  return last as JobStatus;
}
/** One piece of a video: start (no session), add, or finish (with the folder and name). */
export const saveVideoChunk = (a: { session?: string; offset: number; data: string; folder?: string; name?: string }) => call<{ session: string; offset: number; path?: string; size?: number }>('save_video_chunk', a);

export const qbStatus = () => call<QbStatus>('qb_status');
export const qbItems = async () => (await call<{ items: { id: string; name: string }[] }>('qb_items')).items;
export const qbSettings = (patch: { item_id?: string; item_name?: string; auto_deposit?: boolean; email?: boolean }) => call('qb_settings', patch);
export const createInvoice = (jobId: string, kind: Invoice['kind'], amount?: number, description?: string) =>
  call<JobStatus>('create_invoice', { job_id: jobId, kind, ...(amount !== undefined ? { amount } : {}), ...(description ? { description } : {}) });
export const recordPayment = (jobId: string, invoiceId: string, method: 'check' | 'cash' | 'other', amount: number, ref?: string) =>
  call<JobStatus>('record_payment', { job_id: jobId, invoice_id: invoiceId, method, amount, ...(ref ? { ref } : {}) });

/** Documents that expire within `days` (or already have), soonest first. */
export function expiring(docs: ShopDoc[], days = 45, now = Date.now()): (ShopDoc & { daysLeft: number })[] {
  return docs
    .filter((d) => d.expires)
    .map((d) => ({ ...d, daysLeft: Math.ceil((Date.parse(`${d.expires}T23:59:59`) - now) / 864e5) }))
    .filter((d) => d.daysLeft <= days)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

export const blobToBase64 = (b: Blob) => new Promise<string>((ok, fail) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).replace(/^data:[^,]*,/, ''));
  r.onerror = () => fail(r.error);
  r.readAsDataURL(b);
});
