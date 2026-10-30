import { create } from 'zustand';
import type { Cabinet, Project, WallId, WallPanel } from './model/types';
import { cabinetFromPreset, defaultSettings, presets, sampleProject, uid } from './model/defaults';
import { findIssues, footprint, nextFreeOffset, shiftInRoom, wallAxes, wallLength } from './model/layout';
import { defaultCutlist, sheetPrice } from './model/cutlist';
import { setCustomDrawings } from './model/moldings';
import { crownFit } from './model/parts';

export type ViewMode = '3d' | 'plan' | `elev-${WallId}`;

const STORAGE_KEY = 'cabinet-studio.project.v1';
/** The design last replaced by opening another one. */
export const BACKUP_KEY = 'cabinet-studio.replaced.v1';

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
  // Rear brackets used to be a yes/no
  if (typeof (settings.tandemRearBrackets as unknown) === 'boolean') settings.tandemRearBrackets = 'overlay';
  // Older files stored flat/raised instead of Eagle's center panel code
  if ((p.settings as { doorPanel?: string } | undefined)?.doorPanel === 'raised' && !p.settings.centerPanel) settings.centerPanel = 'MDF-03';
  const sample = sampleProject();
  // Older blind corners stored one blind width (dead area + a 3" stile)
  const cabinets = p.cabinets.map((c) => {
    const b = c.blind as (Cabinet['blind'] & { width?: number }) | undefined;
    return b && b.dead == null ? { ...c, blind: { side: b.side, dead: Math.max(0, (b.width ?? 27) - 3), clearance: settings.blindClearance } } : c;
  });
  const out: Project = { ...sample, ...p, version: 2, settings, cabinets, finishes: { ...sample.finishes, ...p.finishes } };
  const base = defaultCutlist(out);
  const cl = p.cutlist;
  out.cutlist = cl
    ? { ...base, ...cl, options: { ...base.options, ...cl.options }, stock: cl.stock.map((st) => (st.price ? st : { ...st, price: sheetPrice(st.material) })) }
    : base;
  return out;
}

export type Editing = { kind: 'cabinet' | 'panel'; id: string; tab?: string } | { kind: 'opening'; id: string; tab?: string } | { kind: 'ceiling' | 'ladder' | 'lights' | 'details'; tab?: string };

interface State {
  project: Project;
  selectedId: string | null;
  /** More than one cabinet picked (shift- or ⌘-click, or a whole wall): moved together. Holds selectedId too. */
  group: string[];
  /** Pick every cabinet on a wall. */
  selectWall: (wall: WallId) => void;
  /** Pick everything that runs up to the ceiling (within a few inches): what takes ceiling crown. */
  selectCeiling: () => void;
  /** Put a crown on everything picked, shortening each so its crown meets the ceiling. Returns how many were shortened. */
  crownGroup: (num: string | undefined) => number;
  /** Slide everything picked along its wall by `along`, and up or down by `up`. */
  moveGroup: (along: number, up?: number) => void;
  view: ViewMode;
  mode: 'design' | 'cutlist' | 'faceframe' | 'quote' | 'job' | 'render' | 'clients' | 'drawings';
  setMode: (m: 'design' | 'cutlist' | 'faceframe' | 'quote' | 'job' | 'render' | 'clients' | 'drawings') => void;
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
  select: (id: string | null, add?: boolean) => void;
  /** The full editor open over the design (double-click an object): a cabinet or panel by id, or the ceiling. */
  editing: Editing | null;
  edit: (what: Editing | null) => void;
  setView: (v: ViewMode) => void;
  setDragging: (d: boolean) => void;
  addFromPreset: (presetId: string, wall: WallId) => void;
  updateCabinet: (id: string, patch: Partial<Cabinet>) => void;
  removeCabinet: (id: string) => void;
  duplicateCabinet: (id: string) => void;
  loadProject: (p: Project) => void;
  addPanel: (panel: WallPanel) => void;
  updatePanel: (id: string, patch: Partial<WallPanel>) => void;
}

const HISTORY = 100;

export const useStore = create<State>((set, get) => ({
  project: loadSaved() ?? normalize(sampleProject()),
  selectedId: null,
  editing: null,
  edit: (editing) => set(editing && (editing.kind === 'cabinet' || editing.kind === 'panel') ? { editing, selectedId: editing.id, group: [] } : { editing }),
  group: [],
  view: '3d',
  mode: (() => { try { const m = localStorage.getItem('cabinet-studio.mode'); return m === 'job' || m === 'render' || m === 'clients' || m === 'drawings' || m === 'quote' || m === 'cutlist' || m === 'faceframe' ? m : 'design'; } catch { return 'design'; } })(),
  setMode: (mode) => { try { localStorage.setItem('cabinet-studio.mode', mode); } catch { /* storage blocked */ } set({ mode }); },
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
  select: (id, add) => {
    if (!add || !id) { set({ selectedId: id, group: [] }); return; }
    // Shift- or ⌘-click adds a cabinet to what's picked, or takes it back out
    const { group, selectedId } = get();
    const now = group.length ? group : selectedId ? [selectedId] : [];
    const next = now.includes(id) ? now.filter((x) => x !== id) : [...now, id];
    set({ group: next.length > 1 ? next : [], selectedId: next.includes(id) ? id : next[0] ?? null });
  },
  selectWall: (wall) => {
    // Islands stand out in the room; shift-click one to bring it along
    // Also anything set off another wall that stands against this one (a cabinet turned to face a
    // side room, its end at this wall)
    const { room, cabinets } = get().project;
    const touches = (c: Cabinet) => {
      const f = footprint(room, c);
      return wall === 'back' ? f.z0 < 0.5 : wall === 'front' ? f.z1 > room.depth - 0.5 : wall === 'left' ? f.x0 < 0.5 : f.x1 > room.width - 0.5;
    };
    const ids = cabinets.filter((c) => !c.island && (c.wall === wall || ((c.wallInset ?? 0) > 0 && touches(c)))).map((c) => c.id);
    set({ group: ids.length > 1 ? ids : [], selectedId: ids[0] ?? null });
  },
  selectCeiling: () => {
    const { room, cabinets } = get().project;
    const ids = cabinets.filter((c) => reachesCeiling(c, room.height)).map((c) => c.id);
    set({ group: ids.length > 1 ? ids : [], selectedId: ids[0] ?? null });
  },
  crownGroup: (num) => {
    const ids = picked(get());
    let cut = 0;
    get().commit((p) => ({ ...p, cabinets: p.cabinets.map((c) => {
      if (!ids.includes(c.id) || !takesCrown(c)) return c;
      const next = { ...c, crown: num };
      const f = num ? crownFit(next, p.settings, p.room.height) : null;
      if (f && f.over > 1e-3) { cut++; return { ...next, height: next.height - Math.ceil(f.over * 16) / 16 }; }
      return next;
    }) }));
    return cut;
  },
  moveGroup: (along, up = 0) => {
    const st = get();
    const ids = picked(st);
    // "Along" is along the run: the wall most of the group hangs on; every cabinet in the group
    // moves that same way in the room, including one standing off another wall (a plate cabinet
    // facing the dining room beside a fridge)
    const wall = runWall(st.project.cabinets.filter((c) => ids.includes(c.id)), st.selectedId);
    if (!wall) return;
    const [ax, az] = wallAxes[wall].along;
    st.commit((p) => ({ ...p, cabinets: p.cabinets.map((c) => (ids.includes(c.id) ? { ...c, ...shiftInRoom(c, along * ax, along * az), elevation: Math.max(0, c.elevation + up) } : c)) }));
  },
  setView: (view) => set({ view }),
  setDragging: (dragging) => set({ dragging }),
  addFromPreset: (presetId, wall) => {
    const preset = presets.find((p) => p.id === presetId)!;
    const { project } = get();
    let cab: Cabinet;
    if (preset.group === 'corner') {
      // Corner cabinets go in a corner: the left end of the wall if it's free, else the right
      const left = cabinetFromPreset(preset, wall, 0, project.cabinets);
      const fits = (c: Cabinet) => !findIssues(project.room, [...project.cabinets, c], project.settings).some((i) => i.cabinetId === c.id);
      const len = wallLength(project.room, wall);
      const right: Cabinet = {
        ...left, offset: len - left.width,
        ...(left.blind ? { blind: { ...left.blind, side: 'right' as const } } : {}),
        ...(left.corner ? { corner: { ...left.corner, side: 'right' as const } } : {}),
      };
      cab = fits(left) || !fits(right) ? left : right;
    } else if (preset.top?.island) {
      // An island goes in the middle of the room, facing the wall it's added to
      const across = wall === 'back' || wall === 'front' ? project.room.depth : project.room.width;
      cab = cabinetFromPreset(preset, wall, Math.round((wallLength(project.room, wall) - preset.width) / 2), project.cabinets);
      cab.wallInset = Math.max(0, Math.round(across / 2 - preset.depth / 2));
    } else {
      const offset = nextFreeOffset(project.room, project.cabinets, wall, preset.width, preset.elevation, preset.elevation + preset.height, preset.depth);
      cab = cabinetFromPreset(preset, wall, offset, project.cabinets);
    }
    get().commit((p) => ({ ...p, cabinets: [...p.cabinets, cab] }));
    set({ selectedId: cab.id });
  },
  updateCabinet: (id, patch) =>
    get().commit((p) => ({ ...p, cabinets: p.cabinets.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
  removeCabinet: (id) => {
    get().commit((p) => ({ ...p, cabinets: p.cabinets.filter((c) => c.id !== id), panels: (p.panels ?? []).filter((w) => w.id !== id) }));
    if (get().selectedId === id) set({ selectedId: null });
    const ed = get().editing;
    if (ed && (ed.kind === 'cabinet' || ed.kind === 'panel') && ed.id === id) set({ editing: null });
  },
  duplicateCabinet: (id) => {
    const { project } = get();
    const src = project.cabinets.find((c) => c.id === id);
    if (!src) return;
    const offset = nextFreeOffset(project.room, project.cabinets, src.wall, src.width, src.elevation, src.elevation + src.height, src.depth);
    const prefix = src.name.match(/^[A-Za-z]+/)?.[0] ?? 'C';
    let n = 1;
    while (project.cabinets.some((c) => c.name === `${prefix}${n}`)) n++;
    const copy: Cabinet = { ...src, id: uid('cab'), name: `${prefix}${n}`, offset, rows: src.rows.map((r) => ({ ...r, id: uid('row') })) };
    get().commit((p) => ({ ...p, cabinets: [...p.cabinets, copy] }));
    set({ selectedId: copy.id });
  },
  addPanel: (panel) => {
    get().commit((p) => ({ ...p, panels: [...(p.panels ?? []), panel] }));
    set({ selectedId: panel.id });
  },
  updatePanel: (id, patch) =>
    get().commit((p) => ({ ...p, panels: (p.panels ?? []).map((w) => (w.id === id ? { ...w, ...patch } : w)) })),
  loadProject: (p) => {
    // Keep the design being replaced, in case it held work that never got saved anywhere
    try { localStorage.setItem(BACKUP_KEY, JSON.stringify({ at: Date.now(), project: get().project })); } catch { /* storage blocked */ }
    get().commit(() => normalize(p));
    set({ selectedId: null });
  },
}));

// Custom profile drawings travel with the design
setCustomDrawings(useStore.getState().project.profiles);
useStore.subscribe((s, prev) => {
  if (s.project.profiles !== prev.project.profiles) setCustomDrawings(s.project.profiles);
  const dragEnded = prev.dragging && !s.dragging;
  if ((s.project === prev.project && !dragEnded) || s.dragging) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s.project));
  } catch {
    // Storage can be unavailable (private windows); the session still works.
  }
});

/** What's picked: the group when there is one, else the one selected cabinet. */
export function picked(st: { selectedId: string | null; group: string[] }): string[] {
  return st.group.length > 1 && st.selectedId && st.group.includes(st.selectedId) ? st.group : st.selectedId ? [st.selectedId] : [];
}

/**
 * The wall a group runs along: the one most of its cabinets hang on (a cabinet turned to face a side
 * room doesn't change it), or the selected cabinet's on a tie.
 */
export function runWall(cabs: Cabinet[], selectedId: string | null): WallId | null {
  if (!cabs.length) return null;
  const count = new Map<WallId, number>();
  for (const c of cabs) count.set(c.wall, (count.get(c.wall) ?? 0) + 1);
  const best = Math.max(...count.values());
  const lead = cabs.find((c) => c.id === selectedId);
  return lead && count.get(lead.wall) === best ? lead.wall : [...count].find(([, n]) => n === best)![0];
}

/** A cabinet standing off its wall (an island, or one turned to face another room) can move either way in the plan. */
export const freeStanding = (c: Cabinet) => !!c.island || (c.wallInset ?? 0) > 0;

/** Cabinets that carry a crown: uppers, talls and pilasters (not bases, shelves or mantels). */
export const takesCrown = (c: Cabinet) => c.kind === 'wall' || c.kind === 'tall' || c.kind === 'pilaster';

/** Runs up to the ceiling, or near enough that a crown would close the gap. */
export const reachesCeiling = (c: Cabinet, ceiling: number) => takesCrown(c) && !c.island && ceiling - (c.elevation + c.height) <= 4 + 1e-6;
