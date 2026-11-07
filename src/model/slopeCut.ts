// A cabinet whose top is cut to a ceiling that slopes down toward its wall (an attic closet, a knee
// wall): the face frame keeps the cabinet's height at the front, and the case falls to its back
// height at the wall. Every part is clipped to that line:
// - sides and dividers become trapezoids, their top edge cut at the slope's angle;
// - the case top tilts to lie under the slope, its long edges beveled;
// - the back stops at the back height, and a hanging rail drops under the slope;
// - shelves high enough to meet the slope get shallower, cut back from the wall.
import type { Cabinet, CutShape, Part, VisualBox } from './types';
import { fmt } from '../units';

const EPS = 0.01;

/** Keep the part of a (z, y) polygon under the line y = top(z). */
function clipUnder(poly: [number, number][], top: (z: number) => number): [number, number][] {
  const out: [number, number][] = [];
  const inside = (p: [number, number]) => p[1] <= top(p[0]) + EPS;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ia = inside(a), ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) {
      // Where the edge crosses the line
      const fa = a[1] - top(a[0]), fb = b[1] - top(b[0]);
      const t = fa / (fa - fb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

export function cutToSlope(c: Cabinet, parts: Part[]): Part[] {
  const st = c.slopeTop;
  if (!st) return parts;
  const H = c.height, D = c.depth;
  const hB = Math.max(6, Math.min(H, st.back));
  if (H - hB < 0.05) return parts;
  // The cut line, in cabinet coordinates: z = 0 at the wall, the face frame's front at D
  const top = (z: number) => hB + ((H - hB) * Math.max(0, Math.min(D, z))) / D;
  const angle = (Math.atan2(H - hB, D) * 180) / Math.PI;
  const deg = `${angle.toFixed(1)}°`;
  const out: Part[] = [];
  for (const p of parts) {
    // The face frame, doors and anything on the front stay at the front height
    const over = (b: VisualBox) => b.min[2] < D - 1.5 && b.min[1] + b.size[1] > top(b.min[2]) + EPS;
    if (!p.boxes.some(over)) { out.push(p); continue; }
    const boxes: VisualBox[] = [], shapes: CutShape[] = [...(p.shapes ?? [])];
    let note = '', length = p.length, width = p.width, drop = false;
    for (const b of p.boxes) {
      if (!over(b)) { boxes.push(b); continue; }
      const [x0, y0, z0] = b.min, [sx, sy, sz] = b.size;
      const thinX = sx <= 1.5 && sz > 1.5, thinY = sy <= 1.5 && sx > 1.5 && sz > 1.5, thinZ = sz <= 1.5;
      if (thinX) {
        // A side or divider: a trapezoid, its top cut along the slope
        const poly = clipUnder([[z0, y0], [z0 + sz, y0], [z0 + sz, y0 + sy], [z0, y0 + sy]], top);
        if (poly.length >= 3) shapes.push({ along: 'z', min: [x0, 0, 0], thickness: sx, outline: poly });
        const hb = Math.min(y0 + sy, top(z0)) - y0;
        note = `Top edge cut to the slope at ${deg} from level: ${fmt(Math.min(sy, top(z0 + sz) - y0))} at the front, ${fmt(hb)} at the back`;
      } else if (thinY && (p.role === 'top' || p.role === 'stretcher')) {
        // The case top tilts to lie just under the slope
        // kept as far under the line as it sat under the top of the face frame (under the top rail on a tall cabinet)
        const za = z0, zb = z0 + sz, off = Math.max(0, H - (y0 + sy));
        const t = (z: number) => top(z) - off;
        shapes.push({ along: 'z', min: [x0, 0, 0], thickness: sx, outline: [[za, t(za) - sy], [zb, t(zb) - sy], [zb, t(zb)], [za, t(za)]] });
        width = Math.hypot(zb - za, t(zb) - t(za));
        note = `Tilted to the slope (${deg}): ${fmt(width)} wide on the slope; bevel both long edges ${deg}`;
      } else if (thinY) {
        // A shelf or bottom that meets the slope: cut back from the wall to clear it by 1/4"
        const zc = ((y0 + sy + 0.25 - hB) * D) / (H - hB);
        if (zc >= z0 + sz - 3) { drop = true; continue; }
        boxes.push({ ...b, min: [x0, y0, zc], size: [sx, sy, z0 + sz - zc] });
        width = Math.max(0, width - (zc - z0));
        note = `Shallower under the slope: ${fmt(width)} deep, its back edge ${fmt(zc - z0)} off the wall`;
      } else if (thinZ) {
        // The back stops under the slope; a hanging rail moves down under it
        const yt = top(z0) - (p.role === 'back' ? 0 : 0.25);
        if (p.role === 'back') {
          const h = Math.max(0, yt - y0);
          boxes.push({ ...b, size: [sx, h, sz] });
          length = h;
          note = `Stops at ${fmt(yt)} under the slope`;
        } else boxes.push({ ...b, min: [x0, yt - sy, z0] });
      } else boxes.push(b);
    }
    if (drop) continue;
    out.push({ ...p, boxes, shapes: shapes.length ? shapes : undefined, length, width, note: [p.note, note].filter(Boolean).join(' · ') || undefined });
  }
  return out;
}
