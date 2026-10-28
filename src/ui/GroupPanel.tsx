// Several cabinets picked at once (shift- or ⌘-click, or a whole wall): slide them together along
// their wall, move them to a new start point, or raise and lower them, keeping their spacing.
import { useState } from 'react';
import { picked, useStore } from '../store';
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
      <Section title="Pick">
        <div className="order-actions">
          {(['back', 'left', 'right', 'front'] as const).filter((w) => project.cabinets.some((c) => c.wall === w)).map((w) => (
            <button key={w} className="mini" onClick={() => selectWall(w)}>Everything on the {wallNames[w].toLowerCase()}</button>
          ))}
        </div>
      </Section>
    </div>
  );
}
