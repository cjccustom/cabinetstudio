// Doors, drawer fronts and drawer boxes are bought from Eagle Woodworking (Methuen, MA).
// Style names and profiles from eaglewoodworking.com, checked Oct 22, 2026.

export type DoorProfile = 'slab' | 'shaker' | 'slim' | 'step' | 'bevel' | 'raised' | 'ogee';

export interface DoorStyle {
  id: string;
  /** Eagle's framing bead (inside profile) code, e.g. 5pc - C. */
  bead?: string;
  name: string;
  line: 'MDF' | 'Wood' | 'Any';
  profile: DoorProfile;
  /** Default rail/stile width. */
  stile: number;
  /** Fixed stile width (mitered Bar Harbor). */
  fixedStile?: boolean;
  /** Offered with a flat or raised center panel. */
  panelChoice?: boolean;
  detail: string;
  verify?: boolean;
}

// From eaglewoodworking.com (MDF and wood door style pages), checked Oct 22, 2026.
// Every style but the slim shakers also comes with a raised center panel.
export const doorStyles: DoorStyle[] = [
  { id: 'jefferson', bead: '2pc - A', name: 'Jefferson Shaker', line: 'MDF', profile: 'shaker', stile: 2.25, panelChoice: true, detail: 'Classic shaker. Eagle’s most popular MDF door.' },
  { id: 'monroe', bead: '2pc - B', name: 'Monroe Slim Shaker', line: 'MDF', profile: 'slim', stile: 1.5, detail: 'Contemporary shaker with slender rails and stiles.' },
  { id: 'adams', bead: '2pc - C', name: 'Adams', line: 'MDF', profile: 'step', stile: 2.25, panelChoice: true, detail: '1/4" round-over inside profile.' },
  { id: 'franklin', bead: '2pc - D', name: 'Franklin', line: 'MDF', profile: 'bevel', stile: 2.25, panelChoice: true, detail: '22.5° bevel.' },
  { id: 'washington', bead: '2pc - E', name: 'Washington', line: 'MDF', profile: 'bevel', stile: 2.25, panelChoice: true, detail: '45° bevel.' },
  { id: 'hamilton', bead: '2pc - F', name: 'Hamilton', line: 'MDF', profile: 'bevel', stile: 2.25, panelChoice: true, detail: '60° bevel.' },
  { id: 'madison', bead: '2pc - G', name: 'Madison Ogee', line: 'MDF', profile: 'ogee', stile: 2.25, panelChoice: true, detail: 'Ogee bevel.' },
  { id: 'boston', bead: '5pc - A', name: 'Boston Shaker', line: 'Wood', profile: 'shaker', stile: 2.25, panelChoice: true, detail: 'Classic shaker. Eagle’s most popular wood door.' },
  { id: 'providence', bead: '5pc - B', name: 'Providence', line: 'Wood', profile: 'shaker', stile: 2.25, panelChoice: true, detail: 'Shaker with a shallow center panel.' },
  { id: 'hartford', bead: '5pc - C', name: 'Hartford', line: 'Wood', profile: 'step', stile: 2.25, panelChoice: true, detail: 'Rounded framing bead.' },
  { id: 'portsmouth', bead: '5pc - D', name: 'Portsmouth', line: 'Wood', profile: 'bevel', stile: 2.25, panelChoice: true, detail: '20° beveled framing bead.' },
  { id: 'nantucket', bead: '5pc - E', name: 'Nantucket', line: 'Wood', profile: 'bevel', stile: 2.25, panelChoice: true, detail: '30° bevel.' },
  { id: 'manchester', bead: '5pc - F', name: 'Manchester', line: 'Wood', profile: 'bevel', stile: 2.25, panelChoice: true, detail: '60° bevel.' },
  { id: 'newport', bead: '5pc - G', name: 'Newport Ogee', line: 'Wood', profile: 'ogee', stile: 2.25, panelChoice: true, detail: 'Ogee bevel.' },
  { id: 'portland', bead: '5pc - I', name: 'Portland', line: 'Wood', profile: 'ogee', stile: 2.25, panelChoice: true, detail: 'Cove profile.' },
  { id: 'cambridge', bead: '5pc - L', name: 'Cambridge Step Shaker', line: 'Wood', profile: 'step', stile: 2.25, panelChoice: true, detail: 'Shaker with a stepped inside edge.' },
  { id: 'barharbor', bead: '5pc - P', name: 'Bar Harbor Slim Shaker', line: 'Wood', profile: 'slim', stile: 1, fixedStile: true, detail: 'Slim mitered shaker, 1" rails and stiles. Eagle’s only mitered door.' },
  { id: 'slab', name: 'Slab', line: 'Any', profile: 'slab', stile: 0, detail: 'Flat one-piece door.' },
];

/** Drawer fronts shorter than this get narrow rails (Eagle used 1 1/2" rails on 5 13/16" fronts, full rails on 7 1/8"). */
export const narrowRailBelow = 6.5;
export const narrowRail = 1.5;

// Eagle's doors product guide (framing beads, center panels, outside edges, hinge boring), checked Oct 22, 2026.

export interface CenterPanel { code: string; name: string; raised?: boolean; /** Drawn flush with the frame front (flat front panels). */ flatFront?: boolean; line: 'MDF' | 'Veneer' | 'Wood'; note?: string }
export const centerPanels: CenterPanel[] = [
  { code: 'MDF-07', name: '1/4" flat panel', line: 'MDF', note: 'default 5pc painted' },
  { code: 'MDF-10', name: 'flat front panel with 1/8" back reveal flush', flatFront: true, line: 'MDF' },
  { code: 'MDF-01', name: 'flat front panel with 1/8" back reveal', flatFront: true, line: 'MDF' },
  { code: 'MDF-02', name: '3/8" flat panel', line: 'MDF', note: '2pc MDF or Bar Harbor only' },
  { code: 'MDF-03', name: 'beveled raised panel', raised: true, line: 'MDF' },
  { code: 'MDF-04', name: 'ogee raised panel', raised: true, line: 'MDF' },
  { code: 'MDF-05', name: 'cove raised panel', raised: true, line: 'MDF' },
  { code: 'MDF-06', name: 'beveled raised panel with shelf', raised: true, line: 'MDF' },
  { code: 'MDF-08', name: 'reverse bevel', line: 'MDF' },
  { code: 'MDF-09', name: 'reverse cove', line: 'MDF' },
  { code: 'VNR-01', name: '1/4" veneer flat panel', line: 'Veneer', note: 'default 5pc stained' },
  { code: 'VNR-02', name: '3/8" veneer flat panel', line: 'Veneer', note: 'Bar Harbor only' },
  { code: 'VNR-03', name: 'veneer flat front panel with 1/8" back reveal', flatFront: true, line: 'Veneer' },
  { code: 'WD-01', name: 'flat front panel with 1/8" back reveal', flatFront: true, line: 'Wood' },
  { code: 'WD-03', name: 'beveled raised panel', raised: true, line: 'Wood' },
  { code: 'WD-04', name: 'ogee raised panel', raised: true, line: 'Wood' },
  { code: 'WD-05', name: 'cove raised panel', raised: true, line: 'Wood' },
];
export const panelByCode = (code: string) => centerPanels.find((p) => p.code === code) ?? centerPanels[0];
export const panelText = (p: CenterPanel) => `${p.code} (${p.name}${p.note ? ` - ${p.note}` : ''})`;

export const outsideEdges = [
  { code: 'E-01', name: 'hand broken - default' },
  { code: 'E-02', name: 'ogee edge' },
  { code: 'E-03', name: '1/4" beveled edge' },
] as const;
export type OutsideEdge = (typeof outsideEdges)[number]['code'];
export const edgeText = (code: string) => { const e = outsideEdges.find((x) => x.code === code) ?? outsideEdges[0]; return `${e.code} (${e.name})`; };

/** Blum hinge used on the job; Eagle bores the cup for its tab distance. */
export const hingeTypes = {
  compact: { name: 'Blum Compact', boring: 'A-03 (cup only 3mm tab (1/8"))' },
  cliptop: { name: 'Blum Clip Top', boring: 'A-05 (cup only 5mm tab (3/16"))' },
} as const;
export type HingeType = keyof typeof hingeTypes;

/** Eagle won't bore hinge cups in stiles narrower than this, except on Bar Harbor. */
export const minBoringStile = 1.75;

/** Wood type names as Eagle's form spells them. */
export const eagleWood: Record<string, string> = {
  'Paint-grade maple': 'Maple - Paint Grade',
  'Natural maple': 'Maple',
  'White oak': 'White Oak',
  Birch: 'Birch',
  Cherry: 'Cherry',
  'Red oak': 'Red Oak',
  Walnut: 'Walnut',
  MDF: 'MDF',
};

/** Eagle's standard rail/stile widths. Rail/stile widths include any framing bead. */
export const stileWidths = [1.5, 1.75, 2.25, 2.5, 3, 3.25];

export const doorMaterials = ['MDF', 'Paint-grade maple', 'Natural maple', 'White oak', 'Birch', 'Cherry', 'Red oak', 'Walnut'];

export const styleById = (id: string) => doorStyles.find((d) => d.id === id) ?? doorStyles[0];

export interface Slide {
  id: string;
  name: string;
  /** Box width = opening width minus this, keyed by drawer side thickness. */
  widthDeduction: Record<string, number>;
  heightDeduction: number;
  lengths: number[];
  notch: string;
}

/**
 * Deductions from Eagle's measuring instructions (checked Oct 22, 2026): Tandem takes 5/8" off the
 * opening width for 1/2" sides, 3/8" for 5/8" sides, at least 13/16" off the height, and needs up to
 * 1/2" behind the box.
 */
export const slides: Slide[] = [
  { id: 'tandem', name: 'Blum Tandem (undermount)', widthDeduction: { '0.5': 0.625, '0.625': 0.375 }, heightDeduction: 0.8125, lengths: [9, 12, 15, 18, 21], notch: '1 3/8" notch, bored for Tandem' },
  // Eagle: side mount takes 1-1/16" off the width regardless of side thickness, at least 1/2" off the height
  { id: 'sidemount', name: 'Side mount', widthDeduction: { '0.5': 1.0625, '0.625': 1.0625 }, heightDeduction: 0.5, lengths: [10, 12, 14, 16, 18, 20, 22, 24], notch: 'no notch' },
];
export const sideThicknesses = [0.5, 0.625];

export interface DrawerInput {
  openingW: number;
  openingH: number;
  /** Clear depth from the face of the face frame to the back (or whatever stops the box). */
  depth: number;
  side: number;
  slideId: string;
  rearClearance: number;
  /** Used when slideId is 'custom'. */
  customW?: number;
  customH?: number;
}

export interface DrawerBox { w: number; h: number; d: number; slide: string; notch: string }

const floor16 = (v: number) => Math.floor(v * 16 + 1e-6) / 16;

/** Eagle-style drawer box sizing from a face frame opening. */
export function drawerBoxSize(i: DrawerInput): DrawerBox {
  const slide = slides.find((x) => x.id === i.slideId);
  const wDed = slide ? slide.widthDeduction[String(i.side)] ?? slide.widthDeduction['0.625'] : i.customW ?? 0.625;
  const hDed = slide ? slide.heightDeduction : i.customH ?? 0.8125;
  const lengths = slide ? slide.lengths : [9, 12, 15, 18, 21, 24];
  const d = [...lengths].reverse().find((l) => l <= i.depth - i.rearClearance) ?? 0;
  return {
    w: floor16(i.openingW - wDed),
    h: floor16(i.openingH - hDed),
    d,
    slide: slide ? slide.name : 'Custom slides',
    notch: slide ? slide.notch : 'Notch per slide spec',
  };
}

export const panelLabel = {
  none: 'None (finished case side)',
  flush: 'Applied, flush with doors',
  reveal: 'Applied, held back',
  inset: 'Inset, flush with frame',
} as const;

// Price estimates fitted to CJC's Eagle order acknowledgments, Jan–Oct 2026, before tax.
// Doors and fronts: 9 orders, 115 pieces of paint-grade maple 5-piece with MDF panels
// (Hartford, Portsmouth, Newport Ogee), all within about $0.70 of Eagle's price.
// Drawer boxes: 5 orders, 33 solid maple dovetail boxes, finished, notched and bored,
// all within about $2. Eagle prices a box by the stock board height it's cut from (whole
// inches, 4" minimum) plus a charge for ripping to an odd height.
export const eagleRates = {
  front: { base: 21.51, perSqFt: 9.732, perHingeHole: 1.941, centerRail: 7.227 },
  box: { base: 43.85, perGirthInch: 0.1458, perBottomSqIn: 0.0168, rip: 1.933, tallPerGirthInch: 0.0879 },
};

export type EagleItem = 'door' | 'drawerFront' | 'endPanel' | 'drawerBox';

/** Hinges per door by height, from Eagle's hinge boring table. */
export const hingeHoles = (h: number) => (h < 9 ? 0 : h <= 39 ? 2 : h <= 60 ? 3 : h <= 80 ? 4 : 5);
/** Eagle adds a center rail on tall 5-piece doors and panels. */
export const needsCenterRail = (h: number) => h > 50;

export function eagleFrontPrice(item: EagleItem, w: number, h: number): number {
  const r = eagleRates.front;
  return r.base + (r.perSqFt * w * h) / 144 + (item === 'door' ? r.perHingeHole * hingeHoles(h) : 0) + (needsCenterRail(h) ? r.centerRail : 0);
}

export function eagleBoxPrice(w: number, h: number, d: number): number {
  const r = eagleRates.box;
  const stock = Math.max(4, Math.ceil(h - 1e-6));
  const girth = w + d;
  return r.base + r.perGirthInch * girth * stock + r.perBottomSqIn * w * d + (stock - h > 1e-3 ? r.rip : 0) + r.tallPerGirthInch * Math.max(0, stock - 10) * girth;
}

/** Estimated Eagle price for one piece. */
export const eaglePrice = (item: EagleItem, w: number, h: number, d = 0) => (item === 'drawerBox' ? eagleBoxPrice(w, h, d) : eagleFrontPrice(item, w, h));
