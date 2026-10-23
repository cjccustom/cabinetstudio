// Nothing goes to Eagle or Woodworker Express until the deposit is in and the
// measurements the order depends on have been checked on site.
import type { Project, WallId } from './types';
import { extentsOf, wallLength } from './layout';

export interface ReleaseState {
  depositDate: string;
  depositAmount: number;
  /** Field measurements by check id. */
  measured: Record<string, number>;
  /** Checks that differ from the design but were looked at and left as drawn. */
  accepted: Record<string, boolean>;
}

export const emptyRelease: ReleaseState = { depositDate: '', depositAmount: 0, measured: {}, accepted: {} };
export const releaseOf = (p: Project): ReleaseState => ({ ...emptyRelease, ...p.release });

/** A measurement taken off the design that decides door, front and box sizes. */
export interface FieldCheck { id: string; label: string; design: number; hint: string }

const wallName: Record<WallId, string> = { back: 'Back wall', left: 'Left wall', right: 'Right wall', front: 'Front wall' };
/** Smallest gap between base cabinets treated as an appliance opening. */
const OPENING = 12;
/** Differences this small don't change an order. */
export const TOLERANCE = 0.125;

export function fieldChecks(p: Project): FieldCheck[] {
  const out: FieldCheck[] = [];
  const walls = (['back', 'left', 'right', 'front'] as WallId[]).filter((w) => p.cabinets.some((c) => c.wall === w) || (p.panels ?? []).some((x) => x.wall === w));
  for (const w of walls) {
    out.push({ id: `wall:${w}`, label: `${wallName[w]} length`, design: wallLength(p.room, w), hint: 'Corner to corner at counter height' });
  }
  if (p.cabinets.some((c) => c.elevation + c.height > 60)) {
    out.push({ id: 'ceiling', label: 'Ceiling height', design: p.room.height, hint: 'Lowest point over the wall and tall cabinets' });
  }
  // Doors and windows on a wall with cabinets: where they sit decides what fits beside them
  for (const o of p.openings ?? []) {
    if (!p.cabinets.some((c) => c.wall === o.wall)) continue;
    out.push({ id: `door:${o.id}:at`, label: `${wallName[o.wall]} corner to ${o.name}`, design: o.offset, hint: 'Left corner to the edge of the opening (jamb), not the casing' });
    out.push({ id: `door:${o.id}:w`, label: `${o.name} width`, design: o.width, hint: 'Jamb to jamb' });
    if (o.kind === 'window') out.push({ id: `door:${o.id}:sill`, label: `${o.name} sill height`, design: o.sill, hint: 'Floor to the top of the sill' });
  }
  // Appliance openings between base cabinets, wall ends included
  for (const w of walls) {
    const runs = p.cabinets
      .filter((c) => c.wall === w && c.elevation < 24)
      .map((c) => {
        const e = extentsOf(p.room, p.cabinets, c, p.settings);
        return { id: c.id, name: c.name, l: c.offset - e.left, r: c.offset + c.width + e.right };
      })
      .sort((a, b) => a.l - b.l);
    if (!runs.length) continue;
    const ends = [{ id: 'start', name: 'wall', l: 0, r: 0 }, ...runs, { id: 'end', name: 'wall', l: wallLength(p.room, w), r: 0 }];
    for (let i = 0; i < ends.length - 1; i++) {
      const a = ends[i], b = ends[i + 1];
      const gap = b.l - (i === 0 ? 0 : a.r);
      const atWall = a.name === 'wall' || b.name === 'wall';
      // Long bare wall at the end of a run is just open wall, not an appliance space
      if (gap < OPENING || (atWall && gap > 48)) continue;
      const between = a.name === 'wall' ? `wall and ${b.name}` : b.name === 'wall' ? `${a.name} and wall` : `${a.name} and ${b.name}`;
      out.push({ id: `open:${w}:${a.id}:${b.id}`, label: `Opening between ${between}`, design: Math.round(gap * 16) / 16, hint: `${wallName[w]}: range, dishwasher or fridge space` });
    }
  }
  return out;
}

export type CheckStatus = 'open' | 'ok' | 'off' | 'accepted';

export function checkStatus(c: FieldCheck, r: ReleaseState): CheckStatus {
  const m = r.measured[c.id];
  if (m == null) return 'open';
  if (Math.abs(m - c.design) <= TOLERANCE) return 'ok';
  return r.accepted[c.id] ? 'accepted' : 'off';
}

export interface ReleaseResult { ready: boolean; deposit: boolean; checks: (FieldCheck & { status: CheckStatus; measured?: number })[]; waiting: string[] }

export function releaseStatus(p: Project): ReleaseResult {
  const r = releaseOf(p);
  const checks = fieldChecks(p).map((c) => ({ ...c, status: checkStatus(c, r), measured: r.measured[c.id] }));
  const deposit = !!r.depositDate;
  const open = checks.filter((c) => c.status === 'open').length;
  const off = checks.filter((c) => c.status === 'off').length;
  const waiting = [
    ...(deposit ? [] : ['deposit']),
    ...(open ? [`${open} measurement${open > 1 ? 's' : ''} to take`] : []),
    ...(off ? [`${off} measurement${off > 1 ? 's' : ''} that don’t match the design`] : []),
  ];
  return { ready: !waiting.length, deposit, checks, waiting };
}
