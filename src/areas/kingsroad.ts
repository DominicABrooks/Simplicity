// The King's Road: the approach to Capital City, the seat of the kingdom of men, up the cave from Witchwood.
//
// You come out of the cave among fields: wheat, barley and cabbages behind hedgerows, a windmill on its
// rise. The road runs north over the river on a stone bridge, past the watermill and the wharf (cogs and
// rowing boats at their moorings, a treadwheel crane, warehouses), through the suburb that grew up along
// it outside the walls (inns, stables, a farrier, an almshouse, a wayside chapel), past the jousting
// ground with its pavilions and grandstand, to the barbican: over the drawbridge and the moat, through the
// great south wall by Southgate, into the city, whose rooftops and spires rise beyond it.
import { T, Tile } from "../data/world.ts";
import type { AreaDef, AreaLayout } from "../world/area.ts";
import { AWNINGS, Town, at, corner, edgeExit, hash, px, type TileRect } from "../world/townkit.ts";

const W = 96, H = 80;
/** The road (tile columns), the city wall's line, the moat's rows and the barbican before the gate. */
const ROAD = { x0: 47, x1: 49 }, MID = 48.5, WALL_Y = 12, MOAT = { y0: 16, y1: 18 };
const BARBICAN: TileRect = [43, 19, 11, 5];
/** The river runs west to east; straight past the bridge, the mill and the wharf, winding elsewhere. */
const RIVER_W = 5;
const riverTop = (x: number) => (x >= 20 && x <= 66 ? 50 : 50 + Math.round(1.6 * Math.sin((x - 20) / 9)));
const onRoad = (x: number) => x >= ROAD.x0 && x <= ROAD.x1;
/** The jousting ground (inside its fence), and the suburb's limits. */
const LISTS = { x0: 64, y0: 28, x1: 90, y1: 40 };
const SUBURB = { y0: 24, y1: 41 };

function build(): AreaLayout {
  const town = new Town(W, H);

  // The country: grass, flowers, forest closing in at the map's edges (but never on the road).
  town.paint((x, y) => hash(x, y, 1) < 0.05, Tile.Flower);
  town.paint((x, y) => {
    const edge = Math.min(x, W - 1 - x, H - 1 - y);
    return y > WALL_Y + 2 && !onRoad(x) && (edge === 0 || (edge < 3 && hash(x, y, 2) < 0.75 - edge * 0.2));
  }, Tile.Tree);

  // Beyond the wall, the city: a lane under the wall, houses along it, and a church spire.
  town.fill([0, 0, W, WALL_Y - 1], Tile.Grass);
  town.fill([0, WALL_Y - 3, W, 2], Tile.Cobble);
  town.add({ kind: "church", rect: px([62, 1, 13, 6]), tower: "spire" });
  town.houses({ street: (x, y) => y === WALL_Y - 3 && town.at(x, y) === Tile.Cobble, allowed: (_x, y) => y < WALL_Y - 3, frontage: [3, 4], depth: [4, 6], storeys: [3, 4], alley: 0.15, seed: 101 });

  // The great south wall, and Southgate in it.
  const wallLine = [-2, 14, 30, 67, 83, 98].map(x => corner(x, WALL_Y));
  town.add({
    kind: "curtainWall", points: wallLine, closed: false, inside: corner(MID, 0), gates: [{ at: corner(MID, WALL_Y), width: 3 * T }],
    height: 6.5, thickness: 2.0, tower: { radius: 1.9, height: 10, roof: "#4a5a7a" },
  });
  town.fill([ROAD.x0, WALL_Y - 3, 3, 7], Tile.Cobble);         // the gate passage
  // The moat, crossed by the drawbridge, and the barbican before it.
  town.paint((_x, y) => y >= MOAT.y0 && y <= MOAT.y1, Tile.Water);
  town.fill([ROAD.x0, WALL_Y + 2, 3, MOAT.y1 - WALL_Y - 1], Tile.Path);
  town.add({ kind: "drawbridge", rect: px([ROAD.x0, MOAT.y0 - 1, 3, MOAT.y1 - MOAT.y0 + 2]) });
  town.fill([ROAD.x0, BARBICAN[1], 3, BARBICAN[3]], Tile.Cobble);
  town.add({ kind: "barbican", rect: px(BARBICAN), facing: "south", height: 5.5 });
  for (const x of [ROAD.x0 - 0.3, ROAD.x1 + 1.3]) town.add({ kind: "torch", x: x * T, y: (BARBICAN[1] + BARBICAN[3] - 0.55) * T, facing: "south", height: 2.6 });

  // The road, all the way from the barbican to the cave.
  town.fill([ROAD.x0, BARBICAN[1] + BARBICAN[3], 3, H], Tile.Path);

  // The river, and the stone bridge over it.
  for (let x = 0; x < W; x++) for (let y = riverTop(x); y < riverTop(x) + RIVER_W; y++) if (!onRoad(x)) town.set(x, y, Tile.Water);
  town.add({ kind: "stoneBridge", rect: px([ROAD.x0, riverTop(MID), 3, RIVER_W]) });
  const bank = riverTop(MID) - 1;                              // the last row of land on the north bank
  // The wharf west of the bridge: a paved quay, a crane, warehouses behind, boats on the water.
  town.fill([22, bank - 2, ROAD.x0 - 22, 3], Tile.Cobble);
  town.add({ kind: "crane", ...at(34, bank), facing: "south" });
  town.add({ kind: "hall", rect: px([23, bank - 9, 8, 6]), door: "south", roof: "#8a4a3a", storeys: 2, stone: false });
  town.add({ kind: "hall", rect: px([33, bank - 9, 8, 6]), door: "south", roof: "#5d6a7d", storeys: 2, stone: false });
  for (const [x, y] of [[27, 0], [37, 0], [42, 1]] as const) town.add({ kind: "stock", ...at(x, bank - 2 + y), what: y ? "crates" : "barrels" });
  town.add({ kind: "boat", x: 29 * T, y: (bank + 3.5) * T, facing: "east", size: "cog" });
  town.add({ kind: "boat", ...at(39, bank + 2), facing: "west", size: "rowing" });
  town.add({ kind: "boat", ...at(23, bank + 3), facing: "east", size: "rowing" });
  // The watermill east of the bridge, its wheel in the water.
  town.add({ kind: "watermill", rect: px([56, bank - 4, 6, 5]), wheel: "south" });
  town.fill([50, bank - 1, 6, 2], Tile.Path);

  // The suburb along the road: inns, a stable yard, the farrier, an almshouse and a wayside chapel.
  town.add({ kind: "house", rect: px([40, 26, 6, 6]), doorSide: "east", roof: "#a8473a", storeys: 3, sign: "#c8423a", lantern: true, stone: true });
  town.add({ kind: "house", rect: px([51, 26, 6, 6]), doorSide: "west", roof: "#4a5a7a", storeys: 3, sign: "#3f6fd0", lantern: true });
  town.add({ kind: "stable", rect: px([31, 25, 9, 3]), facing: "south" });
  town.add({ kind: "trough", rect: px([34, 29, 2, 1]) });
  town.add({ kind: "smithy", rect: px([52, 36, 3, 2]) });
  town.add({ kind: "hall", rect: px([12, 33, 11, 5]), door: "north", roof: "#8a4a3a", storeys: 1, stone: false });   // the almshouse
  town.add({ kind: "church", rect: px([11, 25, 11, 6]), tower: "bellcote" });                                   // the wayside chapel
  town.add({ kind: "well", ...at(26, 36) });
  // Its lanes: one west to the chapel, one east to the jousting ground, one down to the wharf.
  town.fill([8, 31, ROAD.x0 - 8, 2], Tile.Path);
  town.fill([ROAD.x1 + 1, 33, LISTS.x0 - ROAD.x1 - 1, 2], Tile.Path);
  town.fill([22, 38, ROAD.x0 - 22, 2], Tile.Path);
  town.fill([22, 38, 2, bank - 40], Tile.Path);
  town.houses({
    street: (x, y) => town.at(x, y) === Tile.Path || town.at(x, y) === Tile.Cobble,
    allowed: (x, y) => y >= SUBURB.y0 && y <= SUBURB.y1 + 5 && x > 6 && x < LISTS.x0 - 2 && y < bank - 3,
    shop: (x, _y, k) => (onRoad(x) && k < 0.5 ? (["bread", "produce", "pottery", "meat"] as const)[Math.floor(k * 8) % 4]! : null),
    frontage: [3, 4], depth: [4, 6], storeys: [2, 3], alley: 0.3, seed: 102,
  });

  // The jousting ground: a fenced field with the tilt barrier down its middle, pavilions at either end,
  // a grandstand along its north side and standards flying.
  town.add({ kind: "fence", points: [[LISTS.x0, 31], [LISTS.x0, LISTS.y0], [LISTS.x1, LISTS.y0], [LISTS.x1, LISTS.y1], [LISTS.x0, LISTS.y1], [LISTS.x0, 37]].map(([x, y]) => corner(x!, y!)) });
  town.add({ kind: "fence", points: [corner(69, 34), corner(85, 34)] });
  [[66.5, 30.5, AWNINGS[0]], [66.5, 37.5, AWNINGS[1]], [87.5, 30.5, AWNINGS[2]], [87.5, 37.5, AWNINGS[3]]].forEach(([x, y, c]) =>
    town.add({ kind: "pavilion", x: (x as number) * T, y: (y as number) * T, color: c as string }));
  town.add({ kind: "grandstand", rect: px([70, 24, 14, 3]), facing: "south" });
  for (const x of [68, 85]) town.add({ kind: "standard", ...at(x, 25) });
  for (const x of [72, 82]) town.add({ kind: "target", ...at(x, 38), facing: "west" });

  // South of the river: fields behind hedgerows, and the windmill on its rise.
  const fields: [TileRect, "wheat" | "barley" | "cabbage"][] = [
    [[8, 59, 16, 7], "wheat"], [[8, 67, 16, 6], "barley"], [[26, 59, 13, 6], "cabbage"],
    [[57, 59, 15, 7], "wheat"], [[57, 67, 15, 6], "barley"], [[74, 59, 14, 13], "cabbage"],
  ];
  for (const [r, crop] of fields) {
    town.fill(r, Tile.Grass);
    town.add({ kind: "field", rect: px(r), crop });
    for (let x = r[0] - 1; x <= r[0] + r[2]; x++) for (const y of [r[1] - 1, r[1] + r[3]]) if (town.open(x, y) && hash(x, y, 3) < 0.55) town.set(x, y, Tile.Tree);   // hedgerows
  }
  town.fill([28, 68, ROAD.x0 - 28, 2], Tile.Path);
  town.add({ kind: "windmill", ...at(30, 71) });

  // The cave, back down to Witchwood, among the trees at the road's end.
  town.add({ kind: "cave", x: MID * T, y: H * T, facing: "north" });

  // Guards before the barbican, watching the road.
  for (const x of [ROAD.x0 - 1, ROAD.x1 + 1]) town.add({ kind: "guard", ...at(x, BARBICAN[1] + BARBICAN[3] + 1), facing: "south" });
  town.yards(0.05, (x, y) => y > WALL_Y + 3 && y < riverTop(x) - 1 && x < LISTS.x0 - 2);

  return town.layout(
    // Coming up out of the cave, a few steps up the road; coming out of Southgate, on the drawbridge.
    { cave: { x: (ROAD.x0 + 1) * T, y: (H - 4) * T }, gate: { x: (ROAD.x0 + 1) * T, y: (MOAT.y0 - 1) * T } },
    [
      edgeExit("south", ROAD.x0, ROAD.x1, W, H, { area: "witchwood", entry: "cave" }),
      { rect: { x: ROAD.x0 * T, y: (WALL_Y - 3) * T, w: 3 * T, h: 2 * T }, to: { area: "capital", entry: "southgate" } },
    ],
  );
}

export const area: AreaDef = {
  id: "kingsroad",
  name: "Capital City: the King's Road",
  build,
  life: { enemies: false, potions: false, ambient: true },
};
