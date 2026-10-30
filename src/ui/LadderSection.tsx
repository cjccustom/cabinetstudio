import { useStore } from '../store';
import { defaultLadder, ladderIssues, ladderOf, putnamRails, roomAboveRail, type RollingLadder } from '../model/ladder';
import { wallNames, wallOrder } from '../model/layout';
import type { WallId } from '../model/types';
import { fmt } from '../units';
import { Field, LengthInput, Section } from './fields';

const woods = ['Red oak', 'White oak', 'Quarter-sawn white oak', 'Maple', 'Cherry', 'Walnut', 'Mahogany', 'Ash', 'Alder', 'Hickory', 'Natural birch'];
const finishes: { v: RollingLadder['hardware']; label: string }[] = [
  { v: 'black', label: 'Black' }, { v: 'brass', label: 'Brass (polished, satin or antique)' },
  { v: 'nickel', label: 'Nickel or chrome' }, { v: 'bronze', label: 'Oil-rubbed bronze' },
];

/** The rolling library ladder: on or off, which wall's bookcases carry the rail, and its sizes. */
export function LadderSection() {
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  const L = ladderOf(project);
  const put = (patch: Partial<RollingLadder>) => commit((p) => ({ ...p, ladder: { ...p.ladder, ...patch } }));
  const len = (k: keyof RollingLadder, label: string, hint?: string) => (
    <Field label={label} htmlFor={`ld-${k}`} hint={hint}><LengthInput id={`ld-${k}`} value={L[k] as number} onChange={(v) => put({ [k]: v ?? (defaultLadder[k] as number) } as Partial<RollingLadder>)} /></Field>
  );
  const issues = ladderIssues(project);
  const preset = putnamRails.find((r) => Math.abs(r.rail - L.railHeight) < 0.01);
  return (
    <Section title="Rolling library ladder">
      <label className="check-inline"><input id="ld-on" type="checkbox" checked={L.on} onChange={(e) => put({ on: e.target.checked })} /> Rolling ladder on a rail ({L.model})</label>
      {L.on && (
        <>
          <div className="grid2" style={{ marginTop: 8 }}>
            <Field label="Rail on the" htmlFor="ld-wall">
              <select id="ld-wall" value={L.wall} onChange={(e) => put({ wall: e.target.value as WallId, railFrom: undefined, railTo: undefined, at: 0 })}>
                {wallOrder.map((w) => <option key={w} value={w}>{wallNames[w]}</option>)}
              </select>
            </Field>
            <Field label="Ladder" htmlFor="ld-size">
              <select id="ld-size" value={preset ? String(preset.rail) : 'custom'} onChange={(e) => e.target.value !== 'custom' && put({ railHeight: Number(e.target.value) })}>
                {putnamRails.map((r) => <option key={r.rail} value={r.rail}>{r.label}</option>)}
                <option value="custom">Custom rail height</option>
              </select>
            </Field>
            {len('railHeight', 'Rail height (floor to center)', preset?.range)}
            <Field label="Parked at (center from left)" htmlFor="ld-at"><LengthInput id="ld-at" value={L.at} onChange={(v) => put({ at: v ?? 0 })} /></Field>
            <Field label="Rail from" htmlFor="ld-from"><LengthInput id="ld-from" value={L.from} allowAuto placeholder="cabinets" onChange={(v) => put({ railFrom: v ?? undefined })} /></Field>
            <Field label="Rail to" htmlFor="ld-to"><LengthInput id="ld-to" value={L.to} allowAuto placeholder="cabinets" onChange={(v) => put({ railTo: v ?? undefined })} /></Field>
            <Field label="Wood" htmlFor="ld-wood">
              <select id="ld-wood" value={L.wood} onChange={(e) => put({ wood: e.target.value })}>{woods.map((w) => <option key={w}>{w}</option>)}</select>
            </Field>
            <Field label="Hardware" htmlFor="ld-hw">
              <select id="ld-hw" value={L.hardware} onChange={(e) => put({ hardware: e.target.value as RollingLadder['hardware'] })}>{finishes.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}</select>
            </Field>
          </div>
          <details className="overrides">
            <summary>Ladder and rail sizes</summary>
            <div className="grid3">
              {len('width', 'Width')}
              {len('stileDepth', 'Side rail depth')}
              {len('stileThick', 'Side rail thickness')}
              {len('stepDepth', 'Step depth')}
              <Field label="Steps" htmlFor="ld-steps"><input id="ld-steps" inputMode="numeric" value={L.steps ?? ''} placeholder={String(L.stepAt.length)} onChange={(e) => put({ steps: parseInt(e.target.value, 10) || undefined })} /></Field>
              <Field label="Lean (degrees)" htmlFor="ld-lean"><input id="ld-lean" inputMode="decimal" value={L.leanDeg} onChange={(e) => put({ leanDeg: Math.min(25, Math.max(5, Number(e.target.value) || 12)) })} /></Field>
              {len('railDia', 'Rail diameter')}
              {len('standoff', 'Rail off the cabinet face')}
              {len('topAbove', 'Ladder top above the rail')}
              {len('clearAbove', 'Recommended clear above')}
            </div>
          </details>
          <p className="hint">
            Ladder about {fmt(Math.round(L.length))} long, foot {fmt(Math.round((L.railZ + L.footOut) * 4) / 4)} out from the wall; rail {fmt(L.to - L.from)} long on {Math.max(2, Math.ceil((L.to - L.from - 6) / 36) + 1)} brackets (36" apart at most), its center {fmt(L.railZ)} off the wall.
            Putnam recommends {fmt(L.clearAbove)} from the rail’s center to the ceiling or crown and 3" to any upper cabinet doors, and brackets fastened to solid wood. Double-click the ladder in 3D to come back here.
          </p>
          {(() => { const a = roomAboveRail(project); return a.room >= L.topAbove && a.room < L.clearAbove ? <p className="hint">{fmt(Math.round(a.room * 16) / 16)} above the rail to the {a.under}: less than Putnam’s recommended {fmt(L.clearAbove)}, but the ladder’s top ({fmt(L.topAbove)} above the rail) fits.</p> : null; })()}
          {issues.length > 0 && <ul className="issues">{issues.map((i) => <li key={i.message}>{i.message}</li>)}</ul>}
        </>
      )}
    </Section>
  );
}
