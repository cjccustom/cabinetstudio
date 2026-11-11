import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { accentLabel, cabLightLabel, controlLabel, electricianHtml, hafeleOf, type HafeleSpec, lightingJobOf, lightingParts, type Control, type LightingJob, type PartKey , wireRouteLabel, type WireRoute } from '../model/cabinetLighting';
import { capability, type Downloads } from '../runtime';
import { asciiHtml } from '../dropbox';
import { clientName, clientOf, COMPANY } from '../model/client';
import { Field } from './fields';
import { fmt, parseLength } from '../units';

const money = (v: number) => `$${v.toFixed(2)}`;
const hfLen: [keyof HafeleSpec, string][] = [['profileW', 'Shelf groove width'], ['profileD', 'Shelf groove depth'], ['profileBack', 'Groove back from the drop edge'], ['drop', 'Drop edge below the shelf'], ['railW', 'Bus bar channel width'], ['railD', 'Bus bar channel depth'], ['railBack', 'Bus bar channel from the front edge']];
const hfNo: [keyof HafeleSpec, string][] = [['profileNo', 'Light bar profile (blank: Profile 1103)'], ['railNo', 'Bus bar article no.'], ['connectorNo', 'Power supply kit article no.'], ['driverNo', 'Loox 12 V driver article no.']];

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
  const H = hafeleOf(project);
  const putH = (patch: Partial<HafeleSpec>) => commit((p) => ({ ...p, settings: { ...p.settings, hafele: { ...p.settings.hafele, ...patch } } }));
  const hasShelves = L.fixtures.some((f) => f.kind === 'shelves');
  const hasAccent = L.fixtures.some((f) => f.kind === 'topAccent');
  const total = L.parts.reduce((t, x) => t + x.qty * (job.prices[x.key] ?? 0), 0);
  const partsTotal = L.parts.filter((x) => !x.tooling).reduce((t, x) => t + x.qty * (job.prices[x.key] ?? 0), 0);
  const sheet = async () => {
    setMsg('');
    const c = clientOf(project);
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Cabinet lighting - ${clientName(c) || project.name}</title><style>body{font:11pt/1.45 Arial,sans-serif;max-width:7.5in;margin:.5in auto;color:#111}table{border-collapse:collapse;width:100%;margin:6px 0 14px}th,td{border:1px solid #999;padding:4px 6px;text-align:left;vertical-align:top;font-size:10pt}th{background:#eee}h2{font-size:14pt}h3{font-size:11.5pt;margin:14px 0 4px}.co{font-size:9pt;color:#444}</style></head><body><p class="co">${COMPANY.join(' · ')}</p><p><b>${clientName(c)}</b><br>${c.address}</p>${electricianHtml(project)}</body></html>`;
    const data = new Blob([asciiHtml(html)], { type: 'text/html' });
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
      <Field label="Drivers sit" htmlFor="cl-spot">
        <select id="cl-spot" value={job.driverSpot ?? 'below'} onChange={(e) => commit((p) => { const { driverAt: _d, ...rest } = p.cabLighting ?? {}; void _d; return { ...p, cabLighting: { ...rest, driverSpot: e.target.value as 'below' | 'top' } }; })}>
          <option value="below">In the base cabinets below</option>
          <option value="top">On top of the bookcases, behind the crown</option>
        </select>
      </Field>
      <Field label="Where the drivers go (for the electrician)" htmlFor="cl-at"><input id="cl-at" value={job.driverAt} onChange={(e) => put({ driverAt: e.target.value })} /></Field>
      <Field label="How the wires run to the drivers" htmlFor="cl-route">
        <select id="cl-route" value={job.wireRoute ?? 'dado'} onChange={(e) => put({ wireRoute: e.target.value as WireRoute })}>
          {(Object.keys(wireRouteLabel) as WireRoute[]).map((k) => <option key={k} value={k}>{wireRouteLabel[k]}</option>)}
        </select>
      </Field>
      <div className="grid2">
        <Field label="Fixed strips (section tops, cubbies) built from" htmlFor="cl-fixed">
          <select id="cl-fixed" value={job.fixed} onChange={(e) => put({ fixed: e.target.value as LightingJob['fixed'] })}>
            <option value="loox">Häfele Loox5: 24 V tape in 1103 profiles, same drivers</option>
            <option value="generic">Generic 24 V tape and channel</option>
          </select>
        </Field>
        <Field label="Material allowance until quotes are in ($, blank = the parts priced)" htmlFor="cl-allow">
          <input id="cl-allow" inputMode="decimal" value={job.allowance ?? ''} placeholder={money(partsTotal)} onChange={(e) => { const n = parseFloat(e.target.value); put({ allowance: Number.isFinite(n) && n > 0 ? n : undefined }); }} />
        </Field>
      </div>
      {job.allowance != null && <p className="hint">The quote uses the {money(job.allowance)} allowance for lighting materials in place of the parts ({money(partsTotal)} priced so far), not on top of them. Tax, freight, tooling, labor and markup are apart.</p>}
      {/* Each kind of lighting on the job: in the base price, or a box the customer ticks */}
      <div className="grid2">
        {[...new Set(L.fixtures.map((f) => f.kind))].map((k) => (
          <Field key={k} label={`${cabLightLabel[k].replace(/ \(.*\)$/, '')}: offer as an option named (blank = in the base price)`} htmlFor={`cl-opt-${k}`}>
            <input id={`cl-opt-${k}`} placeholder="In the base price" value={job.options?.[k] ?? ''} onChange={(e) => put({ options: { ...job.options, [k]: e.target.value || undefined } })} />
          </Field>
        ))}
      </div>
      {hasAccent && (
        <div className="grid2">
          <Field label="Accent uplight on top" htmlFor="cl-acc">
            <select id="cl-acc" value={job.accent ?? 'white'} onChange={(e) => put({ accent: e.target.value as LightingJob['accent'] })}>
              {(Object.keys(accentLabel) as (keyof typeof accentLabel)[]).map((k) => <option key={k} value={k}>{accentLabel[k]}</option>)}
            </select>
          </Field>
          {job.accent === 'rgbw' && <Field label="Color shown in 3D" htmlFor="cl-hex"><input id="cl-hex" type="color" value={job.accentHex ?? '#ffb060'} onChange={(e) => put({ accentHex: e.target.value })} /></Field>}
        </div>
      )}
      {hasShelves && (
        <details>
          <summary>Häfele shelf lighting: machining and article numbers</summary>
          <p className="hint">From Häfele’s tech doc (Wireless Adjustable Shelf Lighting System, 2/23); groove sizes read off its drawing, so check them against the parts before cutting. They go on the cut list, the shop drawings and the customer’s spec sheet. Each bar fits its shelf: stock 18/24/30/36" (the cabinet editor offers the case width that fits one), anything else custom from Häfele Service+ (888.437.7477), about 10 days. Blank article numbers use the usual ones for the voltage.</p>
          <div className="grid2">
            <Field label="System voltage" htmlFor="hf-v">
              <select id="hf-v" value={H.volts} onChange={(e) => putH({ volts: Number(e.target.value) as 12 | 24 })}>
                <option value={24}>24 V, LED 3045 (matches Loox5 tape and drivers)</option>
                <option value={12}>12 V, LED 2065 / 2068</option>
              </select>
            </Field>
            {H.volts === 12 && (
              <Field label="Light bar intensity" htmlFor="hf-int">
                <select id="hf-int" value={H.intensity} onChange={(e) => putH({ intensity: e.target.value as HafeleSpec['intensity'] })}>
                  <option value="medium">Medium, LED 2065 (4.8 W/m)</option>
                  <option value="high">High, LED 2068 (9.6 W/m)</option>
                </select>
              </Field>
            )}
            {hfLen.map(([k, label]) => (
              <Field key={`${k}-${H[k]}`} label={label} htmlFor={`hf-${k}`}>
                <input id={`hf-${k}`} defaultValue={fmt(H[k] as number)} onBlur={(e) => { const v = parseLength(e.target.value); if (v != null && v >= 0) putH({ [k]: v }); }} />
              </Field>
            ))}
            {hfNo.map(([k, label]) => (
              <Field key={k} label={label} htmlFor={`hf-${k}`}><input id={`hf-${k}`} value={H[k] as string} placeholder="Häfele no." onChange={(e) => putH({ [k]: e.target.value })} /></Field>
            ))}
          </div>
          <label className="check-inline"><input type="checkbox" checked={!!job.ownBit} onChange={(e) => put({ ownBit: e.target.checked || undefined })} /> The shop already has the bus bar router bit (001.25.921)</label>
        </details>
      )}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Part</th><th>Spec to match</th><th className="num">Qty</th><th className="num">Your price</th><th className="num">Total</th></tr></thead>
          <tbody>
            {L.parts.map((x, i) => (
              <tr key={`${x.key}-${i}`}>
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
