import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mountShape, profileByNum, type MoldPiece } from '../model/moldings';

/** Extrude each moulding profile along its run and merge them into one mesh. */
function buildGeometry(pieces: MoldPiece[]) {
  const geos: THREE.BufferGeometry[] = [];
  const edgePts: number[] = [];
  for (const pc of pieces) {
    const p = profileByNum(pc.num);
    if (!p || pc.length <= 0) continue;
    const m = mountShape(p);
    // Casing turns its thicker edge (drawn at the bottom) out, away from the opening
    const flip = pc.kind === 'casing';
    // Wind the outline the same way every time: a profile mirrored to stand it up (or hung upside
    // down) would otherwise extrude inside out and light dark, not matching the cabinet's color
    let outline = m.pts.map(([u, v]) => new THREE.Vector2(u, pc.hang ? -v : flip ? m.height - v : v));
    if (THREE.ShapeUtils.isClockWise(outline)) outline = outline.reverse();
    const shape = new THREE.Shape(outline);
    const g = new THREE.ExtrudeGeometry(shape, { depth: pc.length, bevelEnabled: false, curveSegments: 1 });
    // Mitered ends: each point moves along the run by how far it stands out from the face
    if (pc.cut && (pc.cut[0] !== 'square' || pc.cut[1] !== 'square')) {
      const pos = g.attributes.position as THREE.BufferAttribute;
      const shift = (cut: string, u: number) => (cut === 'out' ? m.depth - u : cut === 'in' ? u : 0);
      for (let i = 0; i < pos.count; i++) {
        const u = pos.getX(i), w = pos.getZ(i);
        if (Math.abs(w) < 1e-6) pos.setZ(i, shift(pc.cut[0], u));
        else if (Math.abs(w - pc.length) < 1e-6) pos.setZ(i, pc.length - shift(pc.cut[1], u));
      }
      pos.needsUpdate = true;
      g.computeVertexNormals();
    }
    // Shape x = out from the face, shape y = up, extrusion = along the run
    const mat = new THREE.Matrix4();
    if (pc.vertical === 'left') mat.set(0, -1, 0, pc.x, 0, 0, 1, pc.y, 1, 0, 0, pc.z, 0, 0, 0, 1);
    else if (pc.vertical === 'right') mat.set(0, 1, 0, pc.x, 0, 0, 1, pc.y, 1, 0, 0, pc.z, 0, 0, 0, 1);
    else if (pc.facing === 'front') mat.set(0, 0, 1, pc.x, 0, 1, 0, pc.y, 1, 0, 0, pc.z, 0, 0, 0, 1);
    else if (pc.facing === 'back') mat.set(0, 0, -1, pc.x, 0, 1, 0, pc.y, -1, 0, 0, pc.z, 0, 0, 0, 1);
    else if (pc.facing === 'left') mat.set(-1, 0, 0, pc.x, 0, 1, 0, pc.y, 0, 0, 1, pc.z, 0, 0, 0, 1);
    else mat.set(1, 0, 0, pc.x, 0, 1, 0, pc.y, 0, 0, 1, pc.z, 0, 0, 0, 1);
    // Edge lines, leaving out the end outline where the run carries on into the next cabinet's
    const e = new THREE.EdgesGeometry(g, 35);
    const ep = e.getAttribute('position');
    const atEnd = (z: number, k: 0 | 1) => !!pc.joined?.[k] && Math.abs(z - (k ? pc.length : 0)) < 1e-3;
    const v = new THREE.Vector3(), w = new THREE.Vector3();
    for (let i = 0; i < ep.count; i += 2) {
      v.fromBufferAttribute(ep, i); w.fromBufferAttribute(ep, i + 1);
      if ((atEnd(v.z, 0) && atEnd(w.z, 0)) || (atEnd(v.z, 1) && atEnd(w.z, 1))) continue;
      v.applyMatrix4(mat); w.applyMatrix4(mat);
      edgePts.push(v.x, v.y, v.z, w.x, w.y, w.z);
    }
    e.dispose();
    g.applyMatrix4(mat);
    const flat = g.index ? g.toNonIndexed() : g;
    // Turning the profile to its run swaps two axes, a mirror: wind the triangles back the other way
    // so the faces point out and light like the cabinet beside them (not lit from behind, darker)
    if (mat.determinant() < 0) {
      for (const name of ['position', 'normal', 'uv'] as const) {
        const a = flat.getAttribute(name) as THREE.BufferAttribute | undefined;
        if (!a) continue;
        const n = a.itemSize, arr = a.array as Float32Array;
        for (let t = 0; t < a.count; t += 3) for (let k = 0; k < n; k++) {
          const i1 = (t + 1) * n + k, i2 = (t + 2) * n + k;
          const tmp = arr[i1]; arr[i1] = arr[i2]; arr[i2] = tmp;
        }
        a.needsUpdate = true;
      }
    }
    geos.push(flat);
  }
  if (!geos.length) return null;
  const merged = mergeGeometries(geos)!;
  geos.forEach((g) => g.dispose());
  const edges = new THREE.BufferGeometry();
  edges.setAttribute('position', new THREE.Float32BufferAttribute(edgePts, 3));
  return { mesh: merged, edges };
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
