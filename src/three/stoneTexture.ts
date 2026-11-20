// Stone for countertops, drawn in code like the wood grain: quartz's fine even speckle, marble's soft
// gray veining (and quartz made to look like it), granite's mixed crystals, soapstone's dark ground with
// faint pale veins. Covers 48" by 24" like the grain, mirrored past that, on the same real-inch UVs.
import * as THREE from 'three';
import { noise2 } from './woodTexture';
import type { StoneKind } from '../model/surfaces';

const TW = 1024, TH = 512;
const cache = new Map<string, THREE.CanvasTexture>();

const rgbOf = (hex: string) => { const c = new THREE.Color(hex), o = { r: 0, g: 0, b: 0 }; c.getRGB(o, THREE.SRGBColorSpace); return o; };

export function stoneTexture(kind: StoneKind, base: string, vein: string): THREE.CanvasTexture | null {
  if (typeof document === 'undefined' || kind === 'solid') return null;
  const key = `${kind}|${base}|${vein}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = TW; canvas.height = TH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(TW, TH);
  const b = rgbOf(base), v = rgbOf(vein);
  const seed = [...kind].reduce((t, ch) => t * 31 + ch.charCodeAt(0), 11);
  const n1 = noise2(seed), n2 = noise2(seed + 5), n3 = noise2(seed + 9);
  const fbm = (n: (x: number, y: number) => number, x: number, y: number, o = 5) => { let t = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { t += a * n(x * f, y * f); a *= 0.5; f *= 2; } return t; };
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    // Inches on the stone
    const ux = (x / TW) * 48, uy = (y / TH) * 24;
    let mix = 0, tone = 1;
    if (kind === 'marble' || kind === 'quartzVein' || kind === 'soapstone') {
      // Veins: long and flowing on a diagonal, gently bent by broad turbulence, a dark core in a soft halo
      const f = (ux * 0.5 + uy * 0.87) / (kind === 'marble' ? 8.5 : 13) + fbm(n1, ux / 22, uy / 22, 4) * 1.7 + fbm(n3, ux / 5, uy / 5, 3) * 0.12;
      const s = 1 - Math.abs(Math.sin(f * Math.PI));
      const core = Math.pow(s, kind === 'marble' ? 14 : 22), halo = Math.pow(s, kind === 'marble' ? 3 : 5);
      // Some veins strong, some fading out along their length
      const gate = Math.min(1, Math.max(0, (fbm(n2, ux / 16, uy / 16, 3) - 0.3) * 2.6));
      const strength = kind === 'marble' ? 0.9 : kind === 'quartzVein' ? 0.8 : 0.5;
      mix = Math.min(1, (core * 0.85 + halo * 0.3) * gate * strength);
      // A second, finer set across them
      if (kind !== 'soapstone') {
        const f2 = (ux * 0.95 - uy * 0.3) / 4.5 + fbm(n3, ux / 9, uy / 9, 3) * 1.2;
        mix = Math.max(mix, Math.pow(1 - Math.abs(Math.sin(f2 * Math.PI)), 80) * gate * 0.45);
      }
      // Soft clouding in the ground
      tone = 1 - (fbm(n3, ux / 7, uy / 7) - 0.5) * (kind === 'quartzVein' ? 0.04 : 0.09);
    } else if (kind === 'granite') {
      // Crystals about a quarter to half inch: dark, the ground and light, with a fine sparkle
      const c = n2(ux * 2.6, uy * 2.6), d = n1(ux * 3.3 + 40, uy * 3.3), e = n3(ux * 1.1, uy * 1.1);
      mix = c > 0.66 ? 0.95 : d < 0.22 ? -0.4 : e > 0.6 ? 0.25 : 0.05;
      tone = 0.94 + n3(ux * 12, uy * 12) * 0.12;
    } else {
      // Quartz: a fine even speckle
      const c = n1(ux * 14, uy * 14);
      mix = c > 0.8 ? 0.45 : c < 0.12 ? 0.15 : 0;
      tone = 0.98 + n2(ux * 3, uy * 3) * 0.04;
    }
    const i = (y * TW + x) * 4;
    // A negative mix lightens toward white (granite's pale crystals)
    const to = mix < 0 ? { r: 0.95, g: 0.93, b: 0.9 } : v, m = Math.abs(mix);
    img.data[i] = Math.round(255 * Math.min(1, (b.r * (1 - m) + to.r * m) * tone));
    img.data[i + 1] = Math.round(255 * Math.min(1, (b.g * (1 - m) + to.g * m) * tone));
    img.data[i + 2] = Math.round(255 * Math.min(1, (b.b * (1 - m) + to.b * m) * tone));
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.MirroredRepeatWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}
