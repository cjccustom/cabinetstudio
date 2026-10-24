import { useStore } from '../store';
import { cofferLayout, cofferMoldings, cofferOf, coffers, defaultCoffer, type CofferCeiling } from '../model/coffer';
import { fmt } from '../units';
import { Field, LengthInput, Section } from './fields';
import { MoldSlot } from './ProfilePicker';

/** The coffered ceiling: layout, beam build, mouldings and field, with what it comes to. */
export function CofferSection() {
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  const c = cofferOf(project);
  const put = (patch: Partial<CofferCeiling>) => commit((p) => ({ ...p, ceiling: { ...cofferOf(p), ...patch } }));
  const species = project.settings.moldSpecies;
  const L = cofferLayout(project, c);
  const m = cofferMoldings(project, c);
  const len = (k: keyof CofferCeiling, label: string, fallback: number) => (
    <Field label={label} htmlFor={`cf-${k}`}><LengthInput id={`cf-${k}`} value={c[k] as number} onChange={(v) => put({ [k]: v ?? fallback } as Partial<CofferCeiling>)} /></Field>
  );
  const sizes = (spans: { a: number; b: number }[]) => [...new Set(spans.map((s) => fmt(s.b - s.a)))].join(', ');
  return (
    <Section title="Coffered ceiling">
      <label className="check-inline"><input id="cf-on" type="checkbox" checked={c.on} onChange={(e) => put({ on: e.target.checked })} /> Coffered ceiling in this room</label>
      {c.on && (
        <>
          <div className="grid2" style={{ marginTop: 8 }}>
            <Field label="Coffers across" htmlFor="cf-across"><input id="cf-across" inputMode="numeric" value={c.across} onChange={(e) => put({ across: Math.max(1, parseInt(e.target.value, 10) || 1) })} /></Field>
            <Field label="Coffers deep" htmlFor="cf-deep"><input id="cf-deep" inputMode="numeric" value={c.deep} onChange={(e) => put({ deep: Math.max(1, parseInt(e.target.value, 10) || 1) })} /></Field>
          </div>
          <div className="grid2">
            <Field label="Layout" htmlFor="cf-layout">
              <select id="cf-layout" value={c.layout} onChange={(e) => put({ layout: e.target.value as CofferCeiling['layout'] })}>
                <option value="even">All coffers equal</option>
                <option value="bigCenter">Smaller perimeter coffers</option>
              </select>
            </Field>
            {c.layout === 'bigCenter' && len('outer', 'Perimeter coffer size', 24)}
          </div>
          <div className="grid3">
            {len('beamWidth', 'Beam width', defaultCoffer.beamWidth)}
            {len('drop', 'Drop from ceiling', defaultCoffer.drop)}
            <Field label="Runs through" htmlFor="cf-through">
              <select id="cf-through" value={c.through} onChange={(e) => put({ through: e.target.value as CofferCeiling['through'] })}>
                <option value="across">Across (back wall way)</option>
                <option value="deep">Deep (side wall way)</option>
              </select>
            </Field>
          </div>
          <label className="check-inline"><input type="checkbox" checked={c.perimeter} onChange={(e) => put({ perimeter: e.target.checked })} /> Perimeter fascia around the room</label>
          {c.perimeter && <div className="grid2">{len('perimeterWidth', 'Wall to fascia face', defaultCoffer.perimeterWidth)}</div>}
          <MoldSlot kind="cofferCrown" label="Crown in each coffer" num={c.crown} species={species} onChange={(n) => put({ crown: n })} />
          <MoldSlot kind="cofferBead" label="Bead on the beam edges" num={c.bead} species={species} onChange={(n) => put({ bead: n })} extra={c.bead && <button className="mini" onClick={() => put({ bead: undefined })}>Remove</button>} />
          {c.perimeter && <MoldSlot kind="picture" label="Picture moulding below the perimeter" num={c.picture} species={species} onChange={(n) => put({ picture: n })} extra={c.picture && <button className="mini" onClick={() => put({ picture: undefined })}>Remove</button>} />}
          <label className="check-inline"><input type="checkbox" checked={c.beadboard} onChange={(e) => put({ beadboard: e.target.checked })} /> Beadboard in the field of each coffer</label>
          <details className="supplies" style={{ marginTop: 8 }}>
            <summary>Beam construction</summary>
            <div className="grid3">
              {len('fascia', 'Fascia stock', defaultCoffer.fascia)}
              {len('soffit', 'Soffit stock', defaultCoffer.soffit)}
              {len('reveal', 'Soffit reveal', defaultCoffer.reveal)}
              {len('tongue', 'Tongue thickness', defaultCoffer.tongue)}
              {len('tongueDepth', 'Tongue into dado', defaultCoffer.tongueDepth)}
              {len('nailer', '2x nailer', defaultCoffer.nailer)}
            </div>
            <Field label="Fascia & soffit species" htmlFor="cf-species"><input id="cf-species" value={c.species} onChange={(e) => put({ species: e.target.value || 'Poplar' })} /></Field>
          </details>
          <p className="hint">
            {m.count} coffers: {sizes(L.xs)} across × {sizes(L.zs)} deep (clear, fascia to fascia).
            Crown {Math.ceil(m.crown / 12)} ft{c.bead ? `, bead ${Math.ceil(m.bead / 12)} ft` : ''}{c.perimeter && c.picture ? `, picture ${Math.ceil(m.picture / 12)} ft` : ''}{c.beadboard ? `, ${Math.ceil(m.fieldSqFt)} sq ft of beadboard` : ''}.
          </p>
          {coffers(project, c).length > 0 && !c.crown && <p className="warn">Pick the crown for the coffers so it's priced and drawn.</p>}
          {L.warnings.map((w) => <p key={w} className="warn">{w}</p>)}
        </>
      )}
    </Section>
  );
}
