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
import { capability, type Downloads } from '../runtime';

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

/** What's on the sketch: freehand ink (or eraser), a straight line, or a typed note. */
type Mark =
  | { kind?: 'ink'; pts: [number, number, number][]; erase: boolean; width: number }
  | { kind: 'line'; a: [number, number]; b: [number, number]; width: number }
  | { kind: 'text'; x: number; y: number; text: string; size: number };
type SketchTool = 'pen' | 'line' | 'text' | 'erase';

/** The sketch in progress survives switching tabs and a reload, until it's saved or cleared. */
let draftPages: { pages: Mark[][]; cur: number } | null = null;
const DRAFT_KEY = 'cabinet-studio.sketch-draft';
/** The pages in progress; an older single-page draft becomes page 1. */
const readDraft = (): { pages: Mark[][]; cur: number } => {
  const d = readJson<unknown>(DRAFT_KEY, null);
  if (Array.isArray(d)) return { pages: [d as Mark[]], cur: 0 };
  const o = d as { pages?: Mark[][]; cur?: number } | null;
  return o?.pages?.length ? { pages: o.pages, cur: Math.min(o.cur ?? 0, o.pages.length - 1) } : { pages: [[]], cur: 0 };
};
const PREFS_KEY = 'cabinet-studio.sketch-prefs';
const readJson = <T,>(key: string, fallback: T): T => { try { const s = localStorage.getItem(key); return s ? (JSON.parse(s) as T) : fallback; } catch { return fallback; } };
const writeJson = (key: string, v: unknown) => { try { if (v == null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage blocked */ } };

/** A touch this big is a palm or the side of a hand, not a fingertip. */
const PALM = 34;

function SketchTab({ v, put, folder, who }: { v: Visit; put: Put; folder?: string; who: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [book, setBookState] = useState(() => draftPages ?? readDraft());
  const setBook = (f: (b: { pages: Mark[][]; cur: number }) => { pages: Mark[][]; cur: number }) => setBookState((b) => {
    const n = f(b); draftPages = n;
    writeJson(DRAFT_KEY, n.pages.some((p) => p.length) || n.pages.length > 1 ? n : null);
    return n;
  });
  const marks = book.pages[book.cur] ?? [];
  const setMarks = (f: (m: Mark[]) => Mark[]) => setBook((b) => ({ ...b, pages: b.pages.map((p, i) => (i === b.cur ? f(p) : p)) }));
  const goPage = (i: number) => { if (typing) placeText(); setBook((b) => ({ ...b, cur: i })); setMsg(''); };
  const addPage = () => { if (typing) placeText(); setBook((b) => ({ pages: [...b.pages, []], cur: b.pages.length })); setMsg(''); };
  const removePage = () => {
    if (book.pages.length < 2 || (marks.length && !confirm(`Delete page ${book.cur + 1}?`))) return;
    setBook((b) => ({ pages: b.pages.filter((_, i) => i !== b.cur), cur: Math.max(0, b.cur - 1) }));
  };
  const [prefs, setPrefsState] = useState(() => readJson(PREFS_KEY, { pencilOnly: false, grid: true, thick: false }));
  const setPrefs = (p: Partial<typeof prefs>) => setPrefsState((x) => { const n = { ...x, ...p }; writeJson(PREFS_KEY, n); return n; });
  const [tool, setTool] = useState<SketchTool>('pen');
  const [label, setLabel] = useState('');
  const [msg, setMsg] = useState('');
  const [typing, setTyping] = useState<{ x: number; y: number; text: string } | null>(null);
  const live = useRef<Mark | null>(null);
  /** The one pointer that's drawing; any other touch while it's down is ignored. */
  const drawing = useRef<number | null>(null);
  const startedAt = useRef(0);
  const size = useRef({ w: 0, h: 0, dpr: 1 });
  const width = prefs.thick ? 4.5 : 2.6;

  const draw = (list: Mark[], forPng = false) => {
    const cv = canvas.current; if (!cv) return;
    const g = cv.getContext('2d')!;
    const { w, h, dpr } = size.current;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    // Graph paper, light enough to sketch over (kept faint in the saved picture)
    if (prefs.grid) {
      g.lineWidth = 1;
      for (let x = 0, i = 0; x <= w; x += 20, i++) { g.strokeStyle = i % 5 ? (forPng ? '#f1f3f6' : '#eceff3') : (forPng ? '#e3e7ec' : '#dde2e8'); g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, h); g.stroke(); }
      for (let y = 0, i = 0; y <= h; y += 20, i++) { g.strokeStyle = i % 5 ? (forPng ? '#f1f3f6' : '#eceff3') : (forPng ? '#e3e7ec' : '#dde2e8'); g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(w, y + 0.5); g.stroke(); }
    }
    g.lineCap = 'round'; g.lineJoin = 'round';
    const ink = '#1b1d21';
    for (const m of list) {
      if (m.kind === 'line') {
        g.strokeStyle = ink; g.lineWidth = m.width;
        g.beginPath(); g.moveTo(m.a[0], m.a[1]); g.lineTo(m.b[0], m.b[1]); g.stroke();
      } else if (m.kind === 'text') {
        g.fillStyle = '#1d4f91'; g.font = `600 ${m.size}px -apple-system, system-ui, sans-serif`; g.textBaseline = 'middle';
        m.text.split('\n').forEach((t, i) => g.fillText(t, m.x, m.y + i * m.size * 1.2));
      } else {
        // Eraser: paint the paper back, grid included
        g.strokeStyle = m.erase ? '#fff' : ink;
        for (let i = 1; i < m.pts.length; i++) {
          const [x0, y0] = m.pts[i - 1], [x1, y1, pr] = m.pts[i];
          g.lineWidth = m.erase ? 26 : m.width * (0.45 + pr * 0.9);
          g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
        }
        if (m.pts.length === 1) { const [x, y] = m.pts[0]; g.fillStyle = m.erase ? '#fff' : ink; g.beginPath(); g.arc(x, y, m.erase ? 13 : m.width / 2, 0, Math.PI * 2); g.fill(); }
      }
    }
  };
  useEffect(() => {
    const fit = () => {
      const el = wrap.current, cv = canvas.current; if (!el || !cv) return;
      const dpr = Math.min(3, window.devicePixelRatio || 1), w = el.clientWidth, h = el.clientHeight;
      size.current = { w, h, dpr };
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      cv.style.width = `${w}px`; cv.style.height = `${h}px`;
      const d = draftPages ?? book; draw(d.pages[d.cur] ?? []);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => draw(marks), [marks, prefs.grid]); // eslint-disable-line react-hooks/exhaustive-deps

  const at = (e: { clientX: number; clientY: number; pointerType: string; pressure: number }): [number, number, number] => {
    const r = canvas.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top, e.pointerType === 'pen' ? e.pressure || 0.5 : 0.5];
  };
  /** Straight lines snap to level, plumb and 45° when they're close. */
  const snapLine = (a: [number, number], b: [number, number]): [number, number] => {
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx), step = Math.PI / 4, near = Math.round(ang / step) * step;
    return Math.abs(ang - near) < (7 * Math.PI) / 180 ? [a[0] + len * Math.cos(near), a[1] + len * Math.sin(near)] : b;
  };
  const ignore = (e: React.PointerEvent) => {
    if (e.pointerType === 'pen') return false;
    // Pencil only: the hand never draws
    if (prefs.pencilOnly) return true;
    // A palm or the side of the hand: too big for a fingertip
    return e.pointerType === 'touch' && (e.width > PALM || e.height > PALM);
  };
  const down = (e: React.PointerEvent) => {
    if (typing) { placeText(); return; }
    if (e.pointerType === 'pen' && !prefs.pencilOnly) setPrefs({ pencilOnly: true });
    if (ignore(e)) return;
    // Another touch while one is drawing: that's the hand resting, or two fingers. If it lands right
    // after the stroke started, the stroke was probably the palm too: drop it.
    if (drawing.current != null) {
      const s = live.current;
      const still = !!s && (s.kind === 'line' ? Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) < 6 : s.kind !== 'text' && s.pts.every((q) => Math.hypot(q[0] - s.pts[0][0], q[1] - s.pts[0][1]) < 6));
      // The first touch hasn't moved: it was the hand resting. Hand the drawing to this one.
      if (e.pointerType === 'touch' && still) { live.current = null; drawing.current = null; }
      else return;
    }
    const p = at(e);
    if (tool === 'text') { setTyping({ x: p[0], y: p[1], text: '' }); return; }
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = e.pointerId; startedAt.current = Date.now();
    live.current = tool === 'line' ? { kind: 'line', a: [p[0], p[1]], b: [p[0], p[1]], width } : { pts: [p], erase: tool === 'erase', width };
    draw([...marks, live.current]);
  };
  const move = (e: React.PointerEvent) => {
    const s = live.current; if (!s || e.pointerId !== drawing.current) return;
    if (s.kind === 'line') { const p = at(e); s.b = snapLine(s.a, [p[0], p[1]]); }
    else if (s.kind !== 'text') { const evs = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [e.nativeEvent]; for (const ev of evs) s.pts.push(at(ev)); }
    draw([...marks, s]);
  };
  const up = (e: React.PointerEvent) => {
    if (e.pointerId !== drawing.current) return;
    drawing.current = null;
    const s = live.current; if (!s) return;
    live.current = null;
    if (s.kind === 'line' && Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) < 4) { draw(marks); return; }
    setMarks((all) => [...all, s]);
  };
  const placeText = () => {
    const t = typing; setTyping(null);
    if (t && t.text.trim()) setMarks((all) => [...all, { kind: 'text', x: t.x, y: t.y, text: t.text.trim(), size: prefs.thick ? 22 : 17 }]);
  };

  /** Onto the iPad itself: claude.ai's download, else the browser's. */
  const saveHere = async (name: string, blob: Blob) => {
    const downloads = await capability<Downloads>('downloads');
    if (downloads) await downloads.save({ filename: name, data: blob });
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); }
  };
  const save = async () => {
    if (!canvas.current) return;
    if (typing) placeText();
    setMsg('Saving…');
    const used = book.pages.map((p, i) => ({ p, i })).filter((x) => x.p.length);
    const d = new Date(), z = (n: number) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}${z(d.getMinutes())}`;
    const files: { name: string; blob: Blob }[] = [];
    for (const { p, i } of used) {
      draw(p, true);
      const blob = await new Promise<Blob | null>((ok) => canvas.current!.toBlob(ok, 'image/png'));
      if (blob) files.push({ name: `${stamp} sketch${label.trim() ? ` ${label.trim()}` : ''}${used.length > 1 ? ` page ${i + 1}` : ''}.png`.replace(/[\\/:*?"<>|]/g, ''), blob });
    }
    draw(marks);
    if (files.length < used.length) { setMsg('A page couldn’t be read. Take a screenshot of each page (top button + volume up) so nothing is lost.'); return; }
    const what = files.length > 1 ? `All ${files.length} pages` : 'The sketch';
    if (folder) {
      try {
        const paths: string[] = [];
        for (const f of files) paths.push((await savePhoto(`${folder}/Sketches`, f.name, await blobToBase64(f.blob))).path);
        put((x) => ({ sketches: [...x.sketches, ...paths] }));
        setMsg(`${what} saved to ${who}’s Sketches folder. They stay here too until you tap Start over.`);
        return;
      } catch (e) {
        setMsg(`Couldn’t reach Dropbox (${e instanceof PortalError ? e.message : (e as Error).message}). Saving to the iPad instead…`);
      }
    }
    try {
      for (const f of files) await saveHere(f.name, f.blob);
      setMsg(`${what} saved to the iPad${folder ? '' : ' (this job isn’t linked to a client folder yet)'}. They stay here too until you tap Start over.`);
    } catch (e) {
      const code = (e as { code?: string }).code;
      setMsg(code === 'declined' || code === 'cancelled' ? 'Not saved. Everything stays here until you tap Start over.' : 'Couldn’t save. Everything stays here until you tap Start over; a screenshot (top button + volume up) also works.');
    }
  };
  const startOver = () => {
    if (book.pages.some((p) => p.length) && !confirm('Start over? Every page is cleared. Save first if you haven’t.')) return;
    setBook(() => ({ pages: [[]], cur: 0 })); setMsg(''); setLabel('');
  };

  const tools: { id: SketchTool; label: string }[] = [{ id: 'pen', label: 'Pen' }, { id: 'line', label: 'Straight line' }, { id: 'text', label: 'Type a note' }, { id: 'erase', label: 'Eraser' }];
  return (
    <div className="sketch">
      <div className="sketch-bar">
        <div className="seg sketch-tools" role="group" aria-label="Tool">
          {tools.map((t) => <button key={t.id} className={tool === t.id ? 'on' : ''} aria-pressed={tool === t.id} onClick={() => { if (typing) placeText(); setTool(t.id); }}>{t.label}</button>)}
        </div>
        <button onClick={() => setMarks((s) => s.slice(0, -1))} disabled={!marks.length}>Undo</button>
        <button onClick={() => { if (marks.length && confirm(`Clear page ${book.cur + 1}?`)) { setMarks(() => []); setMsg(''); } }} disabled={!marks.length}>Clear page</button>
        <label className="chk-row"><input type="checkbox" checked={prefs.thick} onChange={(e) => setPrefs({ thick: e.target.checked })} /> Bold</label>
        <label className="chk-row"><input type="checkbox" checked={prefs.grid} onChange={(e) => setPrefs({ grid: e.target.checked })} /> Grid</label>
        <label className="chk-row" title="Your hand can rest on the screen; only the Apple Pencil draws"><input type="checkbox" checked={prefs.pencilOnly} onChange={(e) => setPrefs({ pencilOnly: e.target.checked })} /> Apple Pencil only</label>
      </div>
      <div className="sketch-bar">
        <div className="seg sketch-pages" role="tablist" aria-label="Pages">
          {book.pages.map((p, i) => <button key={i} role="tab" aria-selected={i === book.cur} className={i === book.cur ? 'on' : ''} onClick={() => goPage(i)}>Page {i + 1}{p.length ? '' : ' (blank)'}</button>)}
        </div>
        <button onClick={addPage}>+ New page</button>
        {book.pages.length > 1 && <button onClick={removePage}>Delete page</button>}
      </div>
      <div className="sketch-bar">
        <input aria-label="Sketch name" placeholder="What is it? (sink wall…)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <button className="primary" onClick={save} disabled={!book.pages.some((p) => p.length)}>{book.pages.filter((p) => p.length).length > 1 ? `Save all ${book.pages.filter((p) => p.length).length} pages` : 'Save sketch'}{folder ? '' : ' to the iPad'}</button>
        <button onClick={startOver} disabled={!book.pages.some((p) => p.length) && book.pages.length < 2}>Start over</button>
        {msg && <span className="hint">{msg}</span>}
        {v.sketches.length > 0 && <span className="hint">{v.sketches.length} saved today</span>}
        {!msg && <span className="hint">{tool === 'text' ? 'Tap where the note goes, then type or tap the microphone on the keyboard to dictate.' : tool === 'line' ? 'Drag for a straight line; it snaps level, plumb and 45°.' : prefs.pencilOnly ? 'Rest your hand anywhere: only the Pencil draws.' : 'Drawing with a finger: a resting palm is ignored. With an Apple Pencil, the first Pencil stroke turns on Pencil only.'}</span>}
      </div>
      <div className="sketch-wrap" ref={wrap}>
        <canvas ref={canvas} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onContextMenu={(e) => e.preventDefault()} style={{ touchAction: 'none' }} />
        {typing && (
          <div className="sketch-note" style={{ left: Math.min(typing.x, (size.current.w || 400) - 260), top: Math.max(0, typing.y - 22) }}>
            <textarea autoFocus rows={2} value={typing.text} placeholder="Note (36&quot; to the window…)" onChange={(e) => setTyping({ ...typing, text: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); placeText(); } if (e.key === 'Escape') setTyping(null); }} />
            <div className="order-actions"><button className="primary mini" onPointerDown={(e) => e.stopPropagation()} onClick={placeText}>Put it on</button><button className="mini" onPointerDown={(e) => e.stopPropagation()} onClick={() => setTyping(null)}>Cancel</button></div>
          </div>
        )}
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
      {signed != null && Math.abs(diff) >= 5 && <p className="warn">This job is signed: a change in price needs a change order the customer approves before the work changes. Write it up under Client portal → Change orders.</p>}
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
