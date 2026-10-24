// Manufacturer 3D models for appliances: read the file the maker publishes (glTF/GLB, OBJ, DAE,
// FBX, STL or USDZ), turn it into one glTF JSON file the artifact can store, and load it back
// for the 3D view. The model only dresses the 3D view; sizes, openings and drawings keep using
// the appliance's own dimensions.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { USDZLoader } from 'three/examples/jsm/loaders/USDZLoader.js';
import type { Model3D } from '../model/appliances';

export const modelExtensions = ['glb', 'gltf', 'obj', 'dae', 'fbx', 'stl', 'usdz'];
export const modelAccept = modelExtensions.map((e) => `.${e}`).join(',');

/** Inches per model unit. */
export const unitInches: Record<Model3D['units'], number> = { mm: 1 / 25.4, cm: 1 / 2.54, m: 39.3701, in: 1, ft: 12 };

/** Read a maker's model file into a three.js object. */
export async function readModelFile(file: File): Promise<THREE.Object3D> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const buf = await file.arrayBuffer();
  const text = () => new TextDecoder().decode(buf);
  switch (ext) {
    case 'glb':
    case 'gltf':
      return new Promise((ok, fail) => new GLTFLoader().parse(ext === 'gltf' ? text() : buf, '', (g) => ok(g.scene), fail));
    case 'obj': {
      // Without its .mtl an OBJ comes in plain white; give it an appliance finish instead
      const o = new OBJLoader().parse(text());
      o.traverse((n) => { const mesh = n as THREE.Mesh; if (mesh.isMesh) mesh.material = new THREE.MeshStandardMaterial({ color: '#3a3d42', metalness: 0.35, roughness: 0.45 }); });
      return o;
    }
    case 'dae':
      return new ColladaLoader().parse(text(), '').scene;
    case 'fbx':
      return new FBXLoader().parse(buf, '');
    case 'stl': {
      const geo = new STLLoader().parse(buf);
      return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#9fa3a8', metalness: 0.4, roughness: 0.4 }));
    }
    case 'usdz':
      return new USDZLoader().parse(buf);
    default:
      throw new Error(`A .${ext} file isn't one the app can read. Use GLB, glTF, OBJ, DAE, FBX, STL or USDZ (SketchUp and Revit files need exporting to one of these first).`);
  }
}

/** Size of the object's bounding box in its own units, after turning it Y-up. */
export function modelSize(obj: THREE.Object3D, up: Model3D['up']): [number, number, number] {
  const g = new THREE.Group();
  const c = obj.clone();
  if (up === 'z') c.rotation.x = -Math.PI / 2;
  g.add(c);
  g.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(g);
  const s = b.getSize(new THREE.Vector3());
  return [s.x, s.y, s.z];
}

/** Guess the units from the size: an appliance is a foot to a few feet across. */
export function guessUnits(size: [number, number, number]): Model3D['units'] {
  const big = Math.max(...size);
  if (big > 200) return 'mm';
  if (big > 20 && big <= 200) return big > 100 ? 'cm' : 'in';
  if (big < 5) return 'm';
  return 'in';
}

const MAX = 20 * 1024 * 1024;

/** One glTF JSON file, under the storage limit: textures dropped if they don't fit, then error. */
export async function toStoredGltf(obj: THREE.Object3D): Promise<{ blob: Blob; texturesDropped: boolean }> {
  const exportJson = (o: THREE.Object3D) => new Promise<string>((ok, fail) =>
    new GLTFExporter().parse(o, (r) => ok(JSON.stringify(r)), fail, { binary: false, embedImages: true, onlyVisible: true }));
  let json = await exportJson(obj);
  let texturesDropped = false;
  if (json.length > MAX) {
    const plain = obj.clone(true);
    plain.traverse((n) => {
      const m = (n as THREE.Mesh).material;
      for (const mat of Array.isArray(m) ? m : m ? [m] : []) for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'bumpMap'] as const) (mat as unknown as Record<string, unknown>)[k] = null;
    });
    json = await exportJson(plain);
    texturesDropped = true;
  }
  if (json.length > MAX) throw new Error('This model is too detailed to store (over 20 MB even without its textures). Look for a lighter "low poly" or "LOD" version from the maker.');
  return { blob: new Blob([json], { type: 'application/json' }), texturesDropped };
}

const cache = new Map<string, Promise<THREE.Object3D>>();
/** Load a stored model (by its display URL), once per page. */
export function loadStoredModel(url: string): Promise<THREE.Object3D> {
  if (!cache.has(url)) {
    cache.set(url, fetch(url).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then((t) => new Promise<THREE.Object3D>((ok, fail) => new GLTFLoader().parse(t, '', (g) => ok(g.scene), fail))));
  }
  return cache.get(url)!;
}
/** Hold a just-imported model in memory, for views that can't store it. */
export function rememberModel(url: string, obj: THREE.Object3D) { cache.set(url, Promise.resolve(obj)); }

/**
 * The model placed in the appliance's box: turned Y-up and to face the room, scaled from its
 * units, then fit inside w × h × d without stretching, centered across, standing on the bottom
 * and with its front at the box's front.
 */
export function placeModel(src: THREE.Object3D, m: Model3D, box: { min: [number, number, number]; size: [number, number, number] }): THREE.Object3D {
  const inner = src.clone(true);
  const turn = new THREE.Group();
  if (m.up === 'z') inner.rotation.x = -Math.PI / 2;
  turn.add(inner);
  turn.rotation.y = (m.turn * Math.PI) / 180;
  const scale = new THREE.Group();
  scale.add(turn);
  const k = unitInches[m.units];
  scale.scale.setScalar(k);
  scale.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(scale);
  const s = b.getSize(new THREE.Vector3());
  const [w, h, d] = box.size;
  // Never bigger than the appliance's box; a model in the right units fits at 1:1
  const fit = Math.min(1, w / s.x || 1, h / s.y || 1, d / s.z || 1);
  const out = new THREE.Group();
  out.add(scale);
  out.scale.setScalar(fit);
  out.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(out);
  const [x0, y0, z0] = box.min;
  out.position.set(x0 + w / 2 - (b2.min.x + b2.max.x) / 2, y0 - b2.min.y, z0 + d - b2.max.z);
  return out;
}
