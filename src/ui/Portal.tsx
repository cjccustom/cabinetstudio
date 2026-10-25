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
  blobToBase64, deleteShopDoc, expiring, getShop, jobStatus, PortalError, publishProposal, updateShop, uploadShopDoc,
  type JobStatus, type Shop, type ShopDoc,
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
  const copy = async () => { await navigator.clipboard.writeText(portal!.url!).then(() => setNote('Link copied.'), () => setNote('Select the link and copy it.')); };
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
          <button onClick={copy}>Copy</button>
          {c.phone && <a className="btn" href={`sms:${c.phone.replace(/[^\d+]/g, '')}?&body=${encodeURIComponent(message)}`}>Text</a>}
          {c.email && <a className="btn" href={`mailto:${c.email}?subject=${encodeURIComponent(`Your project with CJC Custom Carpentry`)}&body=${encodeURIComponent(message)}`}>Email</a>}
        </div>
      )}
      {st && <PortalStatus st={st} checkedAt={portal?.checkedAt} />}
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
        {busy && <p className="hint">{busy}</p>}
        {note && <p className="ok">{note}</p>}
        {error && <p className="warn">{error}</p>}
        <div className="modal-actions"><button onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}
