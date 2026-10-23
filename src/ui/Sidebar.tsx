import { useState } from 'react';
import { useStore } from '../store';
import { presets } from '../model/defaults';
import { newPanel, panelAbove } from '../model/panels';
import { amSpecies } from '../model/moldings';
import { wallNames, wallOrder } from '../model/layout';
import type { PanelMode, ShopSettings, WallId } from '../model/types';
import { RoomDetails } from './RoomDetails';
import { fmt } from '../units';
import { centerPanels, doorMaterials, doorStyles, hingeTypes, outsideEdges, panelLabel, sideThicknesses, slides, stileWidths, styleById, type HingeType, type OutsideEdge } from '../model/eagle';
import { realOverhang } from '../model/parts';
import { Field, LengthInput, Section } from './fields';

type Tab = 'add' | 'room' | 'shop';

export function Sidebar() {
  const [tab, setTab] = useState<Tab>('add');
  return (
    <aside className="sidebar">
      <nav className="tabs" role="tablist">
        {(['add', 'room', 'shop'] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t === 'add' ? 'Cabinets' : t === 'room' ? 'Room' : 'Shop standards'}
          </button>
        ))}
      </nav>
      <div className="side-body">
        {tab === 'add' && <Library />}
        {tab === 'room' && <RoomPanel />}
        {tab === 'shop' && <ShopPanel />}
      </div>
    </aside>
  );
}

function Library() {
  const view = useStore((s) => s.view);
  const add = useStore((s) => s.addFromPreset);
  const addBeadboard = () => {
    const st = useStore.getState();
    const cab = st.project.cabinets.find((c) => c.id === st.selectedId);
    st.addPanel(cab ? panelAbove(st.project, cab) : newPanel(wall, 0, 48, 18.5, 30, st.project.panels ?? []));
  };
  const [wall, setWall] = useState<WallId>(view.startsWith('elev-') ? (view.slice(5) as WallId) : 'back');
  const groups = [
    { kind: 'base', title: 'Base', corner: false },
    { kind: 'wall', title: 'Wall', corner: false },
    { kind: 'tall', title: 'Tall', corner: false },
    { kind: 'corner', title: 'Corners', corner: true },
    { kind: 'mudroom', title: 'Mudroom & built-ins', corner: true },
    { kind: 'library', title: 'Library & pilasters', corner: true },
  ] as const;
  return (
    <div>
      <Field label="Add to" htmlFor="lib-wall">
        <select id="lib-wall" value={wall} onChange={(e) => setWall(e.target.value as WallId)}>
          {wallOrder.map((w) => <option key={w} value={w}>{wallNames[w]}</option>)}
        </select>
      </Field>
      <p className="hint">New cabinets go in the first open spot on that wall. Corner cabinets go in whichever corner of it is free.</p>
      {groups.map((g) => (
        <Section key={g.kind} title={g.title}>
          <div className="lib">
            {presets.filter((p) => (g.corner ? p.group === g.kind : p.kind === g.kind && !p.group)).map((p) => (
              <button key={p.id} className="lib-item" onClick={() => add(p.id, wall)}>
                <PresetGlyph rows={p.rows().map((r) => ({ type: r.type, doors: r.doors, h: r.height }))} w={p.width} h={p.height} kind={p.kind} />
                <span className="lib-text">
                  <span>{p.label}</span>
                  <span className="muted mono">{fmt(p.width)} × {fmt(p.height)} × {fmt(p.depth)}</span>
                </span>
              </button>
            ))}
          </div>
        </Section>
      ))}
      <Section title="Wall finishes">
        <button className="lib-item" onClick={addBeadboard}>
          <svg className="glyph" width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
            <rect x="6" y="10" width="32" height="24" className="g-frame" />
            {[10, 14, 18, 22, 26, 30, 34].map((x) => <line key={x} x1={x} x2={x} y1="10" y2="34" className="g-bead" />)}
            <rect x="5" y="8" width="34" height="3" className="g-door" />
          </svg>
          <span className="lib-text">
            <span>Beadboard backsplash</span>
            <span className="muted">Above the selected cabinet, up to the upper</span>
          </span>
        </button>
      </Section>
    </div>
  );
}

/** A tiny front elevation of the preset, so the library reads like a catalog page. */
function PresetGlyph({ rows, w, h, kind }: { rows: { type: string; doors: number; h: number | null }[]; w: number; h: number; kind: string }) {
  const scale = 40 / Math.max(h, 34.5);
  const W = Math.max(14, w * scale);
  const H = h * scale;
  // Pilasters and floating shelves have no toe kick or face frame openings
  const kick = kind === 'base' || kind === 'tall' ? 4 * scale : 0;
  const fixed = rows.reduce((s, r) => s + (r.h ?? 0), 0) * scale;
  const autos = rows.filter((r) => r.h == null).length || 1;
  const inner = H - kick - 3;
  const autoH = Math.max(2, (inner - fixed - (rows.length - 1) * 1.2) / autos);
  let y = 1.5;
  return (
    <svg className="glyph" width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
      <g transform={`translate(${(44 - W) / 2} ${(44 - H) / 2})`}>
      <rect x="0" y="0" width={W} height={Math.max(1, H - kick)} className="g-frame" />
      {kick > 0 && <rect x="1.5" y={H - kick} width={W - 3} height={kick} className="g-kick" />}
      {rows.map((r, i) => {
        const rh = r.h != null ? r.h * scale : autoH;
        const el = [];
        if (r.type === 'open') el.push(<rect key={i} x="1.5" y={y} width={W - 3} height={rh} className="g-open" />);
        else if (r.type === 'doors' && r.doors === 2) {
          el.push(<rect key={`${i}a`} x="1" y={y - 0.5} width={W / 2 - 1.2} height={rh + 1} className="g-door" />);
          el.push(<rect key={`${i}b`} x={W / 2 + 0.2} y={y - 0.5} width={W / 2 - 1.2} height={rh + 1} className="g-door" />);
        } else el.push(<rect key={i} x="1" y={y - 0.5} width={W - 2} height={rh + 1} className="g-door" />);
        y += rh + 1.2;
        return el;
      })}
      </g>
    </svg>
  );
}

function RoomPanel() {
  const room = useStore((s) => s.project.room);
  const finishes = useStore((s) => s.project.finishes);
  const name = useStore((s) => s.project.name);
  const commit = useStore((s) => s.commit);
  return (
    <div>
      <Section title="Project">
        <Field label="Job name" htmlFor="proj-name">
          <input id="proj-name" value={name} onChange={(e) => commit((p) => ({ ...p, name: e.target.value }))} />
        </Field>
      </Section>
      <Section title="Room size">
        <div className="grid3">
          <Field label="Back wall" htmlFor="room-w"><LengthInput id="room-w" value={room.width} min={24} onChange={(v) => commit((p) => ({ ...p, room: { ...p.room, width: v! } }))} /></Field>
          <Field label="Side walls" htmlFor="room-d"><LengthInput id="room-d" value={room.depth} min={24} onChange={(v) => commit((p) => ({ ...p, room: { ...p.room, depth: v! } }))} /></Field>
          <Field label="Ceiling" htmlFor="room-h"><LengthInput id="room-h" value={room.height} min={60} onChange={(v) => commit((p) => ({ ...p, room: { ...p.room, height: v! } }))} /></Field>
        </div>
        <p className="hint">Rectangular rooms for now. Feet work too: type 13' or 13' 4".</p>
      </Section>
      <Section title="Finishes">
        <div className="swatches">
          {([['paint', 'Paint / stain'], ['box', 'Case interior'], ['counter', 'Stone top'], ['wood', 'Solid wood'], ['wall', 'Walls'], ['trim', 'Room trim']] as const).map(([k, label]) => (
            <label key={k} className="swatch" htmlFor={`fin-${k}`}>
              <input id={`fin-${k}`} type="color" value={finishes[k] ?? (k === 'wall' ? '#f1efea' : k === 'trim' ? '#f7f5ef' : '#b9875a')} onChange={(e) => commit((p) => ({ ...p, finishes: { ...p.finishes, [k]: e.target.value } }))} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </Section>
      <RoomDetails />
    </div>
  );
}

type NumKey = { [K in keyof ShopSettings]: ShopSettings[K] extends number ? K : never }[keyof ShopSettings];
const shopFields: { title: string; fields: [NumKey, string][] }[] = [
  { title: 'Case', fields: [
    ['boxThickness', 'Case stock, nominal'], ['boxActualThickness', 'Case stock, actual'],
    ['dadoDepth', 'Dado & rabbet depth'], ['bottomReveal', 'Bottom below rail'],
    ['backThickness', 'Back'], ['backRabbetWidth', 'Back rabbet width'],
    ['stretcherWidth', 'Stretcher width'], ['ffOverhang', 'Extra overhang per side'],
  ] },
  { title: 'Face frame', fields: [['ffThickness', 'Thickness'], ['stileWidth', 'Stile width'], ['topRailWidth', 'Top rail'], ['bottomRailWidth', 'Bottom rail'], ['midRailWidth', 'Mid rail']] },
  { title: 'Toe kick', fields: [['toeKickHeight', 'Height'], ['toeKickDepth', 'Finished depth'], ['toeKickSkin', 'Skin (applied at install)']] },
  { title: 'Shelves & counters', fields: [['shelfClearance', 'Shelf clearance (total)'], ['shelfSetback', 'Shelf setback'], ['counterThickness', 'Counter thickness'], ['counterOverhang', 'Counter overhang']] },
];

function ShopPanel() {
  const settings = useStore((s) => s.project.settings);
  const commit = useStore((s) => s.commit);
  const set = (patch: Partial<ShopSettings>) => commit((p) => ({ ...p, settings: { ...p.settings, ...patch } }));
  const style = styleById(settings.doorStyleId);
  const panelOptions = (['MDF', 'Veneer', 'Wood'] as const).map((line) => (
    <optgroup key={line} label={line === 'MDF' ? 'MDF (paint grade)' : line === 'Veneer' ? 'Veneer (stained)' : 'Solid wood'}>
      {centerPanels.filter((c) => c.line === line).map((c) => <option key={c.code} value={c.code}>{c.code} {c.name}</option>)}
    </optgroup>
  ));
  const sample = 21;
  const cut = sample - 2 * settings.ffOverhang - 2 * settings.boxThickness + 2 * settings.dadoDepth;
  return (
    <div>
      <p className="hint">How you build. Every cabinet and every part size comes from these numbers, and changes apply to the whole job.</p>

      <Section title="Doors & fronts (Eagle Woodworking)">
        <Field label="Style (framing bead)" htmlFor="door-style">
          <select id="door-style" value={settings.doorStyleId} onChange={(e) => {
            const next = styleById(e.target.value);
            set({ doorStyleId: next.id, doorStile: next.fixedStile ? next.stile : settings.doorStile, doorMaterial: next.line === 'MDF' ? 'MDF' : settings.doorMaterial === 'MDF' ? 'Paint-grade maple' : settings.doorMaterial });
          }}>
            {(['MDF', 'Wood', 'Any'] as const).map((line) => (
              <optgroup key={line} label={line === 'Any' ? 'Other' : `${line} styles`}>
                {doorStyles.filter((d) => d.line === line).map((d) => <option key={d.id} value={d.id}>{d.bead ? `${d.name} (${d.bead})` : d.name}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>
        <div className="style-card">
          <strong>{style.name}{style.verify && <span className="badge">Check with Eagle</span>}</strong>
          {style.detail}
        </div>
        <div className="grid2" style={{ marginTop: 8 }}>
          <Field label="Material" htmlFor="door-mat">
            <select id="door-mat" value={style.line === 'MDF' ? 'MDF' : settings.doorMaterial} disabled={style.line === 'MDF'} onChange={(e) => set({ doorMaterial: e.target.value })}>
              {doorMaterials.filter((m) => style.line !== 'Wood' || m !== 'MDF').map((m) => <option key={m}>{m}</option>)}
            </select>
          </Field>
          {style.profile !== 'slab' && (
            <Field label="Rail & stile width" htmlFor="door-stile">
              <select id="door-stile" value={style.fixedStile ? style.stile : settings.doorStile} disabled={style.fixedStile} onChange={(e) => set({ doorStile: Number(e.target.value) })}>
                {(style.fixedStile ? [style.stile] : stileWidths).map((w) => <option key={w} value={w}>{fmt(w)}</option>)}
              </select>
            </Field>
          )}
          {style.panelChoice && (
            <Field label="Center panel" htmlFor="door-panel">
              <select id="door-panel" value={settings.centerPanel} onChange={(e) => set({ centerPanel: e.target.value })}>
                {panelOptions}
              </select>
            </Field>
          )}
          {style.panelChoice && (
            <Field label="Drawer front panel" htmlFor="door-fpanel">
              <select id="door-fpanel" value={settings.frontPanel} onChange={(e) => set({ frontPanel: e.target.value })}>
                {panelOptions}
              </select>
            </Field>
          )}
          {style.profile !== 'slab' && (
            <Field label="Outside edge" htmlFor="door-edge">
              <select id="door-edge" value={settings.outsideEdge} onChange={(e) => set({ outsideEdge: e.target.value as OutsideEdge })}>
                {outsideEdges.map((x) => <option key={x.code} value={x.code}>{x.code} {x.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Hinges" htmlFor="door-hinge">
            <select id="door-hinge" value={settings.hingeType} onChange={(e) => set({ hingeType: e.target.value as HingeType })}>
              {(Object.keys(hingeTypes) as HingeType[]).map((k) => <option key={k} value={k}>{hingeTypes[k].name} ({hingeTypes[k].boring.slice(0, 4)} boring)</option>)}
            </select>
          </Field>
          <Field label="Drawer fronts" htmlFor="door-dfront">
            <select id="door-dfront" value={settings.drawerFronts} onChange={(e) => set({ drawerFronts: e.target.value as 'match' | 'slab' })}>
              <option value="match">Match doors</option>
              <option value="slab">Slab</option>
            </select>
          </Field>
        </div>
        <p className="hint">Drawer fronts under 6 1/2" tall get 1 1/2" rails, as Eagle builds them. Anything too short even for that goes on the order as a slab.</p>
      </Section>

      <Section title="Door mounting">
        <Field label="Doors & fronts" htmlFor="door-mount">
          <select id="door-mount" value={mountValue(settings)} onChange={(e) => {
            const v = e.target.value;
            // Inset end panels go with inset doors; applied panels with overlay
            const panel = v === 'inset' ? (settings.endPanel === 'none' ? 'none' : 'inset') : settings.endPanel === 'inset' ? 'flush' : settings.endPanel;
            if (v === 'inset') set({ doorMount: 'inset', endPanel: panel });
            else if (v === 'custom') set({ doorMount: 'overlay', endPanel: panel });
            else set({ doorMount: 'overlay', doorOverlay: Number(v), endPanel: panel });
          }}>
            <option value="1.25">1 1/4" overlay</option>
            <option value="0.5">1/2" overlay</option>
            <option value="inset">Inset</option>
            {mountValue(settings) === 'custom' && <option value="custom">{fmt(settings.doorOverlay)} overlay</option>}
          </select>
        </Field>
        <div className="grid2" style={{ marginTop: 8 }}>
          {settings.doorMount === 'overlay' ? (
            <>
              <Field label="Overlay" htmlFor="shop-doorOverlay"><LengthInput id="shop-doorOverlay" value={settings.doorOverlay} onChange={(v) => set({ doorOverlay: v! })} /></Field>
              <Field label="Gap between fronts" htmlFor="shop-doorGap"><LengthInput id="shop-doorGap" value={settings.doorGap} onChange={(v) => set({ doorGap: v! })} /></Field>
            </>
          ) : (
            <Field label="Reveal" htmlFor="shop-insetReveal"><LengthInput id="shop-insetReveal" value={settings.insetReveal} onChange={(v) => set({ insetReveal: v! })} /></Field>
          )}
          <Field label="Door thickness" htmlFor="shop-doorThickness"><LengthInput id="shop-doorThickness" value={settings.doorThickness} onChange={(v) => set({ doorThickness: v! })} /></Field>
        </div>
        <p className="hint">
          {settings.doorMount === 'overlay'
            ? 'Overlay applies at the outside of the face frame. Fronts that share a mid rail or center stile split it, leaving the gap between them. Pairs use Eagle’s formula: (opening + both overlays − gap) ÷ 2.'
            : 'Inset doors sit flush with the face frame, sized to the opening minus the reveal on every side. Drawer boxes get shorter by the front’s thickness.'}
        </p>
      </Section>

      <Section title="End panels & scribes">
        <Field label="Standard for exposed ends" htmlFor="shop-endPanel">
          <select id="shop-endPanel" value={settings.endPanel} onChange={(e) => set({ endPanel: e.target.value as PanelMode })}>
            {(Object.keys(panelLabel) as PanelMode[]).map((m) => <option key={m} value={m}>{panelLabel[m]}</option>)}
          </select>
        </Field>
        <div className="grid2" style={{ marginTop: 8 }}>
          {settings.endPanel === 'reveal' && (
            <Field label="Held back from door face" htmlFor="shop-epr"><LengthInput id="shop-epr" value={settings.endPanelReveal} onChange={(v) => set({ endPanelReveal: v! })} /></Field>
          )}
          <Field label="Panel thickness" htmlFor="shop-ept"><LengthInput id="shop-ept" value={settings.endPanelThickness} onChange={(v) => set({ endPanelThickness: v! })} /></Field>
          <Field label="Scribe allowance on extended stiles" htmlFor="shop-sa"><LengthInput id="shop-sa" value={settings.scribeAllowance} onChange={(v) => set({ scribeAllowance: v! })} /></Field>
        </div>
        {settings.endPanel === 'inset' && settings.doorMount === 'overlay' && (
          <p className="warn">Inset end panels with overlay doors. Fine if the customer wants it; individual cabinets can still be changed.</p>
        )}
        <p className="hint">End panels are ordered from Eagle in the door style and applied to the case side. Each cabinet can override this per end.</p>
      </Section>

      <Section title="Purchasing">
        <div className="grid2">
          <Field label="Sales tax you pay on materials %" htmlFor="shop-ptax">
            <input id="shop-ptax" inputMode="decimal" value={+(settings.purchaseTax * 100).toFixed(3)} onChange={(e) => set({ purchaseTax: (parseFloat(e.target.value) || 0) / 100 })} />
          </Field>
        </div>
        <p className="hint">Added to every material cost. Customers aren’t charged sales tax.</p>
      </Section>

      <Section title="Mouldings (Anderson & McQuaid)">
        <div className="grid2">
          <Field label="Species" htmlFor="shop-mspecies">
            <select id="shop-mspecies" value={settings.moldSpecies} onChange={(e) => set({ moldSpecies: e.target.value })}>
              {amSpecies.map((x) => <option key={x}>{x}</option>)}
            </select>
          </Field>
          <Field label="Waste %" htmlFor="shop-mwaste">
            <input id="shop-mwaste" inputMode="numeric" value={Math.round(settings.moldWaste * 100)} onChange={(e) => set({ moldWaste: (parseFloat(e.target.value) || 0) / 100 })} />
          </Field>
        </div>
      </Section>

      <Section title="Drawer boxes (Eagle dovetail)">
        <div className="grid2">
          <Field label="Slides" htmlFor="shop-slide">
            <select id="shop-slide" value={settings.drawerSlide} onChange={(e) => set({ drawerSlide: e.target.value })}>
              {slides.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              <option value="custom">Other (enter deductions)</option>
            </select>
          </Field>
          <Field label="Side thickness" htmlFor="shop-side">
            <select id="shop-side" value={settings.drawerSide} onChange={(e) => set({ drawerSide: Number(e.target.value) })}>
              {sideThicknesses.map((t) => <option key={t} value={t}>{fmt(t)}</option>)}
            </select>
          </Field>
          {settings.drawerSlide === 'custom' && (
            <>
              <Field label="Width: opening minus" htmlFor="shop-dw"><LengthInput id="shop-dw" value={settings.drawerWidthDeduction} onChange={(v) => set({ drawerWidthDeduction: v! })} /></Field>
              <Field label="Height: opening minus" htmlFor="shop-dh"><LengthInput id="shop-dh" value={settings.drawerHeightDeduction} onChange={(v) => set({ drawerHeightDeduction: v! })} /></Field>
            </>
          )}
          <Field label="Clearance at back" htmlFor="shop-rear"><LengthInput id="shop-rear" value={settings.drawerRearClearance} onChange={(v) => set({ drawerRearClearance: v! })} /></Field>
        </div>
        {settings.drawerSlide === 'tandem' && (
          <Field label="Tandem rear brackets (2 per drawer)" htmlFor="shop-rearbr">
            <select id="shop-rearbr" value={settings.tandemRearBrackets} onChange={(e) => set({ tandemRearBrackets: e.target.value as ShopSettings['tandemRearBrackets'] })}>
              <option value="overlay">Overlay drawers only</option>
              <option value="always">Always</option>
              <option value="never">Never</option>
            </select>
          </Field>
        )}
        <p className="hint">Boxes are sized from each face frame opening. The drawer calculator on the Eagle order tab runs the same math for a single opening.</p>
      </Section>

      {shopFields.map((g) => (
        <Section key={g.title} title={g.title}>
          <div className="grid2">
            {g.fields.map(([k, label]) => (
              <Field key={k} label={label} htmlFor={`shop-${k}`}>
                <LengthInput id={`shop-${k}`} value={settings[k]} onChange={(v) => set({ [k]: v! } as Partial<ShopSettings>)} />
              </Field>
            ))}
          </div>
          {g.title === 'Case' && (
            <p className="hint">
              Example: a {sample}" cabinet gets a bottom and stretchers cut at <span className="computed">{fmt(cut)}</span>. The thinner real plywood leaves the face frame
              overhanging each side by about <span className="computed">{fmt(realOverhang(settings))}</span>.
            </p>
          )}
          {g.title === 'Toe kick' && (
            <p className="hint">
              Cases are built with the kick <span className="computed">{fmt(settings.toeKickDepth + settings.toeKickSkin)}</span> deep on a scrap 3/4" nailer,
              so it finishes at {fmt(settings.toeKickDepth)} once the skin goes on.
            </p>
          )}
          {g.title === 'Case' && (
            <label className="checks" htmlFor="shop-rails">
              <span><input id="shop-rails" type="checkbox" checked={settings.hangingRails} onChange={(e) => set({ hangingRails: e.target.checked })} /> Hanging rails in wall & tall cabinets</span>
            </label>
          )}
        </Section>
      ))}
    </div>
  );
}

function mountValue(s: ShopSettings) {
  if (s.doorMount === 'inset') return 'inset';
  return s.doorOverlay === 1.25 || s.doorOverlay === 0.5 ? String(s.doorOverlay) : 'custom';
}
