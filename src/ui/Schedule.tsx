// Appointments: set in Cabinet Studio, kept by the client portal, and shown on Cody's iPhone
// through the private calendar it subscribes to. The Clients tab gets a Coming up list across
// every job, and each client sheet its own appointments.
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { useStore } from '../store';
import { clientName, clientOf } from '../model/client';
import { apptKinds, calendarFeed, deleteAppointment, listAppointments, PortalError, saveAppointment, type Appointment, type ApptKind } from '../portal';
import { askConfirm } from './Confirm';
import { newJobId } from './Portal';

const useSched = create<{ appts: Appointment[] | null; error: string; set: (p: Partial<{ appts: Appointment[] | null; error: string }>) => void }>((set) => ({ appts: null, error: '', set: (p) => set(p) }));
const errText = (e: unknown) => (e instanceof PortalError ? e.message : `Something went wrong: ${(e as Error).message}`);

export async function loadSchedule() {
  try {
    const from = new Date(Date.now() - 30 * 864e5).toISOString();
    useSched.getState().set({ appts: await listAppointments(from), error: '' });
  } catch (e) { useSched.getState().set({ error: errText(e) }); }
}

const kindLabel = (k: ApptKind) => apptKinds.find((x) => x.v === k)?.label ?? 'Appointment';
const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA');
const dayLabel = (iso: string) => {
  const d = dayKey(iso), today = dayKey(new Date().toISOString()), tomorrow = dayKey(new Date(Date.now() + 864e5).toISOString());
  const name = new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  return d === today ? `Today · ${name}` : d === tomorrow ? `Tomorrow · ${name}` : name;
};
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const pad = (n: number) => String(n).padStart(2, '0');
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/* ---------- The form ---------- */

interface Draft { id?: string; jobId?: string; folder?: Appointment['folder']; who: string; kind: ApptKind; date: string; time: string; minutes: number; location: string; phone: string; notes: string; clientNote: string; remind: number[]; share: boolean }

function ApptForm({ draft: start, onlineJob, onClose }: { draft: Draft; onlineJob: boolean; onClose: () => void }) {
  const [d, setD] = useState(start);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const put = (p: Partial<Draft>) => setD({ ...d, ...p });
  const save = async () => {
    setBusy(true); setError('');
    try {
      const startAt = new Date(`${d.date}T${d.time}`);
      if (Number.isNaN(startAt.getTime())) throw new PortalError('Pick a date and time.');
      await saveAppointment({ id: d.id, jobId: d.jobId, folder: d.folder, who: d.who.trim() || kindLabel(d.kind), kind: d.kind, start: startAt.toISOString(), minutes: d.minutes, location: d.location.trim(), phone: d.phone.trim(), notes: d.notes.trim(), clientNote: d.clientNote.trim(), remind: d.remind, share: onlineJob && d.share });
      await loadSchedule();
      onClose();
    } catch (e) { setError(errText(e)); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!d.id || !(await askConfirm('Delete this appointment? It comes off your phone at the next refresh.', 'Delete'))) return;
    setBusy(true);
    try { await deleteAppointment(d.id); await loadSchedule(); onClose(); } catch (e) { setError(errText(e)); setBusy(false); }
  };
  const toggle = (m: number) => put({ remind: d.remind.includes(m) ? d.remind.filter((x) => x !== m) : [...d.remind, m].sort((a, b) => a - b) });
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal appt-form" role="dialog" aria-modal="true" aria-labelledby="ap-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="ap-title">{d.id ? 'Appointment' : 'New appointment'}</h2>
        <div className="grid2">
          <label>Who / what<input value={d.who} onChange={(e) => put({ who: e.target.value })} placeholder="Client, or e.g. Lumber pickup" /></label>
          <label>Type<select value={d.kind} onChange={(e) => put({ kind: e.target.value as ApptKind })}>{apptKinds.map((k) => <option key={k.v} value={k.v}>{k.label}</option>)}</select></label>
        </div>
        <div className="grid3">
          <label>Date<input type="date" value={d.date} onChange={(e) => put({ date: e.target.value })} /></label>
          <label>Time<input type="time" step={900} value={d.time} onChange={(e) => put({ time: e.target.value })} /></label>
          <label>Length<select value={d.minutes} onChange={(e) => put({ minutes: Number(e.target.value) })}>{[30, 60, 90, 120, 180, 240, 480].map((m) => <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} hr${m > 60 ? 's' : ''}`}</option>)}</select></label>
        </div>
        <div className="grid2">
          <label>Where<input value={d.location} onChange={(e) => put({ location: e.target.value })} /></label>
          <label>Phone<input type="tel" value={d.phone} onChange={(e) => put({ phone: e.target.value })} /></label>
        </div>
        <label>My notes <span className="hint">(only you see these)</span><textarea rows={3} value={d.notes} onChange={(e) => put({ notes: e.target.value })} placeholder="What to bring, what to ask" /></label>
        <div className="chk-line">
          <span>Remind me</span>
          {[[15, '15 min'], [60, '1 hour'], [1440, '1 day']].map(([m, l]) => <label key={m} className="chk-row"><input type="checkbox" checked={d.remind.includes(m as number)} onChange={() => toggle(m as number)} /> {l} before</label>)}
        </div>
        {onlineJob ? (
          <>
            <label className="chk-row"><input type="checkbox" checked={d.share} onChange={(e) => put({ share: e.target.checked })} /> Show on the client’s project page, with “Add to my calendar”</label>
            {d.share && <label>Note for the client<input value={d.clientNote} onChange={(e) => put({ clientNote: e.target.value })} placeholder="e.g. I’ll bring door and finish samples" /></label>}
          </>
        ) : d.jobId ? <p className="hint">Publish their proposal to the portal to show visits on their page.</p> : null}
        {error && <p className="warn">{error}</p>}
        <div className="modal-actions">
          {d.id && <button onClick={remove} disabled={busy} style={{ marginRight: 'auto' }}>Delete</button>}
          <button onClick={onClose}>Cancel</button>
          <button className="primary" disabled={busy || !d.date || !d.time} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

const fromAppt = (a: Appointment): Draft => {
  const t = new Date(a.start);
  return { id: a.id, jobId: a.jobId, folder: a.folder, who: a.who, kind: a.kind, date: localDate(t), time: localTime(t), minutes: a.minutes, location: a.location ?? '', phone: a.phone ?? '', notes: a.notes ?? '', clientNote: a.clientNote ?? '', remind: a.remind, share: a.share };
};
/** Tomorrow at 9, an hour long, an hour's warning. */
const blank = (p: Partial<Draft> = {}): Draft => ({ who: '', kind: 'measure', date: localDate(new Date(Date.now() + 864e5)), time: '09:00', minutes: 60, location: '', phone: '', notes: '', clientNote: '', remind: [60], share: false, ...p });

/* ---------- On the client sheet ---------- */

export function ClientAppointments() {
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  const { appts, error } = useSched();
  const [form, setForm] = useState<Draft | null>(null);
  useEffect(() => { if (!appts) loadSchedule(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const c = clientOf(project);
  const jobId = project.portal?.jobId;
  const mine = (appts ?? []).filter((a) => (jobId && a.jobId === jobId) || (project.dropbox && a.folder?.id === project.dropbox.id));
  const now = new Date().toISOString();
  const add = () => {
    // The job needs its portal id now, so the visit can follow it onto the client's page later
    const id = jobId ?? newJobId(project);
    if (!jobId) commit((p) => ({ ...p, portal: { ...p.portal, jobId: id } }));
    setForm(blank({ jobId: id, folder: project.dropbox ? { id: project.dropbox.id, stage: project.dropbox.stage } : undefined, who: clientName(c), location: c.address, phone: c.phone }));
  };
  return (
    <section className="sheet-sec">
      <div className="sec-head"><h3>Appointments</h3><button className="link-btn" onClick={() => loadSchedule()}>Refresh</button></div>
      {error && <p className="warn">{error}</p>}
      {mine.length ? (
        <ul className="appt-list">
          {mine.map((a) => (
            <li key={a.id} className={a.start < now ? 'past' : ''}>
              <button className="appt" onClick={() => setForm(fromAppt(a))}>
                <b>{kindLabel(a.kind)}</b> · {dayLabel(a.start)}, {time(a.start)}{a.share ? <span className="pill">on their page</span> : null}
                {a.notes && <span className="note">{a.notes}</span>}
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="hint">{appts ? 'None yet.' : 'Appointments live on your client portal; they show here once it’s connected.'}</p>}
      <div className="order-actions"><button onClick={add}>Add appointment</button></div>
      {form && <ApptForm draft={form} onlineJob={!!project.portal?.url} onClose={() => setForm(null)} />}
    </section>
  );
}

/* ---------- Coming up, across every job ---------- */

export function ComingUp({ openClient }: { openClient: (folderId: string, stage: string) => void }) {
  const { appts, error } = useSched();
  const [form, setForm] = useState<Draft | null>(null);
  const [phone, setPhone] = useState(false);
  useEffect(() => { if (!appts) loadSchedule(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const from = new Date(Date.now() - 2 * 3600e3).toISOString();
  const until = new Date(Date.now() + 14 * 864e5).toISOString();
  const soon = (appts ?? []).filter((a) => a.start >= from && a.start <= until);
  const days = [...new Set(soon.map((a) => dayKey(a.start)))];
  return (
    <div className="coming-up">
      <div className="sec-head"><h4>Coming up</h4><span><button className="link-btn" onClick={() => setPhone(true)}>On my iPhone</button> · <button className="link-btn" onClick={() => setForm(blank({ kind: 'other' }))}>New</button></span></div>
      {error && !appts && <p className="hint">{error}</p>}
      {appts && !soon.length && <p className="hint">Nothing in the next two weeks.</p>}
      {days.map((d) => (
        <div key={d}>
          <p className="day">{dayLabel(soon.find((a) => dayKey(a.start) === d)!.start)}</p>
          <ul className="appt-list">
            {soon.filter((a) => dayKey(a.start) === d).map((a) => (
              <li key={a.id}>
                <button className="appt" onClick={() => setForm(fromAppt(a))}><b>{time(a.start)}</b> {a.who}{a.kind !== 'other' ? ` · ${kindLabel(a.kind)}` : ''}</button>
                {a.folder && <button className="link-btn" onClick={() => openClient(a.folder!.id, a.folder!.stage)}>open</button>}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {form && <ApptForm draft={form} onlineJob={false} onClose={() => setForm(null)} />}
      {phone && <PhoneSetup onClose={() => setPhone(false)} />}
    </div>
  );
}

/** Subscribing the iPhone's Calendar app to the portal's feed, once. */
function PhoneSetup({ onClose }: { onClose: () => void }) {
  const [feed, setFeed] = useState<{ url: string; webcal: string } | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => { calendarFeed().then(setFeed, (e) => setError(errText(e))); }, []);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="ph-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="ph-title">Appointments on your iPhone</h2>
        {error && <p className="warn">{error}</p>}
        {feed && (
          <>
            <p>Do this once. Your appointments then show in the iPhone’s Calendar app as a calendar called <b>CJC Jobs</b>, with their reminders.</p>
            <ol className="steps">
              <li>Copy this address and send it to your phone (text or email it to yourself):
                <div className="portal-link"><input readOnly aria-label="Calendar address" value={feed.webcal} onFocus={(e) => e.target.select()} /><button onClick={() => navigator.clipboard.writeText(feed.webcal).then(() => setCopied(true), () => undefined)}>{copied ? 'Copied' : 'Copy'}</button></div>
              </li>
              <li>On the iPhone, tap the address in that text or email and choose <b>Subscribe</b>. (If tapping doesn’t offer it: <b>Settings → Apps → Calendar → Calendar Accounts → Add Account → Other → Add Subscribed Calendar</b>, paste, tap Next.)</li>
              <li>Turn <b>Remove Alerts</b> off so the reminders come through, then tap Add or Save.</li>
              <li>Optional: <b>Settings → Apps → Calendar → Calendar Accounts → Fetch New Data</b>, set to every 15 minutes so new appointments arrive quickly.</li>
            </ol>
            <p className="hint">The address is private: anyone with it can see your appointments. Personal appointments go straight into the Calendar app as usual and sit alongside these.</p>
          </>
        )}
        {!feed && !error && <p className="hint">Getting your calendar address…</p>}
        <div className="modal-actions"><button onClick={onClose}>Done</button></div>
      </div>
    </div>
  );
}
