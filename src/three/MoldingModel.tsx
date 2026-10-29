import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mountShape, profileByNum, type MoldPiece } from '../model/moldings';

/** Extrude each moulding profile along its run and merge them into one mesh. */
function buildGeometry(pieces: MoldPiece[]) {
  const geos: THREE.BufferGeometry[] = [];
  for (const pc of pieces) {
    const p = profileByNum(pc.num);
    if (!p || pc.length <= 0) continue;
    const m = mountShape(p);
    // Casing turns its thicker edge (drawn at the bottom) out, away from the opening
    const flip = pc.kind === 'casing';
    const shape = new THREE.Shape(m.pts.map(([u, v]) => new THREE.Vector2(u, pc.hang ? -v : flip ? m.height - v : v)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: pc.length, bevelEnabled: false, curveSegments: 1 });
    // Shape x = out from the face, shape y = up, extrusion = along the run
    const mat = new THREE.Matrix4();
    if (pc.vertical === 'left') mat.set(0, -1, 0, pc.x, 0, 0, 1, pc.y, 1, 0, 0, pc.z, 0, 0, 0, 1);
    else if (pc.vertical === 'right') mat.set(0, 1, 0, pc.x, 0, 0, 1, pc.y, 1, 0, 0, pc.z, 0, 0, 0, 1);
    else if (pc.facing === 'front') mat.set(0, 0, 1, pc.x, 0, 1, 0, pc.y, 1, 0, 0, pc.z, 0, 0, 0, 1);
    else if (pc.facing === 'back') mat.set(0, 0, -1, pc.x, 0, 1, 0, pc.y, -1, 0, 0, pc.z, 0, 0, 0, 1);
    else if (pc.facing === 'left') mat.set(-1, 0, 0, pc.x, 0, 1, 0, pc.y, 0, 0, 1, pc.z, 0, 0, 0, 1);
    else mat.set(1, 0, 0, pc.x, 0, 1, 0, pc.y, 0, 0, 1, pc.z, 0, 0, 0, 1);
    g.applyMatrix4(mat);
    geos.push(g.index ? g.toNonIndexed() : g);
  }
  if (!geos.length) return null;
  const merged = mergeGeometries(geos)!;
  geos.forEach((g) => g.dispose());
  return { mesh: merged, edges: new THREE.EdgesGeometry(merged, 35) };
}

export function MoldingModel({ pieces, color, edgeColor }: { pieces: MoldPiece[]; color: string; edgeColor: string }) {
  const key = JSON.stringify(pieces);
  const geo = useMemo(() => buildGeometry(pieces), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { geo?.mesh.dispose(); geo?.edges.dispose(); }, [geo]);
  if (!geo) return null;
  return (
    <>
      <mesh geometry={geo.mesh} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.7} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
      </mesh>
      <lineSegments geometry={geo.edges}>
        <lineBasicMaterial color={edgeColor} transparent opacity={0.45} />
      </lineSegments>
    </>
  );
}
