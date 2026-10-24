import type { Cabinet, ShopSettings } from '../model/types';
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { modelUrl, placedAppliances, type PlacedAppliance } from '../model/appliances';
import { loadStoredModel, placeModel } from './modelImport';

type Box = { x: number; y: number; z: number; w: number; h: number; d: number; color: string; glow?: string; metal?: boolean };

/** Simple stand-ins: a body and the face details that make each one read (window, controls, flames). */
function boxesFor(p: PlacedAppliance): Box[] {
  const [x, y, z] = p.min, [w, h, d] = p.size;
  const f = z + d; // front face
  const face = (fx: number, fy: number, fw: number, fh: number, color: string, glow?: string, metal?: boolean): Box => ({ x: x + fx, y: y + fy, z: f, w: fw, h: fh, d: 0.15, color, glow, metal });
  const body: Box = { x, y, z, w, h, d, color: '#2a2c30' };
  switch (p.a.kind) {
    case 'microwave':
    case 'builtInMicrowave': {
      const out = [body, face(0.6, 0.6, w * 0.68, h - 1.2, '#111316'), face(w * 0.72, 0.6, w * 0.28 - 0.6, h - 1.2, '#3a3d42')];
      // The trim kit fills out to the face frame opening
      if (p.a.kind === 'builtInMicrowave') {
        const o = p.opening;
        out.push({ x: o.x0, y: o.y0, z: f - 0.05, w: o.x1 - o.x0, h: Math.min(o.y1 - o.y0, h + p.a.top), d: 0.1, color: '#2a2c30' });
      }
      return out;
    }
    case 'microwaveDrawer':
      return [{ ...body, color: '#9fa3a8', metal: true }, face(1, h - 2.5, w - 2, 1.6, '#111316'), face(w / 2 - 4, h / 2 - 0.4, 8, 0.8, '#d0d3d6', undefined, true)];
    case 'oven':
      return [{ ...body, color: '#9fa3a8', metal: true }, face(1.5, 2, w - 3, h - 7, '#111316'), face(1.5, h - 3.5, w - 3, 2.5, '#2a2c30'), face(3, h - 4.6, w - 6, 0.8, '#d0d3d6', undefined, true)];
    case 'fireplace':
      return [{ ...body, color: '#141414' }, face(0.75, 0.75, w - 1.5, h - 1.5, '#0b0b0c'), { ...face(w * 0.15, 1.5, w * 0.7, h * 0.35, '#5a1e05', '#ff7a1a'), z: f + 0.15 }];
    case 'gasInsert':
      return [{ ...body, color: '#141414' }, face(0.75, 0.75, w - 1.5, h - 1.5, '#0b0b0c'), { ...face(w * 0.2, 2, w * 0.6, 3, '#4a3426'), z: f + 0.1 }, { ...face(w * 0.22, 4, w * 0.56, h * 0.3, '#3a1a06', '#ff9a3c'), z: f + 0.15 }];
    case 'masonry':
      // The opening into an existing firebox: dark soot, brick at the back
      return [{ ...body, color: '#1c1512' }, { ...face(w * 0.08, h * 0.05, w * 0.84, h * 0.85, '#5a2e22'), z: z + 0.5 }];
    case 'beverage':
      return [{ ...body, color: '#9fa3a8', metal: true }, face(1, 1, w - 2, h - 2, '#20262b')];
    case 'tv':
      return [{ ...body, color: '#111316' }, face(0.4, 0.4, w - 0.8, h - 0.8, '#0a0c0f')];
    default:
      return [{ ...body, color: '#6b6f75' }];
  }
}

/** The maker's model in the appliance's box; the plain stand-in until it loads, or if it can't. */
function MakerModel({ p, fallback }: { p: PlacedAppliance; fallback: React.ReactNode }) {
  const m = p.a.model3d!;
  const url = modelUrl(m);
  const [obj, setObj] = useState<THREE.Object3D | null>(null);
  useEffect(() => {
    let live = true;
    setObj(null);
    loadStoredModel(url).then((src) => { if (live) setObj(placeModel(src, m, { min: p.min, size: p.size })); }).catch(() => { if (live) setObj(null); });
    return () => { live = false; };
  }, [url, m.units, m.up, m.turn, p.min.join(), p.size.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  return obj ? <primitive object={obj} /> : <>{fallback}</>;
}

const boxMeshes = (boxes: Box[], key: string) => boxes.map((b, i) => (
  <mesh key={`${key}-${i}`} position={[b.x + b.w / 2, b.y + b.h / 2, b.z + b.d / 2]}>
    <boxGeometry args={[b.w, b.h, b.d]} />
    <meshStandardMaterial color={b.color} roughness={b.metal ? 0.35 : 0.5} metalness={b.metal ? 0.6 : 0.1} emissive={b.glow ?? '#000000'} emissiveIntensity={b.glow ? 0.9 : 0} />
  </mesh>
));

/** Appliances in a cabinet's appliance rows (or a mantel's firebox), in cabinet-local coordinates. */
export function ApplianceModel({ cab, settings }: { cab: Cabinet; settings: ShopSettings }) {
  const placed = placedAppliances(cab, settings);
  if (!placed.length) return null;
  return (
    <group>
      {placed.map((p, i) => (p.a.model3d
        ? <MakerModel key={i} p={p} fallback={boxMeshes(boxesFor(p), `f${i}`)} />
        : <group key={i}>{boxMeshes(boxesFor(p), `b${i}`)}</group>))}
    </group>
  );
}
