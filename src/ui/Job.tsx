import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { releaseOf } from '../model/release';
import {
  PHASES, deleteEntry, deleteTodo, dismissError, exportCsv, hours, jobHours, newTodo, saveEntry, saveJob, saveTodo, setRate, startShop, startTimer, stopTimer, useShop,
  type Entry, type Phase, type ShopJob,
} from '../shop/shop';
import { jobNumbers, starterTodos } from '../shop/fromDesign';
import { uid } from '../model/defaults';
import { Field, Section } from './fields';

const money = (v: number) => `${v < 0 ? '−' : ''}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`;
const hrs = (h: number) => `${h.toFixed(1)} hr`;
const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const tod = (t: number) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const dayKey = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const hhmm = (t: number) => new Date(t).toTimeString().slice(0, 5);
const dur = (ms: number) => { const m = Math.round(ms / 6e4); return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`; };

/** Re-render every second while the clock runs. */
function useTick(on: boolean) {
  const [, setN] = useState(0);
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setN((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [on]);
}

function useShopStart() {
  useEffect(() => { void startShop(); }, []);
  return useShop();
}

const activeJobs = (jobs: Record<string, ShopJob>) => Object.values(jobs).filter((j) => j.status !== 'done').sort((a, b) => b.createdAt - a.createdAt);

/* ---------- Left: the clock ---------- */

export function JobClock() {
  const shop = useShopStart();
  const linked = useStore((s) => s.project.shopJobId);
  const [pickJob, setPickJob] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('Casework');
  const [adding, setAdding] = useState(false);
  const t = shop.timer && shop.jobs[shop.timer.jobId] ? shop.timer : null;
  useTick(!!t);
  const active = activeJobs(shop.jobs);
  const job = pickJob && shop.jobs[pickJob] ? pickJob : linked && shop.jobs[linked]?.status === 'active' ? linked : active[0]?.id;
  const today = dayKey(Date.now());
  const todays = Object.values(shop.entries).filter((e) => dayKey(e.start) === today).sort((a, b) => b.start - a.start);
  const total = todays.reduce((a, e) => a + e.end - e.start, 0) + (t ? Date.now() - t.start : 0);
  return (
    <aside className="sidebar shop-clock">
      <div className="clock-top">
        <div>
          <div className="eyebrow">{new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          <h3>Shop clock</h3>
        </div>
        <div className="today"><div className="eyebrow">Today</div><b>{hrs(hours(total))}</b></div>
      </div>
      {shop.error && <p className="warn">{shop.error} <button className="mini" onClick={dismissError}>Dismiss</button></p>}
      {shop.mode === 'local' && <p className="hint">Saving the clock in this browser only. Open Cabinet Studio from claude.ai to share it with your phone.</p>}
      {shop.mode === 'loading' && <p className="hint">Loading the clock…</p>}
      {t ? (
        <div className="clock-card running">
          <div className="row-between"><span className="pill live">On the clock</span><span className="muted">since {tod(t.start)}</span></div>
          <div className="elapsed">{clock(Date.now() - t.start)}</div>
          <div><strong>{shop.jobs[t.jobId].name}</strong><div className="muted">{t.phase}</div></div>
          <button className="big stop" onClick={() => void stopTimer()}>Clock out</button>
          <div className="eyebrow">Switch task</div>
          <div className="chips">{PHASES.filter((p) => p !== t.phase).map((p) => <button key={p} className="chip" onClick={() => void startTimer(t.jobId, p)}>{p}</button>)}</div>
        </div>
      ) : active.length ? (
        <div className="clock-card">
          <div className="eyebrow">Job</div>
          <div className="joblist">
            {active.map((j) => (
              <button key={j.id} className="jobpick" aria-pressed={job === j.id} onClick={() => setPickJob(j.id)}>
                <span><b>{j.name}</b>{j.client && <small className="muted"> · {j.client}</small>}</span>
                <span className="muted">{hrs(jobHours(j.id, shop).total)}</span>
              </button>
            ))}
          </div>
          <div className="eyebrow">Task</div>
          <div className="chips">{PHASES.map((p) => <button key={p} className="chip" aria-pressed={phase === p} onClick={() => setPhase(p)}>{p}</button>)}</div>
          <button className="big primary" disabled={!job} onClick={() => job && void startTimer(job, phase)}>Clock in</button>
        </div>
      ) : (
        <p className="hint">No open jobs on the clock yet. Add this design’s job from the middle of this page once it’s sold.</p>
      )}
      <div className="row-between" style={{ marginTop: 14 }}>
        <h4 className="sub" style={{ margin: 0 }}>Today</h4>
        {active.length > 0 && <button className="mini" onClick={() => setAdding(!adding)}>{adding ? 'Cancel' : 'Add time by hand'}</button>}
      </div>
      {adding && <EntryForm jobId={job} onDone={() => setAdding(false)} />}
      {todays.length ? <div className="entries">{todays.map((e) => <EntryRow key={e.id} e={e} />)}</div> : <p className="hint">Nothing logged yet today.</p>}
    </aside>
  );
}

function EntryRow({ e, showJob = true }: { e: Entry; showJob?: boolean }) {
  const jobs = useShop((s) => s.jobs);
  const [edit, setEdit] = useState(false);
  if (edit) return <EntryForm entry={e} onDone={() => setEdit(false)} />;
  return (
    <button className="entry" onClick={() => setEdit(true)} title="Edit">
      <span>{showJob && <b>{jobs[e.jobId]?.name ?? 'Deleted job'}</b>}<small>{e.phase} · {tod(e.start)}–{tod(e.end)}{e.note ? ` · ${e.note}` : ''}</small></span>
      <span className="num">{dur(e.end - e.start)}</span>
    </button>
  );
}

function EntryForm({ entry, jobId, onDone }: { entry?: Entry; jobId?: string; onDone: () => void }) {
  const jobs = useShop((s) => s.jobs);
  const now = Date.now();
  const e = entry ?? { id: '', jobId: jobId ?? activeJobs(jobs)[0]?.id ?? '', phase: 'Casework' as Phase, start: now - 36e5, end: now };
  const [f, setF] = useState({ jobId: e.jobId, phase: e.phase, date: dayKey(e.start), start: hhmm(e.start), end: hhmm(e.end), note: e.note ?? '' });
  const [err, setErr] = useState('');
  const save = () => {
    const s = new Date(`${f.date}T${f.start}`).getTime(), en = new Date(`${f.date}T${f.end}`).getTime();
    if (!f.jobId || isNaN(s) || isNaN(en)) return setErr('Fill in the job, date, start and end.');
    if (en <= s) return setErr('End has to be after start.');
    void saveEntry({ id: entry?.id || uid('time'), jobId: f.jobId, phase: f.phase, start: s, end: en, ...(f.note ? { note: f.note } : {}) });
    onDone();
  };
  return (
    <div className="entry-form">
      <select aria-label="Job" value={f.jobId} onChange={(x) => setF({ ...f, jobId: x.target.value })}>
        {Object.values(jobs).map((j) => <option key={j.id} value={j.id}>{j.name}{j.status === 'done' ? ' (finished)' : ''}</option>)}
      </select>
      <select aria-label="Task" value={f.phase} onChange={(x) => setF({ ...f, phase: x.target.value as Phase })}>{PHASES.map((p) => <option key={p}>{p}</option>)}</select>
      <div className="grid3">
        <input aria-label="Date" type="date" value={f.date} onChange={(x) => setF({ ...f, date: x.target.value })} />
        <input aria-label="Start" type="time" value={f.start} onChange={(x) => setF({ ...f, start: x.target.value })} />
        <input aria-label="End" type="time" value={f.end} onChange={(x) => setF({ ...f, end: x.target.value })} />
      </div>
      <input aria-label="Note" placeholder="Note (optional)" value={f.note} onChange={(x) => setF({ ...f, note: x.target.value })} />
      {err && <p className="warn">{err}</p>}
      <div className="order-actions">
        <button className="primary" onClick={save}>{entry ? 'Save' : 'Add time'}</button>
        <button className="mini" onClick={onDone}>Cancel</button>
        {entry && <button className="mini danger" onClick={() => { void deleteEntry(entry.id); onDone(); }}>Delete</button>}
      </div>
    </div>
  );
}

/* ---------- Middle: this job ---------- */

export function JobMain() {
  const shop = useShopStart();
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  const nums = useMemo(() => jobNumbers(project), [project]);
  const job = project.shopJobId ? shop.jobs[project.shopJobId] : undefined;
  useTick(!!shop.timer && shop.timer.jobId === job?.id);
  const deposit = releaseOf(project).depositDate;
  const link = (id: string | undefined) => commit((p) => ({ ...p, shopJobId: id }));

  if (!job) {
    const unlinked = activeJobs(shop.jobs);
    return (
      <main className="stage job-stage">
        <div className="job-start">
          <h2>{project.name}</h2>
          {project.shopJobId && shop.mode !== 'loading' && <p className="warn">This design’s clock job was deleted.</p>}
          <p>{deposit ? `Deposit received ${new Date(deposit + 'T12:00').toLocaleDateString()}.` : 'No deposit recorded yet (Orders tab). Usually you’d start the job once it’s sold.'}</p>
          <div className="stats">
            <Stat label="Quote" value={money(nums.quote)} />
            <Stat label="Materials" value={money(nums.materials)} />
            <Stat label="Estimated hours" value={nums.estHours.toFixed(1)} />
          </div>
          <div className="order-actions">
            <button className="primary" disabled={shop.mode === 'loading'} onClick={() => {
              const id = uid('job');
              void saveJob({ id, name: project.name, client: '', ...nums, status: 'active', createdAt: Date.now() });
              for (const [i, text] of starterTodos(project).entries()) void saveTodo(newTodo(id, text, i));
              link(id);
            }}>Start this job on the shop clock</button>
            {unlinked.length > 0 && (
              <select aria-label="Link to a job already on the clock" value="" onChange={(e) => e.target.value && link(e.target.value)}>
                <option value="">…or link to a job already on the clock</option>
                {unlinked.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
            )}
          </div>
          <p className="hint">Starting the job puts it on the clock with the quote, materials and the labor estimate split by task, and gives it a to-do list for ordering and install.</p>
        </div>
      </main>
    );
  }

  const h = jobHours(job.id, shop);
  const net = job.quote - job.materials;
  const breakEven = shop.rate ? net / shop.rate : 0;
  // Earning per hour means nothing until there's real time on the job
  const earning = h.total >= 0.25 ? net / h.total : 0;
  const profit = net - h.total * shop.rate;
  const stale = nums.quote !== job.quote || nums.materials !== job.materials || nums.estHours !== job.estHours;
  const entries = Object.values(shop.entries).filter((e) => e.jobId === job.id).sort((a, b) => b.start - a.start);
  const days = new Map<string, Entry[]>();
  for (const e of entries) days.set(dayKey(e.start), [...(days.get(dayKey(e.start)) ?? []), e]);
  const scale = Math.max(h.total, breakEven, job.estHours, 1) * 1.1;
  return (
    <main className="stage job-stage">
      <div className="job-head">
        <div>
          <div className="eyebrow">{job.status === 'done' ? 'Finished job' : 'Open job'}</div>
          <BlurInput className="name-input" label="Job name" value={job.name} onSave={(v) => void saveJob({ ...job, name: v || job.name })} />
          <BlurInput className="client-input" label="Client" placeholder="Client" value={job.client} onSave={(v) => void saveJob({ ...job, client: v })} />
        </div>
        <div className="order-actions">
          {job.status === 'done'
            ? <button onClick={() => void saveJob({ ...job, status: 'active' })}>Reopen</button>
            : <button onClick={() => { if (shop.timer?.jobId === job.id) void stopTimer(); void saveJob({ ...job, status: 'done' }); }}>Mark finished</button>}
          <button className="mini" onClick={() => link(undefined)} title="This design stops pointing at the clock job; the job and its hours stay on the clock">Unlink</button>
        </div>
      </div>
      <div className="tape" role="img" aria-label={`${hrs(h.total)} logged, estimate ${hrs(job.estHours)}, break-even ${hrs(breakEven)}`}>
        <div className="used" style={{ width: `${Math.min(100, (h.total / scale) * 100)}%` }} />
        {job.estHours > 0 && <div className="mark est" style={{ left: `${(job.estHours / scale) * 100}%` }} />}
        {breakEven > 0 && <div className="mark be" style={{ left: `${(breakEven / scale) * 100}%` }} />}
      </div>
      <div className="tape-legend"><span><i className="k used" />{hrs(h.total)} logged</span><span><i className="k est" />{hrs(job.estHours)} estimated</span><span><i className="k be" />{hrs(breakEven)} break-even</span></div>
      <div className="stats">
        <Stat label="Hours logged" value={h.total.toFixed(1)} sub={job.estHours ? `${Math.round((h.total / job.estHours) * 100)}% of estimate` : undefined} />
        <Stat label="Earning per hour" value={earning ? money(earning) : '—'} good={earning ? earning >= shop.rate : undefined} />
        <Stat label="Quote − materials" value={money(net)} />
        <Stat label="Profit over shop rate" value={money(profit)} good={profit >= 0} />
      </div>
      {stale && (
        <p className="hint">
          The design has changed since this job went on the clock (quote {money(nums.quote)}, materials {money(nums.materials)}, {nums.estHours.toFixed(1)} hr).{' '}
          <button className="mini" onClick={() => void saveJob({ ...job, ...nums })}>Update the job</button>
        </p>
      )}

      <h3>Estimate vs. actual</h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Task</th><th className="num">Estimated</th><th className="num">Actual</th><th className="num">Difference</th></tr></thead>
          <tbody>
            {PHASES.filter((p) => job.estByPhase?.[p] || h.byPhase[p]).map((p) => {
              const est = job.estByPhase?.[p] ?? 0, act = h.byPhase[p] ?? 0;
              return (
                <tr key={p}>
                  <td>{p}</td>
                  <td className="num">{est ? est.toFixed(1) : '—'}</td>
                  <td className="num">{act ? act.toFixed(1) : '—'}</td>
                  <td className={`num ${est && act > est ? 'bad' : ''}`}>{est && act ? `${act > est ? '+' : '−'}${Math.abs(act - est).toFixed(1)}` : ''}</td>
                </tr>
              );
            })}
            <tr className="total"><td>Total</td><td className="num">{job.estHours.toFixed(1)}</td><td className="num">{h.total.toFixed(1)}</td><td className={`num ${h.total > job.estHours ? 'bad' : ''}`}>{h.total ? `${h.total > job.estHours ? '+' : '−'}${Math.abs(h.total - job.estHours).toFixed(1)}` : ''}</td></tr>
          </tbody>
        </table>
      </div>
      <p className="hint">The estimate is the Quote tab’s labor standards. Material runs, milling and finishing are counted inside casework there; once a few jobs are logged here, the standards can be set from your real hours.</p>

      <h3>Time log</h3>
      {[...days].map(([k, es]) => (
        <div key={k}>
          <div className="eyebrow">{new Date(k + 'T12:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} · {hrs(es.reduce((t, e) => t + hours(e.end - e.start), 0))}</div>
          <div className="entries">{es.map((e) => <EntryRow key={e.id} e={e} showJob={false} />)}</div>
        </div>
      ))}
      {!entries.length && <p className="hint">Entries show up here as you clock in and out.</p>}
    </main>
  );
}

/** A text box that saves when you leave it, so typing doesn't write on every key. */
function BlurInput({ value, onSave, label, className, placeholder }: { value: string; onSave: (v: string) => void; label: string; className?: string; placeholder?: string }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return <input className={className} aria-label={label} placeholder={placeholder} value={v} onChange={(e) => setV(e.target.value)}
    onBlur={() => v.trim() !== value && onSave(v.trim())} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />;
}

function Stat({ label, value, sub, good }: { label: string; value: string; sub?: string; good?: boolean }) {
  return (
    <div className="stat">
      <span className="eyebrow">{label}</span>
      <b className={good === undefined ? '' : good ? 'good' : 'bad'}>{value}</b>
      {sub && <span className="muted">{sub}</span>}
    </div>
  );
}

/* ---------- Right: to-dos, notes, shop report ---------- */

export function JobSide() {
  const shop = useShopStart();
  const project = useStore((s) => s.project);
  const job = project.shopJobId ? shop.jobs[project.shopJobId] : undefined;
  const [text, setText] = useState('');
  const [notes, setNotes] = useState(job?.notes ?? '');
  useEffect(() => { setNotes(job?.notes ?? ''); }, [job?.id, job?.notes]);
  const todos = job ? Object.values(shop.todos).filter((t) => t.jobId === job.id).sort((a, b) => Number(a.done) - Number(b.done) || a.createdAt - b.createdAt) : [];
  const open = todos.filter((t) => !t.done).length;
  const add = () => { if (job && text.trim()) { void saveTodo(newTodo(job.id, text.trim())); setText(''); } };
  return (
    <aside className="panel">
      <div className="panel-body">
        {job ? (
          <>
            <Section title="To do" aside={<span className="muted">{open} open</span>}>
              <ul className="todos">
                {todos.map((t) => (
                  <li key={t.id} className={t.done ? 'done' : ''}>
                    <label><input type="checkbox" checked={t.done} onChange={(e) => void saveTodo({ ...t, done: e.target.checked })} /> <span>{t.text}</span></label>
                    <button className="mini" aria-label="Delete" onClick={() => void deleteTodo(t.id)}>×</button>
                  </li>
                ))}
              </ul>
              <div className="todo-add">
                <input aria-label="New to-do" placeholder="Add a to-do" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
                <button onClick={add}>Add</button>
              </div>
              {!todos.length && <button className="mini" onClick={() => starterTodos(project).forEach((x, i) => void saveTodo(newTodo(job.id, x, i)))}>Add the ordering & install checklist</button>}
            </Section>
            <Section title="Notes">
              <textarea className="job-notes" aria-label="Job notes" rows={8} value={notes} placeholder="Site details, customer decisions, anything to remember on this job"
                onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (job.notes ?? '') && void saveJob({ ...job, notes })} />
            </Section>
          </>
        ) : (
          <p className="hint">Start the job on the shop clock to get its to-do list and notes.</p>
        )}
        <ShopReport />
      </div>
    </aside>
  );
}

function ShopReport() {
  const shop = useShop();
  const [rate, setR] = useState(String(shop.rate));
  useEffect(() => setR(String(shop.rate)), [shop.rate]);
  const rows = Object.values(shop.jobs).map((j) => {
    const h = jobHours(j.id, shop).total;
    return { j, h, eff: h ? (j.quote - j.materials) / h : 0 };
  }).filter((r) => r.h >= 0.25).sort((a, b) => a.eff - b.eff);
  // Only finished jobs say anything about how estimates hold up
  const withEst = rows.filter((r) => r.j.estHours && r.j.status === 'done');
  const avg = withEst.length ? withEst.reduce((t, r) => t + r.h / r.j.estHours, 0) / withEst.length : 0;
  return (
    <Section title="All jobs">
      <Field label="Shop rate ($ per hour)" htmlFor="shop-rate" hint="What each shop hour has to bring in. Break-even and profit are figured against it.">
        <input id="shop-rate" inputMode="decimal" value={rate} onChange={(e) => setR(e.target.value)} onBlur={() => { const v = parseFloat(rate); if (v >= 0 && v !== shop.rate) void setRate(v); }} />
      </Field>
      {rows.length ? (
        <>
          {avg > 0 && <p className="hint">Across finished jobs, actual time runs {Math.round(avg * 100)}% of estimate{avg > 1.05 ? ': the labor standards are low' : avg < 0.95 ? ': the labor standards are generous' : ''}.</p>}
          <div className="table-wrap">
            <table>
              <thead><tr><th>Job</th><th className="num">Hours</th><th className="num">Est.</th><th className="num">$/hr</th></tr></thead>
              <tbody>{rows.map((r) => <tr key={r.j.id}><td>{r.j.name}{r.j.status === 'done' ? '' : ' •'}</td><td className="num">{r.h.toFixed(1)}</td><td className="num">{r.j.estHours ? r.j.estHours.toFixed(0) : '—'}</td><td className={`num ${r.eff >= shop.rate ? 'good' : 'bad'}`}>{money(r.eff)}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="hint">Lowest earning rate first. • = still open.</p>
        </>
      ) : <p className="hint">No time logged yet.</p>}
      {shop.canExport && <button className="mini" onClick={() => void exportCsv()}>Export time log (CSV)</button>}
    </Section>
  );
}
