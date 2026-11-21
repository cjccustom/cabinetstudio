// A photograph of the design as drawn: the 3D scene path traced (light bouncing around the room, soft
// shadows, real reflections), from the view on screen, without the model's outline edges. Day is lit by
// a soft sky through the openings plus the cans; evening by the cans and the cabinet lighting alone.
// Exposure sets itself from the first samples, like a camera.
import * as THREE from 'three';
import { DenoiseMaterial, GradientEquirectTexture, WebGLPathTracer } from 'three-gpu-pathtracer';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

export type Mood = 'day' | 'evening';

export interface PhotoOptions {
  width: number;
  height: number;
  /** More samples, less grain. */
  samples: number;
  mood: Mood;
  /** Called as it goes, with the canvas it draws on (to show as a preview). */
  onProgress?: (done: number, of: number, canvas: HTMLCanvasElement) => void;
  /** Set cancel to stop early; whatever is done comes back. */
  stop?: { cancel: boolean };
}

const frame = () => new Promise<void>((ok) => requestAnimationFrame(() => ok()));

export async function photoRender(scene: THREE.Scene, view: THREE.Camera, o: PhotoOptions): Promise<Blob> {
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(o.width, o.height, false);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  // Outlines, labels and helpers are the drawing, not the work: off while the photo is taken
  const hidden: THREE.Object3D[] = [];
  scene.traverse((x) => { if (((x as THREE.Line).isLine || (x as THREE.LineSegments).isLineSegments || (x as THREE.Points).isPoints || (x as THREE.Sprite).isSprite) && x.visible) { hidden.push(x); x.visible = false; } });
  // The room's light from outside: a soft sky by day, near dark in the evening
  const was = { env: scene.environment, envI: scene.environmentIntensity, bg: scene.background };
  const sky = new GradientEquirectTexture(128);
  sky.topColor.set(o.mood === 'day' ? '#ffffff' : '#20232b');
  sky.bottomColor.set(o.mood === 'day' ? '#d9d2c5' : '#0d0e10');
  sky.update();
  scene.environment = sky;
  scene.environmentIntensity = o.mood === 'day' ? 1 : 0.15;
  scene.background = new THREE.Color(o.mood === 'day' ? '#f3f1ec' : '#1a1c20');
  const cam = (view as THREE.PerspectiveCamera).clone();
  if ((cam as THREE.PerspectiveCamera).isPerspectiveCamera) { cam.aspect = o.width / o.height; cam.updateProjectionMatrix(); }
  const pt = new WebGLPathTracer(renderer);
  try {
    pt.bounces = 6;
    pt.renderDelay = 0;
    pt.minSamples = 0;
    pt.fadeDuration = 0;
    pt.dynamicLowRes = false;
    pt.rasterizeScene = false;
    pt.tiles.set(2, 2);
    pt.setScene(scene, cam);
    await frame();
    let exposed = false;
    while (pt.samples < o.samples && !o.stop?.cancel) {
      pt.renderSample();
      // Like a camera: after a few samples, set the exposure so the picture sits in the middle
      if (!exposed && pt.samples >= 6) { exposed = true; renderer.toneMappingExposure = exposureFor(renderer.domElement); }
      if (Math.floor(pt.samples) % 2 === 0) { o.onProgress?.(Math.floor(pt.samples), o.samples, renderer.domElement); await frame(); }
    }
    pt.renderSample();
    // Smooth the last grain, keeping edges crisp: harder the fewer passes it had
    const n = pt.samples;
    const dn = new FullScreenQuad(new DenoiseMaterial({ map: pt.target.texture, sigma: n < 64 ? 4 : n < 200 ? 3 : 2.5, threshold: n < 64 ? 0.35 : n < 200 ? 0.2 : 0.12, kSigma: 1 }));
    renderer.setRenderTarget(null);
    dn.render(renderer);
    dn.material.dispose(); dn.dispose();
    const out = whiteBalance(renderer.domElement);
    return await new Promise<Blob>((ok, no) => out.toBlob((b) => (b ? ok(b) : no(new Error('The picture didn’t come out.'))), 'image/jpeg', 0.92));
  } finally {
    // Cleanup never hides what went wrong
    try { pt.dispose(); } catch { /* half set up */ }
    try { renderer.dispose(); sky.dispose(); } catch { /* already gone */ }
    hidden.forEach((x) => { x.visible = true; });
    scene.environment = was.env; scene.environmentIntensity = was.envI; scene.background = was.bg;
  }
}

/** The exposure that brings the picture's middle brightness to about mid-gray. */
function exposureFor(canvas: HTMLCanvasElement): number {
  const w = 64, h = Math.max(1, Math.round((64 * canvas.height) / canvas.width));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (!g) return 1;
  g.drawImage(canvas, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  const lum: number[] = [];
  for (let i = 0; i < d.length; i += 4) lum.push((0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255);
  lum.sort((a, b) => a - b);
  const mid = lum[Math.floor(lum.length * 0.5)] || 0.5;
  return Math.min(4, Math.max(0.3, 0.5 / Math.max(0.02, mid)));
}

/**
 * White balance, as a camera does: warm lamps and a wood floor tint the whole room, so pull the
 * picture's average part of the way back to neutral (part way, so a warm room still feels warm).
 */
function whiteBalance(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const g = c.getContext('2d');
  if (!g) return src;
  g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height), d = img.data;
  let r = 0, gg = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 16) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
  r /= n; gg /= n; b /= n;
  const gray = (r + gg + b) / 3;
  const k = 0.4;
  const kr = Math.pow(gray / Math.max(1, r), k), kg = Math.pow(gray / Math.max(1, gg), k), kb = Math.pow(gray / Math.max(1, b), k);
  for (let i = 0; i < d.length; i += 4) { d[i] = Math.min(255, d[i] * kr); d[i + 1] = Math.min(255, d[i + 1] * kg); d[i + 2] = Math.min(255, d[i + 2] * kb); }
  g.putImageData(img, 0, 0);
  return c;
}
