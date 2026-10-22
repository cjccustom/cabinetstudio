// Doors, drawer fronts and drawer boxes are bought from Eagle Woodworking (Methuen, MA).
// Style names come from Eagle's published catalog. Profiles marked `verify` couldn't be
// confirmed from their site and are drawn as a plain shaker until checked.

export type DoorProfile = 'slab' | 'shaker' | 'slim' | 'step' | 'bevel' | 'raised' | 'ogee';

export interface DoorStyle {
  id: string;
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

export const doorStyles: DoorStyle[] = [
  { id: 'jefferson', name: 'Jefferson Shaker', line: 'MDF', profile: 'shaker', stile: 2.25, detail: 'Classic shaker, flat panel. Eagle’s most popular style.' },
  { id: 'franklin', name: 'Franklin', line: 'MDF', profile: 'bevel', stile: 2.25, detail: '22.5° bevel on the frame.' },
  { id: 'washington', name: 'Washington', line: 'MDF', profile: 'bevel', stile: 2.25, detail: '45° bevel on the frame.' },
  { id: 'hamilton', name: 'Hamilton', line: 'MDF', profile: 'bevel', stile: 2.25, detail: '60° bevel on the frame.' },
  { id: 'madison', name: 'Madison Ogee', line: 'MDF', profile: 'ogee', stile: 2.25, detail: 'Ogee profile on the frame.' },
  { id: 'monroe', name: 'Monroe', line: 'MDF', profile: 'shaker', stile: 2.25, detail: 'Profile not confirmed. Drawn as shaker.', verify: true },
  { id: 'adams', name: 'Adams', line: 'MDF', profile: 'shaker', stile: 2.25, detail: 'Profile not confirmed. Drawn as shaker.', verify: true },
  { id: 'providence', name: 'Providence', line: 'Wood', profile: 'shaker', stile: 2.25, detail: 'Wood shaker, cope and stick.' },
  { id: 'cambridge', name: 'Cambridge Step Shaker', line: 'Wood', profile: 'step', stile: 2.25, detail: 'Shaker with a stepped inside edge.' },
  { id: 'nantucket', name: 'Nantucket', line: 'Wood', profile: 'bevel', stile: 2.25, panelChoice: true, detail: '30° bevel. Flat or raised center panel.' },
  { id: 'barharbor', name: 'Bar Harbor', line: 'Wood', profile: 'slim', stile: 1, fixedStile: true, detail: 'Slim mitered shaker, 1" rails and stiles.' },
  { id: 'slab', name: 'Slab', line: 'Any', profile: 'slab', stile: 0, detail: 'Flat one-piece door.' },
];

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
 * Blum Tandem deductions match Eagle's drawer calculator: 5/8" off the opening width for
 * 1/2" sides, 3/8" for 5/8" sides, and at least 13/16" off the opening height.
 */
export const slides: Slide[] = [
  { id: 'tandem', name: 'Blum Tandem (undermount)', widthDeduction: { '0.5': 0.625, '0.625': 0.375 }, heightDeduction: 0.8125, lengths: [9, 12, 15, 18, 21], notch: '1 3/8" notch, bored for Tandem' },
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
