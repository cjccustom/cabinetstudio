import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Edges, Line } from '@react-three/drei';
import type { ViewMode } from '../store';
import type { Floor, Opening, Project, VisualBox, WallId } from '../model/types';
import { wallLength, wallOrder, wallTransform } from '../model/layout';
import { floorOf, openingTrim, roomMoldings } from '../model/room';
import { designByCode, doorDrawing, proportionsFor, type ReebDesign } from '../model/reeb';
import { doorOf } from '../model/doorOrder';
import { MoldingModel } from './MoldingModel';

const T = 4.5;
const EDGE = '#3b3f45';

/** Floor, walls with their openings cut out, casing and room trim. */
export function RoomModel({ project, view }: { project: Project; view: ViewMode }) {
  const { room } = project;
  const { width: W, depth: D, height: H } = room;
  const wallColor = project.finishes.wall ?? '#f1efea';
  const trim = project.finishes.trim ?? '#f7f5ef';
  const openings = project.openings ?? [];
  return (
    <group>
      <FloorModel floor={floorOf(project)} W={W} D={D} />
      {wallOrder.map((wall) => {
        const { pos, rotY } = wallTransform(room, wall, 0);
        const mine = openings.filter((o) => o.wall === wall);
        return (
          <group key={wall} position={pos} rotation-y={rotY}>
            <WallFace len={wallLength(room, wall)} H={H} openings={mine} color={wallColor} />
            <FacingCamera>
              {mine.map((o) => <OpeningModel key={o.id} o={o} trim={trim} />)}
              <MoldingModel pieces={roomMoldings(project, wall)} color={trim} edgeColor={EDGE} />
            </FacingCamera>
          </group>
        );
      })}
      {view === 'plan' && <PlanWalls project={project} />}
    </group>
  );
}

/** Shows its children only while the camera is on the room side of the wall, so trim never blocks the view from outside. */
function FacingCamera({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    const g = ref.current;
    if (!g) return;
    v.copy(camera.position);
    g.parent?.worldToLocal(v);
    g.visible = v.z > 0.5;
  });
  return <group ref={ref}>{children}</group>;
}

function WallFace({ len, H, openings, color }: { len: number; H: number; openings: Opening[]; color: string }) {
  const key = JSON.stringify([len, H, openings.map((o) => [o.offset, o.width, o.sill, o.height])]);
  const geo = useMemo(() => {
    const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(len, 0), new THREE.Vector2(len, H), new THREE.Vector2(0, H)]);
    for (const o of openings) {
      const x0 = Math.max(0.1, o.offset), x1 = Math.min(len - 0.1, o.offset + o.width);
      const y0 = Math.max(0, o.sill), y1 = Math.min(H - 0.1, o.sill + o.height);
      if (x1 <= x0 || y1 <= y0) continue;
      // A door's hole reaches the floor, so nudge it just above to keep the shape valid
      shape.holes.push(new THREE.Path([new THREE.Vector2(x0, Math.max(0.01, y0)), new THREE.Vector2(x0, y1), new THREE.Vector2(x1, y1), new THREE.Vector2(x1, Math.max(0.01, y0))]));
    }
    return new THREE.ShapeGeometry(shape);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
  );
}

function Box({ b, color, edges = true, opacity }: { b: VisualBox; color: string; edges?: boolean; opacity?: number }) {
  const [x, y, z] = b.min;
  const [sx, sy, sz] = b.size;
  if (sx <= 0 || sy <= 0 || sz <= 0) return null;
  return (
    <mesh position={[x + sx / 2, y + sy / 2, z + sz / 2]}>
      <boxGeometry args={[sx, sy, sz]} />
      <meshStandardMaterial color={color} roughness={opacity ? 0.1 : 0.75} transparent={!!opacity} opacity={opacity ?? 1} />
      {edges && <Edges color={EDGE} threshold={15} />}
    </mesh>
  );
}

const vb = (x: number, y: number, z: number, sx: number, sy: number, sz: number): VisualBox => ({ min: [x, y, z], size: [sx, sy, sz] });

/** Jambs, the door or sash in the opening, and the casing around it. */
function OpeningModel({ o, trim }: { o: Opening; trim: string }) {
  const j = 0.75;
  const { offset: x0, width: w, sill: y0, height: h } = o;
  const jambs = [vb(x0, y0, -T, j, h, T), vb(x0 + w - j, y0, -T, j, h, T), vb(x0, y0 + h - j, -T, w, j, T)];
  if (o.kind === 'window') jambs.push(vb(x0, y0, -T, w, j, T));
  const t = openingTrim(o);
  const inner: VisualBox[] = [];
  const d = doorOf(o);
  const design = o.kind === 'door' ? designByCode(d.design) : undefined;
  if (o.kind === 'door' && !design) {
    // No design chosen: a plain slab set back in the jamb
    inner.push(vb(x0 + j, 0.5, -T + 1, w - 2 * j, h - j - 0.5, 1.375));
  } else if (o.kind === 'window') {
    // Double-hung: sash frame and meeting rail
    const f = 2;
    const zs = -T + 1.5;
    inner.push(vb(x0 + j, y0 + j, zs, w - 2 * j, f, 1.25), vb(x0 + j, y0 + h - j - f, zs, w - 2 * j, f, 1.25));
    inner.push(vb(x0 + j, y0 + j, zs, f, h - 2 * j, 1.25), vb(x0 + w - j - f, y0 + j, zs, f, h - 2 * j, 1.25));
    inner.push(vb(x0 + j, y0 + h / 2 - 0.75, zs, w - 2 * j, 1.5, 1.25));
  }
  return (
    <group>
      {jambs.map((b, i) => <Box key={`j${i}`} b={b} color={trim} />)}
      {inner.map((b, i) => <Box key={`i${i}`} b={b} color={trim} />)}
      {design && <DoorLeaves o={o} design={design} leaves={d.leaves} color={trim} />}
      {o.kind === 'door' && d.leaves === 1 && <Box b={vb(d.hinge === 'left' ? x0 + w - j - 3.5 : x0 + j + 2.25, 36, -T + 2.375, 1.25, 1.25, 1.5)} color="#b49a5a" edges={false} />}
      {o.kind === 'window' && <Box b={vb(x0 + j, y0 + j, -T + 2, w - 2 * j, h - 2 * j, 0.1)} color="#cfe1ea" edges={false} opacity={0.55} />}
      {o.kind !== 'window' && <Box b={vb(x0, 0, -T - 0.2, w, h, 0.1)} color={o.kind === 'door' ? '#8c8f94' : '#565a60'} edges={false} />}
      {t.boxes.map((b, i) => <Box key={`c${i}`} b={b} color={trim} />)}
      <MoldingModel pieces={t.pieces} color={trim} edgeColor={EDGE} />
    </group>
  );
}

/** Reeb door leaves in the jamb, drawn from the design's panel layout. */
function DoorLeaves({ o, design, leaves, color }: { o: Opening; design: ReebDesign; leaves: 1 | 2; color: string }) {
  const j = 0.75;
  const W = (o.width - 2 * j - 0.25 - (leaves > 1 ? 0.125 : 0)) / leaves;
  const H = o.height - j - 0.625;
  const dr = useMemo(() => doorDrawing(design, W, H, proportionsFor(design, H)), [design, W, H]);
  const tint = design.line === 'wood' ? woodTint(design.species) : color;
  return (
    <>
      {Array.from({ length: leaves }, (_, k) => {
        const x = o.offset + j + 0.125 + k * (W + 0.125);
        return (
          <group key={k} position={[x, 0.5, -T + 1]}>
            {dr.boxes.map((b, i) => <Box key={i} b={{ ...b }} color={b.shade ? shade(tint, b.shade) : tint} />)}
            {dr.glass.map((b, i) => <Box key={`g${i}`} b={b} color="#cfe1ea" edges={false} opacity={0.55} />)}
            {dr.braces.map((br, i) => {
              const dx = br.b[0] - br.a[0], dy = br.b[1] - br.a[1];
              const len = Math.hypot(dx, dy);
              return (
                <mesh key={`b${i}`} position={[(br.a[0] + br.b[0]) / 2, (br.a[1] + br.b[1]) / 2, br.z + br.t / 2]} rotation-z={Math.atan2(dy, dx)}>
                  <boxGeometry args={[len, br.w, br.t]} />
                  <meshStandardMaterial color={tint} roughness={0.75} />
                  <Edges color={EDGE} threshold={15} />
                </mesh>
              );
            })}
          </group>
        );
      })}
    </>
  );
}

const woodTint = (species?: string) => ({ Maple: '#e2c49a', 'Red oak': '#c99a66', Fir: '#cf9a5f', 'Knotty alder': '#b97a4c', Pine: '#e0b97f' } as Record<string, string>)[species ?? ''] ?? '#c99a66';

/** Wood, tile and the rest drawn as a repeating texture, one tile = 8'. */
function FloorModel({ floor, W, D }: { floor: Floor; W: number; D: number }) {
  const tex = useMemo(() => floorTexture(floor), [floor.kind, floor.color, floor.size]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => tex.dispose(), [tex]);
  tex.repeat.set(W / 96, D / 96);
  return (
    <mesh rotation-x={-Math.PI / 2} position={[W / 2, 0, D / 2]}>
      <planeGeometry args={[W, D]} />
      <meshStandardMaterial map={tex} roughness={floor.kind === 'tile' ? 0.45 : 0.85} />
    </mesh>
  );
}

function shade(hex: string, k: number) {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l * k)));
  return `#${c.getHexString()}`;
}

function floorTexture(f: Floor): THREE.CanvasTexture {
  const px = 4, S = 96 * px;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  // Seeded so the floor doesn't reshuffle on every render
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.fillStyle = f.color;
  g.fillRect(0, 0, S, S);
  if (f.kind === 'hardwood' || f.kind === 'vinyl') {
    const pw = Math.max(2, f.size) * px;
    for (let y = 0; y < S; y += pw) {
      let x = -rnd() * 60 * px;
      while (x < S) {
        const len = (24 + rnd() * 54) * px;
        g.fillStyle = shade(f.color, 0.88 + rnd() * 0.22);
        g.fillRect(x, y, len, pw);
        g.fillStyle = shade(f.color, 0.65);
        g.fillRect(x, y, 1, pw);
        x += len;
      }
      g.fillStyle = shade(f.color, 0.62);
      g.fillRect(0, y, S, 1);
    }
  } else if (f.kind === 'tile') {
    const ts = Math.max(3, f.size) * px;
    for (let y = 0; y < S; y += ts) for (let x = 0; x < S; x += ts) {
      g.fillStyle = shade(f.color, 0.95 + rnd() * 0.1);
      g.fillRect(x, y, ts, ts);
    }
    g.fillStyle = shade(f.color, 0.75);
    for (let v = 0; v < S; v += ts) { g.fillRect(v, 0, 2, S); g.fillRect(0, v, S, 2); }
  } else {
    // Carpet and concrete: a fine mottle
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = shade(f.color, (f.kind === 'carpet' ? 0.9 : 0.85) + rnd() * 0.25);
      const r = f.kind === 'carpet' ? 1 : 2 + rnd() * 5;
      g.fillRect(rnd() * S, rnd() * S, r, r);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Plan view: wall thickness with the openings left open, and door swings. */
function PlanWalls({ project }: { project: Project }) {
  const { width: W, depth: D, height: H } = project.room;
  const openings = project.openings ?? [];
  const bands: [number, number, number, number][] = [];
  const along = (wall: WallId, a: number, b: number): [number, number, number, number] => {
    // [x, z, sx, sz] of the wall band between a and b along the wall
    if (wall === 'back') return [(a + b) / 2, -T / 2, b - a, T];
    if (wall === 'front') return [W - (a + b) / 2, D + T / 2, b - a, T];
    if (wall === 'left') return [-T / 2, D - (a + b) / 2, T, b - a];
    return [W + T / 2, (a + b) / 2, T, b - a];
  };
  for (const wall of wallOrder) {
    const len = wallLength(project.room, wall);
    const cuts = openings.filter((o) => o.wall === wall).map((o) => [o.offset, o.offset + o.width] as [number, number]).sort((a, b) => a[0] - b[0]);
    let x = wall === 'back' || wall === 'front' ? -T : 0;
    const end = wall === 'back' || wall === 'front' ? len + T : len;
    for (const [a, b] of cuts) { if (a > x) bands.push(along(wall, x, a)); x = Math.max(x, b); }
    if (end > x) bands.push(along(wall, x, end));
  }
  return (
    <>
      {bands.map(([x, z, sx, sz], i) => (
        <mesh key={i} position={[x, H / 2, z]}>
          <boxGeometry args={[sx, H, sz]} />
          <meshBasicMaterial color="#5b5f66" />
        </mesh>
      ))}
      {openings.map((o) => {
        const { pos, rotY } = wallTransform(project.room, o.wall, 0);
        const d = doorOf(o);
        // Doors swing into the room from the hinge jamb; pairs swing from both
        const swings: { hx: number; r: number; dir: 1 | -1 }[] = o.kind !== 'door' ? [] : d.leaves === 2
          ? [{ hx: o.offset, r: o.width / 2, dir: 1 }, { hx: o.offset + o.width, r: o.width / 2, dir: -1 }]
          : [{ hx: d.hinge === 'left' ? o.offset : o.offset + o.width, r: o.width, dir: d.hinge === 'left' ? 1 : -1 }];
        return (
          <group key={o.id} position={pos} rotation-y={rotY}>
            {o.kind === 'window' && <Line points={[[o.offset, H + 1, -T / 2], [o.offset + o.width, H + 1, -T / 2]]} color="#7fb3d0" lineWidth={3} />}
            {swings.map((sw, i) => {
              const arc = Array.from({ length: 17 }, (_, k) => { const a = (Math.PI / 2) * (k / 16); return [sw.hx + sw.dir * sw.r * Math.cos(a), H + 1, sw.r * Math.sin(a)] as [number, number, number]; });
              return <Line key={i} points={[[sw.hx, H + 1, 0], [sw.hx, H + 1, sw.r], ...arc.reverse()]} color="#8a8f96" lineWidth={1.5} />;
            })}
          </group>
        );
      })}
    </>
  );
}
