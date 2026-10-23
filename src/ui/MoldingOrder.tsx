import { useMemo } from 'react';
import { useStore } from '../store';
import { moldLabel, moldingOrder, profileLabel, supplierName, type Supplier } from '../model/moldings';
import { fmt } from '../units';
import { ProfileThumb } from './ProfilePicker';
import { DoorGlyph } from './DoorPicker';
import { doorOrder } from '../model/doorOrder';

/** What to order from Anderson & McQuaid and Brosco, by profile, in lineal feet. */
export function MoldingOrder() {
  const project = useStore((s) => s.project);
  const lines = useMemo(() => moldingOrder(project), [project]);
  if (!lines.length) return null;
  return <>{(['am', 'brosco'] as Supplier[]).map((sup) => lines.some((l) => l.supplier === sup) && <SupplierOrder key={sup} sup={sup} lines={lines.filter((l) => l.supplier === sup)} />)}</>;
}

function SupplierOrder({ sup, lines }: { sup: Supplier; lines: ReturnType<typeof moldingOrder> }) {
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  const total = lines.reduce((t, l) => t + l.cost, 0);
  const tax = project.settings.purchaseTax;
  const setPrice = (num: string, v: number | null) => commit((p) => {
    const next = { ...p.moldPrices };
    if (v == null) delete next[num]; else next[num] = v;
    return { ...p, moldPrices: next };
  });
  return (
    <div className="pgroup" style={{ marginTop: 18 }}>
      <div className="pgroup-head">
        <span>{supplierName[sup]} mouldings</span>
        <span className="muted">{project.settings.moldSpecies}, +{Math.round(project.settings.moldWaste * 100)}% waste</span>
      </div>
      <table>
        <thead><tr><th /><th>Profile</th><th className="num">Lin ft</th><th className="num">$/ft</th><th className="num">Cost</th></tr></thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.num}>
              <td><ProfileThumb p={l.profile} size={30} /></td>
              <td>{profileLabel(l.profile)} <span className="muted mono">{fmt(l.profile.t)} × {fmt(l.profile.w)}</span><span className="note">{l.kinds.map((k) => moldLabel[k]).join(', ')}{sup === 'am' && l.species !== project.settings.moldSpecies ? `; not offered in ${project.settings.moldSpecies.toLowerCase()}, priced in ${l.species.toLowerCase()}` : ''}</span></td>
              <td className="num">{l.feet}</td>
              <td className="num">
                {sup === 'brosco'
                  ? <input className="price-in" aria-label={`${profileLabel(l.profile)} price per foot`} inputMode="decimal" placeholder="$/ft" defaultValue={project.moldPrices?.[l.num] ?? ''}
                      onBlur={(e) => { const v = parseFloat(e.target.value); setPrice(l.num, Number.isFinite(v) ? v : null); }} />
                  : l.price != null ? `$${l.price.toFixed(2)}` : '—'}
              </td>
              <td className="num">{l.price != null ? `$${l.cost.toFixed(2)}` : '—'}</td>
            </tr>
          ))}
          <tr><td /><td>Subtotal</td><td /><td /><td className="num">${total.toFixed(2)}</td></tr>
          {tax > 0 && <tr className="sum"><td /><td>With {+(tax * 100).toFixed(3)}% sales tax</td><td /><td /><td className="num">${(total * (1 + tax)).toFixed(2)}</td></tr>}
        </tbody>
      </table>
      <p className="hint">{sup === 'am'
        ? 'Prices from andersonmcquaid.com/price-list as of Oct 22, 2026. They change without notice.'
        : 'Brosco sells through dealers and doesn’t publish prices. Enter your price per foot for each profile; it’s saved with this job and used in the quote.'}</p>
    </div>
  );
}

/** Reeb interior doors: design, trade size, handing and the price entered for this job. */
export function DoorOrderList() {
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  const lines = useMemo(() => doorOrder(project), [project]);
  if (!lines.length) return null;
  const total = lines.reduce((t, l) => t + l.cost, 0);
  const setPrice = (key: string, v: number | null) => commit((p) => {
    const next = { ...p.doorPrices };
    if (v == null) delete next[key]; else next[key] = v;
    return { ...p, doorPrices: next };
  });
  return (
    <div className="pgroup" style={{ marginTop: 18 }}>
      <div className="pgroup-head"><span>Reeb interior doors</span><span className="muted">{lines.reduce((t, l) => t + l.qty, 0)} doors</span></div>
      <table>
        <thead><tr><th /><th>Door</th><th className="num">Qty</th><th className="num">$ each</th><th className="num">Cost</th></tr></thead>
        <tbody>
          {lines.map((l) => (
            <tr key={`${l.key}|${l.hinge}`}>
              <td><DoorGlyph d={l.design} size={34} /></td>
              <td>{l.key}<span className="note">{l.design.name}; {l.leaves > 1 ? 'pair' : `hinges ${l.hinge}`}; {l.openings.join(', ')}{l.fits ? '' : '; not a stock size'}</span></td>
              <td className="num">{l.qty}</td>
              <td className="num"><input className="price-in" aria-label={`${l.key} price`} inputMode="decimal" placeholder="$" defaultValue={project.doorPrices?.[l.key] ?? ''}
                onBlur={(e) => { const v = parseFloat(e.target.value); setPrice(l.key, Number.isFinite(v) ? v : null); }} /></td>
              <td className="num">{l.price != null ? `$${l.cost.toFixed(2)}` : '—'}</td>
            </tr>
          ))}
          <tr><td /><td>Subtotal</td><td /><td /><td className="num">${total.toFixed(2)}</td></tr>
        </tbody>
      </table>
      <p className="hint">Reeb’s price pages aren’t reachable from here yet; enter your price for each door and it’s saved with the job and used in the quote.</p>
    </div>
  );
}
