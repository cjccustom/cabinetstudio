// The pages a client sees from their private link: a phone-first project page (renderings,
// proposal, terms, licenses and insurance, about the shop, and signing), and the signed agreement
// as one printable document, the Notice of Cancellation inside the terms with its dates filled in.
import { type ChangeOrder, type DrawingSheets, type Job, type PortalComment, type Shop, signedTotals, hasProposal, isDraft } from './store';
import { apptLabel, whenEastern, type Appointment } from './calendar';
import { cancelDeadline, easternYmd, longDate, noticeOfCancellation } from './cancel';
import { LOGO } from '../../src/drawings/logo';

export const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const money = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;
const paras = (text: string) => text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
/** The terms that go with this version of the proposal. */
const termsOf = (j: Job, shop: Shop) => j.proposal.terms ?? shop.terms;

/**
 * The terms as the client reads them. The Notice of Cancellation lives in the terms, with its two
 * blanks: once signed they carry the date signed and the cancellation deadline; before, what they'll be.
 * From the notice's heading on, it's set apart in a box so it prints as its own form.
 */
export function termsHtml(text: string, signedAt?: number, seller = 'CJC Custom Carpentry LLC', address = ''): string {
  const ymd = signedAt ? easternYmd(signedAt) : '';
  const filled = text
    .replace(/\[DATE OF TRANSACTION\]/gi, ymd ? longDate(ymd) : '(the date you sign)')
    .replace(/\[CANCELLATION DEADLINE\]/gi, ymd ? longDate(cancelDeadline(ymd)).toUpperCase() : '(THE THIRD BUSINESS DAY AFTER YOU SIGN)');
  const at = filled.search(/^\s*NOTICE OF CANCELLATION\s*$/m);
  // Older terms with no notice of their own: the signed copy still gets the standard, filled-in notice
  if (at < 0) return paras(filled) + (ymd ? noticeOfCancellation(ymd, seller, address) : '');
  const notice = filled.slice(at).replace(/^\s*NOTICE OF CANCELLATION\s*/, '');
  return `${paras(filled.slice(0, at))}<section class="notice"><h3>NOTICE OF CANCELLATION</h3>${paras(notice)}</section>`;
}
export const clientName = (j: Job) => [j.client.first, j.client.last].filter(Boolean).join(' ') || 'there';

const msgCss = `.tip{background:#fff7e6;border:1px solid #f0d9a8;border-radius:8px;padding:10px 12px;margin:0 0 10px}.sheet-head{display:flex;gap:8px;align-items:baseline;margin-bottom:8px}.sheet-head .big-btn{margin-left:auto}button.link{background:none;border:0;color:var(--accent);font:inherit;font-weight:600;cursor:pointer;padding:4px}.sheet-scroll{overflow:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--line);border-radius:6px}.sheet-box{position:relative}.sheet-box img{display:block;width:100%;height:auto}.sheet.big .sheet-box{width:280%}.layer{position:absolute;inset:0}.marking .layer{touch-action:none;cursor:crosshair;background:rgba(194,65,12,.06);outline:2px dashed #c2410c;outline-offset:-2px}.mk{position:absolute;border:2.5px solid #c2410c;border-radius:50%;box-sizing:border-box;display:block}.mk.shop{border-color:var(--accent)}.mk.new{border-style:dashed}.mk .n,.pin{display:inline-block;background:#c2410c;color:#fff;border-radius:50%;width:22px;height:22px;font:700 12px/22px sans-serif;text-align:center;text-decoration:none}.mk .n{position:absolute;top:-11px;left:-11px}.markform{position:fixed;left:0;right:0;bottom:0;background:#fff;border-top:1px solid var(--line);box-shadow:0 -4px 18px rgba(0,0,0,.15);padding:12px max(16px,env(safe-area-inset-left)) calc(12px + env(safe-area-inset-bottom));z-index:20}.markform textarea{min-height:80px}.msg .state{font-size:13px;color:var(--accent);margin-top:6px}.sent{margin:10px 0}details.more{margin-top:12px}details.more>summary{display:inline-block;list-style:none;cursor:pointer}details.more>summary::-webkit-details-marker{display:none}details.more[open]>summary{display:none}.msg{border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin:10px 0;background:#fff}.msg.shop{background:#eef3ef;border-color:#cfdcd3}.msg .who{font-size:13px;color:var(--muted);margin-bottom:4px}.msg p{margin:4px 0}textarea{width:100%;font:inherit;padding:10px;border:1px solid var(--line);border-radius:8px}iframe.dwgs{height:80vh}.draft-stamp{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;font:800 clamp(40px,12vw,140px)/1 system-ui,sans-serif;letter-spacing:.12em;color:rgba(194,65,12,.13);transform:rotate(-18deg)}`;
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
iframe.doc{width:100%;height:70vh;border:1px solid var(--line);border-radius:8px;background:#fff;margin-top:10px}
.design{margin:16px 0}.design .hero{display:block;border-radius:12px;overflow:hidden;background:#ddd;box-shadow:0 2px 14px rgba(0,0,0,.12)}.design .hero img{width:100%;display:block}.design .gallery{margin-top:10px}.design p{font-size:14px;margin:8px 2px 0}
h3{font-size:16px;margin:16px 0 6px}ul.items{margin:0;padding-left:20px}ul.items li{margin:5px 0}
dl.mat{margin:0;display:grid;gap:10px}dl.mat div{display:grid;grid-template-columns:170px 1fr;gap:12px;border-top:1px solid var(--line);padding-top:10px}dl.mat div:first-child{border-top:0;padding-top:0}dt{color:var(--muted)}dd{margin:0}
@media (max-width:520px){dl.mat div{grid-template-columns:1fr;gap:2px}}
table.lines{width:100%;border-collapse:collapse;margin:0 0 6px}table.lines td{padding:8px 0;border-top:1px solid var(--line)}table.lines tr:first-child td{border-top:0}table.lines .num{text-align:right;white-space:nowrap}table.lines tr.sub td{font-weight:600}
.opt{display:flex;gap:12px;align-items:flex-start;padding:12px;border:1px solid var(--line);border-radius:10px;margin:8px 0;cursor:pointer}.opt input{margin-top:4px;width:18px;height:18px}.opt span{display:flex;flex-direction:column;gap:2px;flex:1}.opt span .muted{font-size:14px}.opt .add{white-space:nowrap}
.opt:has(input:checked){border-color:var(--accent);background:#f2f6f3}details.agree{border-top:1px solid var(--line);margin-top:14px;padding-top:12px}
details{border-top:1px solid var(--line);padding:10px 0}details:first-of-type{border-top:0}summary{cursor:pointer;font-weight:600}
ul.docs{list-style:none;padding:0;margin:0}ul.docs li{padding:10px 0;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:10px}ul.docs li:first-child{border-top:0}
a{color:var(--accent)}.btn{display:inline-block;padding:11px 18px;border-radius:8px;border:1px solid var(--accent);background:var(--accent);color:var(--accent-ink);font:inherit;font-weight:600;text-decoration:none;cursor:pointer}
.btn.ghost{background:transparent;color:var(--accent)}.btn:disabled{opacity:.5;cursor:default}
label.chk{display:flex;gap:10px;align-items:flex-start;margin:10px 0}label.chk input{margin-top:5px;width:18px;height:18px;flex:none}
input[type=text]{width:100%;padding:11px;font:inherit;border:1px solid #c9c4ba;border-radius:8px}
canvas.pad{width:100%;height:160px;border:1px dashed #a9a296;border-radius:8px;background:#fffdf8;touch-action:none;display:block}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:12px}.ok{color:#14532d;background:#ecfdf3;border:1px solid #bbf7d0;border-radius:10px;padding:12px 14px}
.warn{color:var(--warn)}.pay{margin-top:14px;padding-top:12px;border-top:1px solid var(--line)}${noticeCss}${msgCss}footer{font-size:13px;color:var(--muted);text-align:center;margin-top:28px}
@media print{body{background:#fff}header.top,.noprint{display:none}main{max-width:none;padding:0}.card{border:0;padding:0}}`;

function shell(title: string, body: string, shop: Shop, who = ''): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>${esc(title)}</title><style>${css}</style></head><body>
<header class="top"><div class="in"><img src="${LOGO}" alt="CJC Custom Carpentry"><div class="who">${who}</div></div></header>
<main>${body}<footer>${shop.company.map(esc).join(' · ')}</footer></main></body></html>`;
}

/** What's owed and how to pay it: QuickBooks' own payment page for card or bank transfer, or a check. */
function payBlock(j: Job, shop: Shop): string {
  const invs = (j.invoices ?? []).filter((i) => i.amount > 0);
  if (!invs.length) return '';
  const payee = shop.company[0] || 'CJC Custom Carpentry LLC';
  const label = { deposit: 'Deposit', final: 'Final payment', change: 'Change order' } as const;
  const receipt = (i: (typeof invs)[number]) => (i.balance < i.amount ? ` <a href="/p/${j.token}/receipt/${esc(i.id)}" target="_blank" rel="noopener">Receipt</a>` : '');
  return `<div class="pay">${invs.map((i) => i.balance <= 0
    ? `<p class="ok">${label[i.kind]} of ${money(i.amount)} received. Thank you!${receipt(i)}</p>`
    : `<p><b>${label[i.kind]} due: ${money(i.balance)}</b>${i.docNumber ? ` <span class="muted">(invoice ${esc(i.docNumber)})</span>` : ''}</p>
${i.link ? `<div class="row"><a class="btn" href="${esc(i.link)}" target="_blank" rel="noopener">Pay by card or bank transfer</a></div>` : ''}
${i.balance < i.amount ? `<p class="muted">${money(i.amount - i.balance)} received so far.${receipt(i)}</p>` : ''}<p class="muted">${i.link ? 'Or pay' : 'Pay'} by check to <b>${esc(payee)}</b>${shop.company[1] ? `, ${esc(shop.company[1])}` : ''}, or in person.</p>`).join('')}</div>`;
}

/** The signing box's script: draw with a finger or mouse, and the form sends the drawing as a PNG. */
const padScript = (formId: string, busy: string) => `<script>(()=>{const c=document.getElementById('pad'),x=c.getContext('2d');let drawn=false,down=false;
const fit=()=>{const r=c.getBoundingClientRect(),k=devicePixelRatio||1;c.width=r.width*k;c.height=r.height*k;x.scale(k,k);x.lineWidth=2.2;x.lineCap='round';x.strokeStyle='#111'};fit();
const p=e=>{const r=c.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]};
const go=document.getElementById('go'),f=document.getElementById('${formId}');const ready=()=>{go.disabled=!(drawn&&f.checkValidity())};f.addEventListener('input',ready);f.addEventListener('change',ready);
c.addEventListener('pointerdown',e=>{down=true;c.setPointerCapture(e.pointerId);x.beginPath();x.moveTo(...p(e))});
c.addEventListener('pointermove',e=>{if(!down)return;x.lineTo(...p(e));x.stroke();drawn=true});
c.addEventListener('pointerup',()=>{down=false;ready()});
document.getElementById('clear').onclick=()=>{x.clearRect(0,0,c.width,c.height);drawn=false;ready()};
f.addEventListener('submit',()=>{document.getElementById('image').value=c.toDataURL('image/png');go.disabled=true;go.textContent='${busy}'});})();</script>`;

const signedMoney = (n: number) => `${n < 0 ? '−' : ''}${money(Math.abs(n))}`;
const coState = (c: ChangeOrder) => c.signature ? `Approved ${longDate(easternYmd(c.signature.at))}` : c.declined ? `Declined ${longDate(easternYmd(c.declined.at))}` : 'Waiting for your approval';

/** One change order: what changes, the price and schedule effect, and approving (signing) or declining it. */
export function changeOrderPage(j: Job, c: ChangeOrder, shop: Shop, token: string, flash = ''): string {
  const base = `/p/${token}/change/${c.id}`;
  const signedAt = j.signature!.at;
  // The total before this one counts only change orders approved before it
  const earlier = (j.changeOrders ?? []).filter((x) => x.id !== c.id && x.signature && !x.voided && (!c.signature || x.signature.at < c.signature.at)).reduce((t, x) => t + x.amount, 0);
  const before = signedTotals(j).total + earlier;
  const sched = c.hours ? `Adds about ${c.hours} hour${c.hours === 1 ? '' : 's'} of work.` : c.days == null ? '' : c.days === 0 ? 'No change to the schedule.' : c.days > 0 ? `Adds about ${c.days} working day${c.days === 1 ? '' : 's'} to the schedule.` : `Takes about ${-c.days} working day${c.days === -1 ? '' : 's'} off the schedule.`;
  const bill = c.amount <= 0 ? (c.amount < 0 ? 'The credit comes off your final payment.' : '') : c.billing === 'now' ? 'Invoiced once you approve it.' : 'Added to your final payment.';
  const payBy = j.signature?.payBy === 'check' && j.proposal.pay ? `<p class="muted">Prices are at your check or bank transfer rate, as in your agreement.</p>` : '';
  const doc = `<section class="card"><h2>Change order ${c.number}: ${esc(c.title)}</h2>
<p class="muted">A change to the agreement for ${esc(j.project)} signed ${esc(longDate(easternYmd(signedAt)))}. Issued ${esc(longDate(easternYmd(c.publishedAt)))}.</p>
<table class="lines">${c.lines.map((l) => `<tr><td>${esc(l.label)}</td><td class="num">${signedMoney(l.amount)}</td></tr>`).join('')}
<tr class="sub"><td>${c.amount < 0 ? 'Credit' : 'This change'}</td><td class="num">${signedMoney(c.amount)}</td></tr></table>
${payBy}
<div class="price"><div><span class="muted">Contract total before this change</span><b>${money(before)}</b></div><div><span class="muted">New contract total</span><b>${money(before + c.amount)}</b></div></div>
${sched ? `<p>${esc(sched)}</p>` : ''}${bill ? `<p>${esc(bill)}</p>` : ''}${c.note ? paras(c.note) : ''}
<p class="muted">Everything else in your agreement, including the Terms and Conditions, stays the same.</p></section>`;
  const open = !c.signature && !c.declined;
  const s = c.signature;
  const answer = s
    ? `<section class="card"><h2>Approved</h2><div class="ok">Approved by <b>${esc(s.name)}</b> on ${esc(new Date(s.at).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'long', timeStyle: 'short' }))} (Eastern). Thank you!</div>
<p><img src="${esc(s.image)}" alt="Signature of ${esc(s.name)}" style="max-width:320px;border-bottom:1px solid #111"></p>
<p class="muted" style="font-size:12px">Signed electronically from ${esc(s.ip)}. Change order fingerprint (SHA-256) ${esc(c.hash.slice(0, 32))}.</p>
<div class="row noprint"><button class="btn ghost" onclick="print()">Print or save</button><a class="btn ghost" href="/p/${token}">Back to your project</a></div></section>`
    : c.declined
      ? `<section class="card"><h2>Declined</h2><p class="warn">You declined this change on ${esc(longDate(easternYmd(c.declined.at)))}. The work goes ahead as in your agreement.</p>${c.declined.reason ? `<p class="muted">Your note: ${esc(c.declined.reason)}</p>` : ''}<p class="row"><a class="btn ghost" href="/p/${token}">Back to your project</a></p></section>`
      : `<section class="card" id="signing"><h2>Approve this change</h2>
<form id="cosign" method="post" action="${base}/sign">
<label class="chk"><input type="checkbox" name="consent" required> <span>I agree to sign this change order electronically. I can save or print it, and ask CJC Custom Carpentry for a paper copy at any time.</span></label>
<label class="chk"><input type="checkbox" name="agree" required> <span>I approve this change to my agreement, at the price and schedule above.</span></label>
<p><input type="text" name="name" placeholder="Your full name" autocomplete="name" required></p>
<p class="muted" style="margin:0 0 6px">Sign with your finger or mouse:</p>
<canvas class="pad" id="pad"></canvas><input type="hidden" name="image" id="image">
<div class="row"><button class="btn" id="go" disabled>Approve and sign</button><button type="button" class="btn ghost" id="clear">Clear</button></div>
</form>${padScript('cosign', 'Signing…')}
<details class="more"><summary class="btn ghost">Decline this change</summary>
<form method="post" action="${base}/decline"><p>If you decline, the work goes ahead as in your agreement.</p>
<textarea name="reason" rows="3" placeholder="Anything you’d like Cody to know (optional)"></textarea>
<div class="row"><button class="btn ghost">Decline the change</button></div></form></details></section>`;
  const body = `${flash ? `<p class="warn">${esc(flash)}</p>` : ''}<h1>${esc(j.project)}</h1><p class="muted">For ${esc(clientName(j))}${j.client.address ? ` · ${esc(j.client.address)}` : ''}${open ? '' : ` · ${esc(coState(c))}`}</p>${doc}${answer}`;
  return shell(`Change order ${c.number} · ${j.project}`, body, shop, esc(clientName(j)));
}

/** The change orders on the client's project page, with the contract total they come to. */
function changeOrdersBlock(j: Job, base: string): string {
  const list = (j.changeOrders ?? []).filter((c) => !c.voided);
  if (!list.length || !j.signature || j.cancelled) return '';
  const approved = list.filter((c) => c.signature).reduce((t, c) => t + c.amount, 0);
  const waiting = list.filter((c) => !c.signature && !c.declined).length;
  return `<section class="card" id="changes"><h2>Change orders</h2>${waiting ? `<p class="warn"><b>${waiting === 1 ? 'A change is' : `${waiting} changes are`} waiting for your approval.</b></p>` : ''}
<table class="lines">${list.map((c) => `<tr><td><a href="${base}/change/${esc(c.id)}">${c.number}. ${esc(c.title)}</a><br><span class="muted">${esc(coState(c))}</span></td><td class="num">${signedMoney(c.amount)}</td></tr>`).join('')}</table>
<div class="price"><div><span class="muted">Signed contract</span><b>${money(signedTotals(j).total)}</b></div><div><span class="muted">With approved changes</span><b>${money(signedTotals(j).total + approved)}</b></div></div>
${list.filter((c) => !c.signature && !c.declined).map((c) => `<p class="row"><a class="btn" href="${base}/change/${esc(c.id)}">Review change order ${c.number}</a></p>`).join('')}</section>`;
}

/** A receipt for money received on one invoice: each check or cash payment recorded, and anything paid online. */
export function receiptPage(j: Job, inv: NonNullable<Job['invoices']>[number], shop: Shop): string {
  const label = { deposit: 'Deposit', final: 'Final payment', change: 'Change order' } as const;
  const day = (t: number) => new Date(t).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'long', day: 'numeric', year: 'numeric' });
  const recorded = inv.payments ?? [];
  const paidHere = recorded.reduce((t, x) => t + x.amount, 0);
  const received = Math.max(0, inv.amount - inv.balance);
  const online = Math.round((received - paidHere) * 100) / 100;
  const how = (x: (typeof recorded)[number]) => (x.method === 'check' ? `Check${x.ref ? ` #${esc(x.ref)}` : ''}` : x.method === 'cash' ? 'Cash' : `Payment${x.ref ? ` (${esc(x.ref)})` : ''}`);
  const rows = [
    ...recorded.map((x) => `<tr><td>${esc(day(x.at))}</td><td>${how(x)}</td><td class="num">${money(x.amount)}</td></tr>`),
    ...(online > 0.004 ? [`<tr><td>${esc(day(inv.checkedAt))}</td><td>Paid online (card or bank transfer)</td><td class="num">${money(online)}</td></tr>`] : []),
  ].join('');
  const no = `${inv.docNumber ? `${esc(inv.docNumber)}-` : ''}${recorded.length + (online > 0.004 ? 1 : 0)}`;
  const company = shop.company.length ? shop.company : ['CJC Custom Carpentry LLC'];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>Receipt · ${esc(j.project)}</title><style>body{font:15px/1.5 system-ui,-apple-system,sans-serif;color:#1f2328;max-width:640px;margin:24px auto;padding:0 16px}h1{font-size:22px;margin:16px 0 4px}.muted{color:#646b73}table{width:100%;border-collapse:collapse;margin:14px 0}td,th{padding:8px 4px;border-bottom:1px solid #e3e0da;text-align:left}.num{text-align:right;white-space:nowrap}.tot td{font-weight:700;border-bottom:0}.head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.head img{height:56px}.btn{display:inline-block;padding:10px 16px;border-radius:8px;background:#2b4a3c;color:#fff;border:0;font:inherit;cursor:pointer}@media print{.noprint{display:none}body{margin:0}}</style></head><body>
<div class="head"><div><b>${esc(company[0])}</b>${company.slice(1).map((l) => `<br><span class="muted">${esc(l)}</span>`).join('')}</div><img src="${LOGO}" alt=""></div>
<h1>Payment receipt</h1><p class="muted">Receipt ${no} · ${esc(day(Date.now()))}</p>
<p><b>Received from</b> ${esc(clientName(j))}${j.client.address ? `<br>${esc(j.client.address)}` : ''}<br><b>For</b> ${esc(j.project)}: ${esc(label[inv.kind].toLowerCase())}${inv.docNumber ? ` (invoice ${esc(inv.docNumber)})` : ''}</p>
<table><thead><tr><th>Date</th><th>Paid by</th><th class="num">Amount</th></tr></thead><tbody>${rows}
<tr class="tot"><td></td><td>Total received</td><td class="num">${money(received)}</td></tr></tbody></table>
<p>Invoice amount ${money(inv.amount)} · ${inv.balance <= 0 ? '<b>paid in full</b>' : `balance due ${money(inv.balance)}`}</p>
<p>Thank you!</p>
<p class="noprint"><button class="btn" onclick="print()">Print or save as PDF</button></p></body></html>`;
}

/** The client's project page. */
export function projectPage(j: Job, shop: Shop, token: string, flash = '', visits: Appointment[] = [], sent = false): string {
  const base = `/p/${token}`;
  const s = j.signature;
  // The design leads: the first rendering large, the rest below it
  const [hero, ...more] = j.renderings;
  const img = (r: { id: string; name: string }, cls = '') => `<a href="${base}/img/${esc(r.id)}" target="_blank" rel="noopener"${cls ? ` class="${cls}"` : ''}><img src="${base}/img/${esc(r.id)}" alt="${esc(r.name)}"${cls ? '' : ' loading="lazy"'}></a>`;
  const shots = hero
    ? `<section class="design">${img(hero, 'hero')}${more.length ? `<div class="gallery">${more.map((r) => img(r)).join('')}</div>` : ''}<p class="muted">${isDraft(j) ? 'Renderings show the look of the work; the design draft below has the sizes.' : 'Renderings show the look of the work. Exact sizes come with the shop drawings you approve after signing.'}</p></section>`
    : '';
  // A returning client's design draft: the drawings and 3D to talk through, before (or alongside) the price
  const draftCard = isDraft(j)
    ? `<section class="card"><h2>Your design draft</h2><p>A working draft of the design for us to talk through. Nothing is final${hasProposal(j) ? '' : ', and there’s no price yet: that comes once the layout is settled'}.</p>${j.drawings ? `<p>Version ${j.drawings.version}, ${esc(longDate(easternYmd(j.drawings.publishedAt)))}.</p><p class="row"><a class="btn" href="${base}/drawings">Look over the drawings</a>${j.model ? ` <a class="btn ghost" href="${base}/model">Look around in 3D</a>` : ''}</p><p class="muted">Tap a spot on a drawing or the 3D model to tell Cody what you’d change.</p>` : '<p class="muted">The drawings will appear here shortly.</p>'}</section>`
    : '';
  // Design first, no proposal yet: the draft and a place to talk about it, nothing to sign
  if (!hasProposal(j)) {
    const body = `${flash ? `<p class="ok">${esc(flash)}</p>` : ''}
<h1>${esc(j.project)}</h1><p class="muted">Prepared for ${esc(clientName(j))}${j.client.address ? ` · ${esc(j.client.address)}` : ''}</p>
${visits.length ? `<section class="card"><h2>Coming up</h2>${visits.map((v) => `<p><b>${esc(apptLabel[v.kind])}</b> · ${esc(whenEastern(v.start))}${v.location ? `<br><span class="muted">${esc(v.location)}</span>` : ''}${v.clientNote ? `<br>${esc(v.clientNote)}` : ''}</p><p><a class="btn ghost" href="${base}/visit/${esc(v.id)}.ics">Add to my calendar</a></p>`).join('')}</section>` : ''}
${shots}${draftCard}
${shop.about ? `<section class="card"><h2>About CJC Custom Carpentry</h2>${paras(shop.about)}</section>` : ''}
${commentsBlock(j, base, 'proposal', 'Questions about the design, or something you’d like changed? Write here and Cody will answer on this page.', sent)}`;
    return shell(`${j.project} · CJC Custom Carpentry`, body, shop, esc(clientName(j)));
  }
  const pr = j.proposal;
  const build = pr.summary?.areas.length
    ? `<section class="card"><h2>What we’ll build</h2>${pr.summary.areas.map((a) => `<h3>${esc(a.title)}</h3><ul class="items">${a.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`).join('')}</section>`
    : '';
  const mats = pr.summary?.materials.length
    ? `<section class="card"><h2>Materials &amp; finishes</h2><dl class="mat">${pr.summary.materials.map((m) => `<div><dt>${esc(m.label)}</dt><dd>${esc(m.value)}</dd></div>`).join('')}</dl></section>`
    : '';
  const share = pr.total ? pr.deposit / pr.total : 0.3;
  const chosen = (pr.options ?? []).filter((o) => s?.options?.includes(o.id));
  const signedFor = s?.total != null ? { total: s.total, deposit: s.deposit ?? pr.deposit } : { total: pr.total, deposit: pr.deposit };
  const open = !s && !j.cancelled;
  const optionsBlock = pr.options?.length
    ? open
      ? `<h3>Options</h3><p class="muted" style="margin-top:0">Tick any you’d like added. The total and deposit update, and what you tick is part of what you sign.</p>${pr.options.map((o) => `<label class="opt"><input type="checkbox" name="opt_${esc(o.id)}" form="sign" data-price="${o.price}"${pr.pay?.optionCheck?.[o.id] != null ? ` data-check="${pr.pay.optionCheck[o.id]}"` : ''}><span><b>${esc(o.label)}</b>${o.items.length ? `<span class="muted">${o.items.map(esc).join('; ')}</span>` : ''}</span><b class="add">+${money(o.price)}</b></label>`).join('')}`
      : chosen.length ? `<h3>Options chosen</h3><ul class="items">${chosen.map((o) => `<li>${esc(o.label)} (+${money(o.price)})</li>`).join('')}</ul>` : ''
    : '';
  // Sections when there's more than one; with options, the base price they add to
  const rows = (pr.sections?.length ?? 0) > 1 ? pr.sections! : [];
  const lines = rows.length || pr.options?.length
    ? `<table class="lines">${rows.map((l) => `<tr><td>${esc(l.label)}</td><td class="num">${money(l.price)}</td></tr>`).join('')}${pr.options?.length ? `<tr class="sub"><td>${rows.length ? 'Before options' : 'Base price'}</td><td class="num">${money(pr.total)}</td></tr>` : ''}</table>`
    : '';
  // With a check / bank transfer discount, the listed prices are the card prices; both totals show
  const pay = pr.pay;
  const pct = pay ? `${+(pay.discount * 100).toFixed(1)}%` : '';
  const payNote = pay && open
    ? `<div class="price"><div><span class="muted">Paying by check or bank transfer (${pct} off)</span><b id="ctot">${money(pay.checkTotal)}</b></div><div><span class="muted">Deposit at signing</span><b id="cdep">${money(pay.checkDeposit)}</b></div></div>`
    : pay && s ? `<p class="muted">${s.payBy === 'check' ? `Paying by check or bank transfer (${pct} off the listed price).` : 'Paying by card, at the listed price.'}</p>` : '';
  const price = `<section class="card"><h2>Your investment</h2>${lines}${optionsBlock}
<div class="price"><div><span class="muted">Total project investment${pay && open ? ' (paying by card)' : ''}</span><b id="tot">${money(signedFor.total)}</b></div><div><span class="muted">Deposit at signing (${Math.round(share * 100)}%)</span><b id="dep">${money(signedFor.deposit)}</b></div></div>
${payNote}
${open && pr.options?.length ? `<script>(()=>{const base=${pr.total},share=${share},cbase=${pay ? pay.checkTotal : 0},cshare=${pay && pay.checkTotal ? pay.checkDeposit / pay.checkTotal : 0},d=${pay ? pay.discount : 0},f=n=>'$'+Math.round(n).toLocaleString('en-US');const go=()=>{let t=base,c=cbase;document.querySelectorAll('input[data-price]').forEach(i=>{if(i.checked){t+=+i.dataset.price;c+=+(i.dataset.check||Math.round(i.dataset.price*(1-d)))}});document.getElementById('tot').textContent=f(t);document.getElementById('dep').textContent=f(Math.round(t*share));const ct=document.getElementById('ctot');if(ct){ct.textContent=f(c);document.getElementById('cdep').textContent=f(Math.round(c*cshare))}};document.querySelectorAll('input[data-price]').forEach(i=>i.addEventListener('change',go));go()})();</script>` : ''}
<details class="agree"><summary>Read the full proposal and agreement</summary><iframe class="doc" title="Project scope and purchase agreement" sandbox srcdoc="${esc(pr.agreementHtml)}"></iframe></details>
<p class="row"><a href="${base}/agreement" target="_blank" rel="noopener">Open the full agreement to print or save</a></p></section>`;
  const docs = shop.docs.filter((d) => d.kind !== 'terms');
  const termsDoc = shop.docs.find((d) => d.kind === 'terms');
  const signBlock = j.cancelled
    ? `<div class="warn">This agreement was cancelled on ${esc(longDate(easternYmd(j.cancelled.at)))}. Any deposit paid will be returned within 10 business days.</div>`
    : s
      ? `<div class="ok">Signed by <b>${esc(s.name)}</b> on ${esc(longDate(easternYmd(s.at)))}. Thank you!</div>
<div class="row"><a class="btn" href="${base}/agreement" target="_blank" rel="noopener">Your signed agreement</a></div>
${payBlock(j, shop)}
`
      : `<p>Read the scope, price and terms above.${pr.options?.length ? ' Any options you ticked are included.' : ''} When you’re ready, sign below; your signed copy opens right away to save or print.</p>
<form id="sign" method="post" action="${base}/sign">
${pr.pay ? `<fieldset class="payby"><legend><b>How will you pay?</b></legend>
<label class="chk"><input type="radio" name="pay_by" value="check" required> <span>By check or bank transfer: ${+(pr.pay.discount * 100).toFixed(1)}% off the listed price</span></label>
<label class="chk"><input type="radio" name="pay_by" value="card" required> <span>By card, at the listed price</span></label></fieldset>` : ''}
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
${visits.length ? `<section class="card"><h2>Coming up</h2>${visits.map((v) => `<p><b>${esc(apptLabel[v.kind])}</b> · ${esc(whenEastern(v.start))}${v.location ? `<br><span class="muted">${esc(v.location)}</span>` : ''}${v.clientNote ? `<br>${esc(v.clientNote)}` : ''}</p><p><a class="btn ghost" href="${base}/visit/${esc(v.id)}.ics">Add to my calendar</a></p>`).join('')}</section>` : ''}
${shots}${draftCard}
${build}${mats}${price}
<section class="card"><h2>Terms and conditions</h2>${termsOf(j, shop) ? `<details><summary>Read the terms</summary>${termsHtml(termsOf(j, shop), j.signature?.at)}</details>` : '<p class="muted">Terms are attached to the agreement.</p>'}${termsDoc ? `<p><a href="${base}/doc/${esc(termsDoc.id)}" target="_blank" rel="noopener">${esc(termsDoc.title)} (PDF)</a></p>` : ''}</section>
${docs.length ? `<section class="card"><h2>Licenses and insurance</h2><ul class="docs">${docs.map((d) => `<li><a href="${base}/doc/${esc(d.id)}" target="_blank" rel="noopener">${esc(d.title)}</a>${d.expires ? `<span class="muted">valid through ${esc(new Date(`${d.expires}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }))}</span>` : ''}</li>`).join('')}</ul></section>` : ''}
${shop.about ? `<section class="card"><h2>About CJC Custom Carpentry</h2>${paras(shop.about)}</section>` : ''}
<section class="card" id="signing"><h2>${s ? 'Signed' : 'Sign the agreement'}</h2>${signBlock}</section>
${changeOrdersBlock(j, base)}
${s && !j.cancelled ? `<section class="card"><h2>Your drawings</h2>${j.drawings ? `<p>Version ${j.drawings.version} is ready for your review (${esc(longDate(easternYmd(j.drawings.publishedAt)))}).</p><p class="row"><a class="btn" href="${base}/drawings">Review the drawings</a>${j.model ? ` <a class="btn ghost" href="${base}/model">Look around in 3D</a>` : ''}</p>` : '<p class="muted">Your detailed drawings come next, with every size, for you to review and approve here.</p>'}</section>` : ''}
${commentsBlock(j, base, 'proposal', s ? 'Questions about your project? Write here and Cody will answer on this page.' : 'Questions about the proposal, or something you’d like changed? Write here and Cody will answer on this page.', sent)}`;
  return shell(`${j.project} · CJC Custom Carpentry`, body, shop, esc(clientName(j)));
}

/** The agreement as one printable document: scope and price, the terms (with the Notice of Cancellation in them), and once signed the signature. */
export function agreementPage(j: Job, shop: Shop): string {
  const html = j.proposal.agreementHtml;
  const style = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/i)?.[1] ?? '').replace(/body\s*\{[^}]*\}/, '');
  const inner = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
  const s = j.signature;
  const signed = s
    ? `<section style="page-break-before:always"><h2>Electronic signature</h2>
<p>Signed by <b>${esc(s.name)}</b> on ${esc(new Date(s.at).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'long', timeStyle: 'short' }))} (Eastern), from ${esc(s.ip)}.</p>
${s.total != null ? `<p>${j.proposal.options?.length ? `<b>Options chosen:</b> ${(j.proposal.options ?? []).filter((o) => s.options?.includes(o.id)).map((o) => `${esc(o.label)} (+${money(o.price)})`).join('; ') || 'none'}.<br>` : ''}${s.payBy ? `<b>Paying ${s.payBy === 'check' ? `by check or bank transfer (${+((j.proposal.pay?.discount ?? 0) * 100).toFixed(1)}% off the listed price)` : 'by card, at the listed price'}.</b><br>` : ''}<b>Total project investment: ${money(s.total)}</b>; deposit ${money(s.deposit ?? 0)}, balance ${money(s.total - (s.deposit ?? 0))} on completion.</p>` : ''}
<p><img src="${esc(s.image)}" alt="Signature of ${esc(s.name)}" style="max-width:360px;border-bottom:1px solid #111"></p>
<p class="muted" style="font-size:12px">The signer agreed to sign electronically and confirmed reading the Project Scope of Work, Purchase Agreement and Terms and Conditions. Document fingerprint (SHA-256) ${esc(s.hash.slice(0, 32))}, version ${s.version}.</p>
</section>`
    : '<p class="muted">Not signed yet.</p>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>${esc(j.project)} agreement</title><style>body{font:11pt/1.45 Georgia,serif;max-width:7.5in;margin:.5in auto;padding:0 16px;color:#111}${style}${noticeCss}
.terms p{font-size:10pt}</style></head><body>${inner}
${termsOf(j, shop) ? `<section class="terms" style="page-break-before:always"><h2>Terms and Conditions</h2>${termsHtml(termsOf(j, shop), s?.at, shop.company[0] || undefined, shop.company[1] || '')}</section>` : s ? noticeOfCancellation(easternYmd(s.at), shop.company[0] || 'CJC Custom Carpentry LLC', shop.company[1] || '') : ''}
${signed}${(j.changeOrders ?? []).some((c) => c.signature && !c.voided) ? `<section><h2>Approved change orders</h2>${(j.changeOrders ?? []).filter((c) => c.signature && !c.voided).map((c) => `<p><b>${c.number}. ${esc(c.title)}</b>: ${signedMoney(c.amount)}, approved by ${esc(c.signature!.name)} on ${esc(longDate(easternYmd(c.signature!.at)))}.</p>`).join('')}<p><b>Contract total with approved changes: ${money(signedTotals(j).total + (j.changeOrders ?? []).filter((c) => c.signature && !c.voided).reduce((t, c) => t + c.amount, 0))}</b></p></section>` : ''}</body></html>`;
}

/** The client's questions and the shop's answers, with a box to write more. */
export function commentsBlock(j: Job, base: string, about: string, intro: string, sent = false): string {
  const all = (j.comments ?? []).filter((c) => (about === 'drawings' ? c.about.startsWith('drawings') : about === 'model' ? c.about.startsWith('model') : !c.about.startsWith('drawings') && !c.about.startsWith('model')));
  const when = (t: number) => new Date(t).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  // Each of the client's messages says whether it's been answered yet
  const answered = (i: number) => all.slice(i + 1).some((c) => c.from === 'shop');
  const status = (c: PortalComment, i: number) => c.from === 'client' ? `<div class="state">${answered(i) ? '✓ Answered below' : '✓ Sent to Cody · waiting for an answer'}</div>` : '';
  const asked = all.some((c) => c.from === 'client');
  const form = `<form method="post" action="${base}/comment">
${about === 'drawings' ? '<p><input type="text" name="sheet" placeholder="Which sheet or cabinet (optional)" oninput="this.form.about.value=this.value?\'drawings: \'+this.value:\'drawings\'"></p>' : ''}
<input type="hidden" name="about" value="${esc(about)}">
<p><textarea name="text" rows="4" required maxlength="2000" placeholder="Write a question or a change you'd like"></textarea></p>
<div class="row"><button class="btn">${asked ? 'Send this question' : 'Send to CJC Custom Carpentry'}</button></div></form>`;
  return `<section class="card" id="comments"><h2>Questions and changes</h2><p class="muted">${esc(intro)}</p>
${sent ? '<div class="ok sent">Your question was sent to Cody. The answer will show up right here on this page.</div>' : ''}
${all.map((c, i) => `<div class="msg ${c.from}" id="c-${esc(c.id)}"><div class="who">${c.mark ? `<a class="pin" href="#sheet-${c.mark.sheet}">${(j.comments ?? []).filter((x) => x.mark).indexOf(c) + 1}</a> ` : c.pin ? `<a class="pin" href="#view" data-pin="${esc(c.id)}">${(j.comments ?? []).filter((x) => x.pin).indexOf(c) + 1}</a> ` : ''}${esc(c.from === 'shop' ? `${c.name} answered` : c.name)} · ${esc(when(c.at))}${c.about !== 'proposal' && c.about !== 'drawings' && c.about !== 'model' ? ` · ${esc(c.about.replace(/^(drawings|model):\s*/, ''))}` : ''}</div>${paras(c.text)}${status(c, i)}</div>`).join('')}
${asked ? `<details class="more"><summary class="btn ghost">Ask another question</summary>${form}</details>` : form}</section>`;
}

/** The drawing set for review once the agreement is signed, with its own comments. */
/**
 * The drawings as a design proof: each sheet fits the screen (Enlarge for detail), and the client
 * can tap or circle a spot on a sheet and write the change right there.
 */
export function drawingsPage(j: Job, shop: Shop, token: string, doc: string, sent = false, split: DrawingSheets | null = null): string {
  const base = `/p/${token}`;
  const d = j.drawings!;
  const top = `<p><a href="${base}">← Back to your project</a></p>
<h1>${esc(d.title)}</h1><p class="muted">${esc(j.project)} · version ${d.version}, ${esc(longDate(easternYmd(d.publishedAt)))}</p>${isDraft(j) ? `<p class=\"warn\"><b>Draft for discussion.</b> This is a working design for us to talk through: nothing is final, and the price comes once the layout is settled. Mark anything you’d like changed.</p>` : ''}
<p class="row"><a class="btn ghost" href="${base}/drawings?print" target="_blank" rel="noopener">Open full size to zoom, print or save</a></p>`;
  if (!split?.sheets.length) {
    // An older set sent before sheets went separately
    return shell(`${d.title} · ${j.project}`, `${top}<section class="card"><iframe class="doc dwgs" title="Drawings" sandbox srcdoc="${esc(doc)}"></iframe></section>
${commentsBlock(j, base, 'drawings', 'Questions or changes about the drawings. Say which sheet.', sent)}`, shop, esc(clientName(j)));
  }
  const marked = (j.comments ?? []).filter((c) => c.mark);
  const markHtml = (i: number) => marked.map((c, k) => (c.mark!.sheet === i
    ? `<a class="mk ${c.from}" href="#c-${esc(c.id)}" title="${esc(c.text.slice(0, 80))}" style="left:${c.mark!.x * 100}%;top:${c.mark!.y * 100}%;width:${c.mark!.w * 100}%;height:${c.mark!.h * 100}%"><span class="n">${k + 1}</span></a>` : '')).join('');
  // Each sheet as a picture with its own styles inside, so it scales cleanly on any screen
  const img = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/^<svg([^>]*)>/, `<svg$1><style>${split.css}</style>`))}`;
  const sheets = split.sheets.map((sh, i) => `<section class="card sheet" id="sheet-${i}" data-i="${i}" data-label="${esc(`${sh.number} ${sh.title}`.trim())}">
<div class="sheet-head"><b>${esc(sh.number)}</b> ${esc(sh.title)}<button type="button" class="link big-btn">Enlarge</button></div>
<div class="sheet-scroll"><div class="sheet-box"><img src="${img(sh.svg)}" alt="Sheet ${esc(sh.number)}: ${esc(sh.title)}">${isDraft(j) ? '<div class="draft-stamp" aria-hidden="true">DRAFT</div>' : ''}<div class="layer">${markHtml(i)}</div></div></div>
<p class="row"><button type="button" class="btn ghost mark-btn">Mark a change on this sheet</button></p></section>`).join('');
  const how = `<section class="card"><h2>How to review</h2>
<p class="tip"><b>Tip:</b> drawings are easiest to read on a laptop or computer. On a phone, turn it sideways and use <b>Enlarge</b>.</p>
<ol class="items">
<li>Look over each sheet below. Tap <b>Enlarge</b> to see a sheet bigger, then scroll sideways to move around.</li>
<li>Want something changed? Tap the button <b>Mark a change on this sheet</b> under that sheet.</li>
<li>Then on the sheet, either <b>tap the spot</b> once, <b>OR</b> <b>draw a circle around it</b> with your finger (or mouse).</li>
<li>A box opens at the bottom of the screen. Type what you’d like changed and tap <b>Send to Cody</b>.</li>
<li>Your mark stays on the sheet with a number, and Cody’s answer shows up on this page.</li></ol></section>`;
  const dialog = `<form id="markform" class="markform" method="post" action="${base}/comment" hidden>
<p class="muted" id="mf-where"></p>
<input type="hidden" name="about" id="mf-about" value="drawings"><input type="hidden" name="sheet_i" id="mf-i">
<input type="hidden" name="mx" id="mf-x"><input type="hidden" name="my" id="mf-y"><input type="hidden" name="mw" id="mf-w"><input type="hidden" name="mh" id="mf-h">
<textarea name="text" rows="3" required maxlength="2000" placeholder="What would you like changed here?"></textarea>
<div class="row"><button class="btn">Send to Cody</button><button type="button" class="btn ghost" id="mf-cancel">Cancel</button></div></form>`;
  const script = `<script>(()=>{let on=null,start=null,temp=null;const f=document.getElementById('markform');
const off=()=>{if(on){on.classList.remove('marking');on.querySelector('.mark-btn').textContent='Mark a change on this sheet'}on=null};
const clear=()=>{if(temp){temp.remove();temp=null}f.hidden=true};
document.querySelectorAll('.sheet').forEach(sh=>{const layer=sh.querySelector('.layer'),btn=sh.querySelector('.mark-btn');
sh.querySelector('.big-btn').onclick=e=>{sh.classList.toggle('big');e.target.textContent=sh.classList.contains('big')?'Fit to screen':'Enlarge'};
btn.onclick=()=>{if(on===sh){off();clear();return}off();clear();on=sh;sh.classList.add('marking');btn.textContent='Now tap the spot OR draw a circle on the sheet · tap here to cancel'};
const pt=e=>{const r=layer.getBoundingClientRect();return[Math.min(1,Math.max(0,(e.clientX-r.left)/r.width)),Math.min(1,Math.max(0,(e.clientY-r.top)/r.height))]};
const draw=(a,b)=>{const x=Math.min(a[0],b[0]),y=Math.min(a[1],b[1]),w=Math.abs(a[0]-b[0]),h=Math.abs(a[1]-b[1]);return[x,y,w,h]};
const put=([x,y,w,h])=>{if(!temp){temp=document.createElement('div');temp.className='mk new';layer.appendChild(temp)}Object.assign(temp.style,{left:x*100+'%',top:y*100+'%',width:w*100+'%',height:h*100+'%'})};
layer.addEventListener('pointerdown',e=>{if(on!==sh)return;e.preventDefault();clear();layer.setPointerCapture(e.pointerId);start=pt(e)});
layer.addEventListener('pointermove',e=>{if(on!==sh||!start)return;put(draw(start,pt(e)))});
layer.addEventListener('pointerup',e=>{if(on!==sh||!start)return;let m=draw(start,pt(e));start=null;
if(m[2]<0.02&&m[3]<0.02){const r=layer.getBoundingClientRect(),s=0.035,sy=s*r.width/r.height;m=[Math.max(0,m[0]-s/2),Math.max(0,m[1]-sy/2),s,sy]}
put(m);const ids=['x','y','w','h'];ids.forEach((k,i)=>document.getElementById('mf-'+k).value=m[i].toFixed(4));
document.getElementById('mf-i').value=sh.dataset.i;document.getElementById('mf-about').value='drawings: '+sh.dataset.label;
document.getElementById('mf-where').textContent='Your mark on '+sh.dataset.label;f.hidden=false;f.querySelector('textarea').focus();off()});});
document.getElementById('mf-cancel').onclick=()=>{clear()};
f.addEventListener('submit',()=>{f.querySelector('button').disabled=true;f.querySelector('button').textContent='Sending…'});})();</script>`;
  const body = `${top}${sent ? '<div class="ok sent">Your note was sent to Cody, with the spot you marked. The answer will show up on this page.</div>' : ''}${how}${sheets}
${commentsBlock(j, base, 'drawings', 'Your notes on the drawings, and Cody’s answers. Numbers match the marks on the sheets.', false)}${dialog}${script}`;
  return shell(`${d.title} · ${j.project}`, body, shop, esc(clientName(j)));
}

/**
 * The 3D model, to look around and pin notes on: turn it with a finger (or mouse), pinch or scroll to
 * zoom, and in "Mark a change" mode tap a spot to pin a note there. Pins already sent show as numbers.
 */
export function modelPage(j: Job, shop: Shop, token: string, sent = false): string {
  const base = `/p/${token}`;
  const pins = (j.comments ?? []).filter((c) => c.pin).map((c, i) => ({ id: c.id, n: i + 1, p: c.pin!, from: c.from, text: c.text.slice(0, 80) }));
  const top = `<p><a href="${base}">← Back to your project</a> · <a href="${base}/drawings">Drawings</a></p>
<h1>Your project in 3D</h1><p class="muted">${esc(j.project)} · version ${j.model!.version}, ${esc(longDate(easternYmd(j.model!.publishedAt)))}</p>${isDraft(j) ? `<p class=\"warn\"><b>Draft for discussion.</b> This is a working design for us to talk through: nothing is final, and the price comes once the layout is settled. Mark anything you’d like changed.</p>` : ''}`;
  const how = `<section class="card"><h2>How to use it</h2><ol class="items">
<li><b>Turn</b> the room by dragging with one finger (or the mouse). <b>Zoom</b> by pinching (or scrolling). <b>Slide</b> it with two fingers (or right-drag).</li>
<li>Want something changed? Tap <b>Mark a change</b>, then tap the spot on the model.</li>
<li>A box opens: type what you’d like changed and tap <b>Send to Cody</b>. A numbered pin stays on that spot, and Cody’s answer shows up below.</li></ol></section>`;
  const view = `<section class="card m3d" id="view"><div class="m3d-bar"><button type="button" class="btn ghost" id="m-mark">Mark a change</button><button type="button" class="btn ghost" id="m-reset">Reset view</button><span class="muted" id="m-msg">Loading the model…</span></div>
<div class="m3d-box" id="m-box"><canvas id="m-canvas"></canvas><div id="m-pins"></div></div></section>`;
  const dialog = `<form id="markform" class="markform" method="post" action="${base}/comment" hidden>
<p class="muted">Your pin on the 3D model</p>
<input type="hidden" name="about" value="model"><input type="hidden" name="px" id="mf-x"><input type="hidden" name="py" id="mf-y"><input type="hidden" name="pz" id="mf-z">
<textarea name="text" rows="3" required maxlength="2000" placeholder="What would you like changed here?"></textarea>
<div class="row"><button class="btn">Send to Cody</button><button type="button" class="btn ghost" id="mf-cancel">Cancel</button></div></form>`;
  const css3 = `<style>.m3d-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px}.m3d-box{position:relative;height:min(70vh,640px);border-radius:8px;overflow:hidden;background:#f3f1ec;touch-action:none}.m3d-box canvas{display:block;width:100%;height:100%}.m3d.marking .m3d-box{outline:3px solid var(--accent);cursor:crosshair}#m-pins{position:absolute;inset:0;pointer-events:none}.p3{position:absolute;transform:translate(-50%,-100%);pointer-events:auto;min-width:24px;height:24px;border-radius:12px 12px 12px 2px;background:#c2410c;color:#fff;font:700 13px/24px system-ui;text-align:center;padding:0 6px;text-decoration:none;box-shadow:0 1px 4px rgba(0,0,0,.35)}.p3.shop{background:var(--accent)}.p3.new{background:#2563eb}</style>`;
  const script = `<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
const pins=${JSON.stringify(pins).replace(/</g, '\\u003c')};
const box=document.getElementById('m-box'),cv=document.getElementById('m-canvas'),msg=document.getElementById('m-msg'),layer=document.getElementById('m-pins'),sec=document.getElementById('view'),f=document.getElementById('markform');
const r=new THREE.WebGLRenderer({canvas:cv,antialias:true});r.setPixelRatio(Math.min(2,devicePixelRatio));r.toneMapping=THREE.NeutralToneMapping;r.toneMappingExposure=0.95;
const scene=new THREE.Scene();scene.background=new THREE.Color('#f3f1ec');
scene.add(new THREE.HemisphereLight('#ffffff','#b9b2a6',1.1));const sun=new THREE.DirectionalLight('#ffffff',1.6);sun.position.set(1,2,1.5);scene.add(sun);const fill=new THREE.DirectionalLight('#ffffff',0.4);fill.position.set(-1,1,-1);scene.add(fill);
const cam=new THREE.PerspectiveCamera(42,1,1,20000);const ctl=new OrbitControls(cam,cv);ctl.enableDamping=true;ctl.screenSpacePanning=true;
let home=null,model=null;
const size=()=>{const w=box.clientWidth,h=box.clientHeight;r.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix()};addEventListener('resize',size);size();
const reset=()=>{if(!home)return;cam.position.copy(home.pos);ctl.target.copy(home.target);ctl.update()};
new GLTFLoader().load('${base}/model.glb',g=>{model=g.scene;scene.add(model);const b=new THREE.Box3().setFromObject(model),c=b.getCenter(new THREE.Vector3()),s=b.getSize(new THREE.Vector3());const d=Math.max(s.x,s.z);
home={target:new THREE.Vector3(c.x,Math.min(c.y,40),c.z),pos:new THREE.Vector3(c.x+d*0.55,c.y+s.y*0.9,c.z+d*1.15)};reset();msg.textContent=pins.length?pins.length+' note'+(pins.length>1?'s':'')+' pinned':'';},undefined,()=>{msg.textContent='The model didn’t load. Reload the page to try again.'});
const v=new THREE.Vector3();const tags=pins.map(p=>{const a=document.createElement('a');a.className='p3 '+p.from;a.textContent=p.n;a.href='#c-'+p.id;a.title=p.text;layer.appendChild(a);return{el:a,p:new THREE.Vector3(...p.p)}});
let pending=null;const place=(t)=>{v.copy(t.p).project(cam);const vis=v.z<1&&v.z>-1;t.el.style.display=vis?'':'none';t.el.style.left=((v.x+1)/2*box.clientWidth)+'px';t.el.style.top=((1-v.y)/2*box.clientHeight)+'px'};
(function loop(){requestAnimationFrame(loop);ctl.update();r.render(scene,cam);tags.forEach(place);if(pending)place(pending)})();
let marking=false;const mb=document.getElementById('m-mark');const setMark=on=>{marking=on;sec.classList.toggle('marking',on);mb.textContent=on?'Now tap the spot · tap here to cancel':'Mark a change'};
mb.onclick=()=>setMark(!marking);document.getElementById('m-reset').onclick=reset;
let down=null;cv.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY]});
cv.addEventListener('pointerup',e=>{if(!marking||!model||!down)return;if(Math.hypot(e.clientX-down[0],e.clientY-down[1])>8)return;
const rc=cv.getBoundingClientRect(),m=new THREE.Vector2((e.clientX-rc.left)/rc.width*2-1,-((e.clientY-rc.top)/rc.height)*2+1);const ray=new THREE.Raycaster();ray.setFromCamera(m,cam);const hit=ray.intersectObject(model,true).find(h=>h.object.isMesh);
if(!hit)return;if(pending)pending.el.remove();const a=document.createElement('span');a.className='p3 new';a.textContent='+';layer.appendChild(a);pending={el:a,p:hit.point.clone()};
['x','y','z'].forEach(k=>document.getElementById('mf-'+k).value=hit.point[k].toFixed(2));f.hidden=false;f.querySelector('textarea').focus();setMark(false)});
document.getElementById('mf-cancel').onclick=()=>{f.hidden=true;if(pending){pending.el.remove();pending=null}};
f.addEventListener('submit',()=>{f.querySelector('button').disabled=true;f.querySelector('button').textContent='Sending…'});
</script>`;
  const body = `${css3}${top}${sent ? '<div class="ok sent">Your note was sent to Cody, pinned where you tapped. The answer will show up on this page.</div>' : ''}${how}${view}
${commentsBlock(j, base, 'model', 'Your notes on the 3D model, and Cody’s answers. Numbers match the pins.', false)}${dialog}${script}`;
  return shell(`3D · ${j.project}`, body, shop, esc(clientName(j)));
}

export const simplePage = (title: string, text: string, shop: Shop) => shell(title, `<h1>${esc(title)}</h1><p>${esc(text)}</p>`, shop);
