/** Tile and sprite cell size, in game pixels. Every game position is the top-left of an 8x8 cell. */
export const T = 8;
/** Half a cell: add to a position to get the centre of its cell. */
export const HALF = T / 2;

/** An axis-aligned box in game pixels. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A campfire as a target: neutral, a yellow ring. */
export const CAMPFIRE_TARGET = { name: "Campfire", radius: 5, height: 0.6 } as const;

/**
 * Ground tiles. Path is trodden earth and Cobble is a paved street: open ground like grass. Wall is
 * anything built (a house, a city wall, a fountain): it blocks movement like a tree, and a prop draws it.
 */
export const Tile = { Grass: 0, Flower: 1, Water: 2, Tree: 3, Path: 4, Cobble: 5, Wall: 6 } as const;
export type Tile = (typeof Tile)[keyof typeof Tile];

/** Trees and buildings: nothing walks, spawns or flies through them. */
export const isSolidTile = (t: Tile): boolean => t === Tile.Tree || t === Tile.Wall;
