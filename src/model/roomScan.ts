// Room scans from CJC Room Scan (the LiDAR scanner app): walls and openings in plan, turned into
// Cabinet Studio's rectangular room with its back, left, right and front walls. The result is the
// same draft the photo reader makes, so it goes through the same check before it's applied.
import type { Opening, WallId } from './types';
import { cleanDraft, type RoomDraft } from './photoRoom';

export interface ScanWall { id: string; start: [number, number]; end: [number, number]; length: number; height: number }
export interface ScanOpening { id: string; kind: 'door' | 'window' | 'opening'; wall?: string; center: [number, number, number]; width: number; height: number; sill: number }
export interface ScanFile { app: string; version: number; name: string; scannedAt: string; units: string; ceilingHeight: number; walls: ScanWall[]; openings: ScanOpening[] }

/** Check a file is a room scan before trusting it. */
export function readScan(text: string): ScanFile {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error('That file isn’t a room scan (it isn’t readable as one).'); }
  const s = raw as Partial<ScanFile>;
  if (s.app !== 'CJC Room Scan' || !Array.isArray(s.walls)) throw new Error('That file isn’t from CJC Room Scan.');
  if (!s.walls.length) throw new Error('The scan has no walls in it. Scan again, pointing at every wall.');
  return s as ScanFile;
}

type V = [number, number];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1];
const len = (a: V) => Math.hypot(a[0], a[1]);
const unit = (a: V): V => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
const mid = (w: ScanWall): V => [(w.start[0] + w.end[0]) / 2, (w.start[1] + w.end[1]) / 2];
/** Looking down on the plan (x, z), the direction to your right when facing f. */
const rightOf = (f: V): V => [-f[1], f[0]];

/** Which way you face when standing in the room looking at each wall. */
function facings(scan: ScanFile): Map<string, V> {
  const ms = scan.walls.map(mid);
  const center: V = [ms.reduce((t, m) => t + m[0], 0) / ms.length, ms.reduce((t, m) => t + m[1], 0) / ms.length];
  const out = new Map<string, V>();
  for (const w of scan.walls) {
    const along = unit(sub(w.end as V, w.start as V));
    let n: V = [-along[1], along[0]];
    if (dot(n, sub(mid(w), center)) < 0) n = [-n[0], -n[1]];
    out.set(w.id, n);
  }
  return out;
}

/** The longest wall makes a sensible back wall until Cody picks one. */
export const defaultBackWall = (scan: ScanFile) => [...scan.walls].sort((a, b) => b.length - a.length)[0].id;

/** Turn a scan into a room draft, with the chosen scanned wall as the back wall. */
export function scanToDraft(scan: ScanFile, backId = defaultBackWall(scan)): RoomDraft {
  const face = facings(scan);
  const fb = face.get(backId) ?? face.values().next().value!;
  const left: V = [fb[1], -fb[0]];
  const sideFacing: Record<WallId, V> = { back: fb, front: [-fb[0], -fb[1]], left, right: [-left[0], -left[1]] };
  const sideOf = new Map<string, WallId>();
  let crooked = false;
  for (const w of scan.walls) {
    const f = face.get(w.id)!;
    let best: WallId = 'back', score = -Infinity;
    for (const s of Object.keys(sideFacing) as WallId[]) { const d = dot(f, sideFacing[s]); if (d > score) { score = d; best = s; } }
    if (score < 0.97) crooked = true;
    sideOf.set(w.id, best);
  }
  // Each side: where it starts (its left end, facing it) and how long it runs
  const span = {} as Record<WallId, { start: number; length: number; axis: V } | undefined>;
  for (const s of Object.keys(sideFacing) as WallId[]) {
    const axis = rightOf(sideFacing[s]);
    const ws = scan.walls.filter((w) => sideOf.get(w.id) === s);
    if (!ws.length) continue;
    const ts = ws.flatMap((w) => [dot(w.start as V, axis), dot(w.end as V, axis)]);
    span[s] = { start: Math.min(...ts), length: Math.max(...ts) - Math.min(...ts), axis };
  }
  const width = span.back?.length ?? span.front?.length ?? 144;
  const depth = span.left?.length ?? span.right?.length ?? 144;
  const multi = (Object.keys(sideFacing) as WallId[]).some((s) => scan.walls.filter((w) => sideOf.get(w.id) === s).length > 1);

  const nearestWall = (c: V) => scan.walls.map((w) => {
    const a = w.start as V, d = sub(w.end as V, a), t = Math.max(0, Math.min(1, dot(sub(c, a), d) / (dot(d, d) || 1)));
    return { id: w.id, dist: len(sub(c, [a[0] + d[0] * t, a[1] + d[1] * t])) };
  }).sort((x, y) => x.dist - y.dist)[0]?.id;

  const counts: Record<string, number> = {};
  const openings = scan.openings.flatMap((o) => {
    const c: V = [o.center[0], o.center[2]];
    const wallId = o.wall && sideOf.has(o.wall) ? o.wall : nearestWall(c);
    const side = wallId ? sideOf.get(wallId) : undefined;
    const sp = side ? span[side] : undefined;
    if (!side || !sp) return [];
    const kind: Opening['kind'] = o.kind === 'door' ? 'door' : o.kind === 'window' ? 'window' : 'cased';
    counts[kind] = (counts[kind] ?? 0) + 1;
    const label = kind === 'door' ? 'Door' : kind === 'window' ? 'Window' : 'Opening';
    return [{ kind, wall: side, name: `${label} ${counts[kind]}`, offset: dot(c, sp.axis) - sp.start - o.width / 2, width: o.width, height: o.height, sill: kind === 'window' ? o.sill : 0, measured: true }];
  });

  const notes = [
    `From the LiDAR scan${scan.name ? ` “${scan.name}”` : ''}${scan.scannedAt ? ` (${new Date(scan.scannedAt).toLocaleDateString('en-US')})` : ''}. Scans are good to an inch or two: field verify before ordering.`,
    ...(crooked || multi ? ['The room isn’t a simple rectangle (angled or broken walls). Each side’s length is its overall run; check the corners.'] : []),
    ...(!span.left || !span.right || !span.front ? ['Not every wall was scanned; missing sides were copied from the opposite wall.'] : []),
  ];
  const draft = cleanDraft({
    room: { width, depth, height: scan.ceilingHeight || 96 },
    measured: { width: true, depth: true, height: true },
    openings,
    trim: { crown: null, base: null, chairRail: null, chairHeight: null, casing: null },
    notes,
  });
  return draft;
}
