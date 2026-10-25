// The pages a client sees from their private link: a phone-first project page (renderings,
// proposal, terms, licenses and insurance, about the shop, and signing), and the signed agreement
// as one printable document with the Notice of Cancellation attached twice (one to keep, one to send).
import type { Job, Shop } from './store';
import { canCancel, cancelDeadline, easternYmd, longDate, noticeOfCancellation } from './cancel';
import { LOGO } from '../../src/drawings/logo';

export const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const money = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;
const paras = (text: string) => text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
export const clientName = (j: Job) => [j.client.first, j.client.last].filter(Boolean).join(' ') || 'there';

const noticeCss = `.notice{border:1px solid #999;padding:14px;margin:18px 0;font-size:13px;break-inside:avoid}.notice h3{text-align:center;margin:0 0 8px}.sigline{margin-top:28px}.muted{color:#646b73}`;
const css = `:root{--ink:#1f2328;--muted:#646b73;--line:#e3e0da;--bg:#f7f5f1;--card:#fff;--accent:#2b4a3c;--accent-ink:#fff;--warn:#9a3412}
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

function shell(title: string, body: string, shop: Shop, who = ''): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>${esc(title)}</title><style>${css}</style></head><body>
<header class="top"><div class="in"><img src="${LOGO}" alt="CJC Custom Carpentry"><div class="who">${who}</div></div></header>
<main>${body}<footer>${shop.company.map(esc).join(' · ')}</footer></main></body></html>`;
}

/** The client's project page. */
export function projectPage(j: Job, shop: Shop, token: string, flash = ''): string {
  const base = `/p/${token}`;
  const s = j.signature;
  const shots = j.renderings.length
    ? `<section class="card"><h2>Your design</h2><div class="gallery">${j.renderings.map((r) => `<a href="${base}/img/${esc(r.id)}" target="_blank" rel="noopener"><img src="${base}/img/${esc(r.id)}" alt="${esc(r.name)}" loading="lazy"></a>`).join('')}</div><p class="muted">Renderings show the look of the work; the signed scope and the shop drawings that follow set the details.</p></section>`
    : '';
  const docs = shop.docs.filter((d) => d.kind !== 'terms');
  const termsDoc = shop.docs.find((d) => d.kind === 'terms');
  const signBlock = j.cancelled
    ? `<div class="warn">This agreement was cancelled on ${esc(longDate(easternYmd(j.cancelled.at)))}. Any deposit paid will be returned within 10 business days.</div>`
    : s
      ? `<div class="ok">Signed by <b>${esc(s.name)}</b> on ${esc(longDate(easternYmd(s.at)))}. Thank you!</div>
<div class="row"><a class="btn" href="${base}/agreement" target="_blank" rel="noopener">Your signed agreement</a></div>
${canCancel(s.at) ? `<details class="noprint"><summary>Changed your mind?</summary><p>You can cancel without penalty until midnight on ${esc(longDate(cancelDeadline(easternYmd(s.at))))}. The Notice of Cancellation is at the end of your signed agreement, or use this:</p>
<form method="post" action="${base}/cancel" onsubmit="return confirm('Cancel this agreement?')"><input type="text" name="name" placeholder="Type your full name to cancel" required><div class="row"><button class="btn ghost">Cancel the agreement</button></div></form></details>` : ''}`
      : `<p>Read the scope, price and terms above. When you’re ready, sign below; your signed copy, with your Notice of Cancellation, opens right away to save or print.</p>
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
f.addEventListener('submit',()=>{document.getElementById('image').value=c.toDataURL('image/png');go.disabled=true;go.textContent='Signing…'});})();</script>`;
  const body = `${flash ? `<p class="ok">${esc(flash)}</p>` : ''}
<h1>${esc(j.project)}</h1><p class="muted">Prepared for ${esc(clientName(j))}${j.client.address ? ` · ${esc(j.client.address)}` : ''}</p>
${shots}
<section class="card"><h2>Your proposal</h2>
<div class="price"><div><span class="muted">Total project investment</span><b>${money(j.proposal.total)}</b></div><div><span class="muted">Deposit at signing (30%)</span><b>${money(j.proposal.deposit)}</b></div></div>
<iframe class="doc" title="Project scope and purchase agreement" sandbox srcdoc="${esc(j.proposal.agreementHtml)}"></iframe>
<p class="row"><a href="${base}/agreement" target="_blank" rel="noopener">Open the full agreement to print or save</a></p></section>
<section class="card"><h2>Terms and conditions</h2>${shop.terms ? `<details><summary>Read the terms</summary>${paras(shop.terms)}</details>` : '<p class="muted">Terms are attached to the agreement.</p>'}${termsDoc ? `<p><a href="${base}/doc/${esc(termsDoc.id)}" target="_blank" rel="noopener">${esc(termsDoc.title)} (PDF)</a></p>` : ''}</section>
${docs.length ? `<section class="card"><h2>Licenses and insurance</h2><ul class="docs">${docs.map((d) => `<li><a href="${base}/doc/${esc(d.id)}" target="_blank" rel="noopener">${esc(d.title)}</a>${d.expires ? `<span class="muted">valid through ${esc(new Date(`${d.expires}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }))}</span>` : ''}</li>`).join('')}</ul></section>` : ''}
${shop.about ? `<section class="card"><h2>About CJC Custom Carpentry</h2>${paras(shop.about)}</section>` : ''}
<section class="card" id="signing"><h2>${s ? 'Signed' : 'Sign the agreement'}</h2>${signBlock}</section>`;
  return shell(`${j.project} · CJC Custom Carpentry`, body, shop, esc(clientName(j)));
}

/** The agreement as one printable document; once signed, with the signature and two Notices of Cancellation. */
export function agreementPage(j: Job, shop: Shop): string {
  const html = j.proposal.agreementHtml;
  const style = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/i)?.[1] ?? '').replace(/body\s*\{[^}]*\}/, '');
  const inner = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
  const s = j.signature;
  const seller = shop.company[0] || 'CJC Custom Carpentry LLC';
  const address = shop.company[1] || '';
  const signed = s
    ? `<section style="page-break-before:always"><h2>Electronic signature</h2>
<p>Signed by <b>${esc(s.name)}</b> on ${esc(new Date(s.at).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'long', timeStyle: 'short' }))} (Eastern), from ${esc(s.ip)}.</p>
<p><img src="${esc(s.image)}" alt="Signature of ${esc(s.name)}" style="max-width:360px;border-bottom:1px solid #111"></p>
<p class="muted" style="font-size:12px">The signer agreed to sign electronically and confirmed reading the Project Scope of Work, Purchase Agreement and Terms and Conditions. Document fingerprint (SHA-256) ${esc(s.hash.slice(0, 32))}, version ${s.version}.</p>
${noticeOfCancellation(easternYmd(s.at), seller, address)}${noticeOfCancellation(easternYmd(s.at), seller, address)}</section>`
    : '<p class="muted">Not signed yet.</p>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>${esc(j.project)} agreement</title><style>body{font:11pt/1.45 Georgia,serif;max-width:7.5in;margin:.5in auto;padding:0 16px;color:#111}${style}${noticeCss}
.terms p{font-size:10pt}</style></head><body>${inner}
${shop.terms ? `<section class="terms" style="page-break-before:always"><h2>Terms and Conditions</h2>${paras(shop.terms)}</section>` : ''}
${signed}</body></html>`;
}

export const simplePage = (title: string, text: string, shop: Shop) => shell(title, `<h1>${esc(title)}</h1><p>${esc(text)}</p>`, shop);
