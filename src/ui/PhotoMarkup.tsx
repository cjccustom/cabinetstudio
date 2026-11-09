// Mark up a photo on the iPad: freehand with the Pencil, arrows, circles and a label or dimension
// typed where you tap, in red. Saved as a new picture in the client's Photos folder (the original
// stays as it was).
import { useEffect, useRef, useState } from 'react';
import { FileButton } from './FileButton';
import { PortalError, blobToBase64, savePhoto } from '../portal';

type Tool = 'pen' | 'arrow' | 'circle' | 'text';
interface Mark { tool: Tool; pts: [number, number][]; text?: string }
const RED = '#e0261b';

/** Draw the photo and the marks onto a canvas, `k` canvas pixels per photo pixel. */
function paint(g: CanvasRenderingContext2D, img: HTMLImageElement, marks: Mark[], k: number) {
  g.drawImage(img, 0, 0, img.naturalWidth * k, img.naturalHeight * k);
  // Line weight in photo pixels, so it looks the same on screen and in the saved picture
  const lw = Math.max(3, img.naturalWidth / 260) * k;
  g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = RED; g.fillStyle = RED; g.lineWidth = lw;
  for (const m of marks) {
    const p = m.pts.map(([x, y]) => [x * k, y * k] as [number, number]);
    if (!p.length) continue;
    if (m.tool === 'pen') {
      g.beginPath(); g.moveTo(p[0][0], p[0][1]); for (const [x, y] of p.slice(1)) g.lineTo(x, y); g.stroke();
    } else if (m.tool === 'arrow' && p.length > 1) {
      const [a, b] = [p[0], p[p.length - 1]];
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), head = lw * 5;
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      g.beginPath(); g.moveTo(b[0], b[1]);
      g.lineTo(b[0] - head * Math.cos(ang - 0.45), b[1] - head * Math.sin(ang - 0.45));
      g.lineTo(b[0] - head * Math.cos(ang + 0.45), b[1] - head * Math.sin(ang + 0.45));
      g.closePath(); g.fill();
    } else if (m.tool === 'circle' && p.length > 1) {
      const [a, b] = [p[0], p[p.length - 1]];
      g.beginPath(); g.ellipse((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]) / 2 || 1, Math.abs(b[1] - a[1]) / 2 || 1, 0, 0, Math.PI * 2); g.stroke();
    } else if (m.tool === 'text' && m.text) {
      const size = lw * 7;
      g.font = `700 ${size}px -apple-system, system-ui, sans-serif`;
      const w = g.measureText(m.text).width;
      // A white backing so the words read over a busy photo
      g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(p[0][0] - size * 0.2, p[0][1] - size * 0.95, w + size * 0.4, size * 1.25);
      g.fillStyle = RED; g.fillText(m.text, p[0][0], p[0][1]);
    }
  }
}

export function PhotoMarkup({ folder }: { folder?: string }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [name, setName] = useState('');
  const [marks, setMarks] = useState<Mark[]>([]);
  const [tool, setTool] = useState<Tool>('arrow');
  const [msg, setMsg] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const live = useRef<Mark | null>(null);
  const scale = useRef(1);

  const open = (files: FileList | null) => {
    const f = files?.[0]; if (!f) return;
    const url = URL.createObjectURL(f);
    const im = new Image();
    im.onload = () => { setImg(im); setMarks([]); setMsg(''); setName(f.name.replace(/\.[^.]+$/, '')); };
    im.src = url;
  };
  const redraw = (list: Mark[]) => {
    const cv = canvas.current; if (!cv || !img) return;
    const g = cv.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    paint(g, img, list, scale.current);
  };
  useEffect(() => {
    if (!img) return;
    const fit = () => {
      const cv = canvas.current, el = wrap.current; if (!cv || !el) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const maxW = el.clientWidth, maxH = Math.max(300, window.innerHeight - 240);
      const css = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
      scale.current = css * dpr;
      cv.width = Math.round(img.naturalWidth * scale.current); cv.height = Math.round(img.naturalHeight * scale.current);
      cv.style.width = `${img.naturalWidth * css}px`; cv.style.height = `${img.naturalHeight * css}px`;
      redraw(marks);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [img]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => redraw(marks), [marks]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Where the pointer is, in photo pixels. */
  const at = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = canvas.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * img!.naturalWidth, ((e.clientY - r.top) / r.height) * img!.naturalHeight];
  };
  const down = (e: React.PointerEvent) => {
    if (!img) return;
    if (tool === 'text') {
      const t = window.prompt('Label or dimension (e.g. "outlet moves here", 36 1/2")');
      if (t?.trim()) setMarks((m) => [...m, { tool: 'text', pts: [at(e)], text: t.trim() }]);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    live.current = { tool, pts: [at(e)] };
  };
  const move = (e: React.PointerEvent) => {
    const m = live.current; if (!m) return;
    if (m.tool === 'pen') for (const ev of (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [e.nativeEvent]) m.pts.push(at(ev));
    else m.pts[1] = at(e);
    redraw([...marks, m]);
  };
  const up = () => { const m = live.current; if (!m) return; live.current = null; if (m.pts.length > 1 || m.tool === 'pen') setMarks((all) => [...all, m]); };

  const save = async () => {
    if (!img || !folder) return;
    setMsg('Saving…');
    try {
      // Full size, up to 2560 px on the long side
      const k = Math.min(1, 2560 / Math.max(img.naturalWidth, img.naturalHeight));
      const out = document.createElement('canvas');
      out.width = Math.round(img.naturalWidth * k); out.height = Math.round(img.naturalHeight * k);
      paint(out.getContext('2d')!, img, marks, k);
      const blob = await new Promise<Blob | null>((ok) => out.toBlob(ok, 'image/jpeg', 0.88));
      if (!blob) throw new Error('The picture couldn’t be made.');
      const d = new Date(), z = (n: number) => String(n).padStart(2, '0');
      const file = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}${z(d.getMinutes())} marked up${name ? ` ${name}` : ''}.jpg`.replace(/[\\/:*?"<>|]/g, '');
      await savePhoto(`${folder}/Photos`, file, await blobToBase64(blob));
      setMsg('Saved to the client’s Photos folder.');
    } catch (e) { setMsg(e instanceof PortalError ? e.message : `Didn’t save: ${(e as Error).message}`); }
  };

  return (
    <section className="sheet-sec">
      <div className="sec-head"><h3>Mark up a photo</h3></div>
      <div className="order-actions">
        <FileButton accept="image/*" capture="environment" onFiles={open}>Take a photo to mark up</FileButton>
        <FileButton accept="image/*" onFiles={open}>Choose a photo</FileButton>
      </div>
      {img && (
        <>
          <div className="sketch-bar" style={{ padding: '8px 0' }}>
            <div className="seg">
              {([['arrow', 'Arrow'], ['circle', 'Circle'], ['pen', 'Pen'], ['text', 'Label']] as [Tool, string][]).map(([t, l]) => <button key={t} className={tool === t ? 'on' : ''} onClick={() => setTool(t)}>{l}</button>)}
            </div>
            <button onClick={() => setMarks((m) => m.slice(0, -1))} disabled={!marks.length}>Undo</button>
            <input aria-label="Photo name" placeholder="What is it?" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="primary" onClick={save} disabled={!folder || !marks.length}>Save marked-up photo</button>
            <button onClick={() => { setImg(null); setMarks([]); setMsg(''); }}>Close</button>
            {msg && <span className="hint">{msg}</span>}
          </div>
          <p className="hint">{tool === 'text' ? 'Tap where the label goes, then type it.' : tool === 'pen' ? 'Draw freehand.' : `Drag to draw ${tool === 'arrow' ? 'an arrow (it points where you lift)' : 'a circle around it'}.`}</p>
          <div ref={wrap} className="markup-wrap">
            <canvas ref={canvas} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} style={{ touchAction: 'none' }} />
          </div>
        </>
      )}
    </section>
  );
}
