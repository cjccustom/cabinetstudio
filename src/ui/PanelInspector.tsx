import { useStore } from '../store';
import type { WallId, WallPanel } from '../model/types';
import { panelMaterials, panelOrder, profiles, spacingOf, spacings } from '../model/panels';
import { fmt } from '../units';
import { wallNames, wallOrder } from '../model/layout';
import { Field, LengthInput, Section } from './fields';

export function PanelInspector({ panel: w }: { panel: WallPanel }) {
  const update = useStore((s) => s.updatePanel);
  const remove = useStore((s) => s.removeCabinet);
  const set = (patch: Partial<WallPanel>) => update(w.id, patch);
  const order = panelOrder(w);
  return (
    <div className="inspector">
      <div className="insp-head">
        <input id="pn-name" className="name-input" aria-label="Panel name" value={w.name} onChange={(e) => set({ name: e.target.value })} />
        <span className="kind">Beadboard paneling</span>
      </div>
      <Section title="Size & placement">
        <div className="grid3">
          <Field label="Wall" htmlFor="pn-wall">
            <select id="pn-wall" value={w.wall} onChange={(e) => set({ wall: e.target.value as WallId })}>
              {wallOrder.map((x) => <option key={x} value={x}>{wallNames[x].replace(' wall', '')}</option>)}
            </select>
          </Field>
          <Field label="From left" htmlFor="pn-off"><LengthInput id="pn-off" value={w.offset} min={-1000} onChange={(v) => set({ offset: v! })} /></Field>
          <Field label="Width" htmlFor="pn-w"><LengthInput id="pn-w" value={w.width} min={1} onChange={(v) => set({ width: v! })} /></Field>
          <Field label="Bottom off floor" htmlFor="pn-b"><LengthInput id="pn-b" value={w.bottom} onChange={(v) => set({ bottom: v! })} /></Field>
          <Field label="Height" htmlFor="pn-h"><LengthInput id="pn-h" value={w.height} min={1} onChange={(v) => set({ height: v! })} /></Field>
        </div>
      </Section>
      <Section title="Nantucket Beadboard">
        <div className="grid2">
          <Field label="Profile" htmlFor="pn-prof">
            <select id="pn-prof" value={w.profile} onChange={(e) => set({ profile: e.target.value as WallPanel['profile'] })}>
              {(Object.keys(profiles) as WallPanel['profile'][]).map((k) => <option key={k} value={k}>{profiles[k].name}</option>)}
            </select>
          </Field>
          <Field label="Bead spacing (o.c.)" htmlFor="pn-sp">
            <select id="pn-sp" value={spacingOf(w)} onChange={(e) => set({ spacing: Number(e.target.value) })}>
              {[...new Set([...spacings, spacingOf(w)])].sort((a, b) => a - b).map((x) => <option key={x} value={x}>{fmt(x)}</option>)}
            </select>
          </Field>
          <Field label="Material" htmlFor="pn-mat">
            <select id="pn-mat" value={w.material} onChange={(e) => set({ material: e.target.value as WallPanel['material'] })}>
              {(Object.keys(panelMaterials) as WallPanel['material'][]).map((k) => <option key={k} value={k}>{panelMaterials[k]}</option>)}
            </select>
          </Field>
          <Field label="Format" htmlFor="pn-fmt">
            <select id="pn-fmt" value={profiles[w.profile].sheetOnly ? 'sheet' : w.format} disabled={profiles[w.profile].sheetOnly} onChange={(e) => set({ format: e.target.value as WallPanel['format'] })}>
              <option value="sheet">4×8 sheets</option>
              <option value="strip">Shiplap strips</option>
            </select>
          </Field>
        </div>
        <p className="hint">Spacings come from dealer listings. Confirm which ones Nantucket offers in this profile before ordering.</p>
        <p className="hint">To order: <strong>{order.qty}</strong> × {order.item}. {order.detail}.</p>
      </Section>
      <Section title="Cap / ledge">
        <div className="checks">
          <label><input id="pn-cap" type="checkbox" checked={w.cap} onChange={(e) => set({ cap: e.target.checked })} /> Solid wood cap along the top</label>
        </div>
        {w.cap && (
          <div className="grid2" style={{ marginTop: 8 }}>
            <Field label="Thickness" htmlFor="pn-ch"><LengthInput id="pn-ch" value={w.capHeight} min={0.25} onChange={(v) => set({ capHeight: v! })} /></Field>
            <Field label="Depth off wall" htmlFor="pn-cd"><LengthInput id="pn-cd" value={w.capDepth} min={0.25} onChange={(v) => set({ capDepth: v! })} /></Field>
          </div>
        )}
      </Section>
      <div className="insp-actions">
        <button className="danger" onClick={() => remove(w.id)}>Delete</button>
      </div>
    </div>
  );
}
