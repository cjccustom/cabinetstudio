// The door style for the customer: the framing bead full size in section (stile, its inside profile,
// the center panel in its groove, the outside edge), and the door straight on. Drawn from Eagle's
// description of each bead (square shaker, rounded, bevel at its angle, ogee, cove, stepped).
import type { Project } from '../model/types';
import { centerPanels, edgeText, styleById, type DoorStyle } from '../model/eagle';
import { eff } from '../model/parts';
import { View, type Frame } from './draw';
import { fmt as fmtIn } from '../units';

type Pt = [number, number];

/**
 * Each framing bead's size from Eagle's profile drawings (eaglewoodworking.com, product guide →
 * framing bead profiles, checked Nov 2, 2026): how wide it is on the face, how far the panel sits
 * below the frame face, and its shape (radius or bevel angle).
 */
const BEADS: Record<string, { kind: 'square' | 'round' | 'bevel' | 'ogee' | 'cove' | 'step'; w: number; recess: number; r?: number; angle?: number }> = {
  jefferson: { kind: 'square', w: 0, recess: 0.3125 }, monroe: { kind: 'square', w: 0, recess: 0.1875 },
  adams: { kind: 'round', w: 0.25, recess: 0.3125, r: 0.5 }, franklin: { kind: 'bevel', w: 0.13, recess: 0.3125, angle: 22.5 },
  washington: { kind: 'bevel', w: 0.3125, recess: 0.3125, angle: 45 }, hamilton: { kind: 'bevel', w: 0.54, recess: 0.3125, angle: 60 },
  madison: { kind: 'ogee', w: 0.375, recess: 0.3125, r: 0.375 },
  boston: { kind: 'square', w: 0, recess: 0.25 }, providence: { kind: 'square', w: 0, recess: 0.1875 },
  hartford: { kind: 'round', w: 0.25, recess: 0.25, r: 0.5 }, portsmouth: { kind: 'bevel', w: 0.125, recess: 0.25, angle: 20 },
  nantucket: { kind: 'bevel', w: 0.1875, recess: 0.25, angle: 30 }, manchester: { kind: 'bevel', w: 0.5, recess: 0.25, angle: 60 },
  newport: { kind: 'ogee', w: 0.375, recess: 0.25, r: 0.375 }, portland: { kind: 'cove', w: 0.3125, recess: 0.25, r: 0.1875 },
  cambridge: { kind: 'step', w: 0.5, recess: 0.375 }, barharbor: { kind: 'square', w: 0, recess: 0.1875 },
};
export const beadOf = (style: DoorStyle) => BEADS[style.id] ?? { kind: 'square' as const, w: 0, recess: 0.25 };

/** The inside edge of the stile, from the frame face down to the panel, as points (x out toward the panel, y up to the face). */
function beadEdge(style: DoorStyle, S: number, T: number): Pt[] {
  const b = beadOf(style);
  const top = T, bot = T - b.recess;
  const arc = (cx: number, cy: number, r: number, a0: number, a1: number, n = 12): Pt[] => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
  switch (b.kind) {
    case 'round': {
      // A round-over of radius r, showing w of it on the face, down to the panel
      const r = Math.min(b.r ?? 0.5, b.recess), w = b.w;
      return [[S - w, top], ...arc(S - w, top - r, r, Math.PI / 2, 0).slice(1).map(([x, y]) => [Math.min(S, x), y] as Pt), [S, bot]];
    }
    case 'bevel': {
      // A bevel at its angle off the face, w wide, then straight down to the panel
      const drop = Math.min(b.recess, b.w * Math.tan(((b.angle ?? 45) * Math.PI) / 180));
      return [[S - b.w, top], [S, top - drop], [S, bot]];
    }
    case 'ogee': {
      const w = b.w, d = Math.min(b.recess, w * 0.85);
      const curve = Array.from({ length: 17 }, (_, i) => { const t = i / 16; return [S - w + w * t, top - d * (0.5 - 0.5 * Math.cos(Math.PI * t))] as Pt; });
      return [...curve, [S, bot]];
    }
    case 'cove': {
      // A small fillet, a cove of radius r, a fillet at the bottom
      const r = b.r ?? 0.1875, w = b.w, f = Math.max(0, (w - r) / 2);
      // Concave: a quarter circle hollowed out of the corner, centered out toward the panel
      return [[S - w, top], [S - w, top - f], ...arc(S - w + r, top - f, r, Math.PI, 1.5 * Math.PI).slice(1), [S, top - f - r], [S, bot]];
    }
    case 'step':
      return [[S - b.w, top], [S - b.w, top - b.recess / 2], [S, top - b.recess / 2], [S, bot]];
    default: return [[S, top], [S, bot]];
  }
}

/** The door style sheet's drawings: the section full size on the left, the door on the right. */
export function doorProfileViews(p: Project, section: Frame, front: Frame): { svg: string; notes: string[] } | null {
  const s = eff({ overrides: undefined } as never, p.settings);
  const style = styleById(s.doorStyleId);
  if (style.profile === 'slab') return null;
  const S = s.doorStile ?? style.stile, T = s.doorThickness ?? 0.75;
  const drop = beadOf(style).recess;
  const panel = centerPanels.find((c) => c.code === s.centerPanel);
  const raised = !!panel?.raised, flatFront = !!panel?.flatFront;
  const W = S + 2.25;
  // Full size: a 2-1/4" stile and its panel take about 4-1/2" of paper
  const v = new View(section, { x0: -0.5, y0: -0.5, x1: W + 0.3, y1: T + 0.6 }, 12);
  // The stile, outside edge eased
  const edge = beadEdge(style, S, T);
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
    `${style.name}${style.bead ? `, framing bead ${style.bead}` : ''}: ${style.detail}`,
    `${style.line === 'MDF' ? 'MDF' : s.doorMaterial}, ${s.doorMount === 'inset' ? 'inset' : 'overlay'} doors and drawer fronts`,
    panel ? `Center panel: ${panel.code}, ${panel.name}` : '',
    `Outside edge: ${edgeText(s.outsideEdge)}`,
    `Framing bead ${beadOf(style).w ? `${fmtIn(beadOf(style).w)} wide, ` : ''}panel ${fmtIn(beadOf(style).recess)} below the frame face (from the door maker’s profile drawing)`,
    'Section drawn full size; the sample door is the final word.',
  ].filter(Boolean);
  return { svg: v.svg() + fv.svg(), notes };
}
