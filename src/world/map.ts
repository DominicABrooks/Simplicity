import { Rng } from "../core/rng.ts";
import { CAMP_SOLIDS, MAP_H, MAP_SEED, MAP_W, SPAWN, T, Tile, type Rect } from "../data/world.ts";

/** The tile grid, indexed [y][x]. */
export interface TileMap {
  width: number;
  height: number;
  tiles: Tile[][];
  /** Things that block movement off the tile grid (the camp's tent and fire), in game pixels. */
  solids: readonly Rect[];
}

export const tileOf = (map: TileMap, tx: number, ty: number): Tile =>
  tx < 0 || ty < 0 || tx >= map.width || ty >= map.height ? Tile.Tree : map.tiles[ty]![tx]!;

export const isOpenGround = (t: Tile): boolean => t === Tile.Grass || t === Tile.Flower;

/**
 * The world is one big forest clearing with an organic outline: a wobbly ellipse whose radius swells
 * and pinches with angle, so the edge has bays and points instead of straight sides. Inside, groves
 * grow where a smooth noise is high, leaving meadows between them. Deterministic for a given seed.
 */
export function makeMap(seed = MAP_SEED): TileMap {
  const rng = new Rng(seed);
  const W = MAP_W, H = MAP_H;
  const tiles: Tile[][] = [];
  for (let y = 0; y < H; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < W; x++) row.push(rng.next() < 0.06 ? Tile.Flower : Tile.Grass);
    tiles.push(row);
  }
  const at = (x: number, y: number) => tiles[y]![x]!;
  const set = (x: number, y: number, t: Tile) => { if (x >= 0 && y >= 0 && x < W && y < H) tiles[y]![x] = t; };

  // Organic clearing: everything outside the wobbly ellipse is forest.
  const cx = W / 2, cy = H / 2 + 1.5, rx = W / 2 - 2, ry = H / 2 - 1;
  const wobble = (a: number) => 0.93 + 0.11 * Math.sin(3 * a + 0.7) + 0.07 * Math.sin(5 * a + 2.1) + 0.04 * Math.sin(11 * a + 4.2);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
    if (Math.hypot(dx, dy) > wobble(Math.atan2(dy, dx))) set(x, y, Tile.Tree);
  }

  // Groves: clumps where a smooth noise peaks, plus a few lone trees in the meadows.
  const grove = (x: number, y: number) =>
    Math.sin(x * 0.33 + 1.3) * Math.sin(y * 0.41 + 0.4) + 0.55 * Math.sin((x + y) * 0.19 + 2.0) + 0.35 * Math.sin(x * 0.71 - y * 0.53);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (at(x, y) === Tile.Tree) continue;
    if (grove(x, y) > 0.92 || rng.next() < 0.03) set(x, y, Tile.Tree);
  }

  // Water: a lake, a pond, and a river winding north from the lake through the forest.
  const ellipse = (ex: number, ey: number, erx: number, ery: number) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      if (((x - ex) / erx) ** 2 + ((y - ey) / ery) ** 2 <= 1) set(x, y, Tile.Water);
  };
  ellipse(42, 25, 8, 5.5);
  ellipse(17, 31, 4.5, 3);
  for (let y = 0; y <= 21; y++) {
    const riverX = 41 + Math.round(2.5 * Math.sin(y / 3.2));
    set(riverX, y, Tile.Water); set(riverX + 1, y, Tile.Water);
  }

  // Keep the start clear, and seal the map edge (the river mouth included).
  const sx = SPAWN.x / T, sy = SPAWN.y / T;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    if (Math.hypot(x - sx, y - sy) < 5 && at(x, y) === Tile.Tree) set(x, y, Tile.Grass);
  for (let x = 0; x < W; x++) { set(x, 0, Tile.Tree); set(x, H - 1, Tile.Tree); }
  for (let y = 0; y < H; y++) { set(0, y, Tile.Tree); set(W - 1, y, Tile.Tree); }

  // Fill any meadow the groves cut off, so nothing spawns where you can't reach it.
  const reached = reachableFrom({ width: W, height: H, tiles, solids: [] }, sx, sy);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    if (isOpenGround(at(x, y)) && !reached.has(y * W + x)) set(x, y, Tile.Tree);

  return { width: W, height: H, tiles, solids: CAMP_SOLIDS };
}

/** Every non-tree tile reachable from (tx, ty) by stepping up, down, left or right. Keys are y * width + x. */
export function reachableFrom(map: TileMap, tx: number, ty: number): Set<number> {
  const seen = new Set([ty * map.width + tx]);
  const queue: [number, number][] = [[tx, ty]];
  while (queue.length) {
    const [x, y] = queue.pop()!;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as [number, number][]) {
      const k = ny * map.width + nx;
      if (seen.has(k) || nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || map.tiles[ny]![nx] === Tile.Tree) continue;
      seen.add(k);
      queue.push([nx, ny]);
    }
  }
  return seen;
}
