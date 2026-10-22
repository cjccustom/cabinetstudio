import { useState } from 'react';
import { useStore } from '../store';
import { presets } from '../model/defaults';
import { wallNames, wallOrder } from '../model/layout';
import type { ShopSettings, WallId } from '../model/types';
import { fmt } from '../units';
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
  const [wall, setWall] = useState<WallId>(view.startsWith('elev-') ? (view.slice(5) as WallId) : 'back');
  const groups = [
    { kind: 'base', title: 'Base' },
    { kind: 'wall', title: 'Wall' },
    { kind: 'tall', title: 'Tall' },
  ] as const;
  return (
    <div>
      <Field label="Add to" htmlFor="lib-wall">
        <select id="lib-wall" value={wall} onChange={(e) => setWall(e.target.value as WallId)}>
          {wallOrder.map((w) => <option key={w} value={w}>{wallNames[w]}</option>)}
        </select>
      </Field>
      <p className="hint">New cabinets go in the first open spot on that wall. Fine-tune sizes after you place them.</p>
      {groups.map((g) => (
        <Section key={g.kind} title={g.title}>
          <div className="lib">
            {presets.filter((p) => p.kind === g.kind).map((p) => (
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
    </div>
  );
}

/** A tiny front elevation of the preset, so the library reads like a catalog page. */
function PresetGlyph({ rows, w, h, kind }: { rows: { type: string; doors: number; h: number | null }[]; w: number; h: number; kind: string }) {
  const scale = 40 / Math.max(h, 34.5);
  const W = Math.max(14, w * scale);
  const H = h * scale;
  const kick = kind === 'wall' ? 0 : 4 * scale;
  const fixed = rows.reduce((s, r) => s + (r.h ?? 0), 0) * scale;
  const autos = rows.filter((r) => r.h == null).length || 1;
  const inner = H - kick - 3;
  const autoH = Math.max(2, (inner - fixed - (rows.length - 1) * 1.2) / autos);
  let y = 1.5;
  return (
    <svg className="glyph" width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
      <g transform={`translate(${(44 - W) / 2} ${(44 - H) / 2})`}>
      <rect x="0" y="0" width={W} height={H - kick} className="g-frame" />
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
          {([['paint', 'Paint / stain'], ['box', 'Case interior'], ['counter', 'Countertop']] as const).map(([k, label]) => (
            <label key={k} className="swatch" htmlFor={`fin-${k}`}>
              <input id={`fin-${k}`} type="color" value={finishes[k]} onChange={(e) => commit((p) => ({ ...p, finishes: { ...p.finishes, [k]: e.target.value } }))} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </Section>
    </div>
  );
}

type NumKey = { [K in keyof ShopSettings]: ShopSettings[K] extends number ? K : never }[keyof ShopSettings];
const shopFields: { title: string; fields: [NumKey, string][] }[] = [
  { title: 'Case', fields: [['boxThickness', 'Case material'], ['backThickness', 'Back'], ['dadoDepth', 'Dado / rabbet depth'], ['stretcherWidth', 'Stretcher width'], ['nailerWidth', 'Nailer width']] },
  { title: 'Face frame', fields: [['ffThickness', 'Thickness'], ['stileWidth', 'Stile width'], ['topRailWidth', 'Top rail'], ['bottomRailWidth', 'Bottom rail'], ['midRailWidth', 'Mid rail'], ['ffOverhang', 'Overhang past case side']] },
  { title: 'Toe kick', fields: [['toeKickHeight', 'Height'], ['toeKickDepth', 'Depth from face frame']] },
  { title: 'Doors & drawers', fields: [['doorThickness', 'Thickness'], ['doorOverlay', 'Overlay'], ['doorGap', 'Gap between pairs'], ['shakerFrameWidth', 'Shaker stile/rail width']] },
  { title: 'Shelves & counters', fields: [['shelfClearance', 'Shelf clearance (total)'], ['shelfSetback', 'Shelf setback'], ['counterThickness', 'Counter thickness'], ['counterOverhang', 'Counter overhang']] },
];

function ShopPanel() {
  const settings = useStore((s) => s.project.settings);
  const commit = useStore((s) => s.commit);
  const set = (patch: Partial<ShopSettings>) => commit((p) => ({ ...p, settings: { ...p.settings, ...patch } }));
  return (
    <div>
      <p className="hint">How you build. Every cabinet and every part dimension comes from these numbers. Changes apply to the whole job.</p>
      <Section title="Door style">
        <div className="seg" role="radiogroup" aria-label="Door style">
          {(['shaker', 'slab'] as const).map((d) => (
            <button key={d} role="radio" aria-checked={settings.doorStyle === d} className={settings.doorStyle === d ? 'on' : ''} onClick={() => set({ doorStyle: d })}>
              {d === 'shaker' ? 'Shaker (5-piece)' : 'Slab'}
            </button>
          ))}
        </div>
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
        </Section>
      ))}
    </div>
  );
}
