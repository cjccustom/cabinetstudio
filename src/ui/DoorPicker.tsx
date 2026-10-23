import { useMemo, useState } from 'react';
import { doorDrawing, proportionsFor, reebDesigns, type ReebDesign } from '../model/reeb';

/** A face-on drawing of a Reeb design, built from the same layout the 3D view uses. */
export function DoorGlyph({ d, size = 70 }: { d: ReebDesign; size?: number }) {
  const W = 32, H = 80;
  const dr = useMemo(() => doorDrawing(d, W, H, proportionsFor(d, H)), [d]);
  const fill = d.line === 'wood' ? '#d9b58a' : '#f4f2ec';
  return (
    <svg width={size * (W / H) + 4} height={size} viewBox={`-1 -1 ${W + 2} ${H + 2}`} className="door-glyph" aria-hidden="true">
      <rect x={0} y={0} width={W} height={H} fill={fill} stroke="#555" strokeWidth={0.4} />
      {[...dr.boxes].sort((a, b) => a.min[2] - b.min[2]).map((b, i) => (
        <rect key={i} x={b.min[0]} y={H - b.min[1] - b.size[1]} width={b.size[0]} height={b.size[1]} fill={fill} stroke="#777" strokeWidth={0.25} opacity={b.shade && b.shade < 0.9 ? 0.85 : 1} />
      ))}
      {dr.glass.map((b, i) => <rect key={`g${i}`} x={b.min[0]} y={H - b.min[1] - b.size[1]} width={b.size[0]} height={b.size[1]} fill="#cfe1ea" stroke="#777" strokeWidth={0.25} />)}
      {dr.glass.length > 0 && dr.boxes.filter((b) => b.size[2] === 0.8).map((b, i) => <rect key={`m${i}`} x={b.min[0]} y={H - b.min[1] - b.size[1]} width={b.size[0]} height={b.size[1]} fill={fill} />)}
      {dr.braces.map((br, i) => <line key={`b${i}`} x1={br.a[0]} y1={H - br.a[1]} x2={br.b[0]} y2={H - br.b[1]} stroke={d.line === 'wood' ? '#b8915f' : '#ddd'} strokeWidth={br.w} />)}
    </svg>
  );
}

export function DoorPicker({ current, onPick, onClose }: { current?: string; onPick: (code: string | undefined) => void; onClose: () => void }) {
  const [line, setLine] = useState<'primed' | 'wood'>(() => reebDesigns.find((d) => d.code === current)?.line ?? 'primed');
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal wide" role="dialog" aria-modal="true" aria-labelledby="dp-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="dp-title">Reeb interior doors</h2>
        <div className="pp-bar">
          <div className="seg" role="group" aria-label="Line">
            {(['primed', 'wood'] as const).map((k) => <button key={k} className={line === k ? 'on' : ''} aria-pressed={line === k} onClick={() => setLine(k)}>{k === 'primed' ? 'Primed stile & rail' : 'Wood stile & rail'}</button>)}
          </div>
          <span className="muted">Reeb’s popular in-stock designs, drawn with the stile and rail sizes from Reeb’s cut sheets.</span>
        </div>
        <div className="pp-grid">
          {reebDesigns.filter((d) => d.line === line).map((d) => (
            <button key={d.code} className={`pp-item${d.code === current ? ' on' : ''}`} onClick={() => { onPick(d.code); onClose(); }}>
              <DoorGlyph d={d} />
              <span className="pp-num">{d.code}</span>
              <span className="muted">{d.name}</span>
            </button>
          ))}
        </div>
        <div className="modal-actions">
          {current && <button onClick={() => { onPick(undefined); onClose(); }}>Plain slab</button>}
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
