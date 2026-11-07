// Sloped ceilings in the Room tab: an attic closet's roof slope at one wall, or a hip ceiling on
// all four, each from the knee-wall height and the pitch you measure.
import { useStore } from '../store';
import type { WallId } from '../model/types';
import { wallNames } from '../model/layout';
import { slopeAngle, slopeRun, slopesOf, WALLS, type CeilingSlope } from '../model/ceiling';
import { fmt } from '../units';
import { Field, LengthInput, Section } from './fields';

export function CeilingSlopesSection() {
  const room = useStore((s) => s.project.room);
  const commit = useStore((s) => s.commit);
  const slopes = slopesOf(room);
  const put = (w: WallId, v: CeilingSlope | undefined) => commit((p) => {
    const next = { ...slopesOf(p.room) };
    if (v) next[w] = v; else delete next[w];
    return { ...p, room: { ...p.room, slopes: Object.keys(next).length ? next : undefined } };
  });
  const any = WALLS.some((w) => slopes[w]);
  const first = WALLS.map((w) => slopes[w]).find(Boolean) ?? { knee: 60, pitch: 8 };
  const hip = () => commit((p) => ({ ...p, room: { ...p.room, slopes: Object.fromEntries(WALLS.map((w) => [w, { ...first }])) } }));
  return (
    <Section title="Sloped ceiling" aside={<button className="mini" onClick={hip} title="Slope all four walls the same, up to the flat ceiling">Hip ceiling</button>}>
      <p className="hint">For attic closets and knee walls: tick each wall the roof slopes down to. Knee height is where the slope meets the wall; the pitch is the rise per 12" (measure 12" level out from the wall and up to the slope). It rises to the flat ceiling at the room’s height.</p>
      {WALLS.map((w) => {
        const s = slopes[w];
        return (
          <div key={w} style={{ marginBottom: 6 }}>
            <label className="check-inline"><input type="checkbox" checked={!!s} onChange={(e) => put(w, e.target.checked ? { ...first } : undefined)} /> {wallNames[w]} slopes</label>
            {s && (
              <div className="grid2">
                <Field label="Knee height" htmlFor={`sl-k-${w}`}><LengthInput id={`sl-k-${w}`} value={s.knee} onChange={(v) => put(w, { ...s, knee: Math.max(0, v ?? s.knee) })} /></Field>
                <Field label={'Pitch (rise per 12")'} htmlFor={`sl-p-${w}`}>
                  <input id={`sl-p-${w}`} inputMode="decimal" defaultValue={s.pitch} key={`${w}-${s.pitch}`} onBlur={(e) => { const n = parseFloat(e.target.value); if (Number.isFinite(n) && n > 0) put(w, { ...s, pitch: n }); }} />
                </Field>
                <p className="hint" style={{ gridColumn: '1 / -1' }}>{s.pitch}/12 ({slopeAngle(s).toFixed(1)}°): from {fmt(s.knee)} at the wall to the {fmt(room.height)} ceiling {fmt(slopeRun(room, s))} out.{slopeRun(room, s) > (w === 'back' || w === 'front' ? room.depth : room.width) ? ' It never reaches the flat ceiling in this room.' : ''}</p>
              </div>
            )}
          </div>
        );
      })}
      {any && <p className="hint">Cabinets that run into the slope are flagged with the height that fits. A cabinet on a sloped wall can have its top cut to the slope (its Size section).</p>}
    </Section>
  );
}
