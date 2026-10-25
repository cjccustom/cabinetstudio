// CJC client portal: one Cloudflare Worker.
//   /p/<token>...      a client's private project page (no login: the link is the key)
//   /<shop code>       the shop's connector for Cabinet Studio (MCP), at an address worked out
//                      from the SHOP_KEY secret, like the Gemini connector
//   /                  setup page
// Setup in Cloudflare: a KV namespace bound as PORTAL, and a Secret named SHOP_KEY.
import { type Env, type Job, type ShopDoc, b64ToBytes, getJob, getShop, jobByToken, putJob, putShop, randomToken, sha256 } from './store';
import { agreementPage, projectPage, simplePage } from './pages';
import { canCancel, cancelDeadline, easternYmd } from './cancel';

const html = (body: string, status = 200) => new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex', 'referrer-policy': 'no-referrer' } });
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (!env.PORTAL) return setupPage('Almost there', '<p>The portal is running, but its storage isn’t connected. In Cloudflare open this worker’s <b>Settings → Bindings</b>, add a <b>KV namespace</b> binding named <code>PORTAL</code> (create a namespace called <b>cjc-portal</b> if you don’t have one), then reload this page.</p>');
    const m = path.match(/^\/p\/([A-Za-z0-9_-]+)(?:\/(img|doc)\/([A-Za-z0-9_-]+)|\/(agreement|sign|cancel))?$/);
    if (m) return client(request, env, m[1], m[2] ?? m[4] ?? '', m[3] ?? '');
    const key = String(env.SHOP_KEY || '').trim();
    if (path === '/' || path === '/setup') return setup(request, url, key);
    const code = key ? await shopCode(key) : '';
    let p = path;
    try { p = decodeURIComponent(p); } catch { /* leave it */ }
    if (!code || p !== `/${code}`) return new Response('Not found', { status: 404 });
    if (request.method === 'GET') return new Response('CJC client portal connector is running.\n', { headers: { 'content-type': 'text/plain' } });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    let msg: unknown;
    try { msg = await request.json(); } catch { return json(rpcErr(null, -32700, 'Parse error')); }
    if (Array.isArray(msg)) {
      const out = (await Promise.all(msg.map((x) => rpc(x, env, url)))).filter(Boolean);
      return out.length ? json(out) : new Response(null, { status: 202 });
    }
    const res = await rpc(msg, env, url);
    return res ? json(res) : new Response(null, { status: 202 });
  },
};

/* ---------- The client's side ---------- */

async function client(request: Request, env: Env, token: string, what: string, id: string): Promise<Response> {
  const job = await jobByToken(env, token);
  const shop = await getShop(env);
  if (!job) return html(simplePage('Link not found', 'This project link isn’t active. Contact CJC Custom Carpentry for a new one.', shop), 404);
  if (what === 'img' || what === 'doc') {
    const key = what === 'img' ? `img:${job.jobId}:${id}` : `doc:${id}`;
    const known = what === 'img' ? job.renderings.some((r) => r.id === id) : shop.docs.some((d) => d.id === id);
    const got = known ? await env.PORTAL.getWithMetadata(key, 'arrayBuffer') : { value: null, metadata: null };
    if (!got.value) return new Response('Not found', { status: 404 });
    const meta = (got.metadata ?? {}) as { mimeType?: string };
    return new Response(got.value, { headers: { 'content-type': meta.mimeType || 'application/octet-stream', 'cache-control': 'private, max-age=3600', 'x-robots-tag': 'noindex' } });
  }
  if (what === 'agreement') return html(agreementPage(job, shop));
  const ip = request.headers.get('cf-connecting-ip') || '';
  if (what === 'sign' && request.method === 'POST') {
    if (job.signature || job.cancelled) return Response.redirect(new URL(`/p/${token}`, request.url).href, 303);
    const f = await request.formData();
    const name = String(f.get('name') || '').trim().slice(0, 120);
    const image = String(f.get('image') || '');
    if (!name || f.get('consent') !== 'on' || f.get('agree') !== 'on' || !/^data:image\/png;base64,/.test(image) || image.length > 400_000) {
      return html(projectPage(job, shop, token, 'Please check both boxes, type your name and sign in the box.'), 400);
    }
    job.signature = { name, image, at: Date.now(), ip, ua: (request.headers.get('user-agent') || '').slice(0, 200), hash: job.proposal.hash, version: job.proposal.version, consent: true };
    await putJob(env, job);
    return Response.redirect(new URL(`/p/${token}/agreement`, request.url).href, 303);
  }
  if (what === 'cancel' && request.method === 'POST') {
    const s = job.signature;
    if (s && !job.cancelled && canCancel(s.at)) {
      const f = await request.formData();
      if (String(f.get('name') || '').trim()) { job.cancelled = { at: Date.now(), ip }; await putJob(env, job); }
    }
    return Response.redirect(new URL(`/p/${token}`, request.url).href, 303);
  }
  // A visit: keep the last 50 view times for the shop
  job.views = [...(job.views ?? []), Date.now()].slice(-50);
  await putJob(env, job);
  return html(projectPage(job, shop, token));
}

/* ---------- Setup page ---------- */

async function setup(request: Request, url: URL, key: string): Promise<Response> {
  if (!key) {
    const suggestion = randomToken(24);
    return setupPage('Almost there', `<p>Storage is connected. Now add a <b>Secret</b> named <code>SHOP_KEY</code> in this worker’s <b>Settings → Variables and Secrets</b>. Make up a long password, or use this one (copy it somewhere safe first):</p><input readonly value="${suggestion}" onclick="this.select()"><p>Save and deploy, then reload this page.</p>`);
  }
  if (request.method === 'POST') {
    const pasted = String((await request.formData()).get('key') || '').trim();
    if (pasted && (await shopCode(pasted)) === (await shopCode(key))) {
      const address = `${url.origin}/${await shopCode(key)}`;
      return setupPage('Your connector address', `<p>In claude.ai go to <b>Settings → Connectors → Add custom connector</b>, name it <b>CJC Portal</b> and paste this address:</p><input readonly value="${address}" onclick="this.select()"><p><button onclick="navigator.clipboard.writeText('${address}');this.textContent='Copied'">Copy</button></p><p class="note">Keep it private: it can publish and read your client pages.</p>`);
    }
    return setupPage('That key doesn’t match', '<p>Paste the same SHOP_KEY you saved in Cloudflare.</p>' + keyForm());
  }
  return setupPage('CJC client portal is running', '<p>Storage: <b>connected</b>. SHOP_KEY: <b>saved</b>. Paste the same SHOP_KEY below to get the connector address for Cabinet Studio.</p>' + keyForm());
}
const keyForm = () => '<form method="post" action="/setup"><input name="key" type="password" placeholder="SHOP_KEY" autocomplete="off" required><button>Get the connector address</button></form>';
async function shopCode(key: string) { return (await sha256(`cjc-portal-connector:${key}`)).slice(0, 40); }
function setupPage(title: string, body: string) {
  return html(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title>
<style>body{font:16px/1.5 -apple-system,system-ui,sans-serif;max-width:560px;margin:10vh auto;padding:0 16px;color:#1d2127;background:#fbfbfc}input{width:100%;box-sizing:border-box;padding:10px;font:inherit;border:1px solid #c9ced6;border-radius:6px;margin:6px 0}button{padding:9px 16px;font:inherit;border:0;border-radius:6px;background:#2b4a3c;color:#fff;cursor:pointer}.note{color:#646d78;font-size:14px}code{background:#eef0f2;padding:1px 4px;border-radius:4px}</style>
</head><body><h1>${title}</h1>${body}</body></html>`);
}

/* ---------- The shop's connector (MCP) ---------- */

const TOOLS = [
  { name: 'get_shop', description: 'The portal’s shop profile: company lines, about blurb, terms, and the documents (licenses, insurance) with their expiration dates.', inputSchema: { type: 'object', properties: {} } },
  {
    name: 'update_shop', description: 'Change the shop profile shown on every client page. Only the fields sent change.',
    inputSchema: { type: 'object', properties: { company: { type: 'array', items: { type: 'string' } }, about: { type: 'string' }, terms: { type: 'string' }, contactEmail: { type: 'string' } } },
  },
  {
    name: 'upload_shop_doc', description: 'Add or replace a shop document shown to every client (license, insurance certificate, terms PDF). Send base64 bytes, or a Dropbox temporary link; up to about 20 MB.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Replace this document; omit for a new one.' }, title: { type: 'string' }, kind: { type: 'string', enum: ['license', 'insurance', 'terms', 'other'] }, mimeType: { type: 'string' }, expires: { type: 'string', description: 'YYYY-MM-DD, for reminders.' }, data: { type: 'string', description: 'Base64 bytes.' }, source_url: { type: 'string', description: 'Or: a Dropbox temporary download link for the portal to fetch.' } }, required: ['title', 'kind'] },
  },
  { name: 'delete_shop_doc', description: 'Remove a shop document.', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  {
    name: 'publish_proposal', description: 'Create or update a client’s project page with the proposal: the scope and purchase agreement (HTML), price, and renderings. Returns the private link. A signed proposal is not replaced unless replace_signed is true.',
    inputSchema: {
      type: 'object',
      properties: {
        job_id: { type: 'string' }, project: { type: 'string' },
        client: { type: 'object', properties: { first: { type: 'string' }, last: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, address: { type: 'string' } } },
        agreement_html: { type: 'string' }, total: { type: 'number' }, deposit: { type: 'number' },
        renderings: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, mimeType: { type: 'string' }, data: { type: 'string' } }, required: ['data'] } },
        keep_renderings: { type: 'boolean', description: 'Leave the renderings already published as they are.' },
        replace_signed: { type: 'boolean' },
      },
      required: ['job_id', 'project', 'agreement_html', 'total', 'deposit'],
    },
  },
  { name: 'job_status', description: 'Where a client’s page stands: link, views, signature (who, when), cancellation and its deadline.', inputSchema: { type: 'object', properties: { job_id: { type: 'string' } }, required: ['job_id'] } },
  { name: 'list_jobs', description: 'Every job on the portal with its status.', inputSchema: { type: 'object', properties: {} } },
];

type Rpc = { id?: unknown; method?: string; params?: { name?: string; arguments?: Record<string, unknown>; protocolVersion?: string } };
const rpcOk = (id: unknown, result: unknown) => ({ jsonrpc: '2.0', id, result });
const rpcErr = (id: unknown, code: number, message: string) => ({ jsonrpc: '2.0', id, error: { code, message } });

async function rpc(raw: unknown, env: Env, url: URL) {
  const { id, method, params } = (raw || {}) as Rpc;
  if (id === undefined || id === null) return null;
  try {
    switch (method) {
      case 'initialize': return rpcOk(id, { protocolVersion: params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'cjc-portal', version: '1.0.0' } });
      case 'ping': return rpcOk(id, {});
      case 'tools/list': return rpcOk(id, { tools: TOOLS });
      case 'tools/call': {
        const out = await tool(String(params?.name), params?.arguments || {}, env, url);
        return rpcOk(id, { content: [{ type: 'text', text: JSON.stringify(out) }], structuredContent: out });
      }
      default: return rpcErr(id, -32601, `Unknown method ${method}`);
    }
  } catch (e) {
    return rpcOk(id, { isError: true, content: [{ type: 'text', text: String((e as Error)?.message || e) }] });
  }
}

const status = (j: Job, url: URL) => ({
  job_id: j.jobId, project: j.project, url: `${url.origin}/p/${j.token}`, version: j.proposal.version, publishedAt: j.proposal.publishedAt,
  views: (j.views ?? []).length, lastViewed: j.views?.length ? j.views[j.views.length - 1] : null,
  signed: j.signature ? { name: j.signature.name, at: j.signature.at, version: j.signature.version, current: j.signature.hash === j.proposal.hash } : null,
  cancelDeadline: j.signature ? cancelDeadline(easternYmd(j.signature.at)) : null,
  cancelled: j.cancelled ? { at: j.cancelled.at } : null,
});

/** A file from a Dropbox temporary link. Only Dropbox's own download hosts, so the portal can't be pointed elsewhere. */
async function fetchDropbox(src: string): Promise<ArrayBuffer> {
  const u = new URL(src);
  if (u.protocol !== 'https:' || !/(^|\.)dropboxusercontent\.com$/.test(u.hostname)) throw new Error('Only Dropbox download links can be fetched.');
  const res = await fetch(u.href, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Dropbox answered ${res.status}; the link may have expired.`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength > 24e6) throw new Error('That file is over the portal’s 24 MB limit.');
  return buf;
}

async function tool(name: string, a: Record<string, unknown>, env: Env, url: URL): Promise<Record<string, unknown>> {
  const str = (k: string) => (typeof a[k] === 'string' ? (a[k] as string) : undefined);
  switch (name) {
    case 'get_shop': return { shop: await getShop(env) };
    case 'update_shop': {
      const s = await getShop(env);
      if (Array.isArray(a.company)) s.company = (a.company as unknown[]).map(String);
      for (const k of ['about', 'terms', 'contactEmail'] as const) if (str(k) !== undefined) s[k] = str(k)!;
      await putShop(env, s);
      return { shop: s };
    }
    case 'upload_shop_doc': {
      const s = await getShop(env);
      const bytes = str('source_url') ? await fetchDropbox(str('source_url')!) : b64ToBytes(String(a.data || ''));
      if (!bytes.byteLength) throw new Error('The document is empty.');
      const id = str('id') && s.docs.some((d) => d.id === str('id')) ? str('id')! : randomToken(9);
      const doc: ShopDoc = { id, title: str('title') || 'Document', kind: (str('kind') as ShopDoc['kind']) || 'other', mimeType: str('mimeType') || 'application/pdf', size: bytes.byteLength, expires: str('expires') || undefined, uploadedAt: Date.now() };
      await env.PORTAL.put(`doc:${id}`, bytes, { metadata: { mimeType: doc.mimeType } });
      s.docs = [...s.docs.filter((d) => d.id !== id), doc];
      await putShop(env, s);
      return { doc };
    }
    case 'delete_shop_doc': {
      const s = await getShop(env);
      s.docs = s.docs.filter((d) => d.id !== str('id'));
      await env.PORTAL.delete(`doc:${str('id')}`);
      await putShop(env, s);
      return { ok: true };
    }
    case 'publish_proposal': {
      const jobId = String(a.job_id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
      if (!jobId) throw new Error('job_id is needed.');
      const old = await getJob(env, jobId);
      if (old?.signature && !old.cancelled && !a.replace_signed) throw new Error('This proposal is already signed. Publish with replace_signed to put up a new version for signing.');
      const shop = await getShop(env);
      const agreementHtml = String(a.agreement_html || '');
      const version = (old?.proposal.version ?? 0) + 1;
      const hash = await sha256(`${agreementHtml}\n--terms--\n${shop.terms}`);
      let renderings = old?.renderings ?? [];
      if (!a.keep_renderings && Array.isArray(a.renderings)) {
        for (const r of renderings) await env.PORTAL.delete(`img:${jobId}:${r.id}`);
        renderings = [];
        for (const r of (a.renderings as { name?: string; mimeType?: string; data: string }[]).slice(0, 12)) {
          const rid = randomToken(9);
          await env.PORTAL.put(`img:${jobId}:${rid}`, b64ToBytes(r.data), { metadata: { mimeType: r.mimeType || 'image/jpeg' } });
          renderings.push({ id: rid, name: r.name || 'Rendering', mimeType: r.mimeType || 'image/jpeg' });
        }
      }
      const token = old?.token ?? randomToken(18);
      const job: Job = {
        jobId, token, client: (a.client as Job['client']) ?? old?.client ?? {}, project: String(a.project || old?.project || 'Your project'), stage: 'proposal',
        proposal: { agreementHtml, total: Number(a.total) || 0, deposit: Number(a.deposit) || 0, publishedAt: Date.now(), version, hash },
        renderings, views: old?.views ?? [],
        history: old?.history ?? [],
      };
      // A cancelled or replaced signature leaves the page but stays on record in the job's history
      if (old?.signature) job.history!.push({ ...old.signature, ...(old.cancelled ? { cancelled: old.cancelled } : {}) });
      await putJob(env, job);
      await env.PORTAL.put(`tok:${token}`, JSON.stringify(jobId));
      return status(job, url);
    }
    case 'job_status': {
      const j = await getJob(env, String(a.job_id || ''));
      if (!j) throw new Error('No portal page for that job yet.');
      return status(j, url);
    }
    case 'list_jobs': {
      const out: unknown[] = [];
      let cursor: string | undefined;
      do {
        const page = await env.PORTAL.list({ prefix: 'job:', cursor });
        for (const k of page.keys) { const j = (await env.PORTAL.get(k.name, 'json')) as Job | null; if (j) out.push(status(j, url)); }
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);
      return { jobs: out };
    }
    default: throw new Error(`Unknown tool ${name}`);
  }
}
