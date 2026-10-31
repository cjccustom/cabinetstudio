// The job's pricing as an Excel workbook with live formulas: change a rate, an hour or a material
// cost and the price follows, the same way the Quote tab works it out. For fine-tuning a job's
// price and for comparing estimates against what the job really took.
import type { Project } from '../model/types';
import { groupLabel, paintLineLabel, priceQuote, quoteOf, type Group } from '../model/quote';
import { ballpark, comparableQuote, rateCardOf } from '../model/ballpark';
import { writeXlsx, type Cell, type Row, type Workbook } from './xlsx';

const money = (v: number, f?: string): Cell => ({ v: Math.round(v * 100) / 100, f, s: 'money' });
const hrs = (v: number, f?: string): Cell => ({ v: Math.round(v * 100) / 100, f, s: 'hours' });
const head = (...t: string[]): Row => t.map((v) => ({ v, s: 'head' as const }));
const qstr = (s: string) => `"${s.replace(/"/g, '""')}"`;

export function pricingWorkbook(p: Project): Workbook {
  const q = quoteOf(p);
  const r = priceQuote(p);
  const tax = p.settings.purchaseTax;
  const adj = q.workloadAdj[q.workload];

  // ── Rates: the inputs every price works from ──
  const rates: Row[] = [
    head('Rates', 'Value', 'What it does'),
    ['Labor cost to you ($/hr)', { v: q.laborCost, s: 'inputMoney' }, { v: 'Wages and overhead per hour', s: 'note' }],
    ['Pricing method', { v: q.method === 'multiplier' ? 'multiplier' : 'bill rate', s: 'input' }, { v: 'Type multiplier or bill rate', s: 'note' }],
    ['Multiplier', { v: q.multiplier, s: 'input' }, { v: '(materials with tax + hours × labor cost) × multiplier', s: 'note' }],
    ['Bill rate ($/hr)', { v: q.billRate, s: 'inputMoney' }, { v: 'hours × bill rate + materials with tax and markup', s: 'note' }],
    ['Material markup (bill rate method)', { v: q.materialMarkup, s: 'inputPct' }],
    ['Purchase tax', { v: tax, s: 'inputPct' }],
    [`Workload (${q.workload})`, { v: adj, s: 'inputPct' }, { v: 'Up when the shop is full, down when it’s light; not on painting', s: 'note' }],
    ['Your adjustment ($)', { v: q.adjustment, s: 'inputMoney' }],
    ['Round to ($)', { v: q.roundTo, s: 'inputMoney' }],
  ];
  const names: Record<string, string> = {
    LaborCost: 'Rates!$B$2', Method: 'Rates!$B$3', Multiplier: 'Rates!$B$4', BillRate: 'Rates!$B$5', MatMarkup: 'Rates!$B$6',
    Tax: 'Rates!$B$7', Workload: 'Rates!$B$8', Adjust: 'Rates!$B$9', RoundTo: 'Rates!$B$10',
  };

  // ── Labor: every hour line, editable ──
  const labor: Row[] = [head('Line', 'Item', 'Where', 'Qty', 'Hours each', 'Hours', 'App’s estimate')];
  for (const h of r.hours) {
    const n = labor.length + 1;
    const qty = h.qty > 0 ? h.qty : 1;
    labor.push([groupLabel[h.group], h.label, h.install ? 'Install' : 'Shop', { v: qty, s: 'num' }, { v: Math.round((h.hours / qty) * 1000) / 1000, s: 'input' }, hrs(h.hours, `D${n}*E${n}`), h.estimated != null ? hrs(h.estimated) : null]);
  }
  const laborEnd = labor.length;
  labor.push([], [{ v: 'Total hours', s: 'bold' }, null, null, null, null, { v: r.hours.reduce((t, h) => t + h.hours, 0), f: `SUM(F2:F${laborEnd})`, s: 'hours' }]);
  labor.push(['Shop', null, null, null, null, hrs(r.shopHours, `SUMIF(C2:C${laborEnd},"Shop",F2:F${laborEnd})`)]);
  labor.push(['Install', null, null, null, null, hrs(r.installHours, `SUMIF(C2:C${laborEnd},"Install",F2:F${laborEnd})`)]);

  // ── Materials ──
  const mats: Row[] = [head('Line', 'Item', 'Detail', 'Cost', 'App’s estimate')];
  for (const m of r.materials) mats.push([groupLabel[m.group], m.label, m.missing ? `${m.detail} (needs a price: ${m.missing})` : m.detail, { v: Math.round(m.cost * 100) / 100, s: 'inputMoney' }, m.estimated != null ? money(m.estimated) : null]);
  const matEnd = mats.length;
  mats.push([], [{ v: 'Total before tax', s: 'bold' }, null, null, { v: r.materials.reduce((t, m) => t + m.cost, 0), f: `SUM(D2:D${matEnd})`, s: 'moneyBold' }]);

  // ── Summary: the agreement's lines, priced from the sheets above ──
  const sum: Row[] = [
    [{ v: `${p.name} — pricing`, s: 'bold' }],
    [{ v: 'Yellow cells are yours to change. Prices follow the Quote tab: each line’s hours and materials, by your pricing method.', s: 'note' }],
    [],
    head('Line on the agreement', 'Hours', 'Materials', 'Multiplier price', 'Bill-rate price', 'Price you set', 'Price'),
  ];
  const workRows: number[] = [];
  for (const g of r.groups) {
    const n = sum.length + 1;
    const key = groupLabel[g.group];
    const set = q.linePrices?.[g.group as Group];
    workRows.push(n);
    sum.push([
      q.lineLabels?.[g.group]?.trim() || key,
      hrs(g.hours, `SUMIF(Labor!$A:$A,${qstr(key)},Labor!$F:$F)`),
      money(g.materials, `SUMIF(Materials!$A:$A,${qstr(key)},Materials!$D:$D)`),
      money(g.methodA, `(C${n}*(1+Tax)+B${n}*LaborCost)*Multiplier`),
      money(g.methodB, `B${n}*BillRate+C${n}*(1+Tax)*(1+MatMarkup)`),
      set != null ? { v: set, s: 'inputMoney' } : { s: 'inputMoney' },
      money(g.price, `IF(F${n}<>"",F${n}/(1+Workload),IF(Method="bill rate",E${n},D${n}))`),
    ]);
  }
  for (const e of q.extras) {
    const n = sum.length + 1;
    const set = q.linePrices?.[`extra:${e.id}`];
    const pr = r.extras.find((x) => x.id === e.id)?.price ?? 0;
    workRows.push(n);
    sum.push([
      q.lineLabels?.[`extra:${e.id}`]?.trim() || e.label,
      { v: e.hours, s: 'input' },
      { v: e.amount, s: 'inputMoney' },
      money(e.hours * q.laborCost * q.multiplier + e.amount, `B${n}*LaborCost*Multiplier+C${n}`),
      money(e.hours * q.billRate + e.amount, `B${n}*BillRate+C${n}`),
      set != null ? { v: set, s: 'inputMoney' } : { s: 'inputMoney' },
      money(pr, `IF(F${n}<>"",F${n}/(1+Workload),IF(Method="bill rate",E${n},D${n}))`),
    ]);
  }
  const paintRow = sum.length + 1;
  sum.push([q.paintWhen === 'none' ? 'Painting (not in this contract)' : paintLineLabel(q), null, null, null, null, { v: r.painter, s: 'inputMoney' }, money(r.painter, `N(F${paintRow})`)]);
  const work = workRows.map((n) => `G${n}`).join(',') || '0';
  const workV = r.groups.reduce((t, g) => t + g.price, 0) + r.extras.reduce((t, e) => t + e.price, 0);
  sum.push([]);
  const w = sum.length + 1;
  sum.push([{ v: 'Work', s: 'bold' }, null, null, null, null, null, money(workV, `SUM(${work})`)]);
  sum.push(['Workload adjustment', null, null, null, null, null, money(r.workloadAmount, `G${w}*Workload`)]);
  sum.push(['Painting', null, null, null, null, null, money(r.painter, `G${paintRow}`)]);
  sum.push(['Your adjustment', null, null, null, null, null, money(q.adjustment, 'Adjust')]);
  const raw = sum.length + 1;
  sum.push(['Before rounding', null, null, null, null, null, money(r.calculated + r.workloadAmount + q.adjustment, `SUM(G${w}:G${raw - 1})`)]);
  const tot = sum.length + 1;
  sum.push([{ v: 'Total', s: 'bold' }, null, null, null, null, null, { v: r.total, f: `IF(RoundTo>0,ROUND(G${raw}/RoundTo,0)*RoundTo,G${raw})`, s: 'moneyBold' }]);
  sum.push([{ v: 'Cabinet Studio’s total when exported', s: 'note' }, null, null, null, null, null, money(r.total)]);
  sum.push([]);
  const painterCost = q.paintWhen === 'none' ? 0 : q.paintMode && q.paintMode !== 'quote' ? r.painter / (1 + q.painterMarkup) : q.painter;
  const extraAmt = q.extras.reduce((t, e) => t + e.amount, 0);
  const extraHrs = q.extras.reduce((t, e) => t + e.hours, 0);
  const cost = sum.length + 1;
  sum.push(['What it costs you', null, null, null, null, null, money(r.cost, `Materials!D${matEnd + 2}*(1+Tax)+(Labor!F${laborEnd + 2}+${extraHrs})*LaborCost+${Math.round(painterCost * 100) / 100}+${extraAmt}`)]);
  sum.push([{ v: '(materials with tax, all hours at your labor cost, the painter’s cost and extras’ amounts)', s: 'note' }]);
  sum.push(['Margin', null, null, null, null, null, money(r.total - r.cost, `G${tot}-G${cost}`)]);
  sum.push(['Margin %', null, null, null, null, null, { v: r.total ? (r.total - r.cost) / r.total : 0, f: `IF(G${tot}>0,(G${tot}-G${cost})/G${tot},0)`, s: 'pct' }]);
  sum.push(['Effective $/hr (price less materials, per hour)', null, null, null, null, null, money(0, `IFERROR((G${tot}-Materials!D${matEnd + 2}*(1+Tax)-G${paintRow})/(Labor!F${laborEnd + 2}+${extraHrs}),0)`)]);
  // Cached value for the $/hr cell
  const allH = r.hours.reduce((t, h) => t + h.hours, 0) + extraHrs;
  (sum[sum.length - 1][6] as Cell).v = allH ? Math.round(((r.total - r.materialCost - r.painter) / allH) * 100) / 100 : 0;

  // ── Ballpark: the meeting calculator's numbers for the same design ──
  const bp = ballpark(p);
  const rc = rateCardOf(p);
  const cmp = comparableQuote(p);
  const ball: Row[] = [
    [{ v: `Ballpark (${bp.painted ? 'painted' : 'unfinished'} rate card)`, s: 'bold' }],
    [{ v: 'Lineal feet by kind of cabinetry and the adders, from the meeting calculator. Pilasters, mantels, ceilings, trim and extras aren’t on the card.', s: 'note' }],
    [],
    head('Line', 'Qty', 'Unit', 'Low rate', 'Typical rate', 'High rate', 'Low', 'Typical', 'High'),
  ];
  const b0 = ball.length + 1;
  for (const l of bp.lines) {
    const n = ball.length + 1;
    ball.push([l.label, { v: Math.round(l.qty * 100) / 100, s: 'input' }, l.unit, { v: l.rate[0], s: 'inputMoney' }, { v: l.rate[1], s: 'inputMoney' }, { v: l.rate[2], s: 'inputMoney' }, money(l.amount[0], `B${n}*D${n}`), money(l.amount[1], `B${n}*E${n}`), money(l.amount[2], `B${n}*F${n}`)]);
  }
  const b1 = ball.length;
  const bt = ball.length + 1;
  ball.push([{ v: 'Total', s: 'bold' }, null, null, null, null, null, money(bp.total[0], `SUM(G${b0}:G${b1})`), money(bp.total[1], `SUM(H${b0}:H${b1})`), money(bp.total[2], `SUM(I${b0}:I${b1})`)]);
  ball.push([]);
  const sp = ball.length + 1;
  ball.push(['Range spread', { v: rc.range, s: 'inputPct' }]);
  ball.push(['Round to', { v: rc.roundTo, s: 'inputMoney' }]);
  ball.push([{ v: 'Range to quote', s: 'bold' }, money(bp.low, `ROUND(H${bt}*(1-B${sp})/B${sp + 1},0)*B${sp + 1}`), money(bp.high, `ROUND(H${bt}*(1+B${sp})/B${sp + 1},0)*B${sp + 1}`)]);
  ball.push([]);
  const cm = ball.length + 1;
  ball.push(['This job’s calculated price for the same cabinetry', money(cmp.amount)]);
  if (cmp.paintEstimated) ball.push([{ v: '(painting estimated from size: no painter’s number yet)', s: 'note' }]);
  ball.push(['Against typical', { v: bp.total[1] ? (cmp.amount - bp.total[1]) / bp.total[1] : 0, f: `IF(H${bt}>0,(B${cm}-H${bt})/H${bt},0)`, s: 'pct' }]);

  return {
    names,
    sheets: [
      { name: 'Summary', rows: sum, widths: [44, 10, 13, 16, 16, 15, 14] },
      { name: 'Labor', rows: labor, widths: [22, 44, 9, 7, 11, 10, 15], freezeRows: 1 },
      { name: 'Materials', rows: mats, widths: [22, 40, 60, 12, 15], freezeRows: 1 },
      { name: 'Rates', rows: rates, widths: [36, 14, 60] },
      { name: 'Ballpark', rows: ball, widths: [44, 12, 6, 12, 13, 12, 12, 12, 12] },
    ],
  };
}

export const pricingXlsx = (p: Project) => writeXlsx(pricingWorkbook(p));
export const pricingFileName = (p: Project) => `${(p.name || 'Job').replace(/[\\/:*?"<>|]+/g, ' ').trim()} - pricing.xlsx`;
