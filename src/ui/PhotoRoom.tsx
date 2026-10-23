import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import type { WallId } from '../model/types';
import { applyDraft, cleanDraft, closestProfile, draftRequest, type DraftOpening, type RoomDraft } from '../model/photoRoom';
import { profileLabel, type MoldKind } from '../model/moldings';
import { openingKinds } from '../model/room';
import { wallNames } from '../model/layout';
import { fmt } from '../units';
import { AddButton, imageBlob, useCapability, useRender } from './Rendering';
import { Field, LengthInput } from './fields';
import type { Sample } from '../runtime';

const failCopy = (code?: string) =>
  code === 'not_granted' ? 'Claude wasn’t allowed for this page. Allow it from the page’s permissions to build rooms from photos.'
    : code === 'rate_limited' ? 'Claude is busy. Wait a minute and try again.'
      : code === 'cancelled' ? 'Stopped.'
        : code === 'images_unavailable' ? 'Photos can’t be sent to Claude from this view.'
          : 'Claude couldn’t read the room from those photos. Try again, or add a measurement or two.';

/** Read the room from photos and site measurements, check the draft, and apply it to the design. */
export function PhotoRoomDialog({ onClose }: { onClose: () => void }) {
  const { project, r, set } = useRender();
  const commit = useStore((s) => s.commit);
  const sample = useCapability<Sample>('sample');
  const [maxPhotos, setMaxPhotos] = useState(5);
  const photos = r.images.filter((i) => i.kind === 'photo');
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<RoomDraft | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [replace, setReplace] = useState(true);
  const ctl = useRef<AbortController | null>(null);
  useEffect(() => { sample?.limits?.().then((l) => setMaxPhotos(Math.max(1, Math.min(8, l.images?.maxCount ?? 5)))).catch(() => undefined); }, [sample]);
  const chosen = photos.filter((p) => !skip.has(p.id)).slice(0, maxPhotos);

  const build = async () => {
    if (!sample || !chosen.length) return;
    ctl.current = new AbortController();
    setBusy(true);
    setStatus('Claude is reading the room. This usually takes under a minute.');
    try {
      const images = await Promise.all(chosen.map((p) => imageBlob(p)));
      const raw = await sample.json(draftRequest(r.measurements, chosen.map((p) => p.note || p.name)), { images, signal: ctl.current.signal, modelTier: 'complex' });
      setDraft(cleanDraft(raw));
      setStatus('');
    } catch (e) {
      setStatus(failCopy((e as { code?: string }).code));
    } finally {
      setBusy(false);
    }
  };
  const apply = () => {
    if (!draft) return;
    commit((p) => applyDraft(p, draft, replace));
    onClose();
  };
  const putRoom = (k: keyof RoomDraft['room'], v: number | null) => draft && setDraft({ ...draft, room: { ...draft.room, [k]: v ?? draft.room[k] }, measured: { ...draft.measured, [k]: true } });
  const putOpening = (i: number, patch: Partial<DraftOpening>) => draft && setDraft({ ...draft, openings: draft.openings.map((o, j) => (j === i ? { ...o, ...patch, measured: true } : o)) });
  const tag = (measured: boolean) => (measured ? null : <span className="est" title="Estimated from the photo">est.</span>);
  const match = (kind: MoldKind, h: number | null) => { const p = closestProfile(kind, h); return p ? `${fmt(h!)} → ${profileLabel(p)}` : 'none'; };

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal wide photo-room" role="dialog" aria-modal="true" aria-labelledby="pr-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="pr-title">Build the room from photos</h2>
        {!draft ? (
          <>
            <p>Add photos of the existing space, ideally one of each wall, plus your site measurements. Claude drafts the room size, doors and windows and the existing trim. You check everything before it goes into the design.</p>
            <div className="pr-photos">
              {photos.map((p) => (
                <label key={p.id} className={skip.has(p.id) ? 'off' : ''}>
                  <img src={p.url} alt="" />
                  <span><input type="checkbox" checked={!skip.has(p.id)} onChange={(e) => { const s = new Set(skip); if (e.target.checked) s.delete(p.id); else s.add(p.id); setSkip(s); }} /> {p.note || p.name}</span>
                </label>
              ))}
            </div>
            <AddButton kind="photo" label={photos.length ? 'Add more photos' : 'Add photos'} />
            {photos.length > maxPhotos && <p className="hint">Claude reads up to {maxPhotos} photos at a time; the first {maxPhotos} checked are sent.</p>}
            <Field label="Measurements and notes" htmlFor="pr-meas" hint="Anything you measured, in plain words. A photo of your sketch works too: add it with the photos.">
              <textarea id="pr-meas" rows={6} value={r.measurements} onChange={(e) => set({ measurements: e.target.value })}
                placeholder={'Back wall 158" corner to corner, ceiling 96"\nWindow on the right wall: 34" wide, sill 30", 18" from the back corner\nDoor on the front wall 32", 6" from the left corner\nBaseboard 5-1/2", crown about 4"'} />
            </Field>
            {status && <p className={busy ? 'hint' : 'warn'} role="status">{status}</p>}
            {!sample && <p className="warn">Reading photos needs Claude, which is only available when the app is open on claude.ai.</p>}
            <div className="modal-actions">
              <button onClick={onClose}>Cancel</button>
              {busy && <button onClick={() => ctl.current?.abort()}>Stop</button>}
              <button className="primary" disabled={!sample || !chosen.length || busy} onClick={build}>{busy ? 'Reading the room…' : 'Build the room'}</button>
            </div>
          </>
        ) : (
          <>
            <p>Here’s the draft. Anything marked <span className="est">est.</span> was estimated from the photos; change any number before applying. Editing a value marks it as yours.</p>
            <div className="grid3">
              {(['width', 'depth', 'height'] as const).map((k) => (
                <Field key={k} label={k === 'width' ? 'Back wall length' : k === 'depth' ? 'Side wall length' : 'Ceiling height'} htmlFor={`pr-${k}`}>
                  <div className="pr-val"><LengthInput id={`pr-${k}`} value={draft.room[k]} onChange={(v) => putRoom(k, v)} />{tag(draft.measured[k])}</div>
                </Field>
              ))}
            </div>
            <h3 className="pr-h">Doors & windows</h3>
            {!draft.openings.length && <p className="hint">None found.</p>}
            {draft.openings.length > 0 && (
              <div className="pr-table-wrap">
                <table className="pr-table">
                  <thead><tr><th>Name</th><th>Kind</th><th>Wall</th><th>From left</th><th>Width</th><th>Height</th><th>Sill</th><th></th></tr></thead>
                  <tbody>
                    {draft.openings.map((o, i) => (
                      <tr key={i}>
                        <td><input aria-label="Name" value={o.name} onChange={(e) => putOpening(i, { name: e.target.value })} />{tag(o.measured)}</td>
                        <td><select aria-label="Kind" value={o.kind} onChange={(e) => putOpening(i, { kind: e.target.value as DraftOpening['kind'], sill: e.target.value === 'window' ? o.sill || 32 : 0 })}>
                          {Object.entries(openingKinds).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select></td>
                        <td><select aria-label="Wall" value={o.wall} onChange={(e) => putOpening(i, { wall: e.target.value as WallId })}>
                          {Object.entries(wallNames).map(([v, l]) => <option key={v} value={v}>{l.replace(' wall', '')}</option>)}
                        </select></td>
                        {(['offset', 'width', 'height', 'sill'] as const).map((k) => (
                          <td key={k}><LengthInput id={`pr-o${i}-${k}`} value={o[k]} onChange={(v) => putOpening(i, { [k]: v ?? o[k] })} /></td>
                        ))}
                        <td><button className="icon-btn" aria-label="Remove" onClick={() => setDraft({ ...draft, openings: draft.openings.filter((_, j) => j !== i) })}>×</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <h3 className="pr-h">Existing trim</h3>
            <ul className="assembly">
              <li>Crown: {match('roomCrown', draft.trim.crown)}</li>
              <li>Baseboard: {match('roomBase', draft.trim.base)}</li>
              <li>Chair rail: {draft.trim.chairRail ? `${match('chairRail', draft.trim.chairRail)} at ${fmt(draft.trim.chairHeight ?? 34)}` : 'none'}</li>
              <li>Casing: {draft.trim.casing ? (draft.trim.casing.style === 'flat' ? `${fmt(draft.trim.casing.width)} flat stock${draft.trim.casing.backBand ? ' with back band' : ''}` : match('casing', draft.trim.casing.width)) : 'none'}</li>
              {draft.floor && <li>Floor: {draft.floor}</li>}
            </ul>
            <p className="hint">Profiles are the closest stock Brosco or A&M match by size; pick the exact ones in the Room panel.</p>
            {draft.notes.length > 0 && (<><h3 className="pr-h">To check on site</h3><ul className="assembly">{draft.notes.map((n) => <li key={n}>{n}</li>)}</ul></>)}
            {(project.openings?.length ?? 0) > 0 && (
              <label className="check-inline"><input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} /> Replace the {project.openings!.length} door{project.openings!.length > 1 ? 's' : ''} and window{project.openings!.length > 1 ? 's' : ''} already in the design</label>
            )}
            <div className="modal-actions">
              <button onClick={() => setDraft(null)}>Back</button>
              <button className="primary" onClick={apply}>Apply to the design</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** A button that opens the dialog. */
export function PhotoRoomButton({ label = 'Build the room from photos', className = '' }: { label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={className} onClick={() => setOpen(true)}>{label}</button>
      {open && <PhotoRoomDialog onClose={() => setOpen(false)} />}
    </>
  );
}
