import type { Cabinet, Part, ShopSettings, VisualBox } from './types';
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

/** Panel or door: a slab, or a 5-piece shaker drawn as frame + recessed panel. */
function frontBoxes(x: number, y: number, z: number, w: number, h: number, t: number, s: ShopSettings): VisualBox[] {
  if (s.doorStyle === 'slab') return [vb(x, y, z, w, h, t)];
  const f = Math.min(s.shakerFrameWidth, h * 0.22, w * 0.3);
  const recess = Math.min(0.375, t / 2);
  return [
    vb(x, y, z, f, h, t),
    vb(x + w - f, y, z, f, h, t),
    vb(x + f, y + h - f, z, w - 2 * f, f, t),
    vb(x + f, y, z, w - 2 * f, f, t),
    vb(x + f, y + f, z, w - 2 * f, h - 2 * f, t - recess, 0.94),
  ];
}

/**
 * Build every part of a face-frame cabinet from its size and the shop's standards.
 * The 3D view draws these same parts, so what you see is what gets cut.
 */
export function buildParts(c: Cabinet, s: ShopSettings): Part[] {
  const parts: Part[] = [];
  const { width: W, height: H, depth: D } = c;
  const t = s.boxThickness;
  const ov = s.ffOverhang;
  const boxW = W - 2 * ov;
  const boxD = D - s.ffThickness;
  const kick = kickOf(c, s);
  const x0 = ov;
  const x1 = W - ov;
  const inW = boxW - 2 * t; // between the sides
  const dadoW = inW + 2 * s.dadoDepth; // panels captured in dados
  const bt = s.backThickness;
  const notch = Math.max(0, s.toeKickDepth - s.ffThickness);

  // Sides
  const sideBoxes = (x: number): VisualBox[] =>
    kick > 0
      ? [vb(x, kick, 0, t, H - kick, boxD), vb(x, 0, 0, t, kick, boxD - notch)]
      : [vb(x, 0, 0, t, H, boxD)];
  for (const x of [x0, x1 - t]) {
    parts.push({
      name: 'Side', role: 'side', material: 'box', length: H, width: boxD, thickness: t, cut: true,
      note: kick > 0 ? `Toe notch ${fmtShort(kick)} × ${fmtShort(notch)}` : undefined,
      boxes: sideBoxes(x),
    });
  }

  // Bottom: top face flush with the top of the face frame bottom rail
  const botTop = kick + s.bottomRailWidth;
  parts.push({
    name: 'Bottom', role: 'bottom', material: 'box', length: dadoW, width: boxD - bt, thickness: t, cut: true,
    boxes: [vb(x0 + t, botTop - t, bt, inW, t, boxD - bt)],
  });

  // Top: stretchers on base cabinets, a full panel on wall and tall
  let backTop = H;
  let topUnder = H;
  if (c.kind === 'base') {
    const sw = s.stretcherWidth;
    parts.push({
      name: 'Front stretcher', role: 'stretcher', material: 'box', length: inW, width: sw, thickness: t, cut: true,
      boxes: [vb(x0 + t, H - t, boxD - sw, inW, t, sw)],
    });
    parts.push({
      name: 'Back stretcher', role: 'stretcher', material: 'box', length: inW, width: sw, thickness: t, cut: true,
      boxes: [vb(x0 + t, H - t, bt, inW, t, sw)],
    });
    topUnder = H - t;
  } else {
    const topY = H - s.topRailWidth;
    parts.push({
      name: 'Top', role: 'top', material: 'box', length: dadoW, width: boxD - bt, thickness: t, cut: true,
      boxes: [vb(x0 + t, topY, bt, inW, t, boxD - bt)],
    });
    backTop = topY + t;
    topUnder = topY;
  }

  // Back, captured in rabbets in the sides
  const backBottom = botTop - t;
  parts.push({
    name: 'Back', role: 'back', material: 'back', length: backTop - backBottom, width: dadoW, thickness: bt, cut: true,
    boxes: [vb(x0 + t, backBottom, 0, inW, backTop - backBottom, bt)],
  });

  // Hanging rails
  if (c.kind !== 'base') {
    const nw = s.nailerWidth;
    parts.push({
      name: 'Top nailer', role: 'nailer', material: 'box', length: inW, width: nw, thickness: t, cut: true,
      boxes: [vb(x0 + t, topUnder - nw, bt, inW, nw, t)],
    });
    if (c.kind === 'wall') {
      parts.push({
        name: 'Bottom nailer', role: 'nailer', material: 'box', length: inW, width: nw, thickness: t, cut: true,
        boxes: [vb(x0 + t, botTop, bt, inW, nw, t)],
      });
    }
  }

  // Toe kick
  if (kick > 0) {
    const z = D - s.toeKickDepth - t;
    parts.push({
      name: 'Toe kick', role: 'toekick', material: 'box', length: inW, width: kick, thickness: t, cut: true,
      boxes: [vb(x0 + t, 0, z, inW, kick, t)],
    });
  }

  // Face frame
  const ffH = H - kick;
  const zF = boxD;
  const ft = s.ffThickness;
  const sw = s.stileWidth;
  const railLen = W - 2 * sw;
  parts.push({
    name: 'Stile', role: 'stile', material: 'faceframe', length: ffH, width: sw, thickness: ft, cut: true,
    boxes: [vb(0, kick, zF, sw, ffH, ft)],
  });
  parts.push({
    name: 'Stile', role: 'stile', material: 'faceframe', length: ffH, width: sw, thickness: ft, cut: true,
    boxes: [vb(W - sw, kick, zF, sw, ffH, ft)],
  });
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

  // Openings: doors, drawer fronts, shelves
  const o = s.doorOverlay;
  const dt = s.doorThickness;
  const zD = D;
  const ox0 = sw;
  const ox1 = W - sw;
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
    if (row.type === 'drawer' || row.type === 'falseFront') {
      const fw = ox1 - ox0 + 2 * o;
      parts.push({
        name: row.type === 'drawer' ? 'Drawer front' : 'False front', role: 'drawerFront', material: 'door',
        length: fh, width: fw, thickness: dt, cut: true, note: row.type === 'falseFront' ? 'Fixed, no drawer box' : undefined,
        boxes: frontBoxes(ox0 - o, fy, zD, fw, fh, dt, s),
      });
    } else if (row.type === 'doors') {
      if (row.doors === 1) {
        const fw = ox1 - ox0 + 2 * o;
        parts.push({ name: 'Door', role: 'door', material: 'door', length: fh, width: fw, thickness: dt, cut: true,
          boxes: frontBoxes(ox0 - o, fy, zD, fw, fh, dt, s) });
      } else if (split) {
        const lw = W / 2 - sw / 2 - ox0 + 2 * o;
        parts.push({ name: 'Door', role: 'door', material: 'door', length: fh, width: lw, thickness: dt, cut: true,
          boxes: frontBoxes(ox0 - o, fy, zD, lw, fh, dt, s) });
        parts.push({ name: 'Door', role: 'door', material: 'door', length: fh, width: lw, thickness: dt, cut: true,
          boxes: frontBoxes(W / 2 + sw / 2 - o, fy, zD, lw, fh, dt, s) });
      } else {
        const total = ox1 - ox0 + 2 * o;
        const dw = (total - s.doorGap) / 2;
        parts.push({ name: 'Door', role: 'door', material: 'door', length: fh, width: dw, thickness: dt, cut: true,
          boxes: frontBoxes(ox0 - o, fy, zD, dw, fh, dt, s) });
        parts.push({ name: 'Door', role: 'door', material: 'door', length: fh, width: dw, thickness: dt, cut: true,
          boxes: frontBoxes(ox0 - o + dw + s.doorGap, fy, zD, dw, fh, dt, s) });
      }
    }
    if ((row.type === 'doors' || row.type === 'open') && row.shelves > 0) {
      const shelfW = inW - s.shelfClearance;
      const shelfD = boxD - bt - s.shelfSetback;
      // Interior span of this opening, clipped to the box
      const lo = Math.max(r.y0, botTop);
      const hi = Math.min(r.y1, topUnder);
      for (let k = 1; k <= row.shelves; k++) {
        const y = lo + ((hi - lo) * k) / (row.shelves + 1) - t / 2;
        parts.push({ name: 'Adjustable shelf', role: 'shelf', material: 'box', length: shelfW, width: shelfD, thickness: t, cut: true,
          boxes: [vb(x0 + t + s.shelfClearance / 2, y, bt, shelfW, t, shelfD)] });
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
