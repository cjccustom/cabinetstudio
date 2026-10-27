// The shop's price book, applied to a job: which plywood the cases and exposed ends are cut from,
// the face frame and solid wood species, and what each costs. The book itself lives with the shop
// (shared between devices); a job keeps a copy of the prices it uses, so an old quote doesn't
// change under it until the prices are brought up to date on purpose.
import type { MaterialKey, Project } from './types';
import type { PriceItem } from '../shop/shop';
import { fmt } from '../units';
import { defaultFaceFrameStock } from './faceframe';

/** The shop's starting entries; editing one saves an override under the same id. */
export const builtinPrices: PriceItem[] = [
  { id: 'ply-prefinished-birch', kind: 'plywood', name: 'Prefinished birch', sheet: { '3/4"': 86.4, '1/2"': 74.91 }, updatedAt: 0, builtin: true },
  { id: 'ply-prefinished-maple', kind: 'plywood', name: 'Prefinished maple', sheet: {}, updatedAt: 0, builtin: true },
  { id: 'ply-paint-grade-birch', kind: 'plywood', name: 'Paint-grade birch', sheet: {}, updatedAt: 0, builtin: true },
  { id: 'ply-red-oak', kind: 'plywood', name: 'Red oak', sheet: {}, updatedAt: 0, builtin: true },
  { id: 'ply-white-oak', kind: 'plywood', name: 'White oak', sheet: {}, updatedAt: 0, builtin: true },
  { id: 'ply-cherry', kind: 'plywood', name: 'Cherry', sheet: {}, updatedAt: 0, builtin: true },
  { id: 'ply-walnut', kind: 'plywood', name: 'Walnut', sheet: {}, updatedAt: 0, builtin: true },
  { id: 'ply-mdf', kind: 'plywood', name: 'MDF', sheet: {}, updatedAt: 0, builtin: true },
  { id: 'lum-hard-maple', kind: 'lumber', name: 'Hard maple', perBF: 0, updatedAt: 0, builtin: true },
  { id: 'lum-soft-maple', kind: 'lumber', name: 'Soft maple', perBF: 0, updatedAt: 0, builtin: true },
  { id: 'lum-poplar', kind: 'lumber', name: 'Poplar', perBF: 0, updatedAt: 0, builtin: true },
  { id: 'lum-red-oak', kind: 'lumber', name: 'Red oak', perBF: 0, updatedAt: 0, builtin: true },
  { id: 'lum-white-oak', kind: 'lumber', name: 'White oak', perBF: 0, updatedAt: 0, builtin: true },
  { id: 'lum-cherry', kind: 'lumber', name: 'Cherry', perBF: 0, updatedAt: 0, builtin: true },
  { id: 'lum-walnut', kind: 'lumber', name: 'Walnut', perBF: 0, updatedAt: 0, builtin: true },
];

/** The book as it stands: built-in entries with the shop's edits, then everything added, by name. */
export function priceBook(saved: Record<string, PriceItem>): PriceItem[] {
  const out = builtinPrices.map((b) => (saved[b.id] ? { ...saved[b.id], builtin: true } : b));
  const added = Object.values(saved).filter((x) => !builtinPrices.some((b) => b.id === x.id));
  return [...out, ...added].sort((a, b) => (a.builtin === b.builtin ? (a.builtin ? 0 : a.name.localeCompare(b.name)) : a.builtin ? -1 : 1));
}

export const priceId = (kind: PriceItem['kind'], name: string) =>
  `${kind === 'plywood' ? 'ply' : 'lum'}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
export const findItem = (book: PriceItem[], kind: PriceItem['kind'], name: string | undefined) =>
  book.find((x) => x.kind === kind && same(x.name, name || (kind === 'plywood' ? 'Prefinished birch' : '')));

/** "3/4\" red oak plywood", or plain "3/4\" plywood" on jobs from before plywood had a name. */
export function sheetName(thickness: number, species: string | undefined): string {
  if (!species) return `${fmt(thickness)} plywood`;
  return same(species, 'MDF') ? `${fmt(thickness)} MDF` : `${fmt(thickness)} ${species.toLowerCase()} plywood`;
}

/** The plywood each sheet material in the job comes from, and its thickness. */
export function jobSheets(p: Project): { material: string; thickness: number; plywood: string | undefined; key: MaterialKey; exposed: boolean }[] {
  const s = p.settings;
  const exposed = s.exposedPlywood || s.plywood;
  const all = [
    { key: 'box' as MaterialKey, thickness: s.boxThickness, plywood: s.plywood, exposed: false },
    { key: 'back' as MaterialKey, thickness: s.backThickness, plywood: s.plywood, exposed: false },
    { key: 'box' as MaterialKey, thickness: s.boxThickness, plywood: exposed, exposed: true },
    { key: 'toeSkin' as MaterialKey, thickness: s.toeKickSkin, plywood: exposed, exposed: true },
  ].map((x) => ({ ...x, material: sheetName(x.thickness, x.plywood) }));
  return all.filter((x, i) => all.findIndex((y) => y.material === x.material) === i);
}

/** The book's price for a sheet the job uses, if it has one. */
export function bookSheetPrice(book: PriceItem[], plywood: string | undefined, thickness: number): number | undefined {
  const v = findItem(book, 'plywood', plywood)?.sheet?.[fmt(thickness)];
  return v ? v : undefined;
}

/** Prices in the job that differ from the book (or are missing from the job): what "Update" would change. */
export function stalePrices(p: Project, book: PriceItem[]): { label: string; job: number | undefined; book: number }[] {
  const out: { label: string; job: number | undefined; book: number }[] = [];
  for (const sh of jobSheets(p)) {
    const b = bookSheetPrice(book, sh.plywood, sh.thickness);
    const stock = p.cutlist?.stock.find((x) => x.material === sh.material);
    const j = stock ? stock.price : p.sheetPrices?.[sh.material];
    if (b != null && Math.abs((j ?? 0) - b) > 0.005) out.push({ label: `${sh.material}, per sheet`, job: j, book: b });
  }
  const species = p.settings.woodSpecies;
  const bf = findItem(book, 'lumber', species)?.perBF;
  const ff = { ...defaultFaceFrameStock, ...p.faceFrame };
  if (bf && ff.species.toLowerCase().startsWith(species.toLowerCase()) && Math.abs(ff.pricePerBF - bf) > 0.005) out.push({ label: `${species}, per board foot`, job: ff.pricePerBF || undefined, book: bf });
  return out;
}

/** The job with the book's current prices for every sheet and the face frame species it uses. */
export function applyBook(p: Project, book: PriceItem[]): Project {
  const sheetPrices = { ...p.sheetPrices };
  const prices = new Map<string, number>();
  for (const sh of jobSheets(p)) {
    const b = bookSheetPrice(book, sh.plywood, sh.thickness);
    if (b != null) { sheetPrices[sh.material] = b; prices.set(sh.material, b); }
  }
  const cutlist = p.cutlist && { ...p.cutlist, stock: p.cutlist.stock.map((x) => (prices.has(x.material) ? { ...x, price: prices.get(x.material)! } : x)) };
  const ff = { ...defaultFaceFrameStock, ...p.faceFrame };
  const bf = findItem(book, 'lumber', p.settings.woodSpecies)?.perBF;
  const faceFrame = bf && ff.species.toLowerCase().startsWith(p.settings.woodSpecies.toLowerCase()) ? { ...ff, pricePerBF: bf } : p.faceFrame;
  return { ...p, sheetPrices, ...(cutlist ? { cutlist } : {}), ...(faceFrame ? { faceFrame } : {}) };
}

/**
 * Change the case or exposed-end plywood: sheet rows on the Sheet cutlist tab follow the new
 * material (keeping their sizes and counts), then the book's prices apply.
 */
export function choosePlywood(p: Project, which: 'plywood' | 'exposedPlywood', name: string | undefined, book: PriceItem[]): Project {
  const before = jobSheets(p);
  // Naming the cases' plywood for the first time names the plain "3/4\" plywood" too
  const settings = { ...p.settings, plywood: p.settings.plywood ?? 'Prefinished birch', [which]: name };
  if (which === 'exposedPlywood' && name && same(name, settings.plywood ?? '')) settings.exposedPlywood = undefined;
  const next = { ...p, settings };
  const after = jobSheets(next);
  const rename = new Map<string, string>();
  for (const a of before) {
    const b = after.find((x) => x.key === a.key && x.exposed === a.exposed && x.thickness === a.thickness);
    if (b && b.material !== a.material) rename.set(a.material, b.material);
  }
  // Only move a row whose material nothing in the job still uses
  const stillUsed = new Set(after.map((x) => x.material));
  const cutlist = p.cutlist && {
    ...p.cutlist,
    stock: p.cutlist.stock.map((x) => {
      const to = rename.get(x.material);
      if (!to || stillUsed.has(x.material) || p.cutlist!.stock.some((y) => y.material === to)) return x;
      return { ...x, material: to, label: `4×8 ${to.replace(/^\S+ /, '')}`, price: 0 };
    }),
  };
  return applyBook({ ...next, ...(cutlist ? { cutlist } : {}) }, book);
}

/** Change the face frame and solid wood species, with the book's price per board foot. */
export function chooseSpecies(p: Project, name: string, book: PriceItem[]): Project {
  const ff = { ...defaultFaceFrameStock, ...p.faceFrame };
  const thick = /,\s*(.+)$/.exec(ff.species)?.[1] ?? '4/4';
  const bf = findItem(book, 'lumber', name)?.perBF;
  return { ...p, settings: { ...p.settings, woodSpecies: name }, faceFrame: { ...ff, species: `${name}, ${thick}`, pricePerBF: bf || 0 } };
}
