// All dimensions in the app are stored as decimal inches.

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Format inches as a shop fraction, rounded to the nearest 1/16": 23.25 -> 23 1/4" */
export function fmt(inches: number, withMark = true): string {
  const mark = withMark ? '"' : '';
  const neg = inches < 0;
  let sixteenths = Math.round(Math.abs(inches) * 16);
  const whole = Math.floor(sixteenths / 16);
  sixteenths -= whole * 16;
  let out: string;
  if (sixteenths === 0) out = `${whole}`;
  else {
    const g = gcd(sixteenths, 16);
    const frac = `${sixteenths / g}/${16 / g}`;
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
