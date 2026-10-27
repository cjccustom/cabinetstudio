import { useEffect, useState } from 'react';
import { askConfirm } from './Confirm';
import { create } from 'zustand';
import { useStore, normalize } from '../store';
import type { Project } from '../model/types';
import { uid, sampleProject } from '../model/defaults';
import { clientInfoDoc, clientName, clientOf, emptyClient, folderName, JOBS_ROOT, ordersDoc, parseFolderName, quoteDoc, stageById, stageByFolder, stages, type ClientInfo, type Measurement, type StageId } from '../model/client';
import { releaseOf } from '../model/release';
import { createClientFolder, listClients, listFolder, moveFolder, readFile, whereIs, writeFile, DropboxError, type DbxEntry } from '../dropbox';
import { Field, Section } from './fields';
import { ClientPortal } from './Portal';
import { ContractSection } from './Contract';
import { ClientAppointments, ComingUp } from './Schedule';

const DESIGN_FILE = 'Cabinet Studio design.json';
const INFO_FILE = 'Client info.md';
const QUOTE_FILE = 'Quote and purchase agreement.html';
const ORDERS_FILE = 'Orders.md';

/** What Dropbox has, shared by the list and the sheet. */
const useDbx = create<{
  folders: Record<StageId, DbxEntry[]> | null;
  busy: string;
  error: string;
  note: string;
  /** The project as last saved to (or opened from) Dropbox, to tell when there are unsaved changes. */
  savedSig: string;
  set: (p: Partial<{ folders: Record<StageId, DbxEntry[]> | null; busy: string; error: string; note: string; savedSig: string }>) => void;
}>((set) => ({ folders: null, busy: '', error: '', note: '', savedSig: '', set: (p) => set(p) }));

const sig = (p: Project) => JSON.stringify({ ...p, dropbox: undefined });

async function run<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
  const s = useDbx.getState();
  s.set({ busy: label, error: '', note: '' });
  try {
    const out = await fn();
    useDbx.getState().set({ busy: '' });
    return out;
  } catch (e) {
    useDbx.getState().set({ busy: '', error: e instanceof DropboxError ? e.message : `Something went wrong: ${(e as Error).message}` });
    return undefined;
  }
}

const refresh = () => run('Reading your Jobs folders…', async () => useDbx.getState().set({ folders: await listClients() }));

/** Make sure the link still points where the folder is (it may have been moved by hand), and name it Last, First - Location. */
async function placeFolder(p: Project): Promise<Project> {
  const link = p.dropbox!;
  const here = await whereIs(link.id);
  if (!here) throw new DropboxError('This job’s Dropbox folder wasn’t found. It may have been deleted; link it again from the Clients list.');
  const parent = here.path.slice(0, here.path.lastIndexOf('/'));
  const stage = stageByFolder(parent.slice(parent.lastIndexOf('/') + 1))?.id ?? link.stage;
  const want = folderName(clientOf(p));
  let path = here.path;
  if (want && want !== here.name) path = (await moveFolder(link.id, `${parent}/${want}`)).path;
  return { ...p, dropbox: { ...link, path, stage } };
}

/** Save the client sheet and the design into the client's folder. */
/** Returns false when the save didn't happen (the error is shown), so nothing that follows should replace the design. */
export async function saveToDropbox(extra: { quote?: boolean; orders?: boolean } = {}): Promise<boolean> {
  const st = useStore.getState();
  if (!st.project.dropbox) return true;
  return (await run('Saving to Dropbox…', async () => {
    const placed = await placeFolder(st.project);
    const now = Date.now();
    const saved = { ...placed.dropbox!.saved, info: now, design: now, ...(extra.quote ? { quote: now } : {}), ...(extra.orders ? { orders: now } : {}) };
    const next = { ...placed, dropbox: { ...placed.dropbox!, saved } };
    await writeFile(next.dropbox!.path, INFO_FILE, clientInfoDoc(next));
    await writeFile(next.dropbox!.path, DESIGN_FILE, JSON.stringify(next));
    // A sold job's agreement is its contract; never overwrite it with the calculated quote
    if (extra.quote && !next.contract) await writeFile(next.dropbox!.path, QUOTE_FILE, quoteDoc(next));
    if (extra.orders) await writeFile(next.dropbox!.path, ORDERS_FILE, ordersDoc(next));
    useStore.getState().transient(() => next);
    useDbx.getState().set({ note: `Saved to ${next.dropbox!.path}`, savedSig: sig(next) });
    return true;
  })) === true;
}

/** Before another client replaces this design: save it, and if that fails, stop and say so. */
async function saveBeforeLeaving(): Promise<boolean> {
  const cur = useStore.getState().project;
  if (await saveToDropbox()) return true;
  const err = useDbx.getState().error;
  useDbx.getState().set({ error: `${cur.name} wasn’t saved, so it’s still open and nothing was replaced. ${err}` });
  return false;
}

/** Open a client folder: its saved design if there is one, else a new job for that client. */
async function openFolder(f: DbxEntry, stage: StageId) {
  const st = useStore.getState();
  const cur = st.project;
  const same = cur.dropbox?.id === f.id;
  if (same) {
    // Clicking the open client reloads its saved design (after asking, if there are unsaved changes)
    if (sig(cur) !== useDbx.getState().savedSig && !(await askConfirm(`Reload ${f.name} from Dropbox? Changes since it was last saved will be lost.`, 'Reload'))) return;
  } else if (cur.dropbox && !(await saveBeforeLeaving())) return;
  else if (cur.cabinets.length && !(await askConfirm('The design open now isn’t linked to a client. Open this client anyway? (Use Project file first if you want to keep it.)', 'Open client'))) return;
  await run(`Opening ${f.name}…`, async () => {
    const text = await readFile(`${f.path}/${DESIGN_FILE}`);
    let p: Project;
    if (text) {
      try { p = normalize(JSON.parse(text) as Project); }
      catch { throw new DropboxError(`The saved design in ${f.name} couldn’t be read, so it wasn’t opened (nothing was changed).`); }
    } else {
      const c = { ...emptyClient, ...parseFolderName(f.name) };
      p = { ...normalize({ ...sampleProject(), cabinets: [] }), name: f.name, client: c };
    }
    p = { ...p, dropbox: { ...p.dropbox, id: f.id, path: f.path, stage } };
    useStore.getState().loadProject(p);
    useDbx.getState().set({ savedSig: text ? sig(p) : '', note: text ? `Opened ${f.name}: ${p.cabinets.length} cabinets. Design is ready.` : `Opened ${f.name}; no saved design there yet, so this is a new one.` });
  });
}

/** Start a new client: a fresh job and their folder in To quote. */
async function newClient(c: ClientInfo) {
  const st = useStore.getState();
  if (st.project.dropbox && !(await saveBeforeLeaving())) return;
  else if (st.project.cabinets.length && !(await askConfirm('The design open now isn’t linked to a client. Start a new client anyway?', 'Start new client'))) return;
  await run('Creating the client folder…', async () => {
    const folder = await createClientFolder('quote', folderName(c));
    const p: Project = { ...normalize({ ...sampleProject(), cabinets: [] }), name: folderName(c), client: { ...c, metOn: c.metOn || new Date().toLocaleDateString('en-US') }, dropbox: { id: folder.id, path: folder.path, stage: 'quote' } };
    useStore.getState().loadProject(p);
    await writeFile(folder.path, INFO_FILE, clientInfoDoc(p));
    await writeFile(folder.path, DESIGN_FILE, JSON.stringify(p));
    useDbx.getState().set({ note: `Created ${folder.path}`, savedSig: sig(p) });
    await listClients().then((folders) => useDbx.getState().set({ folders })).catch(() => undefined);
  });
}

/* ---------- Left: every client, by stage ---------- */

export function ClientsSide() {
  const { folders, busy, error, note } = useDbx();
  const project = useStore((s) => s.project);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<ClientInfo>(emptyClient);
  const [open, setOpen] = useState<Record<string, boolean>>({ quote: true, sold: true, progress: true });
  useEffect(() => { if (!folders) refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const match = (n: string) => !q.trim() || n.toLowerCase().includes(q.trim().toLowerCase());
  return (
    <aside className="sidebar">
      <div className="side-body">
        <Section title="Clients" aside={<button className="mini" onClick={refresh} disabled={!!busy}>Refresh</button>}>
          <div className="order-actions"><button className="primary" onClick={() => { setDraft(emptyClient); setAdding(true); }}>New client</button></div>
          {adding && (
            <form className="new-client" onSubmit={(e) => { e.preventDefault(); if (!draft.last.trim()) return; setAdding(false); newClient(draft); }}>
              <div className="grid2">
                <Field label="Last name" htmlFor="nc-last"><input id="nc-last" autoFocus value={draft.last} onChange={(e) => setDraft({ ...draft, last: e.target.value })} /></Field>
                <Field label="First name" htmlFor="nc-first"><input id="nc-first" value={draft.first} onChange={(e) => setDraft({ ...draft, first: e.target.value })} /></Field>
              </div>
              <Field label="Town" htmlFor="nc-loc"><input id="nc-loc" value={draft.location} placeholder="West Boylston" onChange={(e) => setDraft({ ...draft, location: e.target.value })} /></Field>
              <p className="hint">Folder: {JOBS_ROOT}/To quote/<b>{folderName(draft) || '…'}</b></p>
              <div className="order-actions"><button type="button" onClick={() => setAdding(false)}>Cancel</button><button className="primary" disabled={!draft.last.trim()}>Create folder</button></div>
            </form>
          )}
          <input type="search" aria-label="Find a client" placeholder="Find a client" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginTop: 8 }} />
        </Section>
        <ComingUp openClient={(id, stage) => {
          const f = folders && Object.values(folders).flat().find((x) => x.id === id);
          if (f) openFolder(f, (stages.find((x) => (folders[x.id] ?? []).some((y) => y.id === id))?.id ?? stage) as StageId);
        }} />
        {busy && <p className="hint" role="status">{busy}</p>}
        {error && <p className="warn" role="status">{error}</p>}
        {note && !error && !busy && <p className="ok" role="status">{note}</p>}
        {!folders && !busy && <p className="hint">Open Cabinet Studio on claude.ai with Dropbox connected, then press Refresh.</p>}
        {folders && stages.map((s) => {
          const list = (folders[s.id] ?? []).filter((f) => match(f.name));
          if (!list.length && q) return null;
          return (
            <details key={s.id} className="stage-group" open={!!open[s.id] || !!q} onToggle={(e) => setOpen({ ...open, [s.id]: (e.target as HTMLDetailsElement).open })}>
              <summary>{s.folder} <span className="muted">{(folders[s.id] ?? []).length}</span></summary>
              <ul className="client-list">
                {list.map((f) => (
                  <li key={f.id}><button className={project.dropbox?.id === f.id ? 'on' : ''} onClick={() => openFolder(f, s.id)} disabled={!!busy}>{f.name}</button></li>
                ))}
                {!list.length && <li className="muted">None</li>}
              </ul>
            </details>
          );
        })}
      </div>
    </aside>
  );
}

/* ---------- Middle: the client sheet, made for filling in on an iPad at the first meeting ---------- */

export function ClientMain() {
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  const c = clientOf(project);
  const link = project.dropbox;
  const put = (patch: Partial<ClientInfo>) => commit((p) => ({ ...p, client: { ...clientOf(p), ...patch } }));
  const putM = (id: string, patch: Partial<Measurement>) => put({ measurements: c.measurements.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
  const text = (k: keyof ClientInfo, label: string, opts: { type?: string; placeholder?: string; wide?: boolean } = {}) => (
    <Field label={label} htmlFor={`cl-${k}`}>
      <input id={`cl-${k}`} type={opts.type ?? 'text'} value={String(c[k] ?? '')} placeholder={opts.placeholder} onChange={(e) => put({ [k]: e.target.value } as Partial<ClientInfo>)} />
    </Field>
  );
  return (
    <main className="stage client-stage">
      <div className="client-sheet">
        <header className="client-head">
          <div>
            <h2>{clientName(c) || 'New client'}</h2>
            <p className="muted">{link ? link.path : 'Not in Dropbox yet: use New client, or open a folder from the list.'}</p>
          </div>
          <SaveButton />
        </header>

        <section className="sheet-sec">
          <h3>Contact</h3>
          <div className="grid3">
            {text('first', 'First name')}
            {text('last', 'Last name')}
            {text('partner', 'Spouse / partner')}
          </div>
          <div className="grid3">
            {text('address', 'Project address', { placeholder: 'Street address' })}
            {text('location', 'Town (for the folder name)')}
            {text('metOn', 'First meeting', { placeholder: 'Date' })}
          </div>
          <div className="grid3">
            {text('phone', 'Cell', { type: 'tel' })}
            {text('phone2', 'Other phone', { type: 'tel' })}
            {text('email', 'Email', { type: 'email' })}
          </div>
          {text('source', 'How they found us')}
        </section>

        <ClientAppointments />

        <section className="sheet-sec">
          <h3>Project scope</h3>
          <textarea id="cl-scope" rows={7} value={c.scope} placeholder="What they want, in your words: rooms, built-ins, style, finish, budget, timing…" onChange={(e) => put({ scope: e.target.value })} />
        </section>

        <ContractSection />

        <ClientPortal />

        <section className="sheet-sec">
          <h3>Measurements</h3>
          <table className="meas">
            <thead><tr><th>What</th><th>Size</th><th>Notes</th><th></th></tr></thead>
            <tbody>
              {c.measurements.map((m) => (
                <tr key={m.id}>
                  <td><input aria-label="What" value={m.what} placeholder="Wall, window, ceiling…" onChange={(e) => putM(m.id, { what: e.target.value })} /></td>
                  <td><input aria-label="Size" value={m.size} placeholder={'Width × height'} onChange={(e) => putM(m.id, { size: e.target.value })} /></td>
                  <td><input aria-label="Notes" value={m.note} onChange={(e) => putM(m.id, { note: e.target.value })} /></td>
                  <td><button className="icon-btn" aria-label="Remove" onClick={() => put({ measurements: c.measurements.filter((x) => x.id !== m.id) })}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="order-actions"><button onClick={() => put({ measurements: [...c.measurements, { id: uid('m'), what: '', size: '', note: '' }] })}>Add measurement</button></div>
          <p className="hint">Sketches and photos: save them straight into the client’s folder with the Dropbox app (camera or document scanner). Room photos for the design go in the Rendering tab.</p>
        </section>

        <section className="sheet-sec">
          <h3>Notes</h3>
          <textarea id="cl-notes" rows={4} value={c.notes} onChange={(e) => put({ notes: e.target.value })} />
        </section>

        <section className="sheet-sec">
          <h3>To do</h3>
          <ul className="todo-list">
            {c.todos.map((t) => (
              <li key={t.id}>
                <input type="checkbox" aria-label="Done" checked={t.done} onChange={(e) => put({ todos: c.todos.map((x) => (x.id === t.id ? { ...x, done: e.target.checked } : x)) })} />
                <input aria-label="To do" value={t.text} onChange={(e) => put({ todos: c.todos.map((x) => (x.id === t.id ? { ...x, text: e.target.value } : x)) })} />
                <button className="icon-btn" aria-label="Remove" onClick={() => put({ todos: c.todos.filter((x) => x.id !== t.id) })}>×</button>
              </li>
            ))}
          </ul>
          <div className="order-actions"><button onClick={() => put({ todos: [...c.todos, { id: uid('t'), text: '', done: false }] })}>Add to do</button></div>
        </section>
      </div>
    </main>
  );
}

function SaveButton() {
  const { busy, error, note, savedSig } = useDbx();
  const project = useStore((s) => s.project);
  const link = project.dropbox;
  const dirty = !!link && sig(project) !== savedSig;
  return (
    <div className="save-box">
      <button className="primary" disabled={!link || !!busy} onClick={() => saveToDropbox()}>{busy || 'Save to Dropbox'}</button>
      {dirty && !busy && <p className="muted">Unsaved changes</p>}
      {error && <p className="warn" role="status">{error}</p>}
      {note && !error && <p className="ok" role="status">{note}</p>}
    </div>
  );
}

/* ---------- Right: stage and documents ---------- */

export function ClientPanel() {
  const project = useStore((s) => s.project);
  const link = project.dropbox;
  const { busy } = useDbx();
  const [files, setFiles] = useState<DbxEntry[] | null>(null);
  const rel = releaseOf(project);
  const loadFiles = () => { if (link) run('Listing files…', async () => setFiles(await listFolder(link.path))); };
  useEffect(() => { setFiles(null); }, [link?.id]);

  const moveTo = (stage: StageId) => link && run(`Moving to ${stageById(stage).folder}…`, async () => {
    const placed = await placeFolder(useStore.getState().project);
    const name = placed.dropbox!.path.slice(placed.dropbox!.path.lastIndexOf('/') + 1);
    const moved = await moveFolder(placed.dropbox!.id, `${JOBS_ROOT}/${stageById(stage).folder}/${name}`);
    useStore.getState().commit((p) => ({ ...p, dropbox: { ...placed.dropbox!, path: moved.path, stage } }));
    useDbx.getState().set({ note: `Moved to ${moved.path}` });
    await listClients().then((folders) => useDbx.getState().set({ folders })).catch(() => undefined);
  });
  // The next stage the job's own progress points to
  const suggest: StageId | null = !link ? null
    : link.stage === 'quote' && rel.depositDate ? 'sold'
      : null;
  const when = (k: string) => (link?.saved?.[k] ? new Date(link.saved[k]).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'not yet');

  return (
    <aside className="panel">
      <div className="panel-body">
        {!link ? (
          <Section title="Dropbox">
            <p className="hint">Start with New client, or open a client’s folder from the list. Their folder lives in {JOBS_ROOT}, in the folder for its stage.</p>
          </Section>
        ) : (
          <>
            <Section title="Stage">
              <div className="stage-pick" role="radiogroup" aria-label="Stage">
                {stages.map((s) => (
                  <button key={s.id} role="radio" aria-checked={link.stage === s.id} className={link.stage === s.id ? 'on' : ''} disabled={!!busy} onClick={() => link.stage !== s.id && moveTo(s.id)}>{s.folder}</button>
                ))}
              </div>
              {suggest && <p className="hint">Deposit recorded. <button className="mini" onClick={() => moveTo(suggest)}>Move to {stageById(suggest).folder}</button></p>}
              <p className="hint">Picking a stage moves the client’s folder in Dropbox.</p>
            </Section>
            <Section title="Documents in the folder">
              <table className="doc-table">
                <tbody>
                  <tr><td>Client info</td><td className="muted">{when('info')}</td><td></td></tr>
                  <tr><td>Design file</td><td className="muted">{when('design')}</td><td></td></tr>
                  <tr><td>Quote & purchase agreement</td><td className="muted">{project.contract ? 'Sold: the contract is the agreement' : when('quote')}</td><td>{!project.contract && <button className="mini" disabled={!!busy} onClick={() => saveToDropbox({ quote: true })}>Save</button>}</td></tr>
                  <tr><td>Orders (Eagle, hardware)</td><td className="muted">{when('orders')}</td><td><button className="mini" disabled={!!busy || !project.cabinets.length} onClick={() => saveToDropbox({ orders: true })}>Save</button></td></tr>
                </tbody>
              </table>
              <p className="hint">Save to Dropbox writes the client info and the design every time. The quote opens in Word or a browser and prints to PDF on your letterhead layout.</p>
            </Section>
            <Section title="Everything in the folder" aside={<button className="mini" onClick={loadFiles} disabled={!!busy}>List</button>}>
              {files ? (
                <ul className="file-list">{files.map((f) => <li key={f.id}>{f.type === 'file' ? '' : '📁 '}{f.name}</li>)}{!files.length && <li className="muted">Empty</li>}</ul>
              ) : <p className="hint">Press List to see photos, sketches and documents saved there.</p>}
            </Section>
          </>
        )}
      </div>
    </aside>
  );
}
