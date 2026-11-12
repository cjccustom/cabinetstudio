// Changes made by hand to a furniture piece after the builder lays it out: any part moved, resized,
// profiled on its edges, hidden, or added. The piece's parts are generated from its settings, then
// these are applied on top, so changing a setting later keeps the hand changes where they still fit.
//
// A part's edits are keyed by its name (every one of a set, like all four legs) or name#index (just one).
import type { EdgeCutKind } from './customParts';
import type { TableBox, TablePart, TableRole } from './tableParts';

/** Which of a box's edges a profile runs along, seen from above: x- left end, x+ right end, z- back, z+ front. */
export interface EdgeSides { xn: boolean; xp: boolean; zn: boolean; zp: boolean }
export interface ProfileCut { kind: EdgeCutKind; size: number; sides: EdgeSides }
/** Profiles on a part: around its top face, its bottom face, and down its vertical corners. */
export interface BoxProfile { top?: ProfileCut; bottom?: ProfileCut; corners?: { kind: 'roundover' | 'chamfer'; size: number } }

export interface PartEdit {
  /** Move, in inches: x left/right, y up/down, z back/front. */
  move?: [number, number, number];
  /** New size along x, y, z (unset keeps the generated size). */
  size?: [number | null, number | null, number | null];
  hidden?: boolean;
  profile?: BoxProfile;
  note?: string;
}

/** A part added by hand: a block, panel or round post, or a part drawn in the part builder. */
export interface AddedPart {
  id: string;
  name: string;
  kind: 'block' | 'round' | 'part';
  /** Size along x, y, z, and where its low corner sits (piece coordinates). */
  size: [number, number, number];
  at: [number, number, number];
  /** Part builder part: its id and a copy, standing upright, turned a quarter turn if asked. */
  part?: import('./customParts').CustomPart;
  turned?: boolean;
  hoursEach: number;
  profile?: BoxProfile;
  note?: string;
}

export interface PieceEdits { edits?: Record<string, PartEdit>; added?: AddedPart[] }

const ALL: EdgeSides = { xn: true, xp: true, zn: true, zp: true };
export const allSides = (): EdgeSides => ({ ...ALL });

/** The key for one box of a part, and for the whole set. */
export const boxKey = (part: { name: string }, j: number) => `${part.name}#${j}`;

/** Resize a box: x and z about its center; y from the floor if it stands on it, else from its top. */
function resize(b: TableBox, size: [number | null, number | null, number | null]): TableBox {
  const [sx, sy, sz] = b.size;
  const nx = size[0] ?? sx, ny = size[1] ?? sy, nz = size[2] ?? sz;
  const onFloor = b.min[1] < 0.01;
  return {
    ...b,
    min: [b.min[0] + (sx - nx) / 2, onFloor ? b.min[1] : b.min[1] + sy - ny, b.min[2] + (sz - nz) / 2],
    size: [nx, ny, nz],
  };
}

/** The part's finished length, width and thickness follow its boxes' new sizes, in the same order as before. */
function remeasure(part: TablePart, before: TableBox, after: TableBox): Pick<TablePart, 'length' | 'width' | 'thick'> {
  const dims = [part.length, part.width, part.thick];
  const axis = (v: number) => before.size.findIndex((s) => Math.abs(s - v) < 0.02);
  const used = new Set<number>();
  const pick = (v: number) => { let i = axis(v); if (used.has(i)) i = before.size.findIndex((s, k) => !used.has(k) && Math.abs(s - v) < 0.02); if (i < 0) return v; used.add(i); return after.size[i]; };
  const [length, width, thick] = dims.map(pick);
  return { length, width, thick };
}

/** The piece's parts with the hand changes applied, and the added parts after them. */
export function applyEdits(parts: TablePart[], pe: PieceEdits | undefined): TablePart[] {
  const edits = pe?.edits ?? {};
  const out: TablePart[] = [];
  for (const part of parts) {
    if (part.metal || !part.boxes.length) { out.push(part); continue; }
    const all = edits[part.name];
    const boxes: TableBox[] = [];
    let first: { before: TableBox; after: TableBox } | null = null;
    part.boxes.forEach((b, j) => {
      const one = edits[boxKey(part, j)];
      if (all?.hidden || one?.hidden) return;
      let nb: TableBox = { ...b };
      for (const e of [all, one]) {
        if (!e) continue;
        if (e.size) nb = resize(nb, e.size);
        if (e.move) nb = { ...nb, min: [nb.min[0] + e.move[0], nb.min[1] + e.move[1], nb.min[2] + e.move[2]] };
        if (e.profile) nb = { ...nb, profile: { ...nb.profile, ...e.profile } };
      }
      boxes.push(nb);
      if (!first) first = { before: b, after: nb };
    });
    if (!boxes.length) continue;
    const f = first as { before: TableBox; after: TableBox } | null;
    const note = [part.note, all?.note].filter(Boolean).join('; ');
    out.push({ ...part, ...(f ? remeasure(part, f.before, f.after) : {}), qty: part.qty === part.boxes.length ? boxes.length : part.qty, boxes, ...(note ? { note } : {}) });
  }
  for (const a of pe?.added ?? []) {
    const role: TableRole = a.kind === 'round' ? 'post' : 'cleat';
    const sorted = [...a.size].sort((x, y) => y - x);
    out.push({ role, name: a.name, qty: 1, length: sorted[0], width: sorted[1], thick: sorted[2], note: a.note ?? (a.kind === 'part' ? 'from the part builder' : 'added by hand'),
      boxes: [{ min: a.at, size: a.size, ...(a.profile ? { profile: a.profile } : {}) }], ...(a.kind === 'round' ? { turned: true } : {}), added: a });
  }
  return out;
}

/** The hours the hand changes add: each added part, and each part given a routed profile. */
export function editHours(pe: PieceEdits | undefined): { label: string; hours: number }[] {
  const out: { label: string; hours: number }[] = [];
  for (const a of pe?.added ?? []) if (a.hoursEach) out.push({ label: `${a.name} (added)`, hours: a.hoursEach });
  const profiled = Object.entries(pe?.edits ?? {}).filter(([, e]) => e.profile && (e.profile.top || e.profile.bottom || e.profile.corners)).length + (pe?.added ?? []).filter((a) => a.profile).length;
  if (profiled) out.push({ label: `Routed edge profiles (${profiled} part${profiled > 1 ? 's' : ''} or sets)`, hours: 0.35 * profiled });
  return out;
}
