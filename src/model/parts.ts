import type { CrownBuild, Cabinet, Part, PanelMode, ShopSettings, VisualBox } from './types';
import { drawerBoxSize, narrowRail, narrowRailBelow, styleById, type DoorProfile, panelByCode } from './eagle';
import { buildCornerParts } from './corner';
import { pilasterOf, pilasterParts } from './pilaster';
import { floatingShelfParts } from './floatingShelf';
import { fmt as fmtShort, fmt } from '../units';

export const vb = (x: number, y: number, z: number, sx: number, sy: number, sz: number, shade?: number): VisualBox => ({
  min: [x, y, z], size: [sx, sy, sz], shade,
});

export interface RowLayout {
  rowId: string;
  /** Face frame opening, cabinet-local. */
  y0: number;
  y1: number;
  height: number;
}

/** Where the face frame starts off the floor of the cabinet (toe kick for base/tall). */
export const kickOf = (c: Cabinet, s: ShopSettings) => (c.kind === 'wall' ? 0 : eff(c, s).toeKickHeight);

/** The shop standards with this cabinet's own changes applied. */
export const eff = (c: Cabinet, s: ShopSettings): ShopSettings => (c.overrides ? { ...s, ...c.overrides } : s);

/** Resolve each face row's opening height, top to bottom. Auto rows split what's left. */
export function layoutRows(c: Cabinet, s: ShopSettings): { rows: RowLayout[]; leftover: number } {
  s = eff(c, s);
  const kick = kickOf(c, s);
  const top = c.height - s.topRailWidth;
  const bottom = kick + s.bottomRailWidth;
  const n = c.rows.length;
  const available = top - bottom - Math.max(0, n - 1) * s.midRailWidth;
  const fixed = c.rows.reduce((sum, r) => sum + (r.height ?? 0), 0);
  const autos = c.rows.filter((r) => r.height == null).length;
  const leftover = available - fixed;
  const autoH = autos ? Math.max(0, leftover / autos) : 0;
  const rows: RowLayout[] = [];
  let y = top;
  for (const r of c.rows) {
    const h = r.height ?? autoH;
    rows.push({ rowId: r.id, y0: y - h, y1: y, height: h });
    y -= h + s.midRailWidth;
  }
  return { rows, leftover: autos ? 0 : leftover };
}

/** A frame ring of four boxes, used for profiles on the inside edge of 5-piece doors. */
function ring(x: number, y: number, w: number, h: number, width: number, depth: number, shade: number): VisualBox[] {
  return [
    vb(x, y, 0, width, h, depth, shade),
    vb(x + w - width, y, 0, width, h, depth, shade),
    vb(x + width, y + h - width, 0, w - 2 * width, width, depth, shade),
    vb(x + width, y, 0, w - 2 * width, width, depth, shade),
  ];
}

/** A door or drawer front, drawn close enough to its Eagle style to read correctly in elevation. */
export function frontBoxes(x: number, y: number, z: number, w: number, h: number, t: number, profile: DoorProfile, stile: number, raised: boolean, flatFront = false): VisualBox[] {
  if (profile === 'slab') return [vb(x, y, z, w, h, t)];
  const f = Math.min(stile, h * 0.3, w * 0.3);
  const ix = x + f, iy = y + f, iw = w - 2 * f, ih = h - 2 * f;
  const out: VisualBox[] = [
    vb(x, y, z, f, h, t),
    vb(x + w - f, y, z, f, h, t),
    vb(ix, y + h - f, z, iw, f, t),
    vb(ix, y, z, iw, f, t),
  ];
  const inner: VisualBox[] = [];
  let px = ix, py = iy, pw = iw, ph = ih;
  const addRing = (width: number, depth: number, shade: number) => {
    if (pw <= 2 * width || ph <= 2 * width) return;
    inner.push(...ring(px, py, pw, ph, width, depth, shade));
    px += width; py += width; pw -= 2 * width; ph -= 2 * width;
  };
  if (profile === 'step') addRing(0.375, t - 0.1875, 0.97);
  if (profile === 'bevel') addRing(0.5, t - 0.25, 0.96);
  if (profile === 'ogee') { addRing(0.3, t - 0.12, 0.98); addRing(0.3, t - 0.28, 0.95); }
  // Flat front panels sit flush with the frame face; the rest are recessed
  inner.push(vb(px, py, 0, pw, ph, flatFront ? t : t - 0.375, flatFront ? 0.97 : 0.93));
  if (raised && pw > 3 && ph > 3) inner.push(vb(px + 1.25, py + 1.25, 0, pw - 2.5, ph - 2.5, t - 0.125, 0.99));
  for (const b of inner) out.push({ ...b, min: [b.min[0], b.min[1], z] });
  return out;
}

export interface EndInfo {
  left: boolean;
  right: boolean;
  /** Pilasters: how far out from the wall the neighbour's face is at a height, so returns die into it. */
  faceAt?: (side: 'left' | 'right', y: number) => number;
}

/** The end panel actually used on one side: only exposed ends get one. */
export function panelOn(c: Cabinet, s: ShopSettings, side: 'left' | 'right', exposed: boolean): PanelMode {
  s = eff(c, s);
  if (!exposed || c.corner) return 'none';
  const choice = (side === 'left' ? c.leftPanel : c.rightPanel) ?? 'default';
  return choice === 'default' ? s.endPanel : choice;
}

/** How far end panels stick out past the face frame on each side (they sit on the case side, just inside the frame edge). */
export function panelExtents(c: Cabinet, s: ShopSettings, ends: EndInfo) {
  if (c.kind === 'pilaster' || c.kind === 'shelf') return { left: 0, right: 0 };
  s = eff(c, s);
  const over = s.ffOverhang + s.boxThickness - s.boxActualThickness;
  const out = (scribe: number) => Math.max(0, s.endPanelThickness - scribe - over);
  return {
    left: panelOn(c, s, 'left', ends.left) === 'none' ? 0 : out(c.scribeLeft ?? 0),
    right: panelOn(c, s, 'right', ends.right) === 'none' ? 0 : out(c.scribeRight ?? 0),
  };
}

/**
 * Build every part of a face-frame cabinet from its size and the shop's standards.
 * The 3D view draws these same parts, so what you see is what gets cut.
 *
 * Cut sizes use nominal 3/4" case stock. The drawing uses the real (thinner) thickness,
 * which is where the slim face frame overhang comes from.
 */
export function buildParts(c: Cabinet, s: ShopSettings, ends: EndInfo = { left: false, right: false }): Part[] {
  s = eff(c, s);
  if (c.corner) return buildCornerParts(c, s);
  if (c.kind === 'pilaster') return [...pilasterParts(c, s), ...crownParts(c, s, ends)];
  if (c.kind === 'shelf') return floatingShelfParts(c, s, ends);
  const parts: Part[] = [];
  const { width: W, height: H, depth: D } = c;
  const tn = s.boxThickness;
  const ta = s.boxActualThickness;
  const dd = s.dadoDepth;
  const kick = kickOf(c, s);
  const boxD = D - s.ffThickness;
  // Extended (scribe) stiles widen the face frame past the case instead of a filler.
  const sL = c.scribeLeft ?? 0;
  const sR = c.scribeRight ?? 0;
  const FW = W - sL - sR; // the face frame width the case is built to
  const cutW = FW - 2 * s.ffOverhang - 2 * tn + 2 * dd; // bottom, stretchers, top and back
  const innerW = cutW - 2 * dd; // between the sides
  const xi0 = sL + (FW - innerW) / 2; // inside face of the left side
  const xi1 = xi0 + innerW;
  const pL = panelOn(c, s, 'left', ends.left);
  const pR = panelOn(c, s, 'right', ends.right);
  const bt = s.backThickness;
  const rw = Math.max(s.backRabbetWidth, bt);
  // The case is built back far enough that the toe kick ends at its finished depth once the skin goes on.
  const kickBack = s.toeKickDepth + s.toeKickSkin;
  const notch = Math.max(0, kickBack - s.ffThickness);
  const dados = fmtShort(dd);

  // Sides
  const sideBoxes = (x: number): VisualBox[] =>
    kick > 0
      ? [vb(x, kick, 0, ta, H - kick, boxD), vb(x, 0, 0, ta, kick, boxD - notch)]
      : [vb(x, 0, 0, ta, H, boxD)];
  ([['Left', xi0 - ta, ends.left, pL], ['Right', xi1, ends.right, pR]] as const).forEach(([, x, exposed, panel]) => {
    const notes = [];
    if (kick > 0) notes.push(`Toe notch ${fmtShort(kick)} × ${fmtShort(notch)}`);
    const bare = exposed && panel === 'none';
    notes.push(bare ? 'Exposed end: pocket screw from inside' : exposed ? 'Under end panel: glue & staple' : 'Hidden: glue & staple');
    parts.push({
      name: bare ? 'Side, exposed' : 'Side', role: 'side', material: 'box', length: H, width: boxD, thickness: tn, cut: true,
      note: notes.join(' · '),
      boxes: sideBoxes(x),
    });
  });

  // Bottom: in dados, a hair below the top of the bottom rail, or flush with the bottom of the
  // face frame on wall cabinets hung high enough that the underside shows.
  const flush = c.kind === 'wall' && !!c.bottomFlush;
  const botTop = flush ? ta : kick + s.bottomRailWidth - s.bottomReveal;
  parts.push({
    name: 'Bottom', role: 'bottom', material: 'box', length: cutW, width: boxD - rw, thickness: tn, cut: true,
    note: flush ? `In ${dados} dados, flush with bottom of face frame` : `In ${dados} dados`,
    boxes: [vb(xi0, botTop - ta, rw, innerW, ta, boxD - rw)],
  });

  // Top: stretchers in rabbets on base cabinets, a full panel in dados on wall and tall
  let topUnder = H;
  if (c.kind === 'base') {
    const sw = s.stretcherWidth;
    for (const [name, z] of [['Front stretcher', boxD - sw], ['Back stretcher', rw]] as const) {
      parts.push({
        name, role: 'stretcher', material: 'box', length: cutW, width: sw, thickness: tn, cut: true,
        note: `In ${dados} rabbets`,
        boxes: [vb(xi0, H - ta, z, innerW, ta, sw)],
      });
    }
    topUnder = H - ta;
  } else {
    topUnder = H - s.topRailWidth + s.bottomReveal;
    parts.push({
      name: 'Top', role: 'top', material: 'box', length: cutW, width: boxD - rw, thickness: tn, cut: true,
      note: `In ${dados} dados`,
      boxes: [vb(xi0, topUnder, rw, innerW, ta, boxD - rw)],
    });
  }

  // Back, in a rabbet at the back of the sides
  const backBottom = botTop - ta;
  parts.push({
    name: 'Back', role: 'back', material: 'back', length: H - backBottom, width: cutW, thickness: bt, cut: true,
    note: `In ${fmtShort(rw)} × ${dados} rabbet`,
    boxes: [vb(xi0, backBottom, rw - bt, innerW, H - backBottom, bt)],
  });

  if (s.hangingRails && c.kind !== 'base') {
    const nw = s.nailerWidth;
    parts.push({
      name: 'Hanging rail', role: 'nailer', material: 'box', length: innerW, width: nw, thickness: tn, cut: true,
      boxes: [vb(xi0, topUnder - nw, rw, innerW, nw, ta)],
    });
  }

  if (kick > 0) {
    parts.push({
      name: 'Toe kick nailer', role: 'nailer', material: 'box', length: innerW, width: kick, thickness: tn, cut: true,
      note: 'Scrap 3/4" ply',
      boxes: [vb(xi0, 0, D - kickBack - ta, innerW, kick, ta)],
    });
    parts.push({
      name: 'Toe kick skin', role: 'toekick', material: 'toeSkin', length: W, width: kick, thickness: s.toeKickSkin, cut: true,
      note: 'Applied at install; run it continuous where cabinets butt',
      boxes: [vb(0, 0, D - s.toeKickDepth - s.toeKickSkin, W, kick, s.toeKickSkin)],
    });
    // The skin wraps around exposed ends, tucked under the end panel
    for (const [exposed, x] of [[ends.left, xi0 - ta - s.toeKickSkin], [ends.right, xi1 + ta]] as const) {
      if (!exposed) continue;
      const len = D - s.toeKickDepth - s.toeKickSkin;
      parts.push({
        name: 'Toe kick return', role: 'toekick', material: 'toeSkin', length: len, width: kick, thickness: s.toeKickSkin, cut: true,
        note: 'Applied at install on the exposed end',
        boxes: [vb(x, 0, 0, s.toeKickSkin, kick, len)],
      });
    }
  }

  // Face frame: glued and pocket screwed
  const ffH = H - kick;
  const zF = boxD;
  const ft = s.ffThickness;
  const sw = s.stileWidth;
  const railLen = FW - 2 * sw;
  // Door openings. On a blind corner they start past the dead area and a wide blind stile.
  const blind = c.blind;
  const bs = sw + (blind?.clearance ?? s.blindClearance); // the blind stile: a face frame stile plus clearance
  const blindOpen = blind ? blind.dead + bs : 0;
  let ox0 = sL + sw;
  let ox1 = W - sR - sw;
  if (blind?.side === 'left') ox0 = Math.max(ox0, blindOpen);
  if (blind?.side === 'right') ox1 = Math.min(ox1, W - blindOpen);
  const cx = (ox0 + ox1) / 2;
  for (const [x, extra] of [[0, sL], [W - sw - sR, sR]]) {
    const scribed = extra > 0;
    parts.push({
      name: scribed ? 'Stile, extended' : 'Stile', role: 'stile', material: 'faceframe', length: ffH,
      width: sw + extra + (scribed ? s.scribeAllowance : 0), thickness: ft, cut: true,
      note: scribed ? `${fmtShort(sw)} + ${fmtShort(extra)} extension + ${fmtShort(s.scribeAllowance)} to scribe on site` : undefined,
      boxes: [vb(x, kick, zF, sw + extra, ffH, ft)],
    });
  }
  parts.push({
    name: 'Top rail', role: 'rail', material: 'faceframe', length: railLen, width: s.topRailWidth, thickness: ft, cut: true,
    boxes: [vb(sL + sw, H - s.topRailWidth, zF, railLen, s.topRailWidth, ft)],
  });
  parts.push({
    name: 'Bottom rail', role: 'rail', material: 'faceframe', length: railLen, width: s.bottomRailWidth, thickness: ft, cut: true,
    boxes: [vb(sL + sw, kick, zF, railLen, s.bottomRailWidth, ft)],
  });

  const { rows } = layoutRows(c, s);
  rows.forEach((r, i) => {
    if (i > 0) {
      parts.push({
        name: 'Mid rail', role: 'rail', material: 'faceframe', length: ox1 - ox0, width: s.midRailWidth, thickness: ft, cut: true,
        boxes: [vb(ox0, r.y1, zF, ox1 - ox0, s.midRailWidth, ft)],
      });
    }
  });

  // Openings: doors and drawer fronts (ordered from Eagle), drawer boxes, shelves
  const style = styleById(s.doorStyleId);
  const doorStile = style.fixedStile ? style.stile : s.doorStile;
  const raised = !!style.panelChoice && !!panelByCode(s.centerPanel).raised;
  const frontPanel = panelByCode(s.frontPanel);
  const material = style.line === 'MDF' ? 'MDF' : s.doorMaterial;
  const doorSpec = style.profile === 'slab'
    ? `Slab, ${material}`
    : `${style.name}, ${material}, ${fmtShort(doorStile)} stiles${raised ? ', raised panel' : ''}`;
  if (blind) {
    const openH = H - kick - s.topRailWidth - s.bottomRailWidth;
    const bx = blind.side === 'left' ? ox0 - bs : ox1;
    parts.push({
      name: 'Blind stile', role: 'stile', material: 'faceframe', length: openH, width: bs, thickness: ft, cut: true,
      note: `${fmtShort(sw)} + ${fmtShort(bs - sw)} clearance; starts ${fmtShort(blind.dead)} from the ${blind.side} end`,
      boxes: [vb(bx, kick + s.bottomRailWidth, zF, bs, openH, ft)],
    });
  }
  const inset = s.doorMount === 'inset';
  const o = s.doorOverlay;
  const rev = s.insetReveal;
  const gap = s.doorGap;
  // Fronts sharing a mid rail or center stile split it, so a wide overlay can't run them into each other.
  const shareOv = (rail: number) => Math.min(o, (rail - gap) / 2);
  const dt = s.doorThickness;
  const zFront = inset ? D - dt : D;
  const addFront = (name: string, role: 'door' | 'drawerFront', x: number, y: number, w: number, h: number, note?: string) => {
    // Short drawer fronts can't be built 5-piece; they go on the order as slabs.
    // Eagle drops short drawer fronts to 1 1/2" rails.
    const rail = role === 'drawerFront' && h < narrowRailBelow ? Math.min(narrowRail, doorStile) : doorStile;
    const tooShort = style.profile !== 'slab' && h < 2 * rail + 1.5;
    const slab = role === 'drawerFront' && (s.drawerFronts === 'slab' || tooShort);
    const profile: DoorProfile = slab ? 'slab' : style.profile;
    const spec = (slab ? `Slab, ${material}` : doorSpec) + (inset ? ', inset' : '');
    parts.push({
      name, role, material: 'door', length: h, width: w, thickness: dt, cut: false, note,
      order: { item: role, w, h, spec, ...(profile === 'slab' ? {} : { rail, stile: doorStile }) },
      boxes: role === 'drawerFront'
        ? frontBoxes(x, y, zFront, w, h, dt, profile, Math.min(rail, doorStile), !!style.panelChoice && !!frontPanel.raised, !!frontPanel.flatFront)
        : frontBoxes(x, y, zFront, w, h, dt, profile, doorStile, raised),
    });
  };
  c.rows.forEach((row, i) => {
    const r = rows[i];
    if (r.height <= 0) return;
    const split = row.type === 'doors' && row.doors === 2 && c.centerStile;
    if (split) {
      parts.push({
        name: 'Center stile', role: 'stile', material: 'faceframe', length: r.height, width: sw, thickness: ft, cut: true,
        boxes: [vb(cx - sw / 2, r.y0, zF, sw, r.height, ft)],
      });
    }
    // Front edges: overlay onto the outer frame, share mid rails, or sit inside the opening for inset
    const top = inset ? -rev : i === 0 ? o : shareOv(s.midRailWidth);
    const bottom = inset ? -rev : i === rows.length - 1 ? o : shareOv(s.midRailWidth);
    const side = inset ? -rev : o;
    const fy = r.y0 - bottom;
    const fh = r.height + top + bottom;
    const fullW = ox1 - ox0 + 2 * side;
    const pairGap = inset ? rev : gap;
    if (row.type === 'drawer' || row.type === 'falseFront') {
      addFront(row.type === 'drawer' ? 'Drawer front' : 'False front', 'drawerFront', ox0 - side, fy, fullW, fh, row.type === 'falseFront' ? 'Fixed, no drawer box' : undefined);
    } else if (row.type === 'doors') {
      if (row.doors === 1) addFront('Door', 'door', ox0 - side, fy, fullW, fh);
      else if (split) {
        const mid = inset ? -rev : shareOv(sw);
        const lw = cx - sw / 2 - ox0 + side + mid;
        addFront('Door', 'door', ox0 - side, fy, lw, fh);
        addFront('Door', 'door', cx + sw / 2 - mid, fy, lw, fh);
      } else {
        // Eagle's pair formula: (opening + both overlays - gap) / 2
        const dw = (fullW - pairGap) / 2;
        addFront('Door', 'door', ox0 - side, fy, dw, fh);
        addFront('Door', 'door', ox0 - side + dw + pairGap, fy, dw, fh);
      }
    }
    if (row.type === 'drawer') {
      const box = drawerBoxSize({
        openingW: ox1 - ox0, openingH: r.height, depth: D - rw - (inset ? dt : 0), side: s.drawerSide,
        slideId: s.drawerSlide, rearClearance: s.drawerRearClearance, customW: s.drawerWidthDeduction, customH: s.drawerHeightDeduction,
      });
      parts.push({
        name: 'Drawer box', role: 'drawerBox', material: 'drawerBox', length: box.d, width: box.w, thickness: box.h, cut: false,
        note: box.d ? `${box.d}" slides` : 'Cabinet too shallow for standard slides',
        order: { item: 'drawerBox', w: box.w, h: box.h, d: box.d, spec: `Dovetail, ${fmtShort(s.drawerSide)} sides, ${box.notch}` },
        boxes: [],
      });
    }
    if ((row.type === 'doors' || row.type === 'open') && row.shelves > 0) {
      const shelfW = innerW - s.shelfClearance;
      const shelfD = boxD - rw - s.shelfSetback;
      const lo = Math.max(r.y0, botTop);
      const hi = Math.min(r.y1, topUnder);
      for (let k = 1; k <= row.shelves; k++) {
        const y = lo + ((hi - lo) * k) / (row.shelves + 1) - ta / 2;
        parts.push({ name: 'Adjustable shelf', role: 'shelf', material: 'box', length: shelfW, width: shelfD, thickness: tn, cut: true,
          boxes: [vb(xi0 + s.shelfClearance / 2, y, rw, shelfW, ta, shelfD)] });
      }
    }
  });

  // End panels, bought from Eagle in the door style, applied to the outside of the case side
  const doorFace = zFront + dt;
  const pt = s.endPanelThickness;
  // Applied panels are held up to line up with the doors and fronts; the toe kick returns underneath.
  // Inset panels follow the face frame, since inset doors sit inside it.
  const frontYs = parts.filter((p) => p.role === 'door' || p.role === 'drawerFront').flatMap((p) => p.boxes.map((b) => [b.min[1], b.min[1] + b.size[1]]));
  const doorBottom = frontYs.length ? Math.min(...frontYs.map((y) => y[0])) : kick;
  const doorTop = frontYs.length ? Math.max(...frontYs.map((y) => y[1])) : H;
  for (const [side, mode] of [['left', pL], ['right', pR]] as const) {
    if (mode === 'none') continue;
    const depth = mode === 'flush' ? doorFace : mode === 'reveal' ? doorFace - s.endPanelReveal : D;
    const label = mode === 'flush' ? 'flush with door face' : mode === 'reveal' ? `held back ${fmtShort(s.endPanelReveal)} from door face` : 'inset, flush with face frame';
    // Draw the panel face-on, then turn it to face out from the side of the cabinet
    const [py0, py1] = mode === 'inset' ? [kick, H] : [doorBottom, doorTop];
    const ph = py1 - py0;
    const flat = frontBoxes(0, py0, 0, depth, ph, pt, style.profile, doorStile, raised);
    const boxes = flat.map((b) => {
      const [u, v, w0] = b.min;
      const [su, sv, sw0] = b.size;
      const x = side === 'left' ? xi0 - ta - (w0 + sw0) : xi1 + ta + w0;
      return vb(x, v, u, sw0, sv, su, b.shade);
    });
    parts.push({
      name: 'End panel', role: 'endPanel', material: 'door', length: ph, width: depth, thickness: pt, cut: false,
      note: `${side === 'left' ? 'Left' : 'Right'}, ${label}, ${fmtShort(py0)} off cabinet bottom`,
      order: { item: 'endPanel', w: depth, h: ph, spec: `${doorSpec}, end panel`, ...(style.profile === 'slab' ? {} : { rail: doorStile, stile: doorStile }) },
      boxes,
    });
  }

  if (c.kind === 'base' && c.countertop) parts.push(topPart(c, s, W, D + dt, panelExtents(c, s, ends)));
  if (c.kind !== 'base') parts.push(...crownParts(c, s, ends));
  return parts;
}

export const noCrownBuild: CrownBuild = { subCrown: 0, rise: 0, drop: 0, extra: [] };

/** Where the crown build sits on a cabinet: its top, the face the mouldings go on, and the sub-crown. */
export function crownLayout(c: Cabinet, s: ShopSettings) {
  s = eff(c, s);
  const b = { ...noCrownBuild, ...c.crownBuild };
  // The sub-crown's face lines up with the door faces (or sits a door's thickness proud on inset jobs)
  const subT = b.subCrown > 0 ? s.doorThickness : 0;
  const top = c.height + b.rise;
  // On a pilaster the frieze breaks out flush with the capital block
  const back = c.kind === 'pilaster' ? c.depth + pilasterOf(c).proud - subT : c.depth;
  const face = c.kind === 'pilaster' && !subT ? c.depth + pilasterOf(c).proud : back + subT;
  return { build: b, top, subT, back, subBottom: top - b.subCrown, face, crownTop: top - b.drop };
}

/** How far the face frame actually sticks out past each case side once real plywood thickness is counted. */
export const realOverhang = (s: ShopSettings) => s.ffOverhang + (s.boxThickness - s.boxActualThickness);

/** Flat sub-crown (solid stock, ripped with the face frames) and the plywood nailer that raises it. */
function crownParts(c: Cabinet, s: ShopSettings, ends: EndInfo): Part[] {
  const L = crownLayout(c, s);
  const { build: b, subT } = L;
  const out: Part[] = [];
  const ext = panelExtents(c, s, ends);
  const x0 = -ext.left, x1 = c.width + ext.right;
  const nt = s.boxActualThickness;
  if (b.rise > 0) {
    // Nailer screwed to the cabinet top, behind the face frame, for the sub-crown and crown to land on
    out.push({ name: 'Crown nailer', role: 'nailer', material: 'box', length: c.width, width: b.rise, thickness: s.boxThickness, cut: true,
      note: `on the cabinet top, raises the crown ${fmtShort(b.rise)}`,
      boxes: [vb(0, c.height, c.depth - nt, c.width, b.rise, nt)] });
    for (const side of ['left', 'right'] as const) {
      if (!ends[side]) continue;
      out.push({ name: 'Crown nailer return', role: 'nailer', material: 'box', length: c.depth - nt, width: b.rise, thickness: s.boxThickness, cut: true,
        boxes: [vb(side === 'left' ? 0 : c.width - nt, c.height, 0, nt, b.rise, c.depth - nt)] });
    }
  }
  if (subT > 0) {
    const h = b.subCrown;
    const xl = x0 - (ends.left ? subT : 0), xr = x1 + (ends.right ? subT : 0);
    out.push({ name: 'Sub-crown', role: 'trim', material: 'faceframe', length: xr - xl, width: h, thickness: subT, cut: true,
      note: 'flat, face flush with the doors; crown goes on its face',
      boxes: [vb(xl, L.subBottom, L.back, xr - xl, h, subT)] });
    for (const side of ['left', 'right'] as const) {
      if (!ends[side]) continue;
      const z0 = ends.faceAt ? ends.faceAt(side, L.subBottom + h / 2) : 0;
      if (L.back - z0 < 0.25) continue;
      out.push({ name: 'Sub-crown return', role: 'trim', material: 'faceframe', length: L.back - z0, width: h, thickness: subT, cut: true,
        boxes: [vb(side === 'left' ? xl : x1, L.subBottom, z0, subT, h, L.back - z0)] });
    }
  }
  return out;
}

/**
 * The top of a base cabinet: stone by others, or a solid wood top / bench seat glued up in the shop.
 * Overhangs are measured past the door face and past each end (end panels included).
 */
export function topPart(c: Cabinet, s: ShopSettings, W: number, frontFace: number, ext: { left: number; right: number }): Part {
  const wood = c.topKind === 'wood';
  const t = c.topThickness ?? (wood ? 1.25 : s.counterThickness);
  const front = c.topFront ?? s.counterOverhang;
  const left = ext.left + (c.topLeft ?? 0);
  const right = ext.right + (c.topRight ?? 0);
  const len = W + left + right;
  const depth = frontFace + front;
  return wood
    ? {
        name: 'Wood top', role: 'woodTop', material: 'solidWood', length: len, width: depth, thickness: t, cut: true,
        note: `${s.woodSpecies}, glued up; ${fmt(front)} front overhang`,
        boxes: [vb(-left, c.height, 0, len, t, depth)],
      }
    : {
        name: 'Countertop', role: 'counter', material: 'counter', length: len, width: depth, thickness: t, cut: false,
        boxes: [vb(-left, c.height, 0, len, t, depth)],
      };
}
