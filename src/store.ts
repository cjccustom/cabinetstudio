import { create } from 'zustand';
import type { Cabinet, Project, WallId } from './model/types';
import { cabinetFromPreset, defaultSettings, presets, sampleProject, uid } from './model/defaults';
import { nextFreeOffset } from './model/layout';
import { defaultCutlist } from './model/cutlist';

export type ViewMode = '3d' | 'plan' | `elev-${WallId}`;

const STORAGE_KEY = 'cabinet-studio.project.v1';

function loadSaved(): Project | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalize(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Fill in anything an older or hand-edited project file is missing. */
export function normalize(p: Project): Project {
  if (!p || !Array.isArray(p.cabinets) || !p.room) throw new Error('This doesn’t look like a Cabinet Studio project.');
  // Version 1 files were drawn with placeholder construction standards, not the shop's own.
  const settings = (p as { version: number }).version >= 2 ? { ...defaultSettings, ...p.settings } : { ...defaultSettings };
  const out: Project = { ...sampleProject(), ...p, version: 2, settings };
  const base = defaultCutlist(out);
  const cl = p.cutlist;
  out.cutlist = cl ? { ...base, ...cl, options: { ...base.options, ...cl.options } } : base;
  return out;
}

interface State {
  project: Project;
  selectedId: string | null;
  view: ViewMode;
  mode: 'design' | 'cutlist';
  setMode: (m: 'design' | 'cutlist') => void;
  dragging: boolean;
  past: Project[];
  future: Project[];
  /** Change the project and record an undo step. */
  commit: (fn: (p: Project) => Project) => void;
  /** Change the project without an undo step (used mid-drag). */
  transient: (fn: (p: Project) => Project) => void;
  /** Record an undo step for the current state (used at drag start). */
  checkpoint: () => void;
  undo: () => void;
  redo: () => void;
  select: (id: string | null) => void;
  setView: (v: ViewMode) => void;
  setDragging: (d: boolean) => void;
  addFromPreset: (presetId: string, wall: WallId) => void;
  updateCabinet: (id: string, patch: Partial<Cabinet>) => void;
  removeCabinet: (id: string) => void;
  duplicateCabinet: (id: string) => void;
  loadProject: (p: Project) => void;
}

const HISTORY = 100;

export const useStore = create<State>((set, get) => ({
  project: loadSaved() ?? normalize(sampleProject()),
  selectedId: null,
  view: '3d',
  mode: 'design',
  setMode: (mode) => set({ mode }),
  dragging: false,
  past: [],
  future: [],
  commit: (fn) => {
    const { project, past } = get();
    set({ project: fn(project), past: [...past.slice(-HISTORY), project], future: [] });
  },
  transient: (fn) => set({ project: fn(get().project) }),
  checkpoint: () => {
    const { project, past } = get();
    set({ past: [...past.slice(-HISTORY), project], future: [] });
  },
  undo: () => {
    const { past, project, future } = get();
    if (!past.length) return;
    set({ project: past[past.length - 1], past: past.slice(0, -1), future: [project, ...future] });
  },
  redo: () => {
    const { past, project, future } = get();
    if (!future.length) return;
    set({ project: future[0], past: [...past, project], future: future.slice(1) });
  },
  select: (id) => set({ selectedId: id }),
  setView: (view) => set({ view }),
  setDragging: (dragging) => set({ dragging }),
  addFromPreset: (presetId, wall) => {
    const preset = presets.find((p) => p.id === presetId)!;
    const { project } = get();
    const offset = nextFreeOffset(project.room, project.cabinets, wall, preset.width, preset.elevation, preset.elevation + preset.height);
    const cab = cabinetFromPreset(preset, wall, offset, project.cabinets);
    get().commit((p) => ({ ...p, cabinets: [...p.cabinets, cab] }));
    set({ selectedId: cab.id });
  },
  updateCabinet: (id, patch) =>
    get().commit((p) => ({ ...p, cabinets: p.cabinets.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
  removeCabinet: (id) => {
    get().commit((p) => ({ ...p, cabinets: p.cabinets.filter((c) => c.id !== id) }));
    if (get().selectedId === id) set({ selectedId: null });
  },
  duplicateCabinet: (id) => {
    const { project } = get();
    const src = project.cabinets.find((c) => c.id === id);
    if (!src) return;
    const offset = nextFreeOffset(project.room, project.cabinets, src.wall, src.width, src.elevation, src.elevation + src.height);
    const prefix = src.name.match(/^[A-Za-z]+/)?.[0] ?? 'C';
    let n = 1;
    while (project.cabinets.some((c) => c.name === `${prefix}${n}`)) n++;
    const copy: Cabinet = { ...src, id: uid('cab'), name: `${prefix}${n}`, offset, rows: src.rows.map((r) => ({ ...r, id: uid('row') })) };
    get().commit((p) => ({ ...p, cabinets: [...p.cabinets, copy] }));
    set({ selectedId: copy.id });
  },
  loadProject: (p) => {
    get().commit(() => normalize(p));
    set({ selectedId: null });
  },
}));

useStore.subscribe((s, prev) => {
  const dragEnded = prev.dragging && !s.dragging;
  if ((s.project === prev.project && !dragEnded) || s.dragging) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s.project));
  } catch {
    // Storage can be unavailable (private windows); the session still works.
  }
});
