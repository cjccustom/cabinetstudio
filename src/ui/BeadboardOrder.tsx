import { useStore } from '../store';
import { panelOrder } from '../model/panels';

/** What to order from the beadboard supplier, combined across every panel in the job. */
export function BeadboardOrder() {
  const panels = useStore((s) => s.project.panels ?? []);
  if (!panels.length) return null;
  const lines = panels.map(panelOrder);
  const totals = new Map<string, number>();
  for (const l of lines) totals.set(l.item, (totals.get(l.item) ?? 0) + l.qty);
  return (
    <div className="pgroup" style={{ marginTop: 18 }}>
      <div className="pgroup-head"><span>Nantucket Beadboard</span><span className="muted">{panels.length} area{panels.length > 1 ? 's' : ''}</span></div>
      <table>
        <thead><tr><th className="num">Qty</th><th>Item</th></tr></thead>
        <tbody>
          {[...totals].map(([item, qty]) => <tr key={item}><td className="num">{qty}</td><td>{item}</td></tr>)}
        </tbody>
      </table>
      <ul className="assembly" style={{ marginTop: 6 }}>
        {lines.map((l) => <li key={l.panel.id}><span className="muted">{l.panel.name}:</span> {l.detail}</li>)}
      </ul>
    </div>
  );
}
