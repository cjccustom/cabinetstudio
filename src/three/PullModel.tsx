// Knobs, bar pulls and finger grips on a cabinet's fronts, in the cabinet's own coordinates.
import { useMemo } from 'react';
import type { PullSpot } from '../model/pulls';

const KNOB_R = 0.6, KNOB_D = 1.0, BAR = 0.4, STAND = 1.1;

export function PullModel({ spots, color }: { spots: PullSpot[]; color: string }) {
  const metal = useMemo(() => ({ color, metalness: 0.55, roughness: 0.38 }), [color]);
  return (
    <group>
      {spots.map((h, i) => {
        if (h.kind === 'knob') {
          return (
            <group key={i} position={[h.x, h.y, h.z]}>
              <mesh position={[0, 0, KNOB_D * 0.35]} rotation-x={Math.PI / 2} castShadow>
                <cylinderGeometry args={[0.22, 0.28, KNOB_D * 0.7, 16]} /><meshStandardMaterial {...metal} />
              </mesh>
              <mesh position={[0, 0, KNOB_D * 0.85]} scale={[1, 1, 0.55]} castShadow>
                <sphereGeometry args={[KNOB_R, 20, 14]} /><meshStandardMaterial {...metal} />
              </mesh>
            </group>
          );
        }
        if (h.kind === 'bar') {
          // A bar on two posts, standing off the front
          const along = (t: number): [number, number, number] => (h.vertical ? [h.x, h.y + t, h.z] : [h.x + t, h.y, h.z]);
          const mid = along(h.len / 2);
          return (
            <group key={i}>
              <mesh position={[mid[0], mid[1], h.z + STAND]} castShadow>
                <boxGeometry args={h.vertical ? [BAR, h.len + 0.8, BAR] : [h.len + 0.8, BAR, BAR]} /><meshStandardMaterial {...metal} />
              </mesh>
              {[0, h.len].map((t) => { const q = along(t); return (
                <mesh key={t} position={[q[0], q[1], h.z + STAND / 2]} rotation-x={Math.PI / 2}>
                  <cylinderGeometry args={[0.14, 0.14, STAND, 10]} /><meshStandardMaterial {...metal} />
                </mesh>
              ); })}
            </group>
          );
        }
        // A finger grip: the shadow of the routed edge, just proud of the face so it shows
        return (
          <mesh key={i} position={h.vertical ? [h.x, h.y + h.len / 2, h.z + 0.02] : [h.x + h.len / 2, h.y, h.z + 0.02]}>
            <planeGeometry args={h.vertical ? [0.35, h.len] : [h.len, 0.35]} />
            <meshStandardMaterial color="#2b2a28" roughness={0.9} transparent opacity={0.7} />
          </mesh>
        );
      })}
    </group>
  );
}
