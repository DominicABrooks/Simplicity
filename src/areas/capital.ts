// Capital City: the Market Quarter, the heart of the seat of the kingdom of men.
//
// Through Southgate in the great south wall, the high street climbs to the market square: a flagstoned
// plaza round the great fountain, with the market cross and a well, four rows of stalls under
// bunting, the guildhall over its open market arcade, and the Crown and the Bell facing it. Castle Street
// runs north to the castle; East Street runs east past St Mary's and its churchyard to the Cathedral
// Close. A road runs round inside the walls, lanes cross the quarter, and every street is lined with
// tall, narrow town houses, gable end on, shops on the main streets, St Giles' chapel and the almshouse
// among them.
import { T, Tile } from "../data/world.ts";
import type { AreaDef, AreaLayout, Goods } from "../world/area.ts";
import { AWNINGS, Town, at, corner, edgeExit, hash, px, type TileRect } from "../world/townkit.ts";

const W = 96, H = 80;
/** Southgate's line (the high street and Castle Street run on it), the south wall's row and the west wall's column. */
const MID = 48.5, SOUTH_WALL = 74, WEST_WALL = 3;
const HIGH = { x0: 46, x1: 50 }, SQUARE = { x0: 30, y0: 30, x1: 66, y1: 51 }, EAST_ST = { y0: 39, y1: 42 };
const GUILDHALL: TileRect = [20, 31, 10, 14];
const inSquare = (x: number, y: number) => x >= SQUARE.x0 && x <= SQUARE.x1 && y >= SQUARE.y0 && y <= SQUARE.y1;
/** The main streets, where the shops are. */
const mainStreet = (x: number, y: number) => inSquare(x, y) || (x >= HIGH.x0 && x <= HIGH.x1) || (y >= EAST_ST.y0 && y <= EAST_ST.y1 && x > SQUARE.x1);
const SHOPS: readonly Goods[] = ["bread", "cloth", "meat", "pottery", "produce", "fish", "flowers"];

function build(): AreaLayout {
  const town = new Town(W, H, Tile.Grass);

  // Outside the walls, west and south: the bank, and the moat beyond Southgate.
  town.paint((x, y) => (x < WEST_WALL - 1 || y > SOUTH_WALL + 1) && hash(x, y, 1) < 0.1, Tile.Flower);
  town.paint((_x, y) => y >= SOUTH_WALL + 4, Tile.Water);

  // The streets: the high street up from Southgate, the square, Castle Street north, East Street east,
  // the road round inside the walls, the rim lanes at the quarter's edges, and lanes across it.
  const streets: TileRect[] = [
    [HIGH.x0, SQUARE.y1, 5, SOUTH_WALL + 3 - SQUARE.y1], [SQUARE.x0, SQUARE.y0, SQUARE.x1 - SQUARE.x0 + 1, SQUARE.y1 - SQUARE.y0 + 1],
    [HIGH.x0, 0, 5, SQUARE.y0], [SQUARE.x1, EAST_ST.y0, W - SQUARE.x1, 4],
    [6, 4, 2, 68], [6, 70, 85, 2], [6, 4, 85, 2], [89, 4, 2, 68],
    [6, 16, 85, 2], [6, 58, 85, 2], [18, 4, 2, 68], [77, 4, 2, 68], [6, 48, SQUARE.x0 - 6, 2],
  ];
  for (const r of streets) town.fill(r, Tile.Cobble);
  town.fill(GUILDHALL, Tile.Cobble);                            // paved under its arcade

  // The walls: west and south, with Southgate on the high street's line.
  town.add({
    kind: "curtainWall", closed: false, inside: corner(MID, 37), gates: [{ at: corner(MID, SOUTH_WALL), width: 3 * T }],
    points: [[WEST_WALL, -2], [WEST_WALL, 17], [WEST_WALL, 36], [WEST_WALL, 55], [WEST_WALL, SOUTH_WALL], [19, SOUTH_WALL], [34, SOUTH_WALL], [63, SOUTH_WALL], [78, SOUTH_WALL], [98, SOUTH_WALL]].map(([x, y]) => corner(x!, y!)),
    height: 6.5, thickness: 2.0, tower: { radius: 1.9, height: 10, roof: "#4a5a7a" },
  });
  town.fill([HIGH.x0 + 1, SOUTH_WALL - 3, 3, 8], Tile.Cobble);  // through Southgate
  town.fill([HIGH.x0 + 1, SOUTH_WALL + 4, 3, H], Tile.Path);
  town.add({ kind: "drawbridge", rect: px([HIGH.x0 + 1, SOUTH_WALL + 3, 3, H - SOUTH_WALL - 3]) });
  for (const x of [HIGH.x0 + 0.7, HIGH.x1 - 0.7 + 1]) town.add({ kind: "torch", x: x * T, y: (SOUTH_WALL - 1.6) * T, facing: "north", height: 2.6 });
  for (const x of [HIGH.x0 - 1, HIGH.x1 + 1]) town.add({ kind: "guard", ...at(x, SOUTH_WALL - 5), facing: "north" });

  // The market square: flagstones, the fountain in the middle, the market cross and a well either side,
  // four rows of stalls in pairs facing each other across their aisles, stock about, and bunting all round on masts.
  town.add({ kind: "plaza", rect: px([SQUARE.x0, SQUARE.y0, SQUARE.x1 - SQUARE.x0 + 1, SQUARE.y1 - SQUARE.y0 + 1]), centre: corner(MID, 41) });
  town.add({ kind: "fountain", ...corner(MID, 41), radius: 2.6 });
  town.add({ kind: "cross", ...at(38, 41) });
  town.add({ kind: "well", ...at(59, 41) });
  const stallXs = [31, 34, 37, 40, 55, 58, 61, 64];
  ([[SQUARE.y0 + 3, "south"], [SQUARE.y0 + 7, "north"], [SQUARE.y1 - 8, "south"], [SQUARE.y1 - 4, "north"]] as const).forEach(([y, facing], row) => stallXs.forEach((x, i) =>
    town.add({ kind: "stall", rect: px([x, y, 2, 1]), awning: AWNINGS[(i + row * 3) % AWNINGS.length]!, goods: SHOPS[(i * 3 + row) % SHOPS.length]!, facing })));
  for (const [x, y, what] of [[SQUARE.x0, 39, "barrels"], [SQUARE.x1, 39, "crates"], [SQUARE.x0, 42, "sacks"], [SQUARE.x1, 42, "hay"]] as const) town.add({ kind: "stock", ...at(x, y), what });
  const masts = [[SQUARE.x0, SQUARE.y0], [SQUARE.x1, SQUARE.y0], [SQUARE.x1, SQUARE.y1], [SQUARE.x0, SQUARE.y1]].map(([x, y]) => at(x!, y!));
  masts.forEach((a, i) => town.add({ kind: "bunting", from: a, to: masts[(i + 1) % 4]!, height: 3.4, masts: true }));

  // Round the square: the guildhall over its arcade, the Crown and the Bell either side of Castle Street.
  town.add({ kind: "hall", rect: px(GUILDHALL), door: "east", roof: "#4a5a7a", storeys: 2, stone: true, arcade: true, chimneys: 2 });
  town.add({ kind: "house", rect: px([HIGH.x0 - 6, SQUARE.y0 - 6, 6, 6]), doorSide: "south", roof: "#a8473a", storeys: 4, sign: "#c8423a", lantern: true, stone: true });
  town.add({ kind: "house", rect: px([HIGH.x1 + 1, SQUARE.y0 - 6, 6, 6]), doorSide: "south", roof: "#5d6a7d", storeys: 4, sign: "#3f6fd0", lantern: true, stone: true });

  // St Mary's on East Street, its churchyard between it and the street; St Giles' chapel and the
  // almshouse in the quarter's west.
  town.fill([68, 34, 17, 4], Tile.Grass);
  town.add({ kind: "church", rect: px([68, 26, 18, 8]), tower: "spire" });
  town.add({ kind: "graves", rect: px([69, 34, 15, 4]) });
  for (const x of [68, 85]) town.set(x, 36, Tile.Tree);
  town.add({ kind: "church", rect: px([8, 20, 9, 6]), tower: "bellcote" });
  town.add({ kind: "hall", rect: px([8, 61, 9, 6]), door: "north", roof: "#8a4a3a", storeys: 2, stone: false, chimneys: 1 });
  town.add({ kind: "well", ...at(19, 59) });

  // Houses along every street: tall, narrow, gable end on, shops wherever there's custom.
  town.houses({
    street: (x, y) => town.at(x, y) === Tile.Cobble,
    allowed: (x, y) => x > WEST_WALL + 2 && y < SOUTH_WALL - 3 && !inSquare(x, y),
    shop: (x, y, k) => (mainStreet(x, y) && k < 0.75 ? SHOPS[Math.floor(k * 97) % SHOPS.length]! : null),
    frontage: [3, 4], depth: [5, 7], storeys: [3, 4], alley: 0.25, seed: 201,
  });
  town.yards(0.07, (x, y) => x > WEST_WALL + 2 && y < SOUTH_WALL - 3);

  return town.layout(
    // In through Southgate, at the foot of the high street; down from the castle; along from the close.
    { southgate: { x: 48 * T, y: (SOUTH_WALL - 7) * T }, castle: { x: 48 * T, y: 3 * T }, close: { x: (W - 4) * T, y: (EAST_ST.y0 + 1) * T } },
    [
      { rect: { x: (HIGH.x0 + 1) * T, y: (SOUTH_WALL + 2) * T, w: 3 * T, h: 2 * T }, to: { area: "kingsroad", entry: "gate" } },
      edgeExit("north", HIGH.x0, HIGH.x1, W, H, { area: "castle", entry: "town" }),
      edgeExit("east", EAST_ST.y0, EAST_ST.y1, W, H, { area: "cathedral", entry: "town" }),
    ],
  );
}

export const area: AreaDef = {
  id: "capital",
  name: "Capital City: the Market Quarter",
  build,
  life: { enemies: false, potions: false, ambient: true },
};
