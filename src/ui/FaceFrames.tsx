import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { defaultFaceFrameStock, faceFrameNeeds, faceFramePieces, woodNeeds, woodPieces, type FaceFrameResult, type FaceFrameStock } from '../model/faceframe';
import { fmt, fmtFeet } from '../units';
import { Field, LengthInput, Section } from './fields';

function useFF() {
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  const stock = { ...defaultFaceFrameStock, ...project.faceFrame };
  const set = (patch: Partial<FaceFrameStock>) => commit((p) => ({ ...p, faceFrame: { ...defaultFaceFrameStock, ...p.faceFrame, ...patch } }));
  const result = useMemo(() => faceFrameNeeds(faceFramePieces(project), stock), [project]); // eslint-disable-line react-hooks/exhaustive-deps
  const wood = useMemo(() => woodNeeds(woodPieces(project), stock), [project]); // eslint-disable-line react-hooks/exhaustive-deps
  return { stock, set, result, wood, jobName: project.name };
}

const lf = (inches: number) => `${(inches / 12).toFixed(1)} lf`;

export function FaceFrameInputs() {
  const { stock: s, set } = useFF();
  const num = (id: string, label: string, value: number, onChange: (v: number) => void, step = '1') => (
    <Field label={label} htmlFor={id}>
      <input id={id} inputMode="decimal" step={step} value={Number.isFinite(value) ? value : ''} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} />
    </Field>
  );
  return (
    <aside className="sidebar">
      <div className="side-body">
        <Section title="Stock you buy">
          <Field label="Species & thickness" htmlFor="ff-species"><input id="ff-species" value={s.species} onChange={(e) => set({ species: e.target.value })} /></Field>
          <div className="grid2" style={{ marginTop: 8 }}>
            <Field label="Board length" htmlFor="ff-bl"><LengthInput id="ff-bl" value={s.boardLength} min={12} onChange={(v) => set({ boardLength: v! })} /></Field>
            <Field label="Typical board width" htmlFor="ff-bw"><LengthInput id="ff-bw" value={s.boardWidth} min={1} onChange={(v) => set({ boardWidth: v! })} /></Field>
            {num('ff-nt', 'Thickness for BF (4/4 = 1)', s.nominalThickness, (v) => set({ nominalThickness: v }), '0.25')}
            {num('ff-price', '$ per board foot', s.pricePerBF, (v) => set({ pricePerBF: v }), '0.05')}
          </div>
          <Field label="Supplier" htmlFor="ff-sup"><input id="ff-sup" value={s.supplier} onChange={(e) => set({ supplier: e.target.value })} /></Field>
        </Section>
        <Section title="Milling allowances">
          <div className="grid2">
            <Field label="Per strip: kerf + jointing" htmlFor="ff-rip"><LengthInput id="ff-rip" value={s.ripAllowance} onChange={(v) => set({ ripAllowance: v! })} /></Field>
            <Field label="Straight-line edge per board" htmlFor="ff-edge"><LengthInput id="ff-edge" value={s.edgeCleanup} onChange={(v) => set({ edgeCleanup: v! })} /></Field>
            <Field label="Extra length per piece" htmlFor="ff-la"><LengthInput id="ff-la" value={s.lengthAllowance} onChange={(v) => set({ lengthAllowance: v! })} /></Field>
            <Field label="End trim per board end" htmlFor="ff-et"><LengthInput id="ff-et" value={s.endTrim} onChange={(v) => set({ endTrim: v! })} /></Field>
            <Field label="Crosscut kerf" htmlFor="ff-kerf"><LengthInput id="ff-kerf" value={s.kerf} onChange={(v) => set({ kerf: v! })} /></Field>
            {num('ff-waste', 'Defect waste %', Math.round(s.waste * 100), (v) => set({ waste: v / 100 }))}
          </div>
          <p className="hint">Strips are ripped {fmt(s.ripAllowance)} over and jointed to finished width. Waste covers knots, checks and color you cut around.</p>
        </Section>
      </div>
    </aside>
  );
}

export function FaceFrameBreakdown() {
  const { result, stock, wood } = useFF();
  const [open, setOpen] = useState<number | null>(null);
  if (!result.groups.length) return <main className="stage cut-stage"><div className="empty pad"><p>No face frames yet. Add cabinets in Design.</p></div></main>;
  return (
    <main className="stage cut-stage">
      <section className="mat-block">
        <header><h2>Length needed by finished width</h2><span className="muted">{stock.species}</span></header>
        <div className="table-wrap">
          <table className="ff-table">
            <thead>
              <tr>
                <th className="num">Finished width</th>
                <th className="num">Rip to</th>
                <th className="num">Pieces</th>
                <th className="num">Total length</th>
                <th className="num">With allowances</th>
                <th className="num">Longest</th>
                <th className="num">{fmtFeet(stock.boardLength)} strips</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {result.groups.map((g, i) => (
                <FFRow key={g.width} g={g} open={open === i} toggle={() => setOpen(open === i ? null : i)} />
              ))}
              <tr className="sum">
                <td className="num">All widths</td>
                <td />
                <td className="num">{result.groups.reduce((t, g) => t + g.count, 0)}</td>
                <td className="num">{fmtFeet(result.groups.reduce((t, g) => t + g.totalLength, 0))}<span className="note">{lf(result.groups.reduce((t, g) => t + g.totalLength, 0))}</span></td>
                <td className="num">{lf(result.groups.reduce((t, g) => t + g.cutLength, 0))}</td>
                <td />
                <td className="num">{result.groups.reduce((t, g) => t + g.strips.length, 0)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        {result.tooLong.length > 0 && (
          <p className="warn">Longer than a {fmtFeet(stock.boardLength)} board after end trim: {result.tooLong.map((p) => `${p.cabinet} ${p.name} ${fmt(p.length)}`).join(', ')}. Buy longer stock for these.</p>
        )}
      </section>

      {wood.length > 0 && (
        <section className="mat-block">
          <header><h2>Tops, seats & caps</h2><span className="muted">{stock.species.replace(/,.*$/, '')}, by rough thickness</span></header>
          <div className="table-wrap">
            <table className="ff-table">
              <thead><tr><th>Piece</th><th className="num">Length</th><th className="num">Width</th><th className="num">Finished</th><th className="num">Buy</th></tr></thead>
              <tbody>
                {wood.flatMap((g) => g.pieces.map((p, i) => (
                  <tr key={`${g.quarters}-${i}`}><td>{p.label}</td><td className="num">{fmt(p.length)}</td><td className="num">{fmt(p.width)}</td><td className="num">{fmt(p.thickness)}</td><td className="num">{g.quarters}/4</td></tr>
                )))}
                {wood.map((g) => (
                  <tr key={g.quarters} className="sum"><td>{g.quarters}/4 stock</td><td /><td /><td /><td className="num">{Math.ceil(g.buyBF)} BF</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">Board feet include 2" of length and 1" of width per glue-up, plus defect waste.</p>
        </section>
      )}

      <section className="mat-block">
        <header><h2>Rip plan</h2><span className="muted">{result.boards.length} boards, {fmt(stock.boardWidth)} × {fmtFeet(stock.boardLength)}</span></header>
        <p className="hint" style={{ marginTop: -4 }}>Each bar is one rough board, widest strips first. Boards rarely come in one width, so treat this as a count. Your actual boards will lay out differently.</p>
        <div className="boards">
          {result.boards.map((b, i) => (
            <div key={i} className="board" title={b.strips.map((w) => fmt(w)).join(' + ')}>
              <span className="board-n">{i + 1}</span>
              <div className="board-bar">
                <span className="board-edge" style={{ flexBasis: `${(stock.edgeCleanup / stock.boardWidth) * 100}%` }} />
                {b.strips.map((w, j) => <span key={j} className="board-strip" style={{ flexBasis: `${(w / stock.boardWidth) * 100}%` }}>{fmt(w - stock.ripAllowance)}</span>)}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function FFRow({ g, open, toggle }: { g: FaceFrameResult['groups'][number]; open: boolean; toggle: () => void }) {
  return (
    <>
      <tr>
        <td className="num"><strong>{fmt(g.width)}</strong></td>
        <td className="num">{fmt(g.ripWidth)}</td>
        <td className="num">{g.count}</td>
        <td className="num">{fmtFeet(g.totalLength)}<span className="note">{lf(g.totalLength)}</span></td>
        <td className="num">{lf(g.cutLength)}</td>
        <td className="num">{fmt(g.longest)}</td>
        <td className="num">{g.strips.length}</td>
        <td><button className="mini" onClick={toggle} aria-expanded={open}>{open ? 'Hide' : 'Pieces'}</button></td>
      </tr>
      {open && (
        <tr className="ff-detail">
          <td colSpan={8}>
            <table>
              <thead><tr><th className="num">Qty</th><th className="num">Length</th><th>Part</th><th>Cabinets</th></tr></thead>
              <tbody>
                {g.pieces.map((p) => (
                  <tr key={p.length}><td className="num">{p.qty}</td><td className="num">{fmt(p.length)}</td><td>{p.names.join(', ')}</td><td className="cabs">{p.cabinets.join(', ')}</td></tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}

export function FaceFrameSummary() {
  const { result: r, stock: s, jobName, wood } = useFF();
  const woodBF = wood.reduce((t, g) => t + g.buyBF, 0);
  const tax = useStore((st) => st.project.settings.purchaseTax);
  const [copied, setCopied] = useState('');
  const text = [
    `Face frame stock: ${jobName}`,
    `${s.species}${s.supplier ? `, from ${s.supplier}` : ''}`,
    '',
    ...r.groups.map((g) => `${fmt(g.width)} finished (rip ${fmt(g.ripWidth)}): ${g.count} pcs, ${fmtFeet(g.totalLength)} (${lf(g.cutLength)} with allowances)`),
    '',
    `Buy about ${Math.ceil(r.buyBF)} BF (${r.boards.length} boards ${fmt(s.boardWidth)} x ${fmtFeet(s.boardLength)} + ${Math.round(s.waste * 100)}% waste)`,
  ].join('\n');
  const copy = () => navigator.clipboard.writeText(text).then(() => setCopied('Copied.'), () => setCopied('Couldn’t reach the clipboard.'));
  return (
    <aside className="panel">
      <div className="panel-body">
        <Section title="To buy">
          <div className="big-stat"><span className="mono">{Math.ceil(r.buyBF + woodBF)}</span> board feet</div>
          {wood.map((g) => <p key={g.quarters} className="hint" style={{ marginTop: 0 }}>{g.quarters}/4 for tops, seats & caps: {Math.ceil(g.buyBF)} BF</p>)}
          <p className="hint" style={{ marginTop: 0 }}>Face frames (4/4): {Math.ceil(r.buyBF)} BF</p>
          <table className="totals">
            <tbody>
              <tr><td>Finished face frames</td><td className="num">{r.netBF.toFixed(1)} BF</td></tr>
              <tr><td>Rough boards ({r.boards.length})</td><td className="num">{r.roughBF.toFixed(1)} BF</td></tr>
              <tr><td>Plus {Math.round(s.waste * 100)}% defect waste</td><td className="num">{r.buyBF.toFixed(1)} BF</td></tr>
              {s.pricePerBF > 0 && <tr><td>At ${s.pricePerBF.toFixed(2)}/BF</td><td className="num">${((r.buyBF + woodBF) * s.pricePerBF).toFixed(2)}</td></tr>}
              {s.pricePerBF > 0 && tax > 0 && <tr className="sum"><td>With {+(tax * 100).toFixed(3)}% sales tax</td><td className="num">${((r.buyBF + woodBF) * s.pricePerBF * (1 + tax)).toFixed(2)}</td></tr>}
            </tbody>
          </table>
          {!s.pricePerBF && <p className="hint">Enter your price per board foot to see the cost. It will feed the quote.</p>}
          <p className="hint">Yield from rough to finished: {r.buyBF ? Math.round((100 * r.netBF) / r.buyBF) : 0}%.</p>
          <div className="order-actions" style={{ marginTop: 10 }}>
            <button onClick={copy}>Copy material list</button>
            {copied && <span className="ok">{copied}</span>}
          </div>
        </Section>
        <Section title="Widths in this job">
          <ul className="assembly">
            {r.groups.map((g) => <li key={g.width}><span className="mono">{fmt(g.width)}</span>: {lf(g.totalLength)}{g.width > 2 ? ' (includes extended stiles)' : ''}</li>)}
          </ul>
        </Section>
      </div>
    </aside>
  );
}
