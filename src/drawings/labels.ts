// Part labels for sheet goods: one per piece off the optimizer's layouts, in cutting order, so a label
// goes on each part as it comes off the saw (or the CNC). Printed on standard letter label sheets
// (Avery inkjet sizes) from any printer at 100%; each label carries the sheet and part number
// that match the layout diagrams.
import type { MaterialResult } from '../model/optimizer';
import type { DesignPart } from '../model/cutlist';
import { fmt } from '../units';

export interface PartLabel {
  /** Job-wide part number, in cutting order: what a CNC's nesting would call the part. */
  seq: number;
  job: string;
  cabinet: string;
  part: string;
  note?: string;
  material: string;
  length: number;
  width: number;
  grain: boolean;
  band: number;
  sheet: number;
  sheets: number;
  /** The number on the layout diagram. */
  n: number;
}

/** Every placed part, sheet by sheet in the order the layouts show them. */
export function partLabels(results: MaterialResult[], job: string): PartLabel[] {
  const out: PartLabel[] = [];
  for (const m of results) {
    m.sheets.forEach((sh, i) => {
      for (const p of [...sh.placed].sort((a, b) => a.n - b.n)) {
        const d = p.part as Partial<DesignPart> & typeof p.part;
        out.push({
          seq: out.length + 1, job, material: m.material, sheet: i + 1, sheets: m.sheets.length, n: p.n,
          cabinet: d.cabinet ?? '', part: d.name ?? d.label, note: d.note,
          length: p.part.length, width: p.part.width, grain: p.part.grain, band: p.part.band,
        });
      }
    });
  }
  return out;
}

/** Letter label sheets, measured from the manufacturer's templates (inches). Inkjet and laser versions share sizes. */
export const labelFormats = {
  '8163': { name: 'Avery 8163 / 5163: 2" × 4", 10 per sheet', w: 4, h: 2, cols: 2, rows: 5, left: 0.15625, top: 0.5, pitchX: 4.1875, pitchY: 2 },
  '8164': { name: 'Avery 8164 / 5164: 3⅓" × 4", 6 per sheet', w: 4, h: 3.3333, cols: 2, rows: 3, left: 0.15625, top: 0.5, pitchX: 4.1875, pitchY: 3.3333 },
  '8160': { name: 'Avery 8160 / 5160: 1" × 2⅝", 30 per sheet', w: 2.625, h: 1, cols: 3, rows: 10, left: 0.1875, top: 0.5, pitchX: 2.75, pitchY: 1 },
} as const;
export type LabelFormat = keyof typeof labelFormats;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function labelBody(l: PartLabel, small: boolean): string {
  const size = `${fmt(l.length)} × ${fmt(l.width)}`;
  const grain = l.grain ? '<span class="grain" title="Grain runs with the first number">↔ grain</span>' : '';
  const band = l.band ? `<span class="band">Band ${l.band === 1 ? 'front edge' : `${l.band} long edges`}</span>` : '';
  const where = `Sheet ${l.sheet}/${l.sheets} · #${l.n}`;
  if (small) {
    return `<div class="t">${esc(l.cabinet)} ${esc(l.part)}</div><div class="s">${size} ${grain}</div><div class="f">${where} · ${esc(l.job)}</div>`;
  }
  return `<div class="t"><b>${esc(l.cabinet)}</b> ${esc(l.part)}</div>`
    + (l.note ? `<div class="n">${esc(l.note)}</div>` : '')
    + `<div class="s">${size} ${grain} ${band}</div>`
    + `<div class="f"><span>${esc(l.material)}</span><span>${where}</span></div>`
    + `<div class="j"><span>${esc(l.job)}</span><span class="seq">P${String(l.seq).padStart(3, '0')}</span></div>`;
}

/**
 * Letter pages of labels, positioned to the inch, with their styles: classes prefixed lb- and the
 * pages on a named letter page, so they can ride along in a document with other page sizes (the
 * shop packet). start skips that many spots on the first sheet, for a sheet already partly used.
 */
export function labelPages(labels: PartLabel[], format: LabelFormat, start = 0): { css: string; body: string } {
  const f = labelFormats[format];
  const per = f.cols * f.rows;
  const small = f.h < 1.5;
  const slots = [...Array(Math.min(start, per - 1)).fill(null), ...labels] as (PartLabel | null)[];
  const pages: string[] = [];
  for (let i = 0; i < slots.length; i += per) {
    const cells = slots.slice(i, i + per).map((l, k) => {
      if (!l) return '';
      const x = f.left + (k % f.cols) * f.pitchX, y = f.top + Math.floor(k / f.cols) * f.pitchY;
      return `<div class="lb-lab" style="left:${x}in;top:${y}in;width:${f.w}in;height:${f.h}in">${labelBody(l, small)}</div>`;
    }).join('');
    pages.push(`<section class="lb-page">${cells}</section>`);
  }
  const fs = small ? 7.5 : f.h > 3 ? 12 : 10;
  const css = `
@page labels { size: letter; margin: 0 }
.lb-page { page: labels; position: relative; width: 8.5in; height: 11in; overflow: hidden; background: #fff; color: #000; page-break-after: always; break-after: page; box-sizing: border-box;
  font: ${fs}pt/1.2 -apple-system, "Helvetica Neue", Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact }
.lb-page * { box-sizing: border-box }
.lb-page:last-child { page-break-after: auto; break-after: auto }
.lb-lab { position: absolute; padding: ${small ? '0.06in 0.12in' : '0.14in 0.2in'}; display: flex; flex-direction: column; gap: ${small ? 0 : '0.03in'}; overflow: hidden }
.lb-lab .t { font-size: 1.35em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
.lb-lab .n { font-size: 0.85em; color: #333; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical }
.lb-lab .s { font-size: 1.15em; font-weight: 600; display: flex; gap: 0.6em; align-items: baseline; flex-wrap: wrap }
.lb-lab .grain, .lb-lab .band { font-size: 0.75em; font-weight: 400; border: 1px solid #000; border-radius: 3px; padding: 0 0.3em }
.lb-lab .f, .lb-lab .j { font-size: 0.8em; display: flex; justify-content: space-between; gap: 0.5em; white-space: nowrap }
.lb-lab .j { margin-top: auto; color: #444 }
.lb-lab .seq { font-family: ui-monospace, Menlo, monospace }
@media screen { .lb-page { margin: 0.25in auto; box-shadow: 0 1px 6px rgba(0,0,0,.4) } .lb-lab { outline: 1px dashed #bbb } }
@media print { .lb-page { margin: 0; box-shadow: none } }`;
  return { css, body: pages.join('') };
}

/** A printable document of labels on its own. */
export function labelDocument(labels: PartLabel[], format: LabelFormat, title: string, start = 0): string {
  const { css, body } = labelPages(labels, format, start);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
@page { size: letter; margin: 0 }
html, body { margin: 0; padding: 0; background: #fff }
@media screen { body { background: #888 } }
${css}
</style></head><body>${body}</body></html>`;
}
