import { readFileSync } from "node:fs";
import { optionPrices, proposalSummary, withOptions } from "../src/model/proposal";
import { finishColors } from "../src/model/woodColors";
import { newTV, tvSize } from "../src/model/tv";
import { quoteStates } from "../src/model/quoteQueue";
import { cabinetFavorites, colorByCode, favorites, searchColors, withNamed } from "../src/model/paintColors";
import { bmColors } from "../src/model/benjaminMoore";
import { cabinetFinishPatch } from "../src/model/cabinetFinish";
import { canSpots } from "../src/model/lighting";
import { corbelCatalog } from "../src/model/corbels";
import { roomMoldings as roomMolds, wallAccentBoxes } from "../src/model/room";
import { paymentSchedule } from "../src/model/schedule";
import { asciiHtml } from "../src/dropbox";
import { cabinetFixtures, lightingCost, lightingParts, electricianHtml, hafeleStandard, hafeleFit } from "../src/model/cabinetLighting";
import { printQuote } from "../src/model/printQuote";
import { shopGroups } from "../src/drawings/sheets";
import { sidePanelLayout, wallElevation } from "../src/drawings/views";
import { crc32, writeXlsx } from "../src/export/xlsx";
import { pricingWorkbook } from "../src/export/pricingWorkbook";
import { ballpark, categoriesOf, categoryOf, comparableQuote, defaultRateCard } from "../src/model/ballpark";
import { termsHtml } from "../portal/src/pages";
import { CJC_TERMS } from "../src/model/terms";
import { cutCabinets, newDetail } from "../src/drawings/details";
import { fittedDrop, moldHeight, pictureRuns, underFascia } from "../src/model/coffer";
import { cabinetMoldings, moldCategories } from "../src/model/moldings";
import { ladderIssues, ladderOf } from "../src/model/ladder";
import { newOpening } from "../src/model/room";
import { cancelDeadline, holidays } from "../portal/src/cancel";
import { expiring } from "../src/portal";
import { benchChecks, newBench, newTable, seatHeight, seats, tableEstimate, tableScope } from "../src/model/furniture";
import { tableParts, tableStock } from "../src/model/tableParts";
import { contractTotal, parseWordQuote, splitNames } from "../src/model/contract";
import { mantelOf, shelfFor } from "../src/model/mantel";
import { defaultPilaster } from "../src/model/pilaster";
import { combineAll } from "../src/model/onePiece";
// Sanity checks on the cabinet model: run with `npm test`.
import { rowOpenings, topThick } from "../src/model/parts";
import { subCrownOnTop } from "../src/model/parts";
import { buildParts, eff, crownFit, crownLayout, crownRoom, layoutRows, panelExtents, realOverhang } from "../src/model/parts";
import { placedAppliances } from "../src/model/appliances";
import { legWidth, mantelClearances } from "../src/model/mantel";
import { defaultBack, planToProject, readPlan } from "../src/model/planImport";
import { fromDwgDatabase, parseDxf } from "../src/import/cad";
import { sampleProject, defaultSettings, presets, cabinetFromPreset } from "../src/model/defaults";
import { evenRun, fillSpan, findIssues, footprint, gapBeside, nextFreeOffset, placeOn, resolveEnds, shiftInRoom } from "../src/model/layout";
import { fmt, parseLength } from "../src/units";
import { drawerBoxSize, eaglePrice, hingeHoles } from "../src/model/eagle";
import { optimize } from "../src/model/optimizer";
import { defaultFaceFrameStock, faceFrameNeeds, faceFramePieces, otherSpecies, roughQuarters, woodPieces } from "../src/model/faceframe";
import { panelAbove, panelBetween, panelOrder } from "../src/model/panels";
import { amCatalog } from "../src/model/andersonMcquaid";
import { cabinetMoldings, moldingOrder, mountShape, priceOf, profileByNum, profileLabel, setCustomDrawings } from "../src/model/moldings";
import { closetRods, estimateHours, estimateMaterials, extraFinishes, paintCalculated, paintEstimate, priceQuote, proposalScope, quoteOf, scopeLine } from "../src/model/quote";
import { cutStock, defaultCutlist, designParts, optimizerParts } from "../src/model/cutlist";
import { applyBook, choosePlywood, chooseSpecies, priceBook, setJobFinish, stalePrices } from "../src/model/pricebook";
import { doorMaterials as eagleDoorMaterials, eagleWoodFactor } from "../src/model/eagle";
import { amSpecies as moldSpeciesList } from "../src/model/moldings";
import { normalize, reachesCeiling } from "../src/store";
import { fieldChecks, releaseStatus } from "../src/model/release";
import { eagleFraction, eagleRequests, requestText } from "../src/model/eagleRequest";
import { hardwareOrder, tierPrice } from "../src/model/hardware";
import { bbox, hardwareScope, pullSpots } from "../src/model/pulls";
import { topSection, edgeCurve } from "../src/model/edgeProfiles";
import { cutInset, edgeCutNotes, mouldingDrawing, mouldingNum, newPart, offsetOutline, partDxf, partOutline, partSize, retargetMoulding, templateHtml } from "../src/model/customParts";
import { doorSwings, doorSwingIssues, RESTRICT_TO } from "../src/model/doorSwing";
import { frontMotions } from "../src/three/fronts";
import { selections as selList, optionDeltas, listedPrice, selectionText } from "../src/model/selections";
import { profileItems } from "../src/drawings/profileSheet";
import { parseMeasure, visitsDoc, newVisit, readSummary, summaryRequest } from "../src/model/meeting";
import { hardwareItems } from "../src/drawings/views";
import { defaultSupplies, supplyDrivers, supplyLines } from "../src/model/supplies";
import { jobNumbers, phaseOf, starterTodos } from "../src/shop/fromDesign";
import { bracketCount, bracketLength, finishedEnds } from "../src/model/floatingShelf";
import { broscoCatalog } from "../src/model/brosco";
import { designByCode, doorDrawing, proportionsFor, stockSlab, tradeSize } from "../src/model/reeb";
import { doorOrder } from "../src/model/doorOrder";
import { applyDraft, cleanDraft, closestProfile, draftRequest } from "../src/model/photoRoom";
import { clientInfoDoc, folderName, ordersDoc, parseFolderName, proposalLines, quoteDoc, quoteTotals, stageByFolder } from "../src/model/client";
import { readScan, scanToDraft } from "../src/model/roomScan";
import { customerSet, drawingsOf, setDocument, sheetCss, shopSet } from "../src/drawings/sheets";
import { cabinetCallouts, forAudience, jobCallouts } from "../src/drawings/notes";
import { ceilingAt, slopeFit, wallCeiling } from "../src/model/ceiling";
import { cardLines, cardOf, checkDiscountOf } from "../src/model/payDiscount";
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

// How it's built: a solid top in place of stretchers; fixed shelves in dados; joinery in the notes
const solid = buildParts({ ...b21, build: { top: 'solid' } }, s);
eq('solid top replaces the stretchers', solid.filter((x) => x.role === 'stretcher').length, 0);
eq('solid top runs the full width and depth', `${solid.find((x) => x.name === 'Top')?.length} x ${solid.find((x) => x.name === 'Top')?.width}`, `20 x ${23.25 - 0.625}`);
const shelved = p.cabinets.find((c) => c.rows.some((r) => r.type === 'doors' && r.shelves > 0))!;
const fixed = buildParts({ ...shelved, build: { shelves: 'fixed' } }, s).filter((x) => x.role === 'shelf');
eq('fixed shelves are dadoed, full width', fixed.length > 0 && fixed.every((x) => x.name === 'Fixed shelf' && x.note?.startsWith('In 1/4" dados')), true);
eq('confirmat joinery in the side notes', buildParts({ ...b21, build: { joinery: 'confirmat' } }, s).find((x) => x.role === 'side')!.note!.includes('Confirmat'), true);

// Open sections painted inside: what shows there gets the paint look and the note, and the estimate picks it up
const bookcase = { ...shelved, rows: [{ id: 'o', type: 'open' as const, height: null, doors: 1 as const, shelves: 2 }, ...shelved.rows] };
const painted = buildParts({ ...bookcase, build: { interior: 'paint' } }, s);
eq('open section parts painted', painted.filter((x) => x.look === 'paint' && x.note?.includes('bonding primer')).some((x) => x.role === 'back'), true);
eq('closed shelves stay prefinished', painted.some((x) => x.role === 'shelf' && !x.look), true);
const pe0 = paintEstimate({ ...p, cabinets: [bookcase] }, quoteOf(p)), pe1 = paintEstimate({ ...p, cabinets: [{ ...bookcase, build: { interior: 'paint' } }] }, quoteOf(p));
eq('painted interior adds to the painting estimate', pe1.interior > 0 && pe1.amount > pe0.amount && pe0.interior === 0, true);

// Rolling ladder: Putnam's 92" ladder on Pope-like bookcases, leaning 12 degrees, 7 steps
const lib = { ...p, room: { width: 157.25, depth: 180.5, height: 104.25 }, cabinets: [{ ...shelved, wall: 'back' as const, offset: 10, width: 120, height: 98.75, depth: 12, elevation: 0 }], ladder: { on: true } };
const lad = ladderOf(lib);
eq('ladder rail across the bookcases', `${lad.from}-${lad.to}`, '10-130');
eq('ladder rail center 2 1/2" off the 12" cases', lad.railZ, 14.5);
eq('ladder has 7 steps', lad.stepAt.length, 7);
eq('ladder foot about 19" out from the rail', Math.round(lad.footOut), 19);
eq('ladder clears a 104 1/4" ceiling', ladderIssues(lib).length, 0);
eq('9\' ladder too tall for the room', ladderIssues({ ...lib, ladder: { on: true, railHeight: 103.75 } }).some((i) => i.message.includes('top rises')), true);
eq('rail at 98": less than the recommended 7" but the top fits', ladderIssues({ ...lib, ladder: { on: true, railHeight: 98 } }).length, 0);

// Details: a wall section and a cabinet section go on Details sheets, marked on the elevation
const withDetails = { ...p, details: [newDetail({ kind: 'wall', wall: 'back', at: 40 }), newDetail({ kind: 'cabinet', cabinetId: p.cabinets[0].id })] };
const cset = customerSet(withDetails, drawingsOf(withDetails));
eq('details sheet in the customer set', cset.filter((x) => x.title === 'Details').length, 1);
eq('wall section marked on its elevation', cset.some((x) => x.svg.includes('cutline') && x.title.includes('elevation')), true);
eq('shop set gets the details too', shopSet(withDetails, drawingsOf(withDetails)).filter((x) => x.title === 'Details').length, 1);
eq('a section drawn through the base and wall cabinets', cutCabinets(withDetails, 'back', 40).length >= 2, true);

// Under a coffer's perimeter fascia a tall takes no crown (the fascia carries it); a proud pilaster's
// wrapped base cap returns, and the cabinet's cap stops at its return with an inside miter
{
  const tall = { ...shelved, id: 'tl', kind: 'tall' as const, wall: 'back' as const, offset: 6, width: 30, height: 98.75, depth: 12, elevation: 0, crown: '49', baseMold: '1527', base: { style: 'baseboard' as const, height: 6, cap: 1.5 } };
  const pil = { ...tall, id: 'pl', kind: 'pilaster' as const, name: 'P1', offset: 0, width: 6, depth: 12.75, rows: [], baseMold: undefined, pilaster: { ...defaultPilaster, plinth: 0, wrap: { h: 6, cap: 1.5, t: 0.75 } } };
  const job = { ...p, room: { width: 157.25, depth: 180.5, height: 104.25 }, cabinets: [pil, tall], ceiling: { on: true, across: 3, deep: 3, drop: 5.5, perimeter: true, walls: { back: 13.5 } } };
  eq('a tall under the perimeter fascia takes no crown', underFascia(job, tall), true);
  eq('a pilaster keeps its capital crown', underFascia(job, pil), false);
  const pm = cabinetMoldings(pil, s, resolveEnds(job.room, job.cabinets, pil));
  eq('proud pilaster: base cap wraps its face with a return', pm.filter((m) => m.kind === 'baseMold').length, 2);
  const tm = cabinetMoldings(tall, s, resolveEnds(job.room, job.cabinets, tall)).find((m) => m.kind === 'baseMold')!;
  // Fit the fascia to the bookcases: fascia plus picture moulding down to their tops, picture running across them
  const withPic = { ...job, ceiling: { ...job.ceiling, picture: '1527' } };
  const fit = fittedDrop(withPic)!;
  eq('fitted drop brings fascia + picture moulding to the bookcase tops', Math.abs(104.25 - fit - moldHeight('1527') - 98.75) < 0.07, true);
  eq('picture moulding then runs across the bookcases', pictureRuns({ ...withPic, ceiling: { ...withPic.ceiling, drop: fit } }).some((r) => r.wall === 'back'), true);
  eq('the cabinet\'s cap meets the pilaster\'s cap return, inside-mitered', `${tm.x} ${tm.z} ${tm.cut?.[0]}`, '0 12 in');
}

// From the review: older terms still get a notice on the signed copy; painting left out of the contract
// costs nothing; a line price you set is shown exactly, the adjustment landing on the other lines
eq('older terms: signed copy still carries the notice', termsHtml('1. Parties: you.', Date.UTC(2026, 9, 30, 15)).includes('NOTICE OF CANCELLATION'), true);
eq('new terms: one notice, from the terms', (termsHtml(CJC_TERMS, Date.UTC(2026, 9, 30, 15)).match(/<h3>NOTICE OF CANCELLATION/g) ?? []).length, 1);
{
  const q0 = { ...p, quote: { ...p.quote, painter: 6000 } };
  eq('painting not in contract adds no painter cost', priceQuote({ ...q0, quote: { ...q0.quote, paintWhen: 'none' as const } }).cost < priceQuote(q0).cost - 5999, true);
  const set = { ...p, quote: { ...p.quote, adjustment: -1000, linePrices: { cabinets: 20000 }, extras: [{ id: 'x1', label: 'Demo', hours: 8, amount: 200 }] } };
  eq('a set line price is shown exactly', proposalLines(set).find((l) => l.key === 'cabinets')?.price, 20000);
  eq('the lines still add to the total', proposalLines(set).reduce((t, l) => t + l.price, 0), priceQuote(set).total);
}

// Paint-grade top: 3/4" ply on the case, 3/4" x 1 1/4" edging dropping 1/2" over the top rail
{
  const pt = buildParts({ ...b21, countertop: true, topKind: 'paint' as const, topFront: 0.75 }, s, { left: true, right: false });
  const ply = pt.find((x) => x.role === 'paintTop')!;
  const edge = pt.filter((x) => x.name.startsWith('Top edging'));
  eq('paint top is 3/4 ply on the sheet list', `${ply.thickness} ${ply.material}`, '0.75 box');
  eq('paint top edging: front and the exposed left end', edge.map((x) => x.name).join(), 'Top edging, front,Top edging, left end');
  eq('edging drops 1/2" below the ply', ply.boxes[0].min[1] - edge[0].boxes[0].min[1], 0.5);
  eq('edging front flush with a 3/4" overhang', edge[0].boxes[0].min[2] + 0.75, ply.boxes[0].min[2] + ply.boxes[0].size[2] + 0.75);
}

// Cubbies: dividers in an open row, shelves per bay; two open rows get a fixed divider between them
{
  const cub = { ...b21, kind: 'wall' as const, width: 48, height: 30, depth: 14, elevation: 66, rows: [{ id: 'u', type: 'open' as const, height: 12, doors: 1 as const, shelves: 0 }, { id: 'l', type: 'open' as const, height: null, doors: 1 as const, shelves: 1, dividers: 2 }] };
  const cp = buildParts(cub, s);
  eq('two dividers, two mid stiles', `${cp.filter((x) => x.role === 'divider').length} ${cp.filter((x) => x.name === 'Mid stile').length}`, '2 2');
  eq('a shelf in each of the 3 bays', cp.filter((x) => x.name === 'Adjustable shelf').length, 3);
  eq('fixed divider across between the open rows', cp.some((x) => x.name === 'Fixed shelf' && (x.note ?? '').includes('divider across')), true);
}

// Solid stock: a 98 3/4" pilaster stile goes on a 10' board, shorter pieces fill its leftover, no error
{
  const st = { ...defaultFaceFrameStock, boardLength: 96, endTrim: 1, lengthAllowance: 0.5, kerf: 0.125, waste: 0 };
  const r = faceFrameNeeds([{ cabinet: 'P1', name: 'Stile', width: 1.5, length: 98.75 }, { cabinet: 'P1', name: 'Rail', width: 1.5, length: 15 }, { cabinet: 'B1', name: 'Stile', width: 1.5, length: 30 }], st);
  eq('long pilaster stile: no "too long" error', r.tooLong.length, 0);
  eq('it goes on a 10\' board, the 15" rail in its leftover', `${r.byLength.map((b) => `${b.count}x${b.length}`).join(',')} ${r.groups[0].strips[0].pieces.length}`, '1x120,1x96 2');
}

// Sheets: 98 3/4" pilaster sides go on 4x10 sheets the cutlist adds, everything else stays on 4x8
{
  const pil = { ...b21, id: 'pl1', kind: 'pilaster' as const, name: 'P1', width: 6, height: 98.75, depth: 12, rows: [], pilaster: { ...defaultPilaster, plinth: 0 } };
  const job = { ...p, room: { width: 157.25, depth: 180.5, height: 104.25 }, cabinets: [pil, { ...pil, id: 'pl2', name: 'P2', offset: 40 }] };
  const data = defaultCutlist(job);
  const res = optimize(optimizerParts(job, data), cutStock(job, data), data.options);
  eq('pilaster sides placed (4x10 added)', res.every((m) => m.unplaced.length === 0) && cutStock(job, data).some((x) => x.length === 120), true);
}

// Frame joinery: tongue and groove adds a 3/8" tongue to each rail end; every method is noted
{
  const pocket = buildParts(b21, s).find((x) => x.name === 'Top rail')!;
  const tg = buildParts(b21, { ...s, ffJoinery: 'stubTenon' as const }).find((x) => x.name === 'Top rail')!;
  eq('T&G rail is 3/4" longer', tg.length - pocket.length, 0.75);
  eq('Domino noted on the rail', (buildParts(b21, { ...s, ffJoinery: 'domino' as const }).find((x) => x.name === 'Top rail')!.note ?? '').includes('Domino'), true);
}

// Recessed cans: one per coffer, or a grid about every 5'
eq('one can per coffer', canSpots({ ...p, ceiling: { on: true, across: 3, deep: 3 } }).length, 9);
eq('cans on a grid, 3 across by 2 deep', canSpots({ ...p, room: { width: 156, depth: 144, height: 96 } }).length, 6);
eq('daylight has no cans', canSpots({ ...p, lights: { kind: 'daylight' } }).length, 0);

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
  // On a leveled platform: the cases sit on it, the stiles still run to the floor, the platform is in the cut list
  const plat = buildParts({ ...bbCab, base: { ...bbCab.base, platform: 3.5 } }, defaultSettings, both);
  eq('platform: case sides sit on it', plat.filter((x) => x.role === 'side').every((x) => x.boxes[0].min[1] === 3.5), true);
  eq('platform: stiles to the floor', plat.find((x) => x.name === 'Stile')!.boxes[0].min[1], 0);
  eq('platform: runners and cross pieces', [plat.filter((x) => x.name === 'Platform runner').length, plat.filter((x) => x.name === 'Platform cross piece').length >= 2].join(), '2,true');
  eq('baseboard: bottom rail runs down to 1/2" off the floor', (() => { const r = bb.find((x) => x.name.startsWith('Bottom rail'))!; return [r.boxes[0].min[1], r.width].join(); })(), [0.5, 4.5 + 1.5 - 0.5].join());
  eq('baseboard: case sides stand 1/2" up', bb.filter((x) => x.role === 'side').every((x) => x.boxes[0].min[1] === 0.5), true);
  // A molded baseboard (3" or taller) is the whole baseboard, from the floor, with no flat board under it
  const tallBB = amCatalog.find((x) => x.num === '1827')!;
  const molded = { ...bbCab, baseMold: tallBB.num };
  const mH = mountShape(tallBB).height;
  eq('molded baseboard: from the floor', cabinetMoldings(molded, defaultSettings, both).find((m) => m.kind === 'baseMold' && m.facing === 'front')!.y, 0);
  eq('molded baseboard: no flat board', buildParts(molded, defaultSettings, both).some((x) => x.name.startsWith('Baseboard')), false);
  eq('molded baseboard: 1-1/2" rail shows above it', Math.abs(layoutRows(molded, defaultSettings).rows.slice(-1)[0].y0 - (mH + 1.5)) < 1e-6, true);
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
  eq('customer set: cover, plan, an elevation per wall with cabinets, door style', cust.length, 3 + walls);
  eq('customer set: the door style sheet', cust[cust.length - 1].title, 'Door style');
  eq('elevation dimensions the wall', cust[2].svg.includes(`${p.room.width}"`), true);
  const shop = shopSet(p, d);
  eq('shop set: a sheet per wall, then drawings + parts per cabinet built alike', shop.length, walls + 2 * shopGroups(p).length);
  eq('cabinet drawing: face frame and side layout', shop[walls].svg.includes('FACE FRAME') && shop[walls].svg.includes('LEFT SIDE, INSIDE FACE'), true);
  eq('cabinet parts sheet lists its parts and the order of work', shop[walls + 1].svg.includes('Bottom') && shop[walls + 1].svg.includes('Order of work'), true);
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

// Sold quotes from Word: scope, prices, options, allowances, schedule
{
  const r = parseWordQuote(readFileSync('scripts/fixtures/sample-quote.txt', 'utf8'));
  const c = r.contract;
  eq('word quote: client and date', [r.client.names, r.client.email, c.agreementDate, c.title].join('|'), 'Jane & John Sample|jane@example.com|2026-10-04|Office-to-Library Renovation');
  eq('word quote: names split', JSON.stringify(splitNames('Melissa & Michael Pope')), '{"first":"Melissa","partner":"Michael","last":"Pope"}');
  eq('word quote: scope sections', c.scope.map((x) => x.num || x.title).join(), '1,2,3,4,5A,5B,Painting & Finishing,Project Conditions');
  eq('word quote: allowances', c.allowances.map((a) => a.label).join(' / '), 'Putnam Rolling Ladder model Classic No.1 / Dimplex Revillusion 30” electric firebox insert');
  eq('word quote: price lines, options unticked', c.lines.map((l) => `${l.price}${l.option ? '?' : ''}`).join(), '4800,12280?,10340?,12790,26480,10800');
  eq('word quote: blank total and schedule flagged', [c.totalOverride ?? 'none', c.schedule.length, r.warnings.length].join(), 'none,3,3');
  c.lines[1].chosen = true;
  eq('word quote: total with the full-height option', contractTotal(c), 67150);
}

// One-piece bookcases: a base with a wood top and an open upper on it become one tall case
{
  const lib = { ...p, cabinets: [
    { ...cabinetFromPreset(presets.find((x) => x.id === 'library-base')!, 'back', 0, []), id: 'b1', name: 'B1', wall: 'back' as const, offset: 0, width: 32, height: 35, depth: 12, countertop: true, topKind: 'wood' as const, topThickness: 1, topFront: 0.5 },
    { ...cabinetFromPreset(presets.find((x) => x.id === 'library-upper')!, 'back', 0, []), id: 'w1', name: 'W1', wall: 'back' as const, offset: 0, width: 32, depth: 12, elevation: 36, height: 62.75, overrides: { topRailWidth: 6 } },
  ] };
  const doorsBefore = buildParts(lib.cabinets[0], s, lib).filter((x) => x.role === 'door').map((x) => `${x.length.toFixed(3)}@${x.boxes[0].min[1].toFixed(3)}`).join();
  const r = combineAll(lib);
  const t = r.cabinets[0];
  const parts = buildParts(t, s, { ...lib, cabinets: r.cabinets });
  eq('one piece: one tall case 98 3/4 high', `${r.cabinets.length} ${t.kind} ${t.height}`, '1 tall 98.75');
  eq('one piece: doors unchanged', parts.filter((x) => x.role === 'door').map((x) => `${x.length.toFixed(3)}@${x.boxes[0].min[1].toFixed(3)}`).join(), doorsBefore);
  const ledge = parts.find((x) => x.name === 'Ledge')!;
  eq('one piece: ledge on top at 36", 1/2" proud', `${(ledge.boxes[0].min[1] + ledge.thickness).toFixed(3)} ${ledge.width}`, '36.000 2');
  const fixed = parts.find((x) => x.name === 'Fixed shelf')!;
  eq('one piece: fixed shelf flush with the ledge', (fixed.boxes[0].min[1] + fixed.boxes[0].size[1]).toFixed(3), '36.000');
  eq('one piece: ladder top rail kept', parts.find((x) => x.name === 'Top rail')!.width, 6);
}

// Full-height fireplace: pilaster legs like the bookcases, a faux chimney, an overmantel to the trim, the base wrapped
{
  const fp = { ...cabinetFromPreset(presets.find((x) => x.id === 'mantel-electric')!, 'front', 40, []), depth: 13.5, width: 52.625, height: 54 };
  fp.mantel = { openingW: 31.25, openingH: 26.625, openingY: 8, margin: (52.625 - 12 - 31.25) / 2, legs: 'pilaster', legBuild: 'pilaster', corbels: 0, chimney: true,
    pilaster: { plinth: 7, capital: 3.5, stile: 1.5, rail: 2, proud: 0.75 }, upper: { on: true, top: 98.75, plinth: 2, frameStile: 3, frameRail: 3.5 }, baseH: 6, baseCapH: 1.625, baseT: 0.75 };
  const parts = buildParts(fp, s);
  const names = (re: RegExp) => parts.filter((x) => re.test(x.name)).length;
  eq('fireplace: legs are frame-and-panel pilasters', [names(/^Leg pilaster stile/), names(/^Leg pilaster panel/), names(/^Upper pilaster panel/)].join(), '4,2,2');
  const top = Math.max(...parts.flatMap((x) => x.boxes.map((b) => b.min[1] + b.size[1])));
  eq('fireplace: overmantel stops at the ceiling trim', top.toFixed(3), '98.750');
  eq('fireplace: chimney sides full height, out to the frieze line', parts.filter((x) => x.name === 'Chimney side').map((x) => `${x.length}x${x.width}`).join(), '98.75x12.75,98.75x12.75');
  eq('fireplace: two-piece base in 7 runs', `${names(/^Baseboard$/)}/${names(/^Base cap$/)}`, '7/7');
  const front = parts.find((x) => x.name === 'Baseboard' && x.note?.startsWith('front'))!;
  eq('fireplace: base across the front between the plinths', front.length, 52.625 - 12 - 1.5);
}

// A classic mantel: flat panel breastboard matching the legs, a neck moulding, an upper section stepped back with a cap
{
  const fp = { ...cabinetFromPreset(presets.find((x) => x.id === 'mantel-electric')!, 'front', 55, []), depth: 13.5, width: 47.25, height: 48.5, crown: '5268' };
  fp.mantel = { openingW: 31.25, openingH: 26.625, openingY: 8, margin: 2, legs: 'pilaster', legBuild: 'pilaster', legProud: 0.75, corbels: 0, chimney: true, shelfThickness: 1.5, shelfDepth: 16.5,
    frieze: 'panel', neckMold: '7092', baseCapAcross: false,
    pilaster: { plinth: 0, capital: 0, stile: 1.5, rail: 2, band: 1.5, proud: 0.75 }, upper: { on: true, top: 98.75, plinth: 0, frameStile: 3, frameRail: 3.5, between: 'wall', setback: 1.5, capMold: '5268' }, baseH: 6, baseCapH: 1.5, baseT: 0.75 } as typeof fp.mantel;
  const parts = buildParts(fp, s);
  const fr = parts.find((x) => x.name === 'Frieze panel')!;
  const legPanels = parts.filter((x) => x.name === 'Leg pilaster panel');
  const upperLeg = legPanels.map((x) => x.boxes[0]).sort((a, b) => b.min[1] - a.min[1])[0];
  eq('classic mantel: breastboard panel lines up with the legs\' upper panels', `${fr.boxes[0].min[1].toFixed(3)}-${(fr.boxes[0].min[1] + fr.boxes[0].size[1]).toFixed(3)} ${upperLeg.min[1].toFixed(3)}-${(upperLeg.min[1] + upperLeg.size[1]).toFixed(3)}`, '38.625-43.147 38.625-43.147');
  eq('classic mantel: each leg breaks into two panels', legPanels.length, 4);
  const molds = cabinetMoldings(fp, s, { left: true, right: true } as never);
  eq('classic mantel: neck moulding wraps each leg (face and both sides)', molds.filter((m) => m.num === '7092').length, 6);
  const caps = molds.filter((m) => m.num === '5268' && m.y > 90);
  eq('classic mantel: cap on the upper pilasters, 1-1/2" back from the legs', `${caps.length} ${caps.find((m) => m.facing === 'front')!.z}`, '6 12.75');
  eq('classic mantel: bed moulding steps in across the frieze', molds.some((m) => m.num === '5268' && m.facing === 'front' && m.z === 13.5 && m.cut?.[0] === 'in'), true);
  const sides = parts.filter((x) => x.name === 'Chimney side').map((x) => `${x.length}x${x.width}`).join();
  eq('classic mantel: chimney steps back above the shelf', sides, '48.5x12.75,50.25x11.25,48.5x12.75,50.25x11.25');
  eq('classic mantel: base cap wraps the legs, not across under the opening', parts.some((x) => x.name === 'Base cap' && x.note?.startsWith('front')), false);
  eq('classic mantel: frieze panel in the quote', estimateHours({ ...p, cabinets: [fp] }, quoteOf(p)).some((h) => h.label === 'Mantels: frame-and-panel frieze'), true);
}

// The ~12" soffit along the fireplace wall with stile-and-rail panels underneath, to either side of the chimney
{
  const fp = { ...cabinetFromPreset(presets.find((x) => x.id === 'mantel-electric')!, 'front', 55, []), depth: 13.5, width: 47.25, height: 44.625 };
  fp.mantel = { chimney: true, upper: { on: true, top: 98.75, plinth: 2, frameStile: 3, frameRail: 3.5 } } as typeof fp.mantel;
  const room = { ...p, room: { width: 157.25, depth: 180.5, height: 104.25 }, cabinets: [fp],
    ceiling: { on: true, across: 3, deep: 3, perimeter: true, walls: { front: 13.5, back: 13.5 }, panels: { front: { stile: 2.5, rail: 2.5, size: 24 } } } } as typeof p;
  const parts = cofferParts(room).filter((x) => x.name.startsWith('Perimeter, front'));
  const rails = parts.filter((x) => x.name.endsWith('soffit rail'));
  eq('soffit panels: a run each side of the chimney, two rails each', rails.map((x) => x.length.toFixed(2)).join(), '54.25,54.25,54.25,54.25');
  eq('soffit panels: two panels a side', parts.filter((x) => x.name.endsWith('soffit panel')).length, 4);
  eq('soffit panels: no flat soffit board left', parts.filter((x) => x.name.endsWith(' soffit')).length, 0);
  const wallRail = rails.find((x) => x.note?.startsWith('At the wall'))!;
  eq('soffit panels: the wall rail is at the wall', (wallRail.boxes[0].min[2] + wallRail.boxes[0].size[2]).toFixed(2), '180.50');
  eq('soffit panels: priced per panel', estimateHours(room, quoteOf(room)).find((l) => /stile & rail panels/.test(l.label))?.qty, 4);
}

// Sized from the insert, and the room's base with a custom cap wrapping pilaster plinths
{
  const m = { ...mantelOf({ ...cabinetFromPreset(presets.find((x) => x.id === 'mantel-electric')!, 'front', 0, []) }), openingW: 31.25, openingH: 26.625, openingY: 8, margin: 2 };
  eq('fireplace: shelf from the insert up (8 + 26 5/8 + 2 + 6 frieze + 2 shelf)', shelfFor(m, 6), 44.625);
  const tall = { ...cabinetFromPreset(presets.find((x) => x.id === 'library-base')!, 'back', 0, []), kind: 'tall' as const, height: 98.75, base: { style: 'baseboard' as const, height: 6, cap: 1.625, build: 'faceframe' as const, shape: 'bracket' as const, rise: 3, foot: 2.25 } };
  eq('base: 6" board and 1 5/8" custom cap', buildParts(tall, s).filter((x) => /^Base/.test(x.name)).map((x) => `${x.name}:${x.width}`).sort().join(), 'Base cap, front:1.625,Baseboard, front:6');
  const pil = { ...cabinetFromPreset(presets.find((x) => x.id === 'pilaster')!, 'back', 0, []), pilaster: { ...defaultPilaster, plinth: 7, proud: 0.75, wrap: { h: 6, cap: 1.625, t: 0.75 } } };
  eq('pilaster: base and cap wrap the plinth, front and returns', buildParts(pil, s).filter((x) => /on plinth/.test(x.name)).length, 6);
  // Tight to the left wall (P1): no return on that side, the face pieces square into the wall
  const room = { ...p.room };
  const atWall = { ...pil, offset: 0 };
  const ends = resolveEnds(room, [atWall], atWall);
  eq('pilaster at a wall: the wall side is found', `${ends.wall?.left},${ends.wall?.right}`, 'true,false');
  const wp = buildParts(atWall, s, ends).filter((x) => /on plinth/.test(x.name));
  eq('pilaster at a wall: front pieces plus the open-side returns only', wp.length, 4);
  eq('pilaster at a wall: front runs from the wall, one miter', wp.find((x) => x.name === 'Baseboard on plinth')!.length, atWall.width + 0.75);
  // No plinth block (Pope): the base and cap wrap the pilaster face itself; the frame starts above the cap
  const bare = { ...pil, pilaster: { ...pil.pilaster, plinth: 0 } };
  const bp = buildParts(bare, s);
  eq('pilaster, no plinth: no plinth block', bp.some((x) => x.name === 'Plinth block'), false);
  const br = bp.find((x) => x.name === 'Pilaster bottom rail')!;
  eq('pilaster, no plinth: bottom rail from the floor to 2" above the cap', `${br.boxes[0].min[1]}-${br.boxes[0].min[1] + br.boxes[0].size[1]}`, '0-9.625');
  eq('pilaster, no plinth: base on the pilaster face', bp.find((x) => x.name === 'Baseboard on plinth')!.boxes[0].min[2], bare.depth);
}

// Crown sits on the case unless there's a sub-crown; fitting the last cabinet; equal runs
{
  const room = { width: 159.875, depth: 150, height: 96.5 };
  const up = (name: string, offset: number, width: number) => ({ ...cabinetFromPreset(presets.find((x) => x.kind === 'wall')!, 'front', offset, []), id: name, name, elevation: 31, height: 56, depth: 12.75, crown: 'BR-8010' });
  const w1 = up('W1', 0, 32);
  const L = crownLayout(w1, s);
  const crownPiece = cabinetMoldings(w1, s, { left: true, right: true }).find((m) => m.kind === 'crown' && m.along === 'x')!;
  eq('crown: bottom at the top of the case with no sub-crown', crownPiece.y.toFixed(3), '56.000');
  eq('crown: nailer as tall as the crown', buildParts(w1, s).find((x) => x.name === 'Crown nailer')!.width.toFixed(4), L.seat.toFixed(4));
  const w1sub = { ...w1, crownBuild: { subCrown: 3, rise: 0, drop: 0, extra: [] } };
  eq('crown: with a sub-crown it goes on its face, top at the top of the build', crownLayout(w1sub, s).crownTop, 56);
  const run = [w1, up('W2', 32, 32), up('W3', 64, 32), up('W4', 96, 32), up('W5', 128, 31.5)];
  const f = fillSpan(room, run, run[4], s, 'right');
  eq('fill: last upper widens to the wall', `${f.offset}/${f.width}`, '128/31.875');
  const uneven = [up('U1', 0, 30), up('U2', 30, 33), up('U3', 63, 31), up('U4', 94, 32), up('U5', 126, 30)];
  const ev = evenRun(room, uneven, uneven[2], s);
  const ws = uneven.map((u) => ev.get(u.id)!.width);
  eq('even run: five fill the wall within 1/16', `${ws.join(',')} = ${ws.reduce((t, w) => t + w, 0)}`, '32,32,32,31.9375,31.9375 = 159.875');
  // Pilasters between keep their width
  const pil = (name: string, offset: number) => ({ ...cabinetFromPreset(presets.find((x) => x.id === 'pilaster')!, 'back', offset, []), id: name, name, width: 6, height: 98.75 });
  const tall = (name: string, offset: number, width: number) => ({ ...cabinetFromPreset(presets.find((x) => x.id === 'library-base')!, 'back', offset, []), id: name, name, kind: 'tall' as const, width, height: 98.75 });
  const lib = [pil('P1', 0), tall('T1', 6, 30), pil('P2', 36, ), tall('T2', 42, 33), pil('P3', 75), tall('T3', 81, 31)];
  const ev2 = evenRun({ width: 118, depth: 150, height: 104 }, lib, lib[1], s);
  eq('even run: bookcases between pilasters', ['T1', 'T2', 'T3', 'P2', 'P3'].map((n) => `${n}@${ev2.get(n)!.offset}:${ev2.get(n)!.width}`).join(' '), 'T1@6:33.375 T2@45.375:33.3125 T3@84.6875:33.3125 P2@39.375:6 P3@78.6875:6');
}

// A custom profile's traced drawing, carried in the design
{
  const num = 'custom:Picture Moulding:1.5x0.75:shop';
  setCustomDrawings({ [num]: { name: 'Picture moulding, from the sample', pts: [[0, 0], [0.75, 0.2], [0.5, 1.5], [0, 1.5]] } });
  const pr = profileByNum(num)!;
  eq('custom profile: traced outline and name from the design', `${pr.name} ${mountShape(pr).pts.length} ${mountShape(pr).height}`, 'Picture moulding, from the sample 4 1.5');
  setCustomDrawings(undefined);
  eq('custom profile: plain outline without a drawing', mountShape(profileByNum(num)!).pts.length, 4);
}

// Plywood and species from the price book: red oak cases, birch for nothing, oak face frames
{
  const book = priceBook({ 'ply-red-oak': { id: 'ply-red-oak', kind: 'plywood', name: 'Red oak', sheet: { '3/4"': 120, '1/2"': 100 }, updatedAt: 1 }, 'lum-red-oak': { id: 'lum-red-oak', kind: 'lumber', name: 'Red oak', perBF: 7.5, updatedAt: 1 } });
  const base = { ...p, cutlist: defaultCutlist(p) };
  eq('price book: legacy job sheets', base.cutlist.stock.map((x) => `${x.material} ${x.price}`).join(', '), '3/4" plywood 86.4, 1/2" plywood 74.91');
  const oak = chooseSpecies(choosePlywood(base, 'plywood', 'Red oak', book), 'Red oak', book);
  eq('price book: cutlist rows follow the plywood with its prices', oak.cutlist!.stock.map((x) => `${x.material} ${x.price}`).join(', '), '3/4" red oak plywood 120, 1/2" red oak plywood 100');
  eq('price book: face frame species and $/BF', `${oak.settings.woodSpecies} / ${oak.faceFrame!.species} / ${oak.faceFrame!.pricePerBF}`, 'Red oak / Red oak, 4/4 / 7.5');
  eq('A&M: red oak face frames from a 1x6 by the lineal foot', `${oak.faceFrame!.board} ${oak.faceFrame!.pricePerLF} ${oak.faceFrame!.boardWidth}`, '3/4 x 5-1/2 3.45 5.5');
  const ffLine = estimateMaterials(oak, quoteOf(oak)).find((l) => l.label.startsWith('Face frame stock'))!;
  const need = faceFrameNeeds(faceFramePieces(oak), { ...defaultFaceFrameStock, ...oak.faceFrame });
  eq('A&M: quote prices face frames by length', `${ffLine.cost.toFixed(2)} ${ffLine.detail}`, `${(need.buyLF * 3.45).toFixed(2)} ${need.byLength.map((b) => `${b.count} × ${b.length / 12}'`).join(', ')} boards, ${Math.ceil(need.buyLF)} lf at $3.45`);
  const own = priceBook({ 'lum-red-oak': { id: 'lum-red-oak', kind: 'lumber', name: 'Red oak', perLF: { '3/4 x 5-1/2': 3.75 }, updatedAt: 3 } });
  const unpriced = { ...p, faceFrame: undefined };
  const listLine = estimateMaterials(unpriced, quoteOf(unpriced)).find((l) => l.label.startsWith('Face frame stock'))!;
  eq('A&M: no price entered, hard maple 1x6 from the list', `${listLine.detail.includes('$6.20 (A&M list price)')} ${!listLine.missing}`, 'true true');
  eq('A&M: the shop’s own price beats the list', applyBook(oak, own).faceFrame!.pricePerLF, 3.75);
  const mats = new Set(optimizerParts(oak, oak.cutlist!).map((x) => x.material));
  eq('price book: every part cut from red oak', [...mats].every((m) => m.includes('red oak')), true);
  const exp = choosePlywood(oak, 'exposedPlywood', 'Walnut', book);
  const stock = cutStock(exp, exp.cutlist!).map((x) => x.material);
  eq('price book: exposed ends get their own sheets', stock.includes('3/4" walnut plywood') && stock.includes('3/4" red oak plywood'), true);
  const later = priceBook({ 'ply-red-oak': { id: 'ply-red-oak', kind: 'plywood', name: 'Red oak', sheet: { '3/4"': 125, '1/2"': 100 }, updatedAt: 2 } });
  eq('price book: a price change shows as stale', stalePrices(oak, later).map((x) => `${x.label} ${x.job}->${x.book}`).join('; '), '3/4" red oak plywood, per sheet 120->125');
  eq('price book: updating brings it in', applyBook(oak, later).cutlist!.stock[0].price, 125);
  const doorLine = (x: typeof oak) => estimateMaterials(x, quoteOf(x)).find((l) => l.label.startsWith('Eagle doors'))!;
  const estd = doorLine({ ...oak, settings: { ...oak.settings, doorMaterial: 'Red oak' } });
  eq('eagle: red oak doors priced from Eagle\'s red oak quote', estd.detail.includes('Red Oak, from Eagle'), true);
  const maple = doorLine({ ...oak, settings: { ...oak.settings, doorMaterial: 'Paint-grade maple' } });
  eq('eagle: red oak doors cost about 47% more than paint-grade maple', Math.abs(estd.cost / maple.cost - 1.473) < 0.01, true);
  eq('eagle: cherry is still an estimate to check', doorLine({ ...oak, settings: { ...oak.settings, doorMaterial: 'Cherry' } }).detail.includes('check with Eagle'), true);
  eq('eagle: Eagle\'s red oak door A58745 (14-15/16 x 24) at $73.09', Math.abs(eaglePrice('door', 14.938, 24) * eagleWoodFactor['Red oak'] - 73.09) < 0.01, true);
  const stained = setJobFinish({ ...oak, settings: { ...oak.settings, finish: undefined as never, centerPanel: 'MDF-07', frontPanel: 'MDF-10' } }, 'stain', 'Red oak', book, eagleDoorMaterials, []);
  eq('stain: MDF panels become veneer', `${stained.settings.centerPanel} ${stained.settings.frontPanel}`, 'VNR-01 VNR-03');
  const painted = setJobFinish(stained, 'paint', 'Red oak', book, eagleDoorMaterials, []);
  eq('paint: veneer panels go back to MDF', `${painted.settings.centerPanel} ${painted.settings.frontPanel}`, 'MDF-07 MDF-01');
  const withDoors = doorLine({ ...oak, eagleQuotes: { doors: 1234.5 } });
  eq('eagle quote: doors replaced, fronts still estimated', withDoors.cost > 1234.5 - 0.01 && withDoors.detail.includes('partly Eagle’s quote'), true);
}

{
  const book = priceBook({});
  const prices = (n: string) => JSON.stringify(book.find((x) => x.name === n)!.sheet);
  eq('price book: supplier plywood prices', ['Prefinished maple', 'Red oak', 'Sapele mahogany', 'Walnut'].map(prices).join(' '), '{"3/4\\"":145,"1/2\\"":115} {"3/4\\"":174,"1/2\\"":164} {"3/4\\"":254,"1/2\\"":240} {"3/4\\"":244,"1/2\\"":230}');
  const sap = choosePlywood({ ...p, cutlist: defaultCutlist(p) }, 'plywood', 'Sapele mahogany', book);
  eq('price book: sapele sheets', sap.cutlist!.stock.map((x) => `${x.material} ${x.price}`).join(', '), '3/4" sapele mahogany plywood 254, 1/2" sapele mahogany plywood 240');
}

// Closets: hanging sections with rods, and frameless cases
{
  const mk = (id: string) => ({ ...cabinetFromPreset(presets.find((x) => x.id === id)!, 'back', 0, []), id, name: id });
  const long = mk('closet-long');
  const lp = buildParts(long, s);
  const rod = lp.find((x) => x.role === 'rod')!;
  const fixed = lp.filter((x) => x.name === 'Fixed shelf');
  eq('closet: long hang has one rod under a fixed shelf', `${lp.filter((x) => x.role === 'rod').length} rod, ${fixed.length} fixed shelf`, '1 rod, 1 fixed shelf');
  const sideIn = lp.find((x) => x.name === 'Bottom')!.length - 2 * s.dadoDepth;
  eq('closet: rod runs between the sides less 1/8', rod.length, sideIn - 0.125);
  const rodTop = rod.boxes[0].min[1] + rod.boxes[0].size[1];
  const shelfUnder = fixed[0].boxes[0].min[1];
  eq('closet: rod center 1 3/4 below the shelf', +(shelfUnder - (rodTop - 1.3125 / 2)).toFixed(4), 1.75);
  eq('closet: long hang rod height', +(rodTop - 1.3125 / 2).toFixed(3) > 66, true);
  const dbl = mk('closet-double');
  const dp = buildParts(dbl, s);
  const ys = dp.filter((x) => x.role === 'rod').map((x) => Math.round(x.boxes[0].min[1]));
  eq('closet: double hang has two rods, about 80 and 40 off the floor', ys.length === 2 && ys[0] > 76 && ys[1] > 36 && ys[1] < 46, true);
  const proj = { ...p, cabinets: [long, { ...dbl, offset: 30 }, { ...mk('closet-medium'), offset: 60 }] };
  const r = closetRods(proj);
  eq('closet: rods from 8 ft lengths', `${r.count} rods, ${r.lengths} lengths`, '4 rods, 2 lengths');
  const ql = estimateMaterials(proj, quoteOf(proj)).find((l) => l.label.startsWith('Closet rods'))!;
  eq('closet: quote flags missing rod price', !!ql.missing, true);
  eq('closet: scope says double hang', scopeLine(proj.cabinets[1], proj).includes('double hang'), true);

  // Frameless: same case, no face frame, a fixed shelf for the mid rail, full overlay
  const fs = { ...s, construction: 'frameless' as const };
  const base = { ...cabinetFromPreset(presets.find((x) => x.id === 'base-1dr')!, 'back', 0, []), id: 'FB', name: 'FB' };
  const fp = buildParts(base, fs);
  eq('frameless: no face frame parts', fp.filter((x) => x.material === 'faceframe' && (x.role === 'stile' || x.role === 'rail')).length, 0);
  eq('frameless: fixed shelf between drawer and door', fp.filter((x) => x.name === 'Fixed shelf').length, 1);
  const side = fp.find((x) => x.role === 'side')!;
  eq('frameless: sides run the full depth, front banded', `${side.width} ${side.banded}`, `${base.depth} true`);
  const door = fp.find((x) => x.role === 'door')!;
  eq('frameless: door overlays the case less half the gap each side', door.width, base.width - s.doorGap);
  eq('frameless: one cabinet can stay face frame', buildParts({ ...base, overrides: { construction: 'faceframe' } }, fs).some((x) => x.role === 'stile'), true);
}

// Closets: shoe shelves and drawer banks
{
  const mk = (id: string) => ({ ...cabinetFromPreset(presets.find((x) => x.id === id)!, 'back', 0, []), id, name: id });
  const tower = buildParts(mk('closet-shoes'), s);
  const shelves = tower.filter((x) => x.name === 'Shoe shelf, slanted');
  eq('shoes: nine slanted shelves, each with a fence', `${shelves.length} ${tower.filter((x) => x.name === 'Shoe fence').length}`, '9 9');
  const sh = shelves[3].boxes;
  eq('shoes: back of the shelf higher than the front', sh[0].min[1] > sh[sh.length - 1].min[1] && sh[0].min[2] < sh[sh.length - 1].min[2], true);
  const flat = buildParts({ ...mk('closet-shoes'), rows: [{ ...mk('closet-shoes').rows[0], flatShoes: true }] }, s);
  eq('shoes: flat when asked', flat.filter((x) => x.name === 'Shoe shelf').length, 9);
  const combo = buildParts(mk('closet-shoes-hang'), s);
  eq('shoes: under a long hang, a fixed shelf between them', `${combo.filter((x) => x.role === 'rod').length} rod, ${combo.filter((x) => x.name === 'Fixed shelf').length} fixed, ${combo.filter((x) => x.name === 'Shoe fence').length} fences`, '1 rod, 1 fixed, 3 fences');
  const bank = buildParts(mk('closet-drawers'), s);
  eq('drawer bank: four drawers, a fixed shelf under the open shelves', `${bank.filter((x) => x.role === 'drawerBox').length} drawers, ${bank.filter((x) => x.name === 'Fixed shelf').length} fixed`, '4 drawers, 1 fixed');
  const dresser = mk('closet-dresser');
  const dp = buildParts(dresser, s);
  eq('dresser: four drawers under a wood top', `${dp.filter((x) => x.role === 'drawerBox').length} ${dp.some((x) => x.role === 'woodTop')}`, '4 true');
  const proj = { ...p, cabinets: [mk('closet-shoes')] };
  eq('shoes: scope wording', scopeLine(proj.cabinets[0], proj).includes('(9) slanted shoe shelves with fences'), true);
  eq('shoes: fence labor', estimateHours(proj, quoteOf(proj)).some((h) => h.label === 'Shoe fences' && h.qty === 9), true);
}

// Wardrobe, closet island, stain grade labor
{
  const mk = (id: string) => ({ ...cabinetFromPreset(presets.find((x) => x.id === id)!, 'back', 0, []), id, name: id });
  const wr = buildParts(mk('closet-wardrobe'), s);
  eq('wardrobe: rod behind a pair of doors, doors above too', `${wr.filter((x) => x.role === 'rod').length} rod, ${wr.filter((x) => x.role === 'door').length} doors`, '1 rod, 4 doors');
  const wd = buildParts(mk('closet-wardrobe-drawers'), s);
  eq('wardrobe over drawers', `${wd.filter((x) => x.role === 'rod').length} rod, ${wd.filter((x) => x.role === 'door').length} doors, ${wd.filter((x) => x.role === 'drawerBox').length} drawers`, '1 rod, 2 doors, 2 drawers');
  const isl = { ...mk('closet-island'), wallInset: 60 };
  const ends = { left: true, right: true };
  const ip = buildParts(isl, s, ends);
  const back = ip.find((x) => x.name === 'Back panel, finished')!;
  eq('island: finished back panel on the Eagle order', `${!!back} ${back.order?.item}`, 'true endPanel');
  eq('island: baseboard wraps the back by default', `${ip.some((x) => x.name === 'Baseboard, back')} ${ip.some((x) => x.name.startsWith('Toe kick'))}`, 'true false');
  const ikick = buildParts({ ...isl, base: { ...isl.base!, style: 'kick' } }, s, ends);
  eq('island: toe kick as an option, around the back', ikick.some((x) => x.name === 'Toe kick skin, back'), true);
  const top = ip.find((x) => x.role === 'woodTop')!;
  eq('island: top overhangs the back', top.boxes[0].min[2] < -s.endPanelThickness, true);
  const proj = { ...p, cabinets: [isl] };
  eq('island: stands in the room, no layout issues', findIssues(proj.room, proj.cabinets, s).map((i) => i.message).join('; '), '');
  // Stain grade raises cabinet hours by the multipliers
  const plain = { ...p, cabinets: [mk('closet-drawers')] };
  const stain = { ...plain, settings: { ...plain.settings, finish: 'stain' as const } };
  const hrs = (x: typeof plain, install: boolean) => estimateHours(x, quoteOf(x)).filter((h) => !!h.install === install && h.group === 'cabinets' && !h.label.startsWith('Drawings')).reduce((t, h) => t + h.hours, 0);
  eq('stain grade: shop hours × 1.25', +(hrs(stain, false) / hrs(plain, false)).toFixed(3), 1.25);
  const inst = (x: typeof plain) => estimateHours(x, quoteOf(x)).find((h) => h.label.startsWith('Install cabinets'))!.hours;
  eq('stain grade: installing cabinets × 1.25', +(inst(stain) / inst(plain)).toFixed(3), 1.25);
  eq('stain grade: scope says so', scopeLine(stain.cabinets[0], stain).includes('stain grade hard maple exterior'), true);
}

// Bench seat cushion
{
  const bench = { ...cabinetFromPreset(presets.find((x) => x.id === 'closet-bench')!, 'back', 0, []), id: 'BN', name: 'BN' };
  const bp = buildParts(bench, s, { left: true, right: true });
  const top = bp.find((x) => x.role === 'woodTop')!, cu = bp.find((x) => x.role === 'cushion')!;
  eq('cushion: sized to the seat, sitting on it', `${cu.length === top.length} ${cu.width === top.width} ${cu.boxes[0].min[1]}`, `true true ${bench.height + 1}`);
  const proj = { ...p, cabinets: [bench] };
  const line = estimateMaterials(proj, quoteOf(proj)).find((l) => l.label.startsWith('Custom seat cushions'))!;
  eq('cushion: on the quote, flagged for a price', `${line.cost} ${!!line.missing}`, '0 true');
  eq('cushion: scope wording', scopeLine(bench, proj).includes('custom 3” boxed and welted seat cushion, fabric to be selected by owner'), true);
  const priced = { ...proj, quote: { ...quoteOf(proj), cushionPerSqFt: 40 } };
  const placed = buildParts(bench, proj.settings, resolveEnds(proj.room, proj.cabinets, bench)).find((x) => x.role === 'cushion')!;
  eq('cushion: priced by area', +estimateMaterials(priced, quoteOf(priced)).find((l) => l.label.startsWith('Custom seat cushions'))!.cost.toFixed(2), +((placed.length * placed.width) / 144 * 40).toFixed(2));
}

// Crown against the ceiling, two-sided islands, wall openings
{
  const mk = (id: string) => ({ ...cabinetFromPreset(presets.find((x) => x.id === id)!, 'back', 0, []), id, name: id });
  const upper = { ...mk('wall-2'), elevation: 54, height: 41.5, crown: '5715' };
  const room = { ...p.room, height: 96 };
  const drop = mountShape(profileByNum('5715')!).height;
  const fit = crownFit(upper, s, room.height)!;
  eq('crown fit: over by the drop less the 1/2" gap', +fit.over.toFixed(4), +(drop - 0.5).toFixed(4));
  const msg = findIssues(room, [upper], s).map((i) => i.message).join(' ');
  eq('crown fit: message gives case top, drop and ceiling', /case top at 95 1\/2".*crown drop.*ceiling 96"/.test(msg.replace(/\u00a0/g, ' ')), true);
  eq('crown fit: room for a crown', crownRoom({ ...upper, crown: undefined }, s, room.height), 0.5);
  const shortened = { ...upper, height: upper.height - fit.over };
  eq('crown fit: shortened, it meets the ceiling', crownFit(shortened, s, room.height)!.over, 0);

  const isl = { ...mk('closet-island'), islandSides: 2 as const, wallInset: 80 };
  const ip = buildParts(isl, s, { left: true, right: true });
  eq('two-sided island: drawers both sides', ip.filter((x) => x.role === 'drawerBox').length, 6);
  eq('two-sided island: no finished back panel', ip.some((x) => x.name.startsWith('Back panel, finished')), false);
  const tops = ip.filter((x) => x.role === 'woodTop');
  const far = ip.filter((x) => x.name.endsWith('far side') && x.role === 'drawerFront');
  eq('two-sided island: one top over both, far fronts face the other way', tops.length === 1 && far.length === 3 && far.every((x) => x.boxes[0].min[2] < 0), true);
  const tb = tops[0].boxes[0];
  eq('two-sided island: top covers both sides', tb.min[2] < -isl.depth && tb.min[2] + tb.size[2] > isl.depth, true);
  const proj = { ...p, cabinets: [isl] };
  eq('two-sided island: no layout issues mid-room', findIssues(proj.room, proj.cabinets, proj.settings).map((i) => i.message).join('; '), '');
  eq('two-sided island: labor counts two cases', estimateHours(proj, quoteOf(proj)).find((h) => h.label === 'Case')!.qty, 2);
  eq('wall opening: no trim, floor to ceiling', JSON.stringify((() => { const o = newOpening('open', 'left', p); return [o.trim.flat, o.height === p.room.height, o.name]; })()), JSON.stringify([0, true, 'Wall opening 1']));
}

// A group moves the same way in the room, even a cabinet standing off another wall
{
  const room = { width: 156, depth: 120, height: 80.75 };
  const t1 = { ...cabinetFromPreset(presets.find((x) => x.id === 'tall-pantry')!, 'back', 12.75, []), id: 'T1', name: 'T1', depth: 21 };
  const t3 = { ...cabinetFromPreset(presets.find((x) => x.id === 'tall-pantry')!, 'left', 90, []), id: 'T3', name: 'T3', depth: 14, wallInset: 102.75 };
  const before = [footprint(room, t1), footprint(room, t3)];
  const after = [{ ...t1, ...shiftInRoom(t1, 3, 0) }, { ...t3, ...shiftInRoom(t3, 3, 0) }].map((c) => footprint(room, c));
  for (const w of ['back', 'left', 'right', 'front'] as const) {
    const f0 = footprint(room, t3), c0 = [(f0.x0 + f0.x1) / 2, (f0.z0 + f0.z1) / 2];
    const f1 = footprint(room, { ...t3, ...placeOn(room, t3, w, c0[0], c0[1]) });
    eq(`placeOn: turned to hang off the ${w} wall, same center`, `${(f1.x0 + f1.x1) / 2},${(f1.z0 + f1.z1) / 2}`, `${c0[0]},${c0[1]}`);
  }
  eq('group move: both shift 3" to the right in the room', after.map((f, i) => `${+(f.x0 - before[i].x0).toFixed(3)},${+(f.z0 - before[i].z0).toFixed(3)}`).join(' '), '3,0 3,0');
}

// Refrigerator surround: sides to the floor as the fridge panels, cabinet above built in between
{
  const fs = { ...cabinetFromPreset(presets.find((x) => x.id === 'tall-fridge')!, 'back', 0, []), id: 'RF', name: 'RF' };
  const fp = buildParts(fs, s);
  const side = fp.find((x) => x.role === 'side')!;
  eq('fridge surround: sides full height and full depth', `${side.length} ${side.width} ${side.boxes.length}`, `${fs.height} ${fs.depth - s.ffThickness} 1`);
  eq('fridge surround: no bottom, toe kick or bottom rail', fp.some((x) => x.name === 'Bottom' || x.role === 'toekick' || x.name === 'Bottom rail'), false);
  const shelf = fp.find((x) => x.name === 'Fixed shelf')!;
  const back = fp.find((x) => x.role === 'back')!;
  eq('fridge surround: cabinet above closed by a fixed shelf, back only above it', Math.abs(back.boxes[0].min[1] - shelf.boxes[0].min[1]) < 1e-6, true);
  const L = layoutRows(fs, s).rows;
  eq('fridge surround: fridge opening from the floor', `${L[1].y0} ${L[1].height}`, '0 71');
  const beside = { ...cabinetFromPreset(presets.find((x) => x.id === 'tall-pantry')!, 'back', 0, []), id: 'TP', name: 'TP', depth: 21, width: 30 };
  const placed = { ...fs, offset: 30 };
  const room = { width: 156, depth: 120, height: 84 };
  const ends = resolveEnds(room, [beside, placed], placed);
  eq('fridge surround: side past a shallower neighbour is exposed', ends.left, true);
  eq('fridge surround: exposed side is finished', buildParts(placed, { ...s, endPanel: 'none' }, ends).find((x) => x.name === 'Side, exposed')?.look, 'paint');
  eq('pantry beside the deeper surround stays hidden on that side', resolveEnds(room, [beside, placed], beside).right, false);
  eq('fridge surround: opening clears a 36" fridge', fs.width - 2 * s.stileWidth >= 35.75 + 2 * 0.375, true);
}

// Your own hours and costs on quote lines
{
  const base = priceQuote(p);
  const line = base.hours.find((h) => h.label === 'Case')!;
  const mat = base.materials[0];
  const q0 = quoteOf(p);
  const adj = { ...p, quote: { ...q0, hourOverrides: { [`${line.group}|${line.label}`]: line.hours + 5 }, costOverrides: { [`${mat.group}|${mat.label}`]: 123 } } };
  const r = priceQuote(adj);
  const h = r.hours.find((x) => x.label === 'Case')!;
  eq('quote override: hours used, estimate kept', `${h.hours} ${h.estimated}`, `${line.hours + 5} ${line.hours}`);
  eq('quote override: cost used', r.materials[0].cost, 123);
  eq('quote override: total moves', r.total !== base.total, true);
}

// Painting: the painter's quote, an estimate from the job's size, or an allowance
{
  const q0 = quoteOf(p);
  const pe = paintEstimate(p, q0);
  eq('paint estimate: $150 a front + $40 a sq ft of face', Math.round(pe.amount), Math.round(pe.fronts * 150 + pe.sqft * 40));
  const est = priceQuote({ ...p, quote: { ...q0, paintMode: 'estimate' } });
  eq('paint estimate: on the agreement', Math.round(est.painter), Math.round(pe.amount));
  const al = priceQuote({ ...p, quote: { ...q0, paintMode: 'allowance', paintAllowance: 3000 } });
  eq('paint allowance: flat', al.painter, 3000);
  eq('paint: painter quote by default', priceQuote({ ...p, quote: { ...q0, painter: 2000, painterMarkup: 0.1 } }).painter, 2200);
}

// Crown on everything at the ceiling, shortened to fit
{
  const room = { width: 156, depth: 120, height: 96 };
  const mk = (id: string, name: string, offset: number, patch = {}) => ({ ...cabinetFromPreset(presets.find((x) => x.id === id)!, 'back', offset, []), id: name, name, ...patch });
  const cabs = [mk('tall-pantry', 'T1', 0, { height: 95.5 }), mk('wall-2', 'W1', 24, { elevation: 54, height: 41.5 }), mk('base-1dr', 'B1', 24), mk('wall-2', 'W2', 54, { elevation: 54, height: 30 })];
  const at = cabs.filter((c) => reachesCeiling(c, room.height)).map((c) => c.name).join(',');
  eq('ceiling pick: talls and uppers within 4" of the ceiling, not bases or short uppers', at, 'T1,W1');
  const after = cabs.map((c) => (reachesCeiling(c, room.height) ? (() => { const n = { ...c, crown: '5715' }; const f = crownFit(n, s, room.height)!; return { ...n, height: n.height - Math.ceil(f.over * 16) / 16 }; })() : c));
  eq('ceiling crown: every crowned cabinet meets the ceiling', after.filter((c) => c.crown).every((c) => crownFit(c, s, room.height)!.over < 1e-6 && room.height - crownFit(c, s, room.height)!.top < 1 / 16 + 1e-6), true);
}

// Ballpark: the meeting calculator's rate card, by lineal foot
{
  const mk = (id: string, patch = {}) => ({ ...cabinetFromPreset(presets.find((x) => x.id === id)!, 'back', 0, []), ...patch });
  eq('ballpark: base', categoryOf(mk('base-1dr')), 'base');
  eq('ballpark: shallow base', categoryOf(mk('base-1dr', { depth: 12 })), 'shallowBase');
  eq('ballpark: pantry is tall', categoriesOf(mk('tall-pantry')).join(','), 'tall');
  const bc = mk('tall-pantry', { depth: 12, height: 96, rows: [{ type: 'open', count: 4 }, { type: 'doors', height: 24, count: 2 }] });
  eq('ballpark: bookcase over doors = shallow base + full-height bookcase', categoriesOf(bc as any).join(','), 'shallowBase,bookcase96');
  eq('ballpark: pilasters are off the card', categoryOf({ ...mk('base-1dr'), kind: 'pilaster' } as any), null);
  const one = { ...p, cabinets: [mk('base-1dr', { width: 36, rows: [{ type: 'drawers', count: 1 }, { type: 'doors', count: 2 }] })], quote: { ...p.quote, paintWhen: 'none' as const } };
  const b = ballpark(one);
  eq('ballpark: 3 LF unfinished base at typical', Math.round(b.total[1]), 3 * defaultRateCard.unfinished.base[1]);
  eq('ballpark: quoted range is ±10% rounded to $250', `${b.low}-${b.high}`, `${Math.round(2400 * 0.9 / 250) * 250}-${Math.round(2400 * 1.1 / 250) * 250}`);
  const painted = ballpark({ ...one, quote: { ...one.quote, paintWhen: 'prefinish' as const } });
  eq('ballpark: painted card when prefinished', Math.round(painted.total[1]), 3 * defaultRateCard.painted.base[1]);
  const c = comparableQuote({ ...one, ceiling: { ...(p as any).ceiling, on: true } });
  eq('ballpark: comparable leaves the ceiling out', Math.round(c.amount), Math.round(comparableQuote(one).amount));
  eq('ballpark: comparable estimates painting when there is no painter number', comparableQuote({ ...one, quote: { ...one.quote, paintWhen: 'prefinish' as const, painter: 0 } }).paintEstimated, true);
}

// Pricing workbook: live formulas whose cached values match the Quote tab
{
  eq('xlsx: crc32', crc32(new TextEncoder().encode('123456789')).toString(16), 'cbf43926');
  const wb = pricingWorkbook(p);
  const sum = wb.sheets[0].rows;
  const total = sum.find((r) => typeof r[0] === 'object' && (r[0] as any)?.v === 'Total')![6] as any;
  eq('xlsx: total cell matches the quote', total.v, priceQuote(p).total);
  eq('xlsx: total is a formula', /ROUND\(G\d+\/RoundTo/.test(total.f), true);
  const bytes = writeXlsx(wb);
  eq('xlsx: a zip', `${bytes[0]},${bytes[1]}`, '80,75');
}

// Shop drawings: identical cabinets share a sheet; the side panel layout shows the joinery
{
  const groups = shopGroups(p);
  eq('shop groups: every cabinet once', groups.flat().length, p.cabinets.length);
  eq('shop groups: same-built uppers share a drawing', groups.some((g) => g.length > 1), true);
  const base = p.cabinets.find((c) => c.kind === 'base')!;
  const lay = sidePanelLayout(p, base, { x: 0, y: 0, w: 4, h: 6 })!;
  eq('side layout: back rabbet and bottom dado noted', lay.notes.some((n) => /Back rabbet/.test(n)) && lay.notes.some((n) => /Dados .* bottom/.test(n)), true);
  eq('side layout: none for a pilaster', sidePanelLayout(p, { ...base, kind: 'pilaster' } as any, { x: 0, y: 0, w: 4, h: 6 }), null);
}

// The print copy: the Word layout, the total, the terms with the notice twice and blanks for the dates
{
  const doc = printQuote(p, { terms: CJC_TERMS, version: 3 });
  eq('print copy: scope and agreement', doc.includes('Project Scope of Work') && doc.includes('PURCHASE AGREEMENT'), true);
  eq('print copy: the total', doc.includes(`$${priceQuote(p).total.toLocaleString('en-US')}`), true);
  eq('print copy: notice of cancellation in duplicate', (doc.match(/NOTICE OF CANCELLATION<\/h3>/g) ?? []).length, 2);
  eq('print copy: date blanks, not placeholders', /\[CANCELLATION DEADLINE\]/.test(doc), false);
}

// Cabinet lighting: fixtures from the choices, parts with specs, drivers per wall, quote and electrician sheet
{
  const bc = { ...cabinetFromPreset(presets.find((x) => x.id === 'tall-pantry')!, 'back', 0, []), id: 'BC', name: 'BC', width: 36, depth: 12, height: 96, rows: [{ id: 'r1', type: 'open', count: 1, shelves: 4 }, { id: 'r2', type: 'doors', height: 30, count: 2, shelves: 1 }], lighting: ['stile', 'puck'] } as any;
  const lp = { ...p, cabinets: [...p.cabinets, bc] };
  const fx = cabinetFixtures(bc, lp);
  eq('lighting: two vertical strips and one puck (All Star: one 3" light is enough)', fx.map((f) => `${f.kind}:${f.count}`).join(','), 'stile:2,puck:1');
  const L = lightingParts(lp);
  eq('lighting: tape, channel, pucks, a driver, leads and cable', L.parts.map((x) => x.key).join(','), 'tape,channel,puck,driver60,lead,cable');
  eq('lighting: driver has 20% headroom', L.drivers.every((d) => d.size >= d.watts * 1.2), true);
  eq('lighting: unpriced parts flagged', lightingCost(lp).missing.length, L.parts.length);
  const priced = { ...lp, cabLighting: { prices: { tape: 4, channel: 6, puck: 20, driver60: 55, lead: 3, cable: 0.5 } } };
  const m = estimateMaterials(priced, quoteOf(priced)).find((x) => x.label.startsWith('Interior cabinet lighting'))!;
  eq('lighting: priced into materials', m.cost > 0 && !m.missing, true);
  eq('lighting: labor lines', estimateHours(priced, quoteOf(priced)).some((h) => h.label.startsWith('Lighting: route cables')), true);
  eq('lighting: electrician sheet names the 120 V feed', /120 V receptacle/.test(electricianHtml(priced)), true);
  eq('lighting: scope mentions it', scopeLine(bc, lp).includes('LED lighting'), true);
}

// Häfele adjustable shelf lighting: a profile under every shelf behind a drop edge, power channels in the sides; accent uplight on top
{
  const hc = { ...cabinetFromPreset(presets.find((x) => x.id === 'tall-pantry')!, 'back', 0, []), id: 'HC', name: 'HC', width: 36, depth: 12, height: 84, rows: [{ id: 'r1', type: 'open', count: 1, shelves: 3 }, { id: 'r2', type: 'doors', height: 30, count: 2, shelves: 1 }], lighting: ['shelves', 'topAccent'] } as any;
  const hp = { ...p, room: { ...p.room, height: 108 }, cabinets: [hc], cabLighting: { accent: 'rgbw', driverSpot: 'top' } } as any;
  const fx = cabinetFixtures(hc, hp);
  eq('hafele: a profile under each of 3 shelves and the top, plus the accent', fx.map((f) => `${f.kind}:${f.count}`).join(','), 'shelves:3,topAccent:1');
  const keys = lightingParts(hp).parts.map((x) => x.key);
  eq('hafele: bars, bus bars, power kit, 12 V driver and RGBW accent bought', ['hCustom', 'hRail', 'hConnector', 'hDriver', 'hBit', 'accentTape', 'accentControl'].every((k) => keys.includes(k as any)), true);
  const hpParts = lightingParts(hp).parts;
  eq('hafele: a 36" bookcase takes 3 custom-length bars, one per adjustable shelf', hpParts.find((x) => x.key === 'hCustom')?.qty, 3);
  eq('hafele: 2 bus bars, one pack; one power kit', `${hpParts.find((x) => x.key === 'hRail')?.qty}/${hpParts.find((x) => x.key === 'hConnector')?.qty}`, '2/1');
  eq('hafele: its Loox5 driver is apart from the generic accent driver', lightingParts(hp).drivers.map((d) => d.system).sort().join(','), 'generic,loox');
  eq('hafele: a shelf exactly 30" takes a standard bar', hafeleStandard(30), 30);
  const parts = buildParts(hc, hp.settings);
  eq('hafele: a drop edge on each adjustable shelf in the open section', parts.filter((x) => x.name === 'Shelf drop edge').length, 3);
  eq('hafele: the door section shelf stays plain', parts.filter((x) => x.name === 'Adjustable shelf' && !/Häfele/.test(x.note ?? '')).length, 1);
  eq('hafele: the sides get the power channel', parts.filter((x) => x.role === 'side').every((x) => /bus bar channel/.test(x.note ?? '')), true);
  eq('hafele: labor for channels and drop edges', estimateHours(hp, quoteOf(hp)).some((h) => h.label.startsWith('Lighting: groove shelf')), true);
  eq('hafele: drivers on top for the electrician', /on top of the bookcases/i.test(electricianHtml(hp)), true);
  const low = { ...hp, room: { ...hp.room, height: 86 } };
  eq('accent: no uplight with no room above', cabinetFixtures(hc, low).some((f) => f.kind === 'topAccent'), false);
  const cub = { ...hc, id: 'CU', rows: [{ id: 'r1', type: 'open', count: 1, shelves: 0, dividers: 3 }], lighting: ['shelfFront'] } as any;
  eq('cubby: a strip in the top of each of 4 cubbies', cabinetFixtures(cub, hp).map((f) => `${f.kind}:${f.count}`).join(','), 'shelfFront:4');
  eq('cans: the real count across and deep', canSpots({ ...hp, lights: { across: 3, deep: 2 } }).length, 6);
  // Two 33" towers (4 adjustable shelves and a fixed top light each) and a center cabinet with 4 cubbies, on a Mesh control, accent by the electrician
  {
    const tower = (id: string, offset: number) => ({ ...hc, id, name: id, offset, width: 33, height: 84, rows: [{ id: 'r1', type: 'open', count: 1, shelves: 4 }], lighting: ['shelves', 'shelfFront', 'topAccent'] });
    const w3 = { ...hc, id: 'W3', name: 'W3', offset: 33, width: 96, height: 20, elevation: 70, rows: [{ id: 'r1', type: 'open', count: 1, shelves: 0, dividers: 3 }], lighting: ['shelfFront'] };
    const cx = { ...p, room: { ...p.room, height: 108 }, cabinets: [tower('W1', 0), w3, tower('W2', 129)], cabLighting: { control: 'mesh', accent: 'others', driverSpot: 'top', kelvin: 3000 } } as any;
    const L = lightingParts(cx);
    const q = (k: string) => L.parts.find((x) => x.key === k)?.qty;
    eq('crossen: 8 shelf bars, 4 bus bars, 2 kits', `${(q('hProfile') ?? 0) + (q('hCustom') ?? 0)}/${q('hRail')}/${q('hConnector')}`, '8/4/2');
    eq('crossen: 6 fixed Loox5 lights, 6 leads, 12 caps', `${q('lxLead')}/${q('lxCap')}`, '6/12');
    eq('crossen: two 90 W drivers and two Mesh controllers, one wall control', `${L.drivers.filter((d) => d.system === 'loox').length}/${q('meshCtl')}/${q('meshWall')}`, '2/2/1');
    eq('crossen: the accent is the electrician\'s: not bought', L.parts.some((x) => x.key === 'accentTape' || x.key === 'driver30'), false);
    eq('crossen: accent noted for the electrician', /accent uplight on top of W1, W2/.test(electricianHtml(cx)), true);
    const fit = hafeleFit(cx.cabinets[0], cx)[0];
    eq('crossen: a 33" tower is custom; narrowed it fits stock 30" bars', !fit.stock && fit.bar === 30 && fit.widthFor! < 33, true);
    const fitted = { ...cx, cabinets: cx.cabinets.map((c: any) => (c.id === 'W1' || c.id === 'W2' ? { ...c, width: fit.widthFor } : c)) };
    eq('crossen: narrowed, all 8 are stock 30" bars', lightingParts(fitted).parts.find((x) => x.key === 'hProfile')?.qty, 8);
    const allow = { ...cx, cabLighting: { ...cx.cabLighting, allowance: 1950, prices: { hCustom: 76.8 } } };
    eq('crossen: the allowance replaces the parts total', estimateMaterials(allow, quoteOf(allow)).find((x) => x.label.startsWith('Interior cabinet lighting'))?.cost, 1950);
  }
  const cs = customerSet(hp, drawingsOf(hp));
  eq('hafele: the customer drawings get a lighting spec sheet', cs.some((x) => /Cabinet lighting/.test(x.svg ?? JSON.stringify(x)) && /Häfele adjustable shelf lighting/.test(JSON.stringify(x))), true);
  eq('hafele: the shop notes carry the groove and channel', forAudience(cabinetCallouts(hp, hc), 'shop').filter((n) => /Häfele (shelf lighting: groove|bus bar channel)/.test(n.text)).length, 2);
}

// Next Day Moulding: profiles priced per foot by material; crowns drawn from projection and drop
{
  const cap = profileByNum('ND-163')!;
  eq('next day: basecap 163 in primed FJ pine at $0.96/ft', priceOf(cap, 'Primed FJ pine')?.price, 0.96);
  eq('next day: labeled by supplier', profileLabel(cap), 'Next Day 163');
  const crown = profileByNum('ND-47')!;
  const m = mountShape(crown);
  eq('next day: crown 47 hangs 3-1/2 drop × 2-5/8 projection', `${m.height}x${m.depth}`, '3.5x2.625');
}

// Saved HTML reads the same however it's opened: no raw non-ASCII characters
{
  eq('ascii html: × and inch marks as entities', asciiHtml('46 3/8″ × 45 5/8″ – ok'), '46 3/8&#8243; &#215; 45 5/8&#8243; &#8211; ok');
  const d = drawingsOf(p);
  eq('ascii html: a whole drawing set is plain ASCII', /[^\x00-\x7f]/.test(asciiHtml(setDocument('t', customerSet(p, d), d.paper))), false);
}

// Editing the drawings (never the design): a view's scale, a dimension hidden or retyped, notes on sheets
{
  const d = drawingsOf(p);
  const el = customerSet(p, d).find((x) => /Back wall elevation/.test(x.title))!;
  eq('drawing edits: the elevation lists its view and scale', el.views?.[0]?.key, 'elev:back');
  const dimIds = [...el.svg.matchAll(/data-dim="([^"]+)"/g)].map((m) => m[1]);
  eq('drawing edits: every dimension has a target', dimIds.length > 5, true);
  const id = dimIds[0];
  const ed = { ...d, edits: { scales: { 'elev:back': 0.25 }, dims: { [id]: { text: 'VIF' } } }, texts: { [el.number]: [{ id: 't1', x: 2, y: 2, text: 'Verify window trim' }] } };
  const el2 = customerSet(p, ed).find((x) => /Back wall elevation/.test(x.title))!;
  eq('drawing edits: scale set by hand', el2.views?.[0]?.scale, 0.25);
  eq('drawing edits: retyped dimension', el2.svg.includes('>VIF<'), true);
  eq('drawing edits: note on the sheet', el2.svg.includes('Verify window trim'), true);
  const el3 = customerSet(p, { ...d, edits: { dims: { [id]: { hidden: true } } } }).find((x) => /Back wall elevation/.test(x.title))!;
  eq('drawing edits: hidden dimension keeps only its target', (el3.svg.match(/class="dt"/g) ?? []).length, (el.svg.match(/class="dt"/g) ?? []).length - 1);
  eq('drawing edits: targets never print', sheetCss.includes('.dwg .hit{fill:none;stroke:none}'), true);
}

// Payment schedule: 30% / balance by default; added payments by share or amount, the last takes the rest
{
  eq('schedule: default 30% deposit and balance', paymentSchedule(p, 10000).map((l) => l.amount).join(','), '3000,7000');
  const q = { ...p, quote: { ...p.quote, payments: [{ id: 'a', label: 'Deposit', pct: 0.25 }, { id: 'b', label: 'At install', amount: 4000 }], finalPaymentLabel: 'On completion' } } as any;
  eq('schedule: share, amount, remainder', paymentSchedule(q, 10000).map((l) => `${l.label}:${l.amount}`).join(','), 'Deposit:2500,At install:4000,On completion:3500');
  eq('schedule: on the agreement', quoteDoc(q).includes('($4,000 by check or bank transfer)'), true);
}
// Inset doors hang on Clip Top even when the job says Compact
{
  const base = p.cabinets.find((c) => c.kind === 'base')!;
  eq('inset hinges: Clip Top', eff({ ...base, overrides: { doorMount: 'inset' } } as any, { ...p.settings, hingeType: 'compact' }).hingeType, 'cliptop');
  const ins = { ...p, settings: { ...p.settings, doorMount: 'inset' as const, hingeType: 'compact' as const } };
  eq('inset hinges: no Compact warning on the order', hardwareOrder(ins).problems.some((x) => /Compact/.test(x.text)), false);
}

// Countertops on touching cabinets are one piece, built on the leftmost; a seam starts a new one
{
  const run = p.cabinets.filter((c) => c.wall === 'back' && c.kind === 'base' && c.countertop).sort((a, b) => a.offset - b.offset);
  const tops = (q: typeof p) => q.cabinets.flatMap((c) => buildParts(c, q.settings, resolveEnds(q.room, q.cabinets, c)).filter((x) => x.role === 'counter' || x.role === 'woodTop').map((x) => `${c.name}:${x.length}`));
  const joined = tops(p);
  eq('one-piece top: fewer tops than cabinets with tops', joined.length < run.length, true);
  const seam = { ...p, cabinets: p.cabinets.map((c) => (c.id === run[2].id ? { ...c, topSeam: true } : c)) };
  eq('one-piece top: a seam splits it', tops(seam).length, joined.length + 1);
  const wood = { ...p, cabinets: p.cabinets.map((c) => (c.kind === 'base' && c.countertop ? { ...c, topKind: 'wood' as const, topSpecies: 'Walnut' } : c)) };
  const line = estimateMaterials(wood, quoteOf(wood)).find((m) => /walnut/.test(m.label))!;
  eq('wood top: priced by species from A&M', line.cost > 0 && /A&M/.test(line.detail), true);
}

// Tall cabinets: end panels divided to line up with the doors
{
  const t = p.cabinets.find((c) => c.kind === 'tall')!;
  const panels = (c: typeof t) => buildParts(c, { ...p.settings, endPanel: 'flush' }, { left: false, right: true }).filter((x) => x.role === 'endPanel');
  eq('divided end panel: one piece per door row', panels({ ...t, splitEndPanels: true }).length, 2);
  eq('divided end panel: one piece by default', panels(t).length, 1);
}

// One wall at a time: its own accent and trim
{
  const w = { ...p, roomTrim: { walls: ['left', 'right'] as ('left' | 'right')[], base: '1827', chairHeight: 34 }, wallFinishes: { left: { accent: 'wainscot' as const }, right: { base: null } } } as any;
  eq('wall finish: wainscot boxes on the left wall', wallAccentBoxes(w, 'left').length > 3, true);
  eq('wall finish: no accent on a wall without one', wallAccentBoxes(w, 'back').length, 0);
  eq('wall finish: base off on the right wall only', roomMolds(w, 'right').some((m) => m.kind === 'roomBase'), false);
  eq('wall finish: the room base stays on the left', roomMolds(w, 'left').some((m) => m.kind === 'roomBase'), true);
}

// Corbels from Next Day under a floating shelf: drawn at their size, bought (not cut), priced in materials
{
  const k = corbelCatalog.find((x) => x.code === 'CORBEL-7')!;
  eq('corbels: size from the code (6 W x 9 H x 4 D)', `${k.w}x${k.h}x${k.d}`, '6x9x4');
  const shelf = { ...cabinetFromPreset(presets.find((x) => x.id === 'floating-shelf') ?? presets.find((x) => x.kind === 'shelf')!, 'back', 30, []), id: 'FS', name: 'FS', depth: 10, floating: { grade: 'paint' as const, face: 0.75, corbels: 2, corbelCode: 'CORBEL-7' } } as any;
  const parts = buildParts(shelf, p.settings, { left: true, right: true }).filter((x) => x.name === 'Corbel');
  eq('corbels: two under the shelf, bought', parts.length === 2 && parts.every((x) => !x.cut), true);
  const q = { ...p, cabinets: [...p.cabinets, shelf] };
  eq('corbels: priced from Next Day', estimateMaterials(q, quoteOf(q)).some((m) => m.label === 'Corbels, Next Day CORBEL-7' && Math.abs(m.cost - 2 * k.price) < 0.01), true);
}

// A top over a desk or knee space: carried across the open space between two cabinets
{
  const back = p.cabinets.filter((c) => c.wall === 'back' && c.kind === 'base').sort((a, b) => a.offset - b.offset);
  const [a, b] = [back[0], back[1]];
  const desk = { ...p, cabinets: p.cabinets.filter((c) => !(c.wall === 'back' && c.kind === 'base') || c.id === a.id || c.id === b.id).map((c) => (c.id === b.id ? { ...c, offset: a.offset + a.width + 30 } : c.id === a.id ? { ...c, topBridge: true } : c)) };
  const tops = desk.cabinets.flatMap((c) => buildParts(c, desk.settings, resolveEnds(desk.room, desk.cabinets, c)).filter((x) => x.role === 'counter' || x.role === 'woodTop'));
  eq('desk top: one piece over the knee space', tops.length, 1);
  eq('desk top: spans both cabinets and the 30" gap', tops[0].length >= a.width + 30 + b.width, true);
  eq('desk top: notes the support', /open space/.test(tops[0].note ?? ''), true);
}

// Stain grade red oak, whole job: doors, mouldings, exposed plywood and open sections follow
{
  const book = priceBook([]);
  const ro = setJobFinish(p, 'stain', 'Red oak', book, eagleDoorMaterials, moldSpeciesList);
  eq('stain job: finish', ro.settings.finish, 'stain');
  eq('stain job: species', ro.settings.woodSpecies, 'Red oak');
  eq('stain job: door material', ro.settings.doorMaterial, 'Red oak');
  eq('stain job: moulding species', /red\s*oak/i.test(ro.settings.moldSpecies ?? ''), true);
  eq('stain job: exposed plywood', /red oak/i.test(String(ro.settings.exposedPlywood ?? '')), true);
  const oc = { ...bookcase, build: { interior: 'stain' as const } };
  const ps = buildParts(oc, ro.settings);
  eq('stain job: open-section note', ps.some((x) => /stain and clear coat/.test(x.note ?? '') && x.look === 'wood'), true);
  const back = setJobFinish(ro, 'paint', 'Red oak', book, eagleDoorMaterials, moldSpeciesList);
  eq('paint job: door material back to paint grade', back.settings.doorMaterial, 'Paint-grade maple');
}

// A puzzle table: a raised lip around the top, in 3D, the drawings and the price
{
  const puzzle = { ...newTable(), id: 'pz', name: 'Puzzle table', use: 'puzzle table', length: 60, width: 40, lip: true, lipHeight: 0.75, lipWidth: 0.75 };
  const parts = tableParts(puzzle);
  const lips = parts.filter((x) => x.role === 'lip');
  eq('puzzle: four lip rails', lips.reduce((n, x) => n + x.qty, 0), 4);
  eq('puzzle: top sits inside the lip', parts.find((x) => x.role === 'top')!.length, 58.5);
  eq('puzzle: lip rail is top + lip high', lips[0].width, 1.875);
  eq('puzzle: scope names the lip', /raised 3\/4" lip/.test(tableScope(puzzle)) && /puzzle table/.test(tableScope(puzzle)), true);
  eq('puzzle: no seat count', /seats/.test(tableScope(puzzle)), false);
  eq('puzzle: lip hours', tableEstimate(puzzle, p).hours.some((h) => /lip/i.test(h.label)), true);
  const pp = { ...p, furniture: [puzzle] };
  const shop = shopSet(pp, drawingsOf(pp)), cust = customerSet(pp, drawingsOf(pp));
  eq('puzzle: shop sheet', shop.some((x) => x.title === 'Puzzle table shop drawing' && /SECTION AT THE EDGE/.test(x.svg)), true);
  eq('puzzle: customer sheet', cust.some((x) => x.title === 'Puzzle table'), true);
  eq('puzzle: on the floor plan', /Puzzle table/.test(cust.find((x) => x.title === 'Floor plan')!.svg), true);
}

// Tables priced from A&M boards: the top from 1-1/4", legs glued up from 1-5/8"
{
  const cherry = { ...newTable(), id: 'tc', species: 'Cherry' };
  const st = tableStock(cherry);
  eq('table stock: cherry is on A&M', st.missing, false);
  eq('table stock: top from 1-1/4 boards', st.lines.find((l) => l.part === 'Top')!.board, '1-1/4 x 5-1/2');
  eq('table stock: legs from 1-5/8, two layers', /^1-5\/8/.test(st.lines.find((l) => /^Leg/.test(l.part))!.board) && /2 layers/.test(st.lines.find((l) => /^Leg/.test(l.part))!.how), true);
  const e = tableEstimate(cherry, p);
  eq('table stock: lumber line from A&M', e.materials[0].label, 'Cherry lumber (A&M)');
  eq('table stock: default top 1-1/8', cherry.top, 1.125);
  for (const sp of ['Red oak', 'Walnut', 'Sapele', 'White oak']) eq(`table stock: ${sp} priced`, tableStock({ ...cherry, species: sp }).missing, false);
  eq('table scope: sapele reads as mahogany', /sapele mahogany/.test(tableScope({ ...cherry, species: 'Sapele' })), true);
}

// Identical cabinets listed once on the proposal
{
  const one = p.cabinets[0];
  const twins = { ...p, proposalDetail: 'full' as const, proposalCombine: true, cabinets: [one, { ...one, id: 'tw2', name: 'Z8' }, { ...one, id: 'tw3', name: 'Z9' }] };
  const lines = proposalScope(twins);
  eq('combine: three alike on one line', lines.filter((l) => l.includes('(3 alike)')).length, 1);
  eq('combine: off lists each', proposalScope({ ...twins, proposalCombine: false }).length >= 3, true);
}

// The finish is said on the proposal: on each cabinet and in its own section
{
  const sum = proposalSummary(p);
  eq('finish: each cabinet says painted', sum.areas.filter((a) => a.title !== 'Finishing').every((a) => a.items.every((i) => /painted/.test(i))), true);
  eq('finish: finishing section', sum.areas.some((a) => a.title === 'Finishing' && /color and sheen/.test(a.items.join(' '))), true);
  eq('finish: paint grade explained', sum.materials.some((m) => m.label === 'About paint grade'), true);
  const nat = { ...p, settings: { ...p.settings, finish: 'stain' as const, woodSpecies: 'Hard maple' }, quote: { ...p.quote, stainCoat: 'clear' as const } } as typeof p;
  const ns = proposalSummary(nat);
  eq('finish: natural maple reads clear coated', ns.areas[0].items[0].includes('clear coated') && /natural color/.test(ns.materials.find((m) => m.label === 'Finish')!.value), true);
}

// A table and the ceiling are in "What we'll build" too
{
  const tp = { ...p, furniture: [{ ...newTable(), id: 'tw', name: 'Puzzle table', use: 'puzzle table', lip: true }] };
  const a = proposalSummary(tp).areas.find((x) => x.title === 'Puzzle table');
  eq('proposal: table under its own heading', !!a && /^Solid white oak puzzle table, approx 84"L/.test(a.items[0]) && /raised 3\/4" lip/.test(a.items[0]), true);
}

// Eagle's center rail on doors and panels over 50"
{
  const tall0 = p.cabinets.find((c) => c.kind === 'tall')!;
  const tall = { ...tall0, rows: [{ ...tall0.rows[0], type: 'doors' as const, height: null, doors: 2 as const }] };
  const doors = buildParts(tall, s).filter((x) => x.role === 'door');
  eq('center rail: tall door marked for Eagle', doors.length > 0 && doors.every((d) => d.order?.centerRail === true && /center rail/.test(d.order.spec)), true);
  eq('center rail: drawn (two panels)', doors[0].boxes.length > buildParts({ ...tall, noCenterRail: true }, s).find((x) => x.role === 'door')!.boxes.length, true);
  eq('center rail: off is flagged', /not warranted/.test(buildParts({ ...tall, noCenterRail: true }, s).find((x) => x.role === 'door')!.note ?? ''), true);
  const short = buildParts(p.cabinets.find((c) => c.kind === 'base')!, s).filter((x) => x.role === 'door');
  eq('center rail: short doors none', short.every((d) => !d.order?.centerRail), true);
}

// Crown turning a room corner meets at an inside miter instead of crossing
{
  const crown = amCatalog.find((x) => x.category.toLowerCase().includes('crown') && x.shape)!.num;
  const backs = p.cabinets.filter((c) => c.wall === 'back' && c.kind === 'wall').map((c) => ({ ...c, crown }));
  const w5 = backs.reduce((a, b) => (a.offset > b.offset ? a : b));
  const r1 = { ...cabinetFromPreset(presets.find((x) => x.id === 'wall-2')!, 'right', w5.depth, backs), crown };
  const cabs = [...p.cabinets.filter((c) => !(c.wall === 'back' && c.kind === 'wall')), ...backs, r1];
  const front = (c: typeof w5) => cabinetMoldings(c, eff(c, s), resolveEnds(p.room, cabs, c)).find((m) => m.kind === 'crown' && m.facing === 'front')!;
  const a = front(w5), b = front(r1);
  eq('corner crown: back run inside-mitered at the right', a.cut?.[1], 'in');
  eq('corner crown: right run inside-mitered at the left', b.cut?.[0], 'in');
  eq('corner crown: the backs meet', Math.abs((w5.offset + a.x + a.length) - (p.room.width - b.z)) < 0.01 && Math.abs(r1.offset + b.x - a.z) < 0.01, true);
}

// Opening sizes per row, like Chief's cabinet dialog
{
  const b = p.cabinets.find((c) => c.kind === 'base' && c.rows.length > 1)!;
  const ops = rowOpenings(b, s, buildParts(b, s));
  eq('openings: one per row', ops.length, b.rows.length);
  eq('openings: width inside the stiles', Math.abs(ops[0].w - (b.width - 2 * eff(b, s).stileWidth)) < 0.001, true);
  eq('openings: fronts listed', ops.some((o) => o.fronts.length > 0), true);
}

// Beadboard between the cabinets below and above (a bench and its cubbies)
{
  const lows = p.cabinets.filter((c) => c.wall === 'back' && c.kind === 'base').slice(0, 2);
  const w = panelBetween(p, lows)!;
  const up = p.cabinets.filter((c) => c.wall === 'back' && c.kind === 'wall' && c.offset < lows[1].offset + lows[1].width);
  eq('beadboard between: starts at the countertop', Math.abs(w.bottom - (lows[0].elevation + lows[0].height + topThick(lows[0], p.settings.counterThickness))) < 0.01, true);
  eq('beadboard between: up to the uppers', Math.abs(w.bottom + w.height - Math.min(...up.map((c) => c.elevation))) < 0.01, true);
  eq('beadboard between: across the bases', w.offset === lows[0].offset && w.width === lows[1].offset + lows[1].width - lows[0].offset, true);
  eq('beadboard between: no cap under uppers', w.cap, false);
  const fromUppers = panelBetween(p, up)!;
  eq('beadboard between: picked from the uppers too', Math.abs(fromUppers.bottom - w.bottom) < 0.01, true);
}

// Benjamin Moore colors: the pick sets the 3D color and names itself on the proposal and drawings
{
  const wd = colorByCode('oc17')!;
  eq('bm: catalog loaded', bmColors.length > 3500, true);
  eq('bm: White Dove by number', wd.name, 'White Dove');
  eq('bm: search by name', searchColors('hale navy')[0].code, 'HC-154');
  eq('bm: favorites all found', favorites().length, cabinetFavorites.length);
  const pp = { ...withNamed(p, 'paint', wd), finishes: { ...withNamed(p, 'paint', wd).finishes, paintSheen: 'Satin' } };
  eq('bm: sets the cabinet color', pp.finishes.paint, wd.hex);
  const fin = proposalSummary(pp).materials.find((m) => m.label === 'Finish')!.value;
  eq('bm: on the proposal', /Benjamin Moore White Dove OC-17, satin finish \(proposed/.test(fin), true);
  eq('bm: in the drawing notes', jobCallouts(pp, 'customer').some((x) => /^Paint: Benjamin Moore White Dove OC-17, satin/.test(x)), true);
  eq('bm: cleared', withNamed(pp, 'paint', null).finishes.named?.paint, undefined);
}

// A cabinet finished apart from the job: an accent color, or a stained island on a painted job
{
  const hale = colorByCode('HC-154')!;
  const b = p.cabinets.find((c) => c.kind === 'base')!;
  const accent = { ...p, cabinets: p.cabinets.map((c) => (c.id === b.id ? { ...c, island: true, paint: { hex: hale.hex, named: { brand: hale.brand, code: hale.code, name: hale.name } } } : c)) };
  eq('accent: 3D color', finishColors(eff(accent.cabinets.find((c) => c.id === b.id)!, s), accent.finishes, accent.cabinets.find((c) => c.id === b.id)!.paint).paint, hale.hex);
  const am = proposalSummary(accent).materials.find((m) => m.label === 'Accent finish: Island');
  eq('accent: on the proposal', am?.value, 'Painted Benjamin Moore Hale Navy HC-154');
  eq('accent: on the cabinet line', proposalSummary(accent).areas.some((a) => a.items.some((i) => /^Island, painted Benjamin Moore Hale Navy HC-154/.test(i))), true);
  const book = priceBook([]);
  const patch = cabinetFinishPatch(p, b, 'stain', 'White oak', book, eagleDoorMaterials, moldSpeciesList);
  const stained = { ...p, cabinets: p.cabinets.map((c) => (c.id === b.id ? { ...c, ...patch, island: true } : c)) };
  const sb = stained.cabinets.find((c) => c.id === b.id)!;
  eq('stained island: stain grade white oak', eff(sb, s).finish === 'stain' && eff(sb, s).woodSpecies === 'White oak' && eff(sb, s).doorMaterial === 'White oak', true);
  eq('stained island: frame off its own stock', buildParts(sb, s).filter((x) => x.material === 'faceframe' && x.cut).every((x) => x.species === 'White oak'), true);
  eq('stained island: priced as white oak stock', estimateMaterials(stained, quoteOf(stained)).some((m) => /^White oak stock \(stain grade cabinets\)/.test(m.label)), true);
  eq('stained island: own Eagle request', eagleRequests(stained).filter((r) => r.kind === 'doors').length >= 2, true);
  eq('stained island: proposal says so', proposalSummary(stained).materials.some((m) => m.label === 'Accent finish: Island' && /^Stain grade white oak, stained and clear coated/.test(m.value)), true);
  eq('stained island: back to the job', cabinetFinishPatch(stained, sb, 'job', 'White oak', book, eagleDoorMaterials, moldSpeciesList).overrides, undefined);
}

// An extra paint color (or a stained island) adds to the painting line
{
  const hale = colorByCode('HC-154')!;
  const b = p.cabinets.find((c) => c.kind === 'base')!;
  const one = { ...p, quote: { ...p.quote, paintMode: 'allowance' as const, paintAllowance: 1000 } } as typeof p;
  const two = { ...one, cabinets: one.cabinets.map((c) => (c.id === b.id ? { ...c, paint: { hex: hale.hex, named: { brand: hale.brand, code: hale.code, name: hale.name } } } : c)) };
  eq('extra color: none on a one-color job', extraFinishes(one).length, 0);
  eq('extra color: the accent counts', extraFinishes(two).join(), 'Hale Navy HC-154');
  eq('extra color: $250 added', paintCalculated(two, quoteOf(two)) - paintCalculated(one, quoteOf(one)), 250);
}

// Start date and duration on the agreement
{
  const sp = { ...p, proposalStart: 'Week of March 8, 2027', proposalDuration: '3 to 4 weeks' };
  eq('agreement: start date', /Estimated Start Date<\/th><td>Week of March 8, 2027/.test(quoteDoc(sp)), true);
  eq('agreement: duration', /Project Duration<\/th><td>3 to 4 weeks/.test(quoteDoc(sp)), true);
  eq('print copy: start and duration', /Week of March 8, 2027/.test(printQuote(sp, { terms: CJC_TERMS })) && /3 to 4 weeks/.test(printQuote(sp, { terms: CJC_TERMS })), true);
}

// Light rail: back bands first, on uppers
{
  eq('light rail: back bands listed first', moldCategories.lightRail[0], 'Back Band');
  const w = p.cabinets.find((c) => c.kind === 'wall')!;
  const bb = amCatalog.find((x) => x.category === 'Back Band' && x.shape)!;
  const lr = cabinetMoldings({ ...w, lightRail: bb.num }, eff(w, s), resolveEnds(p.room, p.cabinets, w)).filter((m) => m.kind === 'lightRail');
  eq('light rail: hangs under the upper', lr.length > 0 && lr.every((m) => m.hang && m.y === 0), true);
}

// Brosco B688: a square-topped board; its relief kerf goes to the wall and the eased edge to the room
{
  const m = mountShape(profileByNum('BR-B688')!);
  const mid = m.pts.filter(([, y]) => y > m.height * 0.2 && y < m.height * 0.8);
  eq('B688: relief kerf against the wall', Math.max(...mid.filter(([x]) => x < m.depth / 2).map(([x]) => x)) > 0.03 && Math.min(...mid.filter(([x]) => x >= m.depth / 2).map(([x]) => x)) > m.depth - 0.03, true);
  const top = m.pts.filter(([, y]) => y > m.height - 0.01);
  eq('B688: eased edge on the room side at the top', Math.min(...top.map(([x]) => x)) < 0.01 && Math.max(...top.map(([x]) => x)) < m.depth - 0.05, true);
}

// Baseboards mount with their back to the wall and the moulded top edge on the room side (Next Day draws theirs mirrored)
{
  for (const num of ['1827', 'ND-622', 'ND-660', 'ND-235', 'ND-620', 'BR-8712', 'BR-8721']) {
    const pr = profileByNum(num);
    if (!pr) continue;
    const m = mountShape(pr);
    const top = m.pts.filter(([, y]) => y > m.height - 0.05);
    eq(`baseboard ${num}: back to the wall, top edge at the back`, top.length > 0 && Math.min(...top.map(([x]) => x)) < m.depth * 0.25, true);
  }
}

// A baseboard across touching cabinets is one run: no seam at the joint, and the cabinet keeps its height
{
  const bases = p.cabinets.filter((c) => c.wall === 'back' && c.kind === 'base').sort((a, b) => a.offset - b.offset);
  const pair = bases.find((c, i) => bases[i + 1] && Math.abs(c.offset + c.width - bases[i + 1].offset) < 0.01)!;
  const bb = { style: 'baseboard' as const, height: 4.5, build: 'faceframe' as const, shape: 'bracket' as const, rise: 3, foot: 2.25 };
  const cabs = p.cabinets.map((c) => (c.wall === 'back' && c.kind === 'base' ? { ...c, base: bb, baseMold: 'BR-B688' } : c));
  const a = cabs.find((c) => c.id === pair.id)!;
  const run = cabinetMoldings(a, eff(a, s), resolveEnds(p.room, cabs, a)).find((m) => m.kind === 'baseMold' && m.facing === 'front')!;
  eq('baseboard run: joined to the next cabinet', run.joined?.[1], true);
  eq('baseboard: cabinet keeps its height', Math.max(...buildParts(a, s, resolveEnds(p.room, cabs, a)).filter((x) => x.role === 'stile').flatMap((x) => x.boxes.map((b) => b.min[1] + b.size[1]))), a.height);
}

// A toe kick or a baseboard, never both: base moulding on a toe-kick cabinet makes it a baseboard wrap
{
  const b = p.cabinets.find((c) => c.kind === 'base' && c.elevation < 0.5 && !c.corner)!;
  const kicked = { ...b, base: { ...b.base, style: 'kick' as const }, baseMold: 'BR-B688' } as any;
  const parts = buildParts(kicked, s);
  eq('base moulding: no toe kick parts left', parts.filter((x) => x.role === 'toekick' || /Toe kick/.test(x.name)).length, 0);
  eq('base moulding: stiles run to the floor', Math.min(...parts.filter((x) => x.role === 'stile').flatMap((x) => x.boxes.map((bx) => bx.min[1]))), 0);
  eq('base moulding: the moulding sits at the floor on the face frame, not in front of a kick', cabinetMoldings(kicked, eff(kicked, s), resolveEnds(p.room, [kicked], kicked)).find((m) => m.kind === 'baseMold' && m.facing === 'front')!.y, 0);
}

// Sloped ceilings: an attic closet's roof slope at the back wall, a hip ceiling, cabinets fit or cut to the slope
{
  const room = { width: 72, depth: 60, height: 96, slopes: { back: { knee: 48, pitch: 12 } } };
  eq('slope: knee height at the wall', ceilingAt(room, 30, 0), 48);
  eq('slope: 12/12 rises a foot per foot', ceilingAt(room, 30, 24), 72);
  eq('slope: flat ceiling past the slope', ceilingAt(room, 30, 55), 96);
  const hip = { width: 132, depth: 125, height: 118, slopes: Object.fromEntries(['back', 'left', 'right', 'front'].map((w) => [w, { knee: 80, pitch: 8 }])) } as any;
  eq('hip: flat in the middle', ceilingAt(hip, 66, 62), 118);
  eq('hip: lowest in the corners', ceilingAt(hip, 0, 0), 80);
  const tower = { ...cabinetFromPreset(presets.find((x) => x.id === 'tall-pantry')!, 'back', 10, []), id: 'SL', name: 'SL', width: 30, depth: 16, height: 84, elevation: 0, crown: undefined, rows: [{ id: 'r1', type: 'open', count: 1, shelves: 4 }] } as any;
  const iss = findIssues(room as any, [tower], s).map((i) => i.message).join(' ');
  eq('slope: a cabinet into the slope is flagged with what fits', /runs into the sloped ceiling.*cut its top to the slope \(47 1\/2" at the back, 63 1\/2" at the front\)/.test(iss), true);
  const fit = slopeFit(room as any, tower)!;
  const cut = { ...tower, height: fit.front, slopeTop: { back: fit.back } };
  eq('slope: cut to the slope, no more flags', findIssues(room as any, [cut], s).filter((i) => /slope/.test(i.message)).length, 0);
  const parts = buildParts(cut, s);
  const line = (z: number) => fit.back + ((fit.front - fit.back) * z) / cut.depth;
  const above = parts.flatMap((x) => x.boxes.filter((b) => b.min[2] < cut.depth - 1.5).map((b) => b.min[1] + b.size[1] - line(b.min[2]))).filter((d) => d > 0.02);
  eq('slope: nothing behind the face frame pokes above the slope', above.length, 0);
  eq('slope: both sides cut to the slope', parts.filter((x) => x.role === 'side' && x.shapes?.length && /cut to the slope/.test(x.note ?? '')).length, 2);
  eq('slope: the top tilts under it', parts.some((x) => x.role === 'top' && /Tilted to the slope \(45\.0°\)/.test(x.note ?? '')), true);
  eq('slope: a high shelf gets shallower', parts.some((x) => x.role === 'shelf' && /Shallower under the slope/.test(x.note ?? '')), true);
  eq('slope: the elevation follows the ceiling', wallCeiling(room as any, 'left').map(([, h]) => h).join(','), '96,96,60,48');
}

// The customer's documents name no suppliers; Brosco profiles take Next Day's price where Next Day sells them; the profiles sheet
{
  const cp = { ...p, client: { first: 'Pat', last: 'Doe', address: '1 Main St', email: '', phone: '' },
    cabinets: p.cabinets.map((c, i) => (c.kind === 'wall' ? { ...c, crown: 'BR-B688' } : c.kind === 'base' && i < 3 ? { ...c, baseMold: 'ND-163' } : c)) } as any;
  const sup = /Eagle|Brosco|Next Day|A&M |A&amp;M /i;
  eq('no suppliers: quote document', sup.test(quoteDoc(cp, { online: true })), false);
  eq('no suppliers: customer drawings', customerSet(cp, drawingsOf(cp)).some((x) => sup.test(x.svg) || sup.test(x.title)), false);
  eq('suppliers kept for the shop', shopSet(cp, drawingsOf(cp)).some((x) => /Brosco B688/.test(x.svg)), true);
  const cs = customerSet(cp, drawingsOf(cp));
  eq('profiles sheet: crown and base drawn for the customer', cs.some((x) => x.title === 'Moulding & beadboard profiles' && /Crown: profile B688/.test(x.svg) && /Base: profile 163/.test(x.svg)), true);
  eq('profiles sheet: on the cover index', /Moulding &amp; beadboard profiles/.test(cs[0].svg), true);
  const b665 = { ...cp, cabinets: cp.cabinets.map((c: any) => (c.kind === 'base' ? { ...c, baseMold: 'BR-B665' } : c)) };
  const line = moldingOrder(b665).find((l) => l.num === 'BR-B665')!;
  eq('brosco: B665 priced from Next Day 5089, which lists it', `${(line.via as any)?.code}/${line.price}`, '5089/1.1');
  const picked = moldingOrder({ ...cp, moldSource: { 'BR-B688': 'ND-660' } }).find((l) => l.num === 'BR-B688')!;
  eq('brosco: B688 priced from the Next Day item picked for it', picked.price != null && (picked.via as any)?.code === '660', true);
  eq('brosco: unpicked and unlisted stays unpriced', moldingOrder(cp).find((l) => l.num === 'BR-B688')!.price, null);
}

// A bench: a seat on legs and aprons, a slatted shoe shelf, an upholstered cushion; drawn, priced and on the proposal
{
  const b = { ...newBench(), shelf: 'slats' as const, cushion: true };
  const bp = { ...p, furniture: [b], quote: { ...p.quote, cushionPerSqFt: 40 } } as any;
  const parts = tableParts(b);
  eq('bench: four legs, rails and slats for the shoe shelf', ['leg', 'stretcher', 'slat'].every((r) => parts.some((x) => x.role === r)), true);
  eq('bench: slats sit between the legs', parts.filter((x) => x.role === 'slat').every((x) => x.boxes.every((bx) => bx.min[0] >= -b.length / 2 + 1.5 + b.legSize - 0.01)), true);
  eq('bench: seat height with the cushion', seatHeight(b), 20);
  eq('bench: checks flag a 20" seat', benchChecks(b).some((c) => /Seat height is 20"/.test(c)), true);
  eq('bench: the cushion is not bought as lumber', tableStock(b).lines.some((l) => /cushion/i.test(l.part)), false);
  const est = tableEstimate(b, bp);
  eq('bench: shelf hours and the upholsterer priced', est.hours.some((h) => /Lower shelf/.test(h.label)) && est.materials.some((m) => /cushion/.test(m.label) && m.cost > 0), true);
  eq('bench: on the proposal', /closet|bench/.test(tableScope(b)) && /slatted lower shelf for shoes/.test(tableScope(b)), true);
  eq('bench: its own drawing sheet', customerSet(bp, drawingsOf(bp)).some((x) => x.title === 'Bench'), true);
}

// The check / bank transfer discount: card prices gross up so 3% off lands exactly on the quote
{
  for (const v of [25000, 7500, 1234, 99999, 1]) eq(`discount: $${v} by check is ${cardOf(v, 0.03)} by card, back to the dollar`, Math.round(cardOf(v, 0.03) * 0.97), v);
  const lines = cardLines([{ price: 12000 }, { price: 8000 }, { price: 5000 }], 0.03);
  eq('discount: card lines add up to the card total', lines.reduce((t, l) => t + l.price, 0), cardOf(25000, 0.03));
  const dp = { ...p, client: { first: 'Pat', last: 'Doe', address: '1 Main St', email: '', phone: '' } } as any;
  const total = quoteTotals(dp).total;
  const doc = quoteDoc(dp, { online: true });
  eq('discount: on by default, 3%', checkDiscountOf(dp), 0.03);
  eq('discount: the agreement lists the card total and the check price', doc.includes(`$${cardOf(total, 0.03).toLocaleString('en-US')}`) && doc.includes('Paying by check or bank transfer: 3% off') && doc.includes(`$${total.toLocaleString('en-US')}`), true);
  eq('discount: the schedule shows both', /by check or bank transfer\)/.test(doc), true);
  eq('discount: the paper copy has the choice to tick', /Paying by: &#9744; check or bank transfer/.test(printQuote(dp, { terms: '' })), true);
  const off = { ...dp, quote: { ...dp.quote, checkDiscount: 0 } };
  eq('discount: 0 turns it off (one price)', quoteDoc(off, { online: true }).includes('Paying by check'), false);
}

// A mantel with only pilasters above the shelf: no frame and panel, the chimney face between them is wall
{
  const mt = { ...cabinetFromPreset(presets.find((x) => x.kind === 'mantel')!, 'front', 40, []), id: 'MW', name: 'M1' } as any;
  const base = { ...mt, mantel: { ...mt.mantel, chimney: true, upper: { on: true, top: 98, plinth: 0, frameStile: 3, frameRail: 3.5 } } };
  const wall = { ...base, mantel: { ...base.mantel, upper: { ...base.mantel.upper, between: 'wall' } } };
  const names = (c: any) => buildParts(c, s).map((x) => x.name);
  eq('mantel: frame and panel by default', names(base).includes('Overmantel panel'), true);
  eq('mantel: pilasters only leaves the panel out', names(wall).some((n) => /Overmantel (panel|stile|rail)/.test(n)), false);
  eq('mantel: upper pilasters still there', names(wall).filter((n) => /Upper pilaster/.test(n)).length > 0, true);
  eq('mantel: the chimney face above the shelf is wall color', buildParts(wall, s).some((x) => x.name === 'Chimney face, above the mantel' && x.look === 'wall'), true);
}

// An upper set on the top below it: a 28-1/2" base with a wood top (1-1/4" unless set) is 29-3/4", not 30"
{
  const base = { ...cabinetFromPreset(presets.find((x) => x.id === 'library-base')!, 'back', 0, []), id: 'lb', name: 'B1', height: 28.5, topThickness: undefined };
  const up = { ...cabinetFromPreset(presets.find((x) => x.id === 'library-upper')!, 'back', 0, []), id: 'lu', name: 'W1', elevation: 30 };
  const iss = findIssues(p.room, [base, up], s).filter((i) => i.cabinetId === 'lu').map((i) => i.message).join(' ');
  eq('top below: gap found', /1\/4" above the top of B1 \(top surface at 29 3\/4"\)/.test(iss), true);
  eq('top below: none once it sits on the top', findIssues(p.room, [base, { ...up, elevation: 29.75 }], s).filter((i) => i.cabinetId === 'lu').length, 0);
  eq('top below: 1-1/2" top meets at 30"', findIssues(p.room, [{ ...base, topThickness: 1.5 }, up], s).filter((i) => i.cabinetId === 'lu').length, 0);
}

// A TV on the wall, sized from its screen
{
  const tv = { ...newTV(p, 'back', 78, 40), size: 70 };
  const sz = tvSize(tv);
  eq('tv: 70" about 62" x 35-5/8"', [Math.abs(sz.w - 62) < 0.5, Math.abs(sz.h - 35.6) < 0.5].join(), 'true,true');
  eq('tv: spec sheet size wins', tvSize({ ...tv, w: 61.5, h: 35 }).w, 61.5);
  const tp = { ...p, tvs: [tv] };
  eq('tv: on the elevation', /70" TV \(62" × 35 5\/8"\)/.test(wallElevation(tp, 'back', { x: 0, y: 0, w: 15, h: 9 }, 'customer').svg), true);
}

// To quote, split by where each job stands (made-up clients, named the way Cody's folders and files are)
{
  const day = 86400000, now = Date.parse('2026-11-05T12:00:00Z');
  const folders = ['Abbot, Ann - Holden', 'Baker', 'Carver', 'Dunn', 'Ellis, Eve - Bolton', 'Foster, Fay - Berlin', 'Grant, Gus', 'Hale, Hope - Clinton'].map((name, i) => ({ id: `f${i}`, name }));
  const files = new Map<string, { name: string; modified: number }[]>([
    ['Baker', [{ name: 'Baker.docx', modified: Date.parse('2026-05-11') }, { name: 'Baker.plan', modified: 0 }]],
    ['Carver', [{ name: 'Carol_Carver_Buffet_Quote.docx', modified: Date.parse('2026-10-22') }, { name: 'carver - buffet.pdf', modified: 0 }]],
    ['Dunn', [{ name: 'Dunn - demo.docx', modified: Date.parse('2026-09-27') }]],
    ['Grant, Gus', [{ name: 'Grant layout for cabinet order.pdf', modified: Date.parse('2026-11-01') }]],
    ['Hale, Hope - Clinton', [{ name: 'Proposal sent 2026-11-04.txt', modified: Date.parse('2026-11-04') }]],
  ]);
  const jobs = [
    { job_id: 'ellis-ab12cd', project: 'Ellis, Eve - Bolton', publishedAt: now - 5 * day, views: 10, lastViewed: now - 4 * day, signed: { name: 'Eve Ellis', at: now - 5 * day, version: 1, current: true }, cancelled: null },
    { job_id: 'foster-ef34gh', project: 'Foster Project Proposal', publishedAt: now - 2 * day, views: 8, lastViewed: now - day, signed: null, cancelled: null },
  ] as unknown as import('../src/portal').JobStatus[];
  const st = quoteStates(folders, jobs, files, now);
  const k = (n: string) => st.get(folders.find((f) => f.name === n)!.id)!;
  eq('queue: nothing yet, to build', k('Abbot, Ann - Holden').kind, 'build');
  eq('queue: Word quote named for the client counts as sent', k('Baker').kind, 'sent');
  eq('queue: underscored quote file counts', k('Carver').kind, 'sent');
  eq('queue: a drawing PDF alone does not', k('Grant, Gus').kind, 'build');
  eq('queue: marked sent', k('Hale, Hope - Clinton').kind, 'sent');
  eq('queue: on the portal, matched by last name', k('Foster, Fay - Berlin').kind, 'sent');
  eq('queue: signed on the portal', k('Ellis, Eve - Bolton').kind, 'signed');
  eq('queue: old quote flagged to follow up', (k('Baker') as { followUp: boolean }).followUp, true);
}

// Case plywood by cabinet: birch bases on a red oak job, what shows stays red oak
{
  const job = { ...p, settings: { ...p.settings, plywood: 'Red oak', exposedPlywood: undefined }, cabinets: p.cabinets.map((c) => (c.kind === 'base' ? { ...c, overrides: { ...c.overrides, plywood: 'Prefinished birch' } } : c)) };
  const dp = designParts(job, job.cutlist ?? defaultCutlist(job));
  const base = dp.filter((d) => job.cabinets.find((c) => c.name === d.cabinet)?.kind === 'base');
  eq('case plywood: base case in birch', base.filter((d) => d.name === 'Bottom').every((d) => /prefinished birch/.test(d.material)), true);
  eq('case plywood: base toe kick skin still red oak', base.filter((d) => d.name === 'Toe kick skin').every((d) => /red oak/.test(d.material)), true);
  eq('case plywood: base exposed side still red oak', base.filter((d) => d.name === 'Side, exposed').every((d) => /red oak/.test(d.material)), true);
  eq('case plywood: uppers in red oak', dp.filter((d) => job.cabinets.find((c) => c.name === d.cabinet)?.kind === 'wall').every((d) => /red oak/.test(d.material)), true);
  eq('case plywood: proposal says which', proposalSummary(job).materials.find((m) => m.label === 'Construction')!.value, 'Face frame cabinets with prefinished birch plywood interiors for the base cabinets (clear factory finish inside); red oak plywood interiors for the upper cabinets and tall cabinets');
}

// Knobs and pulls: drawn where they go; finger pulls instead of hardware
{
  const c = p.cabinets.find((x) => x.kind === 'base' && x.rows.some((r) => r.type === 'drawer') && x.rows.some((r) => r.type === 'doors'))!;
  const parts = buildParts(c, p.settings, resolveEnds(p.room, p.cabinets, c));
  const std = pullSpots(p, c, parts);
  eq('pulls: knobs on the doors by default', std.filter((h) => h.kind === 'knob').length >= parts.filter((x) => x.role === 'door').length, true);
  eq('pulls: a pull on the drawer', std.some((h) => h.kind === 'bar'), c.width >= 12 + 3);
  eq('pulls: standard scope', hardwareScope(p).join(' | '), 'Customer responsible for providing knobs/pulls. CJC responsible for installation');
  const fp = { ...p, settings: { ...p.settings, pulls: 'finger' as const } };
  const fin = pullSpots(fp, c, parts);
  eq('pulls: finger grips only', fin.every((h) => h.kind === 'finger'), true);
  eq('pulls: one grip per front', fin.length, parts.filter((x) => (x.role === 'door' || x.role === 'drawerFront') && x.name !== 'False front').length);
  const drawer = parts.find((x) => x.role === 'drawerFront' && x.name !== 'False front')!;
  const top = Math.max(...drawer.boxes.map((b) => b.min[1] + b.size[1]));
  eq('pulls: drawer grip at its top edge, 6" long', fin.some((h) => Math.abs(h.y - (top - 0.25)) < 0.01 && h.len === 6), true);
  eq('pulls: finger scope', hardwareScope(fp).join(' | '), 'Integrated finger pulls routed into the doors and drawer fronts; no knobs or pulls');
  eq('pulls: drawn as bands on the elevation', hardwareItems(fp, c, parts).every((i) => i.cls === 'hw finger'), true);
  const lines = estimateHours(fp, quoteOf(fp)).map((l) => l.label);
  eq('pulls: finger pulls priced, no pull install', [lines.some((l) => /^Finger pulls, routed/.test(l)), lines.some((l) => /Install pulls/.test(l))].join(), 'true,false');
  eq('pulls: proposal lists them', proposalSummary(fp).materials.find((m) => m.label === 'Knobs & pulls')!.value, 'Integrated finger pulls routed into the doors and drawer fronts; no knobs or pulls');
}

// Lift-up doors on uppers: one door per opening on an Aventos, no hinge cups
{
  const job = { ...p, cabinets: p.cabinets.map((c) => (c.kind === 'wall' ? { ...c, rows: c.rows.map((r) => (r.type === 'doors' ? { ...r, doors: 1 as const, lift: true } : r)) } : c)) };
  const w = job.cabinets.find((c) => c.kind === 'wall' && c.rows.some((r) => r.type === 'doors'))!;
  const parts = buildParts(w, job.settings, resolveEnds(job.room, job.cabinets, w));
  const doors = parts.filter((x) => x.role === 'door');
  eq('lift: one lift-up door per door row', doors.map((d) => d.name).join(), w.rows.filter((r) => r.type === 'doors').map(() => 'Lift-up door').join());
  const hw = hardwareOrder(job);
  eq('lift: counted for the Aventos, no hinges for them', hw.lifts, job.cabinets.filter((c) => c.kind === 'wall').reduce((t, c) => t + c.rows.filter((r) => r.type === 'doors').length, 0));
  eq('lift: flagged to order separately', hw.problems.some((x) => /Aventos/.test(x.text)), true);
  const reqs = eagleRequests(job).filter((r) => r.lines?.some?.(() => true) ?? true);
  eq('lift: Eagle request with no hinge holes', JSON.stringify(reqs).includes('Lift-up doors (Blum Aventos): no hinge holes'), true);
  const sp = pullSpots(job, w, parts);
  const d0 = doors[0].boxes.reduce((m, b) => Math.min(m, b.min[1]), Infinity);
  eq('lift: pull at the bottom of the door', sp.every((h) => h.y - d0 < 3), true);
}

// Bench stretchers: H or all around, priced and in the scope; none under a shelf
{
  const b = { ...newBench(), stretchers: 'h' as const };
  const parts = tableParts(b);
  eq('stretchers: H is two ends and a center', parts.filter((x) => x.role === 'stretcher').map((x) => `${x.name} x${x.qty}`).join(', '), 'Stretcher, end x2, Stretcher, center x1');
  eq('stretchers: in the scope', /H stretcher/.test(tableScope(b)), true);
  const box4 = tableParts({ ...b, stretchers: 'box' }).filter((x) => x.role === 'stretcher');
  eq('stretchers: box is four', box4.reduce((t, x) => t + x.qty, 0), 4);
  eq('stretchers: none under a shelf', tableParts({ ...b, shelf: 'slats' }).some((x) => /^Stretcher/.test(x.name)), false);
}

// Check discount switched off for one job: one price, no card or check wording anywhere
{
  const off = { ...p, quote: { ...quoteOf(p), checkDiscount: 0 } };
  const on = { ...p, quote: { ...quoteOf(p), checkDiscount: undefined } };
  const words = /by card|bank transfer|card price/i;
  eq('discount off: quote doc has no card/check wording', words.test(quoteDoc(off)), false);
  eq('discount off: printed quote has none', words.test(printQuote(off, { terms: '' })), false);
  eq('discount on: quote doc mentions it', words.test(quoteDoc(on)), true);
}

// Meeting: laser and typed measurements read as inches; the visit goes in the client sheet
{
  eq('measure: fraction', parseMeasure('92 5/16'), 92.3125);
  eq('measure: decimal inches', parseMeasure('92.3125'), 92.3125);
  eq('measure: feet and inches', parseMeasure(`7'8 1/2"`), 92.5);
  eq('measure: inches word', parseMeasure('36 in'), 36);
  eq('measure: meters', Math.round(parseMeasure('2.345 m')! * 1000) / 1000, 92.323);
  eq('measure: millimeters', Math.round(parseMeasure('2345mm')! * 1000) / 1000, 92.323);
  eq('measure: decimal feet', parseMeasure('7.5 ft'), 90);
  eq('measure: junk', parseMeasure('abc'), null);
  const v = { ...newVisit('v1'), at: Date.UTC(2026, 10, 9, 15), notes: 'Wants painted built-ins', site: { pre1978: { state: 'issue' as const, note: 'Built 1950' } }, utilities: [{ id: 'u1', kind: 'outlet' as const, wall: 'back' as const, offset: 30, height: 18, note: 'Moves' }] };
  const doc = visitsDoc([v]).join('\n');
  eq('meeting: notes, concerns and outlets in the sheet', [/Wants painted built-ins/.test(doc), /\*\*Built before 1978\*\*: Built 1950/.test(doc), /\| Outlet \| Back wall \| 30" \| 18" \| Moves \|/.test(doc)].join(), 'true,true,true');
}

// Claude's visit summary: the request carries the notes and concerns; a bad answer is refused
{
  const v = { ...newVisit('v2'), notes: 'Bookcases both sides of fireplace, painted', site: { electrician: { state: 'issue' as const, note: 'Wants sconces' } } };
  const req = summaryRequest(v, '', { width: 144, depth: 120, height: 96 }, 2);
  eq('summary: request has the notes and the concern', [/Bookcases both sides/.test(req), /Electrician needed \(CONCERN\): Wants sconces/.test(req), /JSON only/.test(req)].join(), 'true,true,true');
  eq('summary: reads a good answer', readSummary({ summary: 'Two bookcases.', scope: ['Painted bookcases', ''], questions: ['Finish?'], followUps: [] })?.scope.join(), 'Painted bookcases');
  eq('summary: refuses junk', readSummary('nope'), null);
}

// Seam batten over the joint between two cases, up into the sub-crown
{
  const run = p.cabinets.filter((c) => c.wall === 'back' && c.kind === 'wall').sort((a, b) => a.offset - b.offset);
  const left = run.find((c) => !resolveEnds(p.room, p.cabinets, c).right)!;
  const cab = { ...left, seamCover: { width: 1.75, thickness: 0.5 }, crownBuild: { subCrown: 3, rise: 0, drop: 0, extra: [] } };
  const job = { ...p, cabinets: p.cabinets.map((c) => (c.id === left.id ? cab : c)) };
  const parts = buildParts(cab, job.settings, resolveEnds(job.room, job.cabinets, cab));
  const b = parts.find((x) => x.name === 'Seam batten');
  const sub = parts.find((x) => x.name === 'Sub-crown')!;
  eq('seam: batten centered on the joint', b ? b.boxes[0].min[0] + b.boxes[0].size[0] / 2 : null, cab.width);
  eq('seam: dies into the sub-crown', b ? b.boxes[0].min[1] + b.boxes[0].size[1] : null, sub.boxes[0].min[1]);
  eq('seam: priced', estimateHours(job, quoteOf(job)).some((l) => /Seam battens/.test(l.label)), true);
  const free = { ...cab, offset: 0, wall: 'front' as const };
  eq('seam: none on an exposed end', buildParts(free, job.settings, { left: true, right: true }).some((x) => x.name === 'Seam batten'), false);
}

// Edge profiles: the section closes, the top draws it, the sheet and the scope name it
{
  for (const pr of ['eased', 'round12', 'chamfer', 'cove', 'ogee', 'thumbnail', 'halfBull', 'bullnose'] as const) {
    const c = edgeCurve(pr, 1.25);
    eq(`edge ${pr}: runs top to bottom inside the edge`, [Math.abs(c[0][1] - 1.25) < 0.08, c[c.length - 1][1] < 0.08, c.every(([i, y]) => i >= -1e-9 && i <= 0.7 && y >= -1e-9 && y <= 1.25 + 1e-9)].join(), 'true,true,true');
  }
  const sec = topSection(25, 1.25, 'round12');
  eq('edge: section spans the top', [Math.min(...sec.map((q) => q[0])), Math.max(...sec.map((q) => q[0]))].join(), '0,25');
  const base = p.cabinets.find((c) => c.kind === 'base')!;
  const cab = { ...base, countertop: true, topKind: 'wood' as const, topProfile: 'ogee' as const };
  const job = { ...p, cabinets: p.cabinets.map((c) => (c.id === base.id ? cab : c)), furniture: [{ ...newBench(), edge: 'profile' as const, edgeProfile: 'round12' as const }] };
  const top = buildParts(cab, job.settings, resolveEnds(job.room, job.cabinets, cab)).find((x) => x.role === 'woodTop')!;
  eq('edge: wood top drawn by its section', [!!top.shapesOnly, top.shapes?.length].join(), 'true,1');
  eq('edge: on the profiles sheet', profileItems(job).filter((i) => /edge:/.test(i.title)).map((i) => i.title).join(' | '), 'Wood top edge: roman ogee | Bench edge: 1/2" roundover');
  eq('edge: bench scope names it', /1\/2" roundover edge/.test(tableScope(job.furniture[0])), true);
  eq('edge: wood top edge priced', estimateHours(job, quoteOf(job)).some((l) => /Top edge: roman ogee/.test(l.label)), true);
}

// Section elevations: a wall with nothing on it gets one when asked, with the side walls shaded
{
  const job = { ...p, drawings: { ...(p.drawings ?? {}), sides: { front: 'section' as const } } };
  const cs = customerSet(job, drawingsOf(job));
  const front = cs.find((x) => /Front wall elevation/.test(x.title));
  eq('section: the empty wall gets an elevation', !!front, true);
  eq('section: side-wall work drawn shaded', /class="sec"/.test(front?.svg ?? ''), true);
}

// Separate toe kick base: no toe notch, a ladder under the case, shop notes only
{
  const base = p.cabinets.find((c) => c.kind === 'base' && !c.island)!;
  const cab = { ...base, base: { ...(base.base ?? { style: 'kick', height: 0, build: 'faceframe', shape: 'straight', rise: 0, foot: 0 }), style: 'kick' as const, separate: true } } as typeof base;
  const job = { ...p, cabinets: p.cabinets.map((c) => (c.id === base.id ? cab : c)) };
  const parts = buildParts(cab, job.settings, resolveEnds(job.room, job.cabinets, cab));
  const side = parts.find((x) => x.role === 'side')!;
  eq('kick base: sides stop at the base', [side.boxes.length, side.boxes[0].min[1], side.length].join(), `1,${job.settings.toeKickHeight},${cab.height - job.settings.toeKickHeight}`);
  eq('kick base: ladder, no nailer', [parts.filter((x) => /Toe kick base, (front|back) rail/.test(x.name)).length, parts.some((x) => x.name === 'Toe kick nailer'), parts.filter((x) => x.name === 'Toe kick base, cross piece').length >= 2].join(), '2,false,true');
  eq('kick base: not on the customer\'s side', /toe kick base/i.test(quoteDoc(job) + proposalSummary(job).materials.map((m) => m.value).join(' ')), false);
  eq('kick base: shop note', cabinetCallouts(job, cab).some((n) => n.for === 'shop' && /Separate toe kick base/.test(n.text)), true);
}

// Sub-crown on top of the case: top rail stays exposed, 1 1/2" shows under the crown, crown stays put
{
  const up = { ...p.cabinets.find((c) => c.kind === 'wall')!, crown: '5268' };
  const before = crownLayout(up, p.settings);
  const n = subCrownOnTop(up, p.settings, 1.5)!;
  const after = { ...up, ...n };
  const L = crownLayout(after, p.settings);
  const ch = mountShape(profileByNum(up.crown)!).height;
  eq('subcrown on top: crown top unchanged (to a 1/16)', Math.abs(L.crownTop - before.crownTop) <= 1 / 16, true);
  eq('subcrown on top: sits on the case top', L.subBottom, after.height);
  eq('subcrown on top: 1 1/2" shows under the crown (to a 1/16)', Math.abs(L.top - ch - L.subBottom - 1.5) <= 1 / 16, true);
}

// Sub-crown: one piece across touching uppers, not a joint at every cabinet
{
  const ups = p.cabinets.filter((c) => c.wall === 'back' && c.kind === 'wall').sort((a, b) => a.offset - b.offset).slice(0, 2);
  const job = { ...p, cabinets: p.cabinets.map((c) => (ups.some((u) => u.id === c.id) ? { ...c, crown: '5268', ...subCrownOnTop({ ...c, crown: '5268' }, p.settings, 1.5)! } : c)) };
  const [a, b] = ups.map((u) => job.cabinets.find((c) => c.id === u.id)!);
  const pa = buildParts(a, job.settings, resolveEnds(job.room, job.cabinets, a)).filter((x) => x.name === 'Sub-crown');
  const pb = buildParts(b, job.settings, resolveEnds(job.room, job.cabinets, b)).filter((x) => x.name === 'Sub-crown');
  eq('sub-crown run: one piece on the first, none on the second', [pa.length, pb.length].join(), '1,0');
  eq('sub-crown run: spans both cabinets', pa[0].boxes[0].min[0] + pa[0].boxes[0].size[0] >= b.offset + b.width - a.offset - 1e-6, true);
}

// Furniture on the agreement: one line per piece, adding up to the furniture total
{
  const job = { ...p, furniture: [{ ...newTable(), name: 'Puzzle table' }, { ...newBench(), name: 'Bench' }], quote: { ...quoteOf(p), lineLabels: { furniture: 'Puzzle Table' } } };
  const lines = proposalLines(job);
  const f = lines.filter((l) => l.key.startsWith('furniture'));
  eq('furniture lines: one per piece, old name on the first', f.map((l) => l.label).join(' | '), 'Puzzle Table | Bench');
  eq('furniture lines: still add up to the total', lines.reduce((t, l) => t + l.price, 0), priceQuote(job).total);
  eq('furniture lines: table costs more than the bench', f[0].price > f[1].price, true);
}

// Selections: each choice shows its effect on the listed price, and the visit gets them in words
{
  const mount = selList.find((x) => x.id === 'mount')!;
  const d = optionDeltas(p, mount);
  const other = p.settings.doorMount === 'inset' ? 'overlay' : 'inset';
  eq('selections: current choice is no change', d.get(p.settings.doorMount), 0);
  eq('selections: the other mounting is priced', (p.settings.doorMount === 'overlay' ? d.get(other)! > 0 : d.get(other)! < 0), true);
  const applied = mount.apply(p, other, []);
  eq('selections: the price moves by what was shown', Math.abs(listedPrice(applied) - listedPrice(p) - d.get(other)!) < 1, true);
  eq('selections: in words for the visit', selectionText(applied).some((t) => /^Doors and drawer fronts: /.test(t)), true);
}

// Doors that swing into a wall or a deeper neighbour: a restrictor just past square, a problem before it
{
  const sw = doorSwings(p);
  const w1 = p.cabinets.find((c) => c.name === 'W1')!;
  const at = sw.find((d) => d.cabinetId === w1.id);
  eq('swing: W1 (hinged at the left wall) gets a restrictor', at ? `${at.fix} ${at.hits}` : 'none', 'restrictor left wall');
  eq('swing: it hits just past square', at!.at >= 87 && at!.at <= 100, true);
  eq('swing: doors in the middle of a run swing free', sw.some((d) => p.cabinets.find((c) => c.id === d.cabinetId)!.name === 'B3'), false);
  // Moved 4" off the wall, it opens well past square
  const off = { ...p, cabinets: p.cabinets.map((c) => (c.id === w1.id ? { ...c, offset: c.offset + 4 } : c)) };
  eq('swing: 4" off the wall, no restrictor', doorSwings(off).some((d) => d.cabinetId === w1.id), false);
  // Finger pulls stand nothing off the face, so the door alone decides
  const fing = { ...p, settings: { ...p.settings, pulls: 'finger' as const } };
  const f1 = doorSwings(fing).find((d) => d.cabinetId === w1.id);
  eq('swing: with finger pulls it gets further before it touches', !f1 || f1.at > at!.at, true);
  // The quote counts them, the problems list says so, the 3D door stops there, the drawings note it
  eq('swing: restrictors stay off the quote (pennies)', estimateMaterials(p, quoteOf(p)).some((l) => /restrictor/i.test(l.label)), false);
  eq('swing: a restrictor isn\'t a problem; a door that can\'t open square is', doorSwingIssues(p).some((i) => i.cabinetId === w1.id) === false && doorSwingIssues(p).every((i) => i.message.includes('before it\'s open square')), true);
  eq('swing: the restrictor is a shop note only', cabinetCallouts(p, w1).filter((c) => /restrictor|opens to/i.test(c.text)).every((c) => c.for === 'shop'), true);
  const parts = buildParts(w1, p.settings, resolveEnds(p.room, p.cabinets, w1));
  const mot = frontMotions(p, w1, parts, []).filter((m) => m.part.role === 'door');
  eq('swing: the 3D door stops at the restrictor', mot.some((m) => Math.abs(Math.abs(m.angle) - (RESTRICT_TO * Math.PI) / 180) < 1e-6), true);
  eq('swing: shop note on the cabinet', cabinetCallouts(p, w1).some((c) => c.for === 'shop' && c.text.startsWith('Hinge opening restrictor')), true);
}

// Closet rods: hangers centered 12" off the wall in any case deep enough, an 18" one included
{
  const cl = { ...cabinetFromPreset(presets.find((x) => x.id === 'closet-long')!, 'back', 0, []), depth: 18 };
  const rod = buildParts(cl, p.settings).find((x) => x.role === 'rod')!;
  eq('closet rod: 12" off the wall in an 18" deep case', rod.note!.includes('12" off the wall'), true);
  eq('closet rod: drawn there', Math.abs(rod.boxes[0].min[2] + rod.boxes[0].size[2] / 2 - 12) < 0.01, true);
}

// Lighting as a proposal option: off the base price and the base scope, priced and listed as its own box to tick
{
  const w = p.cabinets.find((c) => c.kind === 'wall')!;
  const lit = { ...p, cabinets: p.cabinets.map((c) => (c.id === w.id ? { ...c, lighting: ['under' as const] } : c)), cabLighting: { options: { under: 'Cabinet lighting' }, allowance: 300 } };
  const opts = optionPrices(lit);
  const o = opts.find((x) => x.label === 'Cabinet lighting');
  eq('lighting option: offered', !!o, true);
  eq('lighting option: priced over the base', (o?.price ?? 0) > 0, true);
  eq('lighting option: said in words', o?.items.some((i) => i.startsWith('Under-cabinet LED strips')), true);
  eq('lighting option: not in the base', withOptions(lit).cabinets.find((c) => c.id === w.id)!.lighting?.length ?? 0, 0);
  eq('lighting option: kept when chosen', withOptions(lit, ['Cabinet lighting']).cabinets.find((c) => c.id === w.id)!.lighting?.length, 1);
}

// Double hang in one opening: two rods, the lower halfway down, no shelf between
{
  const base = cabinetFromPreset(presets.find((x) => x.id === 'closet-long')!, 'back', 0, []);
  const dh = { ...base, rows: [{ ...base.rows[0] }, { ...base.rows[1], rods: 2 as const }] };
  const rods = buildParts(dh, p.settings).filter((x) => x.role === 'rod');
  eq('two rods: both in the opening', rods.map((r) => r.name).join(', '), 'Closet rod, upper, Closet rod, lower');
  const ys = rods.map((r) => r.boxes[0].min[1]);
  eq('two rods: the lower one about halfway down', ys[1] < ys[0] - 25, true);
  eq('two rods: no fixed shelf between them', buildParts(dh, p.settings).filter((x) => x.name === 'Fixed shelf').length, buildParts(base, p.settings).filter((x) => x.name === 'Fixed shelf').length);
  eq('two rods: said as double hang', scopeLine(dh, { ...p, cabinets: [dh] }).includes('double hang, two closet rods'), true);
}

// Knobs sit centered on the door stile, not over the bead or the panel
{
  const c = p.cabinets.find((x) => x.rows.some((r) => r.type === 'doors') && x.kind === 'base')!;
  const parts = buildParts(c, p.settings, resolveEnds(p.room, p.cabinets, c));
  const knobs = pullSpots(p, c, parts).filter((k) => k.kind === 'knob');
  const doors = parts.filter((x) => x.role === 'door').map(bbox);
  const half = p.settings.doorStile / 2;
  eq('knobs: centered on the stile', knobs.length > 0 && knobs.every((k) => doors.some((d) => Math.abs(k.x - d.x0 - half) < 0.01 || Math.abs(d.x1 - k.x - half) < 0.01)), true);
}

// Custom parts: an outline through a thickness, under a mantel, priced by its own hours and the template once
{
  const part = { ...newPart('scroll'), id: 'part_test', name: 'Test corbel' };
  eq('part: scroll corbel size', `${partSize(part).w} x ${partSize(part).h}`, '5 x 9');
  const dxf = partDxf(part);
  eq('part: DXF is one closed polyline with arcs', dxf.includes('LWPOLYLINE') && dxf.includes('\n42\n') && dxf.includes('\n70\n1\n'), true);
  eq('part: template tiles onto letter pages', (templateHtml(part).match(/class="page"/g) ?? []).length >= 1, true);
  const half = partOutline({ points: [{ x: 0, y: 0, bulge: 1 }, { x: 2, y: 0 }] });
  eq('part: bulge 1 is a half circle of radius 1', Math.abs(Math.min(...half.map((q) => q[1])) + 1) < 1e-6, true);
  const mantel = { ...cabinetFromPreset(presets.find((x) => x.id === 'mantel-electric')!, 'back', 20, []) };
  const withPart = { ...mantel, mantel: { ...mantel.mantel!, corbels: 2 as const, corbelPart: part } };
  const corbels = buildParts(withPart, p.settings).filter((x) => x.name === 'Corbel');
  eq('part: two corbels from the outline', corbels.length === 2 && corbels.every((c) => c.shapes?.[0].outline.length === partOutline(part).length && c.thickness === part.thickness), true);
  const job = { ...p, cabinets: [withPart] };
  const hrs = estimateHours(job, quoteOf(job));
  eq('part: hours each on the quote', hrs.some((h) => h.label.startsWith('Custom parts: Test corbel, make') && h.qty === 2 && h.each === part.hoursEach), true);
  eq('part: master template once', hrs.filter((h) => /master template/.test(h.label)).length, 1);
  eq('part: not bought from Next Day', estimateMaterials(job, quoteOf(job)).some((l) => /Next Day/.test(l.label)), false);
}

// Edge profiles on a custom part: how far each cuts back, the pulled-in outline, and the shop note
{
  eq('cut: roundover full at the face, gone at its radius', `${cutInset('roundover', 0.25, 0)} ${cutInset('roundover', 0.25, 0.25)}`, '0.25 0');
  eq('cut: chamfer halfway', cutInset('chamfer', 0.5, 0.25), 0.25);
  eq('cut: cove is concave (cuts more than a chamfer midway)', cutInset('cove', 0.5, 0.25) > 0.25, true);
  const sq: [number, number][] = [[0, 0], [4, 0], [4, 4], [0, 4]];
  const off = offsetOutline(sq, [0.5, 0.5, 0.5, 0.5]);
  eq('cut: square pulled in evenly', off.map((p) => p.join(',')).join(' '), '0.5,0.5 3.5,0.5 3.5,3.5 0.5,3.5');
  const part = { ...newPart('scroll'), id: 'p2', name: 'Profiled' };
  part.points = part.points.map((p, i) => (i === 4 || i === 5 ? { ...p, cut: { kind: 'roundover' as const, size: 0.25, faces: 'both' as const } } : p));
  eq('cut: shop note', edgeCutNotes(part).join(' | '), '1/4" roundover, both faces: edges 5, 6');
}

// A moulding drawn in the part builder: its number, the job's copy of the drawing, its price, a new size
{
  const m = { ...newPart('m-ogee-crown'), id: 'part-crown1' };
  const num = mouldingNum(m);
  eq('moulding: number carries category, size and part', num, 'custom:Crown:3.5x3.5:shop:part-crown1');
  const c0 = p.cabinets.find((c) => c.kind === 'upper') ?? p.cabinets[0];
  let job = { ...p, cabinets: p.cabinets.map((c) => ({ ...c, crown: num })), profiles: { [num]: mouldingDrawing(m) }, moldPrices: { [num]: m.costPerFoot! } };
  setCustomDrawings(job.profiles);
  const pr = profileByNum(num)!;
  eq('moulding: profile from the drawing', `${pr.name} ${pr.custom?.part} ${mountShape(pr).height} ${mountShape(pr).depth} ${mountShape(pr).pts.length > 8}`, 'Ogee crown part-crown1 3.5 3.5 true');
  const line = moldingOrder(job).find((l) => l.num === num)!;
  eq('moulding: ordered at the shop cost per foot', `${line.price} ${line.cost === line.feet * 7}`, '7 true');
  const big = { ...m, costPerFoot: 8, points: m.points.map((q) => ({ ...q, x: q.x * 4 / 3.5, y: q.y * 4 / 3.5 })) };
  job = retargetMoulding(job, [num], big);
  const n2 = mouldingNum(big);
  setCustomDrawings(job.profiles);
  eq('moulding: resized, every use moves to the new number and price', `${n2} ${job.cabinets.find((c) => c.id === c0.id)!.crown === n2} ${job.moldPrices[n2]} ${moldingOrder(job).find((l) => l.num === n2)?.price}`, 'custom:Crown:4x4:shop:part-crown1 true 8 8');
  eq('moulding: knives & setup once in the quote', estimateHours(job, quoteOf(job)).filter((l) => l.label.includes('grind knives')).map((l) => `${l.label} ${l.qty}`).join(' | '), 'Mouldings: Ogee crown, grind knives & set up (once) 1');
  setCustomDrawings(undefined);
}

// A closet shelf on cleats: plywood, a nosing, cleats on the walls it meets; priced as a closet shelf, no brackets
{
  const sh = { ...cabinetFromPreset(presets.find((x) => x.id === 'float-shelf')!, 'back', 0, []), width: 59, depth: 12, height: 1.5, elevation: 39, floating: { grade: 'paint' as const, face: 0.75, support: 'cleat' as const } };
  const room = { ...p, room: { ...p.room, width: 59, depth: 40, height: 95 }, cabinets: [sh] };
  const parts = buildParts(sh, s, { left: false, right: false } as never);
  eq('cleat shelf: shelf, nosing and three cleats', parts.map((x) => x.name).sort().join(', '), 'Shelf, Shelf cleat, Shelf cleat, Shelf cleat, Shelf nosing');
  const hrs = estimateHours(room, quoteOf(room)).filter((h) => /shel/i.test(h.label)).map((h) => h.label).join(' | ');
  eq('cleat shelf: closet shelf hours, not floating', hrs, 'Closet shelves on cleats: cut, nose & sand | Install closet shelves: cleats & shelf');
  eq('cleat shelf: no floating brackets to buy', estimateMaterials(room, quoteOf(room)).some((l) => l.label === 'Floating shelf brackets'), false);
}

eq('sample has no layout issues', findIssues(p.room, p.cabinets, s).map((i) => i.message).join('; '), '');

console.log(failed ? `${failed} check(s) failed` : 'All model checks passed');
process.exit(failed ? 1 : 0);
