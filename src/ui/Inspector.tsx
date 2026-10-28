import { useEffect, useState } from 'react';
import { cofferOf, perimOf } from '../model/coffer';
import { combine, combineAll, stackedPairs, upperOn } from '../model/onePiece';
import { useStore } from '../store';
import type { CabinetNote, Cabinet, CrownBuild, EndMode, FaceRow, PanelChoice, PanelMode, ShopSettings, WallId } from '../model/types';
import { buildParts, closetRod, crownFit, crownLayout, crownRoom, layoutRows, noCrownBuild, panelOn } from '../model/parts';
import { defaultPilaster, pilasterOf, pilasterSections } from '../model/pilaster';
import { bracketCount, bracketGap, bracketLength, bracketProduct, finishedEnds, floatingOf, shelfPly } from '../model/floatingShelf';
import { evenRun, fillSpan, gapBeside, resolveEnds, runOf, wallLength, wallNames, wallOrder } from '../model/layout';
import { panelLabel } from '../model/eagle';
import { nextName, uid } from '../model/defaults';
import { fmt } from '../units';
import { Field, LengthInput, Section } from './fields';
import { OrderList, PartsTable } from './PartsTable';
import { OverridesSection } from './Overrides';
import { MoldSlot } from './ProfilePicker';
import { ModelField } from './ModelField';
import { friezeHeight, shelfFor, fuelLabel, hearthRequired, legWidth, mantelClearances, mantelCodeBasis, mantelOf, needsManualChart, usesListing, usesMasonryRules, widthFor, type Fuel, type MantelSpec } from '../model/mantel';
import { applianceKinds, appliancePresets, newAppliance, openingFor, placedAppliances, type Appliance, type ApplianceKind } from '../model/appliances';
import { cabinetCallouts } from '../drawings/notes';
import { archBuilds, archShapes, baseLayout, baseOf, baseStyles, cutOutline, defaultBase, floorStanding } from '../model/cabinetBase';
import { profileLabel, profileByNum } from '../model/moldings';

const kindLabel = { base: 'Base cabinet', wall: 'Wall cabinet', tall: 'Tall cabinet', pilaster: 'Pilaster', shelf: 'Floating shelf', mantel: 'Fireplace mantel' };
const rowTypes: { v: FaceRow['type']; label: string }[] = [
  { v: 'drawer', label: 'Drawer' },
  { v: 'doors', label: 'Doors' },
  { v: 'falseFront', label: 'False front' },
  { v: 'open', label: 'Open' },
  { v: 'hang', label: 'Hanging (rod)' },
  { v: 'shoes', label: 'Shoe shelves' },
  { v: 'appliance', label: 'Appliance' },
];

export function Inspector({ cab, issues }: { cab: Cabinet; issues: string[] }) {
  // Parts detail stays tucked away until asked for; remembered for this browser
  const [showParts, setShowParts] = useState(() => { try { return localStorage.getItem('cabinet-studio.showParts') === '1'; } catch { return false; } });
  const toggleParts = (v: boolean) => { setShowParts(v); try { localStorage.setItem('cabinet-studio.showParts', v ? '1' : '0'); } catch { /* storage blocked */ } };
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
  const [shrunk, setShrunk] = useState(0);
  useEffect(() => setShrunk(0), [cab.id]);

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
        <FitButtons cab={cab} />
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
        {(cab.kind === 'base' || cab.kind === 'tall' || cab.island || (cab.wallInset ?? 0) > 0) && !cab.corner && (
          <div className="grid3">
            <Field label="Off the wall" htmlFor="cab-inset"><LengthInput id="cab-inset" value={cab.wallInset ?? 0} onChange={(v) => set({ wallInset: v || undefined })} /></Field>
            {cab.kind === 'base' && (
              <label className="check-inline" style={{ gridColumn: 'span 2', alignSelf: 'end' }}>
                <input type="checkbox" checked={!!cab.island} onChange={(e) => set(e.target.checked
                  ? { island: true, base: cab.base ?? { ...defaultBase, style: 'baseboard' }, topBack: cab.topBack ?? cab.topFront ?? 1, wallInset: cab.wallInset || Math.max(0, Math.round(((cab.wall === 'back' || cab.wall === 'front' ? room.depth : room.width) - cab.depth) / 2)) }
                  : { island: undefined, topBack: undefined })} /> Freestanding island, back finished
              </label>
            )}
          </div>
        )}
        {cab.island && (
          <label className="check-inline">
            <input type="checkbox" checked={cab.islandSides === 2} onChange={(e) => set(e.target.checked
              ? { islandSides: 2, wallInset: (cab.wallInset ?? 0) + cab.depth }
              : { islandSides: undefined, backRows: undefined, wallInset: Math.max(0, (cab.wallInset ?? 0) - cab.depth) })} /> Drawers on both sides (a second case back to back, same openings)
          </label>
        )}
        <div className="order-actions"><button className="mini" onClick={() => useStore.getState().selectWall(cab.wall)}>Pick everything on the {wallNames[cab.wall].toLowerCase()} to move it together</button></div>
        <p className="hint">{cab.island
          ? cab.islandSides === 2
            ? `Island, fronts both ways: ${fmt(2 * cab.depth)} deep over the two cases, the seam between them ${fmt(cab.wallInset ?? 0)} off the ${wallNames[cab.wall].toLowerCase()}. The far side mirrors these openings; the base wraps all four sides and the top runs over both.`
            : `Island: back ${fmt(cab.wallInset ?? 0)} off the ${wallNames[cab.wall].toLowerCase()}, facing away from it. The back gets a panel in the door style, the base (baseboard, or a toe kick under Base below) wraps all four sides, and the top overhangs all four sides.`
          : 'Drag the cabinet in the 3D, Plan or Elevation view to slide it along the wall. It snaps to neighbors and wall ends. Shift- or ⌘-click others to pick several and move them together.'}</p>
      </Section>

      {(cab.blind || cab.corner) && <CornerSection cab={cab} set={set} />}
      {cab.kind === 'pilaster' && <PilasterSection cab={cab} set={set} />}
      {cab.kind === 'shelf' && <FloatingShelfSection cab={cab} set={set} />}
      {cab.kind === 'mantel' && <MantelSection cab={cab} set={set} />}
      <OnePiece cab={cab} />
      {!cab.corner && cab.kind !== 'pilaster' && cab.kind !== 'shelf' && cab.kind !== 'mantel' && (
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
              <select id={`row-type-${r.id}`} aria-label="Opening type" value={r.type} onChange={(e) => {
                const type = e.target.value as FaceRow['type'];
                // A new appliance row starts as a microwave, its opening sized to fit
                if (type === 'appliance' && !r.appliance) { const a = newAppliance('microwave'); setRow(r.id, { type, appliance: a, height: openingFor(a), shelves: 0 }); }
                else setRow(r.id, { type });
              }}>
                {rowTypes.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
              </select>
              <LengthInput id={`row-h-${r.id}`} value={r.height} allowAuto placeholder={`auto ${fmt(layout[i]?.height ?? 0)}`} onChange={(v) => setRow(r.id, { height: v })} />
              {r.type === 'doors' ? (
                <select id={`row-doors-${r.id}`} aria-label="Door count" value={r.doors} onChange={(e) => setRow(r.id, { doors: Number(e.target.value) as 1 | 2 })}>
                  <option value={1}>1 door</option>
                  <option value={2}>2 doors</option>
                </select>
              ) : r.type === 'hang' || r.type === 'shoes' ? (
                <select id={`row-doors-${r.id}`} aria-label="Open or behind doors" value={r.covered ? r.doors : 0} onChange={(e) => {
                  const n = Number(e.target.value);
                  setRow(r.id, n ? { covered: true, doors: n as 1 | 2 } : { covered: undefined });
                }}>
                  <option value={0}>Open</option>
                  <option value={1}>1 door</option>
                  <option value={2}>2 doors</option>
                </select>
              ) : <span />}
              {r.type === 'hang' ? (
                <LengthInput id={`row-rod-${r.id}`} value={r.rodDrop ?? null} allowAuto placeholder={fmt(settings.rodDrop ?? closetRod.drop)} onChange={(v) => setRow(r.id, { rodDrop: v ?? undefined })} />
              ) : r.type === 'shoes' ? (
                <select id={`row-sh-${r.id}`} aria-label="Shoe shelves" value={r.shelves} onChange={(e) => setRow(r.id, { shelves: Number(e.target.value) })}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => <option key={n} value={n}>{n} shel{n === 1 ? 'f' : 'ves'}</option>)}
                </select>
              ) : r.type === 'doors' || r.type === 'open' ? (
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
              {i > 0 && (
                <div className="row-ledge">
                  <label><input type="checkbox" checked={!!r.ledge} onChange={(e) => setRow(r.id, { ledge: e.target.checked ? { thickness: 1, overhang: 0.5 } : undefined })} /> Ledge on the rail above</label>
                  {r.ledge && (
                    <>
                      <span>thick</span><LengthInput id={`row-lt-${r.id}`} value={r.ledge.thickness} onChange={(v) => v != null && setRow(r.id, { ledge: { ...r.ledge!, thickness: v } })} />
                      <span>proud</span><LengthInput id={`row-lo-${r.id}`} value={r.ledge.overhang} onChange={(v) => v != null && setRow(r.id, { ledge: { ...r.ledge!, overhang: v } })} />
                    </>
                  )}
                </div>
              )}
              {r.type === 'appliance' && r.appliance && (
                <ApplianceEditor a={r.appliance} openingH={layout[i]?.height ?? 0} problems={placedAppliances(cab, settings).find((x) => x.row?.id === r.id)?.problems ?? []}
                  onChange={(a, h) => setRow(r.id, { appliance: a, ...(h != null ? { height: h } : {}) })} />
              )}
            </li>
          ))}
        </ol>
        {cab.rows.some((r) => r.type === 'shoes') && (
          <div className="hint">
            {cab.rows.filter((r) => r.type === 'shoes').map((r) => {
              const lay = layout[cab.rows.indexOf(r)];
              return (
                <label key={r.id} className="check-inline">
                  <input type="checkbox" checked={!r.flatShoes} onChange={(e) => setRow(r.id, { flatShoes: !e.target.checked || undefined })} /> Slanted shoe shelves, {fmt((lay?.height ?? 0) / Math.max(1, r.shelves))} apart{r.flatShoes ? ' (flat)' : ''}
                </label>
              );
            })}
            <span> About 7" apart suits flats and sneakers, 9" slanted; boots want 14" or more.</span>
          </div>
        )}
        {cab.rows.some((r) => r.type === 'hang') && (
          <p className="hint">Hanging: the last box is the rod’s center below the shelf over it (blank = Shop standards). Each rod’s height off the floor and clear hang are in its parts note.</p>
        )}
        <FrameWidths cab={cab} settings={settings} set={set} setRow={setRow} />
        {leftover < -0.01 && <p className="warn">Openings are {fmt(-leftover)} taller than the face frame allows.</p>}
        {leftover > 0.01 && <p className="warn">{fmt(leftover)} of face frame is unused. Make one row auto.</p>}
        <div className="checks">
          <label><input id="cab-cstile" type="checkbox" checked={cab.centerStile} onChange={(e) => set({ centerStile: e.target.checked })} /> Center stile between pairs of doors</label>
          {cab.kind !== 'base' && (
            <label><input id="cab-bottom" type="checkbox" checked={!cab.noBottom} onChange={(e) => set({ noBottom: !e.target.checked })} /> Case bottom (off for a bookcase whose sides stand on the countertop)</label>
          )}
          {cab.kind !== 'base' && cab.noBottom && (
            <label><input id="cab-brail" type="checkbox" checked={!!cab.bottomRail} onChange={(e) => set({ bottomRail: e.target.checked })} /> Face frame bottom rail</label>
          )}
          {cab.kind === 'wall' && !cab.noBottom && (
            <label><input id="cab-flush" type="checkbox" checked={!!cab.bottomFlush} onChange={(e) => set({ bottomFlush: e.target.checked })} /> Box bottom flush with bottom of face frame (for cabinets hung high)</label>
          )}

        </div>
        {cab.rows.some((r) => (r.type === 'open' || r.type === 'doors') && r.shelves > 0) && (
          <div className="checks">
            <label><input id="cab-sfront" type="checkbox" checked={!!cab.shelfFront} onChange={(e) => set({ shelfFront: e.target.checked ? { height: 1.5, thickness: 0.75 } : undefined })} /> Applied solid shelf fronts (wider than the plywood)</label>
            {cab.shelfFront && (
              <div className="grid3">
                <Field label="Front height" htmlFor="sf-h"><LengthInput id="sf-h" value={cab.shelfFront.height} onChange={(v) => set({ shelfFront: { ...cab.shelfFront!, height: v ?? 1.5 } })} /></Field>
                <Field label="Thickness" htmlFor="sf-t"><LengthInput id="sf-t" value={cab.shelfFront.thickness} onChange={(v) => set({ shelfFront: { ...cab.shelfFront!, thickness: v ?? 0.75 } })} /></Field>
              </div>
            )}
          </div>
        )}
      </Section>
      {floorStanding(cab) && <BaseSection cab={cab} set={set} />}

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
            {cab.countertop && cab.island && (
              <Field label="Back overhang" htmlFor="cab-topb" hint="Past the back panel">
                <LengthInput id="cab-topb" value={cab.topBack ?? null} allowAuto placeholder={fmt(cab.topFront ?? settings.counterOverhang)} onChange={(v) => set({ topBack: v ?? undefined })} />
              </Field>
            )}
          </div>
          {cab.topKind === 'wood' && cab.countertop && <p className="hint">Solid wood tops and bench seats go on the Solid wood list with board feet to buy.</p>}
          {cab.countertop && (
            <div style={{ marginTop: 8 }}>
              <label className="check-inline"><input id="cab-cushion" type="checkbox" checked={!!cab.cushion} onChange={(e) => set({ cushion: e.target.checked ? { thickness: 3, edge: 'boxed' } : undefined })} /> Custom seat cushion on top</label>
              {cab.cushion && (
                <>
                  <div className="grid3">
                    <Field label="Foam" htmlFor="cab-cu-t">
                      <select id="cab-cu-t" value={cab.cushion.thickness} onChange={(e) => set({ cushion: { ...cab.cushion!, thickness: Number(e.target.value) } })}>
                        {[1.5, 2, 3, 4].map((t) => <option key={t} value={t}>{fmt(t)}</option>)}
                      </select>
                    </Field>
                    <Field label="Edge" htmlFor="cab-cu-e">
                      <select id="cab-cu-e" value={cab.cushion.edge} onChange={(e) => set({ cushion: { ...cab.cushion!, edge: e.target.value as 'knife' | 'boxed' } })}>
                        <option value="boxed">Boxed, welted</option>
                        <option value="knife">Knife edge</option>
                      </select>
                    </Field>
                    <Field label="Fabric" htmlFor="cab-cu-f"><input id="cab-cu-f" value={cab.cushion.fabric ?? ''} placeholder="To be selected" onChange={(e) => set({ cushion: { ...cab.cushion!, fabric: e.target.value || undefined } })} /></Field>
                  </div>
                  <Field label="Notes for the upholsterer" htmlFor="cab-cu-n"><input id="cab-cu-n" value={cab.cushion.notes ?? ''} placeholder="Ties, zipper cover, back cushions…" onChange={(e) => set({ cushion: { ...cab.cushion!, notes: e.target.value || undefined } })} /></Field>
                  <p className="hint">Sized to the seat; seat height with the cushion {fmt(cab.elevation + cab.height + (cab.topThickness ?? 1.25) + cab.cushion.thickness)}. Priced per sq ft under Quote → Prices to fill in.</p>
                </>
              )}
            </div>
          )}
        </Section>
      )}

      {cab.kind !== 'shelf' && (
      <>
      <Section title="Mouldings (Anderson & McQuaid)">
        {(['crown', 'lightRail', 'baseMold'] as const)
          .filter((k) => (k === 'crown' ? cab.kind !== 'base' : k === 'lightRail' ? cab.kind === 'wall' : cab.kind !== 'wall'))
          .filter((k) => cab.kind !== 'pilaster' || k !== 'lightRail')
          .map((k) => (
            <MoldSlot
              key={k}
              kind={k}
              label={cab.kind === 'mantel' ? (k === 'crown' ? 'Bed moulding under the shelf' : 'Base around the plinths') : undefined}
              num={cab[k]}
              species={settings.moldSpecies}
              maxHeight={k === 'crown' && cab.kind !== 'mantel' ? crownRoom(cab, settings, room.height) : undefined}
              onChange={(n) => {
                if (k !== 'crown' || cab.kind === 'mantel') return set({ [k]: n });
                // A crown too tall for the space shortens the cabinet so its top meets the ceiling
                const fit = crownFit({ ...cab, crown: n }, settings, room.height);
                const cut = fit && fit.over > 1e-3 ? Math.ceil(fit.over * 16) / 16 : 0;
                set(cut ? { crown: n, height: cab.height - cut } : { crown: n });
                setShrunk(cut);
              }}
              extra={cab[k] && (
                <button className="mini" title={`Use on every ${cab.kind} cabinet on this wall`} onClick={() =>
                  useStore.getState().commit((p) => ({ ...p, cabinets: p.cabinets.map((c) => {
                    if (c.wall !== cab.wall || c.kind !== cab.kind) return c;
                    const next = { ...c, [k]: cab[k], ...(k === 'crown' ? { crownBuild: cab.crownBuild } : {}) };
                    // Same rule as picking it: shorten any cabinet the crown would push past the ceiling
                    const f = k === 'crown' ? crownFit(next, p.settings, p.room.height) : null;
                    return f && f.over > 1e-3 ? { ...next, height: next.height - Math.ceil(f.over * 16) / 16 } : next;
                  }) }))
                }>Whole wall</button>
              )}
            />
          ))}
        {shrunk > 0 && <p className="hint">Shortened {cab.name} {fmt(shrunk)} to {fmt(cab.height)} so the crown meets the ceiling. Undo puts it back.</p>}
        {cab.kind !== 'base' && cab.kind !== 'mantel' && <CrownBuildEditor cab={cab} set={set} species={settings.moldSpecies} />}
        <p className="hint">Runs across the face and returns to the wall on exposed ends. Lineal footage and cost are on the Orders tab.</p>
      </Section>

      {cab.kind !== 'mantel' && <OverridesSection cab={cab} settings={settings} set={set} />}
      </>
      )}

      {cab.kind !== 'pilaster' && cab.kind !== 'shelf' && cab.kind !== 'mantel' && (
      <>
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
      </>
      )}

      <NotesSection cab={cab} set={set} />

      <button id="toggle-parts" className="mini parts-toggle" aria-expanded={showParts} onClick={() => toggleParts(!showParts)}>
        {showParts ? 'Hide' : 'Show'} cut parts & Eagle order
      </button>
      {showParts && (
        <>
          <Section title="Cut parts">
            <PartsTable cabinets={[cab]} compact />
          </Section>

          <Section title="Order from Eagle">
            <OrderList cabinets={[cab]} compact />
          </Section>
        </>
      )}

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
  const ceiling = useStore((s) => s.project.room.height);
  const all = useStore((s) => s.project.cabinets);
  const commit = useStore((s) => s.commit);
  const fit = crownFit(cab, settings, ceiling);
  const others = all.filter((c) => c.id !== cab.id && c.wall === cab.wall && (crownFit(c, settings, ceiling)?.over ?? 0) > 1e-3);
  return (
    <div className="crown-build">
      <h4>Crown build</h4>
      <div className="grid3">
        <Field label="Flat sub-crown" htmlFor="cb-sub">
          <LengthInput id="cb-sub" value={b.subCrown || null} allowAuto placeholder="none" onChange={(v) => put({ subCrown: v ?? 0 })} />
        </Field>
        <Field label={L.seat > 0 ? "Raise above the case" : "Raise above top"} htmlFor="cb-rise">
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
      {fit && fit.over > 1e-3 && (
        <div className="warn">
          The crown is {fmt(fit.over)} too tall: case top {fmt(fit.caseTop)} + crown drop {fmt(fit.drop)}{b.rise ? ` + ${fmt(b.rise)} raise` : ''} = {fmt(fit.top)}, ceiling {fmt(ceiling)}.
          <div className="order-actions">
            <button className="mini" onClick={() => set({ height: cab.height - fit.over })}>Shorten {cab.name} to {fmt(cab.height - fit.over)}</button>
            {others.length > 0 && <button className="mini" onClick={() => commit((p) => ({ ...p, cabinets: p.cabinets.map((c) => { const f = c.wall === cab.wall ? crownFit(c, p.settings, p.room.height) : null; return f && f.over > 1e-3 ? { ...c, height: c.height - f.over } : c; }) }))}>Shorten all {others.length + 1} on this wall so the crown meets the ceiling</button>}
          </div>
        </div>
      )}
      <p className="hint">
        {L.seat > 0
          ? <>With no sub-crown the crown sits on the case: its bottom at the top of the case, on a 3/4" plywood nailer {fmt(L.seat)} tall (the crown’s height). Raise it to lift it further. Add a sub-crown to set the crown on its face instead.</>
          : <>The sub-crown is flat stock with its face flush with the doors; it’s on the Solid wood list with the face frames. Raising the build adds a 3/4" plywood nailer on the cabinet top.</>}
        {' '}Crown top: {fmt(L.crownTop)} off the cabinet bottom{L.top !== cab.height ? `, ${fmt(L.top - cab.height)} above the case` : ''}{cab.elevation ? `, ${fmt(cab.elevation + L.crownTop)} off the floor` : ''}.
      </p>
    </div>
  );
}

/** Plinth, capital and panel breaks on a pilaster. */
function PilasterSection({ cab, set }: { cab: Cabinet; set: (patch: Partial<Cabinet>) => void }) {
  const ps = pilasterOf(cab);
  const all = useStore((s) => s.project.cabinets);
  const put = (patch: Partial<typeof ps>) => set({ pilaster: { ...ps, ...patch } });
  const commit = useStore((st) => st.commit);
  // Neighbours' tops on this wall, offered as break heights (the base cabinet top, typically)
  const tops = [...new Set(all.filter((c) => c.wall === cab.wall && c.id !== cab.id && c.kind === 'base').map((c) => c.height + (c.countertop ? c.topThickness ?? 1.25 : 0)))].filter((h) => !ps.breaks.some((b) => Math.abs(b - h) < 1e-3));
  return (
    <Section title="Pilaster">
      <div className="grid3">
        <Field label="Face" htmlFor="pil-face">
          <select id="pil-face" value={ps.face} onChange={(e) => put({ face: e.target.value as 'shop' | 'eagle' })}>
            <option value="shop">Shop-built frame & panel</option>
            <option value="eagle">Eagle panels</option>
          </select>
        </Field>
        {ps.face === 'shop' && <Field label="Stiles" htmlFor="pil-stile"><LengthInput id="pil-stile" value={ps.stile} onChange={(v) => put({ stile: v ?? defaultPilaster.stile })} /></Field>}
        {ps.face === 'shop' && <Field label="Top & bottom rails" htmlFor="pil-rail"><LengthInput id="pil-rail" value={ps.rail} onChange={(v) => put({ rail: v ?? defaultPilaster.rail })} /></Field>}
        <Field label="Plinth block (0 = none)" htmlFor="pil-plinth"><LengthInput id="pil-plinth" value={ps.plinth} onChange={(v) => put({ plinth: v ?? 0 })} /></Field>
        <Field label="Capital block" htmlFor="pil-cap"><LengthInput id="pil-cap" value={ps.capital} onChange={(v) => put({ capital: v ?? 0 })} /></Field>
        <Field label="Frame stock" htmlFor="pil-species">
          <select id="pil-species" value={ps.species ?? ''} onChange={(e) => put({ species: e.target.value || undefined })}>
            <option value="">Job face frame stock</option>
            {['Poplar', 'Hard maple', 'Soft maple'].map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </Field>
        <Field label="Blocks proud of panel" htmlFor="pil-proud"><LengthInput id="pil-proud" value={ps.proud} onChange={(v) => put({ proud: v ?? 0 })} /></Field>
      </div>
      <label className="chk-row"><input type="checkbox" checked={!!ps.wrap} onChange={(e) => {
        // Start from the room baseboard the cabinets beside it use
        const nb = all.find((c) => c.wall === cab.wall && c.base?.style === 'baseboard');
        put({ wrap: e.target.checked ? { h: nb?.base?.height ?? 6, cap: nb?.base?.cap ?? 0, t: 0.75 } : undefined });
      }} /> Baseboard and cap wrap the plinth</label>
      {ps.wrap && (
        <div className="grid3">
          <Field label="Baseboard" htmlFor="pil-wh"><LengthInput id="pil-wh" value={ps.wrap.h} onChange={(v) => put({ wrap: { ...ps.wrap!, h: v ?? 0 } })} /></Field>
          <Field label="Cap" htmlFor="pil-wc"><LengthInput id="pil-wc" value={ps.wrap.cap} onChange={(v) => put({ wrap: { ...ps.wrap!, cap: v ?? 0 } })} /></Field>
          <Field label="Thickness" htmlFor="pil-wt"><LengthInput id="pil-wt" value={ps.wrap.t} onChange={(v) => put({ wrap: { ...ps.wrap!, t: v ?? 0.75 } })} /></Field>
        </div>
      )}
      {all.filter((c) => c.kind === 'pilaster' && c.id !== cab.id).length > 0 && (
        <div className="order-actions"><button className="mini" onClick={() => commit((p) => ({ ...p, cabinets: p.cabinets.map((c) => (c.kind === 'pilaster' && c.id !== cab.id ? { ...c, pilaster: { ...pilasterOf(c), plinth: ps.plinth, capital: ps.capital, stile: ps.stile, rail: ps.rail, proud: ps.proud, wrap: ps.wrap } } : c)) }))}>Same plinth, capital, frame and base wrap on the other pilasters</button></div>
      )}
      {ps.wrap && ps.plinth === 0 && <p className="hint">No plinth block: the {fmt(ps.wrap.h + ps.wrap.cap)} base and cap go straight on the pilaster face, and the bottom rail runs from the floor to {fmt(ps.rail)} above the cap.</p>}
      {ps.wrap && ps.plinth > 0 && ps.plinth < ps.wrap.h + ps.wrap.cap && <p className="hint">The {fmt(ps.wrap.h + ps.wrap.cap)} base and cap cover the whole {fmt(ps.plinth)} plinth block. Set the plinth to 0 for no block.</p>}
      <h4 className="sub">Panel breaks</h4>
      {ps.breaks.map((b, i) => (
        <div key={i} className="row-inline">
          <LengthInput id={`pil-brk-${i}`} value={b} onChange={(v) => put({ breaks: ps.breaks.map((x, j) => (j === i ? v ?? x : x)) })} />
          <span className="muted">off the floor</span>
          <button className="mini" onClick={() => put({ breaks: ps.breaks.filter((_, j) => j !== i) })}>Remove</button>
        </div>
      ))}
      <div className="order-actions">
        <button className="mini" onClick={() => put({ breaks: [...ps.breaks, Math.round(cab.height / 2)] })}>Add break</button>
        {tops.map((h) => <button key={h} className="mini" onClick={() => put({ breaks: [...ps.breaks, h] })}>Break at base top ({fmt(h)})</button>)}
        <Field label={ps.face === 'shop' ? 'Rail at breaks' : 'Band at breaks'} htmlFor="pil-band"><LengthInput id="pil-band" value={ps.band} onChange={(v) => put({ band: v ?? defaultPilaster.band })} /></Field>
      </div>
      {ps.face === 'shop' && (
        <>
          <div className="grid3">
            <Field label="Panel" htmlFor="pil-pt"><LengthInput id="pil-pt" value={ps.panelThickness} onChange={(v) => put({ panelThickness: v ?? defaultPilaster.panelThickness })} /></Field>
            <Field label="Rabbet" htmlFor="pil-rab"><LengthInput id="pil-rab" value={ps.rabbet} onChange={(v) => put({ rabbet: v ?? defaultPilaster.rabbet })} /></Field>
          </div>
          <MoldSlot kind="panel" num={ps.panelMold} species={useStore.getState().project.settings.moldSpecies} onChange={(n) => put({ panelMold: n })}
            extra={ps.panelMold && <button className="mini" onClick={() => put({ panelMold: undefined })}>Remove</button>} />
        </>
      )}
      <p className="hint">
        {ps.face === 'shop'
          ? `Stiles and rails from ${ps.species ? ps.species.toLowerCase() : 'the face frame stock'} (on the Solid wood list), with ${pilasterSections(cab).length} MDF panel${pilasterSections(cab).length > 1 ? 's' : ''} let into a rabbet from the back (on the sheet cutlist), on a 3/4" plywood box.`
          : `${pilasterSections(cab).length} recessed panel${pilasterSections(cab).length > 1 ? 's' : ''} ordered from Eagle in the job’s door style, on a 3/4" plywood box.`} Depth runs from the wall to the panel face; set it so the pilaster stands proud of the cabinets beside it. Base moulding and crown wrap it and return to the neighbours.
      </p>
    </Section>
  );
}

/** Grade, face thickness and exposed ends of a floating shelf. */
function FloatingShelfSection({ cab, set }: { cab: Cabinet; set: (patch: Partial<Cabinet>) => void }) {
  const settings = useStore((s) => s.project.settings);
  const room = useStore((s) => s.project.room);
  const all = useStore((s) => s.project.cabinets);
  const f = floatingOf(cab);
  const ends = resolveEnds(room, all, cab);
  const [gap2, setGap2] = useState(14);
  // Another shelf the same size, the spacing above or below this one (top to top)
  const stack = (dir: 1 | -1) => useStore.getState().commit((p) => {
    // Step past shelves already stacked there, so the new one lands in the next open spot
    const clash = (y: number) => p.cabinets.some((o) => o.id !== cab.id && o.wall === cab.wall && o.offset < cab.offset + cab.width && cab.offset < o.offset + o.width && o.elevation < y + cab.height && y < o.elevation + o.height);
    let y = cab.elevation + dir * gap2;
    while (clash(y) && y > 0 && y < p.room.height) y += dir * gap2;
    if (y < 0 || y + cab.height > p.room.height) return p;
    const copy = { ...cab, id: uid('cab'), name: nextName('shelf', p.cabinets), elevation: y };
    return { ...p, cabinets: [...p.cabinets, copy] };
  });
  const gap = bracketGap(cab, settings);
  return (
    <Section title="Floating shelf">
      <div className="grid3">
        <Field label="Grade" htmlFor="fs-grade">
          <select id="fs-grade" value={f.grade} onChange={(e) => set({ floating: { ...f, grade: e.target.value as 'paint' | 'stain' } })}>
            <option value="paint">Paint grade</option>
            <option value="stain">Stain grade ({settings.woodSpecies})</option>
          </select>
        </Field>
        <Field label="Solid face" htmlFor="fs-face"><LengthInput id="fs-face" value={f.face} onChange={(v) => set({ floating: { ...f, face: v ?? 0.75 } })} /></Field>
        <Field label="Brackets" htmlFor="fs-brk">
          <input id="fs-brk" inputMode="numeric" placeholder={`${bracketCount({ ...cab, floating: { ...f, brackets: undefined } })} (auto)`} value={f.brackets ?? ''}
            onChange={(e) => { const n = parseInt(e.target.value, 10); set({ floating: { ...f, brackets: Number.isFinite(n) && n > 0 ? n : undefined } }); }} />
        </Field>
      </div>
      <div className="order-actions">
        <span className="muted">Stack another:</span>
        <button className="mini" onClick={() => stack(1)}>Above</button>
        <button className="mini" onClick={() => stack(-1)}>Below</button>
        <Field label="Spacing" htmlFor="fs-gap"><LengthInput id="fs-gap" value={gap2} onChange={(v) => setGap2(v ?? 14)} /></Field>
      </div>
      <div className="ends">
        {(['left', 'right'] as const).map((side) => {
          const key = side === 'left' ? 'leftEnd' : 'rightEnd';
          return (
            <Field key={side} label={`${side === 'left' ? 'Left' : 'Right'} end`} htmlFor={`fs-${side}`}>
              <select id={`fs-${side}`} value={cab[key] ?? 'auto'} onChange={(e) => set({ [key]: e.target.value as EndMode })}>
                <option value="auto">Auto ({ends[side] ? 'end cap' : 'against wall'})</option>
                <option value="exposed">End cap</option>
                <option value="hidden">Against wall / cabinet</option>
              </select>
            </Field>
          );
        })}
      </div>
      <p className="hint">{bracketCount(cab)} × {bracketLength(cab)}" brackets (<a href={bracketProduct.url} target="_blank" rel="noreferrer">Amazon</a>), on studs at 16" centers unless set; the bracket is 2" shorter than the shelf is deep. {finishedEnds(ends) === 2 ? 'Both ends finished.' : finishedEnds(ends) === 1 ? 'One finished end.' : 'No finished ends.'} Bracket price is on the Quote tab.</p>
      {gap < 0.375 && <p className="warn">Only {fmt(gap)} between the top and bottom for the bracket. Make the shelf thicker.</p>}
      <p className="hint">
        {fmt(settings.boxThickness)} plywood top and bottom ({shelfPly(cab, settings)}, on the sheet cutlist) with the solid face{ends.left || ends.right ? ' and end caps' : ''} mitered to them, leaving {fmt(gap)} for the bracket.
        {f.grade === 'paint' ? ' Solid stock comes from the face frame stock.' : ` Solid stock is ${settings.woodSpecies} on the Solid wood list.`}
      </p>
    </Section>
  );
}

function BaseSection({ cab, set }: { cab: Cabinet; set: (patch: Partial<Cabinet>) => void }) {
  const settings = useStore((s) => s.project.settings);
  const b = baseOf(cab);
  const s = cab.overrides ? { ...settings, ...cab.overrides } : settings;
  const L = baseLayout(cab, s);
  const put = (patch: Partial<typeof b>) => set({ base: { ...b, ...patch } });
  const cap = profileByNum(cab.baseMold);
  const commit = useStore((st) => st.commit);
  const others = useStore((st) => st.project.cabinets).filter((c) => c.id !== cab.id && c.wall === cab.wall && (c.kind === 'base' || c.kind === 'tall'));
  return (
    <Section title="Base">
      <div className="grid3">
        <Field label="Base" htmlFor="base-style">
          <select id="base-style" value={b.style} onChange={(e) => put({ style: e.target.value as typeof b.style })}>
            {Object.entries(baseStyles).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        {b.style !== 'kick' && (
          <Field label={b.style === 'arch' ? 'Skirt height' : 'Board height'} htmlFor="base-h"><LengthInput id="base-h" value={b.height} onChange={(v) => put({ height: v ?? 4.5 })} /></Field>
        )}
        {b.style === 'baseboard' && !cab.baseMold && (
          <Field label="Custom cap" htmlFor="base-cap"><LengthInput id="base-cap" value={b.cap ?? 0} onChange={(v) => put({ cap: v ?? 0 })} /></Field>
        )}
        {b.style === 'arch' && (
          <Field label="Build" htmlFor="base-build">
            <select id="base-build" value={b.build} onChange={(e) => put({ build: e.target.value as typeof b.build })}>
              {Object.entries(archBuilds).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
        )}
      </div>
      {others.length > 0 && <div className="order-actions"><button className="mini" onClick={() => commit((p) => ({ ...p, cabinets: p.cabinets.map((c) => (others.some((o) => o.id === c.id) ? { ...c, base: { ...b }, baseMold: cab.baseMold } : c)) }))}>Same base on the other {others.length} on this wall</button></div>}
      {b.style === 'arch' && (
        <div className="grid3">
          <Field label="Shape" htmlFor="base-shape">
            <select id="base-shape" value={b.shape} onChange={(e) => put({ shape: e.target.value as typeof b.shape })}>
              {Object.entries(archShapes).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Cutout height" htmlFor="base-rise"><LengthInput id="base-rise" value={b.rise} onChange={(v) => put({ rise: v ?? 3 })} /></Field>
          <Field label="Foot width" htmlFor="base-foot"><LengthInput id="base-foot" value={b.foot} onChange={(v) => put({ foot: v ?? 2.25 })} /></Field>
        </div>
      )}
      {b.style === 'arch' && <SkirtPreview cab={cab} />}
      <p className="hint">
        {b.style === 'kick'
          ? `Recessed ${fmt(s.toeKickHeight)} toe kick.`
          : `Cabinet height stays ${fmt(cab.height)}: the base takes ${fmt(L.top)}${cap ? ` (with the ${profileLabel(cap)} cap)` : ''}, a ${fmt(s.bottomRailWidth)} rail shows above it, and the openings shorten to suit.`}
        {b.style === 'baseboard' && (cab.island ? ' The board wraps all four sides of the island; pick a cap under Mouldings → Base.' : ' The board wraps exposed ends back to the wall; pick a cap under Mouldings → Base.')}
        {b.style === 'arch' && (b.build === 'applied'
          ? ' The skirt is applied to the face frame and wraps exposed ends; a recessed toe kick sits behind the cutout.'
          : ' The stiles run to the floor as feet and the cutout comes out of a wide bottom rail. Exposed ends get a matching cut.')}
      </p>
    </Section>
  );
}

/** The skirt or rail profile, drawn to scale across the cabinet's width. */
function SkirtPreview({ cab }: { cab: Cabinet }) {
  const b = baseOf(cab);
  const W = cab.width, h = Math.max(b.height, b.rise + 0.75) + 1.5;
  const pts = cutOutline(W, h, b.foot, W - b.foot, b.shape, Math.min(b.rise, h - 0.75));
  return (
    <svg className="skirt-preview" viewBox={`-0.5 -0.5 ${W + 1} ${h + 1}`} role="img" aria-label="Skirt profile" style={{ width: '100%', height: 'auto', maxHeight: 90 }}>
      <path d={`M${pts.map(([u, v]) => `${u},${h - v}`).join(' L')} Z`} fill="var(--sunk)" stroke="currentColor" strokeWidth={0.12} />
    </svg>
  );
}

/** Notes for the drawings, each for the customer, the shop, or both; plus what the drawings already call out. */
function NotesSection({ cab, set }: { cab: Cabinet; set: (patch: Partial<Cabinet>) => void }) {
  const project = useStore((s) => s.project);
  const notes = cab.notes ?? [];
  const put = (id: string, patch: Partial<CabinetNote>) => set({ notes: notes.map((n) => (n.id === id ? { ...n, ...patch } : n)) });
  const auto = cabinetCallouts(project, { ...cab, notes: [] });
  return (
    <Section title="Notes for the drawings" aside={<button className="mini" onClick={() => set({ notes: [...notes, { id: uid('note'), text: '', for: 'both' }] })}>Add note</button>}>
      {notes.map((n) => (
        <div key={n.id} className="note-row">
          <input aria-label="Note" value={n.text} placeholder="Glass in the upper doors, outlet in the back…" onChange={(e) => put(n.id, { text: e.target.value })} />
          <select aria-label="Shown to" value={n.for} onChange={(e) => put(n.id, { for: e.target.value as CabinetNote['for'] })}>
            <option value="both">Both</option>
            <option value="customer">Customer</option>
            <option value="shop">Shop</option>
          </select>
          <button className="icon-btn" aria-label="Remove note" onClick={() => set({ notes: notes.filter((x) => x.id !== n.id) })}>×</button>
        </div>
      ))}
      {auto.length > 0 && (
        <>
          <p className="hint">Already called out from the design:</p>
          <ul className="assembly">{auto.map((n) => <li key={n.text}>{n.text} <span className="muted">({n.for === 'both' ? 'both' : n.for})</span></li>)}</ul>
        </>
      )}
    </Section>
  );
}

/** Each stile and rail of this cabinet's face frame; blank follows the cabinet's standard widths. */
/** A base with an open upper standing on it, drawn as two cabinets but built as one. */
function OnePiece({ cab }: { cab: Cabinet }) {
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  const select = useStore((s) => s.select);
  const upper = upperOn(project, cab);
  if (!upper) return null;
  const pairs = stackedPairs(project).length;
  const one = () => commit((p) => {
    const u = upperOn(p, p.cabinets.find((c) => c.id === cab.id)!);
    if (!u) return p;
    const t = combine(p.cabinets.find((c) => c.id === cab.id)!, u, p.settings);
    return { ...p, cabinets: p.cabinets.filter((c) => c.id !== u.id).map((c) => (c.id === cab.id ? t : c)) };
  });
  const all = () => commit((p) => ({ ...p, cabinets: combineAll(p).cabinets }));
  return (
    <div className="one-piece">
      <p><b>{upper.name}</b> stands on this base. Built as one piece? The doors keep their size and the top becomes a ledge at the same height.</p>
      <div className="order-actions">
        <button onClick={() => { one(); select(cab.id); }}>Make {cab.name} + {upper.name} one piece</button>
        {pairs > 1 && <button onClick={all}>All {pairs} on this job</button>}
      </div>
    </div>
  );
}

function FrameWidths({ cab, settings, set, setRow }: { cab: Cabinet; settings: ShopSettings; set: (p: Partial<Cabinet>) => void; setRow: (id: string, patch: Partial<FaceRow>) => void }) {
  const s = cab.overrides ? { ...settings, ...cab.overrides } : settings;
  const changed = [cab.stileLeftWidth, cab.stileRightWidth, cab.overrides?.topRailWidth, cab.overrides?.bottomRailWidth, ...cab.rows.map((r) => r.railAbove)].filter((v) => v != null).length;
  const ov = (k: 'topRailWidth' | 'bottomRailWidth', v: number | null) => {
    const next = { ...cab.overrides, [k]: v ?? undefined };
    if (v == null) delete next[k];
    set({ overrides: Object.keys(next).length ? next : undefined });
  };
  const rowName = (i: number) => rowTypes.find((t) => t.v === cab.rows[i].type)?.label.toLowerCase() ?? 'row';
  return (
    <details className="overrides" open={changed > 0}>
      <summary>Stile & rail widths{changed > 0 && <span className="badge-on">{changed} changed</span>}</summary>
      <p className="hint">Blank follows the standard. A tall top rail for a ladder rail, a wide stile at a wall, a deeper rail over a drawer.</p>
      <div className="grid3">
        <Field label="Left stile" htmlFor="fw-sl"><LengthInput id="fw-sl" value={cab.stileLeftWidth ?? null} allowAuto placeholder={fmt(s.stileWidth)} onChange={(v) => set({ stileLeftWidth: v ?? undefined })} /></Field>
        <Field label="Right stile" htmlFor="fw-sr"><LengthInput id="fw-sr" value={cab.stileRightWidth ?? null} allowAuto placeholder={fmt(s.stileWidth)} onChange={(v) => set({ stileRightWidth: v ?? undefined })} /></Field>
        <Field label="Top rail" htmlFor="fw-top"><LengthInput id="fw-top" value={cab.overrides?.topRailWidth ?? null} allowAuto placeholder={fmt(settings.topRailWidth)} onChange={(v) => ov('topRailWidth', v)} /></Field>
        {cab.rows.slice(1).map((r, j) => (
          <Field key={r.id} label={`Rail above row ${j + 2} (${rowName(j + 1)})`} htmlFor={`fw-r-${r.id}`}>
            <LengthInput id={`fw-r-${r.id}`} value={r.railAbove ?? null} allowAuto placeholder={fmt(s.midRailWidth)} onChange={(v) => setRow(r.id, { railAbove: v ?? undefined })} />
          </Field>
        ))}
        <Field label="Bottom rail" htmlFor="fw-bot"><LengthInput id="fw-bot" value={cab.overrides?.bottomRailWidth ?? null} allowAuto placeholder={fmt(settings.bottomRailWidth)} onChange={(v) => ov('bottomRailWidth', v)} /></Field>
      </div>
    </details>
  );
}

/** What goes in an appliance row: the kind, its size and clearances, and sizing the opening to it. */
function ApplianceEditor({ a, openingH, problems, onChange }: { a: Appliance; openingH: number; problems: string[]; onChange: (a: Appliance, height?: number) => void }) {
  const put = (patch: Partial<Appliance>) => onChange({ ...a, ...patch });
  // Typing a size of your own means it's no longer the picked model's
  const len = (k: 'w' | 'h' | 'd' | 'side' | 'top' | 'back', label: string) => (
    <Field label={label} htmlFor={`ap-${k}`}><LengthInput id={`ap-${k}`} value={a[k]} onChange={(v) => put({ [k]: v ?? 0, source: undefined })} /></Field>
  );
  const fit = openingFor(a);
  return (
    <div className="appliance-ed">
      <div className="grid2">
        <Field label="Appliance" htmlFor="ap-kind">
          <select id="ap-kind" value={a.kind} onChange={(e) => { const n = newAppliance(e.target.value as ApplianceKind); onChange({ ...n, model: a.model }, openingFor(n)); }}>
            {(Object.keys(applianceKinds) as ApplianceKind[]).filter((k) => k !== 'masonry').map((k) => <option key={k} value={k}>{applianceKinds[k].label}</option>)}
          </select>
        </Field>
        <Field label="Make & model" htmlFor="ap-model"><input id="ap-model" value={a.model ?? ''} placeholder="From the spec sheet" onChange={(e) => put({ model: e.target.value || undefined })} /></Field>
      </div>
      <Field label="Common sizes" htmlFor="ap-preset">
        <select id="ap-preset" value="" onChange={(e) => {
          const pr = appliancePresets[Number(e.target.value)];
          if (pr) { const n: Appliance = { kind: pr.kind, model: pr.model, source: pr.note, ...pr.size }; onChange(n, openingFor(n)); }
        }}>
          <option value="">Pick a size to fill these in…</option>
          {appliancePresets.map((pr, i) => pr.kind === a.kind ? <option key={i} value={i}>{pr.label}</option> : null)}
        </select>
      </Field>
      {a.source && <p className="hint">{a.source}.</p>}
      <div className="grid3">
        {len('w', 'Width')}{len('h', 'Height')}{len('d', 'Depth')}
        {len('side', 'Clear each side')}{len('top', 'Clear above')}{len('back', 'Clear behind')}
      </div>
      <div className="grid2">
        <Field label="Sits" htmlFor="ap-mount">
          <select id="ap-mount" value={a.mount} onChange={(e) => put({ mount: e.target.value as Appliance['mount'] })}>
            <option value="shelf">Back on an open shelf</option>
            <option value="flush">Flush, face or trim at the face frame</option>
          </select>
        </Field>
        {Math.abs(openingH - fit) > 0.01 && <button className="mini" style={{ alignSelf: 'end' }} onClick={() => onChange(a, fit)}>Size the opening to it ({fmt(fit)} high)</button>}
      </div>
      <ModelField a={a} onChange={(n) => onChange(n, n.h !== a.h || n.top !== a.top ? openingFor(n) : undefined)} />
      <p className="hint">{applianceKinds[a.kind].note}. Sizes are typical until you have the spec sheet.</p>
      {problems.map((p) => <p key={p} className="warn">{p}</p>)}
    </div>
  );
}

/** A fireplace surround: the firebox and its opening, legs, frieze, shelf, corbels and pediment. */
function MantelSection({ cab, set }: { cab: Cabinet; set: (patch: Partial<Cabinet>) => void }) {
  const m = mantelOf(cab);
  const project = useStore((s) => s.project);
  const jobPilaster = project.cabinets.find((c) => c.kind === 'pilaster' && c.pilaster);
  const pilBuild = m.legs === 'pilaster' && m.legBuild === 'pilaster';
  // The ceiling trim: the underside of the coffered ceiling's perimeter fascia, or the ceiling
  const ceil = cofferOf(project);
  const trimY = project.room.height - (ceil.on && ceil.perimeter ? ceil.drop : 0);
  const soffitW = ceil.on && ceil.perimeter ? perimOf(ceil, cab.wall) : 0;
  const legW = legWidth(cab, m);
  // Changing the opening keeps the legs the same width, so the overall width follows
  // Sized from the insert out: the legs keep their width and the frieze its height, so changing the
  // opening (or the facing, or how high it sits) moves the overall width and the shelf with it
  const frieze = friezeHeight(cab, m);
  const put = (patch: Partial<MantelSpec>, keepLegs = true) => {
    const next = { ...m, ...patch };
    if (!keepLegs) { set({ mantel: next }); return; }
    const width = widthFor(next, legW);
    // Grow or shrink about its center, so it stays where it was placed (centered between the doors)
    set({ mantel: next, width, offset: cab.offset + (cab.width - width) / 2, height: shelfFor(next, frieze) });
  };
  const len = (k: 'hearthFront' | 'hearthSide' | 'hearthThickness' | 'openingW' | 'openingH' | 'openingY' | 'margin' | 'legProud' | 'plinth' | 'capital' | 'blockProud' | 'shelfThickness' | 'shelfDepth' | 'shelfOverhang' | 'corbelW' | 'corbelH' | 'pedimentH', label: string) => (
    <Field label={label} htmlFor={`mt-${k}`}><LengthInput id={`mt-${k}`} value={m[k]} onChange={(v) => put({ [k]: v ?? 0 })} /></Field>
  );
  const fires = appliancePresets.filter((pr) => pr.kind === 'fireplace' || pr.kind === 'gasInsert');
  const setFuel = (fuel: Fuel) => {
    if (fuel === 'wood') put({ fuel, install: 'masonry', margin: Math.max(m.margin, 6), openingY: 0 });
    else put({ fuel, margin: 0, insert: m.insert && (fuel === 'gas') === (m.insert.kind === 'gasInsert') ? m.insert : { kind: fuel === 'gas' ? 'gasInsert' : 'fireplace', ...applianceKinds[fuel === 'gas' ? 'gasInsert' : 'fireplace'].size } });
  };
  const clear = mantelClearances(cab);
  return (
    <>
      <Section title="Firebox">
        <div className="grid2">
          <Field label="Firebox" htmlFor="mt-fuel">
            <select id="mt-fuel" value={m.fuel} onChange={(e) => setFuel(e.target.value as Fuel)}>
              {(Object.keys(fuelLabel) as Fuel[]).map((f) => <option key={f} value={f}>{fuelLabel[f]}</option>)}
            </select>
          </Field>
          {m.fuel !== 'wood' && (
            <Field label="Common inserts" htmlFor="mt-insert">
              <select id="mt-insert" value="" onChange={(e) => {
                const pr = fires[Number(e.target.value)];
                if (pr) put({ fuel: pr.kind === 'gasInsert' ? 'gas' : 'electric', openingW: pr.size.w, openingH: pr.size.h, insert: { kind: pr.kind, model: pr.model, source: pr.note, ...pr.size } });
              }}>
                <option value="">Pick one to size the opening…</option>
                {fires.map((pr, i) => <option key={i} value={i}>{pr.label}</option>)}
              </select>
            </Field>
          )}
        </div>
        {m.fuel !== 'wood' && m.insert && (
          <div className="grid3">
            <Field label="Insert model" htmlFor="mt-model"><input id="mt-model" value={m.insert.model ?? ''} placeholder="From the manual" onChange={(e) => put({ insert: { ...m.insert!, model: e.target.value || undefined } })} /></Field>
            <Field label="Insert depth" htmlFor="mt-idepth"><LengthInput id="mt-idepth" value={m.insert.d} onChange={(v) => put({ insert: { ...m.insert!, d: v ?? 0, source: undefined } })} /></Field>
          </div>
        )}
        {m.insert?.source && m.fuel !== 'wood' && <p className="hint">{m.insert.source}.</p>}
        {m.fuel !== 'wood' && m.insert && <ModelField a={m.insert} onChange={(n) => put(n.w !== m.insert!.w || n.h !== m.insert!.h ? { insert: n, openingW: n.w, openingH: n.h } : { insert: n })} />}
        <div className="grid3">
          {len('openingW', 'Opening width')}
          {len('openingH', 'Opening height')}
          {len('openingY', 'Off the floor')}
          {len('margin', m.fuel === 'wood' ? 'Facing to surround' : 'Gap to surround')}
          <Field label="Frieze height" htmlFor="mt-frieze"><LengthInput id="mt-frieze" value={frieze} onChange={(v) => set({ height: shelfFor(m, v ?? 0) })} /></Field>
        </div>
        <p className="hint">Worked out from the insert: {fmt(m.openingW)} opening + {fmt(m.margin)} facing each side + {fmt(legW)} legs = <b>{fmt(cab.width)} wide</b>; shelf top at <b>{fmt(cab.height)}</b> ({fmt(m.openingY)} off the floor + {fmt(m.openingH)} opening + {fmt(m.margin)} facing + {fmt(frieze)} frieze + {fmt(m.shelfThickness)} shelf).{m.insert?.top ? ` The manual wants ${fmt(m.insert.top)} clear above the insert${m.margin < m.insert.top ? ': raise the facing gap to that' : ''}.` : ''}</p>
        {m.fuel !== 'electric' && (
          <Field label="Fireplace" htmlFor="mt-install">
            <select id="mt-install" value={m.install} onChange={(e) => put({ install: e.target.value as MantelSpec['install'] })}>
              <option value="masonry">{m.fuel === 'gas' ? 'Insert in an existing masonry fireplace' : 'Masonry fireplace'}</option>
              <option value="factory">{m.fuel === 'gas' ? 'Direct-vent / zero-clearance gas fireplace' : 'Factory-built (listed) fireplace'}</option>
            </select>
          </Field>
        )}
        {usesMasonryRules(m) && (
          <>
            <div className="grid3">
              {len('hearthFront', 'Hearth, in front')}
              {len('hearthSide', 'Hearth, past each side')}
              {len('hearthThickness', 'Hearth thickness')}
            </div>
            <p className="hint">Needed: {(() => { const h = hearthRequired(m); return `${fmt(h.front)} in front and ${fmt(h.side)} past each side${h.big ? ' (opening is 6 sq ft or more)' : ''}, 2" thick`; })()}.</p>
          </>
        )}
        {usesListing(m) && (
          <details className="overrides" open={needsManualChart(m)}>
            <summary>Mantel clearances from the manual{needsManualChart(m) && <span className="badge-on">not entered</span>}</summary>
            <p className="hint">Copy these from the {m.fuel === 'wood' ? 'fireplace' : 'insert'}'s installation manual. Each row: trim and mantel at least this far above the opening top can project up to this much.</p>
            <div className="grid2">
              <Field label="Trim beside the opening" htmlFor="mt-side"><LengthInput id="mt-side" value={m.manual.sideGap} onChange={(v) => put({ manual: { ...m.manual, sideGap: v ?? 0 } })} /></Field>
            </div>
            {m.manual.rows.map((r, i) => (
              <div key={i} className="grid3">
                <Field label="At least above opening" htmlFor={`mt-r${i}a`}><LengthInput id={`mt-r${i}a`} value={r.above} onChange={(v) => put({ manual: { ...m.manual, rows: m.manual.rows.map((x, j) => (j === i ? { ...x, above: v ?? 0 } : x)) } })} /></Field>
                <Field label="Projects up to" htmlFor={`mt-r${i}d`}><LengthInput id={`mt-r${i}d`} value={r.maxDepth} onChange={(v) => put({ manual: { ...m.manual, rows: m.manual.rows.map((x, j) => (j === i ? { ...x, maxDepth: v ?? 0 } : x)) } })} /></Field>
                <button className="mini" style={{ alignSelf: 'end' }} onClick={() => put({ manual: { ...m.manual, rows: m.manual.rows.filter((_, j) => j !== i) } })}>Remove</button>
              </div>
            ))}
            <button className="mini" onClick={() => put({ manual: { ...m.manual, rows: [...m.manual.rows, { above: 12, maxDepth: 2 }] } })}>Add a row from the chart</button>
          </details>
        )}
        {clear.map((w) => <p key={w} className="warn">{w}</p>)}
        <details className="overrides">
          <summary>Code basis</summary>
          <ul className="hint">{mantelCodeBasis(m).map((t) => <li key={t}>{t}</li>)}</ul>
          <p className="hint">Checked against the 2021 IRC as adopted in Massachusetts (780 CMR 51.00, 10th edition). The building inspector's reading governs.</p>
        </details>
      </Section>
      <Section title="Legs & shelf">
        <div className="grid3">
          <Field label="Legs" htmlFor="mt-legs">
            <select id="mt-legs" value={m.legs} onChange={(e) => put({ legs: e.target.value as MantelSpec['legs'] })}>
              <option value="pilaster">Pilasters, proud of the frieze</option>
              <option value="flat">Flat legs</option>
              <option value="none">No legs (shelf only)</option>
            </select>
          </Field>
          {m.legs !== 'none' && <Field label="Leg width" htmlFor="mt-legw"><LengthInput id="mt-legw" value={legW} onChange={(v) => { const width = widthFor(m, v ?? 0); set({ width, offset: cab.offset + (cab.width - width) / 2 }); }} /></Field>}
          {m.legs === 'pilaster' && len('legProud', 'Proud of frieze')}
          {m.legs === 'pilaster' && (
            <Field label="Built as" htmlFor="mt-build">
              <select id="mt-build" value={m.legBuild} onChange={(e) => {
                const legBuild = e.target.value as MantelSpec['legBuild'];
                // Same build as the job's pilasters, when there are some
                const like = jobPilaster?.pilaster;
                put({ legBuild, ...(legBuild === 'pilaster' && like && !Object.keys(m.pilaster).length ? { pilaster: { ...like, breaks: [] } } : {}) });
              }}>
                <option value="boxed">Boxed legs</option>
                <option value="pilaster">{jobPilaster ? `Like the ${jobPilaster.name} pilasters` : 'Frame-and-panel pilasters'}</option>
              </select>
            </Field>
          )}
          {m.legs !== 'none' && !pilBuild && len('plinth', 'Plinth height')}
          {m.legs !== 'none' && !pilBuild && len('capital', 'Capital height')}
          {m.legs !== 'none' && !pilBuild && len('blockProud', 'Blocks proud')}
          {pilBuild && (['plinth', 'capital', 'stile', 'rail'] as const).map((k) => (
            <Field key={k} label={{ plinth: 'Plinth (0 = none)', capital: 'Capital height', stile: 'Pilaster stiles', rail: 'Pilaster rails' }[k]} htmlFor={`mt-p-${k}`}>
              <LengthInput id={`mt-p-${k}`} value={m.pilaster[k] ?? defaultPilaster[k]} onChange={(v) => put({ pilaster: { ...m.pilaster, [k]: v ?? 0 } })} />
            </Field>
          ))}
          {len('shelfThickness', 'Shelf thickness')}
          {len('shelfDepth', 'Shelf depth')}
          {len('shelfOverhang', 'Shelf past legs')}
        </div>
        <p className="hint">Width is the outside of the legs; height is the top of the shelf; depth is the wall to the frieze face.</p>
      </Section>
      <Section title="Chimney & full height">
        <label className="chk-row"><input type="checkbox" checked={m.chimney} onChange={(e) => put({ chimney: e.target.checked })} /> Faux chimney behind it, framed out to the frieze ({fmt(cab.depth - m.stock)} from the wall)</label>
        {m.chimney && soffitW > 0 && Math.abs(cab.depth - soffitW) > 0.01 && (
          <p className="hint">The ceiling soffit on this wall is {fmt(soffitW)} wide. <button className="link-btn" onClick={() => set({ depth: soffitW })}>Bring the frieze out to it</button> so the chimney lines up with the fascia.</p>
        )}
        <label className="chk-row"><input type="checkbox" checked={m.upper.on} onChange={(e) => put({ upper: { ...m.upper, on: e.target.checked, top: m.upper.top > cab.height ? m.upper.top : trimY } })} /> Full height above the shelf: pilasters over the legs and a panel between them</label>
        {m.upper.on && (
          <div className="grid3">
            <Field label="Up to" htmlFor="mt-utop"><LengthInput id="mt-utop" value={m.upper.top} onChange={(v) => put({ upper: { ...m.upper, top: v ?? 0 } })} /></Field>
            <Field label="Pilaster base" htmlFor="mt-uplinth"><LengthInput id="mt-uplinth" value={m.upper.plinth} onChange={(v) => put({ upper: { ...m.upper, plinth: v ?? 0 } })} /></Field>
            <Field label="Panel stiles" htmlFor="mt-ust"><LengthInput id="mt-ust" value={m.upper.frameStile} onChange={(v) => put({ upper: { ...m.upper, frameStile: v ?? 3 } })} /></Field>
            <Field label="Panel rails" htmlFor="mt-url"><LengthInput id="mt-url" value={m.upper.frameRail} onChange={(v) => put({ upper: { ...m.upper, frameRail: v ?? 3.5 } })} /></Field>
          </div>
        )}
        {m.upper.on && Math.abs(m.upper.top - trimY) > 0.01 && <p className="hint">The ceiling trim is at {fmt(trimY)}. <button className="link-btn" onClick={() => put({ upper: { ...m.upper, top: trimY } })}>Run it up to there</button></p>}
      </Section>
      <Section title="Base wrap">
        <div className="grid3">
          <Field label="Baseboard" htmlFor="mt-bh"><LengthInput id="mt-bh" value={m.baseH} onChange={(v) => put({ baseH: v ?? 0 })} /></Field>
          <Field label="Base cap" htmlFor="mt-bch"><LengthInput id="mt-bch" value={m.baseCapH} onChange={(v) => put({ baseCapH: v ?? 0 })} /></Field>
          <Field label="Thickness" htmlFor="mt-bt"><LengthInput id="mt-bt" value={m.baseT} onChange={(v) => put({ baseT: v ?? 0.75 })} /></Field>
        </div>
        <p className="hint">The room's baseboard, wrapped around the chimney sides, the plinths and across the front. 0 = none.</p>
      </Section>
      <Section title="Corbels & pediment">
        <div className="grid3">
          <Field label="Corbels" htmlFor="mt-corbels">
            <select id="mt-corbels" value={m.corbels} onChange={(e) => put({ corbels: Number(e.target.value) as MantelSpec['corbels'] })}>
              <option value={0}>None</option>
              <option value={2}>2, one on each leg</option>
              <option value={4}>4, two on each leg</option>
            </select>
          </Field>
          {m.corbels > 0 && len('corbelW', 'Corbel width')}
          {m.corbels > 0 && len('corbelH', 'Corbel height')}
          <Field label="Pediment" htmlFor="mt-ped">
            <select id="mt-ped" value={m.pediment} onChange={(e) => put({ pediment: e.target.value as MantelSpec['pediment'] })}>
              <option value="none">None</option>
              <option value="triangle">Triangle</option>
              <option value="arch">Arched</option>
            </select>
          </Field>
          {m.pediment !== 'none' && len('pedimentH', 'Pediment height')}
        </div>
        <Field label="Species" htmlFor="mt-sp"><input id="mt-sp" value={m.species} onChange={(e) => put({ species: e.target.value || 'Poplar' })} /></Field>
      </Section>
    </>
  );
}

/** Fit a cabinet into its stretch of wall, or make its whole run equal widths, instead of working the numbers out. */
function FitButtons({ cab }: { cab: Cabinet }) {
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  if (cab.corner || cab.kind === 'shelf' || cab.island) return null;
  const { room, cabinets, settings } = project;
  const same = (a: Pick<Cabinet, 'offset' | 'width'>) => Math.abs(a.width - cab.width) < 1 / 32 && Math.abs(a.offset - cab.offset) < 1 / 32;
  const fills = (['right', 'left', 'both'] as const).map((side) => ({ side, to: fillSpan(room, cabinets, cab, settings, side) }))
    .filter((f, i, all) => f.to.width >= 6 && !same(f.to) && all.findIndex((g) => Math.abs(g.to.width - f.to.width) < 1 / 32 && Math.abs(g.to.offset - f.to.offset) < 1 / 32) === i);
  const run = runOf(cabinets, cab);
  const even = run.length > 1 ? evenRun(room, cabinets, cab, settings) : null;
  const evenW = even ? [...new Set(run.map((r) => fmt(even.get(r.id)!.width)))] : [];
  const evenChanges = even && run.some((r) => { const n = even.get(r.id)!; return Math.abs(n.width - r.width) > 1 / 32 || Math.abs(n.offset - r.offset) > 1 / 32; });
  const apply = (moves: Map<string, Pick<Cabinet, 'offset' | 'width'>>) => commit((p) => ({ ...p, cabinets: p.cabinets.map((c) => (moves.has(c.id) ? { ...c, ...moves.get(c.id)! } : c)) }));
  const label = { right: 'Fill to the right', left: 'Fill to the left', both: 'Fill the space' };
  if (!fills.length && !evenChanges) return null;
  return (
    <div className="order-actions" style={{ marginTop: 6 }}>
      {fills.map((f) => (
        <button key={f.side} className="mini" title="Widen or narrow it to meet the cabinet or wall beside it, end panels counted" onClick={() => apply(new Map([[cab.id, f.to]]))}>
          {label[f.side]}: {fmt(f.to.width)} wide
        </button>
      ))}
      {evenChanges && (
        <button className="mini" title={`${run.map((r) => r.name).join(', ')}: equal widths filling the wall between whatever bounds the run; anything between them (pilasters) keeps its width`} onClick={() => apply(even!)}>
          Make the {run.length} {cab.kind === 'wall' ? 'uppers' : cab.kind === 'base' ? 'bases' : 'cabinets'} in this run equal: {evenW.join(' / ')}
        </button>
      )}
    </div>
  );
}
