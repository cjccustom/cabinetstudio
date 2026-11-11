// The part builder: draw a custom part's outline to scale (a corbel, a bracket, anything cut from a
// board), give it a thickness and its shop hours, and save it to the shop's parts library. From there
// it prints as a full-size template, saves as a DXF for the CNC, and goes under any mantel or floating
// shelf as its corbel.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { useShop, savePart, deletePart } from '../shop/shop';
import { cutDepth, edgeCutLabel, edgeCutNotes, inches, mouldingCategories, mouldingPresets, retargetMoulding, newPart, offsetOutline, outlineEdges, type EdgeCut, type EdgeCutKind, partArea, partDxf, partOutline, partPresets, partSize, templateHtml, type CustomPart, type PartPoint } from '../model/customParts';
import { capability, type Downloads } from '../runtime';
import { asciiHtml } from '../dropbox';
import { askConfirm } from './Confirm';
import { PartScene, SAMPLE_LENGTH, type PartView } from '../three/PartScene';
import { Field } from './fields';
import { LengthInput } from './fields';

const SNAP = 1 / 16;
const snap = (v: number) => Math.round(v / SNAP) * SNAP;

/** Save a file: through claude.ai's downloads when it's there, else the browser's own. */
async function saveFile(filename: string, data: Blob) {
  const downloads = await capability<Downloads>('downloads');
  if (downloads) await downloads.save({ filename, data });
  else { const a = document.createElement('a'); a.href = URL.createObjectURL(data); a.download = filename; a.click(); }
}

export function PartBuilder() {
  const library = useShop((s) => s.parts);
  const parts = useMemo(() => Object.values(library).sort((a, b) => a.name.localeCompare(b.name)), [library]);
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  const [draft, setDraft] = useState<CustomPart | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [view, setView] = useState<'profile' | PartView>('profile');
  const [preset, setPreset] = useState(partPresets[0].id);
  const [msg, setMsg] = useState('');
  const saved = draft ? library[draft.id] : undefined;
  const dirty = !!draft && JSON.stringify({ ...saved, updatedAt: 0 }) !== JSON.stringify({ ...draft, updatedAt: 0 });

  const open = async (p: CustomPart) => {
    if (dirty && !(await askConfirm(`Leave ${draft!.name} without saving your changes?`, 'Leave it'))) return;
    setDraft(p); setSel(null); setMsg('');
  };
  const put = (patch: Partial<CustomPart>) => setDraft((d) => d && { ...d, ...patch });
  const putPoint = (i: number, patch: Partial<PartPoint>) => setDraft((d) => d && { ...d, points: d.points.map((p, k) => (k === i ? { ...p, ...patch } : p)) });

  const save = async () => {
    if (!draft) return;
    const part = { ...draft, updatedAt: Date.now() };
    await savePart(part);
    // Anywhere this job already uses the part, it takes the new shape
    if (part.kind === 'moulding') {
      const olds = Object.keys(project.profiles ?? {}).filter((k) => k.endsWith(`:shop:${part.id}`));
      if (olds.length) {
        commit((p) => retargetMoulding(p, olds, part));
        setDraft(part);
        setMsg('Saved to the parts library; this job’s mouldings updated to the new shape and price.');
        return;
      }
      setDraft(part);
      setMsg('Saved to the parts library.');
      return;
    }
    const uses = project.cabinets.filter((c) => c.mantel?.corbelPart?.id === part.id || c.floating?.corbelPart?.id === part.id);
    if (uses.length) commit((p) => ({ ...p, cabinets: p.cabinets.map((c) => (c.mantel?.corbelPart?.id === part.id ? { ...c, mantel: { ...c.mantel, corbelPart: part } } : c.floating?.corbelPart?.id === part.id ? { ...c, floating: { ...c.floating, corbelPart: part } } : c)) }));
    setDraft(part);
    setMsg(`Saved to the parts library${uses.length ? `; ${uses.map((c) => c.name).join(', ')} in this job updated` : ''}.`);
  };
  const remove = async () => {
    if (!draft || !(await askConfirm(`Delete ${draft.name} from the parts library? Jobs already using it keep their copy.`, 'Delete'))) return;
    await deletePart(draft.id); setDraft(null);
  };
  const template = async () => {
    if (!draft) return;
    try { await saveFile(`${draft.name} - full-size template.html`, new Blob([asciiHtml(templateHtml(draft, project.name))], { type: 'text/html' })); setMsg('Template saved. Open it, print at 100% (actual size), check the 1" square, then tape the pages together on the overlap lines.'); }
    catch (e) { const code = (e as { code?: string }).code; if (code !== 'declined' && code !== 'cancelled') setMsg('Couldn’t save the template.'); }
  };
  const dxf = async () => {
    if (!draft) return;
    try { await saveFile(`${draft.name}.dxf`, new Blob([partDxf(draft)], { type: 'application/dxf' })); setMsg('DXF saved: one closed outline with true arcs, in inches.'); }
    catch (e) { const code = (e as { code?: string }).code; if (code !== 'declined' && code !== 'cancelled') setMsg('Couldn’t save the DXF.'); }
  };

  const size = draft ? partSize(draft) : null;
  const mould = draft?.kind === 'moulding';
  return (
    <>
      <aside className="sidebar">
        <div className="side-body">
          <h3>Parts library</h3>
          <p className="hint">Shop-made parts nobody sells: corbels, brackets, anything cut from a board. Shared by every job.</p>
          {parts.length ? (['cutout', 'moulding'] as const).map((k) => {
            const group = parts.filter((p) => (p.kind ?? 'cutout') === k);
            return group.length ? (
              <div key={k}>
                <h4 className="part-group">{k === 'cutout' ? 'Corbels and brackets' : 'Mouldings'}</h4>
                <ul className="part-list">
                  {group.map((p) => {
                    const s = partSize(p);
                    return <li key={p.id}><button className={draft?.id === p.id ? 'on' : ''} onClick={() => open(p)}><PartThumb part={p} /><span><b>{p.name}</b><span className="hint">{k === 'moulding' ? `${p.category ?? 'Moulding'}: ${inches(s.h)} × ${inches(s.w)}${p.costPerFoot != null ? `, $${p.costPerFoot.toFixed(2)}/ft` : ''}` : `${inches(s.h)} H × ${inches(s.w)} D × ${inches(p.thickness)}`}</span></span></button></li>;
                  })}
                </ul>
              </div>
            ) : null;
          }) : <p className="hint">No parts yet.</p>}
          <Field label="New part, starting from" htmlFor="pb-preset">
            <select id="pb-preset" value={preset} onChange={(e) => setPreset(e.target.value)}>
              <optgroup label="Cut from a board (corbels, brackets)">{partPresets.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</optgroup>
              <optgroup label="Mouldings (a profile run along a length)">{mouldingPresets.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</optgroup>
            </select>
          </Field>
          <button className="primary" onClick={() => open(newPart(preset))}>New part</button>
        </div>
      </aside>
      {draft ? (
        <>
          <main className="stage part-canvas">
            <div className="seg part-views" role="tablist" aria-label="View">
              {([['profile', 'Outline (edit)'], ['3d', '3D'], ['front', 'Front'], ['side', 'Side'], ['top', 'Top']] as const).map(([v, label]) => (
                <button key={v} role="tab" aria-selected={view === v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{label}</button>
              ))}
            </div>
            {view !== 'profile' ? (
              <div className="part-3d">
                <PartScene part={draft} view={view} />
                <span className="part-3d-dims">{mould
                  ? (view === '3d' ? `A ${inches(SAMPLE_LENGTH)} sample length. Drag to turn it, scroll or pinch to zoom, right-drag to slide` : view === 'front' ? `Front: ${inches(SAMPLE_LENGTH)} sample × ${inches(size!.h)} tall` : view === 'side' ? `End (the profile): ${inches(size!.w)} projection × ${inches(size!.h)} tall` : `Top: ${inches(SAMPLE_LENGTH)} sample × ${inches(size!.w)} projection`)
                  : view === '3d' ? 'Drag to turn it, scroll or pinch to zoom, right-drag to slide' : view === 'front' ? `Front: ${inches(draft.thickness)} W × ${inches(size!.h)} H` : view === 'side' ? `Side: ${inches(size!.w)} D × ${inches(size!.h)} H` : `Top: ${inches(draft.thickness)} W × ${inches(size!.w)} D`}</span>
              </div>
            ) : <OutlineEditor part={draft} sel={sel} onSelect={setSel} onPoint={putPoint} onInsert={(i, x, y) => { setDraft((d) => d && { ...d, points: [...d.points.slice(0, i + 1), { x, y }, ...d.points.slice(i + 1)] }); setSel(i + 1); }} />}
            <p className="hint">Drag a corner to move it (it snaps to 1/16"). Double-click an edge to add a corner there. Pick a corner to type its position or curve the edge that leaves it. {mould ? 'This is the end of the moulding as it’s installed: the back (against the cabinet or wall) is the left edge, the top is the top. For crown, draw it as it sits, sprung: the left edge is the drop down the face, the top edge the reach onto the ceiling.' : 'The back of the part (against the wall) is the left edge; the bottom is the bottom.'}</p>
          </main>
          <aside className="panel">
            <div className="panel-body">
              <Field label="Name" htmlFor="pb-name"><input id="pb-name" value={draft.name} onChange={(e) => put({ name: e.target.value })} /></Field>
              {mould ? (
                <>
                  <div className="grid2">
                    <Field label="Kind of moulding" htmlFor="pb-cat">
                      <select id="pb-cat" value={draft.category ?? 'Panel'} onChange={(e) => put({ category: e.target.value })}>
                        {mouldingCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </Field>
                    <Field label="Size, from the drawing" htmlFor="pb-cat"><b style={{ padding: '6px 0' }}>{inches(size!.h)} tall × {inches(size!.w)} projection</b></Field>
                  </div>
                  <div className="grid2">
                    <Field label="Your cost per lineal foot ($)" htmlFor="pb-cpf"><input id="pb-cpf" inputMode="decimal" value={draft.costPerFoot ?? ''} placeholder="$/ft" onChange={(e) => put({ costPerFoot: e.target.value.trim() === '' ? undefined : Math.max(0, Number(e.target.value) || 0) })} /></Field>
                    <Field label="Hours to grind knives or set up (once)" htmlFor="pb-tpl"><input id="pb-tpl" inputMode="decimal" value={draft.templateHours} onChange={(e) => put({ templateHours: Math.max(0, Number(e.target.value) || 0) })} /></Field>
                  </div>
                  <p className="hint">The cost per foot is stock and machine time to run it; it becomes this moulding’s price on a job’s Orders tab (you can still change it there per job). About {(partArea(draft) / 144).toFixed(3)} board feet per lineal foot in the finished profile, before waste.</p>
                </>
              ) : (
                <>
                  <div className="grid2">
                    <Field label="Size, from the drawing" htmlFor="pb-thick"><b style={{ padding: '6px 0' }}>{inches(size!.h)} H × {inches(size!.w)} D</b></Field>
                    <Field label="Thickness" htmlFor="pb-thick"><LengthInput id="pb-thick" value={draft.thickness} min={0.25} onChange={(v) => put({ thickness: v ?? draft.thickness })} /></Field>
                  </div>
                  <p className="hint">About {(partArea(draft) * draft.thickness / 144).toFixed(2)} board feet in the finished part.</p>
                  <div className="grid2">
                    <Field label="Hours to make each (from the template)" htmlFor="pb-each"><input id="pb-each" inputMode="decimal" value={draft.hoursEach} onChange={(e) => put({ hoursEach: Math.max(0, Number(e.target.value) || 0) })} /></Field>
                    <Field label="Hours for the master template (once)" htmlFor="pb-tpl"><input id="pb-tpl" inputMode="decimal" value={draft.templateHours} onChange={(e) => put({ templateHours: Math.max(0, Number(e.target.value) || 0) })} /></Field>
                  </div>
                </>
              )}
              <Field label="Species (blank: the job's)" htmlFor="pb-sp"><input id="pb-sp" value={draft.species ?? ''} placeholder="Red oak, maple, poplar…" onChange={(e) => put({ species: e.target.value || undefined })} /></Field>
              <Field label="Notes (glue-up, grain direction…)" htmlFor="pb-note"><textarea id="pb-note" rows={2} value={draft.note ?? ''} onChange={(e) => put({ note: e.target.value || undefined })} /></Field>
              {sel != null && draft.points[sel] && (
                <div className="pgroup">
                  <div className="pgroup-head"><span>Corner {sel + 1}</span><button className="mini" onClick={() => setSel(null)}>Done</button></div>
                  <div className="grid2">
                    <Field label="Out from the wall" htmlFor="pb-x"><LengthInput id="pb-x" value={draft.points[sel].x} onChange={(v) => v != null && putPoint(sel, { x: v })} /></Field>
                    <Field label="Up from the bottom" htmlFor="pb-y"><LengthInput id="pb-y" value={draft.points[sel].y} onChange={(v) => v != null && putPoint(sel, { y: v })} /></Field>
                  </div>
                  <Field label={`Edge to corner ${((sel + 1) % draft.points.length) + 1}: curve (0 straight, − and + bow opposite ways)`} htmlFor="pb-bulge">
                    <input id="pb-bulge" type="range" min={-1} max={1} step={0.01} value={draft.points[sel].bulge ?? 0} onChange={(e) => putPoint(sel, { bulge: Number(e.target.value) || undefined })} />
                  </Field>
                  <div className="order-actions">
                    <button className="mini" onClick={() => putPoint(sel, { bulge: undefined })}>Straighten</button>
                    <button className="mini" onClick={() => putPoint(sel, { bulge: -(draft.points[sel].bulge ?? 0) || undefined })}>Flip the curve</button>
                    <button className="mini danger" disabled={draft.points.length <= 3} onClick={() => { setDraft((d) => d && { ...d, points: d.points.filter((_, k) => k !== sel) }); setSel(null); }}>Delete corner</button>
                  </div>
                  {!mould && <EdgeCutFields cut={draft.points[sel].cut} edge={sel + 1} onChange={(cut) => putPoint(sel, { cut })}
                    onAll={(cut) => setDraft((d) => d && { ...d, points: d.points.map((p) => ({ ...p, cut })) })} />}
                </div>
              )}
              {!mould && edgeCutNotes(draft).length > 0 && (
                <div className="hint"><b>Edge profiles</b>{edgeCutNotes(draft).map((t) => <div key={t}>{t}</div>)}</div>
              )}
              <div className="order-actions">
                <button className="primary" disabled={!dirty} onClick={save}>{saved ? 'Save changes' : 'Save to library'}</button>
                <button onClick={template}>Full-size template</button>
                <button onClick={dxf}>DXF for the CNC</button>
                {saved && <button className="danger" onClick={remove}>Delete</button>}
              </div>
              {msg && <p className="ok">{msg}</p>}
              {mould
                ? <p className="hint">To use it: save it, then in Design pick a cabinet (or the room trim) and press its moulding’s profile button, for example <b>Crown</b>, <b>Light rail</b> or <b>Base</b>. It’s listed at the top under <b>Your mouldings</b>. It runs in the 3D and the drawings, and the lineal feet go on the Orders tab at your cost per foot.</p>
                : <p className="hint">To use it: save it, then in Design pick a mantel or floating shelf and choose it under <b>Corbel</b>. It goes into the 3D, the drawings, the cut list and the quote (its hours each, and the template once).</p>}
            </div>
          </aside>
        </>
      ) : (
        <>
          <main className="stage part-canvas empty"><p className="hint">Pick a part from the library, or start a new one.</p></main>
          <aside className="panel" />
        </>
      )}
    </>
  );
}

/** A small picture of the part for the library list. */
function PartThumb({ part }: { part: CustomPart }) {
  const o = partOutline(part, 12), s = partSize(part);
  const k = 40 / Math.max(s.w, s.h, 1);
  return <svg width={44} height={44} viewBox="-2 -2 44 44" className="part-thumb"><path d={`M${o.map(([x, y]) => `${((x - s.minX) * k).toFixed(1)},${(40 - (y - s.minY) * k).toFixed(1)}`).join(' L')} Z`} /></svg>;
}

/** The outline on a 1/4" grid: drag corners, double-click an edge to add one, click a corner to pick it. */
function OutlineEditor({ part, sel, onSelect, onPoint, onInsert }: { part: CustomPart; sel: number | null; onSelect: (i: number | null) => void; onPoint: (i: number, p: Partial<PartPoint>) => void; onInsert: (afterIndex: number, x: number, y: number) => void }) {
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<number | null>(null);
  const s = partSize(part);
  // The view: the part with room around it, fixed while dragging so the grid doesn't swim
  const [view, setView] = useState(() => frame(s));
  useEffect(() => { if (drag.current == null) setView(frame(s)); }, [part.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const { x0, y0, w, h } = view;
  const toSvg = (x: number, y: number): [number, number] => [x, y0 + h - (y - y0)];
  const fromEvent = (e: { clientX: number; clientY: number }) => {
    const r = svg.current!.getBoundingClientRect();
    const k = Math.min(r.width / w, r.height / h);
    const ox = r.left + (r.width - w * k) / 2, oy = r.top + (r.height - h * k) / 2;
    return { x: x0 + (e.clientX - ox) / k, y: y0 + h - (e.clientY - oy) / k };
  };
  const o = partOutline(part, 32);
  const path = `M${o.map(([x, y]) => toSvg(x, y).map((v) => v.toFixed(4)).join(',')).join(' L')} Z`;
  const lines: JSX.Element[] = [];
  for (let gx = Math.ceil(x0 * 4) / 4; gx <= x0 + w; gx += 0.25) { const [a] = toSvg(gx, 0); lines.push(<line key={`x${gx}`} x1={a} y1={y0} x2={a} y2={y0 + h} className={Math.abs(gx - Math.round(gx)) < 1e-6 ? 'g1' : 'g4'} />); }
  for (let gy = Math.ceil(y0 * 4) / 4; gy <= y0 + h; gy += 0.25) { const [, b] = toSvg(0, gy); lines.push(<line key={`y${gy}`} x1={x0} y1={b} x2={x0 + w} y2={b} className={Math.abs(gy - Math.round(gy)) < 1e-6 ? 'g1' : 'g4'} />); }
  // Each edge, for picking and adding corners
  const edges = part.points.map((p, i) => {
    const one = partOutline({ points: [p, part.points[(i + 1) % part.points.length], ...(part.points.length > 2 ? [] : [])] }, 32);
    const seg = one.slice(0, Math.max(2, one.length - (one.length > 2 ? 0 : 0)));
    return `M${seg.map(([x, y]) => toSvg(x, y).join(',')).join(' L')}`;
  });
  return (
    <svg ref={svg} className="outline-editor" viewBox={`${x0} ${y0} ${w} ${h}`} preserveAspectRatio="xMidYMid meet"
      onPointerMove={(e) => { if (drag.current == null) return; const q = fromEvent(e); onPoint(drag.current, { x: snap(q.x), y: snap(q.y) }); }}
      onPointerUp={() => { drag.current = null; }} onPointerLeave={() => { drag.current = null; }}>
      {lines}
      <path d={path} className="shape" />
      {(() => { const cl = cutLine(part); return cl ? <path d={`M${cl.map(([x, y]) => toSvg(x, y).map((v) => v.toFixed(4)).join(',')).join(' L')} Z`} className="cutline" /> : null; })()}
      {edges.map((d, i) => (
        <path key={`e${i}`} d={d} className={`edge${sel === i ? ' on' : ''}`} onClick={() => onSelect(i)}
          onDoubleClick={(e) => { const q = fromEvent(e); onInsert(i, snap(q.x), snap(q.y)); }} />
      ))}
      {part.points.map((p, i) => { const [cx, cy] = toSvg(p.x, p.y); return <circle key={`p${i}`} cx={cx} cy={cy} r={Math.max(w, h) * 0.012} className={`pt${sel === i ? ' on' : ''}`}
        onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); drag.current = i; onSelect(i); }} />; })}
      {/* Overall size along the bottom and the left */}
      <text x={toSvg(s.minX + s.w / 2, 0)[0]} y={toSvg(0, s.minY)[1] + h * 0.05} className="dim" textAnchor="middle">{inches(s.w)}</text>
      <text x={toSvg(s.minX, 0)[0] - w * 0.03} y={toSvg(0, s.minY + s.h / 2)[1]} className="dim" textAnchor="end">{inches(s.h)}</text>
    </svg>
  );
}

const frame = (s: { w: number; h: number; minX: number; minY: number }) => {
  const m = Math.max(1.5, Math.max(s.w, s.h) * 0.25);
  return { x0: Math.floor(s.minX - m), y0: Math.floor(s.minY - m), w: Math.ceil(s.w + 2 * m), h: Math.ceil(s.h + 2 * m) };
};

/** The router or shaper profile on the edge leaving the picked corner. */
function EdgeCutFields({ cut, edge, onChange, onAll }: { cut?: EdgeCut; edge: number; onChange: (c: EdgeCut | undefined) => void; onAll: (c: EdgeCut | undefined) => void }) {
  const kinds = Object.keys(edgeCutLabel) as EdgeCutKind[];
  return (
    <div className="edge-cut">
      <Field label={`Edge ${edge}: router or shaper profile`} htmlFor="pb-cut">
        <select id="pb-cut" value={cut?.kind ?? ''} onChange={(e) => onChange(e.target.value ? { kind: e.target.value as EdgeCutKind, size: cut?.size ?? 0.25, faces: cut?.faces ?? 'both' } : undefined)}>
          <option value="">Square (no profile)</option>
          {kinds.map((k) => <option key={k} value={k}>{edgeCutLabel[k]}</option>)}
        </select>
      </Field>
      {cut && (
        <div className="grid2">
          <Field label={cut.kind === 'chamfer' ? 'Size (each leg)' : cut.kind === 'rabbet' ? 'Width and depth' : 'Radius'} htmlFor="pb-cut-size">
            <LengthInput id="pb-cut-size" value={cut.size} min={1 / 16} onChange={(v) => v && onChange({ ...cut, size: v })} />
          </Field>
          <Field label="On" htmlFor="pb-cut-faces">
            <select id="pb-cut-faces" value={cut.faces} onChange={(e) => onChange({ ...cut, faces: e.target.value as EdgeCut['faces'] })}>
              <option value="both">Both faces</option><option value="left">Left face</option><option value="right">Right face</option>
            </select>
          </Field>
        </div>
      )}
      <div className="order-actions">
        {cut && <button className="mini" onClick={() => onAll(cut)} title="Every edge of the outline gets this profile; set the back and top edges back to Square if they sit against the wall and shelf">Use on every edge</button>}
        <button className="mini" onClick={() => onAll(undefined)}>Clear all profiles</button>
      </div>
    </div>
  );
}

/** Where the profiles stop on the face: the outline pulled in by each edge's full profile depth. */
export function cutLine(part: CustomPart): [number, number][] | null {
  if (!part.points.some((p) => p.cut)) return null;
  const { pts, edgeOf } = outlineEdges(part, 32);
  let area = 0;
  for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; area += x1 * y2 - x2 * y1; }
  const ins = edgeOf.map((e) => { const c = part.points[e].cut; return c ? cutDepth(c) : 0; });
  if (area >= 0) return offsetOutline(pts, ins);
  // Clockwise: run it backwards so "in" is to the left
  const n = pts.length;
  const rp = [...pts].reverse(), ri = rp.map((_, i) => (i < n - 1 ? ins[n - 2 - i] : ins[n - 1]));
  return offsetOutline(rp, ri);
}

