// Edge profiles routed on solid wood tops, tables and bench seats: the cross-section of the edge,
// drawn in the 3D view, on the profiles sheet and named in the scope.

export type EdgeProfile = 'square' | 'eased' | 'round18' | 'round14' | 'round38' | 'round12' | 'chamfer' | 'cove' | 'ogee' | 'halfBull' | 'bullnose' | 'thumbnail';

export const edgeProfiles: { v: EdgeProfile; label: string }[] = [
  { v: 'eased', label: 'Eased (sanded corners)' },
  { v: 'square', label: 'Square' },
  { v: 'round18', label: '1/8" roundover' },
  { v: 'round14', label: '1/4" roundover' },
  { v: 'round38', label: '3/8" roundover' },
  { v: 'round12', label: '1/2" roundover' },
  { v: 'chamfer', label: '1/4" chamfer' },
  { v: 'cove', label: '3/8" cove' },
  { v: 'ogee', label: 'Roman ogee' },
  { v: 'thumbnail', label: 'Thumbnail' },
  { v: 'halfBull', label: 'Half bullnose' },
  { v: 'bullnose', label: 'Full bullnose' },
];
export const edgeLabel = (e?: EdgeProfile) => edgeProfiles.find((x) => x.v === (e ?? 'eased'))!.label;
/** Profiles that take a router setup (priced as an edge profile). */
export const isRouted = (e?: EdgeProfile) => !!e && e !== 'square' && e !== 'eased';

const arc = (cx: number, cy: number, r: number, a0: number, a1: number, n = 10): [number, number][] =>
  Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });

/**
 * The edge, top to bottom: (inset, height) pairs, inset = how far in from the outermost line of the
 * edge, height off the bottom face. Starts on the top face and ends on the bottom face.
 */
export function edgeCurve(p: EdgeProfile, t: number): [number, number][] {
  const e = Math.min(1 / 16, t / 8);
  const ease = (y: number): [number, number][] => [[e, y], [0, y - e]];
  const bottomEase: [number, number][] = [[0, e], [e, 0]];
  const round = (r: number): [number, number][] => [...arc(r, t - r, r, Math.PI / 2, Math.PI).map(([x, y]) => [x, y] as [number, number]), ...bottomEase];
  switch (p) {
    case 'square': return [[0, t], [0, 0]];
    case 'eased': return [...ease(t), ...bottomEase];
    case 'round18': return round(Math.min(0.125, t / 2));
    case 'round14': return round(Math.min(0.25, t / 2));
    case 'round38': return round(Math.min(0.375, t / 2));
    case 'round12': return round(Math.min(0.5, t / 2));
    case 'chamfer': { const c = Math.min(0.25, t / 2); return [[c, t], [0, t - c], ...bottomEase]; }
    case 'cove': {
      // A concave quarter round out of the top corner, a small fillet below it
      const r = Math.min(0.375, t * 0.6), f = Math.min(0.0625, (t - r) / 3);
      return [...arc(0, t, r, 0, -Math.PI / 2), [0, t - r - f], ...bottomEase];
    }
    case 'ogee': {
      // An S: hollow at the top, round below it
      const d = Math.min(0.375, t * 0.4), h = Math.min(0.75, t * 0.65), n = 12;
      const pts: [number, number][] = [[d + 0.0625, t], [d, t - 0.03]];
      for (let i = 1; i <= n; i++) { const s = i / n; pts.push([d * (1 - (3 * s * s - 2 * s * s * s)), t - 0.03 - (h - 0.03) * s]); }
      return [...pts, ...bottomEase];
    }
    case 'thumbnail': {
      // A long, shallow round falling to a small step
      const d = Math.min(0.5, t * 0.45), h = Math.min(0.375, t * 0.4), n = 10;
      const pts: [number, number][] = [];
      for (let i = 0; i <= n; i++) { const a = (Math.PI / 2) * (i / n); pts.push([d * (1 - Math.sin(a)), t - h * (1 - Math.cos(a))]); }
      return [...pts, [0, t - h - 0.0625], ...bottomEase];
    }
    case 'halfBull': { const r = Math.min(t / 2, t); return [...arc(r, t - r, r, Math.PI / 2, Math.PI).map(([x, y]) => [x, y] as [number, number]), [0, 0]]; }
    case 'bullnose': { const r = t / 2; return arc(r, r, r, Math.PI / 2, Math.PI * 1.5, 16).map(([x, y]) => [x, y] as [number, number]); }
  }
}

/**
 * A top's cross-section across its width (u from 0 at the back to w at the front, v up from 0 to
 * t), with its front edge profiled and its back edge square or profiled too (a table, a free-standing
 * seat). Counter-clockwise.
 */
export function topSection(w: number, t: number, front: EdgeProfile, back: EdgeProfile = 'square'): [number, number][] {
  // Up the back edge (bottom to top), then down the front edge (top to bottom); the bottom closes it
  const b = edgeCurve(back, t).map(([i, y]) => [i, y] as [number, number]).reverse();
  const f = edgeCurve(front, t).map(([i, y]) => [w - i, y] as [number, number]);
  return [...b, ...f];
}
