// Quoting: material cost from the design, labor hours from standard times, and the shop's two
// pricing methods side by side. Every number traces back to the design or a setting.
import { furnitureOf, tableEstimate, tableScope } from './furniture';
import type { Cabinet, Project, WallId } from './types';
import { buildParts, eff, isOpenRow, openSpans } from './parts';
import { resolveEnds, wallNames } from './layout';
import { cutStock, defaultCutlist, optimizerParts } from './cutlist';
import { optimize } from './optimizer';
import { faceFrameNeeds, ffStockOf, faceFramePieces, otherSpecies, stockFor, woodNeeds, woodPieces } from './faceframe';
import { ceilingKinds, moldLabel, moldingOrder, profileByNum, profileLabel, roomKinds, type MoldKind } from './moldings';
import { chimneysOn, cofferFeet, cofferLayout, cofferMoldings, cofferOf, cofferParts, perimOf } from './coffer';
import { panelOrder } from './panels';
import { uid } from './defaults';
import { eaglePrice, eagleWood, hingeTypes } from './eagle';
import { hardwareOrder } from './hardware';
import { bracketCount, bracketLength, bracketProduct, finishedEnds } from './floatingShelf';
import { doorOrder } from './doorOrder';
import { baseLabel } from './cabinetBase';
import { defaultSupplies, supplyLines, type SupplyGroup, type SupplyItem } from './supplies';
import { applianceKinds } from './appliances';
import { mantelOf } from './mantel';

/** Shop hours per item. Start from these and calibrate against tracked jobs. */
export interface LaborStandards {
  jobSetup: number;
  /** Frameless case: banding the front edges, in place of building a face frame. */
  frameless?: number;
  /** Cutting a closet rod and setting it in its sockets. */
  closetRod?: number;
  /** Stain grade multipliers on cabinet and moulding hours: shop work, and install & trim. */
  stainShop?: number;
  stainInstall?: number;
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
  /** Stile-and-rail soffit underside: build each panel (frame, panel, sand) in the shop. */
  soffitPanel?: number;
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
  /**
   * Mantels (Pope worksheet: firebox layout and framing 10 h, a complex mantel 32 h, fit and
   * install 10 h): the surround itself, pilaster legs with plinths and capitals, each corbel, a
   * pediment, firebox layout and framing for an insert, and install.
   */
  mantelBuild: number;
  mantelPilasters: number;
  mantelCorbel: number;
  mantelPediment: number;
  /** Full height above the shelf: upper pilasters and the overmantel frame and panel; installing it. */
  mantelUpper: number;
  installMantelUpper: number;
  /** A faux chimney: framing and skin, full height. */
  chimneyFraming: number;
  /** The room's baseboard wrapped around a mantel and chimney. */
  mantelBaseWrap: number;
  fireboxFraming: number;
  installMantel: number;
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
  stainShop: 1.25,
  stainInstall: 1.25,
  perShelf: 0.2,
  shelfFront: 0.15,
  mantelBuild: 20,
  mantelPilasters: 6,
  mantelCorbel: 1.5,
  mantelPediment: 4,
  mantelUpper: 10,
  installMantelUpper: 4,
  chimneyFraming: 6,
  mantelBaseWrap: 1.5,
  fireboxFraming: 8,
  installMantel: 10,
  cofferLayout: 6,
  cofferInstallPerFt: 0.27,
  cofferCrownPerCoffer: 3.5,
  cofferPrepPerCoffer: 0.67,
  soffitPanel: 1.5,
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

export interface QuoteExtra { id: string; label: string; hours: number; amount: number; /** Offered as part of this named option. */ option?: string }

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
  /** Closet rod, per 8' length, and a pair of rod sockets. */
  closetRod8ft: number;
  rodSockets: number;
  /** Custom seat cushions from the upholsterer, per sq ft of seat (foam, fabric and labor). */
  cushionPerSqFt: number;
  beadboardSheet: number;
  /** Coffered ceiling stock bought prepped from the millwork supplier, and blocking/fasteners, per ft of beam and perimeter. */
  cofferStockPerFt: number;
  cofferSundriesPerFt: number;
  /** Screws, glue, banding, abrasives and install sundries. */
  supplies: SupplyItem[];
  installPulls: boolean;
  painter: number;
  painterMarkup: number;
  /**
   * How the prefinishing line is priced: the painter's own quote (with your markup), an estimate
   * from the job's size, or a flat allowance. Unset = the painter's quote.
   */
  paintMode?: 'quote' | 'estimate' | 'allowance';
  /** Estimate rates, as charged to the customer: each door, drawer front or end panel, and each sq ft of cabinet face. */
  paintPerFront?: number;
  paintPerSqFt?: number;
  /** Painting the inside of open sections (prefinished ply scuffed, primed and painted), per sq ft of opening. */
  paintPerInteriorSqFt?: number;
  paintAllowance?: number;
  /** When the cabinets are painted: sprayed before install (prefinished), on site after install, or not in this contract. Unset = prefinished. */
  paintWhen?: 'prefinish' | 'site' | 'none';
  /** The painting line's wording on the agreement; unset = by when it's done. */
  paintLabel?: string;
  /**
   * Your own wording and price for any line on the agreement, by line key: a group ('cabinets',
   * 'ceiling'…), an extra ('extra:<id>') or 'painting'. A price set here is what the line shows,
   * in place of its hours and materials (or the painting quote, estimate or allowance).
   */
  lineLabels?: Record<string, string>;
  linePrices?: Record<string, number>;
  /** Scope of work: your wording for a cabinet's line (by cabinet id, '' hides it), and lines of your own. */
  scopeText?: Record<string, string>;
  scopeExtra?: string[];
  extras: QuoteExtra[];
  /** Hours you set yourself for a labor line, by lineKey: used in place of the estimate. */
  hourOverrides?: Record<string, number>;
  /** Cost you set yourself for a material line, by lineKey. */
  costOverrides?: Record<string, number>;
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
  closetRod8ft: 0,
  rodSockets: 0,
  cushionPerSqFt: 0,
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

export type Group = 'cabinets' | 'tops' | 'paneling' | 'room' | 'ceiling' | 'furniture';

/** The painting line's wording on the agreement: yours, or by when it's done. */
export const paintLineLabel = (q: QuoteSettings) => q.lineLabels?.painting?.trim() || q.paintLabel?.trim() || (q.paintWhen === 'site' ? 'Site finishing (painting)' : 'Cabinet prefinishing');

export interface ScopeItem { key: string; text: string; /** What Cabinet Studio wrote, when you've changed it. */ auto?: string; custom?: boolean }

/** The scope of work, line by line: each cabinet, tables, the ceiling, and lines of your own, with your wording where you've changed it. Hidden lines are left out. */
export function scopeItems(p: Project, withHidden = false): ScopeItem[] {
  const q = quoteOf(p);
  const auto = [
    ...p.cabinets.map((c) => ({ key: c.id, text: scopeLine(c, p) })),
    ...furnitureOf(p).map((t) => ({ key: `table:${t.id}`, text: tableScope(t) })),
    ...(cofferScope(p) ? [{ key: 'ceiling', text: cofferScope(p)! }] : []),
  ];
  const out: ScopeItem[] = auto.map((a) => {
    const mine = q.scopeText?.[a.key];
    return mine == null ? a : { key: a.key, text: mine, auto: a.text };
  });
  (q.scopeExtra ?? []).forEach((t, i) => out.push({ key: `custom:${i}`, text: t, custom: true }));
  return withHidden ? out : out.filter((x) => x.text.trim());
}

/** What painting comes to before any price you set yourself: the painter's quote with markup, the estimate or the allowance. */
export function paintCalculated(p: Project, q: QuoteSettings): number {
  if (q.paintWhen === 'none') return 0;
  return q.paintMode === 'estimate' ? paintEstimate(p, q).amount : q.paintMode === 'allowance' ? q.paintAllowance ?? 0 : q.painter * (1 + q.painterMarkup);
}
export const groupLabel: Record<Group, string> = { cabinets: 'Cabinets', tops: 'Solid wood tops & seats', paneling: 'Wall paneling', room: 'Room trim', ceiling: 'Coffered ceiling', furniture: 'Furniture' };
const moldGroup = (kinds: MoldKind[]): Group => (kinds.includes('cap') ? 'paneling' : kinds.every((k) => ceilingKinds.includes(k)) ? 'ceiling' : kinds.every((k) => roomKinds.includes(k)) ? 'room' : 'cabinets');

export interface HourLine { group: Group; label: string; qty: number; each: number; hours: number; install?: boolean; /** The estimate, when you've set the hours yourself. */ estimated?: number }
export interface MaterialLine { group: Group; label: string; cost: number; detail: string; missing?: string; /** The estimate, when you've set the cost yourself. */ estimated?: number }

/**
 * Three of your past built-in quotes put prefinishing at about $150 a door or drawer front plus
 * $40 a sq ft of cabinet face, primed and sprayed both sides by the painter: the high end of what
 * Massachusetts cabinet painters charge ($90 to $175 a door).
 */
export const paintRates = { perFront: 150, perSqFt: 40, perInteriorSqFt: 30 };

/** The painting estimate from the job's size: fronts (doors, drawer fronts, end panels) and cabinet face. */
export function paintEstimate(p: Project, q: QuoteSettings) {
  let fronts = 0, sqft = 0, interior = 0;
  for (const c of p.cabinets) {
    if (c.kind === 'shelf') continue;
    const parts = buildParts(c, p.settings, resolveEnds(p.room, p.cabinets, c));
    fronts += parts.filter((x) => x.role === 'door' || x.role === 'drawerFront' || x.role === 'endPanel').length;
    sqft += (c.width * c.height) / 144 * (c.island && c.islandSides === 2 ? 2 : 1);
    // Painted open sections: priced by the opening's face area (sides, back and shelves inside it)
    if (c.build?.interior === 'paint') interior += openSpans(c, eff(c, p.settings)).reduce((t, o) => t + (c.width * (o.y1 - o.y0)) / 144, 0);
  }
  const perFront = q.paintPerFront ?? paintRates.perFront, perSqFt = q.paintPerSqFt ?? paintRates.perSqFt, perInterior = q.paintPerInteriorSqFt ?? paintRates.perInteriorSqFt;
  return { fronts, sqft, interior, amount: fronts * perFront + sqft * perSqFt + interior * perInterior };
}

/** What a quote line is known by when you adjust it: its group and label. */
export const lineKey = (l: { group: Group; label: string }) => `${l.group}|${l.label}`;

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
    if (c.kind === 'mantel') {
      const m = mantelOf(c);
      add('Mantels: legs, frieze & shelf', 1, st.mantelBuild ?? 20);
      if (m.legs === 'pilaster') add('Mantels: pilaster legs, plinths & capitals', 1, st.mantelPilasters ?? 6);
      if (m.corbels) add('Mantels: corbels', m.corbels, st.mantelCorbel ?? 1.5);
      if (m.pediment !== 'none') add('Mantels: pediment', 1, st.mantelPediment ?? 4);
      if (m.upper.on) {
        add('Mantels: upper pilasters & overmantel panel', 1, st.mantelUpper ?? 10);
        add('Install overmantel', 1, st.installMantelUpper ?? 4, 'cabinets', true);
        installHours += st.installMantelUpper ?? 4;
      }
      if (m.chimney) { add('Faux chimney: framing & skin', 1, st.chimneyFraming ?? 6, 'cabinets', true); installHours += st.chimneyFraming ?? 6; }
      if (m.baseH > 0) { add('Baseboard wrapped around the chimney & mantel', 1, st.mantelBaseWrap ?? 1.5, 'cabinets', true); installHours += st.mantelBaseWrap ?? 1.5; }
      if (m.fuel !== 'wood') { add('Firebox layout & surround framing', 1, st.fireboxFraming ?? 8, 'cabinets', true); installHours += st.fireboxFraming ?? 8; }
      add('Install mantels: fit, scribe & trim', 1, st.installMantel ?? 10, 'cabinets', true);
      installHours += st.installMantel ?? 10;
      continue;
    }
    if (c.kind === 'pilaster') {
      add('Pilasters: box, panels, plinth & capital', 1, st.pilaster);
      add('Install pilasters', 1, st.installPilaster, 'cabinets', true);
      installHours += st.installPilaster;
      continue;
    }
    const s = eff(c, p.settings);
    // Stain grade: grain-matched stock, tighter joints, hidden fasteners, more sanding, no caulk on site
    const stain = s.finish === 'stain';
    const addC = (label: string, qty: number, each: number, group: Group = 'cabinets', install = false) =>
      add(stain ? `${label}, stain grade` : label, qty, each * (stain ? (install ? st.stainInstall ?? 1.25 : st.stainShop ?? 1.25) : 1), group, install);
    const parts = buildParts(c, p.settings, resolveEnds(p.room, p.cabinets, c));
    const tall = c.height > 60;
    const inset = s.doorMount === 'inset' ? st.insetFactor : 1;
    const n = (role: string) => parts.filter((x) => x.role === role).length;
    // A two-sided island is two cases back to back
    const sides = c.island && c.islandSides === 2 ? 2 : 1;
    addC('Case', sides, st.perBox);
    if (tall) addC('Tall case (extra)', sides, st.tallBox);
    if (s.construction !== 'frameless') addC('Face frame', sides, st.faceFrame);
    else addC('Edge banding the case (frameless)', sides, st.frameless ?? 0.75);
    addC('Face frame openings', c.rows.length + (sides === 2 ? (c.backRows ?? c.rows).length : 0) + (c.corner ? 1 : 0), st.perOpening);
    addC(inset > 1 ? 'Doors, inset (fit & hang)' : 'Doors (fit & hang)', n('door'), st.perDoor * inset);
    addC(inset > 1 ? 'Drawers, inset (slides & fronts)' : 'Drawers (slides & fronts)', n('drawerBox') + parts.filter((x) => x.name === 'False front').length * 0.5, st.perDrawer * inset);
    addC('Shelves', n('shelf'), st.perShelf);
    const baseTrim = parts.filter((x) => /^(Baseboard|Skirt|End skirt)/.test(x.name));
    addC('Baseboard / skirt pieces (fit & miter)', baseTrim.length, st.basePiece ?? 0.25);
    addC('Arched cuts (layout & cut)', parts.filter((x) => (x.note ?? '').startsWith('Cut ') && /feet|arch/i.test(x.note ?? '')).length, st.archCut ?? 0.5);
    addC('Applied shelf fronts', parts.filter((x) => x.name === 'Shelf front').length, st.shelfFront ?? 0.15);
    addC('Shoe fences', parts.filter((x) => x.name === 'Shoe fence').length, st.shelfFront ?? 0.15);
    addC('Closet rods (cut & set in sockets)', n('rod'), st.closetRod ?? 0.25, 'cabinets', true);
    installHours += n('rod') * (st.closetRod ?? 0.25) * (stain ? st.stainInstall ?? 1.25 : 1);
    addC('End panels', n('endPanel'), st.endPanel);
    addC('Extended stiles', parts.filter((x) => x.name === 'Stile, extended').length, st.extendedStile);
    for (const t of parts.filter((x) => x.role === 'woodTop')) {
      // Solid wood tops take the same work either way
      add('Glue-up & finish tops', 1, st.woodTop, 'tops');
      add('Top area (sq ft)', Math.round(sqft(t.length, t.width) * 10) / 10, st.woodTopPerSqFt, 'tops');
      add('Install tops', 1, 0.5, 'tops', true);
    }
    const box = (st.installPerBox + (tall ? st.installTall : 0)) * (stain ? st.stainInstall ?? 1.25 : 1);
    add(stain ? 'Install cabinets, stain grade' : 'Install cabinets', 1, box, 'cabinets', true);
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
    // Stain-grade mouldings: matched for color, coped and fitted tight, no caulk to hide a gap
    const ms = p.settings.finish === 'stain' && group !== 'ceiling';
    const fs = ms ? st.stainShop ?? 1.25 : 1, fi = ms ? st.stainInstall ?? 1.25 : 1;
    add(`Mouldings: cut & prep (ft)${ms ? ', stain grade' : ''}`, ft, st.moldingPerFt * fs, group);
    add(`Mouldings: install (ft)${ms ? ', stain grade' : ''}`, ft, st.moldingInstallPerFt * fi, group, true);
    installHours += ft * st.moldingInstallPerFt * fi;
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
    const sp = cofferParts(p, cc).filter((x) => / soffit panel$/.test(x.name)).length;
    if (sp) add('Soffit underside: stile & rail panels (each)', sp, st.soffitPanel ?? 1.5, 'ceiling');
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
  const sheets = optimize(optimizerParts(p, data), cutStock(p, data), data.options);
  for (const m of sheets) {
    const cost = m.sheets.reduce((t, sh) => t + sh.stock.price, 0);
    out.push({ group: 'cabinets', label: `${m.material} sheets`, cost, detail: `${m.sheets.length} sheets`, missing: cost ? undefined : 'Enter a price per sheet on the Sheet cutlist tab' });
  }
  const ffStock = ffStockOf(p);
  const ff = faceFrameNeeds(faceFramePieces(p), ffStock);
  if (ff.groups.length) {
    out.push(ffStock.pricePerLF
      ? { group: 'cabinets', label: `Face frame stock (${ffStock.species.replace(/,.*$/, '')} ${ffStock.board ?? ''})`, cost: ff.cost, detail: `${ff.boards.length} boards, ${Math.ceil(ff.buyLF)} lf at $${ffStock.pricePerLF.toFixed(2)}${ffStock.listed ? ' (A&M list price)' : ''}` }
      : { group: 'cabinets', label: `Face frame stock (${ffStock.species})`, cost: ff.cost, detail: `${Math.ceil(ff.buyBF)} BF`, missing: ffStock.pricePerBF ? undefined : 'Pick the species under Materials (Shop standards) or enter a price on the Solid wood tab' });
  }
  for (const sp of otherSpecies(p)) {
    const st = stockFor(p, sp);
    const pieces = faceFramePieces(p, sp, { ceiling: false });
    if (!pieces.length) continue;
    const need = faceFrameNeeds(pieces, st);
    out.push({ group: 'cabinets', label: `${sp} stock (pilasters, mantels)`, cost: need.cost, detail: st.pricePerLF ? `${Math.ceil(need.buyLF)} lf ${st.board}` : `${Math.ceil(need.buyBF)} BF`, missing: st.pricePerLF || st.pricePerBF ? undefined : `Enter $/BF for ${sp.toLowerCase()} on the Solid wood tab` });
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

  let fronts = 0, frontArea = 0, doors = 0, drawers = 0, boxCost = 0;
  /** Estimates by Eagle request: doors with end panels, and drawer fronts. */
  const est = { doors: 0, fronts: 0 };
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
        est[o.item === 'drawerFront' ? 'fronts' : 'doors'] += eaglePrice(o.item, o.w, o.h) * k;
        if (o.item === 'door') {
          doors++;
          hingeKinds.add(hingeTypes[eff(c, p.settings).hingeType].name);
        }
      }
    }
  }
  // Eagle's own quote, where it's come back, beats the estimate
  const eq = p.eagleQuotes ?? {};
  const quoted = (['doors', 'fronts'] as const).filter((kind) => est[kind] > 0 && eq[kind] != null);
  const frontCost = (eq.doors != null && est.doors > 0 ? eq.doors : est.doors) + (eq.fronts != null && est.fronts > 0 ? eq.fronts : est.fronts);
  const eWood = eagleWood[p.settings.doorMaterial] ?? p.settings.doorMaterial;
  const qNote = (n: number, of: number) => (n === of ? ', Eagle’s quote' : n ? ', partly Eagle’s quote' : `, estimate${p.settings.doorMaterial === 'Paint-grade maple' || p.settings.doorMaterial === 'MDF' ? '' : ` (${eWood}: check with Eagle)`}`);
  if (fronts) out.push({ group: 'cabinets', label: 'Eagle doors, fronts & end panels', cost: frontCost, detail: `${fronts} pcs, ${frontArea.toFixed(1)} sq ft${qNote(quoted.length, (['doors', 'fronts'] as const).filter((kind) => est[kind] > 0).length)}` });
  if (drawers) out.push({ group: 'cabinets', label: 'Eagle dovetail drawer boxes', cost: eq.boxes ?? boxCost, detail: `${drawers} boxes${eq.boxes != null ? ', Eagle’s quote' : ''}` });
  // Brackets by length: a 12" shelf takes the 10" bracket
  const byLen = new Map<number, number>();
  for (const c of p.cabinets) if (c.kind === 'shelf') byLen.set(bracketLength(c), (byLen.get(bracketLength(c)) ?? 0) + bracketCount(c));
  const brackets = [...byLen.values()].reduce((t, n) => t + n, 0);
  // Bought in packs of 8 for each rod length
  const packs = [...byLen.values()].reduce((t, n) => t + Math.ceil(n / bracketProduct.perPack), 0);
  if (brackets) out.push({ group: 'cabinets', label: 'Floating shelf brackets', cost: packs * q.shelfBracketPack, detail: `${[...byLen].map(([l, n]) => `${n} × ${l}"`).join(', ')}; ${packs} pack${packs > 1 ? 's' : ''} of ${bracketProduct.perPack}`, missing: q.shelfBracketPack ? undefined : 'Enter your bracket pack price' });
  const rods = closetRods(p);
  if (rods.count) {
    const cost = rods.lengths * q.closetRod8ft + rods.count * q.rodSockets;
    out.push({ group: 'cabinets', label: `Closet rods (1 5/16" ${p.settings.closetRod === 'metal' ? 'metal' : 'wood'}) & sockets`, cost,
      detail: `${rods.count} rods from ${rods.lengths} × 8' lengths, ${rods.count} pairs of sockets`,
      missing: q.closetRod8ft && q.rodSockets ? undefined : 'Enter the closet rod and socket prices under Quote → Prices to fill in' });
  }
  const cushions = p.cabinets.flatMap((c) => buildParts(c, p.settings, resolveEnds(p.room, p.cabinets, c)).filter((x) => x.role === 'cushion'));
  if (cushions.length) {
    const area = cushions.reduce((t, x) => t + sqft(x.length, x.width), 0);
    out.push({ group: 'cabinets', label: 'Custom seat cushions (upholsterer)', cost: area * q.cushionPerSqFt,
      detail: `${cushions.length} cushion${cushions.length > 1 ? 's' : ''}, ${area.toFixed(1)} sq ft`,
      missing: q.cushionPerSqFt ? undefined : 'Get the upholsterer’s price and enter it under Quote → Prices to fill in' });
  }
  const hw = hardwareOrder(p);
  const hwCost = (g: 'hinges' | 'slides') => hw.lines.filter((l) => l.group === g).reduce((t, l) => t + l.total, 0);
  const hwMissing = (g: 'hinges' | 'slides') => hw.problems.filter((x) => x.group === g).map((x) => x.text).join('; ') || undefined;
  if (hw.hinges) out.push({ group: 'cabinets', label: `Hinges (${[...hingeKinds].join(' & ')})`, cost: hwCost('hinges'), detail: `${hw.hinges} hinges on ${doors} doors`, missing: hwMissing('hinges') });
  if (hw.drawers) out.push({ group: 'cabinets', label: 'Blum Tandem slides & locking devices', cost: hwCost('slides'), detail: `${hw.drawers} drawers`, missing: hwMissing('slides') });
  for (const m of moldingOrder(p)) {
    out.push({ group: moldGroup(m.kinds), label: `${profileLabel(m.profile)} ${m.kinds.every((k) => roomKinds.includes(k)) ? m.kinds.map((k) => moldLabel[k].toLowerCase()).join(' & ') : 'moulding'}`, cost: m.cost, detail: `${m.feet} lin ft`, missing: m.price == null ? (m.supplier === 'brosco' ? 'Enter the Brosco price per foot on the Orders tab' : m.supplier === 'custom' ? 'Enter the custom-milled price per foot on the Orders tab' : 'No A&M price') : undefined });
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

export interface GroupPrice { group: Group; hours: number; materials: number; methodA: number; methodB: number; price: number; /** The calculated price, when you've set your own. */ estimated?: number }

export interface QuoteResult {
  hours: HourLine[];
  materials: MaterialLine[];
  tax: number;
  groups: GroupPrice[];
  extras: { id: string; label: string; price: number }[];
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
  for (const t of furnitureOf(p)) {
    const e = tableEstimate(t, p);
    hours.push(...e.hours.map((h) => ({ group: 'furniture' as Group, label: `${t.name}: ${h.label}`, qty: 1, each: h.hours, hours: h.hours, install: h.label.startsWith('Delivery') })));
    materials.push(...e.materials.map((m) => ({ group: 'furniture' as Group, label: `${t.name}: ${m.label}`, cost: m.cost, detail: m.detail, ...(m.detail.includes('enter a $/BF') ? { missing: `${t.species} $/BF` } : {}) })));
  }
  // Your own numbers on any line replace the estimate (kept alongside to show and reset)
  for (const [i, h] of hours.entries()) {
    const o = q.hourOverrides?.[lineKey(h)];
    if (o != null) hours[i] = { ...h, hours: o, estimated: h.hours };
  }
  for (const [i, m] of materials.entries()) {
    const o = q.costOverrides?.[lineKey(m)];
    if (o != null) materials[i] = { ...m, cost: o, estimated: m.cost, missing: undefined };
  }
  const price = (h: number, m: number) => {
    const mt = m * (1 + tax);
    const a = (mt + h * q.laborCost) * q.multiplier;
    const b = h * q.billRate + mt * (1 + q.materialMarkup);
    return { a, b, chosen: q.method === 'multiplier' ? a : b };
  };
  const groups = (['cabinets', 'tops', 'paneling', 'room', 'ceiling', 'furniture'] as Group[])
    .map((g) => {
      const h = hours.filter((x) => x.group === g).reduce((t, x) => t + x.hours, 0);
      const m = materials.filter((x) => x.group === g).reduce((t, x) => t + x.cost, 0);
      const pr = price(h, m);
      // A price you set for the whole line stands in for its hours and materials (it's what shows on the agreement, so workload comes back out)
      const set = q.linePrices?.[g];
      return { group: g, hours: h, materials: m, methodA: pr.a, methodB: pr.b, price: set != null ? set / (1 + q.workloadAdj[q.workload]) : pr.chosen, ...(set != null ? { estimated: pr.chosen } : {}) };
    })
    .filter((g) => g.hours || g.materials);
  const adjOf = 1 + q.workloadAdj[q.workload];
  const extras = q.extras.map((e) => {
    const set = q.linePrices?.[`extra:${e.id}`];
    return { id: e.id, label: e.label, price: set != null ? set / adjOf : price(e.hours, 0).chosen + e.amount };
  });
  const painter = q.paintWhen === 'none' ? 0 : q.linePrices?.painting ?? paintCalculated(p, q);
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
    // The painter's cost to you: their quote, or the estimate or allowance less your usual markup
    cost: materialCost + allHours * q.laborCost + (q.paintMode && q.paintMode !== 'quote' ? painter / (1 + q.painterMarkup) : q.painter) + q.extras.reduce((t, e) => t + e.amount, 0),
  };
}

export const newExtra = (): QuoteExtra => ({ id: uid('extra'), label: 'Additional work', hours: 4, amount: 0 });

/** The scope line for one cabinet, in the wording the shop uses on its quotes. */
export function scopeLine(c: Cabinet, p: Project): string {
  if (c.kind === 'shelf') {
    const n = finishedEnds(resolveEnds(p.room, p.cabinets, c));
    return `${c.name}: Floating shelf, approx ${fmtIn(c.width)}W x ${fmtIn(c.depth)}D x ${fmtIn(c.height)} thick; mitered ${(c.floating?.grade ?? 'paint') === 'paint' ? 'paint grade' : 'stain grade'} construction with concealed bracket; ${n === 2 ? 'both ends finished' : n === 1 ? 'one end finished, one against the wall' : 'fits wall to wall'}`;
  }
  if (c.kind === 'mantel') {
    const m = mantelOf(c);
    const bits = [
      `Fireplace mantel, approx ${fmtIn(c.width)}W x ${fmtIn(c.height)}H`,
      m.chimney ? 'built on a framed faux chimney' : '',
      m.legs === 'pilaster' ? (m.legBuild === 'pilaster' ? 'frame-and-panel pilaster legs with plinths and capitals, matching the bookcase pilasters' : 'pilaster legs with plinths and capitals') : m.legs === 'flat' ? 'flat legs' : '',
      'frieze',
      `${fmtIn(m.shelfThickness)} thick mantel shelf${c.crown ? ' with bed moulding' : ''}`,
      m.corbels ? `(${m.corbels}) corbels` : '',
      m.pediment !== 'none' ? `${m.pediment === 'arch' ? 'arched ' : ''}pediment` : '',
      m.fuel === 'wood' ? 'surround for the existing wood-burning firebox' : `opening for owner's ${m.fuel === 'gas' ? 'gas' : 'electric'} insert${m.insert?.model ? ` (${m.insert.model})` : ''}`,
      m.upper.on ? `full-height overmantel to the ceiling trim (approx ${fmtIn(m.upper.top)} high): pilasters over the legs framing a recessed panel` : '',
      m.baseH > 0 ? 'existing two-piece baseboard profile wrapped around the chimney and plinths' : c.baseMold ? 'base moulding' : '',
      'paint grade',
    ].filter(Boolean);
    return `${c.name}: ${bits.join('; ')}`;
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
  if (c.island) bits.push(c.islandSides === 2 ? 'freestanding island with fronts on both sides' : 'freestanding island, back finished with a panel');
  const adj = parts.filter((x) => x.role === 'shelf' && x.name === 'Adjustable shelf').length;
  if (adj) bits.push(`(${adj}) adjustable shel${adj > 1 ? 'ves' : 'f'}`);
  const hang = c.rows.filter((r) => r.type === 'hang').length;
  if (hang) bits.push(hang === 2 ? 'double hang, two closet rods' : hang === 1 ? `${c.rows.some((r) => r.type === 'open') ? 'hanging with shelf storage above, ' : 'hanging, '}closet rod` : `(${hang}) hanging sections with closet rods`);
  const shoes = c.rows.filter((r) => r.type === 'shoes').reduce((t, r) => t + r.shelves, 0);
  if (shoes) bits.push(`(${shoes}) ${c.rows.some((r) => r.type === 'shoes' && !r.flatShoes) ? 'slanted ' : ''}shoe shel${shoes > 1 ? 'ves' : 'f'} with fences`);
  for (const r of c.rows) if (r.type === 'appliance' && r.appliance) bits.push(`${r.appliance.mount === 'shelf' ? 'open space' : 'built-in opening'} for owner's ${applianceKinds[r.appliance.kind].short.toLowerCase()}`);
  if (n('endPanel')) bits.push(`(${n('endPanel')}) finished end panel${n('endPanel') > 1 ? 's' : ''}`);
  if (c.countertop && c.topKind === 'wood') bits.push(`${fmtIn(c.topThickness ?? 1.25)} thick solid wood top`);
  if (c.countertop && c.cushion) bits.push(`custom ${fmtIn(c.cushion.thickness)} ${c.cushion.edge === 'boxed' ? 'boxed and welted' : 'knife edge'} seat cushion, ${c.cushion.fabric?.trim() ? c.cushion.fabric.trim() : "fabric to be selected by owner"}`);
  if (c.crown) bits.push('crown molding');
  if (c.lightRail) bits.push('light rail');
  const bl = baseLabel(c);
  if (bl) bits.push(bl);
  else if (c.baseMold) bits.push('baseboard');
  if (s.construction === 'frameless') bits.push('frameless construction with banded case edges');
  bits.push(`${(s.plywood ?? 'Prefinished birch').toLowerCase()} plywood interior with ${s.finish === 'stain' ? `stain grade ${s.woodSpecies.toLowerCase()}` : 'paint grade'} exterior`);
  if (c.build?.interior === 'paint' && c.rows.some((r) => isOpenRow(r.type, r.covered))) bits.push('open shelving painted inside to match');
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
    ...(c.perimeter ? (Object.keys(c.panels ?? {}) as WallId[]).map((w) => `the ${fmtIn(perimOf(c, w))} soffit along the ${wallNames[w].toLowerCase()} with stile-and-rail panels on its underside${chimneysOn(p, w, p.room.height - c.drop).length ? ' to either side of the chimney' : ''}`) : []),
    `crown in each coffer${crown ? ` (${profileLabel(crown)})` : ''}`,
    ...(c.joint !== 'bead' && c.bead && profileByNum(c.bead) ? ['bead moulding on the beam edges'] : []),
    ...(c.picture && profileByNum(c.picture) ? ['picture moulding below the perimeter'] : []),
    ...(c.beadboard ? ['beadboard in each coffer'] : []),
    'paint grade',
  ];
  return `Coffered ceiling: ${bits.join('; ')}`;
}

/** Every closet rod in the job, and the 8' lengths they're cut from (packed longest first). */
export function closetRods(p: Project): { cuts: number[]; count: number; lengths: number } {
  const cuts: number[] = [];
  for (const c of p.cabinets) for (const part of buildParts(c, p.settings, resolveEnds(p.room, p.cabinets, c))) if (part.role === 'rod') cuts.push(part.length);
  const bins: number[] = [];
  for (const l of [...cuts].sort((a, b) => b - a)) {
    const i = bins.findIndex((used) => used + 0.125 + l <= 96);
    if (i >= 0) bins[i] += 0.125 + l; else bins.push(l);
  }
  return { cuts, count: cuts.length, lengths: bins.length };
}
