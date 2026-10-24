import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';
import { useStore } from '../store';
import { customerSet, drawingsOf, papers, setDocument, sheetCss, shopSet, type DrawingSettings, type Paper, type Sheet } from '../drawings/sheets';
import { renderOf } from '../model/rendering';
import { clientName, clientOf } from '../model/client';
import { blobToDataUrl, capability, shrinkImage, type Downloads } from '../runtime';
import { writeFile } from '../dropbox';
import { Field, Section } from './fields';

type SetKind = 'customer' | 'shop';
const useSetKind = create<{ kind: SetKind; set: (k: SetKind) => void }>((set) => ({ kind: 'customer', set: (kind) => set({ kind }) }));

function useDrawings() {
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  const d = drawingsOf(project);
  const put = (patch: Partial<DrawingSettings>) => commit((p) => ({ ...p, drawings: { ...drawingsOf(p), ...patch } }));
  return { project, d, put };
}

function useSheets(): Sheet[] {
  const { project, d } = useDrawings();
  const kind = useSetKind((s) => s.kind);
  return useMemo(() => (kind === 'customer' ? customerSet(project, d) : shopSet(project, d)), [project, d, kind]);
}

const setTitle = (kind: SetKind, name: string) => `${name} - ${kind === 'customer' ? 'Drawings' : 'Shop drawings'}`;

/** The set as a file: the cover picture is put inside it, so the file stands on its own. */
async function exportDocument(kind: SetKind): Promise<{ name: string; html: string }> {
  const p = useStore.getState().project;
  let d = drawingsOf(p);
  if (d.cover && !d.cover.startsWith('data:')) {
    try { d = { ...d, cover: await blobToDataUrl(await shrinkImage(await (await fetch(d.cover)).blob(), 2000, 0.85)) }; } catch { d = { ...d, cover: undefined }; }
  }
  const sheets = kind === 'customer' ? customerSet(p, d) : shopSet(p, d);
  const who = clientName(clientOf(p)) || p.name;
  const name = `${setTitle(kind, who)}${d.rev ? ` - Rev ${d.rev}` : ''}.html`.replace(/[\\/:*?"<>|]/g, '');
  return { name, html: setDocument(name.replace(/\.html$/, ''), sheets, d.paper) };
}

/* ---------- Left: which set, paper, cover, and getting it out ---------- */

export function DrawingsSide() {
  const { project, d, put } = useDrawings();
  const { kind, set } = useSetKind();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const r = renderOf(project);
  const quoteRendering = r.images.find((i) => i.id === r.quoteId) ?? r.images.filter((i) => i.kind === 'rendering').slice(-1)[0];

  const download = async () => {
    setBusy(true); setMsg('');
    try {
      const downloads = await capability<Downloads>('downloads');
      const { name, html } = await exportDocument(kind);
      if (downloads) await downloads.save({ filename: name, data: new Blob([html], { type: 'text/html' }) });
      else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
        a.download = name;
        a.click();
      }
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== 'declined' && code !== 'cancelled') setMsg('Couldn’t save the file.');
    } finally { setBusy(false); }
  };
  const toDropbox = async () => {
    if (!project.dropbox) return;
    setBusy(true); setMsg('');
    try {
      const { name, html } = await exportDocument(kind);
      await writeFile(project.dropbox.path, name, html);
      setMsg(`Saved to ${project.dropbox.path}/${name}`);
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <aside className="sidebar">
      <div className="side-body">
        <Section title="Drawing set">
          <div className="seg" role="radiogroup" aria-label="Set">
            <button role="radio" aria-checked={kind === 'customer'} className={kind === 'customer' ? 'on' : ''} onClick={() => set('customer')}>For the customer</button>
            <button role="radio" aria-checked={kind === 'shop'} className={kind === 'shop' ? 'on' : ''} onClick={() => set('shop')}>Shop drawings</button>
          </div>
          <p className="hint">{kind === 'customer' ? 'Cover, floor plan and a dimensioned elevation of each wall with cabinets.' : 'An assembly sheet for each wall, then a sheet for every cabinet: face frame, section and parts.'}</p>
          <div className="grid2">
            <Field label="Paper" htmlFor="dw-paper">
              <select id="dw-paper" value={d.paper} onChange={(e) => put({ paper: e.target.value as Paper })}>
                {(Object.keys(papers) as Paper[]).map((k) => <option key={k} value={k}>{papers[k].label}</option>)}
              </select>
            </Field>
            <Field label="Revision" htmlFor="dw-rev">
              <div className="order-actions" style={{ margin: 0 }}>
                <span id="dw-rev">{d.rev ? `Rev ${d.rev}` : 'Original'}</span>
                <button className="mini" onClick={() => put({ rev: d.rev + 1 })}>New revision</button>
              </div>
            </Field>
          </div>
        </Section>

        {kind === 'customer' && (
          <Section title="Cover picture">
            {d.cover ? <img className="quote-render" src={d.cover} alt="Cover" /> : <p className="hint">None yet.</p>}
            <div className="order-actions">
              {quoteRendering && <button className="mini" onClick={() => put({ cover: quoteRendering.url })}>Use the rendering</button>}
              {d.cover && <button className="mini" onClick={() => put({ cover: undefined })}>Remove</button>}
            </div>
            <p className="hint">Or use a 3D view: in Design, turn the view the way you want it and press <b>Use as cover</b>.</p>
          </Section>
        )}

        {kind === 'customer' && (
          <Section title="Notes on the cover">
            <textarea id="dw-notes" rows={4} value={d.notes} placeholder="Paint color, hardware, anything to point out" onChange={(e) => put({ notes: e.target.value })} />
          </Section>
        )}

        <Section title="Get the drawings">
          <div className="order-actions">
            <button className="primary" disabled={busy} onClick={download}>Download</button>
            <button disabled={busy || !project.dropbox} onClick={toDropbox} title={project.dropbox ? '' : 'Link this job to a client in the Clients tab first'}>Save to Dropbox</button>
            <button disabled={busy} onClick={() => window.print()}>Print</button>
          </div>
          {msg && <p className="hint" role="status">{msg}</p>}
          <p className="hint">The file opens in Safari or Chrome; print it at 100% (actual size) to {papers[d.paper].label} paper, or Save as PDF, and the scales on each sheet hold.</p>
        </Section>
      </div>
    </aside>
  );
}

/* ---------- Middle: the sheets ---------- */

export function DrawingsMain() {
  const sheets = useSheets();
  const { d } = useDrawings();
  const P = papers[d.paper];
  // Start at the zoom that fits the sheet across the screen
  const [zoom, setZoom] = useState(() => Math.max(0.3, Math.min(1, +((Math.max(600, window.innerWidth - 700) / (P.w * 96))).toFixed(2))));
  return (
    <main className="stage drawings-stage">
      <style>{sheetCss + `@media print{@page{size:${P.w}in ${P.h}in;margin:0}}`}</style>
      <div className="dw-bar">
        <span className="muted">{sheets.length} sheet{sheets.length === 1 ? '' : 's'}</span>
        <span className="grow" />
        <button className="icon-btn" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.1).toFixed(2)))}>−</button>
        <span className="muted">{Math.round(zoom * 100)}%</span>
        <button className="icon-btn" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(2)))}>+</button>
      </div>
      <div className="dw-scroll">
        {!sheets.length && <p className="hint" style={{ padding: 20 }}>Add cabinets in Design to make drawings.</p>}
        {sheets.map((s) => (
          <div key={s.id} id={`sheet-${s.id}`} className="dw-sheet" style={{ width: `${P.w * 96 * zoom}px`, height: `${P.h * 96 * zoom}px` }}>
            <div style={{ transform: `scale(${zoom})`, transformOrigin: '0 0', width: `${P.w}in`, height: `${P.h}in` }} dangerouslySetInnerHTML={{ __html: s.svg }} />
          </div>
        ))}
      </div>
      {/* What prints: the same sheets at true size, outside the app's layout */}
      {createPortal(
        <div className="dw-print" aria-hidden>
          {sheets.map((s) => <div key={s.id} className="dw-page" style={{ width: `${P.w}in`, height: `${P.h}in` }} dangerouslySetInnerHTML={{ __html: s.svg }} />)}
        </div>,
        document.body,
      )}
    </main>
  );
}

/* ---------- Right: the sheet index ---------- */

export function DrawingsPanel() {
  const sheets = useSheets();
  return (
    <aside className="panel">
      <div className="panel-body">
        <Section title="Sheets">
          <ul className="sheet-list">
            {sheets.map((s) => (
              <li key={s.id}><button onClick={() => document.getElementById(`sheet-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><b>{s.number}</b> {s.title}</button></li>
            ))}
          </ul>
          <p className="hint">Drawings come straight from the design, so they change when it does. Start a new revision before sending an updated set.</p>
        </Section>
      </div>
    </aside>
  );
}

/** On the design view: save what's on screen as the drawing set's cover. */
export function CoverButton() {
  const [done, setDone] = useState(false);
  const commit = useStore((s) => s.commit);
  const grab = async () => {
    useStore.getState().select(null);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const canvas = document.querySelector<HTMLCanvasElement>('.stage canvas');
    if (!canvas) return;
    const flat = document.createElement('canvas');
    flat.width = canvas.width; flat.height = canvas.height;
    const g = flat.getContext('2d')!;
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, flat.width, flat.height);
    g.drawImage(canvas, 0, 0);
    const blob = await new Promise<Blob | null>((ok) => flat.toBlob(ok, 'image/jpeg', 0.9));
    if (!blob) return;
    const url = await blobToDataUrl(await shrinkImage(blob, 1800, 0.85));
    commit((p) => ({ ...p, drawings: { ...drawingsOf(p), cover: url } }));
    setDone(true);
    setTimeout(() => setDone(false), 2000);
  };
  return <button onClick={grab} title="Use this view on the cover of the drawings">{done ? 'Cover saved' : 'Use as cover'}</button>;
}
