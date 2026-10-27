import type { MaterialKey, PartRole, Project } from './types';
import { buildParts } from './parts';
import { resolveEnds } from './layout';
import type { CutPart, OptimizerOptions, Stock } from './optimizer';
import { uid } from './defaults';
import { sheetName } from './pricebook';

/** A part typed in by hand, like a row in cutlistoptimizer.com. */
export interface ExtraPart {
  id: string;
  label: string;
  material: string;
  length: number;
  width: number;
  qty: number;
  grain: boolean;
  band: number;
  enabled: boolean;
}

export interface CutlistData {
  stock: Stock[];
  extra: ExtraPart[];
  options: OptimizerOptions & { bandShelves: boolean; /** Unused; tax on purchases is the shop-wide purchaseTax setting. */ taxRate: number };
  /** Grain lock overrides for design parts, by part id. */
  grain: Record<string, boolean>;
  /** Design parts left out of the optimizer, by part id. */
  skip: Record<string, boolean>;
}

/** Parts whose face shows get their grain locked; hidden structural parts can turn to save plywood. */
const grainByRole: Partial<Record<PartRole, boolean>> = {
  side: true, bottom: true, top: true, back: true, shelf: true, toekick: true,
  stretcher: false, nailer: false,
};

/** The sheet a part is cut from. Exposed case sides and toe kick skins can be a different plywood. */
export const sheetMaterial = (key: MaterialKey, p: Project, partName?: string): string | null => {
  const s = p.settings;
  const exposed = s.exposedPlywood || s.plywood;
  if (key === 'box') return sheetName(s.boxThickness, partName === 'Side, exposed' ? exposed : s.plywood);
  if (key === 'back') return sheetName(s.backThickness, s.plywood);
  if (key === 'toeSkin') return sheetName(s.toeKickSkin, exposed);
  return null;
};

/** Shop's current price per sheet before tax (imported prefinished birch, Oct 2026); other plywood is priced per job. */
export const sheetPrice = (material: string) => {
  if (!/^\S+ (prefinished birch )?plywood$/.test(material)) return 0;
  return material.startsWith('3/4"') ? 86.4 : material.startsWith('1/2"') ? 74.91 : 0;
};

/**
 * The stock the optimizer cuts from: what's on the Sheet cutlist tab, plus a 4x8 row for any
 * material the design now needs that has none (after a plywood change, say), priced from
 * the job's sheet prices when known.
 */
export function cutStock(p: Project, data: CutlistData): Stock[] {
  const need = new Set(optimizerParts(p, data).map((x) => x.material));
  const out = [...data.stock];
  for (const m of need) {
    if (out.some((x) => x.material === m)) continue;
    out.push({ id: `auto:${m}`, label: `4×8 ${m.replace(/^\S+ /, '')}`, material: m, length: 96, width: 48, qty: null, price: p.sheetPrices?.[m] ?? sheetPrice(m) });
  }
  return out;
}

export function defaultCutlist(p: Project): CutlistData {
  const mats = [...new Set((['box', 'back', 'toeSkin'] as MaterialKey[]).map((m) => sheetMaterial(m, p)!))];
  return {
    stock: mats.map((m) => ({ id: uid('stock'), label: p.settings.plywood ? `4×8 ${m.replace(/^\S+ /, '')}` : '4×8 prefinished birch', material: m, length: 96, width: 48, qty: null, price: p.sheetPrices?.[m] ?? sheetPrice(m) })),
    extra: [],
    options: { kerf: 0.125, trim: 0, considerGrain: true, minOffcut: 6, bandShelves: true, taxRate: 0 },
    grain: {},
    skip: {},
  };
}

export interface DesignPart extends CutPart { cabinet: string; name: string; note?: string }

/** Every sheet-goods part in the design, one row per physical piece. */
export function designParts(p: Project, data: CutlistData): DesignPart[] {
  const out: DesignPart[] = [];
  for (const c of p.cabinets) {
    const counts = new Map<string, number>();
    for (const part of buildParts(c, p.settings, resolveEnds(p.room, p.cabinets, c))) {
      if (!part.cut) continue;
      const material = part.sheet ?? sheetMaterial(part.material, p, part.name);
      if (!material) continue;
      const n = (counts.get(part.name) ?? 0) + 1;
      counts.set(part.name, n);
      const id = `${c.id}:${part.name}:${n}`;
      out.push({
        id,
        cabinet: c.name,
        name: part.name,
        note: part.note,
        label: `${c.name} ${part.name}`,
        material,
        length: part.length,
        width: part.width,
        grain: data.grain[id] ?? grainByRole[part.role] ?? true,
        band: part.role === 'shelf' && part.banded !== false && data.options.bandShelves ? 1 : 0,
      });
    }
  }
  return out;
}

/** What actually goes to the optimizer: enabled design parts plus hand-entered ones. */
export function optimizerParts(p: Project, data: CutlistData): CutPart[] {
  const parts: CutPart[] = designParts(p, data).filter((d) => !data.skip[d.id]);
  for (const e of data.extra) {
    if (!e.enabled) continue;
    for (let i = 0; i < e.qty; i++) {
      parts.push({ id: `${e.id}:${i}`, label: e.label || 'Extra', material: e.material, length: e.length, width: e.width, grain: e.grain, band: e.band });
    }
  }
  return parts;
}
