// A bookcase drawn as a base with an open upper standing on it, made into the one-piece case it's
// really built as: doors below, a ledge where the base top was, open shelves above. The doors keep
// their size and the ledge its height, so the elevation looks the same and the cutlist changes.
import type { Cabinet, Project, ShopSettings } from './types';
import { eff, layoutRows } from './parts';
import { uid } from './defaults';

/** The upper standing on this base: same wall, same width and position, starting at the top of the base's top. */
export function upperOn(p: Project, base: Cabinet): Cabinet | null {
  if (base.kind !== 'base') return null;
  const top = base.elevation + base.height + (base.countertop ? (base.topKind === 'wood' ? base.topThickness ?? 1.25 : 1.5) : 0);
  return p.cabinets.find((c) => c.kind === 'wall' && c.wall === base.wall && Math.abs(c.offset - base.offset) < 0.06 && Math.abs(c.width - base.width) < 0.06 && Math.abs(c.elevation - top) < 0.6) ?? null;
}

/** The pairs on the job that can be made one piece. */
export const stackedPairs = (p: Project) => p.cabinets.flatMap((b) => { const u = upperOn(p, b); return u ? [[b, u] as const] : []; });

/** One tall case from a base and the upper on it. */
export function combine(base: Cabinet, upper: Cabinet, s: ShopSettings): Cabinet {
  const sb = eff(base, s);
  const su = eff(upper, s);
  const lower = layoutRows(base, s).rows;
  const ledge = base.countertop ? { thickness: base.topThickness ?? (base.topKind === 'wood' ? 1.25 : 1.5), overhang: base.topFront ?? 0.5 } : undefined;
  // The rail under the ledge takes the place of the base's top rail
  const rail = sb.topRailWidth;
  const baseRows = base.rows.map((r, i) => ({ ...r, id: uid('row'), height: lower[i]?.height ?? r.height, ...(i === 0 ? { ...(ledge ? { ledge } : {}), ...(rail !== su.midRailWidth ? { railAbove: rail } : {}) } : {}) }));
  const upperRows = upper.rows.map((r) => ({ ...r, id: uid('row'), height: null }));
  const height = upper.elevation + upper.height - base.elevation;
  const notes = [...(upper.notes ?? []), ...(base.notes ?? [])];
  return {
    ...upper,
    id: base.id,
    name: base.name.replace(/^B/, 'T'),
    kind: 'tall',
    elevation: base.elevation,
    height,
    depth: Math.max(base.depth, upper.depth),
    rows: [...upperRows, ...baseRows],
    countertop: false,
    noBottom: undefined,
    base: base.base,
    baseMold: base.baseMold,
    stileLeftWidth: base.stileLeftWidth ?? upper.stileLeftWidth,
    stileRightWidth: base.stileRightWidth ?? upper.stileRightWidth,
    // The upper's top rail (a tall one for a ladder rail), the base's bottom rail
    overrides: clean({ ...base.overrides, ...upper.overrides, bottomRailWidth: base.overrides?.bottomRailWidth ?? upper.overrides?.bottomRailWidth }),
    notes: notes.length ? notes : undefined,
  } as Cabinet;
}

const clean = <T extends object>(o: T): T | undefined => {
  const out = Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
  return Object.keys(out).length ? out : undefined;
};

/** Make every stacked base-and-upper on the job one piece. Returns the new cabinet list and how many were combined. */
export function combineAll(p: Project): { cabinets: Cabinet[]; count: number } {
  const pairs = stackedPairs(p);
  const uppers = new Set(pairs.map(([, u]) => u.id));
  const byBase = new Map(pairs.map(([b, u]) => [b.id, combine(b, u, p.settings)]));
  return { cabinets: p.cabinets.filter((c) => !uppers.has(c.id)).map((c) => byBase.get(c.id) ?? c), count: pairs.length };
}
