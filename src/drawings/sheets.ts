// Drawing sets: the customer's (cover, floor plan, wall elevations) and the shop's (a wall
// assembly sheet per wall, then a sheet per cabinet), on 11×17 or letter, each with CJC's title
// block. Every sheet is one SVG at true size, so it prints to scale.
import type { Cabinet, Part, Project, WallId } from '../model/types';
import { wallOrder, wallNames, wallLength } from '../model/layout';
import { clientName, clientOf, COMPANY } from '../model/client';
import { eff } from '../model/parts';
import { styleById } from '../model/eagle';
import { baseLabel } from '../model/cabinetBase';
import { fmt } from '../units';
import { beamSection, cabinetsOn, ceilingPlan, faceFrameView, floorPlan, mantelViews, partRows, partsOf, sideSection, wallElevation } from './views';
import { cofferOf, cofferParts } from '../model/coffer';
import { fuelLabel, mantelOf } from '../model/mantel';
import { cofferScope } from '../model/quote';
import { drawingCss, scaleName, type Frame } from './draw';
import { cabinetCallouts, forAudience, jobCallouts, type Audience } from './notes';
import { LOGO, LOGO_ASPECT } from './logo';

export type Paper = 'tabloid' | 'letter';
export const papers: Record<Paper, { w: number; h: number; label: string }> = {
  tabloid: { w: 17, h: 11, label: '11 × 17' },
  letter: { w: 11, h: 8.5, label: '8-1/2 × 11' },
};

export interface DrawingSettings { paper: Paper; rev: number; cover?: string; notes: string }
export const drawingsOf = (p: Project): DrawingSettings => ({ paper: 'tabloid', rev: 0, notes: '', ...p.drawings });

export interface Sheet { id: string; number: string; title: string; svg: string }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const M = 0.4;
const tbH = (paper: Paper) => (paper === 'tabloid' ? 0.85 : 0.72);
const today = () => new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

/** The drawing area on a sheet, inside the border and above the title block. */
export function area(paper: Paper): Frame {
  const P = papers[paper];
  return { x: M + 0.15, y: M + 0.15, w: P.w - 2 * M - 0.3, h: P.h - 2 * M - tbH(paper) - 0.3 };
}

function titleBlock(p: Project, s: DrawingSettings, number: string, title: string, scale: string): string {
  const P = papers[s.paper];
  const h = tbH(s.paper);
  const y = P.h - M - h;
  const x0 = M, x1 = P.w - M;
  const c = clientOf(p);
  const fs = s.paper === 'tabloid' ? 1 : 0.85;
  const cols = s.paper === 'tabloid' ? [3.4, 5.2, 3.2, 2.4] : [2.6, 3.0, 2.0, 1.4];
  const xs = [x0];
  for (const w of cols) xs.push(xs[xs.length - 1] + w);
  const t = (x: number, yy: number, str: string, size: number, weight = 400) => `<text x="${x}" y="${yy}" font-size="${size * fs}" font-weight="${weight}">${esc(str)}</text>`;
  return [
    `<rect class="f" x="${x0}" y="${y}" width="${x1 - x0}" height="${h}"/>`,
    ...xs.slice(1, -1).map((x) => `<line class="thin" x1="${x}" y1="${y}" x2="${x}" y2="${y + h}"/>`),
    `<line class="thin" x1="${xs[4]}" y1="${y}" x2="${xs[4]}" y2="${y + h}"/>`,
    // Logo, then address, phone and licenses
    `<image href="${LOGO}" x="${xs[0] + 0.12}" y="${y + 0.07}" width="${(h * 0.4) * LOGO_ASPECT}" height="${h * 0.4}"/>`,
    t(xs[0] + 0.12, y + h * 0.6, COMPANY[1], 0.075),
    t(xs[0] + 0.12, y + h * 0.73, COMPANY[2], 0.075),
    t(xs[0] + 0.12, y + h * 0.86, COMPANY[3], 0.065),
    t(xs[1] + 0.12, y + 0.2, 'CLIENT / PROJECT', 0.065, 600),
    t(xs[1] + 0.12, y + 0.38, clientName(c) || p.name, 0.13, 700),
    t(xs[1] + 0.12, y + 0.54, c.address || c.location || '', 0.09),
    t(xs[1] + 0.12, y + 0.68, p.name, 0.085),
    t(xs[2] + 0.12, y + 0.2, 'SHEET', 0.065, 600),
    t(xs[2] + 0.12, y + 0.42, title, 0.12, 700),
    t(xs[2] + 0.12, y + 0.62, `Scale: ${scale}`, 0.085),
    t(xs[3] + 0.12, y + 0.2, 'DATE', 0.065, 600),
    t(xs[3] + 0.12, y + 0.36, today(), 0.09),
    t(xs[3] + 0.12, y + 0.54, 'REVISION', 0.065, 600),
    t(xs[3] + 0.12, y + 0.68, s.rev ? `Rev ${s.rev}` : 'Original', 0.09),
    `<text x="${(xs[4] + x1) / 2}" y="${y + h / 2 + 0.12}" font-size="${0.34 * fs}" font-weight="700" text-anchor="middle">${esc(number)}</text>`,
  ].join('');
}

function sheet(p: Project, s: DrawingSettings, number: string, title: string, scale: string, body: string): Sheet {
  const P = papers[s.paper];
  const svg = `<svg class="dwg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${P.w} ${P.h}" width="${P.w}in" height="${P.h}in">`
    + `<rect x="0" y="0" width="${P.w}" height="${P.h}" fill="#fff"/>`
    + `<rect class="heavy" x="${M}" y="${M}" width="${P.w - 2 * M}" height="${P.h - 2 * M}"/>`
    + body + titleBlock(p, s, number, title, scale) + '</svg>';
  return { id: number, number, title, svg };
}

/** HTML (tables, lists) placed on a sheet. */
// Laid out at 100 units to the inch: browsers round CSS sizes to whole pixels, and a pixel is a full inch at sheet scale.
const html = (f: Frame, inner: string, size = 0.1) =>
  `<g transform="translate(${f.x} ${f.y}) scale(0.01)"><foreignObject x="0" y="0" width="${f.w * 100}" height="${f.h * 100}"><div xmlns="http://www.w3.org/1999/xhtml" class="fo" style="font-size:${size * 100}px">${inner}</div></foreignObject></g>`;

/** The notes column on an elevation: the job's, then each cabinet's on that wall, by tag. */
function wallNotes(p: Project, wall: WallId, a: Audience): string {
  const items = cabinetsOn(p, wall).flatMap((c) => forAudience(cabinetCallouts(p, c), a).map((n) => `<li><b>${esc(c.name)}</b> ${esc(n.text)}</li>`));
  return `<h2>Notes</h2><ul>${jobCallouts(p, a).map((t) => `<li>${esc(t)}</li>`).join('')}${items.join('')}</ul>`;
}

const wallsWithWork = (p: Project) => wallOrder.filter((w) => cabinetsOn(p, w).length > 0);

/* ---------- Customer set ---------- */

export function customerSet(p: Project, s: DrawingSettings): Sheet[] {
  const A = area(s.paper);
  const walls = wallsWithWork(p);
  const sheets: Sheet[] = [];
  const ceiling = cofferOf(p).on;
  const first = ceiling ? 3 : 2;
  const index = [['A0', 'Cover'], ['A1', 'Floor plan'], ...(ceiling ? [['A2', 'Ceiling plan']] : []), ...walls.map((w, i) => [`A${i + first}`, `${wallNames[w]} elevation`])];
  // Cover: the picture, the job, and what's in the set
  const c = clientOf(p);
  const imgW = A.w * 0.64;
  const cover = [
    s.cover ? `<image href="${esc(s.cover)}" x="${A.x}" y="${A.y}" width="${imgW}" height="${A.h}" preserveAspectRatio="xMidYMid meet"/>` : `<rect class="ghost" x="${A.x}" y="${A.y}" width="${imgW}" height="${A.h}"/><text x="${A.x + imgW / 2}" y="${A.y + A.h / 2}" font-size="0.14" text-anchor="middle" fill="#888">Add a 3D view or rendering for the cover</text>`,
    html({ x: A.x + imgW + 0.3, y: A.y, w: A.w - imgW - 0.3, h: A.h }, `
      <img src="${LOGO}" alt="CJC Custom Carpentry" style="width:62%;margin:0 0 1.2em"/>
      <h1>${esc(p.name)}</h1>
      <p class="big">${esc(clientName(c))}</p>
      <p>${esc(c.address || c.location || '')}</p>
      <h2>Drawings</h2>
      <table class="idx">${index.map(([n, t]) => `<tr><td>${n}</td><td>${esc(t)}</td></tr>`).join('')}</table>
      ${s.notes ? `<h2>Notes</h2><p>${esc(s.notes).replace(/\n/g, '<br>')}</p>` : ''}
      <p class="small">Drawings show design intent. Final dimensions are field verified before fabrication.</p>`, s.paper === 'tabloid' ? 0.13 : 0.11),
  ].join('');
  sheets.push(sheet(p, s, 'A0', 'Cover', 'None', cover));
  const plan = floorPlan(p, A);
  sheets.push(sheet(p, s, 'A1', 'Floor plan', scaleName(plan.scale), plan.svg));
  if (ceiling) {
    const rcp = ceilingPlan(p, { ...A, w: A.w * 0.74 });
    const notes = html({ x: A.x + A.w * 0.76, y: A.y, w: A.w * 0.24, h: A.h }, `<h2>Notes</h2><p>${esc(cofferScope(p) ?? '')}</p><p class="small">Coffer sizes are clear openings, fascia face to fascia face.</p>`, s.paper === 'tabloid' ? 0.11 : 0.09);
    sheets.push(sheet(p, s, 'A2', 'Ceiling plan', scaleName(rcp.scale), rcp.svg + notes));
  }
  walls.forEach((w, i) => {
    const e = wallElevation(p, w, { ...A, w: A.w * 0.74 }, 'customer');
    const notes = html({ x: A.x + A.w * 0.76, y: A.y, w: A.w * 0.24, h: A.h }, wallNotes(p, w, 'customer'), s.paper === 'tabloid' ? 0.11 : 0.09);
    sheets.push(sheet(p, s, `A${i + first}`, `${wallNames[w]} elevation`, scaleName(e.scale), e.svg + notes));
  });
  return sheets;
}

/* ---------- Shop set ---------- */

const kinds: Record<Cabinet['kind'], string> = { base: 'Base', wall: 'Wall', tall: 'Tall', pilaster: 'Pilaster', shelf: 'Floating shelf', mantel: 'Mantel' };

function installNotes(p: Project, wall: WallId): string {
  const cs = cabinetsOn(p, wall);
  const floor = cs.filter((c) => c.elevation < 6 && c.kind !== 'shelf');
  const uppers = cs.filter((c) => !floor.includes(c));
  const L = wallLength(p.room, wall);
  const gaps: string[] = [];
  const pts = [0, ...floor.flatMap((c) => [c.offset, c.offset + c.width]), L].sort((a, b) => a - b);
  for (let i = 0; i + 1 < pts.length; i += 2) if (pts[i + 1] - pts[i] > 0.25) gaps.push(`${fmt(pts[i + 1] - pts[i])} at ${fmt(pts[i])} from the left`);
  const li = (c: Cabinet) => `<li><b>${esc(c.name)}</b> ${kinds[c.kind]} ${fmt(c.width)} W × ${fmt(c.height)} H × ${fmt(c.depth)} D${c.elevation > 0.5 ? `, bottom at ${fmt(c.elevation)} AFF` : ''}${(c.scribeLeft ?? 0) || (c.scribeRight ?? 0) ? `; scribe ${[c.scribeLeft ? `left ${fmt(c.scribeLeft)}` : '', c.scribeRight ? `right ${fmt(c.scribeRight)}` : ''].filter(Boolean).join(', ')}` : ''}</li>`;
  return `${wallNotes(p, wall, 'shop')}<h2>${esc(wallNames[wall])}: install order</h2>
    <ol>${[...floor, ...uppers].map(li).join('')}</ol>
    ${gaps.length ? `<h3>Open space along the floor</h3><ul>${gaps.map((g) => `<li>${g}</li>`).join('')}</ul>` : ''}
    <p class="small">Set bases level from the high point of the floor. Heights are above finished floor (AFF).</p>`;
}

function cabinetHeader(p: Project, c: Cabinet): string {
  const s = eff(c, p.settings);
  const style = styleById(s.doorStyleId);
  const bits = [
    `${kinds[c.kind]}, ${fmt(c.width)} W × ${fmt(c.height)} H × ${fmt(c.depth)} D${c.elevation > 0.5 ? `, ${fmt(c.elevation)} AFF` : ''}`,
    `${wallNames[c.wall]}, ${fmt(c.offset)} from the left`,
    c.kind === 'mantel' ? `${mantelOf(c).species}, paint grade; ${fuelLabel[mantelOf(c).fuel].toLowerCase()}` : `${style.name} ${s.doorMount === 'inset' ? 'inset' : 'overlay'}; face frame ${fmt(s.ffThickness)} ${p.settings.woodSpecies}`,
    baseLabel(c) ?? (c.kind === 'base' || c.kind === 'tall' ? `${fmt(s.toeKickHeight)} toe kick` : ''),
  ].filter(Boolean);
  const notes = forAudience(cabinetCallouts(p, c), 'shop');
  return `<h2>${esc(c.name)}</h2><p>${bits.map(esc).join('<br>')}</p>${notes.length ? `<h3>Notes</h3><ul>${notes.map((n) => `<li>${esc(n.text)}</li>`).join('')}</ul>` : ''}`;
}

function materialName(p: Project, part: Part): string {
  const s = p.settings;
  if (part.sheet) return part.sheet;
  switch (part.material) {
    case 'box': return `${fmt(part.thickness)} case ply`;
    case 'back': return `${fmt(part.thickness)} back`;
    case 'toeSkin': return `${fmt(part.thickness)} toe kick skin`;
    case 'faceframe': return part.species ?? s.woodSpecies;
    case 'solidWood': return part.species ?? s.woodSpecies;
    case 'counter': return part.name.startsWith('Hearth') ? 'Stone (by others)' : 'Countertop (by others)';
    default: return part.material;
  }
}

function partsTable(p: Project, c: Cabinet): string {
  const rows = partRows(partsOf(p, c));
  const cut = rows.filter((r) => r.part.cut);
  const bought = rows.filter((r) => !r.part.cut && r.part.role !== 'counter');
  const tr = (r: { part: Part; qty: number }) =>
    `<tr><td>${r.qty}</td><td>${esc(r.part.name)}</td><td>${fmt(r.part.length)}</td><td>${fmt(r.part.width)}</td><td>${fmt(r.part.thickness)}</td><td>${esc(materialName(p, r.part))}</td><td>${esc(r.part.note ?? '')}</td></tr>`;
  const size = (part: Part) => {
    const o = part.order;
    if (!o) return `${fmt(part.length)} × ${fmt(part.width)}`;
    return `${fmt(o.w)} W × ${fmt(o.h)} H${o.d ? ` × ${fmt(o.d)} D` : ''}`;
  };
  const br = (r: { part: Part; qty: number }) => `<tr><td>${r.qty}</td><td>${esc(r.part.name)}</td><td>${size(r.part)}</td><td>${esc(r.part.order?.spec ?? r.part.note ?? '')}</td></tr>`;
  return `<table class="parts"><thead><tr><th>Qty</th><th>Part</th><th>Length</th><th>Width</th><th>Thick</th><th>Material</th><th>Notes</th></tr></thead><tbody>${cut.map(tr).join('')}</tbody></table>
    ${bought.length ? `<h3>Ordered (Eagle)</h3><table class="parts"><thead><tr><th>Qty</th><th>Item</th><th>Size</th><th>Spec</th></tr></thead><tbody>${bought.map(br).join('')}</tbody></table>` : ''}`;
}

export function shopSet(p: Project, s: DrawingSettings): Sheet[] {
  const A = area(s.paper);
  const sheets: Sheet[] = [];
  const walls = wallsWithWork(p);
  walls.forEach((w, i) => {
    const elevFrame = { ...A, w: A.w * 0.7 };
    const e = wallElevation(p, w, elevFrame, 'shop');
    const notes = html({ x: A.x + A.w * 0.72, y: A.y, w: A.w * 0.28, h: A.h }, installNotes(p, w), s.paper === 'tabloid' ? 0.11 : 0.095);
    sheets.push(sheet(p, s, `S${i + 1}`, `${wallNames[w]} assembly`, scaleName(e.scale), e.svg + notes));
  });
  let n = 0;
  for (const w of wallOrder) for (const c of cabinetsOn(p, w)) {
    n++;
    const parts = partsOf(p, c);
    const hasFrame = parts.some((x) => x.material === 'faceframe' && (x.role === 'stile' || x.role === 'rail'));
    const viewH = A.h * 0.56;
    const left: Frame = { x: A.x, y: A.y + 0.1, w: A.w * 0.4, h: viewH };
    const mid: Frame = { x: A.x + A.w * 0.4, y: A.y + 0.1, w: A.w * 0.34, h: viewH };
    const mv = c.kind === 'mantel' ? mantelViews(p, c, left, mid) : null;
    const ff = hasFrame ? faceFrameView(p, c, left) : mv;
    const sec = c.kind === 'shelf' || c.kind === 'pilaster' || c.kind === 'mantel' ? null : sideSection(p, c, mid);
    const labels = [
      ff ? `<text x="${left.x + left.w / 2}" y="${left.y + left.h + 0.05}" font-size="0.11" font-weight="700" text-anchor="middle">${mv ? 'MANTEL' : 'FACE FRAME'} (${esc(scaleName(ff.scale))})</text>` : '',
      sec ? `<text x="${mid.x + mid.w / 2}" y="${mid.y + mid.h + 0.05}" font-size="0.11" font-weight="700" text-anchor="middle">SECTION, FROM THE LEFT (${esc(scaleName(sec.scale))})</text>` : '',
    ].join('');
    const info = html({ x: A.x + A.w * 0.76, y: A.y, w: A.w * 0.24, h: viewH }, cabinetHeader(p, c), s.paper === 'tabloid' ? 0.11 : 0.09);
    const table = html({ x: A.x, y: A.y + viewH + 0.25, w: A.w, h: A.h - viewH - 0.25 }, partsTable(p, c), s.paper === 'tabloid' ? 0.095 : 0.075);
    sheets.push(sheet(p, s, `S${walls.length + n}`, `${c.name} shop drawing`, ff ? scaleName(ff.scale) : 'As noted', (ff?.svg ?? '') + (sec?.svg ?? '') + labels + info + table));
  }
  if (cofferOf(p).on) {
    const top = A.h * 0.58;
    const rcp = ceilingPlan(p, { x: A.x, y: A.y, w: A.w * 0.6, h: top });
    const sec = beamSection(p, { x: A.x + A.w * 0.6, y: A.y, w: A.w * 0.4, h: top });
    const rows = partRows(cofferParts(p)).map(({ part, qty }) => `<tr><td>${qty}</td><td>${esc(part.name)}</td><td>${fmt(part.length)}</td><td>${fmt(part.width)}</td><td>${fmt(part.thickness)}</td><td>${esc(part.species ?? '')}</td><td>${esc(part.note ?? '')}</td></tr>`).join('');
    const table = html({ x: A.x, y: A.y + top + 0.2, w: A.w, h: A.h - top - 0.2 }, `<table class="parts"><thead><tr><th>Qty</th><th>Part</th><th>Length</th><th>Width</th><th>Thick</th><th>Stock</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table>`, s.paper === 'tabloid' ? 0.09 : 0.07);
    sheets.push(sheet(p, s, `S${sheets.length + 1}`, 'Coffered ceiling', `${scaleName(rcp.scale)}; section ${scaleName(sec.scale)}`, rcp.svg + sec.svg + table));
  }
  return sheets;
}

/** Styles for the HTML parts of a sheet (inside foreignObject). Sizes are in sheet inches. */
export const sheetCss = drawingCss + `
.dwg .fo{font-family:"Helvetica Neue",Arial,sans-serif;color:#111;line-height:1.3;height:100%;overflow:hidden}
.dwg .fo h1{font-size:2.1em;margin:0 0 .3em}
.dwg .fo h2{font-size:1.25em;margin:.8em 0 .3em}
.dwg .fo h3{font-size:1.05em;margin:.7em 0 .25em}
.dwg .fo p{margin:.2em 0 .5em}
.dwg .fo .big{font-size:1.4em;font-weight:700}
.dwg .fo .small{font-size:.85em;color:#444}
.dwg .fo ol,.dwg .fo ul{margin:.2em 0 .5em;padding-left:1.9em}
.dwg .fo table{border-collapse:collapse;width:100%}
.dwg .fo td,.dwg .fo th{border:.6px solid #999;padding:.15em .35em;text-align:left;vertical-align:top}
.dwg .fo th{background:#efede8}
.dwg .fo table.idx td{border:0;padding:.1em .6em .1em 0}
.dwg .fo table.parts td:nth-child(1),.dwg .fo table.parts td:nth-child(3),.dwg .fo table.parts td:nth-child(4),.dwg .fo table.parts td:nth-child(5){white-space:nowrap}
`;

/** A whole set as one printable HTML document, one sheet per page. */
export function setDocument(title: string, sheets: Sheet[], paper: Paper): string {
  const P = papers[paper];
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
@page{size:${P.w}in ${P.h}in;margin:0}
html,body{margin:0;padding:0;background:#888}
.page{width:${P.w}in;height:${P.h}in;margin:.3in auto;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.3);overflow:hidden;page-break-after:always;break-after:page}
@media print{html,body{background:#fff}.page{margin:0;box-shadow:none}}
${sheetCss}
</style></head><body>${sheets.map((s) => `<div class="page">${s.svg}</div>`).join('')}</body></html>`;
}
