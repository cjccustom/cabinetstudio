// Which plywood a cabinet's case is cut from: the job's, or its own (prefinished birch for base
// cabinets whose insides never show, on a job whose bookcases are red oak). What shows (exposed
// sides, toe kick skins, stained open sections) stays in the job's showing plywood either way.
import { useMemo } from 'react';
import { useStore } from '../store';
import type { Cabinet } from '../model/types';
import { priceBook } from '../model/pricebook';
import { useShop } from '../shop/shop';
import { isOpenRow } from '../model/parts';
import { Field } from './fields';

export function plywoodNames(book: { kind: string; name: string }[], extra: (string | undefined)[]): string[] {
  return [...new Set([...book.filter((x) => x.kind === 'plywood').map((x) => x.name), ...extra.filter((x): x is string => !!x)])];
}

/** What a cabinet is cut from, in a line: its case, and the parts that show. */
export function plywoodText(c: Cabinet, job: { plywood?: string; exposedPlywood?: string }): string {
  const caseP = (c.overrides?.plywood ?? job.plywood ?? 'Prefinished birch').toLowerCase();
  const shows = (job.exposedPlywood || job.plywood || 'Prefinished birch').toLowerCase();
  const open = (c.build?.interior === 'stain' || c.build?.interior === 'clear') && c.rows.some((r) => isOpenRow(r.type, r.covered));
  const parts = ['exposed sides', ...(c.kind === 'base' || c.kind === 'tall' ? ['toe kick skin'] : []), ...(open ? ['the open sections'] : [])];
  return caseP === shows ? `Cut from ${caseP} plywood, all of it.` : `Case cut from ${caseP} plywood; ${parts.join(', ')} from ${shows}.`;
}

/** The case plywood picker for one cabinet or several picked together. */
export function CasePlywoodField({ cabs }: { cabs: Cabinet[] }) {
  const settings = useStore((s) => s.project.settings);
  const commit = useStore((s) => s.commit);
  const prices = useShop((s) => s.prices);
  const book = useMemo(() => priceBook(prices), [prices]);
  const job = settings.plywood ?? 'Prefinished birch';
  const names = plywoodNames(book, [job, 'Prefinished birch', ...cabs.map((c) => c.overrides?.plywood)]);
  const vals = [...new Set(cabs.map((c) => c.overrides?.plywood ?? ''))];
  const put = (v: string) => commit((p) => ({
    ...p,
    cabinets: p.cabinets.map((c) => {
      if (!cabs.some((x) => x.id === c.id)) return c;
      const o = { ...c.overrides };
      if (!v || v === (p.settings.plywood ?? 'Prefinished birch')) delete o.plywood; else o.plywood = v;
      return { ...c, overrides: Object.keys(o).length ? o : undefined };
    }),
  }));
  const id = `cply-${cabs.map((c) => c.id).join('-').slice(0, 40)}`;
  return (
    <>
      <Field label={cabs.length > 1 ? `Case plywood for these ${cabs.length}` : 'Case plywood'} htmlFor={id}>
        <select id={id} value={vals.length === 1 ? vals[0] : 'mixed'} onChange={(e) => e.target.value !== 'mixed' && put(e.target.value)}>
          {vals.length > 1 && <option value="mixed">Mixed now</option>}
          <option value="">Job ({job.toLowerCase()})</option>
          {names.filter((n) => n !== job).map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </Field>
      {cabs.length === 1 && <p className="hint">{plywoodText(cabs[0], settings)}</p>}
    </>
  );
}
