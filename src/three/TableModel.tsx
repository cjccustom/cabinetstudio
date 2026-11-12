// Free-standing tables in the room, drawn from the same parts as their shop drawings and cut list.
import { bedParts, bedsOf } from '../model/bed';
import { newTable } from '../model/furniture';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { Project } from '../model/types';
import type { DiningTable } from '../model/furniture';
import { tablesOf, type TablePart } from '../model/tableParts';
import { woodColor } from '../model/woodColors';
import { topSection } from '../model/edgeProfiles';
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
  // A routed edge on the top: drawn as its section, run the length (both long edges)
  const prof = t.edge === 'profile' && !t.lip ? t.edgeProfile ?? 'round14' : null;
  return <>{parts.map((part, i) => part.metal ? <MetalMesh key={`m${i}`} m={part.metal} /> : part.outline ? <ShapedTop key={`s${i}`} part={part} color={color} map={map} /> : null)}{parts.filter((part) => !part.metal && !part.outline).flatMap((part, i) => part.boxes.map((b, j) => <PartMesh key={`${i}-${j}`} part={part} b={b} color={part.name.startsWith('Mattress') ? '#f1eee6' : part.role === 'cushion' ? '#9aa3ad' : color} map={part.role === 'cushion' ? null : map} seed={i * 7 + j * 3} section={prof && part.role === 'top' ? topSection(b.size[2], b.size[1], prof, prof) : undefined} />))}</>;
}

function PartMesh({ part, b, color, map, seed, section }: { part: TablePart; b: TablePart['boxes'][number]; color: string; map: THREE.Texture | null; seed: number; section?: [number, number][] }) {
  const [sx, sy, sz] = b.size;
  const c: [number, number, number] = [b.min[0] + sx / 2, b.min[1] + sy / 2, b.min[2] + sz / 2];
  // Tapered legs: a square frustum, wide at the top; turned legs: round
  const geo = useMemo(() => {
    let g: THREE.BufferGeometry;
    if (section) {
      // The section across the width (u, v), extruded the length, then turned to run along x
      const shape = new THREE.Shape(section.map(([u, v]) => new THREE.Vector2(u - sz / 2, v - sy / 2)));
      g = new THREE.ExtrudeGeometry(shape, { depth: sx, bevelEnabled: false, curveSegments: 1 }).toNonIndexed();
      g.translate(0, 0, -sx / 2);
      g.rotateY(Math.PI / 2);
      g.computeVertexNormals();
    } else if (part.turned) g = new THREE.CylinderGeometry(sx * 0.42, sx * 0.3, sy, 20);
    else if (part.taperTo) { g = new THREE.CylinderGeometry(Math.SQRT1_2 * sx, Math.SQRT1_2 * part.taperTo, sy, 4, 1); g.rotateY(Math.PI / 4); g = g.toNonIndexed(); g.computeVertexNormals(); }
    else g = new THREE.BoxGeometry(sx, sy, sz);
    // In real inches from the piece's own spot, grain the long way
    g.translate(c[0], c[1], c[2]);
    grainUVs(g, longAxis([sx, sy, sz]), seed);
    g.translate(-c[0], -c[1], -c[2]);
    return g;
  }, [part.turned, part.taperTo, sx, sy, sz, c[0], c[1], c[2], seed, section ? JSON.stringify(section) : '']);
  return (
    <mesh position={c} geometry={geo} castShadow receiveShadow>
      <meshStandardMaterial key={map ? 'grain' : 'flat'} map={map} color={map ? '#ffffff' : color} roughness={map ? 0.62 : 0.55} />
    </mesh>
  );
}

/** Beds in the room: headboard against its wall (the back wall unless set), centered unless placed. */
export function BedModels({ project, hidden }: { project: Project; hidden: string[] }) {
  return <>{bedsOf(project).filter((b) => !hidden.includes(b.id)).map((b) => {
    const wall = b.wall ?? 'back';
    const W = project.room.width, D = project.room.depth;
    const along = b.offset ?? (wall === 'back' || wall === 'front' ? W / 2 : D / 2);
    const gap = 1.25 + 0.5;
    const place: { pos: [number, number, number]; rot: number } = wall === 'back' ? { pos: [along, 0, gap], rot: 0 }
      : wall === 'front' ? { pos: [W - along, 0, D - gap], rot: Math.PI }
      : wall === 'left' ? { pos: [gap, 0, D - along], rot: Math.PI / 2 }
      : { pos: [W - gap, 0, along], rot: -Math.PI / 2 };
    const look = { ...newTable(), finish: b.finish, species: b.grade === 'paint' ? 'Poplar' : b.species, edge: 'eased' as const, lip: false };
    return <group key={b.id} position={place.pos} rotation-y={place.rot}><TablePiece t={look} parts={bedParts(b)} /></group>;
  })}</>;
}

/** A shaped top (round, oval, racetrack): its outline extruded through the thickness. */
function ShapedTop({ part, color, map }: { part: TablePart; color: string; map: THREE.Texture | null }) {
  const b = part.boxes[0];
  const geo = useMemo(() => {
    const shape = new THREE.Shape(part.outline!.map(([x, z]) => new THREE.Vector2(x, z)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: b.size[1], bevelEnabled: false, curveSegments: 1 });
    // Shape in x–y extruded along z: turn it so the outline lies in plan and the thickness runs up
    g.rotateX(Math.PI / 2);
    g.translate(0, b.min[1] + b.size[1], 0);
    g.computeVertexNormals();
    grainUVs(g, 0, 3);
    return g;
  }, [JSON.stringify(part.outline), b.min[1], b.size[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  return <mesh geometry={geo} castShadow receiveShadow><meshStandardMaterial key={map ? 'grain' : 'flat'} map={map} color={map ? '#ffffff' : color} roughness={map ? 0.62 : 0.55} /></mesh>;
}

/** A metal base: each member a square or round tube (or flat bar) from end to end, plates as slabs. */
export function MetalMesh({ m }: { m: NonNullable<TablePart['metal']> }) {
  const mat = <meshStandardMaterial color={m.color} roughness={0.45} metalness={0.55} />;
  return <>
    {m.members.map((x, i) => {
      const a = new THREE.Vector3(...x.a), b = new THREE.Vector3(...x.b);
      const len = a.distanceTo(b), mid = a.clone().add(b).multiplyScalar(0.5);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      return (
        <mesh key={i} position={mid} quaternion={q} castShadow receiveShadow>
          {m.stock === 'round' ? <cylinderGeometry args={[m.size / 2, m.size / 2, len, 20]} /> : <boxGeometry args={[m.size, len, m.stock === 'flat' ? Math.max(0.25, m.size / 6) : m.size]} />}
          {mat}
        </mesh>
      );
    })}
    {m.plates.map((pl, i) => <mesh key={`p${i}`} position={[pl.min[0] + pl.size[0] / 2, pl.min[1] + pl.size[1] / 2, pl.min[2] + pl.size[2] / 2]} castShadow receiveShadow><boxGeometry args={pl.size} />{mat}</mesh>)}
  </>;
}
