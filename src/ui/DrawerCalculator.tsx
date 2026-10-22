import { useState } from 'react';
import { useStore } from '../store';
import { drawerBoxSize, sideThicknesses, slides } from '../model/eagle';
import { fmt } from '../units';
import { Field, LengthInput } from './fields';

/** Size one Eagle dovetail drawer box from a face frame opening, the way Eagle's online calculator does. */
export function DrawerCalculator({ onClose }: { onClose: () => void }) {
  const s = useStore((st) => st.project.settings);
  const [w, setW] = useState<number | null>(15);
  const [h, setH] = useState<number | null>(6);
  const [d, setD] = useState<number | null>(23.25);
  const [side, setSide] = useState(s.drawerSide);
  const [slideId, setSlideId] = useState(s.drawerSlide);
  const [wDed, setWDed] = useState<number | null>(s.drawerWidthDeduction);
  const [hDed, setHDed] = useState<number | null>(s.drawerHeightDeduction);

  const ready = w != null && h != null && d != null;
  const box = ready
    ? drawerBoxSize({ openingW: w, openingH: h, depth: d, side, slideId, rearClearance: s.drawerRearClearance, customW: wDed ?? 0, customH: hDed ?? 0 })
    : null;
  const slide = slides.find((x) => x.id === slideId);
  const usedW = slide ? slide.widthDeduction[String(side)] : wDed ?? 0;
  const usedH = slide ? slide.heightDeduction : hDed ?? 0;

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="dc-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="dc-title">Drawer box calculator</h2>
        <p>Enter the face frame opening. Depth is measured from the face of the face frame to the back of the cabinet.</p>
        <div className="grid3">
          <Field label="Opening width" htmlFor="dc-w"><LengthInput id="dc-w" value={w} onChange={setW} /></Field>
          <Field label="Opening height" htmlFor="dc-h"><LengthInput id="dc-h" value={h} onChange={setH} /></Field>
          <Field label="Cabinet depth" htmlFor="dc-d"><LengthInput id="dc-d" value={d} onChange={setD} /></Field>
        </div>
        <div className="grid3" style={{ marginTop: 8 }}>
          <Field label="Slides" htmlFor="dc-slide">
            <select id="dc-slide" value={slideId} onChange={(e) => setSlideId(e.target.value)}>
              {slides.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              <option value="custom">Other</option>
            </select>
          </Field>
          <Field label="Drawer sides" htmlFor="dc-side">
            <select id="dc-side" value={side} onChange={(e) => setSide(Number(e.target.value))}>
              {sideThicknesses.map((t) => <option key={t} value={t}>{fmt(t)}</option>)}
            </select>
          </Field>
          {!slide && <span />}
        </div>
        {!slide && (
          <div className="grid3" style={{ marginTop: 8 }}>
            <Field label="Width minus" htmlFor="dc-wd"><LengthInput id="dc-wd" value={wDed} onChange={setWDed} /></Field>
            <Field label="Height minus" htmlFor="dc-hd"><LengthInput id="dc-hd" value={hDed} onChange={setHDed} /></Field>
          </div>
        )}
        {box && (
          <div className="calc-result">
            <div className="calc-size mono">{fmt(box.w)} W × {fmt(box.h)} H × {box.d ? `${box.d}"` : '—'} D</div>
            <div className="hint">
              Width {fmt(w!)} − {fmt(usedW)} · Height {fmt(h!)} − {fmt(usedH)} · Depth: longest slide that fits {fmt(d!)} less {fmt(s.drawerRearClearance)} clearance
            </div>
            <div className="hint">{box.d ? `${box.d}" ${box.slide}, ${box.notch}` : 'Too shallow for a standard slide.'}</div>
          </div>
        )}
        <div className="modal-actions">
          <button className="primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
