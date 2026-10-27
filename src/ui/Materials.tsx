// Materials for the job: the plywood the cases (and exposed ends) are cut from and the face frame
// species, picked from the shop's price book. Anything not in the book can be added on the spot,
// and the book's prices can be updated as they change; the job picks up the new prices.
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { deletePrice, dismissError, savePrice, startShop, useShop, type PriceItem } from '../shop/shop';
import { applyBook, chooseSpecies, choosePlywood, findItem, jobSheets, priceBook, priceId, stalePrices } from '../model/pricebook';
import { sheetPrice } from '../model/cutlist';
import { fmt } from '../units';
import { amLumberPulled, amSizes, defaultBoard } from '../model/amLumber';
import { Field, Section } from './fields';

const ADD = '__add';
const money = (v: number | undefined) => (v ? `$${v.toFixed(2)}` : 'no price');
const num = (s: string) => { const v = parseFloat(s.replace(/[$,]/g, '')); return Number.isFinite(v) && v > 0 ? v : 0; };

/** A $ box that saves when you leave it. */
function Money({ id, value, onSave, label, hint }: { id: string; value: number | undefined; onSave: (v: number) => void; label: string; hint?: number }) {
  return (
    <input id={id} key={value ?? 0} className="money" inputMode="decimal" aria-label={label} placeholder={hint ? hint.toFixed(2) : '–'} defaultValue={value ? value.toFixed(2) : ''}
      onBlur={(e) => { const v = num(e.target.value); if (Math.abs(v - (value ?? 0)) > 0.004) onSave(v); }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
  );
}

export function MaterialsSection() {
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  const saved = useShop((s) => s.prices);
  const error = useShop((s) => s.error);
  useEffect(() => { void startShop(); }, []);
  const book = useMemo(() => priceBook(saved), [saved]);
  const s = project.settings;
  const thicknesses = [...new Set(['3/4"', '1/2"', '1/4"', ...jobSheets(project).map((x) => fmt(x.thickness))])];
  const stale = stalePrices(project, book);
  const [adding, setAdding] = useState<null | 'plywood' | 'exposedPlywood' | 'lumber'>(null);

  /** Save an entry, and bring this job's prices along if it uses it. */
  const save = (item: PriceItem) => {
    void savePrice(item);
    const next = priceBook({ ...saved, [item.id]: item });
    commit((p) => applyBook(p, next));
  };
  const plyOptions = book.filter((x) => x.kind === 'plywood');
  const lumber = book.filter((x) => x.kind === 'lumber');
  const casePly = findItem(book, 'plywood', s.plywood)?.name ?? s.plywood ?? 'Prefinished birch';
  const exposedPly = s.exposedPlywood ? findItem(book, 'plywood', s.exposedPlywood)?.name ?? s.exposedPlywood : '';
  const species = findItem(book, 'lumber', s.woodSpecies)?.name ?? s.woodSpecies;
  const board = project.faceFrame?.board ?? defaultBoard;
  const keep = (list: PriceItem[], name: string) => (name && !list.some((x) => x.name === name) ? [name] : []);

  return (
    <Section title="Materials">
      {error && <p className="warn">{error} <button className="link-btn" onClick={dismissError}>OK</button></p>}
      <div className="grid2">
        <Field label="Case plywood" htmlFor="mat-ply">
          <select id="mat-ply" value={adding === 'plywood' ? ADD : casePly} onChange={(e) => {
            if (e.target.value === ADD) return setAdding('plywood');
            setAdding(null);
            commit((p) => choosePlywood(p, 'plywood', e.target.value, book));
          }}>
            {plyOptions.map((x) => <option key={x.id}>{x.name}</option>)}
            {keep(plyOptions, casePly).map((n) => <option key={n}>{n}</option>)}
            <option value={ADD}>Add a plywood…</option>
          </select>
        </Field>
        <Field label="Exposed ends & toe skins" htmlFor="mat-exp">
          <select id="mat-exp" value={adding === 'exposedPlywood' ? ADD : exposedPly} onChange={(e) => {
            if (e.target.value === ADD) return setAdding('exposedPlywood');
            setAdding(null);
            commit((p) => choosePlywood(p, 'exposedPlywood', e.target.value || undefined, book));
          }}>
            <option value="">Same as the cases</option>
            {plyOptions.filter((x) => x.name !== casePly).map((x) => <option key={x.id}>{x.name}</option>)}
            {keep(plyOptions, exposedPly).map((n) => <option key={n}>{n}</option>)}
            <option value={ADD}>Add a plywood…</option>
          </select>
        </Field>
        <Field label="Face frames & solid wood" htmlFor="mat-wood">
          <select id="mat-wood" value={adding === 'lumber' ? ADD : species} onChange={(e) => {
            if (e.target.value === ADD) return setAdding('lumber');
            setAdding(null);
            commit((p) => chooseSpecies(p, e.target.value, book));
          }}>
            {lumber.map((x) => <option key={x.id}>{x.name}</option>)}
            {keep(lumber, species).map((n) => <option key={n}>{n}</option>)}
            <option value={ADD}>Add a species…</option>
          </select>
        </Field>
      </div>
      {adding && (
        <AddItem kind={adding === 'lumber' ? 'lumber' : 'plywood'} thicknesses={thicknesses} book={book} board={board} onCancel={() => setAdding(null)} onSave={(item) => {
          void savePrice(item);
          const next = priceBook({ ...saved, [item.id]: item });
          commit((p) => (adding === 'lumber' ? applyBook(chooseSpecies(p, item.name, next), next) : choosePlywood(p, adding, item.name, next)));
          setAdding(null);
        }} />
      )}
      <p className="hint">
        {jobSheets(project).map((x) => `${x.material} ${money(project.cutlist?.stock.find((y) => y.material === x.material)?.price ?? project.sheetPrices?.[x.material] ?? sheetPrice(x.material))}`).join(' · ')}
        {' · '}{species} {project.faceFrame?.pricePerLF ? `${project.faceFrame.board} ${money(project.faceFrame.pricePerLF)}/lf` : `${money(project.faceFrame?.pricePerBF)}/BF`}. Door material is set under Doors & fronts.
      </p>
      {stale.length > 0 && (
        <div className="warn">
          This job’s prices differ from the price book: {stale.map((x) => `${x.label} ${money(x.job)} → ${money(x.book)}`).join('; ')}.{' '}
          <button className="mini" onClick={() => commit((p) => applyBook(p, book))}>Use current prices</button>
        </div>
      )}
      <details className="supplies" style={{ marginTop: 8 }}>
        <summary>Price book</summary>
        <p className="hint">Lumber by the lineal foot shows A&M’s list price ({amLumberPulled}) in gray; type your own over it when it changes. The shop’s prices are before tax and shared with every job. Change one here when it changes and this job updates with it; other jobs keep theirs until you update them.</p>
        <div className="price-book" style={{ gridTemplateColumns: `repeat(${thicknesses.length}, minmax(0, 1fr)) 1.8em` }}>
          <span className="pb-head pb-name">Plywood, $ per 4×8 sheet</span>{thicknesses.map((t) => <span key={t} className="pb-head num">{t}</span>)}<span />
          {plyOptions.map((x) => (
            <Fragment key={x.id}>
              <span className="pb-name">{x.name}{x.updatedAt ? <span className="note"> · {new Date(x.updatedAt).toLocaleDateString()}</span> : null}</span>
              {thicknesses.map((t) => <Money key={t} id={`pb-${x.id}-${t}`} label={`${x.name} ${t}`} value={x.sheet?.[t]} onSave={(v) => {
                const sheet = { ...x.sheet };
                if (v) sheet[t] = v; else delete sheet[t];
                save({ ...x, sheet });
              }} />)}
              {x.builtin ? <span /> : <button className="mini" title="Remove from the price book" onClick={() => void deletePrice(x.id)}>✕</button>}
            </Fragment>
          ))}
        </div>
        <div className="price-book" style={{ gridTemplateColumns: 'minmax(0, 1fr) 4.4em 4.4em 1.8em' }}>
          <span className="pb-head">Lumber</span><span className="pb-head num" title={`${board}, per lineal foot`}>$/lf {board === defaultBoard ? '1x6' : board}</span><span className="pb-head num">$/BF tops</span><span />
          {lumber.map((x) => (
            <Fragment key={x.id}>
              <span>{x.name}{x.updatedAt ? <span className="note">{new Date(x.updatedAt).toLocaleDateString()}</span> : null}</span>
              <Money id={`pb-${x.id}-lf`} label={`${x.name} ${board} per lineal foot`} value={x.perLF?.[board]} hint={amSizes(x.name)?.[board]} onSave={(v) => {
                const perLF = { ...x.perLF };
                if (v) perLF[board] = v; else delete perLF[board];
                save({ ...x, perLF });
              }} />
              <Money id={`pb-${x.id}`} label={`${x.name} per board foot`} value={x.perBF} onSave={(v) => save({ ...x, perBF: v })} />
              {x.builtin ? <span /> : <button className="mini" title="Remove from the price book" onClick={() => void deletePrice(x.id)}>✕</button>}
            </Fragment>
          ))}
        </div>
        <div className="order-actions">
          <button className="mini" onClick={() => setAdding('plywood')}>Add a plywood</button>
          <button className="mini" onClick={() => setAdding('lumber')}>Add a species</button>
        </div>
      </details>
    </Section>
  );
}

/** A new plywood (with sheet prices) or lumber species (with $/BF) for the book. */
function AddItem({ kind, thicknesses, book, board, onSave, onCancel }: { kind: PriceItem['kind']; thicknesses: string[]; book: PriceItem[]; board: string; onSave: (item: PriceItem) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [prices, setPrices] = useState<Record<string, string>>({});
  const clean = name.trim();
  const taken = clean && findItem(book, kind, clean);
  const submit = () => {
    if (!clean || taken) return;
    const sheet = Object.fromEntries(Object.entries(prices).map(([t, v]) => [t, num(v)]).filter(([, v]) => v));
    onSave({ id: priceId(kind, clean), kind, name: clean, ...(kind === 'plywood' ? { sheet } : { perBF: num(prices.bf ?? ''), perLF: num(prices.lf ?? '') ? { [board]: num(prices.lf ?? '') } : {} }), updatedAt: Date.now() });
  };
  const field = (k: string, label: string) => (
    <Field key={k} label={label} htmlFor={`add-${k}`}><input id={`add-${k}`} className="money" inputMode="decimal" placeholder="$" value={prices[k] ?? ''} onChange={(e) => setPrices({ ...prices, [k]: e.target.value })} /></Field>
  );
  return (
    <div className="add-item">
      <Field label={kind === 'plywood' ? 'Plywood (species or product)' : 'Species'} htmlFor="add-name">
        <input id="add-name" autoFocus value={name} placeholder={kind === 'plywood' ? 'Rift white oak, Baltic birch…' : 'Ash, Sapele…'} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      </Field>
      <div className="grid3">{kind === 'plywood' ? thicknesses.map((t) => field(t, `${t} sheet`)) : <>{field('lf', `$/lf, ${board}`)}{field('bf', '$/BF for tops')}</>}</div>
      {taken && <p className="warn">{taken.name} is already in the book; pick it from the list.</p>}
      <div className="order-actions">
        <button className="primary" disabled={!clean || !!taken} onClick={submit}>Add & use it</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
      <p className="hint">Leave a price blank if you don’t have it yet; the quote will flag it.</p>
    </div>
  );
}
