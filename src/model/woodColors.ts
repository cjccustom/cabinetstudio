// What stain-grade work and plywood look like in the 3D view: a natural (clear or light stain) tone
// for each species, close enough to read red oak from maple at a glance. Not a finish sample.
import type { Finishes, ShopSettings } from './types';

const species: Record<string, string> = {
  'red oak': '#c38a5a', 'white oak': '#b8955f', 'quartersawn white oak': '#b08b57', 'hard maple': '#e3cba2', maple: '#e3cba2',
  'soft maple': '#dcc199', birch: '#e1c8a0', cherry: '#a8623d', walnut: '#6e4b33', poplar: '#cdbd8c', sapele: '#8f4b30',
  mahogany: '#8a4a2f', 'sapele mahogany': '#8f4b30', pine: '#dcb67f', fir: '#d3a46e', hickory: '#c9a173', ash: '#d7c39c',
};

/** A species' natural tone, if it's one we know (matched loosely: "Red oak, 4/4" is red oak). */
export function woodColor(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const n = name.toLowerCase().replace(/,.*$/, '').replace(/\bplywood\b|\bprefinished\b|\bpaint-grade\b/g, '').trim();
  return species[n] ?? Object.entries(species).find(([k]) => n.includes(k))?.[1];
}

/**
 * The colors a cabinet is drawn in: the job's paint, or on stain grade the face frame species
 * (unless a stain color was picked); the case interior in the job's plywood.
 */
export function finishColors(s: ShopSettings, f: Finishes): { paint: string; box: string } {
  const stain = s.finish === 'stain' ? f.stain ?? woodColor(s.woodSpecies) ?? f.wood : undefined;
  const ply = s.plywood && !/prefinished|paint-grade|mdf/i.test(s.plywood) ? woodColor(s.plywood) : undefined;
  return { paint: stain ?? f.paint, box: ply ?? f.box };
}
