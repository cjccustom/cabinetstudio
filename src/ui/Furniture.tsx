// Dining tables on the Quote tab: size it, pick top and base, see seating, wood movement and
// the price that goes on the proposal, with a plan and side view to show the client.
import { useMemo } from 'react';
import { useStore } from '../store';
import { furnitureOf, newTable, seats, tableBaseLabel, tableChecks, tableEstimate, tableFinishLabel, type DiningTable, type TableBase, type TableFinish, type TableLeg } from '../model/furniture';
import { priceQuote, quoteOf } from '../model/quote';
import { Field, LengthInput, Section } from './fields';
import { fmt } from '../units';

const money = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;
const species = ['White oak', 'Rift white oak', 'Red oak', 'Walnut', 'Cherry', 'Hard maple', 'Ash', 'Hickory', 'Mahogany', 'Poplar'];

export function FurnitureSection() {
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  const tables = furnitureOf(project);
  const setAll = (next: DiningTable[]) => commit((p) => ({ ...p, furniture: next }));
  const put = (id: string, patch: Partial<DiningTable>) => setAll(tables.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  return (
    <Section title="Furniture" aside={<button className="mini" onClick={() => setAll([...tables, newTable()])}>Add table</button>}>
      {!tables.length && <p className="hint">Dining tables: size and seating, top and base, leaves, species and finish, priced with your shop rate.</p>}
      {tables.map((t) => <TableEditor key={t.id} t={t} put={(patch) => put(t.id, patch)} remove={() => setAll(tables.filter((x) => x.id !== t.id))} />)}
    </Section>
  );
}

function TableEditor({ t, put, remove }: { t: DiningTable; put: (p: Partial<DiningTable>) => void; remove: () => void }) {
  const project = useStore((s) => s.project);
  const est = useMemo(() => tableEstimate(t, project), [t, project]);
  const q = quoteOf(project);
  const hours = est.hours.reduce((s, h) => s + h.hours, 0);
  const mats = est.materials.reduce((s, m) => s + m.cost, 0);
  // The table's share of the furniture line, as it goes on the proposal
  const r = useMemo(() => priceQuote(project), [project]);
  const fg = r.groups.find((g) => g.group === 'furniture');
  const allHours = r.hours.filter((h) => h.group === 'furniture').reduce((s, h) => s + h.hours, 0) || 1;
  const price = fg ? (fg.price * hours) / allHours * (1 + q.workloadAdj[q.workload]) : 0;
  const len = (k: keyof DiningTable, label: string) => (
    <Field label={label} htmlFor={`t-${k}-${t.id}`}><LengthInput id={`t-${k}-${t.id}`} value={t[k] as number} onChange={(v) => v != null && put({ [k]: v } as Partial<DiningTable>)} /></Field>
  );
  const id = (k: string) => `t-${k}-${t.id}`;
  return (
    <div className="stock-row table-ed">
      <div className="sr-head">
        <input aria-label="Name" value={t.name} onChange={(e) => put({ name: e.target.value })} />
        <button className="icon-btn" aria-label="Remove table" onClick={remove}>×</button>
      </div>
      <TableSketch t={t} />
      <div className="grid3">{len('length', 'Length')}{len('width', 'Width')}{len('height', 'Height')}</div>
      <p className="hint">Seats {seats(t)}{t.leaves ? `, ${seats(t, true)} with the leaves in (${fmt(t.length + t.leaves * t.leafWidth)} long)` : ''}.</p>
      <div className="grid3">
        {len('top', 'Top thickness')}
        <Field label="Species" htmlFor={id('sp')}>
          <input id={id('sp')} list="table-species" value={t.species} onChange={(e) => put({ species: e.target.value })} />
          <datalist id="table-species">{species.map((s) => <option key={s} value={s} />)}</datalist>
        </Field>
        <Field label="Lumber $/BF" htmlFor={id('bf')}><input id={id('bf')} inputMode="decimal" value={t.pricePerBF || ''} placeholder={String(project.speciesPrices?.[t.species] ?? '')} onChange={(e) => put({ pricePerBF: parseFloat(e.target.value) || 0 })} /></Field>
      </div>
      <div className="grid3">
        <Field label="Base" htmlFor={id('base')}>
          <select id={id('base')} value={t.base} onChange={(e) => put({ base: e.target.value as TableBase })}>{Object.entries(tableBaseLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </Field>
        {t.base === 'legs' && (
          <>
            <Field label="Legs" htmlFor={id('leg')}>
              <select id={id('leg')} value={t.leg} onChange={(e) => put({ leg: e.target.value as TableLeg })}><option value="square">Square</option><option value="tapered">Tapered</option><option value="turned">Turned</option></select>
            </Field>
            {len('legSize', 'Leg size')}
          </>
        )}
      </div>
      {t.base === 'legs' && (
        <div className="grid3">
          {len('apron', 'Apron height')}
          {t.leg === 'turned' && <Field label="Turning, each ($)" htmlFor={id('turn')}><input id={id('turn')} inputMode="decimal" value={t.turningEach || ''} onChange={(e) => put({ turningEach: parseFloat(e.target.value) || 0 })} /></Field>}
        </div>
      )}
      <div className="grid3">
        <Field label="Leaves" htmlFor={id('lv')}>
          <select id={id('lv')} value={t.leaves} onChange={(e) => put({ leaves: Number(e.target.value) })}>{[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n || 'None'}</option>)}</select>
        </Field>
        {t.leaves > 0 && len('leafWidth', 'Leaf width')}
        <Field label="Edge" htmlFor={id('edge')}>
          <select id={id('edge')} value={t.edge} onChange={(e) => put({ edge: e.target.value as DiningTable['edge'] })}><option value="eased">Eased</option><option value="profile">Profiled</option><option value="live">Live edge</option></select>
        </Field>
      </div>
      <label className="chk-row"><input type="checkbox" checked={t.breadboard} onChange={(e) => put({ breadboard: e.target.checked })} /> Breadboard ends</label>
      <div className="grid2">
        <Field label="Finish" htmlFor={id('fin')}>
          <select id={id('fin')} value={t.finish} onChange={(e) => put({ finish: e.target.value as TableFinish })}>{Object.entries(tableFinishLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </Field>
        {t.finish === 'painter' && <Field label="Finisher’s price ($)" htmlFor={id('fp')}><input id={id('fp')} inputMode="decimal" value={t.finishPrice || ''} onChange={(e) => put({ finishPrice: parseFloat(e.target.value) || 0 })} /></Field>}
      </div>
      <ul className="table-checks">{tableChecks(t).map((c) => <li key={c}>{c}</li>)}</ul>
      <table className="totals">
        <tbody>
          {est.hours.map((h) => <tr key={h.label}><td>{h.label}</td><td className="num">{h.hours.toFixed(1)} h</td></tr>)}
          {est.materials.map((m) => <tr key={m.label}><td>{m.label}<span className="note">{m.detail}</span></td><td className="num">{money(m.cost)}</td></tr>)}
          <tr className="sum"><td>{hours.toFixed(1)} h, {money(mats)} materials · price</td><td className="num">{money(price)}</td></tr>
        </tbody>
      </table>
      <p className="hint">Hours are starting standards for a one-off table; adjust as you build them. The price uses your pricing method and goes on the proposal as Furniture.</p>
      <Field label="Notes" htmlFor={id('notes')}><textarea id={id('notes')} rows={2} value={t.notes} onChange={(e) => put({ notes: e.target.value })} /></Field>
    </div>
  );
}

/** Plan and side view, to scale, for talking it through with the client. */
export function TableSketch({ t }: { t: DiningTable }) {
  const W = 300, pad = 8;
  const k = (W - 2 * pad) / Math.max(t.length, 1);
  const planH = t.width * k, sideH = t.height * k;
  const chairD = 7 * k;
  const x0 = pad, yPlan = pad + chairD, ySide = yPlan + planH + chairD + pad * 2, floor = ySide + sideH;
  const H = floor + 16;
  const legW = (t.base === 'legs' ? t.legSize : 3) * k;
  const inset = t.base === 'legs' ? 1.5 * k : 0;
  const top = t.top * k;
  const seatsN = Math.floor((t.length - (t.base === 'legs' ? 2 * t.legSize : 0)) / 24);
  const chairs = Array.from({ length: seatsN }, (_, i) => x0 + ((i + 0.5) * (t.length / seatsN)) * k);
  const base = (() => {
    if (t.base === 'legs') {
      const l = [x0 + inset, x0 + t.length * k - inset - legW];
      const taper = t.leg === 'tapered' ? legW * 0.35 : 0;
      return <>{l.map((x, i) => <path key={i} d={`M${x},${ySide + top} h${legW} l${-taper * (i ? 0 : 1)},${sideH - top} h${-(legW - taper)} z`} />)}<rect x={x0 + inset} y={ySide + top} width={t.length * k - 2 * inset} height={t.apron * k} /></>;
    }
    if (t.base === 'trestle') {
      const ends = [x0 + 14 * k, x0 + (t.length - 14) * k];
      return <>{ends.map((x, i) => <g key={i}><rect x={x - 1.5 * k} y={ySide + top} width={3 * k} height={sideH - top - 3 * k} /><rect x={x - 1.5 * k} y={floor - 3 * k} width={3 * k} height={3 * k} /></g>)}<rect x={ends[0]} y={ySide + top + (sideH - top) * 0.45} width={ends[1] - ends[0]} height={3 * k} /></>;
    }
    const cols = t.base === 'pedestal' ? [x0 + (t.length / 2) * k] : [x0 + (t.length * 0.27) * k, x0 + (t.length * 0.73) * k];
    return <>{cols.map((x, i) => <g key={i}><rect x={x - 3 * k} y={ySide + top} width={6 * k} height={sideH - top - 3 * k} /><rect x={x - 12 * k} y={floor - 3 * k} width={24 * k} height={3 * k} /></g>)}</>;
  })();
  return (
    <svg className="table-sketch" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Plan and side view, ${fmt(t.length)} by ${fmt(t.width)}`}>
      <g className="ts-chairs">{chairs.map((x, i) => <g key={i}><rect x={x - 9 * k} y={yPlan - 6 * k} width={18 * k} height={5 * k} rx={1} /><rect x={x - 9 * k} y={yPlan + planH + 1 * k} width={18 * k} height={5 * k} rx={1} /></g>)}</g>
      <rect className="ts-top" x={x0} y={yPlan} width={t.length * k} height={planH} rx={t.edge === 'live' ? 6 : 1} />
      {t.breadboard && <><line className="ts-line" x1={x0 + 3 * k} y1={yPlan} x2={x0 + 3 * k} y2={yPlan + planH} /><line className="ts-line" x1={x0 + (t.length - 3) * k} y1={yPlan} x2={x0 + (t.length - 3) * k} y2={yPlan + planH} /></>}
      {t.leaves > 0 && <line className="ts-line dash" x1={x0 + (t.length / 2) * k} y1={yPlan} x2={x0 + (t.length / 2) * k} y2={yPlan + planH} />}
      <g className="ts-base">{base}</g>
      <rect className="ts-top" x={x0} y={ySide} width={t.length * k} height={top} />
      <line className="ts-line" x1={0} y1={floor} x2={W} y2={floor} />
      <text x={W / 2} y={yPlan + planH / 2 + 4} textAnchor="middle">{fmt(t.length)} × {fmt(t.width)}</text>
      <text x={W / 2} y={floor + 12} textAnchor="middle">Side view, {fmt(t.height)} high</text>
    </svg>
  );
}
