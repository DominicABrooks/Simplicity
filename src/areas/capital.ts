// Capital City: the Market Quarter, the heart of the seat of the kingdom of men.
//
// Through Southgate in the great south wall, the high street climbs to the market square: a flagstoned
// plaza round the great fountain, with the market cross and a well, four rows of stalls under
// bunting, the guildhall over its open market arcade, and the Crown and the Bell facing it. Castle Street
// runs north to the castle; East Street runs east past St Mary's and its churchyard. A road runs round inside the walls, lanes cross the quarter, and every street is lined with
// tall, narrow town houses, gable end on, shops on the main streets, St Giles' chapel and the almshouse
// among them. Street lamps stand along the main streets and round the square, lit at dusk by the lamplighter.
import { HALF, T, Tile } from "../data/world.ts";
import type { AreaDef, AreaLayout, Goods } from "../world/area.ts";
import { houseDoor } from "../world/plans.ts";
import { AWNINGS, Town, at, corner, edgeExit, hash, px, type TileRect } from "../world/townkit.ts";
import { CASTLE, castleCore } from "./castle.ts";

const W = 96, H = 80;
/** Southgate's line (the high street and Castle Street run on it), the south wall's row and the west wall's column. */
const MID = 48.5, SOUTH_WALL = 74, WEST_WALL = 3;
/**
 * The fountain stone's row (tile corners): south of the fountain toward the high street, out past where the minstrel
 * plays at its foot and the townsfolk walk their circles round it (src/game/townsfolk.ts), so it isn't hidden under them.
 */
const FOUNTAIN_STONE_Y = 46.6;
/** Southgate: its line, the south wall's row, and the south wall's towers (columns). The King's Bridge, outside
 * it, lines its own wall up with these and shows this quarter's south end through the gate. */
export const SOUTHGATE = { x: MID, y: SOUTH_WALL, towers: [19, 34, 63, 78] } as const;
/** The high street, which runs on north as Castle Street. */
export const CASTLE_STREET = { x0: 46, x1: 50 } as const;
const HIGH = CASTLE_STREET, SQUARE = { x0: 30, y0: 30, x1: 66, y1: 51 }, EAST_ST = { y0: 39, y1: 42 };
const GUILDHALL: TileRect = [20, 31, 10, 14];
/** The low door down to the Undercroft, in the south face of St Mary's tower, in the nook by the nave (tiles: the middle of its foot). */
export const UNDERCROFT_DOOR = { x: 69.9, y: 32.1 } as const;
const inSquare = (x: number, y: number) => x >= SQUARE.x0 && x <= SQUARE.x1 && y >= SQUARE.y0 && y <= SQUARE.y1;
/** The main streets, where the shops are. */
const mainStreet = (x: number, y: number) => inSquare(x, y) || (x >= HIGH.x0 && x <= HIGH.x1) || (y >= EAST_ST.y0 && y <= EAST_ST.y1 && x > SQUARE.x1);
const SHOPS: readonly Goods[] = ["bread", "cloth", "meat", "pottery", "produce", "fish", "flowers"];
/**
 * Where the street lamps go (tiles), in the order the lamplighter might take them: up Castle Street, round the
 * square's edge (clear of the stalls), down the high street and out along East Street. Each stands at the
 * street's edge, moved along a step or two if it would be in front of a door or in the way of something.
 */
const LAMPS: readonly (readonly [number, number])[] = [
  [50, 8], [46, 13], [50, 20], [46, 26],
  [36, 30], [42, 30], [54, 30], [60, 30], [66, 35], [66, 45], [60, 51], [54, 51], [42, 51], [36, 51], [30, 45], [30, 35],
  [46, 56], [50, 61], [46, 66],
  [72, 39], [79, 42], [86, 39],
];

function build(): AreaLayout {
  const town = new Town(W, H, Tile.Grass);

  // Outside the walls: the bank to the west, and the great river beyond Southgate.
  town.paint((x, y) => x < WEST_WALL - 1 && hash(x, y, 1) < 0.1, Tile.Flower);
  town.paint((_x, y) => y >= SOUTH_WALL + 2, Tile.Water);

  // The streets: the high street up from Southgate, the square, Castle Street north, East Street east,
  // the road round inside the walls, the rim lanes at the quarter's edges, and lanes across it.
  const streets: TileRect[] = [
    [HIGH.x0, SQUARE.y1, 5, SOUTH_WALL + 3 - SQUARE.y1], [SQUARE.x0, SQUARE.y0, SQUARE.x1 - SQUARE.x0 + 1, SQUARE.y1 - SQUARE.y0 + 1],
    [HIGH.x0, 0, 5, SQUARE.y0], [SQUARE.x1, EAST_ST.y0, 91 - SQUARE.x1, 4],
    [6, 4, 2, 68], [6, 70, 85, 2], [6, 4, 85, 2], [89, 4, 2, 68],
    [6, 16, 85, 2], [6, 58, 85, 2], [18, 4, 2, 68], [77, 4, 2, 68], [6, 48, SQUARE.x0 - 6, 2],
  ];
  for (const r of streets) town.fill(r, Tile.Cobble);
  town.fill(GUILDHALL, Tile.Cobble);                            // paved under its arcade

  // The walls: west and south, with Southgate on the high street's line.
  town.add({
    kind: "curtainWall", closed: false, inside: corner(MID, 37), gates: [{ at: corner(MID, SOUTH_WALL), width: 3 * T }],
    points: [[WEST_WALL, -2], [WEST_WALL, 17], [WEST_WALL, 36], [WEST_WALL, 55], [WEST_WALL, SOUTH_WALL], ...SOUTHGATE.towers.map(x => [x, SOUTH_WALL]), [98, SOUTH_WALL]].map(([x, y]) => corner(x!, y!)),
    height: 6.5, thickness: 2.0, tower: { radius: 1.9, height: 10, roof: "#4a5a7a" },
  });
  town.fill([HIGH.x0 + 1, SOUTH_WALL - 3, 3, 4], Tile.Cobble);  // through Southgate
  // Beyond it, the King's Bridge setting out over the river (see kingsroad.ts), standards on its parapets.
  const bridge: TileRect = [HIGH.x0 - 2, SOUTH_WALL + 1, 9, H - SOUTH_WALL - 1];
  town.fill(bridge, Tile.Cobble);
  town.add({ kind: "stoneBridge", rect: px(bridge), rich: true });
  for (const x of [HIGH.x0 - 1, HIGH.x1 + 1]) town.add({ kind: "standard", ...at(x, SOUTH_WALL + 4) });
  for (const x of [HIGH.x0 + 0.7, HIGH.x1 - 0.7 + 1]) town.add({ kind: "torch", x: x * T, y: (SOUTH_WALL - 1.6) * T, facing: "north", height: 2.6 });
  for (const x of [HIGH.x0 - 1, HIGH.x1 + 1]) town.add({ kind: "guard", ...at(x, SOUTH_WALL - 5), facing: "north" });

  // The market square: flagstones, the fountain in the middle, the market cross and a well either side,
  // four rows of stalls in pairs facing each other across their aisles, stock about, and bunting all round on masts.
  town.add({ kind: "plaza", rect: px([SQUARE.x0, SQUARE.y0, SQUARE.x1 - SQUARE.x0 + 1, SQUARE.y1 - SQUARE.y0 + 1]), centre: corner(MID, 41) });
  town.add({ kind: "fountain", ...corner(MID, 41), radius: 2.6 });
  // The fountain stone, below the fountain on the high street side: one of Ael's old stones (src/game/stones.ts).
  town.add({ kind: "oldStone", ...corner(MID, FOUNTAIN_STONE_Y), name: "The fountain stone", entry: "stone" });
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
  // The low door at the foot of the tower, down to the Undercroft: locked since the Edict, and the key's in the river.
  town.add({ kind: "cryptDoor", x: UNDERCROFT_DOOR.x * T, y: UNDERCROFT_DOOR.y * T, facing: "south" });
  town.add({ kind: "church", rect: px([8, 20, 9, 6]), tower: "bellcote" });
  town.add({ kind: "hall", rect: px([8, 61, 9, 6]), door: "north", roof: "#8a4a3a", storeys: 2, stone: false, chimneys: 1 });
  town.add({ kind: "well", ...at(19, 59) });

  // Houses along every street: tall, narrow, gable end on, shops wherever there's custom.
  town.houses({
    street: (x, y) => town.at(x, y) === Tile.Cobble,
    allowed: (x, y) => x > WEST_WALL + 2 && y < SOUTH_WALL - 3 && !inSquare(x, y),
    shop: (x, y, k) => (mainStreet(x, y) && k < 0.75 ? SHOPS[Math.floor(k * 97) % SHOPS.length]! : null),
    frontage: [3, 4], depth: [5, 7], storeys: [3, 4], alley: 0.25, seed: 201, stone: 0.65,
  });
  town.yards(0.07, (x, y) => x > WEST_WALL + 2 && y < SOUTH_WALL - 3);
  // Along the north edge, behind the rim lane, a line of trees between this quarter's back gardens and the
  // castle's (it plants the same along its south edge): the way north is Castle Street.
  town.paint((x, y) => town.at(x, y) === Tile.Grass && x > WEST_WALL && (y === 0 || (y === 1 && hash(x, y, 7) < 0.4)), Tile.Tree);
  streetLamps(town);

  // Past the north edge, the castle as it stands there: the houses and the moat, the barbican, its walls and towers.
  town.beyond(castleCore(), [0, CASTLE.H - 22, CASTLE.W, 22], HIGH.x0 - CASTLE.street.x0, -22);

  return town.layout(
    // In through Southgate, at the foot of the high street; down from the castle, a step in from the edge.
    {
      southgate: { x: 48 * T, y: (SOUTH_WALL - 4) * T }, castle: { x: 48 * T, y: 1 * T },
      undercroft: { x: (UNDERCROFT_DOOR.x - 0.5) * T, y: (UNDERCROFT_DOOR.y + 1.3) * T },
      // Waking by the fountain stone: just south of it, so he isn't standing on it.
      stone: { x: MID * T - HALF, y: (FOUNTAIN_STONE_Y + 1.3) * T - HALF },
    },
    [
      { rect: { x: (HIGH.x0 + 1) * T, y: (SOUTH_WALL + 2) * T, w: 3 * T, h: 2 * T }, to: { area: "kingsroad", entry: "gate" } },
      edgeExit("north", HIGH.x0, HIGH.x1, W, H, { area: "castle", entry: "town" }),
      { rect: { x: (UNDERCROFT_DOOR.x - 0.5) * T, y: UNDERCROFT_DOOR.y * T, w: T, h: T }, to: { area: "undercroft", entry: "steps" }, locked: "key" },
    ],
  );
}

/** The street lamps (LAMPS), each on a paved tile clear of doorways, buildings, stalls and the other things on the streets. */
function streetLamps(town: Town): void {
  const doors = town.props.flatMap(p => (p.kind === "house" ? [houseDoor(p).at] : p.kind === "hall" ? [{ x: GUILDHALL[0] + GUILDHALL[2] + 0.5, z: GUILDHALL[1] + GUILDHALL[3] / 2 }] : []));
  const clear = (x: number, y: number) => {
    const cx = x + 0.5, cy = y + 0.5, px = cx * T, py = cy * T;
    if (town.at(x, y) !== Tile.Cobble || doors.some(d => Math.hypot(d.x - cx, d.z - cy) < 2)) return false;
    return town.props.every(p => {
      if ("rect" in p) {                                   // not in anything, nor in front of a stall
        const mx = p.kind === "stall" ? 0.3 * T : 0, my = p.kind === "stall" ? 1.2 * T : 0, r = p.rect;
        return p.kind === "plaza" || px < r.x - mx || py < r.y - my || px > r.x + r.w + mx || py > r.y + r.h + my;
      }
      return !("x" in p) || Math.hypot(p.x - px, p.y - py) > 1.5 * T;
    });
  };
  const near = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]] as const;
  for (const [x, y] of LAMPS) {
    const step = near.find(([i, j]) => clear(x + i, y + j));
    if (step) town.add({ kind: "lamp", ...at(x + step[0], y + step[1]) });
  }
}

export const area: AreaDef = {
  id: "capital",
  name: "Capital City: the Market Quarter",
  build,
  life: { enemies: false, potions: false, ambient: true },
};
