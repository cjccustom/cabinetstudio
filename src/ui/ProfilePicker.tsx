import { useMemo, useState } from 'react';
import { amCatalog, type AMProfile } from '../model/andersonMcquaid';
import { moldCategories, moldLabel, priceOf, type MoldKind } from '../model/moldings';
import { fmt } from '../units';

/** A small drawing of a profile as it appears in the Anderson & McQuaid book. */
export function ProfileThumb({ p, size = 64 }: { p: AMProfile; size?: number }) {
  if (!p.shape || !p.sw || !p.sh) {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" className="prof-thumb" aria-hidden="true">
        <text x="32" y="36" textAnchor="middle" className="prof-none">no drawing</text>
      </svg>
    );
  }
  const pad = 0.15;
  const span = Math.max(p.sw, p.sh) + pad * 2;
  const pts = p.shape.map(([x, y]) => `${x + pad + (span - pad * 2 - p.sw!) / 2},${span - (y + pad + (span - pad * 2 - p.sh!) / 2)}`).join(' ');
  return (
    <svg width={size} height={size} viewBox={`0 0 ${span} ${span}`} className="prof-thumb" aria-hidden="true">
      <polygon points={pts} className="prof-shape" />
    </svg>
  );
}

export function ProfilePicker({ kind, current, species, onPick, onClose }: {
  kind: MoldKind; current?: string; species: string; onPick: (num: string | undefined) => void; onClose: () => void;
}) {
  const cats = useMemo(() => [...new Set(amCatalog.map((p) => p.category))].sort(), []);
  const [cat, setCat] = useState<string>(moldCategories[kind][0]);
  const [q, setQ] = useState('');
  const list = amCatalog.filter((p) => (q ? p.num.includes(q.trim()) : p.category === cat));
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal wide" role="dialog" aria-modal="true" aria-labelledby="pp-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="pp-title">{moldLabel[kind]}: Anderson &amp; McQuaid profiles</h2>
        <div className="pp-bar">
          <select id="pp-cat" aria-label="Category" value={cat} onChange={(e) => { setCat(e.target.value); setQ(''); }}>
            <optgroup label={`Suggested for ${moldLabel[kind].toLowerCase()}`}>
              {moldCategories[kind].map((c) => <option key={c} value={c}>{c}</option>)}
            </optgroup>
            <optgroup label="All categories">
              {cats.filter((c) => !moldCategories[kind].includes(c)).map((c) => <option key={c} value={c}>{c}</option>)}
            </optgroup>
          </select>
          <input id="pp-q" placeholder="A&M number" value={q} onChange={(e) => setQ(e.target.value)} inputMode="numeric" />
          <span className="muted">Prices per lineal foot in {species.toLowerCase()} where offered.</span>
        </div>
        <div className="pp-grid">
          {list.map((p) => {
            const pr = priceOf(p, species);
            return (
              <button key={p.num} className={`pp-item${p.num === current ? ' on' : ''}`} onClick={() => { onPick(p.num); onClose(); }}>
                <ProfileThumb p={p} />
                <span className="pp-num">A&amp;M {p.num}</span>
                <span className="muted mono">{fmt(p.t)} × {fmt(p.w)}</span>
                {pr && <span className="mono">${pr.price.toFixed(2)}/ft{pr.species !== species ? ` ${pr.species.toLowerCase()}` : ''}</span>}
              </button>
            );
          })}
          {list.length === 0 && <p className="hint">Nothing matches.</p>}
        </div>
        <div className="modal-actions">
          {current && <button onClick={() => { onPick(undefined); onClose(); }}>Remove {moldLabel[kind].toLowerCase()}</button>}
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/** One moulding slot in an inspector: the chosen profile with buttons to change or clear it. */
export function MoldSlot({ kind, num, species, onChange, extra }: { kind: MoldKind; num?: string; species: string; onChange: (n: string | undefined) => void; extra?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const p = amCatalog.find((x) => x.num === num);
  return (
    <div className="mold-slot">
      <span className="mold-kind">{moldLabel[kind]}</span>
      {p ? (
        <button className="mold-pick" onClick={() => setOpen(true)}>
          <ProfileThumb p={p} size={36} />
          <span><strong>A&amp;M {p.num}</strong><span className="muted mono"> {fmt(p.t)} × {fmt(p.w)}</span></span>
        </button>
      ) : (
        <button className="mini" onClick={() => setOpen(true)}>Choose profile…</button>
      )}
      {extra}
      {open && <ProfilePicker kind={kind} current={num} species={species} onPick={onChange} onClose={() => setOpen(false)} />}
    </div>
  );
}
