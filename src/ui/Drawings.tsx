import { memo, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';
import { useStore } from '../store';
import { customerSet, drawingsOf, papers, setDocument, sheetCss, shopSet, type DrawingSettings, type Paper, type Sheet, type SheetText } from '../drawings/sheets';
import { scaleName, scales, type DimEdit } from '../drawings/draw';
import { renderOf } from '../model/rendering';
import { clientName, clientOf } from '../model/client';
import { blobToDataUrl, capability, shrinkImage, type Downloads } from '../runtime';
import { asciiHtml, writeFile } from '../dropbox';
import { Field, Section } from './fields';
import { DetailsSection } from './DetailsSection';
import { cofferOf } from '../model/coffer';
import { wallNames, wallOrder } from '../model/layout';
import { shopPacketDocument } from '../drawings/packet';
import { withPictures } from './setPictures';
import { labelFormats, type LabelFormat } from '../drawings/labels';

type SetKind = 'customer' | 'shop';
const useSetKind = create<{ kind: SetKind; set: (k: SetKind) => void }>((set) => ({ kind: 'customer', set: (kind) => set({ kind }) }));

function useDrawings() {
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  // Kept the same object until the drawings change, so the sheets aren't redrawn on every render
  const d = useMemo(() => drawingsOf(project), [project]);
  const put = (patch: Partial<DrawingSettings>) => commit((p) => ({ ...p, drawings: { ...drawingsOf(p), ...patch } }));
  return { project, d, put };
}

function useSheets(): Sheet[] {
  const { project, d } = useDrawings();
  const kind = useSetKind((s) => s.kind);
  return useMemo(() => (kind === 'customer' ? customerSet(project, d) : shopSet(project, d)), [project, d, kind]);
}

/** One sheet's drawing, set into the page only when it changes (so what's under the pointer stays put). */
const SheetSvg = memo(function SheetSvg({ svg, zoom, w, h }: { svg: string; zoom: number; w: number; h: number }) {
  return <div style={{ transform: `scale(${zoom})`, transformOrigin: '0 0', width: `${w}in`, height: `${h}in` }} dangerouslySetInnerHTML={{ __html: svg }} />;
});

const setTitle = (kind: SetKind, name: string) => `${name} - ${kind === 'customer' ? 'Drawings' : 'Shop drawings'}`;

/** The set as a file: the cover picture is put inside it, so the file stands on its own. */
async function exportDocument(kind: SetKind): Promise<{ name: string; html: string }> {
  const p = kind === 'customer' ? await withPictures(useStore.getState().project) : useStore.getState().project;
  let d = drawingsOf(p);
  if (d.cover && !d.cover.startsWith('data:')) {
    try { d = { ...d, cover: await blobToDataUrl(await shrinkImage(await (await fetch(d.cover)).blob(), 2000, 0.85)) }; } catch { d = { ...d, cover: undefined }; }
  }
  const sheets = kind === 'customer' ? customerSet(p, d) : shopSet(p, d);
  const who = clientName(clientOf(p)) || p.name;
  const name = `${setTitle(kind, who)}${d.rev ? ` - Rev ${d.rev}` : ''}.html`.replace(/[\\/:*?"<>|]/g, '');
  return { name, html: asciiHtml(setDocument(name.replace(/\.html$/, ''), sheets, d.paper)) };
}

/** The full shop packet as a file: drawings, cut diagrams, face frame list and assembly, labels. */
function exportPacket(labels: LabelFormat): { name: string; html: string } {
  const p = useStore.getState().project;
  const d = drawingsOf(p);
  const who = clientName(clientOf(p)) || p.name;
  const name = `${who} - Shop packet${d.rev ? ` - Rev ${d.rev}` : ''}.html`.replace(/[\\/:*?"<>|]/g, '');
  return { name, html: asciiHtml(shopPacketDocument(p, { labels, title: name.replace(/\.html$/, '') })) };
}

/* ---------- Left: which set, paper, cover, and getting it out ---------- */

export function DrawingsSide() {
  const { project, d, put } = useDrawings();
  const { kind, set } = useSetKind();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const r = renderOf(project);
  const quoteRendering = r.images.find((i) => i.id === r.quoteId) ?? r.images.filter((i) => i.kind === 'rendering').slice(-1)[0];

  const [labelFmt, setLabelFmt] = useState<LabelFormat>('8163');
  const download = async (packet = false) => {
    setBusy(true); setMsg('');
    try {
      const downloads = await capability<Downloads>('downloads');
      const { name, html } = packet ? exportPacket(labelFmt) : await exportDocument(kind);
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
  const toDropbox = async (packet = false) => {
    if (!project.dropbox) return;
    setBusy(true); setMsg('');
    try {
      const { name, html } = packet ? exportPacket(labelFmt) : await exportDocument(kind);
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

        <DetailsSection />

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

        {kind === 'customer' && (
          <Section title="Side walls on the elevations">
            {wallOrder.map((w) => (
              <Field key={w} label={wallNames[w]} htmlFor={`dw-sides-${w}`}>
                <select id={`dw-sides-${w}`} value={d.sides?.[w] ?? ''} onChange={(e) => put({ sides: { ...d.sides, [w]: (e.target.value || undefined) as 'section' | 'side' | undefined } })}>
                  <option value="">Just this wall</option>
                  <option value="section">With the side walls and ceiling in section (shaded)</option>
                  <option value="side">With the side walls as seen from here</option>
                </select>
              </Field>
            ))}
            <p className="hint">In section, what's built on the side walls and the coffered ceiling is cut and shaded solid, so the customer sees how far everything comes out into the room without its insides. Seen from here shows the side of anything exposed: end panels, crown and base returns.</p>
          </Section>
        )}

        {cofferOf(project).on && (
          <Section title="Ceiling plan">
            <label className="check-inline"><input type="checkbox" checked={d.rcpLights ?? true} onChange={(e) => put({ rcpLights: e.target.checked })} /> Show the recessed lights</label>
            <label className="check-inline"><input type="checkbox" checked={!!d.rcpCenters} onChange={(e) => put({ rcpCenters: e.target.checked || undefined })} /> Dimension the beam centerlines</label>
          </Section>
        )}

        <Section title="Get the drawings">
          <div className="order-actions">
            <button className="primary" disabled={busy} onClick={() => download()}>Download</button>
            <button disabled={busy || !project.dropbox} onClick={() => toDropbox()} title={project.dropbox ? '' : 'Link this job to a client in the Clients tab first'}>Save to Dropbox</button>
          </div>
          {kind === 'shop' && (
            <>
              <h3>Full shop packet</h3>
              <p className="hint">Everything to build it, in one file: these shop drawings, a face frame assembly sheet for each different face frame, the plywood cut diagrams (every part numbered), the face frame cut list (rip widths, boards, crosscuts), then the part labels numbered to match the cut diagrams.</p>
              <Field label="Labels on" htmlFor="dw-labels">
                <select id="dw-labels" value={labelFmt} onChange={(e) => setLabelFmt(e.target.value as LabelFormat)}>
                  {(Object.keys(labelFormats) as LabelFormat[]).map((k) => <option key={k} value={k}>{labelFormats[k].name}</option>)}
                </select>
              </Field>
              <div className="order-actions">
                <button className="primary" disabled={busy} onClick={() => download(true)}>Download the packet</button>
                <button disabled={busy || !project.dropbox} onClick={() => toDropbox(true)}>Save packet to Dropbox</button>
              </div>
            </>
          )}
          {msg && <p className="hint" role="status">{msg}</p>}
          <p className="hint">To print: Download (or open the Dropbox copy), open the file in Safari or Chrome and print from there. Cabinet Studio can’t open the print window itself. Print at 100% (actual size) to {papers[d.paper].label} paper, or Save as PDF, and the scales on each sheet hold.</p>
        </Section>
      </div>
    </aside>
  );
}

/* ---------- Middle: the sheets ---------- */

/** What's open for editing on a sheet: a dimension, or a note (new or existing), placed where it was clicked. */
type Pop =
  | { kind: 'dim'; id: string; text: string; measured: string; hidden: boolean; x: number; y: number }
  | { kind: 'note'; sheet: string; id?: string; px: number; py: number; text: string; size: number; x: number; y: number };

/**
 * The sheets on screen, and the drawings editable (the design never changes from here): click a
 * dimension to retype, hide or move it; double-click a sheet to type a note, drag a note to move
 * it; pick each view's scale in the panel; click a detail bubble to go to the detail. Zoom with the
 * buttons or Ctrl/⌘ + scroll.
 */
export function DrawingsMain() {
  const sheets = useSheets();
  const { d, put } = useDrawings();
  const P = papers[d.paper];
  // Start at the zoom that fits the sheet across the screen
  const fit = () => Math.max(0.3, Math.min(1, +((Math.max(600, window.innerWidth - 700) / (P.w * 96))).toFixed(2)));
  const [zoom, setZoom] = useState(fit);
  const [pop, setPop] = useState<Pop | null>(null);
  const drag = useRef<{ el: SVGRectElement; sheet: string; id: string; x0: number; y0: number; moved: boolean; dx: number; dy: number } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const zoomBy = (f: number) => setZoom((z) => Math.min(4, Math.max(0.25, +(z * f).toFixed(2))));
  const at = (e: { clientX: number; clientY: number }) => { const box = scroller.current!.getBoundingClientRect(); return { x: e.clientX - box.left + scroller.current!.scrollLeft, y: e.clientY - box.top + scroller.current!.scrollTop }; };

  const dims = d.edits?.dims ?? {};
  const putDim = (id: string, patch: DimEdit | null) => {
    const next = { ...dims };
    const v = patch ? { ...dims[id], ...patch } : {};
    (Object.keys(v) as (keyof DimEdit)[]).forEach((k) => (v[k] === undefined || v[k] === '' || v[k] === 0 || v[k] === false) && delete v[k]);
    if (Object.keys(v).length) next[id] = v; else delete next[id];
    put({ edits: { ...d.edits, dims: next } });
  };
  const texts = d.texts ?? {};
  const putText = (sheet: string, list: SheetText[]) => {
    const next = { ...texts, [sheet]: list };
    if (!list.length) delete next[sheet];
    put({ texts: next });
  };

  // What was pressed: the click's own target can shift if the page moves under the pointer
  const pressed = useRef<{ dim: SVGRectElement | null; x: number; y: number } | null>(null);
  const down = (e: React.PointerEvent) => {
    pressed.current = { dim: (e.target as Element).closest('rect.hit[data-dim]') as SVGRectElement | null, x: e.clientX, y: e.clientY };
    const el = (e.target as Element).closest('rect.hit[data-note]') as SVGRectElement | null;
    if (!el || e.button !== 0) return;
    drag.current = { el, sheet: el.dataset.sheet!, id: el.dataset.note!, x0: e.clientX, y0: e.clientY, moved: false, dx: 0, dy: 0 };
    el.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const g = drag.current;
    if (!g) return;
    const dx = (e.clientX - g.x0) / (96 * zoom), dy = (e.clientY - g.y0) / (96 * zoom);
    if (!g.moved && Math.hypot(dx, dy) * 96 * zoom < 4) return;
    g.moved = true; g.dx = dx; g.dy = dy;
    // Move the note and its target together while dragging
    g.el.setAttribute('transform', `translate(${dx} ${dy})`);
    (g.el.previousElementSibling as SVGElement | null)?.setAttribute('transform', `translate(${dx} ${dy})`);
  };
  const up = (e: React.PointerEvent) => {
    const pr = pressed.current;
    pressed.current = null;
    if (pr?.dim && Math.hypot(e.clientX - pr.x, e.clientY - pr.y) < 6) {
      const ds = pr.dim.dataset;
      setPop({ kind: 'dim', id: ds.dim!, text: dims[ds.dim!]?.text ?? '', measured: ds.measured ?? ds.text ?? '', hidden: !!ds.hidden, ...at(e) });
      return;
    }
    const g = drag.current;
    drag.current = null;
    if (!g) return;
    const list = texts[g.sheet] ?? [];
    const t = list.find((x) => x.id === g.id);
    if (!t) return;
    if (g.moved) { putText(g.sheet, list.map((x) => (x.id === g.id ? { ...x, x: +(x.x + g.dx).toFixed(3), y: +(x.y + g.dy).toFixed(3) } : x))); return; }
    const p = at(e);
    setPop({ kind: 'note', sheet: g.sheet, id: t.id, px: t.x, py: t.y, text: t.text, size: t.size ?? 0.11, ...p });
  };
  const click = (e: React.MouseEvent) => {
    const t = e.target as Element;
    const go = t.closest('[data-field="goto"]') as SVGElement | null;
    if (go?.dataset.sheet) document.getElementById(`sheet-${go.dataset.sheet}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  // Double-click an empty spot on a sheet: a new note there
  const dbl = (e: React.MouseEvent) => {
    const t = e.target as Element;
    if (t.closest('rect.hit')) return;
    const sh = t.closest('.dw-sheet') as HTMLElement | null;
    if (!sh) return;
    const r = sh.getBoundingClientRect();
    setPop({ kind: 'note', sheet: sh.id.replace(/^sheet-/, ''), px: +((e.clientX - r.left) / (96 * zoom)).toFixed(3), py: +((e.clientY - r.top) / (96 * zoom) - 0.08).toFixed(3), text: '', size: 0.11, ...at(e) });
  };
  const wheel = (e: React.WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1);
  };
  const saveNote = (text: string, size: number) => {
    if (!pop || pop.kind !== 'note') return;
    const list = texts[pop.sheet] ?? [];
    if (!text.trim()) putText(pop.sheet, list.filter((x) => x.id !== pop.id));
    else if (pop.id) putText(pop.sheet, list.map((x) => (x.id === pop.id ? { ...x, text, size } : x)));
    else putText(pop.sheet, [...list, { id: `t${Date.now().toString(36)}`, x: pop.px, y: pop.py, text, size }]);
    setPop(null);
  };
  const stop = { onPointerDown: (e: React.PointerEvent) => e.stopPropagation(), onClick: (e: React.MouseEvent) => e.stopPropagation(), onDoubleClick: (e: React.MouseEvent) => e.stopPropagation() };

  return (
    <main className="stage drawings-stage">
      <style>{sheetCss + `@media print{@page{size:${P.w}in ${P.h}in;margin:0}}`}</style>
      <div className="dw-bar">
        <span className="muted">{sheets.length} sheet{sheets.length === 1 ? '' : 's'} · click a dimension to change it · double-click a sheet to add a note</span>
        <span className="grow" />
        <button className="icon-btn" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.25)}>−</button>
        <span className="muted">{Math.round(zoom * 100)}%</span>
        <button className="icon-btn" aria-label="Zoom in" onClick={() => zoomBy(1.25)}>+</button>
        <button className="mini" onClick={() => setZoom(fit())}>Fit</button>
      </div>
      <div className="dw-scroll" ref={scroller} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClick={click} onDoubleClick={dbl} onWheel={wheel}>
        {!sheets.length && <p className="hint" style={{ padding: 20 }}>Add cabinets in Design to make drawings.</p>}
        {sheets.map((s) => (
          <div key={s.id} id={`sheet-${s.id}`} className="dw-sheet" style={{ width: `${P.w * 96 * zoom}px`, height: `${P.h * 96 * zoom}px` }}>
            <SheetSvg svg={s.svg} zoom={zoom} w={P.w} h={P.h} />
          </div>
        ))}
        {pop?.kind === 'dim' && (
          <form className="dw-pop" style={{ left: pop.x, top: pop.y }} {...stop} onSubmit={(e) => { e.preventDefault(); putDim(pop.id, { text: String(new FormData(e.currentTarget).get('t') ?? '').trim() || undefined }); setPop(null); }}>
            <label htmlFor="dw-dt">Dimension ({pop.measured})</label>
            <input id="dw-dt" name="t" autoFocus defaultValue={pop.text} placeholder={pop.measured} onKeyDown={(e) => { if (e.key === 'Escape') setPop(null); }} />
            <button className="mini primary">Set text</button>
            <button type="button" className="mini" title="Move it further from the drawing" onClick={() => putDim(pop.id, { off: +((dims[pop.id]?.off ?? 0) + 0.12).toFixed(2) })}>Out</button>
            <button type="button" className="mini" title="Move it closer to the drawing" onClick={() => putDim(pop.id, { off: +((dims[pop.id]?.off ?? 0) - 0.12).toFixed(2) })}>In</button>
            <button type="button" className="mini" onClick={() => { putDim(pop.id, { hidden: !pop.hidden }); setPop(null); }}>{pop.hidden ? 'Show' : 'Hide'}</button>
            <button type="button" className="mini" onClick={() => { putDim(pop.id, null); setPop(null); }}>Reset</button>
            <button type="button" className="mini" onClick={() => setPop(null)}>Close</button>
          </form>
        )}
        {pop?.kind === 'note' && (
          <form className="dw-pop note" style={{ left: pop.x, top: pop.y }} {...stop} onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); saveNote(String(f.get('t') ?? ''), Number(f.get('s')) || 0.11); }}>
            <label htmlFor="dw-nt">{pop.id ? 'Note on the sheet' : 'New note here'}</label>
            <textarea id="dw-nt" name="t" rows={2} autoFocus defaultValue={pop.text} placeholder="Type the note" onKeyDown={(e) => { if (e.key === 'Escape') setPop(null); }} />
            <select name="s" aria-label="Text size" defaultValue={String(pop.size)}>
              <option value="0.09">Small</option><option value="0.11">Normal</option><option value="0.15">Large</option>
            </select>
            <button className="mini primary">{pop.id ? 'Save' : 'Add'}</button>
            {pop.id && <button type="button" className="mini" onClick={() => saveNote('', pop.size)}>Delete</button>}
            <button type="button" className="mini" onClick={() => setPop(null)}>Cancel</button>
          </form>
        )}
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
  const { d, put } = useDrawings();
  const sc = d.edits?.scales ?? {};
  const setScale = (key: string, v: number | null) => {
    const next = { ...sc };
    if (v == null) delete next[key]; else next[key] = v;
    put({ edits: { ...d.edits, scales: next } });
  };
  const hidden = Object.values(d.edits?.dims ?? {}).filter((x) => x.hidden).length;
  const edited = Object.keys(d.edits?.dims ?? {}).length;
  const notes = Object.values(d.texts ?? {}).reduce((t, l) => t + l.length, 0);
  return (
    <aside className="panel">
      <div className="panel-body">
        <Section title="Sheets">
          <ul className="sheet-list">
            {sheets.map((s) => (
              <li key={s.id}>
                <button onClick={() => document.getElementById(`sheet-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><b>{s.number}</b> {s.title}</button>
                {(s.views ?? []).map((v) => (
                  <div key={v.key} className="view-scale">
                    <span className="muted">{v.label}</span>
                    <select aria-label={`Scale of ${v.label}`} className={sc[v.key] != null ? 'overridden' : ''} value={sc[v.key] ?? ''} onChange={(e) => setScale(v.key, e.target.value ? Number(e.target.value) : null)}>
                      <option value="">Fit ({scaleName(v.fit)})</option>
                      {scales.filter((x) => x <= 3).map((x) => <option key={x} value={x}>{scaleName(x)}{x > v.fit ? ' (may not fit)' : ''}</option>)}
                    </select>
                  </div>
                ))}
              </li>
            ))}
          </ul>
          <p className="hint">Drawings come straight from the design, so they change when it does. Changes made here (scales, dimensions, notes) only change the drawings. Start a new revision before sending an updated set.</p>
          {(edited > 0 || notes > 0) && (
            <p className="hint">
              {edited ? `${edited} dimension${edited === 1 ? '' : 's'} changed${hidden ? ` (${hidden} hidden, shown dashed red here, not on paper)` : ''}. ` : ''}{notes ? `${notes} note${notes === 1 ? '' : 's'} on sheets. ` : ''}
              {edited > 0 && <button className="link-btn" onClick={() => put({ edits: { ...d.edits, dims: undefined } })}>Reset all dimensions</button>}
            </p>
          )}
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
