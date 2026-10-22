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

/** Undermount slide lengths, which set the drawer box depth. */
export const slideLengths = [9, 12, 15, 18, 21, 24, 27, 30];
