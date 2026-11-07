// The profiles sheet in the customer's drawings: every moulding on the job (crown, light rail, base,
// beadboard cap, coffer mouldings, room trim) drawn as it goes on, and a section through each
// beadboard used, so the customer sees the actual shapes. Full size where they fit, otherwise half
// or quarter size, each labeled.
import type { Project, WallPanel } from '../model/types';
import { moldLabel, moldingOrder, mountShape, profileLabel } from '../model/moldings';
import { optionOf, productOf } from '../model/panels';
import { fmt as fmtIn } from '../units';
import { View, type Frame } from './draw';

interface Item { title: string; sub: string; w: number; h: number; draw: (v: View) => void }

/** Section through a beadboard product: two or three repeats of its bead, groove or V. */
function beadboardItem(w: WallPanel): Item {
  const prod = productOf(w), opt = optionOf(w);
  const t = w.thickness ?? opt.thickness, oc = opt.oc ?? 4;
  const reps = 3, L = reps * oc;
  const name = prod.name.toLowerCase();
  const d = Math.min(t * 0.45, 0.19);
  const top: [number, number][] = [[0, t]];
  for (let k = 1; k < reps; k++) {
    const x = k * oc;
    if (/\bv\b|v-|v bead|v-groove/.test(name)) top.push([x - d * 0.8, t], [x, t - d], [x + d * 0.8, t]);
    else if (/bead/.test(name)) {
      // A round bead, its top flush with the face, between two narrow quirks
      const r = d, q = d * 0.3;
      top.push([x - r - q, t], [x - r - q, t - d], [x - r, t - d]);
      for (let i = 1; i < 12; i++) { const a = Math.PI - (Math.PI * i) / 12; top.push([x + r * Math.cos(a), t - d + r * Math.sin(a)]); }
      top.push([x + r, t - d], [x + r + q, t - d], [x + r + q, t]);
    } else top.push([x - d * 0.6, t], [x - d * 0.6, t - d], [x + d * 0.6, t - d], [x + d * 0.6, t]);
  }
  top.push([L, t]);
  const pts: [number, number][] = [[0, 0], [L, 0], ...top.reverse()];
  return {
    title: `${prod.name} beadboard`, sub: `${fmtIn(t)} thick, beads ${fmtIn(oc)} on center`, w: L, h: t,
    draw: (v) => { v.poly(pts, 'cut'); v.dimH(oc, 2 * oc, t, 0.22, `${fmtIn(oc)} o.c.`); v.dimV(0, t, 0, -0.22); },
  };
}

export function profileItems(p: Project): Item[] {
  const items: Item[] = [];
  for (const l of moldingOrder(p)) {
    const m = mountShape(l.profile);
    if (!m.pts.length) continue;
    const kinds = [...new Set(l.kinds.map((k) => moldLabel[k]))].join(', ');
    items.push({
      title: `${kinds}: ${profileLabel(l.profile)}`, sub: `${fmtIn(m.height)} high × ${fmtIn(m.depth)} projection`, w: m.depth, h: m.height,
      draw: (v) => { v.poly(m.pts, 'cut'); v.dimH(0, m.depth, 0, -0.22); v.dimV(0, m.height, 0, -0.22); },
    });
  }
  // One section per beadboard product and thickness on the job
  const seen = new Set<string>();
  for (const w of p.panels ?? []) {
    const key = `${productOf(w).id}:${w.thickness ?? optionOf(w).thickness}:${optionOf(w).oc}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(beadboardItem(w));
  }
  return items;
}

const SCALES: [number, string][] = [[12, 'FULL SIZE'], [6, 'HALF SIZE'], [3, 'QUARTER SIZE'], [1.5, '1-1/2" = 1\'-0"']];

/** The profiles laid out in a grid across the sheet's drawing area. */
export function profileViews(items: Item[], A: Frame): string {
  const cols = items.length <= 2 ? items.length : items.length <= 4 ? 2 : 3;
  const rows = Math.ceil(items.length / cols);
  const cw = A.w / cols, ch = A.h / rows;
  return items.map((it, i) => {
    const cell: Frame = { x: A.x + (i % cols) * cw, y: A.y + Math.floor(i / cols) * ch, w: cw, h: ch };
    // Room for the title under it and the dimensions around it
    const room = { w: cell.w - 1.0, h: cell.h - 1.0 };
    const [perFoot, scaleText] = SCALES.find(([s]) => (it.w * s) / 12 <= room.w && (it.h * s) / 12 <= room.h) ?? SCALES[SCALES.length - 1];
    const v = new View({ x: cell.x, y: cell.y, w: cell.w, h: cell.h - 0.55 }, { x0: 0, y0: 0, x1: it.w, y1: it.h }, perFoot);
    it.draw(v);
    // The title just under the drawing and its dimensions
    const tx = cell.x + cell.w / 2, ty = Math.min(cell.y + cell.h - 0.2, Number(v.Y(0)) + 0.55);
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    return v.svg()
      + `<text x="${tx}" y="${ty}" font-size="0.11" font-weight="700" text-anchor="middle">${esc(it.title)}</text>`
      + `<text x="${tx}" y="${ty + 0.16}" font-size="0.09" text-anchor="middle">${esc(it.sub)} · ${scaleText}</text>`;
  }).join('');
}
