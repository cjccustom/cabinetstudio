// Mouldings as a drawing shows them in elevation: a run seen face-on carries a few fine lines where
// its profile breaks (the edges of fillets, beads and coves), and where it turns a corner its end shows
// the profile's own outline. Seen end-on (cut through on a side wall) it's the profile itself.
import { mountShape, type Profile } from '../model/moldings';

type Pt = [number, number];

/**
 * The profile's front silhouette, bottom to top: at each height, how far it stands out from the face
 * it's nailed to. Steps (a fillet's square shoulder) come out as two points a hair apart in height.
 */
export function profileEnvelope(prof: Profile): Pt[] {
  const m = mountShape(prof);
  const pts = m.pts;
  const vs = new Set<number>();
  for (const [, v] of pts) for (const e of [-1e-4, 0, 1e-4]) vs.add(Math.min(m.height, Math.max(0, v + e)));
  const out: Pt[] = [];
  for (const v of [...vs].sort((a, b) => a - b)) {
    let u = -Infinity;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if (a[1] === b[1]) { if (Math.abs(a[1] - v) < 1e-9) u = Math.max(u, a[0], b[0]); continue; }
      if ((a[1] - v) * (b[1] - v) > 0) continue;
      u = Math.max(u, a[0] + ((v - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
    }
    if (u > -Infinity) out.push([Math.max(0, u), v]);
  }
  return out;
}

/**
 * Heights (from the profile's bottom) where it breaks sharply enough to draw a line across the run:
 * corners in its silhouette, not every facet of a curve. Kept to the strongest few, so a crown at
 * half-inch scale still reads as a crown and not a smudge.
 */
export function profileBreaks(prof: Profile, max = 6): number[] {
  const env = profileEnvelope(prof);
  const h = mountShape(prof).height;
  // Drop points that sit on top of each other
  const p: Pt[] = [];
  for (const q of env) if (!p.length || Math.hypot(q[0] - p[p.length - 1][0], q[1] - p[p.length - 1][1]) > 0.004) p.push(q);
  const found: { v: number; turn: number }[] = [];
  for (let i = 1; i < p.length - 1; i++) {
    const a = [p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]], b = [p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]];
    const la = Math.hypot(a[0], a[1]), lb = Math.hypot(b[0], b[1]);
    if (la < 1e-6 || lb < 1e-6) continue;
    const turn = Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1]) / (la * lb))));
    if (turn > (30 * Math.PI) / 180) found.push({ v: p[i][1], turn });
  }
  // One line per break: a square step gives two corners a hair apart
  const keep: { v: number; turn: number }[] = [];
  for (const f of found.sort((x, y) => y.turn - x.turn)) {
    if (f.v < 0.05 || f.v > h - 0.05) continue;
    if (keep.some((k) => Math.abs(k.v - f.v) < 0.07)) continue;
    keep.push(f);
    if (keep.length >= max) break;
  }
  return keep.map((k) => k.v).sort((a, b) => a - b);
}

/** How far the silhouette stands out at height v. */
export function envelopeAt(env: Pt[], v: number): number {
  if (!env.length) return 0;
  if (v <= env[0][1]) return env[0][0];
  for (let i = 1; i < env.length; i++) {
    const [u0, v0] = env[i - 1], [u1, v1] = env[i];
    if (v <= v1) return v1 - v0 < 1e-9 ? Math.max(u0, u1) : u0 + ((v - v0) * (u1 - u0)) / (v1 - v0);
  }
  return env[env.length - 1][0];
}

export type EndCut = 'square' | 'out' | 'in';

/**
 * A run seen face-on, x0 to x1 along the wall (the miter tips, for a run that turns an outside
 * corner), with its profile's bottom at yb (or its top at yb, hung upside down). An end mitered round
 * an outside corner shows the profile's outline, the return seen end-on; a square or inside-mitered end
 * is a straight edge. Returns the outline and the fine lines across it at the profile's breaks.
 */
export function runFaceOn(prof: Profile, x0: number, x1: number, yb: number, cut: [EndCut, EndCut] = ['square', 'square'], hang = false): { pts: Pt[]; lines: [number, number, number, number][] } {
  const m = mountShape(prof), d = m.depth;
  const env = profileEnvelope(prof);
  const Y = (v: number) => (hang ? yb - v : yb + v);
  const left = (v: number) => (cut[0] === 'out' ? x0 + d - envelopeAt(env, v) : x0);
  const right = (v: number) => (cut[1] === 'out' ? x1 - d + envelopeAt(env, v) : x1);
  const vs = env.length ? env.map((q) => q[1]) : [0, m.height];
  const R: Pt[] = vs.map((v) => [right(v), Y(v)]);
  const L: Pt[] = vs.map((v) => [left(v), Y(v)]);
  const pts: Pt[] = [...R, ...L.reverse()];
  const lines = profileBreaks(prof).map((v): [number, number, number, number] => [left(v), Y(v), right(v), Y(v)]).filter(([a, , b]) => b - a > 0.05);
  return { pts, lines };
}
