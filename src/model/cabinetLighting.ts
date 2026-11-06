// Lighting built into the cabinetry: low-voltage (24 V DC) LED, chosen cabinet by cabinet.
// - Puck lights recessed in the underside of the part above each open section.
// - Vertical strips in aluminum channel at each side of an open section, just behind the face
//   frame stiles: they light every shelf wherever adjustable shelves end up.
// - A strip across the front of the top of each open section (in a dado or channel), for fixed shelves.
// - Under-cabinet strip at the front of a wall cabinet's bottom.
// From the choices come the parts to buy (with the specs to match when pricing them), drivers sized
// by wall, labor, and a sheet for the electrician: where the drivers go, what feeds them, switching.
import type { Cabinet, Project, WallId } from './types';
import { eff, layoutRows, openSpans } from './parts';
import { wallNames } from './layout';
import { fmt } from '../units';

export type CabLightKind = 'puck' | 'stile' | 'shelfFront' | 'under' | 'shelves' | 'topAccent';
export const cabLightLabel: Record<CabLightKind, string> = {
  puck: 'Puck lights in the top of each open section',
  stile: 'Vertical strips behind the face frame stiles',
  shelfFront: 'Strip in the top of each open section or cubby (in a channel)',
  under: 'Under-cabinet strip (front of the bottom)',
  shelves: 'Häfele adjustable shelf lighting (under every shelf)',
  topAccent: 'Accent uplight on top (dimmable, color optional)',
};

export type PartKey = 'tape' | 'channel' | 'puck' | 'driver30' | 'driver60' | 'driver96' | 'lead' | 'cable' | 'control' | 'hProfile' | 'hCustom' | 'hRail' | 'hConnector' | 'hDriver' | 'accentTape' | 'accentControl';
export type Control = 'wall' | 'door' | 'touch' | 'remote';
export const controlLabel: Record<Control, string> = {
  wall: 'Wall dimmer (electrician), dimmable driver',
  door: 'Door-activated switch in the cabinet',
  touch: 'Touch / wave dimmer in the cabinet',
  remote: 'Wireless remote dimmer at the driver',
};

export interface LightingJob {
  kelvin: 2700 | 3000 | 3500 | 4000;
  control: Control;
  /** Where the drivers go, in words for the electrician. */
  driverAt: string;
  /** How the low-voltage leads get from the lights to the drivers: behind the cabinets, or in a dado routed inside the case. */
  wireRoute?: WireRoute;
  /** LED tape draw, watts per foot, and each puck's watts: from the product picked. */
  wattsPerFt: number;
  puckWatts: number;
  /** Your prices: tape, channel and cable per foot; the rest each. */
  prices: Partial<Record<PartKey, number>>;
  /** Where the drivers sit: in the base cabinets below, or on top of the bookcases (behind the crown). */
  driverSpot?: 'below' | 'top';
  /** Häfele adjustable shelf lighting: the machining, from Häfele's spec sheet, and their article numbers. */
  hafele?: Partial<HafeleSpec>;
  /** Accent uplight on top of the bookcases: plain white, tunable white, or color (RGBW), and the color shown in 3D. */
  accent?: 'white' | 'tunable' | 'rgbw';
  accentHex?: string;
}

/**
 * Häfele Wireless Adjustable Shelf Lighting System (tech doc 2/23), as Cody builds it:
 * - A light bar (Profile 1103, 12 V) routed into the underside of every shelf, hidden behind a
 *   solid wood edge that drops below the shelf. Spring-loaded contacts in each end of the bar touch
 *   the bus bars, so the bar runs the shelf's full length: standard 18", 24", 30", 36", or custom
 *   lengths from Häfele Service+ (about 10 days).
 * - Brushed aluminum bus bars (833.74.996: 92" × 9/32" × 3/16", 20 to a pack) in narrow vertical
 *   channels in the case sides, two per lit bay; two can go back to back in one divider. Häfele
 *   sells a router bit for the channel (001.25.920 8 mm shank, 001.25.921 1/4" shank).
 * - A power supply kit (833.88.986) at the top or bottom of each bay: splice block, two
 *   spring-loaded contact connectors with 500 mm cables, brackets and a 1 m modular cable to a
 *   Loox 12 V driver, ordered separately.
 * Sizes read off Häfele's drawing (channel 7 × 5 mm; bar about 13 × 11.5 mm in a 13.9 × 12 mm
 * groove): confirm against the parts before cutting.
 */
export interface HafeleSpec {
  profileW: number; profileD: number; profileBack: number;
  railW: number; railD: number; railBack: number;
  /** How far the solid wood edge drops below the shelf, to hide the bar. */
  drop: number;
  /** LED 2065 medium (4.8 W/m) or LED 2068 high (9.6 W/m). */
  intensity: 'medium' | 'high';
  /** Häfele article numbers, for the spec sheet and the order. */
  profileNo: string; railNo: string; connectorNo: string; driverNo: string;
}
export const defaultHafele: HafeleSpec = { profileW: 0.5625, profileD: 0.5, profileBack: 0.25, railW: 0.25, railD: 0.1875, railBack: 1, drop: 0.75, intensity: 'medium', profileNo: 'Profile 1103', railNo: '833.74.996', connectorNo: '833.88.986', driverNo: '' };
/** Häfele's standard light bar lengths and article numbers (12 V), by intensity and color. */
export const HAFELE_BARS = [18, 24, 30, 36] as const;
const hafeleBarNo: Record<'medium' | 'high', Record<3000 | 4000, string[]>> = {
  medium: { 3000: ['833.88.978', '833.88.979', '833.88.980', '833.88.981'], 4000: ['833.88.982', '833.88.983', '833.88.984', '833.88.985'] },
  high: { 3000: ['833.88.970', '833.88.971', '833.88.972', '833.88.973'], 4000: ['833.88.974', '833.88.975', '833.88.976', '833.88.977'] },
};
/** The standard bar a shelf takes, if its length is one (within 1/16"). */
export const hafeleStandard = (len: number) => HAFELE_BARS.find((b) => Math.abs(b - len) <= 0.0625);
export const hafeleWattsPerIn = (H: HafeleSpec) => (H.intensity === 'high' ? 9.6 : 4.8) / 39.37;
export const hafeleOf = (p: Project): HafeleSpec => ({ ...defaultHafele, ...p.cabLighting?.hafele, ...p.settings.hafele });
export const accentLabel = { white: 'White, dimmable', tunable: 'Tunable white (warm to cool), dimmable', rgbw: 'Color (RGBW) with white, dimmable' } as const;
export type WireRoute = 'dado' | 'behind';
export const wireRouteLabel: Record<WireRoute, string> = {
  dado: 'In a dado routed inside the case (back or side), down to the base cabinet',
  behind: 'Behind the cabinets, in the space between the case back and the wall',
};
export const defaultLightingJob: LightingJob = { kelvin: 3000, control: 'wall', driverAt: 'In the base cabinet below, behind a removable back panel', wireRoute: 'dado', wattsPerFt: 3, puckWatts: 2, prices: {} };
export const lightingJobOf = (p: Project): LightingJob => {
  const j = { ...defaultLightingJob, ...p.cabLighting, prices: { ...p.cabLighting?.prices } };
  // Drivers on top of the bookcases unless the location was written out by hand
  if (j.driverSpot === 'top' && !p.cabLighting?.driverAt) j.driverAt = 'On top of the bookcases, behind the crown, with an access panel or reachable from above';
  return j;
};

export interface Fixture { cab: Cabinet; kind: CabLightKind; count: number; /** Strip length each, inches (0 for pucks). */ length: number; watts: number; leads: number; where: string; /** Häfele shelves: the open section's height, for the bus bars down each side, and its bays across. */ span?: number; bays?: number; /** 12 V (Häfele) or the usual 24 V. */ volts?: 12 | 24 }

/** The light fixtures a cabinet gets from its choices. */
export function cabinetFixtures(c: Cabinet, p: Project, job = lightingJobOf(p)): Fixture[] {
  const kinds = c.lighting ?? [];
  if (!kinds.length) return [];
  const s = eff(c, p.settings);
  const inner = Math.max(6, c.width - 2 * s.stileWidth);
  const spans = openSpans(c, s);
  const out: Fixture[] = [];
  for (const k of kinds) {
    if (k === 'under') {
      if (c.kind !== 'wall') continue;
      const L = inner - 1;
      out.push({ cab: c, kind: k, count: 1, length: L, watts: (L / 12) * job.wattsPerFt, leads: 1, where: 'Under the bottom, behind the bottom rail' });
      continue;
    }
    if (k === 'topAccent') {
      // A strip set back on top of the case, shining up the wall: only where there's room above it
      const room = p.room.height - (c.elevation + c.height);
      if (room < 6) continue;
      const L = Math.max(6, c.width - 2);
      out.push({ cab: c, kind: k, count: 1, length: L, watts: (L / 12) * job.wattsPerFt, leads: 1, where: `On top of the case, set back behind the crown, shining up the wall (${Math.round(room)}" to the ceiling)` });
      continue;
    }
    if (k === 'shelves') {
      // One profile under each adjustable shelf and under the top of each open section (each cubby, with dividers)
      spans.forEach((o, i) => {
        const rs = c.rows.filter((_, ri) => openRowAt(c, s, ri, o));
        const bays = 1 + Math.max(0, ...rs.map((r) => (r.type === 'open' ? r.dividers ?? 0 : 0)));
        const shelves = rs.reduce((t, r) => t + (r.fixedShelves || c.build?.shelves === 'fixed' ? 0 : r.shelves), 0);
        // Each bar runs the full length of its shelf, contacts touching the bus bars both ends
        const n = bays * (shelves + 1), L = Math.max(6, (inner - (bays - 1) * 0.75) / bays - s.shelfClearance);
        const which = spans.length > 1 ? `open section ${i + 1} (from the bottom)` : 'open section';
        const H = hafeleOf(p);
        out.push({ cab: c, kind: k, count: n, length: L, watts: n * L * hafeleWattsPerIn(H), leads: bays, span: o.y1 - o.y0, bays, volts: 12, where: `Under the front of each shelf and the top of the ${which}, in a groove behind the drop edge; bus bars in channels down each side${bays > 1 ? ' of every cubby' : ''}` });
      });
      continue;
    }
    spans.forEach((o, i) => {
      const h = o.y1 - o.y0;
      const which = spans.length > 1 ? `open section ${i + 1} (from the bottom)` : 'open section';
      if (k === 'puck') {
        const n = Math.max(1, Math.round(inner / 18));
        out.push({ cab: c, kind: k, count: n, length: 0, watts: n * job.puckWatts, leads: 1, where: `Recessed in the underside of the top of the ${which}, evenly spaced` });
      } else if (k === 'stile') {
        const L = Math.max(6, h - 1);
        out.push({ cab: c, kind: k, count: 2, length: L, watts: 2 * (L / 12) * job.wattsPerFt, leads: 2, where: `Both sides of the ${which}, in channel let into the case side just behind the stile, facing in` });
      } else if (k === 'shelfFront') {
        // One strip per cubby when the section has vertical dividers
        const rs = c.rows.filter((_, ri) => openRowAt(c, s, ri, o));
        const bays = 1 + Math.max(0, ...rs.map((r) => (r.type === 'open' ? r.dividers ?? 0 : 0)));
        const L = Math.max(6, (inner - (bays - 1) * 0.75) / bays - 1);
        out.push({ cab: c, kind: k, count: bays, length: L, watts: bays * (L / 12) * job.wattsPerFt, leads: bays, where: `In a channel routed into the underside of the top of ${bays > 1 ? `each of the ${bays} cubbies in the ${which}` : `the ${which}`}, just behind the rail, facing down` });
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

export const DRIVERS = [30, 60, 96] as const;
export interface Driver { wall: WallId; watts: number; size: 30 | 60 | 96; serves: string[]; volts: 12 | 24 }

/** One driver run per wall (and voltage: Häfele's 12 V shelf system has its own), sized with 20% headroom; a wall over 96 W splits into more drivers. */
export function lightingDrivers(fx: Fixture[]): Driver[] {
  const out: Driver[] = [];
  const byWall = new Map<string, Fixture[]>();
  for (const f of fx) { const key = `${f.cab.wall}|${f.volts ?? 24}`; byWall.set(key, [...(byWall.get(key) ?? []), f]); }
  for (const [key, list] of byWall) {
    const wall = key.split('|')[0] as WallId, volts = (Number(key.split('|')[1]) === 12 ? 12 : 24) as 12 | 24;
    let cur: Fixture[] = [], w = 0;
    const flush = () => {
      if (!cur.length) return;
      const need = w * 1.2;
      out.push({ wall, watts: w, size: DRIVERS.find((d) => d >= need) ?? 96, serves: [...new Set(cur.map((f) => f.cab.name))], volts });
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

export interface LightingPart { key: PartKey; label: string; spec: string; qty: number; unit: 'ft' | 'ea'; search: string }
const google = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;

/** What to buy, with the spec to match. Lengths include 10% for cutting to the cut marks. */
export function lightingParts(p: Project): { parts: LightingPart[]; fixtures: Fixture[]; drivers: Driver[]; watts: number } {
  const job = lightingJobOf(p);
  const fixtures = p.cabinets.flatMap((c) => cabinetFixtures(c, p, job));
  const drivers = lightingDrivers(fixtures);
  const strips = fixtures.filter((f) => f.length > 0 && f.kind !== 'shelves' && !(f.kind === 'topAccent' && (job.accent ?? 'white') !== 'white'));
  const stripFt = strips.reduce((t, f) => t + (f.count * f.length) / 12, 0);
  const pucks = fixtures.filter((f) => f.kind === 'puck').reduce((t, f) => t + f.count, 0);
  const leads = fixtures.reduce((t, f) => t + f.leads, 0);
  // Low-voltage cable: each lead runs about half the cabinet's height plus 3' to its driver
  const cableFt = fixtures.reduce((t, f) => t + f.leads * (f.cab.height / 2 + 36) / 12, 0);
  const k = job.kelvin;
  const parts: LightingPart[] = [];
  if (stripFt) {
    parts.push({ key: 'tape', label: 'LED tape', spec: `24 V DC, ${k}K, CRI 90+, about ${job.wattsPerFt} W/ft, high-density (no dots) for use in diffused channel; 8–10 mm wide`, qty: Math.ceil(stripFt * 1.1), unit: 'ft', search: google(`24V LED tape ${k}K CRI 95 cabinet high density`) });
    parts.push({ key: 'channel', label: 'Aluminum channel with frosted diffuser', spec: 'Recessed (flanged) profile for 8–10 mm tape, end caps; note the routing width and depth', qty: Math.ceil(stripFt * 1.1), unit: 'ft', search: google('recessed aluminum LED channel flange frosted diffuser cabinet') });
  }
  const hf = fixtures.filter((f) => f.kind === 'shelves');
  if (hf.length) {
    const H = hafeleOf(p);
    const kk = (k >= 3500 ? 4000 : 3000) as 3000 | 4000;
    const std = new Map<number, number>(), custom = new Map<string, number>();
    for (const f of hf) {
      const b = hafeleStandard(f.length);
      if (b) std.set(b, (std.get(b) ?? 0) + f.count);
      else custom.set(fmt(f.length), (custom.get(fmt(f.length)) ?? 0) + f.count);
    }
    const fam = H.intensity === 'high' ? 'LED 2068 high (9.6 W/m)' : 'LED 2065 medium (4.8 W/m)';
    const nStd = [...std.values()].reduce((a, b) => a + b, 0), nCus = [...custom.values()].reduce((a, b) => a + b, 0);
    if (nStd) parts.push({ key: 'hProfile', label: 'Häfele adjustable shelf light bars, standard length', spec: `${H.profileNo || 'Profile 1103'}, 12 V ${fam}, ${kk}K${k !== kk ? ` (nearest Häfele color to ${k}K)` : ''}: ${[...std].map(([b, n]) => `${n} × ${b}" (${hafeleBarNo[H.intensity][kk][HAFELE_BARS.indexOf(b as 18)]})`).join(', ')}`, qty: nStd, unit: 'ea', search: google(`Hafele ${hafeleBarNo[H.intensity][kk][1]} light bar wireless adjustable shelf`) });
    if (nCus) parts.push({ key: 'hCustom', label: 'Häfele adjustable shelf light bars, custom length', spec: `${H.profileNo || 'Profile 1103'}, 12 V ${fam}, ${kk}K, made to the shelf length by Häfele Service+ (888.437.7477, projects@hafele.us; about 10 days): ${[...custom].map(([l, n]) => `${n} × ${l}`).join(', ')}`, qty: nCus, unit: 'ea', search: google('Hafele wireless adjustable shelf lighting custom length light bar') });
    // Two bus bars per bay (one each side), each 92" long and cut to the section's height; 20 to a pack
    const bars = hf.reduce((t, f) => t + (f.bays ?? 1) * 2 * Math.ceil((f.span ?? 0) / 92), 0);
    parts.push({ key: 'hRail', label: 'Häfele bus bars, packs of 20', spec: `${H.railNo || '833.74.996'}: 92" × 9/32" × 3/16" brushed aluminum, ${bars} bars needed (2 per lit bay, cut to height) in ${fmt(H.railW)} × ${fmt(H.railD)} channels; router bit 001.25.921 (1/4" shank) if you don't have it`, qty: Math.ceil(bars / 20), unit: 'ea', search: google('Hafele 833.74.996 bus bar') });
    parts.push({ key: 'hConnector', label: 'Häfele power supply kits', spec: `${H.connectorNo || '833.88.986'}: one per lit bay, at its top or bottom (splice block, 2 spring contact connectors, brackets, 1 m modular cable)`, qty: hf.reduce((t, f) => t + (f.bays ?? 1), 0), unit: 'ea', search: google('Hafele 833.88.986 power supply kit') });
  }
  const acc = fixtures.filter((f) => f.kind === 'topAccent');
  if (acc.length && (job.accent ?? 'white') !== 'white') {
    const ft = acc.reduce((t, f) => t + f.length / 12, 0);
    parts.push({ key: 'accentTape', label: job.accent === 'rgbw' ? 'RGBW LED tape (accent)' : 'Tunable white LED tape (accent)', spec: `24 V DC, ${job.accent === 'rgbw' ? 'RGB + white' : '2700–6500K'}, for the uplight on top`, qty: Math.ceil(ft * 1.1), unit: 'ft', search: google(`24V ${job.accent === 'rgbw' ? 'RGBW' : 'tunable white'} LED tape`) });
    parts.push({ key: 'accentControl', label: job.accent === 'rgbw' ? 'RGBW controller and remote' : 'Tunable white controller and remote', spec: '24 V DC, rated for the accent run; app or remote dimming', qty: 1, unit: 'ea', search: google(`24V ${job.accent === 'rgbw' ? 'RGBW' : 'CCT'} LED controller remote`) });
  }
  if (pucks) parts.push({ key: 'puck', label: 'Recessed LED puck lights', spec: `24 V DC, ${k}K, CRI 90+, about ${job.puckWatts} W each; note the cutout diameter and depth (must fit the part thickness)`, qty: pucks, unit: 'ea', search: google(`24V recessed LED puck light ${k}K CRI 90 cabinet`) });
  const d12 = drivers.filter((d) => d.volts === 12);
  if (d12.length) parts.push({ key: 'hDriver', label: 'Häfele Loox 12 V drivers', spec: `${hafeleOf(p).driverNo ? `Häfele ${hafeleOf(p).driverNo}: ` : ''}12 V constant-voltage Loox driver for the shelf light bars: ${d12.map((d) => `${d.size} W`).join(', ')}${job.control === 'wall' ? ', dimmable to suit the wall dimmer' : ''}`, qty: d12.length, unit: 'ea', search: google('Hafele Loox5 12V driver') });
  for (const size of DRIVERS) {
    const n = drivers.filter((d) => d.size === size && d.volts === 24).length;
    if (n) parts.push({ key: `driver${size}` as PartKey, label: `Driver, ${size} W`, spec: `24 V DC constant-voltage, Class 2${job.control === 'wall' ? ', dimmable with a wall dimmer (ELV/MLV or TRIAC: match the dimmer the electrician installs)' : ''}; plug-in or hard-wired to suit the outlet`, qty: n, unit: 'ea', search: google(`24V ${size}W dimmable LED driver class 2 cabinet lighting`) });
  }
  if (leads) parts.push({ key: 'lead', label: 'Leads, connectors and distribution block', spec: 'Quick-connect leads to each fixture and a 6- or 10-port block at each driver', qty: leads, unit: 'ea', search: google('24V LED lighting distribution block quick connect lead cabinet') });
  if (cableFt) parts.push({ key: 'cable', label: 'Low-voltage cable, 18/2', spec: 'CL2 or CL3 rated where it runs in a wall', qty: Math.ceil(cableFt), unit: 'ft', search: google('18/2 CL2 LED low voltage wire') });
  if (fixtures.length && job.control !== 'wall') parts.push({ key: 'control', label: controlLabel[job.control], spec: '24 V DC, rated for the driver’s load', qty: drivers.length, unit: 'ea', search: google(`24V LED ${job.control === 'door' ? 'cabinet door switch' : job.control === 'touch' ? 'touch dimmer cabinet' : 'wireless remote dimmer'}`) });
  return { parts, fixtures, drivers, watts: fixtures.reduce((t, f) => t + f.watts, 0) };
}

export function lightingCost(p: Project): { cost: number; missing: string[] } {
  const job = lightingJobOf(p);
  const { parts } = lightingParts(p);
  const missing = parts.filter((x) => job.prices[x.key] == null).map((x) => x.label);
  return { cost: parts.reduce((t, x) => t + x.qty * (job.prices[x.key] ?? 0), 0), missing };
}

/** The electrician's sheet, as HTML for a drawing sheet or a page of its own. */
export function electricianHtml(p: Project): string {
  const job = lightingJobOf(p);
  const { fixtures, drivers, watts } = lightingParts(p);
  if (!fixtures.length) return '';
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const rows = drivers.map((d, i) => `<tr><td>D${i + 1}</td><td>${esc(wallNames[d.wall])}</td><td>${d.volts} V, ${d.size} W (${Math.round(d.watts)} W load)</td><td>${esc(d.serves.join(', '))}</td><td>${esc(job.driverAt)}</td></tr>`).join('');
  const fx = fixtures.map((f) => `<tr><td>${esc(f.cab.name)}</td><td>${esc(cabLightLabel[f.kind])}</td><td>${f.length ? `${f.count} × ${fmt(f.length)}` : `${f.count} pucks`}</td><td>${Math.round(f.watts)} W</td><td>${esc(f.where)}</td></tr>`).join('');
  return `<h2>Cabinet lighting: for the electrician</h2>
<p>Low-voltage LED, ${fixtures.some((f) => f.volts === 12) ? '24 V DC (Häfele shelf lighting 12 V DC on its own drivers)' : '24 V DC'}, ${job.kelvin}K. Total about ${Math.round(watts)} W of fixtures on ${drivers.length} driver${drivers.length === 1 ? '' : 's'}.</p>
<h3>What the electrician provides</h3><ul>
<li>A 120 V receptacle or junction box at each driver location (below): ${esc(job.driverAt)}. Confirm the exact spot with CJC before the cabinets go in.</li>
${job.control === 'wall' ? '<li>A wall dimmer for each driver run, matched to the driver type CJC orders (ELV/MLV or TRIAC); we’ll send the driver model.</li>' : `<li>Switching is in the cabinet (${esc(controlLabel[job.control].toLowerCase())}): constant power to the driver, no wall switch needed unless wanted.</li>`}
<li>Any wall penetrations for low-voltage cable that leaves the cabinets.</li></ul>
<h3>Wiring inside the cabinetry</h3><ul><li>${job.driverSpot === 'top' ? 'Drivers on top of the bookcases, out of sight behind the crown, with the 120 V feed brought up to them.' : 'Drivers hidden in the base cabinets, out of sight behind a removable panel, with the 120 V feed brought into that cabinet.'}</li>
<li>Low-voltage leads from the lights to the drivers: ${esc(wireRouteLabel[job.wireRoute ?? 'dado']).toLowerCase()}${(job.wireRoute ?? 'dado') === 'dado' ? '; CJC routes the dados and drills the pass-throughs in the shop' : '; CJC leaves pass-throughs in the case backs and tops'}.</li></ul>
<h3>What CJC provides</h3><ul><li>Drivers, LED fixtures, channel, low-voltage wiring from the drivers to the fixtures, and testing.</li></ul>
<h3>Drivers</h3><table class="parts"><thead><tr><th>#</th><th>Wall</th><th>Driver</th><th>Serves</th><th>Location</th></tr></thead><tbody>${rows}</tbody></table>
<h3>Fixtures</h3><table class="parts"><thead><tr><th>Cabinet</th><th>Light</th><th>Size</th><th>Load</th><th>Where</th></tr></thead><tbody>${fx}</tbody></table>`;
}

/** The customer's spec sheet for the drawings: what lights go where, the light color, and how they're switched. No prices. */
export function lightingSpecHtml(p: Project): string {
  const job = lightingJobOf(p);
  const { fixtures, drivers } = lightingParts(p);
  if (!fixtures.length) return '';
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const H = hafeleOf(p);
  const kinds = new Set(fixtures.map((f) => f.kind));
  const warm = job.kelvin <= 2700 ? 'warm, like an incandescent bulb' : job.kelvin <= 3000 ? 'warm white' : job.kelvin <= 3500 ? 'neutral warm white' : 'neutral white';
  const what: string[] = [];
  if (kinds.has('shelves')) what.push(`<li><b>Häfele adjustable shelf lighting.</b> An LED light strip set into the underside of every adjustable shelf, hidden behind a solid wood edge that drops ${esc(fmt(H.drop))} below the shelf, so you see the light on the shelf below and not the strip. Power runs in a channel inside the case sides; the shelves stay adjustable and plug in wherever they're set.${H.profileNo ? ` Häfele ${esc(H.profileNo)}.` : ''}</li>`);
  if (kinds.has('topAccent')) what.push(`<li><b>Accent uplight on top of the bookcases.</b> A light strip set back behind the crown, washing up the wall to the ceiling: ${esc(accentLabel[job.accent ?? 'white'].toLowerCase())}${job.accent === 'rgbw' ? ', with any color you pick from the remote or app' : ''}.</li>`);
  if (kinds.has('stile')) what.push('<li><b>Vertical light strips</b> just behind the face frame on both sides of each open section, lighting every shelf wherever it is set.</li>');
  if (kinds.has('puck')) what.push('<li><b>Recessed puck lights</b> in the top of each open section.</li>');
  if (kinds.has('shelfFront')) what.push('<li><b>A light strip across the front</b> of the top of each open section.</li>');
  if (kinds.has('under')) what.push('<li><b>Under-cabinet light strips</b> at the front of the wall cabinets, lighting the counter.</li>');
  const rows = fixtures.map((f) => `<tr><td>${esc(f.cab.name)}</td><td>${esc(cabLightLabel[f.kind])}</td><td>${f.length ? `${f.count} × ${esc(fmt(f.length))}` : `${f.count}`}</td><td>${esc(f.where)}</td></tr>`).join('');
  return `<h2>Cabinet lighting</h2>
<p>Low-voltage LED, ${job.kelvin}K (${warm}), high color rendering so wood and paint colors look true. Dimmable.</p>
<h3>What's lit</h3><ul>${what.join('')}</ul>
<h3>Switching</h3><p>${esc(controlLabel[job.control])}.${kinds.has('topAccent') && (job.accent ?? 'white') !== 'white' ? ' The accent uplight has its own controller and remote.' : ''}</p>
<h3>Power</h3><p>${drivers.length} hidden driver${drivers.length === 1 ? '' : 's'}: ${esc(job.driverAt.charAt(0).toLowerCase() + job.driverAt.slice(1))}. Your electrician brings a 120 V outlet or box to ${drivers.length === 1 ? 'it' : 'each one'}${job.control === 'wall' ? ' and installs the wall dimmer' : ''}; we supply and wire the lights, drivers and low-voltage wiring.</p>
<h3>By cabinet</h3><table class="parts"><thead><tr><th>Cabinet</th><th>Light</th><th>Lights</th><th>Where</th></tr></thead><tbody>${rows}</tbody></table>`;
}
