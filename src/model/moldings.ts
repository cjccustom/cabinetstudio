// Mouldings from the Anderson & McQuaid catalog: crown, light rail and base on cabinets, caps on
// beadboard. Each run follows the cabinet face and returns along exposed ends.
import type { Cabinet, Project, ShopSettings, WallPanel } from './types';
import { amCatalog, type AMProfile } from './andersonMcquaid';
import { panelExtents } from './parts';
import { resolveEnds } from './layout';

export type MoldKind = 'crown' | 'lightRail' | 'baseMold' | 'cap';

export const moldLabel: Record<MoldKind, string> = { crown: 'Crown', lightRail: 'Light rail', baseMold: 'Base', cap: 'Beadboard cap' };

/** Catalog categories that make sense for each spot, listed first in the picker. */
export const moldCategories: Record<MoldKind, string[]> = {
  crown: ['Crown', 'Header Cap', 'Band'],
  lightRail: ['Base Board and Base Cap', 'Panel', 'Scotia', 'Crown', 'Band'],
  baseMold: ['Base Board and Base Cap', 'Shoe Moulding'],
  cap: ['Chair Rail', 'Panel', 'Base Board and Base Cap', 'Header Cap'],
};

export const profileByNum = (num?: string): AMProfile | undefined => (num ? amCatalog.find((p) => p.num === num) : undefined);

export const amSpecies = [...new Set(amCatalog.flatMap((p) => Object.keys(p.prices)))].sort();

/** Price per lineal foot in the job's species, or the closest thing A&M lists. */
export function priceOf(p: AMProfile, species: string): { species: string; price: number } | null {
  if (p.prices[species] != null) return { species, price: p.prices[species] };
  const first = Object.entries(p.prices)[0];
  return first ? { species: first[0], price: first[1] } : null;
}

/**
 * The profile turned so its flat back (the side that goes against the cabinet or wall) is at u = 0,
 * with u running out into the room and v up. Profiles without a traced shape fall back to a rectangle.
 */
export function mountShape(p: AMProfile): { pts: [number, number][]; depth: number; height: number } {
  if (!p.shape || !p.sw || !p.sh) {
    // Crowns stand at about 45°; everything else lies flat against the face
    const [d, h] = p.category === 'Crown' ? [p.w * 0.7, p.w * 0.7] : [p.t, p.w];
    return { pts: [[0, 0], [d, 0], [d, h], [0, h]], depth: d, height: h };
  }
  const { sw, sh } = p;
  const flat = (atX: number) => {
    let len = 0;
    for (let i = 0; i < p.shape!.length; i++) {
      const [x1, y1] = p.shape![i];
      const [x2, y2] = p.shape![(i + 1) % p.shape!.length];
      if (Math.abs(x1 - atX) < 0.02 && Math.abs(x2 - atX) < 0.02) len += Math.abs(y2 - y1);
    }
    return len;
  };
  const backRight = flat(sw) > flat(0);
  return { pts: p.shape.map(([x, y]) => [backRight ? sw - x : x, y]), depth: sw, height: sh };
}

export interface MoldPiece {
  kind: MoldKind;
  num: string;
  /** Cabinet-local (or panel-local) start of the run and its direction. */
  along: 'x' | 'z';
  /** Which way the profile faces: out from the front (+z), or out from a left (-x) or right (+x) end. */
  facing: 'front' | 'left' | 'right';
  x: number;
  y: number;
  z: number;
  length: number;
  /** Turn the profile upside down (light rail hanging under a cabinet). */
  hang?: boolean;
}

/** Moulding pieces for one cabinet, in its own coordinates. */
export function cabinetMoldings(c: Cabinet, s: ShopSettings, ends: { left: boolean; right: boolean }): MoldPiece[] {
  const out: MoldPiece[] = [];
  const ext = panelExtents(c, s, ends);
  const doorFace = c.depth + s.doorThickness * (s.doorMount === 'inset' ? 0 : 1);
  const runs: { kind: MoldKind; num?: string; y: (h: number) => number; z: number; hang?: boolean }[] = [
    // Crown sits on the face frame with its top at the cabinet top
    { kind: 'crown', num: c.crown, y: (h) => c.height - h, z: c.depth },
    // Light rail hangs below the bottom, on the face frame
    { kind: 'lightRail', num: c.lightRail, y: () => 0, z: c.depth, hang: true },
    // Base runs along the floor across the door faces, furniture style
    { kind: 'baseMold', num: c.baseMold, y: () => 0, z: doorFace },
  ];
  for (const r of runs) {
    const p = profileByNum(r.num);
    if (!p) continue;
    const m = mountShape(p);
    const y = r.y(m.height);
    const x0 = -ext.left - (ends.left ? m.depth : 0);
    const x1 = c.width + ext.right + (ends.right ? m.depth : 0);
    out.push({ kind: r.kind, num: p.num, along: 'x', facing: 'front', x: x0, y, z: r.z, length: x1 - x0, hang: r.hang });
    // Returns back to the wall on exposed ends
    if (ends.left) out.push({ kind: r.kind, num: p.num, along: 'z', facing: 'left', x: -ext.left, y, z: 0, length: r.z + m.depth, hang: r.hang });
    if (ends.right) out.push({ kind: r.kind, num: p.num, along: 'z', facing: 'right', x: c.width + ext.right, y, z: 0, length: r.z + m.depth, hang: r.hang });
  }
  return out;
}

/** Cap moulding along the top of a beadboard panel, in the panel's wall coordinates. */
export function panelMoldings(w: WallPanel): MoldPiece[] {
  const p = profileByNum(w.capProfile);
  if (!w.cap || !p) return [];
  return [{ kind: 'cap', num: p.num, along: 'x', facing: 'front', x: 0, y: w.bottom + w.height, z: 0, length: w.width }];
}

export interface MoldOrderLine { num: string; profile: AMProfile; kinds: MoldKind[]; inches: number; feet: number; species: string; price: number | null; cost: number }

/** Lineal feet to order from Anderson & McQuaid, by profile, with waste for miters and defects. */
export function moldingOrder(p: Project): MoldOrderLine[] {
  const s = p.settings;
  const totals = new Map<string, { inches: number; kinds: Set<MoldKind> }>();
  const add = (pc: MoldPiece) => {
    const t = totals.get(pc.num) ?? { inches: 0, kinds: new Set<MoldKind>() };
    t.inches += pc.length;
    t.kinds.add(pc.kind);
    totals.set(pc.num, t);
  };
  for (const c of p.cabinets) {
    if (!c.crown && !c.lightRail && !c.baseMold) continue;
    cabinetMoldings(c, s, resolveEnds(p.room, p.cabinets, c)).forEach(add);
  }
  for (const w of p.panels ?? []) panelMoldings(w).forEach(add);
  return [...totals].map(([num, t]) => {
    const profile = profileByNum(num)!;
    const feet = Math.ceil((t.inches / 12) * (1 + s.moldWaste));
    const pr = priceOf(profile, s.moldSpecies);
    return { num, profile, kinds: [...t.kinds], inches: t.inches, feet, species: pr?.species ?? s.moldSpecies, price: pr?.price ?? null, cost: pr ? pr.price * feet : 0 };
  });
}
