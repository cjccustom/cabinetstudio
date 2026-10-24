import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Project } from '../model/types';
import type { ViewMode } from '../store';
import { cofferOf, cofferParts, coffers } from '../model/coffer';
import { mountShape, profileByNum, type MoldPiece } from '../model/moldings';
import { buildCabinetGeometry } from './cabinetGeometry';
import { MoldingModel } from './MoldingModel';

/** The coffered ceiling: beams and perimeter as boxes, crown run around the inside of each coffer. */
export function CofferModel({ project, view }: { project: Project; view: ViewMode }) {
  const c = cofferOf(project);
  const key = JSON.stringify([project.ceiling, project.room]);
  const geo = useMemo(() => buildCabinetGeometry(cofferParts(project, c)), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { geo.meshes.forEach((m) => m.geometry.dispose()); geo.edges.dispose(); }, [geo]);
  // Crown on each side of each coffer, top at the ceiling, as if each fascia face were a wall
  const crowns = useMemo(() => {
    const prof = profileByNum(c.crown);
    if (!c.on || !prof) return [];
    const h = mountShape(prof).height;
    const y = project.room.height - h;
    return coffers(project, c).flatMap((k) => {
      const w = k.x1 - k.x0, d = k.z1 - k.z0;
      const run = (length: number): MoldPiece[] => [{ kind: 'cofferCrown', num: prof.num, along: 'x', facing: 'front', x: 0, y, z: 0, length }];
      return [
        { pos: [k.x0, 0, k.z0] as const, rot: 0, pieces: run(w) },
        { pos: [k.x1, 0, k.z1] as const, rot: Math.PI, pieces: run(w) },
        { pos: [k.x0, 0, k.z1] as const, rot: Math.PI / 2, pieces: run(d) },
        { pos: [k.x1, 0, k.z0] as const, rot: -Math.PI / 2, pieces: run(d) },
      ];
    });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!c.on || view === 'plan') return null;
  const paint = project.finishes.trim ?? project.finishes.paint;
  return (
    <group>
      {geo.meshes.map((m) => (
        <mesh key={m.key} geometry={m.geometry}>
          <meshStandardMaterial color={new THREE.Color(paint).multiplyScalar(m.shade)} roughness={0.75} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
        </mesh>
      ))}
      <lineSegments geometry={geo.edges}>
        <lineBasicMaterial color="#3b3f45" transparent opacity={0.45} />
      </lineSegments>
      {crowns.map((g, i) => (
        <group key={i} position={g.pos as unknown as [number, number, number]} rotation-y={g.rot}>
          <MoldingModel pieces={g.pieces} color={paint} edgeColor="#3b3f45" />
        </group>
      ))}
    </group>
  );
}
