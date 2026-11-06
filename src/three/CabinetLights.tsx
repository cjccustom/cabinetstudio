// What the cabinet lighting looks like lit: a glowing line under each shelf front (Häfele shelf
// lighting, behind the drop edge) washing down the case back, and an uplight on top of the
// bookcases washing up the wall in the accent color. Drawn in the cabinet's own frame, from the
// same parts the cut list has, so the light lands where the shelves are.
import { useMemo } from 'react';
import * as THREE from 'three';
import type { Cabinet, Part, Project } from '../model/types';
import { cabinetFixtures, hafeleOf, lightingJobOf } from '../model/cabinetLighting';
import { eff, openSpans } from '../model/parts';

const KELVIN: Record<number, string> = { 2700: '#ffc184', 3000: '#ffcf9a', 3500: '#ffdcb6', 4000: '#ffe8d2' };

/** A soft vertical fade, bright at the bottom edge (v = 0) to nothing at the top. */
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
  grad.addColorStop(0.4, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 4, 128);
  fade = new THREE.CanvasTexture(cv);
  return fade;
}

interface Strip { x: number; y: number; z: number; w: number }
interface Wash { x: number; y: number; z: number; w: number; h: number; up: boolean }

export function CabinetLights({ cab, project, parts }: { cab: Cabinet; project: Project; parts: Part[] }) {
  const job = lightingJobOf(project);
  const fx = useMemo(() => cabinetFixtures(cab, project, job), [cab, project, job]);
  const { strips, washes, accent } = useMemo(() => {
    const strips: Strip[] = [], washes: Wash[] = [], accent: { strip: Strip; wash: Wash } [] = [];
    if (!fx.length) return { strips, washes, accent };
    const s = eff(cab, project.settings);
    const H = hafeleOf(project);
    const back = 0.9;
    if (fx.some((f) => f.kind === 'shelves')) {
      // Under each shelf, just behind its drop edge
      const edges = parts.filter((p) => p.name === 'Shelf drop edge').flatMap((p) => p.boxes);
      const tops = openSpans(cab, s);
      const inner0 = s.stileWidth, innerW = Math.max(6, cab.width - 2 * s.stileWidth);
      const lights = [
        ...edges.map((b) => ({ x: b.min[0], w: b.size[0], y: b.min[1] + b.size[1] - 0.75 - 0.1, z: b.min[2] - H.profileBack - 0.3 })),
        // And under the top of each open section
        ...tops.map((o) => ({ x: inner0 + 0.5, w: innerW - 1, y: o.y1 - 0.15, z: cab.depth - 2 })),
      ];
      for (const l of lights) {
        strips.push({ x: l.x, y: l.y, z: l.z, w: l.w });
        // Down the case back to the shelf below (or the bottom of the section)
        const below = Math.max(...[...lights.map((m) => m.y), ...tops.map((o) => o.y0)].filter((y) => y < l.y - 1), l.y - 14);
        washes.push({ x: l.x, y: below, z: back, w: l.w, h: l.y - below, up: false });
      }
    }
    if (fx.some((f) => f.kind === 'topAccent')) {
      const room = project.room.height - (cab.elevation + cab.height);
      const strip = { x: 1, y: cab.height + 0.15, z: 2.5, w: cab.width - 2 };
      accent.push({ strip, wash: { x: 0.5, y: cab.height, z: 0.05, w: cab.width - 1, h: Math.min(room, 36), up: true } });
    }
    return { strips, washes, accent };
  }, [fx, cab, project, parts]);
  if (!fx.length) return null;
  const white = KELVIN[job.kelvin] ?? KELVIN[3000];
  const accentColor = job.accent === 'rgbw' ? job.accentHex ?? '#ffb060' : white;
  const tex = fadeTexture();
  const washMat = (color: string, opacity: number) => (
    <meshBasicMaterial color={color} map={tex} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
  );
  return (
    <group>
      {strips.map((l, i) => (
        <mesh key={`s${i}`} position={[l.x + l.w / 2, l.y, l.z]}>
          <boxGeometry args={[l.w, 0.12, 0.35]} />
          <meshBasicMaterial color={white} toneMapped={false} />
        </mesh>
      ))}
      {washes.map((w, i) => (
        // Brightest at the light: the fade's bright edge is turned to the top for a downlight
        <mesh key={`w${i}`} position={[w.x + w.w / 2, w.y + w.h / 2, w.z]} rotation-z={w.up ? 0 : Math.PI}>
          <planeGeometry args={[w.w, w.h]} />
          {washMat(white, 0.95)}
        </mesh>
      ))}
      {accent.map((a, i) => (
        <group key={`a${i}`}>
          <mesh position={[a.strip.x + a.strip.w / 2, a.strip.y, a.strip.z]}>
            <boxGeometry args={[a.strip.w, 0.2, 0.4]} />
            <meshBasicMaterial color={accentColor} toneMapped={false} />
          </mesh>
          <mesh position={[a.wash.x + a.wash.w / 2, a.wash.y + a.wash.h / 2, a.wash.z]}>
            <planeGeometry args={[a.wash.w, a.wash.h]} />
            {washMat(accentColor, 1)}
          </mesh>
        </group>
      ))}
    </group>
  );
}
