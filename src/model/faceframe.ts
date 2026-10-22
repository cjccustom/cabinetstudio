// Face frame stock: total length needed at each finished width, and how many rough boards
// to buy when ripping and jointing strips out of wider stock.
import type { Project } from './types';
import { buildParts } from './parts';
import { resolveEnds } from './layout';

export interface FaceFrameStock {
  species: string;
  supplier: string;
  /** Rough board length you buy. */
  boardLength: number;
  /** Typical rough board width. */
  boardWidth: number;
  /** For board feet: 4/4 = 1. */
  nominalThickness: number;
  /** Saw kerf plus jointing per strip. */
  ripAllowance: number;
  /** Straight-line rip off the first edge of each board. */
  edgeCleanup: number;
  /** Extra length on each piece for squaring and trimming. */
  lengthAllowance: number;
  /** Cut off each end of a board for checks and snipe. */
  endTrim: number;
  kerf: number;
  /** Defects, knots and color you cut around. 0.15 = 15%. */
  waste: number;
  pricePerBF: number;
}

export const defaultFaceFrameStock: FaceFrameStock = {
  species: 'Hard maple, 4/4',
  supplier: 'Anderson & McQuaid',
  boardLength: 96,
  boardWidth: 6,
  nominalThickness: 1,
  ripAllowance: 0.1875,
  edgeCleanup: 0.25,
  lengthAllowance: 0.5,
  endTrim: 2,
  kerf: 0.125,
  waste: 0.15,
  pricePerBF: 0,
};

export interface FFPiece { cabinet: string; name: string; width: number; length: number }

export function faceFramePieces(p: Project): FFPiece[] {
  const out: FFPiece[] = [];
  for (const c of p.cabinets) {
    for (const part of buildParts(c, p.settings, resolveEnds(p.room, p.cabinets, c))) {
      if (part.material !== 'faceframe' || !part.cut) continue;
      out.push({ cabinet: c.name, name: part.name, width: part.width, length: part.length });
    }
  }
  return out;
}

export interface WidthGroup {
  width: number;
  /** Width each strip is ripped to before jointing to finish. */
  ripWidth: number;
  pieces: { length: number; qty: number; cabinets: string[]; names: string[] }[];
  count: number;
  /** Finished lengths added up. */
  totalLength: number;
  /** With the per-piece length allowance and kerfs. */
  cutLength: number;
  longest: number;
  /** Full-length strips needed, lengths packed end to end. */
  strips: { pieces: number[]; used: number }[];
}

export interface Board { strips: number[]; used: number }

export interface FaceFrameResult {
  groups: WidthGroup[];
  boards: Board[];
  /** Pieces longer than a board. */
  tooLong: FFPiece[];
  netBF: number;
  roughBF: number;
  buyBF: number;
  cost: number;
}

const r16 = (v: number) => Math.round(v * 16) / 16;

export function faceFrameNeeds(pieces: FFPiece[], s: FaceFrameStock): FaceFrameResult {
  const usableLen = s.boardLength - 2 * s.endTrim;
  const tooLong = pieces.filter((p) => p.length + s.lengthAllowance > usableLen);
  const widths = [...new Set(pieces.map((p) => r16(p.width)))].sort((a, b) => a - b);

  const groups: WidthGroup[] = widths.map((width) => {
    const mine = pieces.filter((p) => r16(p.width) === width);
    const byLen = new Map<number, WidthGroup['pieces'][number]>();
    for (const p of mine) {
      const key = r16(p.length);
      const row = byLen.get(key) ?? { length: key, qty: 0, cabinets: [], names: [] };
      row.qty++;
      if (!row.cabinets.includes(p.cabinet)) row.cabinets.push(p.cabinet);
      if (!row.names.includes(p.name)) row.names.push(p.name);
      byLen.set(key, row);
    }
    const rows = [...byLen.values()].sort((a, b) => b.length - a.length);
    // First-fit decreasing: pack cut lengths end to end into board-length strips
    const strips: WidthGroup['strips'] = [];
    for (const p of mine.filter((x) => !tooLong.includes(x)).map((x) => x.length + s.lengthAllowance).sort((a, b) => b - a)) {
      const st = strips.find((x) => x.used + s.kerf + p <= usableLen + 1e-6);
      if (st) { st.used += (st.pieces.length ? s.kerf : 0) + p; st.pieces.push(p); }
      else strips.push({ pieces: [p], used: p });
    }
    return {
      width,
      ripWidth: width + s.ripAllowance,
      pieces: rows,
      count: mine.length,
      totalLength: mine.reduce((t, p) => t + p.length, 0),
      cutLength: mine.reduce((t, p) => t + p.length + s.lengthAllowance, 0),
      longest: Math.max(...mine.map((p) => p.length)),
      strips,
    };
  });

  // Rip plan: pack every strip's rip width across rough boards, widest first
  const usableW = s.boardWidth - s.edgeCleanup;
  const allStrips = groups.flatMap((g) => g.strips.map(() => g.ripWidth)).sort((a, b) => b - a);
  const boards: Board[] = [];
  for (const w of allStrips) {
    const b = boards.find((x) => x.used + s.kerf + w <= usableW + 1e-6);
    if (b) { b.used += s.kerf + w; b.strips.push(w); }
    else boards.push({ strips: [w], used: w });
  }

  const bf = (w: number, l: number) => (s.nominalThickness * w * l) / 144;
  const netBF = groups.reduce((t, g) => t + bf(g.width, g.totalLength), 0);
  const roughBF = boards.length * bf(s.boardWidth, s.boardLength);
  const buyBF = roughBF * (1 + s.waste);
  return { groups, boards, tooLong, netBF, roughBF, buyBF, cost: buyBF * s.pricePerBF };
}

/** Solid wood tops, bench seats and beadboard caps: glued up or milled from thicker stock. */
export interface WoodPiece { label: string; length: number; width: number; thickness: number }

export function woodPieces(p: Project): WoodPiece[] {
  const out: WoodPiece[] = [];
  for (const c of p.cabinets) {
    for (const part of buildParts(c, p.settings, resolveEnds(p.room, p.cabinets, c))) {
      if (part.material === 'solidWood') out.push({ label: `${c.name} ${part.name.toLowerCase()}`, length: part.length, width: part.width, thickness: part.thickness });
    }
  }
  for (const w of p.panels ?? []) if (w.cap) out.push({ label: `${w.name} beadboard cap`, length: w.width, width: w.capDepth, thickness: w.capHeight });
  return out;
}

/** Rough stock thickness to buy for a finished thickness, in quarters: 1 1/4" finished comes from 6/4. */
export function roughQuarters(t: number): number {
  const q = [4, 5, 6, 8, 10, 12, 16];
  return q.find((x) => x / 4 >= t + 0.1875 - 1e-6) ?? 16;
}

export interface WoodGroup { quarters: number; pieces: WoodPiece[]; roughBF: number; buyBF: number }

export function woodNeeds(pieces: WoodPiece[], s: FaceFrameStock): WoodGroup[] {
  const qs = [...new Set(pieces.map((p) => roughQuarters(p.thickness)))].sort((a, b) => a - b);
  return qs.map((q) => {
    const mine = pieces.filter((p) => roughQuarters(p.thickness) === q);
    // 2" extra length and 1" extra width for each glue-up before it's trimmed to size
    const roughBF = mine.reduce((t, p) => t + ((p.length + 2) * (p.width + 1) * (q / 4)) / 144, 0);
    return { quarters: q, pieces: mine, roughBF, buyBF: roughBF * (1 + s.waste) };
  });
}
