import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { cofferScope, defaultStandards, groupLabel, lineKey, newExtra, paintEstimate, paintRates, type Group, priceQuote, quoteOf, scopeLine, type LaborStandards, type QuoteSettings, type Workload } from '../model/quote';
import { Field, Section } from './fields';
import { QuoteRendering } from './Rendering';
import { FurnitureSection } from './Furniture';
import { furnitureOf, tableScope } from '../model/furniture';
import { optionNames, optionPrices } from '../model/proposal';
import { proposalLines } from '../model/client';
import { defaultSupplies, driverLabel, newSupply, supplyLines, type SupplyDriver, type SupplyItem } from '../model/supplies';

const money = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;
const pct = (v: number) => `${+(v * 100).toFixed(2)}%`;

function useQuote() {
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  const q = quoteOf(project);
  const set = (patch: Partial<QuoteSettings>) => commit((p) => ({ ...p, quote: { ...quoteOf(p), ...patch } }));
  const result = useMemo(() => priceQuote(project), [project]);
  return { project, q, set, result };
}

function Num({ id, label, value, onChange, step = '1', suffix }: { id: string; label: string; value: number; onChange: (v: number) => void; step?: string; suffix?: string }) {
  return (
    <Field label={suffix ? `${label} (${suffix})` : label} htmlFor={id}>
      <input id={id} inputMode="decimal" step={step} value={Number.isFinite(value) ? +value.toFixed(4) : ''} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} />
    </Field>
  );
}

/** A number shown as text; click to type your own. Enter or leaving the box saves it. */
function EditNum({ value, onSave, digits, prefix = '', label }: { value: number; onSave: (v: number) => void; digits: number; prefix?: string; label: string }) {
  const [editing, setEditing] = useState(false);
  if (!editing) {
    return <button className="cell-edit" title="Click to set your own" aria-label={label} onClick={() => setEditing(true)}>{prefix}{digits ? value.toFixed(digits) : Math.round(value).toLocaleString('en-US')}</button>;
  }
  const done = (t: string) => {
    setEditing(false);
    const v = parseFloat(t.replace(/[$,]/g, ''));
    if (Number.isFinite(v) && v >= 0 && Math.abs(v - value) > 1e-6) onSave(v);
  };
  return <input className="cell-input" autoFocus aria-label={label} inputMode="decimal" defaultValue={digits ? value.toFixed(digits) : Math.round(value)}
    onBlur={(e) => done(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') done((e.target as HTMLInputElement).value); if (e.key === 'Escape') setEditing(false); }} />;
}

/* ---------- Left: how the job is priced ---------- */

export function QuoteInputs() {
  const { project, q, set } = useQuote();
  const pe = useMemo(() => paintEstimate(project, q), [project]); // eslint-disable-line react-hooks/exhaustive-deps
  const setStd = (patch: Partial<LaborStandards>) => set({ standards: { ...q.standards, ...patch } });
  const stdFields: [keyof LaborStandards, string][] = [
    ['jobSetup', 'Drawings, ordering, setup (per job)'], ['perBox', 'Case (per cabinet)'], ['tallBox', 'Tall case extra'], ['faceFrame', 'Face frame (per cabinet)'],
    ['perOpening', 'Per face frame opening'], ['perDoor', 'Per door'], ['perDrawer', 'Per drawer'], ['insetFactor', 'Inset multiplier (×)'], ['stainShop', 'Stain grade, shop work (×)'], ['stainInstall', 'Stain grade, install & trim (×)'],
    ['perShelf', 'Per shelf'], ['shelfFront', 'Per applied shelf front'], ['cofferLayout', 'Coffers: layout & prep (per ceiling)'], ['cofferInstallPerFt', 'Coffer beams & fascia, install, per ft'], ['cofferCrownPerCoffer', 'Crown per coffer'], ['cofferPrepPerCoffer', 'Coffer joinery & paint prep, per coffer'], ['soffitPanel', 'Per soffit underside panel'], ['basePiece', 'Per baseboard / skirt piece'], ['archCut', 'Per arched cut'], ['endPanel', 'Per end panel'], ['extendedStile', 'Per extended stile'], ['woodTop', 'Per wood top / seat'],
    ['woodTopPerSqFt', 'Wood top per sq ft'], ['moldingPerFt', 'Moulding prep per ft'], ['beadboardPerSqFt', 'Beadboard per sq ft'],
    ['installPerBox', 'Install per cabinet'], ['installTall', 'Install tall extra'], ['installDay', 'Per install day (load-in, cleanup)'],
    ['moldingInstallPerFt', 'Moulding install per ft'], ['pullInstall', 'Per pull/knob'], ['pilaster', 'Per pilaster'], ['installPilaster', 'Install per pilaster'], ['floatingShelf', 'Per floating shelf'], ['shelfFinishedEnd', 'Per finished shelf end'], ['installFloatingShelf', 'Install per floating shelf'], ['mantelBuild', 'Mantel: legs, frieze & shelf'], ['mantelPilasters', 'Mantel pilaster legs'], ['mantelCorbel', 'Per corbel'], ['mantelPediment', 'Per pediment'], ['mantelUpper', 'Overmantel: upper pilasters & panel'], ['installMantelUpper', 'Install overmantel'], ['chimneyFraming', 'Faux chimney framing & skin'], ['mantelBaseWrap', 'Base wrap at a mantel'], ['fireboxFraming', 'Firebox layout & framing'], ['installMantel', 'Install per mantel'], ['installDoor', 'Install interior door'], ['hangSlab', 'Fit & hang a slab (extra)'],
  ];
  return (
    <aside className="sidebar">
      <div className="side-body">
        <Section title="Pricing method">
          <div className="seg" role="radiogroup" aria-label="Pricing method">
            <button role="radio" aria-checked={q.method === 'multiplier'} className={q.method === 'multiplier' ? 'on' : ''} onClick={() => set({ method: 'multiplier' })}>Cost × multiplier</button>
            <button role="radio" aria-checked={q.method === 'rate'} className={q.method === 'rate' ? 'on' : ''} onClick={() => set({ method: 'rate' })}>Hourly rate + markup</button>
          </div>
          <div className="grid2" style={{ marginTop: 8 }}>
            <Num id="q-cost" label="Your labor cost" suffix="$/hr" value={q.laborCost} onChange={(v) => set({ laborCost: v })} />
            <Num id="q-mult" label="Multiplier" suffix="×" step="0.05" value={q.multiplier} onChange={(v) => set({ multiplier: v })} />
            <Num id="q-rate" label="Billing rate" suffix="$/hr" value={q.billRate} onChange={(v) => set({ billRate: v })} />
            <Num id="q-mup" label="Material markup" suffix="%" value={q.materialMarkup * 100} onChange={(v) => set({ materialMarkup: v / 100 })} />
          </div>
          <p className="hint">Cost × multiplier: (materials + hours × labor cost) × multiplier. Hourly rate: hours × rate + materials × (1 + markup). Both are shown in the breakdown.</p>
        </Section>

        <Section title="Workload">
          <div className="seg" role="radiogroup" aria-label="Workload">
            {(['full', 'normal', 'light'] as Workload[]).map((w) => (
              <button key={w} role="radio" aria-checked={q.workload === w} className={q.workload === w ? 'on' : ''} onClick={() => set({ workload: w })}>
                {w === 'full' ? 'Booked up' : w === 'normal' ? 'Normal' : 'Need work'}
              </button>
            ))}
          </div>
          <div className="grid3" style={{ marginTop: 8 }}>
            {(['full', 'normal', 'light'] as Workload[]).map((w) => (
              <Num key={w} id={`q-wl-${w}`} label={w === 'full' ? 'Booked' : w === 'normal' ? 'Normal' : 'Need work'} suffix="%" value={q.workloadAdj[w] * 100} onChange={(v) => set({ workloadAdj: { ...q.workloadAdj, [w]: v / 100 } })} />
            ))}
          </div>
          <p className="hint">Raise the price when you’re booked and sharpen it when you need the job, by a set amount each time.</p>
        </Section>

        <Section title="Prices to fill in">
          <div className="grid2">
            <Num id="q-eagle" label="Eagle prices, up or down" suffix="%" value={q.eagleAdjust * 100} onChange={(v) => set({ eagleAdjust: v / 100 })} />
            <Num id="q-bb" label="Beadboard sheet" suffix="$" value={q.beadboardSheet} onChange={(v) => set({ beadboardSheet: v })} />
            <Num id="q-cfs" label="Coffer stock, prepped" suffix="$/ft" value={q.cofferStockPerFt} onChange={(v) => set({ cofferStockPerFt: v })} />
            <Num id="q-cfb" label="Coffer blocking & fasteners" suffix="$/ft" value={q.cofferSundriesPerFt} onChange={(v) => set({ cofferSundriesPerFt: v })} />
            <Num id="q-brk" label="Shelf brackets" suffix="$ / 8-pack" value={q.shelfBracketPack} onChange={(v) => set({ shelfBracketPack: v })} />
            <Num id="q-rod" label="Closet rod, 8' length" suffix="$" value={q.closetRod8ft} onChange={(v) => set({ closetRod8ft: v })} />
            <Num id="q-sock" label="Rod sockets, pair" suffix="$" value={q.rodSockets} onChange={(v) => set({ rodSockets: v })} />
            <Num id="q-cush" label="Seat cushions" suffix="$/sq ft" value={q.cushionPerSqFt} onChange={(v) => set({ cushionPerSqFt: v })} />
          </div>
          <p className="hint">Plywood, maple and A&amp;M mouldings come from their own tabs. Blum hinges, slides and clips are priced from Woodworker Express’s price list. Floating shelf brackets are the <a href="https://www.amazon.com/dp/B088PQTYJT" target="_blank" rel="noreferrer">Amazon bracket</a>, 2" shorter than the shelf is deep. Eagle doors, fronts and drawer boxes are priced piece by piece from your 2026 Eagle orders (paint-grade maple, 5-piece). Raise the percentage after a price increase or for a pricier species.</p>
        </Section>

        <SuppliesEditor />

        <Section title="Painting (prefinishing)">
          <div className="seg" role="group" aria-label="How painting is priced">
            {([['quote', 'Painter’s quote'], ['estimate', 'Estimate'], ['allowance', 'Allowance']] as const).map(([k, label]) => (
              <button key={k} className={(q.paintMode ?? 'quote') === k ? 'on' : ''} aria-pressed={(q.paintMode ?? 'quote') === k} onClick={() => set({ paintMode: k === 'quote' ? undefined : k })}>{label}</button>
            ))}
          </div>
          {(q.paintMode ?? 'quote') === 'quote' && (
            <>
              <div className="grid2" style={{ marginTop: 8 }}>
                <Num id="q-paint" label="Painter’s price" suffix="$" value={q.painter} onChange={(v) => set({ painter: v })} />
                <Num id="q-pmup" label="Markup" suffix="%" value={q.painterMarkup * 100} onChange={(v) => set({ painterMarkup: v / 100 })} />
              </div>
              <p className="hint">Leave at $0 when the customer deals with the painter directly. Without a quote yet, the estimate for this job is {money(pe.amount)}.</p>
            </>
          )}
          {q.paintMode === 'estimate' && (
            <>
              <div className="grid2" style={{ marginTop: 8 }}>
                <Num id="q-ppf" label="Per door, drawer front or end panel" suffix="$" value={q.paintPerFront ?? paintRates.perFront} onChange={(v) => set({ paintPerFront: v })} />
                <Num id="q-pps" label="Per sq ft of cabinet face" suffix="$" value={q.paintPerSqFt ?? paintRates.perSqFt} onChange={(v) => set({ paintPerSqFt: v })} />
              </div>
              <p className="hint">{pe.fronts} fronts and panels, {Math.round(pe.sqft)} sq ft of cabinet face: <strong>{money(pe.amount)}</strong> to the customer. Starting rates fit your past prefinishing prices; Massachusetts cabinet painters run about $90 to $175 a door.</p>
            </>
          )}
          {q.paintMode === 'allowance' && (
            <>
              <div className="grid2" style={{ marginTop: 8 }}>
                <Num id="q-pal" label="Painting allowance" suffix="$" value={q.paintAllowance ?? 0} onChange={(v) => set({ paintAllowance: v })} />
              </div>
              <p className="hint">A flat amount on the agreement as an allowance. The estimate for this job is {money(pe.amount)}.</p>
            </>
          )}
        </Section>

        <details className="overrides">
          <summary>Labor standards (hours)</summary>
          <p className="hint">Time per item for a typical job. Calibrate these as you track real jobs.</p>
          <div className="grid2">
            {stdFields.map(([k, label]) => (
              <Num key={k} id={`q-std-${k}`} label={label} step="0.05" value={q.standards[k] ?? 0} onChange={(v) => setStd({ [k]: v })} />
            ))}
          </div>
          <button className="mini" onClick={() => set({ standards: defaultStandards })}>Reset to defaults</button>
        </details>
      </div>
    </aside>
  );
}

/* ---------- Center: the math ---------- */

export function QuoteBreakdown() {
  const { q, set, result: r } = useQuote();
  const setOverride = (k: 'hourOverrides' | 'costOverrides', line: { group: Group; label: string }, v: number | undefined) => {
    const next = { ...q[k] };
    if (v == null) delete next[lineKey(line)]; else next[lineKey(line)] = v;
    set({ [k]: Object.keys(next).length ? next : undefined });
  };
  const missing = r.materials.filter((m) => m.missing);
  return (
    <main className="stage cut-stage">
      <section className="quote-summary">
        <div className="qs-card"><span className="qs-label">Your cost</span><span className="qs-num">{money(r.cost)}</span><span className="muted">{(r.shopHours + r.installHours).toFixed(1)} hrs at ${q.laborCost} + materials {money(r.materialCost)}</span></div>
        <div className={`qs-card${q.method === 'multiplier' ? ' on' : ''}`}><span className="qs-label">Cost × {q.multiplier}</span><span className="qs-num">{money(r.groups.reduce((t, g) => t + g.methodA, 0))}</span><span className="muted">before workload and extras</span></div>
        <div className={`qs-card${q.method === 'rate' ? ' on' : ''}`}><span className="qs-label">${q.billRate}/hr + {pct(q.materialMarkup)}</span><span className="qs-num">{money(r.groups.reduce((t, g) => t + g.methodB, 0))}</span><span className="muted">before workload and extras</span></div>
        <div className="qs-card total"><span className="qs-label">Quote</span><span className="qs-num">{money(r.total)}</span><span className="muted">{r.cost ? `${Math.round((1 - r.cost / Math.max(r.total, 1)) * 100)}% margin over your cost` : ''}</span></div>
      </section>
      {missing.length > 0 && (
        <p className="warn">Missing prices, counted as $0: {missing.map((m) => m.label).join(', ')}. Fill them in on the left so the quote isn’t short.</p>
      )}

      <p className="hint">Click any hours or cost to set your own number; it’s used in place of the estimate until you go back to it.</p>
      <section className="mat-block">
        <header><h2>Labor</h2><span className="muted">{r.shopHours.toFixed(1)} shop hrs · {r.installHours.toFixed(1)} install hrs</span></header>
        <div className="table-wrap">
          <table className="ff-table">
            <thead><tr><th>Item</th><th>For</th><th className="num">Qty</th><th className="num">Hrs each</th><th className="num">Hours</th></tr></thead>
            <tbody>
              {r.hours.map((h, i) => (
                <tr key={i} className={h.estimated != null ? 'overridden' : ''}>
                  <td>{h.label}{h.install && <span className="tag-install">install</span>}{h.estimated != null && <span className="note">estimate {h.estimated.toFixed(1)} h · <button className="link-btn" onClick={() => setOverride('hourOverrides', h, undefined)}>use it</button></span>}</td>
                  <td className="muted">{groupLabel[h.group]}</td><td className="num">{+h.qty.toFixed(1)}</td><td className="num">{h.each}</td>
                  <td className="num"><EditNum value={h.hours} digits={1} label={`Hours for ${h.label}`} onSave={(v) => setOverride('hourOverrides', h, v)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mat-block">
        <header><h2>Materials</h2><span className="muted">at your cost, + {pct(r.tax)} sales tax {money(r.materialCost)}</span></header>
        <div className="table-wrap">
          <table className="ff-table">
            <thead><tr><th>Item</th><th>For</th><th>Quantity</th><th className="num">Cost</th></tr></thead>
            <tbody>
              {r.materials.map((m, i) => (
                <tr key={i} className={m.missing ? 'missing' : m.estimated != null ? 'overridden' : ''}>
                  <td>{m.label}{m.missing && <span className="note">{m.missing}</span>}{m.estimated != null && <span className="note">estimate {money(m.estimated)} · <button className="link-btn" onClick={() => setOverride('costOverrides', m, undefined)}>use it</button></span>}</td>
                  <td className="muted">{groupLabel[m.group]}</td><td className="muted">{m.detail}</td>
                  <td className="num"><EditNum value={m.cost} digits={0} prefix="$" label={`Cost of ${m.label}`} onSave={(v) => setOverride('costOverrides', m, v)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

/* ---------- Right: what goes on the agreement ---------- */

export function QuoteSummary() {
  const { project, q, set, result: r } = useQuote();
  const [copied, setCopied] = useState('');
  // What the customer signs for: the base price in sections, and each option on its own
  const rounded = proposalLines(project);
  const options = useMemo(() => optionPrices(project), [project]);
  const baseTotal = rounded.reduce((t, l) => t + l.price, 0);
  const scope = [...project.cabinets.map((c) => scopeLine(c, project)), cofferScope(project), ...furnitureOf(project).map(tableScope)].filter((x): x is string => !!x);
  const text = [
    ...scope,
    '',
    ...rounded.map((l) => `${l.label}: ${money(l.price)}`),
    `Total Project Investment: ${money(baseTotal)}`,
    ...options.map((o) => `Option, ${o.label}: add ${money(o.price)}`),
  ].join('\n');
  const copy = () => navigator.clipboard.writeText(text).then(() => setCopied('Copied.'), () => setCopied('Couldn’t reach the clipboard.'));
  return (
    <aside className="panel">
      <div className="panel-body">
        <Section title="Purchase agreement">
          <table className="totals">
            <tbody>
              {rounded.map((l) => <tr key={l.label}><td>{l.label}</td><td className="num">{money(l.price)}</td></tr>)}
              <tr className="sum"><td>Total Project Investment{options.length ? ' (before options)' : ''}</td><td className="num">{money(baseTotal)}</td></tr>
              {options.map((o) => <tr key={o.id}><td>Option: {o.label}</td><td className="num">+{money(o.price)}</td></tr>)}
            </tbody>
          </table>
          <div className="grid2" style={{ marginTop: 10 }}>
            <Num id="q-adj" label="Your adjustment" suffix="$" value={q.adjustment} onChange={(v) => set({ adjustment: v })} />
            <Num id="q-round" label="Round to" suffix="$" value={q.roundTo} onChange={(v) => set({ roundTo: v })} />
          </div>
          <p className="hint">
            {options.length ? `With every option ${money(r.total)}. ` : ''}Calculated {money(r.calculated)}
            {r.workloadAmount ? `, workload ${r.workloadAmount > 0 ? '+' : '−'}${money(Math.abs(r.workloadAmount))}` : ''}
            {q.adjustment ? `, your adjustment ${q.adjustment > 0 ? '+' : '−'}${money(Math.abs(q.adjustment))}` : ''}.
          </p>
        </Section>

        <FurnitureSection />

        <Section title="Additional work" aside={<button className="mini" onClick={() => set({ extras: [...q.extras, newExtra()] })}>Add</button>}>
          {q.extras.length === 0 && <p className="hint">Demo, trim, casing, hardware installs: anything priced by hours or a flat amount.</p>}
          {q.extras.map((e) => (
            <div key={e.id} className="stock-row">
              <div className="sr-head">
                <input id={`ex-l-${e.id}`} aria-label="Description" value={e.label} onChange={(ev) => set({ extras: q.extras.map((x) => (x.id === e.id ? { ...x, label: ev.target.value } : x)) })} />
                <button className="icon-btn" aria-label="Remove" onClick={() => set({ extras: q.extras.filter((x) => x.id !== e.id) })}>×</button>
              </div>
              <div className="grid2">
                <Num id={`ex-h-${e.id}`} label="Hours" value={e.hours} onChange={(v) => set({ extras: q.extras.map((x) => (x.id === e.id ? { ...x, hours: v } : x)) })} />
                <Num id={`ex-a-${e.id}`} label="Materials or flat" suffix="$" value={e.amount} onChange={(v) => set({ extras: q.extras.map((x) => (x.id === e.id ? { ...x, amount: v } : x)) })} />
              </div>
              <Field label="Offered as an option (blank = included)" htmlFor={`ex-o-${e.id}`}>
                <input id={`ex-o-${e.id}`} list="option-names-q" value={e.option ?? ''} placeholder="Included in the base price" onChange={(ev) => set({ extras: q.extras.map((x) => (x.id === e.id ? { ...x, option: ev.target.value || undefined } : x)) })} />
              </Field>
            </div>
          ))}
        </Section>

        <datalist id="option-names-q">{optionNames(useStore.getState().project).map((n) => <option key={n} value={n} />)}</datalist>
        <QuoteRendering />

        <Section title="Scope of work">
          <ul className="assembly">{scope.map((s) => <li key={s}>{s}</li>)}</ul>
          <div className="order-actions" style={{ marginTop: 10 }}>
            <button onClick={copy}>Copy scope and prices</button>
            {copied && <span className="ok">{copied}</span>}
          </div>
        </Section>
      </div>
    </aside>
  );
}

/* ---------- Shop supplies ---------- */

function SuppliesEditor() {
  const { project, q, set } = useQuote();
  const lines = useMemo(() => supplyLines(project, q.supplies), [project, q.supplies]);
  const total = lines.reduce((t, l) => t + l.cost, 0);
  const put = (id: string, patch: Partial<SupplyItem>) => set({ supplies: q.supplies.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  return (
    <Section title="Shop supplies" aside={<span className="muted">{money(total)}</span>}>
      <details className="supplies">
        <summary>Screws, glue, banding, abrasives, install sundries ({lines.filter((l) => l.qty > 0).length} used on this job)</summary>
        <p className="hint">Each item is counted from the design: face frame joints, hinges, drawers, feet of shelf banding. The starting prices are typical retail; change them to what you pay.</p>
        {lines.map(({ item, count, qty, cost }) => (
          <div key={item.id} className={`supply ${qty ? '' : 'unused'}`}>
            <div className="supply-head">
              <input aria-label="Item" value={item.label} onChange={(e) => put(item.id, { label: e.target.value })} />
              <span className="num">{qty ? `$${cost.toFixed(2)}` : '—'}</span>
              <button className="mini" title="Remove" onClick={() => set({ supplies: q.supplies.filter((x) => x.id !== item.id) })}>×</button>
            </div>
            <div className="supply-row">
              <input aria-label="Quantity" inputMode="decimal" value={item.qtyPer} onChange={(e) => put(item.id, { qtyPer: parseFloat(e.target.value) || 0 })} />
              <input aria-label="Unit" className="unit" value={item.unit} onChange={(e) => put(item.id, { unit: e.target.value })} />
              <select aria-label="Counted" value={item.driver} onChange={(e) => put(item.id, { driver: e.target.value as SupplyDriver })}>
                {(Object.keys(driverLabel) as SupplyDriver[]).map((d) => <option key={d} value={d}>{driverLabel[d]}</option>)}
              </select>
            </div>
            <div className="supply-row">
              <span>at $</span>
              <input aria-label="Cost per unit" inputMode="decimal" value={item.unitCost} onChange={(e) => put(item.id, { unitCost: parseFloat(e.target.value) || 0 })} />
              <span className="muted">each · {count} × {item.qtyPer} = {+qty.toFixed(1)} {item.unit}</span>
            </div>
          </div>
        ))}
        <div className="order-actions">
          <button className="mini" onClick={() => set({ supplies: [...q.supplies, newSupply()] })}>Add item</button>
          <button className="mini" onClick={() => set({ supplies: defaultSupplies })}>Reset to starting list</button>
        </div>
      </details>
    </Section>
  );
}
