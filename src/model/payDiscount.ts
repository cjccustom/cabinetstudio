// A discount for paying by check or bank transfer, the way Massachusetts allows: the listed price is
// the card price, and paying by check or bank transfer takes a percentage off it. Cody's quote is the
// check price (what he charges today); the card price is grossed up so the discount lands exactly on it.
import type { Project } from './types';
import { paymentSchedule } from './schedule';

/** The discount for check / bank transfer, 0–10%; 3% unless the job sets otherwise (0 turns it off). */
export function checkDiscountOf(p: Project): number {
  const d = p.quote?.checkDiscount;
  return d == null ? 0.03 : Math.max(0, Math.min(0.1, d));
}

/** The card price that the discount brings back to exactly this check price (to the dollar). */
export function cardOf(check: number, d: number): number {
  if (!d || !check) return check;
  const guess = Math.round(check / (1 - d));
  for (const k of [guess, guess + 1, guess - 1, guess + 2, guess - 2]) if (Math.round(k * (1 - d)) === check) return k;
  return guess;
}

/** Price lines at card prices, adding up to the card total (the rounding lands on the largest line). */
export function cardLines<T extends { price: number }>(lines: T[], d: number): T[] {
  if (!d) return lines;
  const out = lines.map((l) => ({ ...l, price: Math.round(l.price / (1 - d)) }));
  const want = cardOf(lines.reduce((t, l) => t + l.price, 0), d);
  const diff = want - out.reduce((t, l) => t + l.price, 0);
  if (diff && out.length) out.reduce((a, b) => (b.price > a.price ? b : a)).price += diff;
  return out;
}

/** The payment schedule both ways: what each payment is by check or bank transfer, and by card. */
export function paySchedule(p: Project, checkTotal: number, d: number): { label: string; check: number; card: number; pct: number }[] {
  const lines = paymentSchedule(p, checkTotal);
  const cardTotal = cardOf(checkTotal, d);
  let left = cardTotal;
  return lines.map((l, i) => {
    const card = i === lines.length - 1 ? left : cardOf(l.amount, d);
    left -= card;
    return { label: l.label, check: l.amount, card, pct: l.pct };
  });
}

export const pctText = (d: number) => `${+(d * 100).toFixed(1)}%`;
