// In a cabinet's Size section, under a sloped ceiling: the ceiling over it, a button to fit its
// height under the slope, and, on a sloped wall, cutting its top to the slope.
import { useStore } from '../store';
import type { Cabinet } from '../model/types';
import { cabinetCeiling, SLOPE_CLEAR, slopeFit } from '../model/ceiling';
import { fmt } from '../units';

const down8 = (v: number) => Math.floor(v * 8) / 8;

export function SlopeFit({ cab, set }: { cab: Cabinet; set: (p: Partial<Cabinet>) => void }) {
  const room = useStore((s) => s.project.room);
  const fit = slopeFit(room, cab);
  if (!fit) return null;
  const k = cabinetCeiling(room, cab);
  const flat = down8(k.low - cab.elevation - SLOPE_CLEAR);
  const canCut = !fit.across && fit.front - fit.back > 0.5;
  return (
    <div>
      <p className="hint">Under the sloped ceiling: {fmt(Math.min(k.backLeft, k.backRight))} over its back, {fmt(Math.min(k.frontLeft, k.frontRight))} over its front{fit.across ? `, ${fmt(Math.min(k.backLeft, k.frontLeft))} to ${fmt(Math.min(k.backRight, k.frontRight))} left to right` : ''}.</p>
      <div className="order-actions">
        {Math.abs(cab.height - flat) > 0.01 && !cab.slopeTop && <button className="mini" onClick={() => set({ height: flat })}>Fit under the slope ({fmt(flat)} tall)</button>}
        {canCut && <label className="check-inline"><input type="checkbox" checked={!!cab.slopeTop} onChange={(e) => set(e.target.checked ? { height: down8(fit.front), slopeTop: { back: down8(fit.back) } } : { slopeTop: undefined, height: flat })} /> Cut the top to the slope</label>}
      </div>
      {cab.slopeTop && (
        <p className="hint">
          {fmt(cab.height)} at the face frame, {fmt(cab.slopeTop.back)} at the wall; sides cut to the slope, the top tilted under it, shelves that meet it cut shallower.
          {(Math.abs(cab.height - down8(fit.front)) > 0.01 || Math.abs(cab.slopeTop.back - down8(fit.back)) > 0.01) && <> <button className="mini" onClick={() => set({ height: down8(fit.front), slopeTop: { back: down8(fit.back) } })}>Refit to the slope</button></>}
        </p>
      )}
      {fit.across && <p className="hint">The ceiling falls across this cabinet’s width (a slope on the wall beside it): split it where the slope starts and fit each part, or keep it to the low height.</p>}
    </div>
  );
}
