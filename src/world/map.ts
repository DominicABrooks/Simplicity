import { Tile, isSolidTile } from "../data/world.ts";
import type { Shape } from "./shapes.ts";

/** The tile grid, indexed [y][x]. */
export interface TileMap {
  width: number;
  height: number;
  tiles: Tile[][];
  /** Things that block movement off the tile grid (buildings, posts, a tent, a fire pit), in game pixels. */
  solids: readonly Shape[];
}

export const tileOf = (map: TileMap, tx: number, ty: number): Tile =>
  tx < 0 || ty < 0 || tx >= map.width || ty >= map.height ? Tile.Tree : map.tiles[ty]![tx]!;

/** Ground you can walk on and things can spawn on (not trees or water). */
export const isOpenGround = (t: Tile): boolean => t === Tile.Grass || t === Tile.Flower || t === Tile.Path || t === Tile.Cobble;

/** Every non-solid tile reachable from (tx, ty) by stepping up, down, left or right. Keys are y * width + x. */
export function reachableFrom(map: TileMap, tx: number, ty: number): Set<number> {
  const seen = new Set([ty * map.width + tx]);
  const queue: [number, number][] = [[tx, ty]];
  while (queue.length) {
    const [x, y] = queue.pop()!;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as [number, number][]) {
      const k = ny * map.width + nx;
      if (seen.has(k) || nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || isSolidTile(map.tiles[ny]![nx]!)) continue;
      seen.add(k);
      queue.push([nx, ny]);
    }
  }
  return seen;
}
