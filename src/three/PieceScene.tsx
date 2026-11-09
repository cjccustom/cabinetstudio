// One piece of furniture on its own, for looking it over up close with the customer: on a plain
// floor, lit softly, the camera turning around it.
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import type { DiningTable } from '../model/furniture';
import { tableParts } from '../model/tableParts';
import { TablePiece } from './TableModel';

export function PieceScene({ t }: { t: DiningTable }) {
  const parts = tableParts(t);
  const top = Math.max(...parts.flatMap((p) => p.boxes.map((b) => b.min[1] + b.size[1])), t.height);
  const r = Math.max(t.length, t.width, top) ;
  const target: [number, number, number] = [0, top * 0.45, 0];
  return (
    <Canvas shadows="soft" dpr={[1, 2]} gl={{ antialias: true, preserveDrawingBuffer: true }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.NeutralToneMapping; gl.toneMappingExposure = 0.95; }}>
      <PerspectiveCamera makeDefault fov={35} near={1} far={5000} position={[r * 1.1, top * 0.9 + r * 0.35, r * 1.35]} />
      <OrbitControls makeDefault target={target} enableDamping minDistance={r * 0.25} maxDistance={r * 5} maxPolarAngle={Math.PI * 0.52} />
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#ffffff', '#c9c2b6', 0.5]} />
      <directionalLight position={[r, r * 2, r * 1.2]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-r} shadow-camera-right={r} shadow-camera-top={r} shadow-camera-bottom={-r} shadow-camera-far={r * 6} />
      <directionalLight position={[-r, r, -r]} intensity={0.35} />
      <TablePiece t={t} parts={parts} />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[r * 2, 64]} /><meshStandardMaterial color="#e9e5dd" roughness={0.95} />
      </mesh>
    </Canvas>
  );
}
