// The King's Bridge: the approach to Capital City, the seat of the kingdom of men, up the cave from
// Witchwood. Everything here is meant to tell you how rich the kingdom is before you're even inside it.
//
// You come out of the cave into the King's Park, where a broad paved avenue runs north between an allée
// of trees, banner standards and braziers on their stones. It crosses the great river on the King's
// Bridge, a stone bridge with a gate tower standing in the stream, guarded at both ends. On the far bank
// is the harbour: stone quays either side of the bridge, cogs and rowing boats at their moorings,
// treadwheel cranes, the merchants' warehouses, the customs house over its arcade and the merchants'
// guildhall; behind them, the merchant palaces in their walled gardens. Then the Gate Plaza, flagstoned,
// with a great fountain either side, the barbican, the drawbridge over the moat, and the great south wall
// with Southgate in it, the city's rooftops and spires rising beyond.
import { T, Tile } from "../data/world.ts";
import type { AreaDef, AreaLayout } from "../world/area.ts";
import { Town, at, corner, edgeExit, hash, px, type TileRect } from "../world/townkit.ts";

const W = 96, H = 80;
/** The avenue's line, the city wall's row, the moat's rows, the barbican before the gate, and the plaza. */
const MID = 48.5, AVENUE = { x0: 45, x1: 51 }, WALL_Y = 12, MOAT = { y0: 16, y1: 18 };
const BARBICAN: TileRect = [43, 19, 11, 5], PLAZA = { x0: 30, y0: 24, x1: 67, y1: 36 };
/** The river, the quays along its north bank, the bridge over it and the gate tower standing on it. */
const RIVER = { y0: 44, y1: 51 }, QUAY = { y0: 40, y1: 43 }, BRIDGE: TileRect = [46, RIVER.y0, 5, RIVER.y1 - RIVER.y0 + 1];
const BRIDGE_GATE: TileRect = [43, RIVER.y0 + 2, 11, 4];
const onAvenue = (x: number) => x >= AVENUE.x0 && x <= AVENUE.x1;

function build(): AreaLayout {
  const town = new Town(W, H);

  // The park: grass, flowers, the woods closing in at its edges and round the cave.
  town.paint((x, y) => hash(x, y, 1) < 0.06, Tile.Flower);
  town.paint((x, y) => {
    const edge = Math.min(x, W - 1 - x, H - 1 - y);
    return y > RIVER.y1 + 1 && !onAvenue(x) && (edge === 0 || (edge < 4 && hash(x, y, 2) < 0.8 - edge * 0.18));
  }, Tile.Tree);

  // Beyond the wall, the city: a lane under the wall, tall houses along it, and its spires.
  town.fill([0, 0, W, WALL_Y - 1], Tile.Grass);
  town.fill([0, WALL_Y - 3, W, 2], Tile.Cobble);
  town.add({ kind: "church", rect: px([62, 1, 13, 6]), tower: "spire" });
  town.add({ kind: "church", rect: px([14, 1, 14, 6]), tower: "spire" });
  town.houses({ street: (x, y) => y === WALL_Y - 3 && town.at(x, y) === Tile.Cobble, allowed: (_x, y) => y < WALL_Y - 3, frontage: [3, 4], depth: [4, 6], storeys: [3, 4], alley: 0.1, seed: 101, stone: 0.7 });

  // The great south wall, taller here where the kingdom shows itself, and Southgate in it.
  town.add({
    kind: "curtainWall", points: [-2, 14, 30, 67, 83, 98].map(x => corner(x, WALL_Y)), closed: false, inside: corner(MID, 0),
    gates: [{ at: corner(MID, WALL_Y), width: 3 * T }], height: 8, thickness: 2.4, tower: { radius: 2.3, height: 13, roof: "#4a5a7a" },
  });
  town.fill([AVENUE.x0 + 2, WALL_Y - 3, 3, 7], Tile.Cobble);    // the gate passage
  // The moat, crossed by the drawbridge, and the barbican before it.
  town.paint((_x, y) => y >= MOAT.y0 && y <= MOAT.y1, Tile.Water);
  town.fill([AVENUE.x0 + 2, WALL_Y + 2, 3, MOAT.y1 - WALL_Y - 1], Tile.Cobble);
  town.add({ kind: "drawbridge", rect: px([AVENUE.x0 + 2, MOAT.y0 - 1, 3, MOAT.y1 - MOAT.y0 + 2]) });
  town.fill([AVENUE.x0 + 2, BARBICAN[1], 3, BARBICAN[3]], Tile.Cobble);
  town.add({ kind: "barbican", rect: px(BARBICAN), facing: "south", height: 6.5 });
  for (const x of [AVENUE.x0 + 1.7, AVENUE.x1 - 0.7]) town.add({ kind: "torch", x: x * T, y: (BARBICAN[1] + BARBICAN[3] - 0.55) * T, facing: "south", height: 2.8 });

  // The Gate Plaza: flagstones, a great fountain either side of the way, braziers and the kingdom's
  // standards round it, guards before the barbican.
  town.fill([PLAZA.x0, PLAZA.y0, PLAZA.x1 - PLAZA.x0 + 1, PLAZA.y1 - PLAZA.y0 + 1], Tile.Cobble);
  town.fill([AVENUE.x0, PLAZA.y1, AVENUE.x1 - AVENUE.x0 + 1, RIVER.y0 - PLAZA.y1], Tile.Cobble);   // on down to the bridge
  town.add({ kind: "plaza", rect: px([PLAZA.x0, PLAZA.y0, PLAZA.x1 - PLAZA.x0 + 1, PLAZA.y1 - PLAZA.y0 + 1]), centre: corner(MID, 30.5) });
  for (const x of [38, 59]) town.add({ kind: "fountain", ...corner(x, 30.5), radius: 2.2 });
  for (const x of [PLAZA.x0 + 1, PLAZA.x1 - 1]) for (const y of [PLAZA.y0 + 1, PLAZA.y1 - 1]) town.add({ kind: "brazier", ...at(x, y) });
  for (const x of [33, 43, 54, 64]) town.add({ kind: "standard", ...at(x, PLAZA.y0) });
  for (const x of [AVENUE.x0 + 1, AVENUE.x1 - 1]) town.add({ kind: "guard", ...at(x, PLAZA.y0 + 1), facing: "south" });

  // The river, the King's Bridge over it, and its gate tower standing in the stream, guarded.
  town.paint((_x, y) => y >= RIVER.y0 && y <= RIVER.y1, Tile.Water);
  town.fill([BRIDGE[0], BRIDGE[1], BRIDGE[2], BRIDGE[3]], Tile.Cobble);
  town.add({ kind: "stoneBridge", rect: px(BRIDGE) });
  town.add({ kind: "barbican", rect: px(BRIDGE_GATE), facing: "south", height: 6 });
  for (const x of [AVENUE.x0, AVENUE.x1]) town.add({ kind: "guard", ...at(x, RIVER.y1 + 2), facing: "south" });

  // The harbour along the north bank: stone quays, cranes swinging out over the water, ships at their
  // moorings; behind the quays, warehouses, the customs house on its arcade, the merchants' guildhall.
  town.fill([0, QUAY.y0, W, QUAY.y1 - QUAY.y0 + 1], Tile.Cobble);
  for (const x of [12, 28, 66, 82]) town.add({ kind: "crane", ...at(x, QUAY.y1), facing: "south" });
  for (const [x, y, facing] of [[10, 47.5, "east"], [27, 48.5, "west"], [68, 47.5, "east"], [84, 48.5, "west"]] as const) town.add({ kind: "boat", x: x * T, y: y * T, facing, size: "cog" });
  for (const [x, y, facing] of [[19, 49.5, "east"], [37, 46.5, "west"], [60, 49.5, "west"], [76, 46.5, "east"]] as const) town.add({ kind: "boat", x: x * T, y: y * T, facing, size: "rowing" });
  for (const r of [[4, 34, 10, 5], [16, 34, 10, 5], [70, 34, 10, 5], [82, 34, 10, 5]] as TileRect[]) town.add({ kind: "hall", rect: px(r), door: "south", roof: "#5d6a7d", storeys: 2, stone: true });
  town.fill([31, 37, 11, 4], Tile.Cobble);
  town.add({ kind: "hall", rect: px([31, 37, 11, 4]), door: "south", roof: "#a8473a", storeys: 2, stone: true, arcade: true });   // the customs house
  town.add({ kind: "hall", rect: px([55, 37, 11, 4]), door: "south", roof: "#4a5a7a", storeys: 2, stone: true, chimneys: 2 });  // the merchants' guildhall
  for (const [x, y, what] of [[8, 40, "barrels"], [21, 40, "crates"], [35, 41, "sacks"], [62, 41, "barrels"], [74, 40, "crates"], [88, 40, "sacks"]] as const) town.add({ kind: "stock", ...at(x, y), what });

  // The merchant palaces: great stone houses behind the warehouses, each in its walled garden, a lane in front.
  town.fill([0, 31, PLAZA.x0, 2], Tile.Cobble);
  town.fill([PLAZA.x1 + 1, 31, W - PLAZA.x1 - 1, 2], Tile.Cobble);
  for (const r of [[3, 20, 12, 9], [17, 20, 11, 9], [69, 20, 11, 9], [82, 20, 12, 9]] as TileRect[]) {
    town.add({ kind: "hall", rect: px(r), door: "south", roof: "#7a3a2a", storeys: 3, stone: true, chimneys: 2 });
    town.fill([r[0], r[1] + r[3], r[2], 2], Tile.Flower);     // its garden, between it and the lane
    for (const x of [r[0], r[0] + r[2] - 1]) town.set(x, r[1] + r[3] + 1, Tile.Tree);
  }

  // The King's Park south of the river: the avenue from the bridge to the cave, an allée of trees down
  // either side of it, standards and braziers along it.
  town.fill([AVENUE.x0, RIVER.y1 + 1, AVENUE.x1 - AVENUE.x0 + 1, H - RIVER.y1 - 7], Tile.Cobble);
  town.fill([AVENUE.x0 + 2, H - 6, 3, 6], Tile.Path);          // narrowing to a path into the woods and the cave
  for (let y = RIVER.y1 + 3; y < H - 4; y += 2) for (const x of [AVENUE.x0 - 2, AVENUE.x1 + 2]) town.set(x, y, Tile.Tree);
  for (let y = RIVER.y1 + 4; y < H - 6; y += 6) {
    for (const x of [AVENUE.x0 - 1, AVENUE.x1 + 1]) town.add({ kind: "standard", ...at(x, y) });
    for (const x of [AVENUE.x0 - 1, AVENUE.x1 + 1]) town.add({ kind: "brazier", ...at(x, y + 3) });
  }
  town.add({ kind: "cave", x: MID * T, y: H * T, facing: "north" });
  town.yards(0.04, (x, y) => y > RIVER.y1 + 2 && (x < AVENUE.x0 - 4 || x > AVENUE.x1 + 4));

  return town.layout(
    // Coming up out of the cave, a few steps up the avenue; coming out of Southgate, on the drawbridge.
    { cave: { x: 48 * T, y: (H - 4) * T }, gate: { x: 48 * T, y: (MOAT.y0 - 1) * T } },
    [
      edgeExit("south", AVENUE.x0 + 2, AVENUE.x0 + 4, W, H, { area: "witchwood", entry: "cave" }),
      { rect: { x: (AVENUE.x0 + 2) * T, y: (WALL_Y - 3) * T, w: 3 * T, h: 2 * T }, to: { area: "capital", entry: "southgate" } },
    ],
  );
}

export const area: AreaDef = {
  id: "kingsroad",
  name: "Capital City: the King's Bridge",
  build,
  life: { enemies: false, potions: false, ambient: true },
};
