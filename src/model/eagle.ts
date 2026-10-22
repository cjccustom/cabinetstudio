// Doors, drawer fronts and drawer boxes are bought from Eagle Woodworking (Methuen, MA).
// Style names and profiles from eaglewoodworking.com, checked Oct 22, 2026.

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

// From eaglewoodworking.com (MDF and wood door style pages), checked Oct 22, 2026.
// Every style but the slim shakers also comes with a raised center panel.
export const doorStyles: DoorStyle[] = [
  { id: 'jefferson', name: 'Jefferson Shaker', line: 'MDF', profile: 'shaker', stile: 2.25, panelChoice: true, detail: 'Classic shaker. Eagle’s most popular MDF door.' },
  { id: 'monroe', name: 'Monroe Slim Shaker', line: 'MDF', profile: 'slim', stile: 1.5, detail: 'Contemporary shaker with slender rails and stiles.' },
  { id: 'adams', name: 'Adams', line: 'MDF', profile: 'step', stile: 2.25, panelChoice: true, detail: '1/4" round-over inside profile.' },
  { id: 'franklin', name: 'Franklin', line: 'MDF', profile: 'bevel', stile: 2.25, panelChoice: true, detail: '22.5° bevel.' },
  { id: 'washington', name: 'Washington', line: 'MDF', profile: 'bevel', stile: 2.25, panelChoice: true, detail: '45° bevel.' },
  { id: 'hamilton', name: 'Hamilton', line: 'MDF', profile: 'bevel', stile: 2.25, panelChoice: true, detail: '60° bevel.' },
  { id: 'madison', name: 'Madison Ogee', line: 'MDF', profile: 'ogee', stile: 2.25, panelChoice: true, detail: 'Ogee bevel.' },
  { id: 'boston', name: 'Boston Shaker', line: 'Wood', profile: 'shaker', stile: 2.25, panelChoice: true, detail: 'Classic shaker. Eagle’s most popular wood door.' },
  { id: 'providence', name: 'Providence', line: 'Wood', profile: 'shaker', stile: 2.25, panelChoice: true, detail: 'Shaker with a shallow center panel.' },
  { id: 'hartford', name: 'Hartford', line: 'Wood', profile: 'step', stile: 2.25, panelChoice: true, detail: 'Rounded framing bead.' },
  { id: 'portsmouth', name: 'Portsmouth', line: 'Wood', profile: 'bevel', stile: 2.25, panelChoice: true, detail: '20° beveled framing bead.' },
  { id: 'nantucket', name: 'Nantucket', line: 'Wood', profile: 'bevel', stile: 2.25, panelChoice: true, detail: '30° bevel.' },
  { id: 'manchester', name: 'Manchester', line: 'Wood', profile: 'bevel', stile: 2.25, panelChoice: true, detail: '60° bevel.' },
  { id: 'newport', name: 'Newport Ogee', line: 'Wood', profile: 'ogee', stile: 2.25, panelChoice: true, detail: 'Ogee bevel.' },
  { id: 'portland', name: 'Portland', line: 'Wood', profile: 'ogee', stile: 2.25, panelChoice: true, detail: 'Cove profile.' },
  { id: 'cambridge', name: 'Cambridge Step Shaker', line: 'Wood', profile: 'step', stile: 2.25, panelChoice: true, detail: 'Shaker with a stepped inside edge.' },
  { id: 'barharbor', name: 'Bar Harbor Slim Shaker', line: 'Wood', profile: 'slim', stile: 1, fixedStile: true, detail: 'Slim mitered shaker, 1" rails and stiles. Eagle’s only mitered door.' },
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
