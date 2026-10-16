// Movement and shot collision. Trees (and water, for things that can't swim) block by the tile; anything
// built blocks by its shapes (shapes.ts, made from its props by solids.ts), so walls, towers, stalls and
// posts are as solid as they look and no more.
import type { Rng } from "../core/rng.ts";
import { T, Tile } from "../data/world.ts";
import { isOpenGround, tileOf, type TileMap } from "./map.ts";
import { anyContains, anyOverlaps } from "./shapes.ts";

export interface Point {
  x: number;
  y: number;
}

/** The tile under a game-pixel position. Outside the map counts as forest. */
export const tileAt = (map: TileMap, px: number, py: number): Tile => tileOf(map, Math.floor(px / T), Math.floor(py / T));

/** The collision box inside the 8x8 cell at (x, y): centred on the cell, where the body is drawn,
 * 6 px wide and 4 deep, so you stand as close to a wall coming from the south as from the north. */
export const FEET = { x: 1, y: 2, w: 6, h: 4 } as const;

/** Does the feet box of the cell at (x, y) touch a solid shape (a building, a post, the camp's tent)? */
export const hitsSolid = (map: TileMap, x: number, y: number): boolean =>
  anyOverlaps(map.solids, { x0: x + FEET.x, y0: y + FEET.y, x1: x + FEET.x + FEET.w, y1: y + FEET.y + FEET.h });

/** Is there something solid at a point (for shots: arrows stick in it, bolts burst on it)? */
export const solidAt = (map: TileMap, px: number, py: number): boolean => tileAt(map, px, py) === Tile.Tree || anyContains(map.solids, px, py);

/** Does the feet box of the cell at (x, y) touch anything solid (or water, if `blocksWater`)? */
export function blocked(map: TileMap, x: number, y: number, blocksWater: boolean): boolean {
  const x0 = x + FEET.x, x1 = x + FEET.x + FEET.w - 0.01, y0 = y + FEET.y, y1 = y + FEET.y + FEET.h - 0.01;
  for (const [px, py] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]] as const) {
    const t = tileAt(map, px, py);
    if (t === Tile.Tree || (blocksWater && t === Tile.Water)) return true;
  }
  return hitsSolid(map, x, y);
}

/** The most a move goes in one step, so nothing fast (a dash, a slow frame) skips through a thin post. */
const STEP = 2;

/**
 * Move by (dx, dy) in small steps, one axis at a time, so you slide along walls instead of sticking, and
 * come to rest right against whatever stops you.
 */
export function moveBy(map: TileMap, p: Point, dx: number, dy: number, blocksWater: boolean): void {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / STEP)), sx = dx / n, sy = dy / n;
  let xFree = sx !== 0, yFree = sy !== 0;
  for (let i = 0; i < n && (xFree || yFree); i++) {
    if (xFree) { if (blocked(map, p.x + sx, p.y, blocksWater)) xFree = false; else p.x += sx; }
    if (yFree) { if (blocked(map, p.x, p.y + sy, blocksWater)) yFree = false; else p.y += sy; }
  }
}

/** Two cells overlap enough to touch (pickups, contact damage). */
export const overlap = (a: Point, b: Point): boolean => Math.abs(a.x - b.x) < 6 && Math.abs(a.y - b.y) < 6;

/** A random open-ground cell (or one of tile `on`) at least minDist px from `from`, or null after 200 tries. */
export function randomGroundSpot(map: TileMap, rng: Rng, from: Point, minDist: number, on?: Tile): Point | null {
  for (let i = 0; i < 200; i++) {
    const x = rng.int(1, map.width - 2) * T, y = rng.int(1, map.height - 2) * T, t = map.tiles[y / T]![x / T]!;
    if ((on === undefined ? isOpenGround(t) : t === on) && !hitsSolid(map, x, y) && Math.hypot(x - from.x, y - from.y) >= minDist) return { x, y };
  }
  return null;
}
