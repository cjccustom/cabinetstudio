// Sanity checks on the cabinet model: run with `npm test`.
import { buildParts, layoutRows, panelExtents, realOverhang } from "../src/model/parts";
import { sampleProject, defaultSettings, presets, cabinetFromPreset } from "../src/model/defaults";
import { findIssues, gapBeside, nextFreeOffset, resolveEnds } from "../src/model/layout";
import { fmt, parseLength } from "../src/units";
import { drawerBoxSize, eaglePrice, hingeHoles } from "../src/model/eagle";
import { optimize } from "../src/model/optimizer";
import { defaultFaceFrameStock, faceFrameNeeds, faceFramePieces, roughQuarters, woodPieces } from "../src/model/faceframe";
import { panelAbove, panelOrder } from "../src/model/panels";
import { amCatalog } from "../src/model/andersonMcquaid";
import { cabinetMoldings, moldingOrder, mountShape } from "../src/model/moldings";
import { priceQuote, scopeLine } from "../src/model/quote";
import { optimizerParts } from "../src/model/cutlist";
import { normalize } from "../src/store";
import { fieldChecks, releaseStatus } from "../src/model/release";
import { eagleFraction, eagleRequests, requestText } from "../src/model/eagleRequest";
import { hardwareOrder, tierPrice } from "../src/model/hardware";
import { defaultSupplies, supplyDrivers, supplyLines } from "../src/model/supplies";
import { jobNumbers, phaseOf, starterTodos } from "../src/shop/fromDesign";
import { broscoCatalog } from "../src/model/brosco";
import { designByCode, doorDrawing, proportionsFor, stockSlab, tradeSize } from "../src/model/reeb";
import { doorOrder } from "../src/model/doorOrder";
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
  const room = { ...job, openings: [win, door], roomTrim: { base, crown, chairHeight: 34, walls: ['back', 'left', 'right', 'front'] as any } };
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
  const withB = { ...job, roomTrim: { base: bBase.num, chairHeight: 34, walls: ['front'] as any } };
  const line = moldingOrder(withB).find((m) => m.num === bBase.num)!;
  eq('Brosco on its own order, unpriced', [line.supplier, line.price].join(), 'brosco,');
  const priced = moldingOrder({ ...withB, moldPrices: { [bBase.num]: 1.85 } }).find((m) => m.num === bBase.num)!;
  eq('job price for Brosco used', Math.abs(priced.cost - 1.85 * priced.feet) < 1e-9, true);
  eq('door trade size', tradeSize(32) + ' ' + tradeSize(80), '2/8 6/8');
  eq('32 1/4 x 80 1/8 opening takes a stock 2/8 x 6/8', JSON.stringify(stockSlab(32.25, 80.125)), JSON.stringify({ w: 32, h: 80, fits: true }));
  eq('odd opening flagged', stockSlab(34.5, 80.125).fits, false);
  const door = { ...newOpening('door', 'right', job), offset: 60, width: 32.25, height: 80.125, trim: { flat: 3.5 }, door: { design: 'PR8730', hinge: 'left' as const, leaves: 1 as const, prehung: true } };
  const room = { ...job, openings: [door] };
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

eq('sample has no layout issues', findIssues(p.room, p.cabinets, s).map((i) => i.message).join('; '), '');

console.log(failed ? `${failed} check(s) failed` : 'All model checks passed');
process.exit(failed ? 1 : 0);
