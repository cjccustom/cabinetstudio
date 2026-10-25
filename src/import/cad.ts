// Reading CAD plans exported from Chief Architect (or anything else): ASCII DXF is parsed here,
// DWG through LibreDWG compiled to WebAssembly, loaded only when a DWG is opened. Both end up as
// the same short list of flat entities, in the drawing's own units with y up.

export type Pt = [number, number];
export type CadEnt =
  | { kind: 'line'; layer: string; a: Pt; b: Pt }
  | { kind: 'poly'; layer: string; pts: Pt[]; closed: boolean }
  | { kind: 'arc'; layer: string; c: Pt; r: number; a0: number; a1: number }
  | { kind: 'text'; layer: string; at: Pt; text: string };

export interface CadDrawing {
  ents: CadEnt[];
  /** Inches per drawing unit, from $INSUNITS (inches when it isn't set). */
  scale: number;
  source: 'dxf' | 'dwg';
}

/** $INSUNITS codes to inches. */
const UNITS: Record<number, number> = { 0: 1, 1: 1, 2: 12, 4: 1 / 25.4, 5: 1 / 2.54, 6: 39.3701 };

/** Chief's MTEXT carries font codes: "\fChief Blueprint|b0|i0|c0|p0;U321299\P" -> "U321299". */
export function cleanText(s: string): string {
  return s.replace(/\\[fFcCHhQqTtWwAa][^;]*;/g, '').replace(/\\P/g, ' ').replace(/[{}]/g, '').replace(/\\[LlOoKk]/g, '').replace(/\s+/g, ' ').trim();
}

/* ---------- DXF ---------- */

type Group = { code: number; value: string };

function pairs(text: string): Group[] {
  const lines = text.split(/\r?\n/);
  const out: Group[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) out.push({ code: parseInt(lines[i].trim(), 10), value: lines[i + 1].trim() });
  return out;
}

interface RawEnt { type: string; g: Group[] }

/** Split a run of groups into entities at each code-0 marker. */
function entities(gs: Group[]): RawEnt[] {
  const out: RawEnt[] = [];
  let cur: RawEnt | null = null;
  for (const g of gs) {
    if (g.code === 0) { cur = { type: g.value, g: [] }; out.push(cur); } else if (cur) cur.g.push(g);
  }
  return out;
}

const num = (e: RawEnt, code: number, d = 0) => { const g = e.g.find((x) => x.code === code); return g ? parseFloat(g.value) : d; };
const str = (e: RawEnt, code: number) => e.g.find((x) => x.code === code)?.value ?? '';

type Xf = (p: Pt) => Pt;
const deg = Math.PI / 180;

/** One raw entity to flat ones, through a transform (for block inserts). */
function convert(e: RawEnt, xf: Xf, rot: number, k: number, layerFor: (l: string) => string, blocks: Map<string, { base: Pt; ents: RawEnt[] }>, depth: number, out: CadEnt[]) {
  const layer = layerFor(str(e, 8) || '0');
  switch (e.type) {
    case 'LINE': out.push({ kind: 'line', layer, a: xf([num(e, 10), num(e, 20)]), b: xf([num(e, 11), num(e, 21)]) }); break;
    case 'LWPOLYLINE': {
      const xs = e.g.filter((g) => g.code === 10).map((g) => parseFloat(g.value));
      const ys = e.g.filter((g) => g.code === 20).map((g) => parseFloat(g.value));
      out.push({ kind: 'poly', layer, pts: xs.map((x, i) => xf([x, ys[i] ?? 0])), closed: (num(e, 70) & 1) === 1 });
      break;
    }
    case 'SOLID': case 'TRACE': {
      const pts = [[10, 20], [11, 21], [13, 23], [12, 22]].map(([a, b]) => xf([num(e, a), num(e, b)]));
      out.push({ kind: 'poly', layer, pts, closed: true });
      break;
    }
    case 'ARC': out.push({ kind: 'arc', layer, c: xf([num(e, 10), num(e, 20)]), r: num(e, 40) * k, a0: num(e, 50) * deg + rot, a1: num(e, 51) * deg + rot }); break;
    case 'CIRCLE': out.push({ kind: 'arc', layer, c: xf([num(e, 10), num(e, 20)]), r: num(e, 40) * k, a0: 0, a1: 2 * Math.PI }); break;
    case 'TEXT': out.push({ kind: 'text', layer, at: xf([num(e, 10), num(e, 20)]), text: cleanText(str(e, 1)) }); break;
    case 'MTEXT': {
      const t = e.g.filter((g) => g.code === 3 || g.code === 1).map((g) => g.value).join('');
      out.push({ kind: 'text', layer, at: xf([num(e, 10), num(e, 20)]), text: cleanText(t) });
      break;
    }
    case 'INSERT': {
      const b = blocks.get(str(e, 2));
      if (!b || depth > 6) break;
      const ip: Pt = [num(e, 10), num(e, 20)];
      const sx = num(e, 41, 1), sy = num(e, 42, 1), r = num(e, 50) * deg;
      const cos = Math.cos(r), sin = Math.sin(r);
      const inner: Xf = ([x, y]) => { const u = (x - b.base[0]) * sx, v = (y - b.base[1]) * sy; return xf([ip[0] + u * cos - v * sin, ip[1] + u * sin + v * cos]); };
      // Entities on layer 0 inside a block take the insert's layer
      for (const be of b.ents) convert(be, inner, rot + r, k * Math.abs(sx), (l) => (l === '0' ? layer : layerFor(l)), blocks, depth + 1, out);
      break;
    }
    default: break;
  }
}

export function parseDxf(text: string): CadDrawing {
  const gs = pairs(text);
  // Sections: HEADER for units, BLOCKS for inserts, ENTITIES for the drawing
  const sections = new Map<string, Group[]>();
  for (let i = 0; i < gs.length; i++) {
    if (gs[i].code === 0 && gs[i].value === 'SECTION' && gs[i + 1]?.code === 2) {
      const name = gs[i + 1].value;
      let j = i + 2;
      while (j < gs.length && !(gs[j].code === 0 && gs[j].value === 'ENDSEC')) j++;
      sections.set(name, gs.slice(i + 2, j));
      i = j;
    }
  }
  if (!sections.has('ENTITIES')) throw new Error('This doesn’t look like a DXF drawing (no ENTITIES section). Binary DXF isn’t supported; export ASCII DXF.');
  const head = sections.get('HEADER') ?? [];
  const iu = head.findIndex((g) => g.code === 9 && g.value === '$INSUNITS');
  const units = iu >= 0 ? parseInt(head[iu + 1]?.value ?? '1', 10) : 1;
  const blocks = new Map<string, { base: Pt; ents: RawEnt[] }>();
  let cur: { name: string; base: Pt; ents: RawEnt[] } | null = null;
  for (const e of entities(sections.get('BLOCKS') ?? [])) {
    if (e.type === 'BLOCK') cur = { name: str(e, 2), base: [num(e, 10), num(e, 20)], ents: [] };
    else if (e.type === 'ENDBLK') { if (cur) blocks.set(cur.name, cur); cur = null; } else cur?.ents.push(e);
  }
  const out: CadEnt[] = [];
  for (const e of entities(sections.get('ENTITIES')!)) convert(e, (p) => p, 0, 1, (l) => l, blocks, 0, out);
  return { ents: out, scale: UNITS[units] ?? 1, source: 'dxf' };
}

/* ---------- DWG (LibreDWG) ---------- */

interface DwgEnt { type: string; layer: string; [k: string]: unknown }
type P = { x: number; y: number };

/** LibreDWG's converted database to flat entities. */
export function fromDwgDatabase(db: { entities?: DwgEnt[]; header?: { INSUNITS?: number } }): CadDrawing {
  const out: CadEnt[] = [];
  const pt = (p: unknown): Pt => [(p as P)?.x ?? 0, (p as P)?.y ?? 0];
  for (const e of db.entities ?? []) {
    const layer = e.layer ?? '0';
    switch (e.type) {
      case 'LINE': out.push({ kind: 'line', layer, a: pt(e.startPoint), b: pt(e.endPoint) }); break;
      case 'LWPOLYLINE': out.push({ kind: 'poly', layer, pts: ((e.vertices as P[]) ?? []).map(pt), closed: (((e.flag as number) ?? 0) & 1) === 1 }); break;
      case 'SOLID': out.push({ kind: 'poly', layer, pts: ['corner1', 'corner2', 'corner4', 'corner3'].map((k) => pt(e[k])), closed: true }); break;
      case 'ARC': out.push({ kind: 'arc', layer, c: pt(e.center), r: e.radius as number, a0: e.startAngle as number, a1: e.endAngle as number }); break;
      case 'CIRCLE': out.push({ kind: 'arc', layer, c: pt(e.center), r: e.radius as number, a0: 0, a1: 2 * Math.PI }); break;
      case 'TEXT': out.push({ kind: 'text', layer, at: pt(e.startPoint ?? e.insertionPoint), text: cleanText(String(e.text ?? '')) }); break;
      case 'MTEXT': out.push({ kind: 'text', layer, at: pt(e.insertionPoint), text: cleanText(String(e.text ?? '')) }); break;
      default: break;
    }
  }
  return { ents: out, scale: UNITS[db.header?.INSUNITS ?? 1] ?? 1, source: 'dwg' };
}

/** Where the DWG reader's files are published, next to the page. */
export const DWG_LIB = 'libredwg/';

let dwgLib: Promise<{ read: (buf: ArrayBuffer) => unknown }> | null = null;
/** Load LibreDWG (about 9 MB) the first time a DWG is opened. */
function loadDwg() {
  if (!dwgLib) {
    dwgLib = (async () => {
      const base = new URL(DWG_LIB, document.baseURI).href;
      const mod = await import(/* @vite-ignore */ `${base}dist/libredwg-web.js`);
      const lib = await mod.LibreDwg.create(`${base}wasm/`);
      return { read: (buf: ArrayBuffer) => lib.convert(lib.dwg_read_data(buf, mod.Dwg_File_Type.DWG)) };
    })();
    dwgLib.catch(() => { dwgLib = null; });
  }
  return dwgLib;
}

/** Read a DXF or DWG file the person picked. */
export async function readCadFile(file: File): Promise<CadDrawing> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'dxf') return parseDxf(await file.text());
  if (ext === 'dwg') {
    let lib;
    try { lib = await loadDwg(); } catch { throw new Error('Couldn’t load the DWG reader in this view. Export DXF from Chief instead, or try again.'); }
    return fromDwgDatabase(lib.read(await file.arrayBuffer()) as Parameters<typeof fromDwgDatabase>[0]);
  }
  throw new Error('Pick a .dxf or .dwg file.');
}
