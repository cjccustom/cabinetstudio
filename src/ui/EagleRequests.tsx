import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { eagleRequests, requestText, requestTitle } from '../model/eagleRequest';
import { releaseStatus } from '../model/release';

/** The quote requests to enter on Eagle's website, laid out like Eagle's confirmation emails. */
export function EagleRequests() {
  const project = useStore((s) => s.project);
  const requests = useMemo(() => eagleRequests(project), [project]);
  const release = useMemo(() => releaseStatus(project), [project]);
  const [copied, setCopied] = useState<number | null>(null);
  if (!requests.length) return null;
  const copy = (i: number) => {
    navigator.clipboard.writeText(requestText(project.name, requests[i])).then(() => setCopied(i), () => setCopied(-1));
  };
  return (
    <div className="eagle-requests">
      <h4>Eagle quote requests</h4>
      <p className="hint">
        Enter each one on Eagle’s website as its own quote request.
        {!release.ready && ' Locked until the deposit is in and the measurements are checked.'}
      </p>
      {requests.map((r, i) => (
        <div key={i} className="pgroup eagle-request">
          <div className="pgroup-head">
            <span>{requestTitle[r.kind]}</span>
            <span className="muted">{r.lines.reduce((t, l) => t + Number(l[r.kind === 'boxes' ? 1 : 2]), 0)} pcs</span>
          </div>
          <dl className="eagle-config">
            {r.config.map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
          <div className="table-wrap">
            <table>
              <thead><tr>{r.columns.map((c) => <th key={c} className={c === 'Type' ? '' : 'num'}>{c}</th>)}</tr></thead>
              <tbody>
                {r.lines.map((l, j) => (
                  <tr key={j}>{l.map((v, k) => <td key={k} className={r.columns[k] === 'Type' ? '' : 'num'}>{v}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          {r.check.map((c) => <p key={c} className="warn">Check: {c}</p>)}
          <div className="order-actions">
            <button disabled={!release.ready} onClick={() => copy(i)}>Copy request</button>
            {copied === i && <span className="ok">Copied</span>}
            {copied === -1 && <span className="warn">Couldn’t reach the clipboard</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
