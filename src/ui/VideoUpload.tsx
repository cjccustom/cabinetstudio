// A walkthrough video into the client's Dropbox folder: record it (or pick one) and it goes up in
// pieces of a couple of MB through the portal, so a long clip on a weak signal still gets there.
// A piece that fails is tried again; the page has to stay open until it's done.
import { useRef, useState } from 'react';
import { FileButton } from './FileButton';
import { PortalError, blobToBase64, saveVideoChunk } from '../portal';

// Each call from the page is limited to 1 MB, base64 included
const PIECE = 450 * 1024;
const mb = (n: number) => `${(n / 1048576).toFixed(n < 10 * 1048576 ? 1 : 0)} MB`;

interface Job { key: string; name: string; size: number; sent: number; status: 'sending' | 'saved' | 'failed'; error?: string; path?: string }

export function VideoUpload({ folder }: { folder?: string }) {
  const [label, setLabel] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const files = useRef(new Map<string, File>());
  const queue = useRef(Promise.resolve());
  const upd = (key: string, patch: Partial<Job>) => setJobs((all) => all.map((j) => (j.key === key ? { ...j, ...patch } : j)));

  const send = (key: string, name: string) => {
    queue.current = queue.current.then(async () => {
      const f = files.current.get(key); if (!f || !folder) return;
      upd(key, { status: 'sending', error: undefined, sent: 0 });
      try {
        let session: string | undefined, offset = 0;
        while (true) {
          const last = offset + PIECE >= f.size;
          const data = await blobToBase64(f.slice(offset, Math.min(f.size, offset + PIECE)));
          let r: Awaited<ReturnType<typeof saveVideoChunk>> | null = null;
          // A dropped piece is tried twice more before giving up
          for (let tries = 0; !r; tries++) {
            try { r = await saveVideoChunk({ session, offset, data, ...(last ? { folder: `${folder}/Videos`, name } : {}) }); }
            catch (e) { if (tries >= 2) throw e; await new Promise((ok) => setTimeout(ok, 1500 * (tries + 1))); }
          }
          session = r.session || session; offset = r.offset;
          upd(key, { sent: Math.min(offset, f.size) });
          if (last) { upd(key, { status: 'saved', path: r.path }); files.current.delete(key); break; }
        }
      } catch (e) { upd(key, { status: 'failed', error: e instanceof PortalError ? e.message : (e as Error).message }); }
    });
  };
  const add = (list: FileList | null) => {
    const f = list?.[0]; if (!f || !folder) return;
    const d = new Date(), z = (n: number) => String(n).padStart(2, '0');
    const ext = (/\.([a-z0-9]+)$/i.exec(f.name)?.[1] ?? (f.type.includes('mp4') ? 'mp4' : 'mov')).toLowerCase();
    const name = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}${z(d.getMinutes())} ${label.trim() || 'walkthrough'}.${ext}`.replace(/[\\/:*?"<>|]/g, '');
    const key = `${Date.now()}-${f.name}`;
    files.current.set(key, f);
    setJobs((all) => [{ key, name, size: f.size, sent: 0, status: 'sending' }, ...all]);
    send(key, name);
  };

  if (!folder) return null;
  const busy = jobs.some((j) => j.status === 'sending');
  return (
    <section className="sheet-sec">
      <div className="sec-head"><h3>Video walkthrough</h3></div>
      <div className="photo-bar">
        <input aria-label="What is it?" placeholder="What is it? (walkthrough, sink wall…)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <FileButton className="primary" accept="video/*" capture="environment" onFiles={add}>Record video</FileButton>
        <FileButton accept="video/*" onFiles={add}>Choose a video</FileButton>
      </div>
      <p className="hint">Saved to the client’s Videos folder. Big files take a while on a weak signal (a minute of iPad video is roughly 60 to 130 MB): keep this screen open until it says saved. For smaller files, set the iPad camera to 1080p at 30 fps (Settings → Camera → Record Video).</p>
      {busy && <p className="hint">Sending… keep this screen open.</p>}
      {jobs.map((j) => (
        <div key={j.key} className={`video-job ${j.status}`}>
          <span>{j.name}</span>
          <progress max={j.size} value={j.sent} />
          <span className="hint">{j.status === 'saved' ? `Saved, ${mb(j.size)}` : j.status === 'failed' ? 'Didn’t finish' : `${mb(j.sent)} of ${mb(j.size)}`}</span>
          {j.status === 'failed' && <><span className="warn-text">{j.error}</span>{files.current.has(j.key) && <button className="mini" onClick={() => send(j.key, j.name)}>Try again</button>}</>}
        </div>
      ))}
    </section>
  );
}
