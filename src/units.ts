// All dimensions in the app are stored as decimal inches.

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Format inches as a shop fraction: 23.25 -> 23 1/4". Rounds to the nearest 1/16",
 * except exact 32nds (like a 3/32" reveal), which are shown as they are.
 */
export function fmt(inches: number, withMark = true): string {
  const mark = withMark ? '"' : '';
  const neg = inches < 0;
  const abs = Math.abs(inches);
  const den = Math.abs(abs * 32 - Math.round(abs * 32)) < 1e-6 ? 32 : 16;
  let parts = Math.round(abs * den);
  const whole = Math.floor(parts / den);
  parts -= whole * den;
  let out: string;
  if (parts === 0) out = `${whole}`;
  else {
    const g = gcd(parts, den);
    const frac = `${parts / g}/${den / g}`;
    out = whole ? `${whole} ${frac}` : frac;
  }
  return (neg ? '-' : '') + out + mark;
}

/** Format as feet and inches for long runs: 156 -> 13' 0" */
export function fmtFeet(inches: number): string {
  const ft = Math.floor(Math.round(inches * 16) / 16 / 12);
  return `${ft}' ${fmt(inches - ft * 12)}`;
}

/**
 * Parse what a cabinetmaker types: 23.25, 23 1/4, 23-1/4, 3/4, 2' 6", 30".
 * Returns null when the text can't be read.
 */
export function parseLength(text: string): number | null {
  let s = text.trim().replace(/[”″]/g, '"').replace(/[’′]/g, "'");
  if (!s) return null;
  let total = 0;
  const feet = s.match(/^(-?\d+(?:\.\d+)?)\s*'\s*-?\s*/);
  if (feet) {
    total += parseFloat(feet[1]) * 12;
    s = s.slice(feet[0].length);
  }
  s = s.replace(/"$/, '').trim();
  if (!s) return feet ? total : null;
  const m = s.match(/^(\d+(?:\.\d+)?)?(?:\s+|-)?(?:(\d+)\/(\d+))?$/);
  if (!m || (!m[1] && !m[2])) return null;
  if (m[1]) total += parseFloat(m[1]);
  if (m[2]) {
    const den = parseInt(m[3], 10);
    if (!den) return null;
    total += parseInt(m[2], 10) / den;
  }
  return total;
}

export const round16 = (v: number) => Math.round(v * 16) / 16;
