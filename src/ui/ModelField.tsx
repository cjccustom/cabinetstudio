import { useState } from 'react';
import type { Assets } from '../runtime';
import type { Appliance, Model3D } from '../model/appliances';
import { guessUnits, modelAccept, modelSize, readModelFile, rememberModel, toStoredGltf, unitInches } from '../three/modelImport';
import { fmt } from '../units';
import { uid } from '../model/defaults';
import { Field } from './fields';
import { useCapability } from './Rendering';

const assetError = (code?: string) =>
  code === 'too_large' ? 'The model is over the 20 MB storage limit.'
    : code === 'quota_or_state' ? 'The artifact’s file storage is full; remove an old model or picture first.'
      : code === 'rate_limited' ? 'Too many uploads at once; wait a moment and try again.'
        : 'Couldn’t store the model.';

/**
 * The maker's 3D model for an appliance: pick the file they publish, and it shows in place of the
 * plain box in 3D. Sizes and openings still come from the numbers above.
 */
export function ModelField({ a, onChange }: { a: Appliance; onChange: (a: Appliance) => void }) {
  const assets = useCapability<Assets>('assets');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const m = a.model3d;
  const put = (patch: Partial<Model3D>) => m && onChange({ ...a, model3d: { ...m, ...patch } });
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setErr(''); setBusy('Reading the model…');
    try {
      const obj = await readModelFile(file);
      // Most CAD exports are Z-up: if it's much deeper than tall that way, stand it up
      const yUp = modelSize(obj, 'y');
      const up: Model3D['up'] = /\.(glb|gltf|usdz)$/i.test(file.name) ? 'y' : yUp[2] > yUp[1] * 1.6 && yUp[1] < yUp[0] ? 'z' : 'y';
      const size = modelSize(obj, up);
      const units = guessUnits(size);
      setBusy('Storing it with the job…');
      const { blob, texturesDropped } = await toStoredGltf(obj);
      let model: Model3D;
      if (assets) {
        const r = await assets.upload(blob, { type: 'application/json' });
        model = { assetId: r.id, url: r.url, name: file.name, units, up, turn: 0, size, texturesDropped };
      } else {
        const key = `mem:${uid('model')}`;
        rememberModel(key, obj);
        model = { url: key, name: file.name, units, up, turn: 0, size, local: true, texturesDropped };
      }
      onChange({ ...a, model3d: model });
    } catch (e) {
      const code = (e as { code?: string }).code;
      setErr(code ? assetError(code) : (e as Error).message || 'Couldn’t read that file.');
    } finally { setBusy(''); }
  };
  const inches = m ? m.size.map((v) => v * unitInches[m.units]) as [number, number, number] : null;
  return (
    <div className="model-field">
      <div className="row-actions">
        <label className="btn file-btn">
          {m ? 'Replace 3D model…' : 'Import maker’s 3D model…'}
          <input type="file" accept={modelAccept} hidden disabled={!!busy} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        {m && <button className="mini" onClick={() => onChange({ ...a, model3d: undefined })}>Use the plain box</button>}
      </div>
      {busy && <p className="hint">{busy}</p>}
      {err && <p className="warn">{err}</p>}
      {!m && !busy && <p className="hint">GLB, glTF, OBJ, DAE, FBX, STL or USDZ from the maker (BIMobject, the maker’s site, or a SketchUp model exported to one of these). Shown in 3D only.</p>}
      {m && inches && (
        <>
          <p className="hint">{m.name}: {fmt(inches[0])} × {fmt(inches[1])} × {fmt(inches[2])} as read{m.texturesDropped ? '; textures left off to fit the storage limit' : ''}.{m.local ? ' Not stored with the job in this view; it’ll be gone when the page reloads.' : ''}</p>
          <div className="grid3">
            <Field label="File units" htmlFor="m3-units">
              <select id="m3-units" value={m.units} onChange={(e) => put({ units: e.target.value as Model3D['units'] })}>
                <option value="in">Inches</option><option value="ft">Feet</option><option value="mm">Millimeters</option><option value="cm">Centimeters</option><option value="m">Meters</option>
              </select>
            </Field>
            <Field label="Up in the file" htmlFor="m3-up">
              <select id="m3-up" value={m.up} onChange={(e) => put({ up: e.target.value as Model3D['up'] })}>
                <option value="y">Y up</option><option value="z">Z up</option>
              </select>
            </Field>
            <Field label="Turn" htmlFor="m3-turn">
              <select id="m3-turn" value={m.turn} onChange={(e) => put({ turn: Number(e.target.value) as Model3D['turn'] })}>
                <option value={0}>Facing as drawn</option><option value={90}>90°</option><option value={180}>180°</option><option value={270}>270°</option>
              </select>
            </Field>
          </div>
          <button className="mini" onClick={() => {
            const turned = m.turn % 180 ? [inches[2], inches[1], inches[0]] : inches;
            onChange({ ...a, w: Math.round(turned[0] * 16) / 16, h: Math.round(turned[1] * 16) / 16, d: Math.round(turned[2] * 16) / 16, source: `Size read from ${m.name}` });
          }}>Use the model’s size</button>
        </>
      )}
    </div>
  );
}
