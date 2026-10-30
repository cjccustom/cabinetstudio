import { useStore } from '../store';
import { fittedDrop, perimeterBottom, pictureHeight, beadCorner, cabinetLine, chimneysOn, cofferLayout, cofferMoldings, cofferOf, cofferParts, coffers, crownLimit, defaultCoffer, defaultSoffitPanels, fasciaHeight, isCornerBead, opposite, perimOf, type CofferCeiling, type SoffitPanels } from '../model/coffer';
import { wallNames } from '../model/layout';
import type { WallId } from '../model/types';
import { fmt } from '../units';
import { Field, LengthInput, Section } from './fields';
import { MoldSlot } from './ProfilePicker';

/**
 * The fascias, beam and perimeter alike: how far they drop, their stock, and the picture moulding
 * under the perimeter, with a fit that brings fascia and picture moulding down to the tops of the
 * bookcases and pilasters. What double-clicking a fascia opens first.
 */
export function FasciaSection() {
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  const c = cofferOf(project);
  const put = (patch: Partial<CofferCeiling>) => commit((p) => ({ ...p, ceiling: { ...cofferOf(p), ...patch } }));
  if (!c.on) return null;
  const fit = fittedDrop(project, c);
  const pic = pictureHeight(c);
  const under = perimeterBottom(project, c);
  return (
    <Section title="Fascia">
      <div className="grid3">
        <Field label="Fascia drop (all beams & perimeter)" htmlFor="fa-drop"><LengthInput id="fa-drop" value={c.drop} onChange={(v) => put({ drop: v ?? defaultCoffer.drop })} /></Field>
        <Field label="Fascia stock" htmlFor="fa-t"><LengthInput id="fa-t" value={c.fascia} onChange={(v) => put({ fascia: v ?? defaultCoffer.fascia })} /></Field>
        <Field label="Beam width" htmlFor="fa-bw"><LengthInput id="fa-bw" value={c.beamWidth} onChange={(v) => put({ beamWidth: v ?? defaultCoffer.beamWidth })} /></Field>
      </div>
      {c.perimeter && <MoldSlot kind="picture" label="Picture moulding under the perimeter fascia" num={c.picture} species={project.settings.moldSpecies} onChange={(n) => put({ picture: n })} extra={c.picture && <button className="mini" onClick={() => put({ picture: undefined })}>Remove</button>} />}
      {fit != null && Math.abs(fit - c.drop) > 1 / 32 && (
        <div className="order-actions">
          <button className="mini primary" onClick={() => put({ drop: fit })}>Fit to the bookcases: {fmt(fit)} drop</button>
        </div>
      )}
      <p className="hint">
        Fascia {fmt(fasciaHeight(c))}{pic ? ` plus ${fmt(pic)} of picture moulding` : ''}: the perimeter’s underside is {fmt(under)} off the floor.
        {fit != null ? (Math.abs(fit - c.drop) > 1 / 32 ? ` The fit brings it down onto the tops of the bookcases and pilasters, so the picture moulding runs across their fronts sitting right on them; every beam takes the same drop.` : ' It sits right on the tops of the bookcases and pilasters, the picture moulding running across their fronts.') : ''}
      </p>
    </Section>
  );
}

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
          {c.perimeter && (
            <>
              <div className="grid2">{len('perimeterWidth', 'Wall to fascia face, all walls', defaultCoffer.perimeterWidth)}</div>
              <p className="hint">Bring one wall out (over full-height bookcases, say) and match it on the opposite wall to keep the coffers centered on the windows.</p>
              <table className="cf-walls">
                <tbody>
                  {(['back', 'front', 'left', 'right'] as WallId[]).map((w) => {
                    const own = c.walls?.[w];
                    const line = cabinetLine(project, w, c);
                    const opp = perimOf(c, opposite[w]);
                    const setWall = (v: number | undefined) => {
                      const walls = { ...c.walls, [w]: v };
                      if (v === undefined || v === c.perimeterWidth) delete walls[w];
                      put({ walls: Object.keys(walls).length ? walls : undefined });
                    };
                    return (
                      <tr key={w}>
                        <th><label htmlFor={`cf-wall-${w}`}>{wallNames[w]}</label></th>
                        <td><LengthInput id={`cf-wall-${w}`} value={perimOf(c, w)} min={c.fascia} onChange={(v) => setWall(v ?? undefined)} /></td>
                        <td>
                          {line != null && Math.abs(line - perimOf(c, w)) > 0.01 && <button className="mini" title="Fascia proud of the full-height cabinets' face frames by its thickness, backed by their top rail" onClick={() => setWall(line)}>To cabinets {fmt(line)}</button>}
                          {Math.abs(opp - perimOf(c, w)) > 0.01 && <button className="mini" title={`Same as the ${wallNames[opposite[w]].toLowerCase()}`} onClick={() => setWall(opp)}>Match {opposite[w]} {fmt(opp)}</button>}
                          {own !== undefined && <button className="mini" onClick={() => setWall(undefined)}>Reset</button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <SoffitPanelsBox c={c} put={put} />
            </>
          )}
          <MoldSlot kind="cofferCrown" label="Crown in each coffer" num={c.crown} species={species} maxHeight={crownLimit(c)} onChange={(n) => put({ crown: n })} />
          <MoldSlot kind="cofferBead" label="Bead on the beam edges" num={c.bead} species={species}
            // A square corner bead (A&M #9554) means the soffit hangs below the fascias
            onChange={(n) => put({ bead: n, ...(n && isCornerBead(n) ? { joint: 'bead' as const } : !n && c.joint === 'bead' ? { joint: 'tongue' as const } : {}) })}
            extra={c.bead && <button className="mini" onClick={() => put({ bead: undefined, joint: 'tongue' })}>Remove</button>} />
          <Field label="Fascia to soffit" htmlFor="cf-joint">
            <select id="cf-joint" value={c.joint} onChange={(e) => put({ joint: e.target.value as CofferCeiling['joint'] })}>
              <option value="tongue">Soffit tongue in a dado, {fmt(c.reveal)} reveal</option>
              <option value="bead">Soffit hung {fmt(beadCorner(c))} below on blocking, corner bead</option>
            </select>
          </Field>
          {c.perimeter && <MoldSlot kind="picture" label="Picture moulding below the perimeter" num={c.picture} species={species} onChange={(n) => put({ picture: n })} extra={c.picture && <button className="mini" onClick={() => put({ picture: undefined })}>Remove</button>} />}
          <label className="check-inline"><input type="checkbox" checked={c.beadboard} onChange={(e) => put({ beadboard: e.target.checked })} /> Beadboard in the field of each coffer</label>
          <details className="supplies" style={{ marginTop: 8 }}>
            <summary>Beam construction</summary>
            <div className="grid3">
              {len('fascia', 'Fascia stock', defaultCoffer.fascia)}
              {len('soffit', 'Soffit stock', defaultCoffer.soffit)}
              {c.joint === 'tongue' ? (
                <>
                  {len('reveal', 'Soffit reveal', defaultCoffer.reveal)}
                  {len('tongue', 'Tongue thickness', defaultCoffer.tongue)}
                  {len('tongueDepth', 'Tongue into dado', defaultCoffer.tongueDepth)}
                </>
              ) : len('blocking', 'Blocking spacing', defaultCoffer.blocking)}
              {len('nailer', '2x nailer', defaultCoffer.nailer)}
            </div>
            <Field label="Fascia & soffit species" htmlFor="cf-species"><input id="cf-species" value={c.species} onChange={(e) => put({ species: e.target.value || 'Poplar' })} /></Field>
          </details>
          <p className="hint">
            Fascia face {fmt(fasciaHeight(c))}, so coffer crown up to {fmt(crownLimit(c))} tall. {m.count} coffers: {sizes(L.xs)} across × {sizes(L.zs)} deep (clear, fascia to fascia).
            Crown {Math.ceil(m.crown / 12)} ft{c.bead ? `, bead ${Math.ceil(m.bead / 12)} ft` : ''}{c.perimeter && c.picture ? `, picture ${Math.ceil(m.picture / 12)} ft` : ''}{c.beadboard ? `, ${Math.ceil(m.fieldSqFt)} sq ft of beadboard` : ''}.
          </p>
          {coffers(project, c).length > 0 && !c.crown && <p className="warn">Pick the crown for the coffers so it's priced and drawn.</p>}
          {L.warnings.map((w) => <p key={w} className="warn">{w}</p>)}
        </>
      )}
    </Section>
  );
}

/** Stile-and-rail panels on the underside of a deep perimeter soffit, wall by wall. */
function SoffitPanelsBox({ c, put }: { c: CofferCeiling; put: (patch: Partial<CofferCeiling>) => void }) {
  const project = useStore((s) => s.project);
  const deep = (['back', 'front', 'left', 'right'] as WallId[]).filter((w) => perimOf(c, w) >= 8 || c.panels?.[w]);
  if (!deep.length) return null;
  const setWall = (w: WallId, v: SoffitPanels | undefined) => {
    const panels = { ...c.panels, [w]: v };
    if (!v) delete panels[w];
    put({ panels: Object.keys(panels).length ? panels : undefined });
  };
  const parts = cofferParts(project, c);
  return (
    <div style={{ marginTop: 8 }}>
      {deep.map((w) => {
        const pan = c.panels?.[w];
        const name = `Perimeter, ${w}`;
        const count = parts.filter((x) => x.name === `${name} soffit panel`).length;
        const chim = chimneysOn(project, w, project.room.height - c.drop).length;
        const num = (k: keyof SoffitPanels, label: string) => (
          <Field label={label} htmlFor={`cf-sp-${w}-${k}`}><LengthInput id={`cf-sp-${w}-${k}`} value={pan![k]} min={k === 'size' ? 6 : 1} onChange={(v) => setWall(w, { ...pan!, [k]: v ?? defaultSoffitPanels[k] })} /></Field>
        );
        return (
          <div key={w}>
            <label className="check-inline"><input type="checkbox" checked={!!pan} onChange={(e) => setWall(w, e.target.checked ? { ...defaultSoffitPanels } : undefined)} /> Stile-and-rail panels on the underside of the {wallNames[w].toLowerCase()} soffit</label>
            {pan && (
              <>
                <div className="grid3">{num('stile', 'Stiles')}{num('rail', 'Rails')}{num('size', 'Panel length about')}</div>
                <p className="hint">{count} panel{count === 1 ? '' : 's'}{chim ? ', stopping at the chimney on each side' : ''}. The rail at the fascia takes the {c.joint === 'bead' ? 'bead corner' : 'tongue'} the flat soffit would have.</p>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
