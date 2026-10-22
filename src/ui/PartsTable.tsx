import { useMemo } from 'react';
import { useStore } from '../store';
import type { Cabinet, MaterialKey } from '../model/types';
import { buildParts } from '../model/parts';
import { fmt } from '../units';

const materialLabel: Record<MaterialKey, string> = {
  box: 'Case plywood',
  back: 'Back panels',
  faceframe: 'Face frame stock',
  door: 'Doors & drawer fronts',
  counter: 'Countertop',
};
const order: MaterialKey[] = ['box', 'back', 'faceframe', 'door'];
const SHEET = 48 * 96;

interface Row { key: string; name: string; material: MaterialKey; length: number; width: number; thickness: number; qty: number; cabs: string[]; note?: string }

export function usePartRows(cabinets: Cabinet[]) {
  const settings = useStore((s) => s.project.settings);
  return useMemo(() => {
    const map = new Map<string, Row>();
    for (const c of cabinets) {
      for (const p of buildParts(c, settings)) {
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
  }, [cabinets, settings]);
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
        if (g.material === 'faceframe') summary += ` · ${(lin / 12).toFixed(1)} lin ft`;
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
