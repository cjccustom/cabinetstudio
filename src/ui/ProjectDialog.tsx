import { useRef, useState } from 'react';
import { BACKUP_KEY, useStore } from '../store';
import type { Project } from '../model/types';

/** Save and open jobs as plain text files. The Mac app will swap this for native Save/Open. */
export function ProjectDialog({ onClose }: { onClose: () => void }) {
  const project = useStore((s) => s.project);
  const loadProject = useStore((s) => s.loadProject);
  const json = JSON.stringify(project, null, 2);
  const [text, setText] = useState(json);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  // The design last replaced by opening another one, if any
  const backup = (() => { try { const b = JSON.parse(localStorage.getItem(BACKUP_KEY) ?? 'null') as { at: number; project: Project } | null; return b?.project ? b : null; } catch { return null; } })();

  const load = (raw: string) => {
    try {
      loadProject(JSON.parse(raw) as Project);
      onClose();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof SyntaxError ? 'That text isn’t a complete project file. Check that the whole file was pasted.' : (e as Error).message });
    }
  };

  const copy = () => {
    setText(json);
    navigator.clipboard.writeText(json).then(
      () => setMsg({ kind: 'ok', text: 'Copied. Paste it into a text file to keep a copy of this job.' }),
      () => { area.current?.select(); setMsg({ kind: 'ok', text: 'Text selected. Press ⌘C to copy it.' }); },
    );
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="pf-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="pf-title">Project file</h2>
        <p>Your work saves automatically in this browser. To move a job to another computer or keep a backup, copy the project text below, or paste one in to open it.</p>
        <textarea id="pf-text" ref={area} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
        {backup && (
          <p className="hint">
            Last design replaced in this browser: <b>{backup.project.name}</b>, {new Date(backup.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.{' '}
            <button className="mini" onClick={() => setText(JSON.stringify(backup.project, null, 2))}>Show it</button> then Open pasted project to bring it back.
          </p>
        )}
        {msg && <p className={msg.kind === 'err' ? 'warn' : 'ok'}>{msg.text}</p>}
        <div className="modal-actions">
          <label className="btn">
            Open file…
            <input
              id="pf-file"
              type="file"
              accept=".json,.cabinet,application/json,text/plain"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) f.text().then(load);
              }}
            />
          </label>
          <span className="spacer" />
          <button onClick={copy}>Copy project</button>
          <button className="primary" disabled={text === json} onClick={() => load(text)}>Open pasted project</button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
