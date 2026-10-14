// Greenhollow: the forest clearing you start in. A camp by the spawn, a lake, a pond and a river, and
// a dirt path from the camp north through the woods to a cave in the mountains.
import { Rng } from "../core/rng.ts";
import { HALF, T, Tile, type Rect } from "../data/world.ts";
import type { AreaDef, AreaLayout } from "../world/area.ts";
import { isOpenGround, reachableFrom, type TileMap } from "../world/map.ts";

const W = 64, H = 44, SEED = 7;

/** Where you start a run (cell top-left, game px). */
export const SPAWN = { x: 22 * T, y: 18 * T } as const;

/**
 * The camp around the spawn: a tent to the north-west, a campfire to the north-east with a log to sit
 * on. The tent and the fire are solid.
 */
export const CAMP = {
  tent: { x: 19 * T, y: 15 * T, w: 2 * T, h: 2 * T },
  fire: { x: 24 * T, y: 16 * T },
  seat: { x: 25 * T + 3, y: 17 * T + 2 },
} as const;

export const CAMP_SOLIDS: readonly Rect[] = [
  { x: CAMP.tent.x + 1, y: CAMP.tent.y + 2, w: CAMP.tent.w - 2, h: CAMP.tent.h - 3 },
  { x: CAMP.fire.x + 1, y: CAMP.fire.y + 1, w: T - 2, h: T - 2 },
];

/** The path's column under the cave mouth: it runs straight for the last few rows, up to the cave. */
const CAVE_TX = 22;
/** The path from the camp to the cave: the tile column of its west edge, per row (it's 2 tiles wide). */
const pathX = (y: number) => (y <= 2 ? CAVE_TX : 22 + Math.round(1.6 * Math.sin((14 - y) * 0.5)));
const PATH_END = 14;                                         // the row where it meets the camp clearing
/** The cave mouth, at the top of the map where the path ends. */
const CAVE_X = (CAVE_TX + 1) * T;

/**
 * One big forest clearing with an organic outline: a wobbly ellipse whose radius swells and pinches
 * with angle, so the edge has bays and points instead of straight sides. Inside, groves grow where a
 * smooth noise is high, leaving meadows between them. Deterministic.
 */
export function buildMap(): TileMap {
  const rng = new Rng(SEED);
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

  // The path: two tiles wide, winding north from the camp up to the cave at the map's top edge.
  for (let y = 0; y <= PATH_END; y++) { set(pathX(y), y, Tile.Path); set(pathX(y) + 1, y, Tile.Path); }

  // Fill any meadow the groves cut off, so nothing spawns where you can't reach it.
  const reached = reachableFrom({ width: W, height: H, tiles, solids: [] }, sx, sy);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    if (isOpenGround(at(x, y)) && !reached.has(y * W + x)) set(x, y, Tile.Tree);

  return { width: W, height: H, tiles, solids: CAMP_SOLIDS };
}

function build(): AreaLayout {
  return {
    map: buildMap(),
    entries: {
      start: SPAWN,
      // Coming back down through the cave: a couple of steps south of its mouth.
      cave: { x: CAVE_X - HALF, y: 2 * T },
    },
    exits: [{ rect: { x: CAVE_X - T, y: 0, w: 2 * T, h: 6 }, to: { area: "uncharted", entry: "cave" } }],
    props: [
      { kind: "camp", ...CAMP },
      { kind: "cave", x: CAVE_X, y: 0, facing: "south" },
    ],
  };
}

export const area: AreaDef = {
  id: "greenhollow",
  name: "Greenhollow",
  build,
  life: { enemies: true, potions: true, ambient: true },
};
