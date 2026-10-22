import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, ThreeEvent, useThree } from '@react-three/fiber';
import { Html, Line, OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useStore, type ViewMode } from '../store';
import type { Cabinet, Finishes, Room, ShopSettings, WallId, WallPanel } from '../model/types';
import { spacingOf } from '../model/panels';
import { cabinetMoldings, panelMoldings } from '../model/moldings';
import { eff } from '../model/parts';
import { MoldingModel } from './MoldingModel';
import { buildParts } from '../model/parts';
import { alongWall, footprint, resolveEnds, snapOffset, wallLength, wallTransform } from '../model/layout';
import { buildCabinetGeometry } from './cabinetGeometry';
import { fmt, fmtFeet } from '../units';

const ACCENT = '#2f62d6';
const ISSUE = '#d23b2f';
const EDGE = '#3b3f45';

export function Scene({ issueIds }: { issueIds: Set<string> }) {
  const project = useStore((s) => s.project);
  const view = useStore((s) => s.view);
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);
  const { room, settings, finishes } = project;
  const elevWall = view.startsWith('elev-') ? (view.slice(5) as WallId) : null;
  const visible = elevWall ? project.cabinets.filter((c) => c.wall === elevWall) : project.cabinets;

  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      onPointerMissed={(e) => e.button === 0 && select(null)}
    >
      <Cameras view={view} room={room} />
      <ambientLight intensity={0.85} />
      <hemisphereLight args={['#ffffff', '#b9b2a6', 0.6]} />
      <directionalLight position={[room.width * 0.8, room.height * 2.2, room.depth * 2.5]} intensity={1.5} />
      <directionalLight position={[-room.width, room.height, room.depth]} intensity={0.35} />
      <RoomShell room={room} view={view} />
      {visible.map((c) => (
        <CabinetModel
          key={c.id}
          cab={c}
          room={room}
          settings={settings}
          finishes={finishes}
          view={view}
          selected={c.id === selectedId}
          issue={issueIds.has(c.id)}
        />
      ))}
      {(project.panels ?? []).filter((w) => !elevWall || w.wall === elevWall).map((w) => (
        <WallPanelModel key={w.id} panel={w} room={room} finishes={finishes} selected={w.id === selectedId} />
      ))}
      {elevWall && <ElevationDims room={room} wall={elevWall} cabinets={visible} />}
      {view === 'plan' && <PlanLabels room={room} cabinets={project.cabinets} />}
    </Canvas>
  );
}

function Cameras({ view, room }: { view: ViewMode; room: Room }) {
  const size = useThree((s) => s.size);
  const { width: W, depth: D, height: H } = room;
  if (view === '3d') {
    const target: [number, number, number] = [W / 2, 34, D * 0.35];
    return (
      <>
        <PerspectiveCamera key="persp" makeDefault fov={42} near={1} far={8000} position={[W * 0.78, H * 1.25, D + Math.max(W, D) * 1.05]} />
        <OrbitControls key="orbit-3d" makeDefault target={target} maxPolarAngle={Math.PI * 0.495} enableDamping={false} />
      </>
    );
  }
  if (view === 'plan') {
    const zoom = Math.min(size.width / (W + 48), size.height / (D + 48));
    return (
      <>
        <OrthographicCamera key="plan" makeDefault position={[W / 2, 2000, D / 2]} up={[0, 0, -1]} zoom={zoom} near={1} far={5000} />
        <OrbitControls key="orbit-plan" makeDefault target={[W / 2, 0, D / 2]} enableRotate={false} screenSpacePanning />
      </>
    );
  }
  const wall = view.slice(5) as WallId;
  const len = wallLength(room, wall);
  const zoom = Math.min(size.width / (len + 60), size.height / (H + 60));
  const cy = H / 2 - 6;
  const cam: Record<WallId, { pos: [number, number, number]; target: [number, number, number] }> = {
    back: { pos: [W / 2, cy, D + 1500], target: [W / 2, cy, 0] },
    front: { pos: [W / 2, cy, -1500], target: [W / 2, cy, D] },
    left: { pos: [W + 1500, cy, D / 2], target: [0, cy, D / 2] },
    right: { pos: [-1500, cy, D / 2], target: [W, cy, D / 2] },
  };
  return (
    <>
      <OrthographicCamera key={`elev-${wall}`} makeDefault position={cam[wall].pos} zoom={zoom} near={1} far={5000} />
      <OrbitControls key={`orbit-${wall}`} makeDefault target={cam[wall].target} enableRotate={false} screenSpacePanning />
    </>
  );
}

/** Walls only face inward, so the ones between you and the cabinets disappear on their own. */
function RoomShell({ room, view }: { room: Room; view: ViewMode }) {
  const { width: W, depth: D, height: H } = room;
  const wallMat = <meshStandardMaterial color="#f1efea" roughness={0.95} />;
  const T = 4.5;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[W / 2, 0, D / 2]}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color="#cdbfa8" roughness={0.9} />
      </mesh>
      <mesh position={[W / 2, H / 2, 0]}>
        <planeGeometry args={[W, H]} />
        {wallMat}
      </mesh>
      <mesh position={[W / 2, H / 2, D]} rotation-y={Math.PI}>
        <planeGeometry args={[W, H]} />
        {wallMat}
      </mesh>
      <mesh position={[0, H / 2, D / 2]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[D, H]} />
        {wallMat}
      </mesh>
      <mesh position={[W, H / 2, D / 2]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[D, H]} />
        {wallMat}
      </mesh>
      {view === 'plan' && (
        <>
          <gridHelper args={[Math.max(W, D) + 48, Math.round((Math.max(W, D) + 48) / 12), '#b3a68f', '#c4b8a3']} position={[W / 2, 0.05, D / 2]} />
          {[
            [W / 2, -T / 2, W + 2 * T, T],
            [W / 2, D + T / 2, W + 2 * T, T],
            [-T / 2, D / 2, T, D],
            [W + T / 2, D / 2, T, D],
          ].map(([x, z, sx, sz], i) => (
            <mesh key={i} position={[x, H / 2, z]}>
              <boxGeometry args={[sx, H, sz]} />
              <meshBasicMaterial color="#5b5f66" />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
}

interface DragState {
  pointerId: number;
  plane: THREE.Plane;
  startAlong: number;
  startOffset: number;
  moved: boolean;
}

function CabinetModel(props: {
  cab: Cabinet; room: Room; settings: ShopSettings; finishes: Finishes; view: ViewMode; selected: boolean; issue: boolean;
}) {
  const { cab, room, settings, finishes, view, selected, issue } = props;
  const allCabs = useStore((st) => st.project.cabinets);
  const ends = resolveEnds(room, allCabs, cab);
  const geo = useMemo(
    () => buildCabinetGeometry(buildParts(cab, settings, ends)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cab, settings, ends.left, ends.right],
  );
  useEffect(() => () => {
    geo.meshes.forEach((m) => m.geometry.dispose());
    geo.edges.dispose();
  }, [geo]);
  const { pos, rotY } = wallTransform(room, cab.wall, cab.offset);
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null;
  const drag = useRef<DragState | null>(null);
  const hit = useMemo(() => new THREE.Vector3(), []);

  const colorFor = (material: string, shade: number) => {
    const base = material === 'box' || material === 'back' ? finishes.box : material === 'counter' ? finishes.counter : material === 'solidWood' ? finishes.wood ?? '#b9875a' : finishes.paint;
    return new THREE.Color(base).multiplyScalar(shade);
  };

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const st = useStore.getState();
    st.select(cab.id);
    let plane: THREE.Plane;
    if (view.startsWith('elev-')) {
      const normals: Record<WallId, [THREE.Vector3, number]> = {
        back: [new THREE.Vector3(0, 0, 1), 0],
        front: [new THREE.Vector3(0, 0, -1), room.depth],
        left: [new THREE.Vector3(1, 0, 0), 0],
        right: [new THREE.Vector3(-1, 0, 0), room.width],
      };
      const [n, c] = normals[cab.wall];
      plane = new THREE.Plane(n, c);
    } else {
      plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -e.point.y);
    }
    if (!e.ray.intersectPlane(plane, hit)) return;
    drag.current = { pointerId: e.pointerId, plane, startAlong: alongWall(room, cab.wall, hit.x, hit.z), startOffset: cab.offset, moved: false };
    (e.target as unknown as Element).setPointerCapture?.(e.pointerId);
    if (controls) controls.enabled = false;
  };

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (!e.ray.intersectPlane(d.plane, hit)) return;
    const delta = alongWall(room, cab.wall, hit.x, hit.z) - d.startAlong;
    const st = useStore.getState();
    if (!d.moved) {
      if (Math.abs(delta) < 0.5) return;
      d.moved = true;
      st.checkpoint();
      st.setDragging(true);
    }
    const others = st.project.cabinets;
    const offset = snapOffset(room, others, cab, d.startOffset + delta, st.project.settings);
    st.transient((p) => ({ ...p, cabinets: p.cabinets.map((c) => (c.id === cab.id ? { ...c, offset } : c)) }));
  };

  const onUp = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    (e.target as unknown as Element).releasePointerCapture?.(e.pointerId);
    drag.current = null;
    if (controls) controls.enabled = true;
    if (d.moved) useStore.getState().setDragging(false);
  };

  const edgeColor = issue ? ISSUE : selected ? ACCENT : EDGE;
  return (
    <group
      position={[pos[0], cab.elevation, pos[2]]}
      rotation-y={rotY}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'grab'; }}
      onPointerOut={() => { document.body.style.cursor = ''; }}
    >
      {geo.meshes.map((m) => (
        <mesh key={m.key} geometry={m.geometry}>
          <meshStandardMaterial
            color={colorFor(m.material, m.shade)}
            roughness={m.material === 'counter' ? 0.35 : 0.75}
            emissive={selected ? ACCENT : '#000000'}
            emissiveIntensity={selected ? 0.08 : 0}
            polygonOffset
            polygonOffsetFactor={1}
            polygonOffsetUnits={1}
          />
        </mesh>
      ))}
      <lineSegments geometry={geo.edges}>
        <lineBasicMaterial color={edgeColor} transparent opacity={selected || issue ? 0.95 : 0.55} />
      </lineSegments>
      {(cab.crown || cab.lightRail || cab.baseMold) && (
        <MoldingModel pieces={cabinetMoldings(cab, eff(cab, settings), ends)} color={finishes.paint} edgeColor={edgeColor} />
      )}
    </group>
  );
}

function DimLine({ a, b, y, z, label, tick = 2 }: { a: number; b: number; y: number; z: number; label: string; tick?: number }) {
  const pts: [number, number, number][] = [
    [a, y, z], [b, y, z],
    [a, y - tick, z], [a, y + tick, z],
    [b, y - tick, z], [b, y + tick, z],
  ];
  return (
    <group>
      <Line points={pts} segments color="#7b8490" lineWidth={1} />
      <Html position={[(a + b) / 2, y, z]} center zIndexRange={[20, 0]}>
        <span className="dim-label">{label}</span>
      </Html>
    </group>
  );
}

/** Shop-drawing dimensions: base run below the floor line, uppers above the ceiling, overall at the bottom. */
function ElevationDims({ room, wall, cabinets }: { room: Room; wall: WallId; cabinets: Cabinet[] }) {
  const { pos, rotY } = wallTransform(room, wall, 0);
  const len = wallLength(room, wall);
  const z = 40;
  const lower = cabinets.filter((c) => c.elevation < 24).sort((a, b) => a.offset - b.offset);
  const upper = cabinets.filter((c) => c.elevation >= 24).sort((a, b) => a.offset - b.offset);
  return (
    <group position={pos} rotation-y={rotY}>
      {lower.map((c) => (
        <DimLine key={c.id} a={c.offset} b={c.offset + c.width} y={-7} z={z} label={fmt(c.width)} />
      ))}
      {upper.map((c) => (
        <DimLine key={c.id} a={c.offset} b={c.offset + c.width} y={room.height + 7} z={z} label={fmt(c.width)} />
      ))}
      <DimLine a={0} b={len} y={-17} z={z} label={`${fmt(len)}  (${fmtFeet(len)})`} />
      {cabinets.map((c) => (
        <Html key={`n-${c.id}`} position={[c.offset + c.width / 2, c.elevation + c.height + (c.kind === 'base' ? 3.5 : 0) + 3, z]} center zIndexRange={[20, 0]}>
          <span className="cab-tag">{c.name}</span>
        </Html>
      ))}
    </group>
  );
}

function PlanLabels({ room, cabinets }: { room: Room; cabinets: Cabinet[] }) {
  return (
    <>
      {cabinets.map((c) => {
        const f = footprint(room, c);
        return (
          <Html key={c.id} position={[(f.x0 + f.x1) / 2, c.elevation + c.height + 2, (f.z0 + f.z1) / 2]} center zIndexRange={[20, 0]}>
            <span className={`cab-tag${c.kind === 'wall' ? ' upper' : ''}`}>{c.name}</span>
          </Html>
        );
      })}
    </>
  );
}

/** Beadboard drawn as a thin panel on the wall with its bead lines, plus the solid wood cap. */
function WallPanelModel({ panel: w, room, finishes, selected }: { panel: WallPanel; room: Room; finishes: Finishes; selected: boolean }) {
  const { pos, rotY } = wallTransform(room, w.wall, w.offset);
  const t = 0.5;
  const beads = useMemo(() => {
    const sp = spacingOf(w);
    const pts: number[] = [];
    for (let x = sp; x < w.width - 0.01; x += sp) pts.push(x, w.bottom, t + 0.01, x, w.bottom + w.height, t + 0.01);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [w.profile, w.spacing, w.width, w.bottom, w.height]);
  useEffect(() => () => beads.dispose(), [beads]);
  const select = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    useStore.getState().select(w.id);
  };
  return (
    <group position={[pos[0], 0, pos[2]]} rotation-y={rotY} onPointerDown={select}>
      <mesh position={[w.width / 2, w.bottom + w.height / 2, t / 2]}>
        <boxGeometry args={[w.width, w.height, t]} />
        <meshStandardMaterial color={finishes.paint} roughness={0.8} emissive={selected ? ACCENT : '#000000'} emissiveIntensity={selected ? 0.08 : 0} />
      </mesh>
      <lineSegments geometry={beads}>
        <lineBasicMaterial color={selected ? ACCENT : EDGE} transparent opacity={0.35} />
      </lineSegments>
      {w.cap && w.capProfile && <MoldingModel pieces={panelMoldings(w)} color={finishes.paint} edgeColor={EDGE} />}
      {w.cap && !w.capProfile && (
        <mesh position={[w.width / 2, w.bottom + w.height + w.capHeight / 2, w.capDepth / 2]}>
          <boxGeometry args={[w.width, w.capHeight, w.capDepth]} />
          <meshStandardMaterial color={finishes.wood ?? '#b9875a'} roughness={0.6} />
        </mesh>
      )}
    </group>
  );
}
