// A table on paper: plan, side and end elevations, and an enlarged section through the edge
// (where the lip, top and apron meet), drawn from the same parts as the 3D view and cut list.
import type { DiningTable } from '../model/furniture';
import { lipStock } from '../model/furniture';
import { tableParts, type TableBox, type TablePart } from '../model/tableParts';
import { dimText, fitScale, inView, View, type Frame } from './draw';

type Axis = 0 | 1 | 2;
interface Proj { u: Axis; v: Axis; depth: Axis; near: 1 | -1 }

/** Draws the parts as filled outlines, far to near, so nearer pieces cover what's behind them. */
function drawParts(view: View, parts: TablePart[], pr: Proj) {
  const items: { part: TablePart; b: TableBox; d: number }[] = [];
  for (const part of parts) for (const b of part.boxes) items.push({ part, b, d: pr.near * (b.min[pr.depth] + b.size[pr.depth] / 2) });
  items.sort((a, b) => a.d - b.d);
  for (const { part, b } of items) {
    const u0 = b.min[pr.u], v0 = b.min[pr.v], du = b.size[pr.u], dv = b.size[pr.v];
    if (part.role === 'leg' && pr.v === 1 && (part.taperTo || part.turned)) {
      // Seen from the side: the taper on the inside face (the one toward the middle of the table)
      const bottom = part.turned ? du * 0.7 : part.taperTo!;
      const start = v0 + dv * 0.62;
      const inside = u0 + du / 2 < 0 ? 'right' : 'left';
      const pts: [number, number][] = inside === 'right'
        ? [[u0, v0 + dv], [u0 + du, v0 + dv], [u0 + du, start], [u0 + bottom, v0], [u0, v0]]
        : [[u0, v0 + dv], [u0 + du, v0 + dv], [u0 + du, v0], [u0 + du - bottom, v0], [u0, start]];
      if (part.turned) {
        const c = u0 + du / 2;
        view.poly([[u0, v0 + dv], [u0 + du, v0 + dv], [u0 + du, start + 2], [c + du * 0.42, start], [c + du * 0.3, v0 + 2], [c + du * 0.36, v0], [c - du * 0.36, v0], [c - du * 0.3, v0 + 2], [c - du * 0.42, start], [u0, start + 2]], 'o');
      } else view.poly(pts, 'o');
      continue;
    }
    view.rect(u0, v0, du, dv, 'o');
  }
}

export interface TableSheetViews { svg: string; scale: number; secScale: number }

export function tableViews(t: DiningTable, f: { plan: Frame; side: Frame; end: Frame; section: Frame }): TableSheetViews {
  const parts = tableParts(t);
  const L = t.length, W = t.width, H = t.height;
  // The highest thing on it: the lip, or a bench's cushion
  const lipTop = Math.max(H, ...parts.filter((p) => p.role === 'lip' || p.role === 'cushion').flatMap((p) => p.boxes.map((b) => b.min[1] + b.size[1])));
  const out: string[] = [];
  // One scale for the plan and elevations, so they read together
  const scale = inView(`table:${t.id}`, `${t.name}`, () => Math.min(
    fitScale(L, W, f.plan.w - 1.4, f.plan.h - 1.2),
    fitScale(L, lipTop, f.side.w - 1.4, f.side.h - 1.2),
    fitScale(W, lipTop, f.end.w - 1.2, f.end.h - 1.2),
  ));
  // Plan: x along, z down the page (z = −W/2 at the top is the far side)
  const pv = new View(f.plan, { x0: -L / 2, y0: -W / 2, x1: L / 2, y1: W / 2 }, scale, false);
  drawParts(pv, parts.filter((p) => !['leg', 'apron', 'foot', 'post', 'stretcher', 'column', 'cleat', 'shelf', 'slat'].includes(p.role)), { u: 0, v: 2, depth: 1, near: 1 });
  // The base under the top, dashed
  for (const part of parts) if (['leg', 'apron', 'foot', 'post', 'column', 'shelf', 'slat'].includes(part.role)) for (const b of part.boxes) pv.rect(b.min[0], b.min[2], b.size[0], b.size[2], 'hid');
  pv.dimH(-L / 2, L / 2, W / 2, -0.45);
  pv.dimV(-W / 2, W / 2, L / 2, 0.45);
  if (t.lip) {
    const lw = lipStock(t).w;
    pv.dimV(W / 2 - lw, W / 2, -L / 2, -0.35, `${dimText(lw)} lip`);
    pv.dimV(-W / 2 + lw, W / 2 - lw, -L / 2, -0.75, `${dimText(W - 2 * lw)} inside`);
    pv.dimH(-L / 2 + lw, L / 2 - lw, -W / 2, 0.4, `${dimText(L - 2 * lw)} inside the lip`);
  }
  pv.text(0, -W / 2 - pv.p(t.lip ? 0.75 : 0.35), 'PLAN', 0.12, 'middle', 'lbl');
  out.push(pv.svg());

  // Side elevation, seen from the front (+z)
  const sv = new View(f.side, { x0: -L / 2, y0: 0, x1: L / 2, y1: lipTop }, scale);
  drawParts(sv, parts, { u: 0, v: 1, depth: 2, near: 1 });
  sv.line(-L / 2 - 6, 0, L / 2 + 6, 0, 'heavy');
  sv.dimH(-L / 2, L / 2, 0, -0.4);
  const legs = parts.find((p) => p.role === 'leg');
  if (legs) {
    const xs = legs.boxes.filter((b) => b.min[2] > 0).flatMap((b) => [b.min[0], b.min[0] + b.size[0]]);
    sv.chainH([-L / 2, ...xs, L / 2], 0, -0.75);
  }
  // Floor to the apron and to the top; the lip's own sizes are on the edge section
  const shelfTop = Math.max(0, ...parts.filter((p) => p.role === 'slat' || p.role === 'shelf').flatMap((p) => p.boxes.map((b) => b.min[1] + b.size[1])));
  sv.chainV([0, ...(shelfTop ? [shelfTop] : []), ...(t.base === 'legs' ? [H - t.top - t.apron] : []), H], L / 2, 0.4);
  if (t.cushion) sv.dimV(0, lipTop, L / 2, 0.8, `${dimText(lipTop)} seat with cushion`);
  if (t.lip) sv.dimV(0, lipTop, L / 2, 0.8, `${dimText(lipTop)} to top of lip`);
  sv.text(0, -sv.p(1.05), 'SIDE ELEVATION', 0.12, 'middle', 'lbl');
  out.push(sv.svg());

  // End elevation, seen from the right end (+x)
  const ev = new View(f.end, { x0: -W / 2, y0: 0, x1: W / 2, y1: lipTop }, scale);
  drawParts(ev, parts.map((p) => ({ ...p, boxes: p.boxes.map((b) => ({ min: [b.min[2], b.min[1], b.min[0]] as [number, number, number], size: [b.size[2], b.size[1], b.size[0]] as [number, number, number] })) })), { u: 0, v: 1, depth: 2, near: 1 });
  ev.line(-W / 2 - 4, 0, W / 2 + 4, 0, 'heavy');
  ev.dimH(-W / 2, W / 2, 0, -0.4);
  ev.dimV(0, H, W / 2, 0.4, `${dimText(H)} to the top`);
  ev.text(0, -ev.p(0.8), 'END ELEVATION', 0.12, 'middle', 'lbl');
  out.push(ev.svg());

  // Section through the edge at the middle of the length: top, lip, apron, larger
  const near = parts.filter((p) => p.boxes.some((b) => b.min[0] <= 0 && b.min[0] + b.size[0] >= 0));
  const lowest = t.base === 'legs' ? H - t.top - t.apron - 1.5 : H - t.top - 3;
  const win = { z0: W / 2 - 7, z1: W / 2 + 1.5, y0: lowest, y1: lipTop + 1.5 };
  const secScale = inView(`table-sec:${t.id}`, `${t.name} edge section`, () => fitScale(win.z1 - win.z0, win.y1 - win.y0, f.section.w - 1.3, f.section.h - 1.0));
  const cv = new View(f.section, { x0: win.z0, y0: win.y0, x1: win.z1, y1: win.y1 }, secScale);
  for (const part of near) for (const b of part.boxes) {
    if (!(b.min[0] <= 0 && b.min[0] + b.size[0] >= 0)) continue;
    const z0 = Math.max(win.z0, b.min[2]), z1 = Math.min(win.z1, b.min[2] + b.size[2]);
    const y0 = Math.max(win.y0, b.min[1]), y1 = Math.min(win.y1, b.min[1] + b.size[1]);
    if (z1 > z0 && y1 > y0) cv.rect(z0, y0, z1 - z0, y1 - y0, part.role === 'top' || part.role === 'lip' || part.role === 'apron' || part.role === 'cleat' ? 'cut' : 'o');
  }
  // Break line where the top continues toward the middle
  cv.line(win.z0, H - t.top - 0.6, win.z0, H + 0.6, 'cutline');
  if (t.lip) {
    const ls = lipStock(t);
    const y0 = (t.lipStyle ?? 'edge') === 'edge' ? H - t.top : H;
    cv.dimV(y0, y0 + ls.h, W / 2, 0.35);
    cv.dimV(H, lipTop, W / 2 - ls.w, -0.3);
    cv.text(W / 2 - ls.w - cv.p(0.45), lipTop + cv.p(0.12), `LIP ${dimText(lipTop - H)} ABOVE THE SURFACE`, 0.085, 'end', 'dt');
    cv.dimH(W / 2 - ls.w, W / 2, lipTop, 0.3);
  }
  cv.dimV(H - t.top, H, win.z0 + 0.5, -0.3);
  cv.text((win.z0 + win.z1) / 2, win.y0 - cv.p(0.35), 'SECTION AT THE EDGE', 0.11, 'middle', 'lbl');
  out.push(cv.svg());
  return { svg: out.join(''), scale, secScale };
}
