import type { Rng } from "../core/rng.ts";
import { T, Tile, isSolidTile } from "../data/world.ts";
import { isOpenGround, tileOf, type TileMap } from "./map.ts";

export interface Point {
  x: number;
  y: number;
}

/** The tile under a game-pixel position. Outside the map counts as forest. */
export const tileAt = (map: TileMap, px: number, py: number): Tile => tileOf(map, Math.floor(px / T), Math.floor(py / T));

/** The collision box inside the 8x8 cell at (x, y): centred on the cell, where the body is drawn,
 * 6 px wide and 4 deep, so you stand as close to a wall coming from the south as from the north. */
export const FEET = { x: 1, y: 2, w: 6, h: 4 } as const;

/** Does the feet box of the cell at (x, y) touch a solid (the camp's tent or fire)? */
export const hitsSolid = (map: TileMap, x: number, y: number): boolean =>
  map.solids.some(r => x + FEET.x < r.x + r.w && r.x < x + FEET.x + FEET.w && y + FEET.y < r.y + r.h && r.y < y + FEET.y + FEET.h);

/** Does the feet box of the cell at (x, y) touch anything solid (or water, if `blocksWater`)? */
export function blocked(map: TileMap, x: number, y: number, blocksWater: boolean): boolean {
  const x0 = x + FEET.x, x1 = x + FEET.x + FEET.w - 0.01, y0 = y + FEET.y, y1 = y + FEET.y + FEET.h - 0.01;
  for (const [px, py] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]] as const) {
    const t = tileAt(map, px, py);
    if (isSolidTile(t) || (blocksWater && t === Tile.Water)) return true;
  }
  return hitsSolid(map, x, y);
}

/** Move by (dx, dy), one axis at a time, so you slide along walls instead of sticking. */
export function moveBy(map: TileMap, p: Point, dx: number, dy: number, blocksWater: boolean): void {
  if (dx && !blocked(map, p.x + dx, p.y, blocksWater)) p.x += dx;
  if (dy && !blocked(map, p.x, p.y + dy, blocksWater)) p.y += dy;
}

/** Two cells overlap enough to touch (pickups, contact damage). */
export const overlap = (a: Point, b: Point): boolean => Math.abs(a.x - b.x) < 6 && Math.abs(a.y - b.y) < 6;

/** A random open-ground cell at least minDist px from `from`, or null after 200 tries. */
export function randomGroundSpot(map: TileMap, rng: Rng, from: Point, minDist: number): Point | null {
  for (let i = 0; i < 200; i++) {
    const x = rng.int(1, map.width - 2) * T, y = rng.int(1, map.height - 2) * T;
    if (isOpenGround(map.tiles[y / T]![x / T]!) && !hitsSolid(map, x, y) && Math.hypot(x - from.x, y - from.y) >= minDist) return { x, y };
  }
  return null;
}
