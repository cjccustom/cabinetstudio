// Sections and details for the drawing sets: add the ones a job needs, title and note them, and
// choose which set each goes in. Also reachable from the editor for the object being edited.
import { useState } from 'react';
import { useStore } from '../store';
import { detailOk, detailTitle, detailsOf, newDetail, suggestedCut, type Detail } from '../drawings/details';
import { cofferOf } from '../model/coffer';
import { wallNames, wallOrder } from '../model/layout';
import type { Cabinet, Project, WallId } from '../model/types';
import { Field, LengthInput, Section } from './fields';

/** Add a detail to the job (once: the same one twice just stays). */
export function addDetail(d: Omit<Detail, 'id'>) {
  useStore.getState().commit((p) => {
    const same = detailsOf(p).some((x) => x.kind === d.kind && x.cabinetId === d.cabinetId && x.wall === d.wall && (d.kind !== 'wall' || (x.at === d.at && (x.zoom ?? 'full') === (d.zoom ?? 'full'))));
    return same ? p : { ...p, details: [...detailsOf(p), newDetail(d)] };
  });
}
const has = (p: Project, pred: (d: Detail) => boolean) => detailsOf(p).some(pred);

/** Buttons for the editor: sections of this cabinet, or of the ceiling. */
export function DetailButtons({ cab, ceiling }: { cab?: Cabinet; ceiling?: boolean }) {
  const project = useStore((s) => s.project);
  if (ceiling) {
    if (!cofferOf(project).on) return null;
    const on = has(project, (d) => d.kind === 'beam');
    return <div className="order-actions"><button className="mini" disabled={on} onClick={() => addDetail({ kind: 'beam' })}>{on ? 'Beam section is on the drawings' : 'Add a beam section to the drawings'}</button></div>;
  }
  if (!cab) return null;
  const sectionable = cab.kind === 'base' || cab.kind === 'wall' || cab.kind === 'tall';
  const at = Math.round((cab.offset + cab.width * 0.35) * 4) / 4;
  const wallOn = has(project, (d) => d.kind === 'wall' && (d.zoom ?? 'full') === 'full' && d.wall === cab.wall && d.at != null && d.at >= cab.offset && d.at <= cab.offset + cab.width);
  const cabOn = has(project, (d) => d.kind === 'cabinet' && d.cabinetId === cab.id);
  return (
    <Section title="On the drawings">
      <div className="order-actions">
        {!cab.island && <button className="mini" disabled={wallOn} onClick={() => addDetail({ kind: 'wall', wall: cab.wall, at })}>{wallOn ? 'Wall section here is on the drawings' : `Wall section through ${cab.name}`}</button>}
        {sectionable && <button className="mini" disabled={cabOn} onClick={() => addDetail({ kind: 'cabinet', cabinetId: cab.id })}>{cabOn ? `${cab.name} section is on the drawings` : `Section of ${cab.name}`}</button>}
        {!cab.island && <button className="mini" onClick={() => addDetail({ kind: 'wall', wall: cab.wall, at, zoom: 'top' })}>Enlarged: crown at the ceiling</button>}
        {!cab.island && <button className="mini" onClick={() => addDetail({ kind: 'wall', wall: cab.wall, at, zoom: 'base' })}>Enlarged: base</button>}
      </div>
      <p className="hint">A wall section cuts through everything on the {wallNames[cab.wall].toLowerCase()} here: depths, cases, tops, crown, the soffit above. Details go on their own sheets in the Drawings tab, where you can title and note them.</p>
    </Section>
  );
}

/** The Drawings tab's list of details. */
export function DetailsSection() {
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  const list = detailsOf(project);
  const [wall, setWall] = useState<WallId>(() => wallOrder.find((w) => project.cabinets.some((c) => c.wall === w)) ?? 'back');
  const put = (id: string, patch: Partial<Detail>) => commit((p) => ({ ...p, details: detailsOf(p).map((d) => (d.id === id ? { ...d, ...patch } : d)) }));
  const remove = (id: string) => commit((p) => ({ ...p, details: detailsOf(p).filter((d) => d.id !== id) }));
  const coffer = cofferOf(project).on;
  return (
    <Section title="Details & sections">
      <div className="order-actions">
        {coffer && <button className="mini" disabled={has(project, (d) => d.kind === 'beam')} onClick={() => addDetail({ kind: 'beam' })}>Coffer beam section</button>}
        <select aria-label="Wall for the section" value={wall} onChange={(e) => setWall(e.target.value as WallId)}>
          {wallOrder.map((w) => <option key={w} value={w}>{wallNames[w]}</option>)}
        </select>
        <button className="mini" onClick={() => addDetail({ kind: 'wall', wall, at: suggestedCut(project, wall) })}>Wall section</button>
      </div>
      {list.length === 0 && <p className="hint">Sections show how the important parts are built: a coffer beam with its crown, a cut through the bookcase or fireplace wall with its depths. Add them here, or from a cabinet or the ceiling when you double-click it in the design.</p>}
      {list.map((d) => (
        <details key={d.id} className="opening" open={!detailOk(project, d)}>
          <summary><b>{detailTitle(project, d)}</b>{!detailOk(project, d) && <span className="warn"> · can’t be drawn now</span>}</summary>
          <div className="grid2" style={{ marginTop: 8 }}>
            <Field label="Title" htmlFor={`dt-t-${d.id}`}><input id={`dt-t-${d.id}`} value={d.title ?? ''} placeholder={detailTitle(project, { ...d, title: undefined })} onChange={(e) => put(d.id, { title: e.target.value || undefined })} /></Field>
            <Field label="In the" htmlFor={`dt-s-${d.id}`}>
              <select id={`dt-s-${d.id}`} value={d.sets ?? 'both'} onChange={(e) => put(d.id, { sets: e.target.value === 'both' ? undefined : e.target.value as Detail['sets'] })}>
                <option value="both">Customer and shop sets</option>
                <option value="customer">Customer set only</option>
                <option value="shop">Shop set only</option>
              </select>
            </Field>
            {d.kind === 'wall' && (
              <>
                <Field label="Wall" htmlFor={`dt-w-${d.id}`}>
                  <select id={`dt-w-${d.id}`} value={d.wall} onChange={(e) => put(d.id, { wall: e.target.value as WallId, at: suggestedCut(project, e.target.value as WallId) })}>
                    {wallOrder.map((w) => <option key={w} value={w}>{wallNames[w]}</option>)}
                  </select>
                </Field>
                <Field label="Cut at (from the left)" htmlFor={`dt-a-${d.id}`}><LengthInput id={`dt-a-${d.id}`} value={d.at ?? 0} onChange={(v) => put(d.id, { at: v ?? 0 })} /></Field>
                <Field label="Show" htmlFor={`dt-z-${d.id}`}>
                  <select id={`dt-z-${d.id}`} value={d.zoom ?? 'full'} onChange={(e) => put(d.id, { zoom: e.target.value === 'full' ? undefined : e.target.value as Detail['zoom'] })}>
                    <option value="full">The whole wall, floor to ceiling</option>
                    <option value="top">Enlarged: crown at the ceiling</option>
                    <option value="base">Enlarged: base at the floor</option>
                  </select>
                </Field>
              </>
            )}
          </div>
          <Field label="Note under it" htmlFor={`dt-n-${d.id}`}><input id={`dt-n-${d.id}`} value={d.note ?? ''} placeholder="Construction notes, finish, anything to point out" onChange={(e) => put(d.id, { note: e.target.value || undefined })} /></Field>
          <div className="order-actions"><button className="mini danger" onClick={() => remove(d.id)}>Remove</button></div>
        </details>
      ))}
      {list.some((d) => d.kind === 'wall') && <p className="hint">Wall sections are marked where they’re cut on that wall’s elevation, with the detail’s number and sheet.</p>}
    </Section>
  );
}
