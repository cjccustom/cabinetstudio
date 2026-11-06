// What the cabinet lighting looks like lit, in the 3D view, drawn in the cabinet's own frame from
// the same parts the cut list has, so the light lands where the shelves are:
// - Häfele shelf lighting: a line of light under each shelf front (behind the drop edge) and under
//   the top of each section or cubby, a soft pool on the shelf below and a gentle wash down the back.
// - A strip in the top of each open section or cubby, pucks, vertical strips, under-cabinet strips.
// - The accent uplight washing up the wall above the bookcase, in its color.
// The washes are kept faint and warm on purpose: real cabinet lighting brightens what's on the
// shelves, it doesn't turn the case back white.
import { useMemo } from 'react';
import * as THREE from 'three';
import type { Cabinet, Part, Project } from '../model/types';
import { cabinetFixtures, hafeleOf, lightingJobOf } from '../model/cabinetLighting';
import { eff, openSpans } from '../model/parts';

const KELVIN: Record<number, string> = { 2700: '#ffc184', 3000: '#ffcf9a', 3500: '#ffdcb6', 4000: '#ffe8d2' };

/** A soft fade, strongest at the bottom edge of the texture (v = 0) to nothing well before the top. */
let fade: THREE.CanvasTexture | null = null;
function fadeTexture(): THREE.Texture | null {
  if (fade) return fade;
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = 4; cv.height = 128;
  const g = cv.getContext('2d');
  if (!g) return null;
  const grad = g.createLinearGradient(0, 128, 0, 0);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.4)');
  grad.addColorStop(0.75, 'rgba(255,255,255,0)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 4, 128);
  fade = new THREE.CanvasTexture(cv);
  return fade;
}

/** A glowing line or dot: [x, y, z] center and size. */
interface Glow { p: [number, number, number]; s: [number, number, number]; accent?: boolean }
/** A faint wash on a surface: center, size, which way it faces and which edge is brightest. */
interface Wash { p: [number, number, number]; w: number; h: number; face: 'back' | 'up'; bright: 'top' | 'bottom' | 'front'; opacity: number; accent?: boolean }

export function CabinetLights({ cab, project, parts }: { cab: Cabinet; project: Project; parts: Part[] }) {
  const job = lightingJobOf(project);
  const { glows, washes } = useMemo(() => {
    const glows: Glow[] = [], washes: Wash[] = [];
    const fx = cabinetFixtures(cab, project);
    if (!fx.length) return { glows, washes };
    const kinds = new Set(fx.map((f) => f.kind));
    const s = eff(cab, project.settings);
    const H = hafeleOf(project);
    const x0 = s.stileWidth, x1 = cab.width - s.stileWidth;
    const back = 0.8, front = cab.depth - 1;
    const dividers = parts.filter((p) => p.role === 'divider').flatMap((p) => p.boxes);
    const edges = parts.filter((p) => p.name === 'Shelf drop edge').flatMap((p) => p.boxes);
    for (const o of openSpans(cab, s)) {
      // The cubbies across this section: split at the dividers standing in it
      const cuts = dividers.filter((b) => b.min[1] < o.y1 - 1 && b.min[1] + b.size[1] > o.y0 + 1).map((b) => [b.min[0], b.min[0] + b.size[0]] as const).sort((a, b) => a[0] - b[0]);
      const bays: [number, number][] = [];
      let at = x0;
      for (const [a, b] of cuts) { bays.push([at, a]); at = b; }
      bays.push([at, x1]);
      for (const [b0, b1] of bays) {
        const w = b1 - b0 - 1, cx = (b0 + b1) / 2;
        if (w <= 2) continue;
        // Lights under things in this cubby, top down: the section's top, then each lit shelf
        const under: { y: number; z: number }[] = [];
        if (kinds.has('shelves') || kinds.has('shelfFront')) under.push({ y: o.y1 - 0.15, z: cab.depth - 2.5 });
        const shelfYs = edges.filter((e) => e.min[0] + e.size[0] / 2 > b0 && e.min[0] + e.size[0] / 2 < b1 && e.min[1] > o.y0 && e.min[1] < o.y1)
          .map((e) => ({ top: e.min[1] + e.size[1], z: e.min[2] - H.profileBack - 0.3 })).sort((a, b) => b.top - a.top);
        if (kinds.has('shelves')) for (const e of shelfYs) under.push({ y: e.top - 0.85, z: e.z });
        under.forEach((l, i) => {
          glows.push({ p: [cx, l.y, l.z], s: [w, 0.12, 0.3] });
          // What it lands on: the next shelf down, or the bottom of the section
          const next = kinds.has('shelves') ? shelfYs.find((e) => e.top < l.y - 1) : undefined;
          const floor = next ? next.top : o.y0;
          const gap = l.y - floor;
          if (gap < 2) return;
          washes.push({ p: [cx, floor + 0.03, (back + front) / 2], w, h: front - back, face: 'up', bright: 'front', opacity: 0.5 });
          washes.push({ p: [cx, l.y - gap / 2, back], w, h: gap, face: 'back', bright: 'top', opacity: 0.35 });
          void i;
        });
        if (kinds.has('puck')) {
          const n = Math.max(1, Math.round((b1 - b0) / 18));
          for (let k = 0; k < n; k++) {
            const px = b0 + ((b1 - b0) * (k + 0.5)) / n;
            glows.push({ p: [px, o.y1 - 0.1, cab.depth / 2], s: [2.2, 0.15, 2.2] });
          }
          washes.push({ p: [cx, o.y0 + 0.03, (back + front) / 2], w, h: front - back, face: 'up', bright: 'front', opacity: 0.25 });
          washes.push({ p: [cx, (o.y0 + o.y1) / 2, back], w, h: o.y1 - o.y0, face: 'back', bright: 'top', opacity: 0.18 });
        }
      }
      if (kinds.has('stile')) {
        const h = o.y1 - o.y0 - 1;
        for (const x of [x0 + 0.3, x1 - 0.3]) glows.push({ p: [x, (o.y0 + o.y1) / 2, cab.depth - 1.5], s: [0.15, h, 0.4] });
        washes.push({ p: [(x0 + x1) / 2, (o.y0 + o.y1) / 2, back], w: x1 - x0 - 1, h, face: 'back', bright: 'bottom', opacity: 0.12 });
      }
    }
    if (kinds.has('under') && cab.kind === 'wall') {
      glows.push({ p: [cab.width / 2, -0.1, cab.depth - 2], s: [x1 - x0 - 1, 0.12, 0.35] });
      washes.push({ p: [cab.width / 2, -9, 0.05], w: x1 - x0, h: 18, face: 'back', bright: 'top', opacity: 0.3 });
    }
    if (kinds.has('topAccent')) {
      const room = project.room.height - (cab.elevation + cab.height);
      glows.push({ p: [cab.width / 2, cab.height + 0.15, 2.5], s: [cab.width - 2, 0.2, 0.4], accent: true });
      const h = Math.min(room, 36);
      washes.push({ p: [cab.width / 2, cab.height + h / 2, 0.05], w: cab.width - 1, h, face: 'back', bright: 'bottom', opacity: 0.55, accent: true });
    }
    return { glows, washes };
  }, [cab, project, parts]);
  if (!glows.length) return null;
  const white = KELVIN[job.kelvin] ?? KELVIN[3000];
  const accentColor = job.accent === 'rgbw' ? job.accentHex ?? '#ffb060' : white;
  const tex = fadeTexture();
  return (
    <group>
      {glows.map((g, i) => (
        <mesh key={`g${i}`} position={g.p}>
          <boxGeometry args={g.s} />
          <meshBasicMaterial color={g.accent ? accentColor : white} toneMapped={false} />
        </mesh>
      ))}
      {washes.map((w, i) => {
        // The fade texture is brightest at its bottom edge: turn the plane so that edge is toward the light
        const rot: [number, number, number] = w.face === 'up' ? [-Math.PI / 2, 0, 0] : [0, 0, w.bright === 'top' ? Math.PI : 0];
        return (
          <mesh key={`w${i}`} position={w.p} rotation={rot} renderOrder={2}>
            <planeGeometry args={[w.w, w.h]} />
            <meshBasicMaterial color={w.accent ? accentColor : white} map={tex} transparent opacity={w.opacity} depthWrite={false} toneMapped={false}
              polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
          </mesh>
        );
      })}
    </group>
  );
}
