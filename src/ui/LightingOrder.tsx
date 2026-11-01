import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { controlLabel, electricianHtml, lightingJobOf, lightingParts, type Control, type LightingJob, type PartKey } from '../model/cabinetLighting';
import { capability, type Downloads } from '../runtime';
import { clientName, clientOf, COMPANY } from '../model/client';
import { Field } from './fields';

const money = (v: number) => `$${v.toFixed(2)}`;

/** Cabinet lighting for the job: the parts to price, your prices, and the electrician's sheet. */
export function LightingOrder() {
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  const job = lightingJobOf(project);
  const L = useMemo(() => lightingParts(project), [project]);
  const [msg, setMsg] = useState('');
  if (!L.fixtures.length) return null;
  const put = (patch: Partial<LightingJob>) => commit((p) => ({ ...p, cabLighting: { ...p.cabLighting, ...patch } }));
  const price = (k: PartKey, v: string) => {
    const n = parseFloat(v);
    const prices = { ...job.prices };
    if (Number.isFinite(n)) prices[k] = n; else delete prices[k];
    put({ prices });
  };
  const total = L.parts.reduce((t, x) => t + x.qty * (job.prices[x.key] ?? 0), 0);
  const sheet = async () => {
    setMsg('');
    const c = clientOf(project);
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Cabinet lighting - ${clientName(c) || project.name}</title><style>body{font:11pt/1.45 Arial,sans-serif;max-width:7.5in;margin:.5in auto;color:#111}table{border-collapse:collapse;width:100%;margin:6px 0 14px}th,td{border:1px solid #999;padding:4px 6px;text-align:left;vertical-align:top;font-size:10pt}th{background:#eee}h2{font-size:14pt}h3{font-size:11.5pt;margin:14px 0 4px}.co{font-size:9pt;color:#444}</style></head><body><p class="co">${COMPANY.join(' · ')}</p><p><b>${clientName(c)}</b><br>${c.address}</p>${electricianHtml(project)}</body></html>`;
    const data = new Blob([html], { type: 'text/html' });
    const filename = `${clientName(c) || project.name} - cabinet lighting for the electrician.html`;
    try {
      const downloads = await capability<Downloads>('downloads');
      if (downloads) await downloads.save({ filename, data });
      else { const a = document.createElement('a'); a.href = URL.createObjectURL(data); a.download = filename; a.click(); }
    } catch (e) { const code = (e as { code?: string }).code; if (code !== 'declined' && code !== 'cancelled') setMsg('Couldn’t save the sheet.'); }
  };
  return (
    <div className="pgroup">
      <div className="pgroup-head">
        <span>Cabinet lighting</span>
        <span className="muted">{L.fixtures.length} fixtures · {Math.round(L.watts)} W · {L.drivers.length} driver{L.drivers.length === 1 ? '' : 's'}{total ? ` · ${money(total)}` : ''}</span>
      </div>
      <div className="grid2">
        <Field label="Color temperature" htmlFor="cl-k">
          <select id="cl-k" value={job.kelvin} onChange={(e) => put({ kelvin: +e.target.value as LightingJob['kelvin'] })}>
            {[2700, 3000, 3500, 4000].map((k) => <option key={k} value={k}>{k}K{k === 2700 ? ' (warm)' : k === 3000 ? ' (warm white)' : ''}</option>)}
          </select>
        </Field>
        <Field label="Switching" htmlFor="cl-ctl">
          <select id="cl-ctl" value={job.control} onChange={(e) => put({ control: e.target.value as Control })}>
            {(Object.keys(controlLabel) as Control[]).map((k) => <option key={k} value={k}>{controlLabel[k]}</option>)}
          </select>
        </Field>
        <Field label="Tape draw (W per ft, from the product)" htmlFor="cl-w"><input id="cl-w" inputMode="decimal" value={job.wattsPerFt} onChange={(e) => put({ wattsPerFt: parseFloat(e.target.value) || 0 })} /></Field>
        <Field label="Each puck (W)" htmlFor="cl-p"><input id="cl-p" inputMode="decimal" value={job.puckWatts} onChange={(e) => put({ puckWatts: parseFloat(e.target.value) || 0 })} /></Field>
      </div>
      <Field label="Where the drivers go (for the electrician)" htmlFor="cl-at"><input id="cl-at" value={job.driverAt} onChange={(e) => put({ driverAt: e.target.value })} /></Field>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Part</th><th>Spec to match</th><th className="num">Qty</th><th className="num">Your price</th><th className="num">Total</th></tr></thead>
          <tbody>
            {L.parts.map((x) => (
              <tr key={x.key}>
                <td>{x.label}<div className="check-hint"><a href={x.search} target="_blank" rel="noreferrer">Find it</a></div></td>
                <td className="spec">{x.spec}</td>
                <td className="num">{x.qty} {x.unit}</td>
                <td className="num"><input aria-label={`Price for ${x.label}, per ${x.unit === 'ft' ? 'foot' : 'each'}`} inputMode="decimal" style={{ width: 70 }} value={job.prices[x.key] ?? ''} placeholder={x.unit === 'ft' ? '$/ft' : '$ ea'} onChange={(e) => price(x.key, e.target.value)} /></td>
                <td className="num">{job.prices[x.key] != null ? money(x.qty * job.prices[x.key]!) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">Prices go into the quote as you enter them. Drivers are sized per wall with 20% headroom; lengths include 10% for cutting.</p>
      <p><button onClick={sheet}>Sheet for the electrician</button> {msg && <span className="warn">{msg}</span>}</p>
    </div>
  );
}
