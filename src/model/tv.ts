// TVs hung on the wall: above a base cabinet, between bookcases, over a mantel. Sized from the
// screen's diagonal (16:9) with a thin bezel, so a "70-inch" set is drawn about the size the
// customer will buy; a measured size from the maker's spec sheet can replace it.
import type { Project, WallId } from './types';
import { uid } from './defaults';

export interface WallTV {
  id: string;
  name: string;
  wall: WallId;
  /** Screen size as sold (diagonal, inches). */
  size: number;
  /** Center of the TV along the wall, from the wall's left end. */
  center: number;
  /** Bottom edge off the floor. */
  bottom: number;
  /** The maker's measured size without the stand, when known (replaces the estimate). */
  w?: number;
  h?: number;
  /** Depth off the wall, mount included. */
  depth: number;
}

/** Outside size of a TV from its screen diagonal: 16:9 screen plus the frame (a 70" set comes out about 62" × 35-5/8", like the big brands' spec sheets). */
export function tvSize(t: Pick<WallTV, 'size' | 'w' | 'h'>): { w: number; h: number } {
  const k = t.size / Math.hypot(16, 9);
  return { w: t.w ?? Math.round((16 * k + 1) * 8) / 8, h: t.h ?? Math.round((9 * k + 1.25) * 8) / 8 };
}

export const tvSizes = [43, 50, 55, 60, 65, 70, 75, 77, 83, 85, 98];

export const tvsOf = (p: Project): WallTV[] => p.tvs ?? [];

export function newTV(p: Project, wall: WallId, center: number, bottom: number): WallTV {
  let n = 1;
  while (tvsOf(p).some((t) => t.name === `TV${n}`)) n++;
  return { id: uid('tv'), name: `TV${n}`, wall, size: 70, center, bottom, depth: 2.5 };
}
