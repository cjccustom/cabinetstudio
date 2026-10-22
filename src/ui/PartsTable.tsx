import { useMemo, useState } from 'react';
import { useStore } from '../store';
import type { Cabinet, MaterialKey } from '../model/types';
import { buildParts } from '../model/parts';
import { resolveEnds } from '../model/layout';
import { fmt } from '../units';
import { eaglePrice } from '../model/eagle';
import { releaseStatus } from '../model/release';

const materialLabel: Record<MaterialKey, string> = {
  box: '3/4" case plywood',
  back: 'Back panels',
  toeSkin: 'Toe kick skins (install)',
  drawerBox: 'Drawer boxes',
  faceframe: 'Face frame stock',
  door: 'Doors & drawer fronts',
  counter: 'Countertop',
  solidWood: 'Solid wood (tops & seats)',
};
const order: MaterialKey[] = ['box', 'back', 'toeSkin', 'faceframe', 'solidWood', 'door'];
const SHEET = 48 * 96;

interface Row { key: string; name: string; material: MaterialKey; length: number; width: number; thickness: number; qty: number; cabs: string[]; note?: string }

export function usePartRows(cabinets: Cabinet[]) {
  const settings = useStore((s) => s.project.settings);
  const room = useStore((s) => s.project.room);
  const all = useStore((s) => s.project.cabinets);
  return useMemo(() => {
    const map = new Map<string, Row>();
    for (const c of cabinets) {
      for (const p of buildParts(c, settings, resolveEnds(room, all, c))) {
        if (!p.cut) continue;
        const r16 = (v: number) => Math.round(v * 16);
        const key = [p.material, p.name, r16(p.length), r16(p.width), r16(p.thickness), p.note ?? ''].join('|');
        const row = map.get(key);
        if (row) {
          row.qty++;
          if (!row.cabs.includes(c.name)) row.cabs.push(c.name);
        } else {
          map.set(key, { key, name: p.name, material: p.material, length: p.length, width: p.width, thickness: p.thickness, qty: 1, cabs: [c.name], note: p.note });
        }
      }
    }
    const rows = [...map.values()].sort((a, b) => b.length * b.width - a.length * a.width);
    return order.map((m) => ({ material: m, rows: rows.filter((r) => r.material === m) })).filter((g) => g.rows.length);
  }, [cabinets, settings, room, all]);
}

export function PartsTable({ cabinets, compact }: { cabinets: Cabinet[]; compact?: boolean }) {
  const groups = usePartRows(cabinets);
  if (!cabinets.length) return <p className="hint">Add cabinets to see their parts here.</p>;
  return (
    <div className="parts">
      {groups.map((g) => {
        const area = g.rows.reduce((s, r) => s + r.length * r.width * r.qty, 0);
        const lin = g.rows.reduce((s, r) => s + r.length * r.qty, 0);
        const count = g.rows.reduce((s, r) => s + r.qty, 0);
        let summary = `${count} pcs`;
        if (g.material === 'box' || g.material === 'back') summary += ` · ${(area / 144).toFixed(1)} sq ft · ~${Math.ceil((area * 1.18) / SHEET)} sheets`;
        if (g.material === 'faceframe' || g.material === 'toeSkin') summary += ` · ${(lin / 12).toFixed(1)} lin ft`;
        return (
          <div key={g.material} className="pgroup">
            <div className="pgroup-head">
              <span>{materialLabel[g.material]}</span>
              <span className="muted">{summary}</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th className="num">Qty</th>
                    <th>Part</th>
                    <th className="num">Length</th>
                    <th className="num">Width</th>
                    <th className="num">Thk</th>
                    {!compact && <th>Cabinets</th>}
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r) => (
                    <tr key={r.key} title={r.note}>
                      <td className="num">{r.qty}</td>
                      <td>{r.name}{r.note && <span className="note">{r.note}</span>}</td>
                      <td className="num">{fmt(r.length)}</td>
                      <td className="num">{fmt(r.width)}</td>
                      <td className="num">{fmt(r.thickness)}</td>
                      {!compact && <td className="cabs">{r.cabs.join(', ')}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const money = (v: number) => `$${v.toFixed(2)}`;

const orderLabel = { door: 'Doors', drawerFront: 'Drawer & false fronts', endPanel: 'End panels', drawerBox: 'Drawer boxes' } as const;
type OrderItem = keyof typeof orderLabel;
interface OrderRow { key: string; item: OrderItem; w: number; h: number; d?: number; spec: string; qty: number; cabs: string[]; each: number }

export function useOrderRows(cabinets: Cabinet[]) {
  const settings = useStore((s) => s.project.settings);
  const room = useStore((s) => s.project.room);
  const all = useStore((s) => s.project.cabinets);
  return useMemo(() => {
    const map = new Map<string, OrderRow>();
    for (const c of cabinets) {
      for (const p of buildParts(c, settings, resolveEnds(room, all, c))) {
        const o = p.order;
        if (!o) continue;
        const r16 = (v: number) => Math.round(v * 16);
        const key = [o.item, r16(o.w), r16(o.h), o.d ?? '', o.spec].join('|');
        const row = map.get(key);
        if (row) {
          row.qty++;
          if (!row.cabs.includes(c.name)) row.cabs.push(c.name);
        } else map.set(key, { key, item: o.item, w: o.w, h: o.h, d: o.d, spec: o.spec, qty: 1, cabs: [c.name], each: eaglePrice(o.item, o.w, o.h, o.d ?? 0) });
      }
    }
    const rows = [...map.values()].sort((a, b) => b.h - a.h || b.w - a.w);
    return (Object.keys(orderLabel) as OrderItem[]).map((item) => ({ item, rows: rows.filter((r) => r.item === item) })).filter((g) => g.rows.length);
  }, [cabinets, settings, room, all]);
}

/** Plain text a person can paste into Eagle's order form notes or an email. */
function orderText(jobName: string, groups: ReturnType<typeof useOrderRows>) {
  const lines = [`Eagle Woodworking order: ${jobName}`, ''];
  for (const g of groups) {
    lines.push(orderLabel[g.item].toUpperCase());
    for (const r of g.rows) {
      const size = r.item === 'drawerBox' ? `${fmt(r.w)} W x ${fmt(r.h)} H x ${fmt(r.d ?? 0)} D` : `${fmt(r.w)} W x ${fmt(r.h)} H`;
      lines.push(`  ${r.qty}  @  ${size}   ${r.spec}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function OrderList({ cabinets, compact }: { cabinets: Cabinet[]; compact?: boolean }) {
  const groups = useOrderRows(cabinets);
  const project = useStore((s) => s.project);
  const jobName = project.name;
  const release = useMemo(() => releaseStatus(project), [project]);
  const [copied, setCopied] = useState('');
  if (!groups.length) return <p className="hint">No doors, fronts or drawer boxes yet.</p>;
  const copy = (which: typeof groups, what: string) => {
    const text = orderText(jobName, which);
    navigator.clipboard.writeText(text).then(() => setCopied(`${what} copied. Paste it into Eagle’s quote request.`), () => setCopied('Couldn’t reach the clipboard. Select the table and copy it instead.'));
  };
  // Eagle quotes doors and panels, drawer fronts, and drawer boxes as separate requests
  const requests = [
    { what: 'Doors & end panels', items: ['door', 'endPanel'] },
    { what: 'Drawer fronts', items: ['drawerFront'] },
    { what: 'Drawer boxes', items: ['drawerBox'] },
  ].map((x) => ({ ...x, groups: groups.filter((g) => x.items.includes(g.item)) })).filter((x) => x.groups.length);
  return (
    <div className="parts">
      {groups.map((g) => {
        const shared = g.rows.every((r) => r.spec === g.rows[0].spec) ? g.rows[0].spec : null;
        return (
        <div key={g.item} className="pgroup">
          <div className="pgroup-head">
            <span>{orderLabel[g.item]}</span>
            <span className="muted">{g.rows.reduce((s, r) => s + r.qty, 0)} pcs · about {money(g.rows.reduce((s, r) => s + r.qty * r.each, 0))}</span>
          </div>
          {shared && <p className="spec-line">{shared}</p>}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="num">Qty</th>
                  <th className="num">Width</th>
                  <th className="num">Height</th>
                  {g.item === 'drawerBox' && <th className="num">Depth</th>}
                  {!shared && <th>Spec</th>}
                  {!compact && <th>Cabinets</th>}
                  {!compact && <th className="num" title="Estimated from your 2026 Eagle orders, before tax">Est. each</th>}
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r) => (
                  <tr key={r.key}>
                    <td className="num">{r.qty}</td>
                    <td className="num">{fmt(r.w)}</td>
                    <td className="num">{fmt(r.h)}</td>
                    {g.item === 'drawerBox' && <td className="num">{fmt(r.d ?? 0)}</td>}
                    {!shared && <td className="spec">{r.spec}</td>}
                    {!compact && <td className="cabs">{r.cabs.join(', ')}</td>}
                    {!compact && <td className="num">{money(r.each)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        );
      })}
      {!compact && <p className="hint">Prices are estimates fitted to your 2026 Eagle orders (paint-grade maple, 5-piece, MDF panel), before tax. They usually land within a dollar of Eagle’s price on fronts and $2 on drawer boxes.</p>}
      {!compact && (
        <div className="order-actions">
          {requests.map((x) => (
            <button key={x.what} disabled={!release.ready} onClick={() => copy(x.groups, x.what)}>Copy {x.what.toLowerCase()} for Eagle</button>
          ))}
          {!release.ready && <span className="locked-note">Locked until the deposit is in and measurements are checked.</span>}
          {copied && <span className="ok">{copied}</span>}
        </div>
      )}
    </div>
  );
}
