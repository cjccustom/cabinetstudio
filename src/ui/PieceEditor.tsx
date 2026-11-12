// Hand changes in the furniture builder: the part you clicked in the 3D (one, or the whole set like
// all four legs), its size, where it sits, routed profiles on its edges, hide or duplicate it; and
// parts of your own added to the piece (a block, panel, round post, or a part builder part).
import { useEffect, useState } from 'react';
import { useShop } from '../shop/shop';
import { edgeCutLabel, partSize, type EdgeCutKind } from '../model/customParts';
import { allSides, type AddedPart, type BoxProfile, type EdgeSides, type PartEdit, type PieceEdits, type ProfileCut } from '../model/pieceEdits';
import type { TablePart } from '../model/tableParts';
import { uid } from '../model/defaults';
import { Field, LengthInput } from './fields';
import { fmt, parseLength } from '../units';

/** A length that can go negative (to move a part left, down or back). */
function SignedLength({ id, value, onChange }: { id: string; value: number; onChange: (v: number) => void }) {
  const shown = value ? `${value < 0 ? '-' : ''}${fmt(Math.abs(value))}` : '0';
  const [text, setText] = useState(shown);
  useEffect(() => setText(shown), [shown]);
  const commit = () => {
    const t = text.trim(); const neg = /^[-−]/.test(t);
    const v = parseLength(t.replace(/^[-−+]\s*/, '') || '0');
    if (v == null) { setText(shown); return; }
    onChange(Math.round((neg ? -v : v) * 16) / 16);
  };
  return <input id={id} inputMode="text" value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit(); }} />;
}

const AXES = [['Left–right', 0], ['Height', 1], ['Front–back', 2]] as const;
const SIDE_LABEL: Record<keyof EdgeSides, string> = { zp: 'Front', zn: 'Back', xn: 'Left end', xp: 'Right end' };

/** One face's routed profile: kind, size, and which of its edges. */
function ProfileFields({ id, label, cut, onChange }: { id: string; label: string; cut?: ProfileCut; onChange: (c: ProfileCut | undefined) => void }) {
  return (
    <div className="pe-prof">
      <Field label={label} htmlFor={id}>
        <select id={id} value={cut?.kind ?? ''} onChange={(e) => onChange(e.target.value ? { kind: e.target.value as EdgeCutKind, size: cut?.size ?? 0.25, sides: cut?.sides ?? allSides() } : undefined)}>
          <option value="">Square</option>
          {(Object.keys(edgeCutLabel) as EdgeCutKind[]).map((k) => <option key={k} value={k}>{edgeCutLabel[k]}</option>)}
        </select>
      </Field>
      {cut && <Field label="Size" htmlFor={`${id}-s`}><LengthInput id={`${id}-s`} value={cut.size} min={1 / 16} onChange={(v) => v && onChange({ ...cut, size: v })} /></Field>}
      {cut && <div className="pe-sides">{(Object.keys(SIDE_LABEL) as (keyof EdgeSides)[]).map((k) => <label key={k} className="chk-row"><input type="checkbox" checked={cut.sides[k]} onChange={(e) => onChange({ ...cut, sides: { ...cut.sides, [k]: e.target.checked } })} /> {SIDE_LABEL[k]}</label>)}</div>}
    </div>
  );
}

function ProfileGroup({ id, profile, onChange }: { id: string; profile?: BoxProfile; onChange: (p: BoxProfile | undefined) => void }) {
  const p = profile ?? {};
  const set = (patch: Partial<BoxProfile>) => { const n = { ...p, ...patch }; onChange(n.top || n.bottom || n.corners ? n : undefined); };
  return (
    <>
      <h4>Edge profiles</h4>
      <ProfileFields id={`${id}-top`} label="Top edges" cut={p.top} onChange={(top) => set({ top })} />
      <ProfileFields id={`${id}-bot`} label="Bottom edges" cut={p.bottom} onChange={(bottom) => set({ bottom })} />
      <div className="pe-prof">
        <Field label="Vertical corners" htmlFor={`${id}-cor`}>
          <select id={`${id}-cor`} value={p.corners?.kind ?? ''} onChange={(e) => set({ corners: e.target.value ? { kind: e.target.value as 'roundover' | 'chamfer', size: p.corners?.size ?? 0.25 } : undefined })}>
            <option value="">Square</option><option value="roundover">Roundover</option><option value="chamfer">Chamfer</option>
          </select>
        </Field>
        {p.corners && <Field label="Size" htmlFor={`${id}-cors`}><LengthInput id={`${id}-cors`} value={p.corners.size} min={1 / 16} onChange={(v) => v && set({ corners: { ...p.corners!, size: v } })} /></Field>}
      </div>
    </>
  );
}

/** The part clicked in the 3D. */
export function PartEditor({ parts, sel, pe, setPe, onDone, onSelect, all, setAll }: { parts: TablePart[]; sel: string; pe: PieceEdits; setPe: (pe: PieceEdits) => void; onDone: () => void; onSelect: (key: string) => void; all: boolean; setAll: (v: boolean) => void }) {
  const at = sel.lastIndexOf('#');
  const name = sel.slice(0, at), j = Number(sel.slice(at + 1));
  const part = parts.find((p) => p.name === name);
  if (!part || !part.boxes[j]) return null;
  const box = part.boxes[j];
  const count = part.boxes.length;
  const added = part.added;
  if (added) {
    const put = (patch: Partial<AddedPart>) => setPe({ ...pe, added: (pe.added ?? []).map((a) => (a.id === added.id ? { ...a, ...patch } : a)) });
    return (
      <div className="pgroup pe">
        <div className="pgroup-head"><span>{added.name}</span><button className="mini" onClick={onDone}>Done</button></div>
        <Field label="Name" htmlFor="pe-an"><input id="pe-an" value={added.name} onChange={(e) => put({ name: e.target.value || added.name })} /></Field>
        {added.kind !== 'part' && <div className="grid3">{AXES.map(([l, i]) => <Field key={i} label={l} htmlFor={`pe-as${i}`}><LengthInput id={`pe-as${i}`} value={added.size[i]} min={0.125} onChange={(v) => v && put({ size: added.size.map((s, k) => (k === i ? v : s)) as AddedPart['size'] })} /></Field>)}</div>}
        {added.kind === 'part' && <label className="chk-row"><input type="checkbox" checked={!!added.turned} onChange={(e) => { const s = added.size; put({ turned: e.target.checked, size: [s[2], s[1], s[0]] }); }} /> Turned a quarter turn</label>}
        <h4>Where it sits</h4>
        <div className="grid3">{AXES.map(([l, i]) => <Field key={i} label={i === 1 ? 'Off the floor' : l === 'Left–right' ? 'From center, left–right' : 'From center, front–back'} htmlFor={`pe-aa${i}`}><SignedLength id={`pe-aa${i}`} value={i === 1 ? added.at[1] : added.at[i] + added.size[i] / 2} onChange={(v) => put({ at: added.at.map((s, k) => (k === i ? (i === 1 ? v : v - added.size[i] / 2) : s)) as AddedPart['at'] })} /></Field>)}</div>
        {added.kind !== 'part' && <ProfileGroup id="pe-ap" profile={added.profile} onChange={(profile) => put({ profile })} />}
        <div className="grid3"><Field label="Hours to make and fit" htmlFor="pe-ah"><input id="pe-ah" inputMode="decimal" value={added.hoursEach} onChange={(e) => put({ hoursEach: Math.max(0, Number(e.target.value) || 0) })} /></Field></div>
        <Field label="Note for the shop" htmlFor="pe-anote"><input id="pe-anote" value={added.note ?? ''} onChange={(e) => put({ note: e.target.value || undefined })} /></Field>
        <div className="order-actions"><button className="mini danger" onClick={() => { setPe({ ...pe, added: (pe.added ?? []).filter((a) => a.id !== added.id) }); onDone(); }}>Remove this part</button></div>
      </div>
    );
  }
  const key = all && count > 1 ? name : sel;
  const e: PartEdit = pe.edits?.[key] ?? {};
  const setEdit = (patch: Partial<PartEdit>) => {
    const next = { ...e, ...patch };
    const edits = { ...pe.edits };
    if (!next.move?.some((v) => v) && !next.size?.some((v) => v != null) && !next.hidden && !next.profile && !next.note) delete edits[key]; else edits[key] = next;
    setPe({ ...pe, edits });
  };
  const move = e.move ?? [0, 0, 0];
  const dup = () => {
    const a: AddedPart = { id: uid('ap'), name: `${name} (copy)`, kind: part.turned ? 'round' : 'block', size: [...box.size], at: [box.min[0] + 2, box.min[1], box.min[2] + 2], hoursEach: 0.5, ...(box.profile ? { profile: box.profile } : {}) };
    setPe({ ...pe, added: [...(pe.added ?? []), a] });
    onSelect(`${a.name}#0`);
  };
  return (
    <div className="pgroup pe">
      <div className="pgroup-head"><span>{name}{count > 1 ? ` (${j + 1} of ${count})` : ''}</span><button className="mini" onClick={onDone}>Done</button></div>
      {count > 1 && <label className="chk-row"><input type="checkbox" checked={all} onChange={(ev) => setAll(ev.target.checked)} /> Change all {count} together (untick to change just this one)</label>}
      <p className="hint">Now {fmt(box.size[0])} left–right × {fmt(box.size[1])} high × {fmt(box.size[2])} front–back.</p>
      <h4>Size</h4>
      <div className="grid3">{AXES.map(([l, i]) => <Field key={i} label={l} htmlFor={`pe-s${i}`}><LengthInput id={`pe-s${i}`} value={box.size[i]} min={0.125} onChange={(v) => v && setEdit({ size: [0, 1, 2].map((k) => (k === i ? v : e.size?.[k] ?? null)) as PartEdit['size'] })} /></Field>)}</div>
      <h4>Move it</h4>
      <div className="grid3">{AXES.map(([l, i]) => <Field key={i} label={i === 0 ? 'Right (+) / left (−)' : i === 1 ? 'Up (+) / down (−)' : 'Front (+) / back (−)'} htmlFor={`pe-m${i}`}><SignedLength id={`pe-m${i}`} value={move[i]} onChange={(v) => setEdit({ move: move.map((m, k) => (k === i ? v : m)) as PartEdit['move'] })} /></Field>)}</div>
      <ProfileGroup id="pe-p" profile={e.profile} onChange={(profile) => setEdit({ profile })} />
      <Field label="Note for the shop" htmlFor="pe-note"><input id="pe-note" value={e.note ?? ''} placeholder="Grain direction, joinery, a detail…" onChange={(ev) => setEdit({ note: ev.target.value || undefined })} /></Field>
      <div className="order-actions">
        <button className="mini" onClick={dup}>Duplicate</button>
        <button className="mini danger" onClick={() => { setEdit({ hidden: true }); onDone(); }}>{all && count > 1 ? `Remove all ${count}` : 'Remove it'}</button>
        {pe.edits?.[key] && <button className="mini" onClick={() => { const edits = { ...pe.edits }; delete edits[key]; setPe({ ...pe, edits }); }}>Back to the design</button>}
      </div>
    </div>
  );
}

/** Add a part of your own: a block, panel, round post, or a part from the part builder. */
export function AddPartFields({ pe, setPe, height, onSelect }: { pe: PieceEdits; setPe: (pe: PieceEdits) => void; height: number; onSelect: (key: string) => void }) {
  const lib = useShop((s) => s.parts);
  const cutouts = Object.values(lib).filter((p) => p.kind !== 'moulding');
  const n = (pe.added?.length ?? 0) + 1;
  const add = (a: Omit<AddedPart, 'id'>) => { const full = { ...a, id: uid('ap') }; setPe({ ...pe, added: [...(pe.added ?? []), full] }); onSelect(`${full.name}#0`); };
  const block = (name: string, size: AddedPart['size']) => add({ name: `${name} ${n}`, kind: name === 'Round post' ? 'round' : 'block', size, at: [-size[0] / 2, Math.max(0, height / 2 - size[1] / 2), -size[2] / 2], hoursEach: 0.5 });
  return (
    <div className="pgroup">
      <div className="pgroup-head"><span>Add a part</span></div>
      <div className="order-actions">
        <button className="mini" onClick={() => block('Block', [3, 3, 12])}>Block</button>
        <button className="mini" onClick={() => block('Panel', [24, 12, 0.75])}>Panel</button>
        <button className="mini" onClick={() => block('Round post', [3, Math.max(6, height - 2), 3])}>Round post</button>
      </div>
      {cutouts.length > 0 && (
        <Field label="From the Part builder" htmlFor="pe-addpart">
          <select id="pe-addpart" value="" onChange={(ev) => { const p = lib[ev.target.value]; if (!p) return; const s = partSize(p); add({ name: `${p.name} ${n}`, kind: 'part', part: p, size: [p.thickness, s.h, s.w], at: [-p.thickness / 2, 0, -s.w / 2], hoursEach: p.hoursEach }); }}>
            <option value="">Pick a part…</option>
            {cutouts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
      )}
      <p className="hint">It goes in the middle; size it and move it into place. Or click any part in the 3D to change it.</p>
    </div>
  );
}
