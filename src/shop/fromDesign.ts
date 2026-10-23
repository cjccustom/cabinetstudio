// What the shop clock needs from a design: the quoted price, what materials cost, the labor estimate
// split into the clock's tasks, and a starting to-do list for ordering and install.
import type { Project } from '../model/types';
import { priceQuote, quoteOf, type HourLine } from '../model/quote';
import { eagleRequests, requestTitle } from '../model/eagleRequest';
import { hardwareOrder } from '../model/hardware';
import { moldingOrder, supplierName } from '../model/moldings';
import { optimize } from '../model/optimizer';
import { defaultCutlist, optimizerParts } from '../model/cutlist';
import { defaultFaceFrameStock, faceFrameNeeds, faceFramePieces, otherSpecies, stockFor } from '../model/faceframe';
import { panelOrder } from '../model/panels';
import { bracketCount, bracketLength, bracketProduct } from '../model/floatingShelf';
import { doorOrder } from '../model/doorOrder';
import { fieldChecks } from '../model/release';
import type { Phase, ShopJob } from './shop';

/** Which clock task each line of the labor estimate belongs to. */
export function phaseOf(h: HourLine): Phase {
  if (h.label.startsWith('Drawings')) return 'Design & layout';
  if (h.label.startsWith('Mouldings') || h.label.startsWith('Beadboard')) return 'Trim';
  if (h.install) return 'Install';
  if (h.label.startsWith('Doors') || h.label.startsWith('Drawers')) return 'Doors & drawers';
  return 'Casework';
}

export function jobNumbers(p: Project): Pick<ShopJob, 'quote' | 'materials' | 'estHours' | 'estByPhase'> {
  const r = priceQuote(p);
  const q = quoteOf(p);
  const estByPhase: Partial<Record<Phase, number>> = {};
  for (const h of r.hours) estByPhase[phaseOf(h)] = (estByPhase[phaseOf(h)] ?? 0) + h.hours;
  const extraHours = q.extras.reduce((t, e) => t + e.hours, 0);
  if (extraHours) estByPhase.Other = (estByPhase.Other ?? 0) + extraHours;
  const round = (v: number) => Math.round(v * 10) / 10;
  for (const k of Object.keys(estByPhase) as Phase[]) estByPhase[k] = round(estByPhase[k]!);
  return {
    quote: Math.round(r.total),
    // Materials with purchase tax, plus what the painter and any flat extras cost
    materials: Math.round(r.materialCost + q.painter + q.extras.reduce((t, e) => t + e.amount, 0)),
    estHours: round(r.shopHours + r.installHours + extraHours),
    estByPhase,
  };
}

/** Ordering and scheduling steps for a sold job, taken from what's in the design. */
export function starterTodos(p: Project): string[] {
  const out: string[] = [];
  if (fieldChecks(p).length) out.push('Check site measurements (Orders tab) before ordering');
  for (const r of eagleRequests(p)) out.push(`Eagle quote request: ${requestTitle[r.kind].toLowerCase()} (${r.lines.reduce((t, l) => t + Number(l[r.kind === 'boxes' ? 1 : 2]), 0)} pcs)`);
  if (eagleRequests(p).length) out.push('Approve Eagle quotes and place the order');
  const hw = hardwareOrder(p);
  if (hw.lines.length) out.push(`Order Blum hardware from Woodworker Express (${hw.hinges} hinges, ${hw.drawers} drawer slides)`);
  const data = p.cutlist ?? defaultCutlist(p);
  const sheets = optimize(optimizerParts(p, data), data.stock, data.options).filter((m) => m.sheets.length);
  if (sheets.length) out.push(`Buy sheet goods: ${sheets.map((m) => `${m.sheets.length} × ${m.material}`).join(', ')}`);
  const ff = faceFrameNeeds(faceFramePieces(p), { ...defaultFaceFrameStock, ...p.faceFrame });
  if (ff.groups.length) out.push(`Buy face frame lumber: about ${Math.ceil(ff.buyBF)} BF ${({ ...defaultFaceFrameStock, ...p.faceFrame }).species}`);
  for (const sp of otherSpecies(p)) out.push(`Buy ${sp.toLowerCase()}: about ${Math.ceil(faceFrameNeeds(faceFramePieces(p, sp), stockFor(p, sp)).buyBF)} BF for pilasters`);
  const molds = moldingOrder(p);
  for (const sup of ['am', 'brosco'] as const) {
    const mine = molds.filter((m) => m.supplier === sup);
    if (mine.length) out.push(`Order ${supplierName[sup]} mouldings: ${mine.map((m) => `${m.profile.code ?? m.num} (${m.feet}')`).join(', ')}`);
  }
  if ((p.panels ?? []).some((w) => panelOrder(w).qty)) out.push('Order Nantucket beadboard');
  const doors = doorOrder(p);
  if (doors.length) out.push(`Order Reeb interior doors: ${doors.map((d) => `${d.qty} × ${d.key}, hinge ${d.hinge}`).join('; ')}`);
  const shelves = p.cabinets.filter((c) => c.kind === 'shelf');
  if (shelves.length) {
    const byLen = new Map<number, number>();
    for (const c of shelves) byLen.set(bracketLength(c), (byLen.get(bracketLength(c)) ?? 0) + bracketCount(c));
    out.push(`Order floating shelf brackets (Amazon B088PQTYJT): ${[...byLen].map(([l, n]) => `${Math.ceil(n / bracketProduct.perPack)} × ${l}" 8-pack`).join(', ')}`);
  }
  if (quoteOf(p).painter) out.push('Schedule the painter');
  out.push('Schedule install with the customer');
  return out;
}
