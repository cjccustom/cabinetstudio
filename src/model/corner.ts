// L-shaped corner cabinets (lazy susan base, corner wall cabinet) that span two walls.
// Built for the left-hand corner, with the back leg along this wall (x) and the side leg
// along the other wall (z), then mirrored for the right-hand corner.
import type { Cabinet, Part, ShopSettings, VisualBox } from './types';
import { frontBoxes, kickOf, vb } from './parts';
import { styleById, panelByCode } from './eagle';
import { fmt } from '../units';

export function buildCornerParts(c: Cabinet, s: ShopSettings): Part[] {
  const corner = c.corner!;
  const parts: Part[] = [];
  const W = c.width;
  const W2 = corner.width2;
  const D = c.depth;
  const H = c.height;
  const tn = s.boxThickness;
  const ta = s.boxActualThickness;
  const dd = s.dadoDepth;
  const ft = s.ffThickness;
  const sw = s.stileWidth;
  const kick = kickOf(c, s);
  const boxD = D - ft;
  const bt = s.backThickness;
  const rw = Math.max(s.backRabbetWidth, bt);
  const over = s.ffOverhang + tn - ta; // face frame past the case side
  const endA = W - over; // outside of the side at the end of the back leg
  const endB = W2 - over; // outside of the side at the end of the side leg
  const kickBack = s.toeKickDepth + s.toeKickSkin;
  const notch = Math.max(0, kickBack - ft);
  const botTop = kick + s.bottomRailWidth - s.bottomReveal;
  const topY = c.kind === 'base' ? H - ta : H - s.topRailWidth + s.bottomReveal;
  const dados = fmt(dd);

  // Sides at the two open ends
  const side = (box: (y0: number, h: number, depthCut: number) => VisualBox) =>
    kick > 0 ? [box(kick, H - kick, 0), box(0, kick, notch)] : [box(0, H, 0)];
  parts.push({
    name: 'Side', role: 'side', material: 'box', length: H, width: boxD, thickness: tn, cut: true,
    note: kick > 0 ? `Toe notch ${fmt(kick)} × ${fmt(notch)}` : undefined,
    boxes: side((y0, h, cutD) => vb(endA - ta, y0, 0, ta, h, boxD - cutD)),
  });
  parts.push({
    name: 'Side', role: 'side', material: 'box', length: H, width: boxD, thickness: tn, cut: true,
    note: kick > 0 ? `Toe notch ${fmt(kick)} × ${fmt(notch)}` : undefined,
    boxes: side((y0, h, cutD) => vb(0, y0, endB - ta, boxD - cutD, h, ta)),
  });

  // Backs: one on each wall, the side-wall back butting the back-wall back in the corner
  const backBottom = botTop - ta;
  const backH = H - backBottom;
  parts.push({
    name: 'Back', role: 'back', material: 'back', length: backH, width: endA - ta + dd - (rw - bt), thickness: bt, cut: true,
    note: `Back wall leg; in ${fmt(rw)} × ${dados} rabbet`,
    boxes: [vb(rw - bt, backBottom, rw - bt, endA - ta - (rw - bt), backH, bt)],
  });
  parts.push({
    name: 'Back', role: 'back', material: 'back', length: backH, width: endB - ta + dd - rw, thickness: bt, cut: true,
    note: 'Side wall leg; butts the other back in the corner',
    boxes: [vb(rw - bt, backBottom, rw, bt, backH, endB - ta - rw)],
  });

  // L-shaped bottom and top, cut from a rectangle with the front corner notched out
  const lW = endA - ta + dd - rw;
  const lD = endB - ta + dd - rw;
  const notchW = endA - ta + dd - boxD;
  const notchD = endB - ta + dd - boxD;
  const lBoxes = (y: number): VisualBox[] => [
    vb(rw, y, rw, endA - ta - rw, ta, boxD - rw),
    vb(rw, y, boxD, boxD - rw, ta, endB - ta - boxD),
  ];
  const lNote = `L-shaped: cut ${fmt(lW)} × ${fmt(lD)}, notch out ${fmt(notchW)} × ${fmt(notchD)} at the front corner`;
  parts.push({ name: 'Bottom', role: 'bottom', material: 'box', length: lW, width: lD, thickness: tn, cut: true, note: lNote, boxes: lBoxes(botTop - ta) });
  parts.push({ name: 'Top', role: 'top', material: 'box', length: lW, width: lD, thickness: tn, cut: true, note: lNote, boxes: lBoxes(topY) });

  // Toe kick nailer and skin along both front faces
  if (kick > 0) {
    const zN = D - kickBack - ta;
    const zS = D - s.toeKickDepth - s.toeKickSkin;
    parts.push({ name: 'Toe kick nailer', role: 'nailer', material: 'box', length: endA - ta - zN, width: kick, thickness: tn, cut: true, note: 'Scrap 3/4" ply',
      boxes: [vb(zN, 0, zN, endA - ta - zN, kick, ta)] });
    parts.push({ name: 'Toe kick nailer', role: 'nailer', material: 'box', length: endB - ta - zN - ta, width: kick, thickness: tn, cut: true, note: 'Scrap 3/4" ply',
      boxes: [vb(zN, 0, zN + ta, ta, kick, endB - ta - zN - ta)] });
    parts.push({ name: 'Toe kick skin', role: 'toekick', material: 'toeSkin', length: W - zS, width: kick, thickness: s.toeKickSkin, cut: true, note: 'Applied at install',
      boxes: [vb(zS, 0, zS, W - zS, kick, s.toeKickSkin)] });
    parts.push({ name: 'Toe kick skin', role: 'toekick', material: 'toeSkin', length: W2 - zS - s.toeKickSkin, width: kick, thickness: s.toeKickSkin, cut: true, note: 'Applied at install',
      boxes: [vb(zS, 0, zS + s.toeKickSkin, s.toeKickSkin, kick, W2 - zS - s.toeKickSkin)] });
  }

  // Two face frames meeting at the inside corner. The side-wall frame butts the face of the
  // back-wall frame, so the back-wall corner stile is cut wider by the frame thickness.
  const ffH = H - kick;
  const openH = ffH - s.topRailWidth - s.bottomRailWidth;
  const aX0 = D - ft; // back-wall frame starts behind the side-wall frame
  const aW = W - aX0;
  const bZ0 = D;
  const bW = W2 - bZ0;
  const frame = (leg: 'A' | 'B', from: number, len: number, cornerExtra: number) => {
    const box = (u: number, y: number, du: number, h: number) =>
      leg === 'A' ? vb(from + u, y, D - ft, du, h, ft) : vb(D - ft, y, from + u, ft, h, du);
    const label = leg === 'A' ? 'back wall face' : 'side wall face';
    const railLen = len - 2 * sw - cornerExtra;
    parts.push({ name: 'Corner stile', role: 'stile', material: 'faceframe', length: ffH, width: sw + cornerExtra, thickness: ft, cut: true, note: label, boxes: [box(0, kick, sw + cornerExtra, ffH)] });
    parts.push({ name: 'Stile', role: 'stile', material: 'faceframe', length: ffH, width: sw, thickness: ft, cut: true, note: label, boxes: [box(len - sw, kick, sw, ffH)] });
    parts.push({ name: 'Top rail', role: 'rail', material: 'faceframe', length: railLen, width: s.topRailWidth, thickness: ft, cut: true, note: label,
      boxes: [box(sw + cornerExtra, H - s.topRailWidth, railLen, s.topRailWidth)] });
    parts.push({ name: 'Bottom rail', role: 'rail', material: 'faceframe', length: railLen, width: s.bottomRailWidth, thickness: ft, cut: true, note: label,
      boxes: [box(sw + cornerExtra, kick, railLen, s.bottomRailWidth)] });
  };
  frame('A', aX0, aW, ft);
  frame('B', bZ0, bW, 0);

  // Bifold doors, one on each face, hinged to each other at the corner
  const style = styleById(s.doorStyleId);
  const stile = style.fixedStile ? style.stile : s.doorStile;
  const raised = !!style.panelChoice && !!panelByCode(s.centerPanel).raised;
  const material = style.line === 'MDF' ? 'MDF' : s.doorMaterial;
  const spec = style.profile === 'slab' ? `Slab, ${material}` : `${style.name}, ${material}, ${fmt(stile)} stiles${raised ? ', raised panel' : ''}`;
  const o = s.doorMount === 'inset' ? -s.insetReveal : s.doorOverlay;
  // At the corner the doors can only overlay so far before they hit each other
  const oc = s.doorMount === 'inset' ? -s.insetReveal : Math.min(o, sw - s.doorThickness - 0.0625);
  const dt = s.doorThickness;
  const zDoor = s.doorMount === 'inset' ? D - dt : D;
  const y0 = kick + s.bottomRailWidth - o;
  const dh = openH + 2 * o;
  const aOpen0 = D + sw; // visible corner stile on the back-wall face ends here
  const aDoorW = W - sw - aOpen0 + oc + o;
  const bOpen0 = D + sw;
  const bDoorW = W2 - sw - bOpen0 + oc + o;
  const doorA = frontBoxes(aOpen0 - oc, y0, zDoor, aDoorW, dh, dt, style.profile, stile, raised);
  const doorB = frontBoxes(0, y0, 0, bDoorW, dh, dt, style.profile, stile, raised).map((b) => {
    const [u, v, w0] = b.min;
    const [su, sv, sw0] = b.size;
    return vb(zDoor + w0, v, bOpen0 - oc + u, sw0, sv, su, b.shade);
  });
  const doorNote = 'Bifold pair: hinged to each other at the corner';
  parts.push({ name: 'Door', role: 'door', material: 'door', length: dh, width: aDoorW, thickness: dt, cut: false, note: doorNote,
    order: { item: 'door', w: aDoorW, h: dh, spec: `${spec}, bifold` }, boxes: doorA });
  parts.push({ name: 'Door', role: 'door', material: 'door', length: dh, width: bDoorW, thickness: dt, cut: false, note: doorNote,
    order: { item: 'door', w: bDoorW, h: dh, spec: `${spec}, bifold` }, boxes: doorB });

  // Lazy susan, or L-shaped shelves
  const shelves = corner.lazySusan ? 0 : c.rows[0]?.shelves ?? 0;
  for (let k = 1; k <= shelves; k++) {
    const y = botTop + ((topY - botTop) * k) / (shelves + 1) - ta / 2;
    parts.push({ name: 'Adjustable shelf', role: 'shelf', material: 'box', length: lW - dd * 2, width: lD - dd * 2, thickness: tn, cut: true, note: 'L-shaped, notch the front corner like the bottom',
      boxes: [vb(rw, y, rw, endA - ta - rw - 0.25, ta, boxD - rw - 0.5), vb(rw, y, boxD - 0.5, boxD - rw - 0.5, ta, endB - ta - boxD)] });
  }

  if (c.kind === 'base' && c.countertop) {
    const cd = D + dt + s.counterOverhang;
    parts.push({ name: 'Countertop', role: 'counter', material: 'counter', length: W, width: W2, thickness: s.counterThickness, cut: false,
      boxes: [vb(0, H, 0, W, s.counterThickness, cd), vb(0, H, cd, cd, s.counterThickness, W2 - cd)] });
  }

  if (corner.side === 'right') {
    for (const p of parts) p.boxes = p.boxes.map((b) => ({ ...b, min: [W - b.min[0] - b.size[0], b.min[1], b.min[2]] }));
  }
  return parts;
}
