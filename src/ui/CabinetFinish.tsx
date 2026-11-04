// One cabinet, or several picked together, finished apart from the job: an accent paint color
// (the island, a bank of cabinets on another wall), or stain grade on a painted job.
import { useStore } from '../store';
import type { Cabinet } from '../model/types';
import { cabinetFinishOf, cabinetFinishPatch, type CabinetFinish } from '../model/cabinetFinish';
import { colorText } from '../model/paintColors';
import { lumberNames, priceBook } from '../model/pricebook';
import { useShop } from '../shop/shop';
import { doorMaterials } from '../model/eagle';
import { amSpecies } from '../model/moldings';
import { eff } from '../model/parts';
import { Field, Section } from './fields';
import { ColorPick } from './PaintColorPicker';

export function CabinetFinishSection({ cabs }: { cabs: Cabinet[] }) {
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  const book = priceBook(useShop((s) => s.prices));
  if (!cabs.length) return null;
  const first = cabs[0];
  const f = cabinetFinishOf(project, first);
  const jobStain = project.settings.finish === 'stain';
  const jobPaint = project.finishes.named?.paint;
  // What the picker shows: same as the job, its own paint color, or stain grade
  const mode: 'job' | 'color' | 'stain' | 'paint' = f.finish === 'stain' ? (jobStain && f.species === project.settings.woodSpecies ? 'job' : 'stain')
    : jobStain ? 'paint' : first.paint ? 'color' : 'job';
  const species = eff(first, project.settings).woodSpecies;
  const apply = (fn: (c: Cabinet) => Partial<Cabinet>) => commit((p) => ({ ...p, cabinets: p.cabinets.map((c) => (cabs.some((x) => x.id === c.id) ? { ...c, ...fn(c) } : c)) }));
  const setFinish = (to: CabinetFinish, sp: string) => apply((c) => cabinetFinishPatch(project, c, to, sp, book, doorMaterials, amSpecies));
  const jobText = jobStain ? `stain grade ${project.settings.woodSpecies.toLowerCase()}` : `painted${jobPaint ? ` ${colorText(jobPaint)}` : ''}`;
  const many = cabs.length > 1;
  return (
    <Section title="Finish">
      <Field label={many ? `Finish for these ${cabs.length} cabinets` : 'Finish for this cabinet'} htmlFor="cf-mode">
        <select id="cf-mode" value={mode} onChange={(e) => {
          const v = e.target.value;
          if (v === 'job') { setFinish('job', species); apply(() => ({ paint: undefined })); }
          else if (v === 'stain') setFinish('stain', jobStain ? species : 'White oak');
          else if (v === 'paint') setFinish('paint', species);
          else if (v === 'color') { setFinish('job', species); apply((c) => ({ paint: c.paint ?? { hex: project.finishes.paint } })); }
        }}>
          <option value="job">Same as the job ({jobText})</option>
          {!jobStain && <option value="color">Painted, its own color</option>}
          {jobStain && <option value="paint">Painted (paint grade)</option>}
          <option value="stain">{jobStain ? 'Stain grade, another species' : 'Stain grade'}</option>
        </select>
      </Field>
      {mode === 'stain' && (
        <Field label="Species" htmlFor="cf-sp">
          <select id="cf-sp" value={species} onChange={(e) => setFinish('stain', e.target.value)}>
            {[...new Set([species, ...lumberNames()])].map((x) => <option key={x}>{x}</option>)}
          </select>
        </Field>
      )}
      {(mode === 'color' || mode === 'paint') && (
        <ColorPick label={many ? 'Their color' : 'Its color'} hex={first.paint?.hex} named={first.paint?.named} empty="pick a color"
          onPick={(c) => apply(() => ({ paint: c ? { hex: c.hex, named: { brand: c.brand, code: c.code, name: c.name } } : { hex: project.finishes.paint } }))} />
      )}
      <p className="hint">
        {mode === 'stain' ? 'Its face frame, doors, end panels and solid wood switch to the species: priced from its own stock, its own Eagle request, and said on the proposal and drawings.'
          : mode === 'color' ? 'An accent color (the island, a bank of cabinets on another wall): shown in 3D, named on the proposal, and on the drawings.'
          : many ? 'Pick a finish to apply to all of them.' : 'For an accent island, a bank of cabinets in another color, or a stained island with painted cabinets.'}
      </p>
    </Section>
  );
}
