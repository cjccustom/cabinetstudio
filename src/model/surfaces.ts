// How finishes look in 3D beyond their color: the paint's sheen, what the stone top is (quartz, marble,
// granite, soapstone) and how it's finished, and the hardware's metal. These drive the 3D view and the
// model on the client's page (glTF carries roughness, metalness and the textures).
import type { Finishes, ShopSettings } from './types';

/** Paint sheen to surface roughness: flat paint scatters, semi-gloss shows reflections. */
export function sheenRoughness(sheen: string | undefined): number {
  switch ((sheen ?? '').toLowerCase()) {
    case 'flat': return 0.92;
    case 'matte': return 0.85;
    case 'eggshell': return 0.72;
    case 'pearl': return 0.62;
    case 'satin': return 0.55;
    case 'semi-gloss': return 0.36;
    case 'gloss': return 0.22;
    default: return 0.6;
  }
}

export type StoneKind = 'solid' | 'quartz' | 'quartzVein' | 'marble' | 'granite' | 'soapstone';
export const stoneKinds: { v: StoneKind; label: string }[] = [
  { v: 'quartz', label: 'Quartz (fine speckle)' },
  { v: 'quartzVein', label: 'Quartz, marble look (veined)' },
  { v: 'marble', label: 'Marble' },
  { v: 'granite', label: 'Granite' },
  { v: 'soapstone', label: 'Soapstone' },
  { v: 'solid', label: 'Solid color' },
];
export interface StoneLook { kind: StoneKind; /** Vein or fleck color. */ vein?: string; finish?: 'polished' | 'honed' }
export const stoneOf = (f: Finishes): StoneLook => ({ kind: 'quartz', finish: 'polished', ...f.stone });
export const stoneRoughness = (s: StoneLook) => (s.finish === 'honed' ? 0.5 : s.kind === 'soapstone' ? 0.45 : 0.16);
/** The vein color when none is picked: gray on light stone, light on dark. */
export function defaultVein(base: string, kind: StoneKind): string {
  const h = base.replace('#', '');
  const l = (parseInt(h.slice(0, 2), 16) * 0.3 + parseInt(h.slice(2, 4), 16) * 0.59 + parseInt(h.slice(4, 6), 16) * 0.11) / 255;
  if (kind === 'granite') return '#2f2b28';
  return l > 0.5 ? '#6e6b67' : '#d9d7d2';
}

/** The hardware's metal in 3D. */
export function hardwareLook(s: ShopSettings): { color: string; metalness: number; roughness: number } {
  switch (s.pullFinish) {
    case 'black': return { color: '#1d1e20', metalness: 0.35, roughness: 0.55 };
    case 'brass': return { color: '#c8a35a', metalness: 1, roughness: 0.3 };
    case 'bronze': return { color: '#3d2b1f', metalness: 0.85, roughness: 0.5 };
    default: return { color: '#c5c7ca', metalness: 1, roughness: 0.36 };
  }
}
