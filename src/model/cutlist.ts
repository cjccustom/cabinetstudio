import { jobRooms } from './rooms';
import { eff } from './parts';
import type { MaterialKey, PartRole, Project } from './types';
import { buildParts, partNumbers, partRowKey } from './parts';
import { resolveEnds } from './layout';
import type { CutPart, OptimizerOptions, Stock } from './optimizer';
import { uid } from './defaults';
import { sheetName } from './pricebook';
import { fmt } from '../units';

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
  /** Offcuts from the shop's list set aside for this job: cut first, before new sheets. */
  onHand?: { id: string; material: string; l: number; w: number; from: string }[];
}

/** Parts whose face shows get their grain locked; hidden structural parts can turn to save plywood. */
const grainByRole: Partial<Record<PartRole, boolean>> = {
  side: true, bottom: true, top: true, back: true, shelf: true, toekick: true,
  stretcher: false, nailer: false,
};

/** The sheet a part is cut from. Exposed case sides and toe kick skins can be a different plywood. */
export const sheetMaterial = (key: MaterialKey, p: Project, partName?: string, s = p.settings): string | null => {
  // What shows (exposed sides, toe kick skins) stays in the job's showing plywood even when a
  // cabinet's own case is a plainer one (birch bases on a red oak job)
  const exposed = s.exposedPlywood || p.settings.plywood || s.plywood;
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
export function cutStock(p: Project, data: CutlistData, parts = optimizerParts(p, data), opts: { offcuts?: boolean } = {}): Stock[] {
  const need = new Set(parts.map((x) => x.material));
  // Offcuts set aside for the job go first (one each, no cost). Left out when pricing, so a quote
  // doesn't change with what happens to be in the rack.
  const kept: Stock[] = opts.offcuts ? (data.onHand ?? []).map((o) => ({ id: `off:${o.id}`, label: `Offcut from ${o.from}`, material: o.material, length: Math.max(o.l, o.w), width: Math.min(o.l, o.w), qty: 1, price: 0 })) : [];
  const out = [...kept, ...data.stock];
  const trim = 2 * (data.options.trim ?? 0);
  for (const m of need) {
    if (!out.some((x) => x.material === m)) out.push({ id: `auto:${m}`, label: `4×8 ${m.replace(/^\S+ /, '')}`, ...sheetSize(m), material: m, qty: null, price: p.sheetPrices?.[m] ?? sheetPrice(m) });
    // Longer sheets (4×10) only when they're on the list: a part too long for the sheets on hand
    // is reported as not fitting, so the design or the stock is changed on purpose
    void trim;
  }
  return out;
}

/**
 * A sheet's real size: the shop's prefinished birch (1/2" and 3/4") comes 48-1/2" × 96-1/2", the
 * extra half inch to trim the factory edges; other sheet goods are taken as a true 4×8.
 */
export const sheetSize = (material: string): { length: number; width: number } =>
  (/^(1\/2|3\/4)" (prefinished birch )?plywood$/.test(material) ? { length: 96.5, width: 48.5 } : { length: 96, width: 48 });

export function defaultCutlist(p: Project): CutlistData {
  const mats = [...new Set((['box', 'back', 'toeSkin'] as MaterialKey[]).map((m) => sheetMaterial(m, p)!))];
  return {
    stock: mats.map((m) => ({ id: uid('stock'), label: p.settings.plywood ? `4×8 ${m.replace(/^\S+ /, '')}` : '4×8 prefinished birch', ...sheetSize(m), material: m, qty: null, price: p.sheetPrices?.[m] ?? sheetPrice(m) })),
    extra: [],
    options: { kerf: 0.125, trim: 0, considerGrain: true, minOffcut: 6, bandShelves: true, taxRate: 0 },
    grain: {},
    skip: {},
  };
}

export interface DesignPart extends CutPart { cabinet: string; name: string; note?: string; /** Part number on the drawings and labels: cabinet and line, "T1-3". */ pid?: string }

/** Every sheet-goods part in the design, one row per physical piece. */
export function designParts(p: Project, data: CutlistData): DesignPart[] {
  // A job with several rooms: every room's parts, each named by its room
  const rooms = jobRooms(p);
  if (rooms.length > 1) return rooms.flatMap((r) => roomParts(r.project, data).map((x) => ({ ...x, cabinet: `${r.name} ${x.cabinet}`, label: `${r.name}: ${x.label}` })));
  return roomParts(p, data);
}

function roomParts(p: Project, data: CutlistData): DesignPart[] {
  const out: DesignPart[] = [];
  for (const c of p.cabinets) {
    const counts = new Map<string, number>();
    const built = buildParts(c, p.settings, resolveEnds(p.room, p.cabinets, c));
    const nums = partNumbers(built);
    for (const part of built) {
      if (!part.cut) continue;
      const material = part.sheet ?? sheetMaterial(part.material, p, part.name, eff(c, p.settings));
      if (!material) continue;
      const n = (counts.get(part.name) ?? 0) + 1;
      counts.set(part.name, n);
      const id = `${c.id}:${part.name}:${n}`;
      out.push({
        id,
        cabinet: c.name,
        name: part.name,
        note: part.note,
        pid: nums.has(partRowKey(part)) ? `${c.name}-${nums.get(partRowKey(part))}` : undefined,
        label: `${c.name} ${part.name}`,
        material,
        length: part.length,
        width: part.width,
        // MDF has no grain: it can turn any way that saves sheet
        grain: data.grain[id] ?? (/MDF/i.test(material) ? false : grainByRole[part.role] ?? true),
        band: (part.role === 'shelf' && part.banded !== false && data.options.bandShelves) || (part.role !== 'shelf' && part.banded) ? 1 : 0,
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

/** A material's thickness in inches, read from its name ('3/4" plywood' is 0.75). */
export function materialThickness(material: string): number | null {
  const m = /^(?:(\d+)[- ])?(\d+)(?:\/(\d+))?"/.exec(material);
  if (!m) return null;
  const frac = m[3] ? +m[2] / +m[3] : +m[2];
  return (m[1] ? +m[1] : 0) + frac;
}

/**
 * The sheet parts as a spreadsheet (CSV): one line per part number with its count, sizes in decimal
 * inches (what cutting services, panel saw software and other optimizers read) and in fractions.
 * Parts left out of the cut (unticked) aren't on it; extra parts are.
 */
export function partsCsv(p: Project, data: CutlistData): string {
  const rows = new Map<string, { pid: string; cab: string; name: string; qty: number; l: number; w: number; mat: string; grain: boolean; band: number; note: string }>();
  for (const d of designParts(p, data)) {
    if (data.skip[d.id]) continue;
    const key = `${d.pid ?? d.label}|${d.length.toFixed(3)}|${d.width.toFixed(3)}|${d.material}`;
    const r = rows.get(key);
    if (r) r.qty++;
    else rows.set(key, { pid: d.pid ?? '', cab: d.cabinet, name: d.name, qty: 1, l: d.length, w: d.width, mat: d.material, grain: d.grain, band: d.band, note: d.note ?? '' });
  }
  for (const e of data.extra) if (e.enabled && e.qty > 0) rows.set(`x|${e.id}`, { pid: '', cab: '', name: e.label || 'Extra', qty: e.qty, l: e.length, w: e.width, mat: e.material, grain: e.grain, band: e.band, note: 'Added by hand' });
  const q = (v: string | number) => { const t = String(v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const head = ['Part #', 'Cabinet', 'Part', 'Qty', 'Length (in)', 'Width (in)', 'Thickness (in)', 'Size', 'Material', 'Grain runs with length', 'Edge band (long edges)', 'Note'];
  const lines = [...rows.values()].map((r) => [r.pid, r.cab, r.name, r.qty, r.l.toFixed(3), r.w.toFixed(3), materialThickness(r.mat)?.toFixed(3) ?? '', `${fmt(r.l)} x ${fmt(r.w)}`, r.mat, r.grain ? 'Yes' : 'No', r.band, r.note].map(q).join(','));
  return [head.map(q).join(','), ...lines].join('\r\n') + '\r\n';
}
