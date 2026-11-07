import { useMemo } from 'react';
import { useStore } from '../store';
import { moldLabel, moldingOrder, nextDayChoices, nextDayFor, profileLabel, supplierName, type Supplier } from '../model/moldings';
import { fmt } from '../units';
import { ProfileThumb } from './ProfilePicker';
import { DoorGlyph } from './DoorPicker';
import { doorOrder } from '../model/doorOrder';

/** What to order from Anderson & McQuaid and Brosco, by profile, in lineal feet. */
export function MoldingOrder() {
  const project = useStore((s) => s.project);
  const lines = useMemo(() => moldingOrder(project), [project]);
  if (!lines.length) return null;
  return <>{(['am', 'nextday', 'brosco', 'custom'] as Supplier[]).map((sup) => lines.some((l) => l.supplier === sup) && <SupplierOrder key={sup} sup={sup} lines={lines.filter((l) => l.supplier === sup)} />)}</>;
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
  const setSource = (num: string, nd: string | undefined) => commit((p) => {
    const next = { ...p.moldSource };
    if (nd == null) delete next[num]; else next[num] = nd;
    return { ...p, moldSource: Object.keys(next).length ? next : undefined };
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
              <td>{profileLabel(l.profile)} <span className="muted mono">{fmt(l.profile.t)} × {fmt(l.profile.w)}</span><span className="note">{l.kinds.map((k) => moldLabel[k]).join(', ')}{l.profile.custom ? `; ${l.profile.name?.toLowerCase()}` : ''}{sup === 'am' && l.species !== project.settings.moldSpecies ? `; not offered in ${project.settings.moldSpecies.toLowerCase()}, priced in ${l.species.toLowerCase()}` : ''}</span>
                {sup === 'brosco' && (() => {
                  const auto = nextDayFor({}, l.profile);
                  const cur = project.moldSource?.[l.num];
                  return (
                    <label className="note" style={{ display: 'block' }}>Bought at Next Day as{' '}
                      <select aria-label={`Next Day item for ${profileLabel(l.profile)}`} value={cur ?? 'auto'} onChange={(e) => setSource(l.num, e.target.value === 'auto' ? undefined : e.target.value)}>
                        <option value="auto">{auto ? `${auto.code} (lists ${profileLabel(l.profile)})` : 'not listed: pick one or enter a price'}</option>
                        <option value="">None: my own price</option>
                        {nextDayChoices(l.profile).slice(0, 12).filter((n) => n.num !== auto?.num).map((n) => <option key={n.num} value={n.num}>{n.code} {n.name}, {fmt(n.t)} × {fmt(n.w)}</option>)}
                      </select>
                      {l.via && !project.moldPrices?.[l.num] && <> · Next Day {(l.via as { code?: string }).code}, ${l.price?.toFixed(2) ?? '—'}/ft</>}
                    </label>
                  );
                })()}
              </td>
              <td className="num">{l.feet}</td>
              <td className="num">
                {sup !== 'am' && sup !== 'nextday' && !(l.via && project.moldPrices?.[l.num] == null)
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
        : sup === 'nextday'
          ? 'Next Day Moulding’s online prices, per foot (pieces sold by length worked back to $/ft), as collected Nov 1, 2026. Check the page before ordering.'
        : sup === 'brosco'
          ? 'Brosco sells through dealers and doesn’t publish prices. Where Next Day sells the profile (it lists the Brosco number, or you pick the Next Day item it’s bought as), Next Day’s price is used; otherwise enter your price per foot. Saved with this job and used in the quote.'
          : 'Milled to match the existing trim. Enter the supplier’s price per foot, or your stock cost for the ones you mill; it’s saved with this job and used in the quote.'}</p>
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
              <td className="num"><input className="price-in" aria-label={`${l.key} price`} inputMode="decimal" placeholder={l.priceFrom === 'catalog' ? l.price!.toFixed(0) : '$'} defaultValue={project.doorPrices?.[l.key] ?? ''}
                onBlur={(e) => { const v = parseFloat(e.target.value); setPrice(l.key, Number.isFinite(v) ? v : null); }} />
                {l.priceFrom === 'catalog' && <div className="muted check-hint">Reeb catalog</div>}</td>
              <td className="num">{l.price != null ? `$${l.cost.toFixed(2)}` : '—'}</td>
            </tr>
          ))}
          <tr><td /><td>Subtotal</td><td /><td /><td className="num">${total.toFixed(2)}</td></tr>
        </tbody>
      </table>
      <label className="field" htmlFor="door-adj" style={{ marginTop: 8 }}>
        <span>Reeb catalog prices up or down (%)</span>
        <input id="door-adj" inputMode="decimal" defaultValue={project.doorAdjust ? +(project.doorAdjust * 100).toFixed(2) : ''} placeholder="0"
          onBlur={(e) => { const v = parseFloat(e.target.value); commit((p) => ({ ...p, doorAdjust: Number.isFinite(v) ? v / 100 : undefined })); }} />
      </label>
      <p className="hint">Single doors are priced from Reeb’s interior price catalog (effective 8/10/26, 1-3/8" doors; door only or prehung single unit), adjusted by the percentage above for your dealer. Type a price to override it for this job. Pairs and sizes the catalog doesn’t list need a price entered.</p>
    </div>
  );
}
