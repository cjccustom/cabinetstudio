import { CoverButton, DrawingsMain, DrawingsPanel, DrawingsSide } from './ui/Drawings';
import { ClientMain, ClientPanel, ClientsSide } from './ui/Clients';
import { ViewTools, navHint } from './ui/ViewTools';
import { useNav } from './three/navigation';
import { DesignRenderButton } from './ui/DesignRender';
import { RenderInputs, RenderSide, RenderStage } from './ui/Rendering';
import { useEffect, useMemo, useState } from 'react';
import { useStore, type ViewMode } from './store';
import { Scene } from './three/Scene';
import { Sidebar } from './ui/Sidebar';
import { Inspector } from './ui/Inspector';
import { OrderList, PartsTable } from './ui/PartsTable';
import { ReleasePanel } from './ui/Release';
import { EagleRequests } from './ui/EagleRequests';
import { HardwareOrder } from './ui/HardwareOrder';
import { JobClock, JobMain, JobSide } from './ui/Job';
import { openingIssues } from './model/room';
import { ProjectDialog } from './ui/ProjectDialog';
import { DrawerCalculator } from './ui/DrawerCalculator';
import { PanelInspector } from './ui/PanelInspector';
import { BeadboardOrder } from './ui/BeadboardOrder';
import { DoorOrderList, MoldingOrder } from './ui/MoldingOrder';
import { QuoteBreakdown, QuoteInputs, QuoteSummary } from './ui/Quote';
import { CutlistInputs, CutlistLayouts, CutlistSummary } from './ui/Cutlist';
import { FaceFrameBreakdown, FaceFrameInputs, FaceFrameSummary } from './ui/FaceFrames';
import { findIssues, wallNames, wallOrder } from './model/layout';
import { sampleProject } from './model/defaults';

const views: { v: ViewMode; label: string }[] = [
  { v: '3d', label: '3D' },
  { v: 'plan', label: 'Plan' },
  ...wallOrder.map((w) => ({ v: `elev-${w}` as ViewMode, label: wallNames[w].replace(' wall', '') })),
];

export default function App() {
  const project = useStore((s) => s.project);
  const selectedId = useStore((s) => s.selectedId);
  const view = useStore((s) => s.view);
  const nav = useNav();
  const setView = useStore((s) => s.setView);
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const [panel, setPanel] = useState<'cabinet' | 'cutlist' | 'order'>('cabinet');
  const [dialog, setDialog] = useState<null | 'file' | 'new' | 'drawer'>(null);

  const issues = useMemo(() => [...findIssues(project.room, project.cabinets, project.settings), ...openingIssues(project)], [project]);
  const issueIds = useMemo(() => new Set(issues.map((i) => i.cabinetId)), [issues]);
  const summary = issues.filter((i) => !i.echo).map((i) => i.message);
  const selectedPanel = (project.panels ?? []).find((w) => w.id === selectedId) ?? null;
  const selected = project.cabinets.find((c) => c.id === selectedId) ?? null;

  useEffect(() => { if (selectedId) setPanel('cabinet'); }, [selectedId]);
  useKeyboard();

  return (
    <div className={`app mode-${mode}`}>
      <header className="topbar">
        <div className="brand">
          <span className="mark" aria-hidden="true" />
          <span className="brand-name">Cabinet Studio</span>
          <span className="job">{project.name}</span>
        </div>
        <div className="seg mode" role="tablist" aria-label="Workspace">
          <button role="tab" aria-selected={mode === 'clients'} className={mode === 'clients' ? 'on' : ''} onClick={() => setMode('clients')}>Clients</button>
          <button role="tab" aria-selected={mode === 'design'} className={mode === 'design' ? 'on' : ''} onClick={() => setMode('design')}>Design</button>
          <button role="tab" aria-selected={mode === 'cutlist'} className={mode === 'cutlist' ? 'on' : ''} onClick={() => setMode('cutlist')}>Sheet cutlist</button>
          <button role="tab" aria-selected={mode === 'faceframe'} className={mode === 'faceframe' ? 'on' : ''} onClick={() => setMode('faceframe')}>Solid wood</button>
          <button role="tab" aria-selected={mode === 'quote'} className={mode === 'quote' ? 'on' : ''} onClick={() => setMode('quote')}>Quote</button>
          <button role="tab" aria-selected={mode === 'drawings'} className={mode === 'drawings' ? 'on' : ''} onClick={() => setMode('drawings')}>Drawings</button>
          <button role="tab" aria-selected={mode === 'render'} className={mode === 'render' ? 'on' : ''} onClick={() => setMode('render')}>Rendering</button>
          <button role="tab" aria-selected={mode === 'job'} className={mode === 'job' ? 'on' : ''} onClick={() => setMode('job')}>Job & clock</button>
        </div>
        {mode === 'design' && <div className="seg views" role="tablist" aria-label="View">
          {views.map((v, i) => (
            <button key={v.v} role="tab" aria-selected={view === v.v} className={`${view === v.v ? 'on' : ''}${i === 2 ? ' sep' : ''}`} onClick={() => setView(v.v)}>
              {v.label}
            </button>
          ))}
        </div>}
        <div className="actions">
          <button onClick={undo} disabled={!canUndo} title="Undo (⌘Z)">Undo</button>
          <button onClick={redo} disabled={!canRedo} title="Redo (⇧⌘Z)">Redo</button>
          <button onClick={() => setDialog('file')}>Project file</button>
          <button onClick={() => setDialog('new')}>New</button>
        </div>
      </header>

      {mode === 'cutlist' ? (
        <>
          <CutlistInputs />
          <CutlistLayouts />
          <CutlistSummary />
        </>
      ) : mode === 'job' ? (
        <>
          <JobClock />
          <JobMain />
          <JobSide />
        </>
      ) : mode === 'clients' ? (
        <>
          <ClientsSide />
          <ClientMain />
          <ClientPanel />
        </>
      ) : mode === 'drawings' ? (
        <>
          <DrawingsSide />
          <DrawingsMain />
          <DrawingsPanel />
        </>
      ) : mode === 'render' ? (
        <>
          <RenderInputs />
          <RenderStage />
          <RenderSide />
        </>
      ) : mode === 'quote' ? (
        <>
          <QuoteInputs />
          <QuoteBreakdown />
          <QuoteSummary />
        </>
      ) : mode === 'faceframe' ? (
        <>
          <FaceFrameInputs />
          <FaceFrameBreakdown />
          <FaceFrameSummary />
        </>
      ) : (
      <>
      <Sidebar />

      <main className="stage">
        <div className="view-caption">
          {view === 'plan' ? 'Plan view · back wall at top · ' : view === '3d' ? '' : `${wallNames[view.slice(5) as keyof typeof wallNames]} elevation · `}{navHint(view, nav.pointer, nav.mode)}
        </div>
        <Scene issueIds={issueIds} />
        <div className="render-view"><ViewTools />{view !== 'plan' && <CoverButton />}{view !== 'plan' && <DesignRenderButton />}</div>
        {issues.length > 0 && (
          <div className="issue-bar" role="status">
            <strong>{summary.length} layout issue{summary.length > 1 ? 's' : ''}</strong>
            <span>{summary.slice(0, 3).join(' · ')}{summary.length > 3 ? ' …' : ''}</span>
          </div>
        )}
      </main>

      <aside className="panel">
        <nav className="tabs" role="tablist">
          <button role="tab" aria-selected={panel === 'cabinet'} className={panel === 'cabinet' ? 'on' : ''} onClick={() => setPanel('cabinet')}>Cabinet</button>
          <button role="tab" aria-selected={panel === 'cutlist'} className={panel === 'cutlist' ? 'on' : ''} onClick={() => setPanel('cutlist')}>Cut list</button>
          <button role="tab" aria-selected={panel === 'order'} className={panel === 'order' ? 'on' : ''} onClick={() => setPanel('order')}>Orders</button>
        </nav>
        <div className="panel-body">
          {panel === 'cabinet' && selectedPanel && <PanelInspector key={selectedPanel.id} panel={selectedPanel} />}
          {panel === 'cabinet' && !selectedPanel && (selected ? (
            <Inspector key={selected.id} cab={selected} issues={issues.filter((i) => i.cabinetId === selected.id).map((i) => i.message)} />
          ) : (
            <div className="empty">
              <p><strong>Click a cabinet</strong> to edit its size, openings and placement.</p>
              <p>Add cabinets from the list on the left. Set how you build them under <em>Shop standards</em>.</p>
              <p className="muted">{project.cabinets.length} cabinets in this job.</p>
            </div>
          ))}
          {panel === 'cutlist' && (
            <div>
              <p className="hint">Everything cut in the shop, grouped by material. Sheet counts are a rough estimate until the sheet optimizer is built.</p>
              <PartsTable cabinets={project.cabinets} />
            </div>
          )}
          {panel === 'order' && (
            <div>
              <p className="hint">Doors, drawer fronts and dovetail drawer boxes for the whole job, sized from the face frame openings. Sizes are finished width × height.</p>
              <p><button onClick={() => setDialog('drawer')}>Drawer box calculator…</button></p>
              <ReleasePanel />
              <OrderList cabinets={project.cabinets} />
              <EagleRequests />
              <HardwareOrder />
              <BeadboardOrder />
              <MoldingOrder />
              <DoorOrderList />
            </div>
          )}
        </div>
      </aside>
      </>
      )}

      {dialog === 'file' && <ProjectDialog onClose={() => setDialog(null)} />}
      {dialog === 'drawer' && <DrawerCalculator onClose={() => setDialog(null)} />}
      {dialog === 'new' && (
        <div className="modal-back" onClick={() => setDialog(null)}>
          <div className="modal small" role="dialog" aria-modal="true" aria-labelledby="new-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="new-title">Start a new job?</h2>
            <p>This clears the current layout. Undo can bring it back, or save it first under <em>Project file</em>.</p>
            <div className="modal-actions">
              <button onClick={() => setDialog(null)}>Cancel</button>
              <button onClick={() => { useStore.getState().loadProject({ ...sampleProject(), name: 'New job', cabinets: [] }); setDialog(null); }}>Blank room</button>
              <button className="primary" onClick={() => { useStore.getState().loadProject(sampleProject()); setDialog(null); }}>Sample kitchen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA')) return;
      const st = useStore.getState();
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? st.redo() : st.undo(); return; }
      const id = st.selectedId;
      if (!id || st.mode !== 'design') return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); st.removeCabinet(id); }
      else if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); st.duplicateCabinet(id); }
      else if (e.key === 'Escape') st.select(null);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 1 / 16;
        const c = st.project.cabinets.find((x) => x.id === id);
        if (c) st.updateCabinet(id, { offset: c.offset + (e.key === 'ArrowLeft' ? -step : step) });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
