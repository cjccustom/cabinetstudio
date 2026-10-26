// The client portal from Cabinet Studio's side: publish the proposal and renderings to the
// client's private page, send them the link, see whether they've looked and signed, and keep
// the shop profile (about, terms, licenses, insurance) every client page shows.
import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { clientName, clientOf, COMPANY, quoteDoc, quoteTotals } from '../model/client';
import { renderOf } from '../model/rendering';
import { CJC_TERMS } from '../model/terms';
import { shrinkImage } from '../runtime';
import { downloadLink } from '../dropbox';
import {
  blobToBase64, createInvoice, deleteShopDoc, expiring, getShop, jobStatus, PortalError, publishProposal, qbItems, qbSettings, qbStatus, recordPayment, updateShop, uploadShopDoc,
  type Invoice, type JobStatus, type QbStatus, type Shop, type ShopDoc,
} from '../portal';
import { askConfirm } from './Confirm';
import type { Project } from '../model/types';

const money = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;
const when = (t: number) => new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const day = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const errText = (e: unknown) => (e instanceof PortalError ? e.message : `Something went wrong: ${(e as Error).message}`);

/** A job id the portal can use in a URL-safe key: the client's last name plus a short random tail, made once per job. */
const newJobId = (p: Project) => {
  const c = clientOf(p);
  const base = (c.last || c.first || p.name || 'job').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'job';
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
};

/** The renderings that go to the client: the one picked for the quote first, at most six. */
async function renderingsFor(p: Project) {
  const r = renderOf(p);
  const imgs = r.images.filter((i) => i.kind === 'rendering').sort((a, b) => Number(b.id === r.quoteId) - Number(a.id === r.quoteId)).slice(0, 6);
  const out = [];
  for (const img of imgs) {
    const blob = await shrinkImage(await (await fetch(img.url)).blob(), 1800, 0.85);
    out.push({ name: img.name || 'Rendering', mimeType: 'image/jpeg', data: await blobToBase64(blob) });
  }
  return out;
}

export function ClientPortal() {
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [settings, setSettings] = useState(false);
  const c = clientOf(project);
  const portal = project.portal;
  const st = portal?.status;
  const { total, deposit } = quoteTotals(project);
  const renderings = renderOf(project).images.filter((i) => i.kind === 'rendering').length;

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setError(''); setNote('');
    try { await fn(); } catch (e) { setError(errText(e)); } finally { setBusy(''); }
  };
  const keep = (status: JobStatus, jobId: string) =>
    commit((p) => ({ ...p, portal: { jobId, url: status.url, status, checkedAt: Date.now() } }));

  const publish = () => run(portal ? 'Updating the client’s page…' : 'Publishing the proposal…', async () => {
    if (!total) throw new PortalError('The quote is $0. Price the job in the Quote tab first.');
    if (!clientName(c).trim()) throw new PortalError('Add the client’s name above first.');
    let replaceSigned = false;
    if (st?.signed && !st.cancelled) {
      if (!(await askConfirm(`${st.signed.name} already signed version ${st.signed.version}. Put up a new version for them to sign? The signed one stays on record.`, 'Publish new version'))) return;
      replaceSigned = true;
    }
    const jobId = portal?.jobId ?? newJobId(project);
    const status = await publishProposal({
      job_id: jobId, project: project.name || 'Your project',
      client: { first: c.first, last: c.last, email: c.email, phone: c.phone, address: c.address },
      agreement_html: quoteDoc(project, { online: true }), total, deposit,
      renderings: await renderingsFor(project), replace_signed: replaceSigned,
    });
    keep(status, jobId);
    setNote(`Published version ${status.version}. Send ${c.first || 'the client'} the link below.`);
  });

  const refresh = () => run('Checking…', async () => { keep(await jobStatus(portal!.jobId), portal!.jobId); });
  const copy = (text: string, what: string) => navigator.clipboard.writeText(text).then(() => setNote(`${what} copied.`), () => setNote('Select the link and copy it.'));
  const message = `Hi ${c.first || 'there'}, here’s your project page with the design, proposal and agreement: ${portal?.url ?? ''}`;

  return (
    <section className="sheet-sec">
      <div className="sec-head">
        <h3>Client portal</h3>
        <button className="link-btn" onClick={() => setSettings(true)}>Portal settings</button>
      </div>
      <p className="hint">The client’s private page: renderings, the scope and purchase agreement, your terms, licenses and insurance. They sign on their phone and get the signed copy with the 3-day Notice of Cancellation.</p>
      <p>
        Proposal: <b>{money(total)}</b>, deposit {money(deposit)} · {renderings ? `${Math.min(renderings, 6)} rendering${renderings === 1 ? '' : 's'}` : 'no renderings yet (Rendering tab)'}
      </p>
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
      {st?.signed && !st.cancelled && <Invoices st={st} total={st ? total : 0} busy={!!busy} run={run} keep={(s2) => keep(s2, portal!.jobId)} />}
      <div className="order-actions">
        <button className="primary" disabled={!!busy} onClick={publish}>{portal ? 'Update the client’s page' : 'Publish proposal'}</button>
        {portal && <button disabled={!!busy} onClick={refresh}>Check status</button>}
        {busy && <span className="hint">{busy}</span>}
      </div>
      {note && <p className="ok">{note}</p>}
      {error && <p className="warn">{error}</p>}
      {settings && <PortalSettings onClose={() => setSettings(false)} />}
    </section>
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
                <td>{!i.paid && <button disabled={busy} onClick={() => setPay({ id: i.id, method: 'check', amount: String(i.balance), ref: '' })}>Check or cash…</button>}</td>
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

function PortalStatus({ st, checkedAt }: { st: JobStatus; checkedAt?: number }) {
  return (
    <ul className="portal-status">
      <li>Version {st.version}, published {when(st.publishedAt)}</li>
      <li>{st.views ? `Opened ${st.views} time${st.views === 1 ? '' : 's'}, last ${when(st.lastViewed!)}` : 'Not opened yet'}</li>
      {st.cancelled ? <li className="warn">Cancelled {when(st.cancelled.at)}. Return any deposit within 10 business days.</li>
        : st.signed ? <li className="ok">Signed by {st.signed.name}, {when(st.signed.at)}.{st.cancelDeadline ? ` They can cancel through midnight ${day(st.cancelDeadline)}; hold off ordering until then.` : ''}</li>
        : <li>Not signed yet</li>}
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
            {!terms.trim() && <button onClick={() => setTerms(CJC_TERMS)}>Start from my terms doc</button>}
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
            <label className="btn file-btn">Upload a PDF…<input type="file" accept="application/pdf,image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) fromFile(f); }} /></label>
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
