// Free-standing tables in the room, drawn from the same parts as their shop drawings and cut list.
import { useMemo } from 'react';
import * as THREE from 'three';
import type { Project } from '../model/types';
import type { DiningTable } from '../model/furniture';
import { tablesOf, type TablePart } from '../model/tableParts';
import { woodColor } from '../model/woodColors';
import { grainUVs, longAxis, woodTexture } from './woodTexture';

export function TableModels({ project, hidden }: { project: Project; hidden: string[] }) {
  const tables = tablesOf(project).filter(({ t }) => !hidden.includes(t.id));
  return <>{tables.map(({ t, parts, place }) => (
    <group key={t.id} position={[place.x, 0, place.z]} rotation-y={place.turned ? Math.PI / 2 : 0}>
      <TablePiece t={t} parts={parts} />
    </group>
  ))}</>;
}

/** One table or bench, centered on its own origin. */
export function TablePiece({ t, parts }: { t: DiningTable; parts: TablePart[] }) {
  const color = t.finish === 'paint' ? '#ece8df' : woodColor(t.species) ?? '#b98a5a';
  const map = t.finish === 'paint' ? null : woodTexture(t.species, color);
  return <>{parts.flatMap((part, i) => part.boxes.map((b, j) => <PartMesh key={`${i}-${j}`} part={part} b={b} color={part.role === 'cushion' ? '#9aa3ad' : color} map={part.role === 'cushion' ? null : map} seed={i * 7 + j * 3} />))}</>;
}

function PartMesh({ part, b, color, map, seed }: { part: TablePart; b: TablePart['boxes'][number]; color: string; map: THREE.Texture | null; seed: number }) {
  const [sx, sy, sz] = b.size;
  const c: [number, number, number] = [b.min[0] + sx / 2, b.min[1] + sy / 2, b.min[2] + sz / 2];
  // Tapered legs: a square frustum, wide at the top; turned legs: round
  const geo = useMemo(() => {
    let g: THREE.BufferGeometry;
    if (part.turned) g = new THREE.CylinderGeometry(sx * 0.42, sx * 0.3, sy, 20);
    else if (part.taperTo) { g = new THREE.CylinderGeometry(Math.SQRT1_2 * sx, Math.SQRT1_2 * part.taperTo, sy, 4, 1); g.rotateY(Math.PI / 4); g = g.toNonIndexed(); g.computeVertexNormals(); }
    else g = new THREE.BoxGeometry(sx, sy, sz);
    // In real inches from the piece's own spot, grain the long way
    g.translate(c[0], c[1], c[2]);
    grainUVs(g, longAxis([sx, sy, sz]), seed);
    g.translate(-c[0], -c[1], -c[2]);
    return g;
  }, [part.turned, part.taperTo, sx, sy, sz, c[0], c[1], c[2], seed]);
  return (
    <mesh position={c} geometry={geo} castShadow receiveShadow>
      <meshStandardMaterial key={map ? 'grain' : 'flat'} map={map} color={map ? '#ffffff' : color} roughness={map ? 0.62 : 0.55} />
    </mesh>
  );
}
