// Sanity checks on the cabinet model: run with `npm test`.
import { buildParts, layoutRows } from "../src/model/parts";
import { sampleProject, defaultSettings } from "../src/model/defaults";
import { findIssues } from "../src/model/layout";
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
const b = p.cabinets.find((c) => c.name === 'B2')!; // 30" drawer over 2 doors
const parts = buildParts(b, s);
const get = (n: string) => parts.filter((x) => x.name === n);
eq('side length', get('Side')[0].length, 34.5);
eq('side width', get('Side')[0].width, 23.25);
eq('bottom length', get('Bottom')[0].length, 30 - 0.5 - 1.5 + 0.5);
eq('stile length', get('Stile')[0].length, 30.5);
eq('rail length', get('Top rail')[0].length, 27);
eq('mid rails', get('Mid rail').length, 1);
eq('door count', get('Door').length, 2);
eq('drawer front width', get('Drawer front')[0].width, 28);
eq('door width', get('Door')[0].width, (28 - 0.125) / 2);
const rows = layoutRows(b, s);
eq('rows fill frame', rows.leftover, 0);
eq('door opening', rows.rows[1].height, 30.5 - 1.5 - 1.5 - 1.5 - 6);
for (const part of parts) for (const box of part.boxes) for (const v of box.size) if (!(v > 0)) { failed++; console.log('bad box', part.name, box.size); }

eq('sample has no layout issues', findIssues(p.room, p.cabinets, s).map((i) => i.message).join('; '), '');

console.log(failed ? `${failed} check(s) failed` : 'All model checks passed');
process.exit(failed ? 1 : 0);
