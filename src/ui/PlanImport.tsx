import { useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { readCadFile } from '../import/cad';
import { applyPlan, defaultBack, planToProject, readPlan, type PlanFound, type PlanSide } from '../model/planImport';
import { fmt } from '../units';
import { Field, LengthInput } from './fields';

const sideName: Record<PlanSide, string> = { top: 'Top of the plan', bottom: 'Bottom of the plan', left: 'Left side of the plan', right: 'Right side of the plan' };

/** Open a Chief plan export (DWG or DXF) and turn it into this design's room, openings and cabinets. */
export function PlanImportButton({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [found, setFound] = useState<{ plan: PlanFound; file: string } | null>(null);
  const pick = async (file?: File) => {
    if (!file) return;
    setErr(''); setBusy(file.name.toLowerCase().endsWith('.dwg') ? 'Loading the DWG reader and opening the plan…' : 'Reading the plan…');
    try {
      const plan = readPlan(await readCadFile(file));
      if (!plan) throw new Error('Couldn’t find the room in this drawing. Export the floor plan view, with the wall layers on.');
      setFound({ plan, file: file.name });
    } catch (e) { setErr((e as Error).message || 'Couldn’t read that file.'); } finally { setBusy(''); }
  };
  return (
    <>
      <button className={className} disabled={!!busy} onClick={() => ref.current?.click()}>Import Chief plan (DWG/DXF)</button>
      <input ref={ref} type="file" accept=".dwg,.dxf" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      {busy && <p className="hint">{busy}</p>}
      {err && <p className="warn">{err}</p>}
      {found && <PlanDialog plan={found.plan} file={found.file} onClose={() => setFound(null)} />}
    </>
  );
}

function PlanDialog({ plan, file, onClose }: { plan: PlanFound; file: string; onClose: () => void }) {
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  const [back, setBack] = useState<PlanSide>(() => defaultBack(plan));
  const [height, setHeight] = useState(project.room.height);
  const res = useMemo(() => planToProject(plan, back, height), [plan, back, height]);
  const had = project.cabinets.length + (project.openings?.length ?? 0);
  const apply = () => {
    if (had && !window.confirm(`Replace this design's ${project.cabinets.length} cabinets and ${project.openings?.length ?? 0} doors and windows with the plan's?`)) return;
    commit((p) => {
      const next = applyPlan(p, res, p.name === 'Untitled' || !p.name ? res.roomName || file.replace(/\.(dwg|dxf)$/i, '') : undefined);
      return { ...next, room: { ...next.room, height } };
    });
    onClose();
  };
  const what = (s: PlanSide) => {
    const n = plan.cabinetRun[s];
    return n > 0 ? `${sideName[s]} (${fmt(n)} of cabinets)` : sideName[s];
  };
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="pi-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="pi-title">Import {file}</h2>
        <div className="grid2">
          <Field label="Back wall" htmlFor="pi-back">
            <select id="pi-back" value={back} onChange={(e) => setBack(e.target.value as PlanSide)}>
              {(['top', 'bottom', 'left', 'right'] as PlanSide[]).map((s) => <option key={s} value={s}>{what(s)}</option>)}
            </select>
          </Field>
          <Field label="Ceiling height" htmlFor="pi-h"><LengthInput id="pi-h" value={height} min={60} onChange={(v) => setHeight(v ?? height)} /></Field>
        </div>
        <ul className="hint">{res.notes.map((n) => <li key={n}>{n}</li>)}</ul>
        <p className="hint">Plans don’t carry heights: check door and window heights and sills in Doors & windows, and cabinet heights and openings on each cabinet. Everything else in this design (finishes, ceiling, quote, client) stays as it is.</p>
        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={apply}>Use this plan</button>
        </div>
      </div>
    </div>
  );
}
