// Areas: the world is a graph of areas joined by exits (caves, for now). Each area is a module in
// src/areas/ exporting an AreaDef. Only the area you're in is built and in memory; the others are
// just ids until you travel there (and every area but the home one is downloaded on first visit).
import type { CurioId } from "../data/items.ts";
import type { Rect } from "../data/world.ts";
import type { Point } from "./collision.ts";
import type { TileMap } from "./map.ts";

/** Where an exit leads: an area, and the arrival point there. */
export interface Destination {
  area: string;
  entry: string;
}

/**
 * Walk into `rect` to travel to `to`. A door `locked` with a curiosity (the Rusted Key) opens for whoever carries it,
 * and stays open: see src/game/undercroft.ts.
 */
export interface ExitDef {
  rect: Rect;
  to: Destination;
  locked?: CurioId;
}

/** Static scenery the renderer builds for an area (and the map view marks). */
export type Prop =
  | {
      kind: "camp";
      /** Its tent, if it has one (the Greyed's camp has just its cold fire). */
      tent?: Rect;
      /** The fire pit's cell (top-left). */
      fire: Point;
      seat: Point;
    }
  | {
      kind: "cave";
      /** The cave mouth's centre on the ground, game px. */
      x: number;
      y: number;
      /** The way the opening faces (and you walk in from the opposite side of it). */
      facing: "north" | "south";
    }
  // Town buildings. Rects and points are game px (heights are world units, one tile each); their
  // footprints should be Wall tiles in the map (except what you walk under: arcades, bridges, gates).
  | {
      /**
       * A defensive wall along `points`, with a round tower at every point: a closed ring (outward is away
       * from its middle) or an open run (outward is away from `inside`, a point within). Thick enough to walk along the top,
       * behind a crenellated parapet. Each gate is a gap `width` wide at `at` on whichever edge it falls,
       * with a gatehouse.
       */
      kind: "curtainWall";
      points: Point[];
      closed: boolean;
      inside?: Point;
      gates: { at: Point; width: number }[];
      height: number;
      thickness: number;
      tower: { radius: number; height: number; roof: string };
    }
  /**
   * A town house, gable end to the street when it's deeper than it's wide; its door is on the `doorSide`
   * face, onto the street. A shop opens its ground floor onto the street with a counter of `shop` goods;
   * an inn or shop hangs a `sign` (its board's colour); `lantern` hangs one by the door; `stone` gives
   * it a stone ground floor.
   */
  | { kind: "house"; rect: Rect; roof: string; storeys: number; doorSide: Facing; shop?: Goods; sign?: string; lantern?: boolean; stone?: boolean }
  /**
   * A hall: a long building with its ridge along its longer side and its door on `door`. `stone` or
   * timber-framed; `arcade` leaves the ground floor open on pillars (a market hall you walk under);
   * `louvre` (a kitchen) gives it a pyramid roof with a smoking vent; `raised` sets it on staddle stones
   * (a granary).
   */
  | { kind: "hall"; rect: Rect; door: Facing; roof: string; storeys: number; stone: boolean; arcade?: boolean; louvre?: boolean; raised?: boolean; chimneys?: number }
  /** A parish church or chapel running west to east (door west, altar east), with a west `tower` (and spire) or a bell-cote. */
  | { kind: "church"; rect: Rect; tower: "spire" | "tower" | "bellcote" }
  /** The cathedral, running west to east: twin west towers, nave and aisles, a crossing tower and spire, and a rounded east end. */
  | { kind: "cathedral"; rect: Rect }
  /** A cloister: a covered walk round a green garth, entered from `door`. */
  | { kind: "cloister"; rect: Rect; door: Facing }
  /** An eight-sided chapter house. */
  | { kind: "chapterHouse"; x: number; y: number; radius: number }
  /** Rows of headstones and crosses in a churchyard. */
  | { kind: "graves"; rect: Rect }
  /** A market cross on its stepped base. */
  | { kind: "cross"; x: number; y: number }
  /** A round dovecote, doves wheeling about it. */
  | { kind: "dovecote"; x: number; y: number }
  /** The castle keep on its rocky crag `plinth` high, a stair up to its door; its great hall `height` high. */
  | { kind: "keep"; rect: Rect; plinth: number; height: number }
  /** A barbican or a bridge's gate tower: two towers and a walled passage `gap` wide (3 by default), open toward
   * `facing`; `rich` builds it in marble under gilded roofs, its arms over the arch. */
  | { kind: "barbican"; rect: Rect; facing: Facing; height: number; gap?: number; rich?: boolean }
  /** A drawbridge over a moat, running north-south, lowered. */
  | { kind: "drawbridge"; rect: Rect }
  /** A flight of steps up to a wall walk, against a wall, climbing toward `rises`. */
  | { kind: "stairs"; rect: Rect; rises: Facing; height: number }
  /** A torch in an iron sconce on a wall, facing `facing`, `height` up (not solid). */
  | { kind: "torch"; x: number; y: number; facing: Facing; height: number }
  /** A plank bridge over water, running north-south. */
  | { kind: "bridge"; rect: Rect }
  /** A stone bridge of arches over water, running north-south, with parapets; `rich` builds it in marble and gold,
   * shields on its posts and banners hung down its sides. */
  | { kind: "stoneBridge"; rect: Rect; rich?: boolean }
  /** A gilded lion couchant on a marble plinth, looking toward `facing`. */
  | { kind: "lion"; x: number; y: number; facing: Facing }
  /** A long open-fronted stable, its stalls toward `facing`, horses in them. */
  | { kind: "stable"; rect: Rect; facing: Facing }
  // The country and the river.
  /** A post windmill, its sails turning. */
  | { kind: "windmill"; x: number; y: number }
  /** A watermill on a riverbank, its wheel turning in the water toward `wheel`. */
  | { kind: "watermill"; rect: Rect; wheel: Facing }
  /** A boat moored on the water, bow toward `facing`: a rowing boat or a cog with a mast. */
  | { kind: "boat"; x: number; y: number; facing: Facing; size: "rowing" | "cog" }
  /** A treadwheel crane on a quay, its jib out toward `facing`. */
  | { kind: "crane"; x: number; y: number; facing: Facing }
  /** A post-and-rail fence along `points`. */
  | { kind: "fence"; points: Point[] }
  /** A round pavilion tent with a striped roof and a pennant. */
  | { kind: "pavilion"; x: number; y: number; color: string }
  /** A covered wooden grandstand, its seats toward `facing`. */
  | { kind: "grandstand"; rect: Rect; facing: Facing }
  /** A field of `crop` in rows (not solid). */
  | { kind: "field"; rect: Rect; crop: "wheat" | "barley" | "cabbage" }
  // The market and public places (src/render/market.ts).
  /** A two-tier fountain, `radius` world units across its basin, with a crowned king on top. */
  | { kind: "fountain"; x: number; y: number; radius: number }
  /** A market stall selling `goods`, its counter toward `facing`. */
  | { kind: "stall"; rect: Rect; awning: string; goods: Goods; facing: "north" | "south" }
  /** A heap of market stock. */
  | { kind: "stock"; x: number; y: number; what: "barrels" | "crates" | "sacks" | "hay" }
  /** A string of little flags between two points, `height` up at each end, on its own `masts` or tied to something there. */
  | { kind: "bunting"; from: Point; to: Point; height: number; masts?: boolean }
  /** A tall pole flying a banner. */
  | { kind: "standard"; x: number; y: number }
  /** Flagstones over a rect, with a kerb round the edge and rings of paving round `centre` (not solid). */
  | { kind: "plaza"; rect: Rect; centre: Point }
  // What you'd find in a castle (src/render/castle.ts). Long things lie along their rect's long side.
  /** The King, on his throne, looking toward `facing`. A game entity (a friendly target you can talk to), not scenery. */
  | { kind: "king"; x: number; y: number; facing: Facing }
  // Under St Mary's (src/render/undercroft.ts).
  /** A low iron-banded door in a wall, steps going down behind it, opening toward `facing`. */
  | { kind: "cryptDoor"; x: number; y: number; facing: Facing }
  /** A stone chest tomb, long along `facing`'s axis, the one in it carved lying on the lid if `effigy`. */
  | { kind: "tomb"; x: number; y: number; facing: Facing; effigy: boolean }
  /** A ring of `stones` old grey standing stones, `radius` tiles out, the `gap`th (from the north, clockwise) missing. */
  | { kind: "stoneRing"; x: number; y: number; radius: number; stones: number; gap: number }
  /** A guard at their post, keeping watch toward `facing`. A game entity (a friendly target), not scenery. */
  | { kind: "guard"; x: number; y: number; facing: Facing }
  /** A fire bowl on a tripod. */
  | { kind: "brazier"; x: number; y: number }
  /** A practice dummy, its target toward `facing`. */
  | { kind: "dummy"; x: number; y: number; facing: Facing }
  /** An archery butt, its face toward `facing`. */
  | { kind: "target"; x: number; y: number; facing: Facing }
  /** A weapon rack along the rect, its front toward `facing`. */
  | { kind: "rack"; rect: Rect; facing: Facing }
  /** A covered well. */
  | { kind: "well"; x: number; y: number }
  /** A lean-to forge with an anvil, a grindstone and a quench barrel, open to the south. */
  | { kind: "smithy"; rect: Rect }
  /** A trebuchet, its arm throwing toward `facing`. */
  | { kind: "trebuchet"; rect: Rect; facing: Facing }
  /** A hay cart, its shafts toward `facing`. */
  | { kind: "cart"; rect: Rect; facing: Facing }
  /** A saddled horse, its head toward `facing`. */
  | { kind: "horse"; rect: Rect; facing: Facing }
  /** A water trough. */
  | { kind: "trough"; rect: Rect }
  // Inside a house (src/render/interior.ts): the room, and what's in it.
  /** A room: its floor (planks, flagstones in a stone house, or the throne room's marble), low walls round it (so the camera sees in) and a doorway in one, doorAt tiles along it. */
  | { kind: "room"; rect: Rect; floor: "planks" | "flags" | "marble"; wall: string; door: Facing; doorAt: number }
  /** A piece of furniture, centred at (x, y), its front toward its facing. */
  | { kind: "furniture"; item: FurnitureItem; x: number; y: number; facing: Facing };

/** What furnishes a house, and the throne room (from "throne" on). */
export type FurnitureItem = "hearth" | "table" | "bench" | "bed" | "chest" | "shelf" | "barrel" | "counter" | "loom" | "workbench" | "anvil" | "rug" | "cradle"
  | "throne" | "dais" | "carpet" | "pillar" | "tapestry" | "candelabra" | "chandelier" | "urn" | "window";

export type Facing = "north" | "south" | "east" | "west";
/** A facing as a game angle (0 east, PI/2 south: y grows southward). */
export const FACING_ANGLE: Record<Facing, number> = { east: 0, south: Math.PI / 2, west: Math.PI, north: -Math.PI / 2 };
export type Goods = "produce" | "bread" | "cloth" | "pottery" | "fish" | "flowers" | "meat";

/** Everything about an area's ground, built once (deterministically) when you enter it. */
export interface AreaLayout {
  map: TileMap;
  /** Named arrival points (cell top-left, game px). */
  entries: Record<string, Point>;
  exits: ExitDef[];
  props: Prop[];
  /**
   * What's drawn, when it's more than the map: a larger grid of tiles whose top-left is (x, y) tiles from
   * the map's (so x, y <= 0), holding the map and what lies past its edges (the next district, as it is
   * there), and the props standing out there. Seen from the map, never walked: nothing out there is solid.
   */
  view?: { map: TileMap; x: number; y: number; props: Prop[] };
}

/** What lives in an area. Leave it out for an empty area. */
export interface AreaLife {
  /** Slimes and mages, topped up over time. */
  enemies: boolean;
  /** Potions scattered on arrival. */
  potions: boolean;
  /** Critters and grass, reeds and mushrooms. */
  ambient: boolean;
}

export interface AreaDef {
  /** Must match the module's file name in src/areas/. */
  id: string;
  /** Shown on the map and when you arrive. */
  name: string;
  /** Deterministic: the same layout every time. */
  build(): AreaLayout;
  life?: AreaLife;
  /** Inside a building: no sky, weather or mountains, and the firelight. */
  indoors?: boolean;
}
