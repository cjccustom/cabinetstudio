import { defaultPilaster } from './pilaster';
import type { Cabinet, CabinetKind, FaceRow, Project, ShopSettings, WallId } from './types';
import { newAppliance, openingFor, type ApplianceKind } from './appliances';

export const defaultSettings: ShopSettings = {
  boxThickness: 0.75,
  boxActualThickness: 0.6875,
  backThickness: 0.5,
  backRabbetWidth: 0.625,
  dadoDepth: 0.25,
  bottomReveal: 0.0625,
  ffThickness: 0.75,
  stileWidth: 1.5,
  topRailWidth: 1.5,
  bottomRailWidth: 1.5,
  midRailWidth: 1.5,
  ffOverhang: 0,
  toeKickHeight: 4,
  toeKickDepth: 3,
  toeKickSkin: 0.5,
  endPanel: 'none',
  endPanelReveal: 0.25,
  endPanelThickness: 0.75,
  scribeAllowance: 0.5,
  blindClearance: 3,
  woodSpecies: 'Hard maple',
  moldSpecies: 'Maple',
  moldWaste: 0.15,
  purchaseTax: 0.0625,
  stretcherWidth: 4,
  hangingRails: false,
  nailerWidth: 3,
  doorStyleId: 'hartford',
  doorMaterial: 'Paint-grade maple',
  doorStile: 2.25,
  centerPanel: 'MDF-07',
  frontPanel: 'MDF-10',
  outsideEdge: 'E-01',
  hingeType: 'compact',
  drawerFronts: 'match',
  doorThickness: 0.75,
  doorMount: 'overlay',
  doorOverlay: 1.25,
  doorGap: 0.125,
  insetReveal: 0.09375,
  drawerSlide: 'tandem',
  tandemRearBrackets: 'overlay',
  drawerSide: 0.5,
  drawerWidthDeduction: 0.625,
  drawerHeightDeduction: 0.8125,
  drawerRearClearance: 0.5,
  counterThickness: 1.5,
  counterOverhang: 1,
  shelfSetback: 0.25,
  shelfClearance: 0.0625,
};

let counter = 0;
export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const row = (type: FaceRow['type'], height: number | null, doors: 1 | 2 = 1, shelves = 0): FaceRow => ({
  id: uid('row'), type, height, doors, shelves,
});

/** An appliance row, its opening sized to the appliance. */
const appRow = (kind: ApplianceKind): FaceRow => { const a = newAppliance(kind); return { ...row('appliance', openingFor(a)), appliance: a }; };

export interface Preset {
  id: string;
  label: string;
  kind: CabinetKind;
  width: number;
  height: number;
  depth: number;
  elevation: number;
  rows: () => FaceRow[];
  countertop?: boolean;
  blind?: Cabinet['blind'];
  corner?: Cabinet['corner'];
  group?: 'corner' | 'mudroom' | 'library' | 'fireplace';
  top?: Pick<Cabinet, 'topKind' | 'topThickness' | 'topFront' | 'topLeft' | 'topRight' | 'pilaster' | 'floating' | 'noBottom' | 'mantel'>;
}

export const presets: Preset[] = [
  { id: 'base-1dr', label: 'Base, drawer over door', kind: 'base', width: 18, height: 34.5, depth: 24, elevation: 0, countertop: true,
    rows: () => [row('drawer', 6), row('doors', null, 1, 1)] },
  { id: 'base-1dr2', label: 'Base, drawer over 2 doors', kind: 'base', width: 30, height: 34.5, depth: 24, elevation: 0, countertop: true,
    rows: () => [row('drawer', 6), row('doors', null, 2, 1)] },
  { id: 'base-3dr', label: 'Drawer base, 3 drawers', kind: 'base', width: 18, height: 34.5, depth: 24, elevation: 0, countertop: true,
    rows: () => [row('drawer', 6), row('drawer', 8), row('drawer', null)] },
  { id: 'base-sink', label: 'Sink base', kind: 'base', width: 36, height: 34.5, depth: 24, elevation: 0, countertop: true,
    rows: () => [row('falseFront', 6), row('doors', null, 2, 0)] },
  { id: 'base-door', label: 'Base, full-height doors', kind: 'base', width: 24, height: 34.5, depth: 24, elevation: 0, countertop: true,
    rows: () => [row('doors', null, 2, 1)] },
  { id: 'base-blind', label: 'Blind corner base', kind: 'base', width: 42, height: 34.5, depth: 24, elevation: 0, countertop: true, group: 'corner',
    blind: { side: 'left', dead: 24, clearance: 3 }, rows: () => [row('drawer', 6), row('doors', null, 1, 1)] },
  { id: 'base-lazy', label: 'Lazy susan corner base', kind: 'base', width: 36, height: 34.5, depth: 24, elevation: 0, countertop: true, group: 'corner',
    corner: { side: 'left', width2: 36, lazySusan: true }, rows: () => [row('doors', null, 1, 0)] },
  { id: 'wall-blind', label: 'Blind corner wall', kind: 'wall', width: 36, height: 30, depth: 12, elevation: 54, group: 'corner',
    blind: { side: 'left', dead: 12, clearance: 3 }, rows: () => [row('doors', null, 1, 2)] },
  { id: 'wall-corner', label: 'Corner wall, bifold doors', kind: 'wall', width: 24, height: 30, depth: 12, elevation: 54, group: 'corner',
    corner: { side: 'left', width2: 24, lazySusan: false }, rows: () => [row('doors', null, 1, 2)] },
  { id: 'bench', label: 'Bench base, open cubbies', kind: 'base', width: 48, height: 17.25, depth: 16, elevation: 0, countertop: true, group: 'mudroom',
    top: { topKind: 'wood', topThickness: 1.25, topFront: 1 }, rows: () => [row('open', null, 1, 0)] },
  { id: 'bench-drawers', label: 'Bench base, drawers', kind: 'base', width: 48, height: 17.25, depth: 16, elevation: 0, countertop: true, group: 'mudroom',
    top: { topKind: 'wood', topThickness: 1.25, topFront: 1 }, rows: () => [row('drawer', null)] },
  { id: 'cubby-upper', label: 'Upper cubbies, open', kind: 'wall', width: 48, height: 16, depth: 14, elevation: 66, group: 'mudroom',
    rows: () => [row('open', null, 1, 0)] },
  { id: 'locker', label: 'Locker, open with shelf', kind: 'tall', width: 18, height: 84, depth: 18, elevation: 0, group: 'mudroom',
    rows: () => [row('open', 14, 1, 0), row('open', null, 1, 0)] },
  { id: 'wall-1', label: 'Wall, 1 door', kind: 'wall', width: 18, height: 30, depth: 12, elevation: 54,
    rows: () => [row('doors', null, 1, 2)] },
  { id: 'wall-2', label: 'Wall, 2 doors', kind: 'wall', width: 30, height: 30, depth: 12, elevation: 54,
    rows: () => [row('doors', null, 2, 2)] },
  { id: 'wall-short', label: 'Wall, short (over range/fridge)', kind: 'wall', width: 30, height: 18, depth: 12, elevation: 66,
    rows: () => [row('doors', null, 2, 0)] },
  { id: 'tall-micro', label: 'Tall, microwave space between doors', kind: 'tall', width: 30, height: 84, depth: 24, elevation: 0,
    rows: () => [row('doors', 30, 2, 1), appRow('microwave'), row('doors', null, 2, 2)] },
  { id: 'tall-pantry', label: 'Tall pantry', kind: 'tall', width: 24, height: 84, depth: 24, elevation: 0,
    rows: () => [row('doors', null, 2, 2), row('doors', 46, 2, 3)] },
  // Library: base cabinets with a paint-grade top, open bookcases sitting on them, pilasters between
  { id: 'library-base', label: 'Library base, 2 doors', kind: 'base', width: 30, height: 30, depth: 16, elevation: 0, countertop: true, group: 'library',
    top: { topKind: 'wood', topThickness: 1, topFront: 0.5 }, rows: () => [row('doors', null, 2, 1)] },
  { id: 'library-upper', label: 'Bookcase upper, open', kind: 'wall', width: 30, height: 56, depth: 12, elevation: 31, group: 'library',
    top: { noBottom: true }, rows: () => [row('open', null, 1, 4)] },
  { id: 'library-fireplace', label: 'Library base, electric fireplace', kind: 'base', width: 48, height: 34, depth: 16, elevation: 0, countertop: true, group: 'library',
    top: { topKind: 'wood', topThickness: 1, topFront: 0.5 }, rows: () => [{ ...appRow('fireplace'), height: null }] },
  // Fireplaces: a surround built from legs, frieze, shelf, corbels and an optional pediment
  { id: 'mantel-electric', label: 'Mantel, electric insert', kind: 'mantel', width: 52.625, height: 54, depth: 6, elevation: 0, group: 'fireplace',
    top: { mantel: {} }, rows: () => [] },
  { id: 'mantel-gas', label: 'Mantel, gas fireplace or insert', kind: 'mantel', width: 52, height: 54, depth: 8, elevation: 0, group: 'fireplace',
    top: { mantel: { fuel: 'gas', openingW: 36, openingH: 26, openingY: 4, margin: 0, insert: { kind: 'gasInsert', w: 36, h: 26, d: 16, side: 0, top: 0, back: 0, mount: 'flush' } } }, rows: () => [] },
  { id: 'mantel-wood', label: 'Mantel, existing wood-burning firebox', kind: 'mantel', width: 68, height: 54, depth: 4, elevation: 0, group: 'fireplace',
    top: { mantel: { fuel: 'wood', install: 'masonry', openingW: 36, openingH: 30, openingY: 0, margin: 8, insert: undefined, legProud: 0.5, blockProud: 0.5, corbels: 0, hearthFront: 20, hearthSide: 12, hearthThickness: 2 } }, rows: () => [] },
  { id: 'pilaster', label: 'Pilaster, recessed panel', kind: 'pilaster', width: 5.5, height: 87, depth: 17.5, elevation: 0, group: 'library',
    top: { pilaster: { ...defaultPilaster, breaks: [31] } }, rows: () => [] },
  { id: 'float-shelf', label: 'Floating shelf', kind: 'shelf', width: 36, height: 2, depth: 12, elevation: 54, group: 'library',
    top: { floating: { grade: 'paint', face: 0.75 } }, rows: () => [] },
  { id: 'tall-open', label: 'Tall, open shelves', kind: 'tall', width: 18, height: 84, depth: 12, elevation: 0,
    rows: () => [row('open', null, 1, 5)] },
];

const prefix: Record<CabinetKind, string> = { base: 'B', wall: 'W', tall: 'T', pilaster: 'P', shelf: 'S', mantel: 'M' };

export function nextName(kind: CabinetKind, cabinets: Cabinet[]): string {
  const p = prefix[kind];
  const used = new Set(cabinets.map((c) => c.name));
  let n = 1;
  while (used.has(`${p}${n}`)) n++;
  return `${p}${n}`;
}

export function cabinetFromPreset(preset: Preset, wall: WallId, offset: number, cabinets: Cabinet[]): Cabinet {
  return {
    id: uid('cab'),
    name: nextName(preset.kind, cabinets),
    kind: preset.kind,
    wall,
    offset,
    elevation: preset.elevation,
    width: preset.width,
    height: preset.height,
    depth: preset.depth,
    rows: preset.rows(),
    centerStile: false,
    countertop: !!preset.countertop,
    ...(preset.blind ? { blind: { ...preset.blind } } : {}),
    ...(preset.corner ? { corner: { ...preset.corner } } : {}),
    ...(preset.top ?? {}),
  };
}

/** A small L-shaped kitchen so the app opens on something real. */
export function sampleProject(): Project {
  const cabs: Cabinet[] = [];
  const add = (id: string, wall: WallId, offset: number, patch: Partial<Cabinet> = {}) => {
    const p = presets.find((x) => x.id === id)!;
    cabs.push({ ...cabinetFromPreset(p, wall, offset, cabs), ...patch });
  };
  add('base-3dr', 'back', 0);
  add('base-1dr2', 'back', 18);
  add('base-sink', 'back', 48);
  add('base-1dr', 'back', 84, { width: 24 });
  add('base-1dr', 'back', 138);
  add('wall-1', 'back', 0);
  add('wall-2', 'back', 18);
  add('wall-2', 'back', 84, { width: 24 });
  add('wall-short', 'back', 108);
  add('wall-1', 'back', 138);
  add('tall-pantry', 'left', 0);
  return {
    version: 2,
    name: 'Sample kitchen',
    room: { width: 156, depth: 120, height: 96 },
    settings: { ...defaultSettings },
    finishes: { paint: '#e8e6df', box: '#d8c29a', counter: '#4a4c4f', wood: '#b9875a' },
    cabinets: cabs,
  };
}
