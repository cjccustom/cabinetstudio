import { useStore } from '../store';
import { useNav, zoomStep } from '../three/navigation';

/** Buttons over the 3D and elevation views: orbit or pan, zoom, back to the starting view, mouse or trackpad. */
export function ViewTools() {
  const view = useStore((s) => s.view);
  const nav = useNav();
  const hasCeiling = useStore((s) => !!s.project.ceiling?.on);
  const hasLights = useStore((s) => s.project.cabinets.some((c) => c.lighting?.length));
  const flat = view !== '3d';
  return (
    <div className="view-tools" role="toolbar" aria-label="View">
      {!flat && (
        <div className="seg" role="radiogroup" aria-label="Left-drag">
          <button role="radio" aria-checked={nav.mode === 'orbit'} className={nav.mode === 'orbit' ? 'on' : ''} onClick={() => nav.setMode('orbit')} title="Left-drag turns the view">Orbit</button>
          <button role="radio" aria-checked={nav.mode === 'pan'} className={nav.mode === 'pan' ? 'on' : ''} onClick={() => nav.setMode('pan')} title="Left-drag slides the view">Pan</button>
        </div>
      )}
      <button className="icon-btn" aria-label="Zoom out" title="Zoom out" onClick={() => zoomStep(false)}>−</button>
      <button className="icon-btn" aria-label="Zoom in" title="Zoom in" onClick={() => zoomStep(true)}>+</button>
      <button onClick={nav.reset} title="Back to the starting view">Reset view</button>
      {hasCeiling && <label className="check-inline" style={{ marginTop: 0 }}><input type="checkbox" checked={nav.ceiling} onChange={(e) => nav.setCeiling(e.target.checked)} /> Ceiling</label>}
      {!flat && <label className="check-inline" style={{ marginTop: 0 }} title="Hide the room's walls to see the work from any side"><input type="checkbox" checked={nav.walls} onChange={(e) => nav.setWalls(e.target.checked)} /> Walls</label>}
      <label className="check-inline" style={{ marginTop: 0 }} title="Flat light gray instead of the wood and finish colors, to see the build while you edit (Present and renderings keep the real colors)"><input type="checkbox" checked={nav.plain} onChange={(e) => nav.setPlain(e.target.checked)} /> Plain</label>
      {!flat && hasLights && <label className="check-inline" style={{ marginTop: 0 }} title="Show the cabinet lighting turned on"><input type="checkbox" checked={nav.lights} onChange={(e) => nav.setLights(e.target.checked)} /> Lights</label>}
      {!flat && <label className="check-inline" style={{ marginTop: 0 }} title="Open every door and pull out every drawer to show the inside"><input type="checkbox" checked={nav.allOpen} onChange={(e) => nav.setAllOpen(e.target.checked)} /> Open doors</label>}
      {nav.hidden.length > 0 && <button onClick={nav.showAll} title="Show everything hidden in this view">Show {nav.hidden.length} hidden</button>}
      <select aria-label="Pointing device" value={nav.pointer} onChange={(e) => nav.setPointer(e.target.value as 'mouse' | 'trackpad', true)}
        title="Trackpad: two-finger swipe pans and pinch zooms. Mouse: the wheel zooms toward the cursor.">
        <option value="mouse">Mouse</option>
        <option value="trackpad">Trackpad</option>
      </select>
    </div>
  );
}

/** One line on how to get around, for the corner of the view. */
export function navHint(view: string, pointer: 'mouse' | 'trackpad', mode: 'orbit' | 'pan') {
  const zoom = pointer === 'trackpad' ? 'pinch to zoom, two-finger swipe to pan' : 'scroll to zoom at the cursor';
  if (view !== '3d') return `Drag to pan · ${zoom}`;
  const drag = mode === 'pan' ? 'Drag to pan · right-drag to pan' : 'Drag to orbit · Shift-drag or right-drag to pan';
  return `${drag} · ${zoom}`;
}
