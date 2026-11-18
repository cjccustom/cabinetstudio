// A small G-code reader: enough of the language the router programs use (G0/G1 moves, modal X/Y/Z/F,
// tool numbers, spindle on and off) to draw a program and check it before it goes to the machine.
// Reads Cabinet Studio's programs and the manufacturers' samples alike.

export interface GSeg { rapid: boolean; tool: number; a: [number, number, number]; b: [number, number, number]; f?: number; line: number }
export interface GRead { segs: GSeg[]; tools: number[]; units: 'mm' | 'in'; bounds: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }; warnings: string[] }

export function readGcode(text: string, units: 'mm' | 'in' = 'mm'): GRead {
  let x = 0, y = 0, z = 0, f: number | undefined, mode = 0, tool = 0, spindle = false;
  let u = units;
  const segs: GSeg[] = [];
  const tools: number[] = [];
  const warnings: string[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.replace(/\(.*?\)|;.*$/g, '').toUpperCase().replace(/\s+/g, '');
    if (!line) return;
    const words = [...line.matchAll(/([A-Z])(-?\d*\.?\d+)/g)].map((m) => [m[1], parseFloat(m[2])] as const);
    let nx = x, ny = y, nz = z, moved = false;
    for (const [w, v] of words) {
      if (w === 'G') { if (v === 0 || v === 1) mode = v; else if (v === 20) u = 'in'; else if (v === 21) u = 'mm'; }
      else if (w === 'X') { nx = v; moved = true; }
      else if (w === 'Y') { ny = v; moved = true; }
      else if (w === 'Z') { nz = v; moved = true; }
      else if (w === 'F') f = v;
      else if (w === 'T') { tool = v; if (!tools.includes(v)) tools.push(v); }
      else if (w === 'M') { if (v === 3 || v === 4) spindle = true; else if (v === 5 || v === 30 || v === 2) spindle = false; }
    }
    if (!moved) return;
    if (mode === 1 && !spindle) warnings.push(`Line ${i + 1}: cutting move with the spindle off.`);
    if (mode === 1 && f == null) warnings.push(`Line ${i + 1}: cutting move with no feed rate set.`);
    segs.push({ rapid: mode === 0, tool, a: [x, y, z], b: [nx, ny, nz], f, line: i + 1 });
    [x, y, z] = [nx, ny, nz];
  });
  const all = segs.flatMap((s) => [s.a, s.b]);
  const pick = (k: 0 | 1 | 2, fn: (...v: number[]) => number) => (all.length ? fn(...all.map((p) => p[k])) : 0);
  return { segs, tools, units: u, warnings, bounds: { x0: pick(0, Math.min), x1: pick(0, Math.max), y0: pick(1, Math.min), y1: pick(1, Math.max), z0: pick(2, Math.min), z1: pick(2, Math.max) } };
}

/**
 * What would hurt the machine, the part or the spoilboard: moves sideways through the material at
 * rapid, cuts deeper than the limit, or anything off the sheet. Units as the program's.
 */
export function checkGcode(g: GRead, limits: { length: number; width: number; deepest: number; margin: number }): string[] {
  const out = [...g.warnings];
  for (const s of g.segs) {
    const sideways = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) > 1e-6;
    if (s.rapid && sideways && Math.min(s.a[2], s.b[2]) < 0) out.push(`Line ${s.line}: rapid move sideways below the top of the sheet.`);
    if (s.b[2] < -limits.deepest - 0.002) out.push(`Line ${s.line}: cuts ${(-s.b[2]).toFixed(3)} deep, past the ${limits.deepest.toFixed(3)} limit.`);
    for (const p of [s.a, s.b]) if (p[2] < 0 && (p[0] < -limits.margin || p[1] < -limits.margin || p[0] > limits.length + limits.margin || p[1] > limits.width + limits.margin)) { out.push(`Line ${s.line}: cutting off the sheet.`); break; }
  }
  return [...new Set(out)].slice(0, 50);
}
