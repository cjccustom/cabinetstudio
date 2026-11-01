// Lighting built into the cabinetry: low-voltage (24 V DC) LED, chosen cabinet by cabinet.
// - Puck lights recessed in the underside of the part above each open section.
// - Vertical strips in aluminum channel at each side of an open section, just behind the face
//   frame stiles: they light every shelf wherever adjustable shelves end up.
// - A strip across the front of the top of each open section (in a dado or channel), for fixed shelves.
// - Under-cabinet strip at the front of a wall cabinet's bottom.
// From the choices come the parts to buy (with the specs to match when pricing them), drivers sized
// by wall, labor, and a sheet for the electrician: where the drivers go, what feeds them, switching.
import type { Cabinet, Project, WallId } from './types';
import { eff, openSpans } from './parts';
import { wallNames } from './layout';
import { fmt } from '../units';

export type CabLightKind = 'puck' | 'stile' | 'shelfFront' | 'under';
export const cabLightLabel: Record<CabLightKind, string> = {
  puck: 'Puck lights in the top of each open section',
  stile: 'Vertical strips behind the face frame stiles',
  shelfFront: 'Strip across the front of each open section’s top',
  under: 'Under-cabinet strip (front of the bottom)',
};

export type PartKey = 'tape' | 'channel' | 'puck' | 'driver30' | 'driver60' | 'driver96' | 'lead' | 'cable' | 'control';
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
  /** LED tape draw, watts per foot, and each puck's watts: from the product picked. */
  wattsPerFt: number;
  puckWatts: number;
  /** Your prices: tape, channel and cable per foot; the rest each. */
  prices: Partial<Record<PartKey, number>>;
}
export const defaultLightingJob: LightingJob = { kelvin: 3000, control: 'wall', driverAt: 'In the base cabinet below, behind a removable back panel', wattsPerFt: 3, puckWatts: 2, prices: {} };
export const lightingJobOf = (p: Project): LightingJob => ({ ...defaultLightingJob, ...p.cabLighting, prices: { ...p.cabLighting?.prices } });

export interface Fixture { cab: Cabinet; kind: CabLightKind; count: number; /** Strip length each, inches (0 for pucks). */ length: number; watts: number; leads: number; where: string }

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
        const L = inner - 1;
        out.push({ cab: c, kind: k, count: 1, length: L, watts: (L / 12) * job.wattsPerFt, leads: 1, where: `Across the front of the top of the ${which}, in a channel behind the rail` });
      }
    });
  }
  return out;
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
  const strips = fixtures.filter((f) => f.length > 0);
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
<h3>What CJC provides</h3><ul><li>Drivers, LED fixtures, channel, low-voltage wiring from the drivers to the fixtures, and testing.</li></ul>
<h3>Drivers</h3><table class="parts"><thead><tr><th>#</th><th>Wall</th><th>Driver</th><th>Serves</th><th>Location</th></tr></thead><tbody>${rows}</tbody></table>
<h3>Fixtures</h3><table class="parts"><thead><tr><th>Cabinet</th><th>Light</th><th>Size</th><th>Load</th><th>Where</th></tr></thead><tbody>${fx}</tbody></table>`;
}
