// Capital City: the Castle, the royal seat, built into the city wall at the city's northern edge.
//
// Castle Street comes up from the Market Quarter to the barbican, over the drawbridge and the moat, and
// through the gatehouse into the ward: the keep on its crag between burning braziers, the great hall and
// its kitchen, the chapel and the lodgings, the barracks by the gate, the storehouse, the smithy, a well and
// a corner for training, all inside one ring of tall walls with a tower at every corner.
import { HALF, T, Tile } from "../data/world.ts";
import type { AreaDef, AreaLayout } from "../world/area.ts";
import { keepPlan } from "../world/plans.ts";
import { Town, at, corner, edgeExit, px, type TileRect } from "../world/townkit.ts";
import { area as capital, CASTLE_STREET } from "./capital.ts";

const W = 56, H = 48;
/** The castle's line (its gate, Castle Street), the city wall's row, and the curtain round the ward. */
const MID = 28.5, CITY_WALL = 3, CURTAIN = { x0: 8, x1: 49, y1: 34 };
const MOAT = { y0: 37, y1: 39 }, BARBICAN: TileRect = [23, 41, 11, 5], STREET = { x0: 26, x1: 30 };
const KEEP: TileRect = [20, 6, 17, 13];
/** Its size, and Castle Street, which runs on south into the Market Quarter's high street. */
export const CASTLE = { W, H, street: STREET } as const;

/** The castle and the streets round it, as you walk them. */
function lay(): Town {
  const town = new Town(W, H);

  // The ground: the ward's paving, the moat before the curtain, the street up to the barbican and the
  // lanes of the city either side.
  town.fill([CURTAIN.x0 + 1, CITY_WALL + 1, CURTAIN.x1 - CURTAIN.x0 - 1, CURTAIN.y1 - CITY_WALL - 1], Tile.Cobble);
  town.fill([CURTAIN.x0 - 3, MOAT.y0, CURTAIN.x1 - CURTAIN.x0 + 7, MOAT.y1 - MOAT.y0 + 1], Tile.Water);
  for (const r of [[3, CITY_WALL + 1, 2, H], [51, CITY_WALL + 1, 2, H], [STREET.x0, BARBICAN[1] + BARBICAN[3], 5, H]] as TileRect[]) town.fill(r, Tile.Cobble);
  town.fill([STREET.x0 + 1, CURTAIN.y1 - 3, 3, BARBICAN[1] + BARBICAN[3] - CURTAIN.y1 + 3], Tile.Cobble);   // through the gates
  town.fill([STREET.x0 + 1, MOAT.y0, 3, MOAT.y1 - MOAT.y0 + 1], Tile.Path);
  town.fill([3, MOAT.y1 + 1, W - 6, 2], Tile.Cobble);                                               // the moat's bank, a lane along it

  // The city wall along the north edge, and the castle's curtain built onto it.
  town.add({
    kind: "curtainWall", closed: false, inside: corner(MID, 30), gates: [],
    points: [-2, 58].map(x => corner(x, CITY_WALL)), height: 8.5, thickness: 2.4, tower: { radius: 2.5, height: 13, roof: "#4a5a7a" },
  });
  town.add({
    kind: "curtainWall", closed: false, inside: corner(MID, 18), gates: [{ at: corner(MID, CURTAIN.y1), width: 3 * T }],
    points: [[CURTAIN.x0, CITY_WALL], [CURTAIN.x0, 19], [CURTAIN.x0, CURTAIN.y1], [CURTAIN.x1, CURTAIN.y1], [CURTAIN.x1, 19], [CURTAIN.x1, CITY_WALL]].map(([x, y]) => corner(x!, y!)),
    height: 8.5, thickness: 2.4, tower: { radius: 2.5, height: 13, roof: "#a8473a" },
  });
  // The approach: the barbican and the drawbridge over the moat, guarded, torches at the barbican's mouth.
  town.add({ kind: "drawbridge", rect: px([STREET.x0 + 1, MOAT.y0 - 1, 3, MOAT.y1 - MOAT.y0 + 2]) });
  town.add({ kind: "barbican", rect: px(BARBICAN), facing: "south", height: 6.5 });
  for (const x of [STREET.x0 + 0.7, STREET.x1 + 0.3]) town.add({ kind: "torch", x: x * T, y: (BARBICAN[1] + BARBICAN[3] - 0.55) * T, facing: "south", height: 2.8 });
  for (const x of [STREET.x0 - 1, STREET.x1 + 1]) town.add({ kind: "guard", ...at(x, BARBICAN[1] + BARBICAN[3]), facing: "south" });
  for (const x of [STREET.x0, STREET.x1]) town.add({ kind: "guard", ...at(x, CURTAIN.y1 - 3), facing: "south" });   // inside the gatehouse

  // The ward. The keep on its crag in the middle of the north side, braziers either side of its stair and
  // guards at its foot; the great hall and its kitchen west; the chapel and the lodgings east.
  town.add({ kind: "keep", rect: px(KEEP), plinth: 2.2, height: 8 });
  for (const x of [STREET.x0 - 1, STREET.x1 + 1]) town.add({ kind: "brazier", ...at(x, KEEP[1] + KEEP[3] + 1) });
  for (const x of [STREET.x0 - 2, STREET.x1 + 2]) town.add({ kind: "guard", ...at(x, KEEP[1] + KEEP[3] + 3), facing: "south" });
  town.add({ kind: "hall", rect: px([10, 6, 8, 13]), door: "east", roof: "#4a5a7a", storeys: 2, stone: true, chimneys: 2 });
  town.add({ kind: "hall", rect: px([11, 20, 6, 4]), door: "east", roof: "#7a3a2a", storeys: 1, stone: true, louvre: true });
  town.add({ kind: "church", rect: px([38, 6, 10, 5]), tower: "bellcote" });
  town.add({ kind: "hall", rect: px([39, 12, 8, 7]), door: "west", roof: "#a8473a", storeys: 3, stone: false, chimneys: 1 });
  // South of it, toward the gate: the barracks, the storehouse, the smithy, a
  // well, and a corner for training at arms.
  town.add({ kind: "hall", rect: px([10, 26, 10, 5]), door: "east", roof: "#5d6a7d", storeys: 2, stone: true, chimneys: 1 });
  town.add({ kind: "hall", rect: px([37, 27, 11, 4]), door: "north", roof: "#7a3a2a", storeys: 1, stone: true });
  town.add({ kind: "smithy", rect: px([38, 20, 4, 3]) });
  town.add({ kind: "well", ...at(23, 26) });
  for (const x of [20, 22]) town.add({ kind: "target", ...at(x, 22), facing: "south" });
  town.add({ kind: "dummy", ...at(33, 25), facing: "south" });
  town.add({ kind: "rack", rect: px([33, 22, 2, 1]), facing: "south" });
  for (const [x, y, what] of [[44, 21, "barrels"], [21, 30, "crates"], [46, 24, "crates"]] as const) town.add({ kind: "stock", ...at(x, y), what });

  // The city round the castle: houses along the lanes either side of it and the street below it.
  town.houses({
    street: (x, y) => town.at(x, y) === Tile.Cobble,
    allowed: (x, y) => (x < CURTAIN.x0 - 3 || x > CURTAIN.x1 + 3 || y > MOAT.y1 + 2) && !(x >= BARBICAN[0] - 1 && x < BARBICAN[0] + BARBICAN[2] + 1 && y < BARBICAN[1] + BARBICAN[3] + 1),
    shop: (x, _y, k) => (x >= STREET.x0 && x <= STREET.x1 && k < 0.6 ? (["bread", "meat", "cloth"] as const)[Math.floor(k * 5) % 3]! : null),
    frontage: [3, 4], depth: [3, 5], storeys: [3, 4], alley: 0.2, seed: 401, stone: 0.6,
  });

  return town;
}

/** The foot of the keep's stairs (tiles, down the middle line): where the way up into the Throne Room starts. */
const KEEP_STAIR = (() => {
  const k = keepPlan({ kind: "keep", rect: px(KEEP), plinth: 2.2, height: 8 });
  return k.z + k.back + k.baseD / 2 + k.stairD;
})();

const finish = (town: Town): AreaLayout => town.layout(
  // Up Castle Street from the Market Quarter, a step in from the edge (a step past where you left it);
  // and down the keep's stairs, out of the Throne Room.
  { town: { x: 28 * T, y: (H - 2) * T }, keep: { x: MID * T - HALF, y: (KEEP_STAIR + 1.6) * T - HALF } },
  [
    edgeExit("south", STREET.x0, STREET.x1, W, H, { area: "capital", entry: "castle" }),
    // Up the keep's stairs and in at its door: the Throne Room.
    { rect: { x: (MID - 1.2) * T, y: KEEP_STAIR * T - 2, w: 2.4 * T, h: T }, to: { area: "throneroom", entry: "door" } },
  ],
);

/** The castle as you walk it, without the view past its edge: what the Market Quarter shows past its own. */
export const castleCore = (): AreaLayout => finish(lay());

function build(): AreaLayout {
  // Past the south edge, the Market Quarter's north end as it is there: Castle Street runs straight on into it.
  const town = lay(), dx = CASTLE_STREET.x0 - STREET.x0;
  town.beyond(capital.build(), [dx - 10, 0, W + 20, 12], -10, H);
  return finish(town);
}

export const area: AreaDef = {
  id: "castle",
  name: "Capital City: the Castle",
  build,
  life: { enemies: false, potions: false, ambient: true },
};
