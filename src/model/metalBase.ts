// Custom fabricated metal bases for tables and benches: the form (U legs, sled, X, trapezoid, hairpin,
// box frame, pedestal), the stock (square or round tube, flat bar), and the finish. Drawn as members
// from point to point, so the 3D shows it and the fabricator gets a dimensioned drawing and a cut
// list to quote from. Their price for the job goes in with Cody's markup.
//
// Table-local coordinates like the table: x along the length (0 at the middle), y up, z across.
export type MetalForm = 'u' | 'sled' | 'x' | 'trapezoid' | 'hairpin' | 'box' | 'pedestal';
export type MetalStock = 'square' | 'round' | 'flat';

export interface MetalBase {
  form: MetalForm;
  stock: MetalStock;
  /** Tube outside size (square or round), or flat bar width. */
  size: number;
  /** Flat bar thickness, or the tube's wall. */
  wall: number;
  finish: 'powder' | 'blackened' | 'raw' | 'painted';
  color: string;
  /** How far the base's outside sits in from the top's edge. */
  inset: number;
  /** The fabricator's price for the job, and the markup on it. */
  price: number;
  markup: number;
  notes?: string;
}

export const metalForms: Record<MetalForm, { label: string; hint: string }> = {
  u: { label: 'U legs', hint: 'An upside-down U at each end, joined by rails under the top' },
  sled: { label: 'Sled legs', hint: 'A closed rectangle at each end that sits on the floor, joined by rails' },
  x: { label: 'X ends', hint: 'An X at each end, joined by rails under the top' },
  trapezoid: { label: 'Trapezoid ends', hint: 'Ends wider at the floor than the top, joined by rails' },
  hairpin: { label: 'Hairpin legs', hint: 'Four rod legs, two rods each meeting at the floor, on mounting plates' },
  box: { label: 'Box frame', hint: 'Four posts with a rectangle at the top and the floor' },
  pedestal: { label: 'Pedestal', hint: 'A center column on a floor plate, with a plate under the top' },
};
export const metalFinishes: Record<MetalBase['finish'], string> = { powder: 'Powder coat', blackened: 'Blackened steel, clear coat', raw: 'Raw steel, clear coat', painted: 'Painted' };

export const newMetalBase = (): MetalBase => ({ form: 'u', stock: 'square', size: 2, wall: 0.125, finish: 'powder', color: 'Black', inset: 3, price: 0, markup: 0.25 });

export type P3 = [number, number, number];
export interface MetalMember { name: string; a: P3; b: P3 }
export interface MetalPlate { name: string; min: P3; size: P3 }

const stockLabel = (m: MetalBase) => {
  const f = (v: number) => `${+v.toFixed(3)}"`;
  if (m.form === 'hairpin') return `${f(Math.min(m.size, 0.625))} round rod`;
  return m.stock === 'square' ? `${f(m.size)} square tube, ${f(m.wall)} wall` : m.stock === 'round' ? `${f(m.size)} round tube, ${f(m.wall)} wall` : `${f(m.size)} × ${f(m.wall)} flat bar`;
};
export const metalStockLabel = stockLabel;

/**
 * The base's members as centerlines, and any plates, for a top of length L and width W whose
 * underside is at y = topY. The base's footprint is the top less the inset (smaller under a round top).
 */
export function metalMembers(m: MetalBase, L: number, W: number, topY: number, round = false): { members: MetalMember[]; plates: MetalPlate[] } {
  const s = m.form === 'hairpin' ? Math.min(m.size, 0.625) : m.size;
  // Under a round or oval top the ends stand 60% of the way out, where the curve is still 80% as wide
  const fx = Math.max(4, (round ? (L / 2) * 0.6 : L / 2 - m.inset) - s / 2), fz = Math.max(4, (round ? (W / 2) * 0.8 : W / 2) - m.inset - s / 2);
  const top = topY - s / 2, bot = s / 2;
  const members: MetalMember[] = [];
  const plates: MetalPlate[] = [];
  const add = (name: string, a: P3, b: P3) => members.push({ name, a, b });
  const rails = () => { for (const z of [-fz, fz]) add('Long rail', [-fx, top, z], [fx, top, z]); };
  switch (m.form) {
    case 'u':
    case 'sled':
      for (const x of [-fx, fx]) {
        for (const z of [-fz, fz]) add('Leg', [x, 0, z], [x, top, z]);
        add('End rail, top', [x, top, -fz], [x, top, fz]);
        if (m.form === 'sled') add('End rail, floor', [x, bot, -fz], [x, bot, fz]);
      }
      rails();
      break;
    case 'x':
      for (const x of [-fx, fx]) {
        add('X leg', [x, bot, -fz], [x, top, fz]);
        add('X leg', [x, bot, fz], [x, top, -fz]);
        add('End rail, top', [x, top, -fz], [x, top, fz]);
      }
      rails();
      break;
    case 'trapezoid': {
      const tz = fz * 0.6;
      for (const x of [-fx, fx]) {
        add('Splayed leg', [x, bot, -fz], [x, top, -tz]);
        add('Splayed leg', [x, bot, fz], [x, top, tz]);
        add('End rail, top', [x, top, -tz], [x, top, tz]);
        add('End rail, floor', [x, bot, -fz], [x, bot, fz]);
      }
      for (const z of [-tz, tz]) add('Long rail', [-fx, top, z], [fx, top, z]);
      break;
    }
    case 'hairpin':
      for (const x of [-fx, fx]) for (const z of [-fz, fz]) {
        // Two rods from the plate down to a point at the floor, spread along the length
        add('Hairpin rod', [x - 2, top, z], [x, 0, z]);
        add('Hairpin rod', [x + 2, top, z], [x, 0, z]);
        plates.push({ name: 'Mounting plate', min: [x - 2.5, topY - 0.25, z - 2.5], size: [5, 0.25, 5] });
      }
      break;
    case 'box':
      for (const x of [-fx, fx]) for (const z of [-fz, fz]) add('Post', [x, 0, z], [x, top, z]);
      for (const y of [top, bot]) {
        for (const z of [-fz, fz]) add(y === top ? 'Long rail, top' : 'Long rail, floor', [-fx, y, z], [fx, y, z]);
        for (const x of [-fx, fx]) add(y === top ? 'End rail, top' : 'End rail, floor', [x, y, -fz], [x, y, fz]);
      }
      break;
    case 'pedestal': {
      const plate = Math.min(L, W) * (round ? 0.55 : 0.5);
      add('Column', [0, 0.5, 0], [0, topY - 0.375, 0]);
      plates.push({ name: 'Floor plate', min: [-plate / 2, 0, -plate / 2], size: [plate, 0.5, plate] });
      const tp = Math.min(plate * 0.8, Math.min(L, W) - 2 * m.inset);
      plates.push({ name: 'Top plate', min: [-tp / 2, topY - 0.375, -tp / 2], size: [tp, 0.375, tp] });
      break;
    }
  }
  return { members, plates };
}

const len = (x: MetalMember) => Math.hypot(x.b[0] - x.a[0], x.b[1] - x.a[1], x.b[2] - x.a[2]);
const r16 = (v: number) => Math.round(v * 16) / 16;

/** The fabricator's cut list: members grouped by stock and length (centerline lengths, to confirm at the shop). */
export function metalCutList(m: MetalBase, members: MetalMember[], plates: MetalPlate[]): { what: string; stock: string; qty: number; length: number; angle?: number }[] {
  const out = new Map<string, { what: string; stock: string; qty: number; length: number; angle?: number }>();
  for (const x of members) {
    const l = r16(len(x));
    const dy = Math.abs(x.b[1] - x.a[1]);
    const angle = dy > 0.01 && dy < l - 0.01 ? Math.round((Math.asin(dy / l) * 180) / Math.PI) : undefined;
    const key = `${x.name}|${l}|${angle ?? ''}`;
    const row = out.get(key);
    if (row) row.qty++; else out.set(key, { what: x.name, stock: stockLabel(m), qty: 1, length: l, ...(angle != null ? { angle } : {}) });
  }
  for (const p of plates) {
    const key = `${p.name}|${p.size.join('x')}`;
    const row = out.get(key);
    if (row) row.qty++; else out.set(key, { what: p.name, stock: `${+p.size[1].toFixed(3)}" plate, ${r16(p.size[0])}" × ${r16(p.size[2])}"`, qty: 1, length: 0 });
  }
  return [...out.values()];
}

/** Total lineal feet of stock, for the drawing's notes. */
export const metalFeet = (members: MetalMember[]) => members.reduce((t, x) => t + len(x), 0) / 12;
