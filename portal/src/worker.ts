// CJC client portal: one Cloudflare Worker.
//   /p/<token>...      a client's private project page (no login: the link is the key)
//   /<shop code>       the shop's connector for Cabinet Studio (MCP), at an address worked out
//                      from the SHOP_KEY secret, like the Gemini connector
//   /                  setup page
//   /qb                connecting QuickBooks Online (and /qb/callback, where Intuit returns)
//   /dropbox           connecting Dropbox, for photos from the phone (and /dropbox/callback)
//   /legal/...         the end-user agreement and privacy pages Intuit asks an app to have
//   /cal/<code>.ics    Cody's private appointment calendar, for his iPhone to subscribe to
// Setup in Cloudflare: a KV namespace bound as PORTAL, and a Secret named SHOP_KEY; for
// QuickBooks, Secrets QB_CLIENT_ID and QB_CLIENT_SECRET (and QB_ENV = sandbox to test first);
// for photos, Secrets DBX_APP_KEY and DBX_APP_SECRET.
import { type Env, type Job, type ShopDoc, b64ToBytes, getJob, getShop, jobByToken, putJob, putShop, randomToken, sha256, signedTotals } from './store';
import { agreementPage, esc, projectPage, simplePage } from './pages';
import { canCancel, cancelDeadline, easternYmd } from './cancel';
import { calendar, deleteAppt, feedCode, listAppts, saveAppt, apptLabel, type Appointment } from './calendar';
import { dbxConnectUrl, dbxDisconnect, dbxFinish, dbxReady, dbxRedirect, dbxUpload, getDbx } from './dbx';
import { connectUrl, disconnect, finishConnect, getConn, getQbSettings, listItems, makeInvoice, putQbSettings, qbReady, recordPayment, refreshInvoice, type QbInvoice } from './qb';

const html = (body: string, status = 200) => new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex', 'referrer-policy': 'no-referrer' } });
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (!env.PORTAL) return setupPage('Almost there', '<p>The portal is running, but its storage isn’t connected. In Cloudflare open this worker’s <b>Settings → Bindings</b>, add a <b>KV namespace</b> binding named <code>PORTAL</code> (create a namespace called <b>cjc-portal</b> if you don’t have one), then reload this page.</p>');
    const m = path.match(/^\/p\/([A-Za-z0-9_-]+)(?:\/(img|doc|visit)\/([A-Za-z0-9_-]+)(?:\.ics)?|\/(agreement|sign|cancel))?$/);
    if (m) return client(request, env, m[1], m[2] ?? m[4] ?? '', m[3] ?? '');
    const key = String(env.SHOP_KEY || '').trim();
    const cal = path.match(/^\/cal\/([a-f0-9]{32})\.ics$/);
    if (cal) {
      if (!key || cal[1] !== (await feedCode(key))) return new Response('Not found', { status: 404 });
      const since = new Date(Date.now() - 90 * 864e5).toISOString();
      // Cancelled ones drop off the phone
      const appts = (await listAppts(env)).filter((a) => a.start >= since && !a.cancelled);
      return new Response(calendar(appts, 'CJC Jobs'), { headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'no-store' } });
    }
    if (path === '/' || path === '/setup') return setup(request, url, key);
    if (path === '/qb' || path === '/qb/connect' || path === '/qb/callback') return qbPage(request, env, url, key, path);
    if (path === '/dropbox' || path === '/dropbox/callback') return dbxPage(request, env, url, key, path);
    if (path === '/legal/eula' || path === '/legal/privacy') return html(legalPage(path.endsWith('eula')));
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
  if (what === 'visit') {
    const a = (await listAppts(env)).find((x) => x.id === id && x.jobId === job.jobId && x.share && !x.cancelled);
    if (!a) return new Response('Not found', { status: 404 });
    return new Response(calendar([a], shop.company[0] || 'CJC Custom Carpentry', true, shop.company[0] || 'CJC Custom Carpentry'), { headers: { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': `attachment; filename="${apptLabel[a.kind]}.ics"`, 'cache-control': 'no-store' } });
  }
  if (what === 'agreement') { await freshInvoices(env, job, 5 * 60e3); return html(agreementPage(job, shop)); }
  const ip = request.headers.get('cf-connecting-ip') || '';
  if (what === 'sign' && request.method === 'POST') {
    if (job.signature || job.cancelled) return Response.redirect(new URL(`/p/${token}`, request.url).href, 303);
    const f = await request.formData();
    const name = String(f.get('name') || '').trim().slice(0, 120);
    const image = String(f.get('image') || '');
    if (!name || f.get('consent') !== 'on' || f.get('agree') !== 'on' || !/^data:image\/png;base64,/.test(image) || image.length > 400_000) {
      return html(projectPage(job, shop, token, 'Please check both boxes, type your name and sign in the box.'), 400);
    }
    // Options ticked on the page add to the total; the deposit keeps the proposal's share of it
    const picked = (job.proposal.options ?? []).filter((o) => f.get(`opt_${o.id}`) === 'on');
    const total = job.proposal.total + picked.reduce((t, o) => t + o.price, 0);
    const share = job.proposal.total ? job.proposal.deposit / job.proposal.total : 0.3;
    job.signature = {
      name, image, at: Date.now(), ip, ua: (request.headers.get('user-agent') || '').slice(0, 200), hash: job.proposal.hash, version: job.proposal.version, consent: true,
      ...(job.proposal.options?.length ? { options: picked.map((o) => o.id), total, deposit: Math.round(total * share) } : {}),
    };
    await putJob(env, job);
    await autoDeposit(env, job);
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
  // A visit: keep the last 50 view times for the shop, and catch up on any open invoice
  job.views = [...(job.views ?? []), Date.now()].slice(-50);
  await freshInvoices(env, job, 5 * 60e3);
  await putJob(env, job);
  return html(projectPage(job, shop, token, '', await visitsFor(env, job.jobId)));
}

/** The client's upcoming visits shown on their page. */
const visitsFor = async (env: Env, jobId: string): Promise<Appointment[]> => {
  const now = new Date(Date.now() - 2 * 3600e3).toISOString();
  return (await listAppts(env)).filter((a) => a.jobId === jobId && a.share && !a.cancelled && a.start >= now);
};

/** The deposit invoice, made and sent when the client signs (when QuickBooks is connected and that's switched on). */
async function autoDeposit(env: Env, job: Job) {
  if (!qbReady(env) || !(signedTotals(job).deposit > 0) || job.invoices?.some((i) => i.kind === 'deposit')) return;
  const [conn, s] = [await getConn(env), await getQbSettings(env)];
  if (!conn || !s.autoDeposit) return;
  try {
    const inv = await makeInvoice(env, job, 'deposit', signedTotals(job).deposit, depositLine(job));
    job.invoices = [...(job.invoices ?? []), inv];
    job.invoiceError = undefined;
  } catch (e) {
    job.invoiceError = String((e as Error).message || e).slice(0, 300);
  }
  await putJob(env, job);
}
const depositLine = (j: Job) => {
  const t = signedTotals(j);
  const opts = (j.proposal.options ?? []).filter((o) => j.signature?.options?.includes(o.id)).map((o) => o.label);
  return `Deposit (${Math.round((t.deposit / (t.total || 1)) * 100)}%) on ${j.project}, per the signed agreement (version ${j.proposal.version})${opts.length ? ` with ${opts.join(', ')}` : ''}. Project total $${t.total.toLocaleString('en-US')}.`;
};

/** Bring unpaid invoices up to date with QuickBooks, at most every `age` ms. */
async function freshInvoices(env: Env, job: Job, age: number) {
  const open = (job.invoices ?? []).filter((i) => i.balance > 0 && Date.now() - i.checkedAt > age);
  if (!open.length || !(await getConn(env))) return;
  for (const inv of open) await refreshInvoice(env, inv).catch(() => undefined);
  await putJob(env, job);
}

/* ---------- QuickBooks connection ---------- */

async function qbPage(request: Request, env: Env, url: URL, key: string, path: string): Promise<Response> {
  if (!qbReady(env)) {
    return setupPage('Connect QuickBooks', `<p>First make an app at <b>developer.intuit.com</b> (it’s free), then add its keys to this worker as <b>Secrets</b> in <b>Settings → Variables and Secrets</b>: <code>QB_CLIENT_ID</code> and <code>QB_CLIENT_SECRET</code>. In the Intuit app, add this Redirect URI:</p><input readonly value="${url.origin}/qb/callback" onclick="this.select()"><p>Then reload this page.</p>`);
  }
  if (path === '/qb/callback') {
    try {
      const name = await finishConnect(env, url);
      return setupPage('QuickBooks connected', `<p>The portal is connected to <b>${esc(name)}</b>${String(env.QB_ENV).toLowerCase() === 'sandbox' ? ' (Intuit’s test company)' : ''}. Go back to Cabinet Studio and pick the product/service for invoices under <b>Portal settings → QuickBooks</b>.</p>`);
    } catch (e) {
      return setupPage('QuickBooks didn’t connect', `<p>${esc((e as Error).message)}</p><p><a href="/qb">Try again</a></p>`);
    }
  }
  if (request.method === 'POST') {
    const f = await request.formData();
    const pasted = String(f.get('key') || '').trim();
    if (!key || !pasted || (await shopCode(pasted)) !== (await shopCode(key))) return setupPage('That key doesn’t match', '<p>Paste the same SHOP_KEY you saved in Cloudflare.</p>' + qbForm());
    if (f.get('action') === 'disconnect') { await disconnect(env); return setupPage('QuickBooks disconnected', '<p>The portal no longer has access to QuickBooks. Invoices already made stay in QuickBooks.</p><p><a href="/qb">Connect again</a></p>'); }
    return Response.redirect(await connectUrl(env, url.origin), 302);
  }
  const conn = await getConn(env);
  return setupPage('QuickBooks', `<p>${conn ? `Connected to <b>${esc(conn.companyName || 'your company')}</b> since ${esc(new Date(conn.connectedAt).toLocaleDateString('en-US'))}.` : 'Not connected yet.'}${String(env.QB_ENV).toLowerCase() === 'sandbox' ? ' <b>Test mode</b> (QB_ENV is sandbox).' : ''}</p><p>Paste your SHOP_KEY to ${conn ? 'reconnect or disconnect' : 'connect'}. QuickBooks then asks you to sign in and pick the company.</p>${qbForm(!!conn)}`);
}
const qbForm = (connected = false) => `<form method="post" action="/qb"><input name="key" type="password" placeholder="SHOP_KEY" autocomplete="off" required><p><button name="action" value="connect">${connected ? 'Reconnect' : 'Connect to QuickBooks'}</button>${connected ? ' <button name="action" value="disconnect" style="background:#8a2a1e">Disconnect</button>' : ''}</p></form>`;

/* ---------- Dropbox connection (photos) ---------- */

async function dbxPage(request: Request, env: Env, url: URL, key: string, path: string): Promise<Response> {
  if (!dbxReady(env)) {
    return setupPage('Connect Dropbox', `<p>First make an app at <b>dropbox.com/developers</b> (Create app → Scoped access → Full Dropbox), give it the <b>files.content.write</b> permission, then add its keys to this worker as <b>Secrets</b> in <b>Settings → Variables and Secrets</b>: <code>DBX_APP_KEY</code> and <code>DBX_APP_SECRET</code>. In the Dropbox app's Settings, add this Redirect URI:</p><input readonly value="${dbxRedirect(url.origin)}" onclick="this.select()"><p>Then reload this page.</p>`);
  }
  if (path === '/dropbox/callback') {
    try {
      const c = await dbxFinish(env, url);
      return setupPage('Dropbox connected', `<p>The portal can now save photos into <b>${esc(c.name || 'your')}</b>${c.name ? '’s' : ''} Dropbox${c.email ? ` (${esc(c.email)})` : ''}. Go back to Cabinet Studio and take a photo from a client's page.</p>`);
    } catch (e) {
      return setupPage('Dropbox didn’t connect', `<p>${esc((e as Error).message)}</p><p><a href="/dropbox">Try again</a></p>`);
    }
  }
  if (request.method === 'POST') {
    const f = await request.formData();
    const pasted = String(f.get('key') || '').trim();
    if (!key || !pasted || (await shopCode(pasted)) !== (await shopCode(key))) return setupPage('That key doesn’t match', '<p>Paste the same SHOP_KEY you saved in Cloudflare.</p>' + dbxForm());
    if (f.get('action') === 'disconnect') { await dbxDisconnect(env); return setupPage('Dropbox disconnected', '<p>The portal can no longer save to Dropbox. Photos already saved stay where they are.</p><p><a href="/dropbox">Connect again</a></p>'); }
    return Response.redirect(await dbxConnectUrl(env, url.origin), 302);
  }
  const conn = await getDbx(env);
  return setupPage('Dropbox', `<p>${conn ? `Connected to <b>${esc(conn.name || 'your Dropbox')}</b>${conn.email ? ` (${esc(conn.email)})` : ''} since ${esc(new Date(conn.connectedAt).toLocaleDateString('en-US'))}.` : 'Not connected yet.'}</p><p>The portal uses it only to save photos you take in Cabinet Studio into the client's folder. Paste your SHOP_KEY to ${conn ? 'reconnect or disconnect' : 'connect'}; Dropbox then asks you to sign in and allow it.</p>${dbxForm(!!conn)}`);
}
const dbxForm = (connected = false) => `<form method="post" action="/dropbox"><input name="key" type="password" placeholder="SHOP_KEY" autocomplete="off" required><p><button name="action" value="connect">${connected ? 'Reconnect' : 'Connect to Dropbox'}</button>${connected ? ' <button name="action" value="disconnect" style="background:#8a2a1e">Disconnect</button>' : ''}</p></form>`;

function legalPage(eula: boolean) {
  const body = eula
    ? '<p>This portal is used only by CJC Custom Carpentry LLC to share proposals, agreements and invoices with its own clients. It is provided as is. Clients use it to view and sign their own project documents and to reach QuickBooks’ payment page for their invoices.</p>'
    : '<p>The portal keeps what CJC Custom Carpentry LLC publishes for each client (proposal, renderings, documents), the client’s signature with its time, IP address and browser, and page view times. QuickBooks is used only to make and track the shop’s own invoices; no QuickBooks data is shared with anyone else. Data is stored with Cloudflare. Contact the shop to have a record removed where the law allows.</p>';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${eula ? 'End-user agreement' : 'Privacy'}</title><style>body{font:16px/1.55 system-ui,sans-serif;max-width:640px;margin:8vh auto;padding:0 16px}</style></head><body><h1>${eula ? 'End-user license agreement' : 'Privacy policy'}</h1>${body}</body></html>`;
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
        summary: { type: 'object', description: 'The plain-language page: areas (title, items) and materials (label, value).' },
        sections: { type: 'array', description: 'The base price in sections (label, price).', items: { type: 'object' } },
        options: { type: 'array', description: 'Options the client can tick when signing (id, label, price, items).', items: { type: 'object' } },
        renderings: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, mimeType: { type: 'string' }, data: { type: 'string' } }, required: ['data'] } },
        keep_renderings: { type: 'boolean', description: 'Leave the renderings already published as they are.' },
        replace_signed: { type: 'boolean' },
      },
      required: ['job_id', 'project', 'agreement_html', 'total', 'deposit'],
    },
  },
  { name: 'job_status', description: 'Where a client’s page stands: link, views, signature (who, when), cancellation and its deadline.', inputSchema: { type: 'object', properties: { job_id: { type: 'string' } }, required: ['job_id'] } },
  { name: 'list_jobs', description: 'Every job on the portal with its status.', inputSchema: { type: 'object', properties: {} } },
  { name: 'list_appointments', description: 'Appointments on the portal calendar, soonest first. By default from yesterday on; pass from (ISO date) for older.', inputSchema: { type: 'object', properties: { from: { type: 'string' }, job_id: { type: 'string' } } } },
  {
    name: 'save_appointment', description: 'Add an appointment, or change one (pass its id). Times are ISO with an offset or Z.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, job_id: { type: 'string' }, who: { type: 'string' }, kind: { type: 'string', enum: ['measure', 'design', 'review', 'install', 'delivery', 'other'] }, start: { type: 'string' }, minutes: { type: 'number' }, location: { type: 'string' }, phone: { type: 'string' }, notes: { type: 'string', description: 'Private to Cody.' }, client_note: { type: 'string', description: 'Shown to the client.' }, remind: { type: 'array', items: { type: 'number' }, description: 'Alerts, minutes before.' }, share: { type: 'boolean', description: 'Show on the client’s project page.' }, folder: { type: 'object', properties: { id: { type: 'string' }, stage: { type: 'string' } } }, cancelled: { type: 'boolean' } }, required: ['start'] },
  },
  { name: 'delete_appointment', description: 'Remove an appointment from the calendar.', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  { name: 'calendar_feed', description: 'The private calendar address for Cody’s phone to subscribe to.', inputSchema: { type: 'object', properties: {} } },
  { name: 'qb_status', description: 'Whether QuickBooks Online is set up and connected, to which company, the invoice settings, and the address of the page for connecting it.', inputSchema: { type: 'object', properties: {} } },
  { name: 'dropbox_status', description: 'Whether the portal can save photos to Dropbox, whose Dropbox it is, and the address of the page for connecting it.', inputSchema: { type: 'object', properties: {} } },
  {
    name: 'save_photo', description: 'Save one photo (base64 JPEG/PNG/HEIC) into a Dropbox folder, e.g. a client\'s folder plus /Photos. Never replaces a file: a taken name gets a number added. Up to about 15 MB.',
    inputSchema: { type: 'object', properties: { folder: { type: 'string', description: 'Dropbox path of the folder, like /CJC/Jobs/To quote/Smith, Jane/Photos. Made if missing.' }, name: { type: 'string', description: 'File name, like 2026-10-27 0915 Kitchen.jpg' }, data: { type: 'string', description: 'Base64 bytes.' } }, required: ['folder', 'name', 'data'] },
  },
  { name: 'qb_items', description: 'The QuickBooks products/services (type Service) an invoice line can use.', inputSchema: { type: 'object', properties: {} } },
  {
    name: 'qb_settings', description: 'Change the invoice settings. Only the fields sent change.',
    inputSchema: { type: 'object', properties: { item_id: { type: 'string' }, item_name: { type: 'string' }, auto_deposit: { type: 'boolean', description: 'Make and send the deposit invoice when the client signs.' }, email: { type: 'boolean', description: 'Have QuickBooks email invoices to the client.' } } },
  },
  {
    name: 'create_invoice', description: 'Make a QuickBooks invoice for a job (with card/ACH payment on), and email it when that is on. Deposit defaults to the proposal deposit; final defaults to the total less what was invoiced before.',
    inputSchema: { type: 'object', properties: { job_id: { type: 'string' }, kind: { type: 'string', enum: ['deposit', 'final', 'change'] }, amount: { type: 'number' }, description: { type: 'string' } }, required: ['job_id', 'kind'] },
  },
  {
    name: 'record_payment', description: 'Record a check or cash payment against one of the job’s invoices in QuickBooks.',
    inputSchema: { type: 'object', properties: { job_id: { type: 'string' }, invoice_id: { type: 'string' }, method: { type: 'string', enum: ['check', 'cash', 'other'] }, amount: { type: 'number' }, ref: { type: 'string', description: 'Check number.' } }, required: ['job_id', 'invoice_id', 'method', 'amount'] },
  },
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
  signed: j.signature ? { name: j.signature.name, at: j.signature.at, version: j.signature.version, current: j.signature.hash === j.proposal.hash, ...(j.signature.total != null ? { options: (j.proposal.options ?? []).filter((o) => j.signature!.options?.includes(o.id)).map((o) => o.label), total: j.signature.total, deposit: j.signature.deposit } : {}) } : null,
  cancelDeadline: j.signature ? cancelDeadline(easternYmd(j.signature.at)) : null,
  cancelled: j.cancelled ? { at: j.cancelled.at } : null,
  invoices: (j.invoices ?? []).map((i) => ({ id: i.id, kind: i.kind, number: i.docNumber ?? null, amount: i.amount, balance: i.balance, paid: i.balance <= 0, emailed: !!i.emailed, payLink: !!i.link, createdAt: i.createdAt, payments: i.payments ?? [] })),
  invoiceError: j.invoiceError ?? null,
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
        proposal: { agreementHtml, total: Number(a.total) || 0, deposit: Number(a.deposit) || 0, publishedAt: Date.now(), version, hash, terms: shop.terms, ...cleanSummary(a) },
        renderings, views: old?.views ?? [],
        history: old?.history ?? [],
        invoices: old?.invoices ?? [],
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
      await freshInvoices(env, j, 0);
      return status(j, url);
    }
    case 'list_appointments': {
      const from = str('from') ?? new Date(Date.now() - 864e5).toISOString();
      return { appointments: (await listAppts(env)).filter((a) => a.start >= from && (!str('job_id') || a.jobId === str('job_id'))) };
    }
    case 'save_appointment': {
      const { job_id, client_note, ...rest } = a as Record<string, unknown>;
      return { appointment: await saveAppt(env, { ...(rest as Partial<Appointment>), ...(job_id !== undefined ? { jobId: String(job_id) || undefined } : {}), ...(client_note !== undefined ? { clientNote: String(client_note) } : {}), start: String(a.start) }) };
    }
    case 'delete_appointment': { await deleteAppt(env, String(a.id || '')); return { ok: true }; }
    case 'calendar_feed': {
      const key = String(env.SHOP_KEY || '').trim();
      if (!key) throw new Error('SHOP_KEY isn’t set.');
      const url2 = `${url.origin}/cal/${await feedCode(key)}.ics`;
      return { url: url2, webcal: url2.replace(/^https:/, 'webcal:') };
    }
    case 'qb_status': {
      const conn = qbReady(env) ? await getConn(env) : null;
      return { configured: qbReady(env), connected: !!conn, company: conn?.companyName ?? null, sandbox: String(env.QB_ENV || '').toLowerCase() === 'sandbox', connectPage: `${url.origin}/qb`, redirectUri: `${url.origin}/qb/callback`, settings: await getQbSettings(env), expiresAt: conn?.refreshExp ?? null };
    }
    case 'dropbox_status': {
      const conn = dbxReady(env) ? await getDbx(env) : null;
      return { configured: dbxReady(env), connected: !!conn, name: conn?.name ?? null, email: conn?.email ?? null, connectPage: `${url.origin}/dropbox`, redirectUri: dbxRedirect(url.origin) };
    }
    case 'save_photo': {
      const folder = str('folder') || '', name = str('name') || '';
      if (!folder.startsWith('/') || !name) throw new Error('A photo needs a Dropbox folder (starting with /) and a file name.');
      if (!/\.(jpe?g|png|heic|heif|webp)$/i.test(name)) throw new Error('Only photos (jpg, png, heic, webp) can be saved this way.');
      const bytes = new Uint8Array(b64ToBytes(str('data') || ''));
      if (!bytes.length) throw new Error('The photo came through empty.');
      if (bytes.length > 15e6) throw new Error('That photo is over 15 MB.');
      return await dbxUpload(env, folder, name, bytes);
    }
    case 'qb_items': return { items: await listItems(env) };
    case 'qb_settings': {
      const st = await getQbSettings(env);
      if (str('item_id') !== undefined) { st.itemId = str('item_id'); st.itemName = str('item_name'); }
      if (typeof a.auto_deposit === 'boolean') st.autoDeposit = a.auto_deposit;
      if (typeof a.email === 'boolean') st.email = a.email;
      await putQbSettings(env, st);
      return { settings: st };
    }
    case 'create_invoice': {
      const j = await getJob(env, String(a.job_id || ''));
      if (!j) throw new Error('No portal page for that job yet.');
      const kind = (str('kind') as QbInvoice['kind']) || 'deposit';
      // Change orders are billed on their own when approved; the final invoice is the contract total less earlier contract invoices
      const before = (j.invoices ?? []).filter((i) => i.kind !== 'change').reduce((t, i) => t + i.amount, 0);
      const t = signedTotals(j);
      const amount = typeof a.amount === 'number' ? a.amount : kind === 'deposit' ? t.deposit : kind === 'final' ? t.total - before : 0;
      const description = str('description') || (kind === 'deposit' ? depositLine(j) : kind === 'final' ? `Final payment on ${j.project}: project total $${t.total.toLocaleString('en-US')} less $${before.toLocaleString('en-US')} invoiced before.` : `Change order on ${j.project}.`);
      const inv = await makeInvoice(env, j, kind, amount, description);
      j.invoices = [...(j.invoices ?? []), inv];
      if (kind === 'deposit') j.invoiceError = undefined;
      await putJob(env, j);
      return status(j, url);
    }
    case 'record_payment': {
      const j = await getJob(env, String(a.job_id || ''));
      const inv = j?.invoices?.find((i) => i.id === str('invoice_id'));
      if (!j || !inv) throw new Error('That invoice isn’t on this job.');
      await recordPayment(env, j, inv, (str('method') as 'check' | 'cash' | 'other') || 'check', Number(a.amount), str('ref'));
      await putJob(env, j);
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

/** The plain-language parts of a proposal as sent, kept to plain text and numbers. */
function cleanSummary(a: Record<string, unknown>): Pick<Job['proposal'], 'summary' | 'sections' | 'options'> {
  const str = (v: unknown, n = 400) => String(v ?? '').slice(0, n);
  const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const arr = (v: unknown) => (Array.isArray(v) ? v : []) as Record<string, unknown>[];
  const sm = (a.summary ?? null) as Record<string, unknown> | null;
  const out: Pick<Job['proposal'], 'summary' | 'sections' | 'options'> = {};
  if (sm) out.summary = {
    areas: arr(sm.areas).slice(0, 30).map((x) => ({ title: str(x.title, 80), items: arr(x.items).slice(0, 60).map((i) => str(i)) })),
    materials: arr(sm.materials).slice(0, 20).map((x) => ({ label: str(x.label, 60), value: str(x.value, 200) })),
  };
  if (Array.isArray(a.sections)) out.sections = arr(a.sections).slice(0, 20).map((x) => ({ label: str(x.label, 80), price: num(x.price) }));
  if (Array.isArray(a.options)) out.options = arr(a.options).slice(0, 12).map((x) => ({ id: str(x.id, 40).replace(/[^a-z0-9-]/g, '') || 'option', label: str(x.label, 80), price: num(x.price), items: arr(x.items).slice(0, 30).map((i) => str(i)) }));
  return out;
}
