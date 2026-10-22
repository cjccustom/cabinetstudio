import { useMemo } from 'react';
import { useStore } from '../store';
import { moldLabel, moldingOrder } from '../model/moldings';
import { fmt } from '../units';
import { ProfileThumb } from './ProfilePicker';

/** What to order from Anderson & McQuaid, by profile, in lineal feet. */
export function MoldingOrder() {
  const project = useStore((s) => s.project);
  const lines = useMemo(() => moldingOrder(project), [project]);
  if (!lines.length) return null;
  const total = lines.reduce((t, l) => t + l.cost, 0);
  return (
    <div className="pgroup" style={{ marginTop: 18 }}>
      <div className="pgroup-head">
        <span>Anderson &amp; McQuaid mouldings</span>
        <span className="muted">{project.settings.moldSpecies}, +{Math.round(project.settings.moldWaste * 100)}% waste</span>
      </div>
      <table>
        <thead><tr><th /><th>Profile</th><th className="num">Lin ft</th><th className="num">$/ft</th><th className="num">Cost</th></tr></thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.num}>
              <td><ProfileThumb p={l.profile} size={30} /></td>
              <td>A&amp;M {l.num} <span className="muted mono">{fmt(l.profile.t)} × {fmt(l.profile.w)}</span><span className="note">{l.kinds.map((k) => moldLabel[k]).join(', ')}{l.species !== project.settings.moldSpecies ? `; not offered in ${project.settings.moldSpecies.toLowerCase()}, priced in ${l.species.toLowerCase()}` : ''}</span></td>
              <td className="num">{l.feet}</td>
              <td className="num">{l.price != null ? `$${l.price.toFixed(2)}` : '—'}</td>
              <td className="num">{l.price != null ? `$${l.cost.toFixed(2)}` : '—'}</td>
            </tr>
          ))}
          <tr className="sum"><td /><td>Total</td><td /><td /><td className="num">${total.toFixed(2)}</td></tr>
        </tbody>
      </table>
      <p className="hint">Prices from andersonmcquaid.com/price-list as of Oct 22, 2026. They change without notice.</p>
    </div>
  );
}
