// Named paint colors: Benjamin Moore's catalog, searchable by name or number, with Cody's
// cabinet favorites first. The color picked sets the 3D color and goes on the proposal and
// drawings by name and number. Screen colors are approximate; the color is confirmed from a
// sample before finishing.
import type { Finishes, Project } from './types';
import { bmColors, bmPulled } from './benjaminMoore';

export interface PaintColor { brand: 'Benjamin Moore'; code: string; name: string; hex: string; collection?: string }
export interface NamedColor { brand: string; code: string; name: string }
export type NamedKey = 'paint' | 'wall' | 'trim';

/**
 * Cabinet favorites, by Benjamin Moore number: the whites, grays, blues, greens and darks most used
 * on painted cabinetry and built-ins. Shown first; any number not in the catalog is left out.
 */
export const cabinetFavorites: string[] = [
  // Whites and off-whites
  'OC-17', 'OC-65', 'OC-117', 'OC-45', 'OC-130', 'OC-151', 'OC-152', 'OC-149', 'OC-20',
  // Greiges and grays
  'HC-172', 'HC-173', 'HC-170', 'OC-52', 'OC-23', 'HC-171', 'HC-168', 'HC-167', 'HC-166', 'AF-685',
  // Blues
  'HC-154', 'HC-155', 'HC-156', '2062-10', '2063-10', '2062-20',
  // Greens
  'HC-114', 'HC-134', 'HC-188', 'HC-124', 'HC-116', 'HC-157', '2050-10', '1495', '2041-10',
  // Darks
  '2124-10', '2128-10', '2133-10', '2134-30', '2126-20',
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const byCode = new Map(bmColors.map((c) => [norm(c.code), c]));

export const catalogLoaded = () => bmColors.length > 0;
export const catalogDate = bmPulled;
export const colorByCode = (code: string) => byCode.get(norm(code));
export const favorites = (): PaintColor[] => cabinetFavorites.map(colorByCode).filter((c): c is PaintColor => !!c);

/** Search by name or number ("white dove", "oc-17", "hale"): exact number first, then names that start with it, then the rest. */
export function searchColors(q: string, limit = 40): PaintColor[] {
  const n = norm(q);
  if (!n) return favorites();
  const exact = byCode.get(n);
  const starts = bmColors.filter((c) => c !== exact && (norm(c.name).startsWith(n) || norm(c.code).startsWith(n)));
  const has = bmColors.filter((c) => c !== exact && !starts.includes(c) && norm(c.name).includes(n));
  return [...(exact ? [exact] : []), ...starts, ...has].slice(0, limit);
}

/** "Benjamin Moore White Dove OC-17" */
export const colorText = (c: NamedColor) => `${c.brand} ${c.name} ${c.code}`;

/** The named color picked for a finish, if one was (and the color still matches it). */
export function namedColor(f: Finishes, k: NamedKey): NamedColor | undefined {
  return f.named?.[k];
}

/** Pick a named color for a finish: its screen color and its name travel together. */
export function withNamed(p: Project, k: NamedKey, c: PaintColor | null): Project {
  const named = { ...p.finishes.named };
  if (c) named[k] = { brand: c.brand, code: c.code, name: c.name }; else delete named[k];
  return { ...p, finishes: { ...p.finishes, ...(c ? { [k]: c.hex } : {}), named } };
}

/** Sheen for painted cabinetry, said on the proposal with the color. */
export const sheens = ['Matte', 'Eggshell', 'Pearl', 'Satin', 'Semi-gloss'] as const;
export type Sheen = (typeof sheens)[number];
