// Free-standing tables in the room, drawn from the same parts as their shop drawings and cut list.
import { useMemo } from 'react';
import * as THREE from 'three';
import type { Project } from '../model/types';
import { tablesOf, type TablePart } from '../model/tableParts';
import { woodColor } from '../model/woodColors';

export function TableModels({ project, hidden }: { project: Project; hidden: string[] }) {
  const tables = tablesOf(project).filter(({ t }) => !hidden.includes(t.id));
  return <>{tables.map(({ t, parts, place }) => {
    const color = t.finish === 'paint' ? '#ece8df' : woodColor(t.species) ?? '#b98a5a';
    return (
      <group key={t.id} position={[place.x, 0, place.z]} rotation-y={place.turned ? Math.PI / 2 : 0}>
        {parts.flatMap((part, i) => part.boxes.map((b, j) => <PartMesh key={`${i}-${j}`} part={part} b={b} color={color} />))}
      </group>
    );
  })}</>;
}

function PartMesh({ part, b, color }: { part: TablePart; b: TablePart['boxes'][number]; color: string }) {
  const [sx, sy, sz] = b.size;
  const c: [number, number, number] = [b.min[0] + sx / 2, b.min[1] + sy / 2, b.min[2] + sz / 2];
  // Tapered legs: a square frustum, wide at the top; turned legs: round
  const geo = useMemo(() => {
    if (part.turned) return new THREE.CylinderGeometry(sx * 0.42, sx * 0.3, sy, 20);
    if (part.taperTo) {
      const g = new THREE.CylinderGeometry(Math.SQRT1_2 * sx, Math.SQRT1_2 * part.taperTo, sy, 4, 1);
      g.rotateY(Math.PI / 4);
      return g;
    }
    return null;
  }, [part.turned, part.taperTo, sx, sy]);
  const mat = <meshStandardMaterial color={color} roughness={0.55} />;
  if (geo) return <mesh position={c} geometry={geo} castShadow receiveShadow>{mat}</mesh>;
  return (
    <mesh position={c} castShadow receiveShadow>
      <boxGeometry args={[sx, sy, sz]} />{mat}
    </mesh>
  );
}
