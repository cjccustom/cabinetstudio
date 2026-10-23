import { useStore } from '../store';
import type { Cabinet, CrownBuild, EndMode, FaceRow, PanelChoice, PanelMode, WallId } from '../model/types';
import { buildParts, crownLayout, layoutRows, noCrownBuild, panelOn } from '../model/parts';
import { gapBeside, resolveEnds, wallLength, wallNames, wallOrder } from '../model/layout';
import { panelLabel } from '../model/eagle';
import { uid } from '../model/defaults';
import { fmt } from '../units';
import { Field, LengthInput, Section } from './fields';
import { OrderList, PartsTable } from './PartsTable';
import { OverridesSection } from './Overrides';
import { MoldSlot } from './ProfilePicker';

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

        </div>
      </Section>

      </>
      )}
      {cab.kind === 'base' && !cab.corner && (
        <Section title="Top">
          <div className="grid3">
            <Field label="Top" htmlFor="cab-topkind">
              <select id="cab-topkind" value={cab.countertop ? cab.topKind ?? 'stone' : 'none'} onChange={(e) => {
                const v = e.target.value;
                set(v === 'none' ? { countertop: false } : { countertop: true, topKind: v as 'stone' | 'wood' });
              }}>
                <option value="stone">Stone / by others</option>
                <option value="wood">Solid wood (shop built)</option>
                <option value="none">None</option>
              </select>
            </Field>
            {cab.countertop && (
              <Field label="Thickness" htmlFor="cab-topt">
                <LengthInput id="cab-topt" value={cab.topThickness ?? null} allowAuto placeholder={fmt(cab.topKind === 'wood' ? 1.25 : settings.counterThickness)} onChange={(v) => set({ topThickness: v ?? undefined })} />
              </Field>
            )}
            {cab.countertop && (
              <Field label="Front overhang" htmlFor="cab-topf" hint="Past door face">
                <LengthInput id="cab-topf" value={cab.topFront ?? null} allowAuto placeholder={fmt(settings.counterOverhang)} onChange={(v) => set({ topFront: v ?? undefined })} />
              </Field>
            )}
            {cab.countertop && (
              <Field label="Left overhang" htmlFor="cab-topl">
                <LengthInput id="cab-topl" value={cab.topLeft ?? null} allowAuto placeholder="0&quot;" onChange={(v) => set({ topLeft: v ?? undefined })} />
              </Field>
            )}
            {cab.countertop && (
              <Field label="Right overhang" htmlFor="cab-topr">
                <LengthInput id="cab-topr" value={cab.topRight ?? null} allowAuto placeholder="0&quot;" onChange={(v) => set({ topRight: v ?? undefined })} />
              </Field>
            )}
          </div>
          {cab.topKind === 'wood' && cab.countertop && <p className="hint">Solid wood tops and bench seats go on the Solid wood list with board feet to buy.</p>}
        </Section>
      )}

      <Section title="Mouldings (Anderson & McQuaid)">
        {(['crown', 'lightRail', 'baseMold'] as const)
          .filter((k) => (k === 'crown' ? cab.kind !== 'base' : k === 'lightRail' ? cab.kind === 'wall' : cab.kind !== 'wall'))
          .map((k) => (
            <MoldSlot
              key={k}
              kind={k}
              num={cab[k]}
              species={settings.moldSpecies}
              onChange={(n) => set({ [k]: n })}
              extra={cab[k] && (
                <button className="mini" title={`Use on every ${cab.kind} cabinet on this wall`} onClick={() =>
                  useStore.getState().commit((p) => ({ ...p, cabinets: p.cabinets.map((c) => (c.wall === cab.wall && c.kind === cab.kind ? { ...c, [k]: cab[k], ...(k === 'crown' ? { crownBuild: cab.crownBuild } : {}) } : c)) }))
                }>Whole wall</button>
              )}
            />
          ))}
        {cab.kind !== 'base' && <CrownBuildEditor cab={cab} set={set} species={settings.moldSpecies} />}
        <p className="hint">Runs across the face and returns to the wall on exposed ends. Lineal footage and cost are on the Orders tab.</p>
      </Section>

      <OverridesSection cab={cab} settings={settings} set={set} />

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
          <Field label="Covered by neighbor" htmlFor="cab-bdead" hint="Its depth">
            <LengthInput id="cab-bdead" value={cab.blind.dead} min={0} onChange={(v) => set({ blind: { ...cab.blind!, dead: v! } })} />
          </Field>
        )}
        {cab.blind && (
          <Field label="Stile clearance" htmlFor="cab-bclr" hint="Past the 1 1/2&quot; stile">
            <LengthInput id="cab-bclr" value={cab.blind.clearance} min={0} onChange={(v) => set({ blind: { ...cab.blind!, clearance: v! } })} />
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
          ? 'The cabinet on the other wall covers the blind area, which is left open. The blind stile is a regular face frame stile plus clearance for that cabinet’s doors and pulls. Give it more next to a dishwasher or range.'
          : 'An L-shaped case with a face frame on each wall and a bifold pair of doors. Bottom, top and shelves are cut as rectangles with the front corner notched out.'}
      </p>
    </Section>
  );
}

/** Sub-crown, raise and extra mouldings that build up the crown on a wall or tall cabinet. */
function CrownBuildEditor({ cab, set, species }: { cab: Cabinet; set: (patch: Partial<Cabinet>) => void; species: string }) {
  const settings = useStore((s) => s.project.settings);
  const b = { ...noCrownBuild, ...cab.crownBuild };
  const put = (patch: Partial<CrownBuild>) => set({ crownBuild: { ...b, ...patch } });
  const L = crownLayout(cab, settings);
  // Fronts' top edge, so a sub-crown that laps down over the doors gets flagged
  const frontTop = Math.max(0, ...buildParts(cab, settings).filter((p) => p.role === 'door' || p.role === 'drawerFront').flatMap((p) => p.boxes.map((x) => x.min[1] + x.size[1])));
  const overlap = b.subCrown > 0 ? frontTop - L.subBottom : 0;
  return (
    <div className="crown-build">
      <h4>Crown build</h4>
      <div className="grid3">
        <Field label="Flat sub-crown" htmlFor="cb-sub">
          <LengthInput id="cb-sub" value={b.subCrown || null} allowAuto placeholder="none" onChange={(v) => put({ subCrown: v ?? 0 })} />
        </Field>
        <Field label="Raise above top" htmlFor="cb-rise">
          <LengthInput id="cb-rise" value={b.rise || null} allowAuto placeholder="0" onChange={(v) => put({ rise: v ?? 0 })} />
        </Field>
        <Field label="Crown down from top" htmlFor="cb-drop">
          <LengthInput id="cb-drop" value={b.drop || null} allowAuto placeholder="0" onChange={(v) => put({ drop: v ?? 0 })} />
        </Field>
      </div>
      {b.extra.map((num, i) => (
        <MoldSlot
          key={i}
          kind="crown"
          label={`Under crown ${i + 1}`}
          num={num}
          species={species}
          onChange={(n) => put({ extra: n ? b.extra.map((x, j) => (j === i ? n : x)) : b.extra.filter((_, j) => j !== i) })}
          extra={<button className="mini" onClick={() => put({ extra: b.extra.filter((_, j) => j !== i) })}>Remove</button>}
        />
      ))}
      <div className="order-actions">
        <button className="mini" onClick={() => put({ extra: [...b.extra, ''] })}>Add moulding under crown</button>
        {frontTop > 0 && L.top - frontTop > 0.25 && Math.abs(b.subCrown - (L.top - frontTop)) > 1e-3 && (
          <button className="mini" title="Sub-crown from the top of the doors to the top of the build" onClick={() => put({ subCrown: Math.round((L.top - frontTop) * 16) / 16 })}>Fit sub-crown above doors ({fmt(L.top - frontTop)})</button>
        )}
      </div>
      {overlap > 1e-3 && <p className="warn">The sub-crown laps {fmt(overlap)} down over the doors. Make it shorter or raise it.</p>}
      <p className="hint">
        The sub-crown is flat stock with its face flush with the doors; it’s on the Solid wood list with the face frames. Raising the build adds a 3/4" plywood nailer on the cabinet top.
        {' '}Crown top: {fmt(L.crownTop)} off the cabinet bottom{L.top !== cab.height ? `, ${fmt(L.top - cab.height)} above the case` : ''}.
      </p>
    </div>
  );
}
