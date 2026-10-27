import type { CrownBuild, Cabinet, Part, PanelMode, ShopSettings, VisualBox } from './types';
import { mantelParts } from './mantel';
import { drawerBoxSize, narrowRail, narrowRailBelow, styleById, type DoorProfile, panelByCode } from './eagle';
import { buildCornerParts } from './corner';
import { pilasterOf, pilasterParts } from './pilaster';
import { floatingShelfParts } from './floatingShelf';
import { fmt as fmtShort, fmt } from '../units';
import { baseLayout, boardT, cutShape, archShapes } from './cabinetBase';
import type { CutShape } from './types';

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

/** Height of the recessed toe kick under the case (0 for wall cabinets, or a base that runs to the floor). */
export const kickOf = (c: Cabinet, s: ShopSettings) => (c.kind === 'wall' ? 0 : baseLayout(c, eff(c, s)).kick);

/** The shop standards with this cabinet's own changes applied. */
export const eff = (c: Cabinet, s: ShopSettings): ShopSettings => (c.overrides ? { ...s, ...c.overrides } : s);

/** Width of the mid rail above row i (none above the first row). */
export const railAbove = (c: Cabinet, s: ShopSettings, i: number) => (i <= 0 || i >= c.rows.length ? 0 : c.rows[i].railAbove ?? eff(c, s).midRailWidth);
/** The ledge on the rail above row i, if there is one. */
export const ledgeAbove = (c: Cabinet, i: number) => (i <= 0 || i >= c.rows.length ? null : c.rows[i].ledge && c.rows[i].ledge!.thickness > 0 ? c.rows[i].ledge! : null);
/** Everything between row i and the row above it: the rail, plus a ledge sitting on it. */
export const gapAbove = (c: Cabinet, s: ShopSettings, i: number) => railAbove(c, s, i) + (ledgeAbove(c, i)?.thickness ?? 0);

/** Resolve each face row's opening height, top to bottom. Auto rows split what's left. */
export function layoutRows(c: Cabinet, s: ShopSettings): { rows: RowLayout[]; leftover: number } {
  const s0 = s;
  s = eff(c, s);
  const bl = baseLayout(c, s);
  const top = c.height - s.topRailWidth;
  const bottom = bl.railY + bl.railW;
  const available = top - bottom - c.rows.reduce((t, _, i) => t + gapAbove(c, s0, i), 0);
  const fixed = c.rows.reduce((sum, r) => sum + (r.height ?? 0), 0);
  const autos = c.rows.filter((r) => r.height == null).length;
  const leftover = available - fixed;
  const autoH = autos ? Math.max(0, leftover / autos) : 0;
  const rows: RowLayout[] = [];
  let y = top;
  c.rows.forEach((r, i) => {
    const h = r.height ?? autoH;
    rows.push({ rowId: r.id, y0: y - h, y1: y, height: h });
    y -= h + gapAbove(c, s0, i + 1);
  });
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
  /** Pilasters: a side tight to a room wall. */
  wall?: { left: boolean; right: boolean };
}

/** The end panel actually used on one side: only exposed ends get one. */
export function panelOn(c: Cabinet, s: ShopSettings, side: 'left' | 'right', exposed: boolean): PanelMode {
  s = eff(c, s);
  if (!exposed || c.corner || c.kind === 'mantel') return 'none';
  const choice = (side === 'left' ? c.leftPanel : c.rightPanel) ?? 'default';
  return choice === 'default' ? s.endPanel : choice;
}

/** How far end panels stick out past the face frame on each side (they sit on the case side, just inside the frame edge). */
export function panelExtents(c: Cabinet, s: ShopSettings, ends: EndInfo) {
  if (c.kind === 'pilaster' || c.kind === 'shelf' || c.kind === 'mantel') return { left: 0, right: 0 };
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
  if (c.kind === 'pilaster') return [...pilasterParts(c, s, ends), ...crownParts(c, s, ends)];
  if (c.kind === 'shelf') return floatingShelfParts(c, s, ends);
  if (c.kind === 'mantel') return mantelParts(c, s);
  const parts: Part[] = [];
  const { width: W, height: H, depth: D } = c;
  const tn = s.boxThickness;
  const ta = s.boxActualThickness;
  const dd = s.dadoDepth;
  const BL = baseLayout(c, s);
  const kick = BL.kick;
  const railTop = BL.railY + BL.railW;
  // A shaped face frame base cuts its feet into a bare exposed end as well
  const archSide = (exposed: boolean, panel: string) => BL.style === 'arch' && !BL.applied && exposed && panel === 'none';
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
  const sideShapes = (x: number): CutShape[] => [cutShape('z', [x, 0, 0], boxD, BL.top, ta, BL.b.foot, boxD - Math.max(0.75, BL.b.foot - s.ffThickness), BL.b.shape, BL.rise)];
  const sideBoxes = (x: number, arch = false): VisualBox[] => {
    if (arch) return [vb(x, BL.top, 0, ta, H - BL.top, boxD)];
    return kick > 0
      ? [vb(x, kick, 0, ta, H - kick, boxD), vb(x, 0, 0, ta, kick, boxD - notch)]
      : [vb(x, 0, 0, ta, H, boxD)];
  };
  ([['Left', xi0 - ta, ends.left, pL], ['Right', xi1, ends.right, pR]] as const).forEach(([, x, exposed, panel]) => {
    const notes = [];
    const arch = archSide(exposed, panel);
    if (arch) notes.push(`Cut ${archShapes[BL.b.shape].toLowerCase()} to match the face frame, ${fmtShort(BL.rise)} high`);
    else if (kick > 0) notes.push(`Toe notch ${fmtShort(kick)} × ${fmtShort(notch)}`);
    const bare = exposed && panel === 'none';
    notes.push(bare ? 'Exposed end: pocket screw from inside' : exposed ? 'Under end panel: glue & staple' : 'Hidden: glue & staple');
    parts.push({
      name: bare ? 'Side, exposed' : 'Side', role: 'side', material: 'box', length: H, width: boxD, thickness: tn, cut: true,
      note: notes.join(' · '),
      boxes: sideBoxes(x, arch), shapes: arch ? sideShapes(x) : undefined,
    });
  });

  // Bottom: in dados, a hair below the top of the bottom rail, or flush with the bottom of the
  // face frame on wall cabinets hung high enough that the underside shows.
  const flush = c.kind === 'wall' && !!c.bottomFlush;
  const noBottom = c.kind !== 'base' && !!c.noBottom;
  const botTop = flush ? ta : railTop - s.bottomReveal;
  if (!noBottom) parts.push({
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
  // With no bottom the back runs down to the countertop with the sides
  const backBottom = noBottom ? 0 : botTop - ta;
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
      if (!exposed || BL.style !== 'kick') continue;
      const len = D - s.toeKickDepth - s.toeKickSkin;
      parts.push({
        name: 'Toe kick return', role: 'toekick', material: 'toeSkin', length: len, width: kick, thickness: s.toeKickSkin, cut: true,
        note: 'Applied at install on the exposed end',
        boxes: [vb(x, 0, 0, s.toeKickSkin, kick, len)],
      });
    }
  }

  // Face frame: glued and pocket screwed
  const ffH = H - BL.stileY;
  const zF = boxD;
  const ft = s.ffThickness;
  const sw = s.stileWidth;
  const swL = c.stileLeftWidth ?? sw, swR = c.stileRightWidth ?? sw;
  const railLen = FW - swL - swR;
  // Door openings. On a blind corner they start past the dead area and a wide blind stile.
  const blind = c.blind;
  const bs = sw + (blind?.clearance ?? s.blindClearance); // the blind stile: a face frame stile plus clearance
  const blindOpen = blind ? blind.dead + bs : 0;
  let ox0 = sL + swL;
  let ox1 = W - sR - swR;
  if (blind?.side === 'left') ox0 = Math.max(ox0, blindOpen);
  if (blind?.side === 'right') ox1 = Math.min(ox1, W - blindOpen);
  const cx = (ox0 + ox1) / 2;
  for (const [x, extra, w] of [[0, sL, swL], [W - swR - sR, sR, swR]]) {
    const scribed = extra > 0;
    parts.push({
      name: scribed ? 'Stile, extended' : 'Stile', role: 'stile', material: 'faceframe', length: ffH,
      width: w + extra + (scribed ? s.scribeAllowance : 0), thickness: ft, cut: true,
      note: scribed ? `${fmtShort(w)} + ${fmtShort(extra)} extension + ${fmtShort(s.scribeAllowance)} to scribe on site` : w !== sw ? `${fmtShort(w)} stile for this cabinet` : undefined,
      boxes: [vb(x, BL.stileY, zF, w + extra, ffH, ft)],
    });
  }
  parts.push({
    name: 'Top rail', role: 'rail', material: 'faceframe', length: railLen, width: s.topRailWidth, thickness: ft, cut: true,
    boxes: [vb(sL + swL, H - s.topRailWidth, zF, railLen, s.topRailWidth, ft)],
  });
  {
    // On a shaped base the stiles are the feet and the cutout comes out of a wide bottom rail
    const shaped = BL.style === 'arch' && !BL.applied;
    const x0 = sL + swL;
    const a = Math.max(0, BL.b.foot - x0), b = Math.min(railLen, W - BL.b.foot - x0);
    if (BL.railW > 0) parts.push({
      name: 'Bottom rail', role: 'rail', material: 'faceframe', length: railLen, width: BL.railW, thickness: ft, cut: true,
      note: shaped ? `Cut ${archShapes[BL.b.shape].toLowerCase()}, ${fmtShort(BL.rise)} high, feet ${fmtShort(BL.b.foot)} from the ends`
        : BL.applied ? `${fmtShort(s.bottomRailWidth)} shows above the ${BL.style === 'baseboard' ? 'baseboard' : 'skirt'}` : undefined,
      boxes: shaped ? [] : [vb(x0, BL.railY, zF, railLen, BL.railW, ft)],
      shapes: shaped ? [cutShape('x', [x0, BL.railY, zF], railLen, BL.railW, ft, a, b, BL.b.shape, BL.rise)] : undefined,
    });
  }
  if (BL.applied) {
    // Baseboard or skirt applied to the face frame, mitered around exposed ends and back to the wall
    const ext = panelExtents(c, s, ends);
    const xL = ends.left ? -ext.left - boardT : 0;
    const xR = W + (ends.right ? ext.right + boardT : 0);
    const h = BL.flat;
    const arch = BL.style === 'arch';
    const name = arch ? 'Skirt' : 'Baseboard';
    const len = xR - xL;
    // Plain baseboard is a box; a skirt carries its cutout
    const piece = (along: 'x' | 'z', min: [number, number, number], n: number, a: number, b: number) => arch
      ? { boxes: [], shapes: [cutShape(along, min, n, h, boardT, a, b, BL.b.shape, BL.rise)] }
      : { boxes: [along === 'x' ? vb(min[0], 0, min[2], n, h, boardT) : vb(min[0], 0, min[2], boardT, h, n)] };
    const note = arch ? `Cut ${archShapes[BL.b.shape].toLowerCase()}, ${fmtShort(BL.rise)} high` : undefined;
    // A custom cap (milled to match the room's) runs on top of the baseboard, front and returns
    const capH = !arch && !c.baseMold ? Math.max(0, BL.b.cap ?? 0) : 0;
    if (capH > 0) {
      parts.push({ name: 'Base cap, front', role: 'trim', material: 'faceframe', length: len, width: capH, thickness: boardT, cut: true, note: 'Custom, milled to match the room’s',
        boxes: [vb(xL, h, D, len, capH, boardT)] });
      for (const side of ['left', 'right'] as const) {
        if (!ends[side]) continue;
        parts.push({ name: `Base cap, ${side} return`, role: 'trim', material: 'faceframe', length: D, width: capH, thickness: boardT, cut: true,
          boxes: [vb(side === 'left' ? xL : xR - boardT, h, 0, boardT, capH, D)] });
      }
    }
    if (h > 0) {
      parts.push({
        name: `${name}, front`, role: 'trim', material: 'faceframe', length: len, width: h, thickness: boardT, cut: true, note,
        ...piece('x', [xL, 0, D], len, BL.b.foot, len - BL.b.foot),
      });
      for (const side of ['left', 'right'] as const) {
        if (!ends[side]) continue;
        const x = side === 'left' ? xL : xR - boardT;
        parts.push({
          name: `${name}, ${side} return`, role: 'trim', material: 'faceframe', length: D, width: h, thickness: boardT, cut: true, note,
          ...piece('z', [x, 0, 0], D, BL.b.foot, D - Math.max(0.75, BL.b.foot - boardT)),
        });
      }
    }
  }

  const { rows } = layoutRows(c, s);
  rows.forEach((r, i) => {
    if (i > 0) {
      const mw = railAbove(c, s, i);
      parts.push({
        name: 'Mid rail', role: 'rail', material: 'faceframe', length: ox1 - ox0, width: mw, thickness: ft, cut: true,
        note: c.rows[i].railAbove != null ? `${fmtShort(mw)} rail for this cabinet` : undefined,
        boxes: [vb(ox0, r.y1, zF, ox1 - ox0, mw, ft)],
      });
      // A one-piece case changes from closed to open here: a fixed shelf divides it, and a ledge
      // (when there is one) sits on the rail and runs across the front
      const lg = ledgeAbove(c, i);
      const openAbove = c.rows[i - 1].type === 'open' && c.rows[i].type !== 'open';
      if (lg || openAbove) {
        const topY = r.y1 + mw + (lg?.thickness ?? 0);
        const lap = lg ? 0.75 : 0;
        parts.push({ name: 'Fixed shelf', role: 'shelf', material: 'box', length: innerW + 2 * dd, width: boxD - rw - lap, thickness: tn, cut: true,
          note: lg ? 'Dadoed in, top flush with the top of the ledge' : 'Dadoed in, top flush with the top of the rail; divides the doors from the open shelves above',
          boxes: [vb(xi0, topY - ta, rw, innerW, ta, boxD - rw - lap)] });
        if (lg) {
          const deep = ft + lg.overhang + lap;
          parts.push({ name: 'Ledge', role: 'trim', material: 'faceframe', length: W, width: deep, thickness: lg.thickness, cut: true,
            note: `Solid, on the ${fmtShort(mw)} rail, ${fmtShort(lg.overhang)} proud of the face frame; laps ${fmtShort(lap)} onto the case and fixed shelf. Ease the front edge.`,
            boxes: [vb(0, r.y1 + mw, boxD - lap, W, lg.thickness, deep)] });
        }
      }
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
    const openH = H - railTop - s.topRailWidth;
    const bx = blind.side === 'left' ? ox0 - bs : ox1;
    parts.push({
      name: 'Blind stile', role: 'stile', material: 'faceframe', length: openH, width: bs, thickness: ft, cut: true,
      note: `${fmtShort(sw)} + ${fmtShort(bs - sw)} clearance; starts ${fmtShort(blind.dead)} from the ${blind.side} end`,
      boxes: [vb(bx, railTop, zF, bs, openH, ft)],
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
    // A rail with a ledge on it, or open shelves on its other side, belongs to this front alone
    const ownsAbove = i === 0 || !!ledgeAbove(c, i) || c.rows[i - 1].type === 'open';
    const ownsBelow = i === rows.length - 1 || c.rows[i + 1].type === 'open';
    const top = inset ? -rev : ownsAbove ? (i === 0 ? o : Math.min(o, railAbove(c, s, i) - 0.25)) : shareOv(railAbove(c, s, i));
    const bottom = inset ? -rev : ownsBelow ? (i === rows.length - 1 ? o : Math.min(o, railAbove(c, s, i + 1) - 0.25)) : shareOv(railAbove(c, s, i + 1));
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
    // An appliance sits on a fixed shelf, top flush with the rail below its opening (the case bottom does it in the bottom row)
    if (row.type === 'appliance' && r.y0 - botTop > 0.5) {
      parts.push({ name: 'Fixed shelf', role: 'shelf', material: 'box', length: innerW + 2 * dd, width: boxD - rw, thickness: tn, cut: true,
        note: 'Dadoed in, top flush with the rail below the appliance opening; carries the appliance',
        boxes: [vb(xi0, r.y0 - ta, rw, innerW, ta, boxD - rw)] });
    }
    if ((row.type === 'doors' || row.type === 'open') && row.shelves > 0) {
      const shelfW = innerW - s.shelfClearance;
      const sf = c.shelfFront && c.shelfFront.thickness > 0 && c.shelfFront.height > 0 ? c.shelfFront : null;
      const fullD = boxD - rw - s.shelfSetback;
      const shelfD = fullD - (sf?.thickness ?? 0);
      const lo = Math.max(r.y0, botTop);
      const hi = Math.min(r.y1, topUnder);
      for (let k = 1; k <= row.shelves; k++) {
        const y = lo + ((hi - lo) * k) / (row.shelves + 1) - ta / 2;
        parts.push({ name: 'Adjustable shelf', role: 'shelf', material: 'box', length: shelfW, width: shelfD, thickness: tn, cut: true,
          note: sf ? 'Solid front applied, no banding' : undefined, banded: !sf,
          boxes: [vb(xi0 + s.shelfClearance / 2, y, rw, shelfW, ta, shelfD)] });
        if (sf) parts.push({ name: 'Shelf front', role: 'trim', material: 'faceframe', length: shelfW, width: sf.height, thickness: sf.thickness, cut: true,
          note: 'Glued and nailed to the shelf edge, top flush',
          boxes: [vb(xi0 + s.shelfClearance / 2, y + ta - sf.height, rw + shelfD, shelfW, sf.height, sf.thickness)] });
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
    // A baseboard or skirt wraps over the panel down to the floor; a shaped base has its own end skirt under the panel
    const shapedEnd = BL.style === 'arch' && !BL.applied;
    const [py0, py1] = BL.applied ? [0, mode === 'inset' ? H : doorTop] : shapedEnd ? [BL.top, mode === 'inset' ? H : doorTop] : mode === 'inset' ? [kick, H] : [doorBottom, doorTop];
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
    if (shapedEnd) {
      const x = side === 'left' ? xi0 - ta - pt : xi1 + ta;
      parts.push({
        name: `End skirt, ${side}`, role: 'trim', material: 'faceframe', length: depth, width: BL.top, thickness: pt, cut: true,
        note: `Under the end panel; cut ${archShapes[BL.b.shape].toLowerCase()} to match the face frame`,
        boxes: [], shapes: [cutShape('z', [x, 0, 0], depth, BL.top, pt, BL.b.foot, depth - BL.b.foot, BL.b.shape, BL.rise)],
      });
    }
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
