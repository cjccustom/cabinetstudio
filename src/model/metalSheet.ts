// The drawing that goes to the metal shop for a quote: the base from the front and the end, to scale,
// with its overall sizes, the top it carries, a cut list of members, the stock, the finish and notes.
// Prints on one letter page.
import type { DiningTable } from './furniture';
import { metalCutList, metalFeet, metalForms, metalFinishes, metalMembers, metalStockLabel, type MetalMember, type MetalPlate } from './metalBase';
import { fmt } from '../units';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** One projected view: members as their stock width, plates as rectangles, with overall dimensions. */
function view(members: MetalMember[], plates: MetalPlate[], axis: 'x' | 'z', size: number, topY: number, topSpan: number, title: string, scale: number): string {
  const u = (p: [number, number, number]) => (axis === 'x' ? p[0] : p[2]);
  const xs = [...members.flatMap((m) => [u(m.a), u(m.b)]), ...plates.flatMap((p) => [axis === 'x' ? p.min[0] : p.min[2], (axis === 'x' ? p.min[0] + p.size[0] : p.min[2] + p.size[2])])];
  const lo = Math.min(...xs) - size / 2, hi = Math.max(...xs) + size / 2;
  const span = Math.max(hi - lo, topSpan);
  const W = 330, H = 230, pad = 36;
  // One scale for both views, so they compare true
  const k = scale || Math.min((W - 2 * pad) / span, (H - 2 * pad) / (topY + 2));
  const X = (v: number) => W / 2 + v * k, Y = (v: number) => H - pad + 6 - v * k;
  const bars = members.map((m) => `<line x1="${X(u(m.a)).toFixed(1)}" y1="${Y(m.a[1]).toFixed(1)}" x2="${X(u(m.b)).toFixed(1)}" y2="${Y(m.b[1]).toFixed(1)}" stroke="#222" stroke-width="${Math.max(1.5, size * k).toFixed(1)}" stroke-linecap="square"/>`).join('');
  const pls = plates.map((p) => { const a = axis === 'x' ? p.min[0] : p.min[2], w = axis === 'x' ? p.size[0] : p.size[2]; return `<rect x="${X(a).toFixed(1)}" y="${Y(p.min[1] + p.size[1]).toFixed(1)}" width="${(w * k).toFixed(1)}" height="${Math.max(1.5, p.size[1] * k).toFixed(1)}" fill="#555"/>`; }).join('');
  // The top it carries, dashed, and the floor
  const top = `<rect x="${X(-topSpan / 2).toFixed(1)}" y="${Y(topY + 1.25).toFixed(1)}" width="${(topSpan * k).toFixed(1)}" height="${(1.25 * k).toFixed(1)}" fill="none" stroke="#999" stroke-dasharray="4 3"/>`;
  const floor = `<line x1="${pad / 2}" y1="${Y(0)}" x2="${W - pad / 2}" y2="${Y(0)}" stroke="#bbb"/>`;
  const dimW = `<line x1="${X(lo)}" y1="${H - 10}" x2="${X(hi)}" y2="${H - 10}" stroke="#c2410c"/><text x="${(X(lo) + X(hi)) / 2}" y="${H - 14}" text-anchor="middle" font-size="10" fill="#c2410c">${fmt(hi - lo)} outside</text>`;
  const dimH = `<line x1="${W - 12}" y1="${Y(0)}" x2="${W - 12}" y2="${Y(topY)}" stroke="#c2410c"/><text x="${W - 15}" y="${Y(topY) - 4}" text-anchor="end" font-size="10" fill="#c2410c">${fmt(topY)} floor to the top's underside</text>`;
  return `<figure><figcaption>${title}</figcaption><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${floor}${top}${pls}${bars}${dimW}${dimH}</svg></figure>`;
}

export function metalSheetHtml(t: DiningTable, who: { company: string[]; job: string; client?: string }): string {
  const m = t.metal!;
  const W = t.shape === 'round' ? t.length : t.width;
  const topY = t.height - t.top;
  const round = t.shape === 'round' || t.shape === 'oval';
  const { members, plates } = metalMembers(m, t.length, W, topY, round);
  const size = m.form === 'hairpin' ? Math.min(m.size, 0.625) : m.size;
  const cut = metalCutList(m, members, plates);
  const scale = Math.min((330 - 72) / Math.max(t.length, W), (230 - 72) / (topY + 2));
  const rows = cut.map((c) => `<tr><td>${c.qty}</td><td>${esc(c.what)}</td><td>${esc(c.stock)}</td><td>${c.length ? fmt(c.length) : ''}</td><td>${c.angle != null ? `${c.angle}° from level` : ''}</td></tr>`).join('');
  const topWords = `${t.shape === 'round' ? `${fmt(t.length)} round` : `${fmt(t.length)} × ${fmt(W)}${t.shape && t.shape !== 'rect' ? ` ${t.shape}` : ''}`} × ${fmt(t.top)} thick ${t.species.toLowerCase()} top`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Metal base for quote - ${esc(who.job)}</title>
<style>@page{size:letter;margin:.5in}body{font:10.5pt/1.4 Arial,sans-serif;color:#111;max-width:7.5in;margin:0 auto}h1{font-size:15pt;margin:4px 0}h2{font-size:11.5pt;margin:12px 0 4px}.co{color:#555;font-size:9pt}.views{display:flex;gap:10px;flex-wrap:wrap}figure{margin:0;border:1px solid #ddd;padding:4px}figcaption{font-weight:bold;font-size:9.5pt}table{border-collapse:collapse;width:100%}td,th{border:1px solid #aaa;padding:3px 6px;text-align:left;font-size:9.5pt}th{background:#eee}.note{font-size:9.5pt}</style></head><body>
<p class="co">${who.company.map(esc).join(' · ')}</p>
<h1>Steel base, for your quote</h1>
<p><b>Job:</b> ${esc(who.job)}${who.client ? ` (${esc(who.client)})` : ''} · <b>Piece:</b> ${esc(t.name)} · ${metalForms[m.form].label}</p>
<div class="views">${view(members, plates, 'x', size, topY, t.length, 'Front (along the length)', scale)}${view(members, plates, 'z', size, topY, W, 'End (across the width)', scale)}</div>
<h2>Cut list</h2>
<table><thead><tr><th>Qty</th><th>Member</th><th>Stock</th><th>Length (centerline)</th><th>Angle</th></tr></thead><tbody>${rows}</tbody></table>
<p class="note">About ${Math.ceil(metalFeet(members))} ft of ${esc(metalStockLabel(m))}. Lengths are centerline, to confirm at your shop; miter or cope the joints as you see fit, all welds ground smooth where they show.</p>
<h2>Details</h2>
<ul class="note">
<li>Carries a ${esc(topWords)}; the base's outside sits about ${fmt(m.inset)} in from the top's edge. Overall height ${fmt(t.height)} with the top.</li>
<li>Finish: ${esc(metalFinishes[m.finish])}${m.finish === 'powder' || m.finish === 'painted' ? `, ${esc(m.color)}` : ''}.</li>
<li>Mounting: ${m.form === 'hairpin' ? 'drilled plates for #14 screws into the top' : m.form === 'pedestal' ? 'top plate drilled for 1/4" screws into threaded inserts in the top' : 'tabs or holes in the top rails for 1/4" screws into threaded inserts in the top, slotted across the width so the top can move'}.</li>
<li>Felt or nylon glides on the feet${m.form === 'pedestal' ? ' (under the floor plate)' : ''}.</li>
${m.notes ? `<li>${esc(m.notes)}</li>` : ''}
</ul>
<p class="note">Please quote the base complete, finished and ready to attach, and how long it takes. Thank you.</p>
</body></html>`;
}
