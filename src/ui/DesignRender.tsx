import { useState } from 'react';
import { useStore } from '../store';
import { designRenderPrompt, geminiModels, renderOf } from '../model/rendering';
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
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);
  const [msg, setMsg] = useState('');
  const open = async () => {
    const blob = await captureView();
    if (!blob) { setMsg('Couldn’t capture the view.'); return; }
    setShot({ blob, url: URL.createObjectURL(blob) });
  };
  const close = () => { if (shot) URL.revokeObjectURL(shot.url); setShot(null); };
  return (
    <>
      <button className="render-view-btn" onClick={open} title="Send this view to Gemini for a photorealistic rendering">Render this view</button>
      {msg && <span className="render-view-msg">{msg}</span>}
      {shot && <DesignRenderDialog shot={shot} onClose={close} />}
    </>
  );
}

function DesignRenderDialog({ shot, onClose }: { shot: { blob: Blob; url: string }; onClose: () => void }) {
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
  const prompt = designRenderPrompt(project, notes, !!photo);

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
        <h2 id="dr-title">Render this view</h2>
        <div className="dr-pair">
          <figure><img src={shot.url} alt="The design view" /><figcaption>Your design view</figcaption></figure>
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
