// portal/src/store.ts
var emptyShop = { company: [], about: "", terms: "", docs: [] };
async function getShop(env) {
  return { ...emptyShop, ...await env.PORTAL.get("shop", "json") };
}
var putShop = (env, s) => env.PORTAL.put("shop", JSON.stringify(s));
var getJob = async (env, jobId) => await env.PORTAL.get(`job:${jobId}`, "json");
var putJob = (env, j) => env.PORTAL.put(`job:${j.jobId}`, JSON.stringify(j));
async function jobByToken(env, token) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const id = await env.PORTAL.get(`tok:${token}`, "json");
  return id ? getJob(env, id) : null;
}
function randomToken(bytes = 18) {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function sha256(text) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function b64ToBytes(b64) {
  const bin = atob(b64.replace(/^data:[^,]+,/, ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

// portal/src/cancel.ts
var nth = (y, m, weekday, n) => {
  const d = new Date(Date.UTC(y, m, 1));
  const shift = (weekday - d.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(y, m, 1 + shift + 7 * (n - 1)));
};
var last = (y, m, weekday) => {
  const d = new Date(Date.UTC(y, m + 1, 0));
  return new Date(Date.UTC(y, m, d.getUTCDate() - (d.getUTCDay() - weekday + 7) % 7));
};
var fixed = (y, m, day) => {
  const d = new Date(Date.UTC(y, m, day));
  const wd = d.getUTCDay();
  return wd === 0 ? [new Date(Date.UTC(y, m, day + 1))] : wd === 6 ? [d, new Date(Date.UTC(y, m, day - 1))] : [d];
};
function holidays(y) {
  return [
    ...fixed(y, 0, 1),
    nth(y, 0, 1, 3),
    nth(y, 1, 1, 3),
    nth(y, 3, 1, 3),
    last(y, 4, 1),
    ...fixed(y, 5, 19),
    ...fixed(y, 6, 4),
    nth(y, 8, 1, 1),
    nth(y, 9, 1, 2),
    ...fixed(y, 10, 11),
    nth(y, 10, 4, 4),
    ...fixed(y, 11, 25)
  ].map((d) => d.toISOString().slice(0, 10));
}
function cancelDeadline(signedYmd) {
  const [y, m, d] = signedYmd.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d));
  let count = 0;
  while (count < 3) {
    day.setUTCDate(day.getUTCDate() + 1);
    const ymd = day.toISOString().slice(0, 10);
    if (day.getUTCDay() !== 0 && !holidays(day.getUTCFullYear()).includes(ymd)) count++;
  }
  return day.toISOString().slice(0, 10);
}
var easternYmd = (t) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(t));
var longDate = (ymd) => (/* @__PURE__ */ new Date(`${ymd}T12:00:00Z`)).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
var canCancel = (signedAt, now = Date.now()) => easternYmd(now) <= cancelDeadline(easternYmd(signedAt));
function noticeOfCancellation(signedYmd, seller, address) {
  const deadline = longDate(cancelDeadline(signedYmd));
  return `<section class="notice"><h3>NOTICE OF CANCELLATION</h3>
<p><b>${longDate(signedYmd)}</b><br><span class="muted">(date of transaction)</span></p>
<p>YOU MAY CANCEL THIS TRANSACTION, WITHOUT ANY PENALTY OR OBLIGATION, WITHIN THREE BUSINESS DAYS FROM THE ABOVE DATE.</p>
<p>IF YOU CANCEL, ANY PROPERTY TRADED IN, ANY PAYMENTS MADE BY YOU UNDER THE CONTRACT OR SALE, AND ANY NEGOTIABLE INSTRUMENT EXECUTED BY YOU WILL BE RETURNED WITHIN 10 BUSINESS DAYS FOLLOWING RECEIPT BY THE SELLER OF YOUR CANCELLATION NOTICE, AND ANY SECURITY INTEREST ARISING OUT OF THE TRANSACTION WILL BE CANCELLED.</p>
<p>IF YOU CANCEL, YOU MUST MAKE AVAILABLE TO THE SELLER AT YOUR RESIDENCE, IN SUBSTANTIALLY AS GOOD CONDITION AS WHEN RECEIVED, ANY GOODS DELIVERED TO YOU UNDER THIS CONTRACT OR SALE, OR YOU MAY, IF YOU WISH, COMPLY WITH THE INSTRUCTIONS OF THE SELLER REGARDING THE RETURN SHIPMENT OF THE GOODS AT THE SELLER'S EXPENSE AND RISK.</p>
<p>IF YOU DO MAKE THE GOODS AVAILABLE TO THE SELLER AND THE SELLER DOES NOT PICK THEM UP WITHIN 20 DAYS OF THE DATE OF YOUR NOTICE OF CANCELLATION, YOU MAY RETAIN OR DISPOSE OF THE GOODS WITHOUT ANY FURTHER OBLIGATION. IF YOU FAIL TO MAKE THE GOODS AVAILABLE TO THE SELLER, OR IF YOU AGREE TO RETURN THE GOODS TO THE SELLER AND FAIL TO DO SO, THEN YOU REMAIN LIABLE FOR PERFORMANCE OF ALL OBLIGATIONS UNDER THE CONTRACT.</p>
<p>TO CANCEL THIS TRANSACTION, MAIL OR DELIVER A SIGNED AND DATED COPY OF THIS CANCELLATION NOTICE, OR ANY OTHER WRITTEN NOTICE, TO <b>${seller.toUpperCase()}</b>, AT <b>${address.toUpperCase()}</b>, NOT LATER THAN MIDNIGHT OF <b>${deadline.toUpperCase()}</b>. YOU MAY ALSO USE THE CANCEL BUTTON ON YOUR PROJECT PAGE BEFORE THEN.</p>
<p>I HEREBY CANCEL THIS TRANSACTION.</p>
<p class="sigline">(Date) ____________________ &nbsp; (Buyer's signature) ______________________________</p></section>`;
}

// src/drawings/logo.ts
var LOGO = "data:image/png;base64,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";

// portal/src/pages.ts
var esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
var money = (v) => `$${Math.round(v).toLocaleString("en-US")}`;
var paras = (text) => text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
var clientName = (j) => [j.client.first, j.client.last].filter(Boolean).join(" ") || "there";
var noticeCss = `.notice{border:1px solid #999;padding:14px;margin:18px 0;font-size:13px;break-inside:avoid}.notice h3{text-align:center;margin:0 0 8px}.sigline{margin-top:28px}.muted{color:#646b73}`;
var css = `:root{--ink:#1f2328;--muted:#646b73;--line:#e3e0da;--bg:#f7f5f1;--card:#fff;--accent:#2b4a3c;--accent-ink:#fff;--warn:#9a3412}
*{box-sizing:border-box}body{margin:0;font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;color:var(--ink);background:var(--bg)}
main{max-width:760px;margin:0 auto;padding:0 16px 48px}header.top{background:var(--card);border-bottom:1px solid var(--line)}
header.top .in{max-width:760px;margin:0 auto;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px}
header.top img{height:40px}header.top .who{font-size:13px;color:var(--muted);text-align:right}
h1{font-size:26px;line-height:1.2;margin:28px 0 4px}h2{font-size:19px;margin:0 0 10px}.muted{color:var(--muted)}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px;margin:16px 0}
.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}.gallery a{display:block;border-radius:8px;overflow:hidden;background:#ddd}
.gallery img{width:100%;display:block;aspect-ratio:4/3;object-fit:cover}
.price{display:flex;gap:24px;flex-wrap:wrap;margin:6px 0 12px}.price div{min-width:140px}.price b{display:block;font-size:24px}
iframe.doc{width:100%;height:70vh;border:1px solid var(--line);border-radius:8px;background:#fff}
details{border-top:1px solid var(--line);padding:10px 0}details:first-of-type{border-top:0}summary{cursor:pointer;font-weight:600}
ul.docs{list-style:none;padding:0;margin:0}ul.docs li{padding:10px 0;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:10px}ul.docs li:first-child{border-top:0}
a{color:var(--accent)}.btn{display:inline-block;padding:11px 18px;border-radius:8px;border:1px solid var(--accent);background:var(--accent);color:var(--accent-ink);font:inherit;font-weight:600;text-decoration:none;cursor:pointer}
.btn.ghost{background:transparent;color:var(--accent)}.btn:disabled{opacity:.5;cursor:default}
label.chk{display:flex;gap:10px;align-items:flex-start;margin:10px 0}label.chk input{margin-top:5px;width:18px;height:18px;flex:none}
input[type=text]{width:100%;padding:11px;font:inherit;border:1px solid #c9c4ba;border-radius:8px}
canvas.pad{width:100%;height:160px;border:1px dashed #a9a296;border-radius:8px;background:#fffdf8;touch-action:none;display:block}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:12px}.ok{color:#14532d;background:#ecfdf3;border:1px solid #bbf7d0;border-radius:10px;padding:12px 14px}
.warn{color:var(--warn)}${noticeCss}footer{font-size:13px;color:var(--muted);text-align:center;margin-top:28px}
@media print{body{background:#fff}header.top,.noprint{display:none}main{max-width:none;padding:0}.card{border:0;padding:0}}`;
function shell(title, body, shop, who = "") {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>${esc(title)}</title><style>${css}</style></head><body>
<header class="top"><div class="in"><img src="${LOGO}" alt="CJC Custom Carpentry"><div class="who">${who}</div></div></header>
<main>${body}<footer>${shop.company.map(esc).join(" \xB7 ")}</footer></main></body></html>`;
}
function projectPage(j, shop, token, flash = "") {
  const base = `/p/${token}`;
  const s = j.signature;
  const shots = j.renderings.length ? `<section class="card"><h2>Your design</h2><div class="gallery">${j.renderings.map((r) => `<a href="${base}/img/${esc(r.id)}" target="_blank" rel="noopener"><img src="${base}/img/${esc(r.id)}" alt="${esc(r.name)}" loading="lazy"></a>`).join("")}</div><p class="muted">Renderings show the look of the work; the signed scope and the shop drawings that follow set the details.</p></section>` : "";
  const docs = shop.docs.filter((d) => d.kind !== "terms");
  const termsDoc = shop.docs.find((d) => d.kind === "terms");
  const signBlock = j.cancelled ? `<div class="warn">This agreement was cancelled on ${esc(longDate(easternYmd(j.cancelled.at)))}. Any deposit paid will be returned within 10 business days.</div>` : s ? `<div class="ok">Signed by <b>${esc(s.name)}</b> on ${esc(longDate(easternYmd(s.at)))}. Thank you!</div>
<div class="row"><a class="btn" href="${base}/agreement" target="_blank" rel="noopener">Your signed agreement</a></div>
${canCancel(s.at) ? `<details class="noprint"><summary>Changed your mind?</summary><p>You can cancel without penalty until midnight on ${esc(longDate(cancelDeadline(easternYmd(s.at))))}. The Notice of Cancellation is at the end of your signed agreement, or use this:</p>
<form method="post" action="${base}/cancel" onsubmit="return confirm('Cancel this agreement?')"><input type="text" name="name" placeholder="Type your full name to cancel" required><div class="row"><button class="btn ghost">Cancel the agreement</button></div></form></details>` : ""}` : `<p>Read the scope, price and terms above. When you\u2019re ready, sign below; your signed copy, with your Notice of Cancellation, opens right away to save or print.</p>
<form id="sign" method="post" action="${base}/sign">
<label class="chk"><input type="checkbox" name="consent" required> <span>I agree to sign and receive this agreement electronically. I can save or print it, and I can ask CJC Custom Carpentry for a paper copy at any time.</span></label>
<label class="chk"><input type="checkbox" name="agree" required> <span>I have read the Project Scope of Work, the Purchase Agreement and the Terms and Conditions, and I agree to them.</span></label>
<p><input type="text" name="name" placeholder="Your full name" autocomplete="name" required></p>
<p class="muted" style="margin:0 0 6px">Sign with your finger or mouse:</p>
<canvas class="pad" id="pad"></canvas><input type="hidden" name="image" id="image">
<div class="row"><button class="btn" id="go" disabled>Sign the agreement</button><button type="button" class="btn ghost" id="clear">Clear</button></div>
</form>
<script>(()=>{const c=document.getElementById('pad'),x=c.getContext('2d');let drawn=false,down=false;
const fit=()=>{const r=c.getBoundingClientRect(),k=devicePixelRatio||1;c.width=r.width*k;c.height=r.height*k;x.scale(k,k);x.lineWidth=2.2;x.lineCap='round';x.strokeStyle='#111'};fit();
const p=e=>{const r=c.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]};
const go=document.getElementById('go'),f=document.getElementById('sign');const ready=()=>{go.disabled=!(drawn&&f.checkValidity())};f.addEventListener('input',ready);f.addEventListener('change',ready);
c.addEventListener('pointerdown',e=>{down=true;c.setPointerCapture(e.pointerId);x.beginPath();x.moveTo(...p(e))});
c.addEventListener('pointermove',e=>{if(!down)return;x.lineTo(...p(e));x.stroke();drawn=true});
c.addEventListener('pointerup',()=>{down=false;ready()});
document.getElementById('clear').onclick=()=>{x.clearRect(0,0,c.width,c.height);drawn=false;ready()};
f.addEventListener('submit',()=>{document.getElementById('image').value=c.toDataURL('image/png');go.disabled=true;go.textContent='Signing\u2026'});})();</script>`;
  const body = `${flash ? `<p class="ok">${esc(flash)}</p>` : ""}
<h1>${esc(j.project)}</h1><p class="muted">Prepared for ${esc(clientName(j))}${j.client.address ? ` \xB7 ${esc(j.client.address)}` : ""}</p>
${shots}
<section class="card"><h2>Your proposal</h2>
<div class="price"><div><span class="muted">Total project investment</span><b>${money(j.proposal.total)}</b></div><div><span class="muted">Deposit at signing (30%)</span><b>${money(j.proposal.deposit)}</b></div></div>
<iframe class="doc" title="Project scope and purchase agreement" sandbox srcdoc="${esc(j.proposal.agreementHtml)}"></iframe>
<p class="row"><a href="${base}/agreement" target="_blank" rel="noopener">Open the full agreement to print or save</a></p></section>
<section class="card"><h2>Terms and conditions</h2>${shop.terms ? `<details><summary>Read the terms</summary>${paras(shop.terms)}</details>` : '<p class="muted">Terms are attached to the agreement.</p>'}${termsDoc ? `<p><a href="${base}/doc/${esc(termsDoc.id)}" target="_blank" rel="noopener">${esc(termsDoc.title)} (PDF)</a></p>` : ""}</section>
${docs.length ? `<section class="card"><h2>Licenses and insurance</h2><ul class="docs">${docs.map((d) => `<li><a href="${base}/doc/${esc(d.id)}" target="_blank" rel="noopener">${esc(d.title)}</a>${d.expires ? `<span class="muted">valid through ${esc((/* @__PURE__ */ new Date(`${d.expires}T12:00:00Z`)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }))}</span>` : ""}</li>`).join("")}</ul></section>` : ""}
${shop.about ? `<section class="card"><h2>About CJC Custom Carpentry</h2>${paras(shop.about)}</section>` : ""}
<section class="card" id="signing"><h2>${s ? "Signed" : "Sign the agreement"}</h2>${signBlock}</section>`;
  return shell(`${j.project} \xB7 CJC Custom Carpentry`, body, shop, esc(clientName(j)));
}
function agreementPage(j, shop) {
  const html2 = j.proposal.agreementHtml;
  const style = (html2.match(/<style[^>]*>([\s\S]*?)<\/style>/i)?.[1] ?? "").replace(/body\s*\{[^}]*\}/, "");
  const inner = html2.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html2;
  const s = j.signature;
  const seller = shop.company[0] || "CJC Custom Carpentry LLC";
  const address = shop.company[1] || "";
  const signed = s ? `<section style="page-break-before:always"><h2>Electronic signature</h2>
<p>Signed by <b>${esc(s.name)}</b> on ${esc(new Date(s.at).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "long", timeStyle: "short" }))} (Eastern), from ${esc(s.ip)}.</p>
<p><img src="${esc(s.image)}" alt="Signature of ${esc(s.name)}" style="max-width:360px;border-bottom:1px solid #111"></p>
<p class="muted" style="font-size:12px">The signer agreed to sign electronically and confirmed reading the Project Scope of Work, Purchase Agreement and Terms and Conditions. Document fingerprint (SHA-256) ${esc(s.hash.slice(0, 32))}, version ${s.version}.</p>
${noticeOfCancellation(easternYmd(s.at), seller, address)}${noticeOfCancellation(easternYmd(s.at), seller, address)}</section>` : '<p class="muted">Not signed yet.</p>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>${esc(j.project)} agreement</title><style>body{font:11pt/1.45 Georgia,serif;max-width:7.5in;margin:.5in auto;padding:0 16px;color:#111}${style}${noticeCss}
.terms p{font-size:10pt}</style></head><body>${inner}
${shop.terms ? `<section class="terms" style="page-break-before:always"><h2>Terms and Conditions</h2>${paras(shop.terms)}</section>` : ""}
${signed}</body></html>`;
}
var simplePage = (title, text, shop) => shell(title, `<h1>${esc(title)}</h1><p>${esc(text)}</p>`, shop);

// portal/src/worker.ts
var html = (body, status2 = 200) => new Response(body, { status: status2, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex", "referrer-policy": "no-referrer" } });
var json = (body) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (!env.PORTAL) return setupPage("Almost there", "<p>The portal is running, but its storage isn\u2019t connected. In Cloudflare open this worker\u2019s <b>Settings \u2192 Bindings</b>, add a <b>KV namespace</b> binding named <code>PORTAL</code> (create a namespace called <b>cjc-portal</b> if you don\u2019t have one), then reload this page.</p>");
    const m = path.match(/^\/p\/([A-Za-z0-9_-]+)(?:\/(img|doc)\/([A-Za-z0-9_-]+)|\/(agreement|sign|cancel))?$/);
    if (m) return client(request, env, m[1], m[2] ?? m[4] ?? "", m[3] ?? "");
    const key = String(env.SHOP_KEY || "").trim();
    if (path === "/" || path === "/setup") return setup(request, url, key);
    const code = key ? await shopCode(key) : "";
    let p = path;
    try {
      p = decodeURIComponent(p);
    } catch {
    }
    if (!code || p !== `/${code}`) return new Response("Not found", { status: 404 });
    if (request.method === "GET") return new Response("CJC client portal connector is running.\n", { headers: { "content-type": "text/plain" } });
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
    let msg;
    try {
      msg = await request.json();
    } catch {
      return json(rpcErr(null, -32700, "Parse error"));
    }
    if (Array.isArray(msg)) {
      const out = (await Promise.all(msg.map((x) => rpc(x, env, url)))).filter(Boolean);
      return out.length ? json(out) : new Response(null, { status: 202 });
    }
    const res = await rpc(msg, env, url);
    return res ? json(res) : new Response(null, { status: 202 });
  }
};
async function client(request, env, token, what, id) {
  const job = await jobByToken(env, token);
  const shop = await getShop(env);
  if (!job) return html(simplePage("Link not found", "This project link isn\u2019t active. Contact CJC Custom Carpentry for a new one.", shop), 404);
  if (what === "img" || what === "doc") {
    const key = what === "img" ? `img:${job.jobId}:${id}` : `doc:${id}`;
    const known = what === "img" ? job.renderings.some((r) => r.id === id) : shop.docs.some((d) => d.id === id);
    const got = known ? await env.PORTAL.getWithMetadata(key, "arrayBuffer") : { value: null, metadata: null };
    if (!got.value) return new Response("Not found", { status: 404 });
    const meta = got.metadata ?? {};
    return new Response(got.value, { headers: { "content-type": meta.mimeType || "application/octet-stream", "cache-control": "private, max-age=3600", "x-robots-tag": "noindex" } });
  }
  if (what === "agreement") return html(agreementPage(job, shop));
  const ip = request.headers.get("cf-connecting-ip") || "";
  if (what === "sign" && request.method === "POST") {
    if (job.signature || job.cancelled) return Response.redirect(new URL(`/p/${token}`, request.url).href, 303);
    const f = await request.formData();
    const name = String(f.get("name") || "").trim().slice(0, 120);
    const image = String(f.get("image") || "");
    if (!name || f.get("consent") !== "on" || f.get("agree") !== "on" || !/^data:image\/png;base64,/.test(image) || image.length > 4e5) {
      return html(projectPage(job, shop, token, "Please check both boxes, type your name and sign in the box."), 400);
    }
    job.signature = { name, image, at: Date.now(), ip, ua: (request.headers.get("user-agent") || "").slice(0, 200), hash: job.proposal.hash, version: job.proposal.version, consent: true };
    await putJob(env, job);
    return Response.redirect(new URL(`/p/${token}/agreement`, request.url).href, 303);
  }
  if (what === "cancel" && request.method === "POST") {
    const s = job.signature;
    if (s && !job.cancelled && canCancel(s.at)) {
      const f = await request.formData();
      if (String(f.get("name") || "").trim()) {
        job.cancelled = { at: Date.now(), ip };
        await putJob(env, job);
      }
    }
    return Response.redirect(new URL(`/p/${token}`, request.url).href, 303);
  }
  job.views = [...job.views ?? [], Date.now()].slice(-50);
  await putJob(env, job);
  return html(projectPage(job, shop, token));
}
async function setup(request, url, key) {
  if (!key) {
    const suggestion = randomToken(24);
    return setupPage("Almost there", `<p>Storage is connected. Now add a <b>Secret</b> named <code>SHOP_KEY</code> in this worker\u2019s <b>Settings \u2192 Variables and Secrets</b>. Make up a long password, or use this one (copy it somewhere safe first):</p><input readonly value="${suggestion}" onclick="this.select()"><p>Save and deploy, then reload this page.</p>`);
  }
  if (request.method === "POST") {
    const pasted = String((await request.formData()).get("key") || "").trim();
    if (pasted && await shopCode(pasted) === await shopCode(key)) {
      const address = `${url.origin}/${await shopCode(key)}`;
      return setupPage("Your connector address", `<p>In claude.ai go to <b>Settings \u2192 Connectors \u2192 Add custom connector</b>, name it <b>CJC Portal</b> and paste this address:</p><input readonly value="${address}" onclick="this.select()"><p><button onclick="navigator.clipboard.writeText('${address}');this.textContent='Copied'">Copy</button></p><p class="note">Keep it private: it can publish and read your client pages.</p>`);
    }
    return setupPage("That key doesn\u2019t match", "<p>Paste the same SHOP_KEY you saved in Cloudflare.</p>" + keyForm());
  }
  return setupPage("CJC client portal is running", "<p>Storage: <b>connected</b>. SHOP_KEY: <b>saved</b>. Paste the same SHOP_KEY below to get the connector address for Cabinet Studio.</p>" + keyForm());
}
var keyForm = () => '<form method="post" action="/setup"><input name="key" type="password" placeholder="SHOP_KEY" autocomplete="off" required><button>Get the connector address</button></form>';
async function shopCode(key) {
  return (await sha256(`cjc-portal-connector:${key}`)).slice(0, 40);
}
function setupPage(title, body) {
  return html(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title>
<style>body{font:16px/1.5 -apple-system,system-ui,sans-serif;max-width:560px;margin:10vh auto;padding:0 16px;color:#1d2127;background:#fbfbfc}input{width:100%;box-sizing:border-box;padding:10px;font:inherit;border:1px solid #c9ced6;border-radius:6px;margin:6px 0}button{padding:9px 16px;font:inherit;border:0;border-radius:6px;background:#2b4a3c;color:#fff;cursor:pointer}.note{color:#646d78;font-size:14px}code{background:#eef0f2;padding:1px 4px;border-radius:4px}</style>
</head><body><h1>${title}</h1>${body}</body></html>`);
}
var TOOLS = [
  { name: "get_shop", description: "The portal\u2019s shop profile: company lines, about blurb, terms, and the documents (licenses, insurance) with their expiration dates.", inputSchema: { type: "object", properties: {} } },
  {
    name: "update_shop",
    description: "Change the shop profile shown on every client page. Only the fields sent change.",
    inputSchema: { type: "object", properties: { company: { type: "array", items: { type: "string" } }, about: { type: "string" }, terms: { type: "string" }, contactEmail: { type: "string" } } }
  },
  {
    name: "upload_shop_doc",
    description: "Add or replace a shop document shown to every client (license, insurance certificate, terms PDF). Send base64 bytes, or a Dropbox temporary link; up to about 20 MB.",
    inputSchema: { type: "object", properties: { id: { type: "string", description: "Replace this document; omit for a new one." }, title: { type: "string" }, kind: { type: "string", enum: ["license", "insurance", "terms", "other"] }, mimeType: { type: "string" }, expires: { type: "string", description: "YYYY-MM-DD, for reminders." }, data: { type: "string", description: "Base64 bytes." }, source_url: { type: "string", description: "Or: a Dropbox temporary download link for the portal to fetch." } }, required: ["title", "kind"] }
  },
  { name: "delete_shop_doc", description: "Remove a shop document.", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  {
    name: "publish_proposal",
    description: "Create or update a client\u2019s project page with the proposal: the scope and purchase agreement (HTML), price, and renderings. Returns the private link. A signed proposal is not replaced unless replace_signed is true.",
    inputSchema: {
      type: "object",
      properties: {
        job_id: { type: "string" },
        project: { type: "string" },
        client: { type: "object", properties: { first: { type: "string" }, last: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, address: { type: "string" } } },
        agreement_html: { type: "string" },
        total: { type: "number" },
        deposit: { type: "number" },
        renderings: { type: "array", items: { type: "object", properties: { name: { type: "string" }, mimeType: { type: "string" }, data: { type: "string" } }, required: ["data"] } },
        keep_renderings: { type: "boolean", description: "Leave the renderings already published as they are." },
        replace_signed: { type: "boolean" }
      },
      required: ["job_id", "project", "agreement_html", "total", "deposit"]
    }
  },
  { name: "job_status", description: "Where a client\u2019s page stands: link, views, signature (who, when), cancellation and its deadline.", inputSchema: { type: "object", properties: { job_id: { type: "string" } }, required: ["job_id"] } },
  { name: "list_jobs", description: "Every job on the portal with its status.", inputSchema: { type: "object", properties: {} } }
];
var rpcOk = (id, result) => ({ jsonrpc: "2.0", id, result });
var rpcErr = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });
async function rpc(raw, env, url) {
  const { id, method, params } = raw || {};
  if (id === void 0 || id === null) return null;
  try {
    switch (method) {
      case "initialize":
        return rpcOk(id, { protocolVersion: params?.protocolVersion || "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "cjc-portal", version: "1.0.0" } });
      case "ping":
        return rpcOk(id, {});
      case "tools/list":
        return rpcOk(id, { tools: TOOLS });
      case "tools/call": {
        const out = await tool(String(params?.name), params?.arguments || {}, env, url);
        return rpcOk(id, { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out });
      }
      default:
        return rpcErr(id, -32601, `Unknown method ${method}`);
    }
  } catch (e) {
    return rpcOk(id, { isError: true, content: [{ type: "text", text: String(e?.message || e) }] });
  }
}
var status = (j, url) => ({
  job_id: j.jobId,
  project: j.project,
  url: `${url.origin}/p/${j.token}`,
  version: j.proposal.version,
  publishedAt: j.proposal.publishedAt,
  views: (j.views ?? []).length,
  lastViewed: j.views?.length ? j.views[j.views.length - 1] : null,
  signed: j.signature ? { name: j.signature.name, at: j.signature.at, version: j.signature.version, current: j.signature.hash === j.proposal.hash } : null,
  cancelDeadline: j.signature ? cancelDeadline(easternYmd(j.signature.at)) : null,
  cancelled: j.cancelled ? { at: j.cancelled.at } : null
});
async function fetchDropbox(src) {
  const u = new URL(src);
  if (u.protocol !== "https:" || !/(^|\.)dropboxusercontent\.com$/.test(u.hostname)) throw new Error("Only Dropbox download links can be fetched.");
  const res = await fetch(u.href, { redirect: "follow" });
  if (!res.ok) throw new Error(`Dropbox answered ${res.status}; the link may have expired.`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength > 24e6) throw new Error("That file is over the portal\u2019s 24 MB limit.");
  return buf;
}
async function tool(name, a, env, url) {
  const str = (k) => typeof a[k] === "string" ? a[k] : void 0;
  switch (name) {
    case "get_shop":
      return { shop: await getShop(env) };
    case "update_shop": {
      const s = await getShop(env);
      if (Array.isArray(a.company)) s.company = a.company.map(String);
      for (const k of ["about", "terms", "contactEmail"]) if (str(k) !== void 0) s[k] = str(k);
      await putShop(env, s);
      return { shop: s };
    }
    case "upload_shop_doc": {
      const s = await getShop(env);
      const bytes = str("source_url") ? await fetchDropbox(str("source_url")) : b64ToBytes(String(a.data || ""));
      if (!bytes.byteLength) throw new Error("The document is empty.");
      const id = str("id") && s.docs.some((d) => d.id === str("id")) ? str("id") : randomToken(9);
      const doc = { id, title: str("title") || "Document", kind: str("kind") || "other", mimeType: str("mimeType") || "application/pdf", size: bytes.byteLength, expires: str("expires") || void 0, uploadedAt: Date.now() };
      await env.PORTAL.put(`doc:${id}`, bytes, { metadata: { mimeType: doc.mimeType } });
      s.docs = [...s.docs.filter((d) => d.id !== id), doc];
      await putShop(env, s);
      return { doc };
    }
    case "delete_shop_doc": {
      const s = await getShop(env);
      s.docs = s.docs.filter((d) => d.id !== str("id"));
      await env.PORTAL.delete(`doc:${str("id")}`);
      await putShop(env, s);
      return { ok: true };
    }
    case "publish_proposal": {
      const jobId = String(a.job_id || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
      if (!jobId) throw new Error("job_id is needed.");
      const old = await getJob(env, jobId);
      if (old?.signature && !old.cancelled && !a.replace_signed) throw new Error("This proposal is already signed. Publish with replace_signed to put up a new version for signing.");
      const shop = await getShop(env);
      const agreementHtml = String(a.agreement_html || "");
      const version = (old?.proposal.version ?? 0) + 1;
      const hash = await sha256(`${agreementHtml}
--terms--
${shop.terms}`);
      let renderings = old?.renderings ?? [];
      if (!a.keep_renderings && Array.isArray(a.renderings)) {
        for (const r of renderings) await env.PORTAL.delete(`img:${jobId}:${r.id}`);
        renderings = [];
        for (const r of a.renderings.slice(0, 12)) {
          const rid = randomToken(9);
          await env.PORTAL.put(`img:${jobId}:${rid}`, b64ToBytes(r.data), { metadata: { mimeType: r.mimeType || "image/jpeg" } });
          renderings.push({ id: rid, name: r.name || "Rendering", mimeType: r.mimeType || "image/jpeg" });
        }
      }
      const token = old?.token ?? randomToken(18);
      const job = {
        jobId,
        token,
        client: a.client ?? old?.client ?? {},
        project: String(a.project || old?.project || "Your project"),
        stage: "proposal",
        proposal: { agreementHtml, total: Number(a.total) || 0, deposit: Number(a.deposit) || 0, publishedAt: Date.now(), version, hash },
        renderings,
        views: old?.views ?? [],
        history: old?.history ?? []
      };
      if (old?.signature) job.history.push({ ...old.signature, ...old.cancelled ? { cancelled: old.cancelled } : {} });
      await putJob(env, job);
      await env.PORTAL.put(`tok:${token}`, JSON.stringify(jobId));
      return status(job, url);
    }
    case "job_status": {
      const j = await getJob(env, String(a.job_id || ""));
      if (!j) throw new Error("No portal page for that job yet.");
      return status(j, url);
    }
    case "list_jobs": {
      const out = [];
      let cursor;
      do {
        const page = await env.PORTAL.list({ prefix: "job:", cursor });
        for (const k of page.keys) {
          const j = await env.PORTAL.get(k.name, "json");
          if (j) out.push(status(j, url));
        }
        cursor = page.list_complete ? void 0 : page.cursor;
      } while (cursor);
      return { jobs: out };
    }
    default:
      throw new Error(`Unknown tool ${name}`);
  }
}
export {
  worker_default as default
};
