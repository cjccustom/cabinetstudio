// Dining tables on the Quote tab: size it, pick top and base, see seating, wood movement and
// the price that goes on the proposal, with a plan and side view to show the client.
import { useMemo } from 'react';
import { useStore } from '../store';
import { edgeProfiles, type EdgeProfile } from '../model/edgeProfiles';
import { furnitureOf, isBench, stretchersOf, newBench, newTable, seatHeight, seats, tableBaseLabel, tableChecks, tableEstimate, tableFinishLabel, type DiningTable, type TableBase, type TableFinish, type TableLeg } from '../model/furniture';
import { priceQuote, quoteOf } from '../model/quote';
import { tableSpecies } from '../model/tableParts';
import { Field, LengthInput, Section } from './fields';
import { fmt } from '../units';
import { bedChecks, bedEstimate, bedSize, bedsOf, mattressSizes, newBed, type Bed, type MattressSize } from '../model/bed';

const money = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;

export function FurnitureSection() {
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  const tables = furnitureOf(project);
  const setAll = (next: DiningTable[]) => commit((p) => ({ ...p, furniture: next }));
  const put = (id: string, patch: Partial<DiningTable>) => setAll(tables.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const beds = bedsOf(project);
  const setBeds = (next: Bed[]) => commit((p) => ({ ...p, beds: next }));
  return (
    <Section title="Furniture" aside={<span><button className="mini" onClick={() => setAll([...tables, newTable()])}>Add table</button> <button className="mini" onClick={() => setAll([...tables, newBench()])}>Add bench</button> <button className="mini" onClick={() => setBeds([...beds, newBed()])}>Add bed</button></span>}>
      {!tables.length && !beds.length && <p className="hint">Tables (dining, puzzle, game and the like), benches (closet, entry, window) and beds (platform or frame, headboard, drawers): size, construction, species and finish. Priced with your shop rate.</p>}
      {tables.map((t) => <TableEditor key={t.id} t={t} put={(patch) => put(t.id, patch)} remove={() => setAll(tables.filter((x) => x.id !== t.id))} />)}
      {beds.map((b) => <BedEditor key={b.id} b={b} put={(patch) => setBeds(beds.map((x) => (x.id === b.id ? { ...x, ...patch } : x)))} remove={() => setBeds(beds.filter((x) => x.id !== b.id))} />)}
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
  const bench = isBench(t);
  return (
    <div className="stock-row table-ed">
      <div className="sr-head">
        <input aria-label="Name" value={t.name} onChange={(e) => put({ name: e.target.value })} />
        <button className="icon-btn" aria-label={bench ? 'Remove bench' : 'Remove table'} onClick={remove}>×</button>
      </div>
      <TableSketch t={t} />
      <div className="grid3">{len('length', 'Length')}{len('width', bench ? 'Depth' : 'Width')}{len('height', bench ? 'Seat height (wood)' : 'Height')}</div>
      <Field label="What it's for (as the proposal says it)" htmlFor={id('use')}>
        <input id={id('use')} list={bench ? 'bench-uses' : 'table-uses'} value={t.use ?? (bench ? 'bench' : 'dining table')} onChange={(e) => put({ use: e.target.value })} />
        <datalist id="table-uses">{['dining table', 'puzzle table', 'game table', 'kitchen table', 'desk', 'work table', 'console table'].map((u) => <option key={u} value={u} />)}</datalist>
        <datalist id="bench-uses">{['bench', 'closet bench', 'entry bench', 'dressing bench', 'end-of-bed bench', 'window bench'].map((u) => <option key={u} value={u} />)}</datalist>
      </Field>
      {bench && <p className="hint">Seat height {fmt(seatHeight(t))}{t.cushion ? ' with the cushion' : ''}.</p>}
      {t.base === 'legs' && !(bench && t.shelf && t.shelf !== 'none') && (
        <div className="grid3">
          <Field label="Stretchers" htmlFor={id('str')}>
            <select id={id('str')} value={t.stretchers ?? 'none'} onChange={(e) => put({ stretchers: e.target.value as DiningTable['stretchers'] })}>
              <option value="none">None</option><option value="h">H (ends and center)</option><option value="box">All four sides</option>
            </select>
          </Field>
          {t.stretchers && t.stretchers !== 'none' && <Field label="Top off the floor" htmlFor={id('sth')}><LengthInput id={id('sth')} value={t.stretcherHeight ?? 6} onChange={(v) => v != null && put({ stretcherHeight: v })} /></Field>}
        </div>
      )}
      {bench && t.shelf && t.shelf !== 'none' && t.stretchers && t.stretchers !== 'none' && <p className="hint">The shelf rails brace the legs, so no separate stretchers.</p>}
      {bench && (
        <>
          <div className="grid3">
            <Field label="Lower shelf" htmlFor={id('shelf')}>
              <select id={id('shelf')} value={t.shelf ?? 'none'} onChange={(e) => put({ shelf: e.target.value as DiningTable['shelf'] })}>
                <option value="none">None</option><option value="slats">Slatted (shoes)</option><option value="solid">Solid panel</option>
              </select>
            </Field>
            {t.shelf && t.shelf !== 'none' && <Field label="Shelf top off the floor" htmlFor={id('shh')}><LengthInput id={id('shh')} value={t.shelfHeight ?? 5} onChange={(v) => v != null && put({ shelfHeight: v })} /></Field>}
          </div>
          <label className="chk-row"><input type="checkbox" checked={!!t.cushion} onChange={(e) => put({ cushion: e.target.checked })} /> Upholstered seat cushion (by the upholsterer)</label>
          {t.cushion && <div className="grid3"><Field label="Cushion thickness" htmlFor={id('ct')}><LengthInput id={id('ct')} value={t.cushionThick ?? 2} onChange={(v) => v != null && put({ cushionThick: v })} /></Field></div>}
        </>
      )}
      {!bench && /dining/i.test(t.use ?? 'dining table') && <p className="hint">Seats {seats(t)}{t.leaves ? `, ${seats(t, true)} with the leaves in (${fmt(t.length + t.leaves * t.leafWidth)} long)` : ''}.</p>}
      <div className="grid3">
        {len('top', bench ? 'Seat thickness' : 'Top thickness')}
        <Field label="Species" htmlFor={id('sp')}>
          <select id={id('sp')} value={t.species} onChange={(e) => put({ species: e.target.value })}>
            {!tableSpecies.some((x) => x.name === t.species) && <option value={t.species}>{t.species} (not on A&M's list)</option>}
            {tableSpecies.map((x) => <option key={x.name} value={x.name}>{x.label}</option>)}
          </select>
        </Field>
        <Field label="Your $/BF (blank = A&M list)" htmlFor={id('bf')}><input id={id('bf')} inputMode="decimal" value={t.pricePerBF || ''} placeholder="A&M" onChange={(e) => put({ pricePerBF: parseFloat(e.target.value) || 0 })} /></Field>
      </div>
      <div className="grid3">
        {!bench && <Field label="Base" htmlFor={id('base')}>
          <select id={id('base')} value={t.base} onChange={(e) => put({ base: e.target.value as TableBase })}>{Object.entries(tableBaseLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </Field>}
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
        {!bench && <Field label="Leaves" htmlFor={id('lv')}>
          <select id={id('lv')} value={t.leaves} onChange={(e) => put({ leaves: Number(e.target.value) })}>{[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n || 'None'}</option>)}</select>
        </Field>}
        {t.leaves > 0 && len('leafWidth', 'Leaf width')}
        <Field label="Edge" htmlFor={id('edge')}>
          <select id={id('edge')} value={t.edge === 'profile' ? t.edgeProfile ?? 'round14' : t.edge} onChange={(e) => { const v = e.target.value; put(v === 'eased' || v === 'live' ? { edge: v, edgeProfile: undefined } : { edge: 'profile', edgeProfile: v as EdgeProfile }); }}>
            {edgeProfiles.filter((x) => x.v !== 'square').map((x) => <option key={x.v} value={x.v}>{x.label}</option>)}
            <option value="live">Live edge</option>
          </select>
        </Field>
      </div>
      {!bench && <label className="chk-row"><input type="checkbox" checked={t.breadboard} onChange={(e) => put({ breadboard: e.target.checked })} /> Breadboard ends</label>}
      {!bench && <label className="chk-row"><input type="checkbox" checked={!!t.lip} onChange={(e) => put({ lip: e.target.checked })} /> Raised lip around the top (puzzle or game table)</label>}
      {t.lip && (
        <div className="grid3">
          <Field label="Lip above the top" htmlFor={id('liph')}><LengthInput id={id('liph')} value={t.lipHeight ?? 0.75} onChange={(v) => v != null && put({ lipHeight: v })} /></Field>
          <Field label="Lip thickness" htmlFor={id('lipw')}><LengthInput id={id('lipw')} value={t.lipWidth ?? 0.75} onChange={(v) => v != null && put({ lipWidth: v })} /></Field>
          <Field label="Lip goes" htmlFor={id('lips')}>
            <select id={id('lips')} value={t.lipStyle ?? 'edge'} onChange={(e) => put({ lipStyle: e.target.value as DiningTable['lipStyle'] })}>
              <option value="edge">Around the edge of the top</option>
              <option value="onTop">On the top, at the edge</option>
            </select>
          </Field>
        </div>
      )}
      <div className="grid2">
        <Field label="Finish" htmlFor={id('fin')}>
          <select id={id('fin')} value={t.finish} onChange={(e) => put({ finish: e.target.value as TableFinish })}>{Object.entries(tableFinishLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </Field>
        {t.finish === 'painter' && <Field label="Finisher’s price ($)" htmlFor={id('fp')}><input id={id('fp')} inputMode="decimal" value={t.finishPrice || ''} onChange={(e) => put({ finishPrice: parseFloat(e.target.value) || 0 })} /></Field>}
      </div>
      <div className="grid3">
        <Field label="In the room: from left wall" htmlFor={id('rx')}><LengthInput id={id('rx')} value={t.roomX ?? project.room.width / 2} onChange={(v) => v != null && put({ roomX: v })} /></Field>
        <Field label="From back wall" htmlFor={id('rz')}><LengthInput id={id('rz')} value={t.roomZ ?? project.room.depth / 2} onChange={(v) => v != null && put({ roomZ: v })} /></Field>
        <label className="chk-row"><input type="checkbox" checked={!!t.turned} onChange={(e) => put({ turned: e.target.checked })} /> Turned 90°</label>
      </div>
      <p className="hint">Measured to the middle of the {bench ? 'bench' : 'table'}. It shows in the 3D view and floor plan, and gets its own sheet in the customer and shop drawings.</p>
      <ul className="table-checks">{tableChecks(t).map((c) => <li key={c}>{c}</li>)}</ul>
      <table className="totals">
        <tbody>
          {est.hours.map((h) => <tr key={h.label}><td>{h.label}</td><td className="num">{h.hours.toFixed(1)} h</td></tr>)}
          {est.materials.map((m) => <tr key={m.label}><td>{m.label}<span className="note">{m.detail}</span></td><td className="num">{money(m.cost)}</td></tr>)}
          <tr className="sum"><td>{hours.toFixed(1)} h, {money(mats)} materials · price</td><td className="num">{money(price)}</td></tr>
        </tbody>
      </table>
      <p className="hint">Lumber is priced from A&amp;M's surfaced boards by the lineal foot: the top glued up from 1-1/4" (flattened to about 1-1/8"), legs glued up from 1-5/8", aprons from 1", plus 15% for defects and grain matching. Hours are starting standards for a one-off table; adjust as you build them. The price uses your pricing method and goes on the proposal as Furniture.</p>
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
  const seatsN = isBench(t) ? 0 : Math.floor((t.length - (t.base === 'legs' ? 2 * t.legSize : 0)) / 24);
  const shelfY = isBench(t) && t.shelf && t.shelf !== 'none' ? floor - (t.shelfHeight ?? 5) * k : null;
  const cush = isBench(t) && t.cushion ? (t.cushionThick ?? 2) * k : 0;
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
      {t.lip && <rect className="ts-line" x={x0 + (t.lipWidth ?? 0.75) * k} y={yPlan + (t.lipWidth ?? 0.75) * k} width={(t.length - 2 * (t.lipWidth ?? 0.75)) * k} height={planH - 2 * (t.lipWidth ?? 0.75) * k} fill="none" />}
      {t.lip && <rect className="ts-top" x={x0} y={ySide - (t.lipHeight ?? 0.75) * k} width={t.length * k} height={(t.lipHeight ?? 0.75) * k} />}
      {t.breadboard && <><line className="ts-line" x1={x0 + 3 * k} y1={yPlan} x2={x0 + 3 * k} y2={yPlan + planH} /><line className="ts-line" x1={x0 + (t.length - 3) * k} y1={yPlan} x2={x0 + (t.length - 3) * k} y2={yPlan + planH} /></>}
      {t.leaves > 0 && <line className="ts-line dash" x1={x0 + (t.length / 2) * k} y1={yPlan} x2={x0 + (t.length / 2) * k} y2={yPlan + planH} />}
      <g className="ts-base">{base}</g>
      <rect className="ts-top" x={x0} y={ySide} width={t.length * k} height={top} />
      {stretchersOf(t) !== 'none' && <rect className="ts-top" x={x0 + inset + legW / 2} y={floor - (t.stretcherHeight ?? 6) * k} width={t.length * k - 2 * inset - legW} height={1.75 * k} />}
      {shelfY != null && <rect className="ts-top" x={x0 + inset + legW} y={shelfY} width={t.length * k - 2 * (inset + legW)} height={0.75 * k} />}
      {cush > 0 && <rect className="ts-chairs" x={x0 + 0.25 * k} y={ySide - cush} width={(t.length - 0.5) * k} height={cush} rx={2} />}
      <line className="ts-line" x1={0} y1={floor} x2={W} y2={floor} />
      <text x={W / 2} y={yPlan + planH / 2 + 4} textAnchor="middle">{fmt(t.length)} × {fmt(t.width)}</text>
      <text x={W / 2} y={floor + 12} textAnchor="middle">Side view, {isBench(t) ? `${fmt(seatHeight(t))} seat` : `${fmt(t.height)} high`}</text>
    </svg>
  );
}

/* ---------- Beds ---------- */

export function BedEditor({ b, put, remove }: { b: Bed; put: (p: Partial<Bed>) => void; remove: () => void }) {
  const project = useStore((s) => s.project);
  const est = useMemo(() => bedEstimate(b, project), [b, project]);
  const q = quoteOf(project);
  const hours = est.hours.reduce((s, h) => s + h.hours, 0);
  const mats = est.materials.reduce((s, m) => s + m.cost, 0);
  const r = useMemo(() => priceQuote(project), [project]);
  const fg = r.groups.find((g) => g.group === 'furniture');
  const allHours = r.hours.filter((h) => h.group === 'furniture').reduce((s, h) => s + h.hours, 0) || 1;
  const price = fg ? (fg.price * hours) / allHours * (1 + q.workloadAdj[q.workload]) : 0;
  const id = (k: string) => `b-${k}-${b.id}`;
  const len = (k: keyof Bed, label: string) => (
    <Field label={label} htmlFor={id(k)}><LengthInput id={id(k)} value={b[k] as number} onChange={(v) => v != null && put({ [k]: v } as Partial<Bed>)} /></Field>
  );
  const size = bedSize(b);
  return (
    <div className="stock-row table-ed">
      <div className="sr-head">
        <input aria-label="Name" value={b.name} onChange={(e) => put({ name: e.target.value })} />
        <button className="icon-btn" aria-label="Remove bed" onClick={remove}>×</button>
      </div>
      <div className="grid3">
        <Field label="Mattress" htmlFor={id('m')}>
          <select id={id('m')} value={b.mattress} onChange={(e) => put({ mattress: e.target.value as MattressSize })}>
            {Object.entries(mattressSizes).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            <option value="custom">Custom size</option>
          </select>
        </Field>
        {b.mattress === 'custom' && <Field label="Mattress width" htmlFor={id('mw')}><LengthInput id={id('mw')} value={b.mattressW ?? 60} onChange={(v) => v != null && put({ mattressW: v })} /></Field>}
        {b.mattress === 'custom' && <Field label="Mattress length" htmlFor={id('ml')}><LengthInput id={id('ml')} value={b.mattressL ?? 80} onChange={(v) => v != null && put({ mattressL: v })} /></Field>}
        {len('mattressH', 'Mattress thickness')}
      </div>
      <div className="grid3">
        <Field label="Style" htmlFor={id('st')}>
          <select id={id('st')} value={b.style} onChange={(e) => put({ style: e.target.value as Bed['style'] })}>
            <option value="platform">Platform: deck on a set-back base</option>
            <option value="frame">Frame: legs, rails and slats</option>
          </select>
        </Field>
        {len('deckH', b.style === 'platform' ? 'Top of the deck' : 'Top of the slats')}
      </div>
      <p className="hint">About {fmt(size.W)} wide × {fmt(size.L + (b.headboard !== 'none' ? 1.25 : 0))} long; the mattress top lands at {fmt(size.top)}.</p>
      {b.style === 'platform' && (
        <div className="grid3">
          <Field label="Drawers under each side" htmlFor={id('dr')}>
            <select id={id('dr')} value={b.drawers} onChange={(e) => put({ drawers: Number(e.target.value) })}>{[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n || 'None'}</option>)}</select>
          </Field>
          {b.drawers > 0 && (
            <Field label="Which sides" htmlFor={id('ds')}>
              <select id={id('ds')} value={b.drawerSides} onChange={(e) => put({ drawerSides: e.target.value as Bed['drawerSides'] })}>
                <option value="both">Both sides</option><option value="left">Left side only</option><option value="right">Right side only</option>
              </select>
            </Field>
          )}
        </div>
      )}
      <div className="grid3">
        <Field label="Headboard" htmlFor={id('hb')}>
          <select id={id('hb')} value={b.headboard} onChange={(e) => put({ headboard: e.target.value as Bed['headboard'] })}>
            <option value="none">None</option>
            <option value="panel">Frame and flat panels</option>
            <option value="slab">Solid slab</option>
            <option value="upholstered">Upholstered (by the upholsterer)</option>
          </select>
        </Field>
        {b.headboard !== 'none' && len('headH', 'Headboard top off the floor')}
        {b.headboard !== 'none' && (
          <Field label="Mounted" htmlFor={id('hm')}>
            <select id={id('hm')} value={b.headMount} onChange={(e) => put({ headMount: e.target.value as Bed['headMount'] })}>
              <option value="bed">On the bed</option><option value="wall">On the wall (French cleat)</option>
            </select>
          </Field>
        )}
      </div>
      {b.headboard === 'upholstered' && <Field label="Upholsterer’s price ($)" htmlFor={id('up')}><input id={id('up')} inputMode="decimal" value={b.upholsteryPrice || ''} onChange={(e) => put({ upholsteryPrice: parseFloat(e.target.value) || 0 })} /></Field>}
      {b.style === 'frame' && (
        <div className="grid3">
          <label className="chk-row"><input type="checkbox" checked={b.footboard} onChange={(e) => put({ footboard: e.target.checked })} /> Footboard</label>
          {b.footboard && len('footH', 'Footboard top off the floor')}
        </div>
      )}
      <div className="grid3">
        <Field label="Grade" htmlFor={id('gr')}>
          <select id={id('gr')} value={b.grade} onChange={(e) => { const grade = e.target.value as Bed['grade']; put({ grade, ...(grade === 'paint' ? { species: 'Poplar', finish: 'paint' as TableFinish } : b.species === 'Poplar' ? { species: 'White oak', finish: 'clear' as TableFinish } : {}) }); }}>
            <option value="paint">Paint grade (birch plywood, poplar)</option>
            <option value="stain">Stain grade (veneer plywood and solid wood)</option>
          </select>
        </Field>
        {b.grade === 'stain' && (
          <Field label="Species" htmlFor={id('sp')}>
            <select id={id('sp')} value={b.species} onChange={(e) => put({ species: e.target.value })}>{tableSpecies.filter((x) => x.name !== 'Poplar').map((x) => <option key={x.name} value={x.name}>{x.label}</option>)}</select>
          </Field>
        )}
        <Field label="Finish" htmlFor={id('fin')}>
          <select id={id('fin')} value={b.finish} onChange={(e) => put({ finish: e.target.value as TableFinish })}>{Object.entries(tableFinishLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </Field>
        {b.finish === 'painter' && <Field label="Finisher’s price ($)" htmlFor={id('fp')}><input id={id('fp')} inputMode="decimal" value={b.finishPrice || ''} onChange={(e) => put({ finishPrice: parseFloat(e.target.value) || 0 })} /></Field>}
        <Field label="Your $/BF (blank = A&M list)" htmlFor={id('bf')}><input id={id('bf')} inputMode="decimal" value={b.pricePerBF || ''} placeholder="A&M" onChange={(e) => put({ pricePerBF: parseFloat(e.target.value) || 0 })} /></Field>
      </div>
      <div className="grid3">
        <Field label="Headboard against" htmlFor={id('wall')}>
          <select id={id('wall')} value={b.wall ?? 'back'} onChange={(e) => put({ wall: e.target.value as Bed['wall'], offset: undefined })}>
            {(['back', 'left', 'right', 'front'] as const).map((w) => <option key={w} value={w}>{w[0].toUpperCase() + w.slice(1)} wall</option>)}
          </select>
        </Field>
        <Field label="Its center, along that wall" htmlFor={id('off')}><LengthInput id={id('off')} value={b.offset ?? ((b.wall ?? 'back') === 'back' || b.wall === 'front' ? project.room.width / 2 : project.room.depth / 2)} onChange={(v) => v != null && put({ offset: v })} /></Field>
      </div>
      <ul className="table-checks">{bedChecks(b).map((c) => <li key={c}>{c}</li>)}</ul>
      <table className="totals">
        <tbody>
          {est.hours.map((h) => <tr key={h.label}><td>{h.label}</td><td className="num">{h.hours.toFixed(1)} h</td></tr>)}
          {est.materials.map((m) => <tr key={m.label}><td>{m.label}<span className="note">{m.detail}</span>{m.missing && <span className="warn-text"> {m.missing}</span>}</td><td className="num">{money(m.cost)}</td></tr>)}
          <tr className="sum"><td>{hours.toFixed(1)} h, {money(mats)} materials · price</td><td className="num">{money(price)}</td></tr>
        </tbody>
      </table>
      <p className="hint">Hours are starting standards for a one-off bed; adjust them as you build. The price uses your pricing method and goes on the proposal as Furniture. The bed shows in the 3D view.</p>
      <Field label="Notes" htmlFor={id('notes')}><textarea id={id('notes')} rows={2} value={b.notes} onChange={(e) => put({ notes: e.target.value })} /></Field>
    </div>
  );
}
