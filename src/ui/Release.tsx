import { useMemo } from 'react';
import { useStore } from '../store';
import { releaseOf, releaseStatus, type ReleaseState } from '../model/release';
import { fmt } from '../units';
import { Field, LengthInput } from './fields';

export function useRelease() {
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  const r = releaseOf(project);
  const status = useMemo(() => releaseStatus(project), [project]);
  const set = (patch: Partial<ReleaseState>) => commit((p) => ({ ...p, release: { ...releaseOf(p), ...patch } }));
  return { r, status, set };
}

const diff = (m: number, d: number) => `${m > d ? '+' : '−'}${fmt(Math.abs(m - d))}`;

/** Deposit and field check that have to be done before anything is ordered. */
export function ReleasePanel() {
  const { r, status, set } = useRelease();
  return (
    <div className={`release ${status.ready ? 'is-ready' : ''}`}>
      <div className="pgroup-head">
        <span>Ready to order?</span>
        <span className={status.ready ? 'ok' : 'warn'} style={{ margin: 0 }}>{status.ready ? 'Yes, cleared to order' : `Waiting on ${status.waiting.join(', ')}`}</span>
      </div>
      <div className="grid2">
        <Field label="Deposit received" htmlFor="rel-date">
          <input id="rel-date" type="date" value={r.depositDate} onChange={(e) => set({ depositDate: e.target.value })} />
        </Field>
        <Field label="Amount ($)" htmlFor="rel-amt">
          <input id="rel-amt" inputMode="decimal" value={r.depositAmount || ''} onChange={(e) => set({ depositAmount: parseFloat(e.target.value) || 0 })} />
        </Field>
      </div>
      {status.checks.length > 0 && (
        <>
          <p className="hint">Check these on site before ordering. Anything off by more than 1/8" is flagged. Fix the design, or mark it OK if it doesn’t change the order.</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Measure</th><th className="num">Design</th><th className="num">On site</th><th /></tr>
              </thead>
              <tbody>
                {status.checks.map((c) => (
                  <tr key={c.id} className={`check-${c.status}`}>
                    <td>{c.label}<div className="muted check-hint">{c.hint}</div></td>
                    <td className="num">{fmt(c.design)}</td>
                    <td className="num">
                      <LengthInput
                        id={`rel-${c.id}`}
                        value={c.measured ?? null}
                        allowAuto
                        placeholder="—"
                        onChange={(v) => {
                          const measured = { ...r.measured };
                          if (v == null) delete measured[c.id]; else measured[c.id] = v;
                          set({ measured, accepted: { ...r.accepted, [c.id]: false } });
                        }}
                      />
                    </td>
                    <td>
                      {c.status === 'ok' && <span className="ok" style={{ margin: 0 }}>✓</span>}
                      {(c.status === 'off' || c.status === 'accepted') && (
                        <label className="accept" title="The difference doesn’t change any order sizes">
                          <span className="warn" style={{ margin: 0 }}>{diff(c.measured!, c.design)}</span>{' '}
                          <input type="checkbox" checked={c.status === 'accepted'} onChange={(e) => set({ accepted: { ...r.accepted, [c.id]: e.target.checked } })} /> OK
                        </label>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
