// Several cabinets picked at once (shift- or ⌘-click, or a whole wall): slide them together along
// their wall, move them to a new start point, or raise and lower them, keeping their spacing.
import { useState } from 'react';
import { picked, takesCrown, useStore } from '../store';
import type { Cabinet, CabinetBase } from '../model/types';
import { MoldSlot } from './ProfilePicker';
import { CabinetFinishSection } from './CabinetFinish';
import { takesLightRail } from '../model/moldings';
import { baseOf, baseStyles, floorStanding } from '../model/cabinetBase';
import { wallNames, wallLength } from '../model/layout';
import { fmt } from '../units';
import { Field, LengthInput, Section } from './fields';

export function GroupPanel() {
  const project = useStore((s) => s.project);
  const selectedId = useStore((s) => s.selectedId);
  const group = useStore((s) => s.group);
  const select = useStore((s) => s.select);
  const selectWall = useStore((s) => s.selectWall);
  const moveGroup = useStore((s) => s.moveGroup);
  const ids = picked({ selectedId, group });
  const cabs = project.cabinets.filter((c) => ids.includes(c.id));
  const [step, setStep] = useState(1);
  const [up, setUp] = useState(0);
  const walls = [...new Set(cabs.map((c) => c.wall))];
  const one = walls.length === 1 ? walls[0] : null;
  const start = Math.min(...cabs.map((c) => c.offset));
  const end = Math.max(...cabs.map((c) => c.offset + c.width));
  const len = one ? wallLength(project.room, one) : 0;
  return (
    <div className="inspector">
      <div className="insp-head">
        <strong>{cabs.length} cabinets picked</strong>
        <button className="mini" onClick={() => select(null)}>Clear</button>
      </div>
      <p className="hint">{cabs.map((c) => c.name).join(', ')}{one ? ` · ${wallNames[one].toLowerCase()}, ${fmt(start)} to ${fmt(end)} from the left` : ''}. Shift- or ⌘-click a cabinet to add or drop it. Drag any of them, or use the arrow keys (shift for 1"), to move them all.</p>
      <CabinetFinishSection cabs={cabs.filter((c) => c.kind !== 'pilaster' && c.kind !== 'mantel' && c.kind !== 'shelf')} />
      <Section title="Move together">
        <div className="grid3">
          <Field label="Step" htmlFor="grp-step"><LengthInput id="grp-step" value={step} min={0.0625} onChange={(v) => setStep(v ?? 1)} /></Field>
          <button className="mini" style={{ alignSelf: 'end' }} onClick={() => moveGroup(-step)}>← Left {fmt(step)}</button>
          <button className="mini" style={{ alignSelf: 'end' }} onClick={() => moveGroup(step)}>Right {fmt(step)} →</button>
        </div>
        {one && (
          <div className="grid3">
            <Field label="Run starts at" htmlFor="grp-start"><LengthInput id="grp-start" value={start} min={-1000} onChange={(v) => v != null && moveGroup(v - start)} /></Field>
            <button className="mini" style={{ alignSelf: 'end' }} onClick={() => moveGroup(-start)}>To the left end</button>
            <button className="mini" style={{ alignSelf: 'end' }} onClick={() => moveGroup(len - end)}>To the right end</button>
          </div>
        )}
        <div className="grid3">
          <Field label="Up / down" htmlFor="grp-up"><LengthInput id="grp-up" value={up} min={-200} onChange={(v) => setUp(v ?? 0)} /></Field>
          <button className="mini" style={{ alignSelf: 'end' }} disabled={!up} onClick={() => moveGroup(0, up)}>Raise {fmt(Math.abs(up))}</button>
          <button className="mini" style={{ alignSelf: 'end' }} disabled={!up} onClick={() => moveGroup(0, -up)}>Lower {fmt(Math.abs(up))}</button>
        </div>
      </Section>
      <GroupCrown cabs={cabs} />
      <GroupLightRail cabs={cabs} />
      <GroupBase cabs={cabs} />
      <Section title="Pick">
        <div className="order-actions">
          <button className="mini" onClick={() => useStore.getState().selectCeiling()}>Everything that reaches the ceiling</button>
          <button className="mini" onClick={() => { const ids = project.cabinets.filter(floorStanding).map((c) => c.id); if (ids.length) useStore.setState({ selectedId: ids[0], group: ids }); }}>Every floor cabinet (for the base)</button>
          <button className="mini" onClick={() => { const ids = project.cabinets.filter(takesLightRail).map((c) => c.id); if (ids.length) useStore.setState({ selectedId: ids[0], group: ids }); }}>Every upper (for a light rail)</button>
          {(['back', 'left', 'right', 'front'] as const).filter((w) => project.cabinets.some((c) => c.wall === w)).map((w) => (
            <button key={w} className="mini" onClick={() => selectWall(w)}>Everything on the {wallNames[w].toLowerCase()}</button>
          ))}
        </div>
      </Section>
    </div>
  );
}

/** One light rail under every upper picked. */
function GroupLightRail({ cabs }: { cabs: Cabinet[] }) {
  const species = useStore((s) => s.project.settings.moldSpecies);
  const commit = useStore((s) => s.commit);
  const takers = cabs.filter(takesLightRail);
  if (!takers.length) return null;
  const nums = [...new Set(takers.map((c) => c.lightRail ?? ''))];
  const current = nums.length === 1 && nums[0] ? nums[0] : undefined;
  return (
    <Section title="Light rail on all of them">
      <MoldSlot kind="lightRail" label={nums.length > 1 ? 'Light rail (mixed now)' : 'Light rail'} num={current} species={species}
        onChange={(n) => commit((p) => ({ ...p, cabinets: p.cabinets.map((c) => (takers.some((t) => t.id === c.id) ? { ...c, lightRail: n } : c)) }))} />
      <p className="hint">Under {takers.length} upper{takers.length === 1 ? '' : 's'}, on the face frame, returning around exposed ends. Back bands work well; they're listed first.</p>
    </Section>
  );
}

/** One base for every floor cabinet picked: the toe kick, a baseboard wrapped around them, or a decorative skirt. */
function GroupBase({ cabs }: { cabs: Cabinet[] }) {
  const species = useStore((s) => s.project.settings.moldSpecies);
  const commit = useStore((s) => s.commit);
  const floor = cabs.filter(floorStanding);
  if (!floor.length) return null;
  const styles = [...new Set(floor.map((c) => baseOf(c).style))];
  const caps = [...new Set(floor.map((c) => c.baseMold ?? ''))];
  const h = baseOf(floor[0]).height;
  const put = (fn: (c: Cabinet) => Partial<Cabinet>) => commit((p) => ({ ...p, cabinets: p.cabinets.map((c) => (floor.some((t) => t.id === c.id) ? { ...c, ...fn(c) } : c)) }));
  return (
    <Section title="Base on all of them">
      <div className="grid3">
        <Field label="Base" htmlFor="grp-base">
          <select id="grp-base" value={styles.length === 1 ? styles[0] : ''} onChange={(e) => e.target.value && put((c) => ({ base: { ...baseOf(c), style: e.target.value as CabinetBase['style'] } }))}>
            {styles.length > 1 && <option value="">Mixed now</option>}
            {Object.entries(baseStyles).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        {styles.length === 1 && styles[0] !== 'kick' && (
          <Field label="Board height" htmlFor="grp-bh"><LengthInput id="grp-bh" value={h} onChange={(v) => put((c) => ({ base: { ...baseOf(c), height: v ?? 4.5 } }))} /></Field>
        )}
      </div>
      {styles.length === 1 && styles[0] !== 'kick' && (
        <MoldSlot kind="baseMold" label={caps.length > 1 ? 'Base cap (mixed now)' : 'Base cap'} num={caps.length === 1 && caps[0] ? caps[0] : undefined} species={species}
          onChange={(n) => put(() => ({ baseMold: n }))} />
      )}
      <p className="hint">{floor.length} floor cabinet{floor.length === 1 ? '' : 's'}. A baseboard wrap runs across their fronts as one board and wraps exposed ends back to the wall, furniture style; the toe kick goes away and the cabinets keep their height.</p>
    </Section>
  );
}

/** One crown for everything picked; each cabinet gets shorter where the crown would hit the ceiling. */
function GroupCrown({ cabs }: { cabs: Cabinet[] }) {
  const settings = useStore((s) => s.project.settings);
  const crownGroup = useStore((s) => s.crownGroup);
  const [cut, setCut] = useState<number | null>(null);
  const takers = cabs.filter(takesCrown);
  if (!takers.length) return null;
  const nums = [...new Set(takers.map((c) => c.crown ?? ''))];
  const current = nums.length === 1 && nums[0] ? nums[0] : undefined;
  return (
    <Section title="Crown on all of them">
      <MoldSlot kind="crown" label={nums.length > 1 ? 'Crown (mixed now)' : 'Crown'} num={current} species={settings.moldSpecies} onChange={(n) => setCut(crownGroup(n))} />
      <p className="hint">
        {takers.length} cabinet{takers.length > 1 ? 's' : ''} take crown{cabs.length > takers.length ? ` (${cabs.length - takers.length} base or other left alone)` : ''}. Any that would push the crown into the ceiling get shorter so it meets the ceiling; Undo puts them back.
        {cut != null && ` ${cut ? `Shortened ${cut}.` : 'All fit as they were.'}`}
      </p>
    </Section>
  );
}
