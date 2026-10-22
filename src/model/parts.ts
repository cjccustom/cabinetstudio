import type { Cabinet, Part, ShopSettings, VisualBox } from './types';
import { slideLengths, styleById, type DoorProfile } from './eagle';
import { fmt as fmtShort } from '../units';

const vb = (x: number, y: number, z: number, sx: number, sy: number, sz: number, shade?: number): VisualBox => ({
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
export const kickOf = (c: Cabinet, s: ShopSettings) => (c.kind === 'wall' ? 0 : s.toeKickHeight);

/** Resolve each face row's opening height, top to bottom. Auto rows split what's left. */
export function layoutRows(c: Cabinet, s: ShopSettings): { rows: RowLayout[]; leftover: number } {
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
function frontBoxes(x: number, y: number, z: number, w: number, h: number, t: number, profile: DoorProfile, stile: number, raised: boolean): VisualBox[] {
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
  inner.push(vb(px, py, 0, pw, ph, t - 0.375, 0.93));
  if (raised && pw > 3 && ph > 3) inner.push(vb(px + 1.25, py + 1.25, 0, pw - 2.5, ph - 2.5, t - 0.125, 0.99));
  for (const b of inner) out.push({ ...b, min: [b.min[0], b.min[1], z] });
  return out;
}

export interface EndInfo { left: boolean; right: boolean }

/**
 * Build every part of a face-frame cabinet from its size and the shop's standards.
 * The 3D view draws these same parts, so what you see is what gets cut.
 *
 * Cut sizes use nominal 3/4" case stock. The drawing uses the real (thinner) thickness,
 * which is where the slim face frame overhang comes from.
 */
export function buildParts(c: Cabinet, s: ShopSettings, ends: EndInfo = { left: false, right: false }): Part[] {
  const parts: Part[] = [];
  const { width: W, height: H, depth: D } = c;
  const tn = s.boxThickness;
  const ta = s.boxActualThickness;
  const dd = s.dadoDepth;
  const kick = kickOf(c, s);
  const boxD = D - s.ffThickness;
  const cutW = W - 2 * s.ffOverhang - 2 * tn + 2 * dd; // bottom, stretchers, top and back
  const innerW = cutW - 2 * dd; // between the sides
  const xi0 = (W - innerW) / 2; // inside face of the left side
  const xi1 = W - xi0;
  const bt = s.backThickness;
  const rw = Math.max(s.backRabbetWidth, bt);
  const notch = Math.max(0, s.toeKickDepth - s.ffThickness);
  const dados = fmtShort(dd);

  // Sides
  const sideBoxes = (x: number): VisualBox[] =>
    kick > 0
      ? [vb(x, kick, 0, ta, H - kick, boxD), vb(x, 0, 0, ta, kick, boxD - notch)]
      : [vb(x, 0, 0, ta, H, boxD)];
  ([['Left', xi0 - ta, ends.left], ['Right', xi1, ends.right]] as const).forEach(([, x, exposed]) => {
    const notes = [];
    if (kick > 0) notes.push(`Toe notch ${fmtShort(kick)} × ${fmtShort(notch)}`);
    notes.push(exposed ? 'Exposed end: pocket screw from inside' : 'Hidden: glue & staple');
    parts.push({
      name: exposed ? 'Side, exposed' : 'Side', role: 'side', material: 'box', length: H, width: boxD, thickness: tn, cut: true,
      note: notes.join(' · '),
      boxes: sideBoxes(x),
    });
  });

  // Bottom: in dados, sitting a hair below the top of the face frame bottom rail
  const botTop = kick + s.bottomRailWidth - s.bottomReveal;
  parts.push({
    name: 'Bottom', role: 'bottom', material: 'box', length: cutW, width: boxD - rw, thickness: tn, cut: true,
    note: `In ${dados} dados`,
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
    const z = D - s.toeKickDepth - ta;
    parts.push({
      name: 'Toe kick', role: 'toekick', material: 'box', length: innerW, width: kick, thickness: tn, cut: true,
      boxes: [vb(xi0, 0, z, innerW, kick, ta)],
    });
  }

  // Face frame: glued and pocket screwed
  const ffH = H - kick;
  const zF = boxD;
  const ft = s.ffThickness;
  const sw = s.stileWidth;
  const railLen = W - 2 * sw;
  for (const x of [0, W - sw]) {
    parts.push({
      name: 'Stile', role: 'stile', material: 'faceframe', length: ffH, width: sw, thickness: ft, cut: true,
      boxes: [vb(x, kick, zF, sw, ffH, ft)],
    });
  }
  parts.push({
    name: 'Top rail', role: 'rail', material: 'faceframe', length: railLen, width: s.topRailWidth, thickness: ft, cut: true,
    boxes: [vb(sw, H - s.topRailWidth, zF, railLen, s.topRailWidth, ft)],
  });
  parts.push({
    name: 'Bottom rail', role: 'rail', material: 'faceframe', length: railLen, width: s.bottomRailWidth, thickness: ft, cut: true,
    boxes: [vb(sw, kick, zF, railLen, s.bottomRailWidth, ft)],
  });

  const { rows } = layoutRows(c, s);
  rows.forEach((r, i) => {
    if (i > 0) {
      parts.push({
        name: 'Mid rail', role: 'rail', material: 'faceframe', length: railLen, width: s.midRailWidth, thickness: ft, cut: true,
        boxes: [vb(sw, r.y1, zF, railLen, s.midRailWidth, ft)],
      });
    }
  });

  // Openings: doors and drawer fronts (ordered from Eagle), drawer boxes, shelves
  const style = styleById(s.doorStyleId);
  const doorStile = style.fixedStile ? style.stile : s.doorStile;
  const raised = !!style.panelChoice && s.doorPanel === 'raised';
  const material = style.line === 'MDF' ? 'MDF' : s.doorMaterial;
  const doorSpec = style.profile === 'slab'
    ? `Slab, ${material}`
    : `${style.name}, ${material}, ${fmtShort(doorStile)} stiles${raised ? ', raised panel' : ''}`;
  const o = s.doorOverlay;
  const dt = s.doorThickness;
  const ox0 = sw;
  const ox1 = W - sw;
  const addFront = (name: string, role: 'door' | 'drawerFront', x: number, y: number, w: number, h: number, note?: string) => {
    // Short drawer fronts can't be built 5-piece; they go on the order as slabs.
    const tooShort = style.profile !== 'slab' && h < 2 * doorStile + 1.5;
    const slab = role === 'drawerFront' && (s.drawerFronts === 'slab' || tooShort);
    const profile: DoorProfile = slab ? 'slab' : style.profile;
    const spec = slab ? `Slab, ${material}` : doorSpec;
    parts.push({
      name, role, material: 'door', length: h, width: w, thickness: dt, cut: false, note,
      order: { item: role, w, h, spec },
      boxes: frontBoxes(x, y, D, w, h, dt, profile, doorStile, raised),
    });
  };
  c.rows.forEach((row, i) => {
    const r = rows[i];
    if (r.height <= 0) return;
    const split = row.type === 'doors' && row.doors === 2 && c.centerStile;
    if (split) {
      parts.push({
        name: 'Center stile', role: 'stile', material: 'faceframe', length: r.height, width: sw, thickness: ft, cut: true,
        boxes: [vb(W / 2 - sw / 2, r.y0, zF, sw, r.height, ft)],
      });
    }
    const fy = r.y0 - o;
    const fh = r.height + 2 * o;
    const fullW = ox1 - ox0 + 2 * o;
    if (row.type === 'drawer' || row.type === 'falseFront') {
      addFront(row.type === 'drawer' ? 'Drawer front' : 'False front', 'drawerFront', ox0 - o, fy, fullW, fh, row.type === 'falseFront' ? 'Fixed, no drawer box' : undefined);
    } else if (row.type === 'doors') {
      if (row.doors === 1) addFront('Door', 'door', ox0 - o, fy, fullW, fh);
      else if (split) {
        const lw = W / 2 - sw / 2 - ox0 + 2 * o;
        addFront('Door', 'door', ox0 - o, fy, lw, fh);
        addFront('Door', 'door', W / 2 + sw / 2 - o, fy, lw, fh);
      } else {
        const dw = (fullW - s.doorGap) / 2;
        addFront('Door', 'door', ox0 - o, fy, dw, fh);
        addFront('Door', 'door', ox0 - o + dw + s.doorGap, fy, dw, fh);
      }
    }
    if (row.type === 'drawer') {
      const room = boxD - rw - s.drawerRearClearance;
      const depth = [...slideLengths].reverse().find((l) => l <= room) ?? 0;
      const bw = ox1 - ox0 - s.drawerWidthDeduction;
      const bh = r.height - s.drawerHeightDeduction;
      parts.push({
        name: 'Drawer box', role: 'drawerBox', material: 'drawerBox', length: depth, width: bw, thickness: bh, cut: false,
        note: depth ? `${depth}" undermount slides` : 'Cabinet too shallow for standard slides',
        order: { item: 'drawerBox', w: bw, h: bh, d: depth, spec: `Dovetail, notched & bored for ${depth}" undermount slides` },
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

  if (c.kind === 'base' && c.countertop) {
    const cd = D + dt + s.counterOverhang;
    parts.push({
      name: 'Countertop', role: 'counter', material: 'counter', length: W, width: cd, thickness: s.counterThickness, cut: false,
      boxes: [vb(0, H, 0, W, s.counterThickness, cd)],
    });
  }
  return parts;
}

/** How far the face frame actually sticks out past each case side once real plywood thickness is counted. */
export const realOverhang = (s: ShopSettings) => s.ffOverhang + (s.boxThickness - s.boxActualThickness);
