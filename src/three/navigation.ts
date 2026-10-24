// How you get around the 3D and elevation views: zoom toward the cursor, pan with a drag
// (right or middle button, Shift-drag, or Pan mode), and on a trackpad, two-finger swipe to pan
// and pinch to zoom. The view buttons reach the live camera through here.
import * as THREE from 'three';
import { create } from 'zustand';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

export type Pointer = 'mouse' | 'trackpad';
const load = <T extends string>(key: string, ok: T[], d: T): T => { try { const v = localStorage.getItem(key) as T; return ok.includes(v) ? v : d; } catch { return d; } };
const save = (key: string, v: string) => { try { localStorage.setItem(key, v); } catch { /* storage blocked */ } };

export const useNav = create<{
  mode: 'orbit' | 'pan';
  pointer: Pointer;
  /** Set once the pointer is chosen by hand, so it isn't guessed again. */
  pointerChosen: boolean;
  /** Bumped to put the camera back where each view starts. */
  resetKey: number;
  /** Draw the coffered ceiling (it can hide the room from above). */
  ceiling: boolean;
  setCeiling: (on: boolean) => void;
  setMode: (m: 'orbit' | 'pan') => void;
  setPointer: (p: Pointer, byHand?: boolean) => void;
  reset: () => void;
}>((set) => ({
  mode: load('cabinet-studio.nav', ['orbit', 'pan'], 'orbit'),
  pointer: load('cabinet-studio.pointer', ['mouse', 'trackpad'], 'mouse'),
  pointerChosen: load('cabinet-studio.pointerChosen', ['yes', 'no'], 'no') === 'yes',
  resetKey: 0,
  ceiling: load('cabinet-studio.ceiling', ['on', 'off'], 'on') === 'on',
  setCeiling: (on) => { save('cabinet-studio.ceiling', on ? 'on' : 'off'); set({ ceiling: on }); },
  setMode: (mode) => { save('cabinet-studio.nav', mode); set({ mode }); },
  setPointer: (pointer, byHand = false) => {
    save('cabinet-studio.pointer', pointer);
    if (byHand) save('cabinet-studio.pointerChosen', 'yes');
    set((s) => ({ pointer, pointerChosen: s.pointerChosen || byHand }));
  },
  reset: () => set((s) => ({ resetKey: s.resetKey + 1 })),
}));

/** The live controls, for the view buttons outside the canvas. */
export const live: { controls: OrbitControlsImpl | null; element: HTMLElement | null } = { controls: null, element: null };

/** Slide the view by a number of screen pixels. */
export function panBy(dx: number, dy: number) {
  const c = live.controls, el = live.element;
  if (!c || !el) return;
  const cam = c.object as THREE.PerspectiveCamera | THREE.OrthographicCamera;
  cam.updateMatrix();
  let k: number;
  if ((cam as THREE.PerspectiveCamera).isPerspectiveCamera) {
    const p = cam as THREE.PerspectiveCamera;
    k = (2 * p.position.distanceTo(c.target) * Math.tan((p.fov / 2) * Math.PI / 180)) / el.clientHeight;
  } else {
    const o = cam as THREE.OrthographicCamera;
    k = (o.right - o.left) / o.zoom / el.clientWidth;
  }
  const right = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 0).multiplyScalar(dx * k);
  const up = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 1).multiplyScalar(-dy * k);
  const move = right.add(up);
  cam.position.add(move);
  c.target.add(move);
  c.update();
}

/** Zoom toward the middle of the view, for the + and − buttons. */
export function zoomStep(inward: boolean) {
  const c = live.controls;
  if (!c) return;
  const was = c.zoomToCursor;
  c.zoomToCursor = false;
  if (inward) c.dollyIn(1.25); else c.dollyOut(1.25);
  c.zoomToCursor = was;
}

/**
 * Wheel handling ahead of the controls: a trackpad's two-finger swipe pans, a pinch (which the
 * browser sends as a wheel with Ctrl held) zooms smoothly, and a mouse wheel zooms at the cursor.
 */
export function onWheel(e: WheelEvent) {
  const c = live.controls;
  if (!c) return;
  const nav = useNav.getState();
  if (e.ctrlKey) {
    c.zoomSpeed = Math.min(2, Math.max(0.05, Math.abs(e.deltaY) / 8));
    return;
  }
  // Only trackpads (and Magic Mice) scroll sideways; Shift+wheel is a mouse turned sideways
  if (!nav.pointerChosen && nav.pointer === 'mouse' && e.deltaX !== 0 && !e.shiftKey) nav.setPointer('trackpad');
  if (useNav.getState().pointer === 'trackpad') {
    e.preventDefault();
    e.stopImmediatePropagation();
    panBy(e.deltaX, e.deltaY);
    return;
  }
  c.zoomSpeed = Math.min(1.5, Math.max(0.2, Math.abs(e.deltaY) / 60));
}
