// Wood grain for the 3D view, drawn in code (no photos to download or license): each species gets
// its own figure (oak's cathedral arches and open pores, cherry and maple's quiet grain, walnut's
// darker streaks), tinted to the species or the stain picked. Parts get UVs in real inches with
// the grain running their long way, so a stile's grain runs up and a top's runs its length.
import * as THREE from 'three';

/** The texture covers 48" along the grain by 24" across. */
export const GRAIN_LEN = 48, GRAIN_W = 24;
const TW = 1024, TH = 512;

interface Figure { ring: number; contrast: number; cathedral: number; pores: number; streak: number; rays: number; warp: number }
const figures: Record<string, Figure> = {
  oak: { ring: 11, contrast: 0.26, cathedral: 1, pores: 0.45, streak: 0.08, rays: 0, warp: 0.35 },
  qso: { ring: 6, contrast: 0.14, cathedral: 0, pores: 0.35, streak: 0.12, rays: 0.45, warp: 0.2 },
  ash: { ring: 12, contrast: 0.24, cathedral: 1, pores: 0.3, streak: 0.08, rays: 0, warp: 0.35 },
  cherry: { ring: 9, contrast: 0.1, cathedral: 0.7, pores: 0, streak: 0.1, rays: 0, warp: 0.3 },
  maple: { ring: 10, contrast: 0.07, cathedral: 0.6, pores: 0, streak: 0.08, rays: 0, warp: 0.3 },
  walnut: { ring: 10, contrast: 0.22, cathedral: 0.8, pores: 0.15, streak: 0.18, rays: 0, warp: 0.4 },
  mahogany: { ring: 6, contrast: 0.1, cathedral: 0.2, pores: 0.2, streak: 0.2, rays: 0, warp: 0.2 },
  pine: { ring: 14, contrast: 0.32, cathedral: 1, pores: 0, streak: 0.05, rays: 0, warp: 0.35 },
  poplar: { ring: 10, contrast: 0.08, cathedral: 0.5, pores: 0, streak: 0.18, rays: 0, warp: 0.3 },
  birch: { ring: 10, contrast: 0.08, cathedral: 0.5, pores: 0, streak: 0.08, rays: 0, warp: 0.3 },
};

export function figureOf(species: string | undefined): keyof typeof figures {
  const s = (species ?? '').toLowerCase();
  if (/quarter|rift|qs/.test(s) && /oak/.test(s)) return 'qso';
  if (/oak/.test(s)) return 'oak';
  if (/ash|hickory/.test(s)) return 'ash';
  if (/cherry/.test(s)) return 'cherry';
  if (/walnut/.test(s)) return 'walnut';
  if (/sapele|mahogany/.test(s)) return 'mahogany';
  if (/pine|fir/.test(s)) return 'pine';
  if (/poplar/.test(s)) return 'poplar';
  if (/birch/.test(s)) return 'birch';
  return 'maple';
}

// Small seeded value noise, so each species looks the same every time
function rng(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
function noise2(seed: number) {
  const r = rng(seed), N = 256, perm = new Uint8Array(N * 2), val = new Float32Array(N);
  for (let i = 0; i < N; i++) { perm[i] = i; val[i] = r(); }
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < N; i++) perm[N + i] = perm[i];
  const s = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const a = perm[(xi & 255) + perm[yi & 255]], b = perm[((xi + 1) & 255) + perm[yi & 255]];
    const c = perm[(xi & 255) + perm[(yi + 1) & 255]], d = perm[((xi + 1) & 255) + perm[(yi + 1) & 255]];
    const u = s(xf), v = s(yf);
    return (val[a] * (1 - u) + val[b] * u) * (1 - v) + (val[c] * (1 - u) + val[d] * u) * v;
  };
}

const cache = new Map<string, THREE.CanvasTexture>();

/** A grain texture for a species, in a color (the species' own, or the stain). */
export function woodTexture(species: string | undefined, color: string): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const fig = figureOf(species);
  const key = `${fig}|${color}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const f = figures[fig];
  const canvas = document.createElement('canvas');
  canvas.width = TW; canvas.height = TH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(TW, TH);
  // Worked in sRGB, the canvas's own space (THREE.Color holds linear values)
  const c0 = new THREE.Color(color), rgb = { r: 0, g: 0, b: 0 };
  c0.getRGB(rgb, THREE.SRGBColorSpace);
  // A clear coat deepens raw wood a touch
  const base = { r: rgb.r * 0.95, g: rgb.g * 0.94, b: rgb.b * 0.92 };
  const dark = { r: base.r * (1 - f.contrast), g: base.g * (1 - f.contrast * 1.1), b: base.b * (1 - f.contrast * 1.2) };
  const seed = [...fig].reduce((t, ch) => t * 31 + ch.charCodeAt(0), 7);
  const n = noise2(seed), m = noise2(seed + 17), r = rng(seed + 3);
  // Boards about 4"–6" wide across the texture, each its own tone and its own arch center
  const pxIn = TH / GRAIN_W;
  const boards: { y0: number; y1: number; tone: number; cx: number; cy: number }[] = [];
  for (let y = 0; y < TH;) {
    const h = Math.round((4 + r() * 2.5) * pxIn);
    boards.push({ y0: y, y1: Math.min(TH, y + h), tone: 0.95 + r() * 0.08, cx: r() * TW, cy: y + h * (0.3 + r() * 0.4) - (r() < 0.5 ? 1 : -1) * h * 1.4 });
    y += h;
  }
  const pores = new Float32Array(TW * TH);
  if (f.pores) {
    for (let i = 0; i < TW * TH * 0.012 * f.pores; i++) {
      const x = Math.floor(r() * TW), y = Math.floor(r() * TH), len = 2 + Math.floor(r() * 6);
      for (let k = 0; k < len && x + k < TW; k++) pores[y * TW + x + k] = 1;
    }
  }
  let bi = 0;
  for (let y = 0; y < TH; y++) {
    while (bi < boards.length - 1 && y >= boards[bi].y1) bi++;
    const b = boards[bi];
    for (let x = 0; x < TW; x++) {
      const warp = (n(x / 220, y / 30) - 0.5) * 2 * f.warp * 3;
      // Plain sawn: rings as stretched ellipses round a center off the board (the cathedrals);
      // straight grain where the board is quarter or rift sawn
      const dx = (x - b.cx) * 0.07, dy = y - b.cy;
      const cath = Math.sqrt(dx * dx + dy * dy);
      const ring = (f.cathedral * cath + (1 - f.cathedral) * y) / f.ring + warp;
      const t = ring - Math.floor(ring);
      // Latewood: a narrower dark band in each ring, soft on one side
      const late = Math.pow(Math.max(0, 1 - Math.abs(t - 0.8) / 0.16), 1.4);
      const streak = (m(x / 90, y / 2.2) - 0.5) * f.streak;
      let k = late + streak + (pores[y * TW + x] ? 0.9 * f.pores + (late > 0.2 ? 0.4 : 0) : 0);
      if (f.rays) { const ray = m(x / 7, y / 1.2); if (ray > 0.86) k -= f.rays * (ray - 0.86) * 4; }
      k = Math.max(-0.4, Math.min(1.2, k));
      const tone = b.tone * (1 + (n(x / 400, y / 60) - 0.5) * 0.08);
      const o = (y * TW + x) * 4;
      const cr = (base.r + (dark.r - base.r) * k) * tone, cg = (base.g + (dark.g - base.g) * k) * tone, cb = (base.b + (dark.b - base.b) * k) * tone;
      img.data[o] = Math.max(0, Math.min(255, cr * 255));
      img.data[o + 1] = Math.max(0, Math.min(255, cg * 255));
      img.data[o + 2] = Math.max(0, Math.min(255, cb * 255));
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  // Mirrored so the repeats don't show a seam
  tex.wrapS = tex.wrapT = THREE.MirroredRepeatWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}

/**
 * UVs in real inches for a piece whose grain runs along `grain` (0 x, 1 y, 2 z): on each face the
 * texture's length lies along the grain, or along the face's longer side on the end grain.
 * `seed` shifts where on the texture the piece falls, so neighbors don't match.
 */
export function grainUVs(geo: THREE.BufferGeometry, grain: 0 | 1 | 2, seed = 0): void {
  const pos = geo.getAttribute('position'), nor = geo.getAttribute('normal');
  if (!pos || !nor) return;
  const uv = new Float32Array(pos.count * 2);
  const ou = (seed * 0.618) % 1, ov = (seed * 0.382) % 1;
  for (let i = 0; i < pos.count; i++) {
    const p = [pos.getX(i), pos.getY(i), pos.getZ(i)], nn = [Math.abs(nor.getX(i)), Math.abs(nor.getY(i)), Math.abs(nor.getZ(i))];
    const flat = nn[0] >= nn[1] && nn[0] >= nn[2] ? 0 : nn[1] >= nn[2] ? 1 : 2;
    const axes = ([0, 1, 2] as const).filter((a) => a !== flat);
    const along = axes.includes(grain as never) ? grain : axes[0];
    const across = axes.find((a) => a !== along)!;
    uv[i * 2] = p[along] / GRAIN_LEN + ou;
    uv[i * 2 + 1] = p[across] / GRAIN_W + ov;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

/** The long way of a box: where its grain runs. */
export const longAxis = (size: [number, number, number]): 0 | 1 | 2 => (size[0] >= size[1] && size[0] >= size[2] ? 0 : size[1] >= size[2] ? 1 : 2);
