import { create } from 'zustand';

/**
 * The app's own yes/no box. Pages on claude.ai run in a frame where the browser's confirm()
 * can be blocked, and a blocked confirm() answers "no" without showing anything.
 */
const useConfirm = create<{ q: { message: string; ok: string; done: (yes: boolean) => void } | null }>(() => ({ q: null }));

export function askConfirm(message: string, ok = 'OK'): Promise<boolean> {
  return new Promise((done) => useConfirm.setState({ q: { message, ok, done: (yes) => { useConfirm.setState({ q: null }); done(yes); } } }));
}

export function ConfirmHost() {
  const q = useConfirm((s) => s.q);
  if (!q) return null;
  return (
    <div className="modal-back" onClick={() => q.done(false)}>
      <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="cf-msg" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') q.done(false); }}>
        <p id="cf-msg">{q.message}</p>
        <div className="modal-actions">
          <button onClick={() => q.done(false)}>Cancel</button>
          <button className="primary" autoFocus onClick={() => q.done(true)}>{q.ok}</button>
        </div>
      </div>
    </div>
  );
}
