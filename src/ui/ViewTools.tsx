import { useStore } from '../store';
import { useNav, zoomStep } from '../three/navigation';

/** Buttons over the 3D and elevation views: orbit or pan, zoom, back to the starting view, mouse or trackpad. */
export function ViewTools() {
  const view = useStore((s) => s.view);
  const nav = useNav();
  const hasCeiling = useStore((s) => !!s.project.ceiling?.on);
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
