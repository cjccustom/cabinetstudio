// Toolpaths and G-code: Cabinet Studio's own CAM for the sheet parts. A sheet's operations (from cnc.ts)
// become tool moves for each tool in the library: shelf pin holes drilled first, then dados and rabbets
// pocketed, then every outline profiled, small parts first, leaving a thin onion skin that a last pass
// cuts through so nothing shifts on the vacuum table. A post-processor writes the moves in the dialect
// of the machine's controller. Everything inside is in inches; posts convert to the controller's units.
import type { SheetLayout } from './optimizer';
import { sheetOps, type CncOp, type CncSettings } from './cnc';
import { materialThickness } from './cutlist';

export type ToolJob = 'profile' | 'pocket' | 'drill';
export interface Tool {
  /** The tool changer's pocket (1-12): also its length offset, H. */
  slot: number;
  name: string;
  /** Cutting diameter, inches. */
  dia: number;
  job: ToolJob;
  rpm: number;
  /** Cutting feed and plunge feed, inches a minute. */
  feed: number;
  plunge: number;
  /** Most it takes in one pass, inches. */
  stepdown: number;
  /** Pockets: how far each ring steps in, as a fraction of the diameter. */
  stepover?: number;
}

/**
 * Starting tools: a 3/8" compression bit for outlines, a 1/4" downcut for dados and rabbets and a
 * 5 mm drill for shelf pins. Feeds and speeds are starting points for plywood on a 9 kW-class spindle,
 * the kind of numbers in the manufacturers' sample programs (18,000 rpm, 8,000 mm/min); set them from
 * the bit maker's chart and what the machine likes.
 */
export const defaultTools: Tool[] = [
  { slot: 1, name: '3/8" compression, 2 flute', dia: 0.375, job: 'profile', rpm: 18000, feed: 315, plunge: 80, stepdown: 0.8 },
  { slot: 2, name: '1/4" downcut, 2 flute', dia: 0.25, job: 'pocket', rpm: 18000, feed: 200, plunge: 60, stepdown: 0.25, stepover: 0.45 },
  { slot: 3, name: '5 mm brad point drill', dia: 5 / 25.4, job: 'drill', rpm: 6000, feed: 60, plunge: 60, stepdown: 1 },
];

export interface CamSettings {
  tools: Tool[];
  /** Height for moves between cuts, above the top of the sheet. */
  safeZ: number;
  /** Left on the outlines for the last pass, so small parts stay put while the rest is cut. */
  skin: number;
  /** Plunging into an outline: ramp down over this length instead of straight down. */
  ramp: number;
  /** Climb cut (the tool runs with the material): cleaner on plywood veneer with a router spindle. */
  climb: boolean;
  /** Which controller the program is written for. */
  post: PostId;
}
export const defaultCam: CamSettings = { tools: defaultTools, safeZ: 0.4, skin: 0.02, ramp: 2, climb: true, post: 'vendorA' };
export const camOf = (c?: Partial<CamSettings>): CamSettings => ({ ...defaultCam, ...c, tools: c?.tools?.length ? c.tools : defaultTools });

type Pt = [number, number];
/** A move: z measured up from the top of the sheet (cuts are negative). */
export type Move = { kind: 'rapid' | 'feed'; x?: number; y?: number; z?: number; f?: number };
export interface ToolBlock { tool: Tool; moves: Move[]; what: string }
export interface SheetProgram { blocks: ToolBlock[]; warnings: string[]; /** Cutting distance and time, minutes, at the programmed feeds. */ minutes: number; inches: number }

const area = (pts: Pt[]) => pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;

/** A closed polygon pushed out (d > 0) or in (d < 0) by d, corners kept square: the outlines here are all straight-sided. */
export function offsetPolygon(pts: Pt[], d: number): Pt[] {
  const ccw = area(pts) > 0;
  const n = pts.length;
  const lines = pts.map((p, i) => {
    const q = pts[(i + 1) % n];
    const dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy) || 1;
    // Outward normal: right of the direction of travel on a counter-clockwise loop
    const nx = (ccw ? dy : -dy) / len, ny = (ccw ? -dx : dx) / len;
    return { p: [p[0] + nx * d, p[1] + ny * d] as Pt, dir: [dx / len, dy / len] as Pt };
  });
  return lines.map((L, i) => {
    const P = lines[(i - 1 + n) % n];
    const det = P.dir[0] * L.dir[1] - P.dir[1] * L.dir[0];
    if (Math.abs(det) < 1e-9) return L.p;
    const t = ((L.p[0] - P.p[0]) * L.dir[1] - (L.p[1] - P.p[1]) * L.dir[0]) / det;
    return [P.p[0] + P.dir[0] * t, P.p[1] + P.dir[1] * t] as Pt;
  });
}

/** Clockwise when seen from above: climb cutting around the outside of a part with the spindle turning clockwise (M03). */
const orient = (pts: Pt[], clockwise: boolean) => ((area(pts) < 0) === clockwise ? pts : [...pts].reverse());

/** Depths for a cut of `depth` in passes no deeper than `step`: equal passes, the last at full depth. */
const passes = (depth: number, step: number) => { const n = Math.max(1, Math.ceil(depth / step - 1e-9)); return Array.from({ length: n }, (_, i) => (depth * (i + 1)) / n); };

/**
 * Around a closed loop at depth z, starting by ramping down along the first edge from the height of
 * the pass above (or the sheet top), then the full loop, then back over the ramped stretch.
 */
function loopMoves(loop: Pt[], zFrom: number, z: number, cam: CamSettings, tool: Tool): Move[] {
  const out: Move[] = [];
  const [x0, y0] = loop[0];
  const [x1, y1] = loop[1 % loop.length];
  const seg = Math.hypot(x1 - x0, y1 - y0);
  const r = Math.min(cam.ramp, seg);
  out.push({ kind: 'feed', z: zFrom + 0.02, f: tool.plunge });
  if (r > 0.25) {
    // Ramp: down to depth over r along the first edge, back to the start at depth
    const ux = (x1 - x0) / seg, uy = (y1 - y0) / seg;
    out.push({ kind: 'feed', x: x0 + ux * r, y: y0 + uy * r, z, f: tool.plunge });
    out.push({ kind: 'feed', x: x0, y: y0, z, f: tool.feed });
  } else out.push({ kind: 'feed', z, f: tool.plunge });
  for (let i = 1; i <= loop.length; i++) { const [x, y] = loop[i % loop.length]; out.push({ kind: 'feed', x, y, z, f: tool.feed }); }
  return out;
}

/** Rings stepping in from a pocket's edge to its middle: the tool's center path for clearing it. */
function pocketRings(pts: Pt[], tool: Tool): Pt[][] {
  const rings: Pt[][] = [];
  const step = tool.dia * (tool.stepover ?? 0.45);
  for (let d = tool.dia / 2; d < 1000; d += step) {
    const ring = offsetPolygon(pts, -d);
    // Stop once the ring turns inside out (the pocket is narrower than twice the inset there)
    if (area(ring) * area(pts) <= 0 || Math.abs(area(ring)) < 1e-4) break;
    const xs = ring.map((q) => q[0]), ys = ring.map((q) => q[1]);
    const pxs = pts.map((q) => q[0]), pys = pts.map((q) => q[1]);
    if (Math.min(...xs) > Math.max(...xs) || Math.max(...xs) - Math.min(...xs) > Math.max(...pxs) - Math.min(...pxs) || Math.max(...ys) - Math.min(...ys) > Math.max(...pys) - Math.min(...pys)) break;
    rings.push(ring);
  }
  return rings.reverse(); // middle out: the last pass cleans the walls
}

/** The program for one sheet: per tool, in the order they're used. */
export function sheetProgram(sh: SheetLayout, ops: Map<string, CncOp[]>, cnc: CncSettings, cam: CamSettings): SheetProgram {
  const parts = sheetOps(sh, ops);
  const warnings: string[] = [];
  const thick = materialThickness(sh.stock.material) ?? 0.75;
  const toolFor = (job: ToolJob) => cam.tools.find((t) => t.job === job);
  const blocks: ToolBlock[] = [];
  const safe = cam.safeZ;
  const go = (moves: Move[], x: number, y: number) => moves.push({ kind: 'rapid', z: safe }, { kind: 'rapid', x, y });

  // 1. Shelf pin holes, in rows along the sheet so the head doesn't zigzag
  const drill = toolFor('drill');
  const holes = parts.flatMap((p) => p.ops.filter((o): o is Extract<CncOp, { kind: 'drill' }> => o.kind === 'drill'));
  if (holes.length) {
    if (!drill) warnings.push('No drill in the tool library: shelf pin holes left out.');
    else {
      if (holes.some((h) => Math.abs(h.dia - drill.dia) > 0.01)) warnings.push(`Holes ${holes[0].dia.toFixed(3)}" drilled with the ${drill.name}.`);
      const sorted = [...holes].sort((a, b) => a.at[0] - b.at[0] || a.at[1] - b.at[1]);
      const m: Move[] = [];
      for (const h of sorted) { go(m, h.at[0], h.at[1]); m.push({ kind: 'feed', z: -h.depth, f: drill.plunge }, { kind: 'rapid', z: safe }); }
      blocks.push({ tool: drill, moves: m, what: `${holes.length} shelf pin holes` });
    }
  }
  // 2. Dados and rabbets
  const pocket = toolFor('pocket') ?? toolFor('profile');
  const pockets = parts.flatMap((p) => p.ops.filter((o): o is Extract<CncOp, { kind: 'pocket' }> => o.kind === 'pocket').map((o) => ({ o, label: p.label })));
  if (pockets.length && pocket) {
    const m: Move[] = [];
    for (const { o, label } of pockets) {
      const rings = pocketRings(o.pts, pocket);
      if (!rings.length) { warnings.push(`${label}: ${o.what} is narrower than the ${pocket.name}; left out.`); continue; }
      let zPrev = 0;
      for (const z of passes(o.depth, pocket.stepdown)) {
        for (const ring of rings) { go(m, ring[0][0], ring[0][1]); m.push(...loopMoves(orient(ring, !cam.climb), zPrev, -z, cam, pocket)); }
        zPrev = -z;
      }
      m.push({ kind: 'rapid', z: safe });
    }
    if (m.length) blocks.push({ tool: pocket, moves: m, what: `${pockets.length} dados and rabbets` });
  }
  // 3. Outlines: small parts first; all of them down to the onion skin, then the skin cut through in the same order
  const profile = toolFor('profile');
  if (!profile) warnings.push('No profiling bit in the tool library: outlines left out.');
  else {
    const full = thick + cnc.through;
    const outlines = parts.map((p) => ({ p, o: p.ops.find((o): o is Extract<CncOp, { kind: 'outline' }> => o.kind === 'outline')! }))
      .filter((x) => x.o && x.o.pts.length > 2)
      .sort((a, b) => Math.abs(area(a.o.pts)) - Math.abs(area(b.o.pts)));
    const m: Move[] = [];
    const path = (pts: Pt[]) => orient(offsetPolygon(pts, profile.dia / 2), cam.climb);
    for (const { o } of outlines) {
      const loop = path(o.pts);
      let zPrev = 0;
      go(m, loop[0][0], loop[0][1]);
      for (const z of passes(Math.max(0, full - cam.skin), profile.stepdown)) { m.push(...loopMoves(loop, zPrev, -z, cam, profile)); zPrev = -z; }
      m.push({ kind: 'rapid', z: safe });
    }
    for (const { o } of outlines) {
      const loop = path(o.pts);
      go(m, loop[0][0], loop[0][1]);
      m.push(...loopMoves(loop, -(full - cam.skin), -full, cam, profile));
      m.push({ kind: 'rapid', z: safe });
    }
    if (m.length) blocks.push({ tool: profile, moves: m, what: `${outlines.length} outlines` });
  }
  // Cutting distance and time at the programmed feeds (rapids at ~400 in/min)
  let inches = 0, minutes = 0;
  for (const b of blocks) {
    let x = 0, y = 0, z = safe;
    for (const mv of b.moves) {
      const nx = mv.x ?? x, ny = mv.y ?? y, nz = mv.z ?? z;
      const d = Math.hypot(nx - x, ny - y, nz - z);
      if (mv.kind === 'feed') { inches += d; minutes += d / (mv.f ?? b.tool.feed); } else minutes += d / 400;
      [x, y, z] = [nx, ny, nz];
    }
    minutes += 0.25; // the tool change
  }
  return { blocks, warnings, minutes, inches };
}

/* ---------- Posts ---------- */

export type PostId = 'vendorA' | 'vendorB';
export interface Post { id: PostId; name: string; units: 'mm'; ext: string; note: string; write: (prog: SheetProgram, cam: CamSettings, title: string) => string }

const mm = (v: number) => v * 25.4;
const f3 = (v: number) => mm(v).toFixed(3);

/**
 * Written to match "vendor A"'s sample program exactly: first tool `T1M6`, later tools `T2` alone after
 * stopping the spindle, `G43H<n>` for the tool length, `M03S<rpm>`, `G00`/`G01` with three decimals,
 * moves carrying only what changed, feeds in mm/min, `M30` at the end.
 */
function writeA(prog: SheetProgram, cam: CamSettings): string {
  const L: string[] = [];
  const safe = f3(cam.safeZ);
  prog.blocks.forEach((b, i) => {
    if (i > 0) L.push(`G00Z${safe}`, 'M05', `T${b.tool.slot}`);
    else L.push(`T${b.tool.slot}M6`);
    L.push(`G43H${b.tool.slot}`, `M03S${b.tool.rpm}`);
    let last: { g?: string; x?: string; y?: string; z?: string; f?: string } = {};
    for (const mv of b.moves) {
      const g = mv.kind === 'rapid' ? 'G00' : 'G01';
      const x = mv.x != null ? f3(mv.x) : undefined, y = mv.y != null ? f3(mv.y) : undefined, z = mv.z != null ? f3(mv.z) : undefined;
      const f = mv.kind === 'feed' ? String(Math.round(mm(mv.f ?? b.tool.feed))) : undefined;
      let s = '';
      if (g !== last.g) s += g;
      if (x != null && x !== last.x) s += `X${x}`;
      if (y != null && y !== last.y) s += `Y${y}`;
      if (z != null && z !== last.z) s += `Z${z}`;
      if (f != null && f !== last.f) s += `F${f}`;
      if (s && s !== g) { L.push(s); last = { g, x: x ?? last.x, y: y ?? last.y, z: z ?? last.z, f: f ?? last.f }; }
    }
  });
  if (L[L.length - 1] !== `G00Z${safe}`) L.push(`G00Z${safe}`);
  L.push('M05', 'M30');
  return L.join('\r\n') + '\r\n';
}

/**
 * Written to match "vendor B"'s Vectric post (ELE G Code ATC, mm): header `T<n> ` / `G43 H<n>` /
 * `S<rpm>M03`; tool change `M5`, `T<n>`, `G43 H<n>`, `S<rpm>M03`; rapids `G0` with what changed, the
 * first feed move `G1…F`, then bare coordinates; footer `M5`, a rapid home with Z first, `M30`.
 */
function writeB(prog: SheetProgram, cam: CamSettings): string {
  const L: string[] = [];
  let last: { x?: string; y?: string; z?: string; f?: string } = {};
  let feeding = false;
  prog.blocks.forEach((b, i) => {
    if (i === 0) L.push(`T${b.tool.slot} `, `G43 H${b.tool.slot}`, `S${b.tool.rpm}M03`);
    else L.push('M5', `T${b.tool.slot}`, `G43 H${b.tool.slot}`, `S${b.tool.rpm}M03`);
    feeding = false;
    // A new tool (and length offset): every position and the feed are stated again
    last = {};
    for (const mv of b.moves) {
      const x = mv.x != null ? f3(mv.x) : undefined, y = mv.y != null ? f3(mv.y) : undefined, z = mv.z != null ? f3(mv.z) : undefined;
      let s = '';
      if (x != null && x !== last.x) s += `X${x}`;
      if (y != null && y !== last.y) s += `Y${y}`;
      if (z != null && z !== last.z) s += `Z${z}`;
      if (mv.kind === 'rapid') {
        if (!s) continue;
        L.push(`G0${s}`);
        feeding = false;
      } else {
        const f = mm(mv.f ?? b.tool.feed).toFixed(1);
        if (f !== last.f) s += `F${f}`;
        if (!s) continue;
        L.push(feeding ? s : `G1${s}`);
        feeding = true;
        last.f = f;
      }
      last = { ...last, x: x ?? last.x, y: y ?? last.y, z: z ?? last.z };
    }
  });
  L.push('M5', `G0Z${f3(cam.safeZ)}X0.000Y0.000`, 'M30');
  return L.join('\r\n') + '\r\n';
}

export const posts: Record<PostId, Post> = {
  vendorA: { id: 'vendorA', name: 'Manufacturer A (T1M6, G43H1, M03S…)', units: 'mm', ext: 'nc', note: 'From their sample program t1t2.nc. Later tool changes are written as T2 without M6, as in their sample: confirm with them that their controller changes tools on T alone.', write: writeA },
  vendorB: { id: 'vendorB', name: 'Manufacturer B (ELE Vectric post, mm)', units: 'mm', ext: 'nc', note: 'From their Vectric post-processor file ELE_GCode_ATC_mm.pp.', write: writeB },
};

/** One sheet's G-code for the chosen controller. */
export function sheetGcode(sh: SheetLayout, ops: Map<string, CncOp[]>, cnc: CncSettings, cam: CamSettings, title = ''): { text: string; program: SheetProgram } {
  const program = sheetProgram(sh, ops, cnc, cam);
  return { text: posts[cam.post].write(program, cam, title), program };
}
