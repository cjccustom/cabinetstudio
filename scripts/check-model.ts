// Sanity checks on the cabinet model: run with `npm test`.
import { buildParts, layoutRows, panelExtents, realOverhang } from "../src/model/parts";
import { sampleProject, defaultSettings } from "../src/model/defaults";
import { findIssues, gapBeside, resolveEnds } from "../src/model/layout";
import { fmt, parseLength } from "../src/units";
import { drawerBoxSize } from "../src/model/eagle";
import { optimize } from "../src/model/optimizer";
import { optimizerParts } from "../src/model/cutlist";
import { normalize } from "../src/store";

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
const s = defaultSettings;

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
eq('drawer box width (5/8 sides, Tandem)', box.order!.w, 18 - 0.375);
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

eq('sample has no layout issues', findIssues(p.room, p.cabinets, s).map((i) => i.message).join('; '), '');

console.log(failed ? `${failed} check(s) failed` : 'All model checks passed');
process.exit(failed ? 1 : 0);
