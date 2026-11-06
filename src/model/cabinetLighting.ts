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

export type PartKey = 'tape' | 'channel' | 'puck' | 'driver30' | 'driver60' | 'driver96' | 'lead' | 'cable' | 'control' | 'hProfile' | 'hRail' | 'hConnector' | 'accentTape' | 'accentControl';
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
 * Häfele adjustable shelf lighting, as Cody builds it: an LED profile in a groove under the front
 * of every adjustable shelf, hidden behind a solid wood edge that drops below the shelf; power in a
 * channel routed down the inside of each case side. The sizes start as placeholders: set them from
 * Häfele's spec sheet for the profile and power rail you order.
 */
export interface HafeleSpec {
  profileW: number; profileD: number; profileBack: number;
  railW: number; railD: number; railBack: number;
  /** How far the solid wood edge drops below the shelf, to hide the profile. */
  drop: number;
  /** Häfele article numbers, for the spec sheet and the order. */
  profileNo: string; railNo: string; connectorNo: string; driverNo: string;
}
export const defaultHafele: HafeleSpec = { profileW: 0.625, profileD: 0.3125, profileBack: 0.375, railW: 0.375, railD: 0.25, railBack: 1, drop: 0.75, profileNo: '', railNo: '', connectorNo: '', driverNo: '' };
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

export interface Fixture { cab: Cabinet; kind: CabLightKind; count: number; /** Strip length each, inches (0 for pucks). */ length: number; watts: number; leads: number; where: string; /** Häfele shelves: the open section's height, for the power rail down each side. */ span?: number }

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
        const n = bays * (shelves + 1), L = Math.max(6, (inner - (bays - 1) * 0.75) / bays - 1);
        const which = spans.length > 1 ? `open section ${i + 1} (from the bottom)` : 'open section';
        out.push({ cab: c, kind: k, count: n, length: L, watts: n * (L / 12) * job.wattsPerFt, leads: n, span: o.y1 - o.y0, where: `Under the front of each shelf and the top of the ${which}, in a groove behind the drop edge; power in a channel down each side` });
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
export interface Driver { wall: WallId; watts: number; size: 30 | 60 | 96; serves: string[] }

/** One driver run per wall, sized with 20% headroom; a wall over 96 W splits into more drivers. */
export function lightingDrivers(fx: Fixture[]): Driver[] {
  const out: Driver[] = [];
  const byWall = new Map<WallId, Fixture[]>();
  for (const f of fx) byWall.set(f.cab.wall, [...(byWall.get(f.cab.wall) ?? []), f]);
  for (const [wall, list] of byWall) {
    let cur: Fixture[] = [], w = 0;
    const flush = () => {
      if (!cur.length) return;
      const need = w * 1.2;
      out.push({ wall, watts: w, size: DRIVERS.find((d) => d >= need) ?? 96, serves: [...new Set(cur.map((f) => f.cab.name))] });
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
  const strips = fixtures.filter((f) => f.length > 0 && !(f.kind === 'topAccent' && (job.accent ?? 'white') !== 'white'));
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
    const profFt = hf.reduce((t, f) => t + (f.count * f.length) / 12, 0);
    const railFt = hf.reduce((t, f) => t + (2 * (f.span ?? 0)) / 12, 0);
    parts.push({ key: 'hProfile', label: 'Häfele shelf LED profile', spec: `${H.profileNo ? `Häfele ${H.profileNo}; ` : ''}in a ${fmt(H.profileW)} × ${fmt(H.profileD)} groove under each shelf front; ${k}K`, qty: Math.ceil(profFt * 1.1), unit: 'ft', search: google(`Hafele Loox5 shelf lighting profile ${k}K`) });
    parts.push({ key: 'hRail', label: 'Häfele power rail for the case sides', spec: `${H.railNo ? `Häfele ${H.railNo}; ` : ''}in a ${fmt(H.railW)} × ${fmt(H.railD)} channel down each side, ${fmt(H.railBack)} from the front`, qty: Math.ceil(railFt * 1.1), unit: 'ft', search: google('Hafele Loox5 adjustable shelf lighting power rail') });
    parts.push({ key: 'hConnector', label: 'Häfele shelf connectors', spec: `${H.connectorNo ? `Häfele ${H.connectorNo}; ` : ''}one per lit shelf, so shelves can be moved`, qty: hf.reduce((t, f) => t + f.count, 0), unit: 'ea', search: google('Hafele Loox5 shelf connector adjustable shelf') });
  }
  const acc = fixtures.filter((f) => f.kind === 'topAccent');
  if (acc.length && (job.accent ?? 'white') !== 'white') {
    const ft = acc.reduce((t, f) => t + f.length / 12, 0);
    parts.push({ key: 'accentTape', label: job.accent === 'rgbw' ? 'RGBW LED tape (accent)' : 'Tunable white LED tape (accent)', spec: `24 V DC, ${job.accent === 'rgbw' ? 'RGB + white' : '2700–6500K'}, for the uplight on top`, qty: Math.ceil(ft * 1.1), unit: 'ft', search: google(`24V ${job.accent === 'rgbw' ? 'RGBW' : 'tunable white'} LED tape`) });
    parts.push({ key: 'accentControl', label: job.accent === 'rgbw' ? 'RGBW controller and remote' : 'Tunable white controller and remote', spec: '24 V DC, rated for the accent run; app or remote dimming', qty: 1, unit: 'ea', search: google(`24V ${job.accent === 'rgbw' ? 'RGBW' : 'CCT'} LED controller remote`) });
  }
  if (pucks) parts.push({ key: 'puck', label: 'Recessed LED puck lights', spec: `24 V DC, ${k}K, CRI 90+, about ${job.puckWatts} W each; note the cutout diameter and depth (must fit the part thickness)`, qty: pucks, unit: 'ea', search: google(`24V recessed LED puck light ${k}K CRI 90 cabinet`) });
  for (const size of DRIVERS) {
    const n = drivers.filter((d) => d.size === size).length;
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
  const rows = drivers.map((d, i) => `<tr><td>D${i + 1}</td><td>${esc(wallNames[d.wall])}</td><td>${d.size} W (${Math.round(d.watts)} W load)</td><td>${esc(d.serves.join(', '))}</td><td>${esc(job.driverAt)}</td></tr>`).join('');
  const fx = fixtures.map((f) => `<tr><td>${esc(f.cab.name)}</td><td>${esc(cabLightLabel[f.kind])}</td><td>${f.length ? `${f.count} × ${fmt(f.length)}` : `${f.count} pucks`}</td><td>${Math.round(f.watts)} W</td><td>${esc(f.where)}</td></tr>`).join('');
  return `<h2>Cabinet lighting: for the electrician</h2>
<p>Low-voltage LED, 24 V DC, ${job.kelvin}K. Total about ${Math.round(watts)} W of fixtures on ${drivers.length} driver${drivers.length === 1 ? '' : 's'}.</p>
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
<p>Low-voltage LED (24 V), ${job.kelvin}K (${warm}), high color rendering so wood and paint colors look true. Dimmable.</p>
<h3>What's lit</h3><ul>${what.join('')}</ul>
<h3>Switching</h3><p>${esc(controlLabel[job.control])}.${kinds.has('topAccent') && (job.accent ?? 'white') !== 'white' ? ' The accent uplight has its own controller and remote.' : ''}</p>
<h3>Power</h3><p>${drivers.length} hidden driver${drivers.length === 1 ? '' : 's'}: ${esc(job.driverAt.charAt(0).toLowerCase() + job.driverAt.slice(1))}. Your electrician brings a 120 V outlet or box to ${drivers.length === 1 ? 'it' : 'each one'}${job.control === 'wall' ? ' and installs the wall dimmer' : ''}; we supply and wire the lights, drivers and low-voltage wiring.</p>
<h3>By cabinet</h3><table class="parts"><thead><tr><th>Cabinet</th><th>Light</th><th>Lights</th><th>Where</th></tr></thead><tbody>${rows}</tbody></table>`;
}
