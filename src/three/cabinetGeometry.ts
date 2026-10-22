import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Part } from '../model/types';

export interface CabinetGeometry {
  /** One merged mesh per material/shade, so a whole kitchen stays cheap to draw. */
  meshes: { key: string; material: Part['material']; shade: number; geometry: THREE.BufferGeometry }[];
  edges: THREE.BufferGeometry;
}

export function buildCabinetGeometry(parts: Part[]): CabinetGeometry {
  const groups = new Map<string, { material: Part['material']; shade: number; geos: THREE.BufferGeometry[] }>();
  const edgePts: number[] = [];
  for (const p of parts) {
    for (const b of p.boxes) {
      const [sx, sy, sz] = b.size;
      if (sx <= 0 || sy <= 0 || sz <= 0) continue;
      const [x, y, z] = b.min;
      // The toe kick gets covered with a finished skin on site, so draw it in the finish color, in shadow.
      const material = p.role === 'toekick' ? 'faceframe' : p.material;
      const shade = b.shade ?? (p.role === 'back' ? 0.9 : p.role === 'toekick' ? 0.55 : 1);
      const key = `${material}:${shade}`;
      let g = groups.get(key);
      if (!g) groups.set(key, (g = { material, shade, geos: [] }));
      const geo = new THREE.BoxGeometry(sx, sy, sz);
      geo.translate(x + sx / 2, y + sy / 2, z + sz / 2);
      g.geos.push(geo);
      pushBoxEdges(edgePts, x, y, z, x + sx, y + sy, z + sz);
    }
  }
  const meshes = [...groups.entries()].map(([key, g]) => {
    const geometry = mergeGeometries(g.geos)!;
    g.geos.forEach((x) => x.dispose());
    return { key, material: g.material, shade: g.shade, geometry };
  });
  const edges = new THREE.BufferGeometry();
  edges.setAttribute('position', new THREE.Float32BufferAttribute(edgePts, 3));
  return { meshes, edges };
}

function pushBoxEdges(out: number[], x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
  const c = [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
  ];
  const e = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7];
  for (const i of e) out.push(...c[i]);
}
