// Drawing sets: the customer's (cover, floor plan, wall elevations) and the shop's (a wall
// assembly sheet per wall, then a sheet per cabinet), on 11×17 or letter, each with CJC's title
// block. Every sheet is one SVG at true size, so it prints to scale.
import { jobRooms } from '../model/rooms';
import { doorDrawings } from '../model/eagleDrawings';
import { cabinetMoldings, forCustomer, moldLabel, profileByNum, profileLabel, type MoldPiece } from '../model/moldings';
import { resolveEnds } from '../model/layout';
import type { Cabinet, Part, Project, WallId } from '../model/types';
import { wallOrder, wallNames, wallLength } from '../model/layout';
import { clientName, clientOf, COMPANY } from '../model/client';
import { eff } from '../model/parts';
import { doorProfileViews } from './doorProfile';
import { profileItems, profileViews } from './profileSheet';
import { assemblyView, wallIso } from './assembly';
import { styleById } from '../model/eagle';
import { baseLabel } from '../model/cabinetBase';
import { fmt } from '../units';
import { beamSection, cabinetsOn, ceilingPlan, faceFrameView, floorPlan, mantelViews, partRows, partsOf, sidePanelLayout, sideSection, wallElevation } from './views';
import { joineryLabel } from '../model/parts';
import { hardwareOrder } from '../model/hardware';
import { electricianHtml, lightingSpecHtml } from '../model/cabinetLighting';
import { hingeTypes } from '../model/eagle';
import { cofferOf, cofferParts } from '../model/coffer';
import { fuelLabel, mantelOf, upperTop } from '../model/mantel';
import { cofferScope, scopeLine } from '../model/quote';
import { beginEdits, drawingCss, endEdits, inView, markRevision, scaleName, takeViews, type DrawingEdits, type Frame, type ViewInfo } from './draw';
import { RESTRICTOR_NOTE, cabinetCallouts, forAudience, jobCallouts, type Audience } from './notes';
import { LOGO, LOGO_ASPECT } from './logo';
import { tableViews } from './tableViews';
import { tableParts } from '../model/tableParts';
import { furnitureOf, tableChecks, tableFinishLabel, tableScope, type DiningTable } from '../model/furniture';
import { detailOk, detailTitle, detailsOf, drawDetail, inSet, suggestedCut, type Detail } from './details';

/** The details for a set, numbered, two to a sheet: 1/A5, 2/A5, 3/A6… */
function placeDetails(p: Project, set: 'customer' | 'shop', prefix: string, first: number) {
  const list = detailsOf(p).filter((d) => inSet(d, set) && detailOk(p, d));
  return list.map((d, i) => ({ d, n: (i % 2) + 1, sheet: `${prefix}${first + Math.floor(i / 2)}` }));
}

/** Details sheets: two details side by side, each with its bubble, title, scale and note. */
function detailSheets(p: Project, s: DrawingSettings, placed: { d: Detail; n: number; sheet: string }[]): Sheet[] {
  const A = area(s.paper);
  const out: Sheet[] = [];
  for (let i = 0; i < placed.length; i += 2) {
    const pair = placed.slice(i, i + 2);
    const w = A.w / 2;
    const body = pair.map(({ d, n }, j) => {
      const f: Frame = { x: A.x + j * w, y: A.y, w: w - 0.1, h: A.h - 0.95 };
      const dr = inView(`detail:${d.id}`, `Detail: ${detailTitle(p, d)}`, () => drawDetail(p, d, f));
      if (!dr) return '';
      const by = A.y + A.h - 0.8;
      const bx = f.x + 0.4;
      return dr.svg
        + `<circle class="tag" cx="${bx}" cy="${by + 0.2}" r="0.2"/><text x="${bx}" y="${by + 0.26}" font-size="0.17" font-weight="700" text-anchor="middle">${n}</text>`
        + `<line class="thin" x1="${bx + 0.3}" y1="${by + 0.25}" x2="${f.x + f.w - 0.2}" y2="${by + 0.25}"/>`
        + `<text x="${bx + 0.32}" y="${by + 0.2}" font-size="0.14" font-weight="700">${esc(detailTitle(p, d).toUpperCase())}</text>`
        + `<text x="${bx + 0.32}" y="${by + 0.4}" font-size="0.085">Scale: ${esc(scaleName(dr.scale))}</text>`
        + (d.note?.trim() ? html({ x: bx + 0.3, y: by + 0.46, w: f.w - 0.8, h: 0.4 }, `<p>${esc(d.note.trim())}</p>`, 0.085) : '')
        + (j === 1 ? `<line class="thin" x1="${f.x - 0.05}" y1="${A.y}" x2="${f.x - 0.05}" y2="${A.y + A.h}"/>` : '');
    }).join('');
    out.push(sheet(p, s, pair[0].sheet, 'Details', 'As noted', body));
  }
  return out;
}

/** Wall-section markers for an elevation, pointing at where each detail is drawn. */
const cutsOn = (p: Project, placed: { d: Detail; n: number; sheet: string }[], wall: WallId) =>
  placed.filter(({ d }) => d.kind === 'wall' && d.wall === wall).map(({ d, n, sheet }) => ({ at: d.at ?? suggestedCut(p, wall), ref: `${n}/${sheet}` }));

export type Paper = 'tabloid' | 'letter';
export const papers: Record<Paper, { w: number; h: number; label: string }> = {
  tabloid: { w: 17, h: 11, label: '11 × 17' },
  letter: { w: 11, h: 8.5, label: '8-1/2 × 11' },
};

/** A note typed onto a sheet, at a spot in paper inches from its top left. */
export interface SheetText { id: string; x: number; y: number; text: string; size?: number }
export interface DrawingSettings {
  paper: Paper; rev: number; cover?: string; notes: string;
  /** Pictures for the 3D views sheet (saved 3D views and renderings), embedded so the set stands on its own. Filled in when the set goes out. */
  views?: string[];
  /** Changes to the drawings themselves: view scales and dimensions hidden, retyped or moved. */
  edits?: DrawingEdits;
  /** Notes typed onto sheets, by sheet number. */
  texts?: Record<string, SheetText[]>;
  /** Ceiling plan: show the recessed lights (default) and the beam centerline dimensions. */
  rcpLights?: boolean;
  rcpCenters?: boolean;
  /** Customer elevations: what's built on the side walls and ceiling, cut in section (shaded) or seen from the side. */
  sides?: Partial<Record<WallId, 'section' | 'side'>>;
  /** Each revision: date, what changed, and the cabinets to mark. */
  revisions?: import('../model/revisions').Revision[];
  /** The design as the set last went out (by cabinet tag), to tell what the next revision changed. */
  revBase?: Record<string, string>;
}
export const drawingsOf = (p: Project): DrawingSettings => ({ paper: 'tabloid', rev: 0, notes: '', ...p.drawings });

export interface Sheet { id: string; number: string; title: string; svg: string; /** The views on it, with their scales, for the viewer. */ views?: ViewInfo[] }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const M = 0.4;
const tbH = (paper: Paper) => (paper === 'tabloid' ? 0.85 : 0.72);
const today = () => new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

/** The drawing area on a sheet, inside the border and above the title block. */
export function area(paper: Paper): Frame {
  const P = papers[paper];
  return { x: M + 0.15, y: M + 0.15, w: P.w - 2 * M - 0.3, h: P.h - 2 * M - tbH(paper) - 0.3 };
}

/** While a job with several rooms is drawn: each room's sheet numbers carry its room number, and the one cover lists the whole job. */
let jobSet: { prefix: string; title?: string; index?: string[][] } | null = null;
const shownNumber = (n: string) => (jobSet && n !== 'A0' ? `${jobSet.prefix}${n}` : n);

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
    t(xs[1] + 0.12, y + 0.68, number === 'A0' && jobSet?.title ? jobSet.title : p.name, 0.085),
    t(xs[2] + 0.12, y + 0.2, 'SHEET', 0.065, 600),
    t(xs[2] + 0.12, y + 0.42, title, 0.12, 700),
    t(xs[2] + 0.12, y + 0.62, `Scale: ${scale}`, 0.085),
    t(xs[3] + 0.12, y + 0.2, 'DATE', 0.065, 600),
    t(xs[3] + 0.12, y + 0.36, today(), 0.09),
    t(xs[3] + 0.12, y + 0.54, 'REVISION', 0.065, 600),
    t(xs[3] + 0.12, y + 0.68, s.rev ? `Rev ${s.rev}` : 'Original', 0.09),
    `<text x="${(xs[4] + x1) / 2}" y="${y + h / 2 + 0.12}" font-size="${0.34 * fs}" font-weight="700" text-anchor="middle">${esc(shownNumber(number))}</text>`,
  ].join('');
}

function sheet(p: Project, s: DrawingSettings, number: string, title: string, scale: string, body: string): Sheet {
  const P = papers[s.paper];
  const svg = `<svg class="dwg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${P.w} ${P.h}" width="${P.w}in" height="${P.h}in">`
    + `<rect x="0" y="0" width="${P.w}" height="${P.h}" fill="#fff"/>`
    + `<rect class="heavy" x="${M}" y="${M}" width="${P.w - 2 * M}" height="${P.h - 2 * M}"/>`
    + body + sheetTexts(s, number) + titleBlock(p, s, number, title, scale) + '</svg>';
  return { id: number, number, title, svg, views: takeViews() };
}

/** Notes typed onto the sheet, with a target over each for moving or changing it in the viewer. */
function sheetTexts(s: DrawingSettings, number: string): string {
  return (s.texts?.[number] ?? []).map((t) => {
    const size = t.size ?? 0.11;
    const lines = t.text.split('\n');
    const w = Math.max(...lines.map((l) => l.length)) * size * 0.55, h = lines.length * size * 1.25;
    return `<text class="sheet-note" x="${t.x}" y="${t.y + size}" font-size="${size}">${lines.map((l, i) => `<tspan x="${t.x}" dy="${i ? size * 1.25 : 0}">${esc(l)}</tspan>`).join('')}</text>`
      + `<rect class="hit" x="${t.x - 0.04}" y="${t.y - 0.03}" width="${w + 0.08}" height="${h + 0.08}" data-note="${esc(t.id)}" data-sheet="${esc(number)}"/>`;
  }).join('');
}

/** HTML (tables, lists) placed on a sheet. */
// Laid out at 100 units to the inch: browsers round CSS sizes to whole pixels, and a pixel is a full inch at sheet scale.
const html = (f: Frame, inner: string, size = 0.1) =>
  `<g transform="translate(${f.x} ${f.y}) scale(0.01)"><foreignObject x="0" y="0" width="${f.w * 100}" height="${f.h * 100}"><div xmlns="http://www.w3.org/1999/xhtml" class="fo" style="font-size:${size * 100}px">${inner}</div></foreignObject></g>`;

/** The notes column on an elevation: the job's, then each cabinet's on that wall, by tag. */
function wallNotes(p: Project, wall: WallId, a: Audience): string {
  // A note shared by several cabinets is listed once, with all their names
  const by = new Map<string, string[]>();
  for (const c of cabinetsOn(p, wall)) for (const n of forAudience(cabinetCallouts(p, c), a)) by.set(n.text, [...(by.get(n.text) ?? []), c.name]);
  const items = [...by.entries()].map(([t, names]) => `<li><b>${esc(names.join(', '))}</b> ${esc(t)}</li>`);
  // A wall with nothing built on it (drawn for the side walls in section) gets no door or hardware notes
  if (!cabinetsOn(p, wall).length) return p.drawings?.sides?.[wall] === 'section' ? '<h2>Notes</h2><p>Built-ins on the side walls and the coffered ceiling are shown cut through and shaded, to show how far each comes out into the room.</p>' : '';
  const all = [...jobCallouts(p, a).map((t) => `<li>${esc(t)}</li>`), ...items];
  return all.length ? `<h2>Notes</h2><ul>${all.join('')}</ul>` : '';
}

const wallsWithWork = (p: Project) => wallOrder.filter((w) => cabinetsOn(p, w).length > 0);

/* ---------- Customer set ---------- */

/**
 * The client's drawings for the whole job: one room's set, or for a job with several rooms each
 * room's sheets in turn (numbered by room, titled with its name) after a single cover.
 */
export function jobCustomerSet(p: Project): Sheet[] {
  const rooms = jobRooms(p);
  if (rooms.length < 2) return customerSet(p, drawingsOf(p));
  const draw = (index?: string[][]) => rooms.flatMap((r, i) => {
    const one = { ...r.project, name: `${p.name} · ${r.name}` };
    jobSet = { prefix: `${i + 1}-`, title: p.name, index };
    try {
      return customerSet(one, drawingsOf(one))
        .filter((x) => i === 0 || x.number !== 'A0')
        .map((x) => ({ ...x, number: x.number === 'A0' ? 'A0' : `${i + 1}-${x.number}`, title: x.number === 'A0' ? x.title : `${r.name}: ${x.title}` }));
    } finally { jobSet = null; }
  });
  // Drawn once to learn every room's sheets, then again so the cover lists them all
  return draw(draw().map((x) => [x.number, x.title]));
}

/** The revision list: each revision's number in its triangle, date and what changed (newest first). */
function revTableHtml(s: DrawingSettings): string {
  const revs = [...(s.revisions ?? [])].sort((a, b) => b.rev - a.rev).slice(0, 6);
  if (!revs.length) return '';
  return `<h2>Revisions</h2><table class="revs">${revs.map((r) => `<tr><td class="rv">${r.rev}</td><td>${esc(r.date)}</td><td>${esc(r.note).replace(/\n/g, '<br>')}</td></tr>`).join('')}</table>`
    + `<p class="small">Changed cabinets carry the revision number in a triangle beside their tags.</p>`;
}

/** Mark the cabinets the current revision changed. */
function beginMarks(s: DrawingSettings) {
  const last = s.revisions?.find((r) => r.rev === s.rev);
  markRevision(s.rev, last?.tags ?? []);
}

export function customerSet(p: Project, s: DrawingSettings): Sheet[] {
  beginEdits(s.edits);
  beginMarks(s);
  // The customer's set names no suppliers (the shop set keeps them)
  try { return customerSheets(p, s).map((x) => ({ ...x, title: forCustomer(x.title), svg: forCustomer(x.svg) })); } finally { endEdits(); }
}
function customerSheets(p: Project, s: DrawingSettings): Sheet[] {
  const A = area(s.paper);
  // A wall with nothing on it still gets an elevation when it's asked to show the side walls in section
  const walls = wallOrder.filter((w) => cabinetsOn(p, w).length > 0 || !!s.sides?.[w]);
  const sheets: Sheet[] = [];
  const ceiling = cofferOf(p).on;
  const first = ceiling ? 3 : 2;
  const placed = placeDetails(p, 'customer', 'A', first + walls.length);
  const detailIdx = [...new Set(placed.map((x) => x.sheet))].map((n) => [n, 'Details']);
  // The door style sheet goes last, after any details
  const doorStyle = styleById(eff({ overrides: undefined } as never, p.settings).doorStyleId).profile !== 'slab' && p.cabinets.some((c) => c.rows.some((r) => r.type === 'doors' || r.type === 'drawer'));
  // After the details: the 3D views (a wall or two to a sheet, then any saved pictures), the schedule
  // and selections, the door style, the moulding and beadboard profiles, each table, then the lighting spec
  let nextNo = first + walls.length + detailIdx.length;
  const isoWalls = walls.filter((w) => cabinetsOn(p, w).length > 0);
  const isoNos = Array.from({ length: Math.ceil(isoWalls.length / 2) }, () => `A${nextNo++}`);
  const pics = (s.views ?? []).filter((u) => u.startsWith('data:')).slice(0, 4);
  const picNo = pics.length ? `A${nextNo++}` : '';
  const schedNo = `A${nextNo++}`;
  const doorNo = `A${doorStyle ? nextNo++ : nextNo}`;
  const profiles = profileItems(p);
  const profNo = `A${profiles.length ? nextNo++ : nextNo}`;
  const tableNos = furnitureOf(p).map(() => `A${nextNo++}`);
  const spec = lightingSpecHtml(p);
  const specNo = `A${nextNo}`;
  const index = [['A0', 'Cover'], ['A1', 'Floor plan'], ...(ceiling ? [['A2', 'Ceiling plan']] : []), ...walls.map((w, i) => [`A${i + first}`, `${wallNames[w]} elevation`]), ...detailIdx, ...isoNos.map((n) => [n, '3D views']), ...(picNo ? [[picNo, '3D renderings']] : []), [schedNo, 'Schedule & selections'], ...(doorStyle ? [[doorNo, 'Door style']] : []), ...(profiles.length ? [[profNo, 'Moulding & beadboard profiles']] : []), ...furnitureOf(p).map((t, i) => [tableNos[i], t.name]), ...(spec ? [[specNo, 'Cabinet lighting']] : [])];
  // Cover: the picture, the job, and what's in the set
  const c = clientOf(p);
  const imgW = A.w * 0.64;
  const cover = [
    s.cover ? `<image href="${esc(s.cover)}" x="${A.x}" y="${A.y}" width="${imgW}" height="${A.h}" preserveAspectRatio="xMidYMid meet"/>` : `<rect class="ghost" x="${A.x}" y="${A.y}" width="${imgW}" height="${A.h}"/><text x="${A.x + imgW / 2}" y="${A.y + A.h / 2}" font-size="0.14" text-anchor="middle" fill="#888">Add a 3D view or rendering for the cover</text>`,
    html({ x: A.x + imgW + 0.3, y: A.y, w: A.w - imgW - 0.3, h: A.h }, `
      <img src="${LOGO}" alt="CJC Custom Carpentry" style="width:62%;margin:0 0 1.2em"/>
      <h1>${esc(jobSet?.title ?? p.name)}</h1>
      <p class="big">${esc(clientName(c))}</p>
      <p>${esc(c.address || c.location || '')}</p>
      <h2>Drawings</h2>
      <table class="idx">${(jobSet?.index ?? index).map(([n, t]) => `<tr><td>${n}</td><td>${esc(t)}</td></tr>`).join('')}</table>
      ${s.notes ? `<h2>Notes</h2><p>${esc(s.notes).replace(/\n/g, '<br>')}</p>` : ''}
      <p class="small">Drawings show design intent. Final dimensions are field verified before fabrication.</p>
      ${revTableHtml(s)}
      <div class="approve"><h2>Approval</h2><p>I have reviewed these drawings and the selections on ${esc(schedNo)}, and approve them ☐ as drawn ☐ with the changes marked.</p>
      <p>Signature ______________________________</p><p>Date ______________</p></div>`, s.paper === 'tabloid' ? 0.13 : 0.11),
  ].join('');
  sheets.push(sheet(p, s, 'A0', 'Cover', 'None', cover));
  // The plan keys each drawn wall to its elevation sheet
  const marks = Object.fromEntries(walls.map((w, i) => [w, `A${i + first}`])) as Partial<Record<WallId, string>>;
  const plan = inView('plan', 'Floor plan', () => floorPlan(p, A, marks));
  sheets.push(sheet(p, s, 'A1', 'Floor plan', scaleName(plan.scale), plan.svg));
  if (ceiling) {
    const rcp = inView('rcp', 'Ceiling plan', () => ceilingPlan(p, { ...A, w: A.w * 0.74 }, { lights: s.rcpLights ?? true, centers: !!s.rcpCenters }));
    const notes = html({ x: A.x + A.w * 0.76, y: A.y, w: A.w * 0.24, h: A.h }, `<h2>Notes</h2><p>${esc(cofferScope(p) ?? '')}</p><p class="small">Coffer sizes are clear openings, fascia face to fascia face.</p>`, s.paper === 'tabloid' ? 0.11 : 0.09);
    sheets.push(sheet(p, s, 'A2', 'Ceiling plan', scaleName(rcp.scale), rcp.svg + notes));
  }
  walls.forEach((w, i) => {
    const e = inView(`elev:${w}`, `${wallNames[w]} elevation`, () => wallElevation(p, w, { ...A, w: A.w * 0.74 }, 'customer', cutsOn(p, placed, w), s.sides?.[w]));
    const notes = html({ x: A.x + A.w * 0.76, y: A.y, w: A.w * 0.24, h: A.h }, wallNotes(p, w, 'customer'), s.paper === 'tabloid' ? 0.11 : 0.09);
    sheets.push(sheet(p, s, `A${i + first}`, `${wallNames[w]} elevation`, scaleName(e.scale), e.svg + notes));
  });
  sheets.push(...detailSheets(p, s, placed));
  // 3D views: each wall's cabinetry in isometric, two walls to a sheet
  const fsN = s.paper === 'tabloid' ? 0.11 : 0.09;
  isoNos.forEach((no, i) => {
    const ws = isoWalls.slice(i * 2, i * 2 + 2);
    const half = A.w / ws.length;
    const body = ws.map((w, j) => {
      const f = { x: A.x + j * half + 0.1, y: A.y + 0.35, w: half - 0.2, h: A.h - 0.9 };
      const eNo = `A${walls.indexOf(w) + first}`;
      return wallIso(p, w, f, wallLength(p.room, w), p.room.height) + `<text x="${f.x + f.w / 2}" y="${A.y + A.h - 0.3}" font-size="0.12" font-weight="700" text-anchor="middle">${esc(wallNames[w].toUpperCase())}</text>`
        + `<text x="${f.x + f.w / 2}" y="${A.y + A.h - 0.14}" font-size="0.085" text-anchor="middle">dimensioned on ${eNo}</text>`;
    }).join('');
    sheets.push(sheet(p, s, no, '3D views', 'No scale', html({ x: A.x, y: A.y, w: A.w, h: 0.35 }, '<p class="small">Seen from the room, a little to the right and above, in the paint color. Sizes are on the elevations.</p>', fsN) + body));
  });
  // Saved 3D views and renderings, as pictures
  if (picNo) {
    const cols = pics.length > 1 ? 2 : 1, rows = Math.ceil(pics.length / cols);
    const cw = A.w / cols, ch = A.h / rows;
    const body = pics.map((u, i) => `<image href="${esc(u)}" x="${A.x + (i % cols) * cw + 0.08}" y="${A.y + Math.floor(i / cols) * ch + 0.08}" width="${cw - 0.16}" height="${ch - 0.16}" preserveAspectRatio="xMidYMid meet"/>`).join('');
    sheets.push(sheet(p, s, picNo, '3D renderings', 'No scale', body));
  }
  sheets.push(sheet(p, s, schedNo, 'Schedule & selections', 'No scale', scheduleSheet(p, A, fsN)));
  if (doorStyle) {
    // The door maker's drawings of the bead and panel (not the outside edge: a picture of an eased edge shows nothing)
    const dd = doorDrawings(p.settings).filter((d) => d.what !== 'Outside edge');
    // With their framing bead drawing on the sheet, our own drawn section of it goes; the door moves to the left
    const ownSection = !dd.some((d) => d.what === 'Framing bead');
    const doorF = ownSection ? { x: A.x + A.w * 0.5, y: A.y, w: A.w * 0.24, h: A.h * 0.62 } : { x: A.x, y: A.y, w: A.w * 0.74, h: A.h * 0.62 };
    const dv = inView('door-profile', 'Door style', () => doorProfileViews(p, ownSection ? { x: A.x, y: A.y, w: A.w * 0.5, h: A.h * 0.62 } : null, doorF));
    if (dv) {
      const label = (x: number, w: number, t: string) => `<text x="${x + w / 2}" y="${A.y + A.h * 0.62 + 0.15}" font-size="0.11" font-weight="700" text-anchor="middle">${esc(t)}</text>`;
      const notes = html({ x: A.x + A.w * 0.76, y: A.y, w: A.w * 0.24, h: A.h }, `<h2>Door style</h2><ul>${dv.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`, s.paper === 'tabloid' ? 0.11 : 0.09);
      // The door maker's drawings in a row underneath
      const rowY = A.y + A.h * 0.7, rowH = A.h * 0.24, colW = (A.w * 0.74) / Math.max(1, dd.length);
      const pics = dd.map((d, i) => {
        const x = A.x + i * colW + 0.1;
        return `<image href="${d.src}" x="${x}" y="${rowY}" width="${colW - 0.2}" height="${rowH - 0.3}" preserveAspectRatio="xMidYMid meet"/>`
          + `<text x="${x + (colW - 0.2) / 2}" y="${rowY + rowH - 0.12}" font-size="0.1" font-weight="700" text-anchor="middle">${esc(d.what.toUpperCase())}${d.label ? `: ${esc(d.label)}` : ''}</text>`;
      }).join('');
      sheets.push(sheet(p, s, doorNo, 'Door style', 'As noted', dv.svg + (ownSection ? label(A.x, A.w * 0.5, 'FRAMING BEAD, SECTION (FULL SIZE)') : '') + label(doorF.x, doorF.w, 'DOOR (1-1/2" = 1\'-0")') + pics + notes));
    }
  }
  if (profiles.length) sheets.push(sheet(p, s, profNo, 'Moulding & beadboard profiles', 'As noted', profileViews(profiles, A)));
  furnitureOf(p).forEach((t, i) => {
    const no = tableNos[i];
    const fs = s.paper === 'tabloid' ? 0.11 : 0.09;
    const v = tableSheetViews(t, A, 0.74);
    const notes = html({ x: A.x + A.w * 0.76, y: A.y, w: A.w * 0.24, h: A.h }, `<h2>${esc(t.name)}</h2><p>${esc(tableScope(t).replace(/^[^:]*:\s*/, '').replace(/^./, (c) => c.toUpperCase()))}</p>${t.notes ? `<p>${esc(t.notes)}</p>` : ''}<p class="small">Drawings show design intent; final sizes are confirmed before the lumber is milled.</p>`, fs);
    sheets.push(sheet(p, s, no, t.name, `${scaleName(v.scale)}; section ${scaleName(v.secScale)}`, v.svg + notes));
  });
  // Lighting chosen on any cabinet brings its spec sheet along
  if (spec) sheets.push(sheet(p, s, specNo, 'Cabinet lighting', 'No scale', html({ x: A.x, y: A.y, w: A.w, h: A.h }, spec, s.paper === 'tabloid' ? 0.11 : 0.09)));
  return sheets;
}

/**
 * The customer's schedule and selections, as kitchen design sets have them: what was chosen (paint
 * color with a swatch, door style, hardware, mouldings, lighting), then every cabinet on the
 * drawings by its tag, in plain words, with its size.
 */
function scheduleSheet(p: Project, A: Frame, fs: number): string {
  const swatch = (hex?: string) => (hex ? `<span style="display:inline-block;width:1.6em;height:1em;background:${esc(hex)};border:1px solid #888;vertical-align:middle;margin-right:.4em"></span>` : '');
  const sel = jobCallouts(p, 'customer').map((t) => `<li>${t.startsWith('Paint:') ? swatch(p.finishes.paint) : ''}${esc(t)}</li>`).join('');
  const profs = profileItems(p).map((x) => `<li>${esc(x.title)}</li>`).join('');
  const lights = lightingSpecHtml(p) ? '<li>Cabinet lighting: see its sheet</li>' : '';
  const rows = wallOrder.flatMap((w) => cabinetsOn(p, w).map((c) => `<tr><td><b>${esc(c.name)}</b></td><td>${esc(wallNames[w])}</td><td>${esc(scopeLine(c, p).replace(/^[^:]*:\s*/, '').replace(/^./, (x) => x.toUpperCase()))}</td><td>${fmt(c.width)} W × ${fmt(c.height)} H × ${fmt(c.depth)} D</td></tr>`)).join('');
  const left = `<h2>Selections</h2><ul>${sel}${lights}</ul>${profs ? `<h3>Mouldings</h3><ul>${profs}</ul>` : ''}
    <p class="small">Colors on screen and in print are close but not exact; the finish is matched to a sample before painting.</p>`;
  const right = `<h2>Schedule</h2><p class="small">Every piece on the drawings, by the tag on the plan and elevations.</p><table class="parts sched"><thead><tr><th>Tag</th><th>Wall</th><th>What it is</th><th>Size</th></tr></thead><tbody>${rows}</tbody></table>`;
  return html({ x: A.x, y: A.y, w: A.w * 0.3, h: A.h }, left, fs) + html({ x: A.x + A.w * 0.32, y: A.y, w: A.w * 0.68, h: A.h }, right, fs * 0.9);
}

/** The four table views laid out across the left part of a sheet (frac of its width). */
function tableSheetViews(t: DiningTable, A: Frame, frac: number) {
  const w = A.w * frac, top = A.h * 0.5;
  return tableViews(t, {
    plan: { x: A.x, y: A.y, w: w * 0.45, h: top },
    side: { x: A.x + w * 0.45, y: A.y, w: w * 0.55, h: top },
    end: { x: A.x, y: A.y + top, w: w * 0.5, h: A.h - top },
    section: { x: A.x + w * 0.5, y: A.y + top, w: w * 0.5, h: A.h - top },
  });
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

function cabinetHeader(p: Project, c: Cabinet, same: Cabinet[] = [c]): string {
  const s = eff(c, p.settings);
  const style = styleById(s.doorStyleId);
  const where = (x: Cabinet) => `${wallNames[x.wall]}, ${fmt(x.offset)} from the left${x.elevation > 0.5 ? `, ${fmt(x.elevation)} AFF` : ''}`;
  const bits = [
    c.kind === 'mantel' && mantelOf(c).upper.on ? `${kinds[c.kind]}, ${fmt(c.width)} W × ${fmt(upperTop(c))} H overall (shelf top at ${fmt(c.height)}) × ${fmt(c.depth)} D` : `${kinds[c.kind]}, ${fmt(c.width)} W × ${fmt(c.height)} H × ${fmt(c.depth)} D`,
    c.kind === 'mantel' ? `${mantelOf(c).species}, paint grade; ${fuelLabel[mantelOf(c).fuel].toLowerCase()}` : `${style.name} ${s.doorMount === 'inset' ? 'inset' : 'overlay'}; face frame ${fmt(s.ffThickness)} ${p.settings.woodSpecies}`,
    baseLabel(c) ?? (c.kind === 'base' || c.kind === 'tall' ? `${fmt(s.toeKickHeight)} toe kick` : ''),
  ].filter(Boolean);
  // Restrictors are per cabinet (hardware, not the build): each one named on a shared drawing
  const notes = [
    ...forAudience(cabinetCallouts(p, c), 'shop').filter((n) => !n.text.startsWith(RESTRICTOR_NOTE) && n.text.toLowerCase() !== (baseLabel(c) ?? '').toLowerCase()),
    ...same.flatMap((x) => forAudience(cabinetCallouts(p, x), 'shop').filter((n) => n.text.startsWith(RESTRICTOR_NOTE)).map((n) => ({ ...n, text: same.length > 1 ? `${x.name}: ${n.text}` : n.text }))),
  ];
  const make = same.length > 1 ? `<p class="big">Make ${same.length}</p><ul>${same.map((x) => `<li><b>${esc(x.name)}</b>: ${esc(where(x))}</li>`).join('')}</ul>` : `<p>${esc(where(c))}</p>`;
  return `<h2>${esc(same.map((x) => x.name).join(', '))}</h2>${make}<p>${bits.map(esc).join('<br>')}</p>${notes.length ? `<h3>Notes</h3><ul>${notes.map((n) => `<li>${esc(n.text)}</li>`).join('')}</ul>` : ''}`;
}

/**
 * Cabinets built exactly alike share a drawing: same parts at the same sizes, the same notes and
 * the same hardware. Kept in wall order, each group at its first cabinet.
 */
export function shopGroups(p: Project): Cabinet[][] {
  const groups = new Map<string, Cabinet[]>();
  for (const w of wallOrder) for (const c of cabinetsOn(p, w)) {
    const parts = partRows(partsOf(p, c)).map(({ part, qty }) => [qty, part.name, part.role, part.length, part.width, part.thickness, part.material, part.species ?? '', part.sheet ?? '', part.note ?? '', part.order ? JSON.stringify(part.order) : ''].join('|'));
    const notes = forAudience(cabinetCallouts(p, c), 'shop').map((n) => n.text).filter((t) => !t.startsWith(RESTRICTOR_NOTE));
    // Sizes to the 1/64": two pilasters a thousandth apart are the same pilaster
    const r = (x: number) => Math.round(x * 64) / 64;
    const key = [c.kind, r(c.width), r(c.height), r(c.depth), baseLabel(c) ?? '', ...parts.map((x) => x.replace(/\d+\.\d+/g, (n) => String(r(+n)))).sort(), ...notes].join('\n');
    const g = groups.get(key);
    if (g) g.push(c); else groups.set(key, [c]);
  }
  return [...groups.values()];
}

/** The order of work for a case, from how it's built. */
/** A pilaster's order of work, in the shop and at install. */
function pilasterSteps(p: Project, c: Cabinet): string[] {
  const parts = partsOf(p, c);
  const returns = parts.some((x) => x.name.endsWith('return') && x.role === 'side');
  const box = parts.some((x) => x.name === 'Pilaster side');
  const shallow = returns && !box;
  const ps = c.pilaster ?? {};
  const steps = [
    'Mill the stiles and rails to size. Cut the rabbet on the back inside edge of each stile and rail for the panel (sizes in the parts list).',
    'Assemble the face frame with glue and pocket screws from the back; check it square and flat, then sand the joints flush on the front.',
    'Set the 1/4" MDF panels into the rabbets from the back; a bead of glue in the rabbet and a few pin nails hold them (MDF won’t move).',
    ...(box ? ['Build the box: glue and staple the nailers between the sides, at the back, top and bottom. Check the diagonals.', 'Glue and nail the face frame to the front edges of the sides, flush (or proud the same amount) on both sides.']
      : shallow ? ['Glue the solid returns to the back of the face frame at its outside edges, flush with the outside, clamped every 8"–10".', 'Fasten to the wall or chimney face through the returns or blocking behind them; fill and sand.']
      : ['No box: the finished face (stiles, rails and panel) goes on between the cabinets at install, standing proud of their faces as drawn.', ...(returns ? ['Glue the solid returns to the back of the stiles at their outside edges, flush with the outside.'] : [])]),
    ...(parts.some((x) => x.name === 'Capital block') ? ['Glue and nail the capital block on top, flush at the back, standing proud of the face frame as drawn.'] : []),
    ...(parts.some((x) => x.name.startsWith('Plinth block')) ? ['Glue and nail the plinth block at the bottom; the base moulding wraps it at install.'] : []),
    box ? 'At install: set it plumb between its neighbours, screw through the case sides into the cabinets beside it (screws hidden inside the cabinets), and through the nailers into the wall studs.'
      : 'At install: set the face plumb, its top level with the frames beside it, and fasten it to the cabinets on each side from inside them (blocking or cleats behind the stiles as needed). Scribe a stile to the wall where it meets one.',
    ...((ps as { wrap?: unknown }).wrap ? ['After install: run the baseboard and base cap around the plinth, mitered at the front corners, back to the casework beside it (lengths in the parts list).'] : []),
    ...(c.crown ? ['Crown goes on last, with the run across the cabinets (mouldings list).'] : []),
    'Fill nail holes, caulk the inside corners, sand, prime and paint with the millwork.',
  ];
  return steps;
}

/** A mantel's order of work. */
function mantelSteps(p: Project, c: Cabinet): string[] {
  const m = mantelOf(c);
  const parts = partsOf(p, c);
  return [
    ...(parts.some((x) => x.name === 'Chimney framing') ? ['On site: frame the chimney box (see Built on site), level and plumb, the insert opening framed to the insert’s manual. Electrician runs the outlet inside the box per the manual.', 'Skin the framing with the 3/4" MDF facing and sides; set the screws, fill and sand.'] : []),
    'In the shop: build the leg pilasters (and the upper pilasters) like the bookcase pilasters: face frames with rabbeted stiles and rails, MDF panels from the back, solid returns.',
    'Build the frieze the same way: stiles and rails, its panel from the back.',
    'Build the shelf (see the parts list for its build-up) and ease or profile the front edge and ends.',
    'Fasten the legs to the facing, plumb and the same distance off the insert opening each side; then the frieze between them, its bottom level.',
    ...(m.neckMold ? ['Neck moulding around each leg where its panels break (mouldings list): miter the front corners, return it to the chimney.'] : []),
    'Set the shelf on the frieze and legs, level, screwed up from below through cleats; bed moulding under it, around the legs and across the frieze.',
    ...(m.upper.on ? ['Upper pilasters on the stepped-back face above the shelf; cap moulding around their tops.'] : []),
    'Baseboard and base cap around the plinths and to the wall each side (lengths in the parts list).',
    'Check the insert’s clearances to combustibles in its manual before the final fastening; fill, caulk, sand, prime and paint.',
  ];
}

function assemblySteps(p: Project, c: Cabinet, parts: Part[], sideNotes: string[]): string[] {
  const s = eff(c, p.settings);
  const has = (r: Part['role']) => parts.some((x) => x.role === r);
  const steps: string[] = [];
  const ff = parts.some((x) => x.material === 'faceframe' && x.role === 'rail');
  steps.push('Cut the parts to the list; check the sheet goods for grain direction on exposed parts.');
  if (sideNotes.length) steps.push(`Machine the sides (see the side layout): ${sideNotes.filter((n) => !/mirror/.test(n)).map((n) => n.charAt(0).toLowerCase() + n.slice(1)).join('; ')}.`);
  const notch = parts.find((x) => x.role === 'side' && /notch|Cut .* to match/i.test(x.note ?? ''));
  if (notch) steps.push(`Cut the ${/notch/i.test(notch.note ?? '') ? 'toe notch' : 'shaped foot'} in each side.`);
  const banded = [...new Set(parts.filter((x) => x.banded && x.cut).map((x) => x.name.toLowerCase()))];
  if (banded.length) steps.push(`Edgeband the front edge of each ${banded.join(', ')}.`);
  const fasten = parts.find((x) => x.role === 'side')?.note?.split(' · ').find((t) => /glue|screw|staple|confirmat/i.test(t));
  steps.push(`Assemble the case on a flat bench: sides to ${[has('bottom') ? 'bottom' : '', has('top') ? 'top' : '', has('stretcher') ? 'stretchers' : '', parts.some((x) => x.role === 'shelf' && /dado/i.test(x.note ?? '')) ? 'fixed shelves' : ''].filter(Boolean).join(', ')}${fasten ? ` (${fasten.toLowerCase()})` : ''}.`);
  if (has('divider')) steps.push('Fit the vertical dividers in their dados before the back goes on.');
  if (has('back')) steps.push('Glue and staple the back into its rabbet; measure the diagonals to square the case before it sets.');
  const nailers = [...new Set(parts.filter((x) => x.role === 'nailer').map((x) => x.name.toLowerCase()))];
  if (nailers.length) steps.push(`Glue and screw the ${nailers.join(' and ')}.`);
  if (ff) {
    const j = s.ffJoinery ?? 'pocket';
    steps.push(`Build the face frame (${joineryLabel[j].toLowerCase()}); check it square and flat, sand the joints flush.`);
    steps.push(`Glue and nail the face frame to the case, ${s.ffOverhang > 0 ? `${fmt(s.ffOverhang)} proud of the sides where they're hidden` : 'flush to the sides'}.`);
  }
  if (has('endPanel')) steps.push('Apply the end panels (or leave for install where they scribe to the wall).');
  if (has('door') || has('drawerFront') || has('drawerBox')) {
    const hinge = hingeTypes[s.hingeType]?.name ?? s.hingeType;
    steps.push(`Hardware: ${[has('door') ? `${hinge} hinges` : '', has('drawerBox') ? `${s.drawerSlide} slides` : ''].filter(Boolean).join(', ')}. Hang doors and fronts and set the reveals at ${fmt(s.doorGap)}.`);
  }
  steps.push('Label the case with its name and wall before finishing.');
  return steps;
}

function hardwareList(p: Project, c: Cabinet): string {
  const h = hardwareOrder({ ...p, cabinets: [c] });
  if (!h.lines.length && !h.problems.length) return '';
  // Blum's inset-on-face-frame pairing reads like an overlay hinge in the catalog: say why it's right
  const why = (part: string) => (part === '71B3650' ? ' (Blum’s hinge for inset doors on a face frame, used with the 175H5030.21 plate; not for a half-overlay door here). Bore 35 mm cups to the boring distance on Blum’s sheet for this hinge and plate; hinges about 3" from the top and bottom of each door, a third one centered on doors over 40" tall' : part === '175H5030.21' ? ' (screws to the back of the face frame stile)' : '');
  return `<h3>Hardware, each</h3><ul>${h.lines.map((l) => `<li>${l.qty} × ${esc(l.part.part)}: ${esc(l.part.description)}${esc(why(l.part.part))}</li>`).join('')}${h.problems.map((x) => `<li>${esc(x.text)}</li>`).join('')}</ul>`;
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
    case 'upholstery': return 'Upholsterer';
    default: return part.material;
  }
}

/**
 * A long table split across pages: each row's printed height estimated from its text (the notes
 * column wraps), rows filled into the first page's room, then whole pages after.
 */
interface TRow { html: string; text: string[]; }
function rowInches(r: TRow, w: number, fs: number): number {
  // Share of the table's width each column tends to get: notes take the most; a char is about half the font size wide
  const per = (share: number) => Math.max(4, (share * w) / (fs * 0.5));
  const shares = r.text.length >= 8 ? [0.03, 0.05, 0.15, 0.07, 0.07, 0.06, 0.12, 0.45] : r.text.length >= 6 ? [0.05, 0.15, 0.07, 0.07, 0.06, 0.12, 0.48] : [0.06, 0.2, 0.25, 0.49];
  const lines = Math.max(1, ...r.text.map((t, i) => Math.ceil(t.length / per(shares[Math.min(i, shares.length - 1)]))));
  return lines * fs * 1.3 + fs * 0.35;
}
function pageTable(head: string, rows: TRow[], w: number, fs: number, first: number, rest: number): string[] {
  const pages: TRow[][] = [[]];
  let room = first - fs * 2.2;
  for (const r of rows) {
    const h = rowInches(r, w, fs);
    if (h > room && pages[pages.length - 1].length) { pages.push([]); room = rest - fs * 2.2; }
    pages[pages.length - 1].push(r);
    room -= h;
  }
  return pages.map((rs) => `<table class="parts"><thead>${head}</thead><tbody>${rs.map((r) => r.html).join('')}</tbody></table>`);
}

/** The parts and ordered items, as pages: the first fits `first` inches of height, the rest `rest`. */
function partsTablePages(p: Project, c: Cabinet, make: number, w: number, fs: number, first: number, rest: number, opts: { noMolds?: boolean; extra?: string; extraRows?: number } = {}): string[] {
  const rows = partRows(partsOf(p, c));
  const cut = rows.filter((r) => r.part.cut);
  const bought = rows.filter((r) => !r.part.cut && r.part.role !== 'counter' && r.part.order);
  const site = rows.filter((r) => !r.part.cut && r.part.role !== 'counter' && !r.part.order);
  const q = (n: number) => (make > 1 ? `${n} <span class="small">(${n * make})</span>` : `${n}`);
  const size = (part: Part) => { const o = part.order; return o ? `${fmt(o.w)} W × ${fmt(o.h)} H${o.d ? ` × ${fmt(o.d)} D` : ''}` : `${fmt(part.length)} × ${fmt(part.width)}`; };
  const cutRows: TRow[] = cut.map((r, i) => ({ html: `<tr><td><b>${i + 1}</b></td><td>${q(r.qty)}</td><td>${esc(r.part.name)}</td><td>${fmt(r.part.length)}</td><td>${fmt(r.part.width)}</td><td>${fmt(r.part.thickness)}</td><td>${esc(materialName(p, r.part))}</td><td>${esc(r.part.note ?? '')}</td></tr>`, text: ['', '', r.part.name, '', '', '', materialName(p, r.part), r.part.note ?? ''] }));
  const lead = `<p class="small"># is the part number: on the cut diagrams and labels it reads ${esc(c.name)}-1, ${esc(c.name)}-2…${make > 1 ? ' (each cabinet’s own name)' : ''}.${make > 1 ? ` Quantities are for one; (all ${make}) in brackets.` : ''}</p>`;
  const pages = pageTable('<tr><th>#</th><th>Qty</th><th>Part</th><th>Length</th><th>Width</th><th>Thick</th><th>Material</th><th>Notes</th></tr>', cutRows, w, fs, first - (lead ? fs * 1.5 : 0), rest);
  pages[0] = lead + pages[0];
  if (bought.length) {
    const ordered = `<h3>Ordered (Eagle)</h3><table class="parts"><thead><tr><th>Qty</th><th>Item</th><th>Size</th><th>Spec</th></tr></thead><tbody>${bought.map((r) => `<tr><td>${q(r.qty)}</td><td>${esc(r.part.name)}</td><td>${size(r.part)}</td><td>${esc(r.part.order?.spec ?? r.part.note ?? '')}</td></tr>`).join('')}</tbody></table>`;
    // On the last page if it fits, else a page of its own
    const used = (pages.length === 1 ? first : rest) - pageRoomLeft(pages[pages.length - 1], cutRows, w, fs, pages.length === 1 ? first : rest);
    const need = (bought.length + 3) * fs * 1.6;
    if (used + need <= (pages.length === 1 ? first : rest)) pages[pages.length - 1] += ordered; else pages.push(ordered);
  }
  if (site.length) {
    const html = `<h3>Built on site</h3><table class="parts"><thead><tr><th>Qty</th><th>Item</th><th>Size</th><th>How</th></tr></thead><tbody>${site.map((r) => `<tr><td>${q(r.qty)}</td><td>${esc(r.part.name)}</td><td>${fmt(r.part.length)} × ${fmt(r.part.width)}</td><td>${esc(r.part.note ?? '')}</td></tr>`).join('')}</tbody></table>`;
    pages[pages.length - 1] += html;
  }
  if (opts.extra) {
    const cap = pages.length === 1 ? first : rest;
    const used = cap - pageRoomLeft(pages[pages.length - 1], cutRows, w, fs, cap);
    if (used + (opts.extraRows ?? 10) * fs * 1.5 <= cap) pages[pages.length - 1] += opts.extra; else pages.push(opts.extra);
  }
  const molds = opts.noMolds ? { html: '', rows: 0 } : moldingsTable(p, c, make);
  if (molds.rows) {
    const cap = pages.length === 1 ? first : rest;
    const used = cap - pageRoomLeft(pages[pages.length - 1], cutRows, w, fs, cap) + (bought.length && pages[pages.length - 1].includes('Ordered (') ? (bought.length + 3) * fs * 1.6 : 0);
    if (used + (molds.rows + 3) * fs * 1.6 <= cap) pages[pages.length - 1] += molds.html; else pages.push(molds.html);
  }
  return pages;
}
/**
 * The mouldings on one cabinet, piece by piece: what it is, the profile, the length and how each end
 * is cut. Lengths are to the long point of a miter on an outside corner, the short point on an inside one.
 */
function moldingsTable(p: Project, c: Cabinet, make = 1): { html: string; rows: number } {
  let pieces: MoldPiece[] = [];
  try { pieces = cabinetMoldings(c, eff(c, p.settings), resolveEnds(p.room, p.cabinets, c)); } catch { pieces = []; }
  // Moulding already on the parts list (a pilaster's wrapped base cap, milled in the shop) isn't listed twice
  const listed = new Set(partsOf(p, c).map((x) => x.name));
  if (listed.has('Base cap on plinth') || listed.has('Base cap')) pieces = pieces.filter((x) => x.kind !== 'baseMold');
  if (!pieces.length) return { html: '', rows: 0 };
  const cutWord = (k?: string) => (k === 'out' ? 'outside miter' : k === 'in' ? 'inside miter' : 'square');
  const ends = (x: MoldPiece) => {
    const [a, b] = x.cut ?? ['square', 'square'];
    if (x.along === 'z') return `back ${cutWord(a)}, front ${cutWord(b)}`;
    return a === b ? `${cutWord(a)} both ends` : `left ${cutWord(a)}, right ${cutWord(b)}`;
  };
  const where = (x: MoldPiece) => x.where ?? (x.vertical ? 'up the side' : x.facing === 'front' ? 'across the front' : x.facing === 'left' ? 'left end return' : x.facing === 'right' ? 'right end return' : 'back');
  const rows = new Map<string, { x: MoldPiece; n: number }>();
  for (const x of pieces) {
    const key = [x.label ?? x.kind, x.num, Math.round(x.length * 16), where(x), ends(x)].join('|');
    const r = rows.get(key); if (r) r.n++; else rows.set(key, { x, n: 1 });
  }
  const q = (n: number) => (make > 1 ? `${n} <span class="small">(${n * make})</span>` : `${n}`);
  const body = [...rows.values()].map(({ x, n }) => {
    const pr = profileByNum(x.num);
    return `<tr><td>${q(n)}</td><td>${esc(x.label ?? moldLabel[x.kind] ?? x.kind)}</td><td>${esc(pr ? profileLabel(pr) : x.num)}</td><td>${fmt(x.length)}</td><td>${esc(where(x))}</td><td>${esc(ends(x))}</td></tr>`;
  }).join('');
  return { rows: rows.size, html: `<h3>Mouldings</h3><p class="small">Cut lengths. Miters are 45°; an outside miter's length is on the moulding's face, an inside miter's on its back.</p><table class="parts molds"><thead><tr><th>Qty</th><th>Moulding</th><th>Profile</th><th>Length</th><th>Where</th><th>Ends</th></tr></thead><tbody>${body}</tbody></table>` };
}

/** How much room a page's rows leave (rough, the same estimate as pageTable). */
function pageRoomLeft(page: string, all: TRow[], w: number, fs: number, cap: number): number {
  const on = all.filter((r) => page.includes(r.html));
  return cap - fs * 2.2 - on.reduce((t, r) => t + rowInches(r, w, fs), 0);
}

export function shopSet(p: Project, s: DrawingSettings): Sheet[] {
  beginEdits(s.edits);
  beginMarks(s);
  try { return shopSheets(p, s); } finally { endEdits(); }
}
function shopSheets(p: Project, s: DrawingSettings): Sheet[] {
  const A = area(s.paper);
  const sheets: Sheet[] = [];
  const walls = wallsWithWork(p);
  // Details go right after the wall assemblies, so the section marks on them point somewhere near
  const placed = placeDetails(p, 'shop', 'S', walls.length + 1);
  walls.forEach((w, i) => {
    const elevFrame = { ...A, w: A.w * 0.7 };
    const e = inView(`shop-elev:${w}`, `${wallNames[w]} assembly`, () => wallElevation(p, w, elevFrame, 'shop', cutsOn(p, placed, w)));
    const notes = html({ x: A.x + A.w * 0.72, y: A.y, w: A.w * 0.28, h: A.h }, (i === 0 ? revTableHtml(s) : '') + installNotes(p, w), s.paper === 'tabloid' ? 0.11 : 0.095);
    sheets.push(sheet(p, s, `S${i + 1}`, `${wallNames[w]} assembly`, scaleName(e.scale), e.svg + notes));
  });
  sheets.push(...detailSheets(p, s, placed));
  const fs = s.paper === 'tabloid' ? 0.11 : 0.09;
  const ts = s.paper === 'tabloid' ? 0.095 : 0.075;
  const num = () => `S${sheets.length + 1}`;
  for (const same of shopGroups(p)) {
    const c = same[0];
    const names = same.map((x) => x.name).join(', ');
    const parts = partsOf(p, c);
    const hasFrame = parts.some((x) => x.material === 'faceframe' && (x.role === 'stile' || x.role === 'rail'));
    const mvOnly = c.kind === 'mantel';
    const layoutProbe = sidePanelLayout(p, c, { x: 0, y: 0, w: 1, h: 1 });
    const label = (f: Frame, text: string) => `<text x="${f.x + f.w / 2}" y="${f.y + f.h + 0.05}" font-size="0.11" font-weight="700" text-anchor="middle">${esc(text)}</text>`;
    if (!layoutProbe) {
      // Pilasters, floating shelves, mantels: one sheet, as before
      const viewH = A.h * 0.56;
      const left: Frame = { x: A.x, y: A.y + 0.1, w: A.w * 0.4, h: viewH };
      const mid: Frame = { x: A.x + A.w * 0.4, y: A.y + 0.1, w: A.w * 0.34, h: viewH };
      const mv = mvOnly ? inView(`mantel:${c.id}`, `${c.name} mantel`, () => mantelViews(p, c, left, mid)) : null;
      const ff = hasFrame ? inView(`ff:${c.id}`, `${c.name} face frame`, () => faceFrameView(p, c, left)) : mv;
      const sec = c.kind === 'shelf' || c.kind === 'pilaster' || c.kind === 'mantel' ? null : inView(`sec:${c.id}`, `${c.name} section`, () => sideSection(p, c, mid));
      const labels = (ff ? label(left, `${mv ? 'MANTEL' : 'FACE FRAME'} (${scaleName(ff.scale)})`) : '') + (sec ? label(mid, `SECTION, FROM THE LEFT (${scaleName(sec.scale)})`) : '');
      // Short moulding lists go up in the wide space beside the drawing; long ones with the parts
      const mt = moldingsTable(p, c, same.length);
      // (A mantel's second view uses the middle of the sheet; there the mouldings go with the parts)
      const side = !mv && mt.rows > 0 && mt.rows <= 10;
      const info = mv ? html({ x: A.x + A.w * 0.76, y: A.y, w: A.w * 0.24, h: viewH }, cabinetHeader(p, c, same) + hardwareList(p, c), fs)
        : html({ x: A.x + A.w * 0.4, y: A.y, w: A.w * 0.6, h: viewH }, `<div style="display:flex;gap:1.5em"><div style="flex:1">${cabinetHeader(p, c, same) + hardwareList(p, c)}${c.kind === 'pilaster' ? `<h3>Order of work</h3><ol>${pilasterSteps(p, c).map((t) => `<li>${esc(t)}</li>`).join('')}</ol>` : ''}</div>${side ? `<div style="flex:1.6">${mt.html}</div>` : ''}</div>`, ts);
      const steps = c.kind === 'mantel' ? mantelSteps(p, c) : [];
      const pages = partsTablePages(p, c, same.length, A.w, ts, A.h - viewH - 0.25, A.h - 0.45, { noMolds: side, extra: steps.length ? `<h3>Order of work</h3><ol>${steps.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>` : undefined, extraRows: steps.length + 2 });
      const table = html({ x: A.x, y: A.y + viewH + 0.25, w: A.w, h: A.h - viewH - 0.25 }, pages[0] + (pages.length > 1 ? `<p class="small">Parts continue on the next sheet.</p>` : ''), ts);
      const first = num();
      sheets.push(sheet(p, s, first, `${names} shop drawing`, ff ? scaleName(ff.scale) : 'As noted', (ff?.svg ?? '') + (sec?.svg ?? '') + labels + info + table));
      pages.slice(1).forEach((pg, i) => sheets.push(sheet(p, s, num(), `${names} parts (continued)`, 'No scale',
        html({ x: A.x, y: A.y, w: A.w, h: A.h }, `<h2>${esc(names)}: parts, continued (${i + 2} of ${pages.length})</h2>${pg}<p class="small">Drawings on ${first}.</p>`, ts))));
      continue;
    }
    // Sheet 1: the views — face frame, section, and the side panel as it's machined
    const viewH = A.h * 0.64;
    const fFF: Frame = { x: A.x, y: A.y + 0.1, w: A.w * 0.38, h: viewH };
    const fSec: Frame = { x: A.x + A.w * 0.38, y: A.y + 0.1, w: A.w * 0.3, h: viewH };
    const fSide: Frame = { x: A.x + A.w * 0.68, y: A.y + 0.1, w: A.w * 0.32, h: viewH };
    const ff = hasFrame ? inView(`ff:${c.id}`, `${names} face frame`, () => faceFrameView(p, c, fFF)) : null;
    const sec = inView(`sec:${c.id}`, `${names} section`, () => sideSection(p, c, ff ? fSec : { ...fSec, x: A.x, w: A.w * 0.68 }));
    const lay = inView(`side:${c.id}`, `${names} side panel`, () => sidePanelLayout(p, c, fSide))!;
    const labels = (ff ? label(fFF, `FACE FRAME (${scaleName(ff.scale)})`) : '') + label(ff ? fSec : { ...fSec, x: A.x, w: A.w * 0.68 }, `SECTION, FROM THE LEFT (${scaleName(sec.scale)})`) + label(fSide, `LEFT SIDE, INSIDE FACE (${scaleName(lay.scale)})`);
    const lowY = A.y + viewH + 0.3, lowH = A.h - viewH - 0.3;
    const info = html({ x: A.x, y: lowY, w: A.w * 0.36, h: lowH }, cabinetHeader(p, c, same), fs);
    const sideNotes = html({ x: A.x + A.w * 0.37, y: lowY, w: A.w * 0.33, h: lowH }, `<h3>Side panel</h3><ul>${lay.notes.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`, fs);
    const hw = html({ x: A.x + A.w * 0.71, y: lowY, w: A.w * 0.29, h: lowH }, hardwareList(p, c) || '<h3>Hardware</h3><p>None on this one.</p>', fs);
    const sheetNo = num();
    sheets.push(sheet(p, s, sheetNo, `${names} shop drawing`, ff ? scaleName(ff.scale) : scaleName(sec.scale), (ff?.svg ?? '') + sec.svg + lay.svg + labels + info + sideNotes + hw));
    // Sheet 2: the parts, what's ordered, and the order of work
    const steps = assemblySteps(p, c, parts, lay.notes);
    // Short lists print larger
    const rowCount = partRows(parts).length;
    const tfs = rowCount <= 24 ? fs : ts;
    const pages = partsTablePages(p, c, same.length, A.w * 0.66, tfs, A.h - 0.45, A.h - 0.45);
    const table = html({ x: A.x, y: A.y, w: A.w * 0.66, h: A.h }, `<h2>${esc(names)}: parts${same.length > 1 ? ` (make ${same.length})` : ''}</h2>` + pages[0] + (pages.length > 1 ? `<p class="small">Parts continue on the next sheet.</p>` : ''), tfs);
    const work = html({ x: A.x + A.w * 0.68, y: A.y, w: A.w * 0.32, h: A.h }, `<h2>Order of work</h2><ol>${steps.map((t) => `<li>${esc(t)}</li>`).join('')}</ol><p class="small">Drawings on ${sheetNo}.</p>`, fs);
    sheets.push(sheet(p, s, num(), `${names} parts & assembly`, 'No scale', table + work));
    pages.slice(1).forEach((pg, i) => sheets.push(sheet(p, s, num(), `${names} parts (continued)`, 'No scale',
      html({ x: A.x, y: A.y, w: A.w * 0.66, h: A.h }, `<h2>${esc(names)}: parts, continued (${i + 2} of ${pages.length})</h2>${pg}`, tfs))));
    // The assembly view: the case pulled apart in 3D, every part ballooned with its parts-list number
    const av = assemblyView(p, c, { x: A.x, y: A.y + 0.2, w: A.w * 0.64, h: A.h - 0.3 });
    if (av.svg) {
      const key = `<h2>${esc(names)}: assembly</h2>${same.length > 1 ? `<p class="big">Make ${same.length}</p>` : ''}<p>Pulled apart to show every part; the red numbers are the parts list numbers (and the labels: ${esc(c.name)}-1, -2…). Sides out, top up, back behind, the face frame and doors in front.</p>
        <table class="parts"><thead><tr><th>#</th><th>Part</th><th>Qty</th></tr></thead><tbody>${av.legend.map((l) => `<tr><td><b>${l.n}</b></td><td>${esc(l.name)}</td><td>${l.qty}</td></tr>`).join('')}</tbody></table>
        <h3>Order of work</h3><ol>${steps.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>`;
      sheets.push(sheet(p, s, num(), `${names} assembly`, 'No scale', av.svg + html({ x: A.x + A.w * 0.66, y: A.y, w: A.w * 0.34, h: A.h }, key, ts)));
    }
  }
  if (cofferOf(p).on) {
    const top = A.h * 0.58;
    const rcp = inView('shop-rcp', 'Ceiling plan', () => ceilingPlan(p, { x: A.x, y: A.y, w: A.w * 0.6, h: top }, { lights: s.rcpLights ?? true, centers: !!s.rcpCenters }));
    const sec = inView('beam', 'Beam section', () => beamSection(p, { x: A.x + A.w * 0.6, y: A.y, w: A.w * 0.4, h: top }));
    const cfs = s.paper === 'tabloid' ? 0.09 : 0.07;
    const rows: TRow[] = partRows(cofferParts(p)).map(({ part, qty }) => ({ html: `<tr><td>${qty}</td><td>${esc(part.name)}</td><td>${fmt(part.length)}</td><td>${fmt(part.width)}</td><td>${fmt(part.thickness)}</td><td>${esc(part.species ?? '')}</td><td>${esc(part.note ?? '')}</td></tr>`, text: ['', part.name, '', '', '', part.species ?? '', part.note ?? ''] }));
    const pages = pageTable('<tr><th>Qty</th><th>Part</th><th>Length</th><th>Width</th><th>Thick</th><th>Stock</th><th>Notes</th></tr>', rows, A.w, cfs, A.h - top - 0.2, A.h - 0.45);
    const first = `S${sheets.length + 1}`;
    const table = html({ x: A.x, y: A.y + top + 0.2, w: A.w, h: A.h - top - 0.2 }, pages[0] + (pages.length > 1 ? '<p class="small">Parts continue on the next sheet.</p>' : ''), cfs);
    sheets.push(sheet(p, s, first, 'Coffered ceiling', `${scaleName(rcp.scale)}; section ${scaleName(sec.scale)}`, rcp.svg + sec.svg + table));
    pages.slice(1).forEach((pg, i) => sheets.push(sheet(p, s, `S${sheets.length + 1}`, 'Coffered ceiling parts (continued)', 'No scale',
      html({ x: A.x, y: A.y, w: A.w, h: A.h }, `<h2>Coffered ceiling: parts, continued (${i + 2} of ${pages.length})</h2>${pg}<p class="small">Plan and section on ${first}.</p>`, cfs))));
  }
  for (const t of furnitureOf(p)) {
    const v = tableSheetViews(t, A, 0.62);
    const rows = tableParts(t).map((x) => `<tr><td>${x.qty}</td><td>${esc(x.name)}</td><td>${fmt(x.length)}</td><td>${fmt(x.width)}</td><td>${fmt(x.thick)}</td><td>${esc(x.note ?? '')}</td></tr>`).join('');
    const info = `<h2>${esc(t.name)}</h2><p>${esc(t.species)}, ${esc(tableFinishLabel[t.finish].toLowerCase())}. ${fmt(t.length)} L × ${fmt(t.width)} W × ${fmt(t.height)} H.</p>`
      + `<h3>Cut list (finished sizes)</h3><table class="parts"><thead><tr><th>Qty</th><th>Part</th><th>Length</th><th>Width</th><th>Thick</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table>`
      + `<h3>Notes</h3><ul>${tableChecks(t).map((c) => `<li>${esc(c)}</li>`).join('')}${t.notes ? `<li>${esc(t.notes)}</li>` : ''}</ul>`;
    sheets.push(sheet(p, s, `S${sheets.length + 1}`, `${t.name} shop drawing`, `${scaleName(v.scale)}; section ${scaleName(v.secScale)}`, v.svg + html({ x: A.x + A.w * 0.64, y: A.y, w: A.w * 0.36, h: A.h }, info, s.paper === 'tabloid' ? 0.095 : 0.075)));
  }
  // Every moulding profile full size, custom ones drawn from their samples, so they can be milled or matched
  const profs = profileItems(p);
  if (profs.length) sheets.push(sheet(p, s, `S${sheets.length + 1}`, 'Moulding profiles', 'As noted', profileViews(profs, A)));
  const elec = electricianHtml(p);
  if (elec) sheets.push(sheet(p, s, `S${sheets.length + 1}`, 'Cabinet lighting & electrical', 'No scale', html({ x: A.x, y: A.y, w: A.w, h: A.h }, elec, s.paper === 'tabloid' ? 0.11 : 0.09)));
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
.dwg .fo table.parts td:nth-child(1),.dwg .fo table.parts td:nth-child(2),.dwg .fo table.parts td:nth-child(3),.dwg .fo table.parts td:nth-child(4),.dwg .fo table.parts td:nth-child(5),.dwg .fo table.parts td:nth-child(6){white-space:nowrap}
.dwg .fo table.molds td:nth-child(5),.dwg .fo table.molds td:nth-child(6){white-space:normal}
.dwg .fo table.sched td:nth-child(3){white-space:normal}
.dwg .fo table.revs{border-collapse:collapse;width:100%;margin:.2em 0}.dwg .fo table.revs td{border:1px solid #bbb;padding:.15em .35em;vertical-align:top}.dwg .fo table.revs td.rv{color:#c0392b;font-weight:700;text-align:center;width:1.6em}
.dwg .fo .approve{border:1px solid #111;padding:.4em .7em;margin-top:1em}
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

/** For the shop packet: the sheet frame, the drawing area, HTML in a frame. */
export { sheet as packetSheet, area as sheetArea, html as sheetHtml, esc as sheetEsc, pageTable, type TRow };
