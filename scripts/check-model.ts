// Sanity checks on the cabinet model: run with `npm test`.
import { buildParts, layoutRows, realOverhang } from "../src/model/parts";
import { sampleProject, defaultSettings } from "../src/model/defaults";
import { findIssues, resolveEnds } from "../src/model/layout";
import { fmt, parseLength } from "../src/units";

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
eq('drawer box width', box.order!.w, 21 - 3 - 0.625);
eq('drawer box height', box.order!.h, 6 - 0.8125);
eq('drawer box depth', box.order!.d, 21);
eq('doors are ordered, not cut', p21.filter((x) => x.order && x.cut).length, 0);

const b = p.cabinets.find((c) => c.name === 'B2')!; // 30" drawer over 2 doors
const parts = buildParts(b, s);
const get = (n: string) => parts.filter((x) => x.name === n);
eq('stile length', get('Stile')[0].length, 30.5);
eq('rail length', get('Top rail')[0].length, 27);
eq('door count', get('Door').length, 2);
eq('drawer front width', get('Drawer front')[0].width, 28);
eq('door width', get('Door')[0].width, (28 - 0.125) / 2);
const rows = layoutRows(b, s);
eq('rows fill frame', rows.leftover, 0);
for (const part of parts) for (const bx of part.boxes) for (const v of bx.size) if (!(v > 0)) { failed++; console.log('bad box', part.name, bx.size); }

const ends = resolveEnds(p.room, p.cabinets, p.cabinets.find((c) => c.name === 'B4')!);
eq('B4 right end exposed (range gap)', ends.right, true);
eq('B4 left end hidden', ends.left, false);

eq('sample has no layout issues', findIssues(p.room, p.cabinets, s).map((i) => i.message).join('; '), '');

console.log(failed ? `${failed} check(s) failed` : 'All model checks passed');
process.exit(failed ? 1 : 0);
