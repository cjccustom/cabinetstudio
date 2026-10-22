import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { hardwareOrder, hardwareText } from '../model/hardware';
import { releaseStatus } from '../model/release';
import { wwePriceDate } from '../model/woodworkerExpress';

const money = (v: number) => `$${v.toFixed(2)}`;

/** Blum hardware to buy from Woodworker Express for the whole job. */
export function HardwareOrder() {
  const project = useStore((s) => s.project);
  const h = useMemo(() => hardwareOrder(project), [project]);
  const release = useMemo(() => releaseStatus(project), [project]);
  const [copied, setCopied] = useState('');
  if (!h.lines.length && !h.problems.length) return null;
  const copy = () => navigator.clipboard.writeText(hardwareText(project.name, h)).then(() => setCopied('Copied.'), () => setCopied('Couldn’t reach the clipboard.'));
  return (
    <div className="pgroup wwe-order">
      <div className="pgroup-head">
        <span>Woodworker Express</span>
        <span className="muted">{h.hinges} hinges · {h.drawers} drawers · about {money(h.cost)}</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Blum part</th><th>Item</th><th className="num">Qty</th><th className="num">Total</th></tr>
          </thead>
          <tbody>
            {h.lines.map((l) => (
              <tr key={l.part.sku} title={`For ${l.use}`}>
                <td><a href={l.part.url} target="_blank" rel="noreferrer">{l.part.part}</a><div className="muted check-hint">SKU {l.part.sku}</div></td>
                <td className="spec">{l.part.description}</td>
                <td className="num">{l.qty}</td>
                <td className="num">{money(l.total)}<div className="muted check-hint">{money(l.each)} ea</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {h.problems.map((x) => <p key={x.text} className="warn">{x.text}</p>)}
      <p className="hint">Woodworker Express prices from {wwePriceDate} (same as your account pricing), before tax and shipping, with their quantity breaks. Screws are under shop supplies on the Quote tab.</p>
      <div className="order-actions">
        <button disabled={!release.ready} onClick={copy}>Copy hardware order</button>
        {!release.ready && <span className="locked-note">Locked until the deposit is in and measurements are checked.</span>}
        {copied && <span className="ok">{copied}</span>}
      </div>
    </div>
  );
}
