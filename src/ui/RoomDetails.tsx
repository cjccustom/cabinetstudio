import { newTV, tvSize, tvSizes, tvsOf, type WallTV } from '../model/tv';
import { topThick } from '../model/parts';
import { PhotoRoomButton, ScanImportButton } from './PhotoRoom';
import { PlanImportButton } from './PlanImport';
import { CofferSection } from './CofferSection';
import { CeilingSlopesSection } from './CeilingSlopes';
import { LadderSection } from './LadderSection';
import { useState } from 'react';
import { useStore } from '../store';
import { doorOf } from '../model/doorOrder';
import { designByCode, stockSlab, tradeSize } from '../model/reeb';
import { DoorGlyph, DoorPicker } from './DoorPicker';
import type { Floor, Opening, OpeningTrim, RoomTrim, WallAccent, WallFinish, WallId } from '../model/types';
import { wallLength, wallNames, wallOrder } from '../model/layout';
import { accentHeightOf, defaultFloor, floorOf, inScope, newOpening, openingKinds, roomTrimOf } from '../model/room';
import { fmt } from '../units';
import { Field, LengthInput, Section } from './fields';
import { MoldSlot } from './ProfilePicker';
import { canSpots, lightsOf, type RoomLights } from '../model/lighting';
import { cofferOf } from '../model/coffer';

const floorKinds: Record<Floor['kind'], { label: string; size?: string; color: string; sizeDefault: number }> = {
  hardwood: { label: 'Hardwood', size: 'Plank width', color: '#b98b5e', sizeDefault: 3.25 },
  vinyl: { label: 'Vinyl plank', size: 'Plank width', color: '#a99377', sizeDefault: 7 },
  tile: { label: 'Tile', size: 'Tile size', color: '#d9d4cb', sizeDefault: 12 },
  carpet: { label: 'Carpet', color: '#9c968c', sizeDefault: 0 },
  concrete: { label: 'Concrete', color: '#a7a7a2', sizeDefault: 0 },
};

/** Doors, windows, room trim and flooring, on the Room tab. */
export function RoomDetails() {
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  const species = project.settings.moldSpecies;
  const openings = project.openings ?? [];
  const trim = roomTrimOf(project);
  const floor = floorOf(project);
  const putOpening = (id: string, patch: Partial<Opening>) => commit((p) => ({ ...p, openings: (p.openings ?? []).map((o) => (o.id === id ? { ...o, ...patch } : o)) }));
  const putTrim = (patch: Partial<RoomTrim>) => commit((p) => ({ ...p, roomTrim: { ...roomTrimOf(p), ...patch } }));
  const putFloor = (patch: Partial<Floor>) => commit((p) => ({ ...p, floor: { ...floorOf(p), ...patch } }));
  const putScope = (what: 'doors' | 'roomTrim', on: boolean) => commit((p) => ({ ...p, scope: { ...p.scope, [what]: on } }));
  const add = (kind: Opening['kind']) => commit((p) => ({ ...p, openings: [...(p.openings ?? []), newOpening(kind, 'back', p)] }));
  return (
    <>
      <Section title="Start from photos">
        <p className="hint">Photos of the existing space and your measurements: Claude drafts the room, doors, windows and trim for you to check.</p>
        <div className="order-actions"><PhotoRoomButton className="primary" /><ScanImportButton /><PlanImportButton /></div>
        <p className="hint">Room scan: from the CJC Room Scan app on your iPhone Pro (LiDAR), saved to Dropbox or AirDropped here. Chief plan: File → Export → Export DWG/DXF from the floor plan view.</p>
      </Section>
      <CeilingSlopesSection />
      <TVSection />
      <CofferSection />
      <LadderSection />
      <Section title="Doors & windows">
        <div className="order-actions">
          {(Object.keys(openingKinds) as Opening['kind'][]).map((k) => <button key={k} className="mini" onClick={() => add(k)}>Add {openingKinds[k].toLowerCase()}</button>)}
        </div>
        {openings.map((o) => <OpeningEditor key={o.id} o={o} species={species} put={(patch) => putOpening(o.id, patch)}
          remove={() => commit((p) => ({ ...p, openings: (p.openings ?? []).filter((x) => x.id !== o.id) }))} />)}
        {!openings.length && <p className="hint">Add the room’s doors and windows so cabinets, casing and trim fit around them.</p>}
        <ScopeToggle id="scope-doors" on={inScope(project, 'doors')} set={(v) => putScope('doors', v)}
          label="This job supplies and installs the doors"
          note="Off: doors are drawn for the design only. On: they go on the Orders tab, priced from Reeb’s catalog, with install labor in the quote." />
      </Section>

      <Section title="Room trim">
        <MoldSlot kind="roomCrown" num={trim.crown} species={species} onChange={(n) => putTrim({ crown: n })} extra={trim.crown && <button className="mini" onClick={() => putTrim({ crown: undefined })}>Remove</button>} />
        <MoldSlot kind="roomBase" num={trim.base} species={species} onChange={(n) => putTrim({ base: n })} extra={trim.base && <button className="mini" onClick={() => putTrim({ base: undefined })}>Remove</button>} />
        <MoldSlot kind="chairRail" num={trim.chairRail} species={species} onChange={(n) => putTrim({ chairRail: n })} extra={trim.chairRail && <button className="mini" onClick={() => putTrim({ chairRail: undefined })}>Remove</button>} />
        {trim.chairRail && (
          <Field label="Chair rail top, off the floor" htmlFor="rt-chair"><LengthInput id="rt-chair" value={trim.chairHeight} onChange={(v) => putTrim({ chairHeight: v ?? 34 })} /></Field>
        )}
        <div className="checks">
          {wallOrder.map((w) => (
            <label key={w} htmlFor={`rt-${w}`}>
              <input id={`rt-${w}`} type="checkbox" checked={trim.walls.includes(w)} onChange={(e) => putTrim({ walls: e.target.checked ? [...trim.walls, w] : trim.walls.filter((x) => x !== w) })} /> {wallNames[w]}
            </label>
          ))}
        </div>
        <p className="hint">Runs each wall corner to corner and stops at cabinets, panels and door casing; base and chair rail run under windows.</p>
        <ScopeToggle id="scope-trim" on={inScope(project, 'roomTrim')} set={(v) => putScope('roomTrim', v)}
          label="This job supplies and installs room trim & casing"
          note="Off: crown, base, chair rail and door and window casing are drawn for the design only. On: footage goes on the moulding orders, flat casing on the Solid wood list, and both into the quote under Room trim." />
      </Section>

      <WallsSection />

      <Section title="Floor">
        <div className="grid2">
          <Field label="Flooring" htmlFor="fl-kind">
            <select id="fl-kind" value={floor.kind} onChange={(e) => { const k = e.target.value as Floor['kind']; putFloor({ kind: k, color: floorKinds[k].color, size: floorKinds[k].sizeDefault || defaultFloor.size }); }}>
              {(Object.keys(floorKinds) as Floor['kind'][]).map((k) => <option key={k} value={k}>{floorKinds[k].label}</option>)}
            </select>
          </Field>
          {floorKinds[floor.kind].size && (
            <Field label={floorKinds[floor.kind].size!} htmlFor="fl-size"><LengthInput id="fl-size" value={floor.size} onChange={(v) => putFloor({ size: v ?? floor.size })} /></Field>
          )}
        </div>
        <label className="swatch" htmlFor="fl-color"><input id="fl-color" type="color" value={floor.color} onChange={(e) => putFloor({ color: e.target.value })} /><span>Floor color</span></label>
      </Section>

      <LightingSection />
    </>
  );
}

/** How the 3D view is lit: recessed cans the way the room will be, or plain daylight. */
/** TVs on the wall: size by the screen, centered over a cabinet or the space between, hung at a height. */
function TVSection() {
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  const tvs = tvsOf(project);
  const put = (id: string, patch: Partial<WallTV>) => commit((p) => ({ ...p, tvs: tvsOf(p).map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  const add = () => {
    // Over the widest gap between uppers on the back wall, else the middle of the wall, 48" up (or 8" over the tallest base there)
    const wall: WallId = 'back';
    const len = wallLength(project.room, wall);
    const bases = project.cabinets.filter((c) => c.wall === wall && c.kind === 'base');
    const top = bases.length ? Math.max(...bases.map((c) => c.elevation + c.height + (c.countertop ? topThick(c, project.settings.counterThickness) : 0))) : 0;
    commit((p) => ({ ...p, tvs: [...tvsOf(p), newTV(p, wall, len / 2, top ? top + 8 : 48)] }));
  };
  return (
    <Section title="TVs on the wall" aside={<button className="mini" onClick={add}>Add a TV</button>}>
      {!tvs.length && <p className="hint">Show the customer how a TV sits with the built-in: pick the screen size and it's drawn at about that set's real size, in 3D and on the elevations.</p>}
      {tvs.map((t) => {
        const { w, h } = tvSize(t);
        const cabs = project.cabinets.filter((c) => c.wall === t.wall).sort((a, b) => a.offset - b.offset);
        return (
          <div key={t.id} className="stock-row">
            <div className="sr-head">
              <input aria-label="Name" value={t.name} onChange={(e) => put(t.id, { name: e.target.value })} />
              <button className="icon-btn" aria-label={`Remove ${t.name}`} onClick={() => commit((p) => ({ ...p, tvs: tvsOf(p).filter((x) => x.id !== t.id) }))}>×</button>
            </div>
            <div className="grid3">
              <Field label="Screen size" htmlFor={`tv-s-${t.id}`}>
                <select id={`tv-s-${t.id}`} value={t.size} onChange={(e) => put(t.id, { size: Number(e.target.value), w: undefined, h: undefined })}>
                  {[...new Set([...tvSizes, t.size])].sort((a, b) => a - b).map((n) => <option key={n} value={n}>{n}"</option>)}
                </select>
              </Field>
              <Field label="Wall" htmlFor={`tv-w-${t.id}`}>
                <select id={`tv-w-${t.id}`} value={t.wall} onChange={(e) => put(t.id, { wall: e.target.value as WallId, center: wallLength(project.room, e.target.value as WallId) / 2 })}>
                  {wallOrder.map((x) => <option key={x} value={x}>{wallNames[x].replace(' wall', '')}</option>)}
                </select>
              </Field>
              <Field label="Bottom off floor" htmlFor={`tv-b-${t.id}`}><LengthInput id={`tv-b-${t.id}`} value={t.bottom} onChange={(v) => v != null && put(t.id, { bottom: v })} /></Field>
            </div>
            <div className="grid3">
              <Field label="Center from left" htmlFor={`tv-c-${t.id}`}><LengthInput id={`tv-c-${t.id}`} value={t.center} min={-1000} onChange={(v) => v != null && put(t.id, { center: v })} /></Field>
              <Field label="Center over" htmlFor={`tv-o-${t.id}`}>
                <select id={`tv-o-${t.id}`} value="" onChange={(e) => { const c = cabs.find((x) => x.id === e.target.value); if (c) put(t.id, { center: c.offset + c.width / 2 }); else if (e.target.value === 'wall') put(t.id, { center: wallLength(project.room, t.wall) / 2 }); }}>
                  <option value="">Pick…</option>
                  <option value="wall">Middle of the wall</option>
                  {cabs.map((c) => <option key={c.id} value={c.id}>{c.name} ({fmt(c.width)})</option>)}
                </select>
              </Field>
              <Field label="Off the wall" htmlFor={`tv-d-${t.id}`}><LengthInput id={`tv-d-${t.id}`} value={t.depth} onChange={(v) => v != null && put(t.id, { depth: v })} /></Field>
            </div>
            <details className="supplies">
              <summary>Size: {fmt(w)} × {fmt(h)}{t.w || t.h ? ' (from the spec sheet)' : ' (typical for the size)'}</summary>
              <div className="grid3">
                <Field label="Width, no stand" htmlFor={`tv-mw-${t.id}`}><LengthInput id={`tv-mw-${t.id}`} value={t.w ?? null} allowAuto placeholder={fmt(tvSize({ size: t.size }).w)} onChange={(v) => put(t.id, { w: v ?? undefined })} /></Field>
                <Field label="Height, no stand" htmlFor={`tv-mh-${t.id}`}><LengthInput id={`tv-mh-${t.id}`} value={t.h ?? null} allowAuto placeholder={fmt(tvSize({ size: t.size }).h)} onChange={(v) => put(t.id, { h: v ?? undefined })} /></Field>
              </div>
              <p className="hint">Sizes vary a little by brand. For the customer's actual set, type the width and height without the stand from its spec sheet.</p>
            </details>
          </div>
        );
      })}
    </Section>
  );
}

export function LightingSection() {
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  const L = lightsOf(project);
  const put = (patch: Partial<RoomLights>) => commit((p) => ({ ...p, lights: { ...p.lights, ...patch } }));
  const coffered = cofferOf(project).on;
  const n = canSpots(project).length;
  return (
    <Section title="Lighting (3D)">
      <div className="grid2">
        <Field label="Light from" htmlFor="lt-kind">
          <select id="lt-kind" value={L.kind} onChange={(e) => put({ kind: e.target.value as RoomLights['kind'] })}>
            <option value="recessed">Recessed cans</option>
            <option value="daylight">Daylight (even)</option>
          </select>
        </Field>
        <Field label="Brightness" htmlFor="lt-bright">
          <input id="lt-bright" type="range" min={0.4} max={2} step={0.1} value={L.brightness} onChange={(e) => put({ brightness: Number(e.target.value) })} />
        </Field>
        {L.kind === 'recessed' && (!coffered || L.grid) && (
          <>
            <Field label="Cans across (along the back wall)" htmlFor="lt-nx"><input id="lt-nx" inputMode="numeric" value={L.across ?? ''} placeholder={`${Math.max(1, Math.round(project.room.width / L.spacing))} (auto)`} onChange={(e) => { const v = parseInt(e.target.value, 10); put({ across: Number.isFinite(v) ? Math.max(0, Math.min(12, v)) : undefined }); }} /></Field>
            <Field label="Rows deep (out from the back wall)" htmlFor="lt-nz"><input id="lt-nz" inputMode="numeric" value={L.deep ?? ''} placeholder={`${Math.max(1, Math.round(project.room.depth / L.spacing))} (auto)`} onChange={(e) => { const v = parseInt(e.target.value, 10); put({ deep: Number.isFinite(v) ? Math.max(0, Math.min(12, v)) : undefined }); }} /></Field>
            {L.across == null && L.deep == null && <Field label="Can spacing (auto counts)" htmlFor="lt-space"><LengthInput id="lt-space" value={L.spacing} onChange={(v) => put({ spacing: Math.max(24, v ?? L.spacing) })} /></Field>}
          </>
        )}
      </div>
      {L.kind === 'recessed' && coffered && <label className="check-inline"><input type="checkbox" checked={!L.grid} onChange={(e) => put({ grid: !e.target.checked })} /> A can centered in every coffer</label>}
      {L.kind === 'recessed' && <p className="hint">{n} can{n === 1 ? '' : 's'}{coffered && !L.grid ? ', one centered in each coffer' : ', spread evenly across the ceiling'}. Set the counts to match the room's real cans (0 for none in a direction leaves none). Shadows from the cans show depth the way the finished room will look.</p>}
      <label className="swatch" htmlFor="lt-ceil"><input id="lt-ceil" type="color" value={project.finishes.ceiling ?? '#f7f6f2'} onChange={(e) => commit((p) => ({ ...p, finishes: { ...p.finishes, ceiling: e.target.value } }))} /><span>Ceiling color</span></label>
    </Section>
  );
}

export function OpeningEditor({ o, species, put, remove }: { o: Opening; species: string; put: (p: Partial<Opening>) => void; remove: () => void }) {
  const room = useStore((s) => s.project.room);
  const len = wallLength(room, o.wall);
  const t = o.trim;
  const setTrim = (patch: Partial<OpeningTrim>) => put({ trim: { ...t, ...patch } });
  return (
    <details className="opening">
      <summary>
        <input aria-label="Name" value={o.name} onClick={(e) => e.stopPropagation()} onChange={(e) => put({ name: e.target.value })} />
        <span className="muted">{fmt(o.width)} × {fmt(o.height)} · {wallNames[o.wall]}</span>
      </summary>
      <div className="grid3">
        <Field label="Wall" htmlFor={`op-wall-${o.id}`}>
          <select id={`op-wall-${o.id}`} value={o.wall} onChange={(e) => put({ wall: e.target.value as WallId, offset: Math.min(o.offset, Math.max(0, wallLength(room, e.target.value as WallId) - o.width)) })}>
            {wallOrder.map((w) => <option key={w} value={w}>{wallNames[w]}</option>)}
          </select>
        </Field>
        <Field label="From left" htmlFor={`op-off-${o.id}`}><LengthInput id={`op-off-${o.id}`} value={o.offset} onChange={(v) => put({ offset: Math.min(v ?? 0, len - o.width) })} /></Field>
        <Field label="Width" htmlFor={`op-w-${o.id}`}><LengthInput id={`op-w-${o.id}`} value={o.width} min={6} onChange={(v) => put({ width: v ?? o.width })} /></Field>
        <Field label="Height" htmlFor={`op-h-${o.id}`}><LengthInput id={`op-h-${o.id}`} value={o.height} min={6} onChange={(v) => put({ height: v ?? o.height })} /></Field>
        {o.kind === 'window' && <Field label="Sill off floor" htmlFor={`op-s-${o.id}`}><LengthInput id={`op-s-${o.id}`} value={o.sill} onChange={(v) => put({ sill: v ?? o.sill })} /></Field>}
        {!t.casing && o.kind !== 'open' && <Field label="Flat casing" htmlFor={`op-fc-${o.id}`}><LengthInput id={`op-fc-${o.id}`} value={t.flat || null} allowAuto placeholder="none" onChange={(v) => setTrim({ flat: v ?? 0 })} /></Field>}
      </div>
      <div className="order-actions">
        <button className="mini" onClick={() => put({ offset: 0 })}>To the left end</button>
        <button className="mini" onClick={() => put({ offset: Math.max(0, len - o.width) })}>To the right end</button>
        {o.kind === 'open' && Math.abs(o.height - room.height) > 0.01 && <button className="mini" onClick={() => put({ height: room.height })}>Floor to ceiling</button>}
      </div>
      <p className="hint">{o.kind === 'open' ? 'A gap in the wall where the room carries on: no casing, no door. Baseboard and crown stop at it.' : 'Sizes are the finished opening, jamb to jamb; casing goes around it.'}</p>
      {o.kind === 'door' && <DoorChoice o={o} put={put} />}
      {o.kind !== 'open' && <MoldSlot kind="casing" label="Profiled casing" num={t.casing} species={species} onChange={(n) => setTrim({ casing: n })} extra={t.casing && <button className="mini" onClick={() => setTrim({ casing: undefined })}>Use flat stock</button>} />}
      {!t.casing && o.kind !== 'open' && <MoldSlot kind="backBand" num={t.backBand} species={species} onChange={(n) => setTrim({ backBand: n })} extra={t.backBand && <button className="mini" onClick={() => setTrim({ backBand: undefined })}>Remove</button>} />}
      {o.kind !== 'open' && <MoldSlot kind="headCap" num={t.headCap} species={species} onChange={(n) => setTrim({ headCap: n })} extra={t.headCap && <button className="mini" onClick={() => setTrim({ headCap: undefined })}>Remove</button>} />}
      {o.kind === 'window' && (
        <>
          <MoldSlot kind="stool" num={t.stool} species={species} onChange={(n) => setTrim({ stool: n })} extra={t.stool && <button className="mini" onClick={() => setTrim({ stool: undefined })}>Remove</button>} />
          <MoldSlot kind="apron" num={t.apron} species={species} onChange={(n) => setTrim({ apron: n })} extra={t.apron && <button className="mini" onClick={() => setTrim({ apron: undefined })}>Remove</button>} />
        </>
      )}
      <button className="mini danger" onClick={remove}>Remove {openingKinds[o.kind].toLowerCase()}</button>
    </details>
  );
}

function DoorChoice({ o, put }: { o: Opening; put: (p: Partial<Opening>) => void }) {
  const [open, setOpen] = useState(false);
  const d = doorOf(o);
  const design = designByCode(d.design);
  const set = (patch: Partial<typeof d>) => put({ door: { ...d, ...patch } });
  const slab = stockSlab(o.width, o.height, d.leaves);
  return (
    <div className="door-choice">
      <div className="mold-slot">
        <span className="mold-kind">Door</span>
        <button className="mold-pick" onClick={() => setOpen(true)}>
          {design ? <><DoorGlyph d={design} size={44} /><span><strong>Reeb {design.code}</strong><span className="muted"> {design.name}</span></span></> : <span>Choose a Reeb design…</span>}
        </button>
      </div>
      <div className="grid3">
        <Field label="Hinges on" htmlFor={`dr-h-${o.id}`}>
          <select id={`dr-h-${o.id}`} value={d.hinge} disabled={d.leaves === 2} onChange={(e) => set({ hinge: e.target.value as 'left' | 'right' })}>
            <option value="left">Left</option><option value="right">Right</option>
          </select>
        </Field>
        <Field label="Leaves" htmlFor={`dr-l-${o.id}`}>
          <select id={`dr-l-${o.id}`} value={d.leaves} onChange={(e) => set({ leaves: Number(e.target.value) as 1 | 2 })}>
            <option value={1}>Single</option><option value={2}>Pair</option>
          </select>
        </Field>
        <Field label="Unit" htmlFor={`dr-p-${o.id}`}>
          <select id={`dr-p-${o.id}`} value={d.prehung ? 'prehung' : 'slab'} onChange={(e) => set({ prehung: e.target.value === 'prehung' })}>
            <option value="prehung">Prehung</option><option value="slab">Slab only</option>
          </select>
        </Field>
      </div>
      <p className={slab.fits ? 'hint' : 'warn'}>
        {slab.fits ? 'Stock' : 'Nearest stock'} {d.leaves > 1 ? 'pair of ' : ''}{tradeSize(slab.w)} × {tradeSize(slab.h)} ({slab.w}" × {slab.h}"){slab.fits ? '' : `; this opening wants ${fmt((o.width - 0.25) / d.leaves)} × ${fmt(o.height - 0.125)}. Size the opening to a stock door or plan on a custom one.`} Hinges side is as you face the door from the room it swings into.
      </p>
      {open && <DoorPicker current={d.design} onPick={(c) => set({ design: c })} onClose={() => setOpen(false)} />}
    </div>
  );
}

/** Switch between showing something in the design only and including it in the quote and orders. */
function ScopeToggle({ id, on, set, label, note }: { id: string; on: boolean; set: (v: boolean) => void; label: string; note: string }) {
  return (
    <div className={`scope-toggle${on ? ' on' : ''}`}>
      <label htmlFor={id}><input id={id} type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} /> {label}</label>
      <p className="hint">{note}</p>
    </div>
  );
}

const accentLabel: Record<WallAccent, string> = { wainscot: 'Frame & panel wainscot', beadboard: 'Beadboard', shiplap: 'Shiplap', slats: 'Wood slats', boardBatten: 'Board & batten' };

/** One wall at a time: its paint, an accent treatment, and trim of its own. */
function WallsSection() {
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  const species = project.settings.moldSpecies;
  const [wall, setWall] = useState<WallId>('back');
  const wf: WallFinish = project.wallFinishes?.[wall] ?? {};
  const put = (patch: Partial<WallFinish>) => commit((p) => {
    const cur = { ...p.wallFinishes?.[wall], ...patch };
    (Object.keys(cur) as (keyof WallFinish)[]).forEach((k) => cur[k] === undefined && delete cur[k]);
    const next = { ...p.wallFinishes, [wall]: cur };
    if (!Object.keys(cur).length) delete next[wall];
    return { ...p, wallFinishes: next };
  });
  const trimSlot = (k: 'crown' | 'base' | 'chairRail', kind: 'roomCrown' | 'roomBase' | 'chairRail', label: string) => (
    <div className="row-ledge" style={{ alignItems: 'center' }}>
      <select aria-label={`${label} on this wall`} value={wf[k] === undefined ? 'room' : wf[k] === null ? 'none' : 'own'} onChange={(e) => put({ [k]: e.target.value === 'room' ? undefined : e.target.value === 'none' ? null : wf[k] ?? roomTrimOf(project)[k] ?? '' } as Partial<WallFinish>)}>
        <option value="room">{label}: same as the room</option>
        <option value="none">{label}: none on this wall</option>
        <option value="own">{label}: its own profile</option>
      </select>
      {typeof wf[k] === 'string' && <MoldSlot kind={kind} num={wf[k] || undefined} species={species} onChange={(n) => put({ [k]: n ?? null } as Partial<WallFinish>)} />}
    </div>
  );
  return (
    <Section title="Walls">
      <div className="seg" role="tablist" aria-label="Wall">
        {wallOrder.map((w) => <button key={w} role="tab" aria-selected={wall === w} className={wall === w ? 'on' : ''} onClick={() => setWall(w)}>{wallNames[w].replace(' wall', '')}{project.wallFinishes?.[w] ? ' •' : ''}</button>)}
      </div>
      <div className="grid2" style={{ marginTop: 8 }}>
        <Field label="Paint color" htmlFor="wf-color">
          <input id="wf-color" type="color" value={wf.color ?? project.finishes.wall ?? '#f1efea'} onChange={(e) => put({ color: e.target.value })} />
        </Field>
        <Field label="Accent" htmlFor="wf-accent">
          <select id="wf-accent" value={wf.accent ?? ''} onChange={(e) => put({ accent: (e.target.value || undefined) as WallAccent | undefined })}>
            <option value="">None</option>
            {(Object.keys(accentLabel) as WallAccent[]).map((k) => <option key={k} value={k}>{accentLabel[k]}</option>)}
          </select>
        </Field>
        {wf.accent && (
          <Field label="Accent height" htmlFor="wf-ah" hint="Off the floor">
            <LengthInput id="wf-ah" value={wf.accentHeight ?? null} allowAuto placeholder={fmt(accentHeightOf(wf, project.room.height))} onChange={(v) => put({ accentHeight: v ?? undefined })} />
          </Field>
        )}
        {wf.accent && (
          <Field label="Accent color" htmlFor="wf-ac">
            <input id="wf-ac" type="color" value={wf.accentColor ?? project.finishes.trim ?? '#f7f5ef'} onChange={(e) => put({ accentColor: e.target.value })} />
          </Field>
        )}
      </div>
      {trimSlot('crown', 'roomCrown', 'Crown')}
      {trimSlot('base', 'roomBase', 'Base')}
      {trimSlot('chairRail', 'chairRail', 'Chair rail')}
      {wf.accent && wf.accent !== 'shiplap' && wf.accent !== 'slats' && <p className="hint">A chair rail on this wall caps the accent at its height.</p>}
      {Object.keys(wf).length > 0 && <button className="mini" onClick={() => commit((p) => { const next = { ...p.wallFinishes }; delete next[wall]; return { ...p, wallFinishes: next }; })}>Back to the room’s finish</button>}
    </Section>
  );
}
