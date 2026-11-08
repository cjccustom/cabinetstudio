// The printed quote in Cody's Word layout (logo with the license box, the green-banded Project
// Scope of Work and Purchase Agreement tables, signature lines), followed by the Terms and
// Conditions with the Notice of Cancellation in duplicate. Saved to the client's Dropbox folder
// each time a proposal is published, for the paper copy that goes to the client.
import { forCustomer } from './moldings';
import type { Project } from './types';
import { clientName, clientOf, proposalLines, proposalTitle } from './client';
import { paymentSchedule, pctText as schedPct } from './schedule';
import { cardLines, cardOf, checkDiscountOf, paySchedule, pctText as discPct } from './payDiscount';
import { proposalSummary, withOptions } from './proposal';
import { priceQuote, proposalScope } from './quote';
import { LOGO } from '../drawings/logo';
import { finishingItems } from './finishing';
import { termsHtml } from '../../portal/src/pages';

const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const money = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;
const longDate = (t: number) => new Date(t).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

/** The company box, as on the Word template. */
const companyBox = `<div class="cobox"><b>CJC Custom Carpentry LLC</b><br><b>50 Beaman Rd</b><br><b>Sterling, MA 01564</b><br><b>Phone: (508)215-6295</b><br><b>HIC License #207489</b><br><b>CSL License #CS119119</b></div>`;
const head = `<div class="head"><img src="${LOGO}" alt="CJC Custom Carpentry">${companyBox}</div>`;

/** Cody's standard opening section. */
const SETUP = [
  '<b>Clients Responsible</b> for removing all items from work area, including shoes, furniture, decorations, etc.',
  'Jobsite will be left broom clean at the end of each workday and at the end of the project all protection materials will be removed.',
];

/** The print copy the customer signs, with no supplier names in it. */
export const printQuote = (p: Project, opts: { terms: string; version?: number; publishedAt?: number }): string => forCustomer(printQuoteRaw(p, opts));

function printQuoteRaw(p: Project, opts: { terms: string; version?: number; publishedAt?: number }): string {
  const c = clientOf(p);
  const base = withOptions(p);
  const r = priceQuote(base);
  const summary = proposalSummary(p);
  const full = p.proposalDetail === 'full';
  const lines = proposalLines(p);
  const d = checkDiscountOf(p);
  const when = opts.publishedAt ?? Date.now();
  const bullets = (items: string[]) => `<ul class="dash">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;

  // Scope sections: setup, then the work by area (or cabinet by cabinet), materials, options
  const sections: string[] = [`<h4>Project Setup, Protection, &amp; Cleaning</h4>${SETUP.map((t) => `<p>${t}</p>`).join('')}`];
  if (c.scope) sections.push(`<p>${esc(c.scope).replace(/\n/g, '<br>')}</p>`);
  if (full) sections.push(`<h4>${esc(proposalTitle(p))}</h4>${bullets(proposalScope(base))}`);
  else for (const a of summary.areas) sections.push(`<h4>${esc(a.title)}</h4>${bullets(a.items)}`);
  if (full && base.cabinets.length) sections.push(`<h4>Finishing</h4>${bullets(finishingItems(base))}`);
  if (full && r.extras.length) sections.push(`<h4>Additional Work</h4>${bullets(r.extras.map((e) => e.label))}`);
  if (!full && summary.materials.length) sections.push(`<h4>Materials &amp; Finishes</h4>${bullets(summary.materials.map((m) => `${m.label}: ${m.value}`))}`);
  if (summary.options.length) sections.push(`<h4>Options</h4><p>Added to the work above only when chosen at signing:</p>${bullets(summary.options.map((o) => `${o.label} (${money(o.price)})${o.items.length ? `: ${o.items.join('; ')}` : ''}`))}`);
  sections.push(`<h4>*Notes*</h4>${bullets([
    full ? 'Final dimensions will be field verified' : 'Sizes shown are approximate; exact sizes are set on the shop drawings you approve after signing, from measurements taken on site',
    'Homeowner to approve door style, finish and hardware before ordering',
  ])}`);

  const scopePage = `<section class="page">${head}
<table class="grid"><tr><th class="band" colspan="4">Project Scope of Work</th></tr>
<tr><th>Client Name</th><td colspan="3">${esc(clientName(c))}</td></tr>
<tr><th>Project Address</th><td colspan="3">${esc(c.address)}</td></tr>
<tr><th>Cell Phone</th><td>${esc(c.phone)}</td><th class="em">E-Mail</th><td>${esc(c.email)}</td></tr>
<tr><td colspan="4" class="body">${sections.join('')}</td></tr></table></section>`;

  const optRows = summary.options.map((o) => `<tr><td class="lab">Option: ${esc(o.label)}</td><td class="amt">add ${money(cardOf(o.price, d))}${d ? `<br><span class="small">${money(o.price)} by check</span>` : ''}</td></tr>`).join('');
  const agreementPage = `<section class="page">${head}
<table class="grid pa"><tr><th class="band" colspan="2">PURCHASE AGREEMENT</th></tr>
<tr><th>Client Name</th><td>${esc(clientName(c))}</td></tr>
<tr><th>Project Address</th><td>${esc(c.address)}</td></tr>
<tr><th>Agreement Date</th><td></td></tr>
<tr><th>Estimated Start Date</th><td>${esc(p.proposalStart ?? '')}</td></tr>
<tr><th>Project Duration</th><td>${esc(p.proposalDuration ?? '')}</td></tr>
<tr><td colspan="2" class="small">The above <b>Estimated Start Date</b> is an approximation valid on the above listed <b>Agreement Date</b> and is used for planning purposes only. CJC Custom Carpentry, LLC cannot be held responsible for delays caused by weather or other unforeseen circumstances before or during the project. All pricing is valid for (14) days from Agreement date.</td></tr></table>
<table class="grid prices">${cardLines(lines, d).map((l) => `<tr><td class="lab">${esc(l.label)}</td><td class="amt">${money(l.price)}</td></tr>`).join('')}
<tr class="tot"><td class="lab">Total Project Investment${summary.options.length ? ' (before options)' : ''}</td><td class="amt">${money(cardOf(r.total, d))}</td></tr>${d ? `<tr class="tot"><td class="lab">Paying by check or bank transfer: ${discPct(d)} off</td><td class="amt">${money(r.total)}</td></tr>` : ''}${optRows}
<tr><td colspan="2" class="sched"><u><b>Project Payment Schedule</b></u><br>${(d ? paySchedule(p, r.total, d).map((l) => ({ label: l.label, amount: l.card, check: l.check, pct: l.pct })) : paymentSchedule(p, r.total).map((l) => ({ ...l, check: 0 }))).map((l) => `<b>${esc(l.label)} – ${money(l.amount)}</b>${d ? ` (${money(l.check)} by check or bank transfer)` : ''}${summary.options.length ? ` (plus ${schedPct(l.pct)} of options chosen)` : ''}`).join('<br><br>')}${d ? `<br><br>Prices listed are for paying by card; paying by check or bank transfer takes ${discPct(d)} off every amount.<br>Paying by: &#9744; check or bank transfer &nbsp; &#9744; card` : ''}${summary.options.length ? '<br><br>Options chosen: ______________________________ &nbsp; Total with options: $____________' : ''}</td></tr></table>
<p class="supersede">This agreement supersedes all conversations, statements, and agreements expressed or implied between the parties, their agents and representatives. The Terms and Conditions that follow are part of this agreement.</p>
<div class="sign"><div>Owner</div><div>Date</div><div>CJC Custom Carpentry, LLC</div><div>Date</div></div>
<p class="ver">Proposal${opts.version ? ` version ${opts.version}` : ''}, ${esc(longDate(when))}</p></section>`;

  // The terms, blanks left for the dates; the notice again on its own page as the copy they can send back
  const blanks = opts.terms.replace(/\[DATE OF TRANSACTION\]/gi, '____________________').replace(/\[CANCELLATION DEADLINE\]/gi, '____________________');
  const termsBody = termsHtml(blanks);
  const notice = termsBody.match(/<section class="notice">[\s\S]*<\/section>/)?.[0];
  const termsPage = `<section class="page terms">${head}<h2>Terms and Conditions</h2>${termsBody}</section>`;
  const noticeCopy = notice ? `<section class="page terms">${head}<p class="small"><b>Second copy of the Notice of Cancellation.</b> Keep one copy; to cancel, sign and send this one.</p>${notice}</section>` : '';

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(proposalTitle(p))}</title>
<style>
@page{size:letter;margin:.5in .6in}
*{box-sizing:border-box}
body{font:10.5pt/1.35 Arial,Helvetica,sans-serif;color:#000;margin:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{max-width:7.3in;margin:0 auto 24px;page-break-after:always;break-after:page}
.page:last-child{page-break-after:auto;break-after:auto}
.head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.head img{height:.95in}
.cobox{border:1.5px solid #000;padding:6px 12px;font-size:10pt;line-height:1.3;min-width:2.45in}
table.grid{border-collapse:collapse;width:100%;margin:0}
table.grid th,table.grid td{border:1px solid #000;padding:3px 6px;text-align:left;vertical-align:top;font-size:10pt}
table.grid th{font-weight:700;width:1.45in;white-space:nowrap}
table.grid th.em{width:.7in}
th.band{background:#c4d79b;text-align:center!important;font-size:12pt;width:auto!important}
td.body{padding:10px 8px 14px}
td.body h4{font-size:10.5pt;text-decoration:underline;margin:14px 0 4px}
td.body h4:first-child{margin-top:4px}
td.body p{margin:4px 0}
ul.dash{list-style:none;padding-left:16px;margin:4px 0 8px}
ul.dash li{position:relative;margin:2px 0}
ul.dash li::before{content:"-";position:absolute;left:-14px}
.small{font-size:8.5pt}
table.prices{margin-top:-1px}
table.prices td.lab{text-align:right;font-weight:700}
table.prices td.amt{width:1.15in;font-weight:700;white-space:nowrap}
table.prices tr.tot td{background:#c4d79b}
td.sched{font-size:10pt}
p.supersede{font-style:italic;font-size:9.5pt;margin:4px 0 0}
.sign{display:grid;grid-template-columns:3fr 1.2fr;column-gap:0;margin-top:44px;row-gap:40px}
.sign div{border-top:1px solid #000;padding-top:3px;font-size:9.5pt}
.ver{font-size:8pt;color:#555;margin-top:24px}
.terms h2{font-size:12pt;text-align:center;margin:6px 0 10px}
.terms p{margin:0 0 7px;font-size:9.5pt}
.notice{border:1px solid #000;padding:12px;margin:14px 0;font-size:9.5pt;break-inside:avoid}
.notice h3{text-align:center;margin:0 0 8px;font-size:11pt}
@media screen{body{background:#888;padding:20px 0}.page{background:#fff;padding:.5in .6in;box-shadow:0 2px 10px rgba(0,0,0,.3);max-width:8.5in}}
@media print{.page{margin:0;max-width:none}}
</style></head><body>${scopePage}${agreementPage}${termsPage}${noticeCopy}</body></html>`;
}

/** The print copy's file name in the client's folder: one per published version. */
export const printQuoteFile = (version?: number) => `Proposal${version ? ` v${version}` : ''} - print copy.html`;
