// Benjamin Moore colors for the cabinets, walls and trim (and any one cabinet's own color): your
// cabinet favorites first, the full catalog by name or number. Picking one sets the 3D color and
// puts the name and number on the proposal and drawings.
import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { catalogLoaded, colorText, searchColors, sheens, withNamed, type NamedColor, type NamedKey, type PaintColor } from '../model/paintColors';

const labels: Record<NamedKey, string> = { paint: 'Cabinet paint', wall: 'Walls', trim: 'Room trim' };

/** The job's color for cabinets, walls or trim. */
export function PaintColorPicker({ k }: { k: NamedKey }) {
  const named = useStore((s) => s.project.finishes.named?.[k]);
  const hex = useStore((s) => s.project.finishes[k]);
  const sheen = useStore((s) => s.project.finishes.paintSheen);
  const commit = useStore((s) => s.commit);
  return (
    <ColorPick label={labels[k]} hex={hex} named={named} onPick={(c) => commit((p) => withNamed(p, k, c))}
      extra={k === 'paint' && named ? (
        <label className="bm-sheen">Sheen{' '}
          <select value={sheen ?? ''} onChange={(e) => commit((p) => ({ ...p, finishes: { ...p.finishes, paintSheen: e.target.value || undefined } }))}>
            <option value="">Not said</option>
            {sheens.map((x) => <option key={x}>{x}</option>)}
          </select>
        </label>
      ) : null} />
  );
}

/** One color slot: a chip with its name, and the favorites and search to change it. */
export function ColorPick({ label, hex, named, onPick, extra, empty = 'no named color' }: { label: string; hex?: string; named?: NamedColor; onPick: (c: PaintColor | null) => void; extra?: React.ReactNode; empty?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const list = useMemo(() => (open ? searchColors(q) : []), [open, q]);
  const loaded = catalogLoaded();
  return (
    <div className="bm-pick">
      <div className="bm-row">
        <span className="bm-chip" style={{ background: hex ?? '#ffffff' }} aria-hidden="true" />
        <span className="bm-name">{label}: {named ? colorText(named) : <span className="muted">{empty}</span>}</span>
        <button className="mini" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Done' : named ? 'Change' : 'Pick a Benjamin Moore color'}</button>
        {named && <button className="link-btn" onClick={() => onPick(null)}>Clear</button>}
      </div>
      {extra}
      {open && (
        <div className="bm-panel">
          {!loaded ? <p className="warn">The Benjamin Moore catalog hasn’t been loaded into Cabinet Studio yet.</p> : (
            <>
              <input aria-label="Search Benjamin Moore colors" placeholder="Name or number: White Dove, OC-17, Hale Navy…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
              <p className="hint">{q ? `${list.length >= 40 ? 'First 40 matches' : `${list.length} match${list.length === 1 ? '' : 'es'}`} in the full catalog.` : 'Cabinet favorites. Search for any Benjamin Moore color.'}</p>
              <div className="bm-grid">
                {list.map((c) => (
                  <button key={c.code} className={`bm-swatch${named?.code === c.code ? ' on' : ''}`} onClick={() => onPick(c)} title={colorText(c)}>
                    <span style={{ background: c.hex }} />
                    <b>{c.name}</b><small>{c.code}</small>
                  </button>
                ))}
              </div>
            </>
          )}
          <p className="hint">Screen colors are close, not exact: the customer confirms the color from a sample before finishing.</p>
        </div>
      )}
    </div>
  );
}
