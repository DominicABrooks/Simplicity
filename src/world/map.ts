import { T, Tile, isSolidTile } from "../data/world.ts";
import { anyContains, type Shape } from "./shapes.ts";

/** The tile grid, indexed [y][x]. */
export interface TileMap {
  width: number;
  height: number;
  tiles: Tile[][];
  /** Things that block movement off the tile grid (buildings, posts, a tent, a fire pit), in game pixels. */
  solids: readonly Shape[];
  /** How its woods look: green, or (deep in the Witchwood, where the dark gets in) ash-grey, or (the Frozen Hollow) under snow, or
   *  (the Thunder Rift) dark and slate-blue under the storm. */
  look?: "green" | "ash" | "snow" | "storm";
}

export const tileOf = (map: TileMap, tx: number, ty: number): Tile =>
  tx < 0 || ty < 0 || tx >= map.width || ty >= map.height ? Tile.Tree : map.tiles[ty]![tx]!;

/** Ground you can walk on and things can spawn on (not trees or water, but ice). */
export const isOpenGround = (t: Tile): boolean => t === Tile.Grass || t === Tile.Flower || t === Tile.Path || t === Tile.Cobble || t === Tile.Ice;

/** Every non-solid tile reachable from (tx, ty) by stepping up, down, left or right. Keys are y * width + x. */
export function reachableFrom(map: TileMap, tx: number, ty: number): Set<number> {
  return flood(map, tx, ty, (x, y) => isSolidTile(map.tiles[y]![x]!));
}

/**
 * Like reachableFrom, but what stands on the map stops the walk too: a tile whose middle is inside one of its solids
 * (a barricade's stakes, the woodwardens in its gate, Yssa in the track) is as good as a wall. Where enemies may turn up.
 */
export function walkableFrom(map: TileMap, tx: number, ty: number): Set<number> {
  return flood(map, tx, ty, (x, y) => isSolidTile(map.tiles[y]![x]!) || anyContains(map.solids, (x + 0.5) * T, (y + 0.5) * T));
}

function flood(map: TileMap, tx: number, ty: number, stops: (x: number, y: number) => boolean): Set<number> {
  const seen = new Set([ty * map.width + tx]);
  const queue: [number, number][] = [[tx, ty]];
  while (queue.length) {
    const [x, y] = queue.pop()!;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as [number, number][]) {
      const k = ny * map.width + nx;
      if (seen.has(k) || nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || stops(nx, ny)) continue;
      seen.add(k);
      queue.push([nx, ny]);
    }
  }
  return seen;
}
