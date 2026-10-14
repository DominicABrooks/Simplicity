/** Tile and sprite cell size, in game pixels. Every game position is the top-left of an 8x8 cell. */
export const T = 8;
/** Half a cell: add to a position to get the centre of its cell. */
export const HALF = T / 2;

export const MAP_W = 64;
export const MAP_H = 44;
export const MAP_SEED = 7;

/** Where the hero starts (top-left of the cell, game pixels). */
export const SPAWN = { x: 22 * T, y: 18 * T } as const;

/** An axis-aligned box in game pixels. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The camp you start at, just around the spawn: a tent to the north-west, a campfire to the
 * north-east with a log to sit on. The tent and the fire are solid.
 */
export const CAMP = {
  tent: { x: 19 * T, y: 15 * T, w: 2 * T, h: 2 * T },
  fire: { x: 24 * T, y: 16 * T },
  seat: { x: 25 * T + 3, y: 17 * T + 2 },
} as const;

/** What blocks movement in the camp: the tent's footprint and the fire pit. */
export const CAMP_SOLIDS: readonly Rect[] = [
  { x: CAMP.tent.x + 1, y: CAMP.tent.y + 2, w: CAMP.tent.w - 2, h: CAMP.tent.h - 3 },
  { x: CAMP.fire.x + 1, y: CAMP.fire.y + 1, w: T - 2, h: T - 2 },
];

export const Tile = { Grass: 0, Flower: 1, Water: 2, Tree: 3 } as const;
export type Tile = (typeof Tile)[keyof typeof Tile];
