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
  // Town buildings. Rects and points are game px; their footprints should be Wall tiles in the map.
  | {
      kind: "cityWall";
      /** The outer edge of the wall (a ring one tile thick), with round towers at the corners. */
      rect: Rect;
      /** The gap for the gate in the south side, flanked by the gatehouse towers. */
      gate: { x: number; w: number };
    }
  | { kind: "house"; rect: Rect; roof: string }
  | { kind: "keep"; rect: Rect }
  | { kind: "fountain"; x: number; y: number }
  | { kind: "stall"; rect: Rect; awning: string }
  /** A street lamp (not solid: you walk past it). */
  | { kind: "lamp"; x: number; y: number };

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
