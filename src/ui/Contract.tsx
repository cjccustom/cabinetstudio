// The Clients tab's Contract section: what the job sold for. Bring in a quote written in Word
// from the client's Dropbox folder, or lock in Cabinet Studio's own quote; tick the options the
// client chose, set the agreed total and payment schedule, and mark payments as they come in.
import { useState } from 'react';
import { useStore } from '../store';
import { clientOf, proposalLines } from '../model/client';
import { contractTotal, defaultSchedule, parseWordQuote, received, splitNames, type Contract, type ContractLine, type Payment } from '../model/contract';
import { priceQuote } from '../model/quote';
import { uid } from '../model/defaults';
import { listFolder, readFile, DropboxError, type DbxEntry } from '../dropbox';
import { askConfirm } from './Confirm';

const money = (v: number) => `$${Math.round(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const today = () => new Date().toISOString().slice(0, 10);
const num = (s: string) => { const v = parseFloat(s.replace(/[$,]/g, '')); return Number.isFinite(v) ? v : 0; };

export function ContractSection() {
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  const c = project.contract;
  const [files, setFiles] = useState<DbxEntry[] | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const put = (patch: Partial<Contract>) => commit((p) => ({ ...p, contract: { ...p.contract!, ...patch } }));
  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setError('');
    try { await fn(); } catch (e) { setError(e instanceof DropboxError ? e.message : `Something went wrong: ${(e as Error).message}`); } finally { setBusy(''); }
  };

  const findQuotes = () => run('Looking in the client’s folder…', async () => {
    if (!project.dropbox) throw new Error('Open this client from the list (or link a Dropbox folder) first, so I know which folder to look in.');
    const all = await listFolder(project.dropbox.path);
    const docs = all.filter((e) => e.type === 'file' && /\.(docx|pdf)$/i.test(e.name) && !/^~\$/.test(e.name));
    if (!docs.length) throw new Error('No Word or PDF quote in the client’s folder.');
    setFiles(docs);
  });
  const importFile = (f: DbxEntry) => run(`Reading ${f.name}…`, async () => {
    const text = await readFile(f.id || f.path);
    if (!text) throw new Error(`Dropbox couldn’t read the text of ${f.name}.`);
    const r = parseWordQuote(text, f.path);
    if (!r.contract.lines.length) throw new Error(`${f.name} doesn’t look like one of your quotes (no purchase agreement prices found).`);
    const cl = clientOf(project);
    const n = r.client.names ? splitNames(r.client.names) : null;
    const phone = r.client.phones[0]?.replace(/^[^(\d]*-\s*/, '');
    commit((p) => ({
      ...p,
      contract: r.contract,
      // Fill in client details the sheet doesn't have yet; never overwrite what's there
      client: {
        ...p.client,
        ...(!cl.first && n?.first ? { first: n.first } : {}),
        ...(!cl.partner && n?.partner ? { partner: n.partner } : {}),
        ...(!cl.last && n?.last ? { last: n.last } : {}),
        ...(!cl.address && r.client.address ? { address: r.client.address } : {}),
        ...(!cl.phone && phone ? { phone } : {}),
        ...(!cl.email && r.client.email ? { email: r.client.email } : {}),
        ...(!cl.scope && r.contract.title ? { scope: r.contract.title } : {}),
      },
    }));
    setWarnings(r.warnings);
    setFiles(null);
  });
  const fromStudio = () => {
    const r = priceQuote(project);
    const lines: ContractLine[] = proposalLines(project).map((l) => ({ id: uid('cl'), label: l.label, price: l.price, option: false, chosen: true }));
    commit((p) => ({ ...p, contract: { source: 'studio', importedAt: Date.now(), agreementDate: today(), title: p.name, scope: [], allowances: [], lines, totalOverride: undefined, schedule: defaultSchedule(r.total), notes: '' } }));
    setWarnings([]);
  };
  const remove = async () => { if (await askConfirm('Remove the contract from this job? The Word file in Dropbox isn’t touched.', 'Remove')) commit((p) => ({ ...p, contract: undefined })); };

  if (!c) {
    return (
      <section className="sheet-sec">
        <h3>Contract</h3>
        <p className="hint">What the job sold for. For jobs quoted in Word, bring the quote in from the client’s Dropbox folder; for new jobs, lock in this design’s quote once they sign.</p>
        <div className="order-actions">
          <button className="primary" disabled={!!busy} onClick={findQuotes}>Import sold quote from Dropbox</button>
          <button disabled={!!busy} onClick={fromStudio}>Use this design’s quote</button>
          {busy && <span className="hint">{busy}</span>}
        </div>
        {files && (
          <ul className="file-pick">
            {files.map((f) => <li key={f.id || f.path}><button className="link-btn" onClick={() => importFile(f)}>{f.name}</button></li>)}
          </ul>
        )}
        {error && <p className="warn">{error}</p>}
      </section>
    );
  }

  const total = contractTotal(c);
  const sum = c.lines.filter((l) => l.chosen).reduce((t, l) => t + l.price, 0);
  const paid = received(c);
  const scheduled = c.schedule.reduce((t, p) => t + p.amount, 0);
  const putLine = (id: string, patch: Partial<ContractLine>) => put({ lines: c.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
  const putPay = (id: string, patch: Partial<Payment>) => put({ schedule: c.schedule.map((p) => (p.id === id ? { ...p, ...patch } : p)) });

  return (
    <section className="sheet-sec contract">
      <div className="sec-head">
        <h3>Contract{c.title ? `: ${c.title}` : ''}</h3>
        <button className="link-btn" onClick={remove}>Remove</button>
      </div>
      <p className="hint">{c.source === 'word' ? `From ${c.file?.split('/').pop() ?? 'the Word quote'}` : 'Locked in from this design’s quote'}{c.agreementDate ? ` · agreement dated ${c.agreementDate}` : ''}</p>
      {warnings.map((w) => <p key={w} className="warn">{w}</p>)}

      <table className="doc-table contract-lines">
        <tbody>
          {c.lines.map((l) => (
            <tr key={l.id} className={l.chosen ? '' : 'off'}>
              <td><input type="checkbox" aria-label={`Include ${l.label}`} checked={l.chosen} onChange={(e) => putLine(l.id, { chosen: e.target.checked })} /></td>
              <td><input aria-label="Line" value={l.label} onChange={(e) => putLine(l.id, { label: e.target.value })} />{l.option && <span className="pill">option</span>}</td>
              <td><input aria-label={`${l.label} price`} inputMode="decimal" value={l.price} onChange={(e) => putLine(l.id, { price: num(e.target.value) })} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="order-actions"><button onClick={() => put({ lines: [...c.lines, { id: uid('cl'), label: 'Change order', price: 0, option: false, chosen: true }] })}>Add line</button></div>
      <div className="contract-total">
        <label>Agreed total
          <input inputMode="decimal" value={c.totalOverride ?? ''} placeholder={String(sum)} onChange={(e) => put({ totalOverride: e.target.value.trim() ? num(e.target.value) : undefined })} />
        </label>
        <span>{money(total)}{c.totalOverride != null && c.totalOverride !== sum ? <span className="hint"> (lines add to {money(sum)})</span> : ''}</span>
      </div>

      {c.allowances.length > 0 && (
        <>
          <h4>Allowances</h4>
          <table className="doc-table">
            <tbody>
              {c.allowances.map((a) => (
                <tr key={a.id}><td>{a.label}</td><td><input aria-label={`${a.label} allowance`} inputMode="decimal" placeholder="$" value={a.amount || ''} onChange={(e) => put({ allowances: c.allowances.map((x) => (x.id === a.id ? { ...x, amount: num(e.target.value) } : x)) })} /></td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h4>Payment schedule</h4>
      <div className="pay-sched">
          {c.schedule.map((p) => (
            <div className="pay-row" key={p.id}>
              <input aria-label="Payment" value={p.label} onChange={(e) => putPay(p.id, { label: e.target.value })} />
              <input aria-label={`${p.label} amount`} inputMode="decimal" placeholder="$" value={p.amount || ''} onChange={(e) => putPay(p.id, { amount: num(e.target.value) })} />
              <button className="icon-btn" aria-label="Remove payment" onClick={() => put({ schedule: c.schedule.filter((x) => x.id !== p.id) })}>×</button>
              <div className="pay-recv">
                {p.received ? (
                  <span className="recv">
                    <input type="date" aria-label="Received on" value={p.received.on} onChange={(e) => putPay(p.id, { received: { ...p.received!, on: e.target.value } })} />
                    <select aria-label="Paid by" value={p.received.method} onChange={(e) => putPay(p.id, { received: { ...p.received!, method: e.target.value as NonNullable<Payment['received']>['method'] } })}>
                      <option value="check">Check</option><option value="cash">Cash</option><option value="card">Card</option><option value="ach">Bank transfer</option><option value="other">Other</option>
                    </select>
                    {p.received.method === 'check' && <input aria-label="Check number" placeholder="Check #" value={p.received.ref ?? ''} onChange={(e) => putPay(p.id, { received: { ...p.received!, ref: e.target.value } })} />}
                    <span className="ok">Received</span><button className="link-btn" onClick={() => putPay(p.id, { received: undefined })}>undo</button>
                  </span>
                ) : <button disabled={!p.amount} onClick={() => putPay(p.id, { received: { on: today(), method: 'check' } })}>Mark received</button>}
              </div>
            </div>
          ))}
      </div>
      <div className="order-actions">
        <button onClick={() => put({ schedule: [...c.schedule, { id: uid('pay'), label: 'Progress payment', amount: 0 }] })}>Add payment</button>
        {!c.schedule.some((p) => p.amount) && <button onClick={() => put({ schedule: defaultSchedule(total) })}>30% deposit, balance at completion</button>}
      </div>
      <p className={scheduled && Math.round(scheduled) !== Math.round(total) ? 'warn' : 'hint'}>
        Received {money(paid)} of {money(total)} · balance {money(total - paid)}
        {scheduled && Math.round(scheduled) !== Math.round(total) ? ` · the schedule adds to ${money(scheduled)}, not the total` : ''}
      </p>

      {c.scope.length > 0 && (
        <details className="contract-scope">
          <summary>Scope as written ({c.scope.length} sections)</summary>
          {c.scope.map((s) => <div key={s.num + s.title}><b>{s.num ? `${s.num}. ` : ''}{s.title}</b>{s.text.split('\n').map((t, i) => <p key={i}>{t}</p>)}</div>)}
        </details>
      )}
      <label className="contract-notes">Notes<textarea rows={2} value={c.notes} placeholder="What was settled on site, selections still owed, sample approvals…" onChange={(e) => put({ notes: e.target.value })} /></label>
      {error && <p className="warn">{error}</p>}
    </section>
  );
}
