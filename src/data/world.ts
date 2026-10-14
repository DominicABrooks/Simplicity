/** Tile and sprite cell size, in game pixels. Every game position is the top-left of an 8x8 cell. */
export const T = 8;
/** Half a cell: add to a position to get the centre of its cell. */
export const HALF = T / 2;

export const MAP_W = 64;
export const MAP_H = 44;
export const MAP_SEED = 7;

/** Where the hero starts (top-left of the cell, game pixels). */
export const SPAWN = { x: 22 * T, y: 18 * T } as const;

export const Tile = { Grass: 0, Flower: 1, Water: 2, Tree: 3 } as const;
export type Tile = (typeof Tile)[keyof typeof Tile];
