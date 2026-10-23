import { PhotoRoomButton } from './PhotoRoom';
import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { useStore } from '../store';
import { uid } from '../model/defaults';
import { geminiModels, promptRequest, renderOf, revisionRequest, templatePrompt, type RenderImage, type RenderState } from '../model/rendering';
import { base64ToBlob, blobToDataUrl, capability, shrinkImage, type Assets, type Downloads, type Mcp, type Sample } from '../runtime';
import { Field, Section } from './fields';

/** Which picture is on screen, shared by the stage and the list. */
const useView = create<{ selected?: string; select: (id?: string) => void }>((set) => ({ select: (selected) => set({ selected }) }));

export function useRender() {
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  const r = renderOf(project);
  const set = (patch: Partial<RenderState> | ((r: RenderState) => Partial<RenderState>)) =>
    commit((p) => { const cur = renderOf(p); return { ...p, render: { ...cur, ...(typeof patch === 'function' ? patch(cur) : patch) } }; });
  return { project, r, set };
}

/** Resolve a capability once for a component; null until (and unless) it's there. */
export function useCapability<T>(name: string): T | null {
  const [v, setV] = useState<T | null>(null);
  // Wrapped, because sample is itself a function and React would call it as an updater
  useEffect(() => { let live = true; capability<T>(name).then((x) => { if (live) setV(() => x); }); return () => { live = false; }; }, [name]);
  return v;
}

export const sampleError = (code?: string) =>
  code === 'not_granted' ? 'Claude wasn’t allowed for this page, so here’s the standard prompt instead.'
    : code === 'rate_limited' ? 'Claude is busy. Wait a minute and try again.'
      : code === 'cancelled' ? 'Stopped.'
        : 'Couldn’t reach Claude, so here’s the standard prompt instead.';

/** The custom connector's name in claude.ai; it must match exactly. */
export const GEMINI = 'Gemini Images';

function geminiError(e: { code?: string; message?: string; result?: unknown }): string {
  switch (e.code) {
    case 'server_not_connected':
    case 'server_not_found':
      return `The “${GEMINI}” connector isn’t added. In claude.ai go to Settings → Connectors → Add custom connector, name it exactly “${GEMINI}”, and paste the address from your Cloudflare connector page.`;
    case 'selection_required':
      return `There’s more than one connector named “${GEMINI}”. Pick one when claude.ai asks, or remove the extra one in Settings → Connectors.`;
    case 'needs_reauth':
      return `Reconnect “${GEMINI}” in claude.ai Settings → Connectors.`;
    case 'not_in_manifest':
    case 'approval_required':
    case 'not_granted':
      return `“${GEMINI}” isn’t allowed for this page yet. Press the button again and choose Allow when claude.ai asks.`;
    case 'blocked_by_policy':
      return 'Your organization’s settings block this connector.';
    case 'server_unavailable':
      return 'Couldn’t reach the connector just now. Try again in a minute.';
    case 'cancelled':
      return 'Stopped.';
    case 'tool_error': {
      const text = (e.result as { content?: { text?: string }[] } | undefined)?.content?.find((c) => c.text)?.text || e.message || '';
      return `Gemini couldn’t make that one: ${text.slice(0, 300)}`;
    }
    default:
      return 'Something went wrong reaching Gemini. Try again; if it keeps happening, check the connector page in Cloudflare says it’s running.';
  }
}

/** Store a picture: with the artifact's file storage when there is some, else shrunk into the job itself. */
async function storeImage(file: Blob, kind: RenderImage['kind'], assets: Assets | null, name = (file as File).name ?? kind): Promise<RenderImage> {
  const blob = await shrinkImage(file, assets ? 2400 : 1400, assets ? 0.9 : 0.8);
  const base = { id: uid('img'), kind, name: name.replace(/\.[^.]+$/, ''), note: '', at: Date.now() };
  if (assets) {
    const a = await assets.upload(blob);
    return { ...base, assetId: a.id, url: a.url };
  }
  return { ...base, url: await blobToDataUrl(blob) };
}

function useAddImages(kind: RenderImage['kind']) {
  const { set } = useRender();
  const assets = useCapability<Assets>('assets');
  const select = useView((s) => s.select);
  const [busy, setBusy] = useState('');
  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(`Adding ${files.length > 1 ? `${files.length} pictures` : 'picture'}…`);
    try {
      const added: RenderImage[] = [];
      for (const f of Array.from(files)) if (f.type.startsWith('image/')) added.push(await storeImage(f, kind, assets));
      set((r) => ({ images: [...r.images, ...added] }));
      if (added.length) select(added[added.length - 1].id);
      setBusy('');
    } catch (e) {
      const code = (e as { code?: string }).code;
      setBusy(code === 'quota_exceeded' ? 'Storage is full. Delete pictures you no longer need.' : code === 'too_large' ? 'That picture is too large.' : 'Couldn’t add that picture.');
    }
  };
  return { add, busy, stored: !!assets };
}

export function AddButton({ kind, label }: { kind: RenderImage['kind']; label: string }) {
  const { add, busy } = useAddImages(kind);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="order-actions">
      <button onClick={() => ref.current?.click()}>{label}</button>
      <input ref={ref} type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
      {busy && <span className="muted">{busy}</span>}
    </div>
  );
}

function CopyBox({ id, label, value, onChange, rows = 9 }: { id: string; label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  const [msg, setMsg] = useState('');
  const copy = () => navigator.clipboard.writeText(value).then(() => setMsg('Copied.'), () => setMsg('Couldn’t reach the clipboard; select the text and copy it.'));
  return (
    <>
      <Field label={label} htmlFor={id}><textarea id={id} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} /></Field>
      <div className="order-actions"><button onClick={copy} disabled={!value}>Copy</button>{msg && <span className="ok">{msg}</span>}</div>
    </>
  );
}

export const imageBlob = async (img: RenderImage, maxEdge = 1568) => shrinkImage(await (await fetch(img.url)).blob(), maxEdge, 0.85);

/* ---------- Left: photo, brief, prompt ---------- */

export function RenderInputs() {
  const { project, r, set } = useRender();
  const sample = useCapability<Sample>('sample');
  const [status, setStatus] = useState('');
  const [working, setWorking] = useState<'' | 'prompt' | 'revision'>('');
  const ctl = useRef<AbortController | null>(null);
  const photos = r.images.filter((i) => i.kind === 'photo');
  const renderings = r.images.filter((i) => i.kind === 'rendering');
  const latest = renderings[renderings.length - 1];

  // Straight to Gemini through the Gemini Images connector, when it's added
  const mcp = useCapability<Mcp>('mcp');
  const assets = useCapability<Assets>('assets');
  const select = useView((s) => s.select);
  const [gStatus, setGStatus] = useState<{ which: 'render' | 'revise'; text: string; bad?: boolean } | null>(null);
  const gemini = async (which: 'render' | 'revise') => {
    if (!mcp) return;
    const prompt = which === 'render' ? r.prompt.trim() : (r.revisionPrompt || r.revision).trim();
    const pics = which === 'render' ? photos.slice(0, 1) : [latest].filter(Boolean);
    if (!prompt || !pics.length) return;
    setGStatus({ which, text: 'Gemini is rendering. This usually takes 15 to 60 seconds.' });
    try {
      // Kept under the connector's 1 MB limit for what's sent
      const images = await Promise.all(pics.map(async (p) => {
        const b = await shrinkImage(await (await fetch(p.url)).blob(), 1536, 0.85);
        return { data: (await blobToDataUrl(b)).split(',')[1], mimeType: 'image/jpeg' };
      }));
      const res = await mcp.callTool(GEMINI, 'render_image', { prompt, images, model: r.geminiModel || geminiModels[0].id }, { cache: false });
      const img = res.content.find((c) => c.type === 'image' && c.data);
      if (!img) throw { code: 'tool_error', message: res.content.find((c) => c.text)?.text || 'No image came back.' };
      const blob = base64ToBlob(img.data!, img.mimeType || 'image/png');
      const stored = await storeImage(blob, 'rendering', assets, which === 'render' ? 'Gemini rendering' : 'Gemini revision');
      const note = which === 'revise' ? r.revision.trim().slice(0, 60) : '';
      set((cur) => ({ images: [...cur.images, { ...stored, note }] }));
      select(stored.id);
      setGStatus(null);
    } catch (e) {
      setGStatus({ which, text: geminiError(e as { code?: string; message?: string; result?: unknown }), bad: true });
    }
  };

  const ask = async (which: 'prompt' | 'revision') => {
    if (!sample) {
      if (which === 'prompt') set({ prompt: templatePrompt(r, project) });
      return;
    }
    ctl.current = new AbortController();
    setWorking(which);
    setStatus('Claude is looking at the photo…');
    const field = which === 'prompt' ? 'prompt' : 'revisionPrompt';
    try {
      const pic = which === 'prompt' ? photos[0] : latest;
      const images = pic ? [await imageBlob(pic)] : [];
      const input = which === 'prompt' ? promptRequest(r, project) : revisionRequest(r, !!pic);
      const { text } = await sample(input, { images, signal: ctl.current.signal, onText: ({ text }) => { setStatus(''); set({ [field]: text }); } });
      set({ [field]: text.trim() });
      setStatus('');
    } catch (e) {
      const code = (e as { code?: string }).code;
      setStatus(sampleError(code));
      if (which === 'prompt' && code !== 'cancelled' && code !== 'rate_limited') set({ prompt: templatePrompt(r, project) });
    } finally {
      setWorking('');
    }
  };

  return (
    <aside className="sidebar">
      <div className="side-body">
        <Section title="1. Photo of the space">
          <p className="hint">A straight-on photo of the wall, taken from where the customer will stand, renders best.</p>
          <AddButton kind="photo" label={photos.length ? 'Add another photo' : 'Add photo'} />
          {photos.length > 0 && <div className="order-actions"><PhotoRoomButton label="Build the room from these photos" /></div>}
        </Section>

        <Section title="2. What to add">
          <Field label="Describe the work" htmlFor="rd-brief">
            <textarea id="rd-brief" rows={6} value={r.brief} placeholder="Full wall of painted built-in bookcases with pilasters, lower cabinets with inset shaker doors, brass rolling ladder, coffered ceiling…" onChange={(e) => set({ brief: e.target.value })} />
          </Field>
          <label className="check-inline"><input id="rd-design" type="checkbox" checked={r.useDesign} disabled={!project.cabinets.length} onChange={(e) => set({ useDesign: e.target.checked })} /> Use the door style, base and mouldings from the design</label>
          {!project.cabinets.length && <p className="hint">No cabinets drawn yet, which is fine: the prompt comes from your description alone.</p>}
          <div className="order-actions" style={{ marginTop: 10 }}>
            <button className="primary" onClick={() => ask('prompt')} disabled={!!working || (!r.brief.trim() && !project.cabinets.length)}>
              {working === 'prompt' ? 'Writing…' : sample ? 'Write the prompt with Claude' : 'Write the prompt'}
            </button>
            {working && <button onClick={() => ctl.current?.abort()}>Stop</button>}
          </div>
          {status && <p className="hint" role="status">{status}</p>}
          {sample && !photos.length && <p className="hint">Add the photo first so Claude can place the work in the room.</p>}
        </Section>

        <Section title="3. Prompt and render">
          <CopyBox id="rd-prompt" label="Prompt" value={r.prompt} onChange={(v) => set({ prompt: v })} rows={10} />
          <div className="order-actions">
            <button className="primary" disabled={!mcp || !!gStatus && !gStatus.bad || !r.prompt.trim() || !photos.length} onClick={() => gemini('render')}>Render with Gemini</button>
            <select aria-label="Gemini model" value={r.geminiModel || geminiModels[0].id} onChange={(e) => set({ geminiModel: e.target.value })}>
              {geminiModels.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          {!mcp && <p className="hint">Render with Gemini works when the app is open on claude.ai with the “{GEMINI}” connector added. Reload the page if you just added it.</p>}
          {mcp && (!photos.length || !r.prompt.trim()) && <p className="hint">Add a photo and write the prompt first.</p>}
          {gStatus?.which === 'render' && <p className={gStatus.bad ? 'warn' : 'hint'} role="status">{gStatus.text}</p>}
          <p className="hint">{mcp ? 'Renders the first photo with this prompt and adds the result under Renderings. Or paste it into ChatGPT or Gemini yourself.' : 'Paste it into ChatGPT or Gemini with the photo. Save the image it makes, then add it under Renderings.'}</p>
        </Section>

        <Section title="4. Revise">
          <Field label="What to change" htmlFor="rd-rev">
            <textarea id="rd-rev" rows={3} value={r.revision} placeholder="Make the lower cabinets 36&quot; tall, drop the crown, darker brass…" onChange={(e) => set({ revision: e.target.value })} />
          </Field>
          <div className="order-actions">
            <button onClick={() => ask('revision')} disabled={!sample || !!working || !r.revision.trim()}>{working === 'revision' ? 'Writing…' : 'Write the revision'}</button>
            <button className="primary" disabled={!mcp || !!gStatus && !gStatus.bad || !latest || !r.revision.trim()} onClick={() => gemini('revise')}>Revise with Gemini</button>
          </div>
          {gStatus?.which === 'revise' && <p className={gStatus.bad ? 'warn' : 'hint'} role="status">{gStatus.text}</p>}
          {mcp && latest && <p className="hint">Revise with Gemini sends the newest rendering with {r.revisionPrompt ? 'the revision Claude wrote' : 'your change'}.</p>}
          {!sample && <p className="hint">Revisions are written by Claude, which isn’t available here. Type the change straight into ChatGPT.</p>}
          {r.revisionPrompt && <CopyBox id="rd-revp" label="Send this with the last rendering" value={r.revisionPrompt} onChange={(v) => set({ revisionPrompt: v })} rows={4} />}
        </Section>
      </div>
    </aside>
  );
}

/* ---------- Middle: the picture, with before and after ---------- */

export function RenderStage() {
  const { r } = useRender();
  const selected = useView((s) => s.selected);
  const [split, setSplit] = useState(50);
  const [compare, setCompare] = useState(true);
  const photo = r.images.find((i) => i.kind === 'photo');
  const renderings = r.images.filter((i) => i.kind === 'rendering');
  const shown = r.images.find((i) => i.id === selected) ?? renderings[renderings.length - 1] ?? photo;
  const canCompare = !!photo && shown?.kind === 'rendering';

  if (!shown) {
    return (
      <main className="stage render-stage">
        <div className="render-empty">
          <h2>Sell it with a picture of their own room</h2>
          <ol>
            <li>Add a photo of the customer’s space.</li>
            <li>Describe what you want to build. Claude writes the prompt.</li>
            <li>Paste the prompt and photo into ChatGPT or Gemini, then add the rendering back here.</li>
            <li>Pick the rendering that goes out with the quote.</li>
          </ol>
          <AddButton kind="photo" label="Add photo" />
        </div>
      </main>
    );
  }
  return (
    <main className="stage render-stage">
      <div className="render-bar">
        <strong>{shown.kind === 'photo' ? 'Existing space' : 'Rendering'}{shown.note ? `: ${shown.note}` : ''}</strong>
        {canCompare && (
          <label className="check-inline"><input id="rd-compare" type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} /> Before / after</label>
        )}
        <span className="grow" />
        <AddButton kind="rendering" label="Add rendering" />
      </div>
      {canCompare && compare ? (
        <div className="render-compare">
          <img src={shown.url} alt="Rendering" />
          <img src={photo!.url} alt="Existing space" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }} />
          <div className="divider" style={{ left: `${split}%` }} />
          <input aria-label="Before and after" type="range" min={0} max={100} value={split} onChange={(e) => setSplit(+e.target.value)} />
          <span className="tag before">Before</span><span className="tag after">After</span>
        </div>
      ) : (
        <div className="render-single"><img src={shown.url} alt={shown.kind === 'photo' ? 'Existing space' : 'Rendering'} /></div>
      )}
    </main>
  );
}

/* ---------- Right: everything kept for the job ---------- */

export function RenderSide() {
  const { r, set } = useRender();
  const { selected, select } = useView();
  const downloads = useCapability<Downloads>('downloads');
  const assets = useCapability<Assets>('assets');
  const [msg, setMsg] = useState('');
  const put = (id: string, patch: Partial<RenderImage>) => set((cur) => ({ images: cur.images.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  const remove = async (img: RenderImage) => {
    if (!confirm(`Delete this ${img.kind === 'photo' ? 'photo' : 'rendering'}? This can’t be undone.`)) return;
    if (img.assetId && assets) await assets.delete(img.assetId).catch(() => undefined);
    set((cur) => ({ images: cur.images.filter((i) => i.id !== img.id), quoteId: cur.quoteId === img.id ? undefined : cur.quoteId }));
  };
  const save = async (img: RenderImage) => {
    if (!downloads) return;
    try {
      const blob = await (await fetch(img.url)).blob();
      await downloads.save({ filename: `${img.note || img.name || 'rendering'}.jpg`, data: blob });
      setMsg('');
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== 'declined' && code !== 'cancelled') setMsg('Couldn’t save that picture.');
    }
  };
  const groups: [RenderImage['kind'], string][] = [['rendering', 'Renderings'], ['photo', 'Photos of the space']];
  const { stored } = useAddImages('rendering');
  return (
    <aside className="panel">
      <div className="panel-body">
        {groups.map(([kind, title]) => {
          const list = r.images.filter((i) => i.kind === kind);
          return (
            <Section key={kind} title={title}>
              {!list.length && <p className="hint">{kind === 'rendering' ? 'Renderings you add from ChatGPT or Gemini show here.' : 'No photo yet.'}</p>}
              <ul className="render-list">
                {[...list].reverse().map((img) => (
                  <li key={img.id} className={img.id === selected ? 'on' : ''}>
                    <button className="thumb" onClick={() => select(img.id)} aria-label="Show"><img src={img.url} alt="" /></button>
                    <div className="meta">
                      <input aria-label="Note" placeholder={kind === 'rendering' ? 'Option A, white paint…' : 'Back wall…'} value={img.note} onChange={(e) => put(img.id, { note: e.target.value })} />
                      <div className="order-actions">
                        {kind === 'rendering' && (
                          <label className="check-inline"><input type="radio" name="rd-quote" checked={r.quoteId === img.id} onChange={() => set({ quoteId: img.id })} /> With quote</label>
                        )}
                        {downloads && <button className="mini" onClick={() => save(img)}>Download</button>}
                        <button className="mini danger" onClick={() => remove(img)}>Delete</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          );
        })}
        {msg && <p className="warn">{msg}</p>}
        {!stored && <p className="hint">Pictures are kept with this design in this browser. Open the app on claude.ai to store full-size copies with the job.</p>}
      </div>
    </aside>
  );
}

/** The rendering picked for the quote, shown on the Quote tab. */
export function QuoteRendering() {
  const { r } = useRender();
  const setMode = useStore((s) => s.setMode);
  const img = r.images.find((i) => i.id === r.quoteId);
  const downloads = useCapability<Downloads>('downloads');
  const save = async () => {
    if (!img || !downloads) return;
    const blob = await (await fetch(img.url)).blob();
    await downloads.save({ filename: `${img.note || 'rendering'}.jpg`, data: blob }).catch(() => undefined);
  };
  return (
    <Section title="Rendering">
      {img ? (
        <>
          <img className="quote-render" src={img.url} alt="Rendering sent with the quote" />
          <div className="order-actions">{downloads && <button onClick={save}>Download for the customer</button>}<button onClick={() => setMode('render')}>Change</button></div>
        </>
      ) : (
        <div className="order-actions"><span className="muted">None picked.</span><button onClick={() => setMode('render')}>Rendering tab</button></div>
      )}
    </Section>
  );
}
