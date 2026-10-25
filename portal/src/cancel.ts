// The 3-day right to cancel for a home improvement contract signed away from the shop
// (MA G.L. c.93 §48 and the FTC cooling-off rule, 16 CFR 429): the deadline is midnight of the
// third business day after signing, where a business day is any day but Sunday or a legal
// holiday. Massachusetts holidays are counted (Patriots' Day included), which only ever makes
// the window longer, never shorter.

const nth = (y: number, m: number, weekday: number, n: number) => {
  const d = new Date(Date.UTC(y, m, 1));
  const shift = (weekday - d.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(y, m, 1 + shift + 7 * (n - 1)));
};
const last = (y: number, m: number, weekday: number) => {
  const d = new Date(Date.UTC(y, m + 1, 0));
  return new Date(Date.UTC(y, m, d.getUTCDate() - ((d.getUTCDay() - weekday + 7) % 7)));
};
/** A fixed-date holiday, plus the weekday it's observed on: Monday after a Sunday, Friday before a Saturday (both kept, so the window is never shorter). */
const fixed = (y: number, m: number, day: number) => {
  const d = new Date(Date.UTC(y, m, day));
  const wd = d.getUTCDay();
  return wd === 0 ? [new Date(Date.UTC(y, m, day + 1))] : wd === 6 ? [d, new Date(Date.UTC(y, m, day - 1))] : [d];
};

export function holidays(y: number): string[] {
  return [
    ...fixed(y, 0, 1), nth(y, 0, 1, 3), nth(y, 1, 1, 3), nth(y, 3, 1, 3), last(y, 4, 1), ...fixed(y, 5, 19), ...fixed(y, 6, 4),
    nth(y, 8, 1, 1), nth(y, 9, 1, 2), ...fixed(y, 10, 11), nth(y, 10, 4, 4), ...fixed(y, 11, 25),
  ].map((d) => d.toISOString().slice(0, 10));
}

/** The date (YYYY-MM-DD) by midnight of which the client can cancel, signing on `signed` (a date in Eastern time). */
export function cancelDeadline(signedYmd: string): string {
  const [y, m, d] = signedYmd.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d));
  let count = 0;
  while (count < 3) {
    day.setUTCDate(day.getUTCDate() + 1);
    const ymd = day.toISOString().slice(0, 10);
    if (day.getUTCDay() !== 0 && !holidays(day.getUTCFullYear()).includes(ymd)) count++;
  }
  return day.toISOString().slice(0, 10);
}

/** A moment as a date in Massachusetts time. */
export const easternYmd = (t: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
export const longDate = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
/** Still inside the window: before midnight Eastern at the end of the deadline day. */
export const canCancel = (signedAt: number, now = Date.now()) => easternYmd(now) <= cancelDeadline(easternYmd(signedAt));

/** The notice the client keeps, filled in (the FTC's wording, which Massachusetts accepts). */
export function noticeOfCancellation(signedYmd: string, seller: string, address: string): string {
  const deadline = longDate(cancelDeadline(signedYmd));
  return `<section class="notice"><h3>NOTICE OF CANCELLATION</h3>
<p><b>${longDate(signedYmd)}</b><br><span class="muted">(date of transaction)</span></p>
<p>YOU MAY CANCEL THIS TRANSACTION, WITHOUT ANY PENALTY OR OBLIGATION, WITHIN THREE BUSINESS DAYS FROM THE ABOVE DATE.</p>
<p>IF YOU CANCEL, ANY PROPERTY TRADED IN, ANY PAYMENTS MADE BY YOU UNDER THE CONTRACT OR SALE, AND ANY NEGOTIABLE INSTRUMENT EXECUTED BY YOU WILL BE RETURNED WITHIN 10 BUSINESS DAYS FOLLOWING RECEIPT BY THE SELLER OF YOUR CANCELLATION NOTICE, AND ANY SECURITY INTEREST ARISING OUT OF THE TRANSACTION WILL BE CANCELLED.</p>
<p>IF YOU CANCEL, YOU MUST MAKE AVAILABLE TO THE SELLER AT YOUR RESIDENCE, IN SUBSTANTIALLY AS GOOD CONDITION AS WHEN RECEIVED, ANY GOODS DELIVERED TO YOU UNDER THIS CONTRACT OR SALE, OR YOU MAY, IF YOU WISH, COMPLY WITH THE INSTRUCTIONS OF THE SELLER REGARDING THE RETURN SHIPMENT OF THE GOODS AT THE SELLER'S EXPENSE AND RISK.</p>
<p>IF YOU DO MAKE THE GOODS AVAILABLE TO THE SELLER AND THE SELLER DOES NOT PICK THEM UP WITHIN 20 DAYS OF THE DATE OF YOUR NOTICE OF CANCELLATION, YOU MAY RETAIN OR DISPOSE OF THE GOODS WITHOUT ANY FURTHER OBLIGATION. IF YOU FAIL TO MAKE THE GOODS AVAILABLE TO THE SELLER, OR IF YOU AGREE TO RETURN THE GOODS TO THE SELLER AND FAIL TO DO SO, THEN YOU REMAIN LIABLE FOR PERFORMANCE OF ALL OBLIGATIONS UNDER THE CONTRACT.</p>
<p>TO CANCEL THIS TRANSACTION, MAIL OR DELIVER A SIGNED AND DATED COPY OF THIS CANCELLATION NOTICE, OR ANY OTHER WRITTEN NOTICE, TO <b>${seller.toUpperCase()}</b>, AT <b>${address.toUpperCase()}</b>, NOT LATER THAN MIDNIGHT OF <b>${deadline.toUpperCase()}</b>. YOU MAY ALSO USE THE CANCEL BUTTON ON YOUR PROJECT PAGE BEFORE THEN.</p>
<p>I HEREBY CANCEL THIS TRANSACTION.</p>
<p class="sigline">(Date) ____________________ &nbsp; (Buyer's signature) ______________________________</p></section>`;
}
