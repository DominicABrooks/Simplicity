// Capital City: a walled town up the cave from Witchwood. You come out of the cave in a meadow south of
// the walls; a dirt road leads to the gatehouse, and the main street runs north past houses and market
// stalls to a fountain in the plaza, and on to the keep. A safe place: nothing hostile lives here.
//
// Laid out by hand on a tile grid, mirrored about the main street. Everything built is a prop (drawn by
// src/render/props.ts) over Wall tiles (which block movement), so collision stays a tile lookup.
import { HALF, T, Tile, type Rect } from "../data/world.ts";
import type { AreaDef, AreaLayout, Prop } from "../world/area.ts";
import type { TileMap } from "../world/map.ts";

const W = 48, H = 40;
/** The city wall's tile bounds (inclusive) and the gate in its south side. */
const WALL = { x0: 7, y0: 3, x1: 40, y1: 29 };
const GATE = { x: 23, w: 2 };
/** The main street's two columns, the cave and the road all line up on the city's centre line. */
const MID = 24;

/** Tile rects: [x, y, w, h]. */
type TileRect = readonly [number, number, number, number];
const px = ([x, y, w, h]: TileRect): Rect => ({ x: x * T, y: y * T, w: w * T, h: h * T });
/** Mirror a west-side rect onto the east side of the main street. */
const mirror = ([x, y, w, h]: TileRect): TileRect => [2 * MID - x - w, y, w, h];

const ROOFS = { clay: "#a8473a", slate: "#4a5a7a", moss: "#5a6b3a", straw: "#b08a4a" } as const;
type Roof = keyof typeof ROOFS;

/** West-side houses, mirrored east with the roof swapped for variety. */
const HOUSES: [TileRect, Roof, Roof][] = [
  [[9, 5, 3, 2], "clay", "slate"],
  [[13, 5, 4, 2], "straw", "clay"],
  [[9, 9, 4, 2], "slate", "moss"],
  [[14, 9, 3, 2], "moss", "straw"],
  [[9, 13, 3, 2], "moss", "clay"],
  [[13, 13, 3, 2], "clay", "straw"],
  [[9, 17, 4, 2], "straw", "slate"],
  [[14, 17, 3, 2], "slate", "moss"],
  [[9, 24, 3, 2], "clay", "moss"],
  [[13, 24, 3, 2], "moss", "clay"],
  [[17, 24, 4, 2], "slate", "straw"],
];
const KEEP: TileRect = [19, 5, 10, 5];
const FOUNTAIN: TileRect = [23, 16, 2, 2];
/** Market stalls around the plaza, with their awnings' colours. */
const STALLS: [TileRect, string][] = [
  [[19, 13, 2, 1], "#c8423a"], [[27, 13, 2, 1], "#3f6fd0"],
  [[19, 18, 2, 1], "#5fb04a"], [[27, 18, 2, 1], "#e8963a"],
];
/** Trees at the plaza's corners. */
const PLAZA_TREES: [number, number][] = [[18, 12], [29, 12], [18, 19], [29, 19]];
/** Lamp posts (tile centres): along the main street, around the plaza, and outside the gate. */
const LAMPS: [number, number][] = [[22, 27], [25, 27], [22, 23], [25, 23], [21, 15], [26, 15], [21, 20], [26, 20], [21, 31], [26, 31]];

const hash = (x: number, y: number, k: number) => { const s = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453; return s - Math.floor(s); };

function buildMap(): TileMap {
  const tiles: Tile[][] = Array.from({ length: H }, () => Array.from({ length: W }, () => Tile.Grass as Tile));
  const set = (x: number, y: number, t: Tile) => { if (x >= 0 && y >= 0 && x < W && y < H) tiles[y]![x] = t; };
  const fill = ([x, y, w, h]: TileRect, t: Tile) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, t); };
  const inCity = (x: number, y: number) => x >= WALL.x0 && x <= WALL.x1 && y >= WALL.y0 && y <= WALL.y1;

  // Outside the walls: a meadow with flowers, thickening into forest toward the map's edges.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (inCity(x, y)) continue;
    const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
    const nearRoad = Math.abs(x + 0.5 - MID) < 4 && y > WALL.y1;
    const nearWall = x >= WALL.x0 - 2 && x <= WALL.x1 + 2 && y >= WALL.y0 - 2 && y <= WALL.y1 + 2;
    if (edge === 0 || (edge < 3 && hash(x, y, 1) < 0.7 - edge * 0.15)) set(x, y, Tile.Tree);
    else if (!nearRoad && !nearWall && hash(x, y, 2) < 0.12) set(x, y, Tile.Tree);
    else if (hash(x, y, 3) < 0.07) set(x, y, Tile.Flower);
  }

  // Inside: paved throughout; the city wall around it, with the gate open.
  fill([WALL.x0, WALL.y0, WALL.x1 - WALL.x0 + 1, WALL.y1 - WALL.y0 + 1], Tile.Cobble);
  for (let x = WALL.x0; x <= WALL.x1; x++) { set(x, WALL.y0, Tile.Wall); set(x, WALL.y1, Tile.Wall); }
  for (let y = WALL.y0; y <= WALL.y1; y++) { set(WALL.x0, y, Tile.Wall); set(WALL.x1, y, Tile.Wall); }
  fill([GATE.x, WALL.y1, GATE.w, 1], Tile.Cobble);
  // The gatehouse towers stand out from the wall on either side of the gate.
  fill([GATE.x - 2, WALL.y1, 2, 2], Tile.Wall);
  fill([GATE.x + GATE.w, WALL.y1, 2, 2], Tile.Wall);

  // Buildings.
  for (const [r] of HOUSES) { fill(r, Tile.Wall); fill(mirror(r), Tile.Wall); }
  fill(KEEP, Tile.Wall);
  fill(FOUNTAIN, Tile.Wall);
  for (const [r] of STALLS) fill(r, Tile.Wall);
  for (const [x, y] of PLAZA_TREES) set(x, y, Tile.Tree);

  // The road from the cave up to the gate.
  for (let y = WALL.y1 + 1; y < H; y++) { set(MID - 1, y, Tile.Path); set(MID, y, Tile.Path); }
  return { width: W, height: H, tiles, solids: [] };
}

function props(): Prop[] {
  const out: Prop[] = [
    { kind: "cityWall", rect: px([WALL.x0, WALL.y0, WALL.x1 - WALL.x0 + 1, WALL.y1 - WALL.y0 + 1]), gate: { x: GATE.x * T, w: GATE.w * T } },
    { kind: "keep", rect: px(KEEP) },
    { kind: "fountain", x: (FOUNTAIN[0] + FOUNTAIN[2] / 2) * T, y: (FOUNTAIN[1] + FOUNTAIN[3] / 2) * T },
    { kind: "cave", x: MID * T, y: H * T, facing: "north" },
  ];
  for (const [r, west, east] of HOUSES) {
    out.push({ kind: "house", rect: px(r), roof: ROOFS[west] }, { kind: "house", rect: px(mirror(r)), roof: ROOFS[east] });
  }
  for (const [r, awning] of STALLS) out.push({ kind: "stall", rect: px(r), awning });
  for (const [x, y] of LAMPS) out.push({ kind: "lamp", x: x * T + HALF, y: y * T + HALF });
  return out;
}

function build(): AreaLayout {
  return {
    map: buildMap(),
    // Coming up out of the cave: a few steps north of its mouth, on the road to the gate.
    entries: { cave: { x: MID * T - HALF, y: (H - 4) * T } },
    exits: [{ rect: { x: MID * T - T, y: (H - 1) * T + 2, w: 2 * T, h: T - 2 }, to: { area: "witchwood", entry: "cave" } }],
    props: props(),
  };
}

export const area: AreaDef = {
  id: "capital",
  name: "Capital City",
  build,
  life: { enemies: false, potions: false, ambient: true },
};
