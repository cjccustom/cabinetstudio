// A part's solid with routed edges: slices up through its height, each slice the plan rectangle (or
// a shaped outline) pulled in where a profile cuts at that depth, with its corners rounded or chamfered
// if asked. Centered on its own middle, ready to place.
import * as THREE from 'three';
import { cutInset, offsetOutline } from '../model/customParts';
import type { BoxProfile, ProfileCut } from '../model/pieceEdits';

const STEPS = 10;

/** A plan rectangle, each side pulled in, its corners rounded (r) or chamfered. */
function rectLayer(sx: number, sz: number, ins: [number, number, number, number], corner: { kind: 'roundover' | 'chamfer'; size: number } | undefined): [number, number][] {
  const [xn, xp, zn, zp] = ins;
  const x0 = -sx / 2 + xn, x1 = sx / 2 - xp, z0 = -sz / 2 + zn, z1 = sz / 2 - zp;
  const r = corner ? Math.max(0, Math.min(corner.size, (x1 - x0) / 2 - 0.01, (z1 - z0) / 2 - 0.01)) : 0;
  if (r <= 0) return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const n = corner!.kind === 'chamfer' ? 1 : 6;
  const pts: [number, number][] = [];
  // Corners counterclockwise from (x0, z0), each from one side's end to the next side's start
  const corners: [number, number, number][] = [[x1 - r, z0 + r, -Math.PI / 2], [x1 - r, z1 - r, 0], [x0 + r, z1 - r, Math.PI / 2], [x0 + r, z0 + r, Math.PI]];
  for (const [cx, cz, a0] of corners) for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * (Math.PI / 2); pts.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]); }
  return pts;
}

const insetOf = (c: ProfileCut | undefined, z: number): [number, number, number, number] => {
  if (!c) return [0, 0, 0, 0];
  const v = cutInset(c.kind, c.size, z);
  return [c.sides.xn ? v : 0, c.sides.xp ? v : 0, c.sides.zn ? v : 0, c.sides.zp ? v : 0];
};
const depthOf = (c?: ProfileCut) => (c ? (c.kind === 'bead' ? c.size * 1.2 : c.size) : 0);

/**
 * The solid for a box of size [sx, sy, sz] with routed edges. With an outline (a shaped top), the
 * outline is pulled in evenly all around instead of side by side.
 */
export function profiledBox(size: [number, number, number], prof: BoxProfile, outline?: [number, number][]): THREE.BufferGeometry {
  const [sx, sy, sz] = size;
  let dt = depthOf(prof.top), db = depthOf(prof.bottom);
  if (dt + db > sy * 0.96) { const k = (sy * 0.96) / (dt + db); dt *= k; db *= k; }
  const layer = (c: ProfileCut | undefined, z: number): [number, number][] => {
    if (outline) {
      const v = c ? cutInset(c.kind, c.size, z) : 0;
      return v ? offsetOutline(outline, outline.map(() => v)) : outline;
    }
    return rectLayer(sx, sz, insetOf(c, z), prof.corners);
  };
  // Slices from the bottom face up: the bottom profile, straight, then the top profile
  const layers: { y: number; poly: [number, number][] }[] = [];
  if (db > 0) for (let i = 0; i <= STEPS; i++) { const z = db - (db * i) / STEPS; layers.push({ y: db - z, poly: layer(prof.bottom, z) }); }
  else layers.push({ y: 0, poly: layer(undefined, 0) });
  if (dt > 0) for (let i = 0; i <= STEPS; i++) { const z = (dt * (STEPS - i)) / STEPS; layers.push({ y: sy - z, poly: layer(prof.top, z) }); }
  else layers.push({ y: sy, poly: layer(undefined, 0) });

  const pos: number[] = [];
  const V = (p: [number, number], y: number) => new THREE.Vector3(p[0], y - sy / 2, p[1]);
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, out: THREE.Vector3) => {
    const nrm = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    if (nrm.lengthSq() < 1e-14) return;
    if (nrm.dot(out) < 0) [b, c] = [c, b];
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };
  const n = layers[0].poly.length;
  for (let L = 0; L < layers.length - 1; L++) {
    const A = layers[L], B = layers[L + 1];
    if (B.poly.length !== n) continue;
    for (let k = 0; k < n; k++) {
      const k1 = (k + 1) % n;
      const mid = V([(A.poly[k][0] + A.poly[k1][0]) / 2, (A.poly[k][1] + A.poly[k1][1]) / 2], (A.y + B.y) / 2);
      const out = new THREE.Vector3(mid.x, 0, mid.z);
      const a0 = V(A.poly[k], A.y), a1 = V(A.poly[k1], A.y), b0 = V(B.poly[k], B.y), b1 = V(B.poly[k1], B.y);
      tri(a0, a1, b1, out); tri(a0, b1, b0, out);
    }
  }
  // Caps: fans from the middle (the layers are convex or star-shaped about it)
  for (const [l, up] of [[layers[0], -1], [layers[layers.length - 1], 1]] as const) {
    const c = new THREE.Vector3(0, l.y - sy / 2, 0);
    for (let k = 0; k < l.poly.length; k++) tri(c, V(l.poly[k], l.y), V(l.poly[(k + 1) % l.poly.length], l.y), new THREE.Vector3(0, up, 0));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
