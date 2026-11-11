// A custom part on its own, solid and shaded: turn it around in 3D, or look straight at it from the
// front, the side or the top like an elevation. The outline is cut through the part's thickness;
// sharp edges are drawn in, the curved faces are left smooth and read by their shading.
//
// World: x across the part's thickness (its width seen from the front), y up, z out from the wall
// toward you (the outline's x).
import { useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Edges, OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { normalized, partOutline, partSize, type CustomPart } from '../model/customParts';

export type PartView = '3d' | 'front' | 'side' | 'top';

function usePartGeometry(part: CustomPart) {
  return useMemo(() => {
    const n = normalized(part);
    let pts = partOutline(n, 48).map(([x, y]) => new THREE.Vector2(x, y));
    if (THREE.ShapeUtils.isClockWise(pts)) pts = pts.reverse();
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: part.thickness, bevelEnabled: false, curveSegments: 1 });
    // Shape x (out from the wall) to world z; the extrusion (thickness) to world x, centered
    g.rotateY(-Math.PI / 2);
    g.translate(part.thickness / 2, 0, 0);
    // Smooth the curved faces: merge the side walls' vertices so the arcs shade round
    const merged = mergeSmooth(g);
    return merged;
  }, [part]);
}

/** Side walls shaded smooth across shallow bends (an arc), sharp at real corners. */
function mergeSmooth(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const ng = g.toNonIndexed();
  ng.computeVertexNormals();
  const pos = ng.getAttribute('position'), nor = ng.getAttribute('normal');
  // Average normals of coincident vertices whose faces bend less than ~35°
  const key = (i: number) => `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
  const groups = new Map<string, number[]>();
  for (let i = 0; i < pos.count; i++) { const k = key(i); const a = groups.get(k); if (a) a.push(i); else groups.set(k, [i]); }
  const out = new Float32Array(nor.count * 3);
  const v = new THREE.Vector3(), w = new THREE.Vector3(), sum = new THREE.Vector3();
  const cos = Math.cos((35 * Math.PI) / 180);
  for (const idx of groups.values()) {
    for (const i of idx) {
      v.fromBufferAttribute(nor, i);
      sum.set(0, 0, 0);
      for (const j of idx) { w.fromBufferAttribute(nor, j); if (v.dot(w) >= cos) sum.add(w); }
      sum.normalize();
      out[i * 3] = sum.x; out[i * 3 + 1] = sum.y; out[i * 3 + 2] = sum.z;
    }
  }
  ng.setAttribute('normal', new THREE.BufferAttribute(out, 3));
  return ng;
}

function PartMesh({ part, color }: { part: CustomPart; color: string }) {
  const geo = usePartGeometry(part);
  return (
    <mesh geometry={geo} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.72} metalness={0} />
      <Edges threshold={30} color="#1b1b1b" lineWidth={1.2} />
    </mesh>
  );
}

export function PartScene({ part, view, color = '#d8b98a' }: { part: CustomPart; view: PartView; color?: string }) {
  const s = partSize(part);
  const W = part.thickness, H = s.h, D = s.w;
  const r = Math.max(W, H, D);
  const center: [number, number, number] = [0, H / 2, D / 2];
  const ortho = view !== '3d';
  // Each elevation looks straight at the part; the zoom fits it with a margin
  const cam: Record<Exclude<PartView, '3d'>, { pos: [number, number, number]; up: [number, number, number]; span: [number, number] }> = {
    front: { pos: [0, H / 2, D + r * 4], up: [0, 1, 0], span: [W, H] },
    // From the left, like the outline editor: the wall on the left, the front on the right
    side: { pos: [-r * 4, H / 2, D / 2], up: [0, 1, 0], span: [D, H] },
    top: { pos: [0, H + r * 4, D / 2], up: [0, 0, -1], span: [W, D] },
  };
  return (
    <Canvas shadows="soft" dpr={[1, 2]} gl={{ antialias: true, preserveDrawingBuffer: true }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.NeutralToneMapping; gl.toneMappingExposure = 1; }}>
      <color attach="background" args={['#f4f2ee']} />
      {ortho ? (
        <FitOrtho key={view} pos={cam[view as Exclude<PartView, '3d'>].pos} up={cam[view as Exclude<PartView, '3d'>].up} span={cam[view as Exclude<PartView, '3d'>].span} target={center} />
      ) : (
        <PerspectiveCamera makeDefault fov={30} near={0.1} far={r * 60} position={[-r * 1.8, H * 0.85 + r * 0.8, D / 2 + r * 2.3]} />
      )}
      <OrbitControls makeDefault target={center} enableDamping enableRotate={!ortho} minDistance={r * 0.6} maxDistance={r * 12} />
      <ambientLight intensity={0.45} />
      <hemisphereLight args={['#ffffff', '#bdb6aa', 0.55]} />
      {/* Key light from the front-right and above, a soft fill from the other side: curves read by their shading */}
      <directionalLight position={[-r * 2, r * 3, D + r * 2.5]} intensity={1.7} castShadow shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-r * 2} shadow-camera-right={r * 2} shadow-camera-top={r * 2} shadow-camera-bottom={-r * 2} shadow-camera-far={r * 12} shadow-bias={-0.0004} />
      <directionalLight position={[-r * 2, r, -r]} intensity={0.4} />
      <PartMesh part={part} color={color} />
      {!ortho && (
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, D / 2]} receiveShadow>
          <planeGeometry args={[r * 6, r * 6]} /><shadowMaterial opacity={0.18} />
        </mesh>
      )}
    </Canvas>
  );
}

/** An orthographic camera looking straight at the part, zoomed to fit it. */
function FitOrtho({ pos, up, span, target }: { pos: [number, number, number]; up: [number, number, number]; span: [number, number]; target: [number, number, number] }) {
  const size = useThree((st) => st.size);
  const zoom = Math.min(size.width / (span[0] * 1.6), size.height / (span[1] * 1.6));
  return <OrthographicCamera makeDefault position={pos} up={up} near={0.1} far={1000} zoom={zoom} onUpdate={(c) => { c.lookAt(...target); c.updateProjectionMatrix(); }} />;
}
