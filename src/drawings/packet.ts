// The full shop packet: everything the shop needs to build the job, in one document to print or
// save as a PDF. The shop drawing set, then the plywood cut diagrams (one sheet per sheet of plywood,
// every part numbered), the face frame and solid stock cut list (rip widths, boards, crosscuts),
// a face frame assembly sheet for each different face frame, and last the part labels on letter
// label sheets, numbered to match the cut diagrams.
import type { Cabinet, Project } from '../model/types';
import { fmt } from '../units';
import { cutStock, defaultCutlist, optimizerParts } from '../model/cutlist';
import { optimize, type MaterialResult, type SheetLayout } from '../model/optimizer';
import { faceFrameNeeds, faceFramePieces, ffStockOf, otherSpecies, stockFor, type FaceFrameResult } from '../model/faceframe';
import { labelPages, partLabels, type LabelFormat } from './labels';
import { drawingsOf, packetSheet, pageTable, sheetArea, sheetCss, sheetEsc as esc, sheetHtml as html, shopGroups, shopSet, type DrawingSettings, type Sheet, type TRow, papers } from './sheets';
import { faceFrameView, partRows, partsOf } from './views';
import { inView, scaleName, type Frame } from './draw';
import { eff } from '../model/parts';
import { moldingOrder, moldLabel, profileLabel } from '../model/moldings';
import { hardwareOrder } from '../model/hardware';

const num = (sheets: Sheet[]) => `S${sheets.length + 1}`;

/* ---------- Plywood cut diagrams ---------- */

/** One sheet of plywood drawn to scale: parts numbered, grain marked, offcuts hatched. */
function layoutSvg(sh: SheetLayout, f: Frame): string {
  const { length: L, width: W } = sh.stock;
  const k = Math.min(f.w / L, f.h / W);
  const ox = f.x + (f.w - L * k) / 2, oy = f.y;
  const X = (x: number) => ox + x * k, Y = (y: number) => oy + y * k;
  const out: string[] = [`<rect x="${X(0)}" y="${Y(0)}" width="${L * k}" height="${W * k}" fill="#fff" stroke="#000" stroke-width="0.02"/>`];
  for (const o of sh.offcuts) out.push(`<rect x="${X(o.x)}" y="${Y(o.y)}" width="${o.l * k}" height="${o.w * k}" fill="#e6e3dc" stroke="#999" stroke-width="0.006"/>`);
  for (const p of sh.placed) {
    out.push(`<rect x="${X(p.x)}" y="${Y(p.y)}" width="${p.l * k}" height="${p.w * k}" fill="#f6f3ea" stroke="#000" stroke-width="0.012"/>`);
    const cx = X(p.x + p.l / 2), cy = Y(p.y + p.w / 2);
    const small = Math.min(p.l, p.w) * k;
    const fs = Math.max(0.07, Math.min(0.16, small * 0.45));
    // The part number where it fits (T1-3), else the sheet's own count; both are in the table beside it
    const pid = (p.part as { pid?: string }).pid;
    const big = pid && p.l * k > fs * pid.length * 0.65 + 0.1;
    out.push(`<text x="${cx}" y="${cy + fs * 0.35}" font-size="${fs}" font-weight="700" text-anchor="middle">${big ? esc(pid!) : p.n}</text>`);
    // Grain runs along the sheet's length unless the part was turned
    if (p.part.grain && p.l * k > 0.45 && p.w * k > 0.2) {
      const gy = Y(p.y + p.w) - 0.06;
      out.push(p.rotated
        ? `<line x1="${X(p.x) + 0.06}" y1="${Y(p.y) + 0.08}" x2="${X(p.x) + 0.06}" y2="${Math.min(gy, Y(p.y) + 0.35)}" stroke="#666" stroke-width="0.01"/>`
        : `<line x1="${X(p.x) + 0.08}" y1="${gy}" x2="${Math.min(X(p.x + p.l) - 0.06, X(p.x) + 0.4)}" y2="${gy}" stroke="#666" stroke-width="0.01"/>`);
    }
  }
  // The sheet's size along its edges
  out.push(`<text x="${X(L / 2)}" y="${Y(W) + 0.16}" font-size="0.09" text-anchor="middle">${fmt(L)} (grain this way →)</text>`);
  out.push(`<text x="${X(0) - 0.08}" y="${Y(W / 2)}" font-size="0.09" text-anchor="middle" transform="rotate(-90 ${X(0) - 0.08} ${Y(W / 2)})">${fmt(W)}</text>`);
  return out.join('');
}

function cutSheets(p: Project, s: DrawingSettings, sheets: Sheet[], results: MaterialResult[]): Sheet[] {
  const A = sheetArea(s.paper);
  const out: Sheet[] = [];
  const fs = s.paper === 'tabloid' ? 0.085 : 0.07;
  for (const m of results) {
    m.sheets.forEach((sh, i) => {
      const draw: Frame = { x: A.x, y: A.y + 0.45, w: A.w * 0.62, h: A.h - 0.8 };
      const rows = [...sh.placed].sort((a, b) => a.n - b.n).map((pl) => {
        const d = pl.part as typeof pl.part & { cabinet?: string; name?: string; note?: string };
        const what = d.cabinet ? `<b>${esc(d.cabinet)}</b> ${esc(d.name ?? '')}` : esc(pl.part.label);
        const extra = [pl.part.grain ? 'grain' : '', pl.part.band ? `band ${pl.part.band === 1 ? 'front edge' : 'both long edges'}` : '', pl.rotated ? 'turned' : ''].filter(Boolean).join(', ');
        const pid = (pl.part as { pid?: string }).pid;
        return `<tr><td>${pl.n}</td><td><b>${esc(pid ?? '')}</b></td><td>${what}</td><td>${fmt(pl.part.length)} × ${fmt(pl.part.width)}</td><td>${esc(extra)}</td></tr>`;
      }).join('');
      const yieldPct = Math.round((100 * sh.usedArea) / (sh.stock.length * sh.stock.width));
      const head = `<h2>${esc(m.material)}: sheet ${i + 1} of ${m.sheets.length}</h2><p>${esc(sh.stock.label)}, ${fmt(sh.stock.length)} × ${fmt(sh.stock.width)}; ${sh.placed.length} parts, ${yieldPct}% used.</p>`;
      const legend = html({ x: A.x + A.w * 0.64, y: A.y, w: A.w * 0.36, h: A.h }, `<h3>Parts on this sheet</h3><table class="parts"><thead><tr><th>#</th><th>Part no.</th><th>Part</th><th>Length × width</th><th></th></tr></thead><tbody>${rows}</tbody></table>
        <p class="small">Length is along the grain. Rip the full-length strips first, crosscut, then rip to width. Put each part’s label on it as it comes off the saw (labels at the back of this packet, numbered the same). Shaded areas are offcuts.</p>`, fs);
      out.push(packetSheet(p, s, num([...sheets, ...out]), `Cut diagram: ${m.material}, sheet ${i + 1}`, 'As shown', html({ x: A.x, y: A.y, w: A.w * 0.62, h: 0.45 }, head, fs) + layoutSvg(sh, draw) + legend));
    });
    if (m.unplaced.length) {
      out.push(packetSheet(p, s, num([...sheets, ...out]), `Cut diagram: ${m.material}, won’t fit`, 'No scale', html({ x: A.x, y: A.y, w: A.w, h: A.h },
        `<h2>${esc(m.material)}: parts that don’t fit any stock sheet</h2><ul>${m.unplaced.map((u) => `<li>${esc(u.label)}: ${fmt(u.length)} × ${fmt(u.width)}</li>`).join('')}</ul><p>Add longer stock in the Sheet cutlist, or turn grain off for these parts.</p>`, fs)));
    }
  }
  return out;
}

/* ---------- Face frame and solid stock cut list ---------- */

function ffListHtml(title: string, stockLabel: string, r: FaceFrameResult, ripAllowance: number, lengthAllowance: number): string {
  const groups = r.groups.map((g) => `<tr><td><b>${fmt(g.width)}</b></td><td>${fmt(g.ripWidth)}</td><td>${g.pieces.map((x) => `${x.qty} @ ${fmt(x.length)} <span class="small">(${esc(x.cabinets.join(', '))}: ${esc(x.names.join(', ').toLowerCase())})</span>`).join('<br>')}</td></tr>`).join('');
  const boards = r.boards.map((b, i) => `<tr><td>${i + 1}</td><td>${fmt(b.length)}</td><td>${b.strips.map((w) => fmt(w)).join(' + ')}</td></tr>`).join('');
  return `<h2>${esc(title)}</h2><p>${esc(stockLabel)}. Buy: ${r.byLength.map((x) => `${x.count} at ${fmt(x.length)}`).join(', ')}${r.buyLF ? ` (${Math.ceil(r.buyLF)} lineal ft)` : ''}${r.buyBF ? `, about ${Math.ceil(r.buyBF)} BF` : ''}, waste included.</p>
    ${r.tooLong.length ? `<p><b>Too long for any stocked board:</b> ${r.tooLong.map((x) => `${esc(x.cabinet)} ${esc(x.name)} ${fmt(x.length)}`).join(', ')}. Splice behind a rail or order long stock.</p>` : ''}
    <h3>1. Pieces by finished width</h3><table class="parts"><thead><tr><th>Finished width</th><th>Rip to</th><th>Pieces (finished lengths)</th></tr></thead><tbody>${groups}</tbody></table>
    <p class="small">Rip ${fmt(ripAllowance)} wide of finished, then joint or plane to width. Crosscut ${fmt(lengthAllowance)} long, then trim square to the finished length at assembly.</p>
    <h3>2. Rip the boards into strips</h3><table class="parts"><thead><tr><th>Board</th><th>Length</th><th>Strips (rip widths)</th></tr></thead><tbody>${boards}</tbody></table>`;
}
/** Step 3, crosscutting each strip: rows for a table that can run onto more sheets. */
function crosscutRows(r: FaceFrameResult, lengthAllowance: number): TRow[] {
  return r.groups.flatMap((g) => g.strips.map((st, i) => {
    const pcs = st.pieces.map((x) => fmt(x - lengthAllowance)).join(', ');
    return { html: `<tr><td>${fmt(g.width)}</td><td>${i + 1}</td><td>${fmt(st.length)}</td><td>${pcs}</td></tr>`, text: ['', '', '', pcs] };
  }));
}

function ffCutSheets(p: Project, s: DrawingSettings, sheets: Sheet[]): Sheet[] {
  const A = sheetArea(s.paper);
  const fs = s.paper === 'tabloid' ? 0.085 : 0.07;
  const out: Sheet[] = [];
  const main = ffStockOf(p);
  const lists: { title: string; label: string; r: FaceFrameResult; st: typeof main }[] = [];
  const mine = faceFramePieces(p);
  if (mine.length) lists.push({ title: `Face frame and solid stock: ${main.species.replace(/,.*$/, '')}`, label: `${main.species}${main.board ? `, ${main.board} boards` : ''} from ${main.supplier}`, r: faceFrameNeeds(mine, main), st: main });
  for (const sp of otherSpecies(p)) {
    const st = stockFor(p, sp);
    const ps = faceFramePieces(p, sp);
    if (ps.length) lists.push({ title: `Solid stock: ${sp}`, label: `${st.species}${st.board ? `, ${st.board} boards` : ''}`, r: faceFrameNeeds(ps, st), st });
  }
  for (const l of lists) {
    const first = num([...sheets, ...out]);
    out.push(packetSheet(p, s, first, l.title, 'No scale', html({ x: A.x, y: A.y, w: A.w, h: A.h }, ffListHtml(l.title, l.label, l.r, l.st.ripAllowance, l.st.lengthAllowance) + '<p class="small">Step 3 (crosscutting) on the next sheet.</p>', fs)));
    const pages = pageTable('<tr><th>Width</th><th>Strip</th><th>Length</th><th>Pieces off it (finished lengths, plus the crosscut allowance)</th></tr>', crosscutRows(l.r, l.st.lengthAllowance), A.w, fs, A.h - 0.5, A.h - 0.5);
    pages.forEach((pg, i) => out.push(packetSheet(p, s, num([...sheets, ...out]), `${l.title}: crosscuts${pages.length > 1 ? ` (${i + 1} of ${pages.length})` : ''}`, 'No scale',
      html({ x: A.x, y: A.y, w: A.w, h: A.h }, `<h2>${esc(l.title)}</h2><h3>3. Crosscut the strips${pages.length > 1 ? ` (${i + 1} of ${pages.length})` : ''}</h3>${pg}<p class="small">Boards and rip widths on ${first}.</p>`, fs))));
  }
  return out;
}

/* ---------- Face frame assembly ---------- */

function ffAssemblySheets(p: Project, s: DrawingSettings, sheets: Sheet[]): Sheet[] {
  const A = sheetArea(s.paper);
  const fs = s.paper === 'tabloid' ? 0.1 : 0.085;
  const out: Sheet[] = [];
  for (const same of shopGroups(p)) {
    const c: Cabinet = same[0];
    const parts = partsOf(p, c).filter((x) => x.material === 'faceframe' && (x.role === 'stile' || x.role === 'rail'));
    if (!parts.length) continue;
    const names = same.map((x) => x.name).join(', ');
    const f: Frame = { x: A.x, y: A.y + 0.1, w: A.w * 0.58, h: A.h - 0.3 };
    const v = inView(`ffa:${c.id}`, `${names} face frame assembly`, () => faceFrameView(p, c, f));
    const st = eff(c, p.settings);
    const rows = partRows(parts).map(({ part, qty }) => `<tr><td>${qty}${same.length > 1 ? ` <span class="small">(${qty * same.length})</span>` : ''}</td><td>${esc(part.name)}</td><td>${fmt(part.length)}</td><td>${fmt(part.width)}</td><td>${esc(part.note ?? '')}</td></tr>`).join('');
    const rails = parts.filter((x) => x.role === 'rail');
    const steps = [
      `Lay the stiles and rails out face up on a flat bench, as drawn. Mark the face, and mark each joint (A–A, B–B…) so they go back the same way.`,
      `Pocket holes on the back of each rail end${c.kind === 'pilaster' ? '' : ''}: two on rails 2" and wider, one on narrower rails. 1-1/4" fine-thread pocket screws in hardwood.`,
      'Glue the end grain lightly, clamp each joint flat across the faces (a face clamp at the joint), and drive the screws. Work from one end to the other.',
      `Check the diagonals: equal within 1/16". Check the frame lies flat. Rail positions are to the bottom of each rail (dimensions at the right of the drawing).`,
      'Sand the joints flush on the face once the glue sets; don’t round over the inside edges of the openings.',
      ...(rails.some((r) => /rabbet/i.test(r.note ?? '')) ? ['Rabbets for panels are cut before assembly; keep them on the back.'] : []),
      `Glue and nail the frame to the case, flush with the outside of the sides${(st.ffOverhang ?? 0) > 0 ? ` (overhanging ${fmt(st.ffOverhang)} each side)` : ''}; set the nails and fill.`,
    ];
    const info = html({ x: A.x + A.w * 0.6, y: A.y, w: A.w * 0.4, h: A.h }, `<h2>${esc(names)}: face frame</h2>${same.length > 1 ? `<p class="big">Make ${same.length}</p>` : ''}
      <p>Face frame ${fmt(st.ffThickness)} ${esc(p.settings.woodSpecies)}; ${fmt(c.width)} wide overall. Drawn from the front.</p>
      <h3>Pieces</h3><table class="parts ffa"><thead><tr><th>Qty</th><th>Piece</th><th>Length</th><th>Width</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table>
      <h3>Assembly</h3><ol>${steps.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>`, fs);
    out.push(packetSheet(p, s, num([...sheets, ...out]), `${names} face frame assembly`, scaleName(v.scale), v.svg + info));
  }
  return out;
}

/* ---------- Job materials: everything to buy or order, in one place ---------- */

function materialsSheet(p: Project, s: DrawingSettings, sheets: Sheet[], results: MaterialResult[]): Sheet {
  const A = sheetArea(s.paper);
  const fs = s.paper === 'tabloid' ? 0.085 : 0.07;
  const data = p.cutlist ?? defaultCutlist(p);
  const parts = optimizerParts(p, data);
  // Sheet goods: sheets per material from the cut diagrams, how much of them the parts use
  const sheetRows = results.map((m) => {
    const used = m.sheets.reduce((t, sh) => t + sh.usedArea, 0), area = m.sheets.reduce((t, sh) => t + sh.stock.length * sh.stock.width, 0);
    const kinds = [...new Set(m.sheets.map((sh) => `${sh.stock.label} ${fmt(sh.stock.length)} × ${fmt(sh.stock.width)}`))].join('; ');
    return `<tr><td><b>${m.sheets.length}</b></td><td>${esc(m.material)}</td><td>${esc(kinds)}</td><td>${area ? Math.round((100 * used) / area) : 0}%${m.unplaced.length ? `; <b>${m.unplaced.length} parts don’t fit</b>` : ''}</td></tr>`;
  }).join('');
  // Edge banding: the banded edges of every part, by material, plus 10% for trimming
  const band = new Map<string, number>();
  for (const x of parts) if (x.band) band.set(x.material, (band.get(x.material) ?? 0) + x.band * x.length);
  const bandRows = [...band.entries()].map(([m, inches]) => `<tr><td>${esc(m)}</td><td><b>${Math.ceil((inches * 1.1) / 12)} ft</b></td><td>${Math.ceil(inches / 12)} ft of edges, plus 10%</td></tr>`).join('');
  // Solid stock, by species: what to buy from the face frame lists
  const solid: string[] = [];
  const main = ffStockOf(p);
  const mainPieces = faceFramePieces(p);
  if (mainPieces.length) { const r = faceFrameNeeds(mainPieces, main); solid.push(`<tr><td>${esc(main.species)}</td><td>${r.byLength.map((x) => `${x.count} @ ${fmt(x.length)}`).join(', ')}</td><td>${Math.ceil(r.buyBF)} BF</td></tr>`); }
  for (const sp of otherSpecies(p)) {
    const st = stockFor(p, sp), ps = faceFramePieces(p, sp);
    if (!ps.length) continue;
    const r = faceFrameNeeds(ps, st);
    solid.push(`<tr><td>${esc(sp)}</td><td>${r.byLength.map((x) => `${x.count} @ ${fmt(x.length)}`).join(', ')}</td><td>${Math.ceil(r.buyBF)} BF</td></tr>`);
  }
  // Mouldings by profile
  const molds = moldingOrder(p).map((l) => `<tr><td>${esc(profileLabel(l.profile))}</td><td>${esc([...new Set(l.kinds.map((k) => moldLabel[k]))].join(', '))}</td><td><b>${Math.ceil(l.feet)} ft</b></td><td>${esc(l.species)}</td></tr>`).join('');
  // Ordered pieces (doors, drawer fronts, boxes, panels) across the job
  const orders = new Map<string, { qty: number; item: string; size: string; spec: string; who: Set<string> }>();
  for (const c of p.cabinets) for (const x of partsOf(p, c)) {
    const o = x.order;
    if (!o) continue;
    const size = `${fmt(o.w)} W × ${fmt(o.h)} H${o.d ? ` × ${fmt(o.d)} D` : ''}`;
    const key = [o.item, size, o.spec].join('|');
    const r = orders.get(key) ?? { qty: 0, item: x.name, size, spec: o.spec ?? '', who: new Set<string>() };
    r.qty++; r.who.add(c.name);
    orders.set(key, r);
  }
  const orderRows = [...orders.values()].map((r) => `<tr><td><b>${r.qty}</b></td><td>${esc(r.item)}</td><td>${esc(r.size)}</td><td>${esc(r.spec)}</td><td>${esc([...r.who].join(', '))}</td></tr>`).join('');
  // Hardware
  const hw = hardwareOrder(p);
  const why = (part: string) => (part === '71B3650' ? ' (Blum’s hinge for inset doors on a face frame, with the 175H5030.21 plate)' : '');
  const hwRows = hw.lines.map((l) => `<tr><td><b>${l.qty}</b></td><td>${esc(l.part.part)}</td><td>${esc(l.part.description + why(l.part.part))}</td></tr>`).join('') + hw.problems.map((x) => `<tr><td></td><td colspan="2">${esc(x.text)}</td></tr>`).join('');
  const table = (title: string, head: string, rows: string) => (rows ? `<h3>${title}</h3><table class="parts"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>` : '');
  const left = `<h2>Job materials</h2><p class="small">Everything to buy or order for ${esc(p.name)}, from the drawings, cut diagrams and lists in this packet.</p>`
    + table('Sheet goods (from the cut diagrams)', '<th>Sheets</th><th>Material</th><th>Stock</th><th>Used</th>', sheetRows)
    + table('Edge banding', '<th>Material</th><th>Buy</th><th></th>', bandRows)
    + table('Solid stock (boards to buy, waste included)', '<th>Species</th><th>Boards</th><th>About</th>', solid.join(''))
    + table('Mouldings (lineal feet, waste included)', '<th>Profile</th><th>Used as</th><th>Buy</th><th>Species</th>', molds);
  const right = table('Ordered: doors, drawer fronts, boxes and panels', '<th>Qty</th><th>Item</th><th>Size</th><th>Spec</th><th>For</th>', orderRows)
    + table('Hardware', '<th>Qty</th><th>Part</th><th>Description</th>', hwRows);
  return packetSheet(p, s, num(sheets), 'Job materials', 'No scale', html({ x: A.x, y: A.y, w: A.w * 0.48, h: A.h }, left, fs) + html({ x: A.x + A.w * 0.5, y: A.y, w: A.w * 0.5, h: A.h }, right, fs));
}

/* ---------- The packet ---------- */

/** Every sheet in the packet, numbered on from the shop set. */
export function packetSheets(p: Project, d = drawingsOf(p)): { sheets: Sheet[]; results: MaterialResult[] } {
  const sheets = shopSet(p, d);
  const data = p.cutlist ?? defaultCutlist(p);
  const results = optimize(optimizerParts(p, data), cutStock(p, data), data.options);
  sheets.push(...ffAssemblySheets(p, d, sheets));
  sheets.push(...cutSheets(p, d, sheets, results));
  sheets.push(...ffCutSheets(p, d, sheets));
  sheets.push(materialsSheet(p, d, sheets, results));
  return { sheets, results };
}

/** The packet as one document: the sheets, then the labels on letter label sheets. */
export function shopPacketDocument(p: Project, opts: { labels?: LabelFormat; title?: string } = {}): string {
  const d = drawingsOf(p);
  const { sheets, results } = packetSheets(p, d);
  const P = papers[d.paper];
  const labels = labelPages(partLabels(results, p.name), opts.labels ?? '8163');
  const title = opts.title ?? `${p.name} - Shop packet`;
  // A contents page up front
  const toc = sheets.map((x) => `<tr><td>${esc(x.number)}</td><td>${esc(x.title)}</td></tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
@page{size:${P.w}in ${P.h}in;margin:0}
html,body{margin:0;padding:0;background:#888}
.page{width:${P.w}in;height:${P.h}in;margin:.3in auto;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.3);overflow:hidden;page-break-after:always;break-after:page}
.toc{padding:.6in;font:11pt/1.4 "Helvetica Neue",Arial,sans-serif;box-sizing:border-box}
.toc table{border-collapse:collapse}.toc td{padding:.05in .25in .05in 0;vertical-align:top}
@media print{html,body{background:#fff}.page{margin:0;box-shadow:none}}
${sheetCss}
.dwg .fo table.ffa td:nth-child(5){white-space:normal}
${labels.css}
</style></head><body>
<div class="page toc"><h1>${esc(p.name)}: shop packet</h1><p>Drawings, plywood cut diagrams, face frame cut list and assembly, then the part labels (print those on Avery label sheets at 100%).</p><table>${toc}<tr><td>Labels</td><td>${partLabels(results, p.name).length} part labels, after the last sheet</td></tr></table></div>
${sheets.map((x) => `<div class="page">${x.svg}</div>`).join('')}
${labels.body}
</body></html>`;
}
