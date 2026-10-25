// Cabinet Studio's reach into Cody's Dropbox, through claude.ai's Dropbox connector. Every call
// runs as Cody, from a button he pressed; nothing here runs on a timer.
import { capability, type Mcp } from './runtime';
import { JOBS_ROOT, stageById, stages, type StageId } from './model/client';

export const DROPBOX = 'Dropbox';

export interface DbxEntry { name: string; path: string; id: string; type: 'file' | 'folder' | 'mount' }
export class DropboxError extends Error { constructor(message: string, public code?: string) { super(message); } }

type Raw = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function call(tool: string, input: Raw): Promise<Raw> {
  const mcp = await capability<Mcp>('mcp');
  if (!mcp) throw new DropboxError('Dropbox works when Cabinet Studio is open on claude.ai with the Dropbox connector added.', 'unavailable');
  try {
    const res = await mcp.callTool(DROPBOX, tool, input, { cache: false });
    const payload = res.payload ?? res.content.find((c) => c.text)?.text;
    return (typeof payload === 'string' ? JSON.parse(payload) : payload) as Raw;
  } catch (e) {
    const err = e as { code?: string; message?: string; result?: { content?: { text?: string }[] } };
    if (err instanceof DropboxError) throw err;
    const text = err.result?.content?.find((c) => c.text)?.text || err.message || '';
    throw new DropboxError(friendly(err.code, text), err.code === 'tool_error' ? (/\[([A-Z_]+)\]/.exec(text)?.[1] ?? 'tool_error') : err.code);
  }
}

function friendly(code: string | undefined, text: string): string {
  switch (code) {
    case 'server_not_connected': case 'server_not_found': return 'The Dropbox connector isn’t added. Add it in claude.ai Settings → Connectors.';
    case 'needs_reauth': return 'Reconnect Dropbox in claude.ai Settings → Connectors.';
    case 'not_in_manifest': case 'approval_required': case 'not_granted': return 'Dropbox isn’t allowed for this page yet. Try again and choose Allow when claude.ai asks.';
    case 'server_unavailable': return 'Dropbox didn’t answer. Try again in a minute.';
    case 'tool_error': return `Dropbox said: ${text.slice(0, 200)}`;
    default: return text ? `Dropbox: ${text.slice(0, 200)}` : 'Something went wrong reaching Dropbox.';
  }
}

const entry = (e: Raw): DbxEntry => ({ name: e.name, path: e.path_display || e.path, id: e.file_id || e.id, type: e.object_type });

/** A folder's immediate contents. */
export async function listFolder(path: string): Promise<DbxEntry[]> {
  let res = await call('list_folder', { path, recursive: false, max_results: 600 });
  const out: DbxEntry[] = (res.entries ?? []).map(entry);
  while (res.has_more && res.cursor) {
    res = await call('list_folder', { cursor: res.cursor });
    out.push(...(res.entries ?? []).map(entry));
  }
  return out;
}

/** Every client folder, by stage. */
export async function listClients(): Promise<Record<StageId, DbxEntry[]>> {
  const out = {} as Record<StageId, DbxEntry[]>;
  await Promise.all(stages.map(async (s) => {
    try { out[s.id] = (await listFolder(`${JOBS_ROOT}/${s.folder}`)).filter((e) => e.type !== 'file').sort((a, b) => a.name.localeCompare(b.name)); }
    catch (e) { if ((e as DropboxError).code === 'NOT_FOUND') out[s.id] = []; else throw e; }
  }));
  return out;
}

/** Where a folder is now, wherever it has been moved to. */
export async function whereIs(id: string): Promise<{ path: string; name: string } | null> {
  try {
    const m = await call('get_file_metadata', { path_or_file_id: id });
    const f = m.folder ?? m.file;
    return f ? { path: f.path_display, name: f.name } : null;
  } catch (e) {
    if ((e as DropboxError).code === 'NOT_FOUND' || /not.?found/i.test((e as Error).message)) return null;
    throw e;
  }
}

export async function createClientFolder(stage: StageId, name: string): Promise<DbxEntry> {
  const res = await call('create_folder', { path: `${JOBS_ROOT}/${stageById(stage).folder}/${name}` });
  return entry(res.folder);
}

/** Move (or rename) a folder; Dropbox may finish a big move in the background. */
export async function moveFolder(id: string, to: string): Promise<DbxEntry> {
  let res = await call('move', { entries: [{ source_path: id, destination_path: to }] });
  for (let i = 0; res.status === 'in_progress' && i < 10; i++) res = await call('check_job_status', { operation_id: res.operation_id, wait_ms: 5000 });
  const r = res.move_result?.entries?.[0];
  if (!r) throw new DropboxError('Dropbox is still moving the folder. Check again in a minute.');
  if (r.entry_status !== 'success') throw new DropboxError(`Couldn’t move the folder (${r.failure?.error_code ?? 'unknown'}).`, r.failure?.error_code);
  return entry(r.object);
}

/** Write a text file into a folder, replacing an earlier copy (which goes to Dropbox's Deleted files). */
export async function writeFile(folderPath: string, name: string, content: string): Promise<void> {
  const path = `${folderPath}/${name}`;
  await call('delete', { entries: [{ source_path: path }] }).catch(() => undefined);
  await call('create_file', { path, content });
}

/** A text file's contents, or null when it isn't there. */
export async function readFile(path: string): Promise<string | null> {
  try { return String((await call('fetch', { id: path })).text ?? ''); }
  catch (e) { if (/not.?found/i.test((e as Error).message) || (e as DropboxError).code === 'NOT_FOUND') return null; throw e; }
}

/** A five-minute download address for a file, for handing to something that fetches it itself (the client portal). */
export async function downloadLink(path: string): Promise<{ url: string; name: string }> {
  const e = (await call('download_link', { entries: [path], expiration_in_sec: 300 })).entries?.[0];
  if (!e?.download_url) throw new DropboxError(`Dropbox couldn’t find ${path}.`, 'NOT_FOUND');
  return { url: e.download_url, name: e.name };
}
