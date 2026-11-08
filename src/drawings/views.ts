// The views on a drawing sheet, all drawn from the same parts the 3D view and cut list use:
// wall elevations, the floor plan, and per-cabinet face frame elevations and side sections.
import { tvSize, tvsOf } from '../model/tv';
import { tablesOf } from '../model/tableParts';
import type { Cabinet, Part, Project, WallId } from '../model/types';
import { buildParts, eff, topThick } from '../model/parts';
import { footprint, resolveEnds, wallLength, wallNames, wallTransform } from '../model/layout';
import { cabinetMoldings, mountShape, profileByNum, profileLabel } from '../model/moldings';
import { casingReach, openingTrim, roomMoldings, wallAccentBoxes } from '../model/room';
import { View, dimText, fitScale, type Frame } from './draw';
import { canSpots } from '../model/lighting';
import { hasSlopes, wallCeiling } from '../model/ceiling';
import { applianceName, placedAppliances, type PlacedAppliance } from '../model/appliances';
import { mantelLayout, mantelOf } from '../model/mantel';
import { pullSpots } from '../model/pulls';
import { beadCorner, cofferLayout, cofferOf, coffers, fasciaHeight, perimOf, underFascia } from '../model/coffer';

export const partsOf = (p: Project, c: Cabinet) => buildParts(c, p.settings, resolveEnds(p.room, p.cabinets, c));
export const cabinetsOn = (p: Project, wall: WallId) => p.cabinets.filter((c) => c.wall === wall).sort((a, b) => a.offset - b.offset);
const isFloor = (c: Cabinet) => c.elevation < 6 && c.kind !== 'shelf';

interface Item { x: number; y: number; w: number; h: number; z: number; cls: string; pts?: [number, number][]; circle?: boolean }

/**
 * Knobs and pulls where they'd go, or the finger grips routed in their place: knobs as circles,
 * pulls as bars, finger pulls as a thin band along the pull edge.
 */
export function hardwareItems(p: Project, c: Cabinet, parts: Part[]): Item[] {
  return pullSpots(p, c, parts).map((h): Item => {
    const z = 100 + h.z;
    if (h.kind === 'knob') return { x: c.offset + h.x, y: c.elevation + h.y, w: 0.65, h: 0, z, cls: 'hw', circle: true };
    const t = h.kind === 'finger' ? 0.4 : 0.5;
    const cls = h.kind === 'finger' ? 'hw finger' : 'hw';
    // Centered on its line (a finger grip's line is just inside the front's edge)
    if (h.vertical) return { x: c.offset + h.x - t / 2, y: c.elevation + h.y, w: t, h: h.len, z, cls };
    return { x: c.offset + h.x, y: c.elevation + h.y - t / 2, w: h.len, h: t, z, cls };
  });
}

/** Everything seen looking straight at a wall, in wall coordinates, nearest last. */
function elevationItems(p: Project, wall: WallId): Item[] {
  const items: Item[] = [];
  const H = p.room.height;
  for (const w of p.panels ?? []) if (w.wall === wall) items.push({ x: w.offset, y: w.bottom, w: w.width, h: w.height, z: 0.1, cls: 'ghost' });
  for (const pc of roomMoldings(p, wall)) {
    const prof = profileByNum(pc.num);
    if (prof) items.push({ x: pc.x, y: pc.y, w: pc.length, h: mountShape(prof).height, z: 0.5, cls: 'o' });
  }
  for (const o of p.openings ?? []) {
    if (o.wall !== wall) continue;
    const t = openingTrim(o);
    for (const b of t.boxes) items.push({ x: b.min[0], y: b.min[1], w: b.size[0], h: b.size[1], z: 0.8 + b.min[2], cls: 'o' });
    for (const pc of t.pieces) {
      const prof = profileByNum(pc.num);
      if (!prof) continue;
      const m = mountShape(prof);
      if (pc.vertical === 'left') items.push({ x: pc.x - m.height, y: pc.y, w: m.height, h: pc.length, z: 0.9, cls: 'o' });
      else if (pc.vertical === 'right') items.push({ x: pc.x, y: pc.y, w: m.height, h: pc.length, z: 0.9, cls: 'o' });
      else items.push({ x: pc.x, y: pc.y, w: pc.length, h: m.height, z: 0.9, cls: 'o' });
    }
    items.push({ x: o.offset, y: o.sill, w: o.width, h: o.height, z: 0.2, cls: o.kind === 'window' ? 'glass' : 'o' });
    if (o.kind === 'window') items.push({ x: o.offset + 1.5, y: o.sill + o.height / 2 - 0.75, w: o.width - 3, h: 1.5, z: 0.3, cls: 'o' });
  }
  for (const c of cabinetsOn(p, wall)) {
    const cparts = partsOf(p, c);
    items.push(...hardwareItems(p, c, cparts));
    for (const part of cparts) {
      for (const b of part.boxes) items.push({ x: c.offset + b.min[0], y: c.elevation + b.min[1], w: b.size[0], h: b.size[1], z: 10 + b.min[2] + b.size[2], cls: part.role === 'counter' || part.role === 'woodTop' ? 'cut' : 'o' });
      for (const s of part.shapes ?? []) {
        if (s.along === 'x') items.push({ x: 0, y: 0, w: 1, h: 1, z: 10 + s.min[2] + s.thickness, cls: 'o', pts: s.outline.map(([u, v]) => [c.offset + s.min[0] + u, c.elevation + s.min[1] + v]) });
        // Seen end-on (a corbel under a shelf): its width by its height
        else items.push({ x: c.offset + s.min[0], y: c.elevation + s.min[1], w: s.thickness, h: Math.max(...s.outline.map((q) => q[1])), z: 10 + s.min[2] + Math.max(...s.outline.map((q) => q[0])), cls: 'o' });
      }
    }
    for (const ap of placedAppliances(c, p.settings)) items.push(...applianceItems(ap, c.offset, c.elevation, 10 + ap.min[2] + ap.size[2]));
    for (const pc of cabinetMoldings(c, eff(c, p.settings), resolveEnds(p.room, p.cabinets, c), { noCrown: underFascia(p, c) })) {
      if (pc.along !== 'x') continue;
      const prof = profileByNum(pc.num);
      if (!prof) continue;
      const h = mountShape(prof).height;
      items.push({ x: c.offset + pc.x, y: c.elevation + (pc.hang ? pc.y - h : pc.y), w: pc.length, h, z: 10 + pc.z + 2, cls: 'o' });
    }
  }
  // The coffered ceiling's perimeter fascia across the top of the wall, and the picture moulding under it
  const cc = cofferOf(p);
  if (cc.on && cc.perimeter) {
    const L = wallLength(p.room, wall);
    const fb = H - fasciaHeight(cc);
    const zf = 10 + perimOf(cc, wall);
    items.push({ x: 0, y: fb, w: L, h: H - fb, z: zf, cls: 'o' });
    const pic = profileByNum(cc.picture);
    if (pic) {
      const m = mountShape(pic);
      items.push({ x: 0, y: fb - m.height, w: L, h: m.height, z: zf + m.depth, cls: 'o' });
    }
  }
  // Furthest first, so nearer parts cover what's behind them
  return items.filter((i) => i.y < H + 24).sort((a, b) => a.z - b.z);
}

/** An appliance in elevation: its outline, shaded, with the face detail that says what it is. */
function applianceItems(ap: PlacedAppliance, x0: number, y0: number, z: number): Item[] {
  const [x, y] = [x0 + ap.min[0], y0 + ap.min[1]], [w, h] = [ap.size[0], ap.size[1]];
  const out: Item[] = [{ x, y, w, h, z, cls: 'appl' }];
  const k = ap.a.kind;
  if (k === 'microwave' || k === 'builtInMicrowave') out.push({ x: x + 0.6, y: y + 0.6, w: w * 0.68, h: h - 1.2, z: z + 0.01, cls: 'glass' });
  else if (k === 'oven') out.push({ x: x + 1.5, y: y + 2, w: w - 3, h: h - 7, z: z + 0.01, cls: 'glass' });
  else if (k === 'fireplace' || k === 'gasInsert' || k === 'masonry') out.push({ x: x + 0.75, y: y + 0.75, w: w - 1.5, h: h - 1.5, z: z + 0.01, cls: 'firebox' });
  else if (k === 'beverage' || k === 'tv') out.push({ x: x + 1, y: y + 1, w: w - 2, h: h - 2, z: z + 0.01, cls: 'glass' });
  else if (k === 'microwaveDrawer') out.push({ x: x + w / 2 - 4, y: y + h / 2 - 0.4, w: 8, h: 0.8, z: z + 0.01, cls: 'o' });
  return out;
}

function drawItems(v: View, items: Item[]) {
  for (const i of items) {
    if (i.pts) v.poly(i.pts, i.cls);
    else if (i.circle) v.circle(i.x, i.y, i.w, i.cls);
    else v.rect(i.x, i.y, i.w, i.h, i.cls);
  }
}

/** A wall elevation: the room's wall, openings, trim and cabinets, dimensioned for the customer or the shop. */
export function wallElevation(p: Project, wall: WallId, frame: Frame, mode: 'customer' | 'shop', cuts: { at: number; ref: string }[] = []): { svg: string; scale: number } {
  const L = wallLength(p.room, wall);
  const H = p.room.height;
  const margin = mode === 'shop' ? 1.5 : 1.25;
  const perFoot = fitScale(L, H, frame.w - 2 * margin, frame.h - 2 * margin);
  const v = new View(frame, { x0: 0, y0: 0, x1: L, y1: H }, perFoot);
  // The wall: ceiling and floor lines, ends in section
  v.rect(-4.5, 0, 4.5, H, 'wall');
  v.rect(L, 0, 4.5, H, 'wall');
  v.line(-4.5, 0, L + 4.5, 0, 'heavy');
  // The ceiling: flat, or following the slopes along this wall
  if (hasSlopes(p.room)) {
    const pts = wallCeiling(p.room, wall);
    for (let i = 0; i + 1 < pts.length; i++) v.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 'heavy');
    // The flat ceiling beyond, where the slope comes down in front of this wall
    v.line(0, H, L, H, 'ghost');
  } else v.line(0, H, L, H, 'f');
  // The wall's accent (wainscot, shiplap, slats...) behind everything in front of it
  for (const b of wallAccentBoxes(p, wall)) v.rect(b.min[0], b.min[1], b.size[0], b.size[1], 'thin');
  drawItems(v, elevationItems(p, wall));
  v.line(-4.5, 0, L + 4.5, 0, 'heavy');

  const cabs = cabinetsOn(p, wall);
  const floor = cabs.filter(isFloor);
  const uppers = cabs.filter((c) => !isFloor(c));
  // Widths along the bottom (base and tall) and the top (uppers), then the whole wall
  v.chainH([0, L, ...floor.flatMap((c) => [c.offset, c.offset + c.width])], 0, -0.48);
  if (uppers.length) v.chainH([0, L, ...uppers.flatMap((c) => [c.offset, c.offset + c.width])], H, 0.35);
  v.dimH(0, L, 0, -0.83, undefined, true);
  // Heights up the right side: counter, bottom and top of the uppers, ceiling
  const tops = floor.filter((c) => c.kind === 'base').map((c) => c.elevation + c.height + (c.countertop ? topThick(c) : 0));
  const cc = cofferOf(p);
  const fasciaY = cc.on && cc.perimeter ? [H - fasciaHeight(cc), ...(profileByNum(cc.picture) ? [H - fasciaHeight(cc) - mountShape(profileByNum(cc.picture)!).height] : [])] : [];
  const ys = [0, H, ...tops, ...uppers.flatMap((c) => [c.elevation, c.elevation + c.height]), ...fasciaY];
  v.chainV(ys, L + 4.5, 0.35);
  v.dimV(0, H, L + 4.5, 0.75, undefined, true);
  // Cabinet tags, and opening sizes
  // Tags: uppers in their middle, floor cabinets just under the floor line, clear of hardware
  for (const c of cabs) v.tag(c.offset + c.width / 2, isFloor(c) ? -v.p(0.2) : c.elevation + c.height / 2, c.name);
  for (const o of p.openings ?? []) {
    if (o.wall !== wall) continue;
    v.text(o.offset + o.width / 2, o.sill + o.height + casingReach(o).head + v.p(0.08), `${o.name}: ${dimText(o.width)} × ${dimText(o.height)}`, 0.08);
  }
  // TVs on this wall: the set's outline, its size, and how high it hangs
  for (const t of tvsOf(p)) {
    if (t.wall !== wall) continue;
    const { w, h } = tvSize(t);
    v.rect(t.center - w / 2, t.bottom, w, h, 'appl');
    v.rect(t.center - w / 2 + 0.45, t.bottom + 0.55, w - 0.9, h - 1.1, 'glass');
    v.text(t.center, t.bottom + h / 2, `${t.size}" TV (${dimText(w)} × ${dimText(h)})`, 0.09);
    v.dimV(0, t.bottom, t.center + w / 2, 0.25, `${dimText(t.bottom)} to bottom of TV`);
  }
  if (mode === 'shop') {
    // Set height for the uppers, from the floor, once per height, outside the left wall
    const heights = [...new Set(uppers.map((c) => Math.round(c.elevation * 16) / 16))].sort((a, b) => a - b);
    heights.forEach((h, i) => v.dimV(0, h, -4.5, -0.35 - i * 0.3, `${dimText(h)} AFF to bottom of uppers`));
  }
  // Where wall sections are cut: a line through the wall with a bubble at each end naming the detail
  for (const c of cuts) {
    const top = H + v.p(0.75), bot = -v.p(0.25);
    v.line(c.at, bot, c.at, top, 'cutline');
    for (const y of [top, bot]) {
      v.circle(c.at, y + (y === top ? v.p(0.11) : -v.p(0.11)), v.p(0.11), 'tag');
      v.text(c.at, y + (y === top ? v.p(0.11) : -v.p(0.11)) - v.p(0.03), c.ref, 0.07, 'middle', 'tagt');
      const cy = y + (y === top ? v.p(0.11) : -v.p(0.11));
      v.hit(c.at - v.p(0.12), cy - v.p(0.12), v.p(0.24), v.p(0.24), { field: 'goto', sheet: c.ref.split('/')[1] ?? '', name: `detail ${c.ref}` });
    }
  }
  v.text(L / 2, -v.p(1.12), wallNames[wall].toUpperCase(), 0.14, 'middle', 'lbl');
  return { svg: v.svg(), scale: perFoot };
}

/** The floor plan: walls, cabinets (uppers dashed), doors and windows, and runs dimensioned along each wall. */
export function floorPlan(p: Project, frame: Frame): { svg: string; scale: number } {
  const { width: W, depth: D } = p.room;
  const T = 4.5;
  const margin = 1.6;
  const perFoot = fitScale(W + 2 * T, D + 2 * T, frame.w - 2 * margin, frame.h - 2 * margin);
  const v = new View(frame, { x0: -T, y0: -T, x1: W + T, y1: D + T }, perFoot, false);
  v.rect(-T, -T, W + 2 * T, T, 'wall'); v.rect(-T, D, W + 2 * T, T, 'wall');
  v.rect(-T, 0, T, D, 'wall'); v.rect(W, 0, T, D, 'wall');
  // Openings: a gap in the wall, a window's glass lines or a door's swing
  const along = (wall: WallId, t: number): [number, number] => { const { pos } = wallTransform(p.room, wall, t); return [pos[0], pos[2]]; };
  for (const o of p.openings ?? []) {
    const a = along(o.wall, o.offset), b = along(o.wall, o.offset + o.width);
    const horiz = o.wall === 'back' || o.wall === 'front';
    const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), z0 = Math.min(a[1], b[1]), z1 = Math.max(a[1], b[1]);
    if (horiz) v.rect(x0, o.wall === 'back' ? -T : D, x1 - x0, T, 'o');
    else v.rect(o.wall === 'left' ? -T : W, z0, T, z1 - z0, 'o');
    if (o.kind === 'window') {
      if (horiz) { const zc = o.wall === 'back' ? -T / 2 : D + T / 2; v.line(x0, zc - 0.6, x1, zc - 0.6, 'thin'); v.line(x0, zc + 0.6, x1, zc + 0.6, 'thin'); }
      else { const xc = o.wall === 'left' ? -T / 2 : W + T / 2; v.line(xc - 0.6, z0, xc - 0.6, z1, 'thin'); v.line(xc + 0.6, z0, xc + 0.6, z1, 'thin'); }
    } else if (o.kind === 'door') {
      // Swing into the room from the hinge side (as seen from inside, facing the door)
      const hingeAtStart = (o.door?.hinge ?? 'left') === 'left';
      const hinge = hingeAtStart ? a : b, free = hingeAtStart ? b : a;
      const inward: [number, number] = o.wall === 'back' ? [0, 1] : o.wall === 'front' ? [0, -1] : o.wall === 'left' ? [1, 0] : [-1, 0];
      const r = o.width;
      const open: [number, number] = [hinge[0] + inward[0] * r, hinge[1] + inward[1] * r];
      v.line(hinge[0], hinge[1], open[0], open[1], 'o');
      // Sweep direction from the turn between the two radii, on paper (y down)
      const ax = v.X(open[0]) - v.X(hinge[0]), ay = v.Y(open[1]) - v.Y(hinge[1]);
      const bx = v.X(free[0]) - v.X(hinge[0]), by = v.Y(free[1]) - v.Y(hinge[1]);
      const sw = ax * by - ay * bx > 0 ? 1 : 0;
      v.path(`M${v.X(open[0])},${v.Y(open[1])} A${(r * v.k).toFixed(4)},${(r * v.k).toFixed(4)} 0 0 ${sw} ${v.X(free[0])},${v.Y(free[1])}`, 'thin');
    }
  }
  // Cabinets: bases solid, uppers dashed over them
  const ordered = [...p.cabinets].sort((a, b) => Number(!isFloor(a)) - Number(!isFloor(b)));
  const prints = ordered.map((c) => ({ c, f: footprint(p.room, c) }));
  for (const { c, f } of prints) v.rect(f.x0, f.z0, f.x1 - f.x0, f.z1 - f.z0, isFloor(c) ? 'o' : 'hid');
  // Free-standing tables: the top's outline (and the lip inside it), named
  for (const { t, place } of tablesOf(p)) {
    const [lx, lz] = place.turned ? [t.width, t.length] : [t.length, t.width];
    v.rect(place.x - lx / 2, place.z - lz / 2, lx, lz, 'o');
    if (t.lip) { const w = t.lipWidth ?? 0.75; v.rect(place.x - lx / 2 + w, place.z - lz / 2 + w, lx - 2 * w, lz - 2 * w, 'thin'); }
    v.text(place.x, place.z + v.p(0.03), t.name, 0.075, 'middle', 'tagt');
  }
  // Labels: an upper's in its outline; a base under one gets its label in the strip in front of it
  const overlap = (a: typeof prints[0]['f'], b: typeof prints[0]['f']) => a.x0 < b.x1 - 0.5 && b.x0 < a.x1 - 0.5 && a.z0 < b.z1 - 0.5 && b.z0 < a.z1 - 0.5;
  for (const { c, f } of prints) {
    let x = (f.x0 + f.x1) / 2, z = (f.z0 + f.z1) / 2;
    const above = isFloor(c) ? prints.find((o) => !isFloor(o.c) && overlap(o.f, f)) : undefined;
    if (above) {
      const a = above.f;
      if (c.wall === 'back') z = (a.z1 + f.z1) / 2; else if (c.wall === 'front') z = (f.z0 + a.z0) / 2;
      else if (c.wall === 'left') x = (a.x1 + f.x1) / 2; else x = (f.x0 + a.x0) / 2;
    }
    v.text(x, z + v.p(0.03), c.name, 0.075, 'middle', 'tagt');
  }
  // Runs along each wall, outside the room, then the wall's length
  const runs: Record<WallId, (cs: Cabinet[]) => void> = {
    // (y runs down the page here, so a positive offset is up, away from the room)
    back: (cs) => { if (cs.length) v.chainH([0, W, ...cs.flatMap((c) => [c.offset, c.offset + c.width])], -T, 0.3); v.dimH(0, W, -T, cs.length ? 0.65 : 0.3, undefined, true); },
    front: (cs) => { if (cs.length) v.chainH([0, W, ...cs.flatMap((c) => [W - c.offset - c.width, W - c.offset])], D + T, -0.3); v.dimH(0, W, D + T, cs.length ? -0.65 : -0.3, undefined, true); },
    left: (cs) => { if (cs.length) v.chainV([0, D, ...cs.flatMap((c) => [D - c.offset - c.width, D - c.offset])], -T, -0.3); v.dimV(0, D, -T, cs.length ? -0.65 : -0.3, undefined, true); },
    right: (cs) => { if (cs.length) v.chainV([0, D, ...cs.flatMap((c) => [c.offset, c.offset + c.width])], W + T, 0.3); v.dimV(0, D, W + T, cs.length ? 0.65 : 0.3, undefined, true); },
  };
  for (const w of ['back', 'left', 'right', 'front'] as WallId[]) runs[w](cabinetsOn(p, w));
  return { svg: v.svg(), scale: perFoot };
}

/** A mantel straight on and from the side: legs, frieze, shelf, corbels and the opening, dimensioned for the shop. */
export function mantelViews(p: Project, c: Cabinet, front: Frame, side: Frame): { svg: string; scale: number } {
  const parts = partsOf(p, c);
  const m = mantelOf(c);
  const L = mantelLayout(c, m);
  const oh = m.shelfOverhang;
  const topY = c.height + (m.pediment !== 'none' ? m.pedimentH : 0);
  const perFoot = Math.min(fitScale(c.width + 2 * oh, topY, front.w - 2.2, front.h - 1.9), fitScale(m.shelfDepth + 2, topY, side.w - 1.6, side.h - 1.9));
  const v = new View(front, { x0: -oh, y0: 0, x1: c.width + oh, y1: topY }, perFoot);
  const items: { x: number; y: number; w: number; h: number; z: number; cls: string; pts?: [number, number][] }[] = [];
  for (const ap of placedAppliances(c, p.settings)) items.push(...applianceItems(ap, 0, 0, 0.5));
  for (const part of parts) {
    for (const b of part.boxes) items.push({ x: b.min[0], y: b.min[1], w: b.size[0], h: b.size[1], z: 10 + b.min[2] + b.size[2], cls: 'o' });
    for (const s of part.shapes ?? []) {
      if (s.along === 'x') items.push({ x: 0, y: 0, w: 1, h: 1, z: 10 + s.min[2] + s.thickness, cls: 'o', pts: s.outline.map(([u, q]) => [s.min[0] + u, s.min[1] + q]) });
      else items.push({ x: s.min[0], y: s.min[1], w: s.thickness, h: Math.max(...s.outline.map((q) => q[1])), z: 10 + s.min[2] + 2, cls: 'o' });
    }
  }
  for (const pc of cabinetMoldings(c, eff(c, p.settings), resolveEnds(p.room, p.cabinets, c))) {
    const prof = profileByNum(pc.num);
    if (!prof || pc.along !== 'x') continue;
    items.push({ x: pc.x, y: pc.y, w: pc.length, h: mountShape(prof).height, z: 10 + pc.z + 2, cls: 'o' });
  }
  items.sort((a, b) => a.z - b.z);
  drawItems(v, items);
  v.line(-oh - 2, 0, c.width + oh + 2, 0, 'heavy');
  // Overall, legs and opening across the bottom; shelf across the top; heights up the side
  const ox0 = c.width / 2 - m.openingW / 2, ox1 = c.width / 2 + m.openingW / 2;
  v.chainH([0, c.width, ...(L.legW ? [L.legW, c.width - L.legW] : []), ox0, ox1], 0, -0.35);
  v.dimH(-oh, c.width + oh, topY, 0.3, `${dimText(c.width + 2 * oh)} shelf`);
  v.chainV([0, m.openingY, L.openTop, L.friezeBottom, L.shelfBottom, c.height, topY].filter((y, i, a) => a.indexOf(y) === i).sort((a, b) => a - b), c.width + oh, 0.3);
  v.text(c.width / 2, -v.p(0.8), 'MANTEL, FRONT', 0.12, 'middle', 'lbl');
  // Side: the wall, leg and frieze depth, shelf and corbels in profile
  const sv = new View(side, { x0: -1, y0: 0, x1: m.shelfDepth + 1, y1: topY }, perFoot);
  sv.rect(-1, 0, 1, topY, 'wall');
  sv.rect(0, 0, L.legFace, L.capTop, 'cut');
  sv.rect(0, L.shelfBottom, m.shelfDepth, m.shelfThickness, 'cut');
  if (m.plinth > 0) sv.rect(L.legFace, 0, m.blockProud, m.plinth, 'o');
  if (m.capital > 0) sv.rect(L.legFace, L.capTop - m.capital, m.blockProud, m.capital, 'o');
  for (const part of parts) for (const s of part.shapes ?? []) if (s.along === 'z') sv.poly(s.outline.map(([u, q]) => [s.min[2] + u, s.min[1] + q]), 'o');
  const bed = profileByNum(c.crown);
  if (bed) { const bm = mountShape(bed); sv.poly(bm.pts.map(([u, q]) => [L.legFace + u, L.shelfBottom - bm.height + q]), 'o'); }
  sv.line(-1, 0, m.shelfDepth + 1, 0, 'heavy');
  sv.chainH([0, c.depth, L.legFace, m.shelfDepth].filter((x, i, a) => a.indexOf(x) === i).sort((a, b) => a - b), topY, 0.3);
  sv.text(m.shelfDepth / 2, -v.p(0.8), 'SIDE', 0.12, 'middle', 'lbl');
  return { svg: v.svg() + sv.svg(), scale: perFoot };
}

/** One cabinet's face frame, straight on, with stile, rail and opening sizes. */
export function faceFrameView(p: Project, c: Cabinet, frame: Frame): { svg: string; scale: number } {
  const parts = partsOf(p, c);
  const ff = parts.filter((x) => x.material === 'faceframe' && (x.role === 'stile' || x.role === 'rail'));
  const boxes = ff.flatMap((x) => x.boxes);
  const shapes = ff.flatMap((x) => x.shapes ?? []).filter((s) => s.along === 'x');
  const x0 = Math.min(...boxes.map((b) => b.min[0]), ...shapes.map((s) => s.min[0])), x1 = Math.max(...boxes.map((b) => b.min[0] + b.size[0]), ...shapes.map((s) => s.min[0] + Math.max(...s.outline.map((q) => q[0]))));
  const y0 = Math.min(...boxes.map((b) => b.min[1]), ...shapes.map((s) => s.min[1])), y1 = Math.max(...boxes.map((b) => b.min[1] + b.size[1]));
  const perFoot = fitScale(x1 - x0, y1 - y0, frame.w - 2.2, frame.h - 1.9);
  const v = new View(frame, { x0, y0, x1, y1 }, perFoot);
  // Doors and fronts as ghosts behind, so the openings read; appliances labeled in their openings
  for (const part of parts.filter((x) => x.role === 'door' || x.role === 'drawerFront')) for (const b of part.boxes) v.rect(b.min[0], b.min[1], b.size[0], b.size[1], 'hid');
  for (const ap of placedAppliances(c, p.settings)) {
    v.rect(ap.min[0], ap.min[1], ap.size[0], ap.size[1], 'hid');
    v.text(ap.min[0] + ap.size[0] / 2, ap.min[1] + ap.size[1] / 2, applianceName(ap.a).toUpperCase(), 0.09, 'middle', 'dt');
  }
  for (const part of ff) {
    for (const b of part.boxes) v.rect(b.min[0], b.min[1], b.size[0], b.size[1], 'o');
    for (const s of part.shapes ?? []) if (s.along === 'x') v.poly(s.outline.map(([u, q]) => [s.min[0] + u, s.min[1] + q]), 'o');
  }
  // Stiles across the top, rails up the side, then overall size
  const stileXs = ff.filter((x) => x.role === 'stile').flatMap((x) => x.boxes.flatMap((b) => [b.min[0], b.min[0] + b.size[0]]));
  v.chainH([x0, x1, ...stileXs], y1, 0.3);
  const railYs = ff.filter((x) => x.role === 'rail').flatMap((x) => x.boxes.flatMap((b) => [b.min[1], b.min[1] + b.size[1]]));
  v.chainV([y0, y1, ...railYs], x1, 0.3);
  v.dimH(x0, x1, y0, -0.35);
  v.dimV(y0, y1, x0, -0.35);
  return { svg: v.svg(), scale: perFoot };
}

/** A section through the cabinet, cut at its middle and seen from the left: depth, toe kick, box, face frame, door. */
export function sideSection(p: Project, c: Cabinet, frame: Frame): { svg: string; scale: number } {
  const parts = partsOf(p, c);
  // Cut through the middle of the first opening, clear of a center stile
  const stiles = parts.filter((x) => x.role === 'stile').flatMap((x) => x.boxes).sort((a, b) => a.min[0] - b.min[0]);
  // A third of the way into the first opening: through a door, not the gap between a pair
  const cx = stiles.length >= 2 ? stiles[0].min[0] + stiles[0].size[0] + (stiles[1].min[0] - stiles[0].min[0] - stiles[0].size[0]) * 0.3 : c.width * 0.3;
  const all = parts.flatMap((part) => part.boxes.map((b) => ({ part, b })));
  // Mouldings on the front, in profile (baseboard and cap, crown, light rail), to draw after the cut
  const moldPcs = cabinetMoldings(c, eff(c, p.settings), resolveEnds(p.room, p.cabinets, c)).flatMap((pc) => {
    const prof = pc.along === 'x' && pc.facing === 'front' ? profileByNum(pc.num) : undefined;
    if (!prof) return [];
    return [{ pc, prof, pts: mountShape(prof).pts.map(([u, q]) => [pc.z + u, pc.y + (pc.hang ? -q : q)] as [number, number]) }];
  });
  const molds = moldPcs.map((m) => m.pts);
  const mz = molds.flat().map(([z]) => z), my = molds.flat().map(([, y]) => y);
  const zMax = Math.max(c.depth, ...all.map(({ b }) => b.min[2] + b.size[2]), ...mz);
  const yMax = Math.max(c.height, ...all.map(({ b }) => b.min[1] + b.size[1]), ...my);
  const perFoot = fitScale(zMax, yMax, frame.w - 2.2, frame.h - 1.9);
  const v = new View(frame, { x0: 0, y0: 0, x1: zMax, y1: yMax }, perFoot);
  // The near side of the case, as a ghost
  for (const { part, b } of all) if (part.role === 'side' && b.min[0] < c.width / 2) v.rect(b.min[2], b.min[1], b.size[2], b.size[1], 'ghost');
  for (const part of parts) for (const s of part.shapes ?? []) if (s.along === 'z' && s.min[0] < c.width / 2 && !(s.min[0] <= cx && cx <= s.min[0] + s.thickness)) v.poly(s.outline.map(([u, q]) => [s.min[2] + u, s.min[1] + q]), 'ghost');
  // Shaped pieces the cut passes through (a top tilted to a sloped ceiling)
  for (const part of parts) for (const s of part.shapes ?? []) if (s.along === 'z' && s.min[0] <= cx && cx <= s.min[0] + s.thickness) v.poly(s.outline.map(([u, q]) => [s.min[2] + u, s.min[1] + q]), 'cut');
  // What the cut passes through
  const cut = all.filter(({ b }) => b.min[0] <= cx && cx <= b.min[0] + b.size[0]).sort((a, b) => a.b.min[0] - b.b.min[0]);
  for (const { part, b } of cut) v.rect(b.min[2], b.min[1], b.size[2], b.size[1], part.role === 'door' || part.role === 'drawerFront' || part.role === 'counter' ? 'o' : 'cut');
  for (const part of parts) for (const s of part.shapes ?? []) if (s.along === 'x' && s.min[0] <= cx) {
    const pts = s.outline;
    const top = Math.max(...pts.map((q) => q[1]));
    v.rect(s.min[2], s.min[1], s.thickness, top, 'cut');
  }
  for (const pts of molds) v.poly(pts, 'cut');
  // Name the base moulding and the platform, small, out in front of the cabinet
  for (const { pc, prof, pts } of moldPcs) {
    if (pc.kind !== 'baseMold') continue;
    const top = Math.max(...pts.map(([, y]) => y)), front = Math.max(...pts.map(([z]) => z));
    v.text(front + v.p(0.95), (pc.y + top) / 2, `${profileLabel(prof)} ${pc.y < 0.01 ? 'baseboard' : 'base cap'}`, 0.07, 'start', 'dt');
    if (pc.y < 0.01) v.dimV(0, top, front, 0.75);
  }
  const plat = parts.find((x) => x.name === 'Platform runner');
  if (plat) v.text(c.depth / 2, plat.width / 2, `${dimText(plat.width)} leveled platform`, 0.07, 'middle', 'dt');
  v.line(-2, 0, zMax + 2, 0, 'heavy');
  // Depths along the bottom and top, heights on the front
  const s = eff(c, p.settings);
  const ffFront = c.depth;
  const boxD = c.depth - s.ffThickness;
  v.dimH(0, ffFront, 0, -0.35, `${dimText(ffFront)} to face frame`);
  if (zMax - ffFront > 0.1) v.dimH(ffFront, zMax, 0, -0.35);
  v.dimH(0, boxD, yMax, 0.35, `${dimText(boxD)} box`);
  const kick = parts.find((x) => x.name === 'Toe kick skin');
  const ys = [0, c.height, yMax];
  if (kick) ys.push(kick.boxes[0].min[1] + kick.boxes[0].size[1]);
  const bottom = parts.find((x) => x.name === 'Bottom')?.boxes[0];
  const top = parts.find((x) => x.name === 'Top')?.boxes[0];
  if (bottom) ys.push(bottom.min[1] + bottom.size[1]);
  if (top) ys.push(top.min[1]);
  v.chainV(ys, zMax, 0.35);
  if (kick) v.dimH(kick.boxes[0].min[2] + kick.boxes[0].size[2], ffFront, kick.boxes[0].size[1], 0.25, `${dimText(ffFront - kick.boxes[0].min[2] - kick.boxes[0].size[2])} kick`);
  return { svg: v.svg(), scale: perFoot };
}

/** Shelf pin layout used on the side panel drawings: 5 mm holes on 32 mm centers, rows set in from front and back. */
export const PINS = { pitch: 32 / 25.4, inset: 1.5, clear: 2 };

/**
 * The left side as it goes on the bench, inside face up, front edge to the right: the dados and
 * rabbets it takes, the shelf pin rows, the toe notch, all dimensioned from the bottom and the back.
 * The right side is its mirror. Null for pieces with no case sides (pilasters, shelves, mantels).
 */
export function sidePanelLayout(p: Project, c: Cabinet, frame: Frame): { svg: string; scale: number; notes: string[] } | null {
  if (c.kind === 'pilaster' || c.kind === 'shelf' || c.kind === 'mantel' || c.corner) return null;
  const parts = partsOf(p, c);
  const sides = parts.filter((x) => x.role === 'side').map((x) => ({ part: x, x0: Math.min(...x.boxes.map((b) => b.min[0])) })).sort((a, b) => a.x0 - b.x0);
  if (!sides.length || !sides[0].part.boxes.length) return null;
  const side = sides[0].part;
  const inner = Math.min(...side.boxes.map((b) => b.min[0] + b.size[0]));
  const H = Math.max(...side.boxes.map((b) => b.min[1] + b.size[1]));
  const Y0 = Math.min(...side.boxes.map((b) => b.min[1]));
  const D = Math.max(...side.boxes.map((b) => b.min[2] + b.size[2]));
  const perFoot = fitScale(D, H - Y0, frame.w - 1.6, frame.h - 1.2);
  const v = new View(frame, { x0: 0, y0: Y0, x1: D, y1: H }, perFoot);
  const notes: string[] = [];
  const st = eff(c, p.settings);
  const dd = st.dadoDepth;
  // The panel
  const shaped = (side.shapes ?? []).find((sh) => sh.along === 'z');
  if (shaped) v.poly(shaped.outline.map(([u, q]) => [u, shaped.min[1] + q]), 'o');
  else for (const b of side.boxes) v.rect(b.min[2], b.min[1], b.size[2], b.size[1], 'o');
  // What lands on its inside face
  const touching = parts.filter((x) => x !== side && x.role !== 'side' && x.boxes.some((b) => Math.abs(b.min[0] - inner) < 0.05 && b.size[0] > 1));
  const joints: { y0: number; y1: number; z0: number; z1: number; kind: 'dado' | 'rabbet'; name: string }[] = [];
  const pinShelves: number[] = [];
  for (const x of touching) {
    const b = x.boxes.find((bb) => Math.abs(bb.min[0] - inner) < 0.05)!;
    const note = x.note ?? '';
    if (/dado/i.test(note) || x.role === 'bottom' || (x.role === 'top' && !/rabbet/i.test(note))) joints.push({ y0: b.min[1], y1: b.min[1] + b.size[1], z0: b.min[2], z1: b.min[2] + b.size[2], kind: 'dado', name: x.name });
    else if (/rabbet/i.test(note) && x.role !== 'back') joints.push({ y0: b.min[1], y1: b.min[1] + b.size[1], z0: b.min[2], z1: b.min[2] + b.size[2], kind: 'rabbet', name: x.name });
    else if (x.role === 'shelf') pinShelves.push(b.min[1]);
  }
  for (const j of joints) {
    v.rect(j.z0, j.y0, j.z1 - j.z0, j.y1 - j.y0, 'cut');
    const stopped = j.kind === 'dado' && D - j.z1 > 0.3;
    if (stopped) v.text(j.z1 + v.p(0.04), (j.y0 + j.y1) / 2 - v.p(0.03), `stop ${dimText(D - j.z1)}`, 0.065, 'start', 'dt');
  }
  // The back rabbet runs the height of the back
  const back = parts.find((x) => x.role === 'back');
  if (back?.boxes[0]) {
    const bb = back.boxes[0];
    const rw = bb.min[2] + bb.size[2];
    v.rect(0, bb.min[1], rw, Math.min(H, bb.min[1] + bb.size[1]) - bb.min[1], 'hid');
    notes.push(`Back rabbet ${dimText(rw)} wide × ${dimText(dd)} deep${bb.min[1] > Y0 + 0.05 ? `, from ${dimText(bb.min[1] - Y0)} up` : ''}`);
  }
  // Shelf pin rows between the fixed parts above and below each adjustable shelf
  const fixedYs = joints.map((j) => [j.y0, j.y1] as const).sort((a, b) => a[0] - b[0]);
  const zones = new Map<string, [number, number, number]>();
  for (const y of pinShelves) {
    const below = fixedYs.filter((f) => f[1] <= y + 0.01).pop();
    const above = fixedYs.find((f) => f[0] >= y + 0.5);
    const lo = (below ? below[1] : Y0) + PINS.clear, hi = (above ? above[0] : H) - PINS.clear;
    if (hi > lo) zones.set(`${lo.toFixed(3)}|${hi.toFixed(3)}`, [lo, hi, below ? below[1] : Y0]);
  }
  const rw0 = back?.boxes[0] ? back.boxes[0].min[2] + back.boxes[0].size[2] : 0;
  const rows = [rw0 + PINS.inset, D - PINS.inset];
  let holes = 0;
  for (const [lo, hi, base] of zones.values()) {
    const n = Math.floor((hi - lo) / PINS.pitch) + 1;
    const start = lo + ((hi - lo) - (n - 1) * PINS.pitch) / 2;
    for (let i = 0; i < n; i++) for (const z of rows) v.circle(z, start + i * PINS.pitch, Math.max(0.1, v.p(0.012)), 'f');
    holes += n * rows.length;
    v.dimV(start, start + (n - 1) * PINS.pitch, rows[1], 0.22, `${n} holes`);
    v.dimV(base, start, rows[1], 0.22);
  }
  if (holes) notes.push(`Shelf pins: 5 mm holes on 32 mm centers, rows ${dimText(PINS.inset)} from the back rabbet and the front edge (${holes} a side)`);
  // Toe notch
  const foot = side.boxes.length > 1 ? side.boxes.find((b) => b.min[1] <= Y0 + 0.01 && b.min[2] + b.size[2] < D - 0.05) : null;
  if (foot) {
    const top = foot.min[1] + foot.size[1];
    v.dimH(foot.min[2] + foot.size[2], D, Y0, -0.3, `${dimText(D - foot.min[2] - foot.size[2])} notch`);
    v.dimV(Y0, top, D, 0.42, `${dimText(top - Y0)} kick`);
  }
  // Heights on the back edge: to the bottom of each dado and rabbet; overall height and depth
  v.chainV([Y0, ...joints.map((j) => j.y0), H], 0, -0.3);
  v.dimV(Y0, H, 0, -0.62, `${dimText(H - Y0)} side`);
  v.dimH(0, D, H, 0.3, `${dimText(D)}`);
  if (rw0) v.dimH(0, rw0, H, 0.12);
  const dados = joints.filter((j) => j.kind === 'dado');
  if (dados.length) notes.push(`Dados ${dimText(dd)} deep for ${[...new Set(dados.map((j) => j.name.toLowerCase()))].join(', ')}; heights to the bottom of each`);
  const rabbets = joints.filter((j) => j.kind === 'rabbet');
  if (rabbets.length) notes.push(`Rabbets ${dimText(dd)} deep across the top for the ${[...new Set(rabbets.map((j) => j.name.toLowerCase()))].join(' and ')}`);
  notes.push('Right side is the mirror image');
  return { svg: v.svg(), scale: perFoot, notes };
}

/** Parts for one cabinet, identical ones counted together. */
export function partRows(parts: Part[]) {
  const rows = new Map<string, { part: Part; qty: number }>();
  for (const part of parts) {
    const key = [part.name, part.length, part.width, part.thickness, part.material, part.note ?? ''].join('|');
    const r = rows.get(key);
    if (r) r.qty++; else rows.set(key, { part, qty: 1 });
  }
  return [...rows.values()];
}

/** The ceiling looking up, drawn as a plan (back wall at the top): beams, perimeter fascia, coffer sizes. */
export function ceilingPlan(p: Project, frame: Frame, show: { lights?: boolean; centers?: boolean } = {}): { svg: string; scale: number } {
  const { width: W, depth: D } = p.room;
  const T = 4.5;
  const c = cofferOf(p);
  const L = cofferLayout(p, c);
  const perFoot = fitScale(W + 2 * T, D + 2 * T, frame.w - 1.8, frame.h - 1.9);
  const v = new View(frame, { x0: -T, y0: -T, x1: W + T, y1: D + T }, perFoot, false);
  v.rect(-T, -T, W + 2 * T, T, 'wall'); v.rect(-T, D, W + 2 * T, T, 'wall');
  v.rect(-T, 0, T, D, 'wall'); v.rect(W, 0, T, D, 'wall');
  if (c.perimeter) {
    const Pb = perimOf(c, 'back'), Pf = perimOf(c, 'front'), Pl = perimOf(c, 'left'), Pr = perimOf(c, 'right');
    v.rect(0, 0, W, Pb, 'ghost'); v.rect(0, D - Pf, W, Pf, 'ghost'); v.rect(0, Pb, Pl, D - Pb - Pf, 'ghost'); v.rect(W - Pr, Pb, Pr, D - Pb - Pf, 'ghost');
  }
  const f = L.field;
  for (const b of L.beamsZ) v.rect(f.x0, b.a, f.x1 - f.x0, b.b - b.a, 'ghost');
  for (const b of L.beamsX) v.rect(b.a, f.z0, b.b - b.a, f.z1 - f.z0, 'ghost');
  // The soffit's recessed bottom, inside each beam's fascias
  const t = c.fascia;
  for (const b of L.beamsZ) v.line(f.x0, b.a + t, f.x1, b.a + t, 'thin'), v.line(f.x0, b.b - t, f.x1, b.b - t, 'thin');
  for (const b of L.beamsX) v.line(b.a + t, f.z0, b.a + t, f.z1, 'thin'), v.line(b.b - t, f.z0, b.b - t, f.z1, 'thin');
  for (const k of coffers(p, c)) {
    v.rect(k.x0, k.z0, k.x1 - k.x0, k.z1 - k.z0, c.beadboard ? 'f' : 'f');
    if (c.beadboard) for (let x = k.x0 + 3.5; x < k.x1 - 1; x += 3.5) v.line(x, k.z0 + 2, x, k.z1 - 2, 'thin');
    // The size under the light when the lights show, so the two don't overlap
    v.text((k.x0 + k.x1) / 2, (k.z0 + k.z1) / 2 + v.p(show.lights ? 0.2 : 0.035), `${dimText(k.x1 - k.x0)} × ${dimText(k.z1 - k.z0)}`, 0.085, 'middle', 'dt');
  }
  // Recessed lights, a circle with a cross at each can
  if (show.lights) for (const s of canSpots(p)) {
    v.circle(s.x, s.z, 2.5, 'f');
    v.line(s.x - 3.5, s.z, s.x + 3.5, s.z, 'thin'); v.line(s.x, s.z - 3.5, s.x, s.z + 3.5, 'thin');
  }
  // Beam centerlines, dimensioned from the walls along the bottom and the right
  if (show.centers) {
    const cx = L.beamsX.map((b) => (b.a + b.b) / 2), cz = L.beamsZ.map((b) => (b.a + b.b) / 2);
    for (const x of cx) { v.line(x, -T / 2, x, D + T / 2, 'cutline'); v.text(x, D + T + v.p(0.12), 'CL', 0.07, 'middle', 'dt'); }
    for (const z of cz) { v.line(-T / 2, z, W + T / 2, z, 'cutline'); v.text(W + T + v.p(0.12), z + v.p(0.03), 'CL', 0.07, 'middle', 'dt'); }
    if (cx.length) v.chainH([0, W, ...cx], D + T, -0.3);
    if (cz.length) v.chainV([0, D, ...cz], W + T, 0.3);
  }
  // Coffers and beams across the top and down the left, then the room
  v.chainH([0, W, f.x0, f.x1, ...L.beamsX.flatMap((b) => [b.a, b.b])], -T, 0.3);
  v.dimH(0, W, -T, 0.65, undefined, true);
  v.chainV([0, D, f.z0, f.z1, ...L.beamsZ.flatMap((b) => [b.a, b.b])], -T, -0.3);
  v.dimV(0, D, -T, -0.65, undefined, true);
  v.text(W / 2, D + T + v.p(show.centers ? 0.75 : 0.45), 'REFLECTED CEILING PLAN', 0.14, 'middle', 'lbl');
  return { svg: v.svg(), scale: perFoot };
}

/** A section through one beam, large: nailer, fascias, the soffit (tongue in a dado, or hung below with a corner bead), crown and bead. */
export function beamSection(p: Project, frame: Frame): { svg: string; scale: number } {
  const c = cofferOf(p);
  const B = c.beamWidth, t = c.fascia, drop = c.drop;
  const crown = profileByNum(c.crown);
  const cm = crown ? mountShape(crown) : null;
  const ext = (cm?.depth ?? 0) + 1.5;
  const perFoot = fitScale(B + 2 * ext + 14, drop + 2, frame.w - 1.6, frame.h - 1.4);
  const v = new View(frame, { x0: -ext, y0: -1, x1: B + ext + 14, y1: drop + 1 }, perFoot);
  // y = 0 at the bottom of the beam, up to the ceiling at the drop
  v.line(-ext, drop, B + ext, drop, 'heavy');
  v.rect(t, drop - c.nailer, B - 2 * t, c.nailer, 'ghost');
  const bead = profileByNum(c.bead);
  if (c.joint === 'bead') {
    const g = beadCorner(c);
    v.rect(0, g, t, drop - g, 'cut');
    v.rect(B - t, g, t, drop - g, 'cut');
    v.rect(t, 0, B - 2 * t, c.soffit, 'cut');
    // Blocking between the soffit and the nailer
    const bh = drop - c.nailer - c.soffit;
    if (bh > 0.25) { v.rect(t, c.soffit, B - 2 * t, bh, 'ghost'); v.text(B / 2, c.soffit + bh / 2 - v.p(0.03), '2x blocking', 0.085, 'middle', 'dt'); }
    // The bead fills the square corner under each fascia, its back against the fascia and the soffit edge
    if (bead) {
      const bm = bead.shape && bead.sw && bead.sh ? bead.shape : [[0, 0], [bead.t, 0], [bead.t, bead.w], [0, bead.w]] as [number, number][];
      v.poly(bm.map(([x, y]) => [t - x, g - y]), 'o');
      v.poly(bm.map(([x, y]) => [B - t + x, g - y]), 'o');
    }
    if (cm) {
      v.poly(cm.pts.map(([u, q]) => [-u, drop - cm.height + q]), 'o');
      v.poly(cm.pts.map(([u, q]) => [B + u, drop - cm.height + q]), 'o');
    }
    v.chainV([0, g, drop - (cm?.height ?? 0)].filter((y, i, a) => i === 0 || y > a[i - 1] + 0.05), -ext, -0.3);
  } else {
    const dy0 = c.reveal, dy1 = c.reveal + c.tongue;
    // Fascias, each with its dado on the inside face
    v.poly([[0, 0], [t, 0], [t, dy0], [t - c.tongueDepth, dy0], [t - c.tongueDepth, dy1], [t, dy1], [t, drop], [0, drop]], 'cut');
    v.poly([[B - t, 0], [B, 0], [B, drop], [B - t, drop], [B - t, dy1], [B - t + c.tongueDepth, dy1], [B - t + c.tongueDepth, dy0], [B - t, dy0]], 'cut');
    // Soffit: full thickness between the fascias, tongues on its bottom face into the dados
    v.poly([[t - c.tongueDepth, dy0], [B - t + c.tongueDepth, dy0], [B - t + c.tongueDepth, dy1], [B - t, dy1], [B - t, c.reveal + c.soffit], [t, c.reveal + c.soffit], [t, dy1], [t - c.tongueDepth, dy1]], 'cut');
    // Crown on each outside face, against the ceiling
    if (cm) {
      v.poly(cm.pts.map(([u, q]) => [-u, drop - cm.height + q]), 'o');
      v.poly(cm.pts.map(([u, q]) => [B + u, drop - cm.height + q]), 'o');
    }
    if (bead) {
      const bm = mountShape(bead);
      v.poly(bm.pts.map(([u, q]) => [-u, q]), 'o');
      v.poly(bm.pts.map(([u, q]) => [B + u, q]), 'o');
    }
    v.chainV([0, c.reveal, c.reveal + c.soffit], -ext, -0.3);
  }
  v.dimH(0, B, 0, -0.35, `${dimText(B)} beam`);
  v.dimH(t, B - t, drop - c.nailer, 0.25, `${dimText(B - 2 * t)} nailer`);
  // What each piece is, out to the right
  const lx = B + ext + v.p(0.7);
  const callouts: [number, number, string][] = [
    [B - t / 2, drop * 0.55, `Fascia, ${dimText(t)} ${(c.species ?? 'poplar').toLowerCase()}`],
    [B / 2, c.joint === 'bead' ? c.soffit / 2 : c.reveal + c.soffit / 2, c.joint === 'bead' ? 'Soffit on blocking' : `Soffit, ${dimText(c.tongue)} tongue in a dado`],
    [B / 2, drop - c.nailer / 2, '2x nailer to the ceiling framing'],
    ...(cm ? [[B + cm.depth * 0.5, drop - cm.height * 0.5, `Crown, ${profileLabel(crown!)}`] as [number, number, string]] : []),
  ];
  callouts.sort((a, b) => b[1] - a[1]).forEach(([x, y, text], i) => {
    const ty = drop + v.p(0.1) - i * v.p(0.22);
    v.line(x, y, lx, ty, 'thin');
    v.circle(x, y, v.p(0.012), 'hw');
    v.text(lx + v.p(0.04), ty - v.p(0.03), text, 0.085, 'start', 'dt');
  });
  v.dimV(0, drop, B + ext, 0.3, `${dimText(drop)} drop`);
  v.text(B / 2, -v.p(0.75), 'BEAM SECTION', 0.12, 'middle', 'lbl');
  return { svg: v.svg(), scale: perFoot };
}
