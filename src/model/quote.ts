// Quoting: material cost from the design, labor hours from standard times, and the shop's two
// pricing methods side by side. Every number traces back to the design or a setting.
import type { Cabinet, Project } from './types';
import { buildParts, eff } from './parts';
import { resolveEnds } from './layout';
import { defaultCutlist, optimizerParts } from './cutlist';
import { optimize } from './optimizer';
import { defaultFaceFrameStock, faceFrameNeeds, faceFramePieces, woodNeeds, woodPieces } from './faceframe';
import { moldLabel, moldingOrder, roomKinds, type MoldKind } from './moldings';
import { panelOrder } from './panels';
import { uid } from './defaults';
import { eaglePrice, hingeTypes } from './eagle';
import { hardwareOrder } from './hardware';
import { defaultSupplies, supplyLines, type SupplyGroup, type SupplyItem } from './supplies';

/** Shop hours per item. Start from these and calibrate against tracked jobs. */
export interface LaborStandards {
  jobSetup: number;
  perBox: number;
  tallBox: number;
  faceFrame: number;
  perOpening: number;
  perDoor: number;
  perDrawer: number;
  insetFactor: number;
  perShelf: number;
  endPanel: number;
  extendedStile: number;
  woodTop: number;
  woodTopPerSqFt: number;
  moldingPerFt: number;
  beadboardPerSqFt: number;
  installPerBox: number;
  /** Build one pilaster: box, panels, plinth, bands and capital. */
  pilaster: number;
  installPilaster: number;
  floatingShelf: number;
  installFloatingShelf: number;
  installTall: number;
  installDay: number;
  moldingInstallPerFt: number;
  pullInstall: number;
}

export const defaultStandards: LaborStandards = {
  jobSetup: 3,
  perBox: 2,
  tallBox: 1,
  faceFrame: 1,
  perOpening: 0.15,
  perDoor: 0.3,
  perDrawer: 0.6,
  insetFactor: 1.6,
  perShelf: 0.2,
  endPanel: 0.5,
  extendedStile: 0.25,
  woodTop: 1.5,
  woodTopPerSqFt: 0.15,
  moldingPerFt: 0.05,
  beadboardPerSqFt: 0.06,
  installPerBox: 1,
  pilaster: 2,
  installPilaster: 0.5,
  floatingShelf: 1.5,
  installFloatingShelf: 0.75,
  installTall: 0.5,
  installDay: 1,
  moldingInstallPerFt: 0.15,
  pullInstall: 0.15,
};

export type Workload = 'full' | 'normal' | 'light';

export interface QuoteExtra { id: string; label: string; hours: number; amount: number }

export interface QuoteSettings {
  laborCost: number;
  method: 'multiplier' | 'rate';
  multiplier: number;
  billRate: number;
  materialMarkup: number;
  workload: Workload;
  workloadAdj: Record<Workload, number>;
  /** Purchased parts not yet in the app's price lists. */
  /** Up or down from the fitted Eagle prices, for a price increase or a pricier species. 0.05 = 5%. */
  eagleAdjust: number;
  beadboardSheet: number;
  /** Screws, glue, banding, abrasives and install sundries. */
  supplies: SupplyItem[];
  installPulls: boolean;
  painter: number;
  painterMarkup: number;
  extras: QuoteExtra[];
  /** Your final call, added to the calculated price. */
  adjustment: number;
  roundTo: number;
  standards: LaborStandards;
}

export const defaultQuote: QuoteSettings = {
  laborCost: 65,
  method: 'multiplier',
  multiplier: 1.85,
  billRate: 110,
  materialMarkup: 0.25,
  workload: 'normal',
  workloadAdj: { full: 0.08, normal: 0, light: -0.06 },
  eagleAdjust: 0,
  beadboardSheet: 0,
  supplies: defaultSupplies,
  installPulls: true,
  painter: 0,
  painterMarkup: 0,
  extras: [],
  adjustment: 0,
  roundTo: 10,
  standards: defaultStandards,
};

export const quoteOf = (p: Project): QuoteSettings => {
  const q = { ...defaultQuote, ...p.quote };
  return { ...q, standards: { ...defaultStandards, ...p.quote?.standards }, workloadAdj: { ...defaultQuote.workloadAdj, ...p.quote?.workloadAdj } };
};

export type Group = 'cabinets' | 'tops' | 'paneling' | 'room';
export const groupLabel: Record<Group, string> = { cabinets: 'Cabinets', tops: 'Solid wood tops & seats', paneling: 'Wall paneling', room: 'Room trim' };
const moldGroup = (kinds: MoldKind[]): Group => (kinds.includes('cap') ? 'paneling' : kinds.every((k) => roomKinds.includes(k)) ? 'room' : 'cabinets');

export interface HourLine { group: Group; label: string; qty: number; each: number; hours: number; install?: boolean }
export interface MaterialLine { group: Group; label: string; cost: number; detail: string; missing?: string }

const sqft = (w: number, h: number) => (w * h) / 144;

/** Labor hours from the design, using standard times. */
export function estimateHours(p: Project, q: QuoteSettings): HourLine[] {
  const st = q.standards;
  const counts: Record<string, { label: string; group: Group; qty: number; each: number; install?: boolean }> = {};
  const add = (label: string, qty: number, each: number, group: Group = 'cabinets', install = false) => {
    if (!qty) return;
    const k = `${group}|${label}|${each}|${install}`;
    counts[k] = counts[k] ?? { label, group, qty: 0, each, install };
    counts[k].qty += qty;
  };
  if (p.cabinets.length || (p.panels ?? []).length) add('Drawings, ordering & setup', 1, st.jobSetup);
  let installHours = 0;
  for (const c of p.cabinets) {
    if (c.kind === 'shelf') {
      add('Floating shelves: miter fold & glue-up', 1, st.floatingShelf);
      add('Install floating shelves', 1, st.installFloatingShelf, 'cabinets', true);
      installHours += st.installFloatingShelf;
      continue;
    }
    if (c.kind === 'pilaster') {
      add('Pilasters: box, panels, plinth & capital', 1, st.pilaster);
      add('Install pilasters', 1, st.installPilaster, 'cabinets', true);
      installHours += st.installPilaster;
      continue;
    }
    const s = eff(c, p.settings);
    const parts = buildParts(c, p.settings, resolveEnds(p.room, p.cabinets, c));
    const tall = c.height > 60;
    const inset = s.doorMount === 'inset' ? st.insetFactor : 1;
    const n = (role: string) => parts.filter((x) => x.role === role).length;
    add('Case', 1, st.perBox);
    if (tall) add('Tall case (extra)', 1, st.tallBox);
    add('Face frame', 1, st.faceFrame);
    add('Face frame openings', c.rows.length + (c.corner ? 1 : 0), st.perOpening);
    add(inset > 1 ? 'Doors, inset (fit & hang)' : 'Doors (fit & hang)', n('door'), st.perDoor * inset);
    add(inset > 1 ? 'Drawers, inset (slides & fronts)' : 'Drawers (slides & fronts)', n('drawerBox') + parts.filter((x) => x.name === 'False front').length * 0.5, st.perDrawer * inset);
    add('Shelves', n('shelf'), st.perShelf);
    add('End panels', n('endPanel'), st.endPanel);
    add('Extended stiles', parts.filter((x) => x.name === 'Stile, extended').length, st.extendedStile);
    for (const t of parts.filter((x) => x.role === 'woodTop')) {
      add('Glue-up & finish tops', 1, st.woodTop, 'tops');
      add('Top area (sq ft)', Math.round(sqft(t.length, t.width) * 10) / 10, st.woodTopPerSqFt, 'tops');
      add('Install tops', 1, 0.5, 'tops', true);
    }
    const box = st.installPerBox + (tall ? st.installTall : 0);
    add('Install cabinets', 1, box, 'cabinets', true);
    installHours += box;
    if (q.installPulls) add('Install pulls & knobs', n('door') + n('drawerFront'), st.pullInstall, 'cabinets', true);
  }
  for (const m of moldingOrder(p)) {
    const ft = Math.round((m.inches / 12) * 10) / 10;
    const group = moldGroup(m.kinds);
    add('Mouldings: cut & prep (ft)', ft, st.moldingPerFt, group);
    add('Mouldings: install (ft)', ft, st.moldingInstallPerFt, group, true);
    installHours += ft * st.moldingInstallPerFt;
  }
  for (const w of p.panels ?? []) {
    const a = Math.round(sqft(w.width, w.height) * 10) / 10;
    add('Beadboard: cut & install (sq ft)', a, st.beadboardPerSqFt, 'paneling', true);
  }
  // Load-in, protection and cleanup for each install day
  const days = Math.max(installHours > 0 ? 1 : 0, Math.ceil(installHours / 7));
  add('Install days: load-in, protection, cleanup', days, st.installDay, 'cabinets', true);
  return Object.values(counts).map((v) => ({ group: v.group, label: v.label, qty: v.qty, each: v.each, hours: v.qty * v.each, install: v.install }));
}

/** Material cost from the design at what the shop pays, before tax. */
export function estimateMaterials(p: Project, q: QuoteSettings): MaterialLine[] {
  const out: MaterialLine[] = [];
  const data = p.cutlist ?? defaultCutlist(p);
  const sheets = optimize(optimizerParts(p, data), data.stock, data.options);
  for (const m of sheets) {
    const cost = m.sheets.reduce((t, sh) => t + sh.stock.price, 0);
    out.push({ group: 'cabinets', label: `${m.material} sheets`, cost, detail: `${m.sheets.length} sheets`, missing: cost ? undefined : 'Enter a price per sheet on the Sheet cutlist tab' });
  }
  const ffStock = { ...defaultFaceFrameStock, ...p.faceFrame };
  const ff = faceFrameNeeds(faceFramePieces(p), ffStock);
  if (ff.groups.length) {
    out.push({ group: 'cabinets', label: `Face frame stock (${ffStock.species})`, cost: ff.buyBF * ffStock.pricePerBF, detail: `${Math.ceil(ff.buyBF)} BF`, missing: ffStock.pricePerBF ? undefined : 'Enter $/BF on the Solid wood tab' });
  }
  const wood = woodNeeds(woodPieces(p), ffStock);
  const woodBF = wood.reduce((t, g) => t + g.buyBF, 0);
  if (woodBF) out.push({ group: 'tops', label: 'Solid wood for tops, seats & caps', cost: woodBF * ffStock.pricePerBF, detail: `${Math.ceil(woodBF)} BF`, missing: ffStock.pricePerBF ? undefined : 'Enter $/BF on the Solid wood tab' });

  let fronts = 0, frontCost = 0, frontArea = 0, doors = 0, drawers = 0, boxCost = 0;
  const hingeKinds = new Set<string>();
  const k = 1 + q.eagleAdjust;
  for (const c of p.cabinets) {
    for (const part of buildParts(c, p.settings, resolveEnds(p.room, p.cabinets, c))) {
      const o = part.order;
      if (!o) continue;
      if (o.item === 'drawerBox') {
        drawers++;
        boxCost += eaglePrice('drawerBox', o.w, o.h, o.d ?? 0) * k;
      } else {
        fronts++;
        frontArea += sqft(o.w, o.h);
        frontCost += eaglePrice(o.item, o.w, o.h) * k;
        if (o.item === 'door') {
          doors++;
          hingeKinds.add(hingeTypes[eff(c, p.settings).hingeType].name);
        }
      }
    }
  }
  if (fronts) out.push({ group: 'cabinets', label: 'Eagle doors, fronts & end panels', cost: frontCost, detail: `${fronts} pcs, ${frontArea.toFixed(1)} sq ft` });
  if (drawers) out.push({ group: 'cabinets', label: 'Eagle dovetail drawer boxes', cost: boxCost, detail: `${drawers} boxes` });
  const hw = hardwareOrder(p);
  const hwCost = (g: 'hinges' | 'slides') => hw.lines.filter((l) => l.group === g).reduce((t, l) => t + l.total, 0);
  const hwMissing = (g: 'hinges' | 'slides') => hw.problems.filter((x) => x.group === g).map((x) => x.text).join('; ') || undefined;
  if (hw.hinges) out.push({ group: 'cabinets', label: `Hinges (${[...hingeKinds].join(' & ')})`, cost: hwCost('hinges'), detail: `${hw.hinges} hinges on ${doors} doors`, missing: hwMissing('hinges') });
  if (hw.drawers) out.push({ group: 'cabinets', label: 'Blum Tandem slides & locking devices', cost: hwCost('slides'), detail: `${hw.drawers} drawers`, missing: hwMissing('slides') });
  for (const m of moldingOrder(p)) {
    out.push({ group: moldGroup(m.kinds), label: `A&M ${m.num} ${m.kinds.every((k) => roomKinds.includes(k)) ? m.kinds.map((k) => moldLabel[k].toLowerCase()).join(' & ') : 'moulding'}`, cost: m.cost, detail: `${m.feet} lin ft`, missing: m.price == null ? 'No A&M price' : undefined });
  }
  const bb = (p.panels ?? []).map(panelOrder).reduce((t, l) => t + (l.item.startsWith('4×8') ? l.qty : 0), 0);
  if (bb) out.push({ group: 'paneling', label: 'Nantucket beadboard sheets', cost: bb * q.beadboardSheet, detail: `${bb} sheets`, missing: q.beadboardSheet ? undefined : 'Enter your beadboard sheet price' });
  const groups: [SupplyGroup, string][] = [['cabinets', 'Shop supplies: screws, glue, banding, abrasives'], ['tops', 'Shop supplies for tops'], ['paneling', 'Shop supplies for paneling']];
  const sup = supplyLines(p, q.supplies);
  for (const [g, label] of groups) {
    const mine = sup.filter((l) => l.group === g && l.qty > 0);
    if (mine.length) out.push({ group: g, label, cost: mine.reduce((t, l) => t + l.cost, 0), detail: `${mine.length} items` });
  }
  return out;
}

export interface GroupPrice { group: Group; hours: number; materials: number; methodA: number; methodB: number; price: number }

export interface QuoteResult {
  hours: HourLine[];
  materials: MaterialLine[];
  tax: number;
  groups: GroupPrice[];
  extras: { label: string; price: number }[];
  painter: number;
  /** Before workload, adjustment and rounding. */
  calculated: number;
  workloadAmount: number;
  total: number;
  shopHours: number;
  installHours: number;
  materialCost: number;
  /** What the job costs you: materials with tax plus hours at your labor cost. */
  cost: number;
}

export function priceQuote(p: Project): QuoteResult {
  const q = quoteOf(p);
  const tax = p.settings.purchaseTax;
  const hours = estimateHours(p, q);
  const materials = estimateMaterials(p, q);
  const price = (h: number, m: number) => {
    const mt = m * (1 + tax);
    const a = (mt + h * q.laborCost) * q.multiplier;
    const b = h * q.billRate + mt * (1 + q.materialMarkup);
    return { a, b, chosen: q.method === 'multiplier' ? a : b };
  };
  const groups = (['cabinets', 'tops', 'paneling', 'room'] as Group[])
    .map((g) => {
      const h = hours.filter((x) => x.group === g).reduce((t, x) => t + x.hours, 0);
      const m = materials.filter((x) => x.group === g).reduce((t, x) => t + x.cost, 0);
      const pr = price(h, m);
      return { group: g, hours: h, materials: m, methodA: pr.a, methodB: pr.b, price: pr.chosen };
    })
    .filter((g) => g.hours || g.materials);
  const extras = q.extras.map((e) => ({ label: e.label, price: price(e.hours, 0).chosen + e.amount }));
  const painter = q.painter * (1 + q.painterMarkup);
  const work = groups.reduce((t, g) => t + g.price, 0) + extras.reduce((t, e) => t + e.price, 0);
  const workloadAmount = work * q.workloadAdj[q.workload];
  const calculated = work + painter;
  const raw = calculated + workloadAmount + q.adjustment;
  const total = q.roundTo > 0 ? Math.round(raw / q.roundTo) * q.roundTo : raw;
  const materialCost = materials.reduce((t, m) => t + m.cost, 0) * (1 + tax);
  const allHours = hours.reduce((t, h) => t + h.hours, 0) + q.extras.reduce((t, e) => t + e.hours, 0);
  return {
    hours, materials, tax, groups, extras, painter, calculated, workloadAmount, total,
    shopHours: hours.filter((h) => !h.install).reduce((t, h) => t + h.hours, 0),
    installHours: hours.filter((h) => h.install).reduce((t, h) => t + h.hours, 0),
    materialCost,
    cost: materialCost + allHours * q.laborCost + q.painter + q.extras.reduce((t, e) => t + e.amount, 0),
  };
}

export const newExtra = (): QuoteExtra => ({ id: uid('extra'), label: 'Additional work', hours: 4, amount: 0 });

/** The scope line for one cabinet, in the wording the shop uses on its quotes. */
export function scopeLine(c: Cabinet, p: Project): string {
  if (c.kind === 'shelf') return `${c.name}: Floating shelf, approx ${fmtIn(c.width)}W x ${fmtIn(c.depth)}D x ${fmtIn(c.height)} thick; mitered ${(c.floating?.grade ?? 'paint') === 'paint' ? 'paint grade' : 'stain grade'} construction with concealed bracket`;
  if (c.kind === 'pilaster') return `${c.name}: Pilaster, approx ${fmtIn(c.width)}W x ${fmtIn(c.height)}H; recessed panel face with plinth and capital${c.crown ? '; crown molding' : ''}${c.baseMold ? '; baseboard' : ''}; paint grade`;
  const s = eff(c, p.settings);
  const parts = buildParts(c, p.settings, resolveEnds(p.room, p.cabinets, c));
  const n = (role: string) => parts.filter((x) => x.role === role).length;
  const inset = s.doorMount === 'inset' ? 'inset ' : 'overlay ';
  const bits: string[] = [];
  const W = c.corner ? `${fmtIn(c.width)} x ${fmtIn(c.corner.width2)}` : fmtIn(c.width);
  bits.push(`Approx: ${W}W x ${fmtIn(c.height)}H x ${fmtIn(c.depth)}D`);
  if (n('door')) bits.push(`(${n('door')}) ${inset}door${n('door') > 1 ? 's' : ''}`);
  if (n('drawerBox')) bits.push(`(${n('drawerBox')}) drawer${n('drawerBox') > 1 ? 's' : ''} with dovetail drawer boxes and soft close slides`);
  if (n('shelf')) bits.push(`(${n('shelf')}) adjustable shel${n('shelf') > 1 ? 'ves' : 'f'}`);
  if (n('endPanel')) bits.push(`(${n('endPanel')}) finished end panel${n('endPanel') > 1 ? 's' : ''}`);
  if (c.countertop && c.topKind === 'wood') bits.push(`${fmtIn(c.topThickness ?? 1.25)} thick solid wood top`);
  if (c.crown) bits.push('crown molding');
  if (c.lightRail) bits.push('light rail');
  if (c.baseMold) bits.push('baseboard');
  bits.push('prefinished birch plywood interior with paint grade exterior');
  return `${c.name}: ${bits.join('; ')}`;
}

function fmtIn(v: number) {
  const s = Math.round(v * 16);
  const whole = Math.floor(s / 16);
  let r = s % 16;
  if (!r) return `${whole}”`;
  let d = 16;
  while (r % 2 === 0) { r /= 2; d /= 2; }
  return whole ? `${whole}-${r}/${d}”` : `${r}/${d}”`;
}
