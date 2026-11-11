// Lighting built into the cabinetry: low-voltage LED, chosen cabinet by cabinet.
// - Häfele Wireless Adjustable Shelf Lighting: a light bar under every adjustable shelf, powered
//   through bus bars in the case sides, so shelves move without wiring.
// - A fixed strip in the top of each open section or cubby (tape in a recessed profile).
// - Puck lights recessed in the underside of the part above each open section.
// - Vertical strips at each side of an open section, just behind the face frame stiles.
// - Under-cabinet strip at the front of a wall cabinet's bottom.
// - An accent uplight on top of the bookcases (ours, or the electrician's).
// Fixed strips can be built from generic tape and channel, or from Häfele Loox5 parts so the whole
// job runs on Loox5 drivers and one wireless Mesh control. From the choices come the parts to buy
// (with the specs to match when pricing them), drivers, labor, and a sheet for the electrician.
import type { Cabinet, Project, WallId } from './types';
import { buildParts, eff, layoutRows, openSpans } from './parts';
import { wallNames } from './layout';
import { fmt } from '../units';

export type CabLightKind = 'puck' | 'stile' | 'shelfFront' | 'under' | 'shelves' | 'topAccent';
export const cabLightLabel: Record<CabLightKind, string> = {
  puck: 'Puck lights in the top of each open section',
  stile: 'Vertical strips behind the face frame stiles',
  shelfFront: 'Strip in the top of each open section or cubby (in a channel)',
  under: 'Under-cabinet strip (front of the bottom)',
  shelves: 'Häfele adjustable shelf lighting (under every adjustable shelf)',
  topAccent: 'Accent uplight on top (dimmable, color optional)',
};

export type PartKey = 'tape' | 'channel' | 'puck' | 'driver30' | 'driver60' | 'driver96' | 'lead' | 'cable' | 'control'
  | 'hProfile' | 'hCustom' | 'hRail' | 'hConnector' | 'hDriver' | 'hBit'
  | 'lxTape' | 'lxProfile' | 'lxCap' | 'lxLead' | 'lxExt' | 'meshCtl' | 'meshWall' | 'meshBattery'
  | 'accentTape' | 'accentControl';
export type Control = 'wall' | 'door' | 'touch' | 'remote' | 'mesh';
export const controlLabel: Record<Control, string> = {
  wall: 'Wall dimmer (electrician), dimmable driver',
  door: 'Door-activated switch in the cabinet',
  touch: 'Touch / wave dimmer in the cabinet',
  remote: 'Wireless remote dimmer at the driver',
  mesh: 'Häfele Connect Mesh: wireless wall control, all lights in one group',
};

export interface LightingJob {
  kelvin: 2700 | 3000 | 3500 | 4000;
  control: Control;
  /** Where the drivers go, in words for the electrician. */
  driverAt: string;
  /** How the low-voltage leads get from the lights to the drivers: behind the cabinets, or in a dado routed inside the case. */
  wireRoute?: WireRoute;
  /** Generic LED tape draw, watts per foot, and each puck's watts: from the product picked. */
  wattsPerFt: number;
  puckWatts: number;
  /** Your prices, each (tape, channel and cable per foot). */
  prices: Partial<Record<PartKey, number>>;
  /** Where the drivers sit: in the base cabinets below, or on top of the bookcases (behind the crown). */
  driverSpot?: 'below' | 'top';
  /** Häfele adjustable shelf lighting: the machining and the system's article numbers. */
  hafele?: Partial<HafeleSpec>;
  /** Accent uplight on top of the bookcases: plain white, tunable white, color (RGBW), or the electrician's (drawn, not priced). */
  accent?: 'white' | 'tunable' | 'rgbw' | 'others';
  accentHex?: string;
  /** Fixed strips (section tops, cubbies, stiles, under-cabinet) from generic tape and channel, or Häfele Loox5 parts. Defaults to Loox5 when the job has Häfele shelf lighting. */
  fixed?: 'generic' | 'loox';
  /** A working allowance for the lighting materials until supplier quotes are in: used in place of the parts total, not on top of it. */
  allowance?: number;
  /** The shop already has the bus bar router bit. */
  ownBit?: boolean;
  /** Lighting offered as an option on the proposal, by kind: shelf lighting, the accent on top... (unset = in the base price). */
  options?: Partial<Record<CabLightKind, string>>;
}

/**
 * Häfele Wireless Adjustable Shelf Lighting System (tech doc 2/23), as Cody builds it:
 * - A light bar (Profile 1103) routed into the underside of every adjustable shelf, hidden behind
 *   a solid wood edge that drops below the shelf. Spring-loaded contacts in each end of the bar
 *   touch the bus bars, so the bar fits the shelf's length: stock 18", 24", 30", 36" (size the case
 *   to a stock bar), or custom lengths from Häfele Service+ (about 10 days).
 * - Brushed aluminum bus bars, 92", in narrow vertical channels in the case sides, two per lit
 *   bay; two can go back to back in a divider. Router bit 001.25.921 (1/4" shank).
 * - A power connection kit at the top or bottom of each bay to the Loox driver.
 * 24 V (LED 3045, matching Loox5 24 V tape and drivers) or 12 V (LED 2065 / 2068). Groove sizes
 * read off Häfele's drawing: confirm against the parts before cutting.
 */
export interface HafeleSpec {
  volts: 12 | 24;
  profileW: number; profileD: number; profileBack: number;
  railW: number; railD: number; railBack: number;
  /** How far the solid wood edge drops below the shelf, to hide the bar. */
  drop: number;
  /** 12 V only: LED 2065 medium (4.8 W/m) or LED 2068 high (9.6 W/m). 24 V is LED 3045, 9.6 W/m. */
  intensity: 'medium' | 'high';
  /** Article numbers when they differ from the usual ones for the voltage (blank = the usual). */
  profileNo: string; railNo: string; connectorNo: string; driverNo: string;
}
export const defaultHafele: HafeleSpec = { volts: 24, profileW: 0.5625, profileD: 0.5, profileBack: 0.25, railW: 0.25, railD: 0.1875, railBack: 1, drop: 0.75, intensity: 'medium', profileNo: '', railNo: '', connectorNo: '', driverNo: '' };
/** Häfele's stock light bar lengths. */
export const HAFELE_BARS = [18, 24, 30, 36] as const;
/** Stock bar article numbers, where known, by voltage, LED, color and length. */
const barNo: Record<string, Partial<Record<number, string>>> = {
  '12-medium-3000': { 18: '833.88.978', 24: '833.88.979', 30: '833.88.980', 36: '833.88.981' },
  '12-medium-4000': { 18: '833.88.982', 24: '833.88.983', 30: '833.88.984', 36: '833.88.985' },
  '12-high-3000': { 18: '833.88.970', 24: '833.88.971', 30: '833.88.972', 36: '833.88.973' },
  '12-high-4000': { 18: '833.88.974', 24: '833.88.975', 30: '833.88.976', 36: '833.88.977' },
  '24-3000': { 30: '833.86.978' },
};
/** The system's usual article numbers for the voltage. */
export const hafeleNos = (H: HafeleSpec) => ({
  rail: H.railNo || (H.volts === 24 ? '833.74.620' : '833.74.996'),
  kit: H.connectorNo || (H.volts === 24 ? '833.86.149' : '833.88.986'),
  driver: H.driverNo || (H.volts === 24 ? '833.95.011' : ''),
  led: H.volts === 24 ? 'LED 3045' : H.intensity === 'high' ? 'LED 2068' : 'LED 2065',
});
/** The stock bar a shelf takes, if its length is one (within 1/16"). */
export const hafeleStandard = (len: number) => HAFELE_BARS.find((b) => Math.abs(b - len) <= 0.0625);
export const hafeleWattsPerIn = (H: HafeleSpec) => (H.volts === 24 || H.intensity === 'high' ? 9.6 : 4.8) / 39.37;
export const hafeleOf = (p: Project): HafeleSpec => ({ ...defaultHafele, ...p.cabLighting?.hafele, ...p.settings.hafele });
/** Loox5 24 V tape (LED 3045), watts per inch. */
const LOOX_W_PER_IN = 9.6 / 39.37;
export const accentLabel = { white: 'White, dimmable', tunable: 'Tunable white (warm to cool), dimmable', rgbw: 'Color (RGBW) with white, dimmable', others: 'By the electrician (shown on the drawings, not in our price)' } as const;
export type WireRoute = 'dado' | 'behind';
export const wireRouteLabel: Record<WireRoute, string> = {
  dado: 'In a dado routed inside the case (back or side), to the driver',
  behind: 'Behind the cabinets, in the space between the case back and the wall',
};
export const defaultLightingJob: LightingJob = { kelvin: 3000, control: 'wall', driverAt: 'In the base cabinet below, behind a removable back panel', wireRoute: 'dado', wattsPerFt: 3, puckWatts: 2, prices: {} };
export const lightingJobOf = (p: Project): LightingJob => {
  const j = { ...defaultLightingJob, ...p.cabLighting, prices: { ...p.cabLighting?.prices } };
  // Drivers on top of the bookcases unless the location was written out by hand
  if (j.driverSpot === 'top' && !p.cabLighting?.driverAt) j.driverAt = 'On top of the bookcases, behind the crown, with access and ventilation';
  if (!j.fixed) j.fixed = p.cabinets.some((c) => c.lighting?.includes('shelves')) ? 'loox' : 'generic';
  return j;
};

export interface Fixture {
  cab: Cabinet; kind: CabLightKind; count: number;
  /** Strip length each, inches (0 for pucks). */
  length: number;
  /** Häfele shelves: each bar's length (the shelves', which can differ by bay). */
  lengths?: number[];
  watts: number; leads: number; where: string;
  /** Häfele shelves: the open section's height, for the bus bars down each side, and its bays across. */
  span?: number; bays?: number;
  /** Which system powers it: Häfele/Loox5 (its own drivers) or generic 24 V tape. */
  system: 'loox' | 'loox12' | 'generic';
  /** The electrician's (accent by others): drawn and noted, not priced. */
  byOthers?: boolean;
}

/** The light fixtures a cabinet gets from its choices. */
export function cabinetFixtures(c: Cabinet, p: Project, job = lightingJobOf(p)): Fixture[] {
  const kinds = c.lighting ?? [];
  if (!kinds.length) return [];
  const s = eff(c, p.settings);
  const inner = Math.max(6, c.width - 2 * s.stileWidth);
  const spans = openSpans(c, s);
  const H = hafeleOf(p);
  const loox = job.fixed === 'loox';
  const fixedSys = loox ? 'loox' as const : 'generic' as const;
  const wpi = (sys: Fixture['system']) => (sys === 'generic' ? job.wattsPerFt / 12 : LOOX_W_PER_IN);
  const out: Fixture[] = [];
  const baysIn = (o: { y0: number; y1: number }) => 1 + Math.max(0, ...c.rows.filter((_, ri) => openRowAt(c, s, ri, o)).map((r) => (r.type === 'open' ? r.dividers ?? 0 : 0)));
  for (const k of kinds) {
    if (k === 'under') {
      if (c.kind !== 'wall') continue;
      const L = inner - 1;
      out.push({ cab: c, kind: k, count: 1, length: L, watts: L * wpi(fixedSys), leads: 1, system: fixedSys, where: 'Under the bottom, behind the bottom rail' });
      continue;
    }
    if (k === 'topAccent') {
      // A strip set back on top of the case, shining up the wall: only where there's room above it
      const room = p.room.height - (c.elevation + c.height);
      if (room < 6) continue;
      const L = Math.max(6, c.width - 2);
      const others = job.accent === 'others';
      out.push({ cab: c, kind: k, count: 1, length: L, watts: others ? 0 : (L / 12) * job.wattsPerFt, leads: others ? 0 : 1, system: 'generic', byOthers: others || undefined, where: `On top of the case, set back behind the crown, shining up the wall (${Math.round(room)}" to the ceiling)${others ? '; by the electrician' : ''}` });
      continue;
    }
    if (k === 'shelves') {
      // A bar under each adjustable shelf in the open sections, as long as the shelf, from the cut list
      const lit = buildParts(c, p.settings).filter((x) => x.name === 'Adjustable shelf' && /Häfele/.test(x.note ?? ''));
      spans.forEach((o, i) => {
        const here = lit.filter((x) => x.boxes.some((b) => b.min[1] > o.y0 - 0.5 && b.min[1] < o.y1));
        if (!here.length) return;
        const bays = baysIn(o);
        const lengths = here.map((x) => x.length);
        const which = spans.length > 1 ? `open section ${i + 1} (from the bottom)` : 'open section';
        out.push({ cab: c, kind: k, count: here.length, length: Math.max(...lengths), lengths, watts: lengths.reduce((t, l) => t + l, 0) * hafeleWattsPerIn(H), leads: bays, span: o.y1 - o.y0, bays, system: H.volts === 24 ? 'loox' : 'loox12',
          where: `Under the front of each adjustable shelf in the ${which}, in a groove behind the drop edge; bus bars in channels down each side${bays > 1 ? ' of every cubby' : ''}, a power kit at the top` });
      });
      continue;
    }
    spans.forEach((o, i) => {
      const h = o.y1 - o.y0;
      const which = spans.length > 1 ? `open section ${i + 1} (from the bottom)` : 'open section';
      if (k === 'puck') {
        // One 3" puck lights an upper's section (All Star Electric); one per 48" on a very wide one
        const n = Math.max(1, Math.ceil(inner / 48));
        out.push({ cab: c, kind: k, count: n, length: 0, watts: n * job.puckWatts, leads: 1, system: 'generic', where: `Recessed in the underside of the top of the ${which}, evenly spaced` });
      } else if (k === 'stile') {
        const L = Math.max(6, h - 1);
        out.push({ cab: c, kind: k, count: 2, length: L, watts: 2 * L * wpi(fixedSys), leads: 2, system: fixedSys, where: `Both sides of the ${which}, in channel let into the case side just behind the stile, facing in` });
      } else if (k === 'shelfFront') {
        // One strip per cubby when the section has vertical dividers
        const bays = baysIn(o);
        const L = Math.max(6, (inner - (bays - 1) * 0.75) / bays - 1);
        out.push({ cab: c, kind: k, count: bays, length: L, watts: bays * L * wpi(fixedSys), leads: bays, system: fixedSys, where: `${loox ? 'Loox5 tape in a recessed 1103 profile with opal diffuser' : 'In a channel'} routed into the underside of the top of ${bays > 1 ? `each of the ${bays} cubbies in the ${which}` : `the ${which}`}, just behind the rail, facing down` });
      }
    });
  }
  return out;
}

/** Whether face frame row ri is the open section spanning o. */
function openRowAt(c: Cabinet, s: ReturnType<typeof eff>, ri: number, o: { y0: number; y1: number }): boolean {
  const L = layoutRows(c, s).rows[ri];
  return !!L && Math.abs(L.y0 - o.y0) < 0.01 && Math.abs(L.y1 - o.y1) < 0.01;
}

/** For the cabinet editor: each lit section's shelf length, the stock bar nearest under it, and the cabinet width that fits that bar exactly. */
export function hafeleFit(c: Cabinet, p: Project): { length: number; bar?: number; stock: boolean; widthFor?: number }[] {
  const f = cabinetFixtures(c, p).filter((x) => x.kind === 'shelves');
  const seen = new Set<string>();
  return f.flatMap((x) => {
    const L = x.length, bays = x.bays ?? 1;
    const key = fmt(L);
    if (seen.has(key)) return [];
    seen.add(key);
    const bar = [...HAFELE_BARS].reverse().find((b) => b <= L + 0.0625);
    const stock = !!hafeleStandard(L);
    return [{ length: L, bar, stock, widthFor: bar && !stock ? Math.round((c.width - (L - bar) * bays) * 16) / 16 : undefined }];
  });
}

export const DRIVERS = [30, 60, 96] as const;
export interface Driver { wall: WallId; watts: number; size: number; serves: string[]; volts: 12 | 24; system: Fixture['system']; /** Loox5 with Mesh: outputs used on its controller. */ outputs?: number }

/** Outputs a fixture takes on a Mesh controller: one per bus bar kit (each bay), one per fixed light. */
const outputsOf = (f: Fixture) => (f.kind === 'shelves' ? f.bays ?? 1 : f.count);

/**
 * Drivers by wall and system, each with 20% headroom. Generic and 12 V Häfele: 30/60/96 W, split
 * when a wall runs over. Loox5 24 V: 90 W drivers, at least one per Mesh controller (six outputs each).
 */
export function lightingDrivers(fx: Fixture[], job?: LightingJob): Driver[] {
  const out: Driver[] = [];
  const groups = new Map<string, Fixture[]>();
  for (const f of fx) { if (f.byOthers) continue; const key = `${f.cab.wall}|${f.system}`; groups.set(key, [...(groups.get(key) ?? []), f]); }
  for (const [key, list] of groups) {
    const [wallS, sys] = key.split('|') as [WallId, Fixture['system']];
    const wall = wallS as WallId;
    if (sys === 'loox') {
      const load = list.reduce((t, f) => t + f.watts, 0);
      const outs = list.reduce((t, f) => t + outputsOf(f), 0);
      const n = Math.max(1, Math.ceil((load * 1.2) / 90), job?.control === 'mesh' ? Math.ceil(outs / 6) : 1);
      // Spread across the drivers in order (left to right), keeping each cabinet's fixtures together
      const per = Math.ceil(outs / n);
      let cur: Fixture[] = [], o = 0, w = 0;
      const flush = () => { if (cur.length) out.push({ wall, watts: w, size: 90, serves: [...new Set(cur.map((f) => f.cab.name))], volts: 24, system: 'loox', outputs: o }); cur = []; o = 0; w = 0; };
      for (const f of [...list].sort((a, b) => a.cab.offset - b.cab.offset)) {
        const fo = outputsOf(f);
        if (o > 0 && o + fo > per && out.filter((d) => d.wall === wall && d.system === 'loox').length < n - 1) flush();
        cur.push(f); o += fo; w += f.watts;
      }
      flush();
      continue;
    }
    let cur: Fixture[] = [], w = 0;
    const flush = () => {
      if (!cur.length) return;
      const need = w * 1.2;
      out.push({ wall, watts: w, size: DRIVERS.find((d) => d >= need) ?? 96, serves: [...new Set(cur.map((f) => f.cab.name))], volts: sys === 'loox12' ? 12 : 24, system: sys });
      cur = []; w = 0;
    };
    for (const f of list) {
      if ((w + f.watts) * 1.2 > 96) flush();
      cur.push(f); w += f.watts;
    }
    flush();
  }
  return out;
}

export interface LightingPart { key: PartKey; label: string; spec: string; qty: number; unit: 'ft' | 'ea'; search: string; /** A tool for the shop, priced apart from the installed materials. */ tooling?: boolean }
const google = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;

/** Pieces cut from stock lengths, first fit, longest first. */
function sticks(pieces: number[], stock: number, kerf = 0.25): number {
  const left: number[] = [];
  for (const p of [...pieces].sort((a, b) => b - a)) {
    const i = left.findIndex((r) => r >= p + kerf);
    if (i >= 0) left[i] -= p + kerf; else left.push(stock - p - kerf);
  }
  return left.length;
}

/** What to buy, with the spec to match. Generic tape lengths include 10% for cutting to the cut marks. */
export function lightingParts(p: Project): { parts: LightingPart[]; fixtures: Fixture[]; drivers: Driver[]; watts: number } {
  const job = lightingJobOf(p);
  const fixtures = p.cabinets.flatMap((c) => cabinetFixtures(c, p, job));
  const ours = fixtures.filter((f) => !f.byOthers);
  const drivers = lightingDrivers(ours, job);
  const k = job.kelvin;
  const parts: LightingPart[] = [];
  // Generic 24 V tape in channel
  const strips = ours.filter((f) => f.length > 0 && f.system === 'generic' && !(f.kind === 'topAccent' && (job.accent ?? 'white') !== 'white'));
  const stripFt = strips.reduce((t, f) => t + (f.count * f.length) / 12, 0);
  if (stripFt) {
    parts.push({ key: 'tape', label: 'LED tape', spec: `24 V DC, ${k}K, CRI 90+, about ${job.wattsPerFt} W/ft, high-density (no dots) for use in diffused channel; 8–10 mm wide`, qty: Math.ceil(stripFt * 1.1), unit: 'ft', search: google(`24V LED tape ${k}K CRI 95 cabinet high density`) });
    parts.push({ key: 'channel', label: 'Aluminum channel with frosted diffuser', spec: 'Recessed (flanged) profile for 8–10 mm tape, end caps; note the routing width and depth', qty: Math.ceil(stripFt * 1.1), unit: 'ft', search: google('recessed aluminum LED channel flange frosted diffuser cabinet') });
  }
  // Häfele shelf bars, bus bars and power kits
  const hf = ours.filter((f) => f.kind === 'shelves');
  const H = hafeleOf(p), nos = hafeleNos(H);
  if (hf.length) {
    const kk = (k >= 3500 ? 4000 : 3000) as 3000 | 4000;
    const table = barNo[H.volts === 24 ? `24-${kk}` : `12-${H.intensity}-${kk}`] ?? {};
    const std = new Map<number, number>(), custom = new Map<string, number>();
    for (const f of hf) for (const L of f.lengths ?? Array(f.count).fill(f.length)) {
      const b = hafeleStandard(L);
      if (b) std.set(b, (std.get(b) ?? 0) + 1); else custom.set(fmt(L), (custom.get(fmt(L)) ?? 0) + 1);
    }
    const fam = `${H.volts} V ${nos.led}${H.volts === 12 ? (H.intensity === 'high' ? ' high (9.6 W/m)' : ' medium (4.8 W/m)') : ' (9.6 W/m)'}`;
    const color = `${kk}K${k !== kk ? ` (Häfele's nearest to ${k}K)` : ''}`;
    const nStd = [...std.values()].reduce((a, b) => a + b, 0), nCus = [...custom.values()].reduce((a, b) => a + b, 0);
    if (nStd) parts.push({ key: 'hProfile', label: 'Häfele adjustable shelf light bars, stock length', spec: `${H.profileNo || 'Profile 1103'}, ${fam}, ${color}, spring contacts: ${[...std].map(([b, n]) => `${n} × ${b}"${table[b] ? ` (${table[b]})` : ''}`).join(', ')}`, qty: nStd, unit: 'ea', search: google(`Hafele ${[...std].map(([b]) => table[b]).find(Boolean) ?? 'adjustable shelf light bar'} ${H.volts}V`) });
    if (nCus) parts.push({ key: 'hCustom', label: 'Häfele adjustable shelf light bars, custom length', spec: `${H.profileNo || 'Profile 1103'}, ${fam}, ${color}, made to length by Häfele Service+ (888.437.7477, projects@hafele.us; about 10 days): ${[...custom].map(([l, n]) => `${n} × ${l}`).join(', ')}. Or size the cases to a stock bar (cabinet editor).`, qty: nCus, unit: 'ea', search: google('Hafele wireless adjustable shelf lighting custom length light bar') });
    // Two bus bars per bay (one each side), 92" long and cut to the section's height
    const bars = hf.reduce((t, f) => t + (f.bays ?? 1) * 2 * Math.ceil((f.span ?? 0) / 92), 0);
    parts.push({ key: 'hRail', label: 'Häfele bus bars, 92"', spec: `${nos.rail}: brushed aluminum, 2 per lit bay, cut to height, in ${fmt(H.railW)} × ${fmt(H.railD)} channels; price per bar (confirm the pack size)`, qty: bars, unit: 'ea', search: google(`Hafele ${nos.rail} bus bar`) });
    parts.push({ key: 'hConnector', label: `Häfele ${H.volts} V shelf power connection kits`, spec: `${nos.kit}: one per lit bay, at its top${H.volts === 24 ? '; not the 12 V kit 833.88.986' : ''}`, qty: hf.reduce((t, f) => t + (f.bays ?? 1), 0), unit: 'ea', search: google(`Hafele ${nos.kit}`) });
    if (!job.ownBit) parts.push({ key: 'hBit', label: 'Bus bar router bit (tooling)', spec: '001.25.921, 1/4" shank; only if the shop doesn\'t have one', qty: 1, unit: 'ea', search: google('Hafele 001.25.921 router bit'), tooling: true });
  }
  // Loox5 fixed lights: 24 V tape in recessed 1103 profiles with opal diffusers, plugged in with leads
  const lx = ours.filter((f) => f.system === 'loox' && f.kind !== 'shelves' && f.length > 0);
  if (lx.length) {
    const pieces = lx.flatMap((f) => Array(f.count).fill(f.length) as number[]);
    const m = pieces.reduce((t, l) => t + l, 0) * 0.0254;
    parts.push({ key: 'lxTape', label: 'Häfele Loox5 LED tape, 5 m rolls', spec: `24 V LED 3045, ${k <= 3000 ? '3000K' : `${k}K`}, 9.6 W/m${k <= 3000 ? ' (833.76.335)' : ''}; ${m.toFixed(1)} m for ${pieces.length} fixed lights (${pieces.map((l) => fmt(l)).join(', ')}); cut only at the marks`, qty: Math.ceil((m * 1.05) / 5), unit: 'ea', search: google('Hafele 833.76.335 LED 3045 tape') });
    parts.push({ key: 'lxProfile', label: 'Häfele 1103 recessed profiles with opal diffuser, 92"', spec: '833.94.200, silver; cut to each light', qty: sticks(pieces, 92), unit: 'ea', search: google('Hafele 833.94.200 profile 1103') });
    parts.push({ key: 'lxCap', label: 'Häfele 1103 end caps', spec: '833.95.766; 2 per light (packs of 10 if not sold singly)', qty: 2 * pieces.length, unit: 'ea', search: google('Hafele 833.95.766 end cap') });
    parts.push({ key: 'lxLead', label: 'Häfele 2 m plug-to-tape leads', spec: '833.95.706, 24 V, for 8 mm monochrome tape; one per fixed light', qty: pieces.length, unit: 'ea', search: google('Hafele 833.95.706 lead') });
  }
  const looxDrivers = drivers.filter((d) => d.system === 'loox');
  if (looxDrivers.length) {
    parts.push({ key: 'hDriver', label: 'Häfele Loox5 24 V / 90 W drivers', spec: `${nos.driver || '833.95.011'}; ${looxDrivers.map((d) => `${Math.round(d.watts)} W load`).join(', ')}; ask for US mains cords with them`, qty: looxDrivers.length, unit: 'ea', search: google('Hafele 833.95.011 Loox5 driver 90W') });
    parts.push({ key: 'lxExt', label: 'Häfele 2 m extension leads (allowance)', spec: '833.95.717, 24 V; check the count after routing', qty: 2, unit: 'ea', search: google('Hafele 833.95.717') });
  }
  const d12 = drivers.filter((d) => d.system === 'loox12');
  if (d12.length) parts.push({ key: 'hDriver', label: 'Häfele Loox 12 V drivers', spec: `${nos.driver ? `${nos.driver}: ` : ''}12 V constant-voltage Loox driver: ${d12.map((d) => `${d.size} W`).join(', ')}`, qty: d12.length, unit: 'ea', search: google('Hafele Loox5 12V driver') });
  if (job.control === 'mesh' && drivers.length) {
    parts.push({ key: 'meshCtl', label: 'Häfele Connect Mesh six-output controllers', spec: `850.00.043, 24 V; one at each driver (${looxDrivers.map((d) => `${d.outputs ?? 0} outputs used`).join(', ') || 'one per driver'})`, qty: Math.max(1, looxDrivers.length || drivers.length), unit: 'ea', search: google('Hafele 850.00.043 Connect Mesh') });
    parts.push({ key: 'meshWall', label: 'Häfele four-button wireless wall control', spec: '850.00.041; programmed for one group (all the cabinet lights)', qty: 1, unit: 'ea', search: google('Hafele 850.00.041') });
    parts.push({ key: 'meshBattery', label: 'CR2430 battery for the wall control', spec: '002.99.034, if not supplied', qty: 1, unit: 'ea', search: google('CR2430 battery') });
  }
  // Generic: accent tape and controller, pucks, drivers, leads and cable
  const acc = ours.filter((f) => f.kind === 'topAccent');
  if (acc.length && (job.accent ?? 'white') !== 'white') {
    const ft = acc.reduce((t, f) => t + f.length / 12, 0);
    parts.push({ key: 'accentTape', label: job.accent === 'rgbw' ? 'RGBW LED tape (accent)' : 'Tunable white LED tape (accent)', spec: `24 V DC, ${job.accent === 'rgbw' ? 'RGB + white' : '2700–6500K'}, for the uplight on top`, qty: Math.ceil(ft * 1.1), unit: 'ft', search: google(`24V ${job.accent === 'rgbw' ? 'RGBW' : 'tunable white'} LED tape`) });
    parts.push({ key: 'accentControl', label: job.accent === 'rgbw' ? 'RGBW controller and remote' : 'Tunable white controller and remote', spec: '24 V DC, rated for the accent run; app or remote dimming', qty: 1, unit: 'ea', search: google(`24V ${job.accent === 'rgbw' ? 'RGBW' : 'CCT'} LED controller remote`) });
  }
  const pucks = ours.filter((f) => f.kind === 'puck').reduce((t, f) => t + f.count, 0);
  if (pucks) parts.push({ key: 'puck', label: 'Recessed LED puck lights', spec: `3" recessed, 24 V DC, ${k}K, CRI 90+, about ${job.puckWatts} W each; note the cutout diameter and depth (must fit the part thickness)`, qty: pucks, unit: 'ea', search: google(`24V recessed LED puck light ${k}K CRI 90 cabinet`) });
  for (const size of DRIVERS) {
    const n = drivers.filter((d) => d.size === size && d.system === 'generic').length;
    if (n) parts.push({ key: `driver${size}` as PartKey, label: `Driver, ${size} W`, spec: `24 V DC constant-voltage, Class 2${job.control === 'wall' ? ', dimmable with a wall dimmer (ELV/MLV or TRIAC: match the dimmer the electrician installs)' : ''}; plug-in or hard-wired to suit the outlet`, qty: n, unit: 'ea', search: google(`24V ${size}W dimmable LED driver class 2 cabinet lighting`) });
  }
  const gen = ours.filter((f) => f.system === 'generic');
  const leads = gen.reduce((t, f) => t + f.leads, 0);
  // Low-voltage cable: each lead runs about half the cabinet's height plus 3' to its driver
  const cableFt = gen.reduce((t, f) => t + f.leads * (f.cab.height / 2 + 36) / 12, 0);
  if (leads) parts.push({ key: 'lead', label: 'Leads, connectors and distribution block', spec: 'Quick-connect leads to each fixture and a 6- or 10-port block at each driver', qty: leads, unit: 'ea', search: google('24V LED lighting distribution block quick connect lead cabinet') });
  if (cableFt) parts.push({ key: 'cable', label: 'Low-voltage cable, 18/2', spec: 'CL2 or CL3 rated where it runs in a wall', qty: Math.ceil(cableFt), unit: 'ft', search: google('18/2 CL2 LED low voltage wire') });
  if (gen.length && job.control !== 'wall' && job.control !== 'mesh') parts.push({ key: 'control', label: controlLabel[job.control], spec: '24 V DC, rated for the driver’s load', qty: drivers.filter((d) => d.system === 'generic').length, unit: 'ea', search: google(`24V LED ${job.control === 'door' ? 'cabinet door switch' : job.control === 'touch' ? 'touch dimmer cabinet' : 'wireless remote dimmer'}`) });
  return { parts, fixtures, drivers, watts: ours.reduce((t, f) => t + f.watts, 0) };
}

/** The lighting materials at cost: the parts priced, or the working allowance in their place. Tooling apart. */
export function lightingCost(p: Project): { cost: number; parts: number; tooling: number; missing: string[]; allowance?: number } {
  const job = lightingJobOf(p);
  const { parts } = lightingParts(p);
  const each = (x: LightingPart) => x.qty * (job.prices[x.key] ?? 0);
  const mat = parts.filter((x) => !x.tooling), tools = parts.filter((x) => x.tooling);
  const priced = mat.reduce((t, x) => t + each(x), 0);
  const tooling = tools.reduce((t, x) => t + each(x), 0);
  if (job.allowance != null && job.allowance > 0) return { cost: job.allowance, parts: priced, tooling, missing: [], allowance: job.allowance };
  return { cost: priced, parts: priced, tooling, missing: mat.filter((x) => job.prices[x.key] == null).map((x) => x.label) };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** The electrician's sheet, as HTML for a drawing sheet or a page of its own. */
export function electricianHtml(p: Project): string {
  const job = lightingJobOf(p);
  const { fixtures, drivers, watts } = lightingParts(p);
  if (!fixtures.length) return '';
  const others = fixtures.filter((f) => f.byOthers);
  const ours = fixtures.filter((f) => !f.byOthers);
  const rows = drivers.map((d, i) => `<tr><td>D${i + 1}</td><td>${esc(wallNames[d.wall])}</td><td>${d.volts} V, ${d.size} W (${Math.round(d.watts)} W load)</td><td>${esc(d.serves.join(', '))}</td><td>${esc(job.driverAt)}</td></tr>`).join('');
  const fx = fixtures.map((f) => `<tr><td>${esc(f.cab.name)}</td><td>${esc(cabLightLabel[f.kind])}${f.byOthers ? ' (by the electrician)' : ''}</td><td>${f.length ? `${f.count} × ${fmt(f.length)}` : `${f.count} pucks`}</td><td>${f.byOthers ? '—' : `${Math.round(f.watts)} W`}</td><td>${esc(f.where)}</td></tr>`).join('');
  const volts = [...new Set(drivers.map((d) => d.volts))].sort().map((v) => `${v} V`).join(' and ');
  const mesh = job.control === 'mesh';
  return `<h2>Cabinet lighting: for the electrician</h2>
<p>Low-voltage LED, ${volts || '24 V'} DC, ${job.kelvin}K. Total about ${Math.round(watts)} W of fixtures on ${drivers.length} driver${drivers.length === 1 ? '' : 's'}.</p>
<h3>What the electrician provides</h3><ul>
<li>A 120 V receptacle at each driver location (below): ${esc(job.driverAt)}. Confirm the exact spot with CJC before the cabinets go in. Line-voltage wiring and receptacles are not in CJC's price.</li>
${mesh ? '<li>No wall dimmer for the cabinet lights: they are switched and dimmed from a wireless Häfele wall control (CJC supplies and programs it). Constant power to the drivers.</li>' : job.control === 'wall' ? '<li>A wall dimmer for each driver run, matched to the driver type CJC orders (ELV/MLV or TRIAC); we’ll send the driver model.</li>' : `<li>Switching is in the cabinet (${esc(controlLabel[job.control].toLowerCase())}): constant power to the driver, no wall switch needed unless wanted.</li>`}
${others.length ? `<li>The accent uplight on top of ${esc([...new Set(others.map((f) => f.cab.name))].join(', '))}: fixtures, power supply, controls and installation, all by the electrician.</li>` : ''}
<li>Any wall penetrations for low-voltage cable that leaves the cabinets.</li></ul>
<h3>Wiring inside the cabinetry</h3><ul><li>${job.driverSpot === 'top' ? 'Drivers on top of the bookcases, out of sight behind the crown, with access and ventilation, and the 120 V receptacle brought up to them.' : 'Drivers hidden in the base cabinets, out of sight behind a removable panel, with the 120 V feed brought into that cabinet.'}</li>
<li>Low-voltage leads from the lights to the drivers: ${esc(wireRouteLabel[job.wireRoute ?? 'dado']).toLowerCase()}${(job.wireRoute ?? 'dado') === 'dado' ? '; CJC routes the dados and drills the pass-throughs in the shop' : '; CJC leaves pass-throughs in the case backs and tops'}.</li></ul>
<h3>What CJC provides</h3><ul><li>Drivers${mesh ? ', Mesh controllers and the wireless wall control' : ''}, LED fixtures, low-voltage wiring from the drivers to the fixtures, programming and testing.</li></ul>
${ours.length ? `<h3>Drivers</h3><table class="parts"><thead><tr><th>#</th><th>Wall</th><th>Driver</th><th>Serves</th><th>Location</th></tr></thead><tbody>${rows}</tbody></table>` : ''}
<h3>Fixtures</h3><table class="parts"><thead><tr><th>Cabinet</th><th>Light</th><th>Size</th><th>Load</th><th>Where</th></tr></thead><tbody>${fx}</tbody></table>`;
}

/** The customer's spec sheet for the drawings: what lights go where, the light color, and how they're switched. No prices. */
export function lightingSpecHtml(p: Project): string {
  const job = lightingJobOf(p);
  const { fixtures, drivers } = lightingParts(p);
  if (!fixtures.length) return '';
  const H = hafeleOf(p);
  const kinds = new Set(fixtures.map((f) => f.kind));
  const warm = job.kelvin <= 2700 ? 'warm, like an incandescent bulb' : job.kelvin <= 3000 ? 'warm white' : job.kelvin <= 3500 ? 'neutral warm white' : 'neutral white';
  const loox = job.fixed === 'loox';
  const others = job.accent === 'others';
  const what: string[] = [];
  if (kinds.has('shelves')) what.push(`<li><b>Häfele adjustable shelf lighting.</b> An LED light bar set into the underside of every adjustable shelf, hidden behind a solid wood edge that drops ${esc(fmt(H.drop))} below the shelf, so you see the light on the shelf below and not the bar. Power runs in thin bus bars in the case sides: the shelves stay adjustable and light wherever they're set, with no wires.</li>`);
  if (kinds.has('shelfFront')) what.push(`<li><b>A light in the top of each open section${fixtures.some((f) => f.kind === 'shelfFront' && f.count > 1) ? ' and each cubby' : ''}.</b> ${loox ? 'LED tape in a recessed aluminum profile with an opal diffuser, flush with the wood.' : 'LED tape in a recessed channel.'}</li>`);
  if (kinds.has('topAccent')) what.push(`<li><b>Accent uplight on top of the bookcases.</b> ${others ? 'Supplied and installed by your electrician, not part of our price.' : `A light strip set back behind the crown, washing up the wall to the ceiling: ${esc(accentLabel[job.accent ?? 'white'].toLowerCase())}${job.accent === 'rgbw' ? ', with any color you pick from the remote or app' : ''}.`}</li>`);
  if (kinds.has('stile')) what.push('<li><b>Vertical light strips</b> just behind the face frame on both sides of each open section, lighting every shelf wherever it is set.</li>');
  if (kinds.has('puck')) what.push('<li><b>Recessed puck lights</b> in the top of each open section.</li>');
  if (kinds.has('under')) what.push('<li><b>Under-cabinet light strips</b> at the front of the wall cabinets, lighting the counter.</li>');
  const rows = fixtures.map((f) => `<tr><td>${esc(f.cab.name)}</td><td>${esc(cabLightLabel[f.kind])}${f.byOthers ? ' (by the electrician)' : ''}</td><td>${f.length ? `${f.count} × ${esc(fmt(f.length))}` : `${f.count}`}</td><td>${esc(f.where)}</td></tr>`).join('');
  return `<h2>Cabinet lighting</h2>
<p>Low-voltage LED, ${job.kelvin}K (${warm}), high color rendering so wood and paint colors look true. Dimmable.${kinds.has('shelves') || loox ? ' Häfele Loox5 components.' : ''}</p>
<h3>What's lit</h3><ul>${what.join('')}</ul>
<h3>Switching</h3><p>${esc(controlLabel[job.control])}.${kinds.has('topAccent') && !others && (job.accent ?? 'white') !== 'white' ? ' The accent uplight has its own controller and remote.' : ''}</p>
<h3>Power</h3><p>${drivers.length} hidden driver${drivers.length === 1 ? '' : 's'}: ${esc(job.driverAt.charAt(0).toLowerCase() + job.driverAt.slice(1))}. Your electrician brings a 120 V outlet to ${drivers.length === 1 ? 'it' : 'each one'}${job.control === 'wall' ? ' and installs the wall dimmer' : ''}; we supply, wire${job.control === 'mesh' ? ', program' : ''} and test the cabinet lights. Line-voltage wiring and outlets are by your electrician.</p>
<h3>By cabinet</h3><table class="parts"><thead><tr><th>Cabinet</th><th>Light</th><th>Lights</th><th>Where</th></tr></thead><tbody>${rows}</tbody></table>`;
}
