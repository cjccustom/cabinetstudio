import type { MaterialKey, PartRole, Project } from './types';
import { buildParts } from './parts';
import { resolveEnds } from './layout';
import { fmt } from '../units';
import type { CutPart, OptimizerOptions, Stock } from './optimizer';
import { uid } from './defaults';

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

export const sheetMaterial = (key: MaterialKey, p: Project): string | null => {
  const s = p.settings;
  if (key === 'box') return `${fmt(s.boxThickness)} plywood`;
  if (key === 'back') return `${fmt(s.backThickness)} plywood`;
  if (key === 'toeSkin') return `${fmt(s.toeKickSkin)} plywood`;
  return null;
};

/** Shop's current price per sheet before tax (imported prefinished birch, Oct 2026). */
export const sheetPrice = (material: string) => (material.startsWith('3/4"') ? 86.4 : material.startsWith('1/2"') ? 74.91 : 0);

export function defaultCutlist(p: Project): CutlistData {
  const mats = [...new Set((['box', 'back', 'toeSkin'] as MaterialKey[]).map((m) => sheetMaterial(m, p)!))];
  return {
    stock: mats.map((m) => ({ id: uid('stock'), label: '4×8 prefinished birch', material: m, length: 96, width: 48, qty: null, price: sheetPrice(m) })),
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
      const material = part.sheet ?? sheetMaterial(part.material, p);
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
        band: part.role === 'shelf' && data.options.bandShelves ? 1 : 0,
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
