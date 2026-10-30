// The full editor: double-click a cabinet, pilaster, mantel, shelf, panel or the coffered ceiling
// and everything about it opens here, a tab at a time, over the design so the change shows as you
// make it. The sidebar keeps the everyday settings.
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { Inspector, inspectorTabs, type InspectorTab } from './Inspector';
import { PanelInspector } from './PanelInspector';
import { CofferSection } from './CofferSection';
import { LightingSection } from './RoomDetails';
import { LadderSection } from './LadderSection';
import { DetailButtons } from './DetailsSection';

export function Editor({ issuesFor }: { issuesFor: (id: string) => string[] }) {
  const editing = useStore((s) => s.editing);
  const edit = useStore((s) => s.edit);
  const cabinets = useStore((s) => s.project.cabinets);
  const panels = useStore((s) => s.project.panels);
  const [tab, setTab] = useState<string>('size');
  // Dragged by its title bar out of the way of what's being changed; stays put for the session
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const grab = useRef<{ dx: number; dy: number } | null>(null);
  const id = editing && (editing.kind === 'cabinet' || editing.kind === 'panel') ? editing.id : null;
  useEffect(() => { if (editing?.tab) setTab(editing.tab); }, [editing]);
  useEffect(() => {
    if (!editing) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); edit(null); } };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [editing, edit]);
  if (!editing) return null;

  const cab = editing.kind === 'cabinet' ? cabinets.find((c) => c.id === id) : undefined;
  const panel = editing.kind === 'panel' ? (panels ?? []).find((w) => w.id === id) : undefined;
  if ((editing.kind === 'cabinet' || editing.kind === 'panel') && !cab && !panel) return null;
  const tabs = cab ? inspectorTabs(cab) : [];
  const on = cab && !tabs.some((t) => t.id === tab) ? 'size' : tab;
  // Step through the job's cabinets without closing
  const i = cab ? cabinets.indexOf(cab) : -1;
  const step = (d: number) => { const n = cabinets[(i + d + cabinets.length) % cabinets.length]; if (n) edit({ kind: 'cabinet', id: n.id }); };

  return (
    <div className="editor-win" role="dialog" aria-label="Edit" style={pos ? { left: pos.x, top: pos.y, transform: 'none' } : undefined}>
      <div className="editor-bar" title="Drag to move"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          const r = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
          grab.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!grab.current) return;
          setPos({ x: Math.max(0, Math.min(window.innerWidth - 120, e.clientX - grab.current.dx)), y: Math.max(0, Math.min(window.innerHeight - 48, e.clientY - grab.current.dy)) });
        }}
        onPointerUp={() => { grab.current = null; }}>
        <strong>{cab ? cab.name : panel ? panel.name : editing.kind === 'ladder' ? 'Rolling ladder' : 'Ceiling & lighting'}</strong>
        {cab && cabinets.length > 1 && (
          <span className="editor-step">
            <button className="mini" title="Previous cabinet" onClick={() => step(-1)}>‹</button>
            <span className="muted">{i + 1} of {cabinets.length}</span>
            <button className="mini" title="Next cabinet" onClick={() => step(1)}>›</button>
          </span>
        )}
        <button className="mini primary" onClick={() => edit(null)}>Done</button>
      </div>
      {cab && (
        <nav className="tabs editor-tabs" role="tablist">
          {tabs.map((t) => <button key={t.id} role="tab" aria-selected={on === t.id} className={on === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.label}</button>)}
        </nav>
      )}
      <div className="editor-body">
        {cab && <Inspector key={cab.id} cab={cab} issues={issuesFor(cab.id)} tab={on as InspectorTab} />}
        {cab && on === 'proposal' && <DetailButtons cab={cab} />}
        {panel && <PanelInspector key={panel.id} panel={panel} />}
        {editing.kind === 'ceiling' && <><CofferSection /><DetailButtons ceiling /><LightingSection /></>}
        {editing.kind === 'ladder' && <LadderSection />}
      </div>
    </div>
  );
}
