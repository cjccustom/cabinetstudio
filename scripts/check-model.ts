import { readFileSync } from "node:fs";
import { cancelDeadline, holidays } from "../portal/src/cancel";
import { expiring } from "../src/portal";
import { newTable, seats, tableEstimate, tableScope } from "../src/model/furniture";
// Sanity checks on the cabinet model: run with `npm test`.
import { buildParts, layoutRows, panelExtents, realOverhang } from "../src/model/parts";
import { placedAppliances } from "../src/model/appliances";
import { legWidth, mantelClearances } from "../src/model/mantel";
import { defaultBack, planToProject, readPlan } from "../src/model/planImport";
import { fromDwgDatabase, parseDxf } from "../src/import/cad";
import { sampleProject, defaultSettings, presets, cabinetFromPreset } from "../src/model/defaults";
import { findIssues, gapBeside, nextFreeOffset, resolveEnds } from "../src/model/layout";
import { fmt, parseLength } from "../src/units";
import { drawerBoxSize, eaglePrice, hingeHoles } from "../src/model/eagle";
import { optimize } from "../src/model/optimizer";
import { defaultFaceFrameStock, faceFrameNeeds, faceFramePieces, otherSpecies, roughQuarters, woodPieces } from "../src/model/faceframe";
import { panelAbove, panelOrder } from "../src/model/panels";
import { amCatalog } from "../src/model/andersonMcquaid";
import { cabinetMoldings, moldingOrder, mountShape } from "../src/model/moldings";
import { estimateHours, priceQuote, quoteOf, scopeLine } from "../src/model/quote";
import { optimizerParts } from "../src/model/cutlist";
import { normalize } from "../src/store";
import { fieldChecks, releaseStatus } from "../src/model/release";
import { eagleFraction, eagleRequests, requestText } from "../src/model/eagleRequest";
import { hardwareOrder, tierPrice } from "../src/model/hardware";
import { defaultSupplies, supplyDrivers, supplyLines } from "../src/model/supplies";
import { jobNumbers, phaseOf, starterTodos } from "../src/shop/fromDesign";
import { bracketCount, bracketLength, finishedEnds } from "../src/model/floatingShelf";
import { broscoCatalog } from "../src/model/brosco";
import { designByCode, doorDrawing, proportionsFor, stockSlab, tradeSize } from "../src/model/reeb";
import { doorOrder } from "../src/model/doorOrder";
import { applyDraft, cleanDraft, closestProfile, draftRequest } from "../src/model/photoRoom";
import { clientInfoDoc, folderName, ordersDoc, parseFolderName, quoteDoc, stageByFolder } from "../src/model/client";
import { readScan, scanToDraft } from "../src/model/roomScan";
import { customerSet, drawingsOf, setDocument, shopSet } from "../src/drawings/sheets";
import { cabinetCallouts, forAudience } from "../src/drawings/notes";
import { hardwareItems, partsOf } from "../src/drawings/views";
import { cabinetLine, cofferFeet, cofferLayout, cofferMoldings, cofferParts, coffers as cofferList, fasciaBacking } from "../src/model/coffer";
import { blockedAlong, casingReach, freeRuns, newOpening, openingIssues, openingTrim, roomMoldings } from "../src/model/room";

let failed = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  if (got !== want) { failed++; console.log(`FAIL ${label}: got ${got}, want ${want}`); }
};

eq('parse 23 1/4', parseLength('23 1/4'), 23.25);
eq('parse 23-1/4', parseLength('23-1/4'), 23.25);
eq('parse 3/4', parseLength('3/4'), 0.75);
eq("parse 2' 6\"", parseLength(`2' 6"`), 30);
eq('parse junk', parseLength('abc'), null);
eq('fmt 22.5', fmt(22.5), '22 1/2"');
eq('fmt 0.0625', fmt(1 / 16), '1/16"');
eq('fmt 3/32', fmt(3 / 32), '3/32"');
eq('fmt rounds odd values to 1/16', fmt(0.7), '11/16"');

const p = sampleProject();
const s = { ...defaultSettings, endPanel: 'flush' as const };

// Cody's example: a 21" base, nominal 3/4" stock, 1/4" dados -> bottom & stretchers at 20"
const b21 = { ...p.cabinets.find((c) => c.name === 'B1')!, width: 21 };
const p21 = buildParts(b21, s);
const one = (n: string) => p21.find((x) => x.name === n)!;
eq('21" bottom length', one('Bottom').length, 20);
eq('21" stretcher length', one('Front stretcher').length, 20);
eq('21" back width', one('Back').width, 20);
eq('bottom depth stops at back rabbet', one('Bottom').width, 23.25 - 0.625);
eq('real overhang 1/16', realOverhang(s), 0.0625);
eq('back is 1/2"', one('Back').thickness, 0.5);
// Drawn bottom sits 1/16" below the top of the 1 1/2" bottom rail
const bot = one('Bottom').boxes[0];
eq('bottom top below rail', bot.min[1] + bot.size[1], 4 + 1.5 - 0.0625);
// Drawn sides leave the face frame overhanging by the real overhang
const side = p21.find((x) => x.role === 'side')!.boxes[0];
eq('left side outer face', side.min[0], 0.0625);
const box = p21.find((x) => x.name === 'Drawer box')!;
eq('drawer box width (1/2 sides, Tandem)', box.order!.w, 18 - 0.625);
eq('drawer box height', box.order!.h, 6 - 0.8125);
eq('drawer box depth', box.order!.d, 21);
eq('1/2" sides width', drawerBoxSize({ openingW: 18, openingH: 6, depth: 24, side: 0.5, slideId: 'tandem', rearClearance: 0.5 }).w, 17.375);
eq('toe notch 3 1/2 deep overall', p21.find((x) => x.role === 'side')!.note!.startsWith('Toe notch 4" × 2 3/4"'), true);
eq('toe skin is 1/2"', one('Toe kick skin').thickness, 0.5);
eq('doors are ordered, not cut', p21.filter((x) => x.order && x.cut).length, 0);

const b = p.cabinets.find((c) => c.name === 'B2')!; // 30" drawer over 2 doors
const parts = buildParts(b, s);
const get = (n: string) => parts.filter((x) => x.name === n);
eq('stile length', get('Stile')[0].length, 30.5);
eq('rail length', get('Top rail')[0].length, 27);
eq('door count', get('Door').length, 2);
// 1 1/4" overlay: full overlay at the frame edge, fronts split the 1 1/2" mid rail
const df = get('Drawer front')[0];
eq('1 1/4 overlay drawer front width', df.width, 27 + 2.5);
eq('drawer front height shares mid rail', df.length, 6 + 1.25 + (1.5 - 0.125) / 2);
eq('door width (Eagle pair formula)', get('Door')[0].width, (29.5 - 0.125) / 2);
const half = buildParts(b, { ...s, doorOverlay: 0.5 });
eq('1/2 overlay drawer front', half.find((x) => x.name === 'Drawer front')!.length, 7);
const ins = buildParts(b, { ...s, doorMount: 'inset' });
eq('inset drawer front width', ins.find((x) => x.name === 'Drawer front')!.width, 27 - 2 * 0.09375);
eq('inset pair width', ins.find((x) => x.name === 'Door')!.width, (27 - 3 * 0.09375) / 2);
const w1 = p.cabinets.find((c) => c.kind === 'wall')!;
const wf = buildParts({ ...w1, bottomFlush: true }, s).find((x) => x.name === 'Bottom')!.boxes[0];
eq('flush wall bottom sits at face frame bottom', wf.min[1], 0);
const rows = layoutRows(b, s);
eq('rows fill frame', rows.leftover, 0);
for (const part of parts) for (const bx of part.boxes) for (const v of bx.size) if (!(v > 0)) { failed++; console.log('bad box', part.name, bx.size); }

const ends = resolveEnds(p.room, p.cabinets, p.cabinets.find((c) => c.name === 'B4')!);
eq('B4 right end exposed (range gap)', ends.right, true);
eq('B4 left end hidden', ends.left, false);

// Extended stile instead of a filler: face frame grows, case stays the same
const sc = { ...b21, width: 22.5, scribeRight: 1.5 };
const psc = buildParts(sc, s);
eq('scribed cabinet keeps 20" bottom', psc.find((x) => x.name === 'Bottom')!.length, 20);
const ext = psc.find((x) => x.name === 'Stile, extended')!;
eq('extended stile cut width', ext.width, 1.5 + 1.5 + s.scribeAllowance);
eq('extended stile drawn width', ext.boxes[0].size[0], 3);
eq('rails unchanged', psc.find((x) => x.name === 'Top rail')!.length, 18);
// Gap to the wall is found so the stile can close it
const lone = { ...b21, id: 'lone', wall: 'right' as const, offset: 120 - 21 - 1.375 };
eq('gap to wall', gapBeside(p.room, [lone], lone, 'right', s), 1.375);
// End panels
const pan = buildParts(b21, s, { left: true, right: false });
const ep = pan.find((x) => x.name === 'End panel')!;
eq('flush panel depth reaches door face', ep.width, 24 + 0.75);
eq('panel ordered from Eagle', ep.order!.item, 'endPanel');
// 1 1/4" overlay on a 34 1/2" base: doors run from 4 + 1 1/2 - 1 1/4 up to 34 1/2 - 1 1/2 + 1 1/4
eq('panel height matches doors', ep.length, (34.5 - 0.25) - (4 + 0.25));
eq('inset panel follows face frame', buildParts(b21, { ...s, endPanel: 'inset' }, { left: true, right: false }).find((x) => x.name === 'End panel')!.length, 30.5);
eq('side under panel is stapled', pan.filter((x) => x.role === 'side').every((x) => !x.note!.includes('pocket')), true);
eq('held-back panel', buildParts(b21, { ...s, endPanel: 'reveal' }, { left: true, right: false }).find((x) => x.name === 'End panel')!.width, 24.5);
eq('inset panel', buildParts(b21, { ...s, endPanel: 'inset' }, { left: true, right: false }).find((x) => x.name === 'End panel')!.width, 24);
eq('panel sticks out past frame', panelExtents(b21, s, { left: true, right: false }).left, 0.75 - 0.0625);

// Sheet optimizer: nothing overlaps, everything stays on the sheet, grain-locked parts keep their grain
{
  const proj = normalize(sampleProject());
  const res = optimize(optimizerParts(proj, proj.cutlist!), proj.cutlist!.stock, proj.cutlist!.options);
  const k = proj.cutlist!.options.kerf;
  for (const m of res) {
    eq(`${m.material}: all parts placed`, m.unplaced.length, 0);
    for (const sh of m.sheets) {
      sh.placed.forEach((a, i) => {
        if (a.x < -1e-6 || a.y < -1e-6 || a.x + a.l > sh.stock.length + 1e-6 || a.y + a.w > sh.stock.width + 1e-6) { failed++; console.log('off sheet', a.part.label); }
        if (a.part.grain && a.rotated) { failed++; console.log('grain turned', a.part.label); }
        sh.placed.slice(i + 1).forEach((b) => {
          if (a.x < b.x + b.l + k - 1e-6 && b.x < a.x + a.l + k - 1e-6 && a.y < b.y + b.w + k - 1e-6 && b.y < a.y + a.w + k - 1e-6) { failed++; console.log('overlap', a.part.label, b.part.label); }
        });
      });
    }
    const used = m.sheets.reduce((s2, sh) => s2 + sh.usedArea, 0);
    const total = m.sheets.reduce((s2, sh) => s2 + sh.stock.length * sh.stock.width, 0);
    console.log(`  ${m.material}: ${m.sheets.length} sheets, ${Math.round((100 * used) / total)}% yield, ${m.sheets.reduce((s2, sh) => s2 + sh.cuts.length, 0)} cuts`);
  }
}

// Face frame stock: grouped by finished width, strips never longer than a board
{
  const proj = normalize(sampleProject());
  const pcs = faceFramePieces(proj);
  const ff = faceFrameNeeds(pcs, defaultFaceFrameStock);
  eq('every piece counted once', ff.groups.reduce((t, g) => t + g.count, 0), pcs.length);
  eq('1 1/2" is the main width', ff.groups[0].width, 1.5);
  for (const g of ff.groups) for (const st of g.strips) if (st.used > 96 - 4 + 1e-6) { failed++; console.log('strip too long', st.used); }
  const withScribe = faceFrameNeeds(faceFramePieces({ ...proj, cabinets: [{ ...proj.cabinets[0], scribeLeft: 1.5, width: 19.5 }] }), defaultFaceFrameStock);
  eq('extended stile is its own width', withScribe.groups.map((g) => g.width).join(','), '1.5,3.5');
  console.log(`  face frames: ${pcs.length} pcs, ${ff.groups.map((g) => `${g.width}": ${(g.totalLength / 12).toFixed(1)} lf`).join(', ')}, ${ff.boards.length} boards, buy ${ff.buyBF.toFixed(1)} BF`);
}

// Corner cabinets
{
  const proj = normalize(sampleProject());
  const room = { width: 144, depth: 144, height: 96 };
  const lazy = cabinetFromPreset(presets.find((x) => x.id === 'base-lazy')!, 'back', 0, []);
  const lp = buildParts(lazy, s);
  eq('lazy susan has 2 bifold doors', lp.filter((x) => x.name === 'Door').length, 2);
  eq('lazy susan bottom is notched', lp.find((x) => x.name === 'Bottom')!.note!.startsWith('L-shaped'), true);
  eq('no shelves with a susan', lp.filter((x) => x.role === 'shelf').length, 0);
  for (const part of lp) for (const bx of part.boxes) for (const v of bx.size) if (!(v > 0)) { failed++; console.log('bad corner box', part.name, bx.size); }
  // Doors don't collide at the inside corner
  const [da, db] = lp.filter((x) => x.name === 'Door').map((d) => d.boxes[0]);
  const hit = da.min[0] < db.min[0] + db.size[0] && db.min[0] < da.min[0] + da.size[0] && da.min[2] < db.min[2] + db.size[2] && db.min[2] < da.min[2] + da.size[2];
  eq('bifold doors clear each other', hit, false);
  // A base on the left wall after the susan starts past the susan's leg
  // Left-wall offsets run from the front corner, so the susan's leg takes 108..144 along that wall
  const filler = { ...cabinetFromPreset(presets[0], 'left', 0, [lazy]), width: 90 };
  const off = nextFreeOffset(room, [lazy, filler], 'left', 18, 0, 34.5, 24);
  eq('next left-wall cabinet fits up against the corner leg', off, 90);
  eq('nothing fits past the corner leg', nextFreeOffset(room, [lazy, filler], 'left', 24, 0, 34.5, 24) >= 108 - 1e-6 || nextFreeOffset(room, [lazy, filler], 'left', 24, 0, 34.5, 24) === 120, true);
  const next = { ...cabinetFromPreset(presets[0], 'left', off, [lazy]), offset: off };
  eq('cabinet butting the susan has a hidden end', resolveEnds(room, [lazy, next], next).right, false);
  eq('no overlap with corner', findIssues(room, [lazy, next], s).length, 0);
  // Blind corner: door opening starts past the blind width
  const blind = cabinetFromPreset(presets.find((x) => x.id === 'base-blind')!, 'back', 0, []);
  const bp = buildParts(blind, s);
  eq('blind stile present', bp.some((x) => x.name === 'Blind stile'), true);
  // Blind stile = 1 1/2" face frame stile + 3" clearance, starting 24" from the corner
  eq('blind stile width', bp.find((x) => x.name === 'Blind stile')!.width, 4.5);
  eq('blind door width', bp.find((x) => x.name === 'Door')!.width, 42 - 28.5 - 1.5 + 2 * s.doorOverlay);
  eq('mid rail spans opening only', bp.find((x) => x.name === 'Mid rail')!.length, 42 - 28.5 - 1.5);
  eq('more clearance next to a range', buildParts({ ...blind, blind: { ...blind.blind!, clearance: 6 } }, s).find((x) => x.name === 'Blind stile')!.width, 7.5);
  void proj;
}

// Per-cabinet overrides, solid wood tops, beadboard
{
  const b = { ...sampleProject().cabinets.find((c) => c.name === 'B2')!, overrides: { stileWidth: 2, toeKickHeight: 3.5 } };
  const ps = buildParts(b, s);
  eq('override stile width', ps.find((x) => x.name === 'Stile')!.width, 2);
  eq('override rail length', ps.find((x) => x.name === 'Top rail')!.length, 26);
  eq('override toe kick', ps.find((x) => x.name === 'Stile')!.length, 34.5 - 3.5);
  eq('job standard untouched', buildParts({ ...b, overrides: undefined }, s).find((x) => x.name === 'Stile')!.width, 1.5);
  const bench = cabinetFromPreset(presets.find((x) => x.id === 'bench')!, 'back', 0, []);
  const top = buildParts(bench, s).find((x) => x.role === 'woodTop')!;
  eq('bench seat is solid wood', top.material, 'solidWood');
  eq('bench seat depth', top.width, 16 + 0.75 + 1);
  eq('bench seat 6/4 stock', roughQuarters(top.thickness), 6);
  eq('4/4 for 3/4 finished', roughQuarters(0.75), 4);
  const proj = normalize({ ...sampleProject(), cabinets: [bench] });
  const panel = panelAbove(proj, bench);
  eq('backsplash starts on the seat', panel.bottom, 17.25 + 1.25);
  eq('one sheet covers a 48 x 30 backsplash', panelOrder(panel).qty, 1);
  eq('60" wide backsplash still fits one sheet cut in rows', panelOrder({ ...panel, width: 60 }).qty, 1);
  eq('tall wainscot', panelOrder({ ...panel, width: 100, height: 60 }).qty, 3);
  eq('default product is Standard Bead 2" o.c.', panelOrder(panel).item.includes('MDF502048SBP1S'), true);
  eq('strips cover by face width', panelOrder({ ...panel, profile: 'standard-bead-strip', spacing: 2 }).qty, 5);
  eq('3" o.c. strip has a 9" face', panelOrder({ ...panel, profile: 'standard-bead-strip', spacing: 3 }).qty, 6);
  eq('old projects still read', panelOrder({ ...panel, profile: 'vbead', spacing: undefined }).item.startsWith('4×8 sheet, V-Bead'), true);
  eq('seat and cap on the wood list', woodPieces({ ...proj, panels: [{ ...panel, cap: true }] }).length, 2);
}

// Anderson & McQuaid mouldings
{
  eq('A&M catalog loaded', amCatalog.length > 200, true);
  const crown = amCatalog.find((p) => p.category === 'Crown' && p.shape)!;
  const m = mountShape(crown);
  eq('crown back sits at u = 0', Math.min(...m.pts.map((q) => q[0])) < 0.02, true);
  const w = { ...cabinetFromPreset(presets.find((x) => x.id === 'wall-2')!, 'back', 30, []), crown: crown.num };
  const pcs = cabinetMoldings(w, s, { left: true, right: true });
  eq('crown front + two returns', pcs.length, 3);
  const ex = panelExtents(w, s, { left: true, right: true });
  eq('front run wraps both ends and end panels', Math.abs(pcs[0].length - (30 + ex.left + ex.right + 2 * m.depth)) < 1e-6, true);
  eq('returns run back to the wall', Math.abs(pcs[1].length - (12 + m.depth)) < 1e-6, true);
  const proj = normalize({ ...sampleProject(), cabinets: [w], panels: [] });
  const ord = moldingOrder(proj);
  const inches = 30 + ex.left + ex.right + 2 * m.depth + 2 * (12 + m.depth);
  eq('order lineal feet with waste', ord[0].feet, Math.ceil((inches / 12) * 1.15));
  eq('priced', ord[0].price != null, true);
}

// Quoting
{
  const base = normalize(sampleProject());
  base.quote = {};
  const r = priceQuote(base);
  const tax = base.settings.purchaseTax;
  const g = r.groups[0];
  eq('method A formula', Math.abs(g.methodA - (g.materials * (1 + tax) + g.hours * 65) * 1.85) < 0.01, true);
  eq('method B formula', Math.abs(g.methodB - (g.hours * 110 + g.materials * (1 + tax) * 1.25)) < 0.01, true);
  eq('quote rounds to $10', r.total % 10, 0);
  const busy = priceQuote({ ...base, quote: { ...base.quote, workload: 'full' } });
  eq('booked-up raises price 8%', Math.abs(busy.workloadAmount - (busy.calculated - busy.painter) * 0.08) < 0.01, true);
  const painted = priceQuote({ ...base, quote: { ...base.quote, painter: 1500, painterMarkup: 0.1 } });
  eq('painter line passes through with markup', Math.abs(painted.calculated - r.calculated - 1650) < 0.01, true);
  eq('hours estimated', r.shopHours > 20 && r.installHours > 5, true);
  eq('scope line wording', scopeLine(base.cabinets[1], base).startsWith('B2: Approx: 30”W x 34-1/2”H x 24”D; (2) overlay doors; (1) drawer'), true);
}

// Eagle prices from real order acknowledgments
{
  const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
  eq('door 15.75 x 48.325, 3 holes ($78.35, Oct)', near(eaglePrice('door', 15.75, 48.325), 78.35, 1), true);
  eq('tall door gets a center rail ($96.25 class)', eaglePrice('door', 17.875, 65.875) - eaglePrice('door', 17.875, 49.9) > 7, true);
  eq('drawer front 36.313 x 4.75 ($33.03)', near(eaglePrice('drawerFront', 36.313, 4.75), 33.03, 1), true);
  eq('drawer box 7.5 x 13.875 x 12 ($79.05)', near(eaglePrice('drawerBox', 13.875, 7.5, 12), 79.05, 2), true);
  eq('drawer box 12 x 21.625 x 21 ($132.56)', near(eaglePrice('drawerBox', 21.625, 12, 21), 132.56, 2), true);
  eq('odd height costs a rip over the stock height', eaglePrice('drawerBox', 19.375, 8.75, 21) > eaglePrice('drawerBox', 19.375, 9, 21), true);
}

// Order release: deposit and site measurements
{
  const job = normalize(sampleProject());
  const checks = fieldChecks(job);
  eq('back wall length is checked', checks.some((c) => c.id === 'wall:back'), true);
  eq('ceiling checked when there are uppers', checks.some((c) => c.id === 'ceiling'), true);
  eq('fresh job is not cleared', releaseStatus(job).ready, false);
  const measured = Object.fromEntries(checks.map((c) => [c.id, c.design]));
  eq('measured but no deposit', releaseStatus({ ...job, release: { measured } }).waiting.join(), 'deposit');
  eq('deposit and matching measurements clear it', releaseStatus({ ...job, release: { depositDate: '2026-10-22', measured } }).ready, true);
  const off = { ...measured, 'wall:back': measured['wall:back'] - 0.5 };
  eq('1/2" short wall blocks ordering', releaseStatus({ ...job, release: { depositDate: '2026-10-22', measured: off } }).ready, false);
  eq('marked OK clears it', releaseStatus({ ...job, release: { depositDate: '2026-10-22', measured: off, accepted: { 'wall:back': true } } }).ready, true);
  eq('1/16" off is within tolerance', releaseStatus({ ...job, release: { depositDate: '2026-10-22', measured: { ...measured, 'wall:back': measured['wall:back'] + 0.0625 } } }).ready, true);
  console.log('  field checks:', checks.map((c) => `${c.label} ${fmt(c.design)}`).join('; '));
}

// Eagle quote requests, laid out like Eagle's own confirmation emails
{
  const job = normalize(sampleProject());
  const reqs = eagleRequests(job);
  eq('three requests: doors, fronts, boxes', reqs.map((r) => r.kind).join(), 'doors,fronts,boxes');
  const cfg = Object.fromEntries(reqs[0].config);
  eq('door construction', cfg['Construction Type'], '5-Piece Doors (Wood only)');
  eq('door wood', cfg['Wood Type'], 'Maple - Paint Grade');
  eq('rail and stile', cfg['Rail and Stile Width'], '2-1/4"');
  eq('framing bead', cfg['Framing Bead'], '5pc - C (Hartford)');
  eq('hinge holes', cfg['Hinge Holes'], 'A-03 (cup only 3mm tab (1/8"))');
  eq('no end panels by default', reqs[0].lines.some((l) => l[1] === 'Panel'), false);
  const paneled = eagleRequests({ ...job, settings: { ...job.settings, endPanel: 'flush' } });
  eq('end panels go on the door request as Panel', paneled[0].lines.some((l) => l[1] === 'Panel'), true);
  eq('fronts have no hinge holes', Object.fromEntries(reqs[1].config)['Hinge Holes'], 'None');
  eq('box columns', reqs[2].columns.slice(1, 5).join(), 'Qty,Height,Width,Depth');
  eq('box material', Object.fromEntries(reqs[2].config)['Drawer material'], '1/2 maple');
  eq('fractions Eagle style', [eagleFraction(2.25), eagleFraction(0.75), eagleFraction(1.5)].join(' '), '2-1/4" 3/4" 1-1/2"');
  eq('center panel code', cfg['Center Panel'], 'MDF-07 (1/4" flat panel - default 5pc painted)');
  eq('front panel code', Object.fromEntries(reqs[1].config)['Center Panel'], 'MDF-10 (flat front panel with 1/8" back reveal flush)');
  eq('outside edge', cfg['Outside Edge'], 'E-01 (hand broken - default)');
  const clip = eagleRequests({ ...job, settings: { ...job.settings, hingeType: 'cliptop', doorStyleId: 'cambridge' } });
  eq('clip top hinges bore A-05', Object.fromEntries(clip[0].config)['Hinge Holes'], 'A-05 (cup only 5mm tab (3/16"))');
  eq('Cambridge is 5pc - L', Object.fromEntries(clip[0].config)['Framing Bead'], '5pc - L (Cambridge Step Shaker)');
  eq('hinge holes by Eagle table', [8, 30, 39, 39.0625, 60, 61, 80, 84].map(hingeHoles).join(), '0,2,2,3,3,4,4,5');
  eq('nothing to check on a Hartford job', reqs.flatMap((r) => r.check).join(), '');
  // Short fronts get 1 1/2" rails like Eagle's 4 3/4" fronts
  const short = { ...job, cabinets: job.cabinets.map((c) => (c.name === 'B3' ? { ...c, rows: [{ type: 'drawer' as const, height: 3.5, doors: 1 as const, shelves: 0 }, ...c.rows.slice(1)] } : c)) };
  eq('short front rails', eagleRequests(short)[1].lines.some((l) => l[5] === '1-1/2"'), true);
  console.log(requestText(job.name, reqs[1]).split('\n').slice(0, 14).join('\n'));
}

// Woodworker Express hardware
{
  const job = normalize(sampleProject());
  const h = hardwareOrder(job);
  const qty = (part: string) => h.lines.find((l) => l.part.part === part)?.qty ?? 0;
  eq('1 1/4" overlay picks Compact 39C355B.20', qty('39C355B.20'), h.hinges);
  eq('one 21" Tandem 563H pair per drawer', qty('563H5330B'), h.drawers);
  eq('left and right clips per drawer', [qty('T51.1901 L'), qty('T51.1901 R')].join(), `${h.drawers},${h.drawers}`);
  eq('rear brackets on overlay drawers', qty('295.3750.02'), 2 * h.drawers);
  eq('no problems on the sample', h.problems.map((x) => x.text).join('; '), '');
  const inset = hardwareOrder({ ...job, settings: { ...job.settings, doorMount: 'inset', hingeType: 'cliptop' } });
  const iq = (part: string) => inset.lines.find((l) => l.part.part === part)?.qty ?? 0;
  eq('inset Clip Top: half crank on 9mm face frame plate', [iq('71B3650'), iq('175H5030.21')].join(), `${inset.hinges},${inset.hinges}`);
  eq('inset drawers get PS clips', iq('T51.1901.PS L'), inset.drawers);
  eq('no rear brackets on inset', iq('295.3750.02'), 0);
  const compact = h.lines.find((l) => l.part.part === '39C355B.20')!.part;
  eq('quantity break at 300', [tierPrice(compact, 299), tierPrice(compact, 300)].join(), '3.25,2.97');
  const quoted = priceQuote(job).materials.find((m) => m.label.startsWith('Hinges'));
  eq('quote prices hinges from the list', Math.abs((quoted?.cost ?? 0) - h.hinges * 3.25) < 0.01, true);
}

// Shop supplies counted from the design
{
  const job = normalize(sampleProject());
  const d = supplyDrivers(job);
  const h = hardwareOrder(job);
  eq('hinge count drives hinge screws', d.hinge, h.hinges);
  eq('two joints per rail', d.ffJoint > 2 * job.cabinets.length, true);
  eq('shelf banding counted', d.bandFt > 10, true);
  const lines = supplyLines(job, defaultSupplies);
  const pocket = lines.find((l) => l.item.label.startsWith('Pocket'))!;
  eq('pocket screws = 2 per joint at $0.04', Math.abs(pocket.cost - d.ffJoint * 2 * 0.04) < 1e-9, true);
  const sup = priceQuote(job).materials.find((m) => m.label.startsWith('Shop supplies'))!;
  eq('quote carries shop supplies', Math.abs(sup.cost - lines.filter((l) => l.group === 'cabinets').reduce((t, l) => t + l.cost, 0)) < 0.01, true);
  console.log('  supplies:', lines.filter((l) => l.qty).map((l) => `${l.item.label} ${l.qty.toFixed(0)} = $${l.cost.toFixed(2)}`).join('; '));
}

// Crown build: sub-crown flush with the doors, raised on a nailer, crown and a bed mould stacked on it
{
  const job = normalize(sampleProject());
  const w = job.cabinets.find((c) => c.name === 'W1')!;
  const crownNum = amCatalog.find((x) => x.category === 'Crown' && x.shape)!.num;
  const bed = amCatalog.find((x) => x.category === 'Crown' && x.shape && x.num !== crownNum)!.num;
  const built = { ...w, crown: crownNum, crownBuild: { subCrown: 3, rise: 1.5, drop: 0, extra: [bed] } };
  const ends = resolveEnds(job.room, job.cabinets, w);
  const parts = buildParts(built, job.settings, ends);
  const sub = parts.find((x) => x.name === 'Sub-crown')!;
  eq('sub-crown is face frame stock', sub.material, 'faceframe');
  eq('sub-crown face flush with doors', sub.boxes[0].min[2] + sub.boxes[0].size[2], w.depth + job.settings.doorThickness);
  eq('sub-crown top at the raised top', sub.boxes[0].min[1] + sub.boxes[0].size[1], w.height + 1.5);
  eq('nailer raises the build', parts.find((x) => x.name === 'Crown nailer')!.width, 1.5);
  const ms = cabinetMoldings(built, job.settings, ends).filter((m) => m.facing === 'front');
  eq('crown and bed mould both run', ms.length, 2);
  eq('crown on the sub-crown face', ms[0].z, w.depth + job.settings.doorThickness);
  eq('crown top at the top of the build', Math.abs(ms[0].y + mountShape(amCatalog.find((x) => x.num === crownNum)!).height - (w.height + 1.5)) < 1e-9, true);
  eq('bed mould right under the crown', Math.abs(ms[1].y + mountShape(amCatalog.find((x) => x.num === bed)!).height - ms[0].y) < 1e-9, true);
  const plain = cabinetMoldings({ ...w, crown: crownNum }, job.settings, ends).find((m) => m.facing === 'front')!;
  eq('no build: crown on the face frame, top at cabinet top', plain.z, w.depth);
}

// Library pilasters between base + bookcase bays
{
  const job = normalize(sampleProject());
  const P = (id: string) => presets.find((x) => x.id === id)!;
  const crownNum = amCatalog.find((x) => x.category === 'Crown' && x.shape)!.num;
  const baseNum = amCatalog.find((x) => x.category.startsWith('Base Board') && x.shape)!.num;
  const cabs: any[] = [];
  const pil = { ...cabinetFromPreset(P('pilaster'), 'back', 0, cabs), baseMold: baseNum, crown: crownNum };
  cabs.push(pil);
  const lb = { ...cabinetFromPreset(P('library-base'), 'back', 5.5, cabs) };
  cabs.push(lb);
  const up = { ...cabinetFromPreset(P('library-upper'), 'back', 5.5, cabs) };
  cabs.push(up);
  {
    const ue = resolveEnds(job.room, cabs, up);
    const up1 = buildParts(up, job.settings, ue);
    eq('bookcase upper: no bottom by default', up1.some((x) => x.name === 'Bottom'), false);
    eq('bookcase upper: back runs to the countertop', up1.find((x) => x.name === 'Back')!.length, up.height);
    eq('bookcase upper: no face frame bottom rail', up1.some((x) => x.name === 'Bottom rail'), false);
    eq('openings run to the bottom of the face frame', layoutRows(up, job.settings).rows.slice(-1)[0].y0, 0);
    eq('rail toggles back on', buildParts({ ...up, bottomRail: true }, job.settings, ue).some((x) => x.name === 'Bottom rail'), true);
    eq('bottom toggles back on', buildParts({ ...up, noBottom: false }, job.settings, ue).some((x) => x.name === 'Bottom'), true);
    const sf = buildParts({ ...up, shelfFront: { height: 1.75, thickness: 0.75 } }, job.settings, ue);
    const sh = sf.filter((x) => x.role === 'shelf'), fr = sf.filter((x) => x.name === 'Shelf front');
    eq('a solid front per shelf', [sh.length, fr.length].join(), '4,4');
    eq('shelf is shorter by the front', sh[0].width, up1.find((x) => x.role === 'shelf')!.width - 0.75);
    eq('front tops flush with the shelf', fr[0].boxes[0].min[1] + fr[0].boxes[0].size[1], sh[0].boxes[0].min[1] + sh[0].boxes[0].size[1]);
    eq('no banding behind a solid front', sh.every((x) => x.banded === false), true);
  }
  const lib = { ...job, cabinets: cabs };
  const ends = resolveEnds(lib.room, lib.cabinets, pil);
  const parts = buildParts(pil, lib.settings, ends);
  eq('pilaster: two panels split at the base top', parts.filter((x) => x.name === 'Pilaster panel').length, 2);
  eq('shop-built: stiles and three rails', [parts.filter((x) => x.name === 'Pilaster stile').length, parts.filter((x) => x.name.startsWith('Pilaster') && x.name.endsWith('rail')).length].join(), '2,3');
  eq('shop-built panels are 1/4" MDF', parts.filter((x) => x.name === 'Pilaster panel').every((x) => x.sheet === '1/4" MDF'), true);
  const op = parts.find((x) => x.name === 'Pilaster panel')!;
  eq('panel = opening + rabbet both sides, less 1/16', op.width, 5.5 - 3 + 0.75 - 0.0625);
  eq('frame is face frame stock', parts.find((x) => x.name === 'Pilaster stile')!.material, 'faceframe');
  eq('nothing goes to Eagle for a shop-built pilaster', eagleRequests(lib).length ? eagleRequests(lib)[0].lines.some((l) => l[1] === 'Panel') : false, false);
  eq('pilaster: plinth and capital', ['Plinth block', 'Capital block'].every((n) => parts.some((x) => x.name === n)), true);
  const eagleLib = { ...lib, cabinets: lib.cabinets.map((c) => (c.kind === 'pilaster' ? { ...c, pilaster: { ...c.pilaster!, face: 'eagle' as const } } : c)) };
  eq('Eagle face: panels go on the door request', eagleRequests(eagleLib)[0].lines.filter((l) => l[1] === 'Panel').length >= 1, true);
  const molded = { ...pil, pilaster: { ...pil.pilaster!, panelMold: amCatalog.find((x) => x.category === 'Panel')!.num } };
  eq('panel moulding ordered from A&M', moldingOrder({ ...lib, cabinets: [molded, lb, up] }).some((m) => m.kinds.includes('panel')), true);
  const ms = cabinetMoldings(pil, lib.settings, ends);
  const baseRet = ms.find((m) => m.facing === 'right' && m.num === baseNum)!;
  eq('base moulding returns to the base cabinet door face', baseRet.z, lb.depth + 0.75);
  const crownRet = ms.find((m) => m.facing === 'right' && m.num === crownNum)!;
  eq('crown returns to the bookcase face', crownRet.z, up.depth + 0.75);
  eq('left return runs to the wall (nothing beside it)', ms.find((m) => m.facing === 'left' && m.num === baseNum)!.z, 0);
  eq('neighbour beside a pilaster is not exposed', resolveEnds(lib.room, lib.cabinets, lb).left, false);
  eq('pilaster labor', priceQuote(lib).hours.some((h) => h.label.startsWith('Pilasters')), true);
  const poplar = { ...lib, cabinets: lib.cabinets.map((c: any) => (c.kind === 'pilaster' ? { ...c, pilaster: { ...c.pilaster, species: 'Poplar' } } : c)) };
  eq('poplar pilaster: its own species on the Solid wood list', otherSpecies(poplar).join(), 'Poplar');
  eq('poplar pieces leave the maple list', faceFramePieces(poplar).some((x) => x.name.startsWith('Pilaster')), false);
  eq('poplar pieces counted', faceFramePieces(poplar, 'Poplar').filter((x) => x.name === 'Pilaster stile').length, 2);
  eq('poplar priced in the quote', priceQuote({ ...poplar, speciesPrices: { Poplar: 4 } }).materials.some((m) => m.label.startsWith('Poplar') && m.cost > 0), true);
}

// Floating shelves: 3/4 ply top and bottom, mitered solid face, 1/2" bracket gap
{
  const job = normalize(sampleProject());
  const sh = { ...cabinetFromPreset(presets.find((x) => x.id === 'float-shelf')!, 'left', 40, job.cabinets) };
  const lib = { ...job, cabinets: [...job.cabinets, sh] };
  const ends = resolveEnds(lib.room, lib.cabinets, sh);
  const parts = buildParts(sh, lib.settings, ends);
  eq('2" shelf leaves 1/2" for the bracket', 2 - 2 * lib.settings.boxThickness, 0.5);
  eq('top and bottom plywood', parts.filter((x) => x.name === 'Shelf top' || x.name === 'Shelf bottom').length, 2);
  eq('paint grade plywood on the sheet list', parts.find((x) => x.name === 'Shelf top')!.sheet, '3/4" paint-grade plywood');
  eq('end caps on both exposed ends', parts.filter((x) => x.name === 'Shelf end cap').length, 2);
  eq('paint grade face from face frame stock', parts.find((x) => x.name === 'Shelf face')!.material, 'faceframe');
  const stain = buildParts({ ...sh, floating: { grade: 'stain', face: 0.75 } }, lib.settings, ends);
  eq('stain grade face in the wood species', stain.find((x) => x.name === 'Shelf face')!.material, 'solidWood');
  eq('stain grade plywood', stain.find((x) => x.name === 'Shelf top')!.sheet, '3/4" hard maple plywood');
  eq('36" shelf: 3 brackets at 16" studs', bracketCount(sh), 3);
  eq('72" shelf: 5 brackets', bracketCount({ ...sh, width: 72 }), 5);
  eq('brackets on the quote', priceQuote(lib).materials.some((m) => m.label === 'Floating shelf brackets'), true);
  eq('12" shelf takes the 10" bracket', [sh.depth, bracketLength(sh)].join(), '12,10');
  eq('9" shelf takes a 6" rod (no 7")', bracketLength({ ...sh, depth: 9 }), 6);
  const brk = priceQuote(lib).materials.find((m) => m.label === 'Floating shelf brackets')!;
  eq('3 brackets = one 8-pack at $16.16', brk.cost, 16.16);
  // Like the garage bar: one shelf floating free, one running into the side wall
  const free = { ...sh, wall: 'back' as const, offset: 30 };
  const toWall = { ...sh, id: 'sh-wall', name: 'S9', wall: 'back' as const, offset: job.room.width - 36 };
  const bar = { ...job, cabinets: [free, toWall] };
  eq('free shelf: two finished ends', finishedEnds(resolveEnds(bar.room, bar.cabinets, free)), 2);
  eq('shelf against the wall: one finished end', finishedEnds(resolveEnds(bar.room, bar.cabinets, toWall)), 1);
  const endHours = priceQuote(bar).hours.find((h) => h.label === 'Floating shelves: finished ends')!;
  eq('finished ends add labor: 3 ends', endHours.qty, 3);
  eq('floating shelf labor', priceQuote(lib).hours.some((h) => h.label.startsWith('Floating shelves')), true);
}

// Shop clock: job numbers and to-dos from the design
{
  const job = normalize(sampleProject());
  const r = priceQuote(job);
  const n = jobNumbers(job);
  eq('clock quote = quote total', n.quote, Math.round(r.total));
  eq('estimate split by task adds up', Math.abs(Object.values(n.estByPhase!).reduce((t, v) => t + v!, 0) - n.estHours) < 0.5, true);
  eq('install lines go to Install', phaseOf({ group: 'cabinets', label: 'Install cabinets', qty: 1, each: 1, hours: 1, install: true }), 'Install');
  eq('doors go to Doors & drawers', phaseOf({ group: 'cabinets', label: 'Doors (fit & hang)', qty: 1, each: 1, hours: 1 }), 'Doors & drawers');
  const todos = starterTodos(job);
  eq('to-dos: three Eagle requests', todos.filter((t) => t.startsWith('Eagle quote request')).length, 3);
  eq('to-dos: hardware and sheet goods', todos.some((t) => t.includes('Woodworker Express')) && todos.some((t) => t.startsWith('Buy sheet goods')), true);
  console.log('  todos:', todos.join(' | '));
}

// Room: openings, casing and trim that breaks at cabinets and doors
{
  const job = normalize(sampleProject());
  const base = amCatalog.find((x) => x.category.startsWith('Base Board') && x.shape)!.num;
  const crown = amCatalog.find((x) => x.category === 'Crown' && x.shape)!.num;
  const bb = amCatalog.find((x) => x.category === 'Back Band')!.num;
  const win = { ...newOpening('window', 'back', job), offset: 54, width: 24, height: 40, sill: 42, trim: { flat: 3.5, backBand: bb } };
  const door = { ...newOpening('door', 'right', job), offset: 60, width: 32, height: 80, trim: { flat: 3.5 } };
  const room = { ...job, openings: [win, door], roomTrim: { base, crown, chairHeight: 34, walls: ['back', 'left', 'right', 'front'] as any }, scope: { roomTrim: true } };
  const designOnly = { ...room, scope: {} };
  eq('room trim is design only by default: not ordered', moldingOrder(designOnly).length, 0);
  eq('room trim is design only by default: no flat casing stock', faceFramePieces(designOnly).filter((x) => x.cabinet === 'Room').length, 0);
  eq('room trim is design only by default: no quote group', priceQuote(designOnly).groups.some((g) => g.group === 'room'), false);
  eq('free runs skip blocked stretches', JSON.stringify(freeRuns(100, [[10, 20], [15, 30], [90, 100]])), JSON.stringify([[0, 10], [30, 90]]));
  eq('back wall base: only the 30" range gap', roomMoldings(room, 'back').filter((m) => m.kind === 'roomBase').map((m) => m.length).join(), '30');
  const rightBase = roomMoldings(room, 'right').filter((m) => m.kind === 'roomBase');
  eq('base on the right wall breaks at the door casing', rightBase.length, 2);
  eq('base stops at the casing', Math.abs(rightBase[0].x + rightBase[0].length - (60 - casingReach(door).side)) < 1e-6, true);
  eq('crown runs the open front wall full length', roomMoldings(room, 'front').filter((m) => m.kind === 'roomCrown').map((m) => m.length).join(), String(job.room.width));
  const t = openingTrim(win);
  eq('flat casing: two legs and a head', t.boxes.length, 3);
  eq('back band on both legs and the head', t.pieces.filter((x) => x.kind === 'backBand').length, 3);
  eq('flat casing goes on the stock list', faceFramePieces(room).filter((x) => x.cabinet === 'Room').length, 6);
  eq('room trim on the A&M order', moldingOrder(room).some((m) => m.kinds.includes('roomBase')), true);
  eq('room trim priced under its own group', priceQuote(room).groups.some((g) => g.group === 'room'), true);
  eq('window between the uppers over the sink is fine', openingIssues(room).length, 0);
  eq('wider window: its casing runs into the uppers', openingIssues({ ...room, openings: [{ ...win, offset: 50, width: 32 }] }).some((i) => i.message.includes('casing')), true);
  const blocked = { ...room, openings: [{ ...win, sill: 30 }] };
  eq('window low enough to hit the counter run flags it', openingIssues(blocked).length > 0, true);
  eq('cabinets block the wall where they sit', blockedAlong(room, 'back', 0, 4).length >= 5, true);
  eq('window position goes on the site check', fieldChecks(room).some((c) => c.id === `door:${win.id}:sill`), true);
}

// Brosco mouldings next to A&M; Reeb interior doors
{
  const job = normalize(sampleProject());
  eq('Brosco catalog loaded', broscoCatalog.length > 80, true);
  const bBase = broscoCatalog.find((x) => x.code === '8712')!;
  eq('Brosco 8712 is a 9/16 x 3 1/2 base', [bBase.category, bBase.t, bBase.w].join(), 'Base Board and Base Cap,0.5625,3.5');
  eq('traced Brosco outline snapped to size', Math.abs(Math.max(bBase.sw!, bBase.sh!) - 3.5) < 1e-6, true);
  const withB = { ...job, roomTrim: { base: bBase.num, chairHeight: 34, walls: ['front'] as any }, scope: { roomTrim: true } };
  const line = moldingOrder(withB).find((m) => m.num === bBase.num)!;
  eq('Brosco on its own order, unpriced', [line.supplier, line.price].join(), 'brosco,');
  const priced = moldingOrder({ ...withB, moldPrices: { [bBase.num]: 1.85 } }).find((m) => m.num === bBase.num)!;
  eq('job price for Brosco used', Math.abs(priced.cost - 1.85 * priced.feet) < 1e-9, true);
  eq('door trade size', tradeSize(32) + ' ' + tradeSize(80), '2/8 6/8');
  eq('32 1/4 x 80 1/8 opening takes a stock 2/8 x 6/8', JSON.stringify(stockSlab(32.25, 80.125)), JSON.stringify({ w: 32, h: 80, fits: true }));
  eq('odd opening flagged', stockSlab(34.5, 80.125).fits, false);
  const door = { ...newOpening('door', 'right', job), offset: 60, width: 32.25, height: 80.125, trim: { flat: 3.5 }, door: { design: 'PR8730', hinge: 'left' as const, leaves: 1 as const, prehung: true } };
  const room = { ...job, openings: [door], scope: { doors: true } };
  eq('doors are design only by default', doorOrder({ ...room, scope: {} }).length + priceQuote({ ...room, scope: {} }).hours.filter((h) => h.label.includes('door')).length, 0);
  const dl = doorOrder(room);
  eq('door order key', dl.map((l) => l.key).join(), 'PR8730 2/8x6/8 prehung');
  eq('PR8730 2/8 x 6/8 prehung at Reeb catalog price', [dl[0].price, dl[0].priceFrom].join(), '375,catalog');
  eq('dealer adjustment applies to catalog prices', doorOrder({ ...room, doorAdjust: -0.1 })[0].price, 337.5);
  eq('job price overrides the catalog', doorOrder({ ...room, doorPrices: { 'PR8730 2/8x6/8 prehung': 310 } })[0].price, 310);
  const pair = { ...room, openings: [{ ...door, width: 60.375, door: { ...door.door, leaves: 2 as const } }] };
  eq('pairs need a price entered', priceQuote(pair).materials.some((m) => m.label === 'Reeb interior doors' && !!m.missing), true);
  const sheet = proportionsFor(designByCode('PR8730')!, 80);
  eq('PR8730 from Reeb cut sheet: 4-7/16 stile, 4-5/16 top, 9-3/16 bottom', [sheet.fromSheet, sheet.stile, sheet.top, sheet.bottom].join(), 'true,4.4375,4.3125,9.1875');
  eq('door install labor', priceQuote(room).hours.some((h) => h.label === 'Install interior doors'), true);
  const dr = doorDrawing(designByCode('PR66')!, 32, 80);
  eq('6 panel door: raised fields drawn', dr.boxes.filter((b) => b.shade === 1).length, 6);
  const lock = doorDrawing(designByCode('PR82R')!, 32, 80).boxes.find((b) => b.size[1] === 7.75);
  eq('lock rail near 36"', !!lock && Math.abs(lock.min[1] + 3.875 - 36) < 12, true);
}

{
  // Floor cabinet bases: toe kick, baseboard wrap, decorative skirt
  const bc = cabinetFromPreset(presets.find((x) => x.id === 'base-door')!, 'back', 0, []);
  const both = { left: true, right: true };
  const k = buildParts(bc, defaultSettings, both);
  const kRows = layoutRows(bc, defaultSettings).rows;
  const bbCab = { ...bc, base: { style: 'baseboard' as const, height: 4.5, build: 'faceframe' as const, shape: 'bracket' as const, rise: 3, foot: 2.25 } };
  const bb = buildParts(bbCab, defaultSettings, both);
  const bbRows = layoutRows(bbCab, defaultSettings).rows;
  eq('baseboard: opening starts at board + 1-1/2" rail', bbRows[bbRows.length - 1].y0, 4.5 + 1.5);
  eq('baseboard: cabinet height unchanged, opening shorter', [Math.max(...bb.flatMap((x) => x.boxes.map((b) => b.min[1] + b.size[1]))) >= bc.height, bbRows[0].height < kRows[0].height].join(), 'true,true');
  eq('baseboard: no toe kick', bb.some((x) => x.role === 'toekick'), false);
  eq('baseboard: front and two returns', bb.filter((x) => x.name.startsWith('Baseboard')).length, 3);
  eq('baseboard: stiles run to the floor', bb.find((x) => x.name === 'Stile')!.length, bc.height);
  const capped = { ...bbCab, baseMold: amCatalog.find((x) => x.category === 'Base Board and Base Cap')!.num };
  const capH = mountShape(amCatalog.find((x) => x.num === capped.baseMold)!).height;
  eq('cap moulding sits on the board, rail above it', layoutRows(capped, defaultSettings).rows.slice(-1)[0].y0, 4.5 + capH + 1.5);
  eq('cap on top of the board', cabinetMoldings(capped, defaultSettings, both).find((m) => m.kind === 'baseMold')!.y, 4.5);
  const ff = { ...bbCab, base: { ...bbCab.base, style: 'arch' as const } };
  const fp = buildParts(ff, defaultSettings, both);
  const rail = fp.find((x) => x.name === 'Bottom rail')!;
  const ol = rail.shapes![0].outline;
  eq('shaped rail: wide, with the cutout', [rail.width, ol.length > 10, Math.min(...ol.map((q) => q[1]))].join(), '6,true,0');
  eq('shaped rail: center cut to the full rise', Math.max(...ol.map((q) => q[1]).filter((v) => v < rail.width)), 3);
  eq('shaped base: recessed kick behind the cutout', fp.find((x) => x.name === 'Toe kick skin')!.width, 3);
  eq('shaped base: bare ends cut to match', fp.filter((x) => x.role === 'side' && (x.note ?? '').includes('bracket feet')).length, 2);
  const ap = buildParts({ ...ff, base: { ...ff.base, build: 'applied' as const } }, defaultSettings, both);
  eq('applied skirt: front and returns', ap.filter((x) => x.name.startsWith('Skirt')).length, 3);
  eq('applied skirt: 1-1/2" of rail shows above', ap.find((x) => x.name === 'Bottom rail')!.boxes[0].min[1] + ap.find((x) => x.name === 'Bottom rail')!.width, 4.5 + 1.5);
  eq('wall cabinets ignore it', layoutRows({ ...bbCab, kind: 'wall' as const, elevation: 54 }, defaultSettings).rows.slice(-1)[0].y0, defaultSettings.bottomRailWidth);
  eq('quote says so', scopeLine(ff, { ...p, cabinets: [ff] }).includes('bracket feet cut into the face frame'), true);
}

{
  // Room from photos: tidy Claude's draft and apply it
  const d = cleanDraft({ room: { width: '158', depth: 140, height: 96 }, measured: { width: true }, openings: [
    { kind: 'window', wall: 'right', offset: 18, width: 34, height: 60, sill: 30, measured: true },
    { kind: 'door', wall: 'front', offset: 500, width: 32, height: 80, sill: 12 },
    { kind: 'skylight', wall: 'ceiling', width: 'x' },
  ], trim: { crown: 4.25, base: 5.5, chairRail: null, casing: { style: 'flat', width: 3.5, backBand: true } }, floor: 'hardwood', wallColor: '#C9BFAE', notes: ['Measure the left wall'] });
  eq('draft: numbers parsed and clamped', [d.room.width, d.openings.length, d.openings[1].offset, d.openings[1].sill].join(), `158,3,${158 - 32},0`);
  eq('draft: unknown kinds and walls fall back', [d.openings[2].kind, d.openings[2].wall].join(), 'window,back');
  eq('draft: measured flags', [d.measured.width, d.measured.depth, d.openings[0].measured, d.openings[1].measured].join(), 'true,false,true,false');
  const base = closestProfile('roomBase', 5.5)!;
  eq('closest baseboard is near 5-1/2"', Math.abs(mountShape(base).height - 5.5) < 1, true);
  const applied = applyDraft(p, d, true);
  eq('applied: room, openings, trim, wall color', [applied.room.width, applied.openings!.length, !!applied.roomTrim!.base, !!applied.roomTrim!.crown, applied.roomTrim!.chairRail ?? 'none', applied.finishes.wall].join(), '158,3,true,true,none,#c9bfae');
  eq('applied: flat casing with back band', [applied.openings![0].trim.flat, !!applied.openings![0].trim.backBand, applied.openings![0].trim.casing ?? 'flat'].join(), '3.5,true,flat');
  eq('applied: door gets a swing', applied.openings![1].door?.hinge, 'left');
  eq('cabinets stay', applied.cabinets.length, p.cabinets.length);
  eq('request names the photos and measurements', draftRequest('Back wall 158"', ['back', 'right']).includes('2 "right"') && draftRequest('Back wall 158"', ['a']).includes('Back wall 158"'), true);
  eq('garbage in, sensible room out', [cleanDraft(null).room.height, cleanDraft('x').openings.length].join(), '96,0');
}

{
  // Casings and baseboards drawn lying down are stood up: the face is the wide side
  const casing = amCatalog.find((x) => x.num === '2001')!;
  const ms = mountShape(casing);
  eq('casing 2001 projects its thickness, face is its width', [ms.depth, ms.height].join(), [casing.sh, casing.sw].join());
  const lying = [...amCatalog, ...broscoCatalog].filter((x) => x.category === 'Window and Door Casing' && x.shape && x.sw && x.sh);
  eq('every casing projects less than it is wide', lying.every((x) => mountShape(x).depth < mountShape(x).height), true);
  const crown = amCatalog.find((x) => x.category === 'Crown' && x.shape && x.sw && x.sh)!;
  eq('crowns are left as drawn', mountShape(crown).depth, crown.sw);
}

{
  // Clients and their Dropbox folders
  const c = { first: 'Melissa', last: 'Pope', location: 'West Boylston' } as any;
  eq('folder name: Last, First - Location', folderName(c), 'Pope, Melissa - West Boylston');
  eq('no slashes in folder names', folderName({ ...c, location: 'Sterling/Leominster' }), 'Pope, Melissa - SterlingLeominster');
  eq('old folders are just a last name', JSON.stringify(parseFolderName('Lavin')), JSON.stringify({ last: 'Lavin', first: '', location: '' }));
  eq('new folders read back', parseFolderName('Pope, Melissa - West Boylston').location, 'West Boylston');
  eq('stage from folder name, any case', stageByFolder('not sold')?.id, 'notsold');
  const cp = { ...p, client: { ...c, phone: '(508) 555-0100', scope: 'Library wall', measurements: [{ id: 'm', what: 'Back wall', size: '158"', note: '' }] } };
  eq('client info sheet has contact, scope and measurements', ['Melissa Pope', '(508) 555-0100', 'Library wall', '| Back wall | 158" |'].every((t) => clientInfoDoc(cp).includes(t)), true);
  const qd = quoteDoc(cp);
  eq('quote has scope, agreement and total', ['PROJECT SCOPE OF WORK', 'PURCHASE AGREEMENT', 'Total Project Investment', 'HIC License #207489'].every((t) => qd.includes(t)), true);
  eq('orders doc lists Eagle requests', ordersDoc(cp).includes('Eagle'), true);
}

{
  // LiDAR scans: a 150" x 120" room, turned 30 degrees and moved, as RoomPlan might report it
  const a = Math.PI / 6, at = ([x, z]: number[]) => [x * Math.cos(a) - z * Math.sin(a) + 40, x * Math.sin(a) + z * Math.cos(a) - 25];
  const wall = (id: string, s: number[], e: number[]) => ({ id, start: at(s), end: at(e), length: Math.hypot(e[0] - s[0], e[1] - s[1]), height: 97 });
  const open = (id: string, kind: string, w: string, c: number[], width: number, height: number, sill: number) => { const p2 = at([c[0], c[1]]); return { id, kind, wall: w, center: [p2[0], sill + height / 2, p2[1]], width, height, sill }; };
  const scan = readScan(JSON.stringify({ app: 'CJC Room Scan', version: 1, name: 'Test', scannedAt: '2026-10-23T12:00:00Z', units: 'inches', ceilingHeight: 97,
    walls: [wall('N', [0, 0], [150, 0]), wall('E', [150, 0], [150, 120]), wall('S', [150, 120], [0, 120]), wall('W', [0, 120], [0, 0])],
    openings: [open('w1', 'window', 'N', [58, 0], 36, 54, 30), open('d1', 'door', 'E', [150, 36], 32, 80, 0), open('w2', 'window', undefined as any, [0, 85], 30, 48, 34)] }));
  const d = scanToDraft(scan, 'N');
  eq('scan: room size from the walls', [Math.round(d.room.width), Math.round(d.room.depth), d.room.height].join(), '150,120,97');
  const byName = (k: string) => d.openings.find((o) => o.kind === k && o.name.endsWith('1'))!;
  eq('scan: window on the back wall, 40" from its left end', [byName('window').wall, Math.round(byName('window').offset), byName('window').sill].join(), 'back,40,30');
  eq('scan: door on the right wall, 20" from the back corner', [byName('door').wall, Math.round(byName('door').offset)].join(), 'right,20');
  const w2 = d.openings.find((o) => o.name === 'Window 2')!;
  eq('scan: window with no wall id goes to the nearest (left), measured from the front corner', [w2.wall, Math.round(w2.offset)].join(), 'left,20');
  const d2 = scanToDraft(scan, 'E');
  eq('scan: another back wall turns the room', [Math.round(d2.room.width), Math.round(d2.room.depth), d2.openings.find((o) => o.kind === 'door')!.wall].join(), '120,150,back');
  eq('scan: everything marked measured', d.openings.every((o) => o.measured) && d.measured.width, true);
  let bad = ''; try { readScan('{"app":"Polycam"}'); } catch (e) { bad = (e as Error).message; }
  eq('only CJC Room Scan files', bad.includes('CJC Room Scan'), true);
}

{
  // Drawing sets from the sample kitchen
  const d = drawingsOf(p);
  const cust = customerSet(p, d);
  const walls = new Set(p.cabinets.map((c) => c.wall)).size;
  eq('customer set: cover, plan, an elevation per wall with cabinets', cust.length, 2 + walls);
  eq('elevation dimensions the wall', cust[2].svg.includes(`${p.room.width}"`), true);
  const shop = shopSet(p, d);
  eq('shop set: a sheet per wall and per cabinet', shop.length, walls + p.cabinets.length);
  eq('cabinet sheet lists its parts', shop[walls].svg.includes('Bottom') && shop[walls].svg.includes('FACE FRAME'), true);
  const doc = setDocument('Test', cust, 'letter');
  eq('printable document, letter pages', doc.includes('size:11in 8.5in') && (doc.match(/class="page"/g) ?? []).length === cust.length, true);
  eq('sheets are true size', cust[1].svg.includes('width="17in"'), true);
}

{
  // Notes and assumed hardware on the drawings
  const c0 = { ...p.cabinets[0], notes: [{ id: 'n1', text: 'Outlet in the back', for: 'shop' as const }, { id: 'n2', text: 'Glass doors', for: 'customer' as const }] };
  const notes = cabinetCallouts(p, c0);
  eq('own notes go to their audience', [forAudience(notes, 'shop').some((n) => n.text === 'Outlet in the back'), forAudience(notes, 'customer').some((n) => n.text === 'Outlet in the back'), forAudience(notes, 'customer').some((n) => n.text === 'Glass doors')].join(), 'true,false,true');
  const panelCab = { ...p.cabinets[0], leftPanel: 'flush' as const };
  const pp = { ...p, cabinets: [panelCab, ...p.cabinets.slice(1)] };
  eq('end panels are called out when exposed', cabinetCallouts(pp, panelCab).some((n) => n.text.startsWith('Finished end panel')) || !resolveEnds(pp.room, pp.cabinets, panelCab).left, true);
  const two = p.cabinets.find((c) => c.rows.some((r) => r.type === 'doors' && r.doors === 2))!;
  const hw = hardwareItems(p, two, partsOf(p, two));
  const doorsN = partsOf(p, two).filter((x) => x.role === 'door').length;
  eq('a knob on every door', hw.filter((h) => h.circle).length >= doorsN, true);
}

{
  // Coffered ceiling: a 180" x 156" room, 3 x 3 coffers, 5-1/2" beams, 4" perimeter
  const room = { ...p, room: { width: 180, depth: 156, height: 96 }, ceiling: { on: true, across: 3, deep: 3, crown: amCatalog.find((x) => x.category === 'Crown')!.num } };
  const L = cofferLayout(room);
  const cx = (180 - 8 - 2 * 5.5) / 3;
  eq('even coffers to the 1/16, the middle one takes what\'s left, and they fill the field', [L.xs.length, L.xs[0].b - L.xs[0].a, +(L.xs[1].b - L.xs[1].a).toFixed(4), L.xs[0].a, +(L.xs[2].b).toFixed(4)].join(), `3,${Math.floor(cx * 16) / 16},${+(180 - 8 - 11 - 2 * Math.floor(cx * 16) / 16).toFixed(4)},4,176`);
  const big = cofferLayout({ ...room, ceiling: { ...room.ceiling, layout: 'bigCenter', outer: 30 } });
  eq('smaller perimeter coffers make the middle one bigger', [big.xs[0].b - big.xs[0].a, +(big.xs[1].b - big.xs[1].a).toFixed(4)].join(), `30,${+(180 - 8 - 11 - 60).toFixed(4)}`);
  const parts = cofferParts(room);
  const soffit = parts.find((x) => x.name === 'Through beam soffit')!;
  eq('soffit: beam less fascias plus both tongues', soffit.width, 5.5 - 1.5 + 0.5);
  eq('soffit sits a reveal above the fascia bottom', soffit.boxes[0].min[1], 96 - 5.5 + 0.25);
  eq('nailer ripped to fit between the fascias, 2x thick', [parts.find((x) => x.name === 'Through beam nailer (2x)')!.width, parts.find((x) => x.name === 'Through beam nailer (2x)')!.thickness].join(), '4,1.5');
  eq('2 through beams, 2 cross beams in 3 pieces each, 4 perimeter runs', [parts.filter((x) => x.name === 'Through beam soffit').length, parts.filter((x) => x.name === 'Cross beam soffit').length, parts.filter((x) => x.name.startsWith('Perimeter') && x.name.endsWith('soffit')).length].join(), '2,6,4');
  const m = cofferMoldings(room);
  eq('crown goes all the way around each of 9 coffers', [m.count, Math.round(m.crown)].join(), `9,${Math.round(cofferList(room).reduce((t, k) => t + 2 * (k.x1 - k.x0 + k.z1 - k.z0), 0))}`);
  eq('coffer crown and stock in the quote', ['Coffered ceiling'].every((g) => priceQuote(room).groups.some((x) => x.group === 'ceiling')) && priceQuote(room).materials.some((x) => x.label.startsWith('Prepped beam')), true);
  eq('beam feet for labor', Math.round(cofferFeet(room).beams), Math.round((2 * 172 + 6 * (156 - 8 - 11) / 3) / 12));
  eq('off by default', cofferParts(p).length, 0);
  // Bookcases 12" deep to within a foot of the beams: the perimeter goes proud of them by the fascia
  const bc = { ...room, cabinets: [{ ...p.cabinets[0], id: 'bk', name: 'U9', wall: 'left' as const, elevation: 0, height: 84, depth: 12 }] };
  eq('fascia proud of the bookcases by its thickness', cabinetLine(bc, 'left'), 12.75);
  const lined = { ...bc, ceiling: { ...bc.ceiling, walls: { left: 12.75 } } };
  const ls = cofferParts(lined).filter((x) => x.name === 'Perimeter, left soffit');
  const run = 156 - 4 - 4 + 2 * 0.75;
  eq('no perimeter soffit over the bookcase; the rest of the wall keeps it', +ls.reduce((t, x) => t + x.length, 0).toFixed(3), +(run - ((156 - 4 + 0.75) - (156 - lined.cabinets[0].width))).toFixed(3)); // the bookcase sits in the front corner, partly past the run's end
  eq('fascia still runs the full wall over the bookcase', cofferParts(lined).filter((x) => x.name === 'Perimeter, left fascia').length, 1);
  eq('bookcase short of the fascia gets its top rail extended', fasciaBacking(lined, lined.cabinets[0])!.short, 96 - 5.5 - 84);
  // Pope library from Chief: 167 1/4 x 188 1/2, 3 x 3 coffers; the worksheet has 74 hours for the ceiling
  const pope = { ...p, cabinets: [], room: { width: 167.25, depth: 188.5, height: 109.125 }, ceiling: { on: true, across: 3, deep: 3, crown: amCatalog.find((x) => x.category === 'Crown')!.num } };
  const ch = estimateHours(pope, quoteOf(pope)).filter((x) => x.group === 'ceiling').reduce((t, x) => t + x.hours, 0);
  eq('Pope ceiling labor within 2 hours of the worksheet', Math.abs(ch - 74) <= 2, true);
  // A&M #9554 corner bead: the soffit hangs 3/4" below the fascias, fits between them, on blocking
  const beaded = { ...room, ceiling: { ...room.ceiling, bead: '9554', joint: 'bead' as const } };
  const bp = cofferParts(beaded);
  const bs = bp.find((x) => x.name === 'Through beam soffit')!, bf = bp.find((x) => x.name === 'Through beam fascia')!;
  eq('beaded soffit fits between the fascias', bs.width, 5.5 - 1.5);
  eq('beaded soffit bottom 3/4" below the fascia bottom', +(bf.boxes[0].min[1] - bs.boxes[0].min[1]).toFixed(4), 0.75);
  eq('beaded fascia is the drop less the bead corner, no dado', [bf.width, bf.note!.startsWith('No dado')].join(), '4.75,true');
  eq('blocking inside beaded beams, about 16" apart', bp.filter((x) => x.name === 'Through beam blocking (2x)').length, 2 * (Math.ceil(172 / 16) + 1));
  // Library: bookcases on the left wall bring that perimeter out to 16"; the right wall matches
  const lib = { ...room, ceiling: { ...room.ceiling, walls: { left: 16, right: 16 } } };
  const LL = cofferLayout(lib);
  eq('per-wall perimeter moves the field', [LL.field.x0, LL.field.x1, LL.field.z0].join(), '16,164,4');
  const lp = cofferParts(lib);
  eq('left perimeter nailer and soffit fill to the fascia', [lp.find((x) => x.name === 'Perimeter, left nailer (2x)')!.width, lp.find((x) => x.name === 'Perimeter, left fascia')!.boxes[0].min[0]].join(), '15.25,15.25');
  eq('back soffit runs wall to wall', lp.find((x) => x.name === 'Perimeter, back soffit')!.length, 180);
  eq('crown over half the fascia is flagged', cofferLayout({ ...room, ceiling: { ...room.ceiling, crown: amCatalog.filter((x) => x.category === 'Crown').sort((a, b) => b.w - a.w)[0].num } }).warnings.some((w) => w.includes('more than half')), true);
}

{
  // Individual stiles and rails: a 4" left stile, a 3" rail above the second row
  const two = { ...b, stileLeftWidth: 4, rows: b.rows.length > 1 ? b.rows.map((r, i) => (i === 1 ? { ...r, railAbove: 3 } : r)) : b.rows };
  const pp = buildParts(two, s);
  const stiles = pp.filter((x) => x.role === 'stile' && x.name.startsWith('Stile')).map((x) => x.width);
  eq('left stile its own width, right stays standard', stiles.join(), [4, s.stileWidth].join());
  eq('top rail shortened by the wider stile', pp.find((x) => x.name === 'Top rail')!.length, buildParts(b, s).find((x) => x.name === 'Top rail')!.length - (4 - s.stileWidth));
  if (b.rows.length > 1) {
    eq('rail above row 2 is 3"', pp.find((x) => x.name === 'Mid rail')!.width, 3);
    const L0 = layoutRows(b, s).rows, L1 = layoutRows(two, s).rows;
    eq('openings give up the extra rail width', +(L0.reduce((t, r) => t + r.height, 0) - L1.reduce((t, r) => t + r.height, 0)).toFixed(4), 3 - s.midRailWidth);
  }
}

{
  // Appliances: a microwave on its own shelf in a tall bank, a fireplace insert in a library base
  const tm = cabinetFromPreset(presets.find((x) => x.id === 'tall-micro')!, 'back', 0, []);
  const ap = placedAppliances(tm, s);
  eq('microwave placed in its row, no fit problems', [ap.length, ap[0].problems.length, ap[0].a.kind].join(), '1,0,microwave');
  const tp = buildParts(tm, s);
  eq('fixed shelf under the microwave, top flush with its opening', [tp.filter((x) => x.name === 'Fixed shelf').length, +(tp.find((x) => x.name === 'Fixed shelf')!.boxes[0].min[1] + s.boxActualThickness).toFixed(4)].join(), `1,${+ap[0].opening.y0.toFixed(4)}`);
  eq('no doors or shelves in the appliance opening', tp.filter((x) => (x.role === 'door' || x.name === 'Adjustable shelf') && x.boxes.some((b) => b.min[1] >= ap[0].opening.y0 - 0.01 && b.min[1] < ap[0].opening.y1 - 1)).length, 0);
  eq('microwave sits back an inch on the shelf', +(ap[0].min[2] + ap[0].size[2]).toFixed(4), tm.depth - 1);
  const fp = cabinetFromPreset(presets.find((x) => x.id === 'library-fireplace')!, 'back', 0, []);
  eq('fireplace fits its base', placedAppliances(fp, s)[0].problems.join(), '');
  const shallow = { ...fp, depth: 12 };
  eq('too-shallow cabinet flagged', placedAppliances(shallow, s)[0].problems.some((x) => x.includes('deep')), true);
}

{
  // Mantels: electric with pilasters and corbels; wood-burning clearances
  const me = cabinetFromPreset(presets.find((x) => x.id === 'mantel-electric')!, 'back', 40, []);
  const mp = buildParts(me, s);
  eq('mantel legs 8" each around the 36 5/8 opening', legWidth(me), 8);
  eq('mantel parts: 2 leg faces, 4 returns, frieze, shelf, 2 corbels', [mp.filter((x) => x.name === 'Leg face').length, mp.filter((x) => x.name === 'Leg return').length, mp.filter((x) => x.name === 'Frieze').length, mp.filter((x) => x.name === 'Mantel shelf').length, mp.filter((x) => x.name === 'Corbel').length].join(), '2,4,1,1,2');
  eq('shelf runs past the legs both ends', mp.find((x) => x.name === 'Mantel shelf')!.length, 52.625 + 4);
  eq('raised insert gets a lower panel', mp.some((x) => x.name === 'Lower panel'), true);
  eq('insert placed in the opening', placedAppliances(me, s)[0].min[1], 12);
  eq('mantel has no cabinet supplies or end panels', buildParts(me, s).some((x) => x.role === 'endPanel'), false);
  const mw = cabinetFromPreset(presets.find((x) => x.id === 'mantel-wood')!, 'back', 40, []);
  eq('wood-burning preset passes the clearance check', mantelClearances(mw).join(' | '), '');
  eq('surround 4" from a wood-burning opening is flagged', mantelClearances({ ...mw, mantel: { ...mw.mantel, margin: 4 } }).some((w) => w.includes('6"')), true);
  eq('a deep shelf low over a wood-burning opening is flagged', mantelClearances({ ...mw, height: 38, mantel: { ...mw.mantel, shelfDepth: 12 } }).some((w) => w.includes('shelf')), true);
  eq('small opening needs a 16" x 8" hearth extension', mantelClearances({ ...mw, mantel: { ...mw.mantel, openingW: 30, openingH: 24, hearthFront: 14, hearthSide: 8 } }).some((w) => w.includes('16"')), true);
  eq('6 sq ft opening needs 20" x 12"', mantelClearances({ ...mw, mantel: { ...mw.mantel, hearthFront: 16, hearthSide: 8 } }).filter((w) => w.includes('R1001.10')).length, 2);
  eq('masonry wood mantel gets a stone hearth by others', buildParts(mw, s).some((x) => x.name === 'Hearth extension' && !x.cut), true);
  const chart = { ...me, mantel: { ...me.mantel, manual: { sideGap: 0, rows: [{ above: 12, maxDepth: 2 }, { above: 18, maxDepth: 6 }] } } };
  eq('gas/electric mantel checked against the manual chart', mantelClearances(chart).some((w) => w.includes("manual's chart")), true);
  eq('a shelf high enough passes the chart', mantelClearances({ ...chart, height: 70 }).filter((w) => w.includes('shelf')).length, 0);
  eq('mantel in the quote scope', scopeLine(me, { ...p, cabinets: [me] }).includes('Fireplace mantel'), true);
}

{
  // Chief plan import: the Pope library's DWG export (LibreDWG's entities, saved as a fixture)
  const fx = JSON.parse(readFileSync('scripts/fixtures/pope-plan.dwg.json', 'utf8'));
  const plan = readPlan(fromDwgDatabase(fx))!;
  eq('room inside the walls 157 1/4 x 180 1/2', [+(plan.rect.R - plan.rect.L).toFixed(3), +(plan.rect.T - plan.rect.B).toFixed(3)].join(), '157.25,180.5');
  eq('bookcase wall picked as the back wall', defaultBack(plan), 'top');
  const res = planToProject(plan, defaultBack(plan), 104.25);
  const doors = res.openings.filter((o) => o.kind === 'door').sort((a, b) => a.offset - b.offset);
  eq('two doors on the front wall at 6 1/4 and 115 3/4, 33 1/2 wide', doors.map((d) => `${d.wall}@${d.offset}/${d.width}/${d.door!.hinge}`).join(), 'front@6.25/33.5/left,front@115.75/33.5/right');
  const wins = res.openings.filter((o) => o.kind === 'window').sort((a, b) => a.offset - b.offset);
  eq('two 32" windows on the right wall', wins.map((w) => `${w.wall}@${w.offset.toFixed(3)}/${w.width}`).join(), 'right@38.109/32,right@122.316/32');
  const tall = res.cabinets.filter((c) => c.kind === 'tall');
  eq('four 31 3/4 x 12 full-height cabinets, 99" from the Chief label', tall.map((c) => `${c.width}x${c.depth}x${c.height}`).join(), Array(4).fill('31.75x12x99').join());
  eq('five pilasters in the gaps, 3/4" proud', res.cabinets.filter((c) => c.kind === 'pilaster').map((c) => `${c.offset.toFixed(2)}:${c.width.toFixed(2)}:${c.pilaster!.proud}`).join(), '0.00:6.06:0.75,37.81:6.00:0.75,75.56:6.06:0.75,113.38:6.06:0.75,151.19:6.06:0.75');
  // DXF reader: a block insert, an MTEXT with Chief's font codes, units in mm
  const dxf = ['0','SECTION','2','HEADER','9','$INSUNITS','70','4','0','ENDSEC','0','SECTION','2','BLOCKS','0','BLOCK','2','BOX','10','0','20','0','0','LINE','8','0','10','0','20','0','11','254','21','0','0','ENDBLK','0','ENDSEC','0','SECTION','2','ENTITIES','0','INSERT','8','Walls','2','BOX','10','100','20','50','50','90','0','MTEXT','8','Cabinets, Labels','10','1','20','2','1','\\fChief Blueprint|b0;B24\\P','0','ENDSEC','0','EOF'].join('\n');
  const d = parseDxf(dxf);
  const ln = d.ents.find((e) => e.kind === 'line') as { a: [number, number]; b: [number, number]; layer: string };
  eq('DXF: mm units, block insert rotated onto its layer', [d.scale.toFixed(4), ln.layer, ln.b.map((v) => Math.round(v)).join('/')].join(), `${(1 / 25.4).toFixed(4)},Walls,100/304`);
  eq('DXF: Chief font codes stripped from labels', (d.ents.find((e) => e.kind === 'text') as { text: string }).text, 'B24');
}

// Client portal: the 3-day cancel window skips Sundays and Massachusetts holidays
eq('cancel: Saturday signing runs to Wednesday', cancelDeadline('2026-10-24'), '2026-10-28');
eq('cancel: Friday before Patriots’ Day skips Sunday and the holiday', cancelDeadline('2027-04-16'), '2027-04-21');
eq('cancel: July 4 on a Sunday is observed Monday', holidays(2027).includes('2027-07-05'), true);
eq('portal: documents expiring within 45 days', expiring([
  { id: 'a', title: 'COI', kind: 'insurance', mimeType: 'application/pdf', size: 1, expires: '2027-02-26', uploadedAt: 0 },
  { id: 'b', title: 'HIC', kind: 'license', mimeType: 'application/pdf', size: 1, expires: '2027-06-01', uploadedAt: 0 },
], 45, Date.parse('2027-02-01T12:00:00')).map((d) => `${d.title}:${d.daysLeft}`).join(), 'COI:26');
eq('portal: online agreement has no paper signature lines', [quoteDoc(p).includes('class="sign"'), quoteDoc(p, { online: true }).includes('class="sign"')].join(), 'true,false');

// Furniture: a dining table prices into its own Furniture line
{
  const t = { ...newTable(), species: 'Walnut', pricePerBF: 16, leaves: 2, base: 'double-pedestal' as const, length: 72, width: 44 };
  eq('table: seats 8, 10 with two 18" leaves', `${seats(t)}/${seats(t, true)}`, '8/10');
  eq('table: scope wording', tableScope(t).includes('(2) 18" extension leaves; seats 8–10'), true);
  const tp = { ...p, cabinets: [], furniture: [t] };
  const r = priceQuote(tp);
  eq('table: priced as Furniture', r.groups.map((g) => g.group).join(), 'furniture');
  eq('table: lumber from its own $/BF', Math.round(tableEstimate(t, tp).materials[0].cost), Math.round(tableEstimate(t, tp).bf * 16));
}

eq('sample has no layout issues', findIssues(p.room, p.cabinets, s).map((i) => i.message).join('; '), '');

console.log(failed ? `${failed} check(s) failed` : 'All model checks passed');
process.exit(failed ? 1 : 0);
