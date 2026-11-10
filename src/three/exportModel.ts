// The 3D view as a .glb model for the client portal, where the customer turns it and pins notes on
// it. Exported as the customer should see it: real colors, doors closed, nothing selected, and the
// room's walls left out so the work can be seen from any side. Lights stay behind (the viewer has its own).
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { useStore } from '../store';
import { live, useNav } from './navigation';

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
