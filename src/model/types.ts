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
}

export type EndMode = 'auto' | 'exposed' | 'hidden';

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
  doorOverlay: number;
  doorGap: number;
  drawerWidthDeduction: number;
  drawerHeightDeduction: number;
  drawerRearClearance: number;
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
}

export type MaterialKey = 'box' | 'back' | 'faceframe' | 'door' | 'drawerBox' | 'counter';

export type PartRole =
  | 'side' | 'bottom' | 'top' | 'stretcher' | 'back' | 'nailer' | 'toekick' | 'shelf'
  | 'stile' | 'rail' | 'door' | 'drawerFront' | 'drawerBox' | 'counter';

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
  order?: { item: 'door' | 'drawerFront' | 'drawerBox'; w: number; h: number; d?: number; spec: string };
  /** Geometry in cabinet-local inches: x = left→right, y = up, z = wall→front. */
  boxes: VisualBox[];
}
