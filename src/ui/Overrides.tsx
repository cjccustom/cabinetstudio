import type { Cabinet, PanelMode, ShopSettings } from '../model/types';
import { doorStyles, panelLabel, sideThicknesses, stileWidths, styleById } from '../model/eagle';
import { fmt } from '../units';
import { Field, LengthInput } from './fields';

type NumKey = { [K in keyof ShopSettings]: ShopSettings[K] extends number ? K : never }[keyof ShopSettings];

const groups: { title: string; fields: [NumKey, string][] }[] = [
  { title: 'Face frame', fields: [['stileWidth', 'Stile width'], ['topRailWidth', 'Top rail'], ['bottomRailWidth', 'Bottom rail'], ['midRailWidth', 'Mid rail'], ['ffThickness', 'Thickness'], ['ffOverhang', 'Extra overhang per side']] },
  { title: 'Case', fields: [['backThickness', 'Back'], ['bottomReveal', 'Bottom below rail'], ['stretcherWidth', 'Stretcher width'], ['shelfSetback', 'Shelf setback']] },
  { title: 'Toe kick', fields: [['toeKickHeight', 'Height'], ['toeKickDepth', 'Finished depth']] },
  { title: 'Doors & panels', fields: [['doorOverlay', 'Overlay'], ['doorGap', 'Gap between fronts'], ['insetReveal', 'Inset reveal'], ['endPanelReveal', 'End panel held back']] },
];

/** Change any shop standard for this one cabinet. Blank fields follow the job's shop standards. */
export function OverridesSection({ cab, settings, set }: { cab: Cabinet; settings: ShopSettings; set: (p: Partial<Cabinet>) => void }) {
  const o = cab.overrides ?? {};
  const count = Object.keys(o).length;
  const put = (patch: Partial<ShopSettings>) => {
    const next: Partial<ShopSettings> = { ...o, ...patch };
    for (const k of Object.keys(next) as (keyof ShopSettings)[]) if (next[k] === undefined) delete next[k];
    set({ overrides: Object.keys(next).length ? next : undefined });
  };
  const choice = <K extends keyof ShopSettings>(k: K, label: string, options: { v: ShopSettings[K]; label: string }[]) => (
    <Field label={label} htmlFor={`ov-${k}`}>
      <select id={`ov-${k}`} className={o[k] !== undefined ? 'overridden' : ''} value={o[k] === undefined ? '' : String(o[k])} onChange={(e) => {
        const opt = options.find((x) => String(x.v) === e.target.value);
        put({ [k]: opt ? opt.v : undefined } as Partial<ShopSettings>);
      }}>
        <option value="">Job ({options.find((x) => x.v === settings[k])?.label ?? String(settings[k])})</option>
        {options.map((x) => <option key={String(x.v)} value={String(x.v)}>{x.label}</option>)}
      </select>
    </Field>
  );
  const style = styleById(o.doorStyleId ?? settings.doorStyleId);
  return (
    <details className="overrides" open={count > 0}>
      <summary>Construction for this cabinet{count > 0 && <span className="badge-on">{count} changed</span>}</summary>
      <p className="hint">Blank fields follow the job’s shop standards. Fill one in to change it for this cabinet only.</p>
      <div className="grid2">
        {choice('doorStyleId', 'Door style', doorStyles.map((d) => ({ v: d.id, label: d.name })))}
        {style.profile !== 'slab' && !style.fixedStile && choice('doorStile', 'Door rail & stile', stileWidths.map((w) => ({ v: w, label: fmt(w) })))}
        {choice('doorMount', 'Doors', [{ v: 'overlay', label: 'Overlay' }, { v: 'inset', label: 'Inset' }])}
        {choice('drawerFronts', 'Drawer fronts', [{ v: 'match', label: 'Match doors' }, { v: 'slab', label: 'Slab' }])}
        {choice('endPanel', 'End panels', (Object.keys(panelLabel) as PanelMode[]).map((m) => ({ v: m, label: panelLabel[m] })))}
        {choice('drawerSide', 'Drawer sides', sideThicknesses.map((t) => ({ v: t, label: fmt(t) })))}
      </div>
      {groups.map((g) => (
        <div key={g.title} className="ov-group">
          <h4>{g.title}</h4>
          <div className="grid3">
            {g.fields.map(([k, label]) => (
              <Field key={k} label={label} htmlFor={`ov-${k}`}>
                <LengthInput id={`ov-${k}`} value={o[k] ?? null} allowAuto placeholder={fmt(settings[k])} onChange={(v) => put({ [k]: v ?? undefined } as Partial<ShopSettings>)} />
              </Field>
            ))}
          </div>
        </div>
      ))}
      {count > 0 && <button className="mini" onClick={() => set({ overrides: undefined })}>Reset to job standards</button>}
    </details>
  );
}
