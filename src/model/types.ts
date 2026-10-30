import type { Appliance } from './appliances';
import type { MantelSpec } from './mantel';

export type WallId = 'back' | 'left' | 'right' | 'front';
export type CabinetKind = 'base' | 'wall' | 'tall' | 'pilaster' | 'shelf' | 'mantel';

/** One horizontal band of the face frame, top to bottom, separated by mid rails. */
export interface FaceRow {
  id: string;
  type: 'drawer' | 'doors' | 'falseFront' | 'open' | 'appliance' | 'hang' | 'shoes';
  /** Face frame opening height. null = share the leftover height with other auto rows. */
  height: number | null;
  doors: 1 | 2;
  shelves: number;
  /** Width of the mid rail above this row, when it isn't the cabinet's standard (e.g. a tall rail for a ladder rail). */
  railAbove?: number;
  /** Hanging and shoe rows: closed with doors (a wardrobe) instead of open; doors = how many. */
  covered?: boolean;
  /** Shoe rows: shelves tipped down to the front (the default) or flat. */
  flatShoes?: boolean;
  /** Hanging rows: how far the rod's center sits below the shelf above it, when not the shop's standard. */
  rodDrop?: number;
  /** What sits in an appliance row: a microwave, wall oven, fireplace insert... */
  appliance?: Appliance;
  /** A solid ledge on the rail above this row, projecting past the face frame: the waist of a one-piece
   *  bookcase with doors below and open shelves above. */
  ledge?: { thickness: number; overhang: number };
}

/**
 * How a case is assembled. top: a base cabinet's front and back stretchers, or a solid top panel
 * for a clean interior (open or glass-front cabinets, a top that shows from inside). joinery: how
 * the case is fastened (standard = glue and staples, pocket screws from inside on bare exposed ends).
 * shelves: adjustable on pins, or fixed in dados.
 */
export interface CaseBuild {
  top?: 'stretchers' | 'solid';
  joinery?: 'standard' | 'pocket' | 'staples' | 'confirmat';
  shelves?: 'adjustable' | 'fixed';
  /** The inside of the open sections: left prefinished, or scuffed, primed and painted with the millwork. */
  interior?: 'prefinished' | 'paint';
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
  /** Distance the back of the cabinet stands off its wall (0 = against it). */
  wallInset?: number;
  /**
   * Freestanding island (a closet island): stands off the wall by wallInset, back finished with a
   * panel in the door style, toe kick carried around the back, top overhanging all four sides.
   */
  island?: boolean;
  /** An island with fronts on both sides: a second case back to back with this one, mirrored, under one top. */
  islandSides?: 1 | 2;
  /** The far side's openings, when they differ from the front's (same as the front when unset). */
  backRows?: FaceRow[];
  /** Top overhang past the finished back (islands). */
  topBack?: number;
  /** A custom cushion on a bench seat, made by an upholsterer. */
  cushion?: Cushion;
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
  /** What the customer calls where it goes ("Fridge wall", "Window seat"); groups it on the proposal. Unset = its wall. */
  area?: string;
  /** Offered on top of the base price as part of this named option (e.g. "Additional cabinets"); the customer ticks it when signing. */
  option?: string;
  /** Notes for the drawings: for the customer, the shop, or both. */
  notes?: CabinetNote[];
  /** Floor cabinets: toe kick, baseboard wrap or a decorative skirt. */
  base?: CabinetBase;
  /** Open bookcase uppers: no case bottom; the sides stand on the countertop below. */
  noBottom?: boolean;
  /** Face frame bottom rail on a cabinet with no case bottom (left off unless turned on). */
  bottomRail?: boolean;
  /** Solid stock applied to the front edge of the adjustable shelves, in place of edgebanding. Top flush with the shelf. */
  shelfFront?: { height: number; thickness: number };
  /** End panel on an exposed end. default = the job's standard. */
  leftPanel?: PanelChoice;
  rightPanel?: PanelChoice;
  /** Extra width on the outside stiles, used instead of fillers and scribed on site. */
  scribeLeft?: number;
  scribeRight?: number;
  /** One stile wider or narrower than the cabinet's standard stile width. */
  stileLeftWidth?: number;
  stileRightWidth?: number;
  /** Blind corner: the end that runs into the corner, and how far from that end the door opening starts. */
  blind?: { side: 'left' | 'right'; /** Covered by the cabinet on the other wall. */ dead: number; /** Extra stile width past the face frame stile, for the neighbour's doors and pulls (or an appliance). */ clearance: number };
  /** L-shaped corner cabinet spanning two walls. width runs along this wall, width2 along the other. */
  corner?: { side: 'left' | 'right'; width2: number; lazySusan: boolean };
  /** Any shop standard changed for just this cabinet. */
  overrides?: Partial<ShopSettings>;
  /** How this case goes together, where it differs from the usual way. */
  build?: CaseBuild;
  /** What sits on top of a base cabinet: stone (by others) or a solid wood top/bench seat built in the shop. */
  topKind?: 'stone' | 'wood';
  topThickness?: number;
  /** Overhang past the door face, and past each end. */
  topFront?: number;
  topLeft?: number;
  topRight?: number;
  /** Anderson & McQuaid profile numbers. */
  crown?: string;
  lightRail?: string;
  baseMold?: string;
  /** How the crown is built up on top of the cabinet. */
  crownBuild?: CrownBuild;
  /** Pilaster details (kind 'pilaster'). Its depth runs from the wall to the panel face. */
  pilaster?: PilasterSpec;
  /** Fireplace mantel / surround (kind 'mantel'): width is outside the legs, height the shelf top, depth wall to frieze. */
  mantel?: Partial<MantelSpec>;
  /** Floating shelf details (kind 'shelf'). Height is the shelf thickness. */
  floating?: FloatingShelfSpec;
}

export interface Cushion {
  /** Foam thickness. */
  thickness: number;
  /** Knife edge (two panels sewn at the edge) or boxed (a band around the sides, usually welted). */
  edge: 'knife' | 'boxed';
  /** Fabric, once picked; blank = owner's selection, to come. */
  fabric?: string;
  notes?: string;
}

/** Full-height pilaster between built-in sections: plywood sides, Eagle panels on the face, solid plinth and capital. */
export interface PilasterSpec {
  /** Plinth block at the floor; the base moulding wraps it. */
  plinth: number;
  /** Capital block at the top, under the frieze and crown. */
  capital: number;
  /** Heights off the floor where the panel breaks with a solid band (e.g. at the base cabinet top). */
  breaks: number[];
  /** Height of each band at a break. */
  band: number;
  /** How far the plinth, bands and capital stand proud of the panel face. */
  proud: number;
  /** shop = stiles and rails with the panel let into a rabbet from the back; eagle = panels ordered from Eagle. */
  face: 'shop' | 'eagle';
  stile: number;
  /** Top and bottom rails; rails at breaks use the band height. */
  rail: number;
  panelThickness: number;
  /** Rabbet the panel sits in, each edge. */
  rabbet: number;
  /** A&M panel or bead moulding mitered around each panel on the front. */
  panelMold?: string;
  /** Stiles, rails, plinth and capital in this species; empty = the job's face frame stock. */
  species?: string;
  /** The room's baseboard and cap wrapped around the plinth: heights and thickness. */
  wrap?: { h: number; cap: number; t: number };
  /** With no plinth block: how high the base and cap applied over the face reach, so the panel frame starts above it. */
  foot?: number;
}

/** Floating shelf: 3/4" plywood top and bottom with a mitered solid face, open in the middle for the bracket. */
export interface FloatingShelfSpec {
  grade: 'paint' | 'stain';
  /** Solid face and end cap thickness. */
  face: number;
  /** Floating shelf brackets; empty = one per stud at 16" centers. */
  brackets?: number;
}

/**
 * Crown built up on a wall or tall cabinet: an optional flat sub-crown (solid stock, face flush with
 * the doors), raised above the case on a plywood nailer if needed, with the crown and any extra
 * mouldings stacked down its face.
 */
export interface CrownBuild {
  /** Height of the flat sub-crown; 0 = none, crown goes straight on the face frame. */
  subCrown: number;
  /** How far the build rises above the cabinet top, on a 3/4" plywood nailer. */
  rise: number;
  /** How far the crown's top sits below the top of the build. */
  drop: number;
  /** More A&M profiles stacked under the crown, top to bottom (bed mould, bead, ...). */
  extra: string[];
}

/** Beadboard or other paneling applied to a wall, like a backsplash above a mudroom bench. */
export interface WallPanel {
  id: string;
  name: string;
  wall: WallId;
  offset: number;
  width: number;
  /** Bottom edge, off the floor. */
  bottom: number;
  height: number;
  /** Nantucket Beadboard product id from the catalog (Standard Bead, V-Bead, a strip product…). */
  profile: string;
  thickness?: number;
  material: 'MDF' | 'MRI' | 'MRX' | 'PVC';
  /** Older projects only; the product decides sheet or strip now. */
  format?: 'sheet' | 'strip';
  /** Bead spacing on center. */
  spacing?: number;
  /** Solid wood cap or ledge along the top. */
  cap: boolean;
  capHeight: number;
  capDepth: number;
  /** Anderson & McQuaid profile for the cap; a plain solid wood ledge when unset. */
  capProfile?: string;
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
  /** Eagle center panel code for doors and end panels, e.g. MDF-07. */
  centerPanel: string;
  /** Eagle center panel code for drawer fronts. */
  frontPanel: string;
  outsideEdge: import('./eagle').OutsideEdge;
  hingeType: import('./eagle').HingeType;
  drawerFronts: 'match' | 'slab';
  doorThickness: number;
  doorMount: 'overlay' | 'inset';
  doorOverlay: number;
  /** Gap between a pair of doors, and between fronts that share a mid rail or center stile. */
  doorGap: number;
  /** Reveal around inset doors and between inset pairs. */
  insetReveal: number;
  drawerSlide: string;
  /** Blum Tandem rear mounting brackets, two per drawer: on overlay jobs only, always or never. */
  tandemRearBrackets: 'overlay' | 'always' | 'never';
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
  /** Default extra blind stile width on blind corners, past the face frame stile. */
  blindClearance: number;
  /** Solid wood species for face frames, tops, seats and caps. */
  woodSpecies: string;
  /**
   * Plywood for the cases (sides, tops, bottoms, shelves, backs), e.g. "Prefinished birch", "Red oak".
   * Unset on older jobs: their sheets are just "3/4\" plywood".
   */
  plywood?: string;
  /**
   * How the cases are built: face frame (the shop's standard) or frameless, with banded case
   * edges, a fixed shelf where a mid rail would be and full-overlay fronts. Unset = face frame.
   */
  construction?: 'faceframe' | 'frameless';
  /** Paint grade (the shop's usual) or stain grade: clear-finished species, so every joint, nail hole and veneer match shows. */
  finish?: 'paint' | 'stain';
  /** Closet rod: 1 5/16" round, wood or metal, in rod sockets. */
  closetRod?: 'wood' | 'metal';
  /** Rod center below the shelf (or case top) over it. */
  rodDrop?: number;
  /** Plywood for exposed case sides and toe kick skins when it differs from the cases; empty = the same. */
  exposedPlywood?: string;
  /** Species for Anderson & McQuaid mouldings, as they list it (Maple, Poplar…). */
  moldSpecies: string;
  /** Extra moulding for miters and defects. 0.15 = 15%. */
  moldWaste: number;
  /** Sales tax the shop pays on materials it buys (customers aren't charged tax). 0.0625 = 6.25%. */
  purchaseTax: number;
  counterThickness: number;
  counterOverhang: number;
  shelfSetback: number;
  shelfClearance: number;
}

export interface Finishes {
  paint: string;
  /** Stain color on stain-grade work; unset = the species' natural tone. */
  stain?: string;
  box: string;
  counter: string;
  wood: string;
  /** Room walls. */
  wall?: string;
  /** Room trim: casing, baseboard, crown. */
  trim?: string;
  /** The ceiling. */
  ceiling?: string;
}

/** A door, window or cased opening cut into a wall. Offset and sill are to the rough opening's edge, like a cabinet. */
export interface Opening {
  id: string;
  name: string;
  /** open = a gap in the wall with no trim: the room carries on past it (a hall, another room). */
  kind: 'door' | 'window' | 'cased' | 'open';
  wall: WallId;
  offset: number;
  width: number;
  height: number;
  /** Off the floor; 0 for doors and cased openings. */
  sill: number;
  trim: OpeningTrim;
  /** Doors: the Reeb design hung in it, which side the hinges are on (facing it from the room), and how many leaves. */
  door?: { design?: string; hinge: 'left' | 'right'; leaves: 1 | 2; prehung: boolean };
}

/** Casing on the room side of an opening: a profiled casing, or flat stock with a back band and header cap. */
export interface OpeningTrim {
  /** A&M casing profile. Leave empty to use flat stock. */
  casing?: string;
  /** Flat casing width when there's no profile; 0 = no casing. */
  flat: number;
  backBand?: string;
  headCap?: string;
  /** Windows: stool across the sill and apron under it. */
  stool?: string;
  apron?: string;
}

/** Mouldings run around the room, broken at cabinets and door casings. */
export interface RoomTrim {
  crown?: string;
  base?: string;
  chairRail?: string;
  /** Top of the chair rail off the floor. */
  chairHeight: number;
  walls: WallId[];
}

export interface Floor {
  kind: 'hardwood' | 'tile' | 'vinyl' | 'carpet' | 'concrete';
  color: string;
  /** Plank width or tile size. */
  size: number;
}

export interface Room {
  width: number;
  depth: number;
  height: number;
}

export interface Project {
  version: 2;
  name: string;
  /** How the customer's proposal describes the work: plain (no sizes, the default) or full, cabinet by cabinet with sizes. */
  proposalDetail?: 'plain' | 'full';
  room: Room;
  settings: ShopSettings;
  finishes: Finishes;
  cabinets: Cabinet[];
  panels?: WallPanel[];
  cutlist?: import('./cutlist').CutlistData;
  faceFrame?: Partial<import('./faceframe').FaceFrameStock>;
  quote?: Partial<import('./quote').QuoteSettings>;
  release?: Partial<import('./release').ReleaseState>;
  /** This design's job on the shop clock. */
  shopJobId?: string;
  openings?: Opening[];
  roomTrim?: RoomTrim;
  /** How the room is lit in 3D. */
  lights?: Partial<import('./lighting').RoomLights>;
  /** Price per board foot for solid stock in species other than the face frame stock, by species. */
  speciesPrices?: Record<string, number>;
  /** Doors and room trim are drawn for the design; these put them in the quote and orders on jobs that include them. */
  scope?: { doors?: boolean; roomTrim?: boolean };
  floor?: Floor;
  /** $ per lineal foot for this job by profile number, where there's no list price (Brosco) or a quoted one. */
  moldPrices?: Record<string, number>;
  /** $ per sheet for this job by sheet material ("3/4\" red oak plywood"), for plywood without a shop price. */
  sheetPrices?: Record<string, number>;
  /** Eagle's quoted totals for this job by request (doors & panels, drawer fronts, drawer boxes), used in place of the estimate. */
  eagleQuotes?: Partial<Record<'doors' | 'fronts' | 'boxes', number>>;
  /**
   * Drawings of profiles milled to match, by their custom:... number: a name and the outline as
   * installed (inches, back against the wall at u = 0, v up), traced from a sample or knife drawing.
   */
  profiles?: Record<string, { name?: string; pts: [number, number][] }>;
  /** $ per door for this job by Reeb design and size, e.g. "PR8730 2/8x6/8 prehung". */
  doorPrices?: Record<string, number>;
  /** Up or down from Reeb's catalog prices, e.g. your dealer's discount. -0.1 = 10% off. */
  doorAdjust?: number;
  /** Photo-based renderings for selling the job. */
  render?: Partial<import('./rendering').RenderState>;
  /** The customer, and their folder in Dropbox. */
  client?: Partial<import('./client').ClientInfo>;
  dropbox?: import('./client').DropboxLink;
  /** This job's page on the client portal: its id there and what it last said. */
  portal?: { jobId: string; url?: string; status?: import('../portal').JobStatus; checkedAt?: number };
  /** Drawing sets: paper, revision, cover picture, notes. */
  drawings?: Partial<import('../drawings/sheets').DrawingSettings>;
  /** What the job sold for: contract lines, options chosen, allowances, payment schedule. */
  contract?: import('./contract').Contract;
  /** Free-standing furniture on the job (dining tables for now). */
  furniture?: Partial<import('./furniture').DiningTable>[];
  /** A coffered ceiling over the room. */
  ceiling?: Partial<import('./coffer').CofferCeiling>;
}

export type MaterialKey = 'box' | 'back' | 'toeSkin' | 'faceframe' | 'door' | 'drawerBox' | 'counter' | 'solidWood' | 'hardware' | 'upholstery';

export type PartRole =
  | 'side' | 'bottom' | 'top' | 'stretcher' | 'back' | 'nailer' | 'toekick' | 'shelf'
  | 'stile' | 'rail' | 'door' | 'drawerFront' | 'drawerBox' | 'endPanel' | 'counter' | 'woodTop' | 'trim' | 'rod' | 'cushion';

export interface CabinetNote { id: string; text: string; for: 'both' | 'customer' | 'shop' }

export interface CabinetBase {
  style: 'kick' | 'baseboard' | 'arch';
  /** Baseboard or skirt height off the floor, not counting a cap moulding on top. */
  height: number;
  /** A custom base cap milled to match the room's (not an A&M profile): its height. 0 = none. */
  cap?: number;
  /** Decorative base: cut into a wide face frame rail, or an applied skirt board. */
  build: 'faceframe' | 'applied';
  shape: 'bracket' | 'arch' | 'straight';
  /** Height of the cutout. */
  rise: number;
  /** Foot width at each end, from the outside of the face frame (or end). */
  foot: number;
}

/** A flat piece with a shaped edge (an arched skirt or rail): its outline, extruded through its thickness. */
export interface CutShape {
  /** Runs along x (across the front) or z (an end, its thickness toward +x). */
  along: 'x' | 'z';
  min: [number, number, number];
  thickness: number;
  /** Outline in the piece's own (along, up) coordinates. */
  outline: [number, number][];
}

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
  /** Sheet goods other than the job's case and back plywood, e.g. 1/4" MDF or stain-grade plywood. */
  sheet?: string;
  /** How it's finished, when that isn't what its material suggests (painted MDF panels, stained shelf plywood). */
  look?: 'paint' | 'wood';
  /** Solid stock in a different species from the job's face frame stock (poplar pilasters on a maple job). */
  species?: string;
  length: number;
  width: number;
  thickness: number;
  note?: string;
  /** Shelves: false when a solid front is applied instead of edgebanding. */
  banded?: boolean;
  /** false for anything not cut in the shop (bought doors, drawer boxes, countertops). */
  cut: boolean;
  /** Ordered from Eagle. Sizes are finished W × H (× D for drawer boxes). */
  order?: { item: 'door' | 'drawerFront' | 'drawerBox' | 'endPanel'; w: number; h: number; d?: number; spec: string; /** 5-piece rail and stile widths; absent on slabs. */ rail?: number; stile?: number };
  /** Geometry in cabinet-local inches: x = left→right, y = up, z = wall→front. */
  boxes: VisualBox[];
  shapes?: CutShape[];
}
