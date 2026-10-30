import type { ThreeEvent } from '@react-three/fiber';
import type { Project } from '../model/types';
import { ladderOf } from '../model/ladder';
import { wallTransform } from '../model/layout';
import { woodColor } from '../model/woodColors';
import { useStore } from '../store';

const metal = { black: '#1d1d1f', brass: '#b8913e', nickel: '#c3c5c7', bronze: '#5a4532' } as const;

/**
 * The rolling ladder: the rail on its brackets across the bookcase faces, end stops, and the ladder
 * leaning from its floor wheels up to the hooks over the rail. Drawn in the wall's own frame.
 */
export function LadderModel({ project }: { project: Project }) {
  const L = ladderOf(project);
  if (!L.on) return null;
  const { pos, rotY } = wallTransform(project.room, L.wall, 0);
  const wood = woodColor(L.wood) ?? '#b98a5a';
  const hw = metal[L.hardware];
  const metalMat = <meshStandardMaterial color={hw} metalness={L.hardware === 'black' ? 0.3 : 0.8} roughness={0.35} />;
  const woodMat = <meshStandardMaterial color={wood} roughness={0.6} />;
  const railLen = L.to - L.from;
  const r = L.railDia / 2;
  // Brackets no more than 36" apart (Putnam), one near each end
  const nb = Math.max(2, Math.ceil((railLen - 6) / 36) + 1);
  const brackets = Array.from({ length: nb }, (_, i) => L.from + 3 + ((railLen - 6) * i) / (nb - 1));
  // The side rails ride just in front of the rail, the hooks reaching back over it
  const d = r + 0.25 + L.stileDepth / 2;
  const open = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); useStore.getState().edit({ kind: 'ladder' }); };
  const xs = [-L.width / 2 + L.stileThick / 2, L.width / 2 - L.stileThick / 2];
  return (
    <group position={pos} rotation-y={rotY} onDoubleClick={open}>
      {/* Rail, brackets and end stops */}
      <mesh position={[L.from + railLen / 2, L.railHeight, L.railZ]} rotation-z={Math.PI / 2} castShadow>
        <cylinderGeometry args={[r, r, railLen, 20]} />{metalMat}
      </mesh>
      {brackets.map((x) => (
        <mesh key={x} position={[x, L.railHeight, (L.face + L.railZ) / 2]} rotation-x={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.3, 0.3, L.railZ - L.face, 12]} />{metalMat}
        </mesh>
      ))}
      {[L.from + 0.6, L.to - 0.6].map((x) => (
        <mesh key={x} position={[x, L.railHeight, L.railZ]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[r * 1.6, r * 1.6, 1.2, 20]} />{metalMat}
        </mesh>
      ))}
      {/* The ladder: from the foot, leaning back to the rail */}
      <group position={[L.at, 0, L.railZ + L.footOut + d / Math.cos(L.lean)]} rotation-x={-L.lean}>
        {xs.map((x) => (
          <mesh key={x} position={[x, L.length / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[L.stileThick, L.length, L.stileDepth]} />{woodMat}
          </mesh>
        ))}
        {L.stepAt.map((y) => (
          // Steps sit level, so tilt each one back against the ladder's lean
          <mesh key={y} position={[0, y, 0]} rotation-x={L.lean} castShadow receiveShadow>
            <boxGeometry args={[L.width - 2 * L.stileThick, 0.875, L.stepDepth]} />{woodMat}
          </mesh>
        ))}
        {/* The turned rung at the top */}
        <mesh position={[0, L.length - 2.5, 0]} rotation-z={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.6, 0.6, L.width - 2 * L.stileThick, 16]} />{woodMat}
        </mesh>
        {/* Wheels at the foot */}
        {xs.map((x) => (
          <mesh key={`w${x}`} position={[x, 1.25, 0]} rotation-z={Math.PI / 2} rotation-x={L.lean}>
            <cylinderGeometry args={[1.25, 1.25, 0.9, 20]} />
            <meshStandardMaterial color="#2a2a2a" roughness={0.8} />
          </mesh>
        ))}
        {/* Hooks over the rail: a strap from the back of each side rail over the top of the rail, and a lip behind it */}
        {xs.map((x) => (
          <group key={`h${x}`} position={[x, L.length - 3, 0]} rotation-x={L.lean}>
            <mesh position={[0, r + 0.35, (-L.stileDepth / 2 - d - r - 0.3) / 2]}><boxGeometry args={[0.4, 0.35, d + r + 0.3 - L.stileDepth / 2]} />{metalMat}</mesh>
            <mesh position={[0, 0.2, -d - r - 0.3]}><boxGeometry args={[0.4, 1.1, 0.35]} />{metalMat}</mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
