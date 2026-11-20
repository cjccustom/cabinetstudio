// The 3D view as a .glb model for the client portal, where the customer turns it and pins notes on
// it. Exported as the customer should see it: real colors, doors closed, nothing selected, with the
// room's walls. Wall faces show only from inside, and the trim on a wall (named cjc-facing) and the
// ceiling (cjc-ceiling) go in whole: the portal's viewer hides them when they'd block the view, as
// the app does. Lights stay behind (the viewer has its own).
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { useStore } from '../store';
import { live, useNav } from './navigation';
import { roomTabs, switchRoom } from '../model/rooms';
import { mainWall } from './WalkControls';
import { choicesExtras } from '../model/clientChoices';

/**
 * The doors and drawer fronts in each other style the client can try: the view redrawn in that style and
 * its fronts copied out where they stand, one hidden-by-the-page group per style (cjc-style:<id>).
 */
async function frontVariants(ids: string[]): Promise<THREE.Group[]> {
  const start = useStore.getState().project;
  const out: THREE.Group[] = [];
  const shown = (o: THREE.Object3D | null) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
  try {
    for (const id of ids) {
      useStore.setState({ project: { ...start, settings: { ...start.settings, doorStyleId: id } } });
      await frames(25);
      const sc = live.scene;
      if (!sc) continue;
      sc.updateMatrixWorld(true);
      const g = new THREE.Group();
      g.name = `cjc-style:${id}`;
      sc.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || m.name !== 'cjc-m:door' || !shown(m)) return;
        // Copies of their own: the view lets go of its geometry when it redraws
        const c = new THREE.Mesh(m.geometry.clone(), (m.material as THREE.Material).clone());
        c.name = m.name;
        m.matrixWorld.decompose(c.position, c.quaternion, c.scale);
        g.add(c);
      });
      out.push(g);
    }
  } finally {
    useStore.setState({ project: start });
    await frames(10);
  }
  return out;
}

const frames = (n = 3) => new Promise<void>((ok) => { const step = (k: number) => (k ? requestAnimationFrame(() => step(k - 1)) : ok()); step(n); });

export async function exportModel(): Promise<ArrayBuffer> {
  const st = useStore.getState(), nav = useNav.getState();
  const before = { view: st.view, plain: nav.plain, walls: nav.walls, allOpen: nav.allOpen, open: nav.open };
  st.select(null);
  if (st.view !== '3d') st.setView('3d');
  useNav.setState({ plain: false, walls: true, allOpen: false, open: [] });
  live.exporting = true;
  try {
    // Give the view time to build (longer when it's just been opened)
    for (let i = 0; i < 60 && !live.scene; i++) await frames(1);
    await frames(20);
    const scene = live.scene;
    if (!scene) throw new Error('Open the Design tab’s 3D view first, then send again.');
    // A job with several rooms: each room's 3D in turn, set side by side with a gap, in one model
    if (roomTabs(st.project).length > 1) return await exportRooms();
    // The other door styles the client can try, beside the ones drawn
    const choices = choicesExtras(useStore.getState().project);
    const variants = choices ? await frontVariants(choices.doors.map((d) => d.id).filter((id) => id !== choices.now.door)) : [];
    variants.forEach((g) => scene.add(g));
    // Lights and anything hidden stay out of the model
    const lights: THREE.Object3D[] = [];
    scene.traverse((o) => { if ((o as THREE.Light).isLight && o.visible) { lights.push(o); o.visible = false; } });
    // The wall to face first when the client stands in the room (glTF extras)
    const was = { face: scene.userData.cjcFace, choices: scene.userData.cjcChoices };
    scene.userData.cjcFace = mainWall(useStore.getState().project);
    if (choices) scene.userData.cjcChoices = choices;
    try {
      const out = await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: true, maxTextureSize: 1024 });
      if (!(out instanceof ArrayBuffer)) throw new Error('The model didn’t come out as a .glb.');
      return out;
    } finally {
      lights.forEach((o) => { o.visible = true; });
      scene.userData.cjcFace = was.face; scene.userData.cjcChoices = was.choices;
      variants.forEach((g) => { scene.remove(g); g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } }); });
    }
  } finally {
    live.exporting = false;
    useNav.setState({ plain: before.plain, walls: before.walls, allOpen: before.allOpen, open: before.open });
    if (before.view !== '3d') useStore.getState().setView(before.view);
  }
}

/** Every room of the job in one model: each room's 3D copied out in turn, set side by side left to right. */
async function exportRooms(): Promise<ArrayBuffer> {
  const start = useStore.getState().project;
  const all = new THREE.Scene();
  const choices = choicesExtras(start);
  if (choices) all.userData.cjcChoices = choices;
  const others = choices ? choices.doors.map((d) => d.id).filter((id) => id !== choices.now.door) : [];
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
      // The room's name rides along (glTF extras), for the client page's room switcher
      room.userData = { ...room.userData, cjcRoom: t.name, cjcFace: mainWall(useStore.getState().project) };
      for (const child of sc.children) {
        if ((child as THREE.Light).isLight || (child as THREE.Camera).isCamera || !child.visible) continue;
        room.add(child.clone(true));
      }
      for (const g of await frontVariants(others)) room.add(g);
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
