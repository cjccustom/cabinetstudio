// Shop Clock, built in: jobs, a clock-in timer by task, time entries and a to-do list per job.
// Kept in the artifact's shared database so the shop phone and the office computer see the same
// clock; falls back to this browser's storage where the database isn't available.
import { create } from 'zustand';
import { uid } from '../model/defaults';

export const PHASES = ['Design & layout', 'Material run', 'Milling', 'Casework', 'Doors & drawers', 'Finishing', 'Install', 'Trim', 'Other'] as const;
export type Phase = (typeof PHASES)[number];

export interface ShopJob {
  id: string;
  name: string;
  client: string;
  /** Quoted price. */
  quote: number;
  /** What the job's materials (and any painter) cost the shop. */
  materials: number;
  estHours: number;
  /** The quote's labor estimate split by task, so actual time can be checked against it. */
  estByPhase?: Partial<Record<Phase, number>>;
  status: 'active' | 'done';
  createdAt: number;
  notes?: string;
}
export interface Entry { id: string; jobId: string; phase: Phase; start: number; end: number; note?: string }
export interface Timer { jobId: string; phase: Phase; start: number }
export interface Todo { id: string; jobId: string; text: string; done: boolean; createdAt: number }
/**
 * The shop's price book: plywood by the sheet at each thickness, lumber by the board foot. Shared
 * by every job and device; a job keeps the prices it was quoted with until they're updated.
 */
export interface PriceItem {
  id: string;
  kind: 'plywood' | 'lumber';
  name: string;
  /** Plywood: $ per 4x8 sheet before tax, by thickness as written ("3/4\""). */
  sheet?: Record<string, number>;
  /** Lumber: $ per board foot, 4/4. */
  perBF?: number;
  updatedAt: number;
  /** One of the shop's starting entries (it can be re-priced, not removed). */
  builtin?: boolean;
}

interface ShopState {
  mode: 'loading' | 'db' | 'local';
  jobs: Record<string, ShopJob>;
  entries: Record<string, Entry>;
  todos: Record<string, Todo>;
  timer: Timer | null;
  rate: number;
  /** Edits and additions to the price book, by id; the built-in entries fill in the rest. */
  prices: Record<string, PriceItem>;
  error: string | null;
  canExport: boolean;
}

export const useShop = create<ShopState>(() => ({ mode: 'loading', jobs: {}, entries: {}, todos: {}, timer: null, rate: 75, prices: {}, error: null, canExport: false }));

type Db = {
  doc(path: string): { set(d: Record<string, unknown>): Promise<void>; delete(): Promise<void>; onSnapshot(n: (s: { exists: boolean; data(): Record<string, unknown> | undefined }) => void, e?: (err: { code: string }) => void): () => void };
  collection(path: string): { onSnapshot(n: (s: { docs: { id: string; data(): Record<string, unknown> | undefined }[] }) => void, e?: (err: { code: string }) => void): () => void };
};
type Downloads = { save(r: { filename: string; data: string }): Promise<unknown> };

let db: Db | null = null;
let downloads: Downloads | null = null;
let started = false;
const LKEY = 'cabinet-studio.shop.v1';

function saveLocal() {
  const s = useShop.getState();
  try { localStorage.setItem(LKEY, JSON.stringify({ jobs: s.jobs, entries: s.entries, todos: s.todos, timer: s.timer, rate: s.rate, prices: s.prices })); } catch { /* storage blocked */ }
}
function loadLocal() {
  try {
    const d = JSON.parse(localStorage.getItem(LKEY) || 'null');
    if (d) useShop.setState({ jobs: d.jobs ?? {}, entries: d.entries ?? {}, todos: d.todos ?? {}, timer: d.timer ?? null, rate: d.rate ?? 75, prices: d.prices ?? {} });
  } catch { /* storage blocked */ }
}

const lostConnection = () => useShop.setState({ error: 'Lost the connection to the shop clock. Reload the page to reconnect.' });

/** Start once: subscribe to the shared database, or load this browser's copy. */
export async function startShop() {
  if (started) return;
  started = true;
  const claude = (window as unknown as { claude?: { use(n: string): Promise<unknown> } }).claude;
  try {
    if (claude?.use) {
      db = (await claude.use('db')) as Db | null;
      downloads = (await claude.use('downloads')) as Downloads | null;
    }
  } catch { db = null; }
  useShop.setState({ canExport: !!downloads });
  if (!db) {
    loadLocal();
    useShop.setState({ mode: 'local' });
    return;
  }
  const toMap = <T,>(docs: { id: string; data(): Record<string, unknown> | undefined }[]) =>
    Object.fromEntries(docs.map((d) => [d.id, { ...(d.data() as object), id: d.id } as T]));
  db.collection('jobs').onSnapshot((s) => useShop.setState({ jobs: toMap<ShopJob>(s.docs), mode: 'db' }), lostConnection);
  db.collection('entries').onSnapshot((s) => useShop.setState({ entries: toMap<Entry>(s.docs) }), lostConnection);
  db.collection('todos').onSnapshot((s) => useShop.setState({ todos: toMap<Todo>(s.docs) }), lostConnection);
  db.collection('prices').onSnapshot((s) => useShop.setState({ prices: toMap<PriceItem>(s.docs) }), lostConnection);
  db.doc('timer/active').onSnapshot((d) => {
    const v = d.exists ? (d.data() as Partial<Timer>) : null;
    useShop.setState({ timer: v?.jobId ? (v as Timer) : null });
  }, lostConnection);
  db.doc('settings/shop').onSnapshot((d) => { if (d.exists) useShop.setState({ rate: Number(d.data()?.rate) || 75 }); }, lostConnection);
}

type Kind = 'jobs' | 'entries' | 'todos' | 'prices';

/** Change local state at once, then save to the database (or this browser). */
async function write(kind: Kind | 'timer' | 'settings', id: string, data: Record<string, unknown> | null) {
  const s = useShop.getState();
  if (kind === 'timer') useShop.setState({ timer: data && data.jobId ? (data as unknown as Timer) : null });
  else if (kind === 'settings') useShop.setState({ rate: Number(data?.rate) || s.rate });
  else {
    const next = { ...s[kind] } as Record<string, unknown>;
    if (data) next[id] = data; else delete next[id];
    useShop.setState({ [kind]: next } as Partial<ShopState>);
  }
  if (!db) { saveLocal(); return; }
  const path = kind === 'timer' ? 'timer/active' : kind === 'settings' ? 'settings/shop' : `${kind}/${id}`;
  try {
    if (data) await db.doc(path).set(data); else await db.doc(path).delete();
  } catch (e) {
    const code = (e as { code?: string }).code;
    useShop.setState({ error: code === 'quota_exceeded' ? 'The shop clock’s storage is full. Delete finished jobs you no longer need.' : 'Couldn’t save that change to the shop clock. Check your connection and try again.' });
  }
}

export const saveJob = (j: ShopJob) => write('jobs', j.id, j as unknown as Record<string, unknown>);
export async function deleteJob(id: string) {
  const s = useShop.getState();
  if (s.timer?.jobId === id) await write('timer', '', { jobId: null });
  for (const e of Object.values(s.entries).filter((x) => x.jobId === id)) await write('entries', e.id, null);
  for (const t of Object.values(s.todos).filter((x) => x.jobId === id)) await write('todos', t.id, null);
  await write('jobs', id, null);
}

export async function stopTimer() {
  const t = useShop.getState().timer;
  if (!t) return;
  const end = Date.now();
  await write('timer', '', { jobId: null });
  // Under 30 seconds is a mis-tap, not work
  if (end - t.start >= 30e3) { const id = uid('time'); await write('entries', id, { id, jobId: t.jobId, phase: t.phase, start: t.start, end }); }
}
export async function startTimer(jobId: string, phase: Phase) {
  if (useShop.getState().timer) await stopTimer();
  await write('timer', '', { jobId, phase, start: Date.now() });
}

export const saveEntry = (e: Entry) => write('entries', e.id, e as unknown as Record<string, unknown>);
export const deleteEntry = (id: string) => write('entries', id, null);
export const saveTodo = (t: Todo) => write('todos', t.id, t as unknown as Record<string, unknown>);
export const deleteTodo = (id: string) => write('todos', id, null);
export const newTodo = (jobId: string, text: string, n = 0): Todo => ({ id: uid('todo'), jobId, text, done: false, createdAt: Date.now() + n });
export const setRate = (rate: number) => write('settings', '', { rate });
export const savePrice = (item: PriceItem) => write('prices', item.id, { ...item, updatedAt: Date.now() } as unknown as Record<string, unknown>);
export const deletePrice = (id: string) => write('prices', id, null);
export const dismissError = () => useShop.setState({ error: null });

export const hours = (ms: number) => ms / 36e5;

/** Hours logged on a job, by task, counting a running clock. */
export function jobHours(jobId: string, s = useShop.getState(), now = Date.now()) {
  const byPhase: Partial<Record<Phase, number>> = {};
  let total = 0;
  const add = (p: Phase, ms: number) => { byPhase[p] = (byPhase[p] ?? 0) + hours(ms); total += hours(ms); };
  for (const e of Object.values(s.entries)) if (e.jobId === jobId) add(e.phase, e.end - e.start);
  if (s.timer?.jobId === jobId) add(s.timer.phase, now - s.timer.start);
  return { total, byPhase };
}

/** The time log as a spreadsheet, offered as a download where the page can. */
export async function exportCsv() {
  if (!downloads) return;
  const s = useShop.getState();
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const day = (t: number) => new Date(t).toISOString().slice(0, 10);
  const hm = (t: number) => new Date(t).toTimeString().slice(0, 5);
  const lines = ['Date,Job,Client,Task,Start,End,Hours,Note'];
  for (const e of Object.values(s.entries).sort((a, b) => a.start - b.start)) {
    const j = s.jobs[e.jobId];
    lines.push([day(e.start), q(j?.name), q(j?.client), q(e.phase), hm(e.start), hm(e.end), hours(e.end - e.start).toFixed(2), q(e.note)].join(','));
  }
  try { await downloads.save({ filename: `shop-time-log-${day(Date.now())}.csv`, data: lines.join('\n') }); } catch { /* viewer declined */ }
}
