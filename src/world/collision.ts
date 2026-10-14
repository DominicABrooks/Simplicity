import type { Rng } from "../core/rng.ts";
import { T, Tile } from "../data/world.ts";
import { isOpenGround, tileOf, type TileMap } from "./map.ts";

export interface Point {
  x: number;
  y: number;
}

/** The tile under a game-pixel position. Outside the map counts as forest. */
export const tileAt = (map: TileMap, px: number, py: number): Tile => tileOf(map, Math.floor(px / T), Math.floor(py / T));

/** Feet-level collision box: x+1..x+7, y+4..y+8 inside the 8x8 cell at (x, y). */
export function blocked(map: TileMap, x: number, y: number, blocksWater: boolean): boolean {
  for (const [px, py] of [[x + 1, y + 4], [x + 6.99, y + 4], [x + 1, y + 7.99], [x + 6.99, y + 7.99]] as const) {
    const t = tileAt(map, px, py);
    if (t === Tile.Tree || (blocksWater && t === Tile.Water)) return true;
  }
  return false;
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
    if (isOpenGround(map.tiles[y / T]![x / T]!) && Math.hypot(x - from.x, y - from.y) >= minDist) return { x, y };
  }
  return null;
}
