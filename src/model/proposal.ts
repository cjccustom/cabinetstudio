// What the customer sees before they sign: the work in plain words, grouped by area, the materials
// and finishes, the price in sections, and options they can add. No dimensioned drawings and no
// cabinet-by-cabinet sizes until the job is sold, so the design can't be shopped to another builder.
import type { Cabinet, Project, WallId } from './types';
import { priceQuote, scopeLine } from './quote';
import { wallNames } from './layout';
import { styleById } from './eagle';
import { profileByNum, profileLabel } from './moldings';
import { fridgeBelow } from './cabinetBase';

export interface ProposalOption { id: string; label: string; price: number; items: string[] }
export interface ProposalArea { title: string; items: string[] }
export interface ProposalSummary {
  areas: ProposalArea[];
  materials: { label: string; value: string }[];
  options: ProposalOption[];
}

const optionId = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'option';

/** The option names used in a job: cabinets and extras marked as offered on top of the base price. */
export function optionNames(p: Project): string[] {
  const names = [...p.cabinets.map((c) => c.option), ...(p.quote?.extras ?? []).map((e) => e.option)].map((n) => n?.trim()).filter((n): n is string => !!n);
  return [...new Set(names)];
}

/** The job with only some options in it (none = the base proposal). */
export function withOptions(p: Project, keep: string[] = []): Project {
  const on = (n?: string) => !n?.trim() || keep.includes(n.trim());
  return {
    ...p,
    cabinets: p.cabinets.filter((c) => on(c.option)),
    ...(p.quote ? { quote: { ...p.quote, extras: (p.quote.extras ?? []).filter((e) => on(e.option)) } } : {}),
  };
}

/** Each option's price: what adding it to the base proposal adds to the total, to the nearest $10. */
export function optionPrices(p: Project): ProposalOption[] {
  const names = optionNames(p);
  if (!names.length) return [];
  const base = priceQuote(withOptions(p)).total;
  return names.map((name) => {
    const price = Math.round((priceQuote(withOptions(p, [name])).total - base) / 10) * 10;
    const only = { ...p, cabinets: p.cabinets.filter((c) => c.option?.trim() === name) };
    const extras = (p.quote?.extras ?? []).filter((e) => e.option?.trim() === name).map((e) => e.label);
    return { id: optionId(name), label: name, price, items: [...plainItems(only, only.cabinets), ...extras] };
  });
}

const noun = (c: Cabinet) => c.island ? (c.islandSides === 2 ? 'Island with fronts on both sides' : 'Island')
  : fridgeBelow(c) ? 'Refrigerator surround with a cabinet above'
  : c.kind === 'base' ? 'Base cabinet' : c.kind === 'wall' ? 'Wall cabinet' : c.kind === 'tall' ? 'Tall cabinet' : '';

/** Said once under Materials & finishes, so left out of each line. */
const covered = [/^approx/i, /plywood interior with/i, /^(paint|stain) grade$/i, /^built-in opening for owner's refrigerator$/i, /^freestanding island/i];

/** One cabinet in plain words: what it is and what it has, without its sizes. */
export function plainItem(c: Cabinet, p: Project): string {
  // Your own wording for this cabinet on the Quote tab goes on the proposal as you wrote it
  const mine = p.quote?.scopeText?.[c.id];
  if (mine != null) return mine.replace(/^[A-Z]{1,3}\d{1,3}:\s*/, '').trim();
  const text = scopeLine(c, p).replace(/^[^:]+:\s*/, '');
  const bits = text.split('; ')
    .map((b) => b.replace(/,?\s*approx\.?\s*[\d”"'\-\s/xWHD.]+(thick)?/gi, '').replace(/\s*\(approx [^)]*\)/gi, '')
      .replace(/ with dovetail drawer boxes and soft close slides/, '').replace(/\boverlay (doors?)\b/, '$1').replace(/\binset (doors?)\b/, '$1').trim())
    .filter((b) => b && !covered.some((r) => r.test(b)));
  const n = noun(c);
  // Pilasters, shelves and mantels name themselves in their first phrase
  const [head, ...rest] = n ? [n, ...bits] : bits;
  return rest.length ? `${head}: ${rest.join('; ')}` : head ?? '';
}

/** Cabinets in plain words, identical ones counted together. */
function plainItems(p: Project, cabs: Cabinet[]): string[] {
  const counts = new Map<string, number>();
  for (const c of cabs) { const t = plainItem(c, p); if (t) counts.set(t, (counts.get(t) ?? 0) + 1); }
  return [...counts].map(([t, n]) => (n > 1 ? `(${n}) ${t.replace(/^([^:]*?)\bcabinet\b/, '$1cabinets')}` : t));
}

/** Where each cabinet is, as a customer would say it: by wall, with islands on their own. */
function areaOf(c: Cabinet): string {
  if (c.area?.trim()) return c.area.trim();
  if (c.island) return 'Island';
  return wallNames[c.wall as WallId];
}

/** Everything the customer reads before signing. */
export function proposalSummary(p: Project): ProposalSummary {
  const base = withOptions(p);
  const groups = new Map<string, Cabinet[]>();
  for (const c of base.cabinets) groups.set(areaOf(c), [...(groups.get(areaOf(c)) ?? []), c]);
  const areas = [...groups].map(([title, cabs]) => ({ title, items: plainItems(base, cabs) }));
  const extras = [...(base.quote?.extras ?? []).map((e) => e.label), ...(base.quote?.scopeExtra ?? [])].filter((x) => x?.trim());
  if (extras.length) areas.push({ title: 'Also included', items: extras });
  return { areas, materials: materialsOf(p), options: optionPrices(p) };
}

/** Materials and finishes, in a few lines. */
export function materialsOf(p: Project): { label: string; value: string }[] {
  const s = p.settings;
  const style = styleById(s.doorStyleId);
  const material = style.line === 'MDF' ? 'MDF' : s.doorMaterial;
  const out: { label: string; value: string }[] = [];
  const doors = p.cabinets.some((c) => c.rows.some((r) => r.type === 'doors' || r.type === 'drawer' || r.covered));
  if (doors) out.push({ label: 'Doors & drawer fronts', value: `${style.name}${style.bead ? ` (${style.bead.toLowerCase()})` : ''}, ${material.toLowerCase()}, ${s.doorMount === 'inset' ? 'inset' : 'overlay'}` });
  const when = p.quote?.paintWhen === 'site' ? ', finished on site after install' : p.quote?.paintWhen === 'none' ? '; painting by others' : '';
  out.push({ label: 'Finish', value: (s.finish === 'stain' ? `Stain grade ${s.woodSpecies.toLowerCase()}, stained in your choice of color` : 'Painted in your choice of color') + when });
  out.push({ label: 'Construction', value: `${s.construction === 'frameless' ? 'Frameless' : 'Face frame'} cabinets with ${(s.plywood ?? 'Prefinished birch').toLowerCase()} plywood interiors` });
  if (p.cabinets.some((c) => c.rows.some((r) => r.type === 'drawer'))) out.push({ label: 'Drawers', value: 'Dovetail drawer boxes on soft-close, full-extension slides' });
  if (doors) out.push({ label: 'Hinges', value: 'Soft-close, adjustable' });
  const crown = p.cabinets.map((c) => profileByNum(c.crown)).find(Boolean);
  if (crown) out.push({ label: 'Mouldings', value: `Crown moulding${p.cabinets.some((c) => c.baseMold) ? ' and base moulding' : ''} (${profileLabel(crown)})` });
  if (p.cabinets.some((c) => c.countertop && c.topKind === 'wood')) out.push({ label: 'Tops', value: `Solid ${s.woodSpecies.toLowerCase()}` });
  if (p.cabinets.some((c) => c.cushion)) out.push({ label: 'Cushions', value: 'Custom seat cushions, fabric to be selected' });
  return out;
}
