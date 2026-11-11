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
import { cutDepth, cutInset, normalized, offsetOutline, outlineEdges, partSize, type CustomPart, type EdgeCut } from '../model/customParts';

export type PartView = '3d' | 'front' | 'side' | 'top';
/** A moulding is shown as a sample this long, its profile on the ends. */
export const SAMPLE_LENGTH = 24;

function usePartGeometry(part: CustomPart) {
  return useMemo(() => mergeSmooth(partSolid(part)), [part]);
}

/**
 * The part as a solid: slices through the thickness from the left face to the right, each slice the
 * outline pulled in along any edge whose router profile reaches that deep. With no profiles it's the
 * outline cut straight through.
 */
export function partSolid(part: CustomPart): THREE.BufferGeometry {
  const n0 = normalized(part);
  let { pts, edgeOf } = outlineEdges(n0, 32);
  // Counter-clockwise, so "inside" is to the left of each piece
  let area = 0;
  for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; area += x1 * y2 - x2 * y1; }
  if (area < 0) {
    const n = pts.length;
    pts = [...pts].reverse();
    edgeOf = pts.map((_, i) => (i < n - 1 ? edgeOf[n - 2 - i] : edgeOf[n - 1]));
  }
  const t = part.thickness;
  const cutOn = (side: 'left' | 'right') => part.points.map((p) => (p.cut && (p.cut.faces === 'both' || p.cut.faces === side) ? p.cut : undefined));
  const left = cutOn('left'), right = cutOn('right');
  const depthOf = (cs: (EdgeCut | undefined)[]) => Math.max(0, ...cs.map((c) => (c ? cutDepth(c) : 0)));
  let dL = depthOf(left), dR = depthOf(right);
  if (dL + dR > t * 0.96) { const k = (t * 0.96) / (dL + dR); dL *= k; dR *= k; }
  const steps = 14;
  const layers: { x: number; poly: [number, number][] }[] = [];
  const at = (cs: (EdgeCut | undefined)[], z: number) => offsetOutline(pts, edgeOf.map((e) => (cs[e] ? cutInset(cs[e]!.kind, cs[e]!.size, z) : 0)));
  if (dL > 0) for (let i = 0; i <= steps; i++) { const z = (dL * i) / steps; layers.push({ x: -t / 2 + z, poly: at(left, z) }); }
  else layers.push({ x: -t / 2, poly: pts });
  if (dR > 0) for (let i = steps; i >= 0; i--) { const z = (dR * i) / steps; layers.push({ x: t / 2 - z, poly: at(right, z) }); }
  else layers.push({ x: t / 2, poly: pts });

  const pos: number[] = [];
  const W = (x: number, p: [number, number]) => new THREE.Vector3(x, p[1], p[0]);
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, out: THREE.Vector3) => {
    const nrm = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    if (nrm.lengthSq() < 1e-14) return;
    if (nrm.dot(out) < 0) [b, c] = [c, b];
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };
  const n = pts.length;
  // The walls between neighboring slices, each piece facing out from the outline
  for (let L = 0; L < layers.length - 1; L++) {
    const A = layers[L], B = layers[L + 1];
    for (let k = 0; k < n; k++) {
      const k1 = (k + 1) % n;
      const dx = pts[k1][0] - pts[k][0], dy = pts[k1][1] - pts[k][1];
      // Out from the outline, leaning toward the nearer face (a profile's surfaces tip that way; a rabbet's shoulder faces it)
      const L2 = Math.hypot(dx, dy) || 1;
      const out = new THREE.Vector3(A.x + B.x < 0 ? -0.7 : 0.7, -dx / L2, dy / L2);
      const a0 = W(A.x, A.poly[k]), a1 = W(A.x, A.poly[k1]), b0 = W(B.x, B.poly[k]), b1 = W(B.x, B.poly[k1]);
      tri(a0, a1, b1, out); tri(a0, b1, b0, out);
    }
  }
  // The two faces
  const cap = (layer: { x: number; poly: [number, number][] }, out: THREE.Vector3) => {
    const contour = layer.poly.map(([x, y]) => new THREE.Vector2(x, y));
    for (const [i, j, k] of THREE.ShapeUtils.triangulateShape(contour, [])) tri(W(layer.x, layer.poly[i]), W(layer.x, layer.poly[j]), W(layer.x, layer.poly[k]), out);
  };
  cap(layers[0], new THREE.Vector3(-1, 0, 0));
  cap(layers[layers.length - 1], new THREE.Vector3(1, 0, 0));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
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

export function PartScene({ part: drawn, view, color = '#d8b98a' }: { part: CustomPart; view: PartView; color?: string }) {
  // A moulding: its profile run along a sample length, with no router profiles of its own
  const part = useMemo(() => (drawn.kind === 'moulding' ? { ...drawn, thickness: SAMPLE_LENGTH, points: drawn.points.map(({ cut: _c, ...p }) => p) } : drawn), [drawn]);
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
