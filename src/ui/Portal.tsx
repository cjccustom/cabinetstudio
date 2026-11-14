// The client portal from Cabinet Studio's side: publish the proposal and renderings to the
// client's private page, send them the link, see whether they've looked and signed, and keep
// the shop profile (about, terms, licenses, insurance) every client page shows.
import { exportModel } from '../three/exportModel';
import { Scene } from '../three/Scene';
const noIssues = new Set<string>();
import { contractTotal } from '../model/contract';
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { clientName, clientOf, COMPANY, proposalLines, proposalTitle, quoteDoc, quoteTotals } from '../model/client';
import { optionPrices, proposalSummary } from '../model/proposal';
import { Field } from './fields';
import { drawingsOf, jobCustomerSet, setDocument, sheetCss } from '../drawings/sheets';
import { FileButton } from './FileButton';
import { renderOf } from '../model/rendering';
import { markIssued, withPictures } from './setPictures';
import { CJC_TERMS } from '../model/terms';
import { capability, shrinkImage, type Downloads } from '../runtime';
import { asciiHtml, downloadLink, whereIs, writeFile } from '../dropbox';
import { printQuote, printQuoteFile } from '../model/printQuote';
import {
  blobToBase64, restoreSigned, billChangeOrder, publishChangeOrder, voidChangeOrder, publishModel, createInvoice, deleteShopDoc, expiring, getShop, jobStatus, PortalError, publishProposal, publishDrawings, replyComment, markCommentsRead, qbItems, qbSettings, qbStatus, recordPayment, updateShop, uploadShopDoc,
  type ChangeOrderStatus, type Invoice, type JobStatus, type QbStatus, type Shop, type ShopDoc,
} from '../portal';
import { askConfirm } from './Confirm';
import { projectPage } from '../../portal/src/pages';
import { forCustomer } from '../model/moldings';
import { cardLines, cardOf, checkDiscountOf } from '../model/payDiscount';
import { priceQuote } from '../model/quote';
import { listedPrice } from '../model/selections';

/** What goes on the customer's page, with no supplier names. */
const clean = <T,>(x: T): T => JSON.parse(forCustomer(JSON.stringify(x))) as T;

/**
 * What goes on the client's page with the check / bank transfer discount: the listed prices are the
 * card prices, and the check prices (the quote as built) ride along for the client to choose at signing.
 */
function cardSide(project: Project, summary: ReturnType<typeof proposalSummary>) {
  const d = checkDiscountOf(project);
  const { total, deposit } = quoteTotals(project);
  return {
    total: cardOf(total, d), deposit: cardOf(deposit, d),
    sections: cardLines(clean(proposalLines(project)), d),
    options: summary.options.map((o) => ({ ...o, price: cardOf(o.price, d) })),
    pay: d ? { discount: d, checkTotal: total, checkDeposit: deposit, optionCheck: Object.fromEntries(summary.options.map((o) => [o.id, o.price])) } : undefined,
  };
}
import type { Job, Shop as PortalShop } from '../../portal/src/store';
import type { Project } from '../model/types';

const money = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;
const when = (t: number) => new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const day = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const errText = (e: unknown) => (e instanceof PortalError ? e.message : `Something went wrong: ${(e as Error).message}`);

/** A job id the portal can use in a URL-safe key: the client's last name plus a short random tail, made once per job. */
export const newJobId = (p: Project) => {
  const c = clientOf(p);
  const base = (c.last || c.first || p.name || 'job').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'job';
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
};

/**
 * The pictures that go to the client, at most six: renderings and saved 3D views (the one picked
 * for the quote first). With none saved, the 3D views kept beside Gemini renderings and the
 * drawings' cover picture stand in, so the proposal never goes out without the design.
 */
export function proposalPictures(p: Project): { name: string; url: string }[] {
  const r = renderOf(p);
  const chosen = r.images.filter((i) => i.kind === 'rendering').sort((a, b) => Number(b.id === r.quoteId) - Number(a.id === r.quoteId));
  const fallback = [...r.images.filter((i) => i.kind === 'photo' && /design view/i.test(`${i.note ?? ''} ${i.name ?? ''}`)), ...(drawingsOf(p).cover ? [{ name: '3D view of the design', url: drawingsOf(p).cover! }] : [])];
  return (chosen.length ? chosen : fallback).slice(0, 6).map((i) => ({ name: i.name || 'Rendering', url: i.url }));
}

async function renderingsFor(p: Project) {
  const out = [];
  const mark = `Design by CJC Custom Carpentry for ${clientName(clientOf(p)) || 'this proposal'} · not for reuse`;
  for (const img of proposalPictures(p)) {
    try {
      const blob = await watermark(await shrinkImage(await (await fetch(img.url)).blob(), 1800, 0.85), mark);
      out.push({ name: img.name, mimeType: 'image/jpeg', data: await blobToBase64(blob) });
    } catch { /* a picture that can't be read is left out rather than stopping the proposal */ }
  }
  return out;
}

/**
 * The proposal page's data tucked into the agreement as a comment. The portal takes it back out;
 * it gets through even a connector that still has the old list of fields.
 */
function withCarried(html: string, data: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return html.replace('</body>', `<!--CJC-PROPOSAL ${btoa(bin)} --></body>`);
}

/** A quiet line in the corner saying whose design it is, so a rendering passed to another builder says so. */
async function watermark(blob: Blob, text: string): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(blob);
    const c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    const x = c.getContext('2d')!;
    x.drawImage(bmp, 0, 0);
    const size = Math.max(12, Math.round(c.width / 70));
    x.font = `${size}px -apple-system, "Helvetica Neue", Arial, sans-serif`;
    const w = x.measureText(text).width;
    const pad = size * 0.6;
    x.fillStyle = 'rgba(0,0,0,0.38)';
    x.fillRect(c.width - w - pad * 3, c.height - size - pad * 2.4, w + pad * 2, size + pad * 1.4);
    x.fillStyle = 'rgba(255,255,255,0.92)';
    x.textBaseline = 'bottom';
    x.fillText(text, c.width - w - pad * 2, c.height - pad * 1.6);
    return await new Promise<Blob>((ok) => c.toBlob((b) => ok(b ?? blob), 'image/jpeg', 0.88));
  } catch { return blob; }
}

/**
 * The paper copy in the Word quote's layout, with the terms and the Notice of Cancellation, saved
 * to the client's Dropbox folder for printing. A failure here never undoes the publish.
 */
async function savePrintCopy(project: Project, version: number): Promise<string> {
  if (!project.dropbox) return ' Link a Dropbox folder to get a print copy saved with each version.';
  const name = printQuoteFile(version);
  try {
    let terms = CJC_TERMS;
    try { terms = ((await getShop()) as unknown as PortalShop).terms || CJC_TERMS; } catch { /* the starting terms */ }
    // Where the folder is now (it may have moved between stages); never rename it from here
    const here = await whereIs(project.dropbox.id);
    if (!here) return ' The print copy wasn’t saved: this job’s Dropbox folder wasn’t found.';
    await writeFile(here.path, name, printQuote(project, { terms, version, publishedAt: Date.now() }));
    return ` Print copy saved to Dropbox: ${here.path}/${name}.`;
  } catch (e) {
    return ` The print copy wasn’t saved to Dropbox (${(e as Error).message}).`;
  }
}

export function ClientPortal() {
  // A hidden 3D view, mounted only while the model is exported for the portal
  const [stage, setStage] = useState(false);
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [settings, setSettings] = useState(false);
  const [preview, setPreview] = useState<{ html: string; offline: boolean } | null>(null);
  const c = clientOf(project);
  const portal = project.portal;
  const st = portal?.status;
  const { total, deposit } = quoteTotals(project);
  // A sold job's price is its contract; the design's calculated quote never goes to the client
  const sold = project.contract;
  const pics = useMemo(() => proposalPictures(project), [project]);
  const renderings = pics.length;
  const options = useMemo(() => optionPrices(project), [project]);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setError(''); setNote('');
    try { await fn(); } catch (e) { setError(errText(e)); } finally { setBusy(''); }
  };
  const keep = (status: JobStatus, jobId: string) =>
    commit((p) => ({ ...p, portal: { jobId, url: status.url, status, checkedAt: Date.now() } }));

  const publish = () => run(portal?.url ? 'Updating the client’s page…' : 'Publishing the proposal…', async () => {
    if (sold) throw new PortalError('This job is sold under its contract, so Cabinet Studio’s calculated proposal isn’t published.');
    if (!total) throw new PortalError('The quote is $0. Price the job in the Quote tab first.');
    if (!clientName(c).trim()) throw new PortalError('Add the client’s name above first.');
    let replaceSigned = false;
    if (st?.signed && !st.cancelled) {
      if (!(await askConfirm(`${st.signed.name} already signed version ${st.signed.version}. Replacing it takes the signed agreement off their page and asks them to sign everything again; change orders are for changes after signing. Replace the signed agreement anyway?`, 'Replace the signed agreement'))) return;
      replaceSigned = true;
    }
    const jobId = portal?.jobId ?? newJobId(project);
    const summary = clean(proposalSummary(project));
    const card = cardSide(project, summary);
    const status = await publishProposal({
      job_id: jobId, project: proposalTitle(project),
      client: { first: c.first, last: c.last, email: c.email, phone: c.phone, address: c.address },
      agreement_html: withCarried(quoteDoc(project, { online: true }), { summary: { areas: summary.areas, materials: summary.materials }, sections: card.sections, options: card.options, pay: card.pay }), total: card.total, deposit: card.deposit,
      renderings: await renderingsFor(project), replace_signed: replaceSigned,
    });
    keep(status, jobId);
    const printed = await savePrintCopy(project, status.version);
    setNote(`Published version ${status.version}. Send ${c.first || 'the client'} the link below.${printed}`);
  });

  /** The client's page exactly as the portal will draw it, built here from what would be published. */
  const showPreview = () => run('Building the preview…', async () => {
    if (!total) throw new PortalError('The quote is $0. Price the job in the Quote tab first.');
    let shop: PortalShop = { company: [], about: '', terms: CJC_TERMS, docs: [] };
    let offline = false;
    try { shop = (await getShop()) as unknown as PortalShop; } catch { offline = true; }
    const summary = clean(proposalSummary(project));
    const card = cardSide(project, summary);
    const rend = await renderingsFor(project);
    const job: Job = {
      jobId: 'preview', token: 'preview', project: proposalTitle(project), stage: 'proposal',
      client: { first: c.first, last: c.last, email: c.email, phone: c.phone, address: c.address },
      proposal: {
        agreementHtml: quoteDoc(project, { online: true }), total: card.total, deposit: card.deposit, publishedAt: Date.now(), version: (st?.version ?? 0) + 1, hash: '', terms: shop.terms,
        summary: { areas: summary.areas, materials: summary.materials }, sections: card.sections.map(({ label, price }) => ({ label, price })), options: card.options, pay: card.pay,
      },
      renderings: rend.map((r, i) => ({ id: `r${i}`, name: r.name, mimeType: r.mimeType })), views: [],
    };
    let html = projectPage(job, shop, 'preview');
    rend.forEach((r, i) => { html = html.split(`/p/preview/img/r${i}`).join(`data:${r.mimeType};base64,${r.data}`); });
    // Nothing can be signed here: say so where they'd sign
    html = html.replace('<button class="btn" id="go" disabled>Sign the agreement</button>', '<button class="btn" disabled>Preview only: sign on the real page</button>');
    setPreview({ html, offline });
  });

  /** The paper copy, offered as a download (it's saved to Dropbox by itself each time you publish). */
  const printCopy = () => run('Making the print copy…', async () => {
    if (!total) throw new PortalError('The quote is $0. Price the job in the Quote tab first.');
    let terms = CJC_TERMS;
    try { terms = ((await getShop()) as unknown as PortalShop).terms || CJC_TERMS; } catch { /* the starting terms */ }
    const html = printQuote(project, { terms, version: st?.version });
    const data = new Blob([asciiHtml(html)], { type: 'text/html' });
    const filename = `${clientName(c) || project.name} - ${printQuoteFile(st?.version)}`;
    const downloads = await capability<Downloads>('downloads');
    if (downloads) { try { await downloads.save({ filename, data }); } catch { /* declined */ } }
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(data); a.download = filename; a.click(); }
  });

  /** After signing: the customer drawing set on their page, for review and comments. */
  const sendDrawings = () => run('Sending the drawings…', async () => {
    const d = drawingsOf(project);
    const title = `Drawings for review: ${project.name || 'your project'}`;
    const sheets = jobCustomerSet(await withPictures(project));
    const s2 = await publishDrawings(portal!.jobId, setDocument(title, sheets, d.paper), 'Drawings for your review', sheetCss, sheets.map((x) => ({ number: x.number, title: x.title, svg: x.svg })));
    keep(s2, portal!.jobId);
    markIssued();
    // The 3D model goes with them, for the customer to look around and pin notes on
    let sent3d = '';
    try {
      setNote('Sending the 3D model…');
      setStage(true);
      let glb: ArrayBuffer;
      try { glb = await exportModel(); } finally { setStage(false); }
      const s3 = await publishModel(portal!.jobId, await blobToBase64(new Blob([glb], { type: 'model/gltf-binary' })), (d, n) => setNote(`Sending the 3D model… ${Math.round((d / n) * 100)}%`));
      if (s3) keep(s3, portal!.jobId);
      sent3d = ' with the 3D model';
    } catch (e) { sent3d = `; the 3D model didn’t go (${(e as Error).message})`; }
    setNote(`Drawings version ${s2.drawings?.version ?? 1} are on ${c.first || 'the client'}’s page${sent3d}.`);
  });

  /** A returning client: the design draft (drawings and 3D) on their page before there's a price. */
  const shareDraft = () => run('Sharing the design draft…', async () => {
    if (!clientName(c).trim()) throw new PortalError('Add the client’s name above first.');
    const jobId = portal?.jobId ?? newJobId(project);
    const d = drawingsOf(project);
    const title = `Design draft: ${proposalTitle(project)}`;
    const sheets = jobCustomerSet(await withPictures(project));
    // The request rides inside the document, so a connector that hasn't picked up new fields still carries it
    const ask = { project: proposalTitle(project), client: { first: c.first, last: c.last, email: c.email, phone: c.phone, address: c.address } };
    const carried = `<!--CJC-DESIGN ${btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(ask))))} -->`;
    const s2 = await publishDrawings(jobId, carried + setDocument(title, sheets, d.paper), 'Design draft for discussion', sheetCss, sheets.map((x) => ({ number: x.number, title: x.title, svg: x.svg })));
    keep(s2, jobId);
    markIssued();
    let sent3d = '';
    try {
      setNote('Sending the 3D model…');
      setStage(true);
      let glb: ArrayBuffer;
      try { glb = await exportModel(); } finally { setStage(false); }
      const s3 = await publishModel(jobId, await blobToBase64(new Blob([glb], { type: 'model/gltf-binary' })), (dn, n) => setNote(`Sending the 3D model… ${Math.round((dn / n) * 100)}%`));
      if (s3) keep(s3, jobId);
      sent3d = ' with the 3D model';
    } catch (e) { sent3d = `; the 3D model didn’t go (${(e as Error).message})`; }
    setNote(`Design draft ${s2.drawings?.version ?? 1} is on ${c.first || 'the client'}’s page${sent3d}. No price shows until you publish the proposal.`);
  });

  const refresh = () => run('Checking…', async () => { keep(await jobStatus(portal!.jobId), portal!.jobId); });
  // Opening the job checks the portal, quietly, so signatures and approvals show without a click
  useEffect(() => {
    const id = portal?.jobId;
    if (!id || (portal?.checkedAt && Date.now() - portal.checkedAt < 30e3)) return;
    jobStatus(id).then((s2) => keep(s2, id), () => { /* offline or not on claude.ai: Check status still works */ });
  }, [portal?.jobId]); // eslint-disable-line react-hooks/exhaustive-deps
  const copy = (text: string, what: string) => navigator.clipboard.writeText(text).then(() => setNote(`${what} copied.`), () => setNote('Select the link and copy it.'));
  const draftOnly = !!st && st.version === 0;
  const message = draftOnly
    ? `Hi ${c.first || 'there'}, here’s the first draft of the design to look over. Turn it around in 3D and mark anything you’d change: ${portal?.url ?? ''}`
    : `Hi ${c.first || 'there'}, here’s your project page with the design, proposal and agreement: ${portal?.url ?? ''}`;

  return (
    <section className="sheet-sec">
      {stage && <div className="export-stage" aria-hidden="true"><Scene issueIds={noIssues} /></div>}
      <div className="sec-head">
        <h3>Client portal</h3>
        <button className="link-btn" onClick={() => setSettings(true)}>Portal settings</button>
      </div>
      <p className="hint">The client’s private page: renderings, the scope and purchase agreement, your terms, licenses and insurance. They sign on their phone and get the signed copy with the 3-day Notice of Cancellation.</p>
      {!sold && (
        <Field label="Title the client sees" htmlFor="pp-title">
          <input id="pp-title" value={project.proposalTitle ?? ''} placeholder={proposalTitle({ ...project, proposalTitle: undefined })} onChange={(e) => commit((p) => ({ ...p, proposalTitle: e.target.value || undefined }))} />
        </Field>
      )}
      {!sold && (
        <div className="grid2">
          <Field label="Estimated start date" htmlFor="pp-start">
            <input id="pp-start" value={project.proposalStart ?? ''} placeholder="Week of March 8, 2027 · Early spring" onChange={(e) => commit((p) => ({ ...p, proposalStart: e.target.value || undefined }))} />
          </Field>
          <Field label="Project duration" htmlFor="pp-dur">
            <input id="pp-dur" value={project.proposalDuration ?? ''} placeholder="3 to 4 weeks · 5 days on site" onChange={(e) => commit((p) => ({ ...p, proposalDuration: e.target.value || undefined }))} />
          </Field>
          <p className="hint" style={{ gridColumn: '1 / -1' }}>On the purchase agreement, the portal and the print copy. The agreement already says the start date is an estimate for planning only.</p>
        </div>
      )}
      {!sold && (
        <div className="grid2">
          <Field label="Scope on the proposal" htmlFor="pp-detail">
            <select id="pp-detail" value={project.proposalDetail ?? 'plain'} onChange={(e) => commit((p) => ({ ...p, proposalDetail: e.target.value === 'full' ? 'full' : undefined }))}>
              <option value="plain">Plain words by area, with approximate sizes</option>
              <option value="full">Every cabinet with its sizes</option>
            </select>
          </Field>
          <label className="chk-row" style={{ gridColumn: '1 / -1' }}><input type="checkbox" checked={!!project.proposalCombine} onChange={(e) => commit((p) => ({ ...p, proposalCombine: e.target.checked || undefined }))} /> List identical cabinets once ("B1, B2 and B3 (3 alike)"), even when they're on different walls</label>
          <p className="hint" style={{ alignSelf: 'end' }}>{(project.proposalDetail ?? 'plain') === 'plain' ? 'Each cabinet with its approximate size, in plain words. Exact sizes come with the drawings they approve after signing.' : 'Shows every cabinet’s size. Anyone they forward it to can quote from it.'}</p>
        </div>
      )}
      {!sold && !(st?.signed && !st.cancelled) && (
        <div className="pgroup">
          <label className="chk-row"><input type="checkbox" checked={!!project.designFirst} onChange={(e) => commit((p) => ({ ...p, designFirst: e.target.checked || undefined }))} /> Returning client: share the design before the proposal</label>
          <p className="hint">{project.designFirst
            ? 'The full drawings (with sizes) and the 3D go on their page stamped DRAFT, with no price and nothing to sign, for them to mark up. Each new draft replaces the last. Publish the proposal to the same page once the layout is settled.'
            : 'Off: drawings and the 3D stay off their page until they sign, so nobody can shop your design around. Turn it on for a client you trust.'}</p>
          {project.designFirst && <button className="primary" disabled={!!busy} onClick={shareDraft}>{st?.design_shared && st.drawings ? `Update the design draft (now v${st.drawings.version})` : 'Share the design draft'}</button>}
        </div>
      )}
      {!sold && options.length > 0 && <p className="hint">Options they can tick when signing: {options.map((o) => `${o.label} (+${money(o.price)})`).join(', ')}.</p>}
      <p>
        {sold
          ? <>Sold: <b>{money(contractTotal(sold))}</b> under the contract above. Cabinet Studio’s calculated proposal ({money(total)}) stays off the portal for this job.</>
          : <>Proposal: <b>{money(total)}</b>, deposit {money(deposit)} · {renderings ? `${renderings} picture${renderings === 1 ? '' : 's'} of the design` : 'no pictures of the design yet'}</>}
      </p>
      {!sold && (pics.length
        ? <div className="pic-strip">{pics.map((x, i) => <img key={i} src={x.url} alt={x.name} title={x.name} />)}</div>
        : <p className="warn">No pictures of the design will go with the proposal. In <b>Design</b>, turn the 3D view the way you want it and click <b>Save view for proposal</b> (or make a rendering on the Rendering tab).</p>)}
      {portal?.url && (
        <div className="portal-link">
          <input aria-label="Client link" readOnly value={portal.url} onFocus={(e) => e.target.select()} />
          <button onClick={() => copy(portal.url!, 'Link')}>Copy link</button>
          <button onClick={() => copy(message, 'Message')}>Copy message</button>
          <a className="btn" href={portal.url} target="_blank" rel="noopener noreferrer">Preview</a>
          {c.phone && <a className="btn" href={`sms:${c.phone.replace(/[^\d+]/g, '')}?&body=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">Text</a>}
          {c.email && <a className="btn" href={`mailto:${c.email}?subject=${encodeURIComponent(`Your project with CJC Custom Carpentry`)}&body=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">Email</a>}
        </div>
      )}
      {st && <PortalStatus st={st} checkedAt={portal?.checkedAt} />}
      {st?.replaced_signed && !st.signed && (
        <div className="warn">
          <p>Version {st.replaced_signed.version}, signed by {st.replaced_signed.name}, was replaced by this unsigned version {when(st.replaced_signed.at)}. Change orders wait until the page is signed again.</p>
          <button disabled={!!busy} onClick={async () => { if (await askConfirm(`Put version ${st.replaced_signed!.version} back on the page, signed by ${st.replaced_signed!.name}? The unsigned version comes off.`, 'Put the signed version back')) run('Putting the signed version back…', async () => keep(await restoreSigned(st.job_id), portal!.jobId)); }}>Undo: put the signed version back</button>
        </div>
      )}
      {!sold && st?.signed && !st.cancelled && (
        <p className="hint">Signed, so the proposal stays as they signed it. Changes go in a change order below. <button disabled={!!busy} onClick={publish}>Replace the signed agreement…</button></p>
      )}
      {st?.signed && !st.cancelled && <ChangeOrders st={st} project={project} busy={!!busy} run={run} keep={(s2) => keep(s2, portal!.jobId)} copy={copy} />}
      {st?.signed && !st.cancelled && <Invoices st={st} total={st ? total : 0} busy={!!busy} run={run} keep={(s2) => keep(s2, portal!.jobId)} />}
      <div className="order-actions">
        {!sold && <button disabled={!!busy} onClick={showPreview}>Preview what they’ll see</button>}
        {!sold && <button disabled={!!busy} title="The quote in your Word layout with the terms and Notice of Cancellation, to print" onClick={printCopy}>Print copy</button>}
        {!sold && !(st?.signed && !st.cancelled) && <button className="primary" disabled={!!busy} onClick={publish}>{portal?.url ? 'Update the client’s page' : 'Publish proposal'}</button>}
        {portal?.url && <button disabled={!!busy} onClick={refresh}>Check status</button>}
        {portal?.jobId && st?.signed && !st.cancelled && <button disabled={!!busy} title="The customer drawing set (plan and elevations with sizes), for them to review and comment on" onClick={sendDrawings}>{st.drawings ? `Update drawings (v${st.drawings.version})` : 'Send drawings to the client'}</button>}
        {busy && <span className="hint">{busy}</span>}
      </div>
      {note && <p className="ok">{note}</p>}
      {error && <p className="warn">{error}</p>}
      {portal?.jobId && st && <PortalComments st={st} busy={!!busy} run={run} keep={(s2) => keep(s2, portal.jobId)} />}
      {settings && <PortalSettings onClose={() => setSettings(false)} />}
      {preview && <ProposalPreview html={preview.html} offline={preview.offline} onClose={() => setPreview(null)} onPublish={() => { setPreview(null); publish(); }} published={!!portal?.url} />}
    </section>
  );
}

const signedMoney = (v: number) => `${v < 0 ? '−' : ''}${money(Math.abs(v))}`;

/** Changes to a signed job: written up here, approved (signed) or declined by the client on their page. */
function ChangeOrders({ st, project, busy, run, keep, copy }: { st: JobStatus; project: Project; busy: boolean; run: (label: string, fn: () => Promise<void>) => Promise<void>; keep: (s: JobStatus) => void; copy: (text: string, what: string) => void }) {
  type Draft = { title: string; lines: { label: string; amount: string }[]; time: string; unit: 'days' | 'hours'; note: string; billing: 'now' | 'final' };
  // Prices as typed: "$1,200", "-400", "−$400"
  const amt = (v: string) => { const t = v.replace(/[$,\s]/g, '').replace(/^[−–]/, '-'); return t === '' || t === '-' ? NaN : Number(t); };
  // "2", "2 hours", "3 days": the number, and the unit if they wrote one
  const timeOf = (d: Draft) => { const n = parseFloat(d.time.replace(/[^\d.\-]/g, ' ').trim()); return Number.isFinite(n) ? n : null; };
  const [draft, setDraft] = useState<Draft | null>(null);
  const list = (st.change_orders ?? []).filter((c) => !c.voided);
  const signedTotal = st.signed?.total ?? 0;
  const byCheck = st.signed?.payBy === 'check';
  // The design priced the way they pay, against what they signed for
  const designNow = useMemo(() => { try { return byCheck ? priceQuote(project).total : listedPrice(project); } catch { return null; } }, [project, byCheck]);
  const approved = list.filter((c) => c.approved).reduce((t, c) => t + c.amount, 0);
  const pending = list.filter((c) => !c.approved && !c.declined).reduce((t, c) => t + c.amount, 0);
  const unbilled = designNow != null && st.signed?.total != null ? Math.round(designNow - signedTotal - approved - pending) : null;
  const sum = (d: Draft) => d.lines.reduce((t, l) => t + (amt(l.amount) || 0), 0);
  const ok = (d: Draft) => d.title.trim() && d.lines.length && d.lines.every((l) => l.label.trim() && Number.isFinite(amt(l.amount)));
  // What's missing, said plainly, so a grey button explains itself
  const why = (d: Draft) => !d.title.trim() ? 'Give it a title.' : d.lines.some((l) => !l.label.trim()) ? 'Each line needs a description.' : d.lines.some((l) => !Number.isFinite(amt(l.amount))) ? 'Each line needs a price, like 500 or -400 for a credit.' : '';
  // Totals come from the portal: check them fresh when starting one
  const start = () => run('Checking the job…', async () => {
    keep(await jobStatus(st.job_id));
    setDraft({ title: '', lines: [{ label: '', amount: unbilled ? String(unbilled) : '' }], time: '', unit: 'days', note: '', billing: 'final' });
  });
  const send = () => run('Putting the change order on their page…', async () => {
    const d = draft!;
    const r = await publishChangeOrder(st.job_id, { title: d.title.trim(), lines: d.lines.map((l) => ({ label: l.label.trim(), amount: amt(l.amount) })), ...(timeOf(d) != null ? (d.unit === 'hours' ? { hours: timeOf(d)! } : { days: Math.round(timeOf(d)!) }) : {}), ...(d.note.trim() ? { note: d.note.trim() } : {}), billing: d.billing });
    keep(r);
    setDraft(null);
    copy(`Hi${st.signed?.name ? ` ${st.signed.name.split(' ')[0]}` : ''}, here’s the change order for your project to review and approve: ${r.change_order_url}`, 'Message with the link');
  });
  const state = (c: ChangeOrderStatus) => c.approved ? `Approved by ${c.approved.name}, ${when(c.approved.at)}` : c.declined ? `Declined ${when(c.declined.at)}${c.declined.reason ? `: “${c.declined.reason}”` : ''}` : 'Waiting for them';
  const line = (i: number, patch: Partial<Draft['lines'][number]>) => setDraft((d) => d && { ...d, lines: d.lines.map((l, k) => (k === i ? { ...l, ...patch } : l)) });
  return (
    <div className="invoices">
      <h4>Change orders</h4>
      <p className="hint">Your terms call for changes in writing. Each one goes on their page to approve (sign) or decline. Approved ones change the contract total, and the final invoice includes them.</p>
      {list.length > 0 && (
        <table className="doc-table">
          <tbody>
            {list.map((c) => (
              <tr key={c.id}>
                <td><b>{c.number}. {c.title}</b><div className="hint">{c.lines.map((l) => `${l.label} ${signedMoney(l.amount)}`).join(' · ')}{c.hours ? ` · ${c.hours} hours of work` : c.days ? ` · ${c.days > 0 ? '+' : ''}${c.days} working days` : ''}</div></td>
                <td>{signedMoney(c.amount)}</td>
                <td className={c.approved ? 'ok' : c.declined ? 'warn' : ''}>{state(c)}{c.approved && c.amount > 0 ? (c.invoiceId ? ' · invoiced' : c.billing === 'final' ? ' · with the final' : '') : ''}</td>
                <td>
                  <button onClick={() => copy(c.url, 'Link')}>Copy link</button>
                  {!c.approved && !c.declined && <button disabled={busy} onClick={async () => { if (await askConfirm(`Take back change order ${c.number}? It comes off their page.`, 'Take it back')) run('Taking it back…', async () => keep(await voidChangeOrder(st.job_id, c.id))); }}>Take back</button>}
                  {c.approved && c.billing === 'now' && c.amount > 0 && !c.invoiceId && <button disabled={busy} onClick={() => run('Making the invoice in QuickBooks…', async () => keep(await billChangeOrder(st.job_id, c.id)))}>Invoice it</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {st.signed?.total != null && (
        <p>Signed {money(signedTotal)}{approved ? <> · approved changes {signedMoney(approved)} · <b>contract now {money(st.adjusted_total ?? signedTotal + approved)}</b></> : null}{pending ? <> · waiting on {signedMoney(pending)}</> : null}</p>
      )}
      {unbilled != null && Math.abs(unbilled) >= 5 && !draft && <p className="warn">The design now prices {signedMoney(unbilled)} {unbilled > 0 ? 'over' : 'under'} what they signed for, not counting the change orders above{byCheck ? ' (at their check price)' : ''}. If that’s a change they asked for, write it up.</p>}
      {!draft && <div className="order-actions"><button disabled={busy} onClick={start}>New change order…</button></div>}
      {draft && (
        <div className="pgroup">
          <Field label="What’s changing (the title they see)" htmlFor="co-title"><input id="co-title" placeholder="e.g. Add lighting to the bookcases" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
          {draft.lines.map((l, i) => (
            <div key={i} className="pay-form">
              <input aria-label={`Line ${i + 1}`} placeholder="Line (what they see)" style={{ flex: 1 }} value={l.label} onChange={(e) => line(i, { label: e.target.value })} />
              <input aria-label={`Line ${i + 1} price`} inputMode="decimal" placeholder="$ (− for a credit)" style={{ width: 120 }} value={l.amount} onChange={(e) => line(i, { amount: e.target.value })} />
              {draft.lines.length > 1 && <button aria-label="Remove line" onClick={() => setDraft({ ...draft, lines: draft.lines.filter((_, k) => k !== i) })}>✕</button>}
            </div>
          ))}
          <div className="order-actions"><button onClick={() => setDraft({ ...draft, lines: [...draft.lines, { label: '', amount: '' }] })}>Add a line</button>{unbilled ? <span className="hint">The first line starts at the design’s difference, {signedMoney(unbilled)}{byCheck ? ', at their check price' : ''}.</span> : null}</div>
          <div className="grid2">
            <Field label="Time it adds (blank: don’t say)" htmlFor="co-days">
              <div style={{ display: 'flex', gap: 8 }}>
                <input id="co-days" inputMode="decimal" placeholder="e.g. 2" style={{ flex: '1 1 80px', width: 'auto' }} value={draft.time} onChange={(e) => { const v = e.target.value; setDraft({ ...draft, time: v, unit: /hour|hr/i.test(v) ? 'hours' : /day/i.test(v) ? 'days' : draft.unit }); }} />
                <select aria-label="Hours or working days" style={{ flex: '0 0 auto', width: 'auto' }} value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value as 'days' | 'hours' })}><option value="hours">hours of work</option><option value="days">working days</option></select>
              </div>
            </Field>
            <Field label="Billing" htmlFor="co-bill">
              <select id="co-bill" value={sum(draft) > 0 ? draft.billing : 'final'} disabled={!(sum(draft) > 0)} onChange={(e) => setDraft({ ...draft, billing: e.target.value as 'now' | 'final' })}>
                <option value="final">{sum(draft) < 0 ? 'Credit off the final payment' : 'Add to the final payment'}</option>
                <option value="now">Invoice when they approve</option>
              </select>
            </Field>
          </div>
          <Field label="Note for them (optional)" htmlFor="co-note"><textarea id="co-note" rows={2} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></Field>
          <p>This change: <b>{signedMoney(sum(draft))}</b> · contract would be <b>{money((st.adjusted_total ?? signedTotal) + sum(draft))}</b>{byCheck ? <span className="hint"> · they pay by check, so enter check prices</span> : null}</p>
          <div className="order-actions">
            <button className="primary" disabled={busy || !ok(draft)} onClick={send}>Put it on their page</button>
            <button onClick={() => setDraft(null)}>Cancel</button>
            {!ok(draft) && <span className="hint">{why(draft)}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

const kindLabel = { deposit: 'Deposit', final: 'Final', change: 'Change order' } as const;

/** QuickBooks invoices on a signed job: what's open, what's paid, and checks or cash taken in. */
function Invoices({ st, busy, run, keep }: { st: JobStatus; total: number; busy: boolean; run: (label: string, fn: () => Promise<void>) => Promise<void>; keep: (s: JobStatus) => void }) {
  const invs = st.invoices ?? [];
  const [pay, setPay] = useState<{ id: string; method: 'check' | 'cash'; amount: string; ref: string } | null>(null);
  const has = (k: Invoice['kind']) => invs.some((i) => i.kind === k);
  const [change, setChange] = useState<{ amount: string; what: string } | null>(null);
  const make = (kind: Invoice['kind'], amount?: number, what?: string) => run(`Making the ${kindLabel[kind].toLowerCase()} invoice in QuickBooks…`, async () => {
    keep(await createInvoice(st.job_id, kind, amount, what ? `Change order: ${what}` : undefined));
    setChange(null);
  });
  const save = () => run('Recording the payment in QuickBooks…', async () => {
    keep(await recordPayment(st.job_id, pay!.id, pay!.method, Number(pay!.amount), pay!.ref.trim() || undefined));
    setPay(null);
  });
  return (
    <div className="invoices">
      <h4>QuickBooks invoices</h4>
      {st.invoiceError && !has('deposit') && <p className="warn">The deposit invoice didn’t go out: {st.invoiceError}</p>}
      {invs.length ? (
        <table className="doc-table">
          <tbody>
            {invs.map((i) => (
              <tr key={i.id}>
                <td>{kindLabel[i.kind]}{i.number ? ` #${i.number}` : ''}</td>
                <td>{money(i.amount)}</td>
                <td className={i.paid ? 'ok' : ''}>{i.paid ? 'Paid' : `Open ${money(i.balance)}`}{i.emailed ? ' · emailed' : ''}</td>
                <td>{i.payments.map((p) => `${p.method}${p.ref ? ` #${p.ref}` : ''} ${money(p.amount)}`).join(', ')}</td>
                <td>{!i.paid && <button disabled={busy} onClick={() => setPay({ id: i.id, method: 'check', amount: String(i.balance), ref: '' })}>Check or cash…</button>}{i.balance < i.amount && st.url && <a className="btn" href={`${st.url}/receipt/${i.id}`} target="_blank" rel="noopener noreferrer" title="A receipt for the money received on this invoice, to print or send">Receipt</a>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="hint">No invoices yet.</p>}
      {pay && (
        <div className="pay-form">
          <select aria-label="Paid by" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value as 'check' | 'cash' })}><option value="check">Check</option><option value="cash">Cash</option></select>
          <input aria-label="Amount" inputMode="decimal" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
          {pay.method === 'check' && <input aria-label="Check number" placeholder="Check #" value={pay.ref} onChange={(e) => setPay({ ...pay, ref: e.target.value })} />}
          <button className="primary" disabled={busy || !(Number(pay.amount) > 0)} onClick={save}>Record</button>
          <button onClick={() => setPay(null)}>Cancel</button>
        </div>
      )}
      <div className="order-actions">
        {!has('deposit') && <button disabled={busy} onClick={() => make('deposit')}>Send deposit invoice</button>}
        {!has('final') && <button disabled={busy} onClick={() => make('final')}>Send final invoice</button>}
        <button disabled={busy} onClick={() => setChange({ amount: '', what: '' })}>Change order invoice…</button>
      </div>
      {change && (
        <div className="pay-form">
          <input aria-label="Change order" placeholder="What changed" value={change.what} onChange={(e) => setChange({ ...change, what: e.target.value })} />
          <input aria-label="Change order amount" inputMode="decimal" placeholder="$" value={change.amount} onChange={(e) => setChange({ ...change, amount: e.target.value })} />
          <button className="primary" disabled={busy || !(Number(change.amount) > 0) || !change.what.trim()} onClick={() => make('change', Number(change.amount), change.what.trim())}>Send</button>
          <button onClick={() => setChange(null)}>Cancel</button>
        </div>
      )}
    </div>
  );
}

/** The client's questions and change requests from their page, with your answers. */
function PortalComments({ st, busy, run, keep }: { st: JobStatus; busy: boolean; run: (label: string, fn: () => Promise<void>) => Promise<void>; keep: (s: JobStatus) => void }) {
  const [text, setText] = useState('');
  const [about, setAbout] = useState('proposal');
  const list = st.comments ?? [];
  if (!list.length) return <p className="hint">No questions from the client yet. They can write from their page; you’ll see them here (Check status) and by email if that’s set up in Portal settings.</p>;
  const unread = st.unread ?? 0;
  const send = () => run('Sending your answer…', async () => { keep(await replyComment(st.job_id, text.trim(), about)); setText(''); });
  return (
    <div className="pgroup">
      <div className="pgroup-head"><span>Questions and changes</span>{unread > 0 && <span className="warn">{unread} new</span>}</div>
      {list.map((c) => (
        <div key={c.id} className={`portal-msg ${c.from}${c.from === 'client' && !c.read ? ' unread' : ''}`}>
          <div className="hint">{c.name} · {when(c.at)}{c.about !== 'proposal' ? ` · ${c.about}` : ''}{c.mark ? ' · marked a spot' : ''}{c.mark && st.url ? <> · <a href={`${st.url}/drawings#c-${c.id}`} target="_blank" rel="noreferrer">see it</a></> : null}</div>
          <p style={{ whiteSpace: 'pre-wrap', margin: '2px 0 0' }}>{c.text}</p>
        </div>
      ))}
      <Field label="Your answer (shows on their page)" htmlFor="pc-text"><textarea id="pc-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} /></Field>
      <div className="order-actions">
        <select aria-label="About" value={about} onChange={(e) => setAbout(e.target.value)}><option value="proposal">On the project page</option>{st.drawings && <option value="drawings">On the drawings page</option>}</select>
        <button className="primary" disabled={busy || !text.trim()} onClick={send}>Answer</button>
        {unread > 0 && <button disabled={busy} onClick={() => run('Marking read…', async () => keep(await markCommentsRead(st.job_id)))}>Mark read</button>}
      </div>
    </div>
  );
}

function PortalStatus({ st, checkedAt }: { st: JobStatus; checkedAt?: number }) {
  return (
    <ul className="portal-status">
      <li>{st.version ? <>Proposal version {st.version}, published {when(st.publishedAt)}</> : <>Design draft only{st.drawings ? ` (v${st.drawings.version}, ${when(st.drawings.publishedAt)})` : ''}; no proposal yet</>}</li>
      <li>{st.views ? `Opened ${st.views} time${st.views === 1 ? '' : 's'}, last ${when(st.lastViewed!)}` : 'Not opened yet'}</li>
      {st.cancelled ? <li className="warn">Cancelled {when(st.cancelled.at)}. Return any deposit within 10 business days.</li>
        : st.signed ? <li className="ok">Signed by {st.signed.name}, {when(st.signed.at)}.{st.cancelDeadline ? ` They can cancel through midnight ${day(st.cancelDeadline)}; hold off ordering until then.` : ''}</li>
        : st.version ? <li>Not signed yet</li> : null}
      {checkedAt && <li className="hint">Checked {when(checkedAt)}</li>}
    </ul>
  );
}

/** Shop documents Cody keeps in Dropbox, offered for one-click adding. Expiry dates are from the documents themselves. */
const dropboxDocs: { title: string; kind: ShopDoc['kind']; path: string; expires?: string }[] = [
  { title: 'Home Improvement Contractor registration #207489', kind: 'license', path: '/CJC/Docs/Licenses/CJC Custom Carpentry LLC - 207489 - HIC Card.pdf', expires: '2027-02-01' },
  { title: 'Construction Supervisor License #CS-119119', kind: 'license', path: '/CJC/Docs/Licenses/CSL.pdf' },
  { title: 'Certificate of liability insurance', kind: 'insurance', path: '/CJC/Docs/Insurance/COI26.pdf', expires: '2027-02-26' },
];

/** The QuickBooks connection, as the portal has it, and the invoice settings. Connecting itself happens on the portal's own page, where Intuit's sign-in runs. */
function QuickBooksBox() {
  const [qs, setQs] = useState<QbStatus | null>(null);
  const [items, setItems] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const load = async () => {
    setBusy('Checking QuickBooks…'); setError('');
    try {
      const s = await qbStatus();
      setQs(s);
      if (s.connected) setItems(await qbItems());
    } catch (e) { setError(errText(e)); } finally { setBusy(''); }
  };
  useEffect(() => { load(); }, []);
  const put = async (patch: Parameters<typeof qbSettings>[0]) => {
    setError('');
    try { await qbSettings(patch); setQs((q) => q && { ...q, settings: { ...q.settings, ...(patch.item_id !== undefined ? { itemId: patch.item_id, itemName: patch.item_name } : {}), ...(patch.auto_deposit !== undefined ? { autoDeposit: patch.auto_deposit } : {}), ...(patch.email !== undefined ? { email: patch.email } : {}) } }); }
    catch (e) { setError(errText(e)); }
  };
  return (
    <>
      <h3>QuickBooks</h3>
      <div className="qb-box">
        {qs && !qs.configured && <p>Not set up yet: the portal needs your Intuit app’s keys. See <b>QuickBooks setup</b> in the portal instructions, then come back here.</p>}
        {qs?.configured && !qs.connected && <p>Ready to connect. <a href={qs.connectPage} target="_blank" rel="noopener noreferrer">Open the QuickBooks page</a>, paste your SHOP_KEY and sign in to QuickBooks. Then <button className="link-btn" onClick={load}>check again</button>.</p>}
        {qs?.connected && (
          <>
            <p className="ok">Connected to <b>{qs.company || 'your company'}</b>{qs.sandbox ? ' (test company)' : ''}. <a href={qs.connectPage} target="_blank" rel="noopener noreferrer">Reconnect or disconnect</a></p>
            <label>Product/service on invoices
              <select value={qs.settings.itemId ?? ''} onChange={(e) => put({ item_id: e.target.value, item_name: items.find((i) => i.id === e.target.value)?.name })}>
                <option value="">Pick one…</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </label>
            {!qs.settings.itemId && <p className="warn">Pick one so invoices can be made. A service item like “Custom cabinetry” works; make one in QuickBooks if you need to.</p>}
            <label className="chk-row"><input type="checkbox" checked={qs.settings.autoDeposit} onChange={(e) => put({ auto_deposit: e.target.checked })} /> Send the deposit invoice as soon as the client signs</label>
            <label className="chk-row"><input type="checkbox" checked={qs.settings.email} onChange={(e) => put({ email: e.target.checked })} /> Have QuickBooks email invoices (with its Pay now button)</label>
            <p className="hint">Invoice lines are marked non-taxable. The client’s page shows a “Pay by card or bank transfer” button when QuickBooks Payments is on for your company.</p>
          </>
        )}
        {busy && <p className="hint">{busy}</p>}
        {error && <p className="warn">{error}</p>}
      </div>
    </>
  );
}

function PortalSettings({ onClose }: { onClose: () => void }) {
  const [shop, setShop] = useState<Shop | null>(null);
  const [company, setCompany] = useState('');
  const [about, setAbout] = useState('');
  const [terms, setTerms] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState('Loading the portal…');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [add, setAdd] = useState<{ title: string; kind: ShopDoc['kind']; expires: string }>({ title: '', kind: 'license', expires: '' });

  const fill = (s: Shop) => {
    setShop(s);
    setCompany((s.company.length ? s.company : COMPANY).join('\n'));
    setAbout(s.about); setTerms(s.terms); setEmail(s.contactEmail ?? '');
  };
  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setError(''); setNote('');
    try { await fn(); } catch (e) { setError(errText(e)); } finally { setBusy(''); }
  };
  useEffect(() => { run('Loading the portal…', async () => fill(await getShop())); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => run('Saving…', async () => {
    fill(await updateShop({ company: company.split('\n').map((l) => l.trim()).filter(Boolean), about, terms, contactEmail: email.trim() }));
    setNote('Saved. Every client page shows it now; signed agreements keep the terms they were signed with.');
  });
  const docAdded = (d: ShopDoc) => setShop((s) => s && { ...s, docs: [...s.docs.filter((x) => x.id !== d.id), d] });
  const fromDropbox = (d: (typeof dropboxDocs)[number]) => run(`Copying ${d.title} from Dropbox…`, async () => {
    const link = await downloadLink(d.path).catch((e) => { throw new PortalError((e as Error).message); });
    const old = shop?.docs.find((x) => x.title === d.title);
    docAdded(await uploadShopDoc({ id: old?.id, title: d.title, kind: d.kind, mimeType: 'application/pdf', expires: d.expires, source_url: link.url }));
    setNote(`Added ${d.title}.`);
  });
  const fromFile = (f: File) => run(`Uploading ${f.name}…`, async () => {
    if (f.size > 20e6) throw new PortalError('That file is over 20 MB.');
    docAdded(await uploadShopDoc({ title: add.title.trim() || f.name.replace(/\.[^.]+$/, ''), kind: add.kind, mimeType: f.type || 'application/pdf', expires: add.expires || undefined, data: await blobToBase64(f) }));
    setAdd({ title: '', kind: 'license', expires: '' });
    setNote(`Added ${f.name}.`);
  });
  const remove = (d: ShopDoc) => run('Removing…', async () => {
    if (!(await askConfirm(`Take “${d.title}” off every client page?`, 'Remove'))) return;
    await deleteShopDoc(d.id);
    setShop((s) => s && { ...s, docs: s.docs.filter((x) => x.id !== d.id) });
  });
  const soon = shop ? expiring(shop.docs) : [];

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal wide portal-settings" role="dialog" aria-modal="true" aria-labelledby="ps-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="ps-title">Portal settings</h2>
        <p className="hint">What every client page shows. Changes here reach the clients’ pages right away.</p>
        {soon.map((d) => <p key={d.id} className="warn">{d.title} {d.daysLeft < 0 ? 'has expired' : `expires in ${d.daysLeft} day${d.daysLeft === 1 ? '' : 's'}`} ({d.expires}). Upload the renewed one.</p>)}
        {shop && (
          <>
            <div className="grid2">
              <label>Company lines<textarea className="plain" rows={4} value={company} onChange={(e) => setCompany(e.target.value)} /></label>
              <label>Contact email for clients<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cody@cjccustomcarpentry.com" /></label>
            </div>
            <label>About you<textarea className="plain" rows={5} value={about} placeholder="A few lines about you and the shop: how long you’ve been building, how you work, what clients can expect." onChange={(e) => setAbout(e.target.value)} /></label>
            <label>
              Terms and conditions <span className="hint">(blank line between sections)</span>
              <textarea className="plain" rows={10} value={terms} onChange={(e) => setTerms(e.target.value)} />
            </label>
            {terms.trim() !== CJC_TERMS && <button onClick={() => setTerms(CJC_TERMS)}>{terms.trim() ? 'Replace with my revised terms doc (Oct 30)' : 'Start from my terms doc'}</button>}
            <p className="hint">The Notice of Cancellation is the last part of the terms. Its [DATE OF TRANSACTION] and [CANCELLATION DEADLINE] are filled in on the client’s signed copy; nothing else adds a notice.</p>
            <div className="modal-actions"><button className="primary" disabled={!!busy} onClick={save}>Save profile</button></div>

            <h3>Licenses, insurance and documents</h3>
            <table className="doc-table">
              <tbody>
                {shop.docs.map((d) => (
                  <tr key={d.id}><td>{d.title}</td><td>{d.kind}</td><td>{d.expires ? `valid through ${d.expires}` : ''}</td><td><button className="icon-btn" aria-label={`Remove ${d.title}`} onClick={() => remove(d)}>×</button></td></tr>
                ))}
                {!shop.docs.length && <tr><td className="hint">None yet.</td></tr>}
              </tbody>
            </table>
            <div className="order-actions">
              {dropboxDocs.map((d) => (
                <button key={d.path} disabled={!!busy} onClick={() => fromDropbox(d)}>{shop.docs.some((x) => x.title === d.title) ? 'Replace' : 'Add'} {d.kind === 'insurance' ? 'insurance certificate' : d.title.split(' #')[0]} from Dropbox</button>
              ))}
            </div>
            <div className="grid3 doc-add">
              <label>Title<input value={add.title} placeholder="e.g. Workers’ comp certificate" onChange={(e) => setAdd({ ...add, title: e.target.value })} /></label>
              <label>Kind
                <select value={add.kind} onChange={(e) => setAdd({ ...add, kind: e.target.value as ShopDoc['kind'] })}>
                  <option value="license">License</option><option value="insurance">Insurance</option><option value="terms">Terms (PDF)</option><option value="other">Other</option>
                </select>
              </label>
              <label>Expires<input type="date" value={add.expires} onChange={(e) => setAdd({ ...add, expires: e.target.value })} /></label>
            </div>
            <FileButton className="file-btn" accept="application/pdf,image/*" onFiles={(fl) => { const f = fl?.[0]; if (f) fromFile(f); }}>Upload a PDF…</FileButton>
          </>
        )}
        {shop && <QuickBooksBox />}
        {busy && <p className="hint">{busy}</p>}
        {note && <p className="ok">{note}</p>}
        {error && <p className="warn">{error}</p>}
        <div className="modal-actions"><button onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

/** The client's page before it goes up, at phone or computer width. Links and signing are off. */
function ProposalPreview({ html, offline, onClose, onPublish, published }: { html: string; offline: boolean; onClose: () => void; onPublish: () => void; published: boolean }) {
  const [phone, setPhone] = useState(true);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal wide preview-modal" role="dialog" aria-modal="true" aria-labelledby="pv-title" onClick={(e) => e.stopPropagation()}>
        <div className="sec-head">
          <h2 id="pv-title">Preview: the client’s page</h2>
          <div className="seg" role="group" aria-label="Screen">
            <button className={phone ? 'on' : ''} aria-pressed={phone} onClick={() => setPhone(true)}>Phone</button>
            <button className={!phone ? 'on' : ''} aria-pressed={!phone} onClick={() => setPhone(false)}>Computer</button>
          </div>
        </div>
        <p className="hint">Exactly what they’ll see once it’s published. Nothing has gone to the client yet; links and signing don’t work here.{offline ? ' The portal couldn’t be reached, so your terms and shop details are the defaults built into Cabinet Studio.' : ''}</p>
        <div className="preview-frame" style={{ width: phone ? 390 : '100%' }}>
          <iframe title="Client page preview" sandbox="allow-scripts" srcDoc={html} />
        </div>
        <div className="modal-actions">
          <button onClick={onClose}>Close</button>
          <button className="primary" onClick={onPublish}>{published ? 'Update the client’s page' : 'Publish proposal'}</button>
        </div>
      </div>
    </div>
  );
}
