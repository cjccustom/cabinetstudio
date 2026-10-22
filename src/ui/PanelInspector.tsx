import { useStore } from '../store';
import type { WallId, WallPanel } from '../model/types';
import { optionOf, panelMaterials, panelOrder, productOf } from '../model/panels';
import { beadboardCatalog, type BeadboardProduct } from '../model/nantucket';
import { fmt } from '../units';
import { MoldSlot } from './ProfilePicker';
import { wallNames, wallOrder } from '../model/layout';
import { Field, LengthInput, Section } from './fields';

export function PanelInspector({ panel: w }: { panel: WallPanel }) {
  const update = useStore((s) => s.updatePanel);
  const remove = useStore((s) => s.removeCabinet);
  const set = (patch: Partial<WallPanel>) => update(w.id, patch);
  const species = useStore((s) => s.project.settings.moldSpecies);
  const order = panelOrder(w);
  const prod = productOf(w);
  const opt = optionOf(w);
  const ocs = [...new Set(prod.options.map((o) => o.oc).filter((x): x is number => x != null))];
  const thicks = [...new Set(prod.options.filter((o) => o.oc === opt.oc).map((o) => o.thickness))];
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
        <Field label="Product" htmlFor="pn-prof">
          <select id="pn-prof" value={prod.id} onChange={(e) => {
            const next = beadboardCatalog.find((x) => x.id === e.target.value)!;
            const o = next.options.find((x) => x.thickness === (w.thickness ?? 0.5)) ?? next.options[0];
            set({ profile: next.id, spacing: o.oc ?? undefined, thickness: o.thickness });
          }}>
            {[['Sheets (4×8)', (p: BeadboardProduct) => !p.special && p.family === 'sheet'], ['Shiplap strips', (p: BeadboardProduct) => !p.special && p.family === 'strip'], ['Special order', (p: BeadboardProduct) => p.special]].map(([label, test]) => (
              <optgroup key={label as string} label={label as string}>
                {beadboardCatalog.filter(test as (p: BeadboardProduct) => boolean).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>
        <div className="grid3" style={{ marginTop: 8 }}>
          <Field label="On center" htmlFor="pn-sp">
            <select id="pn-sp" value={opt.oc ?? ''} disabled={ocs.length < 2} onChange={(e) => {
              const oc = Number(e.target.value);
              const o = prod.options.find((x) => x.oc === oc && x.thickness === opt.thickness) ?? prod.options.find((x) => x.oc === oc)!;
              set({ spacing: oc, thickness: o.thickness });
            }}>
              {ocs.length === 0 && <option value="">Random</option>}
              {ocs.map((x) => <option key={x} value={x}>{fmt(x)}</option>)}
            </select>
          </Field>
          <Field label="Thickness" htmlFor="pn-t">
            <select id="pn-t" value={opt.thickness} disabled={thicks.length < 2} onChange={(e) => set({ thickness: Number(e.target.value) })}>
              {thicks.map((x) => <option key={x} value={x}>{fmt(x)}</option>)}
            </select>
          </Field>
          <Field label="Substrate" htmlFor="pn-mat">
            <select id="pn-mat" value={w.material} onChange={(e) => set({ material: e.target.value as WallPanel['material'] })}>
              {(Object.keys(panelMaterials) as WallPanel['material'][]).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </Field>
        </div>
        {opt.face && <p className="hint">Strip face width {fmt(opt.face)}.</p>}
        {opt.code && <p className="hint">Product code <span className="mono">{opt.code}</span>{w.material !== 'MDF' && ' (MDF; confirm the code for this substrate)'}.</p>}
        {w.material !== 'MDF' && opt.thickness !== 0.5 && <p className="warn">MRI, MRX, fire-rated MDF and PVC come in 1/2" only.</p>}
        <p className="hint">To order: <strong>{order.qty}</strong> × {order.item}. {order.detail}.</p>
      </Section>
      <Section title="Cap / ledge">
        <div className="checks">
          <label><input id="pn-cap" type="checkbox" checked={w.cap} onChange={(e) => set({ cap: e.target.checked })} /> Cap along the top (A&amp;M profile, or a plain shop-made ledge)</label>
        </div>
        {w.cap && (
          <MoldSlot kind="cap" num={w.capProfile} species={species} onChange={(n) => set({ capProfile: n })} />
        )}
        {w.cap && !w.capProfile && (
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
