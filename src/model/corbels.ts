// Corbels and brackets under mantel shelves and floating shelves: shop-made, or bought from Next
// Day Moulding. Next Day's item codes carry the size (BKTW05X04X06 = about 5" wide, 4" deep,
// 6" tall); the listed width and height are used as given and the depth taken from the code.
import { nextDayCorbels, type NextDayCorbel } from './nextDay';

export interface CorbelPick { code: string; name: string; w: number; h: number; d: number; price: number; url: string; kind: 'corbel' | 'bracket' }

/** Next Day's corbels, sized: depth from the code's middle number (BKTW05X05X08 → 5"). */
export const corbelCatalog: CorbelPick[] = nextDayCorbels.map((c: NextDayCorbel) => {
  const m = c.name.match(/([A-Z]{3,4})(\d{2})X(\d{2})X(\d{2})/i);
  const d = m ? Number(m[3]) : 4;
  return { code: c.code, name: c.name.replace(/^[\d/ X-]+/i, '').replace(/\s+Corbel$/i, '').trim().toUpperCase(), w: c.w ?? 4, h: c.h ?? 8, d, price: c.price, url: c.url, kind: m && /^BKT/i.test(m[1]) ? 'bracket' : 'corbel' };
});
export const corbelByCode = (code?: string) => (code ? corbelCatalog.find((c) => c.code === code) : undefined);
export const corbelLabel = (c: CorbelPick) => `Next Day ${c.code}: ${c.kind === 'bracket' ? 'bracket' : 'corbel'} ${fmtIn(c.w)} W × ${fmtIn(c.h)} H × ${fmtIn(c.d)} D, $${c.price.toFixed(2)}`;
const fmtIn = (v: number) => { const w = Math.floor(v + 1e-6), f = Math.round((v - w) * 16); const g = (a: number, b: number): number => (b ? g(b, a % b) : a); const k = f ? g(f, 16) : 1; return `${w ? w : ''}${f ? `${w ? '-' : ''}${f / k}/${16 / k}` : ''}"`; };
