// Stand in the room: the camera at eye height inside the room, the way the client will see it. Drag to
// look around (the view follows the finger, like a street photo), tap the floor to walk there, tap a
// cabinet or wall to walk up to it and face it, pinch or scroll to zoom; on a keyboard the arrows or
// WASD walk and Q/E turn. Every walk stops three feet short of whatever is in the way.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { Room } from '../model/types';
import { useNav } from './navigation';

/** Eye height off the floor, inches. */
export const EYE = 62;
/** How close a walk comes to anything in its way, and where a tap on a cabinet stands you. */
const CLEAR = 36, STAND = 54, MARGIN = 14;

const visible = (o: THREE.Object3D | null): boolean => { for (; o; o = o.parent) if (!o.visible) return false; return true; };

export function WalkControls({ room }: { room: Room }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const turnKey = useNav((n) => n.turnKey);
  const st = useRef({
    p: new THREE.Vector3(room.width / 2, EYE, room.depth - Math.min(40, room.depth / 3)),
    yaw: 0, pitch: -0.04, fov: 68,
    anim: null as null | { from: THREE.Vector3; to: THREE.Vector3; y0: number; y1: number; t0: number; dur: number },
    keys: new Set<string>(),
  });

  const clamp = (v: THREE.Vector3) => {
    v.x = Math.min(Math.max(v.x, MARGIN), room.width - MARGIN);
    v.z = Math.min(Math.max(v.z, MARGIN), room.depth - MARGIN);
    v.y = EYE;
    return v;
  };
  const meshHits = (rc: THREE.Raycaster) => rc.intersectObject(scene, true).find((h) => (h.object as THREE.Mesh).isMesh && visible(h.object) && !(h.object as THREE.Mesh).userData.noWalk);
  // Stop short of anything in the way, checked at knee and chest height
  const clear = (to: THREE.Vector3) => {
    const s = st.current;
    const d = new THREE.Vector3(to.x - s.p.x, 0, to.z - s.p.z);
    const len = d.length();
    if (len < 1) return clamp(to);
    d.divideScalar(len);
    let reach = len + CLEAR;
    for (const h of [20, 50]) {
      const hit = meshHits(new THREE.Raycaster(new THREE.Vector3(s.p.x, h, s.p.z), d, 0, reach));
      if (hit) reach = Math.min(reach, hit.distance);
    }
    const go = Math.max(0, Math.min(len, reach - CLEAR));
    return clamp(new THREE.Vector3(s.p.x + d.x * go, EYE, s.p.z + d.z * go));
  };
  const turnTo = (y: number) => { const s = st.current; let d = y - s.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return s.yaw + d; };
  const go = (to: THREE.Vector3, yaw?: number) => {
    const s = st.current;
    const dest = clear(to);
    s.anim = { from: s.p.clone(), to: dest, y0: s.yaw, y1: yaw == null ? s.yaw : turnTo(yaw), t0: performance.now(), dur: Math.min(1600, Math.max(450, s.p.distanceTo(dest) * 7)) };
  };

  // "Turn around" from the toolbar
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } const s = st.current; go(s.p.clone(), s.yaw + Math.PI); }, [turnKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = gl.domElement;
    const s = st.current;
    camera.fov = s.fov; camera.near = 1; camera.updateProjectionMatrix();
    const pts = new Map<number, [number, number]>();
    let pinch = 0, down: [number, number] | null = null;
    const setFov = (v: number) => { s.fov = Math.min(80, Math.max(30, v)); camera.fov = s.fov; camera.updateProjectionMatrix(); };
    const onDown = (e: PointerEvent) => {
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 1) down = [e.clientX, e.clientY];
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); down = null; }
    };
    const onMove = (e: PointerEvent) => {
      const q = pts.get(e.pointerId);
      if (!q) return;
      if (pts.size === 1) {
        s.anim = null;
        const k = 0.0038 * (s.fov / 68);
        s.yaw -= (e.clientX - q[0]) * k;
        s.pitch = Math.min(1.15, Math.max(-1.15, s.pitch + (e.clientY - q[1]) * k));
      }
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) setFov(s.fov * pinch / d); pinch = d; }
    };
    const onUp = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = 0;
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 8 || e.button !== 0) { down = null; return; }
      down = null;
      // A tap: walk to the spot on the floor, or up to the cabinet or wall tapped, facing it
      const rc = el.getBoundingClientRect();
      const m = new THREE.Vector2(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(m, camera);
      const hit = meshHits(ray);
      if (!hit) return;
      const n = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
      if (n.y > 0.7 && hit.point.y < 3) { go(hit.point.clone()); return; }
      const d = new THREE.Vector3(hit.point.x - s.p.x, 0, hit.point.z - s.p.z);
      const len = d.length();
      if (len < 1) return;
      d.divideScalar(len);
      go(hit.point.clone().addScaledVector(d, -STAND), Math.atan2(d.x, -d.z));
    };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); e.stopImmediatePropagation(); setFov(s.fov + e.deltaY * 0.03); };
    const typing = () => /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName ?? '');
    const key = (e: KeyboardEvent) => (e.key.length === 1 ? e.key.toLowerCase() : e.key);
    const onKey = (e: KeyboardEvent) => { if (typing()) return; const k = key(e); if (/^(Arrow(Up|Down|Left|Right)|[wasdqe])$/.test(k)) { s.keys.add(k); s.anim = null; e.preventDefault(); } };
    const onKeyUp = (e: KeyboardEvent) => { s.keys.delete(key(e)); };
    const onBlur = () => s.keys.clear();
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.parentElement?.addEventListener('wheel', onWheel, { capture: true, passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.parentElement?.removeEventListener('wheel', onWheel, { capture: true });
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [camera, gl, scene, room]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(() => {
    const s = st.current;
    if (s.anim) {
      const a = s.anim, t = Math.min(1, (performance.now() - a.t0) / a.dur);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      s.p.lerpVectors(a.from, a.to, e);
      s.yaw = a.y0 + (a.y1 - a.y0) * e;
      if (t >= 1) s.anim = null;
    }
    if (s.keys.size) {
      const k = s.keys, sp = 2.2;
      const fw = (k.has('ArrowUp') || k.has('w') ? 1 : 0) - (k.has('ArrowDown') || k.has('s') ? 1 : 0);
      const side = (k.has('d') ? 1 : 0) - (k.has('a') ? 1 : 0);
      s.yaw += ((k.has('ArrowRight') || k.has('e') ? 1 : 0) - (k.has('ArrowLeft') || k.has('q') ? 1 : 0)) * 0.03;
      const next = s.p.clone();
      next.x += (Math.sin(s.yaw) * fw + Math.cos(s.yaw) * side) * sp;
      next.z += (-Math.cos(s.yaw) * fw + Math.sin(s.yaw) * side) * sp;
      // Keys walk too, but not through a cabinet
      const d = new THREE.Vector3(next.x - s.p.x, 0, next.z - s.p.z);
      const len = d.length();
      if (len > 0) {
        d.divideScalar(len);
        const blocked = [20, 50].some((h) => !!meshHits(new THREE.Raycaster(new THREE.Vector3(s.p.x, h, s.p.z), d, 0, len + 18)));
        if (!blocked) s.p.copy(clamp(next));
      }
    }
    const c = Math.cos(s.pitch);
    camera.position.copy(s.p);
    camera.lookAt(s.p.x + Math.sin(s.yaw) * c, s.p.y + Math.sin(s.pitch), s.p.z - Math.cos(s.yaw) * c);
  });
  return null;
}
