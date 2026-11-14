// The furniture builder's designs: what kind of piece it is (from the gallery), and the piece itself,
// a table-type piece (tables, benches, stools) or a bed. Designs live in the shop's library; adding
// one to a job puts a copy on the job, where it's priced, proposed and drawn in the room.
import type { Project } from './types';
import { uid } from './defaults';
import { newBench, newTable, type DiningTable, type TopShape } from './furniture';
import { newBed, type Bed } from './bed';
import { newCase, type CaseKind, type CasePiece } from './casePiece';
import { priceQuote, quoteOf } from './quote';

export type FurnitureType = 'dining' | 'kitchen' | 'coffee' | 'side' | 'console' | 'desk' | 'bench' | 'stool' | 'bed' | 'nightstand' | 'dresser' | 'chest' | 'sideboard' | 'media' | 'scratch';

export interface FurnitureDesign {
  id: string;
  name: string;
  type: FurnitureType;
  table?: DiningTable;
  bed?: Bed;
  /** Case pieces: nightstand, dresser, chest, sideboard, media console. */
  case?: CasePiece;
  updatedAt: number;
}

interface TypeInfo { id: FurnitureType; label: string; group: string; hint: string; shapes: TopShape[] | null; soon?: boolean; make: () => { table?: DiningTable; bed?: Bed; case?: CasePiece } }

const table = (patch: Partial<DiningTable>) => ({ table: { ...newTable(), ...patch } });
const allShapes: TopShape[] = ['rect', 'round', 'oval', 'racetrack'];

/** The gallery, grouped: each type starts at sizes that suit it. */
export const furnitureTypes: TypeInfo[] = [
  { id: 'dining', label: 'Dining table', group: 'Tables', hint: '84" × 40" × 30", seats 8', shapes: allShapes, make: () => table({ name: 'Dining table', use: 'dining table' }) },
  { id: 'kitchen', label: 'Kitchen or work table', group: 'Tables', hint: '60" × 36" × 30"', shapes: allShapes, make: () => table({ name: 'Kitchen table', use: 'kitchen table', length: 60, width: 36, leg: 'square', legSize: 2.5 }) },
  { id: 'coffee', label: 'Coffee table', group: 'Tables', hint: '48" × 24" × 17"', shapes: allShapes, make: () => table({ name: 'Coffee table', use: 'coffee table', length: 48, width: 24, height: 17, leg: 'square', legSize: 2, apron: 3 }) },
  { id: 'side', label: 'Side or end table', group: 'Tables', hint: '22" × 22" × 24"', shapes: allShapes, make: () => table({ name: 'Side table', use: 'side table', length: 22, width: 22, height: 24, leg: 'tapered', legSize: 1.75, apron: 3 }) },
  { id: 'console', label: 'Console table', group: 'Tables', hint: '54" × 16" × 31"', shapes: ['rect', 'racetrack'], make: () => table({ name: 'Console table', use: 'console table', length: 54, width: 16, height: 31, leg: 'tapered', legSize: 1.75, apron: 4 }) },
  { id: 'desk', label: 'Desk', group: 'Tables', hint: '60" × 30" × 30"', shapes: ['rect', 'racetrack'], make: () => table({ name: 'Desk', use: 'desk', length: 60, width: 30, leg: 'tapered', legSize: 2.25 }) },
  { id: 'bench', label: 'Bench seat', group: 'Seating', hint: '48" × 16" × 18"', shapes: ['rect', 'racetrack'], make: () => ({ table: newBench() }) },
  { id: 'stool', label: 'Stool', group: 'Seating', hint: '14" × 14" × 24" (counter height)', shapes: ['rect', 'round'], make: () => ({ table: { ...newBench(), name: 'Stool', use: 'stool', length: 14, width: 14, height: 24, legSize: 1.5, apron: 2.5, stretchers: 'box' as const } }) },
  { id: 'bed', label: 'Bed frame', group: 'Bedroom', hint: 'Platform or frame, any mattress size', shapes: null, make: () => ({ bed: newBed() }) },
  { id: 'nightstand', label: 'Nightstand', group: 'Bedroom', hint: '22" × 16" × 26", 2 drawers on legs', shapes: null, make: () => ({ case: newCase('nightstand') }) },
  { id: 'dresser', label: 'Dresser', group: 'Bedroom', hint: '60" × 20" × 34", 2 over 3 drawers', shapes: null, make: () => ({ case: newCase('dresser') }) },
  { id: 'chest', label: 'Chest of drawers', group: 'Bedroom', hint: '36" × 20" × 50", graduated drawers', shapes: null, make: () => ({ case: newCase('chest') }) },
  { id: 'sideboard', label: 'Sideboard or buffet', group: 'Storage', hint: '66" × 18" × 36", drawers over doors', shapes: null, make: () => ({ case: newCase('sideboard') }) },
  { id: 'media', label: 'Media console', group: 'Storage', hint: '72" × 18" × 24", open over doors', shapes: null, make: () => ({ case: newCase('media') }) },
  { id: 'scratch', label: 'Start from scratch', group: 'Other', hint: 'A plain top on four legs to shape your own way', shapes: allShapes, make: () => table({ name: 'New piece', use: 'table', length: 48, width: 30, leg: 'square' }) },
];
export const typeInfo = (t: FurnitureType) => furnitureTypes.find((x) => x.id === t)!;

/** A new design of a type, in a shape (a round top is as wide as it is long). */
export function newDesign(type: FurnitureType, shape: TopShape = 'rect'): FurnitureDesign {
  const info = typeInfo(type);
  const made = info.make();
  const d: FurnitureDesign = { id: uid('fd'), name: made.bed?.name ?? made.case?.name ?? made.table!.name, type, updatedAt: Date.now(), ...made };
  if (d.table) {
    d.table = { ...d.table, type, shape, ...(shape === 'round' ? { width: d.table.length } : {}) };
    if (shape === 'round' && d.table.length > 60) d.table = { ...d.table, length: 54, width: 54 };
  }
  return d;
}

/** A job's furniture as designs, for the builder's "In this job" list. */
export function jobPieces(p: Project): FurnitureDesign[] {
  return [
    ...(p.furniture ?? []).map((t) => ({ id: t.id!, name: t.name ?? 'Table', type: (t.type as FurnitureType) ?? (t.kind === 'bench' ? 'bench' : 'dining'), table: { ...newTable(), ...t } as DiningTable, updatedAt: 0 })),
    ...(p.beds ?? []).map((b) => ({ id: b.id!, name: b.name ?? 'Bed', type: 'bed' as FurnitureType, bed: { ...newBed(), ...b } as Bed, updatedAt: 0 })),
    ...(p.cases ?? []).map((c) => ({ id: c.id!, name: c.name ?? 'Nightstand', type: ((c.kind as CaseKind) ?? 'nightstand') as FurnitureType, case: { ...newCase((c.kind as CaseKind) ?? 'nightstand'), ...c } as CasePiece, updatedAt: 0 })),
  ];
}

/** What the piece comes to on its own at the job's pricing (the furniture line, with workload). */
export function designPrice(p: Project, d: Pick<FurnitureDesign, 'table' | 'bed' | 'case'>): { price: number; hours: number; materials: number } {
  const lone: Project = { ...p, rooms: undefined, cabinets: [], panels: [], openings: [], ceiling: undefined, furniture: d.table ? [d.table] : [], beds: d.bed ? [d.bed] : [], cases: d.case ? [d.case] : [], quote: { ...p.quote, extras: [], scopeExtra: [] } };
  const r = priceQuote(lone);
  const q = quoteOf(lone);
  const g = r.groups.find((x) => x.group === 'furniture');
  return { price: g ? g.price * (1 + q.workloadAdj[q.workload]) : 0, hours: g?.hours ?? 0, materials: g?.materials ?? 0 };
}

/** Put a copy of a library design on the job (or update the job's copy). */
export function addToJob(p: Project, d: FurnitureDesign): { project: Project; id: string } {
  if (d.table) {
    const id = uid('tbl');
    return { project: { ...p, furniture: [...(p.furniture ?? []), { ...d.table, id, name: d.name, designId: d.id }] }, id };
  }
  if (d.case) {
    const id = uid('case');
    return { project: { ...p, cases: [...(p.cases ?? []), { ...d.case, id, name: d.name }] }, id };
  }
  const id = uid('bed');
  return { project: { ...p, beds: [...(p.beds ?? []), { ...d.bed!, id, name: d.name }] }, id };
}
export function updateInJob(p: Project, d: FurnitureDesign): Project {
  if (d.table) return { ...p, furniture: (p.furniture ?? []).map((t) => (t.id === d.id ? { ...d.table!, id: d.id, name: d.name } : t)) };
  if (d.case) return { ...p, cases: (p.cases ?? []).map((c) => (c.id === d.id ? { ...d.case!, id: d.id, name: d.name } : c)) };
  return { ...p, beds: (p.beds ?? []).map((b) => (b.id === d.id ? { ...d.bed!, id: d.id, name: d.name } : b)) };
}
export function removeFromJob(p: Project, id: string): Project {
  return { ...p, furniture: (p.furniture ?? []).filter((t) => t.id !== id), beds: (p.beds ?? []).filter((b) => b.id !== id), cases: (p.cases ?? []).filter((c) => c.id !== id) };
}
