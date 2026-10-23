import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CutShape, Part } from '../model/types';

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
      const material = p.role === 'toekick' || p.look === 'paint' ? 'faceframe' : p.look === 'wood' ? 'solidWood' : p.material;
      const shade = b.shade ?? (p.role === 'back' ? 0.9 : p.role === 'toekick' ? 0.55 : 1);
      const key = `${material}:${shade}`;
      let g = groups.get(key);
      if (!g) groups.set(key, (g = { material, shade, geos: [] }));
      const geo = new THREE.BoxGeometry(sx, sy, sz);
      geo.translate(x + sx / 2, y + sy / 2, z + sz / 2);
      g.geos.push(geo);
      pushBoxEdges(edgePts, x, y, z, x + sx, y + sy, z + sz);
    }
    for (const c of p.shapes ?? []) {
      const material = p.look === 'paint' ? 'faceframe' : p.look === 'wood' ? 'solidWood' : p.material;
      const key = `${material}:1:cut`;
      let g = groups.get(key);
      if (!g) groups.set(key, (g = { material, shade: 1, geos: [] }));
      const geo = shapeGeometry(c);
      g.geos.push(geo);
      // Edges only where faces meet at a real corner, so the curve reads smooth
      const e = new THREE.EdgesGeometry(geo, 30);
      edgePts.push(...(e.getAttribute('position').array as Float32Array));
      e.dispose();
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

/** Extrude a shaped piece's outline through its thickness and stand it in place. */
function shapeGeometry(c: CutShape): THREE.BufferGeometry {
  const shape = new THREE.Shape(c.outline.map(([u, v]) => new THREE.Vector2(u, v)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: c.thickness, bevelEnabled: false, curveSegments: 1 }).toNonIndexed();
  const [x, y, z] = c.min;
  const m = new THREE.Matrix4();
  // Along x: outline in the x-y plane, thickness toward +z. Along z: outline in the z-y plane, thickness toward +x.
  if (c.along === 'x') m.makeTranslation(x, y, z);
  else m.set(0, 0, -1, x + c.thickness, 0, 1, 0, y, 1, 0, 0, z, 0, 0, 0, 1);
  geo.applyMatrix4(m);
  geo.computeVertexNormals();
  return geo;
}
