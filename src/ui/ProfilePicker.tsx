import { useMemo, useState } from 'react';
import { catalog, moldCategories, moldLabel, mountShape, priceOf, profileByNum, profileLabel, supplierName, supplierOf, type MoldKind, type Profile, type Supplier } from '../model/moldings';
import { fmt } from '../units';

/** A small drawing of a profile as it appears in the supplier's catalog. */
export function ProfileThumb({ p, size = 64 }: { p: Profile; size?: number }) {
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

export function ProfilePicker({ kind, current, species, onPick, onClose, maxHeight }: {
  kind: MoldKind; current?: string; species: string; onPick: (num: string | undefined) => void; onClose: () => void;
  /** Profiles taller than this as installed are marked and listed last (coffer crown: half the fascia). */
  maxHeight?: number;
}) {
  const [sup, setSup] = useState<Supplier | 'all'>(() => (current && profileByNum(current) ? supplierOf(profileByNum(current)!) : 'all'));
  const pool = useMemo(() => catalog.filter((p) => sup === 'all' || supplierOf(p) === sup), [sup]);
  const cats = useMemo(() => [...new Set(pool.map((p) => p.category))].sort(), [pool]);
  const [cat, setCat] = useState<string>(moldCategories[kind][0]);
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const tooTall = (p: Profile) => maxHeight != null && mountShape(p).height > maxHeight + 0.01;
  const list = pool.filter((p) => (needle ? [p.code ?? p.num, p.wm ?? '', p.name ?? ''].some((v) => v.toLowerCase().includes(needle)) : p.category === cat))
    .sort((a, b) => Number(tooTall(a)) - Number(tooTall(b)));
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal wide" role="dialog" aria-modal="true" aria-labelledby="pp-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="pp-title">{moldLabel[kind]} profiles</h2>
        <div className="pp-bar">
          <div className="seg" role="group" aria-label="Supplier">
            {(['all', 'am', 'brosco'] as const).map((k) => (
              <button key={k} className={sup === k ? 'on' : ''} aria-pressed={sup === k} onClick={() => setSup(k)}>{k === 'all' ? 'Both' : supplierName[k]}</button>
            ))}
          </div>
          <select id="pp-cat" aria-label="Category" value={cat} onChange={(e) => { setCat(e.target.value); setQ(''); }}>
            <optgroup label={`Suggested for ${moldLabel[kind].toLowerCase()}`}>
              {moldCategories[kind].map((c) => <option key={c} value={c}>{c}</option>)}
            </optgroup>
            <optgroup label="All categories">
              {cats.filter((c) => !moldCategories[kind].includes(c)).map((c) => <option key={c} value={c}>{c}</option>)}
            </optgroup>
          </select>
          <input id="pp-q" placeholder="Number, WM number or name" value={q} onChange={(e) => setQ(e.target.value)} />
          {maxHeight != null && <span className="muted">Fits: up to {fmt(maxHeight)} tall installed; taller ones are listed last.</span>}
          <span className="muted">A&amp;M prices per lineal foot in {species.toLowerCase()}; Brosco is priced per job on the Orders tab.</span>
        </div>
        <div className="pp-grid">
          {list.map((p) => {
            const pr = priceOf(p, species);
            return (
              <button key={p.num} className={`pp-item${p.num === current ? ' on' : ''}${tooTall(p) ? ' too-tall' : ''}`} onClick={() => { onPick(p.num); onClose(); }}>
                <ProfileThumb p={p} />
                <span className="pp-num">{profileLabel(p)}</span>
                <span className="muted mono">{fmt(p.t)} × {fmt(p.w)}</span>
                {(p.name || p.wm) && <span className="muted">{[p.name, p.wm].filter(Boolean).join(' · ')}</span>}
                {tooTall(p) && <span className="warn-text">{fmt(mountShape(p).height)} tall: too big</span>}
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
export function MoldSlot({ kind, num, species, onChange, extra, label, maxHeight }: { kind: MoldKind; num?: string; species: string; onChange: (n: string | undefined) => void; extra?: React.ReactNode; label?: string; maxHeight?: number }) {
  const [open, setOpen] = useState(false);
  const p = profileByNum(num);
  return (
    <div className="mold-slot">
      <span className="mold-kind">{label ?? moldLabel[kind]}</span>
      {p ? (
        <button className="mold-pick" onClick={() => setOpen(true)}>
          <ProfileThumb p={p} size={36} />
          <span><strong>{profileLabel(p)}</strong><span className="muted mono"> {fmt(p.t)} × {fmt(p.w)}</span></span>
        </button>
      ) : (
        <button className="mini" onClick={() => setOpen(true)}>Choose profile…</button>
      )}
      {extra}
      {open && <ProfilePicker kind={kind} current={num} species={species} maxHeight={maxHeight} onPick={onChange} onClose={() => setOpen(false)} />}
    </div>
  );
}
