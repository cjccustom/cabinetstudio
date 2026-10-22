// Quote requests laid out the way Eagle's website asks for them: one request each for doors
// (with end panels), drawer fronts and drawer boxes, with Eagle's own names and option codes.
import type { Project } from './types';
import { buildParts, eff } from './parts';
import { resolveEnds } from './layout';
import { eagleWood, framingBead, hingeBorings, slides, styleById } from './eagle';

export type RequestKind = 'doors' | 'fronts' | 'boxes';
export const requestTitle: Record<RequestKind, string> = { doors: 'Doors & panels', fronts: 'Drawer fronts', boxes: 'Drawer boxes' };

export interface EagleRequest {
  kind: RequestKind;
  /** Settings picked once per request, in the order the form asks for them. */
  config: [string, string][];
  columns: string[];
  lines: (string | number)[][];
  /** Settings that need checking against Eagle's form before submitting. */
  check: string[];
}

/** Eagle's form takes decimal inches. */
const dec = (v: number) => +v.toFixed(3);
/** Fractions the way Eagle writes them: 2-1/4", 3/4". */
export function eagleFraction(v: number): string {
  const whole = Math.floor(v + 1e-6);
  const n = Math.round((v - whole) * 16);
  if (!n) return `${whole}"`;
  let num = n, den = 16;
  while (num % 2 === 0) { num /= 2; den /= 2; }
  return whole ? `${whole}-${num}/${den}"` : `${num}/${den}"`;
}

interface Piece { kind: RequestKind; type: string; w: number; h: number; d?: number; rail?: number; stile?: number; config: [string, string][]; check: string[] }

function frontConfig(p: Project, cabId: string, kind: 'doors' | 'fronts', slab: boolean): { config: [string, string][]; check: string[] } {
  const c = p.cabinets.find((x) => x.id === cabId)!;
  const s = eff(c, p.settings);
  const style = styleById(s.doorStyleId);
  const check: string[] = [];
  const wood = style.line === 'MDF' ? 'MDF' : eagleWood[s.doorMaterial] ?? s.doorMaterial;
  if (slab) {
    return { config: [['Construction Type', 'Slab'], ['Wood Type', wood], ['Door Thickness', eagleFraction(s.doorThickness)], ['Finish', 'None'], ['Hinge Holes', kind === 'doors' ? hingeBorings[s.hingeBoring] : 'None']], check: ['Slab doors haven’t been ordered through the app yet'] };
  }
  const bead = framingBead[style.id];
  if (style.line === 'MDF') check.push(`${style.name} is an MDF door; only paint-grade maple 5-piece has been ordered through the app`);
  else if (!bead) check.push(`No framing bead letter for ${style.name}`);
  else if (!bead.confirmed) check.push(`Framing bead letter ${bead.letter} for ${style.name} is a guess`);
  if (s.doorPanel === 'raised') check.push('Raised panel code not known yet');
  const stile = style.fixedStile ? style.stile : s.doorStile;
  const config: [string, string][] = [
    ['Construction Type', style.line === 'MDF' ? '5-Piece Doors (MDF)' : '5-Piece Doors (Wood only)'],
    ['Wood Type', wood],
    ['Door Thickness', eagleFraction(s.doorThickness)],
    ['Rail and Stile Width', eagleFraction(stile)],
    ['Framing Bead', bead ? `5pc - ${bead.letter} (${style.name})` : style.name],
    ['Outside Edge', 'E-01 (hand broken - default)'],
    ['Center Panel', s.doorPanel === 'raised' ? 'Raised panel' : kind === 'doors' ? 'MDF-07 (1/4" flat panel - default 5pc painted)' : 'MDF-10 (flat front)'],
    ['Finish', 'None'],
    ['Hinge Holes', kind === 'doors' ? hingeBorings[s.hingeBoring] : 'None'],
  ];
  return { config, check };
}

function pieces(p: Project): Piece[] {
  const out: Piece[] = [];
  for (const c of p.cabinets) {
    const s = eff(c, p.settings);
    for (const part of buildParts(c, p.settings, resolveEnds(p.room, p.cabinets, c))) {
      const o = part.order;
      if (!o) continue;
      if (o.item === 'drawerBox') {
        const slide = slides.find((x) => x.id === s.drawerSlide);
        const notch = slide?.id === 'tandem' ? '1-3/8' : slide?.id === 'sidemount' ? 'None' : 'Check';
        out.push({
          kind: 'boxes', type: 'Drawer', w: o.w, h: o.h, d: o.d,
          config: [['Delivery Type', 'Eagle Delivery'], ['Ship to', 'Billing Address'], ['Drawer material', `${eagleFraction(s.drawerSide).replace('"', '')} maple`], ['Hardware', 'no-hardware'], ['Locking Device', 'none'], ['Rear Mounting Bracket', 'none']],
          check: notch === 'Check' ? ['Notch and bore for these slides'] : [],
        });
        continue;
      }
      const kind = o.item === 'drawerFront' ? 'fronts' : 'doors';
      const { config, check } = frontConfig(p, c.id, kind, o.rail == null);
      out.push({ kind, type: o.item === 'door' ? 'Door' : o.item === 'endPanel' ? 'Panel' : 'Drawer Front', w: o.w, h: o.h, rail: o.rail, stile: o.stile, config, check });
    }
  }
  return out;
}

/** One request per kind and per set of options; a job with two door styles gets two door requests. */
export function eagleRequests(p: Project): EagleRequest[] {
  const groups = new Map<string, Piece[]>();
  for (const pc of pieces(p)) {
    const key = pc.kind + JSON.stringify(pc.config);
    groups.set(key, [...(groups.get(key) ?? []), pc]);
  }
  const order: RequestKind[] = ['doors', 'fronts', 'boxes'];
  return [...groups.values()]
    .sort((a, b) => order.indexOf(a[0].kind) - order.indexOf(b[0].kind))
    .map((list) => {
      const kind = list[0].kind;
      const counts = new Map<string, { pc: Piece; qty: number }>();
      for (const pc of list) {
        const key = [pc.type, dec(pc.w), dec(pc.h), pc.d ?? '', pc.rail ?? '', pc.stile ?? ''].join('|');
        const row = counts.get(key);
        if (row) row.qty++; else counts.set(key, { pc, qty: 1 });
      }
      const rows = [...counts.values()];
      const check = [...new Set(list.flatMap((pc) => pc.check))];
      if (kind === 'boxes') {
        const notch = list[0].check.length ? 'Check' : '1-3/8';
        rows.sort((a, b) => b.pc.h - a.pc.h || b.pc.w - a.pc.w);
        return {
          kind, config: list[0].config, check,
          columns: ['Line#', 'Qty', 'Height', 'Width', 'Depth', 'Bottom', 'Notch Bore', 'Finish', 'Finish Front', 'Scoop', 'Engrave'],
          lines: rows.map((r, i) => [i + 1, r.qty, dec(r.pc.h), dec(r.pc.w), dec(r.pc.d ?? 0), '1/4"', notch, 'Yes', 'No', 'No', 'No']),
        };
      }
      rows.sort((a, b) => (a.pc.type === b.pc.type ? 0 : a.pc.type === 'Door' ? -1 : 1) || b.pc.h - a.pc.h || b.pc.w - a.pc.w);
      const slab = list[0].rail == null;
      return {
        kind, config: list[0].config, check,
        columns: slab ? ['Line', 'Type', 'Qty', 'Width', 'Height'] : ['Line', 'Type', 'Qty', 'Width', 'Height', 'Rails', 'Stiles'],
        lines: rows.map((r, i) => {
          const base: (string | number)[] = [i + 1, r.pc.type, r.qty, dec(r.pc.w), dec(r.pc.h)];
          return slab ? base : [...base, eagleFraction(r.pc.rail!), eagleFraction(r.pc.stile!)];
        }),
      };
    });
}

/** Plain text of one request, to paste or keep with the job. */
export function requestText(jobName: string, r: EagleRequest): string {
  const lines = [`${jobName}: Eagle quote request, ${requestTitle[r.kind].toLowerCase()}`, ''];
  for (const [k, v] of r.config) lines.push(`${k}: ${v}`);
  lines.push('', r.columns.join('\t'));
  for (const l of r.lines) lines.push(l.join('\t'));
  if (r.check.length) lines.push('', ...r.check.map((c) => `CHECK: ${c}`));
  return lines.join('\n');
}
