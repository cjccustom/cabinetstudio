// Pilasters for built-ins like libraries: a plywood box the full height of the run, standing on a plinth
// block and topped with a capital under the frieze. The face is shop-built (solid stiles and rails with
// the panel let into a rabbet from the back, rails at each break) or recessed panels ordered from Eagle.
import type { Cabinet, Part, PilasterSpec, ShopSettings } from './types';
import { eff, frontBoxes, vb, type EndInfo } from './parts';
import { panelByCode, styleById } from './eagle';
import { fmt } from '../units';
import { profileByNum, profileLabel } from './moldings';

export const defaultPilaster: PilasterSpec = { plinth: 6, capital: 3.5, breaks: [], band: 1.5, proud: 0.25, face: 'shop', stile: 1.5, rail: 2, panelThickness: 0.25, rabbet: 0.375 };
export const pilasterOf = (c: Cabinet): PilasterSpec => ({ ...defaultPilaster, ...c.pilaster });
/**
 * Where the panel frame starts: on the plinth block, or with no block, above the room's base and cap
 * applied straight over the face.
 */
export const pilasterFoot = (ps: PilasterSpec) => (ps.plinth > 0 ? ps.plinth : ps.foot ?? (ps.wrap ? ps.wrap.h + ps.wrap.cap : 0));

/** Panel sections between the plinth, bands and capital, bottom to top. */
export function pilasterSections(c: Cabinet): { y0: number; y1: number }[] {
  const ps = pilasterOf(c);
  const foot = pilasterFoot(ps);
  const cuts = [...ps.breaks].filter((b) => b > foot + ps.band && b < c.height - ps.capital - ps.band).sort((a, b) => a - b);
  const out: { y0: number; y1: number }[] = [];
  let y = foot;
  for (const b of cuts) {
    out.push({ y0: y, y1: b - ps.band / 2 });
    y = b + ps.band / 2;
  }
  out.push({ y0: y, y1: c.height - ps.capital });
  return out.filter((x) => x.y1 - x.y0 > 1);
}

/** Shop-built face: rails at the bottom, top and each break, bottom to top. */
export function pilasterRails(c: Cabinet): { name: string; y0: number; y1: number }[] {
  const ps = pilasterOf(c);
  const secs = pilasterSections(c);
  // With no plinth block the bottom rail runs down behind the base to the floor
  const out = [{ name: 'Pilaster bottom rail', y0: ps.plinth, y1: pilasterFoot(ps) + ps.rail }];
  for (const sec of secs.slice(1)) out.push({ name: 'Pilaster mid rail', y0: sec.y0 - ps.band, y1: sec.y0 });
  out.push({ name: 'Pilaster top rail', y0: c.height - ps.capital - ps.rail, y1: c.height - ps.capital });
  return out;
}

/** Panel openings in a shop-built face, bottom to top. */
export function pilasterOpenings(c: Cabinet): { y0: number; w: number; h: number }[] {
  const ps = pilasterOf(c);
  const secs = pilasterSections(c);
  return secs.map((sec, i) => {
    const y0 = sec.y0 + (i === 0 ? ps.rail : 0);
    const y1 = sec.y1 - (i === secs.length - 1 ? ps.rail : 0);
    return { y0, w: c.width - 2 * ps.stile, h: y1 - y0 };
  }).filter((o) => o.h > 0.5 && o.w > 0.5);
}

export function pilasterParts(c: Cabinet, settings: ShopSettings, ends?: EndInfo): Part[] {
  const wall = ends?.wall ?? { left: false, right: false };
  const s = eff(c, settings);
  const ps = pilasterOf(c);
  const W = c.width, H = c.height;
  const pt = s.endPanelThickness;
  const nt = s.boxActualThickness;
  // The box stops behind the face: an Eagle panel, or the shop-built frame
  const faceT = ps.face === 'eagle' ? pt : s.ffThickness;
  const back = c.depth - faceT;
  const style = styleById(s.doorStyleId);
  const raised = !!style.panelChoice && !!panelByCode(s.centerPanel).raised;
  // Narrow pilasters can't carry full-width stiles; Eagle builds down to 1 1/2"
  const stile = style.fixedStile ? style.stile : Math.min(s.doorStile, Math.max(1.5, (W - 2) / 2));
  const material = style.line === 'MDF' ? 'MDF' : s.doorMaterial;
  const spec = style.profile === 'slab' ? `Slab, ${material}, pilaster panel` : `${style.name}, ${material}, ${fmt(stile)} stiles, pilaster panel`;
  const parts: Part[] = [];
  for (const side of ['Left', 'Right'] as const) {
    parts.push({ name: 'Pilaster side', role: 'side', material: 'box', look: 'paint', length: H, width: back, thickness: s.boxThickness, cut: true, note: side,
      boxes: [vb(side === 'Left' ? 0 : W - nt, 0, 0, nt, H, back)] });
  }
  parts.push({ name: 'Pilaster nailer', role: 'nailer', material: 'box', length: W - 2 * nt, width: s.nailerWidth, thickness: s.boxThickness, cut: true, note: 'top and bottom, holds the sides apart',
    boxes: [vb(nt, 0, back - nt, W - 2 * nt, s.nailerWidth, nt)] });
  parts.push({ name: 'Pilaster nailer', role: 'nailer', material: 'box', length: W - 2 * nt, width: s.nailerWidth, thickness: s.boxThickness, cut: true,
    boxes: [vb(nt, H - s.nailerWidth, back - nt, W - 2 * nt, s.nailerWidth, nt)] });
  if (ps.face === 'eagle') {
    for (const sec of pilasterSections(c)) {
      const h = sec.y1 - sec.y0;
      parts.push({
        name: 'Pilaster panel', role: 'endPanel', material: 'door', length: h, width: W, thickness: pt, cut: false, note: `${fmt(sec.y0)} off the floor`,
        order: { item: 'endPanel', w: W, h, spec, ...(style.profile === 'slab' ? {} : { rail: stile, stile }) },
        boxes: frontBoxes(0, sec.y0, back, W, h, pt, style.profile, stile, raised),
      });
    }
  } else {
    // Shop-built frame: stiles between the plinth and capital, rails top and bottom and at each break
    const ft = s.ffThickness;
    const fz = c.depth - ft;
    const y0 = ps.plinth, y1 = H - ps.capital;
    const railLen = W - 2 * ps.stile;
    for (const side of ['Left', 'Right'] as const) {
      parts.push({ name: 'Pilaster stile', role: 'stile', material: 'faceframe', species: ps.species, length: y1 - y0, width: ps.stile, thickness: ft, cut: true, note: side,
        boxes: [vb(side === 'Left' ? 0 : W - ps.stile, y0, fz, ps.stile, y1 - y0, ft)] });
    }
    for (const r of pilasterRails(c)) {
      parts.push({ name: r.name, role: 'rail', material: 'faceframe', species: ps.species, length: railLen, width: r.y1 - r.y0, thickness: ft, cut: true,
        boxes: [vb(ps.stile, r.y0, fz, railLen, r.y1 - r.y0, ft)] });
    }
    for (const o of pilasterOpenings(c)) {
      const pw = o.w + 2 * ps.rabbet - 0.0625, ph = o.h + 2 * ps.rabbet - 0.0625;
      parts.push({ name: 'Pilaster panel', role: 'back', material: 'back', look: 'paint', sheet: `${fmt(ps.panelThickness)} MDF`, length: ph, width: pw, thickness: ps.panelThickness, cut: true,
        note: `set into a ${fmt(ps.rabbet)} rabbet from the back`,
        boxes: [vb(ps.stile, o.y0, fz - ps.panelThickness + 0.0625, o.w, o.h, ps.panelThickness, 0.94)] });
      if (ps.panelMold) {
        const m = 0.5;
        parts.push({ name: 'Panel moulding', role: 'trim', material: 'faceframe', length: 2 * (o.w + o.h), width: m, thickness: m, cut: false,
          note: `${profileByNum(ps.panelMold) ? profileLabel(profileByNum(ps.panelMold)!) : ps.panelMold}, mitered around the panel`,
          boxes: [vb(ps.stile, o.y0, fz, o.w, m, m), vb(ps.stile, o.y0 + o.h - m, fz, o.w, m, m), vb(ps.stile, o.y0 + m, fz, m, o.h - 2 * m, m), vb(ps.stile + o.w - m, o.y0 + m, fz, m, o.h - 2 * m, m)] });
      }
    }
  }
  const block = (name: string, y0: number, h: number, note: string): Part => ({
    name, role: 'trim', material: 'faceframe', species: ps.species, length: W, width: h, thickness: faceT + ps.proud, cut: true, note,
    boxes: [vb(0, y0, back, W, h, faceT + ps.proud)],
  });
  if (ps.plinth > 0) parts.push(block('Plinth block', 0, ps.plinth, 'base moulding wraps it'));
  // The room's baseboard and cap wrapped around the plinth: across its face and back each side to the casework
  // beside it. A side tight to a wall gets no return; the face piece is cut square and dies into the wall.
  if (ps.wrap && ps.wrap.h > 0) {
    const { h, cap, t } = ps.wrap;
    // On the plinth block, or with none, straight on the pilaster face
    const face = ps.plinth > 0 ? c.depth + ps.proud : c.depth;
    // Back to the face of the casework beside it; flush with it, the base runs straight through
    const retOf = (side: 'left' | 'right', y: number) => {
      const nb = ends?.faceAt?.(side, y) ?? 0;
      return nb > 0 ? face + t - nb : ps.proud + t;
    };
    for (const [nm, y, hh] of [['Baseboard', 0, h], ['Base cap', h, cap]] as const) {
      if (hh <= 0) continue;
      const ret = { left: retOf('left', y + hh / 2), right: retOf('right', y + hh / 2) };
      // A return wherever this base stands out past what's beside it (a neighbour's own base included)
      const miter = { left: !wall.left && ret.left > 0.01, right: !wall.right && ret.right > 0.01 };
      const x0 = miter.left ? -t : 0;
      const len = W + (miter.left ? t : 0) + (miter.right ? t : 0);
      const endNote = (side: 'left' | 'right') => (miter[side] ? 'mitered' : wall[side] ? 'square to the wall' : 'butts the base beside it');
      const ends2 = endNote('left') === endNote('right') ? `${endNote('left')} both ends` : `${endNote('left')} on the left, ${endNote('right')} on the right`;
      const what = nm === 'Base cap' ? 'Custom, milled to match the room’s; ' : '';
      // A cap milled to the casework's base moulding is drawn as that moulding (see cabinetMoldings), not a flat strip
      const asMoulding = nm === 'Base cap' && !!profileByNum(c.baseMold ?? ends?.baseBeside?.('left')?.num ?? ends?.baseBeside?.('right')?.num);
      parts.push({ name: `${nm} on plinth`, role: 'trim', material: 'faceframe', length: len, width: hh, thickness: t, cut: true, note: what + ends2.charAt(0)[what ? 'toLowerCase' : 'toUpperCase']() + ends2.slice(1),
        boxes: asMoulding ? [] : [vb(x0, y, face, len, hh, t)] });
      for (const side of ['left', 'right'] as const) {
        if (!miter[side]) continue;
        parts.push({ name: `${nm} return on plinth`, role: 'trim', material: 'faceframe', length: ret[side], width: hh, thickness: t, cut: true, note: `${side}; mitered at the front, back to the casework beside it`,
          boxes: asMoulding ? [] : [vb(side === 'left' ? -t : W, y, face + t - ret[side], t, hh, ret[side])] });
      }
    }
  }
  if (ps.face === 'eagle') for (const b of pilasterSections(c).slice(1)) parts.push(block('Pilaster band', b.y0 - ps.band, ps.band, `at ${fmt(b.y0 - ps.band / 2)}`));
  if (ps.capital > 0) parts.push(block('Capital block', H - ps.capital, ps.capital, 'under the frieze'));
  return parts;
}
