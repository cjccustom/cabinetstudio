// Start a design from photos of the existing room and the measurements taken on site: Claude
// reads them and drafts the room size, doors and windows and the existing trim, which Cody checks
// and corrects before applying it to the design.
import type { Floor, Opening, Project, WallId } from './types';
import { catalog, moldCategories, mountShape, type MoldKind, type Profile } from './moldings';
import { uid } from './defaults';
import { openingKinds } from './room';

export interface DraftOpening {
  kind: Opening['kind'];
  wall: WallId;
  name: string;
  /** From the wall's left end (standing in the room facing that wall) to the rough opening. */
  offset: number;
  width: number;
  height: number;
  sill: number;
  /** True when it came from a measurement, false when estimated from the photo. */
  measured: boolean;
  hinge?: 'left' | 'right';
}

export interface RoomDraft {
  room: { width: number; depth: number; height: number };
  /** Which of the room dimensions were measured rather than estimated. */
  measured: { width: boolean; depth: boolean; height: boolean };
  openings: DraftOpening[];
  trim: {
    crown: number | null;
    base: number | null;
    chairRail: number | null;
    chairHeight: number | null;
    casing: { style: 'flat' | 'profile'; width: number; backBand: boolean } | null;
  };
  floor: Floor['kind'] | null;
  floorColor: string | null;
  wallColor: string | null;
  trimColor: string | null;
  /** Assumptions and things to check on site. */
  notes: string[];
}

const walls: WallId[] = ['back', 'left', 'right', 'front'];

/** Instructions and answer format for Claude, sent with the photos. */
export function draftRequest(measurements: string, photoNames: string[]): string {
  return `You help a custom cabinet shop start a design from photos of a customer's existing room. Build a floor plan model of the room from the attached photos (${photoNames.length}: ${photoNames.map((n, i) => `${i + 1} "${n}"`).join(', ')}) and the shop owner's site measurements.

Conventions:
- The room is a rectangle. The BACK wall is the main wall the work goes on: the one the first photo faces most squarely. Standing in the room facing the back wall, the LEFT wall is on your left, the RIGHT wall on your right, the FRONT wall behind you.
- width = length of the back (and front) wall; depth = length of the left (and right) walls; height = floor to ceiling. All sizes in inches.
- Each door, window or cased opening: offset = distance from that wall's LEFT end, as seen standing in the room facing that wall, to the left edge of the opening (not the casing). width and height are the opening (sash or door) size, not counting casing. sill = floor to the bottom of the opening (0 for doors and cased openings).
- Use the measurements exactly where given. Estimate everything else from the photos, scaling from things of known size (interior doors are usually 80" tall, outlets 12-16" off the floor, countertops 36", standard windows, ceiling heights 96" or so), and mark it measured: false.
- Trim: heights in inches of the existing crown (its vertical drop on the wall), baseboard and chair rail (null if none), chair rail height off the floor, and the door/window casing: "flat" boards (New England style) or a "profile" moulding, its face width, and whether a back band wraps it.
- Colors as hex. Floor kind: hardwood, tile, vinyl, carpet or concrete (what is under any rug).
- notes: short items for the shop owner to check, e.g. "Right wall length estimated from the window; measure it." Include anything you could not see.

Site measurements and notes from the shop owner:
${measurements.trim() || '(none given: estimate everything from the photos)'}

Reply with only JSON in exactly this shape:
{"room":{"width":0,"depth":0,"height":0},"measured":{"width":false,"depth":false,"height":false},
"openings":[{"kind":"window","wall":"back","name":"Window 1","offset":0,"width":0,"height":0,"sill":0,"measured":false,"hinge":"left"}],
"trim":{"crown":0,"base":0,"chairRail":null,"chairHeight":null,"casing":{"style":"flat","width":3.5,"backBand":false}},
"floor":"hardwood","floorColor":"#000000","wallColor":"#000000","trimColor":"#ffffff","notes":[""]}
(hinge only for doors: the side the hinges are on, facing the door from inside the room.)`;
}

const num = (v: unknown, lo: number, hi: number, d: number) => {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n * 8) / 8)) : d;
};
const optNum = (v: unknown, lo: number, hi: number) => (v == null || v === 0 ? null : num(v, lo, hi, NaN) || null);
const hex = (v: unknown) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null);
const text = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');

/** Check and tidy Claude's answer: anything missing or out of range becomes a sensible default. */
export function cleanDraft(raw: unknown): RoomDraft {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  const room = { width: num(r.room?.width, 36, 1200, 144), depth: num(r.room?.depth, 36, 1200, 144), height: num(r.room?.height, 72, 240, 96) };
  const lenOf = (w: WallId) => (w === 'back' || w === 'front' ? room.width : room.depth);
  const openings: DraftOpening[] = (Array.isArray(r.openings) ? r.openings : []).slice(0, 24).flatMap((o: any, i: number) => {
    const kind: Opening['kind'] = o?.kind === 'door' || o?.kind === 'cased' ? o.kind : 'window';
    const wall: WallId = walls.includes(o?.wall) ? o.wall : 'back';
    const len = lenOf(wall);
    const width = num(o?.width, 6, len, kind === 'window' ? 36 : 32);
    const height = num(o?.height, 6, room.height, kind === 'window' ? 54 : 80);
    const sill = kind === 'window' ? num(o?.sill, 0, room.height - height, 32) : 0;
    const offset = num(o?.offset, 0, Math.max(0, len - width), Math.max(0, (len - width) / 2));
    return [{ kind, wall, name: text(o?.name, 40) || `${openingKinds[kind]} ${i + 1}`, offset, width, height, sill, measured: !!o?.measured, hinge: o?.hinge === 'right' ? 'right' : o?.hinge === 'left' ? 'left' : undefined }];
  });
  const c = r.trim?.casing;
  return {
    room,
    measured: { width: !!r.measured?.width, depth: !!r.measured?.depth, height: !!r.measured?.height },
    openings,
    trim: {
      crown: optNum(r.trim?.crown, 1, 12),
      base: optNum(r.trim?.base, 1, 12),
      chairRail: optNum(r.trim?.chairRail, 0.5, 6),
      chairHeight: optNum(r.trim?.chairHeight, 24, 48),
      casing: c && typeof c === 'object' ? { style: c.style === 'profile' ? 'profile' : 'flat', width: num(c.width, 1.5, 8, 3.5), backBand: !!c.backBand } : null,
    },
    floor: ['hardwood', 'tile', 'vinyl', 'carpet', 'concrete'].includes(r.floor) ? r.floor : null,
    floorColor: hex(r.floorColor),
    wallColor: hex(r.wallColor),
    trimColor: hex(r.trimColor),
    notes: (Array.isArray(r.notes) ? r.notes : []).map((n: unknown) => text(n)).filter(Boolean).slice(0, 12),
  };
}

/** The stock profile closest to a measured height, from either supplier. */
export function closestProfile(kind: MoldKind, height: number | null): Profile | undefined {
  if (!height) return undefined;
  const cats = moldCategories[kind];
  let best: Profile | undefined;
  let bestD = Infinity;
  for (const p of catalog) {
    if (!cats.includes(p.category)) continue;
    // Prefer the first category listed (true crowns over bands, casings over brick mould)
    const d = Math.abs(mountShape(p).height - height) + cats.indexOf(p.category) * 0.25;
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

/** Put the draft into the design: room size, openings, room trim, floor and colors. Cabinets stay. */
export function applyDraft(p: Project, d: RoomDraft, replaceOpenings: boolean): Project {
  const casing = d.trim.casing;
  const casingProfile = casing?.style === 'profile' ? closestProfile('casing', casing.width) : undefined;
  const backBand = casing?.style === 'flat' && casing.backBand ? closestProfile('backBand', 1.25) : undefined;
  const openings: Opening[] = d.openings.map((o) => ({
    id: uid('open'), name: o.name, kind: o.kind, wall: o.wall, offset: o.offset, width: o.width, height: o.height, sill: o.sill,
    trim: { casing: casingProfile?.num, flat: casing ? casing.width : 3.5, backBand: backBand?.num },
    ...(o.kind === 'door' ? { door: { hinge: o.hinge ?? 'left', leaves: o.width > 48 ? 2 : 1, prehung: true } as Opening['door'] } : {}),
  }));
  return {
    ...p,
    room: { ...p.room, ...d.room },
    openings: replaceOpenings ? openings : [...(p.openings ?? []), ...openings],
    roomTrim: {
      ...(p.roomTrim ?? { chairHeight: 34, walls: walls }),
      crown: closestProfile('roomCrown', d.trim.crown)?.num,
      base: closestProfile('roomBase', d.trim.base)?.num,
      chairRail: closestProfile('chairRail', d.trim.chairRail)?.num,
      chairHeight: d.trim.chairHeight ?? p.roomTrim?.chairHeight ?? 34,
    },
    floor: d.floor ? { ...(p.floor ?? { kind: 'hardwood', color: '#b98b5e', size: 3.25 }), kind: d.floor, ...(d.floorColor ? { color: d.floorColor } : {}) } : p.floor,
    finishes: { ...p.finishes, ...(d.wallColor ? { wall: d.wallColor } : {}), ...(d.trimColor ? { trim: d.trimColor } : {}) },
  };
}
