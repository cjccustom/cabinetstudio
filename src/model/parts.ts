import type { CrownBuild, Cabinet, FaceRow, FrameJoinery, Part, PanelMode, ShopSettings, VisualBox } from './types';
import { mantelParts } from './mantel';
import { drawerBoxSize, narrowRail, narrowRailBelow, styleById, type DoorProfile, panelByCode } from './eagle';
import { buildCornerParts } from './corner';
import { pilasterOf, pilasterParts } from './pilaster';
import { floatingShelfParts } from './floatingShelf';
import { fmt as fmtShort, fmt } from '../units';
import { isRouted, topSection } from './edgeProfiles';
import { baseLayout, boardT, cutShape, archShapes, fridgeBelow } from './cabinetBase';
import { mountShape, profileByNum } from './moldings';
import type { CutShape } from './types';
import { defaultHafele, type HafeleSpec } from './cabinetLighting';
import { cutToSlope } from './slopeCut';

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
/** Blum Compact hinges are overlay only, so inset doors always hang on Clip Top. */
const insetHinges = (s: ShopSettings): ShopSettings => (s.doorMount === 'inset' && s.hingeType === 'compact' ? { ...s, hingeType: 'cliptop' } : s);
export const eff = (c: Cabinet, s: ShopSettings): ShopSettings => frameless(insetHinges(c.overrides ? { ...s, ...c.overrides } : s));

/**
 * Frameless cases, worked as a face frame of nothing: the case edges stand where the stiles and
 * rails would, a fixed shelf takes each mid rail's place, and the fronts overlay the case edges
 * full, leaving the door gap between neighbours.
 */
function frameless(s: ShopSettings): ShopSettings {
  if (s.construction !== 'frameless') return s;
  const ta = s.boxActualThickness;
  return {
    ...s, ffThickness: 0, ffOverhang: 0, stileWidth: ta, topRailWidth: ta, bottomRailWidth: ta, midRailWidth: ta,
    bottomReveal: 0, doorMount: 'overlay', doorOverlay: ta - s.doorGap / 2,
  };
}
export const isFrameless = (c: Cabinet, s: ShopSettings) => eff(c, s).construction === 'frameless';

/** How a case side is fastened, from the cabinet's joinery. */
export function sideFastening(c: Cabinet, bare: boolean, exposed: boolean): string {
  switch (c.build?.joinery ?? 'standard') {
    case 'pocket': return bare ? 'Pocket screw from inside' : 'Glue & pocket screw from inside';
    case 'staples': return bare ? 'Glue & staple (fill and finish the exposed end)' : 'Glue & staple';
    case 'confirmat': return bare ? 'Confirmat screws, plugged or capped on the exposed end' : 'Confirmat screws';
    default: return bare ? 'Exposed end: pocket screw from inside' : exposed ? 'Under end panel: glue & staple' : 'Hidden: glue & staple';
  }
}

/** An opening split into equal bays by n mid stiles (or divider edges) of width w: the stiles' centers. */
export function bayEdges(x0: number, x1: number, n: number, w: number): { bay: number; stiles: number[] } {
  const bay = (x1 - x0 - n * w) / (n + 1);
  return { bay, stiles: Array.from({ length: n }, (_, k) => x0 + (k + 1) * bay + k * w + w / 2) };
}

/** Open to the room: open shelves, or hanging space. */
export const isOpenRow = (t: FaceRow['type'], covered?: boolean) => t === 'open' || ((t === 'hang' || t === 'shoes') && !covered);
/** Rows behind doors: door rows, and hanging or shoe space closed in for a wardrobe. */
export const hasDoors = (r: FaceRow) => r.type === 'doors' || (!!r.covered && (r.type === 'hang' || r.type === 'shoes'));
/** Shoe shelves: tipped about 15° to the front, a fence on the front edge to stop the heels. */
export const shoeShelf = { fence: 1.5, lip: 0.75, slope: 0.27, maxDrop: 4 };
/** Closet rods: hangers centered 12" off the wall whatever the case depth (a shallow case lets the clothes stand past the face frame). */
export const closetRod = { diameter: 1.3125, drop: 1.75, fromWall: 12 };

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

/**
 * Each face frame row's opening, as Chief's cabinet dialog shows them: the clear width and height
 * inside the frame (each side of a center stile, or each cubby between dividers), and the doors
 * or fronts that cover it.
 */
export function rowOpenings(c: Cabinet, s0: ShopSettings, parts?: Part[]): { rowId: string; w: number; h: number; n: number; fronts: { kind: string; w: number; h: number; n: number }[] }[] {
  const s = eff(c, s0);
  const { rows } = layoutRows(c, s0);
  const sw = s.stileWidth;
  const swL = c.stileLeftWidth ?? sw, swR = c.stileRightWidth ?? sw;
  let ox0 = (c.scribeLeft ?? 0) + swL, ox1 = c.width - (c.scribeRight ?? 0) - swR;
  if (c.blind) {
    const open = c.blind.dead + sw + (c.blind.clearance ?? s.blindClearance);
    if (c.blind.side === 'left') ox0 = Math.max(ox0, open); else ox1 = Math.min(ox1, c.width - open);
  }
  const fl = s.construction === 'frameless';
  return c.rows.map((r, i) => {
    const L = rows[i];
    let w = ox1 - ox0, n = 1;
    if (hasDoors(r) && r.doors === 2 && c.centerStile) { n = 2; w = (w - sw) / 2; }
    else if (r.type === 'open' && (r.dividers ?? 0) > 0) { n = r.dividers! + 1; w = bayEdges(ox0, ox1, r.dividers!, fl ? s.boxActualThickness : sw).bay; }
    const fronts = new Map<string, { kind: string; w: number; h: number; n: number }>();
    for (const p of parts ?? []) {
      if (!p.order || (p.role !== 'door' && p.role !== 'drawerFront')) continue;
      const b = p.boxes[0];
      if (!b) continue;
      const mid = b.min[1] + b.size[1] / 2;
      if (mid < L.y0 - 0.01 || mid > L.y1 + 0.01) continue;
      const kind = p.role === 'door' ? 'Door' : 'Drawer front';
      const key = `${kind}|${p.order.w}|${p.order.h}`;
      const f = fronts.get(key);
      if (f) f.n++; else fronts.set(key, { kind, w: p.order.w, h: p.order.h, n: 1 });
    }
    return { rowId: r.id, w, h: L.height, n, fronts: [...fronts.values()] };
  });
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
/** Eagle's limit: 5-piece doors and panels over 50" tall get a center rail (over 50" wide, a center stile) for their warranty. */
export const EAGLE_CENTER_OVER = 50;
export interface CenterSplit { rail?: boolean; stile?: boolean }
/** Whether a 5-piece front this size gets Eagle's center rail or stile (unless the cabinet says to leave it off). */
export const centerSplit = (w: number, h: number, profile: DoorProfile, off?: boolean): CenterSplit =>
  off || profile === 'slab' ? {} : { ...(h > EAGLE_CENTER_OVER ? { rail: true } : {}), ...(w > EAGLE_CENTER_OVER ? { stile: true } : {}) };

const centerText = (cs: CenterSplit) => (cs.rail && cs.stile ? ', center rail and stile' : cs.rail ? ', center rail' : cs.stile ? ', center stile' : '');
const centerOrder = (cs: CenterSplit) => ({ ...(cs.rail ? { centerRail: true } : {}), ...(cs.stile ? { centerStile: true } : {}) });
/** What to watch on a big front: Eagle's warranty limits. */
function centerNote(cs: CenterSplit, w: number, h: number, profile: DoorProfile, off?: boolean): string {
  const big = Math.max(w, h);
  if (big > 95) return 'Over 95": larger than Eagle makes';
  if (big > 84) return 'Over 84": not warranted by Eagle';
  if (profile === 'slab' && big > 44) return 'One-piece slab over 44": not warranted by Eagle';
  if (off && profile !== 'slab' && big > EAGLE_CENTER_OVER) return 'Over 50" without a center rail: not warranted by Eagle';
  return cs.rail || cs.stile ? `Eagle center ${cs.rail && cs.stile ? 'rail and stile' : cs.rail ? 'rail' : 'stile'} (over 50")` : '';
}

export function frontBoxes(x: number, y: number, z: number, w: number, h: number, t: number, profile: DoorProfile, stile: number, raised: boolean, flatFront = false, split: CenterSplit = {}): VisualBox[] {
  if (profile === 'slab') return [vb(x, y, z, w, h, t)];
  const f = Math.min(stile, h * 0.3, w * 0.3);
  const ix = x + f, iy = y + f, iw = w - 2 * f, ih = h - 2 * f;
  const out: VisualBox[] = [
    vb(x, y, z, f, h, t),
    vb(x + w - f, y, z, f, h, t),
    vb(ix, y + h - f, z, iw, f, t),
    vb(ix, y, z, iw, f, t),
  ];
  // A center rail and/or stile, the panel split around them
  let panels: [number, number, number, number][] = [[ix, iy, iw, ih]];
  if (split.stile && iw > 3 * f) {
    const sx = x + w / 2 - f / 2;
    out.push(vb(sx, iy, z, f, ih, t));
    panels = panels.flatMap(([px, py, pw, ph]) => [[px, py, sx - px, ph], [sx + f, py, px + pw - sx - f, ph]] as [number, number, number, number][]);
  }
  if (split.rail && ih > 3 * f) {
    const ry = y + h / 2 - f / 2;
    for (const [px, , pw] of [...new Map(panels.map((q) => [q[0], q])).values()]) out.push(vb(px, ry, z, pw, f, t));
    panels = panels.flatMap(([px, py, pw, ph]) => [[px, py, pw, ry - py], [px, ry + f, pw, py + ph - ry - f]] as [number, number, number, number][]);
  }
  const inner: VisualBox[] = [];
  for (const [qx, qy, qw, qh] of panels) {
    let px = qx, py = qy, pw = qw, ph = qh;
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
  }
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
  /** Casework: a pilaster beside it standing proud with its base wrapped (the wrap's thickness), so this cabinet's base cap meets the pilaster's cap return at an inside miter. */
  wrapBeside?: (side: 'left' | 'right') => number | null;
  /** Pilasters: the base moulding on the casework beside it (its profile, and how far out its back sits), so the pilaster's carries on from it. */
  baseBeside?: (side: 'left' | 'right') => { num?: string; z: number; board: number } | null;
  /**
   * Countertops on cabinets that touch along a wall are one piece: the first cabinet carries it
   * across the run (lead), the others have none (joined). last: the run's right-hand cabinet and
   * whether its right end is exposed, for the top's right overhang and edging.
   */
  /**
   * A room's inside corner at this end: the cabinet on the next wall that turns the corner with it,
   * and where that wall is in this cabinet's own x (so crown can meet it at an inside miter).
   */
  corner?: (side: 'left' | 'right') => { other: Cabinet; wallX: number } | null;
  /** The cabinet touching this end on the same wall, if any (a run's mouldings carry on into it). */
  beside?: (side: 'left' | 'right') => Cabinet | null;
  topRun?: { lead: boolean; span: number; last: Cabinet; lastRight: boolean; /** Open spaces the top crosses. */ gaps?: { at: number; width: number }[] };
  /** Sub-crowns on touching cabinets at the same height are one piece: the first cabinet carries it across the run. */
  subRun?: { lead: boolean; span: number; last: Cabinet; lastRight: boolean };
}

/**
 * An end panel split to match the front: one piece per face frame row, spanning its doors or
 * fronts (or, for an open row, its opening plus the door overlay), clipped to the panel's height.
 */
function endPanelPieces(rows: { y0: number; y1: number }[], parts: Part[], py0: number, py1: number, s: ShopSettings): [number, number][] {
  const ov = s.doorMount === 'inset' ? 0 : s.doorOverlay;
  const fronts = parts.filter((p) => p.role === 'door' || p.role === 'drawerFront').flatMap((p) => p.boxes);
  const spans = rows.map((r) => {
    const mine = fronts.filter((b) => { const m = b.min[1] + b.size[1] / 2; return m > r.y0 && m < r.y1; });
    return mine.length ? [Math.min(...mine.map((b) => b.min[1])), Math.max(...mine.map((b) => b.min[1] + b.size[1]))] as [number, number] : [r.y0 - ov, r.y1 + ov] as [number, number];
  }).sort((a, b) => a[0] - b[0]);
  const out = spans.map(([a, b], i) => [i === 0 ? py0 : Math.max(py0, a), i === spans.length - 1 ? py1 : Math.min(py1, b)] as [number, number]).filter(([a, b]) => b - a > 2);
  return out.length ? out : [[py0, py1]];
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
  let parts = caseParts(c, s, ends);
  if (c.build?.interior && c.build.interior !== 'prefinished') parts = paintOpenInterior(c, { ...eff(c, s), exposedPlywood: eff(c, s).exposedPlywood || (c.overrides?.plywood ? s.plywood : undefined) }, parts);
  // A cabinet in its own species (a stain-grade island on a painted job): its frame and solid wood
  // come off that species' stock, priced and listed apart from the job's
  const own = c.overrides?.woodSpecies;
  // The seam batten where it meets the next case on the right
  if (c.seamCover && !ends.right && c.kind !== 'mantel' && c.kind !== 'shelf') {
    const sc = c.seamCover, bl = baseLayout(c, eff(c, s)), L = crownLayout(c, s);
    const y0 = bl.style === 'kick' ? bl.kick : bl.top;
    const y1 = L.subT > 0 ? L.subBottom : c.height;
    if (y1 - y0 > 1) parts.push({ name: 'Seam batten', role: 'trim', material: 'faceframe', length: y1 - y0, width: sc.width, thickness: sc.thickness, cut: true,
      note: `Centered on the joint with the next case; ${bl.style === 'kick' ? 'from the toe kick' : 'on the base cap'} up ${L.subT > 0 ? 'into the sub-crown' : 'to the case top'}. Glue to this case only, so the joint can move`,
      boxes: [vb(c.width - sc.width / 2, y0, c.depth, sc.width, y1 - y0, sc.thickness)] });
  }
  if (own && own !== s.woodSpecies) parts = parts.map((p) => ((p.material === 'faceframe' || p.material === 'solidWood') && !p.species ? { ...p, species: own } : p));
  return cutToSlope(c, frameJoinery(c, eff(c, s), parts));
}

/** Frame joinery: the tongue length on each rail end for tongue and groove, and how each joint goes together. */
export const TENON = 0.375;
export const joineryLabel: Record<FrameJoinery, string> = {
  pocket: 'Pocket screws', stubTenon: 'Tongue & groove (stub tenon)', domino: 'Festool Domino', lamello: 'Lamello', biscuit: 'Biscuits',
};
const joineryNote = (j: FrameJoinery, w: number) => ({
  pocket: 'Glued, pocket screwed from the back',
  stubTenon: `Glued; ${fmtShort(TENON)} tongue each end into a ${fmtShort(TENON)} deep groove in the stile`,
  domino: `Glued; Domino ${w >= 2.5 ? '2 × ' : ''}5 × 30 each end`,
  lamello: w >= 2 ? 'Glued; Lamello Clamex P-10 each end' : 'Glued; Lamello #0 biscuit each end',
  biscuit: w >= 2.25 ? 'Glued; #10 biscuit each end' : 'Glued; #0 biscuit each end',
}[j]);

function frameJoinery(c: Cabinet, s: ShopSettings, parts: Part[]): Part[] {
  const j: FrameJoinery = (c.kind === 'pilaster' ? c.pilaster?.joinery : undefined) ?? s.ffJoinery ?? 'pocket';
  return parts.map((p) => {
    if (p.material !== 'faceframe' || !p.cut) return p;
    const isRail = p.role === 'rail' || p.name === 'Pilaster rail' || /rail$/i.test(p.name) && p.role !== 'trim';
    if (isRail) return { ...p, length: p.length + (j === 'stubTenon' ? 2 * TENON : 0), note: [p.note, joineryNote(j, p.width)].filter(Boolean).join(' · ') };
    if (p.role === 'stile' && j === 'stubTenon') return { ...p, note: [p.note, `Grooved ${fmtShort(TENON)} deep for the rail tongues`].filter(Boolean).join(' · ') };
    return p;
  });
}

/** Where the open sections are, top to bottom, in the cabinet's own coordinates. */
export function openSpans(c: Cabinet, s: ShopSettings): { y0: number; y1: number }[] {
  const { rows } = layoutRows(c, s);
  return rows.filter((_, i) => c.rows[i] && isOpenRow(c.rows[i].type, c.rows[i].covered)).map((r) => ({ y0: r.y0, y1: r.y1 }));
}

/**
 * Open sections painted with the millwork: the case stays prefinished plywood, and whatever shows
 * in an open section (sides, back, top, bottom, shelves) is scuffed, primed with a bonding primer
 * and painted to match.
 */
function paintOpenInterior(c: Cabinet, s: ShopSettings, parts: Part[]): Part[] {
  const spans = openSpans(c, s);
  if (!spans.length) return parts;
  const roles = new Set(['side', 'back', 'top', 'bottom', 'shelf', 'stretcher', 'nailer', 'divider']);
  const shows = (p: Part) => (p.material === 'box' || p.material === 'back') && roles.has(p.role)
    && p.boxes.some((b) => spans.some((o) => b.min[1] < o.y1 + 1 && b.min[1] + b.size[1] > o.y0 - 1));
  const mode = c.build?.interior;
  if (mode === 'stain' || mode === 'clear') {
    // Stain grade: what shows in an open section is cut from the exposed (veneer) plywood and finished with the millwork
    const ply = s.exposedPlywood || s.plywood;
    const note = `Open section: ${ply ? `${ply.toLowerCase()} plywood, ` : ''}${mode === 'stain' ? 'stain and clear coat' : 'clear coat only'} with the millwork`;
    return parts.map((p) => (shows(p) ? { ...p, look: 'wood' as const, ...(s.exposedPlywood ? { sheet: /^mdf$/i.test(s.exposedPlywood) ? `${fmt(p.thickness)} MDF` : `${fmt(p.thickness)} ${s.exposedPlywood.toLowerCase()} plywood` } : {}), note: p.note ? `${p.note} · ${note}` : note } : p));
  }
  const note = 'Open section: scuff, bonding primer, paint to match the millwork';
  return parts.map((p) => (shows(p) ? { ...p, look: 'paint' as const, note: p.note ? `${p.note} · ${note}` : note } : p));
}

function caseParts(c: Cabinet, s: ShopSettings, ends: EndInfo): Part[] {
  if (c.island && c.islandSides === 2) return twoSidedIsland(c, s, ends);
  s = eff(c, s);
  if (c.corner) return buildCornerParts(c, s);
  const HF: HafeleSpec = { ...defaultHafele, ...s.hafele };
  const hfSpans = c.lighting?.includes('shelves') ? openSpans(c, s) : [];
  const hafeleSideNote = (spans: { y0: number; y1: number }[], both: boolean) => `Häfele bus bar channel ${fmtShort(HF.railW)} wide × ${fmtShort(HF.railD)} deep${both ? ' each face (bars back to back)' : ' on the inside face'}, ${fmtShort(HF.railBack)} from the front edge, lined up with the shelf bar grooves, ${spans.map((o) => `${fmtShort(o.y0)} to ${fmtShort(o.y1)}`).join(' and ')} up from the bottom of the cabinet (Häfele bit 001.25.921); room for the power supply kit's contact at the top or bottom`;
  if (c.kind === 'pilaster') return [...pilasterParts(c, s, ends), ...crownParts(c, s, ends)];
  if (c.kind === 'shelf') return floatingShelfParts(c, s, ends);
  if (c.kind === 'mantel') return mantelParts(c, s);
  const parts: Part[] = [];
  const fl = s.construction === 'frameless';
  const { width: W, height: H, depth: D } = c;
  const tn = s.boxThickness;
  const ta = s.boxActualThickness;
  const dd = s.dadoDepth;
  const BL = baseLayout(c, s);
  const fridge = fridgeBelow(c);
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
  // A separate toe kick base: the case has no toe notch and sits on a ladder built and leveled once for the run
  const sep = BL.style === 'kick' && kick > 0 && !!BL.b.separate && !fridge;

  // Sides
  const sideShapes = (x: number): CutShape[] => [cutShape('z', [x, 0, 0], boxD, BL.top, ta, BL.b.foot, boxD - Math.max(0.75, BL.b.foot - s.ffThickness), BL.b.shape, BL.rise)];
  const sideBoxes = (x: number, arch = false): VisualBox[] => {
    if (arch) return [vb(x, BL.top, 0, ta, H - BL.top, boxD)];
    if (sep) return [vb(x, kick, 0, ta, H - kick, boxD)];
    if (kick > 0 && c.island) return [vb(x, kick, 0, ta, H - kick, boxD), vb(x, 0, notch, ta, kick, boxD - 2 * notch)];
    return kick > 0
      ? [vb(x, kick, 0, ta, H - kick, boxD), vb(x, 0, 0, ta, kick, boxD - notch)]
      : [vb(x, BL.lift, 0, ta, H - BL.lift, boxD)];
  };
  ([['Left', xi0 - ta, ends.left, pL], ['Right', xi1, ends.right, pR]] as const).forEach(([, x, exposed, panel]) => {
    const notes = [];
    const arch = archSide(exposed, panel);
    if (arch) notes.push(`Cut ${archShapes[BL.b.shape].toLowerCase()} to match the face frame, ${fmtShort(BL.rise)} high`);
    else if (sep) notes.push(`No toe notch: sits on the ${fmtShort(kick)} toe kick base`);
    else if (kick > 0) notes.push(`Toe notch ${fmtShort(kick)} × ${fmtShort(notch)}${c.island ? ', front and back' : ''}`);
    const bare = exposed && panel === 'none';
    notes.push(sideFastening(c, bare, exposed));
    if (fridge) notes.push('Runs to the floor as the fridge panel');
    if (BL.platform > 0) notes.push(`Sits on the ${fmtShort(BL.platform)} leveled platform`);
    else if (BL.lift > 0) notes.push(`Stands ${fmtShort(BL.lift)} off the floor behind the baseboard, room to level`);
    if (bare) notes.push('Finished outside: paint (or stain) with the face frame');
    if (fl) notes.push('Band the front edge');
    if (hfSpans.length) notes.push(hafeleSideNote(hfSpans, false));
    parts.push({
      name: bare ? 'Side, exposed' : 'Side', role: 'side', material: 'box', length: H - BL.lift - (sep ? kick : 0), width: boxD, thickness: tn, cut: true, banded: fl || undefined,
      // A bare exposed side gets the finish (painted, or stained to match), not left as case plywood
      ...(bare ? { look: 'paint' as const } : {}),
      note: notes.join(' · '),
      boxes: sideBoxes(x, arch), shapes: arch ? sideShapes(x) : undefined,
    });
  });

  // Bottom: in dados, a hair below the top of the bottom rail, or flush with the bottom of the
  // face frame on wall cabinets hung high enough that the underside shows.
  const flush = c.kind === 'wall' && !!c.bottomFlush;
  const noBottom = (c.kind !== 'base' && !!c.noBottom) || fridge;
  const botTop = flush ? ta : railTop - s.bottomReveal;
  if (!noBottom) parts.push({
    name: 'Bottom', role: 'bottom', material: 'box', length: cutW, width: boxD - rw, thickness: tn, cut: true, banded: fl || undefined,
    note: fl ? `In ${dados} dados, front edge banded` : flush ? `In ${dados} dados, flush with bottom of face frame` : `In ${dados} dados`,
    boxes: [vb(xi0, botTop - ta, rw, innerW, ta, boxD - rw)],
  });

  // Top: stretchers in rabbets on base cabinets, a full panel in dados on wall and tall
  let topUnder = H;
  if (c.kind === 'base' && c.build?.top === 'solid') {
    // A solid top in place of the stretchers, so the inside looks finished from below the counter
    parts.push({
      name: 'Top', role: 'top', material: 'box', length: cutW, width: boxD - rw, thickness: tn, cut: true, banded: fl || undefined,
      note: `Solid top in ${dados} rabbets, in place of stretchers${fl ? ', front edge banded' : ''}`,
      boxes: [vb(xi0, H - ta, rw, innerW, ta, boxD - rw)],
    });
    topUnder = H - ta;
  } else if (c.kind === 'base') {
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
      name: 'Top', role: 'top', material: 'box', length: cutW, width: boxD - rw, thickness: tn, cut: true, banded: fl || undefined,
      note: fl ? `In ${dados} dados, front edge banded` : `In ${dados} dados`,
      boxes: [vb(xi0, topUnder, rw, innerW, ta, boxD - rw)],
    });
  }

  // Back, in a rabbet at the back of the sides
  // With no bottom the back runs down to the countertop with the sides
  // Over a fridge the back starts at the fixed shelf that closes the cabinet above it
  const fr = fridge && c.rows.length > 1 ? layoutRows(c, s).rows[c.rows.length - 1] : null;
  const backBottom = fr ? fr.y1 + gapAbove(c, s, c.rows.length - 1) - ta : noBottom ? 0 : botTop - ta;
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

  if (sep) {
    // A ladder of 3/4" ply rails, front and back, with cross pieces at each end and no more than 24" apart.
    // Its front stands back where the toe kick nailer would, so the skin lands at the usual depth.
    const front = D - kickBack - ta, back = s.backThickness > 0 ? 1 : 0, depthIn = front - back - ta;
    const n = Math.max(2, Math.ceil(W / 24) + 1);
    const railNote = 'Separate toe kick base: built as one ladder for the run (join rails over a cross piece), set and leveled before the cases go on (on carpet, cut the carpet back under it)';
    parts.push({ name: 'Toe kick base, front rail', role: 'nailer', material: 'box', length: W, width: kick, thickness: tn, cut: true, note: railNote, boxes: [vb(0, 0, front, W, kick, ta)] });
    parts.push({ name: 'Toe kick base, back rail', role: 'nailer', material: 'box', length: W, width: kick, thickness: tn, cut: true, note: railNote, boxes: [vb(0, 0, back, W, kick, ta)] });
    for (let i = 0; i < n; i++) parts.push({ name: 'Toe kick base, cross piece', role: 'nailer', material: 'box', length: depthIn, width: kick, thickness: tn, cut: true,
      note: `Between the rails, at each end and about every ${fmtShort(Math.round((W - ta) / (n - 1)))}; glued and screwed`,
      boxes: [vb(i === n - 1 ? W - ta : (i * (W - ta)) / (n - 1), 0, back + ta, ta, kick, depthIn)] });
    parts.push({
      name: 'Toe kick skin', role: 'toekick', material: 'toeSkin', length: W, width: kick, thickness: s.toeKickSkin, cut: true,
      note: 'Applied at install, continuous along the base',
      boxes: [vb(0, 0, D - s.toeKickDepth - s.toeKickSkin, W, kick, s.toeKickSkin)],
    });
  } else if (kick > 0) {
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
    if (c.island) {
      // An island's kick runs around the back too
      parts.push({ name: 'Toe kick nailer, back', role: 'nailer', material: 'box', length: innerW, width: kick, thickness: tn, cut: true, note: 'Scrap 3/4" ply',
        boxes: [vb(xi0, 0, kickBack, innerW, kick, ta)] });
      parts.push({ name: 'Toe kick skin, back', role: 'toekick', material: 'toeSkin', length: W, width: kick, thickness: s.toeKickSkin, cut: true, note: 'Applied at install',
        boxes: [vb(0, 0, s.toeKickDepth, W, kick, s.toeKickSkin)] });
    }
    // The skin wraps around exposed ends, tucked under the end panel
    for (const [exposed, x] of [[ends.left, xi0 - ta - s.toeKickSkin], [ends.right, xi1 + ta]] as const) {
      if (!exposed || BL.style !== 'kick') continue;
      const len = D - s.toeKickDepth - s.toeKickSkin - (c.island ? s.toeKickDepth + s.toeKickSkin : 0);
      parts.push({
        name: 'Toe kick return', role: 'toekick', material: 'toeSkin', length: len, width: kick, thickness: s.toeKickSkin, cut: true,
        note: 'Applied at install on the exposed end',
        boxes: [vb(x, 0, c.island ? s.toeKickDepth + s.toeKickSkin : 0, s.toeKickSkin, kick, len)],
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
        : BL.applied ? `${fmtShort(s.bottomRailWidth)} shows above the ${BL.style === 'baseboard' ? 'baseboard' : 'skirt'}${BL.lift > 0 ? `; runs down to ${fmtShort(BL.lift)} off the floor as the baseboard nailer` : ''}` : undefined,
      boxes: shaped ? [] : [vb(x0, BL.railY, zF, railLen, BL.railW, ft)],
      shapes: shaped ? [cutShape('x', [x0, BL.railY, zF], railLen, BL.railW, ft, a, b, BL.b.shape, BL.rise)] : undefined,
    });
  }
  if (BL.platform > 0) {
    // A leveled platform under the case: front and back runners and cross pieces every 16" or so, built and
    // leveled once for the run, the baseboard covering its front; the face frame stiles run past it to the floor
    const ph = BL.platform, pd = boxD - 0.75, xs0 = xi0 - ta, len = xi1 + ta - xs0;
    const runner = (z: number, where: string) => parts.push({ name: 'Platform runner', role: 'nailer', material: 'box', length: len, width: ph, thickness: tn, cut: true,
      note: `Leveling platform, ${where}; shim level, then set the cabinets on it`, boxes: [vb(xs0, 0, z, len, ph, ta)] });
    runner(pd - ta, `front, ${fmtShort(0.75)} behind the face frame`);
    runner(0, 'back');
    const n = Math.max(2, Math.ceil(len / 16) + 1);
    for (let k = 0; k < n; k++) parts.push({ name: 'Platform cross piece', role: 'nailer', material: 'box', length: pd - 2 * ta, width: ph, thickness: tn, cut: true,
      note: `${n} across, about 16" apart, one under each case side`, boxes: [vb(xs0 + ((len - ta) * k) / (n - 1), 0, ta, ta, ph, pd - 2 * ta)] });
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
      const zC = c.island ? -s.endPanelThickness - boardT : 0;
      if (c.island) parts.push({ name: 'Base cap, back', role: 'trim', material: 'faceframe', length: len, width: capH, thickness: boardT, cut: true, note: 'Custom, milled to match the room’s',
        boxes: [vb(xL, h, zC, len, capH, boardT)] });
      for (const side of ['left', 'right'] as const) {
        if (!ends[side]) continue;
        parts.push({ name: `Base cap, ${side} return`, role: 'trim', material: 'faceframe', length: D - zC, width: capH, thickness: boardT, cut: true,
          boxes: [vb(side === 'left' ? xL : xR - boardT, h, zC, boardT, capH, D - zC)] });
      }
    }
    if (h > 0) {
      parts.push({
        name: `${name}, front`, role: 'trim', material: 'faceframe', length: len, width: h, thickness: boardT, cut: true, note,
        ...piece('x', [xL, 0, D], len, BL.b.foot, len - BL.b.foot),
      });
      // An island's baseboard wraps its finished back, outside the back panel
      const zB = c.island ? -s.endPanelThickness - boardT : 0;
      if (c.island) parts.push({ name: `${name}, back`, role: 'trim', material: 'faceframe', length: len, width: h, thickness: boardT, cut: true, note,
        ...piece('x', [xL, 0, zB], len, BL.b.foot, len - BL.b.foot) });
      for (const side of ['left', 'right'] as const) {
        if (!ends[side]) continue;
        const x = side === 'left' ? xL : xR - boardT;
        const rl = D - zB - (c.island ? boardT : 0);
        parts.push({
          name: `${name}, ${side} return`, role: 'trim', material: 'faceframe', length: rl, width: h, thickness: boardT, cut: true, note,
          ...piece('z', [x, 0, c.island ? zB + boardT : 0], rl, BL.b.foot, rl - Math.max(0.75, BL.b.foot - boardT)),
        });
      }
    }
  }

  const { rows } = layoutRows(c, s);
  rows.forEach((r, i) => {
    if (i > 0 && fl) {
      // Frameless: a fixed shelf where the mid rail would be, its banded edge between the fronts
      parts.push({ name: 'Fixed shelf', role: 'shelf', material: 'box', length: innerW + 2 * dd, width: boxD - rw, thickness: tn, cut: true, banded: true,
        note: 'Dadoed in, front edge banded', boxes: [vb(xi0, r.y1, rw, innerW, ta, boxD - rw)] });
    } else if (i > 0) {
      const mw = railAbove(c, s, i);
      parts.push({
        name: 'Mid rail', role: 'rail', material: 'faceframe', length: ox1 - ox0, width: mw, thickness: ft, cut: true,
        note: c.rows[i].railAbove != null ? `${fmtShort(mw)} rail for this cabinet` : undefined,
        boxes: [vb(ox0, r.y1, zF, ox1 - ox0, mw, ft)],
      });
      // A one-piece case changes from closed to open here: a fixed shelf divides it, and a ledge
      // (when there is one) sits on the rail and runs across the front
      const lg = ledgeAbove(c, i);
      const openAbove = isOpenRow(c.rows[i - 1].type, c.rows[i - 1].covered) && !isOpenRow(c.rows[i].type, c.rows[i].covered);
      // Two open rows: the rail between them carries a fixed shelf, a solid divider across the bookcase
      const bothOpen = c.rows[i - 1].type === 'open' && c.rows[i].type === 'open';
      // Hanging space has a fixed shelf over it to carry the rod, and under it to close it off
      const hang = c.rows[i].type === 'hang' || c.rows[i - 1].type === 'hang';
      // The cabinet over a fridge closes off with a fixed shelf on the rail
      const overFridge = c.rows[i].type === 'appliance' && c.rows[i].appliance?.kind === 'fridge';
      if (lg || openAbove || hang || overFridge || bothOpen) {
        const topY = r.y1 + mw + (lg?.thickness ?? 0);
        const lap = lg ? 0.75 : 0;
        parts.push({ name: 'Fixed shelf', role: 'shelf', material: 'box', length: innerW + 2 * dd, width: boxD - rw - lap, thickness: tn, cut: true,
          note: lg ? 'Dadoed in, top flush with the top of the ledge' : bothOpen ? 'Dadoed in, top flush with the top of the rail; a fixed divider across the bookcase' : openAbove ? 'Dadoed in, top flush with the top of the rail; divides the doors from the open shelves above' : 'Dadoed in, top flush with the top of the rail',
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
  const addFront = (name: string, role: 'door' | 'drawerFront', x: number, y: number, w: number, h: number, note?: string, specExtra = '') => {
    // Short drawer fronts can't be built 5-piece; they go on the order as slabs.
    // Eagle drops short drawer fronts to 1 1/2" rails.
    const rail = role === 'drawerFront' && h < narrowRailBelow ? Math.min(narrowRail, doorStile) : doorStile;
    const tooShort = style.profile !== 'slab' && h < 2 * rail + 1.5;
    const slab = role === 'drawerFront' && (s.drawerFronts === 'slab' || tooShort);
    const profile: DoorProfile = slab ? 'slab' : style.profile;
    const cs = centerSplit(w, h, profile, c.noCenterRail);
    const spec = (slab ? `Slab, ${material}` : doorSpec) + (inset ? ', inset' : '') + centerText(cs) + specExtra;
    parts.push({
      name, role, material: 'door', length: h, width: w, thickness: dt, cut: false, note: [note, centerNote(cs, w, h, profile, c.noCenterRail)].filter(Boolean).join(' · ') || undefined,
      order: { item: role, w, h, spec, ...(profile === 'slab' ? {} : { rail, stile: doorStile }), ...centerOrder(cs) },
      boxes: role === 'drawerFront'
        ? frontBoxes(x, y, zFront, w, h, dt, profile, Math.min(rail, doorStile), !!style.panelChoice && !!frontPanel.raised, !!frontPanel.flatFront, cs)
        : frontBoxes(x, y, zFront, w, h, dt, profile, doorStile, raised, false, cs),
    });
  };
  c.rows.forEach((row, i) => {
    const r = rows[i];
    if (r.height <= 0) return;
    const split = hasDoors(row) && row.doors === 2 && c.centerStile;
    // Vertical dividers in an open row (cubbies): a plywood panel dadoed into what's above and below,
    // a mid stile in front of it on a face frame case (its banded edge on a frameless one)
    if (row.type === 'open' && (row.dividers ?? 0) > 0) {
      const n = row.dividers!;
      const lo = Math.max(r.y0, botTop), hi = Math.min(r.y1, topUnder);
      for (const x of bayEdges(ox0, ox1, n, fl ? ta : sw).stiles) {
        parts.push({ name: 'Divider', role: 'divider', material: 'box', length: hi - lo + 2 * dd, width: boxD - rw, thickness: tn, cut: true, banded: fl || undefined,
          note: [`In ${dados} dados top and bottom${fl ? ', front edge banded' : ', behind a mid stile'}`, c.lighting?.includes('shelves') ? hafeleSideNote([{ y0: lo, y1: hi }], true) : ''].filter(Boolean).join(' · '), boxes: [vb(x - ta / 2, lo, rw, ta, hi - lo, boxD - rw)] });
        if (!fl) parts.push({ name: 'Mid stile', role: 'stile', material: 'faceframe', length: r.height, width: sw, thickness: ft, cut: true,
          note: 'Over the divider', boxes: [vb(x - sw / 2, r.y0, zF, sw, r.height, ft)] });
      }
    }
    if (split) {
      parts.push({
        name: 'Center stile', role: 'stile', material: 'faceframe', length: r.height, width: sw, thickness: ft, cut: true,
        boxes: [vb(cx - sw / 2, r.y0, zF, sw, r.height, ft)],
      });
    }
    // Front edges: overlay onto the outer frame, share mid rails, or sit inside the opening for inset
    // A rail with a ledge on it, or open shelves on its other side, belongs to this front alone
    const ownsAbove = i === 0 || !!ledgeAbove(c, i) || isOpenRow(c.rows[i - 1].type, c.rows[i - 1].covered);
    const ownsBelow = i === rows.length - 1 || isOpenRow(c.rows[i + 1].type, c.rows[i + 1].covered);
    const top = inset ? -rev : ownsAbove ? (i === 0 ? o : Math.min(o, railAbove(c, s, i) - 0.25)) : shareOv(railAbove(c, s, i));
    const bottom = inset ? -rev : ownsBelow ? (i === rows.length - 1 ? o : Math.min(o, railAbove(c, s, i + 1) - 0.25)) : shareOv(railAbove(c, s, i + 1));
    const side = inset ? -rev : o;
    const fy = r.y0 - bottom;
    const fh = r.height + top + bottom;
    const fullW = ox1 - ox0 + 2 * side;
    const pairGap = inset ? rev : gap;
    if (row.type === 'drawer' || row.type === 'falseFront') {
      addFront(row.type === 'drawer' ? 'Drawer front' : 'False front', 'drawerFront', ox0 - side, fy, fullW, fh, row.type === 'falseFront' ? 'Fixed, no drawer box' : undefined);
    } else if (hasDoors(row)) {
      if (row.lift) addFront('Lift-up door', 'door', ox0 - side, fy, fullW, fh, 'Blum Aventos HK top lift system; no hinge cups', ', lift-up (no hinge holes)');
      else if (row.doors === 1) addFront('Door', 'door', ox0 - side, fy, fullW, fh);
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
    if (row.type === 'hang') {
      // Round rod in a pair of sockets, hung under the shelf (or case top) over the opening
      const under = i === 0 ? topUnder : fl ? r.y1 : r.y1 + gapAbove(c, s, i) - ta;
      const drop = row.rodDrop ?? s.rodDrop ?? closetRod.drop;
      const d = closetRod.diameter;
      const len = innerW - 0.125;
      // Centered 12" off the wall, or mid-depth in a case too shallow for that
      const zc = Math.min(closetRod.fromWall, boxD - d);
      parts.push({ name: 'Closet rod', role: 'rod', material: 'hardware', length: len, width: d, thickness: d, cut: false,
        note: `${fmtShort(d)} round ${s.closetRod === 'metal' ? 'metal' : 'wood'} rod in 2 sockets, center ${fmtShort(drop)} below the shelf (${fmtShort(c.elevation + under - drop)} off the floor) and ${fmtShort(zc)} off the wall; ${fmtShort(r.height - drop - d / 2)} clear below`,
        boxes: [vb(xi0 + 0.0625, under - drop - d / 2, zc - d / 2, len, d, d, 0.35)] });
    }
    if (row.type === 'shoes' && row.shelves > 0) {
      // Shelves on pins, the back pins higher than the front for slanted ones; a solid fence on the front edge
      const shelfW = innerW - s.shelfClearance;
      const shelfD = boxD - rw - s.shelfSetback - 0.75;
      const slant = !row.flatShoes;
      const drop = slant ? Math.min(shoeShelf.maxDrop, shelfD * shoeShelf.slope) : 0;
      const lo = Math.max(r.y0, botTop);
      const hi = Math.min(r.y1, topUnder);
      const n = row.shelves;
      const pitch = (hi - lo) / n;
      for (let k = 0; k < n; k++) {
        // Front edge of each shelf a fence height up from the bottom of its space; the back rises by the drop
        const yF = lo + pitch * k + (k === 0 ? 0.25 : 0);
        const x0 = xi0 + s.shelfClearance / 2;
        const steps = slant ? 4 : 1;
        const boxes = Array.from({ length: steps }, (_, j) => vb(x0, yF + (drop * (steps - 1 - j)) / steps, rw + (shelfD * j) / steps, shelfW, ta, shelfD / steps));
        parts.push({ name: slant ? 'Shoe shelf, slanted' : 'Shoe shelf', role: 'shelf', material: 'box', length: shelfW, width: shelfD, thickness: tn, cut: true, banded: false,
          note: slant ? `On pins, back ${fmtShort(drop)} higher than the front (about 15°); fence on the front edge` : 'On pins; fence on the front edge',
          boxes });
        parts.push({ name: 'Shoe fence', role: 'trim', material: 'faceframe', length: shelfW, width: shoeShelf.fence, thickness: 0.75, cut: true,
          note: `Glued and nailed to the shelf's front edge, standing ${fmtShort(shoeShelf.lip)} above it`,
          boxes: [vb(x0, yF + ta + shoeShelf.lip - shoeShelf.fence, rw + shelfD, shelfW, shoeShelf.fence, 0.75)] });
      }
    }
    if ((row.type === 'doors' || row.type === 'open') && row.shelves > 0) {
      const shelfW = innerW - s.shelfClearance;
      const fixed0 = c.build?.shelves === 'fixed' || !!row.fixedShelves;
      // Häfele shelf lighting: every adjustable shelf in an open section gets a drop edge, and a groove for the profile behind it
      const lit = !fixed0 && isOpenRow(row.type, row.covered) && !!c.lighting?.includes('shelves');
      const sf = lit ? { thickness: 0.75, height: ta + HF.drop } : c.shelfFront && c.shelfFront.thickness > 0 && c.shelfFront.height > 0 ? c.shelfFront : null;
      const fullD = boxD - rw - s.shelfSetback;
      const shelfD = fullD - (sf?.thickness ?? 0);
      const lo = Math.max(r.y0, botTop);
      const hi = Math.min(r.y1, topUnder);
      // With dividers, each bay gets its own shelves between the dividers
      const bays: [number, number][] = row.type === 'open' && (row.dividers ?? 0) > 0
        ? (() => { const st = bayEdges(ox0, ox1, row.dividers!, fl ? ta : sw).stiles; const xs = [xi0, ...st.flatMap((x) => [x - ta / 2, x + ta / 2]), xi1]; return xs.reduce<[number, number][]>((a, _, i) => (i % 2 === 0 ? [...a, [xs[i], xs[i + 1]]] : a), []); })()
        : [[xi0, xi1]];
      for (const [b0, b1] of bays) for (let k = 1; k <= row.shelves; k++) {
        const y = lo + ((hi - lo) * k) / (row.shelves + 1) - ta / 2;
        const fixed = c.build?.shelves === 'fixed' || !!row.fixedShelves;
        const bw = b1 - b0, sW = bays.length > 1 ? bw - s.shelfClearance : shelfW;
        parts.push({ name: fixed ? 'Fixed shelf' : 'Adjustable shelf', role: 'shelf', material: 'box', length: fixed ? bw + 2 * dd : sW, width: shelfD, thickness: tn, cut: true,
          note: [fixed ? `In ${dados} dados` : '', lit ? `Häfele light bar groove ${fmtShort(HF.profileW)} wide × ${fmtShort(HF.profileD)} deep in the underside, ${fmtShort(HF.profileBack)} behind the drop edge, run through end to end so the bar's spring contacts reach the bus bars` : '', sf ? (lit ? 'Solid drop edge applied, no banding' : 'Solid front applied, no banding') : ''].filter(Boolean).join(' · ') || undefined, banded: !sf,
          boxes: [fixed ? vb(b0, y, rw, bw, ta, shelfD) : vb(b0 + s.shelfClearance / 2, y, rw, sW, ta, shelfD)] });
        if (sf) parts.push({ name: lit ? 'Shelf drop edge' : 'Shelf front', role: 'trim', material: 'faceframe', length: sW, width: sf.height, thickness: sf.thickness, cut: true,
          note: lit ? `Solid wood, top flush with the shelf, drops ${fmtShort(HF.drop)} below it to hide the LED profile; glued and nailed` : 'Glued and nailed to the shelf edge, top flush',
          boxes: [vb(b0 + s.shelfClearance / 2, y + ta - sf.height, rw + shelfD, sW, sf.height, sf.thickness)] });
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
    const [py0, py1] = BL.applied ? [BL.lift, mode === 'inset' ? H : doorTop] : shapedEnd ? [BL.top, mode === 'inset' ? H : doorTop] : mode === 'inset' ? [kick, H] : [doorBottom, doorTop];
    // Divided to match the front: a piece for each row's doors or opening, with the same gaps between
    const pieces = c.splitEndPanels ? endPanelPieces(rows, parts, py0, py1, s) : [[py0, py1] as [number, number]];
    pieces.forEach(([a, b], i) => {
      const ph = b - a;
      const cs = centerSplit(depth, ph, style.profile, c.noCenterRail);
      const flat = frontBoxes(0, a, 0, depth, ph, pt, style.profile, doorStile, raised, false, cs);
      const boxes = flat.map((bx) => {
        const [u, v, w0] = bx.min;
        const [su, sv, sw0] = bx.size;
        const x = side === 'left' ? xi0 - ta - (w0 + sw0) : xi1 + ta + w0;
        return vb(x, v, u, sw0, sv, su, bx.shade);
      });
      parts.push({
        name: pieces.length > 1 ? `End panel ${i + 1} of ${pieces.length}` : 'End panel', role: 'endPanel', material: 'door', length: ph, width: depth, thickness: pt, cut: false,
        note: [`${side === 'left' ? 'Left' : 'Right'}, ${label}, ${fmtShort(a)} off cabinet bottom${pieces.length > 1 ? ', lined up with the front' : ''}`, centerNote(cs, depth, ph, style.profile, c.noCenterRail)].filter(Boolean).join(' · '),
        order: { item: 'endPanel', w: depth, h: ph, spec: `${doorSpec}, end panel${centerText(cs)}`, ...(style.profile === 'slab' ? {} : { rail: doorStile, stile: doorStile }), ...centerOrder(cs) },
        boxes,
      });
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

  if (c.island) {
    // The back is finished like an end: a panel in the door style across the case and the end panels
    const ext = panelExtents(c, s, ends);
    const len = W + ext.left + ext.right;
    // Down to the floor behind a baseboard, which then wraps over it; else lined up with the fronts
    const [py0, py1] = [BL.applied ? BL.lift : doorBottom, doorTop];
    parts.push({
      name: 'Back panel, finished', role: 'endPanel', material: 'door', length: py1 - py0, width: len, thickness: pt, cut: false,
      note: `Island back, over the case back; ${BL.applied ? 'down to the floor, the baseboard over it' : `${fmtShort(py0)} off cabinet bottom, lined up with the fronts`}`,
      order: { item: 'endPanel', w: len, h: py1 - py0, spec: `${doorSpec}, end panel${centerText(centerSplit(len, py1 - py0, style.profile, c.noCenterRail))}`, ...(style.profile === 'slab' ? {} : { rail: doorStile, stile: doorStile }), ...centerOrder(centerSplit(len, py1 - py0, style.profile, c.noCenterRail)) },
      boxes: frontBoxes(-ext.left, py0, -pt, len, py1 - py0, pt, style.profile, doorStile, raised, false, centerSplit(len, py1 - py0, style.profile, c.noCenterRail)),
    });
  }
  // Joined into the top of the cabinet to its left: no top of its own
  if (c.kind === 'base' && c.countertop && ends.topRun && !ends.topRun.lead) { /* the lead cabinet's top covers it */ }
  else if (c.kind === 'base' && c.countertop) {
    const run = ends.topRun;
    const ext = panelExtents(c, s, ends);
    // Leading a run: one piece across to the far side of the last cabinet, overhanging its end as it would its own
    const lastExt = run ? panelExtents(run.last, s, { left: false, right: run.lastRight }) : null;
    const top = run && lastExt
      ? topPart({ ...c, topRight: run.last.topRight }, s, run.span, D + dt, { left: ext.left, right: lastExt.right })
      : topPart(c, s, W, D + dt, ext);
    if (run) {
      const gaps = run.gaps ?? [];
      top.note = [top.note, `One piece across ${fmt(run.span)}`, ...gaps.map((g) => `spans a ${fmt(g.width)} open space: support it with a cleat on the wall${g.width > 36 ? ' and a leg or bracket' : ''}`)].filter(Boolean).join(' · ');
    }
    parts.push(top, ...topEdging(run ? { ...c, topRight: run.last.topRight } : c, s, top, run ? { ...ends, right: run.lastRight } : ends));
    // A seat cushion covers the top
    const cu = c.cushion;
    if (cu) {
      const b = top.boxes[0];
      parts.push({ name: 'Seat cushion', role: 'cushion', material: 'upholstery', length: top.length, width: top.width, thickness: cu.thickness, cut: false,
        note: `Custom, by the upholsterer: ${fmtShort(cu.thickness)} foam, ${cu.edge === 'boxed' ? 'boxed edge with welt' : 'knife edge'}; ${cu.fabric?.trim() || 'fabric to be selected'}. Upholsterer to confirm size on site.${cu.notes?.trim() ? ` ${cu.notes.trim()}` : ''}`,
        boxes: [vb(b.min[0], b.min[1] + b.size[1], b.min[2], b.size[0], cu.thickness, b.size[2], 0.9)] });
    }
  }
  if (c.kind !== 'base') parts.push(...crownParts(c, s, ends));
  return fl ? parts.filter((x) => !(x.material === 'faceframe' && (x.role === 'stile' || x.role === 'rail'))) : parts;
}

/**
 * An island with fronts both ways: this case, and a second one back to back with it turned to face
 * the other side, sharing a top that runs over both. The base wraps the pair.
 */
function twoSidedIsland(c: Cabinet, s0: ShopSettings, ends: EndInfo): Part[] {
  const half: Cabinet = { ...c, island: undefined, islandSides: undefined, countertop: false, cushion: undefined, topBack: undefined };
  const front = buildParts(half, s0, ends);
  const back = buildParts({ ...half, rows: c.backRows ?? c.rows }, s0, ends).map((p) => mirrorPart(p, c.width));
  const s = eff(c, s0);
  const out = [...front, ...back];
  if (c.countertop) {
    const reach = c.depth + (s.doorMount === 'inset' ? 0 : s.doorThickness);
    const top = topPart(c, s, c.width, reach, panelExtents(c, s, ends), reach + (c.topBack ?? c.topFront ?? s.counterOverhang));
    out.push(top, ...topEdging(c, s, top, { ...ends, left: true, right: true }, true));
  }
  return out;
}

/** A part turned to face the other way: spun half a turn about the back of the case (x = w/2, z = 0). */
function mirrorPart(p: Part, w: number): Part {
  const boxes = p.boxes.map((b) => ({ ...b, min: [w - b.min[0] - b.size[0], b.min[1], -b.min[2] - b.size[2]] as [number, number, number] }));
  const shapes = p.shapes?.map((sh) => {
    const len = Math.max(...sh.outline.map(([u]) => u));
    const outline = sh.outline.map(([u, v]) => [len - u, v] as [number, number]).reverse();
    const min: [number, number, number] = sh.along === 'x'
      ? [w - sh.min[0] - len, sh.min[1], -sh.min[2] - sh.thickness]
      : [w - sh.min[0] - sh.thickness, sh.min[1], -sh.min[2] - len];
    return { ...sh, min, outline };
  });
  return { ...p, name: `${p.name}, far side`, boxes, ...(shapes ? { shapes } : {}) };
}

export const noCrownBuild: CrownBuild = { subCrown: 0, rise: 0, drop: 0, extra: [] };

/**
 * The common build in one step: a flat sub-crown standing on top of the case (the face frame's top
 * rail stays fully exposed), showing a set amount under the crown, with the crown kept where it is
 * now; the case gets shorter by what the build grows.
 */
export function subCrownOnTop(c: Cabinet, s: ShopSettings, exposed: number): Partial<Cabinet> | null {
  const p = profileByNum(c.crown);
  if (!p) return null;
  const ch = mountShape(p).height;
  const L = crownLayout(c, s);
  const sub = Math.round((ch + exposed) * 16) / 16;
  const height = Math.round((L.top - sub) * 16) / 16;
  if (height < 12) return null;
  return { height, crownBuild: { ...noCrownBuild, ...c.crownBuild, subCrown: sub, rise: sub, drop: 0 } };
}



/** Where the crown build sits on a cabinet: its top, the face the mouldings go on, and the sub-crown. */
export function crownLayout(c: Cabinet, s: ShopSettings) {
  s = eff(c, s);
  const b = { ...noCrownBuild, ...c.crownBuild };
  // The sub-crown's face lines up with the door faces (or sits a door's thickness proud on inset jobs)
  const subT = b.subCrown > 0 ? s.doorThickness : 0;
  // With no sub-crown the crown (and anything stacked under it) sits on the case: its bottom at the
  // top of the case, on a nailer as tall as the stack; the raise lifts it further
  const seat = b.subCrown > 0 || c.kind === 'pilaster' ? 0 : [c.crown, ...b.extra].reduce((t, num) => { const p = profileByNum(num); return t + (p ? mountShape(p).height : 0); }, 0);
  const rise = b.rise + seat;
  const top = c.height + rise;
  // On a pilaster the frieze breaks out flush with the capital block
  const back = c.kind === 'pilaster' ? c.depth + pilasterOf(c).proud - subT : c.depth;
  const face = c.kind === 'pilaster' && !subT ? c.depth + pilasterOf(c).proud : back + subT;
  return { build: b, top, subT, back, subBottom: top - b.subCrown, face, crownTop: top - b.drop, rise, seat };
}

/**
 * The crown against the ceiling: where the top of the build lands off the floor, the crown's own
 * drop, and how far it runs past the ceiling (0 when it fits).
 */
export function crownFit(c: Cabinet, s: ShopSettings, ceiling: number) {
  const p = profileByNum(c.crown);
  if (!p || c.kind === 'base' || c.kind === 'mantel' || c.kind === 'shelf') return null;
  const L = crownLayout(c, s);
  const top = c.elevation + Math.max(L.top, L.crownTop);
  const drop = mountShape(p).height;
  return { top, drop, caseTop: c.elevation + c.height, over: Math.max(0, top - ceiling) };
}

/** The tallest crown that fits between this cabinet and the ceiling as it's built (none: it hangs from a sub-crown). */
export function crownRoom(c: Cabinet, s: ShopSettings, ceiling: number): number | undefined {
  const b = { ...noCrownBuild, ...c.crownBuild };
  if (b.subCrown > 0 || c.kind === 'pilaster') return undefined;
  const under = b.extra.reduce((t, num) => { const p = profileByNum(num); return t + (p ? mountShape(p).height : 0); }, 0);
  void s;
  return Math.max(0, ceiling - c.elevation - c.height - b.rise - under);
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
  if (L.rise > 0) {
    // Nailer screwed to the cabinet top, behind the face frame, for the sub-crown and crown to land on
    out.push({ name: 'Crown nailer', role: 'nailer', material: 'box', length: c.width, width: L.rise, thickness: s.boxThickness, cut: true,
      note: L.seat ? `on the cabinet top, as tall as the crown, which sits on the case` : `on the cabinet top, raises the crown ${fmtShort(L.rise)}`,
      boxes: [vb(0, c.height, c.depth - nt, c.width, L.rise, nt)] });
    for (const side of ['left', 'right'] as const) {
      if (!ends[side]) continue;
      out.push({ name: 'Crown nailer return', role: 'nailer', material: 'box', length: c.depth - nt, width: L.rise, thickness: s.boxThickness, cut: true,
        boxes: [vb(side === 'left' ? 0 : c.width - nt, c.height, 0, nt, L.rise, c.depth - nt)] });
    }
  }
  if (subT > 0) {
    const h = b.subCrown;
    // One piece across a run of cabinets: the first carries it to the far end of the last
    const run = ends.subRun;
    const lastExt = run?.lead ? panelExtents(run.last, s, { left: false, right: run.lastRight }) : null;
    const xEnd = run?.lead && lastExt ? run.span + lastExt.right : x1;
    const rightOpen = run?.lead ? run.lastRight : ends.right;
    const xl = x0 - (ends.left ? subT : 0), xr = xEnd + (rightOpen ? subT : 0);
    if (!run || run.lead) out.push({ name: 'Sub-crown', role: 'trim', material: 'faceframe', length: xr - xl, width: h, thickness: subT, cut: true,
      note: ['flat, face flush with the doors; crown goes on its face', run ? `One piece across ${fmt(run.span)}${xr - xl > 96 ? '; longer than 8\': splice it at a cabinet joint with a scarf or spline' : ''}` : ''].filter(Boolean).join(' · '),
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
/** How thick a base cabinet's top is: a paint-grade top's plywood, a wood top, or stone. */
export const topThick = (c: Cabinet, counter = 1.5) => (c.topKind === 'paint' ? PAINT_TOP.ply : c.topThickness ?? (c.topKind === 'wood' ? 1.25 : counter));

/** Paint-grade top: 3/4" plywood with solid edging, the edging dropping this far below the plywood over the top rail. */
export const PAINT_TOP = { ply: 0.75, edgeT: 0.75, edgeH: 1.25 };

/** A paint-grade top's applied edging: across the front, and around exposed ends (and an island's back). */
function topEdging(c: Cabinet, s: ShopSettings, top: Part, ends: EndInfo, back = !!c.island): Part[] {
  if (c.topKind !== 'paint') return [];
  const b = top.boxes[0];
  const { ply, edgeT: t, edgeH: h } = PAINT_TOP;
  const y = b.min[1] + ply - h;
  const sp = c.topEdge ?? 'Poplar';
  const note = `${sp}, ${fmtShort(t)} × ${fmtShort(h)}; top flush with the plywood, dropping ${fmtShort(h - ply)} over the top rail; mitered at the corners`;
  const out: Part[] = [{ name: 'Top edging, front', role: 'trim', material: 'faceframe', species: sp, length: b.size[0] + 2 * t, width: h, thickness: t, cut: true, note,
    boxes: [vb(b.min[0] - t, y, b.min[2] + b.size[2], b.size[0] + 2 * t, h, t)] }];
  if (back) out.push({ name: 'Top edging, back', role: 'trim', material: 'faceframe', species: sp, length: b.size[0] + 2 * t, width: h, thickness: t, cut: true, note,
    boxes: [vb(b.min[0] - t, y, b.min[2] - t, b.size[0] + 2 * t, h, t)] });
  for (const side of ['left', 'right'] as const) {
    if (!ends[side] && !(c.topLeft && side === 'left') && !(c.topRight && side === 'right')) continue;
    out.push({ name: `Top edging, ${side} end`, role: 'trim', material: 'faceframe', species: sp, length: b.size[2] + (back ? 2 * t : t), width: h, thickness: t, cut: true, note,
      boxes: [vb(side === 'left' ? b.min[0] - t : b.min[0] + b.size[0], y, b.min[2] - (back ? t : 0), t, h, b.size[2] + (back ? 2 * t : t))] });
  }
  void s;
  return out;
}

export function topPart(c: Cabinet, s: ShopSettings, W: number, frontFace: number, ext: { left: number; right: number }, backReach?: number): Part {
  const wood = c.topKind === 'wood';
  if (c.topKind === 'paint') {
    // 3/4" paint-grade plywood; the edging adds its thickness to the front and exposed ends
    const front = (c.topFront ?? 0.75) - PAINT_TOP.edgeT;
    const left = ext.left + (c.topLeft ?? 0), right = ext.right + (c.topRight ?? 0);
    const back = backReach != null ? backReach - PAINT_TOP.edgeT : c.island ? s.endPanelThickness + (c.topBack ?? 0.75) - PAINT_TOP.edgeT : 0;
    const len = W + left + right, depth = frontFace + front + back;
    return {
      name: 'Paint-grade top', role: 'paintTop', material: 'box', look: 'paint', length: len, width: depth, thickness: PAINT_TOP.ply, cut: true,
      note: `3/4" paint-grade plywood; solid ${(c.topEdge ?? 'Poplar').toLowerCase()} edging applied`,
      boxes: [vb(-left, c.height, -back, len, PAINT_TOP.ply, depth)],
    };
  }
  const t = c.topThickness ?? (wood ? 1.25 : s.counterThickness);
  const front = c.topFront ?? s.counterOverhang;
  const left = ext.left + (c.topLeft ?? 0);
  const right = ext.right + (c.topRight ?? 0);
  const len = W + left + right;
  // An island's top also covers its finished back and overhangs it
  const back = backReach ?? (c.island ? s.endPanelThickness + (c.topBack ?? front) : 0);
  const depth = frontFace + front + back;
  return wood
    ? {
        name: 'Wood top', role: 'woodTop', material: 'solidWood', length: len, width: depth, thickness: t, cut: true,
        ...(c.topSpecies && c.topSpecies !== s.woodSpecies ? { species: c.topSpecies } : {}),
        note: `${c.topSpecies ?? s.woodSpecies}, glued up; ${fmt(front)} front overhang${backReach != null ? `, ${fmt(c.topBack ?? front)} past the far side's fronts` : c.island ? `, ${fmt(back - s.endPanelThickness)} past the back panel` : ''}`,
        boxes: [vb(-left, c.height, -back, len, t, depth)],
        // A routed edge: the top drawn as its section, run the length (the ends stay square in 3D)
        ...(isRouted(c.topProfile) ? { shapesOnly: true, shapes: [{ along: 'z' as const, min: [-left, c.height, -back] as [number, number, number], thickness: len, outline: topSection(depth, t, c.topProfile!, c.island ? c.topProfile! : 'square') }] } : {}),
      }
    : {
        name: 'Countertop', role: 'counter', material: 'counter', length: len, width: depth, thickness: t, cut: false,
        boxes: [vb(-left, c.height, -back, len, t, depth)],
      };
}
