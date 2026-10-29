// Face frame stock: total length needed at each finished width, and how many rough boards
// to buy when ripping and jointing strips out of wider stock.
import { cofferParts } from './coffer';
import type { Project } from './types';
import { amSizes, boardSize, defaultBoard } from './amLumber';
import { buildParts } from './parts';
import { resolveEnds } from './layout';
import { inScope, roomFlatStock } from './room';

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
  /** The surfaced board bought, by its exact size ("3/4 x 5-1/2", a 1x6), when it's bought by the lineal foot. */
  board?: string;
  /** $ per lineal foot of that board (A&M's price list); when set, the stock is priced by length, not board feet. */
  pricePerLF?: number;
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

export interface FFPiece { cabinet: string; name: string; width: number; length: number; species?: string }

/** Face frame stock pieces: the job's main species, or with `species`, the pieces called out in that one. */
export function faceFramePieces(p: Project, species?: string, opts: { ceiling?: boolean } = {}): FFPiece[] {
  const out: FFPiece[] = [];
  // Coffered ceiling stock comes off the same lists, unless asked for without it (the quote prices it on its own)
  if (opts.ceiling !== false) for (const part of cofferParts(p)) if ((part.species ?? undefined) === species) out.push({ cabinet: 'Ceiling', name: part.name, width: part.width, length: part.length, species });
  for (const c of p.cabinets) {
    for (const part of buildParts(c, p.settings, resolveEnds(p.room, p.cabinets, c))) {
      if (part.material !== 'faceframe' || !part.cut || (part.species ?? undefined) !== species) continue;
      out.push({ cabinet: c.name, name: part.name, width: part.width, length: part.length, species });
    }
  }
  // Flat casing boards around doors and windows come out of the same stock
  if (!species && inScope(p, 'roomTrim')) for (const f of roomFlatStock(p)) out.push({ cabinet: 'Room', name: f.label, width: f.width, length: f.length });
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
  /** Lineal feet of board to buy, waste included. */
  buyLF: number;
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
  const buyLF = (boards.length * s.boardLength * (1 + s.waste)) / 12;
  return { groups, boards, tooLong, netBF, roughBF, buyBF, buyLF, cost: s.pricePerLF ? buyLF * s.pricePerLF : buyBF * s.pricePerBF };
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
  for (const w of p.panels ?? []) if (w.cap && !w.capProfile) out.push({ label: `${w.name} beadboard cap`, length: w.width, width: w.capDepth, thickness: w.capHeight });
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

/**
 * The job's face frame stock, priced: when no price has been entered, A&M's list price for the
 * species in a 1x6 (3/4 x 5-1/2), by the lineal foot. `listed` says the price came from the list.
 */
export function ffStockOf(p: Project): FaceFrameStock & { listed?: boolean } {
  const ff = { ...defaultFaceFrameStock, ...p.faceFrame };
  if (ff.pricePerLF || ff.pricePerBF) return ff;
  const board = ff.board ?? defaultBoard;
  const lf = amSizes(ff.species.replace(/,.*$/, ''))?.[board];
  const size = boardSize(board);
  return lf ? { ...ff, board, pricePerLF: lf, ...(size && !ff.board ? { boardWidth: size.w } : {}), listed: true } : ff;
}

/** Other species called out on parts (poplar pilasters on a maple job), each with its own stock settings. */
export function otherSpecies(p: Project): string[] {
  const seen = new Set<string>();
  for (const c of p.cabinets) for (const part of buildParts(c, p.settings, resolveEnds(p.room, p.cabinets, c))) if (part.species && part.material === 'faceframe') seen.add(part.species);
  for (const part of cofferParts(p)) if (part.species) seen.add(part.species);
  return [...seen].sort();
}

/** The face frame stock settings with another species and its price. */
export function stockFor(p: Project, species: string): FaceFrameStock {
  const ff = { ...defaultFaceFrameStock, ...p.faceFrame };
  // A price per board foot entered for the species wins; otherwise A&M's price for the same board
  const lf = ff.board && !p.speciesPrices?.[species] ? amSizes(species)?.[ff.board] : undefined;
  return { ...ff, species: `${species}, 4/4`, pricePerBF: p.speciesPrices?.[species] ?? 0, pricePerLF: lf };
}
