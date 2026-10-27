// Photos straight into the client's Dropbox folder: take them on the phone (or pick some), and
// each one is shrunk to a sensible size and sent through the CJC Portal, which uploads it into
// <client folder>/Photos. Nothing goes to the camera roll.
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { PortalError, blobToBase64, dropboxStatus, savePhoto, type DbxStatus } from '../portal';

const errText = (e: unknown) => (e instanceof PortalError ? e.message : `Something went wrong: ${(e as Error).message}`);

/** The long edge photos are brought down to: plenty for measuring from, a fraction of the phone's size. */
const MAX_EDGE = 2560;

interface Shot { key: string; name: string; thumb: string; status: 'sending' | 'saved' | 'failed'; path?: string; error?: string; file: File }

/** "2026-10-27 0915", local time. */
function stamp(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}${p(d.getMinutes())}`;
}

/** A JPEG no bigger than MAX_EDGE on its long side, the right way up. Falls back to the original if the browser can't read it. */
async function prepare(file: File): Promise<{ data: string; ext: string }> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    const k = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * k); canvas.height = Math.round(bmp.height * k);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85));
    if (blob) return { data: await blobToBase64(blob), ext: 'jpg' };
  } catch { /* send it as it came */ }
  const ext = (/\.([a-z0-9]+)$/i.exec(file.name)?.[1] ?? (file.type.split('/')[1] || 'jpg')).toLowerCase();
  return { data: await blobToBase64(file), ext: ext === 'jpeg' ? 'jpg' : ext };
}

export function ClientPhotos() {
  const project = useStore((s) => s.project);
  const folder = project.dropbox?.path;
  const [dbx, setDbx] = useState<DbxStatus | null>(null);
  const [error, setError] = useState('');
  const [label, setLabel] = useState('');
  const [shots, setShots] = useState<Shot[]>([]);
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const queue = useRef(Promise.resolve());

  const check = async () => { setError(''); try { setDbx(await dropboxStatus()); } catch (e) { setError(errText(e)); } };
  useEffect(() => { if (folder) check(); }, [folder]); // eslint-disable-line react-hooks/exhaustive-deps
  // A new client starts a new list
  useEffect(() => setShots([]), [folder]);

  const update = (key: string, patch: Partial<Shot>) => setShots((all) => all.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  /** One at a time, in the order taken, so a weak signal isn't asked to carry several at once. */
  const send = (shot: Shot) => {
    queue.current = queue.current.then(async () => {
      update(shot.key, { status: 'sending', error: undefined });
      try {
        const { data, ext } = await prepare(shot.file);
        const r = await savePhoto(`${folder}/Photos`, `${shot.name}.${ext}`, data);
        update(shot.key, { status: 'saved', path: r.path });
      } catch (e) { update(shot.key, { status: 'failed', error: errText(e) }); }
    });
  };
  const add = (files: FileList | null) => {
    if (!files?.length || !folder) return;
    const base = `${stamp()}${label.trim() ? ` ${label.trim()}` : ''}`;
    const fresh = [...files].map((file, i): Shot => ({
      key: `${Date.now()}-${i}-${file.name}`, file, status: 'sending', thumb: URL.createObjectURL(file),
      name: files.length > 1 ? `${base} ${i + 1}` : base,
    }));
    setShots((all) => [...fresh, ...all]);
    fresh.forEach(send);
  };
  useEffect(() => () => shots.forEach((s) => URL.revokeObjectURL(s.thumb)), []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!folder) return null;
  const ready = dbx?.connected;
  const saved = shots.filter((s) => s.status === 'saved').length;
  return (
    <section className="sheet-sec">
      <div className="sec-head"><h3>Photos</h3>{dbx && !ready && <button className="link-btn" onClick={check}>Check again</button>}</div>
      {error && <p className="warn">{error}</p>}
      {dbx && !dbx.configured && <p className="hint">Not set up yet: the portal needs a Dropbox app’s keys. See <b>Photos from the phone</b> in the portal instructions.</p>}
      {dbx?.configured && !dbx.connected && <p className="hint">Almost ready. <a href={dbx.connectPage} target="_blank" rel="noopener noreferrer">Open the portal’s Dropbox page</a>, paste your SHOP_KEY and allow it, then check again.</p>}
      {ready && (
        <>
          <div className="photo-bar">
            <input id="ph-label" placeholder="What is it? (Kitchen, sink wall…)" value={label} onChange={(e) => setLabel(e.target.value)} />
            <button className="primary" onClick={() => camera.current?.click()}>Take photo</button>
            <button onClick={() => library.current?.click()}>Choose photos</button>
            <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
            <input ref={library} type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
          </div>
          <p className="hint">Saved to {folder}/Photos, named by the date and time{label.trim() ? ` and “${label.trim()}”` : ''}. Photos you take here don’t go to your camera roll.</p>
          {shots.length > 0 && (
            <>
              <p className="hint">{saved} of {shots.length} saved{shots.some((s) => s.status === 'sending') ? '; keep this page open until they’re all in' : ''}.</p>
              <ul className="photo-grid">
                {shots.map((s) => (
                  <li key={s.key} className={s.status}>
                    <img src={s.thumb} alt={s.name} />
                    <span className="photo-cap">{s.status === 'saved' ? 'Saved' : s.status === 'sending' ? 'Sending…' : 'Didn’t save'}</span>
                    {s.status === 'failed' && <><span className="warn-text">{s.error}</span><button className="mini" onClick={() => send(s)}>Try again</button></>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
