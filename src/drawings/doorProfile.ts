// The door style for the customer: the framing bead full size in section (stile, its inside profile,
// the center panel in its groove, the outside edge), and the door straight on. Drawn from Eagle's
// description of each bead (square shaker, rounded, bevel at its angle, ogee, cove, stepped).
import type { Project } from '../model/types';
import { centerPanels, edgeText, styleById, type DoorStyle } from '../model/eagle';
import { eff } from '../model/parts';
import { View, type Frame } from './draw';

type Pt = [number, number];

/** The inside edge of the stile, from the frame face down to the panel, as points (x out toward the panel, y up to the face). */
function beadEdge(style: DoorStyle, S: number, T: number, drop: number): Pt[] {
  const top = T, bot = T - drop;
  const arc = (cx: number, cy: number, r: number, a0: number, a1: number, n = 10): Pt[] => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
  const angle = Number(style.detail.match(/(\d+(?:\.\d+)?)°/)?.[1] ?? 0);
  if (/cove/i.test(style.detail)) return [[S - drop, top], ...arc(S - drop, bot, drop, Math.PI / 2, 0).slice(1)];
  switch (style.profile) {
    case 'step':
      // A stepped shaker (Cambridge): two square steps; otherwise a 1/4" round-over (Hartford, Adams)
      if (/stepped/i.test(style.detail)) return [[S - 0.25, top], [S - 0.25, top - drop / 2], [S, top - drop / 2], [S, bot]];
      return [...arc(S - 0.25, top - 0.25, 0.25, Math.PI / 2, 0), [S, bot]];
    case 'bevel': {
      const w = angle ? Math.min(0.75, drop * Math.tan((90 - angle) * Math.PI / 180)) : 0.375;
      return [[S - w, top], [S, bot]];
    }
    case 'ogee': {
      const w = 0.4;
      return Array.from({ length: 17 }, (_, i) => { const t = i / 16; return [S - w + w * t, top - drop * (0.5 - 0.5 * Math.cos(Math.PI * t))] as Pt; });
    }
    default: return [[S, top], [S, bot]];
  }
}

/** The door style sheet's drawings: the section full size on the left, the door on the right. */
export function doorProfileViews(p: Project, section: Frame, front: Frame): { svg: string; notes: string[] } | null {
  const s = eff({ overrides: undefined } as never, p.settings);
  const style = styleById(s.doorStyleId);
  if (style.profile === 'slab') return null;
  const S = s.doorStile ?? style.stile, T = s.doorThickness ?? 0.75;
  const drop = style.profile === 'slim' ? 0.1875 : 0.25;
  const panel = centerPanels.find((c) => c.code === s.centerPanel);
  const raised = !!panel?.raised, flatFront = !!panel?.flatFront;
  const W = S + 2.25;
  // Full size: a 2-1/4" stile and its panel take about 4-1/2" of paper
  const v = new View(section, { x0: -0.5, y0: -0.5, x1: W + 0.3, y1: T + 0.6 }, 12);
  // The stile, outside edge eased
  const edge = beadEdge(style, S, T, drop);
  const e = 1 / 16;
  v.poly([[0, e], [e, 0], [S, 0], [S, T - drop - 0.375], ...edge.slice().reverse(), [e, T], [0, T - e]] as Pt[], 'cut');
  // The center panel in its groove: 1/4" flat (or raised, or flush with the frame face), tongue 3/8" into the stile
  const pt = raised ? 0.75 : 0.25;
  const pFace = flatFront ? T - 0.0625 : T - drop;
  const pBack = raised ? pFace - 0.75 * 0.6 : pFace - pt;
  const pb = Math.max(0.0625, pBack);
  v.rect(S, pb, W - S, pFace - pb, 'o');
  // The tongue in the stile's groove, hidden
  v.rect(S - 0.375, pb, 0.375, pFace - pb, 'hid');
  // Labels
  v.text(S / 2, -0.3, 'STILE', 0.09, 'middle', 'lbl');
  v.text(S + 1.1, pFace + 0.22, 'CENTER PANEL', 0.09, 'middle', 'lbl');
  v.dimH(0, S, T, 0.3, undefined);
  v.dimV(0, T, 0, -0.3, undefined);
  // The door straight on: frame, the bead line inside it, the panel
  const dw = 15, dh = 30;
  const fv = new View(front, { x0: -1, y0: -1, x1: dw + 1, y1: dh + 1 }, 1.5);
  fv.rect(0, 0, dw, dh, 'o');
  fv.rect(S, S, dw - 2 * S, dh - 2 * S, 'f');
  const inset = style.profile === 'shaker' || style.profile === 'slim' ? 0 : 0.375;
  if (inset) fv.rect(S - inset, S - inset, dw - 2 * (S - inset), dh - 2 * (S - inset), 'thin');
  if (raised) fv.rect(S + 1.5, S + 1.5, dw - 2 * (S + 1.5), dh - 2 * (S + 1.5), 'thin');
  if (style.line !== 'MDF') { fv.line(S, 0, S, dh, 'thin'); fv.line(dw - S, 0, dw - S, dh, 'thin'); }
  fv.dimH(0, S, 0, -0.25);
  const notes = [
    `${style.name}${style.bead ? `, Eagle framing bead ${style.bead}` : ''}: ${style.detail}`,
    `${style.line === 'MDF' ? 'MDF' : s.doorMaterial}, ${s.doorMount === 'inset' ? 'inset' : 'overlay'} doors and drawer fronts`,
    panel ? `Center panel: ${panel.code}, ${panel.name}` : '',
    `Outside edge: ${edgeText(s.outsideEdge)}`,
    'Section drawn full size from Eagle’s profile description; the sample door is the final word.',
  ].filter(Boolean);
  return { svg: v.svg() + fv.svg(), notes };
}
