// Areas: the world is a graph of areas joined by exits (caves, for now). Each area is a module in
// src/areas/ exporting an AreaDef. Only the area you're in is built and in memory; the others are
// just ids until you travel there (and every area but the home one is downloaded on first visit).
import type { Rect } from "../data/world.ts";
import type { Point } from "./collision.ts";
import type { TileMap } from "./map.ts";

/** Where an exit leads: an area, and the arrival point there. */
export interface Destination {
  area: string;
  entry: string;
}

/** Walk into `rect` to travel to `to`. */
export interface ExitDef {
  rect: Rect;
  to: Destination;
}

/** Static scenery the renderer builds for an area (and the map view marks). */
export type Prop =
  | {
      kind: "camp";
      tent: Rect;
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
  // footprints should be Wall tiles in the map.
  | {
      /** A defensive wall around a polygon, with a round tower at every corner. */
      kind: "curtainWall";
      points: Point[];
      /** The gate: a gap `width` wide centred at `x` on edge `edge` (from points[edge] to the next), with a gatehouse. */
      gate: { edge: number; x: number; width: number };
      height: number;
      tower: { radius: number; height: number; roof: string };
    }
  /** A town house; its door is on the `doorSide` face (south by default), onto the street. An inn or
   * shop hangs a `sign` (its board's colour) over the door. */
  | { kind: "house"; rect: Rect; roof: string; storeys?: number; doorSide?: "north" | "south"; sign?: string }
  /** The castle keep, raised on a rocky crag `plinth` high with a stair up to its door. */
  | { kind: "keep"; rect: Rect; plinth: number }
  /** A cathedral: a long nave running east-west, a bell tower with a spire at its west end. */
  | { kind: "cathedral"; rect: Rect }
  /** A plank bridge over water, running north-south. */
  | { kind: "bridge"; rect: Rect }
  /** A two-tier fountain, `radius` world units across its basin, with a crowned king on top. */
  | { kind: "fountain"; x: number; y: number; radius: number }
  /** A market stall selling `goods`, its counter toward `facing`. */
  | { kind: "stall"; rect: Rect; awning: string; goods: Goods; facing: "north" | "south" }
  /** A statue on a plinth, looking toward `facing`. */
  | { kind: "statue"; x: number; y: number; figure: "king" | "knight"; facing: Facing }
  /** A stone planter with a tree in it. */
  | { kind: "planter"; x: number; y: number }
  /** A bench along the rect's long side; you'd sit looking toward `facing`. */
  | { kind: "bench"; rect: Rect; facing: Facing }
  /** A heap of market stock. */
  | { kind: "stock"; x: number; y: number; what: "barrels" | "crates" | "sacks" | "hay" }
  /** A string of little flags between two points, `height` up at each end, on its own `masts` or tied to something there. */
  | { kind: "bunting"; from: Point; to: Point; height: number; masts?: boolean }
  /** A tall pole flying a banner (not solid). */
  | { kind: "standard"; x: number; y: number }
  /** Flagstones over a rect, with a kerb round the edge and rings of paving round `centre` (not solid). */
  | { kind: "plaza"; rect: Rect; centre: Point }
  // What you'd find in a castle (src/render/castle.ts). Long things lie along their rect's long side.
  /** A guard with a spear, standing watch toward `facing`. */
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
  /** A street lamp (not solid: you walk past it). */
  | { kind: "lamp"; x: number; y: number };

export type Facing = "north" | "south" | "east" | "west";
export type Goods = "produce" | "bread" | "cloth" | "pottery" | "fish" | "flowers";

/** Everything about an area's ground, built once (deterministically) when you enter it. */
export interface AreaLayout {
  map: TileMap;
  /** Named arrival points (cell top-left, game px). */
  entries: Record<string, Point>;
  exits: ExitDef[];
  props: Prop[];
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
}
