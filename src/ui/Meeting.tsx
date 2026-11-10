// The meeting screen, for the iPad at the customer's: notes (type or dictate), a sketch pad for the
// Pencil, measurements that go straight into the design (a laser in keyboard mode types into the
// box that's selected, then it moves on to the next), what's on the walls, the site conditions, and
// photos into the client's Dropbox folder. Done saves it all to the client's file.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { clientName, clientOf, type ClientInfo } from '../model/client';
import { readSummary, summaryRequest } from '../model/meeting';
import { useCapability } from './Rendering';
import type { Sample } from '../runtime';
import { PhotoMarkup } from './PhotoMarkup';
import { VideoUpload } from './VideoUpload';
import { ScanImportButton } from './PhotoRoom';
import { listedPrice, optionDeltas, selectionText, selections, signedPrice, type Selection } from '../model/selections';
import { priceBook } from '../model/pricebook';
import { useShop } from '../shop/shop';
import { PaintColorPicker } from './PaintColorPicker';
import { doorDrawings } from '../model/eagleDrawings';
import { newVisit, parseMeasure, siteChecks, utilityKinds, visitToday, type SiteState, type Utility, type UtilityKind, type Visit } from '../model/meeting';
import { newOpening, openingKinds } from '../model/room';
import { wallNames, wallOrder } from '../model/layout';
import { uid } from '../model/defaults';
import type { Opening, WallId } from '../model/types';
import { fmt } from '../units';
import { ClientPhotos } from './Photos';
import { saveToDropbox } from './Clients';
import { PortalError, blobToBase64, savePhoto } from '../portal';

type Tab = 'notes' | 'sketch' | 'measure' | 'site' | 'selections' | 'photos';
const tabs: { id: Tab; label: string }[] = [
  { id: 'notes', label: 'Notes' }, { id: 'sketch', label: 'Sketch' }, { id: 'measure', label: 'Measure' }, { id: 'site', label: 'Site' }, { id: 'selections', label: 'Selections' }, { id: 'photos', label: 'Photos & video' },
];

/** Today's visit for this client, and a way to change it (started the first time the screen opens today). */
function useVisit() {
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  const c = clientOf(project);
  const v = visitToday(c.visits);
  useEffect(() => {
    if (!v) commit((p) => { const cc = clientOf(p); return { ...p, client: { ...cc, visits: [...(cc.visits ?? []), newVisit(uid('visit'))] } }; });
  }, [v, commit]);
  const put = (patch: Partial<Visit> | ((v: Visit) => Partial<Visit>)) => commit((p) => {
    const cc = clientOf(p);
    const today = visitToday(cc.visits);
    if (!today) return p;
    return { ...p, client: { ...cc, visits: (cc.visits ?? []).map((x) => (x.id === today.id ? { ...x, ...(typeof patch === 'function' ? patch(x) : patch) } : x)) } };
  });
  return { c, v, put };
}

export function Meeting() {
  const project = useStore((s) => s.project);
  const setMeeting = useStore((s) => s.setMeeting);
  const { c, v, put } = useVisit();
  const [tab, setTab] = useState<Tab>('notes');
  const [saving, setSaving] = useState('');
  const done = async () => {
    if (!project.dropbox) { setMeeting(false); return; }
    setSaving('Saving to the client’s folder…');
    const ok = await saveToDropbox();
    if (ok) setMeeting(false); else setSaving('Couldn’t save to Dropbox. Everything is kept here; try Done again when you have signal.');
  };
  const who = clientName(c) || project.name;
  return (
    <div className="meeting">
      <header className="present-bar">
        <div className="present-title"><strong>{who}</strong><span>Visit {new Date(v?.at ?? Date.now()).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span></div>
        <div className="seg" role="tablist" aria-label="Meeting">
          {tabs.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.label}</button>)}
        </div>
        <div className="present-tools">
          {saving && <span className="hint">{saving}</span>}
          <button className="primary" onClick={done} title={project.dropbox ? 'Save everything to the client’s Dropbox folder' : 'Close (this job isn’t linked to a client folder yet)'}>Done</button>
        </div>
      </header>
      <main className="meeting-body">
        {!v ? <p className="hint">Starting the visit…</p>
          : tab === 'notes' ? <NotesTab c={c} v={v} put={put} />
          : tab === 'sketch' ? <SketchTab v={v} put={put} folder={project.dropbox?.path} who={who} />
          : tab === 'measure' ? <MeasureTab v={v} put={put} />
          : tab === 'site' ? <SiteTab v={v} put={put} />
          : tab === 'selections' ? <SelectionsTab put={put} />
          : <div className="meeting-pad"><ClientPhotos /><PhotoMarkup folder={project.dropbox?.path} /><VideoUpload folder={project.dropbox?.path} /><p className="hint">Inspiration pictures the customer shows you: AirDrop or save them to the iPad, then <b>Choose photos</b> with “Inspiration” in the box.</p></div>}
      </main>
    </div>
  );
}

type Put = (patch: Partial<Visit> | ((v: Visit) => Partial<Visit>)) => void;

function NotesTab({ c, v, put }: { c: ClientInfo; v: Visit; put: Put }) {
  const commit = useStore((s) => s.commit);
  return (
    <div className="meeting-pad">
      <label className="meeting-label" htmlFor="mt-notes">Notes from today</label>
      <textarea id="mt-notes" className="meeting-notes" value={v.notes} placeholder="Write here with the Apple Pencil (it turns into typed text), type, or tap the microphone on the keyboard to talk…" onChange={(e) => put({ notes: e.target.value })} />
      <p className="hint">Apple Pencil: write right in the box and it becomes typed text as you go (Scribble). Scratch out a word to delete it; draw a vertical line between words to join or split them. Turn it on in Settings → Apple Pencil → Scribble.</p>
      <label className="meeting-label" htmlFor="mt-scope">What they want (the project scope)</label>
      <textarea id="mt-scope" rows={5} value={c.scope} placeholder="Rooms, built-ins, style, finish, budget, timing…" onChange={(e) => commit((p) => ({ ...p, client: { ...clientOf(p), scope: e.target.value } }))} />
      <p className="hint">Both save with the client’s file when you tap Done.</p>
      <SummaryPanel c={c} v={v} put={put} />
    </div>
  );
}

/** Claude reads the notes (and what was measured and checked) and drafts scope lines, questions and follow-ups. */
function SummaryPanel({ c, v, put }: { c: ClientInfo; v: Visit; put: Put }) {
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  const sample = useCapability<Sample>('sample');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [added, setAdded] = useState('');
  const s = v.summary;
  const run = async () => {
    if (!sample) return;
    setBusy(true); setErr(''); setAdded('');
    try {
      const raw = await sample.json(summaryRequest(v, c.scope, project.room, (project.openings ?? []).length), { modelTier: 'default', cache: false });
      const got = readSummary(raw);
      if (!got) throw new Error('Claude didn’t send back a summary. Try again.');
      put({ summary: got });
    } catch (e) {
      const code = (e as { code?: string }).code;
      setErr(code === 'not_granted' ? 'Allow Claude for this page when claude.ai asks, then try again.' : code === 'rate_limited' ? 'Too many requests just now; wait a minute and try again.' : (e as Error).message || 'Something went wrong.');
    } finally { setBusy(false); }
  };
  const addScope = () => {
    commit((p) => { const cc = clientOf(p); return { ...p, client: { ...cc, scope: [cc.scope.trim(), ...s!.scope.map((x) => `- ${x}`)].filter(Boolean).join('\n') } }; });
    setAdded('Added to the project scope.');
  };
  const addTodos = () => {
    commit((p) => { const cc = clientOf(p); return { ...p, client: { ...cc, todos: [...cc.todos, ...[...s!.questions, ...s!.followUps].map((t) => ({ id: uid('t'), text: t, done: false }))] } }; });
    setAdded('Added to the client’s to do list.');
  };
  return (
    <section className="summary-box">
      <div className="sec-head">
        <h3>Claude’s summary</h3>
        <button className={s ? '' : 'primary'} onClick={run} disabled={!sample || busy || !v.notes.trim()}>{busy ? 'Reading your notes…' : s ? 'Summarize again' : 'Summarize my notes'}</button>
      </div>
      {!sample && <p className="hint">Needs the app open on claude.ai.</p>}
      {sample && !v.notes.trim() && !s && <p className="hint">Write or dictate some notes first. Claude reads them with the scope, the site checklist and what you measured, and drafts scope lines, open questions and follow-ups for you to check.</p>}
      {err && <p className="warn">{err}</p>}
      {s && (
        <>
          {s.summary && <p>{s.summary}</p>}
          {s.scope.length > 0 && <><h4>Scope lines</h4><ul>{s.scope.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
          {s.questions.length > 0 && <><h4>Still to decide</h4><ul>{s.questions.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
          {s.followUps.length > 0 && <><h4>Follow-ups</h4><ul>{s.followUps.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
          <div className="order-actions">
            {s.scope.length > 0 && <button onClick={addScope}>Add scope lines to the project scope</button>}
            {(s.questions.length > 0 || s.followUps.length > 0) && <button onClick={addTodos}>Add questions and follow-ups to the to do list</button>}
          </div>
          {added && <p className="ok">{added}</p>}
          <p className="hint">A draft from your notes: check it before it goes anywhere near a proposal.</p>
        </>
      )}
    </section>
  );
}

/* ---------- Sketch pad ---------- */

interface Stroke { pts: [number, number, number][]; erase: boolean; width: number }

function SketchTab({ v, put, folder, who }: { v: Visit; put: Put; folder?: string; who: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [erase, setErase] = useState(false);
  const [label, setLabel] = useState('');
  const [msg, setMsg] = useState('');
  const live = useRef<Stroke | null>(null);
  const penSeen = useRef(false);
  const size = useRef({ w: 0, h: 0, dpr: 1 });

  const draw = (list: Stroke[]) => {
    const cv = canvas.current; if (!cv) return;
    const g = cv.getContext('2d')!;
    const { w, h, dpr } = size.current;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const s of list) {
      g.strokeStyle = s.erase ? '#fff' : '#1b1d21';
      for (let i = 1; i < s.pts.length; i++) {
        const [x0, y0] = s.pts[i - 1], [x1, y1, p] = s.pts[i];
        g.lineWidth = s.erase ? 22 : s.width * (0.45 + p * 0.9);
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      }
      if (s.pts.length === 1) { const [x, y] = s.pts[0]; g.fillStyle = s.erase ? '#fff' : '#1b1d21'; g.beginPath(); g.arc(x, y, s.erase ? 11 : s.width / 2, 0, Math.PI * 2); g.fill(); }
    }
  };
  useEffect(() => {
    const fit = () => {
      const el = wrap.current, cv = canvas.current; if (!el || !cv) return;
      const dpr = Math.min(3, window.devicePixelRatio || 1), w = el.clientWidth, h = el.clientHeight;
      size.current = { w, h, dpr };
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      cv.style.width = `${w}px`; cv.style.height = `${h}px`;
      draw(strokes);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => draw(strokes), [strokes]); // eslint-disable-line react-hooks/exhaustive-deps

  const at = (e: React.PointerEvent): [number, number, number] => {
    const r = canvas.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top, e.pointerType === 'pen' ? e.pressure || 0.5 : 0.5];
  };
  const down = (e: React.PointerEvent) => {
    // Once the Pencil has been used, a resting palm (touch) doesn't draw
    if (e.pointerType === 'pen') penSeen.current = true;
    else if (e.pointerType === 'touch' && penSeen.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    live.current = { pts: [at(e)], erase, width: 2.6 };
    draw([...strokes, live.current]);
  };
  const move = (e: React.PointerEvent) => {
    const s = live.current; if (!s) return;
    const evs = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [e.nativeEvent];
    for (const ev of evs) { const r = canvas.current!.getBoundingClientRect(); s.pts.push([ev.clientX - r.left, ev.clientY - r.top, ev.pointerType === 'pen' ? ev.pressure || 0.5 : 0.5]); }
    draw([...strokes, s]);
  };
  const up = () => { const s = live.current; if (!s) return; live.current = null; setStrokes((all) => [...all, s]); };

  const save = async () => {
    if (!folder || !canvas.current) return;
    setMsg('Saving…');
    try {
      const blob = await new Promise<Blob | null>((ok) => canvas.current!.toBlob(ok, 'image/png'));
      if (!blob) throw new Error('The sketch couldn’t be read.');
      const d = new Date(), z = (n: number) => String(n).padStart(2, '0');
      const name = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}${z(d.getMinutes())} sketch${label.trim() ? ` ${label.trim()}` : ''}.png`;
      const r = await savePhoto(`${folder}/Sketches`, name.replace(/[\\/:*?"<>|]/g, ''), await blobToBase64(blob));
      put((x) => ({ sketches: [...x.sketches, r.path] }));
      setMsg(`Saved to ${who}’s Sketches folder.`);
    } catch (e) { setMsg(e instanceof PortalError ? e.message : `Didn’t save: ${(e as Error).message}`); }
  };

  return (
    <div className="sketch">
      <div className="sketch-bar">
        <div className="seg">
          <button className={!erase ? 'on' : ''} onClick={() => setErase(false)}>Pen</button>
          <button className={erase ? 'on' : ''} onClick={() => setErase(true)}>Eraser</button>
        </div>
        <button onClick={() => setStrokes((s) => s.slice(0, -1))} disabled={!strokes.length}>Undo</button>
        <button onClick={() => { if (strokes.length && confirm('Clear the sketch?')) setStrokes([]); }} disabled={!strokes.length}>Clear</button>
        <input aria-label="Sketch name" placeholder="What is it? (sink wall…)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <button className="primary" onClick={save} disabled={!folder || !strokes.length}>Save sketch</button>
        {msg && <span className="hint">{msg}</span>}
        {!folder && <span className="hint">Link the job to a client folder to save sketches.</span>}
        {v.sketches.length > 0 && <span className="hint">{v.sketches.length} saved today</span>}
      </div>
      <div className="sketch-wrap" ref={wrap}>
        <canvas ref={canvas} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} style={{ touchAction: 'none' }} />
      </div>
    </div>
  );
}

/* ---------- Measuring ---------- */

/**
 * A box for one measurement. A laser in keyboard mode types the number and presses Return: the
 * number is read (inches, feet and inches, or metric) and the next box is selected.
 */
function MeasureBox({ value, onChange, label, id }: { value: number | null | undefined; onChange: (v: number | null) => void; label: string; id: string }) {
  const [text, setText] = useState(value != null ? fmt(value, false) : '');
  const [bad, setBad] = useState(false);
  useEffect(() => { setText(value != null ? fmt(value, false) : ''); }, [value]);
  const commitText = () => {
    if (!text.trim()) { setBad(false); onChange(null); return true; }
    const v = parseMeasure(text);
    if (v == null) { setBad(true); return false; }
    setBad(false); onChange(Math.round(v * 16) / 16); return true;
  };
  const next = (el: HTMLInputElement) => {
    const all = [...document.querySelectorAll<HTMLInputElement>('input[data-measure]')];
    const i = all.indexOf(el);
    if (i >= 0 && all[i + 1]) { all[i + 1].focus(); all[i + 1].select(); } else el.blur();
  };
  return (
    <label className="mbox" htmlFor={id}>
      <span>{label}</span>
      <input id={id} data-measure="" className={bad ? 'bad' : ''} value={text} autoComplete="off" enterKeyHint="next" inputMode="text"
        onChange={(e) => setText(e.target.value)} onFocus={(e) => e.target.select()}
        onBlur={commitText}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (commitText()) next(e.currentTarget); } }} />
    </label>
  );
}

function MeasureTab({ v, put }: { v: Visit; put: Put }) {
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  const room = project.room;
  const openings = project.openings ?? [];
  const setRoom = (patch: Partial<typeof room>) => commit((p) => ({ ...p, room: { ...p.room, ...patch } }));
  const setOpening = (id: string, patch: Partial<Opening>) => commit((p) => ({ ...p, openings: (p.openings ?? []).map((o) => (o.id === id ? { ...o, ...patch } : o)) }));
  const addOpening = (kind: Opening['kind']) => commit((p) => ({ ...p, openings: [...(p.openings ?? []), newOpening(kind, 'back', p)] }));
  const setU = (id: string, patch: Partial<Utility>) => put((x) => ({ utilities: x.utilities.map((u) => (u.id === id ? { ...u, ...patch } : u)) }));
  const wallSel = (val: WallId, on: (w: WallId) => void, id: string) => (
    <label className="mbox" htmlFor={id}><span>Wall</span>
      <select id={id} value={val} onChange={(e) => on(e.target.value as WallId)}>{wallOrder.map((w) => <option key={w} value={w}>{wallNames[w]}</option>)}</select>
    </label>
  );
  return (
    <div className="meeting-pad">
      <p className="hint">Tap a box and measure. With a laser in keyboard mode, its reading lands in the box and the next box is picked. Typed sizes work too: 92 5/16, 7&apos;8 1/2&quot;, or metric. Distances along a wall are from its left corner, facing the wall.</p>
      <div className="scan-row">
        <ScanImportButton className="primary" />
        <span className="hint">Scanned the room with CJC Room Scan on the iPhone? AirDrop the scan to the iPad (or save it to Files), then import it here: walls, ceiling height, doors and windows fill in below. Measure anything the scan missed.</span>
      </div>
      <h3>Room</h3>
      <div className="mrow">
        <MeasureBox id="m-w" label="Back wall length" value={room.width} onChange={(x) => x && setRoom({ width: x })} />
        <MeasureBox id="m-d" label="Side wall length" value={room.depth} onChange={(x) => x && setRoom({ depth: x })} />
        <MeasureBox id="m-h" label="Ceiling height" value={room.height} onChange={(x) => x && setRoom({ height: x })} />
      </div>
      <h3>Windows and doors</h3>
      {openings.map((o) => (
        <div className="mrow" key={o.id}>
          <label className="mbox" htmlFor={`mo-k-${o.id}`}><span>What</span>
            <select id={`mo-k-${o.id}`} value={o.kind} onChange={(e) => setOpening(o.id, { kind: e.target.value as Opening['kind'] })}>{(Object.keys(openingKinds) as Opening['kind'][]).map((k) => <option key={k} value={k}>{openingKinds[k]}</option>)}</select>
          </label>
          {wallSel(o.wall, (w) => setOpening(o.id, { wall: w }), `mo-w-${o.id}`)}
          <MeasureBox id={`mo-o-${o.id}`} label="From left corner" value={o.offset} onChange={(x) => x != null && setOpening(o.id, { offset: x })} />
          <MeasureBox id={`mo-wd-${o.id}`} label="Width" value={o.width} onChange={(x) => x && setOpening(o.id, { width: x })} />
          <MeasureBox id={`mo-h-${o.id}`} label="Height" value={o.height} onChange={(x) => x && setOpening(o.id, { height: x })} />
          {o.kind === 'window' && <MeasureBox id={`mo-s-${o.id}`} label="Sill off floor" value={o.sill} onChange={(x) => x != null && setOpening(o.id, { sill: x })} />}
          <button className="icon-btn" aria-label={`Remove ${o.name}`} onClick={() => commit((p) => ({ ...p, openings: (p.openings ?? []).filter((x) => x.id !== o.id) }))}>×</button>
        </div>
      ))}
      <div className="order-actions"><button onClick={() => addOpening('window')}>Add window</button><button onClick={() => addOpening('door')}>Add door</button><button onClick={() => addOpening('cased')}>Add cased opening</button></div>
      <h3>On the walls</h3>
      <p className="hint">Outlets, switches, vents and plumbing where the work goes: centers, from the left corner and off the floor.</p>
      {v.utilities.map((u) => (
        <div className="mrow" key={u.id}>
          <label className="mbox" htmlFor={`mu-k-${u.id}`}><span>What</span>
            <select id={`mu-k-${u.id}`} value={u.kind} onChange={(e) => setU(u.id, { kind: e.target.value as UtilityKind })}>{(Object.keys(utilityKinds) as UtilityKind[]).map((k) => <option key={k} value={k}>{utilityKinds[k]}</option>)}</select>
          </label>
          {wallSel(u.wall, (w) => setU(u.id, { wall: w }), `mu-w-${u.id}`)}
          <MeasureBox id={`mu-o-${u.id}`} label="From left corner" value={u.offset} onChange={(x) => setU(u.id, { offset: x })} />
          <MeasureBox id={`mu-h-${u.id}`} label="Off the floor" value={u.height} onChange={(x) => setU(u.id, { height: x })} />
          <label className="mbox grow" htmlFor={`mu-n-${u.id}`}><span>Notes</span><input id={`mu-n-${u.id}`} value={u.note} onChange={(e) => setU(u.id, { note: e.target.value })} /></label>
          <button className="icon-btn" aria-label="Remove" onClick={() => put((x) => ({ utilities: x.utilities.filter((y) => y.id !== u.id) }))}>×</button>
        </div>
      ))}
      <div className="order-actions">
        {(['outlet', 'switch', 'vent', 'water'] as UtilityKind[]).map((k) => (
          <button key={k} onClick={() => put((x) => ({ utilities: [...x.utilities, { id: uid('u'), kind: k, wall: x.utilities[x.utilities.length - 1]?.wall ?? 'back', offset: null, height: null, note: '' }] }))}>Add {utilityKinds[k].toLowerCase().replace('ac', 'AC')}</button>
        ))}
      </div>
      <p className="hint">The room and the windows and doors change the design right away; check them in the Design tab after.</p>
    </div>
  );
}

/* ---------- Site conditions ---------- */

function SiteTab({ v, put }: { v: Visit; put: Put }) {
  const set = (id: string, patch: { state?: SiteState; note?: string }) => put((x) => ({ site: { ...x.site, [id]: { ...x.site[id], ...patch } } }));
  const issues = useMemo(() => Object.values(v.site).filter((s) => s.state === 'issue').length, [v.site]);
  return (
    <div className="meeting-pad">
      <p className="hint">Mark each one OK, a concern, or not applicable, and add a note. {issues ? `${issues} concern${issues > 1 ? 's' : ''} so far.` : ''}</p>
      {siteChecks.map((g) => (
        <section key={g.group}>
          <h3>{g.group}</h3>
          {g.items.map((i) => {
            const s = v.site[i.id] ?? {};
            return (
              <div className={`site-row${s.state === 'issue' ? ' issue' : ''}`} key={i.id}>
                <div className="site-label"><b>{i.label}</b>{i.hint && <span className="hint">{i.hint}</span>}</div>
                <div className="seg">
                  {(['ok', 'issue', 'na'] as SiteState[]).map((st) => (
                    <button key={st} className={s.state === st ? 'on' : ''} aria-pressed={s.state === st} onClick={() => set(i.id, { state: s.state === st ? undefined : st })}>{st === 'ok' ? 'OK' : st === 'issue' ? 'Concern' : 'N/A'}</button>
                  ))}
                </div>
                <input aria-label={`${i.label} note`} placeholder="Note" value={s.note ?? ''} onChange={(e) => set(i.id, { note: e.target.value })} />
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

/* ---------- Selections ---------- */

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const deltaText = (d: number | undefined) => (d == null ? '' : Math.abs(d) < 5 ? 'same price' : `${d > 0 ? '+' : '−'}${money(Math.abs(d))}`);

function SelectionsTab({ put }: { put: Put }) {
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  const prices = useShop((s) => s.prices);
  const book = useMemo(() => priceBook(prices), [prices]);
  // What the price was when this screen opened, so a meeting's choices add up as they're made
  const [start] = useState(() => listedPrice(project));
  const now = useMemo(() => listedPrice(project), [project]);
  const signed = signedPrice(project);
  const deltas = useMemo(() => new Map(selections.filter((s) => !s.free && s.shown(project)).map((s) => [s.id, optionDeltas(project, s, book)])), [project, book]);
  const choose = (sel: Selection, v: string) => {
    commit((p) => sel.apply(p, v, book));
    // The visit keeps what was picked
    put(() => ({ selections: selectionText(useStore.getState().project) }));
  };
  const diff = signed != null ? now - signed : now - start;
  return (
    <div className="meeting-pad">
      <div className={`sel-total${Math.abs(diff) >= 5 ? ' changed' : ''}`}>
        <div><span className="muted">{signed != null ? 'Signed price' : 'Price before today’s choices'}</span><b>{money(signed ?? start)}</b></div>
        <div><span className="muted">With these choices</span><b>{money(now)}</b></div>
        <div><span className="muted">Difference</span><b>{Math.abs(diff) < 5 ? 'none' : `${diff > 0 ? '+' : '−'}${money(Math.abs(diff))}`}</b></div>
      </div>
      {signed != null && Math.abs(diff) >= 5 && <p className="warn">This job is signed: a change in price needs a change order the customer approves before the work changes.</p>}
      <p className="hint">Each choice shows what it does to the price next to it. The design and the quote change as you pick; a proposal that’s already out doesn’t change until you publish it again.</p>
      {selections.filter((s) => s.shown(project)).map((s) => {
        const d = deltas.get(s.id);
        return (
          <div className="sel-row" key={s.id}>
            <label htmlFor={`sel-${s.id}`}>{s.label}</label>
            <select id={`sel-${s.id}`} value={s.current(project)} onChange={(e) => choose(s, e.target.value)}>
              {s.options(project).map((o) => <option key={o.v} value={o.v}>{o.label}{d && o.v !== s.current(project) && d.has(o.v) ? `  (${deltaText(d.get(o.v))})` : ''}</option>)}
            </select>
          </div>
        );
      })}
      {doorDrawings(project.settings).length > 0 && (
        <div className="door-pics">
          {doorDrawings(project.settings).map((d) => <figure key={d.what}><img src={d.src} alt={`${d.what}: ${d.label}`} /><figcaption><b>{d.what}</b>{d.label ? `: ${d.label}` : ''}</figcaption></figure>)}
        </div>
      )}
      {project.settings.finish !== 'stain' && (
        <div className="sel-row"><span className="sel-label">Paint color and sheen</span><PaintColorPicker k="paint" /></div>
      )}
      <p className="hint">Door styles are priced the same in the quote (Eagle doors are estimated by the square foot), so a style change shows no difference. Knobs and pulls are the customer’s to supply; their color only changes the 3D view.</p>
    </div>
  );
}
