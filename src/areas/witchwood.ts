// Witchwood: the forest clearing you start in. A camp by the spawn, a lake, a pond and a river, and
// a dirt path from the camp north through the woods to a cave in the mountains, which leads up to
// the capital; and an old trail south into the deeper woods, barred by the King's woodwardens until
// you write them the King's watchword.
import { Rng } from "../core/rng.ts";
import { WOODWARDEN } from "../data/ashwild.ts";
import { HALF, T, Tile } from "../data/world.ts";
import type { AreaDef, AreaLayout, Prop } from "../world/area.ts";
import { isOpenGround, reachableFrom, type TileMap } from "../world/map.ts";
import type { Shape } from "../world/shapes.ts";
import { propSolids } from "../world/solids.ts";

const W = 80, H = 56, SEED = 7;
/** How far the original clearing's features sit in from the top-left, now that the woods around it are deeper. */
const OX = 8, OY = 6;

/** Where you start a run (cell top-left, game px). */
export const SPAWN = { x: (OX + 22) * T, y: (OY + 18) * T } as const;

/**
 * The camp around the spawn: a tent to the north-west, a campfire to the north-east with a log to sit
 * on. The tent and the fire are solid.
 */
export const CAMP = {
  tent: { x: (OX + 19) * T, y: (OY + 15) * T, w: 2 * T, h: 2 * T },
  fire: { x: (OX + 24) * T, y: (OY + 16) * T },
  seat: { x: (OX + 25) * T + 3, y: (OY + 17) * T + 2 },
} as const;

export const CAMP_SOLIDS: readonly Extract<Shape, { kind: "box" }>[] = [
  { kind: "box", x: CAMP.tent.x + 1, y: CAMP.tent.y + 2, w: CAMP.tent.w - 2, h: CAMP.tent.h - 3 },
  { kind: "box", x: CAMP.fire.x + 1, y: CAMP.fire.y + 1, w: T - 2, h: T - 2 },
];

/** The path's column under the cave mouth: it runs straight for the last few rows, up to the cave. */
const CAVE_TX = OX + 22;
/** The path from the camp to the cave: the tile column of its west edge, per row (it's 2 tiles wide). */
const pathX = (y: number) => (y <= 2 ? CAVE_TX : CAVE_TX + Math.round(1.6 * Math.sin((PATH_END - y) * 0.5)));
const PATH_END = OY + 14;                                        // the row where it meets the camp clearing
/** The cave mouth, at the top of the map where the path ends. */
const CAVE_X = (CAVE_TX + 1) * T;
/**
 * The old trail south, out of the camp clearing into the deeper woods (the Ashwild): the tile column of its
 * west edge, per row (two tiles wide), from where it leaves the clearing to the map's south edge; and the
 * row the King's woodwardens have barred it at.
 */
const TRAIL_TOP = OY + 18, trailX = (y: number) => OX + 27 + Math.round(2 * Math.sin((y - TRAIL_TOP) * 0.3)) + Math.floor((y - TRAIL_TOP) / 7);
const BAR_Y = H - 7;
/** The glade deep in the north-west woods (tiles), where the fair folk have left a ring. */
const GLADE = { x: 11, y: 8 } as const;

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
  const cx = W / 2, cy = H / 2 + 1.5, rx = W / 2 - 4, ry = H / 2 - 3;
  const wobble = (a: number) => 0.93 + 0.11 * Math.sin(3 * a + 0.7) + 0.07 * Math.sin(5 * a + 2.1) + 0.04 * Math.sin(11 * a + 4.2);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
    if (Math.hypot(dx, dy) > wobble(Math.atan2(dy, dx))) set(x, y, Tile.Tree);
  }

  // Groves: clumps where a smooth noise peaks, plus a few lone trees in the meadows.
  const grove = (gx: number, gy: number, x = gx - OX, y = gy - OY) =>
    Math.sin(x * 0.33 + 1.3) * Math.sin(y * 0.41 + 0.4) + 0.55 * Math.sin((x + y) * 0.19 + 2.0) + 0.35 * Math.sin(x * 0.71 - y * 0.53);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (at(x, y) === Tile.Tree) continue;
    if (grove(x, y) > 0.92 || rng.next() < 0.03) set(x, y, Tile.Tree);
  }

  // A glade deep in the north-west woods, thick with flowers, and a deer trail winding out to it from
  // the clearing. The trail steps one axis at a time so it never joins up only at a corner.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x + 0.5 - GLADE.x) / 4.4, dy = (y + 0.5 - GLADE.y) / 3.2, a = Math.atan2(dy, dx);
    if (Math.hypot(dx, dy) < 1 + 0.12 * Math.sin(5 * a + 1.1)) set(x, y, rng.next() < 0.3 ? Tile.Flower : Tile.Grass);
  }
  for (let x = GLADE.x + 2, y = GLADE.y + 1, i = 0; x !== 16 || y !== 13; i++) {
    set(x, y, Tile.Path);
    if (x !== 16 && (y === 13 || (i + Math.floor(i / 3)) % 2 === 0)) x += Math.sign(16 - x); else y += Math.sign(13 - y);
  }

  // Water: a lake, a pond, and a river winding north from the lake through the forest.
  const ellipse = (ex: number, ey: number, erx: number, ery: number) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      if (((x - ex) / erx) ** 2 + ((y - ey) / ery) ** 2 <= 1) set(x, y, Tile.Water);
  };
  ellipse(OX + 42, OY + 25, 8, 5.5);
  ellipse(OX + 17, OY + 31, 4.5, 3);
  for (let y = 0; y <= OY + 21; y++) {
    const riverX = OX + 41 + Math.round(2.5 * Math.sin((y - OY) / 3.2));
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
  // The old trail south into the deeper woods, and past the woodwardens' barricade, nothing but trail and trees.
  for (let y = TRAIL_TOP; y < H; y++) {
    if (y > BAR_Y) for (let x = 0; x < W; x++) set(x, y, Tile.Tree);
    for (let x = trailX(y); x <= trailX(y) + 1; x++) set(x, y, Tile.Path);
    if (trailX(y + 1) !== trailX(y) && y + 1 < H) set(trailX(y + 1), y, Tile.Path);   // no corner-only joins where it bends
  }

  // Fill any meadow the groves cut off, so nothing spawns where you can't reach it.
  const reached = reachableFrom({ width: W, height: H, tiles, solids: [] }, sx, sy);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    if (isOpenGround(at(x, y)) && !reached.has(y * W + x)) set(x, y, Tile.Tree);

  return { width: W, height: H, tiles, solids: CAMP_SOLIDS };
}

/** What stands in the Witchwood: the camp, the cave, and the woodwardens at their barricade on the trail south. */
const PROPS: Prop[] = [
  { kind: "camp", ...CAMP },
  { kind: "cave", x: CAVE_X, y: 0, facing: "south" },
  // A fairy ring in the flowered glade at the end of the deer trail.
  { kind: "fairyRing", x: GLADE.x * T, y: GLADE.y * T, radius: 1.6 },
  // The Ranger's stone, the oldest in the valley, where he wakes at the start of a run (src/game/stones.ts).
  { kind: "oldStone", x: SPAWN.x + HALF, y: SPAWN.y + HALF, name: "The Ranger's stone", entry: "start" },
  // The King's woodwardens' barricade across the trail, two wardens standing in its gate until he's written them the
  // watchword; then they step aside, one to each post (src/game/watchword.ts).
  { kind: "barricade", rect: { x: (trailX(BAR_Y) - 6) * T, y: BAR_Y * T, w: 14 * T, h: T }, gate: 6, gateW: 2 },
  { kind: "guard", x: (trailX(BAR_Y) + 0.5) * T, y: (BAR_Y - 0.5) * T, facing: "north", name: WOODWARDEN.name },
  { kind: "guard", x: (trailX(BAR_Y) + 1.5) * T, y: (BAR_Y - 0.5) * T, facing: "north", name: WOODWARDEN.name },
];

function build(): AreaLayout {
  const map = buildMap(), props = PROPS;
  // Everything standing in the way: the camp, and the barricade's stakes. The wardens move, so they stand in the way
  // wherever they are (src/game/watchword.ts).
  const fixed = props.filter(p => !(p.kind === "guard" && p.name === WOODWARDEN.name));
  return {
    map: { ...map, solids: [...map.solids, ...fixed.flatMap(propSolids)] },
    entries: {
      start: SPAWN,
      // Coming back down through the cave: a couple of steps south of its mouth.
      cave: { x: CAVE_X - HALF, y: 2 * T },
      // Back from under the hill (src/game/underhill.ts): beside the fairy ring, just out of it.
      ring: { x: GLADE.x * T - HALF, y: (GLADE.y + 2.6) * T - HALF },
      // Coming back up the trail out of the Ashwild, past the barricade.
      ashwild: { x: (trailX(H - 3) + 0.5) * T, y: (H - 3) * T },
    },
    exits: [
      { rect: { x: CAVE_X - T, y: 0, w: 2 * T, h: 6 }, to: { area: "kingsroad", entry: "cave" } },
      // On down the trail into the Ashwild: the woodwardens let nobody through who hasn't written them the King's watchword.
      { rect: { x: trailX(H - 1) * T, y: (H - 1) * T + 2, w: 2 * T, h: T - 2 }, to: { area: "ashwild", entry: "witchwood" }, needs: "watchword" },
    ],
    props,
  };
}

export const area: AreaDef = {
  id: "witchwood",
  name: "Witchwood",
  build,
  life: { enemies: true, potions: true, ambient: true },
};
