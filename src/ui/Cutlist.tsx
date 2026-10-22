import { useMemo, useState } from 'react';
import { useStore } from '../store';
import type { Project } from '../model/types';
import { defaultCutlist, designParts, optimizerParts, sheetPrice, type CutlistData, type ExtraPart } from '../model/cutlist';
import { optimize, type MaterialResult, type SheetLayout, type Stock } from '../model/optimizer';
import { uid } from '../model/defaults';
import { fmt } from '../units';
import { Field, LengthInput, Section } from './fields';

function useCutlist() {
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  const data = project.cutlist ?? defaultCutlist(project);
  const set = (fn: (d: CutlistData) => CutlistData) => commit((p) => ({ ...p, cutlist: fn(p.cutlist ?? defaultCutlist(p)) }));
  return { project, data, set };
}

export function useOptimized() {
  const project = useStore((s) => s.project);
  return useMemo(() => {
    const data = project.cutlist ?? defaultCutlist(project);
    return optimize(optimizerParts(project, data), data.stock, data.options);
  }, [project]);
}

function materialsOf(p: Project, data: CutlistData) {
  return [...new Set([...designParts(p, data).map((d) => d.material), ...data.stock.map((s) => s.material), ...data.extra.map((e) => e.material)])];
}

/* ---------- Left: inputs, laid out like cutlistoptimizer.com ---------- */

export function CutlistInputs() {
  const { project, data, set } = useCutlist();
  const o = data.options;
  const mats = materialsOf(project, data);
  const setOpt = (patch: Partial<CutlistData['options']>) => set((d) => ({ ...d, options: { ...d.options, ...patch } }));
  const setStock = (id: string, patch: Partial<Stock>) => set((d) => ({ ...d, stock: d.stock.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  const setExtra = (id: string, patch: Partial<ExtraPart>) => set((d) => ({ ...d, extra: d.extra.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  const missing = mats.filter((m) => !data.stock.some((s) => s.material === m));

  return (
    <aside className="sidebar">
      <div className="side-body">
        <Section title="Options">
          <div className="grid2">
            <Field label="Blade kerf" htmlFor="co-kerf"><LengthInput id="co-kerf" value={o.kerf} onChange={(v) => setOpt({ kerf: v! })} /></Field>
            <Field label="Edge trim" htmlFor="co-trim"><LengthInput id="co-trim" value={o.trim} onChange={(v) => setOpt({ trim: v! })} /></Field>
            <Field label="Keep offcuts over" htmlFor="co-min"><LengthInput id="co-min" value={o.minOffcut} onChange={(v) => setOpt({ minOffcut: v! })} /></Field>
          </div>
          <div className="checks">
            <label><input id="co-grain" type="checkbox" checked={o.considerGrain} onChange={(e) => setOpt({ considerGrain: e.target.checked })} /> Respect grain direction</label>
            <label><input id="co-band" type="checkbox" checked={o.bandShelves} onChange={(e) => setOpt({ bandShelves: e.target.checked })} /> Edge band shelf fronts</label>
          </div>
          <p className="hint">Edge trim is cleaned off each factory edge before the first rip.</p>
        </Section>

        <Section title="Stock sheets" aside={
          <button className="mini" onClick={() => set((d) => ({ ...d, stock: [...d.stock, { id: uid('stock'), label: 'Sheet', material: mats[0] ?? '3/4" plywood', length: 96, width: 48, qty: null, price: sheetPrice(mats[0] ?? '3/4"') }] }))}>Add</button>
        }>
          {missing.map((m) => (
            <p key={m} className="warn">No stock for {m}. <button className="mini" onClick={() => set((d) => ({ ...d, stock: [...d.stock, { id: uid('stock'), label: '4×8 prefinished birch', material: m, length: 96, width: 48, qty: null, price: sheetPrice(m) }] }))}>Add 4×8</button></p>
          ))}
          <div className="rows-table">
            {data.stock.map((s) => (
              <div key={s.id} className="stock-row">
                <div className="sr-head">
                <select id={`st-mat-${s.id}`} aria-label="Material" value={s.material} onChange={(e) => setStock(s.id, { material: e.target.value })}>
                  {[...new Set([...mats, s.material])].map((m) => <option key={m}>{m}</option>)}
                </select>
                <button className="icon-btn" aria-label="Remove stock" title="Remove" onClick={() => set((d) => ({ ...d, stock: d.stock.filter((x) => x.id !== s.id) }))}>×</button>
                </div>
                <div className="sr-grid">
                <Field label="Length" htmlFor={`st-l-${s.id}`}><LengthInput id={`st-l-${s.id}`} value={s.length} min={1} onChange={(v) => setStock(s.id, { length: v! })} /></Field>
                <Field label="Width" htmlFor={`st-w-${s.id}`}><LengthInput id={`st-w-${s.id}`} value={s.width} min={1} onChange={(v) => setStock(s.id, { width: v! })} /></Field>
                <Field label="Qty" htmlFor={`st-q-${s.id}`}>
                  <input id={`st-q-${s.id}`} inputMode="numeric" placeholder="any" value={s.qty ?? ''} onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    setStock(s.id, { qty: Number.isFinite(n) && n > 0 ? n : null });
                  }} />
                </Field>
                <Field label="$ / sheet" htmlFor={`st-p-${s.id}`}>
                  <input id={`st-p-${s.id}`} inputMode="decimal" value={s.price || ''} placeholder="0" onChange={(e) => setStock(s.id, { price: parseFloat(e.target.value) || 0 })} />
                </Field>
                </div>
              </div>
            ))}
          </div>
          <p className="hint">Leave Qty blank for as many as needed. Give a remnant a quantity and it gets used before full sheets.</p>
        </Section>

        <Section title="Extra parts" aside={
          <button className="mini" onClick={() => set((d) => ({ ...d, extra: [...d.extra, { id: uid('xp'), label: '', material: mats[0] ?? '3/4" plywood', length: 24, width: 12, qty: 1, grain: true, band: 0, enabled: true }] }))}>Add</button>
        }>
          {data.extra.length === 0 && <p className="hint">Parts from the design are included automatically. Add anything else here: jigs, a vanity top, shop parts.</p>}
          <div className="rows-table">
            {data.extra.map((e) => (
              <div key={e.id} className="stock-row">
                <div className="sr-head">
                <input id={`xp-label-${e.id}`} aria-label="Label" placeholder="Label" value={e.label} onChange={(ev) => setExtra(e.id, { label: ev.target.value })} />
                <button className="icon-btn" aria-label="Remove part" title="Remove" onClick={() => set((d) => ({ ...d, extra: d.extra.filter((x) => x.id !== e.id) }))}>×</button>
                </div>
                <div className="sr-grid">
                <Field label="Length" htmlFor={`xp-l-${e.id}`}><LengthInput id={`xp-l-${e.id}`} value={e.length} min={0.5} onChange={(v) => setExtra(e.id, { length: v! })} /></Field>
                <Field label="Width" htmlFor={`xp-w-${e.id}`}><LengthInput id={`xp-w-${e.id}`} value={e.width} min={0.5} onChange={(v) => setExtra(e.id, { width: v! })} /></Field>
                <Field label="Qty" htmlFor={`xp-q-${e.id}`}>
                  <input id={`xp-q-${e.id}`} inputMode="numeric" value={e.qty} onChange={(ev) => setExtra(e.id, { qty: Math.max(0, parseInt(ev.target.value, 10) || 0) })} />
                </Field>
                <Field label="Material" htmlFor={`xp-m-${e.id}`}>
                  <select id={`xp-m-${e.id}`} value={e.material} onChange={(ev) => setExtra(e.id, { material: ev.target.value })}>
                    {[...new Set([...mats, e.material])].map((m) => <option key={m}>{m}</option>)}
                  </select>
                </Field>
                </div>
                <div className="sr-checks">
                <label className="inline-check"><input type="checkbox" checked={e.grain} onChange={(ev) => setExtra(e.id, { grain: ev.target.checked })} /> Grain locked</label>
                <label className="inline-check"><input type="checkbox" checked={e.band > 0} onChange={(ev) => setExtra(e.id, { band: ev.target.checked ? 1 : 0 })} /> Band one edge</label>
                <label className="inline-check"><input type="checkbox" checked={e.enabled} onChange={(ev) => setExtra(e.id, { enabled: ev.target.checked })} /> Include</label>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </aside>
  );
}

/* ---------- Center: sheet layouts ---------- */

export function CutlistLayouts() {
  const results = useOptimized();
  const [showCuts, setShowCuts] = useState(true);
  return (
    <main className="stage cut-stage">
      <div className="cut-toolbar">
        <label><input id="co-showcuts" type="checkbox" checked={showCuts} onChange={(e) => setShowCuts(e.target.checked)} /> Show cut sequence</label>
        <span className="muted">Rip strips the full length first, then crosscut, then rip each piece to width. Numbers follow the order to cut.</span>
      </div>
      {results.length === 0 && <div className="empty pad"><p>No sheet-goods parts yet. Add cabinets in Design.</p></div>}
      {results.map((m) => <MaterialBlock key={m.material} m={m} showCuts={showCuts} />)}
    </main>
  );
}

function MaterialBlock({ m, showCuts }: { m: MaterialResult; showCuts: boolean }) {
  const area = m.sheets.reduce((s, sh) => s + sh.stock.length * sh.stock.width, 0);
  const used = m.sheets.reduce((s, sh) => s + sh.usedArea, 0);
  return (
    <section className="mat-block">
      <header>
        <h2>{m.material}</h2>
        <span className="muted">{m.sheets.length} sheet{m.sheets.length === 1 ? '' : 's'} · {area ? Math.round((100 * used) / area) : 0}% yield</span>
      </header>
      {m.unplaced.length > 0 && (
        <p className="warn">Won’t fit on any stock: {m.unplaced.map((p) => `${p.label} (${fmt(p.length)} × ${fmt(p.width)})`).join(', ')}. Add larger stock or turn off grain for these parts.</p>
      )}
      <div className="sheets">
        {m.sheets.map((sh, i) => <SheetCard key={i} sh={sh} index={i + 1} showCuts={showCuts} />)}
      </div>
    </section>
  );
}

function SheetCard({ sh, index, showCuts }: { sh: SheetLayout; index: number; showCuts: boolean }) {
  const { length: L, width: W } = sh.stock;
  const yieldPct = Math.round((100 * sh.usedArea) / (L * W));
  const pad = 3;
  return (
    <figure className="sheet-card">
      <figcaption>
        <strong>Sheet {index}</strong>
        <span className="muted">{sh.stock.label} {fmt(L)} × {fmt(W)} · {sh.placed.length} parts · {yieldPct}%</span>
      </figcaption>
      <svg viewBox={`${-pad} ${-pad} ${L + 2 * pad} ${W + 2 * pad}`} className="sheet-svg" role="img" aria-label={`Sheet ${index} layout`}>
        <rect x={0} y={0} width={L} height={W} className="sv-sheet" />
        {sh.offcuts.map((o, i) => <rect key={`o${i}`} x={o.x} y={o.y} width={o.l} height={o.w} className="sv-offcut" />)}
        {sh.placed.map((p) => {
          // Tall, narrow parts get their label turned to run along them
          const vertical = p.w > p.l * 1.3;
          const along = vertical ? p.w : p.l;
          const across = vertical ? p.l : p.w;
          const fs = Math.min(2.4, across / 3.2, along / 9);
          const showText = fs >= 1.1;
          const twoLines = across > fs * 3.4;
          const cx = p.x + p.l / 2;
          const cy = p.y + p.w / 2;
          const grainH = !p.rotated; // grain runs along the sheet length unless the part was turned
          return (
            <g key={p.n}>
              <rect x={p.x} y={p.y} width={p.l} height={p.w} className={`sv-part${p.part.grain ? '' : ' free'}`}>
                <title>{`#${p.n} ${p.part.label}: ${fmt(p.part.length)} × ${fmt(p.part.width)}${p.rotated ? ' (turned)' : ''}`}</title>
              </rect>
              {p.part.grain && (grainH
                ? <line x1={p.x + 1.5} x2={p.x + Math.min(p.l - 1.5, 8)} y1={p.y + p.w - 1.2} y2={p.y + p.w - 1.2} className="sv-grain" />
                : <line x1={p.x + 1.2} x2={p.x + 1.2} y1={p.y + p.w - 1.5} y2={p.y + p.w - Math.min(p.w - 1.5, 8)} className="sv-grain" />)}
              <g transform={vertical ? `rotate(-90 ${cx} ${cy})` : undefined}>
                {showText ? (
                  <text x={cx} y={cy} className="sv-label" fontSize={fs} textAnchor="middle" dominantBaseline="middle">
                    <tspan x={cx} dy={twoLines ? -fs * 0.6 : 0}>{`${p.n}  ${p.part.label}`}</tspan>
                    {twoLines && <tspan x={cx} dy={fs * 1.25} className="sv-dim">{`${fmt(p.part.length)} × ${fmt(p.part.width)}`}</tspan>}
                  </text>
                ) : (
                  <text x={cx} y={cy} className="sv-label" fontSize={Math.max(0.9, Math.min(across * 0.6, 1.6))} textAnchor="middle" dominantBaseline="middle">{p.n}</text>
                )}
              </g>
            </g>
          );
        })}
        {showCuts && sh.cuts.map((c) => (
          <g key={`c${c.n}`}>
            <line x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} className={`sv-cut ${c.kind}`} />
            <circle cx={c.kind === 'rip' ? c.x1 + 1.6 : c.x1} cy={c.kind === 'rip' ? c.y1 : c.y1 + 1.6} r={1.15} className="sv-cut-dot" />
            <text x={c.kind === 'rip' ? c.x1 + 1.6 : c.x1} y={c.kind === 'rip' ? c.y1 : c.y1 + 1.6} className="sv-cut-n" fontSize={1.25} textAnchor="middle" dominantBaseline="central">{c.n}</text>
          </g>
        ))}
      </svg>
      <details className="cut-seq">
        <summary>{sh.placed.length} parts</summary>
        <ol className="part-legend">
          {sh.placed.map((p) => (
            <li key={p.n} value={p.n}>{p.part.label} <span className="muted mono">{fmt(p.part.length)} × {fmt(p.part.width)}{p.rotated ? ', turned' : ''}</span></li>
          ))}
        </ol>
      </details>
      {showCuts && (
        <details className="cut-seq">
          <summary>{sh.cuts.length} cuts</summary>
          <ol>{sh.cuts.map((c) => <li key={c.n}>{c.text}</li>)}</ol>
        </details>
      )}
    </figure>
  );
}

/* ---------- Right: summary, offcuts and the design parts feeding the optimizer ---------- */

export function CutlistSummary() {
  const { project, data, set } = useCutlist();
  const results = useOptimized();
  const parts = useMemo(() => designParts(project, data), [project, data]);
  const [filter, setFilter] = useState('');
  const banded = optimizerParts(project, data).reduce((s, p) => s + p.band * p.length, 0);
  const cost = results.reduce((s, m) => s + m.sheets.reduce((t, sh) => t + sh.stock.price, 0), 0);
  const shown = parts.filter((p) => !filter || p.label.toLowerCase().includes(filter.toLowerCase()));

  return (
    <aside className="panel">
      <div className="panel-body">
        <Section title="Job totals">
          <table className="totals">
            <tbody>
              {results.map((m) => (
                <tr key={m.material}>
                  <td>{m.material}</td>
                  <td className="num">{m.sheets.length} sheets</td>
                  <td className="num">{m.sheets.some((s) => s.stock.price) ? `$${m.sheets.reduce((t, sh) => t + sh.stock.price, 0).toFixed(2)}` : '—'}</td>
                </tr>
              ))}
              {cost > 0 && <tr className="sum"><td>Sheet goods</td><td /><td className="num">${cost.toFixed(2)}</td></tr>}
            </tbody>
          </table>
          {banded > 0 && <p className="hint">Edge banding: {(banded / 12).toFixed(1)} lin ft (shelf fronts{data.extra.some((e) => e.band) ? ' and extra parts' : ''}).</p>}
          {cost === 0 && <p className="hint">Enter a price per sheet under Stock sheets to see material cost. It will feed the quote.</p>}
        </Section>

        <Section title="Usable offcuts">
          {results.every((m) => m.sheets.every((s) => s.offcuts.length === 0))
            ? <p className="hint">No offcuts over {fmt(data.options.minOffcut)}.</p>
            : (
              <ul className="offcuts">
                {results.flatMap((m) => m.sheets.flatMap((sh, i) => sh.offcuts.map((o, j) => (
                  <li key={`${m.material}${i}-${j}`}><span className="mono">{fmt(o.l)} × {fmt(o.w)}</span> <span className="muted">{m.material}, sheet {i + 1}</span></li>
                ))))}
              </ul>
            )}
        </Section>

        <Section title={`Parts from the design (${parts.length})`}>
          <input id="cl-filter" placeholder="Filter, e.g. B3 or Shelf" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <div className="table-wrap" style={{ marginTop: 6 }}>
            <table>
              <thead>
                <tr><th>Part</th><th className="num">Length</th><th className="num">Width</th><th title="Grain must run with the sheet length">Grain</th><th>Cut</th></tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.id} className={data.skip[p.id] ? 'skipped' : ''}>
                    <td>{p.label}<span className="note">{p.material}</span></td>
                    <td className="num">{fmt(p.length)}</td>
                    <td className="num">{fmt(p.width)}</td>
                    <td><input type="checkbox" aria-label={`Grain locked for ${p.label}`} checked={p.grain} onChange={(e) => set((d) => ({ ...d, grain: { ...d.grain, [p.id]: e.target.checked } }))} /></td>
                    <td><input type="checkbox" aria-label={`Include ${p.label}`} checked={!data.skip[p.id]} onChange={(e) => set((d) => ({ ...d, skip: { ...d.skip, [p.id]: !e.target.checked } }))} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">Sizes update from the design automatically. Untick Cut for parts you already have.</p>
        </Section>
      </div>
    </aside>
  );
}
