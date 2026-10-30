// The per-job toolbar under the design: the things only some jobs have (an island, pilasters, a
// mantel, a fridge surround, beadboard, doors and windows, a coffered ceiling, a rolling ladder,
// lighting, sections for the drawings), each added or turned on in one click and opened in the editor.
import { useStore } from '../store';
import type { Opening, WallId } from '../model/types';
import { newPanel } from '../model/panels';
import { newOpening } from '../model/room';
import { defaultBase } from '../model/cabinetBase';
import { cofferOf } from '../model/coffer';
import { wallLength } from '../model/layout';

/** The wall new things go on: the elevation being looked at, else the picked cabinet's, else the back. */
function targetWall(): WallId {
  const st = useStore.getState();
  if (st.view.startsWith('elev-')) return st.view.slice(5) as WallId;
  return st.project.cabinets.find((c) => c.id === st.selectedId)?.wall ?? 'back';
}

/** Add a library item and open it in the editor. */
function addPreset(id: string, then?: (cabId: string) => void) {
  const st = useStore.getState();
  st.addFromPreset(id, targetWall());
  const cab = useStore.getState().selectedId;
  if (!cab) return;
  then?.(cab);
  useStore.getState().edit({ kind: 'cabinet', id: cab });
}

const tools: { id: string; label: string; icon: string; title: string; run: () => void; on?: () => boolean }[] = [
  { id: 'island', label: 'Island', icon: '▭', title: 'A freestanding island in the middle of the room, back finished', run: () => addPreset('base-1dr2', (id) => {
    const st = useStore.getState();
    const c = st.project.cabinets.find((x) => x.id === id)!;
    const across = c.wall === 'back' || c.wall === 'front' ? st.project.room.depth : st.project.room.width;
    st.updateCabinet(id, { width: 48, offset: Math.round((wallLength(st.project.room, c.wall) - 48) / 2), island: true, base: { ...defaultBase, style: 'baseboard' }, topBack: 1, wallInset: Math.max(0, Math.round((across - c.depth) / 2)) });
  }) },
  { id: 'pilaster', label: 'Pilaster', icon: '▯', title: 'A pilaster between bookcases or at the end of a run', run: () => addPreset('pilaster') },
  { id: 'mantel', label: 'Mantel', icon: '⌂', title: 'A fireplace mantel', run: () => addPreset('mantel-electric') },
  { id: 'shelf', label: 'Floating shelf', icon: '▬', title: 'A floating shelf', run: () => addPreset('float-shelf') },
  { id: 'fridge', label: 'Fridge surround', icon: '▥', title: 'A refrigerator surround with a cabinet above', run: () => addPreset('tall-fridge') },
  { id: 'panel', label: 'Beadboard', icon: '▤', title: 'Beadboard paneling on the wall', run: () => {
    const st = useStore.getState();
    st.addPanel(newPanel(targetWall(), 0, 48, 18.5, 30, st.project.panels ?? []));
    const id = useStore.getState().selectedId;
    if (id) st.edit({ kind: 'panel', id });
  } },
  { id: 'door', label: 'Door or window', icon: '▢', title: 'A door or window in the wall, so the work fits around it', run: () => {
    const st = useStore.getState();
    const o = newOpening('window' as Opening['kind'], targetWall(), st.project);
    st.commit((p) => ({ ...p, openings: [...(p.openings ?? []), o] }));
    st.edit({ kind: 'opening', id: o.id });
  } },
  { id: 'coffer', label: 'Coffered ceiling', icon: '▦', title: 'Turn the coffered ceiling on and set it up', on: () => cofferOf(useStore.getState().project).on, run: () => {
    const st = useStore.getState();
    if (!cofferOf(st.project).on) st.commit((p) => ({ ...p, ceiling: { ...cofferOf(p), on: true } }));
    st.edit({ kind: 'ceiling' });
  } },
  { id: 'ladder', label: 'Rolling ladder', icon: '⫽', title: 'A rolling library ladder on a rail across the bookcases', on: () => !!useStore.getState().project.ladder?.on, run: () => {
    const st = useStore.getState();
    if (!st.project.ladder?.on) st.commit((p) => ({ ...p, ladder: { ...p.ladder, on: true, ...(p.ladder?.wall ? {} : { wall: targetWall() }) } }));
    st.edit({ kind: 'ladder' });
  } },
  { id: 'lights', label: 'Lighting', icon: '◌', title: 'Recessed cans or daylight in the 3D view', run: () => useStore.getState().edit({ kind: 'lights' }) },
  { id: 'details', label: 'Sections', icon: '⊘', title: 'Sections and details for the drawings', run: () => useStore.getState().edit({ kind: 'details' }) },
];

export function AddToolbar() {
  // Re-render when what's on changes
  useStore((s) => [s.project.ceiling?.on, s.project.ladder?.on].join());
  return (
    <div className="add-toolbar" role="toolbar" aria-label="Add to this job">
      {tools.map((t) => (
        <button key={t.id} className={t.on?.() ? 'on' : ''} title={t.title} onClick={t.run}>
          <span className="ti" aria-hidden="true">{t.icon}</span>{t.label}
        </button>
      ))}
    </div>
  );
}
