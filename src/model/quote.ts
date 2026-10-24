// Quoting: material cost from the design, labor hours from standard times, and the shop's two
// pricing methods side by side. Every number traces back to the design or a setting.
import type { Cabinet, Project } from './types';
import { buildParts, eff } from './parts';
import { resolveEnds } from './layout';
import { defaultCutlist, optimizerParts } from './cutlist';
import { optimize } from './optimizer';
import { defaultFaceFrameStock, faceFrameNeeds, faceFramePieces, otherSpecies, stockFor, woodNeeds, woodPieces } from './faceframe';
import { ceilingKinds, moldLabel, moldingOrder, profileByNum, profileLabel, roomKinds, type MoldKind } from './moldings';
import { cofferFeet, cofferLayout, cofferMoldings, cofferOf } from './coffer';
import { panelOrder } from './panels';
import { uid } from './defaults';
import { eaglePrice, hingeTypes } from './eagle';
import { hardwareOrder } from './hardware';
import { bracketCount, bracketLength, bracketProduct, finishedEnds } from './floatingShelf';
import { doorOrder } from './doorOrder';
import { baseLabel } from './cabinetBase';
import { defaultSupplies, supplyLines, type SupplyGroup, type SupplyItem } from './supplies';
import { applianceKinds } from './appliances';

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
  shelfFront: number;
  /** Old shop-built beams; the stock now comes prepped from the millwork supplier. Kept for saved jobs. */
  cofferBeamPerFt?: number;
  /** Coffered ceiling (Pope library worksheet): layout and prep per ceiling, beams and perimeter fascia per ft, crown per coffer. */
  cofferLayout: number;
  cofferInstallPerFt: number;
  cofferCrownPerCoffer: number;
  cofferPrepPerCoffer: number;
  basePiece: number;
  archCut: number;
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
  /** Each finished end on a floating shelf: the end cap, its miters and the extra sanding. */
  shelfFinishedEnd: number;
  installFloatingShelf: number;
  /** Hang an interior door: a prehung unit, plus extra to fit a slab into an existing jamb. */
  installDoor: number;
  hangSlab: number;
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
  shelfFront: 0.15,
  cofferLayout: 6,
  cofferInstallPerFt: 0.27,
  cofferCrownPerCoffer: 3.5,
  cofferPrepPerCoffer: 0.67,
  basePiece: 0.25,
  archCut: 0.5,
  endPanel: 0.5,
  extendedStile: 0.25,
  woodTop: 1.5,
  woodTopPerSqFt: 0.15,
  moldingPerFt: 0.05,
  beadboardPerSqFt: 0.06,
  installPerBox: 1,
  pilaster: 2,
  installPilaster: 0.5,
  floatingShelf: 1.25,
  shelfFinishedEnd: 0.5,
  installFloatingShelf: 0.75,
  installDoor: 1.5,
  hangSlab: 1,
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
  /** Floating shelf brackets: price of a pack (8 to a pack). */
  shelfBracketPack: number;
  beadboardSheet: number;
  /** Coffered ceiling stock bought prepped from the millwork supplier, and blocking/fasteners, per ft of beam and perimeter. */
  cofferStockPerFt: number;
  cofferSundriesPerFt: number;
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
  shelfBracketPack: 16.16,
  beadboardSheet: 0,
  cofferStockPerFt: 16,
  cofferSundriesPerFt: 4.4,
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

export type Group = 'cabinets' | 'tops' | 'paneling' | 'room' | 'ceiling';
export const groupLabel: Record<Group, string> = { cabinets: 'Cabinets', tops: 'Solid wood tops & seats', paneling: 'Wall paneling', room: 'Room trim', ceiling: 'Coffered ceiling' };
const moldGroup = (kinds: MoldKind[]): Group => (kinds.includes('cap') ? 'paneling' : kinds.every((k) => ceilingKinds.includes(k)) ? 'ceiling' : kinds.every((k) => roomKinds.includes(k)) ? 'room' : 'cabinets');

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
      add('Floating shelves: finished ends', finishedEnds(resolveEnds(p.room, p.cabinets, c)), st.shelfFinishedEnd);
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
    const baseTrim = parts.filter((x) => /^(Baseboard|Skirt|End skirt)/.test(x.name));
    add('Baseboard / skirt pieces (fit & miter)', baseTrim.length, st.basePiece ?? 0.25);
    add('Arched cuts (layout & cut)', parts.filter((x) => (x.note ?? '').startsWith('Cut ') && /feet|arch/i.test(x.note ?? '')).length, st.archCut ?? 0.5);
    add('Applied shelf fronts', parts.filter((x) => x.name === 'Shelf front').length, st.shelfFront ?? 0.15);
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
  const cc = cofferOf(p);
  const cm = cc.on ? cofferMoldings(p, cc) : null;
  for (const m of moldingOrder(p)) {
    // Coffer crown and picture moulding are priced per coffer below, not per foot
    const perCoffer = cm ? (cc.crown === m.num ? cm.crown : 0) + (cc.perimeter && cc.picture === m.num ? cm.picture : 0) : 0;
    const ft = Math.round((Math.max(0, m.inches - perCoffer) / 12) * 10) / 10;
    if (ft <= 0) continue;
    const group = moldGroup(m.kinds);
    add('Mouldings: cut & prep (ft)', ft, st.moldingPerFt, group);
    add('Mouldings: install (ft)', ft, st.moldingInstallPerFt, group, true);
    installHours += ft * st.moldingInstallPerFt;
  }
  for (const d of doorOrder(p)) {
    const n = d.qty * d.leaves;
    add('Install interior doors', n, st.installDoor, 'room', true);
    if (!d.prehung) add('Fit & hang slab doors', n, st.hangSlab, 'room', true);
    installHours += n * (st.installDoor + (d.prehung ? 0 : st.hangSlab));
  }
  for (const w of p.panels ?? []) {
    const a = Math.round(sqft(w.width, w.height) * 10) / 10;
    add('Beadboard: cut & install (sq ft)', a, st.beadboardPerSqFt, 'paneling', true);
  }
  if (cc.on && cm) {
    const f = cofferFeet(p, cc);
    const ft = Math.round((f.beams + f.perimeter) * 10) / 10;
    const ins = (label: string, qty: number, each: number) => { add(label, qty, each, 'ceiling', true); installHours += qty * each; };
    // The beam stock comes prepped from the millwork supplier, so it's all site labor
    ins('Coffers: layout, crown removal & prep', 1, st.cofferLayout ?? 6);
    ins('Coffer beams & perimeter fascia: build & install (ft)', ft, st.cofferInstallPerFt ?? 0.27);
    if (cc.crown) ins('Crown in each coffer (incl. picture moulding)', cm.count, st.cofferCrownPerCoffer ?? 3.5);
    ins('Coffers: joinery & paint-ready prep', cm.count, st.cofferPrepPerCoffer ?? 0.67);
    if (cc.beadboard) {
      const a = Math.round(cofferMoldings(p, cc).fieldSqFt * 10) / 10;
      add('Beadboard in the coffers (sq ft)', a, st.beadboardPerSqFt * 1.5, 'ceiling', true);
      installHours += a * st.beadboardPerSqFt * 1.5;
    }
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
  for (const sp of otherSpecies(p)) {
    const st = stockFor(p, sp);
    const pieces = faceFramePieces(p, sp, { ceiling: false });
    if (!pieces.length) continue;
    const need = faceFrameNeeds(pieces, st);
    out.push({ group: 'cabinets', label: `${sp} stock (pilasters)`, cost: need.buyBF * st.pricePerBF, detail: `${Math.ceil(need.buyBF)} BF`, missing: st.pricePerBF ? undefined : `Enter $/BF for ${sp.toLowerCase()} on the Solid wood tab` });
  }
  // The coffered ceiling: stock bought prepped from the millwork supplier, by the foot of beam
  if (cofferOf(p).on) {
    const f = cofferFeet(p);
    const ft = Math.ceil(f.beams + f.perimeter);
    out.push({ group: 'ceiling', label: 'Prepped beam & fascia stock (millwork supplier)', cost: ft * q.cofferStockPerFt, detail: `${ft} ft of beam`, missing: q.cofferStockPerFt ? undefined : 'Enter the millwork price per foot of beam' });
    out.push({ group: 'ceiling', label: '2x nailers, blocking, adhesive & fasteners', cost: ft * q.cofferSundriesPerFt, detail: `${ft} ft of beam` });
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
  // Brackets by length: a 12" shelf takes the 10" bracket
  const byLen = new Map<number, number>();
  for (const c of p.cabinets) if (c.kind === 'shelf') byLen.set(bracketLength(c), (byLen.get(bracketLength(c)) ?? 0) + bracketCount(c));
  const brackets = [...byLen.values()].reduce((t, n) => t + n, 0);
  // Bought in packs of 8 for each rod length
  const packs = [...byLen.values()].reduce((t, n) => t + Math.ceil(n / bracketProduct.perPack), 0);
  if (brackets) out.push({ group: 'cabinets', label: 'Floating shelf brackets', cost: packs * q.shelfBracketPack, detail: `${[...byLen].map(([l, n]) => `${n} × ${l}"`).join(', ')}; ${packs} pack${packs > 1 ? 's' : ''} of ${bracketProduct.perPack}`, missing: q.shelfBracketPack ? undefined : 'Enter your bracket pack price' });
  const hw = hardwareOrder(p);
  const hwCost = (g: 'hinges' | 'slides') => hw.lines.filter((l) => l.group === g).reduce((t, l) => t + l.total, 0);
  const hwMissing = (g: 'hinges' | 'slides') => hw.problems.filter((x) => x.group === g).map((x) => x.text).join('; ') || undefined;
  if (hw.hinges) out.push({ group: 'cabinets', label: `Hinges (${[...hingeKinds].join(' & ')})`, cost: hwCost('hinges'), detail: `${hw.hinges} hinges on ${doors} doors`, missing: hwMissing('hinges') });
  if (hw.drawers) out.push({ group: 'cabinets', label: 'Blum Tandem slides & locking devices', cost: hwCost('slides'), detail: `${hw.drawers} drawers`, missing: hwMissing('slides') });
  for (const m of moldingOrder(p)) {
    out.push({ group: moldGroup(m.kinds), label: `${profileLabel(m.profile)} ${m.kinds.every((k) => roomKinds.includes(k)) ? m.kinds.map((k) => moldLabel[k].toLowerCase()).join(' & ') : 'moulding'}`, cost: m.cost, detail: `${m.feet} lin ft`, missing: m.price == null ? (m.supplier === 'brosco' ? 'Enter the Brosco price per foot on the Orders tab' : 'No A&M price') : undefined });
  }
  const reeb = doorOrder(p);
  if (reeb.length) {
    const unpriced = reeb.filter((d) => d.price == null);
    out.push({ group: 'room', label: 'Reeb interior doors', cost: reeb.reduce((t, d) => t + d.cost, 0), detail: `${reeb.reduce((t, d) => t + d.qty, 0)} doors`, missing: unpriced.length ? `Enter Reeb prices on the Orders tab (${unpriced.map((d) => d.key).join(', ')})` : undefined });
  }
  const bb = (p.panels ?? []).map(panelOrder).reduce((t, l) => t + (l.item.startsWith('4×8') ? l.qty : 0), 0);
  if (bb) out.push({ group: 'paneling', label: 'Nantucket beadboard sheets', cost: bb * q.beadboardSheet, detail: `${bb} sheets`, missing: q.beadboardSheet ? undefined : 'Enter your beadboard sheet price' });
  const cc = cofferOf(p);
  if (cc.on && cc.beadboard) {
    const sheets = Math.ceil((cofferMoldings(p, cc).fieldSqFt * 1.15) / 32);
    if (sheets) out.push({ group: 'ceiling', label: 'Beadboard sheets for the coffers', cost: sheets * q.beadboardSheet, detail: `${sheets} sheets`, missing: q.beadboardSheet ? undefined : 'Enter your beadboard sheet price' });
  }
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
  const groups = (['cabinets', 'tops', 'paneling', 'room', 'ceiling'] as Group[])
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
  if (c.kind === 'shelf') {
    const n = finishedEnds(resolveEnds(p.room, p.cabinets, c));
    return `${c.name}: Floating shelf, approx ${fmtIn(c.width)}W x ${fmtIn(c.depth)}D x ${fmtIn(c.height)} thick; mitered ${(c.floating?.grade ?? 'paint') === 'paint' ? 'paint grade' : 'stain grade'} construction with concealed bracket; ${n === 2 ? 'both ends finished' : n === 1 ? 'one end finished, one against the wall' : 'fits wall to wall'}`;
  }
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
  const adj = parts.filter((x) => x.role === 'shelf' && x.name === 'Adjustable shelf').length;
  if (adj) bits.push(`(${adj}) adjustable shel${adj > 1 ? 'ves' : 'f'}`);
  for (const r of c.rows) if (r.type === 'appliance' && r.appliance) bits.push(`${r.appliance.mount === 'shelf' ? 'open space' : 'built-in opening'} for owner's ${applianceKinds[r.appliance.kind].short.toLowerCase()}`);
  if (n('endPanel')) bits.push(`(${n('endPanel')}) finished end panel${n('endPanel') > 1 ? 's' : ''}`);
  if (c.countertop && c.topKind === 'wood') bits.push(`${fmtIn(c.topThickness ?? 1.25)} thick solid wood top`);
  if (c.crown) bits.push('crown molding');
  if (c.lightRail) bits.push('light rail');
  const bl = baseLabel(c);
  if (bl) bits.push(bl);
  else if (c.baseMold) bits.push('baseboard');
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

/** The ceiling's line in the scope of work. */
export function cofferScope(p: Project): string | null {
  const c = cofferOf(p);
  if (!c.on) return null;
  const L = cofferLayout(p, c);
  const m = cofferMoldings(p, c);
  const crown = profileByNum(c.crown);
  const bits = [
    `${m.count} coffers (${L.xs.length} × ${L.zs.length})${c.layout === 'bigCenter' && L.xs.length >= 3 ? ', smaller around the perimeter' : ''}`,
    `${fmtIn(c.beamWidth)} wide beams dropping ${fmtIn(c.drop)}, ${c.species.toLowerCase()} fascias with ${c.joint === 'bead' ? 'the soffit set below and a bead on each corner' : 'a recessed soffit'}`,
    ...(c.perimeter ? ['perimeter fascia around the room'] : []),
    `crown in each coffer${crown ? ` (${profileLabel(crown)})` : ''}`,
    ...(c.joint !== 'bead' && c.bead && profileByNum(c.bead) ? ['bead moulding on the beam edges'] : []),
    ...(c.picture && profileByNum(c.picture) ? ['picture moulding below the perimeter'] : []),
    ...(c.beadboard ? ['beadboard in each coffer'] : []),
    'paint grade',
  ];
  return `Coffered ceiling: ${bits.join('; ')}`;
}
