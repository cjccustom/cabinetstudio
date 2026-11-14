// The furniture builder's panel for case pieces (nightstand, dresser, chest, sideboard, media console):
// size, base, top, the face row by row, fronts and hardware, wood and finish, where it stands, the
// design checks and the estimate.
import { useMemo } from 'react';
import { useStore } from '../store';
import { tableFinishLabel, type TableFinish } from '../model/furniture';
import { tableSpecies } from '../model/tableParts';
import { uid } from '../model/defaults';
import { caseChecks, caseEstimate, rowHeights, slideLength, type CasePiece, type CaseRow } from '../model/casePiece';
import { Field, LengthInput } from './fields';
import { fmt } from '../units';

const money = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;

export function CaseEditor({ c, put }: { c: CasePiece; put: (p: Partial<CasePiece>) => void }) {
  const project = useStore((s) => s.project);
  const est = useMemo(() => caseEstimate(c, project), [c, project]);
  const id = (k: string) => `cs-${k}`;
  const len = (k: keyof CasePiece, label: string, min = 0.25) => (
    <Field label={label} htmlFor={id(k)}><LengthInput id={id(k)} value={c[k] as number} min={min} onChange={(v) => v != null && put({ [k]: v } as Partial<CasePiece>)} /></Field>
  );
  const hs = rowHeights(c);
  const putRow = (i: number, patch: Partial<CaseRow>) => put({ rows: c.rows.map((r, k) => (k === i ? { ...r, ...patch } : r)) });
  const move = (i: number, d: -1 | 1) => { const rows = [...c.rows]; const j = i + d; if (j < 0 || j >= rows.length) return; [rows[i], rows[j]] = [rows[j], rows[i]]; put({ rows }); };
  return (
    <div className="case-ed">
      <h3>Size</h3>
      <div className="grid3">{len('width', 'Width')}{len('depth', 'Depth')}{len('height', 'Height')}</div>
      <div className="grid3">
        <Field label="How many alike" htmlFor={id('qty')}>
          <select id={id('qty')} value={c.qty ?? 1} onChange={(e) => put({ qty: Number(e.target.value) })}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n === 1 ? 'One' : n === 2 ? 'A pair' : n}</option>)}</select>
        </Field>
      </div>
      {(c.qty ?? 1) > 1 && <p className="hint">Priced together: the second and later ones take about 60% of the first one’s hours. The room’s 3D shows one; place the others there by hand if you need them.</p>}
      <h3>Base and top</h3>
      <div className="grid3">
        <Field label="Base" htmlFor={id('base')}>
          <select id={id('base')} value={c.base} onChange={(e) => put({ base: e.target.value as CasePiece['base'], ...(e.target.value === 'plinth' && c.baseH > 5 ? { baseH: 3.5 } : e.target.value === 'legs' && c.baseH < 4 ? { baseH: 7 } : {}) })}>
            <option value="legs">Legs</option><option value="plinth">Set-back plinth</option>
          </select>
        </Field>
        {len('baseH', c.base === 'legs' ? 'Leg height (floor to case)' : 'Plinth height', 0)}
        {c.base === 'legs' && (
          <Field label="Legs" htmlFor={id('leg')}>
            <select id={id('leg')} value={c.leg} onChange={(e) => put({ leg: e.target.value as CasePiece['leg'] })}>
              <option value="tapered">Tapered</option><option value="square">Square</option><option value="turned">Turned</option>
            </select>
          </Field>
        )}
        {c.base === 'legs' && len('legSize', 'Leg size')}
        {len('topT', 'Top thickness')}
        {len('overhang', 'Top overhang (front and sides)', 0)}
      </div>
      <h3>The face, top to bottom</h3>
      <p className="hint">Leave a row’s height blank to share what’s left with the other blank rows. The face is {fmt(c.height - c.topT - c.baseH)} from the bottom of the case to the top.</p>
      <ol className="case-rows">
        {c.rows.map((r, i) => (
          <li key={r.id} className="case-row">
            <div className="grid3">
              <Field label="Row" htmlFor={id(`t${i}`)}>
                <select id={id(`t${i}`)} value={r.type} onChange={(e) => putRow(i, { type: e.target.value as CaseRow['type'], ...(e.target.value !== 'drawer' && r.shelves == null ? { shelves: 1 } : {}) })}>
                  <option value="drawer">Drawers</option><option value="doors">Doors</option><option value="open">Open shelf</option>
                </select>
              </Field>
              <Field label="Across" htmlFor={id(`s${i}`)}>
                <select id={id(`s${i}`)} value={r.split} onChange={(e) => putRow(i, { split: Number(e.target.value) as CaseRow['split'] })}>
                  <option value={1}>One</option><option value={2}>Two</option><option value={3}>Three</option>
                </select>
              </Field>
              <Field label={`Height (now ${fmt(hs[i])})`} htmlFor={id(`h${i}`)}>
                <LengthInput id={id(`h${i}`)} value={r.h} allowAuto placeholder="share" onChange={(v) => putRow(i, { h: v })} />
              </Field>
              {r.type !== 'drawer' && (
                <Field label="Shelves inside" htmlFor={id(`sh${i}`)}>
                  <select id={id(`sh${i}`)} value={r.shelves ?? 0} onChange={(e) => putRow(i, { shelves: Number(e.target.value) })}>{[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n || 'None'}</option>)}</select>
                </Field>
              )}
            </div>
            <div className="order-actions">
              <button className="mini" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move row ${i + 1} up`}>↑</button>
              <button className="mini" disabled={i === c.rows.length - 1} onClick={() => move(i, 1)} aria-label={`Move row ${i + 1} down`}>↓</button>
              <button className="mini danger" disabled={c.rows.length < 2} onClick={() => put({ rows: c.rows.filter((_, k) => k !== i) })}>Remove row</button>
            </div>
          </li>
        ))}
      </ol>
      <div className="order-actions">
        <button onClick={() => put({ rows: [...c.rows, { id: uid('crow'), type: 'drawer', h: null, split: 1 }] })}>Add a row of drawers</button>
        <button onClick={() => put({ rows: [...c.rows, { id: uid('crow'), type: 'doors', h: null, split: c.width > 30 ? 2 : 1, shelves: 1 }] })}>Add doors</button>
        <button onClick={() => put({ rows: [...c.rows, { id: uid('crow'), type: 'open', h: null, split: 1, shelves: 0 }] })}>Add an open shelf</button>
      </div>
      <h3>Fronts and hardware</h3>
      <div className="grid3">
        <Field label="Fronts" htmlFor={id('fr')}>
          <select id={id('fr')} value={c.fronts} onChange={(e) => put({ fronts: e.target.value as CasePiece['fronts'] })}>
            <option value="overlay">Full overlay</option><option value="inset">Inset in a face frame</option>
          </select>
        </Field>
        <Field label="Style" htmlFor={id('fs')}>
          <select id={id('fs')} value={c.frontStyle} onChange={(e) => put({ frontStyle: e.target.value as CasePiece['frontStyle'] })}>
            <option value="slab">Slab</option><option value="shaker">Five-piece (shaker)</option>
          </select>
        </Field>
        <Field label="Hardware" htmlFor={id('hw')}>
          <select id={id('hw')} value={c.hardware} onChange={(e) => put({ hardware: e.target.value as CasePiece['hardware'] })}>
            <option value="knobs">Knobs</option><option value="pulls">Pulls</option><option value="none">None (push to open or finger pulls)</option>
          </select>
        </Field>
      </div>
      {c.rows.some((r) => r.type === 'drawer') && <p className="hint">Drawers: dovetailed boxes on {slideLength(c)}" full-extension soft-close slides.</p>}
      <h3>Wood and finish</h3>
      <div className="grid3">
        <Field label="Grade" htmlFor={id('gr')}>
          <select id={id('gr')} value={c.grade} onChange={(e) => { const grade = e.target.value as CasePiece['grade']; put({ grade, ...(grade === 'paint' ? { species: 'Poplar', finish: 'paint' as TableFinish } : c.species === 'Poplar' ? { species: 'White oak', finish: 'clear' as TableFinish } : {}) }); }}>
            <option value="paint">Paint grade (birch plywood, poplar)</option>
            <option value="stain">Stain grade (veneer plywood and solid wood)</option>
          </select>
        </Field>
        {c.grade === 'stain' && (
          <Field label="Species" htmlFor={id('sp')}>
            <select id={id('sp')} value={c.species} onChange={(e) => put({ species: e.target.value })}>{tableSpecies.filter((x) => x.name !== 'Poplar').map((x) => <option key={x.name} value={x.name}>{x.label}</option>)}</select>
          </Field>
        )}
        <Field label="Finish" htmlFor={id('fin')}>
          <select id={id('fin')} value={c.finish} onChange={(e) => put({ finish: e.target.value as TableFinish })}>{Object.entries(tableFinishLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </Field>
        {c.finish === 'painter' && <Field label="Finisher’s price ($)" htmlFor={id('fp')}><input id={id('fp')} inputMode="decimal" value={c.finishPrice || ''} onChange={(e) => put({ finishPrice: parseFloat(e.target.value) || 0 })} /></Field>}
        <Field label="Your $/BF (blank = A&M list)" htmlFor={id('bf')}><input id={id('bf')} inputMode="decimal" value={c.pricePerBF || ''} placeholder="A&M" onChange={(e) => put({ pricePerBF: parseFloat(e.target.value) || 0 })} /></Field>
      </div>
      <h3>In the room</h3>
      <div className="grid3">
        <Field label="Back against" htmlFor={id('wall')}>
          <select id={id('wall')} value={c.wall ?? 'back'} onChange={(e) => put({ wall: e.target.value as CasePiece['wall'], offset: undefined })}>
            {(['back', 'left', 'right', 'front'] as const).map((w) => <option key={w} value={w}>{w[0].toUpperCase() + w.slice(1)} wall</option>)}
          </select>
        </Field>
        <Field label="Its center, along that wall" htmlFor={id('off')}><LengthInput id={id('off')} value={c.offset ?? ((c.wall ?? 'back') === 'back' || c.wall === 'front' ? project.room.width / 2 : project.room.depth / 2)} onChange={(v) => v != null && put({ offset: v })} /></Field>
      </div>
      <ul className="table-checks">{caseChecks(c).map((x) => <li key={x}>{x}</li>)}</ul>
      <details>
        <summary>Hours and materials</summary>
        <table className="totals">
          <tbody>
            {est.hours.map((h) => <tr key={h.label}><td>{h.label}</td><td className="num">{h.hours.toFixed(1)} h</td></tr>)}
            {est.materials.map((m) => <tr key={m.label}><td>{m.label}<span className="note">{m.detail}</span>{m.missing && <span className="warn-text"> {m.missing}</span>}</td><td className="num">{money(m.cost)}</td></tr>)}
          </tbody>
        </table>
      </details>
    </div>
  );
}
