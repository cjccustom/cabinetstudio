// The furniture builder: pick what it is (dining table, coffee table, bench, bed...), then its shape,
// then build it: size, top, a wood base or a custom fabricated metal one, wood and finish. The piece
// turns in 3D or shows straight on from the front, side and top; its estimate updates as you go.
// Designs go in the shop's library; "Add to this job" puts a copy on the job, where the quote,
// proposal, room and client page pick it up.
import { useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import { useStore } from '../store';
import { useShop, saveFurniture, deleteFurniture } from '../shop/shop';
import { addToJob, designPrice, furnitureTypes, jobPieces, newDesign, removeFromJob, typeInfo, updateInJob, type FurnitureDesign, type FurnitureType } from '../model/furnitureDesign';
import { newTable, tableBaseLabel, tableChecks, tableEstimate, tableFinishLabel, topShapeLabel, type DiningTable, type TableBase, type TableFinish, type TableLeg, type TopShape } from '../model/furniture';
import { tableParts, tableSpecies } from '../model/tableParts';
import { bedParts } from '../model/bed';
import { caseParts } from '../model/casePiece';
import { CaseEditor } from './CaseEditor';
import { metalFinishes, metalForms, newMetalBase, type MetalBase, type MetalForm, type MetalStock } from '../model/metalBase';
import { metalSheetHtml } from '../model/metalSheet';
import { edgeProfiles, type EdgeProfile } from '../model/edgeProfiles';
import { clientName, clientOf, COMPANY } from '../model/client';
import { FurnitureScene, type FurnitureView } from '../three/FurnitureScene';
import { BedEditor } from './Furniture';
import { AddPartFields, PartEditor } from './PieceEditor';
import type { PieceEdits } from '../model/pieceEdits';
import { Field, LengthInput } from './fields';
import { askConfirm } from './Confirm';
import { capability, type Downloads } from '../runtime';
import { asciiHtml } from '../dropbox';
import { fmt } from '../units';

/** A piece to open when the builder shows (from the Quote tab's list). */
export const useFurnitureUI = create<{ openId: string | null }>(() => ({ openId: null }));

const money = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;

async function saveFile(filename: string, data: Blob) {
  const downloads = await capability<Downloads>('downloads');
  if (downloads) await downloads.save({ filename, data });
  else { const a = document.createElement('a'); a.href = URL.createObjectURL(data); a.download = filename; a.click(); }
}

export function FurnitureBuilder() {
  const library = useShop((s) => s.furniture);
  const designs = useMemo(() => Object.values(library).sort((a, b) => a.name.localeCompare(b.name)), [library]);
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  const inJob = useMemo(() => jobPieces(project), [project]);
  // What's open: a library design (a draft until saved) or a piece on the job (changes go straight in)
  const [open, setOpen] = useState<{ where: 'library' | 'job'; d: FurnitureDesign } | null>(null);
  const [step, setStep] = useState<'pick' | 'shape' | 'edit'>('edit');
  const [pickType, setPickType] = useState<FurnitureType | null>(null);
  const [view, setView] = useState<FurnitureView>('3d');
  const [msg, setMsg] = useState('');
  // The part picked in the 3D (name#index), and whether the whole set is picked
  const [sel, setSel] = useState<string | null>(null);
  const [pickAll, setPickAll] = useState(true);
  const openId = useFurnitureUI((s) => s.openId);
  useEffect(() => {
    if (!openId) return;
    const d = jobPieces(useStore.getState().project).find((x) => x.id === openId);
    if (d) { setOpen({ where: 'job', d }); setStep('edit'); }
    useFurnitureUI.setState({ openId: null });
  }, [openId]);
  // A job piece follows the job (undo, other edits)
  const live = open?.where === 'job' ? inJob.find((x) => x.id === open.d.id) ?? null : open?.d ?? null;
  const saved = open?.where === 'library' ? library[open.d.id] : undefined;
  const dirty = open?.where === 'library' && JSON.stringify({ ...saved, updatedAt: 0 }) !== JSON.stringify({ ...open.d, updatedAt: 0 });

  const change = (next: FurnitureDesign) => {
    if (!open) return;
    if (open.where === 'job') commit((p) => updateInJob(p, next));
    setOpen({ ...open, d: next });
  };
  const putTable = (patch: Partial<DiningTable>) => live?.table && change({ ...live, table: { ...live.table, ...patch } });
  // Hand changes live on the table or the bed itself
  const pe: PieceEdits = live?.table ? { edits: live.table.edits, added: live.table.added } : live?.bed ? { edits: live.bed.edits, added: live.bed.added } : live?.case ? { edits: live.case.edits, added: live.case.added } : {};
  const setPe = (n: PieceEdits) => { if (!live) return; if (live.table) change({ ...live, table: { ...live.table, edits: n.edits, added: n.added } }); else if (live.bed) change({ ...live, bed: { ...live.bed, edits: n.edits, added: n.added } }); else if (live.case) change({ ...live, case: { ...live.case, edits: n.edits, added: n.added } }); };
  useEffect(() => setSel(null), [open?.d.id]);
  const leave = async () => !dirty || (await askConfirm(`Leave ${open!.d.name} without saving your changes?`, 'Leave it'));
  const startNew = async () => { if (!(await leave())) return; setOpen(null); setStep('pick'); setPickType(null); setMsg(''); };
  const choose = (type: FurnitureType) => {
    const info = typeInfo(type);
    if (info.shapes && info.shapes.length > 1) { setPickType(type); setStep('shape'); return; }
    setOpen({ where: 'library', d: newDesign(type) }); setStep('edit'); setView('3d');
  };
  const shape = (s: TopShape) => { setOpen({ where: 'library', d: newDesign(pickType!, s) }); setStep('edit'); setView('3d'); };
  const openDesign = async (d: FurnitureDesign, where: 'library' | 'job') => { if (!(await leave())) return; setOpen({ where, d }); setStep('edit'); setMsg(''); };

  const save = async () => { if (!open) return; const d = { ...open.d, updatedAt: Date.now() }; await saveFurniture(d); setOpen({ where: 'library', d }); setMsg('Saved to the furniture library.'); };
  const add = () => {
    if (!open) return;
    let id = '';
    commit((p) => { const r = addToJob(p, open.d); id = r.id; return r.project; });
    setMsg(`Added to ${project.name}: it's on the quote and proposal as Furniture, and in the room’s 3D. Its copy on the job is open now.`);
    setTimeout(() => { const d = jobPieces(useStore.getState().project).find((x) => x.id === id); if (d) setOpen({ where: 'job', d }); }, 0);
  };
  const remove = async () => {
    if (!open) return;
    if (open.where === 'job') {
      if (!(await askConfirm(`Take ${open.d.name} off this job? It comes off the quote and proposal (the library design, if any, stays).`, 'Take it off'))) return;
      commit((p) => removeFromJob(p, open.d.id));
    } else {
      if (!(await askConfirm(`Delete ${open.d.name} from the furniture library? Jobs already using it keep their copy.`, 'Delete'))) return;
      await deleteFurniture(open.d.id);
    }
    setOpen(null); setStep('pick');
  };
  const fabSheet = async () => {
    const t = live?.table;
    if (!t?.metal) return;
    const html = metalSheetHtml({ ...t, name: live!.name }, { company: COMPANY, job: project.name, client: clientName(clientOf(project)) || undefined });
    try { await saveFile(`${live!.name} - steel base for quote.html`, new Blob([asciiHtml(html)], { type: 'text/html' })); setMsg('Fabricator drawing saved. Open it and print it, or attach it to an email to the metal shop.'); }
    catch (e) { const code = (e as { code?: string }).code; if (code !== 'declined' && code !== 'cancelled') setMsg('Couldn’t save the drawing.'); }
  };

  // The piece as the 3D draws it
  const look = live?.table ?? (live?.bed ? { ...newTable(), finish: live.bed.finish, species: live.bed.grade === 'paint' ? 'Poplar' : live.bed.species } : live?.case ? { ...newTable(), finish: live.case.finish, species: live.case.grade === 'paint' ? 'Poplar' : live.case.species, edge: 'eased' as const } : null);
  const parts = useMemo(() => (live?.table ? tableParts(live.table) : live?.bed ? bedParts(live.bed) : live?.case ? caseParts(live.case) : []), [live]);
  const price = useMemo(() => (live ? designPrice(project, live) : null), [live, project]);

  return (
    <>
      <aside className="sidebar">
        <div className="side-body">
          <button className="primary" onClick={startNew}>New piece</button>
          <h3>In this job</h3>
          {inJob.length ? <ul className="part-list">{inJob.map((d) => <li key={d.id}><button className={open?.where === 'job' && open.d.id === d.id ? 'on' : ''} onClick={() => openDesign(d, 'job')}><span><b>{d.name}</b><span className="hint">{pieceSize(d)}</span></span></button></li>)}</ul> : <p className="hint">Nothing yet. Build a piece, then Add to this job.</p>}
          <h3>Furniture library</h3>
          <p className="hint">Your designs, shared by every job. Start one from here to reuse it.</p>
          {designs.length ? <ul className="part-list">{designs.map((d) => <li key={d.id}><button className={open?.where === 'library' && open.d.id === d.id ? 'on' : ''} onClick={() => openDesign(d, 'library')}><span><b>{d.name}</b><span className="hint">{typeInfo(d.type)?.label} · {pieceSize(d)}</span></span></button></li>)}</ul> : <p className="hint">No designs saved yet.</p>}
        </div>
      </aside>
      {step === 'pick' || (!open && step !== 'shape') ? (
        <>
          <main className="stage fb-gallery">
            <h2>What are you building?</h2>
            {[...new Set(furnitureTypes.map((t) => t.group))].map((g) => (
              <section key={g}>
                <h3>{g}</h3>
                <div className="fb-cards">
                  {furnitureTypes.filter((t) => t.group === g).map((t) => (
                    <button key={t.id} className="fb-card" disabled={t.soon} onClick={() => choose(t.id)}>
                      <TypeIcon type={t.id} /><b>{t.label}</b><span className="hint">{t.hint}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </main>
          <aside className="panel"><div className="panel-body"><p className="hint">Pick what you’re building. Each starts at sizes that suit it; change anything after.</p></div></aside>
        </>
      ) : step === 'shape' && pickType ? (
        <>
          <main className="stage fb-gallery">
            <h2>{typeInfo(pickType).label}: pick the top’s shape</h2>
            <div className="fb-cards">
              {typeInfo(pickType).shapes!.map((s) => <button key={s} className="fb-card" onClick={() => shape(s)}><ShapeIcon shape={s} /><b>{topShapeLabel[s]}</b></button>)}
            </div>
            <p><button className="link-btn" onClick={() => setStep('pick')}>← Back to the list</button></p>
          </main>
          <aside className="panel"><div className="panel-body"><p className="hint">A square is a rectangle with the same length and width. Round, oval and racetrack tops get their base set inside the curve.</p></div></aside>
        </>
      ) : live && look ? (
        <>
          <main className="stage part-canvas">
            <div className="seg part-views" role="tablist" aria-label="View">
              {([['3d', '3D'], ['front', 'Front'], ['side', 'Side'], ['top', 'Top']] as const).map(([v, label]) => <button key={v} role="tab" aria-selected={view === v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{label}</button>)}
            </div>
            <div className="part-3d"><FurnitureScene key={`${live.id}-${view}`} look={look} parts={parts} view={view} onPick={setSel}
                selected={(key, name) => !!sel && (key === sel || (sel.slice(0, sel.lastIndexOf('#')) === name && !parts.find((p) => p.name === name)?.added && pickAll))} /><span className="part-3d-dims">{pieceSize(live)}{view === '3d' ? ' · drag to turn, scroll or pinch to zoom' : ''}</span></div>
          </main>
          <aside className="panel">
            <div className="panel-body">
              <p className="hint">{open!.where === 'job' ? `On ${project.name}: changes go straight onto the job.` : saved ? 'From the furniture library.' : 'New design: save it to the library, add it to this job, or both.'}</p>
              {sel && <PartEditor key={sel} parts={parts} sel={sel} pe={pe} setPe={setPe} onDone={() => setSel(null)} onSelect={setSel} all={pickAll} setAll={setPickAll} />}
              {!sel && <p className="hint">Click any part in the 3D to change its size, move it, or route a profile on its edges.</p>}
              <Field label="Name" htmlFor="fb-name"><input id="fb-name" value={live.name} onChange={(e) => change({ ...live, name: e.target.value, ...(live.table ? { table: { ...live.table, name: e.target.value } } : {}), ...(live.bed ? { bed: { ...live.bed, name: e.target.value } } : {}), ...(live.case ? { case: { ...live.case, name: e.target.value } } : {}) })} /></Field>
              {live.table && <TablePanel t={live.table} type={live.type} put={putTable} onFab={fabSheet} inJob={open!.where === 'job'} />}
              {live.bed && <BedEditor embedded b={live.bed} put={(patch) => change({ ...live, bed: { ...live.bed!, ...patch } })} remove={remove} />}
              {live.case && <CaseEditor c={live.case} put={(patch) => change({ ...live, case: { ...live.case!, ...patch } })} />}
              {!sel && <AddPartFields pe={pe} setPe={setPe} height={live.table?.height ?? live.bed?.headH ?? live.case?.height ?? 30} onSelect={setSel} />}
              {price && (
                <div className="fb-price"><span>{price.hours.toFixed(1)} h · {money(price.materials)} materials</span><b>{money(price.price)}</b></div>
              )}
              <p className="hint">The price at this job’s pricing method and workload: what it adds to the proposal as Furniture.</p>
              <div className="order-actions">
                {open!.where === 'library' && <button className="primary" disabled={!!saved && !dirty} onClick={save}>{saved ? 'Save changes' : 'Save to library'}</button>}
                {open!.where === 'library' && <button onClick={add}>Add to this job</button>}
                {open!.where === 'job' && <button onClick={async () => { const d = { ...live, id: live.table?.designId ?? newDesign(live.type).id, updatedAt: Date.now() }; await saveFurniture(d); setMsg('Saved a copy to the furniture library.'); }}>Save a copy to the library</button>}
                {(open!.where === 'job' || saved) && <button className="danger" onClick={remove}>{open!.where === 'job' ? 'Take off this job' : 'Delete'}</button>}
              </div>
              {msg && <p className="ok">{msg}</p>}
            </div>
          </aside>
        </>
      ) : (
        <>
          <main className="stage part-canvas empty"><p className="hint">Pick a piece on the left, or start a new one.</p></main>
          <aside className="panel" />
        </>
      )}
    </>
  );
}

function pieceSize(d: FurnitureDesign): string {
  if (d.table) {
    const t = d.table;
    return t.shape === 'round' ? `${fmt(t.length)} round × ${fmt(t.height)} high` : `${fmt(t.length)} × ${fmt(t.width)} × ${fmt(t.height)} high`;
  }
  if (d.case) return `${fmt(d.case.width)} × ${fmt(d.case.depth)} × ${fmt(d.case.height)} high`;
  const b = d.bed!;
  return `${b.mattress === 'custom' ? 'custom' : b.mattress} ${b.style} bed`;
}

/** Everything for a table-type piece: size and shape, top, base (wood or metal), wood and finish. */
function TablePanel({ t, type, put, onFab, inJob }: { t: DiningTable; type: FurnitureType; put: (p: Partial<DiningTable>) => void; onFab: () => void; inJob: boolean }) {
  const project = useStore((s) => s.project);
  const id = (k: string) => `fb-${k}`;
  const len = (k: keyof DiningTable, label: string, min = 0.25) => <Field label={label} htmlFor={id(k)}><LengthInput id={id(k)} value={t[k] as number} min={min} onChange={(v) => v != null && put({ [k]: v } as Partial<DiningTable>)} /></Field>;
  const shapes = typeInfo(type)?.shapes ?? ['rect'];
  const shape = t.shape ?? 'rect';
  const seat = type === 'bench' || type === 'stool';
  const est = useMemo(() => tableEstimate(t, project), [t, project]);
  const m = t.metal;
  const putM = (patch: Partial<MetalBase>) => put({ metal: { ...m!, ...patch } });
  return (
    <>
      <h4>Size and shape</h4>
      {shapes.length > 1 && (
        <Field label="Top shape" htmlFor={id('shape')}>
          <select id={id('shape')} value={shape} onChange={(e) => { const s = e.target.value as TopShape; put({ shape: s, ...(s === 'round' ? { width: t.length } : {}), ...(s !== 'rect' ? { breadboard: false } : {}) }); }}>
            {shapes.map((s) => <option key={s} value={s}>{topShapeLabel[s]}</option>)}
          </select>
        </Field>
      )}
      <div className="grid3">
        {shape === 'round' ? <Field label="Diameter" htmlFor={id('len')}><LengthInput id={id('len')} value={t.length} min={10} onChange={(v) => v != null && put({ length: v, width: v })} /></Field> : <>{len('length', 'Length', 10)}{len('width', seat ? 'Depth' : 'Width', 8)}</>}
        {len('height', seat ? 'Seat height' : 'Height', 8)}
      </div>
      <h4>Top</h4>
      <div className="grid3">
        {len('top', seat ? 'Seat thickness' : 'Top thickness', 0.5)}
        <Field label="Edge" htmlFor={id('edge')}>
          <select id={id('edge')} value={t.edge === 'profile' ? t.edgeProfile ?? 'round14' : t.edge} onChange={(e) => { const v = e.target.value; put(v === 'eased' || v === 'live' ? { edge: v, edgeProfile: undefined } : { edge: 'profile', edgeProfile: v as EdgeProfile }); }}>
            {edgeProfiles.filter((x) => x.v !== 'square').map((x) => <option key={x.v} value={x.v}>{x.label}</option>)}
            {shape === 'rect' && <option value="live">Live edge</option>}
          </select>
        </Field>
        {!seat && (type === 'dining' || type === 'kitchen' || type === 'scratch') && shape !== 'round' && (
          <Field label="Extension leaves" htmlFor={id('lv')}><select id={id('lv')} value={t.leaves} onChange={(e) => put({ leaves: Number(e.target.value) })}>{[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n || 'None'}</option>)}</select></Field>
        )}
      </div>
      {t.leaves > 0 && <div className="grid3">{len('leafWidth', 'Leaf width', 6)}</div>}
      {!seat && shape === 'rect' && <label className="chk-row"><input type="checkbox" checked={t.breadboard} onChange={(e) => put({ breadboard: e.target.checked })} /> Breadboard ends</label>}
      <h4>Base</h4>
      <div className="seg" role="group" aria-label="Base">
        <button className={!m ? 'on' : ''} onClick={() => put({ metal: undefined })}>Wood</button>
        <button className={m ? 'on' : ''} onClick={() => put({ metal: m ?? { ...newMetalBase(), ...(shape === 'round' ? { form: 'pedestal' as MetalForm } : {}) } })}>Custom metal (fabricated)</button>
      </div>
      {!m && (
        <>
          <div className="grid3">
            <Field label="Style" htmlFor={id('base')}>
              <select id={id('base')} value={t.base} onChange={(e) => put({ base: e.target.value as TableBase })}>{(Object.keys(tableBaseLabel) as TableBase[]).filter((b) => !seat || b === 'legs' || b === 'trestle').map((b) => <option key={b} value={b}>{tableBaseLabel[b]}</option>)}</select>
            </Field>
            {t.base === 'legs' && <Field label="Legs" htmlFor={id('leg')}><select id={id('leg')} value={t.leg} onChange={(e) => put({ leg: e.target.value as TableLeg })}><option value="square">Square</option><option value="tapered">Tapered</option><option value="turned">Turned</option></select></Field>}
            {t.base === 'legs' && len('legSize', 'Leg size', 1)}
          </div>
          {t.base === 'legs' && (
            <div className="grid3">
              {len('apron', 'Apron height', 1)}
              <Field label="Stretchers" htmlFor={id('str')}><select id={id('str')} value={t.stretchers ?? 'none'} onChange={(e) => put({ stretchers: e.target.value as DiningTable['stretchers'] })}><option value="none">None</option><option value="h">H stretcher</option><option value="box">All around</option></select></Field>
              <Field label="Lower shelf" htmlFor={id('sh')}><select id={id('sh')} value={t.shelf ?? 'none'} onChange={(e) => put({ shelf: e.target.value as DiningTable['shelf'] })}><option value="none">None</option><option value="slats">Slats</option><option value="solid">Solid panel</option></select></Field>
              {t.shelf && t.shelf !== 'none' && len('shelfHeight', 'Shelf height', 2)}
            </div>
          )}
          {t.base === 'legs' && t.leg === 'turned' && <Field label="Turning, each leg ($)" htmlFor={id('turn')}><input id={id('turn')} inputMode="decimal" value={t.turningEach || ''} onChange={(e) => put({ turningEach: parseFloat(e.target.value) || 0 })} /></Field>}
        </>
      )}
      {m && (
        <>
          <div className="fb-forms">
            {(Object.keys(metalForms) as MetalForm[]).map((f) => <button key={f} className={`fb-form${m.form === f ? ' on' : ''}`} title={metalForms[f].hint} onClick={() => putM({ form: f })}><MetalIcon form={f} /><span>{metalForms[f].label}</span></button>)}
          </div>
          <p className="hint">{metalForms[m.form].hint}.</p>
          <div className="grid3">
            {m.form !== 'hairpin' && <Field label="Stock" htmlFor={id('stock')}><select id={id('stock')} value={m.stock} onChange={(e) => putM({ stock: e.target.value as MetalStock })}><option value="square">Square tube</option><option value="round">Round tube</option><option value="flat">Flat bar</option></select></Field>}
            <Field label={m.form === 'hairpin' ? 'Rod diameter' : m.stock === 'flat' ? 'Bar width' : 'Tube size'} htmlFor={id('msize')}><LengthInput id={id('msize')} value={m.size} min={0.25} onChange={(v) => v != null && putM({ size: v })} /></Field>
            {m.form !== 'hairpin' && <Field label={m.stock === 'flat' ? 'Bar thickness' : 'Wall'} htmlFor={id('wall')}><LengthInput id={id('wall')} value={m.wall} min={0.0625} onChange={(v) => v != null && putM({ wall: v })} /></Field>}
          </div>
          <div className="grid3">
            <Field label="Finish" htmlFor={id('mfin')}><select id={id('mfin')} value={m.finish} onChange={(e) => putM({ finish: e.target.value as MetalBase['finish'] })}>{Object.entries(metalFinishes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            {(m.finish === 'powder' || m.finish === 'painted') && <Field label="Color" htmlFor={id('mcol')}><input id={id('mcol')} list="fb-colors" value={m.color} onChange={(e) => putM({ color: e.target.value })} /><datalist id="fb-colors">{['Black', 'Matte black', 'Bronze', 'Oil rubbed bronze', 'White', 'Gray', 'Brass', 'Gold'].map((c) => <option key={c} value={c} />)}</datalist></Field>}
            <Field label="In from the top's edge" htmlFor={id('inset')}><LengthInput id={id('inset')} value={m.inset} min={0} onChange={(v) => v != null && putM({ inset: v })} /></Field>
          </div>
          <div className="grid3">
            <Field label="Fabricator’s price for the job ($)" htmlFor={id('mprice')}><input id={id('mprice')} inputMode="decimal" value={m.price || ''} placeholder="from their quote" onChange={(e) => putM({ price: parseFloat(e.target.value) || 0 })} /></Field>
            <Field label="Your markup (%)" htmlFor={id('mk')}><input id={id('mk')} inputMode="decimal" value={Math.round(m.markup * 100)} onChange={(e) => putM({ markup: (parseFloat(e.target.value) || 0) / 100 })} /></Field>
          </div>
          <Field label="Notes for the fabricator" htmlFor={id('mnotes')}><textarea id={id('mnotes')} rows={2} value={m.notes ?? ''} placeholder="Leveling feet, matching another piece, delivery…" onChange={(e) => putM({ notes: e.target.value || undefined })} /></Field>
          <div className="order-actions"><button onClick={onFab}>Fabricator drawing (for their quote)</button></div>
          <p className="hint">The drawing has the base from the front and the end with its sizes, a cut list of the members, the stock, the finish and how it mounts. Send it to the metal shop; type their price for the job above.</p>
        </>
      )}
      <h4>Wood and finish</h4>
      <div className="grid3">
        <Field label="Species" htmlFor={id('sp')}><select id={id('sp')} value={t.species} onChange={(e) => put({ species: e.target.value })}>{tableSpecies.map((x) => <option key={x.name} value={x.name}>{x.label}</option>)}</select></Field>
        <Field label="Finish" htmlFor={id('fin')}><select id={id('fin')} value={t.finish} onChange={(e) => put({ finish: e.target.value as TableFinish })}>{Object.entries(tableFinishLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Your $/BF (blank = A&M)" htmlFor={id('bf')}><input id={id('bf')} inputMode="decimal" value={t.pricePerBF || ''} placeholder="A&M" onChange={(e) => put({ pricePerBF: parseFloat(e.target.value) || 0 })} /></Field>
      </div>
      {t.finish === 'painter' && <Field label="Finisher’s price ($)" htmlFor={id('fp')}><input id={id('fp')} inputMode="decimal" value={t.finishPrice || ''} onChange={(e) => put({ finishPrice: parseFloat(e.target.value) || 0 })} /></Field>}
      {seat && (
        <div className="grid3">
          <label className="chk-row"><input type="checkbox" checked={!!t.cushion} onChange={(e) => put({ cushion: e.target.checked })} /> Upholstered cushion</label>
          {t.cushion && len('cushionThick', 'Cushion thickness', 0.5)}
        </div>
      )}
      {inJob && (
        <div className="grid3">
          <Field label="In the room: from left wall" htmlFor={id('rx')}><LengthInput id={id('rx')} value={t.roomX ?? project.room.width / 2} onChange={(v) => v != null && put({ roomX: v })} /></Field>
          <Field label="From back wall" htmlFor={id('rz')}><LengthInput id={id('rz')} value={t.roomZ ?? project.room.depth / 2} onChange={(v) => v != null && put({ roomZ: v })} /></Field>
          <label className="chk-row"><input type="checkbox" checked={!!t.turned} onChange={(e) => put({ turned: e.target.checked })} /> Turned 90°</label>
        </div>
      )}
      <ul className="table-checks">{tableChecks(t).map((c) => <li key={c}>{c}</li>)}</ul>
      <details>
        <summary>Hours and materials</summary>
        <table className="totals"><tbody>
          {est.hours.map((h) => <tr key={h.label}><td>{h.label}</td><td className="num">{h.hours.toFixed(1)} h</td></tr>)}
          {est.materials.map((x) => <tr key={x.label}><td>{x.label}<span className="note">{x.detail}</span></td><td className="num">{money(x.cost)}</td></tr>)}
        </tbody></table>
      </details>
    </>
  );
}

/* ---------- Little pictures for the gallery ---------- */

function TypeIcon({ type }: { type: FurnitureType }) {
  const st = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' as const };
  const d: Record<FurnitureType, JSX.Element> = {
    dining: <><path d="M8 26h48M12 26v22M52 26v22M10 30h44" {...st} /></>,
    kitchen: <><path d="M10 24h44M14 24v24M50 24v24M14 40h36" {...st} /></>,
    coffee: <><path d="M6 36h52M10 36v12M54 36v12M10 44h44" {...st} /></>,
    side: <><path d="M20 26h24M23 26v22M41 26v22M23 40h18" {...st} /></>,
    console: <><path d="M6 24h52M9 24v24M55 24v24M9 28h46" {...st} /></>,
    desk: <><path d="M6 24h52M9 24v24M55 24v24M36 24v12h19" {...st} /></>,
    bench: <><path d="M8 36h48M12 36v12M52 36v12M12 44h40" {...st} /></>,
    stool: <><path d="M22 22h20M25 22l-3 26M39 22l3 26M24 38h16" {...st} /></>,
    bed: <><path d="M8 18v30M8 32h48v16M8 32V22h14v10M56 36v12" {...st} /></>,
    nightstand: <><path d="M16 18h32M18 18v22h28V18M18 29h28M30 23h4M30 34h4M19 40v8M45 40v8" {...st} /></>,
    dresser: <><path d="M6 16h52M8 16v28h48V16M8 23h48M32 16v7M8 30h48M8 37h48M10 44v4M54 44v4M18 19h4M42 19h4M30 26h4M30 33h4M30 40h4" {...st} /></>,
    chest: <><path d="M16 8h32M18 8v40h28V8M18 15h28M32 8v7M18 22h28M18 30h28M18 39h28M30 18h4M30 25h4M30 34h4M30 43h4" {...st} /></>,
    sideboard: <><path d="M4 20h56M6 20v20h52V20M6 26h52M23 20v20M41 20v20M8 40v8M56 40v8M13 23h4M30 23h4M48 23h4" {...st} /></>,
    media: <><path d="M4 28h56M6 28v16h52V28M6 34h52M23 28v16M41 28v16M8 44v4M56 44v4" {...st} /></>,
    scratch: <><path d="M32 18v28M18 32h28" {...st} /></>,
  };
  return <svg viewBox="0 0 64 64" width="56" height="56" aria-hidden="true">{d[type]}</svg>;
}

function ShapeIcon({ shape }: { shape: TopShape }) {
  const st = { fill: '#e8dcc4', stroke: 'currentColor', strokeWidth: 2 };
  return <svg viewBox="0 0 80 50" width="80" height="50" aria-hidden="true">
    {shape === 'rect' && <rect x="6" y="9" width="68" height="32" {...st} />}
    {shape === 'round' && <circle cx="40" cy="25" r="20" {...st} />}
    {shape === 'oval' && <ellipse cx="40" cy="25" rx="34" ry="17" {...st} />}
    {shape === 'racetrack' && <rect x="6" y="9" width="68" height="32" rx="16" {...st} />}
  </svg>;
}

function MetalIcon({ form }: { form: MetalForm }) {
  const st = { fill: 'none', stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'square' as const };
  const d: Record<MetalForm, string> = {
    u: 'M10 44V10h28v34', sled: 'M10 44V10h28v34H10', x: 'M10 44L38 10M10 10l28 34M10 10h28', trapezoid: 'M6 44l8-34h20l8 34H6',
    hairpin: 'M12 10l6 34 6-34M30 10l6 34 6-34', box: 'M10 10h28v34H10z', pedestal: 'M8 44h32M24 44V10M14 10h20',
  };
  return <svg viewBox="0 0 48 54" width="40" height="44" aria-hidden="true"><path d={d[form]} {...st} /></svg>;
}
