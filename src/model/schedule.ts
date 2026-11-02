// The payment schedule on the purchase agreement: payments before the last, each a share of the
// total or a set amount, and the final payment for whatever is left. Default: 30% deposit at
// agreement, the balance on completion.
import type { Project } from './types';

export interface PaymentStep { id: string; label: string; /** Share of the total, 0.3 = 30%. */ pct?: number; /** Or a set amount. */ amount?: number }
export const defaultPayments: PaymentStep[] = [{ id: 'deposit', label: 'Deposit due at agreement', pct: 0.3 }];
export const defaultFinalLabel = 'Final payment due upon completion';

export interface ScheduleLine { label: string; amount: number; pct: number }

export const paymentsOf = (p: Project): PaymentStep[] => (p.quote?.payments?.length ? p.quote.payments : defaultPayments);

/** Each payment in dollars (rounded to the dollar), the final one taking the remainder so they add to the total. */
export function paymentSchedule(p: Project, total: number): ScheduleLine[] {
  const steps = paymentsOf(p);
  const out: ScheduleLine[] = [];
  let left = total;
  for (const s of steps) {
    const amt = Math.max(0, Math.min(left, Math.round(s.amount != null ? s.amount : total * (s.pct ?? 0))));
    out.push({ label: s.label.trim() || 'Payment', amount: amt, pct: total ? amt / total : 0 });
    left -= amt;
  }
  out.push({ label: p.quote?.finalPaymentLabel?.trim() || defaultFinalLabel, amount: left, pct: total ? left / total : 0 });
  return out;
}

/** "30%" for the share a payment is of the total, for the options note. */
export const pctText = (v: number) => `${Math.round(v * 100)}%`;
