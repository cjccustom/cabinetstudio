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
}

/** The shop's construction standards. Every cabinet is built from these. */
export interface ShopSettings {
  boxThickness: number;
  backThickness: number;
  dadoDepth: number;
  ffThickness: number;
  stileWidth: number;
  topRailWidth: number;
  bottomRailWidth: number;
  midRailWidth: number;
  ffOverhang: number;
  toeKickHeight: number;
  toeKickDepth: number;
  stretcherWidth: number;
  nailerWidth: number;
  doorThickness: number;
  doorOverlay: number;
  doorGap: number;
  doorStyle: 'shaker' | 'slab';
  shakerFrameWidth: number;
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
  version: 1;
  name: string;
  room: Room;
  settings: ShopSettings;
  finishes: Finishes;
  cabinets: Cabinet[];
}

export type MaterialKey = 'box' | 'back' | 'faceframe' | 'door' | 'counter';

export type PartRole =
  | 'side' | 'bottom' | 'top' | 'stretcher' | 'back' | 'nailer' | 'toekick' | 'shelf'
  | 'stile' | 'rail' | 'door' | 'drawerFront' | 'counter';

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
  /** false for things like countertops that aren't cut in the shop. */
  cut: boolean;
  /** Geometry in cabinet-local inches: x = left→right, y = up, z = wall→front. */
  boxes: VisualBox[];
}
