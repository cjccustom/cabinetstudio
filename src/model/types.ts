export type WallId = 'back' | 'left' | 'right' | 'front';
export type CabinetKind = 'base' | 'wall' | 'tall';

/** One horizontal band of the face frame, top to bottom, separated by mid rails. */
export interface FaceRow {
  id: string;
  type: 'drawer' | 'doors' | 'falseFront' | 'open';
  /** Face frame opening height. null = share the leftover height with other auto rows. */
  height: number | null;
  doors: 1 | 2;
  shelves: number;
}

export interface Cabinet {
  id: string;
  name: string;
  kind: CabinetKind;
  wall: WallId;
  /** Distance from the left end of the wall (standing in the room, facing it) to the cabinet's left edge. */
  offset: number;
  /** Height of the cabinet bottom off the floor. */
  elevation: number;
  width: number;
  height: number;
  depth: number;
  rows: FaceRow[];
  centerStile: boolean;
  countertop: boolean;
  /** Finished (exposed) end panels. auto = exposed when nothing sits against that side. */
  leftEnd?: EndMode;
  rightEnd?: EndMode;
  /** Wall cabinets: box bottom flush with the bottom of the face frame instead of tucked behind the rail. */
  bottomFlush?: boolean;
  /** End panel on an exposed end. default = the job's standard. */
  leftPanel?: PanelChoice;
  rightPanel?: PanelChoice;
  /** Extra width on the outside stiles, used instead of fillers and scribed on site. */
  scribeLeft?: number;
  scribeRight?: number;
  /** Blind corner: the end that runs into the corner, and how far from that end the door opening starts. */
  blind?: { side: 'left' | 'right'; width: number };
  /** L-shaped corner cabinet spanning two walls. width runs along this wall, width2 along the other. */
  corner?: { side: 'left' | 'right'; width2: number; lazySusan: boolean };
}

export type EndMode = 'auto' | 'exposed' | 'hidden';
/** flush = applied, front flush with the door face; reveal = applied, held back from the door face; inset = front flush with the face frame. */
export type PanelMode = 'none' | 'flush' | 'reveal' | 'inset';
export type PanelChoice = 'default' | PanelMode;

/** The shop's construction standards. Every cabinet is built from these. */
export interface ShopSettings {
  /** Nominal case thickness, used for all cut-size math (3/4"). */
  boxThickness: number;
  /** What the plywood really measures (a heavy 11/16"). Only affects the drawing and the real overhang. */
  boxActualThickness: number;
  backThickness: number;
  /** Width of the rabbet the back sits in, measured from the back edge of the sides. */
  backRabbetWidth: number;
  /** Depth of every dado and rabbet. */
  dadoDepth: number;
  /** How far the box bottom sits below the top of the face frame bottom rail. */
  bottomReveal: number;
  ffThickness: number;
  stileWidth: number;
  topRailWidth: number;
  bottomRailWidth: number;
  midRailWidth: number;
  /** Planned overhang of the face frame past each case side, on top of what thin plywood gives. */
  ffOverhang: number;
  toeKickHeight: number;
  toeKickDepth: number;
  stretcherWidth: number;
  hangingRails: boolean;
  nailerWidth: number;
  doorStyleId: string;
  doorMaterial: string;
  doorStile: number;
  doorPanel: 'flat' | 'raised';
  drawerFronts: 'match' | 'slab';
  doorThickness: number;
  doorMount: 'overlay' | 'inset';
  doorOverlay: number;
  /** Gap between a pair of doors, and between fronts that share a mid rail or center stile. */
  doorGap: number;
  /** Reveal around inset doors and between inset pairs. */
  insetReveal: number;
  drawerSlide: string;
  drawerSide: number;
  drawerWidthDeduction: number;
  drawerHeightDeduction: number;
  drawerRearClearance: number;
  /** Finished toe kick skin, applied at install. The case is built back by its thickness. */
  toeKickSkin: number;
  endPanel: PanelMode;
  endPanelReveal: number;
  endPanelThickness: number;
  /** Added to the cut width of extended stiles so there's wood to scribe. */
  scribeAllowance: number;
  /** Stile on a blind corner between the dead area and the doors; leaves room for the neighbour's doors and pulls. */
  blindStileWidth: number;
  counterThickness: number;
  counterOverhang: number;
  shelfSetback: number;
  shelfClearance: number;
}

export interface Finishes {
  paint: string;
  box: string;
  counter: string;
}

export interface Room {
  width: number;
  depth: number;
  height: number;
}

export interface Project {
  version: 2;
  name: string;
  room: Room;
  settings: ShopSettings;
  finishes: Finishes;
  cabinets: Cabinet[];
  cutlist?: import('./cutlist').CutlistData;
  faceFrame?: Partial<import('./faceframe').FaceFrameStock>;
}

export type MaterialKey = 'box' | 'back' | 'toeSkin' | 'faceframe' | 'door' | 'drawerBox' | 'counter';

export type PartRole =
  | 'side' | 'bottom' | 'top' | 'stretcher' | 'back' | 'nailer' | 'toekick' | 'shelf'
  | 'stile' | 'rail' | 'door' | 'drawerFront' | 'drawerBox' | 'endPanel' | 'counter';

export interface VisualBox {
  min: [number, number, number];
  size: [number, number, number];
  /** Recessed shaker panels render a touch darker. */
  shade?: number;
}

/** A single physical part. length runs with the grain. */
export interface Part {
  name: string;
  role: PartRole;
  material: MaterialKey;
  length: number;
  width: number;
  thickness: number;
  note?: string;
  /** false for anything not cut in the shop (bought doors, drawer boxes, countertops). */
  cut: boolean;
  /** Ordered from Eagle. Sizes are finished W × H (× D for drawer boxes). */
  order?: { item: 'door' | 'drawerFront' | 'drawerBox' | 'endPanel'; w: number; h: number; d?: number; spec: string };
  /** Geometry in cabinet-local inches: x = left→right, y = up, z = wall→front. */
  boxes: VisualBox[];
}
