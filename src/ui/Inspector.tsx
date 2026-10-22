import { useStore } from '../store';
import type { Cabinet, EndMode, FaceRow, PanelChoice, PanelMode, WallId } from '../model/types';
import { layoutRows, panelOn } from '../model/parts';
import { gapBeside, resolveEnds, wallLength, wallNames, wallOrder } from '../model/layout';
import { panelLabel } from '../model/eagle';
import { uid } from '../model/defaults';
import { fmt } from '../units';
import { Field, LengthInput, Section } from './fields';
import { OrderList, PartsTable } from './PartsTable';

const kindLabel = { base: 'Base cabinet', wall: 'Wall cabinet', tall: 'Tall cabinet' };
const rowTypes: { v: FaceRow['type']; label: string }[] = [
  { v: 'drawer', label: 'Drawer' },
  { v: 'doors', label: 'Doors' },
  { v: 'falseFront', label: 'False front' },
  { v: 'open', label: 'Open' },
];

export function Inspector({ cab, issues }: { cab: Cabinet; issues: string[] }) {
  const update = useStore((s) => s.updateCabinet);
  const remove = useStore((s) => s.removeCabinet);
  const duplicate = useStore((s) => s.duplicateCabinet);
  const settings = useStore((s) => s.project.settings);
  const room = useStore((s) => s.project.room);
  const all = useStore((s) => s.project.cabinets);
  const ends = resolveEnds(room, all, cab);
  const sideInfo = (['left', 'right'] as const).map((side) => ({ side, panel: panelOn(cab, settings, side, ends[side]) }));
  const bareSides = sideInfo.filter((x) => ends[x.side] && x.panel === 'none').map((x) => x.side);
  const panels = sideInfo.filter((x) => x.panel !== 'none').map((x) => `${x.side} ${panelLabel[x.panel].toLowerCase()}`);
  const set = (patch: Partial<Cabinet>) => update(cab.id, patch);
  const setRow = (id: string, patch: Partial<FaceRow>) => set({ rows: cab.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const { rows: layout, leftover } = layoutRows(cab, settings);

  return (
    <div className="inspector">
      <div className="insp-head">
        <input
          id="cab-name"
          className="name-input"
          aria-label="Cabinet name"
          value={cab.name}
          onChange={(e) => set({ name: e.target.value })}
        />
        <span className="kind">{kindLabel[cab.kind]}</span>
      </div>
      {issues.length > 0 && (
        <ul className="issues">
          {issues.map((m) => <li key={m}>{m}</li>)}
        </ul>
      )}

      <Section title="Size">
        <div className="grid3">
          <Field label="Width" htmlFor="cab-w"><LengthInput id="cab-w" value={cab.width} min={6} onChange={(v) => set({ width: v! })} /></Field>
          <Field label="Height" htmlFor="cab-h"><LengthInput id="cab-h" value={cab.height} min={6} onChange={(v) => set({ height: v! })} /></Field>
          <Field label="Depth" htmlFor="cab-d"><LengthInput id="cab-d" value={cab.depth} min={4} onChange={(v) => set({ depth: v! })} /></Field>
        </div>
      </Section>

      <Section title="Placement">
        <div className="grid3">
          <Field label="Wall" htmlFor="cab-wall">
            <select id="cab-wall" value={cab.wall} onChange={(e) => set({ wall: e.target.value as WallId })}>
              {wallOrder.map((w) => <option key={w} value={w}>{wallNames[w].replace(' wall', '')}</option>)}
            </select>
          </Field>
          <Field label="From left" htmlFor="cab-off"><LengthInput id="cab-off" value={cab.offset} min={-1000} onChange={(v) => set({ offset: v! })} /></Field>
          <Field label="Off floor" htmlFor="cab-elev"><LengthInput id="cab-elev" value={cab.elevation} onChange={(v) => set({ elevation: v! })} /></Field>
        </div>
        <p className="hint">Drag the cabinet in the 3D, Plan or Elevation view to slide it along the wall. It snaps to neighbors and wall ends.</p>
      </Section>

      {(cab.blind || cab.corner) && <CornerSection cab={cab} set={set} />}
      {!cab.corner && (
      <>
      <Section
        title="Face frame openings"
        aside={
          <button className="mini" onClick={() => set({ rows: [...cab.rows, { id: uid('row'), type: 'doors', height: null, doors: 1, shelves: 1 }] })}>
            Add row
          </button>
        }
      >
        <p className="hint">Top to bottom. Leave height blank to split the remaining space.</p>
        <ol className="rows">
          {cab.rows.map((r, i) => (
            <li key={r.id} className="row-ed">
              <select id={`row-type-${r.id}`} aria-label="Opening type" value={r.type} onChange={(e) => setRow(r.id, { type: e.target.value as FaceRow['type'] })}>
                {rowTypes.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
              </select>
              <LengthInput id={`row-h-${r.id}`} value={r.height} allowAuto placeholder={`auto ${fmt(layout[i]?.height ?? 0)}`} onChange={(v) => setRow(r.id, { height: v })} />
              {r.type === 'doors' ? (
                <select id={`row-doors-${r.id}`} aria-label="Door count" value={r.doors} onChange={(e) => setRow(r.id, { doors: Number(e.target.value) as 1 | 2 })}>
                  <option value={1}>1 door</option>
                  <option value={2}>2 doors</option>
                </select>
              ) : <span />}
              {r.type === 'doors' || r.type === 'open' ? (
                <select id={`row-sh-${r.id}`} aria-label="Shelves" value={r.shelves} onChange={(e) => setRow(r.id, { shelves: Number(e.target.value) })}>
                  {[0, 1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} shelf{n === 1 ? '' : 'ves'}</option>)}
                </select>
              ) : <span />}
              <button
                className="icon-btn"
                aria-label="Remove row"
                title="Remove row"
                disabled={cab.rows.length <= 1}
                onClick={() => set({ rows: cab.rows.filter((x) => x.id !== r.id) })}
              >×</button>
            </li>
          ))}
        </ol>
        {leftover < -0.01 && <p className="warn">Openings are {fmt(-leftover)} taller than the face frame allows.</p>}
        {leftover > 0.01 && <p className="warn">{fmt(leftover)} of face frame is unused. Make one row auto.</p>}
        <div className="checks">
          <label><input id="cab-cstile" type="checkbox" checked={cab.centerStile} onChange={(e) => set({ centerStile: e.target.checked })} /> Center stile between pairs of doors</label>
          {cab.kind === 'wall' && (
            <label><input id="cab-flush" type="checkbox" checked={!!cab.bottomFlush} onChange={(e) => set({ bottomFlush: e.target.checked })} /> Box bottom flush with bottom of face frame (for cabinets hung high)</label>
          )}
          {cab.kind === 'base' && (
            <label><input id="cab-counter" type="checkbox" checked={cab.countertop} onChange={(e) => set({ countertop: e.target.checked })} /> Show countertop</label>
          )}
        </div>
      </Section>

      </>
      )}
      <Section title="Ends, panels & scribes">
        <div className="ends">
          {(['left', 'right'] as const).map((side) => {
            const endKey = side === 'left' ? 'leftEnd' : 'rightEnd';
            const panelKey = side === 'left' ? 'leftPanel' : 'rightPanel';
            const scribeKey = side === 'left' ? 'scribeLeft' : 'scribeRight';
            const mode = cab[endKey] ?? 'auto';
            const gap = gapBeside(room, all, cab, side, settings);
            const scribe = cab[scribeKey] ?? 0;
            const closeGap = () => {
              if (gap == null) return;
              set({ [scribeKey]: scribe + gap, width: cab.width + gap, ...(side === 'left' ? { offset: cab.offset - gap } : {}) });
            };
            return (
              <div key={side} className="end-col">
                <Field label={side === 'left' ? 'Left end' : 'Right end'} htmlFor={`cab-${endKey}`}>
                  <select id={`cab-${endKey}`} value={mode} onChange={(e) => set({ [endKey]: e.target.value as EndMode })}>
                    <option value="auto">Auto ({ends[side] ? 'exposed' : 'hidden'})</option>
                    <option value="exposed">Exposed</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </Field>
                {ends[side] && !cab.corner && (
                  <Field label="End panel" htmlFor={`cab-${panelKey}`}>
                    <select id={`cab-${panelKey}`} value={cab[panelKey] ?? 'default'} onChange={(e) => set({ [panelKey]: e.target.value as PanelChoice })}>
                      <option value="default">Job standard ({panelLabel[settings.endPanel]})</option>
                      {(Object.keys(panelLabel) as PanelMode[]).map((m) => <option key={m} value={m}>{panelLabel[m]}</option>)}
                    </select>
                  </Field>
                )}
                {!cab.corner && <Field label="Stile extension" htmlFor={`cab-${scribeKey}`}>
                  <LengthInput id={`cab-${scribeKey}`} value={scribe} onChange={(v) => {
                    const d = v! - scribe;
                    set({ [scribeKey]: v!, width: cab.width + d, ...(side === 'left' ? { offset: cab.offset - d } : {}) });
                  }} />
                </Field>}
                {gap != null && !cab.corner && (
                  <button className="mini" onClick={closeGap}>Extend stile to close {fmt(gap)} gap</button>
                )}
              </div>
            );
          })}
        </div>
        <p className="hint">Extending a stile widens the face frame to fill a gap. The case keeps its size, and the cut list adds {fmt(settings.scribeAllowance)} to scribe on site.</p>
        <ul className="assembly">
          <li>Face frame: glue and pocket screws.</li>
          <li>Case: glue, then {bareSides.length ? `pocket screws on the exposed ${bareSides.join(' and ')} side${bareSides.length > 1 ? 's' : ''}${bareSides.length < 2 ? ', staples elsewhere' : ''}` : 'staples'}.</li>
          {panels.length > 0 && <li>End panel{panels.length > 1 ? 's' : ''}: {panels.join('; ')}.</li>}
        </ul>
      </Section>

      <Section title="Cut parts">
        <PartsTable cabinets={[cab]} compact />
      </Section>

      <Section title="Order from Eagle">
        <OrderList cabinets={[cab]} compact />
      </Section>

      <div className="insp-actions">
        <button onClick={() => duplicate(cab.id)}>Duplicate</button>
        <button className="danger" onClick={() => remove(cab.id)}>Delete</button>
      </div>
    </div>
  );
}

function CornerSection({ cab, set }: { cab: Cabinet; set: (p: Partial<Cabinet>) => void }) {
  const room = useStore((s) => s.project.room);
  const len = wallLength(room, cab.wall);
  // Switching corners moves the cabinet to the other end of the wall
  const flip = (side: 'left' | 'right') => {
    if (cab.blind) set({ blind: { ...cab.blind, side }, offset: side === 'left' ? 0 : len - cab.width });
    if (cab.corner) set({ corner: { ...cab.corner, side }, offset: side === 'left' ? 0 : len - cab.width });
  };
  const side = cab.blind?.side ?? cab.corner!.side;
  return (
    <Section title={cab.corner ? 'Corner cabinet' : 'Blind corner'}>
      <div className="grid3">
        <Field label="Corner" htmlFor="cab-cside">
          <select id="cab-cside" value={side} onChange={(e) => flip(e.target.value as 'left' | 'right')}>
            <option value="left">Left end</option>
            <option value="right">Right end</option>
          </select>
        </Field>
        {cab.blind && (
          <Field label="Blind width" htmlFor="cab-bw" hint="Corner end to door opening">
            <LengthInput id="cab-bw" value={cab.blind.width} min={6} onChange={(v) => set({ blind: { ...cab.blind!, width: v! } })} />
          </Field>
        )}
        {cab.corner && (
          <Field label="Along other wall" htmlFor="cab-w2">
            <LengthInput id="cab-w2" value={cab.corner.width2} min={cab.depth + 6} onChange={(v) => set({ corner: { ...cab.corner!, width2: v! } })} />
          </Field>
        )}
        {cab.corner && !cab.corner.lazySusan && (
          <Field label="Shelves" htmlFor="cab-csh">
            <select id="cab-csh" value={cab.rows[0]?.shelves ?? 0} onChange={(e) => set({ rows: cab.rows.map((r, i) => (i === 0 ? { ...r, shelves: Number(e.target.value) } : r)) })}>
              {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
        )}
      </div>
      {cab.corner && cab.kind === 'base' && (
        <div className="checks">
          <label><input id="cab-susan" type="checkbox" checked={cab.corner.lazySusan} onChange={(e) => set({ corner: { ...cab.corner!, lazySusan: e.target.checked } })} /> Lazy susan (no shelves)</label>
        </div>
      )}
      <p className="hint">
        {cab.blind
          ? 'The cabinet on the other wall sits in front of the blind area. Set the blind width to that cabinet’s depth plus the blind stile, so its doors and pulls clear.'
          : 'An L-shaped case with a face frame on each wall and a bifold pair of doors. Bottom, top and shelves are cut as rectangles with the front corner notched out.'}
      </p>
    </Section>
  );
}
