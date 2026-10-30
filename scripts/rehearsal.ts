// A dress rehearsal before a real customer sees anything: a made-up client goes through the whole
// path. Part 1 runs the customer portal (the same worker that goes to Cloudflare) against an
// in-memory store: publish the proposal the app builds, open it, sign it, read the signed copy,
// check the status. Part 2 opens the built app in a real browser and visits every tab and view on
// the sample kitchen and on a room with every cabinet in the library, watching for crashes, NaN
// and $0 quotes. Nothing here touches Cloudflare, QuickBooks, Dropbox or a real client.
//
//   npm run rehearsal          (build first with npm run build:preview for part 2)
import { createRequire } from 'node:module';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import worker from '../portal/src/worker';
import { sampleProject } from '../src/model/defaults';
import { proposalLines, quoteDoc, quoteTotals } from '../src/model/client';
import { proposalSummary, withOptions } from '../src/model/proposal';
import { cabinetFromPreset, presets } from '../src/model/defaults';
import { priceQuote } from '../src/model/quote';

let failed = 0;
const check = (what: string, ok: boolean, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `: ${detail}` : ''}`);
};

/* ---------- Part 1: the customer portal ---------- */
async function portal() {
  const m = new Map<string, { value: string; metadata?: unknown }>();
  const KV = {
    async get(k: string, t?: string) { const v = m.get(k); if (!v) return null; return t === 'json' ? JSON.parse(v.value) : v.value; },
    async getWithMetadata(k: string) { const v = m.get(k); return v ? { value: v.value, metadata: v.metadata } : { value: null, metadata: null }; },
    async put(k: string, value: string, o?: { metadata?: unknown }) { m.set(k, { value, metadata: o?.metadata }); },
    async delete(k: string) { m.delete(k); },
    async list({ prefix }: { prefix: string }) { return { keys: [...m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; },
  };
  const env = { PORTAL: KV, SHOP_KEY: 'rehearsal-key' } as never;
  const ORIGIN = 'https://portal.example';
  const call = (path: string, init?: RequestInit) => (worker as { fetch: (r: Request, e: never) => Promise<Response> }).fetch(new Request(ORIGIN + path, init), env);
  const setup = await (await call('/setup', { method: 'POST', body: new URLSearchParams({ key: 'rehearsal-key' }) })).text();
  const addr = setup.match(/value="[^"]*\/([a-f0-9]{40})"/)?.[1];
  check('portal: connector address set up', !!addr);
  const mcp = async (name: string, args: unknown) => {
    const r = await call('/' + addr, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) });
    const j = await r.json() as { result: { isError?: boolean; content: { text: string }[]; structuredContent: Record<string, unknown> } };
    if (j.result?.isError) throw new Error(j.result.content[0].text);
    return j.result.structuredContent;
  };
  await mcp('update_shop', { company: ['CJC Custom Carpentry LLC', '50 Beaman Rd, Suite 1A, Sterling, MA 01564'], terms: '1. Parties: "You" refers to the buyer.' });

  // The proposal exactly as the app builds it for a made-up client
  const p = { ...sampleProject(), name: 'Rehearsal kitchen', client: { first: 'Test', last: 'Customer', partner: '', location: 'Sterling', address: '1 Test Rd', phone: '', phone2: '', email: 'test@example.com', source: '', scope: '', notes: '', measurements: [], todos: [] } };
  // One option the customer will tick, and one they won't
  const job = p as never as import('../src/model/types').Project;
  job.cabinets.push({ ...cabinetFromPreset(presets.find((x) => x.id === 'closet-island')!, 'back', 40, job.cabinets), island: true, wallInset: 70, option: 'Kitchen island' });
  job.quote = { ...job.quote, extras: [{ id: 'e1', label: 'Under-cabinet lighting', hours: 4, amount: 300, option: 'Lighting' }] };
  const sm = proposalSummary(job);
  const html = quoteDoc(p as never, { online: true });
  check('proposal: plain scope has no cabinet sizes', !/\d+”W x \d/.test(html) && html.includes('What') === html.includes('What'));
  check('proposal: two options priced', sm.options.length === 2 && sm.options.every((o) => o.price > 0), sm.options.map((o) => `${o.label} +$${o.price}`).join(', '));
  const { total, deposit } = quoteTotals(p as never);
  check('proposal: base total is the quote without the options', total > 0 && Math.abs(total - priceQuote(withOptions(job)).total) < 1, `$${total}`);
  check('proposal: 30% deposit', Math.abs(deposit - total * 0.3) <= 1, `$${deposit}`);
  check('proposal: no NaN or undefined in the agreement', !/NaN|undefined/.test(html));
  // Sent the way the app sends it: the page's data rides inside the agreement, so an old connector can't drop it
  const carried = Buffer.from(JSON.stringify({ summary: { areas: sm.areas, materials: sm.materials }, sections: proposalLines(job), options: sm.options })).toString('base64');
  const pub = await mcp('publish_proposal', { job_id: 'rehearsal', project: 'Rehearsal kitchen', client: { first: 'Test', last: 'Customer', address: '1 Test Rd' }, agreement_html: html.replace('</body>', `<!--CJC-PROPOSAL ${carried} --></body>`), total, deposit }) as { url: string };
  const token = pub.url.split('/p/')[1];
  const page = await (await call('/p/' + token)).text();
  check('customer page: opens', page.includes('Rehearsal kitchen') && page.includes('Sign the agreement'));
  check('customer page: no cancellation box before signing', !/Changed your mind|Notice of Cancellation/i.test(page));
  check('customer page: what we’ll build, materials, options to tick', page.includes('What we’ll build') && page.includes('Materials &amp; finishes') && (page.match(/name="opt_/g) ?? []).length === 2);
  const signed = await call(`/p/${token}/sign`, { method: 'POST', body: new URLSearchParams({ consent: 'on', agree: 'on', name: 'Test Customer', image: 'data:image/png;base64,iVBORw0KGgo=', [`opt_${sm.options[0].id}`]: 'on' }), headers: { 'cf-connecting-ip': '203.0.113.7' }, redirect: 'manual' });
  check('customer signs', signed.status === 303);
  const after = await (await call('/p/' + token)).text();
  check('the carried data is taken out of the stored agreement', !after.includes('CJC-PROPOSAL'));
  check('customer page after signing: no cancel box', !/Changed your mind|Cancel the agreement/i.test(after) && after.includes('Signed by'));
  const agreement = await (await call(`/p/${token}/agreement`)).text();
  check('signed copy: signature and two Notices of Cancellation', agreement.includes('Electronic signature') && (agreement.match(/NOTICE OF CANCELLATION/gi) ?? []).length >= 2);
  const st = await mcp('job_status', { job_id: 'rehearsal' }) as { signed?: { name: string; options?: string[]; total?: number; deposit?: number }; cancelDeadline?: string };
  check('your status: signed, with the cancel deadline', st.signed?.name === 'Test Customer' && !!st.cancelDeadline, st.cancelDeadline);
  const want = total + sm.options[0].price;
  check('the ticked option is in the signed total and deposit', st.signed?.total === want && st.signed?.deposit === Math.round(want * deposit / total) && st.signed?.options?.join() === sm.options[0].label, `$${st.signed?.total}, deposit $${st.signed?.deposit}`);
  check('signed copy lists the option and the total', agreement.includes(`Options chosen:</b> ${sm.options[0].label}`) && agreement.includes(`$${want.toLocaleString('en-US')}`));
  let refused = false;
  try { await mcp('publish_proposal', { job_id: 'rehearsal', project: 'x', agreement_html: 'x', total: 1, deposit: 1 }); } catch { refused = true; }
  check('a signed proposal can’t be replaced by accident', refused);
  check('wrong link shows nothing', (await call('/p/AAAAAAAAAAAAAAAAAAAAAAAA')).status === 404);
  // Clearing out a test job: a signed one needs it said twice
  let kept = false;
  try { await mcp('delete_job', { job_id: 'rehearsal', confirm: 'rehearsal' }); } catch { kept = true; }
  check('a signed job isn’t deleted without even_signed', kept);
  await mcp('delete_job', { job_id: 'rehearsal', confirm: 'rehearsal', even_signed: true });
  check('deleted job: link gone, not listed', (await call('/p/' + token)).status === 404 && ((await mcp('list_jobs', {})) as { jobs: unknown[] }).jobs.length === 0);
}

/* ---------- Part 2: the app in a browser ---------- */
async function app() {
  const file = pathToFileURL(resolve('dist-preview/cabinet-studio.html'));
  if (!existsSync(file)) { console.log('skip app: run npm run build:preview first'); return; }
  const require = createRequire(resolve('package.json'));
  let pw: typeof import('playwright');
  try { pw = require('playwright'); } catch { console.log('skip app: Playwright isn’t installed here'); return; }
  const shell = existsSync('/opt/pw-browsers') ? readdirSync('/opt/pw-browsers').find((d) => d.startsWith('chromium_headless_shell')) : undefined;
  const dir = shell ? readdirSync(`/opt/pw-browsers/${shell}`).map((d) => `/opt/pw-browsers/${shell}/${d}/headless_shell`).find((f) => existsSync(f)) : undefined;
  const exe = process.env.PW_CHROMIUM ?? dir;
  const browser = await pw.chromium.launch(exe ? { executablePath: exe } : {});
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(file.href);
  await page.waitForTimeout(2500);
  const tab = (name: string) => page.getByRole('tab', { name, exact: true }).first();
  const visitAll = async (label: string) => {
    for (const v of ['3D', 'Plan', 'Back', 'Left', 'Right', 'Front']) { await page.getByRole('tab', { name: v, exact: true }).first().click(); await page.waitForTimeout(400); }
    for (const t of ['Clients', 'Sheet cutlist', 'Solid wood', 'Quote', 'Drawings', 'Rendering', 'Job & clock', 'Design']) {
      await tab(t).click(); await page.waitForTimeout(600);
      const text = await page.locator('body').innerText();
      check(`${label}: ${t} tab, no NaN`, !/\bNaN\b/.test(text));
    }
    await tab('Quote').click(); await page.waitForTimeout(600);
    const total = (await page.locator('body').innerText()).match(/Total Project Investment\s*\$([\d,]+)/)?.[1];
    check(`${label}: quote has a total`, !!total && Number(total.replace(/,/g, '')) > 0, total ? `$${total}` : 'none');
    await tab('Design').click();
  };
  await visitAll('sample kitchen');
  // A blank room with one of everything in the library, along whichever wall has room
  await page.getByRole('button', { name: 'New', exact: true }).click(); await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Blank room' }).click(); await page.waitForTimeout(600);
  const items = await page.locator('.lib-item').count();
  for (let i = 0; i < items; i++) {
    await page.selectOption('#lib-wall', ['back', 'left', 'right', 'front'][i % 4]);
    await page.locator('.lib-item').nth(i).click(); await page.waitForTimeout(150);
  }
  check('every library item adds without a crash', errors.length === 0, `${items} items`);
  await visitAll('one of everything');
  check('no crashes anywhere', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
}

await portal();
await app();
console.log(failed ? `${failed} rehearsal check(s) failed` : 'Rehearsal passed');
process.exit(failed ? 1 : 0);
