import { useEffect, useRef, useState } from 'react';
import { live, useNav } from '../three/navigation';
import { photoRender, type Mood } from '../three/photoRender';
import { createPortal } from 'react-dom';
import { useStore } from '../store';
import { designRenderPrompt, finishRenderPrompt, geminiModels, renderOf } from '../model/rendering';
import { base64ToBlob, blobToDataUrl, shrinkImage, type Assets, type Mcp } from '../runtime';
import { GEMINI, geminiError, storeImage, useCapability, useRender, useView } from './Rendering';
import { Field } from './fields';

/** Grab what the 3D or elevation view shows right now, without the selection highlight. */
async function captureView(): Promise<Blob | null> {
  useStore.getState().select(null);
  // Two frames: one to redraw without the highlight, one to be sure it's on the canvas
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const canvas = document.querySelector<HTMLCanvasElement>('.stage canvas');
  if (!canvas) return null;
  // The 3D canvas is transparent where the page shows through; flatten it onto the stage color
  const flat = document.createElement('canvas');
  flat.width = canvas.width;
  flat.height = canvas.height;
  const g = flat.getContext('2d')!;
  g.fillStyle = getComputedStyle(canvas.closest('.stage') ?? document.body).backgroundColor || '#f6f5f2';
  g.fillRect(0, 0, flat.width, flat.height);
  g.drawImage(canvas, 0, 0);
  return new Promise((ok) => flat.toBlob((b) => ok(b), 'image/jpeg', 0.92));
}

const toPart = async (b: Blob) => ({ data: (await blobToDataUrl(await shrinkImage(b, 1536, 0.88))).split(',')[1], mimeType: 'image/jpeg' });

/** Render the design as it's drawn now: the view goes to Gemini with a prompt written from the design. */
export function DesignRenderButton() {
  const [shot, setShot] = useState<{ blob: Blob; url: string; photo?: boolean } | null>(null);
  const [photo, setPhoto] = useState(false);
  const [msg, setMsg] = useState('');
  const open = async () => {
    const blob = await captureView();
    if (!blob) { setMsg('Couldn’t capture the view.'); return; }
    setShot({ blob, url: URL.createObjectURL(blob) });
  };
  const close = () => { if (shot) URL.revokeObjectURL(shot.url); setShot(null); };
  return (
    <>
      <button className="render-view-btn" onClick={() => setPhoto(true)} title="A photograph of the design exactly as drawn, from this view: real light, shadows and materials">Photo render</button>
      <button className="render-view-btn" onClick={open} title="Send this view to Gemini as it is (quicker, but Gemini fills in more)">Gemini from view</button>
      <SaveViewButton onMsg={setMsg} />
      {msg && <span className="render-view-msg">{msg}</span>}
      {/* On the page body: inside the view's corner the add-toolbar would sit on top of it */}
      {shot && createPortal(<DesignRenderDialog shot={shot} onClose={close} />, document.body)}
      {photo && createPortal(<PhotoRenderDialog onClose={() => setPhoto(false)} onGemini={(blob) => { setPhoto(false); setShot({ blob, url: URL.createObjectURL(blob), photo: true }); }} />, document.body)}
    </>
  );
}

/**
 * Keep the 3D view as it looks now, as one of the proposal's images: a plain picture of the model
 * (the client never gets the model itself before signing).
 */
function SaveViewButton({ onMsg }: { onMsg: (m: string) => void }) {
  const { set } = useRender();
  const assets = useCapability<Assets>('assets');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true); onMsg('');
    try {
      const blob = await captureView();
      if (!blob) { onMsg('Couldn’t capture the view.'); return; }
      const img = await storeImage(blob, 'rendering', assets, '3D view of the design');
      set((cur) => ({ images: [...cur.images, { ...img, note: '3D view' }] }));
      onMsg('Saved to the Rendering tab; it goes out with the proposal.');
    } catch { onMsg('Couldn’t save the view.'); } finally { setBusy(false); }
  };
  return <button className="render-view-btn" disabled={busy} onClick={save} title="Save this 3D view as a picture that goes with the proposal">Save view for proposal</button>;
}

function DesignRenderDialog({ shot, onClose }: { shot: { blob: Blob; url: string; photo?: boolean }; onClose: () => void }) {
  const { project, r, set } = useRender();
  const setMode = useStore((s) => s.setMode);
  const select = useView((s) => s.select);
  const mcp = useCapability<Mcp>('mcp');
  const assets = useCapability<Assets>('assets');
  const photos = r.images.filter((i) => i.kind === 'photo');
  const [notes, setNotes] = useState('');
  const [photoId, setPhotoId] = useState<string>(photos[0]?.id ?? '');
  const [state, setState] = useState<{ busy?: boolean; error?: string; result?: { id: string; url: string } }>({});
  const photo = photos.find((p) => p.id === photoId);
  const [staging, setStaging] = useState(false);
  const prompt = shot.photo ? finishRenderPrompt(project, notes, staging, !!photo) : designRenderPrompt(project, notes, !!photo);

  const go = async () => {
    if (!mcp) return;
    setState({ busy: true });
    try {
      const images = [await toPart(shot.blob)];
      if (photo) images.push(await toPart(await (await fetch(photo.url)).blob()));
      const res = await mcp.callTool(GEMINI, 'render_image', { prompt, images, model: r.geminiModel || geminiModels[0].id }, { cache: false });
      const img = res.content.find((c) => c.type === 'image' && c.data);
      if (!img) throw { code: 'tool_error', message: res.content.find((c) => c.text)?.text || 'No image came back.' };
      const stored = await storeImage(base64ToBlob(img.data!, img.mimeType || 'image/png'), 'rendering', assets, 'Design rendering');
      const view = await storeImage(shot.blob, 'photo', assets, 'Design view');
      // Keep the model view as the "before" next to it, unless there's a real room photo
      set((cur) => ({ images: [...cur.images, ...(photos.length ? [] : [{ ...view, note: 'Design view' }]), { ...stored, note: notes.trim().slice(0, 60) }], quoteId: renderOf(project).quoteId ?? stored.id }));
      select(stored.id);
      setState({ result: { id: stored.id, url: stored.url } });
    } catch (e) {
      setState({ error: geminiError(e as { code?: string; message?: string; result?: unknown }) });
    }
  };

  return (
    <div className="modal-back" onClick={state.busy ? undefined : onClose}>
      <div className="modal wide design-render" role="dialog" aria-modal="true" aria-labelledby="dr-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="dr-title">{shot.photo ? 'Finish the photo with Gemini' : 'Render this view with Gemini'}</h2>
        <div className="dr-pair">
          <figure><img src={shot.url} alt="The design view" /><figcaption>{shot.photo ? 'Photo render (exact)' : 'Your design view'}</figcaption></figure>
          <figure>
            {state.result ? <img src={state.result.url} alt="Rendering" /> : <div className="dr-wait">{state.busy ? 'Gemini is rendering… usually 15 to 60 seconds' : 'The rendering appears here'}</div>}
            <figcaption>Rendering</figcaption>
          </figure>
        </div>
        {!state.result && (
          <>
            <div className="grid2">
              <Field label="Room photo for context" htmlFor="dr-photo">
                <select id="dr-photo" value={photoId} onChange={(e) => setPhotoId(e.target.value)}>
                  <option value="">None: use the design’s colors</option>
                  {photos.map((p) => <option key={p.id} value={p.id}>{p.note || p.name}</option>)}
                </select>
              </Field>
              <Field label="Gemini model" htmlFor="dr-model">
                <select id="dr-model" value={r.geminiModel || geminiModels[0].id} onChange={(e) => set({ geminiModel: e.target.value })}>
                  {geminiModels.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </Field>
            </div>
            {shot.photo && <label className="chk-row"><input type="checkbox" checked={staging} onChange={(e) => setStaging(e.target.checked)} /> Add a few books, baskets and a rug (nothing in front of doors or drawers)</label>}
            <Field label="Anything to add (optional)" htmlFor="dr-notes">
              <textarea id="dr-notes" rows={2} value={notes} placeholder="Unlacquered brass knobs, warm evening light, books and baskets on the shelves…" onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <details className="dr-prompt"><summary>Prompt sent to Gemini</summary><pre>{prompt}</pre></details>
          </>
        )}
        {state.error && <p className="warn" role="status">{state.error}</p>}
        {!mcp && <p className="warn">Rendering needs the app open on claude.ai with the “{GEMINI}” connector added.</p>}
        <div className="modal-actions">
          {state.result ? (
            <>
              <button onClick={() => setState({})}>Render again</button>
              <button onClick={() => { onClose(); setMode('render'); }}>Open in Rendering tab</button>
              <button className="primary" onClick={onClose}>Done</button>
            </>
          ) : (
            <>
              <button onClick={onClose} disabled={state.busy}>Cancel</button>
              <button className="primary" onClick={go} disabled={!mcp || state.busy}>{state.busy ? 'Rendering…' : 'Render with Gemini'}</button>
            </>
          )}
        </div>
        {state.result && <p className="hint">Saved under Renderings{renderOf(project).quoteId === state.result.id ? ' and picked to go with the quote' : ''}.</p>}
      </div>
    </div>
  );
}

const qualities = [
  { id: 'quick', label: 'Quick look', samples: 96, long: 1600 },
  { id: 'best', label: 'Best, for the proposal (takes longer)', samples: 420, long: 2400 },
] as const;

/**
 * A photograph of the design exactly as drawn, from the view on screen: the scene path traced on this
 * device (light bouncing around the room, soft shadows, real paint, stone and metal), no outlines.
 */
function PhotoRenderDialog({ onClose, onGemini }: { onClose: () => void; onGemini: (b: Blob) => void }) {
  const { set } = useRender();
  const assets = useCapability<Assets>('assets');
  const [mood, setMood] = useState<Mood>('day');
  const [q, setQ] = useState<(typeof qualities)[number]['id']>('quick');
  const [state, setState] = useState<{ busy?: boolean; done?: number; of?: number; error?: string; result?: { blob: Blob; url: string }; saved?: boolean }>({});
  const box = useRef<HTMLDivElement>(null);
  const stop = useRef({ cancel: false });
  useEffect(() => () => { stop.current.cancel = true; }, []);
  const go = async () => {
    const scene = live.scene, cam = live.camera;
    const view = document.querySelector<HTMLCanvasElement>('.stage canvas');
    if (!scene || !cam || !view) { setState({ error: 'Open the 3D view first, turned the way you want the picture.' }); return; }
    const Q = qualities.find((x) => x.id === q)!;
    // The picture keeps the view's shape, its long side at the chosen size
    const r = view.clientWidth / Math.max(1, view.clientHeight);
    const width = r >= 1 ? Q.long : Math.round(Q.long * r), height = r >= 1 ? Math.round(Q.long / r) : Q.long;
    stop.current = { cancel: false };
    setState({ busy: true, done: 0, of: Q.samples });
    useStore.getState().select(null);
    // Evening: the cabinet lighting on
    const nav = useNav.getState(), lightsWere = nav.lights;
    if (mood === 'evening' && !lightsWere) { nav.setLights(true); await new Promise((ok) => setTimeout(ok, 400)); }
    try {
      const blob = await photoRender(scene, cam, { width, height, samples: Q.samples, mood, stop: stop.current, onProgress: (done, of, canvas) => {
        if (box.current && canvas.parentElement !== box.current) { box.current.innerHTML = ''; canvas.style.width = '100%'; canvas.style.height = 'auto'; box.current.appendChild(canvas); }
        setState((st) => ({ ...st, done, of }));
      } });
      setState({ result: { blob, url: URL.createObjectURL(blob) } });
    } catch (e) {
      setState({ error: `The photo render didn’t work on this device: ${(e as Error).message}. Try Quick, or a computer with a stronger graphics card.` });
    } finally {
      if (mood === 'evening' && !lightsWere) useNav.getState().setLights(false);
    }
  };
  const save = async () => {
    if (!state.result) return;
    const img = await storeImage(state.result.blob, 'rendering', assets, 'Photo render');
    set((cur) => ({ images: [...cur.images, { ...img, note: `Photo render, ${mood}` }] }));
    setState((st) => ({ ...st, saved: true }));
  };
  return (
    <div className="modal-back" onClick={state.busy ? undefined : onClose}>
      <div className="modal wide design-render" role="dialog" aria-modal="true" aria-labelledby="pr-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="pr-title">Photo render</h2>
        <p className="hint">A photograph of the design exactly as drawn, from the view on screen: real light bouncing around the room, soft shadows, the paint, stone and metal as picked. Nothing is made up, so it can go to the client as is.</p>
        {state.result
          ? <img src={state.result.url} alt="Photo render" style={{ width: '100%', borderRadius: 6 }} />
          : <div ref={box} className="dr-wait" style={{ minHeight: 220 }}>{state.busy ? 'Setting up the scene…' : 'The picture appears here as it renders, getting cleaner as it goes.'}</div>}
        {!state.result && !state.busy && (
          <div className="grid2">
            <Field label="Light" htmlFor="pr-mood">
              <select id="pr-mood" value={mood} onChange={(e) => setMood(e.target.value as Mood)}>
                <option value="day">Day: soft daylight and the cans</option>
                <option value="evening">Evening: the cans and cabinet lighting</option>
              </select>
            </Field>
            <Field label="Quality" htmlFor="pr-q">
              <select id="pr-q" value={q} onChange={(e) => setQ(e.target.value as typeof q)}>
                {qualities.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
            </Field>
          </div>
        )}
        {state.busy && <p className="hint" role="status">Rendering: {state.done ?? 0} of {state.of} passes. Keep this tab in front; it goes faster.</p>}
        {state.error && <p className="warn" role="status">{state.error}</p>}
        <div className="modal-actions">
          {state.result ? (
            <>
              <button onClick={() => setState({})}>Render again</button>
              <button onClick={() => onGemini(state.result!.blob)} title="Gemini adds photographic polish (and decor, if you like), keeping the cabinetry as drawn">Finish with Gemini…</button>
              <button className="primary" disabled={state.saved} onClick={save}>{state.saved ? 'Saved for the proposal' : 'Save for the proposal'}</button>
              <button onClick={onClose}>Done</button>
            </>
          ) : state.busy ? (
            <button onClick={() => { stop.current.cancel = true; }}>Stop here and keep it</button>
          ) : (
            <>
              <button onClick={onClose}>Cancel</button>
              <button className="primary" onClick={go}>Render</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
