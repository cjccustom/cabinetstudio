import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, ThreeEvent, useThree } from '@react-three/fiber';
import { PullModel } from './PullModel';
import { fixedParts, frontMotions } from './fronts';
import { isOpenIn } from './navigation';
import { useFrame } from '@react-three/fiber';
import type { CabinetGeometry } from './cabinetGeometry';
import { pullColor, pullSpots } from '../model/pulls';
import { Html, Line, OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { finishColors, woodColor } from '../model/woodColors';
import { freeStanding, picked, runWall, useStore, type ViewMode } from '../store';
import type { Cabinet, Finishes, Project, Room, ShopSettings, WallId, WallPanel } from '../model/types';
import { canSpots, lightsOf } from '../model/lighting';
import { ceilingAt, hasSlopes } from '../model/ceiling';
import { spacingOf } from '../model/panels';
import { cabinetMoldings, panelMoldings } from '../model/moldings';
import { eff } from '../model/parts';
import { MoldingModel } from './MoldingModel';
import { CabinetLights } from './CabinetLights';
import { ApplianceModel } from './ApplianceModel';
import { live, onWheel, useNav } from './navigation';
import { RoomModel } from './RoomModel';
import { CofferModel } from './CofferModel';
import { LadderModel } from './LadderModel';
import { BedModels, TableModels } from './TableModel';
import { tvSize, tvsOf, type WallTV } from '../model/tv';
import { opposite, underFascia } from '../model/coffer';
import { buildParts } from '../model/parts';
import { alongWall, footprint, resolveEnds, shiftInRoom, snapOffset, wallAxes, wallLength, wallTransform } from '../model/layout';
import { buildCabinetGeometry } from './cabinetGeometry';
import { woodTexture } from './woodTexture';
import { fmt, fmtFeet } from '../units';

const ACCENT = '#2f62d6';
const ISSUE = '#d23b2f';
const EDGE = '#3b3f45';

export function Scene({ issueIds }: { issueIds: Set<string> }) {
  const project = useStore((s) => s.project);
  const view = useStore((s) => s.view);
  const selectedId = useStore((s) => s.selectedId);
  const group = useStore((s) => s.group);
  const pickedIds = picked({ selectedId, group });
  const select = useStore((s) => s.select);
  const { room, settings, finishes } = project;
  const showCeiling = useNav((n) => n.ceiling);
  // Things hidden to see past them (a mantel in front of the bookcases), and the walls, in the 3D view
  const hidden = useNav((n) => n.hidden);
  const showWalls = useNav((n) => n.walls) || view !== '3d';
  const elevWall = view.startsWith('elev-') ? (view.slice(5) as WallId) : null;
  const cans = lightsOf(project).kind === 'recessed';
  const present = useStore((s) => s.present);
  const visible = elevWall ? project.cabinets.filter((c) => c.wall === elevWall) : project.cabinets;

  return (
    <Canvas
      shadows="soft"
      dpr={[1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      onPointerMissed={(e) => e.button === 0 && select(null)}
      // Neutral tone mapping keeps wood and paint colors true in the light (the default curve bleaches bright tops)
      onCreated={({ gl }) => { gl.toneMapping = THREE.NeutralToneMapping; gl.toneMappingExposure = 0.92; }}
    >
      <Cameras view={view} room={room} />
      <NavBridge />
      {/* In 3D the room is lit the way it will be: recessed cans casting shadows (or a high sun for
          daylight); the flat views stay evenly lit */}
      {view === '3d' && cans
        ? <CanLights project={project} showTrims={showCeiling} />
        : <>
          <ambientLight intensity={view === '3d' ? 0.55 : 0.85} />
          <hemisphereLight args={['#ffffff', '#b9b2a6', view === '3d' ? 0.55 : 0.6]} />
          {view === '3d'
            ? <SunLight room={room} />
            : <directionalLight position={[room.width * 0.8, room.height * 2.2, room.depth * 2.5]} intensity={1.5} />}
          <directionalLight position={[-room.width, room.height, room.depth]} intensity={0.35} />
        </>}
      <RoomModel project={project} view={view} walls={showWalls} />
      {showCeiling && <CofferModel project={project} view={view} />}
      {/* Not in the elevation of the wall across from it, where it would stand in front of the view */}
      {(!elevWall || elevWall !== opposite[project.ladder?.wall ?? 'back']) && <LadderModel project={project} />}
      {/* Tables stand in the room: shown in 3D and plan, left out of the wall elevations they'd block */}
      {!elevWall && <TableModels project={project} hidden={hidden} />}
      {!elevWall && <BedModels project={project} hidden={hidden} />}
      {tvsOf(project).filter((t) => !elevWall || t.wall === elevWall).map((t) => <WallTVModel key={t.id} t={t} room={room} />)}
      {/* The ceiling, seen only from below, so the coffers and cans have something over them */}
      {showCeiling && view === '3d' && (
        hasSlopes(room)
          ? <SlopedCeiling room={room} color={project.finishes.ceiling ?? '#f7f6f2'} />
          : <mesh position={[room.width / 2, room.height, room.depth / 2]} rotation-x={Math.PI / 2}>
            <planeGeometry args={[room.width, room.depth]} />
            <meshStandardMaterial color={project.finishes.ceiling ?? '#f7f6f2'} emissive="#ffffff" emissiveIntensity={0.18} roughness={0.95} />
          </mesh>
      )}
      {visible.filter((c) => !hidden.includes(c.id)).map((c) => (
        <CabinetModel
          key={c.id}
          cab={c}
          room={room}
          settings={settings}
          finishes={finishes}
          view={view}
          selected={!present && pickedIds.includes(c.id)}
          issue={!present && issueIds.has(c.id)}
        />
      ))}
      {(project.panels ?? []).filter((w) => (!elevWall || w.wall === elevWall) && !hidden.includes(w.id)).map((w) => (
        <WallPanelModel key={w.id} panel={w} room={room} finishes={finishes} selected={w.id === selectedId} />
      ))}
      {elevWall && <ElevationDims room={room} wall={elevWall} cabinets={visible} tags={!present} />}
      {view === 'plan' && <PlanLabels room={room} cabinets={project.cabinets} />}
    </Canvas>
  );
}

/** A TV on the wall: the set in black with its screen, on a mount off the wall. */
function WallTVModel({ t, room }: { t: WallTV; room: Room }) {
  const { w, h } = tvSize(t);
  const { pos, rotY } = wallTransform(room, t.wall, t.center - w / 2);
  const body = Math.min(1.25, t.depth * 0.5);
  return (
    <group position={pos} rotation-y={rotY}>
      <mesh position={[w / 2, t.bottom + h / 2, t.depth - body / 2]} castShadow>
        <boxGeometry args={[w, h, body]} /><meshStandardMaterial color="#141518" roughness={0.4} />
      </mesh>
      <mesh position={[w / 2, t.bottom + h / 2, t.depth + 0.01]}>
        <planeGeometry args={[w - 0.9, h - 1.1]} /><meshStandardMaterial color="#0b0d12" roughness={0.15} metalness={0.2} />
      </mesh>
      <mesh position={[w / 2, t.bottom + h / 2, (t.depth - body) / 2]}>
        <boxGeometry args={[Math.min(16, w * 0.4), Math.min(12, h * 0.4), Math.max(0.25, t.depth - body)]} /><meshStandardMaterial color="#2a2c30" />
      </mesh>
    </group>
  );
}

/** Hands the live controls to the view buttons, and takes the wheel before the controls do. */
function NavBridge() {
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null;
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => { live.scene = scene; return () => { if (live.scene === scene) live.scene = null; }; }, [scene]);
  useEffect(() => {
    live.controls = controls;
    live.element = gl.domElement;
    const host = gl.domElement.parentElement;
    host?.addEventListener('wheel', onWheel, { capture: true, passive: false });
    return () => { host?.removeEventListener('wheel', onWheel, { capture: true }); if (live.controls === controls) live.controls = null; };
  }, [controls, gl]);
  return null;
}

function Cameras({ view, room }: { view: ViewMode; room: Room }) {
  const size = useThree((s) => s.size);
  const nav = useNav();
  // Left-drag pans in the flat views and in Pan mode; right or middle drag always pans
  const buttons = (flat: boolean) => ({ LEFT: flat || nav.mode === 'pan' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN });
  const k = nav.resetKey;
  const { width: W, depth: D, height: H } = room;
  if (view === '3d') {
    const target: [number, number, number] = [W / 2, 34, D * 0.35];
    return (
      <>
        <PerspectiveCamera key={`persp-${k}`} makeDefault fov={42} near={1} far={8000} position={[W * 0.78, H * 1.25, D + Math.max(W, D) * 1.05]} />
        <OrbitControls key={`orbit-3d-${k}`} makeDefault target={target} maxPolarAngle={Math.PI * 0.92} enableDamping={false} zoomToCursor screenSpacePanning mouseButtons={buttons(false)} />
      </>
    );
  }
  if (view === 'plan') {
    const zoom = Math.min(size.width / (W + 48), size.height / (D + 48));
    return (
      <>
        <OrthographicCamera key={`plan-${k}`} makeDefault position={[W / 2, 2000, D / 2]} up={[0, 0, -1]} zoom={zoom} near={1} far={5000} />
        <OrbitControls key={`orbit-plan-${k}`} makeDefault target={[W / 2, 0, D / 2]} enableRotate={false} screenSpacePanning zoomToCursor mouseButtons={buttons(true)} />
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
      <OrthographicCamera key={`elev-${wall}-${k}`} makeDefault position={cam[wall].pos} zoom={zoom} near={1} far={5000} />
      <OrbitControls key={`orbit-${wall}-${k}`} makeDefault target={cam[wall].target} enableRotate={false} screenSpacePanning zoomToCursor mouseButtons={buttons(true)} />
    </>
  );
}

/** The last cabinet tapped on a touch screen, for double-tap. */
const lastTap = { id: '', at: 0 };

/** Most cans that cast shadows; past this each shadow costs more than it shows. A phone or tablet gets fewer, lighter ones. */
const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const SHADOW_CANS = touch ? 4 : 9;
const SHADOW_SIZE = touch ? 512 : 1024;

/**
 * Recessed cans: a spot just under the ceiling at each can, aimed straight down with a wide soft
 * cone, so coffer beams, uppers and crown throw the shadows they will in the finished room. A dim
 * fill stands in for light bouncing off the walls and floor.
 */
function CanLights({ project, showTrims }: { project: Project; showTrims: boolean }) {
  const { room } = project;
  const L = lightsOf(project);
  const spots = canSpots(project);
  const H = room.height;
  // Spread the room's light over its cans, so more cans doesn't mean a brighter room
  const area = (room.width * room.depth) / Math.max(1, spots.length);
  const each = L.brightness * 2.6 * Math.max(H * H, area * 0.9);
  return (
    <>
      <ambientLight intensity={0.32} />
      <hemisphereLight args={['#fff8ee', '#d8cfc0', 0.75]} />
      {spots.map((s, i) => <Can key={`${i}-${s.x}-${s.z}`} x={s.x} z={s.z} y={H - 0.75} intensity={each} shadow={i < SHADOW_CANS} reach={H * 2.5} />)}
      {showTrims && spots.map((s, i) => (
        <group key={`t${i}`} position={[s.x, H - 0.05, s.z]} rotation-x={Math.PI / 2}>
          <mesh><ringGeometry args={[2.1, 2.75, 32]} /><meshBasicMaterial color="#f4f4f2" /></mesh>
          <mesh position-z={0.02}><circleGeometry args={[2.1, 32]} /><meshBasicMaterial color="#fffbe8" /></mesh>
        </group>
      ))}
    </>
  );
}

function Can({ x, y, z, intensity, shadow, reach }: { x: number; y: number; z: number; intensity: number; shadow: boolean; reach: number }) {
  const ref = useRef<THREE.SpotLight>(null!);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const l = ref.current;
    l.target.position.set(x, 0, z);
    scene.add(l.target);
    l.target.updateMatrixWorld();
    return () => { scene.remove(l.target); };
  }, [scene, x, z]);
  return (
    <spotLight ref={ref} position={[x, y, z]} color="#fff1dc" intensity={intensity} angle={1.05} penumbra={0.9} decay={2} distance={reach}
      castShadow={shadow} shadow-mapSize={[SHADOW_SIZE, SHADOW_SIZE]} shadow-bias={-0.0005} shadow-normalBias={0.5} shadow-camera-near={1} shadow-camera-far={reach} />
  );
}

/** The key light in 3D: high and in front, aimed at the middle of the room, casting soft shadows. */
function SunLight({ room }: { room: Room }) {
  const ref = useRef<THREE.DirectionalLight>(null!);
  const scene = useThree((s) => s.scene);
  const { width: W, depth: D, height: H } = room;
  useEffect(() => {
    const l = ref.current;
    l.target.position.set(W / 2, 0, D / 2);
    scene.add(l.target);
    l.target.updateMatrixWorld();
    return () => { scene.remove(l.target); };
  }, [scene, W, D]);
  const r = Math.max(W, D, H) * 0.9;
  return (
    <directionalLight ref={ref} castShadow intensity={1.6} position={[W * 1.15, H * 1.9, D * 1.25]}
      shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.6} shadow-radius={4}
      shadow-camera-left={-r} shadow-camera-right={r} shadow-camera-top={r} shadow-camera-bottom={-r} shadow-camera-near={1} shadow-camera-far={r * 8} />
  );
}

/** Walls only face inward, so the ones between you and the cabinets disappear on their own. */
interface DragState {
  pointerId: number;
  /** Everyone moving with this one (a picked group), as each was when the drag started. */
  starts: Map<string, Cabinet>;
  plane: THREE.Plane;
  startAlong: number;
  /** Where the pointer first hit, in the room's plan (x, z). */
  startHit: [number, number];
  startOffset: number;
  moved: boolean;
}

function CabinetModel(props: {
  cab: Cabinet; room: Room; settings: ShopSettings; finishes: Finishes; view: ViewMode; selected: boolean; issue: boolean;
}) {
  const { cab, room, settings, finishes, view, selected, issue } = props;
  const allCabs = useStore((st) => st.project.cabinets);
  // Under a coffer's perimeter fascia the fascia carries the crown, not the cabinet
  const noCrown = useStore((st) => underFascia(st.project, cab));
  const ends = resolveEnds(room, allCabs, cab);
  const parts = useMemo(
    () => buildParts(cab, settings, ends),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cab, settings, ends.left, ends.right],
  );
  // Doors and drawer fronts drawn on their own, so they can swing open and slide out
  const geo = useMemo(() => buildCabinetGeometry(fixedParts(parts)), [parts]);
  const project0 = useStore((st) => st.project);
  const spots = useMemo(() => pullSpots(project0, cab, parts), [project0, cab, parts]);
  const motions = useMemo(() => frontMotions(project0, cab, parts, spots), [project0, cab, parts, spots]);
  const frontGeos = useMemo(() => motions.map((m) => buildCabinetGeometry([m.part])), [motions]);
  const fixedSpots = useMemo(() => spots.filter((h) => !motions.some((m) => m.pulls.includes(h))), [spots, motions]);
  const opened = useNav((n) => isOpenIn(n, cab.id)) && view === '3d';
  useEffect(() => () => { frontGeos.forEach((g) => { g.meshes.forEach((m) => m.geometry.dispose()); g.edges.dispose(); }); }, [frontGeos]);
  // The cabinet's lighting, lit, in the 3D view (the Lights switch over the view turns it off)
  const lightsOn = useNav((n) => n.lights) && view === '3d' && !!cab.lighting?.length;
  const project = useStore((st) => st.project);
  useEffect(() => () => {
    geo.meshes.forEach((m) => m.geometry.dispose());
    geo.edges.dispose();
  }, [geo]);
  const { pos, rotY } = wallTransform(room, cab.wall, cab.offset, cab.wallInset);
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null;
  const drag = useRef<DragState | null>(null);
  const hit = useMemo(() => new THREE.Vector3(), []);

  // Stain grade shows the species; the case interior shows the plywood
  const fc = finishColors(eff(cab, settings), finishes, cab.paint);
  // A chimney face left as wall between upper pilasters takes the wall's color
  const wallTint = project.wallFinishes?.[cab.wall]?.color ?? finishes.wall ?? '#f1efea';
  const plain = useNav((n) => n.plain) && !useStore.getState().present;
  const colorFor = (material: string, shade: number) => {
    if (plain && material !== 'counter' && material !== 'hardware') return new THREE.Color(material === 'box' || material === 'back' ? '#f2f0eb' : '#e6e3dc').multiplyScalar(shade);
    const base = material === 'wall' ? wallTint : material === 'hardware' ? '#c9ccd1' : material === 'upholstery' ? '#9aa3ad' : material === 'box' || material === 'back' ? fc.box : material === 'counter' ? finishes.counter : material === 'solidWood' ? woodColor(cab.topSpecies) ?? finishes.wood ?? '#b9875a' : fc.paint;
    return new THREE.Color(base).multiplyScalar(shade);
  };
  // Natural wood gets its grain: stain grade fronts and frames, solid wood tops, and veneer plywood that shows
  const s = eff(cab, settings);
  const ply = settings.plywood && !/prefinished|paint-grade|mdf/i.test(settings.plywood) ? settings.plywood : undefined;
  const grainFor = (material: string) => {
    if (plain) return null;
    if (material === 'hardware' || material === 'upholstery' || material === 'counter' || material === 'wall') return null;
    if (material === 'solidWood') { const sp = cab.topSpecies ?? settings.woodSpecies; return woodTexture(sp, woodColor(cab.topSpecies) ?? finishes.wood ?? '#b9875a'); }
    if (material === 'box' || material === 'back') return ply ? woodTexture(ply, fc.box) : null;
    return s.finish === 'stain' ? woodTexture(s.woodSpecies, fc.paint) : null;
  };

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    // Showing the customer: a drag only turns the view
    if (e.button !== 0 || useStore.getState().present) return;
    // Phones and tablets don't send double-clicks: two quick taps on the same cabinet open the editor
    if (e.nativeEvent.pointerType === 'touch') {
      // The time the finger came down, not when the busy page got to it
      const now = e.nativeEvent.timeStamp;
      if (lastTap.id === cab.id && now - lastTap.at < 400) { e.stopPropagation(); lastTap.id = ''; useStore.getState().edit({ kind: 'cabinet', id: cab.id }); return; }
      lastTap.id = cab.id; lastTap.at = now;
    }
    // In Pan mode a drag slides the view, even over a cabinet; pressing still selects it
    if (view === '3d' && useNav.getState().mode === 'pan') { useStore.getState().select(cab.id); return; }
    e.stopPropagation();
    const st = useStore.getState();
    // Shift- or ⌘-click adds to (or takes out of) what's picked, without dragging
    if (e.shiftKey || e.metaKey || e.ctrlKey) { st.select(cab.id, true); return; }
    // Pressing a cabinet already in the group keeps the group, so a drag moves them all
    const inGroup = st.group.length > 1 && st.group.includes(cab.id);
    if (inGroup) useStore.setState({ selectedId: cab.id }); else st.select(cab.id);
    const movers = inGroup ? st.project.cabinets.filter((c) => st.group.includes(c.id)) : [cab];
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
    drag.current = { pointerId: e.pointerId, plane, starts: new Map(movers.map((c) => [c.id, c])), startHit: [hit.x, hit.z], startAlong: alongWall(room, cab.wall, hit.x, hit.z), startOffset: cab.offset, moved: false };
    (e.target as unknown as Element).setPointerCapture?.(e.pointerId);
    if (controls) controls.enabled = false;
  };

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (!e.ray.intersectPlane(d.plane, hit)) return;
    const st = useStore.getState();
    const dx = hit.x - d.startHit[0], dz = hit.z - d.startHit[1];
    if (!d.moved) {
      if (Math.hypot(dx, dz) < 0.5) return;
      d.moved = true;
      st.checkpoint();
      st.setDragging(true);
    }
    const group = d.starts.size > 1;
    const elevWall = view.startsWith('elev-') ? (view.slice(5) as WallId) : null;
    // Which way things move: a group along its run; one cabinet standing off its wall either way in the
    // plan (whichever way the drag mostly goes); anything else along its own wall
    const run = group ? runWall([...d.starts.values()], cab.id)! : elevWall && freeStanding(cab) ? elevWall : null;
    let mx = 0, mz = 0;
    if (run) {
      const [ax, az] = wallAxes[run].along;
      let t = dx * ax + dz * az;
      // Snap the one under the pointer when it runs the same way
      if (cab.wall === run) t = snapOffset(room, st.project.cabinets.filter((c) => c.id === cab.id || !d.starts.has(c.id)), cab, d.startOffset + t, st.project.settings) - d.startOffset;
      mx = t * ax; mz = t * az;
    } else if (freeStanding(cab)) {
      // To the nearest sixteenth, so it lands on a tape-measure number
      const r16 = (v: number) => Math.round(v * 16) / 16;
      if (Math.abs(dx) >= Math.abs(dz)) mx = r16(dx); else mz = r16(dz);
    } else {
      const delta = alongWall(room, cab.wall, hit.x, hit.z) - d.startAlong;
      const offset = snapOffset(room, st.project.cabinets.filter((c) => c.id === cab.id || !d.starts.has(c.id)), cab, d.startOffset + delta, st.project.settings);
      const [ax, az] = wallAxes[cab.wall].along;
      mx = (offset - d.startOffset) * ax; mz = (offset - d.startOffset) * az;
    }
    // Everyone moving goes the same way in the room, whatever wall they hang on
    st.transient((p) => ({ ...p, cabinets: p.cabinets.map((c) => {
      const from = d.starts.get(c.id);
      return from ? { ...c, ...shiftInRoom(from, mx, mz) } : c;
    }) }));
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
  const drawGeo = (g: CabinetGeometry) => (
    <>
      {g.meshes.map((m) => (
        <mesh key={m.key} geometry={m.geometry} castShadow receiveShadow>
          <meshStandardMaterial
            key={grainFor(m.material) ? 'grain' : 'flat'}
            map={grainFor(m.material)}
            color={grainFor(m.material) ? new THREE.Color(1, 1, 1).multiplyScalar(m.shade) : colorFor(m.material, m.shade)}
            roughness={m.material === 'counter' ? 0.35 : grainFor(m.material) ? 0.62 : 0.75}
            emissive={selected ? ACCENT : '#000000'}
            emissiveIntensity={selected ? 0.08 : 0}
            polygonOffset
            polygonOffsetFactor={1}
            polygonOffsetUnits={1}
          />
        </mesh>
      ))}
      <lineSegments geometry={g.edges}>
        <lineBasicMaterial color={edgeColor} transparent opacity={selected || issue ? 0.95 : 0.55} />
      </lineSegments>
    </>
  );
  return (
    <group
      position={[pos[0], cab.elevation, pos[2]]}
      rotation-y={rotY}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onClick={(e) => { if (useStore.getState().present && view === '3d' && e.delta < 6) { e.stopPropagation(); useNav.getState().toggleOpen(cab.id); } }}
      onDoubleClick={(e) => { e.stopPropagation(); useStore.getState().edit({ kind: 'cabinet', id: cab.id }); }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'grab'; }}
      onPointerOut={() => { document.body.style.cursor = ''; }}
    >
      {drawGeo(geo)}
      {motions.map((m, i) => (
        <Moving key={i} open={opened} pivot={m.pivot} angle={m.angle} slide={m.slide} lift={m.lift}>
          {drawGeo(frontGeos[i])}
          {m.pulls.length > 0 && <PullModel spots={m.pulls} color={pullColor(s)} />}
          {m.box && <DrawerBox {...m.box} />}
        </Moving>
      ))}
      {(cab.crown || cab.lightRail || cab.baseMold) && (
        <MoldingModel pieces={cabinetMoldings(cab, eff(cab, settings), ends, { noCrown })} color={plain ? '#e6e3dc' : fc.paint} edgeColor={edgeColor} />
      )}
      <PullModel spots={fixedSpots} color={pullColor(s)} />
      <ApplianceModel cab={cab} settings={settings} />
      {lightsOn && <CabinetLights cab={cab} project={project} parts={parts} />}
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
function ElevationDims({ room, wall, cabinets, tags }: { room: Room; wall: WallId; cabinets: Cabinet[]; tags: boolean }) {
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
      {tags && cabinets.map((c) => (
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
    if (useStore.getState().present) return;
    if (e.button !== 0) return;
    e.stopPropagation();
    useStore.getState().select(w.id);
  };
  return (
    <group position={[pos[0], 0, pos[2]]} rotation-y={rotY} onPointerDown={select} onDoubleClick={(e) => { e.stopPropagation(); useStore.getState().edit({ kind: 'panel', id: w.id }); }}>
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

/** A ceiling that slopes down to the walls: a fine grid following the ceiling height, seen from below. */
function SlopedCeiling({ room, color }: { room: Room; color: string }) {
  const geo = useMemo(() => {
    const nx = Math.max(2, Math.ceil(room.width / 2)), nz = Math.max(2, Math.ceil(room.depth / 2));
    const pos: number[] = [], idx: number[] = [];
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const x = (room.width * i) / nx, z = (room.depth * j) / nz;
      pos.push(x, ceilingAt(room, x, z), z);
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      // Faces point down, into the room
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [room]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color={color} emissive="#ffffff" emissiveIntensity={0.18} roughness={0.95} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** A door or drawer front that swings on its hinge line, or slides out, easing to where it's going. */
function Moving({ open, pivot, angle, slide, lift, children }: { open: boolean; pivot: [number, number]; angle: number; slide: number; lift?: boolean; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 7);
    const ta = open ? angle : 0, tz = pivot[1] + (open ? slide : 0);
    const rot = lift ? g.rotation.x : g.rotation.y;
    if (Math.abs(rot - ta) < 1e-4 && Math.abs(g.position.z - tz) < 1e-3) return;
    if (lift) g.rotation.x += (ta - rot) * k; else g.rotation.y += (ta - rot) * k;
    g.position.z += (tz - g.position.z) * k;
  });
  // Doors turn about a vertical hinge line at (x, z); lift-up doors about a level one at (y, z)
  const at: [number, number, number] = lift ? [0, pivot[0], pivot[1]] : [pivot[0], 0, pivot[1]];
  return (
    <group ref={ref} position={at}>
      <group position={[-at[0], -at[1], -at[2]]}>{children}</group>
    </group>
  );
}

/** A dovetail drawer box behind its front: sides, back, sub-front and bottom, in clear maple. */
function DrawerBox({ x0, y0, z0, w, h, d }: { x0: number; y0: number; z0: number; w: number; h: number; d: number }) {
  const t = 0.5, col = '#dcc39a';
  const pieces: [number, number, number, number, number, number][] = [
    [x0, y0, z0, t, h, d], [x0 + w - t, y0, z0, t, h, d],
    [x0 + t, y0, z0, w - 2 * t, h, t], [x0 + t, y0, z0 + d - t, w - 2 * t, h, t],
    [x0 + t, y0 + 0.5, z0 + t, w - 2 * t, 0.25, d - 2 * t],
  ];
  return (
    <group>
      {pieces.map(([x, y, z, sx, sy, sz], i) => (
        <mesh key={i} position={[x + sx / 2, y + sy / 2, z + sz / 2]} castShadow receiveShadow>
          <boxGeometry args={[sx, sy, sz]} /><meshStandardMaterial color={col} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}
