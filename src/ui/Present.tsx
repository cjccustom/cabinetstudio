// Showing the design to the customer in person: the 3D view and the wall elevations, full screen,
// with only the view buttons. No cabinet names, issues, prices, orders or settings, and nothing
// to click by mistake: a drag only turns or slides the view.
import { useEffect, useMemo, useState } from 'react';
import { furnitureOf } from '../model/furniture';
import { PieceScene } from '../three/PieceScene';
import { useStore, type ViewMode } from '../store';
import { Scene } from '../three/Scene';
import { useNav, zoomStep } from '../three/navigation';
import { wallNames, wallOrder } from '../model/layout';
import { tvsOf } from '../model/tv';
import { clientName } from '../model/client';

const none = new Set<string>();

export function Present() {
  const project = useStore((s) => s.project);
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const setPresent = useStore((s) => s.setPresent);
  const nav = useNav();
  // A piece of furniture shown on its own, or the room
  const [solo, setSolo] = useState<string | null>(null);
  const [soloKey, setSoloKey] = useState(0);
  const pieces = furnitureOf(project);
  const piece = pieces.find((t) => t.id === solo) ?? null;
  // Only the walls with work on them
  const walls = useMemo(() => wallOrder.filter((w) => project.cabinets.some((c) => c.wall === w) || (project.panels ?? []).some((x) => x.wall === w) || tvsOf(project).some((t) => t.wall === w)), [project]);
  const views: { v: ViewMode; label: string }[] = [{ v: '3d', label: '3D' }, ...walls.map((w) => ({ v: `elev-${w}` as ViewMode, label: wallNames[w] }))];
  useEffect(() => {
    if (view === 'plan') setView('3d');
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPresent(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, setView, setPresent]);
  const name = project.client ? clientName({ first: '', last: '', ...project.client } as Parameters<typeof clientName>[0]) : '';

  return (
    <div className="present">
      <header className="present-bar">
        <div className="present-title"><strong>CJC Custom Carpentry</strong><span>{name || project.name}</span></div>
        <div className="seg" role="tablist" aria-label="View">
          {views.map((v) => <button key={v.v} role="tab" aria-selected={!piece && view === v.v} className={!piece && view === v.v ? 'on' : ''} onClick={() => { setSolo(null); setView(v.v); }}>{v.label}</button>)}
          {pieces.map((t) => <button key={t.id} role="tab" aria-selected={piece?.id === t.id} className={piece?.id === t.id ? 'on' : ''} onClick={() => setSolo(t.id)} title="On its own, to look over up close">{t.name}</button>)}
        </div>
        <div className="present-tools">
          {!piece && <button className="icon-btn" aria-label="Zoom out" onClick={() => zoomStep(false)}>−</button>}
          {!piece && <button className="icon-btn" aria-label="Zoom in" onClick={() => zoomStep(true)}>+</button>}
          <button onClick={() => (piece ? setSoloKey((k) => k + 1) : nav.reset())}>Reset view</button>
          {!piece && view === '3d' && <button className={nav.allOpen ? 'on' : ''} aria-pressed={nav.allOpen} onClick={() => nav.setAllOpen(!nav.allOpen)} title="Or tap a cabinet to open just that one">{nav.allOpen ? 'Close doors' : 'Open doors'}</button>}
          <button className="primary" onClick={() => setPresent(false)} title="Back to the design (Esc)">Exit</button>
        </div>
      </header>
      <main className="stage present-stage">
        {piece ? (
          <>
            <div className="view-caption">Drag to turn it · scroll or pinch to zoom in on the details</div>
            <PieceScene key={`${piece.id}-${soloKey}`} t={piece} />
          </>
        ) : (
          <>
            {view === '3d' && <div className="view-caption">Drag to turn the room · tap a cabinet to open it</div>}
            <Scene issueIds={none} />
          </>
        )}
      </main>
    </div>
  );
}
