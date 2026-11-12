// The furniture builder's view: the piece on its own, turned in 3D or seen straight on from the
// front, the side or the top, like the part builder.
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import type { DiningTable } from '../model/furniture';
import type { TablePart } from '../model/tableParts';
import { TablePiece, type PickProps } from './TableModel';

export type FurnitureView = '3d' | 'front' | 'side' | 'top';

/** The piece's extent from its parts (boxes, metal members and plates). */
function extent(parts: TablePart[]): { min: THREE.Vector3; max: THREE.Vector3 } {
  const b = new THREE.Box3();
  for (const p of parts) {
    for (const x of p.boxes) { b.expandByPoint(new THREE.Vector3(...x.min)); b.expandByPoint(new THREE.Vector3(x.min[0] + x.size[0], x.min[1] + x.size[1], x.min[2] + x.size[2])); }
    for (const m of p.metal?.members ?? []) { b.expandByPoint(new THREE.Vector3(...m.a)); b.expandByPoint(new THREE.Vector3(...m.b)); }
    for (const pl of p.metal?.plates ?? []) { b.expandByPoint(new THREE.Vector3(...pl.min)); b.expandByPoint(new THREE.Vector3(pl.min[0] + pl.size[0], pl.min[1] + pl.size[1], pl.min[2] + pl.size[2])); }
  }
  if (b.isEmpty()) b.set(new THREE.Vector3(-24, 0, -12), new THREE.Vector3(24, 30, 12));
  return { min: b.min, max: b.max };
}

export function FurnitureScene({ look, parts, view, selected, onPick }: { look: DiningTable; parts: TablePart[]; view: FurnitureView } & PickProps) {
  const { min, max } = extent(parts);
  const c = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);
  const s = new THREE.Vector3().subVectors(max, min);
  const r = Math.max(s.x, s.y, s.z, 12);
  const target: [number, number, number] = [c.x, c.y, c.z];
  const ortho = view !== '3d';
  const cam: Record<Exclude<FurnitureView, '3d'>, { pos: [number, number, number]; up: [number, number, number]; span: [number, number] }> = {
    front: { pos: [c.x, c.y, max.z + r * 4], up: [0, 1, 0], span: [s.x, s.y] },
    side: { pos: [max.x + r * 4, c.y, c.z], up: [0, 1, 0], span: [s.z, s.y] },
    top: { pos: [c.x, max.y + r * 4, c.z], up: [0, 0, -1], span: [s.x, s.z] },
  };
  return (
    <Canvas shadows="soft" dpr={[1, 2]} gl={{ antialias: true, preserveDrawingBuffer: true }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.NeutralToneMapping; gl.toneMappingExposure = 0.95; }}
      onPointerMissed={() => onPick?.(null)}>
      <color attach="background" args={['#f4f2ee']} />
      {ortho
        ? <FitOrtho key={view} pos={cam[view as Exclude<FurnitureView, '3d'>].pos} up={cam[view as Exclude<FurnitureView, '3d'>].up} span={cam[view as Exclude<FurnitureView, '3d'>].span} target={target} />
        : <PerspectiveCamera makeDefault fov={35} near={1} far={5000} position={[c.x + r * 1.45, c.y + r * 0.95, c.z + r * 1.75]} />}
      <OrbitControls makeDefault target={target} enableDamping enableRotate={!ortho} minDistance={r * 0.25} maxDistance={r * 6} maxPolarAngle={Math.PI * 0.52} />
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#ffffff', '#c9c2b6', 0.5]} />
      <directionalLight position={[r, r * 2, r * 1.2]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-r} shadow-camera-right={r} shadow-camera-top={r} shadow-camera-bottom={-r} shadow-camera-far={r * 6} />
      <directionalLight position={[-r, r, -r]} intensity={0.35} />
      <TablePiece t={look} parts={parts} selected={selected} onPick={onPick} />
      {!ortho && (
        <mesh rotation-x={-Math.PI / 2} position={[c.x, -0.01, c.z]} receiveShadow>
          <circleGeometry args={[r * 2, 64]} /><meshStandardMaterial color="#e9e5dd" roughness={0.95} />
        </mesh>
      )}
    </Canvas>
  );
}

function FitOrtho({ pos, up, span, target }: { pos: [number, number, number]; up: [number, number, number]; span: [number, number]; target: [number, number, number] }) {
  const size = useThree((st) => st.size);
  const zoom = Math.min(size.width / (Math.max(span[0], 1) * 1.35), size.height / (Math.max(span[1], 1) * 1.35));
  return <OrthographicCamera makeDefault position={pos} up={up} near={0.1} far={5000} zoom={zoom} onUpdate={(cm) => { cm.lookAt(...target); cm.updateProjectionMatrix(); }} />;
}
