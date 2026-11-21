import { doorPhotoData } from './doorPhotos';
// The door style for the customer: the framing bead full size in section (stile, its inside profile,
// the center panel in its groove, the outside edge), and the door straight on. Drawn from Eagle's
// description of each bead (square shaker, rounded, bevel at its angle, ogee, cove, stepped).
import type { Project } from '../model/types';
import { centerPanels, edgeText, styleById, type DoorStyle } from '../model/eagle';
import { eff } from '../model/parts';
import { View, fitScale, type Frame } from './draw';
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

/** Where the door style's photo is published next to the page (flat or raised panel version). */
export function doorPhotoPath(p: Project): string | null {
  const s = eff({ overrides: undefined } as never, p.settings);
  const style = styleById(s.doorStyleId);
  if (style.profile === 'slab') return null;
  const raised = !!centerPanels.find((c) => c.code === s.centerPanel)?.raised;
  const flatOnly = style.id === 'barharbor';
  const name = `${style.id}${raised && !flatOnly ? '-raised' : ''}`;
  // Built into the app where it can be, so the photo never depends on finding a file
  return doorPhotoData(name) ?? `doors/${name}.webp`;
}

/**
 * The door style sheet's drawings, all in the set's own line weights: the framing bead in section,
 * full size, and a typical door straight on, dimensioned. The notes say what the door is.
 */
export function doorProfileViews(p: Project, section: Frame | null, front: Frame): { svg: string; notes: string[]; scale: number } | null {
  const s = eff({ overrides: undefined } as never, p.settings);
  const style = styleById(s.doorStyleId);
  if (style.profile === 'slab') return null;
  const S = s.doorStile ?? style.stile, T = s.doorThickness ?? 0.75;
  const drop = beadOf(style).recess;
  const panel = centerPanels.find((c) => c.code === s.centerPanel);
  const raised = !!panel?.raised, flatFront = !!panel?.flatFront;
  const W = S + 2.25;
  // Full size: a stile and 2-1/4" of its panel, centered in its frame
  const v = new View(section ?? { x: 0, y: 0, w: 1, h: 1 }, { x0: -0.6, y0: -0.6, x1: W + 0.2, y1: T + 0.7 }, 12);
  const edge = beadEdge(style, S, T);
  const e = 1 / 16;
  v.poly([[0, e], [e, 0], [S, 0], [S, T - drop - 0.375], ...edge.slice().reverse(), [e, T], [0, T - e]] as Pt[], 'cut');
  const pt = raised ? 0.75 : 0.25;
  const pFace = flatFront ? T - 0.0625 : T - drop;
  const pBack = raised ? pFace - 0.75 * 0.6 : pFace - pt;
  const pb = Math.max(0.0625, pBack);
  v.rect(S, pb, W - S, pFace - pb, 'cut');
  v.rect(S - 0.375, pb, 0.375, pFace - pb, 'hid');
  v.text(S / 2, T / 2 - 0.04, 'STILE', 0.08, 'middle', 'lbl');
  v.text(S + 1.3, pb - 0.2, 'PANEL', 0.08, 'middle', 'lbl');
  v.dimH(0, S, T, 0.3);
  v.dimV(0, T, 0, -0.3);
  if (drop) v.dimV(pFace, T, W, 0.3);
  // A typical door straight on, as big as its space allows
  const dw = 15, dh = 30;
  const scale = fitScale(dw + 2, dh + 2, front.w - 0.8, front.h - 0.6);
  const fv = new View(front, { x0: -1, y0: -1, x1: dw + 1, y1: dh + 1 }, scale);
  fv.rect(0, 0, dw, dh, 'o');
  const inset = style.profile === 'shaker' || style.profile === 'slim' ? 0 : Math.max(beadOf(style).w, 0.25);
  if (inset) fv.rect(S, S, dw - 2 * S, dh - 2 * S, 'thin');
  fv.rect(S + inset, S + inset, dw - 2 * (S + inset), dh - 2 * (S + inset), 'o');
  if (raised) fv.rect(S + inset + 1.5, S + inset + 1.5, dw - 2 * (S + inset + 1.5), dh - 2 * (S + inset + 1.5), 'thin');
  if (style.line !== 'MDF') { fv.line(S, 0, S, dh, 'o'); fv.line(dw - S, 0, dw - S, dh, 'o'); }
  fv.dimH(0, S, 0, -0.25);
  fv.dimV(dh - S, dh, dw, 0.25);
  const notes = [
    `${style.name}: five-piece door (stiles, rails and a center panel), ${style.detail.replace(/\.$/, '').toLowerCase()}`,
    `${style.line === 'MDF' ? 'MDF' : s.doorMaterial}, ${s.doorMount === 'inset' ? 'inset' : 'overlay'} doors and drawer fronts`,
    panel ? `Center panel: ${panel.name}` : '',
    `Outside edge: ${edgeText(s.outsideEdge).replace(/^E-\d+ \((.*)\)$/, '$1')}`,
    `Stiles and rails ${fmtIn(S)} wide${beadOf(style).w ? `; framing bead ${fmtIn(beadOf(style).w)} wide` : ''}; panel ${fmtIn(drop)} below the frame face`,
    'The sample door is the final word.',
  ].filter(Boolean);
  return { svg: (section ? v.svg() : '') + fv.svg(), notes, scale };
}
