// The 3D view as a .glb model for the client portal, where the customer turns it and pins notes on
// it. Exported as the customer should see it: real colors, doors closed, nothing selected, and the
// room's walls left out so the work can be seen from any side. Lights stay behind (the viewer has its own).
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { useStore } from '../store';
import { live, useNav } from './navigation';
import { roomTabs, switchRoom } from '../model/rooms';

const frames = (n = 3) => new Promise<void>((ok) => { const step = (k: number) => (k ? requestAnimationFrame(() => step(k - 1)) : ok()); step(n); });

export async function exportModel(): Promise<ArrayBuffer> {
  const st = useStore.getState(), nav = useNav.getState();
  const before = { view: st.view, plain: nav.plain, walls: nav.walls, allOpen: nav.allOpen, open: nav.open };
  st.select(null);
  if (st.view !== '3d') st.setView('3d');
  useNav.setState({ plain: false, walls: false, allOpen: false, open: [] });
  try {
    // Give the view time to build (longer when it's just been opened)
    for (let i = 0; i < 60 && !live.scene; i++) await frames(1);
    await frames(20);
    const scene = live.scene;
    if (!scene) throw new Error('Open the Design tab’s 3D view first, then send again.');
    // A job with several rooms: each room's 3D in turn, set side by side with a gap, in one model
    if (roomTabs(st.project).length > 1) return await exportRooms();
    // Lights and anything hidden stay out of the model
    const lights: THREE.Object3D[] = [];
    scene.traverse((o) => { if ((o as THREE.Light).isLight && o.visible) { lights.push(o); o.visible = false; } });
    try {
      const out = await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: true, maxTextureSize: 1024 });
      if (!(out instanceof ArrayBuffer)) throw new Error('The model didn’t come out as a .glb.');
      return out;
    } finally { lights.forEach((o) => { o.visible = true; }); }
  } finally {
    useNav.setState({ plain: before.plain, walls: before.walls, allOpen: before.allOpen, open: before.open });
    if (before.view !== '3d') useStore.getState().setView(before.view);
  }
}

/** Every room of the job in one model: each room's 3D copied out in turn, set side by side left to right. */
async function exportRooms(): Promise<ArrayBuffer> {
  const start = useStore.getState().project;
  const all = new THREE.Scene();
  let x = 0;
  try {
    for (const t of roomTabs(start)) {
      // Put the room on screen without touching undo, and let the view rebuild
      useStore.setState({ project: switchRoom(useStore.getState().project, t.id), selectedId: null, group: [] });
      await frames(30);
      const sc = live.scene;
      if (!sc) continue;
      const room = new THREE.Group();
      room.name = t.name;
      for (const child of sc.children) {
        if ((child as THREE.Light).isLight || (child as THREE.Camera).isCamera || !child.visible) continue;
        room.add(child.clone(true));
      }
      const box = new THREE.Box3().setFromObject(room);
      if (box.isEmpty()) continue;
      const gap = Math.max(1, (box.max.x - box.min.x) * 0.25);
      room.position.x += x - box.min.x;
      x += box.max.x - box.min.x + gap;
      all.add(room);
    }
  } finally {
    // Back to the room that was on screen, exactly as it was
    useStore.setState({ project: start });
    await frames(5);
  }
  const lights: THREE.Object3D[] = [];
  all.traverse((o) => { if ((o as THREE.Light).isLight && o.visible) { lights.push(o); o.visible = false; } });
  const out = await new GLTFExporter().parseAsync(all, { binary: true, onlyVisible: true, maxTextureSize: 1024 });
  if (!(out instanceof ArrayBuffer)) throw new Error('The model didn’t come out as a .glb.');
  return out;
}

// For the rehearsal and troubleshooting: the export can be run from the browser's console
if (typeof window !== 'undefined') (window as unknown as { cabinetStudioExport?: typeof exportModel }).cabinetStudioExport = exportModel;
