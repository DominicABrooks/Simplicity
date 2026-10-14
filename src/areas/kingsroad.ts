// The King's Bridge: the approach to Capital City, the seat of the kingdom of men, up the cave from
// Witchwood. Everything here is meant to tell you how rich the kingdom is before you're even inside it.
//
// You come out of the cave at the edge of the King's Park onto the King's Bridge: a broad stone bridge
// over the great river, its parapets pinnacled, banner standards and braziers along it, and a great gate
// tower standing in the stream at either end. Moored either side are the merchants' ships; on the far
// bank, the harbour quay with its cranes, the customs house on its arcade and the merchants' guildhall,
// and behind it the merchant palaces in their gardens. Then the Gate Plaza with a great fountain either
// side, the barbican, the drawbridge over the moat, and the great south wall with Southgate in it, the
// city's rooftops and spires rising beyond.
import { T, Tile } from "../data/world.ts";
import type { AreaDef, AreaLayout } from "../world/area.ts";
import { Town, at, corner, edgeExit, hash, px, type TileRect } from "../world/townkit.ts";

const W = 96, H = 50;
/** The way's line and width, the city wall's row, the moat's rows, the barbican before the gate, and the plaza. */
const MID = 48.5, WAY = { x0: 46, x1: 50 }, WALL_Y = 12, MOAT = { y0: 16, y1: 18 };
const BARBICAN: TileRect = [43, 19, 11, 5], PLAZA = { x0: 30, y0: 24, x1: 67, y1: 28 };
/** The quay, the river, and the King's Bridge over it: its deck, and its gate towers at either end. */
const QUAY = { y0: 29, y1: 32 }, RIVER = { y0: 33, y1: 44 };
const BRIDGE: TileRect = [44, RIVER.y0, 9, RIVER.y1 - RIVER.y0 + 1];
const NORTH_GATE: TileRect = [39, RIVER.y0, 19, 3], SOUTH_GATE: TileRect = [39, RIVER.y1 - 2, 19, 3];

function build(): AreaLayout {
  const town = new Town(W, H);

  // The park on the south bank: grass and flowers, the woods closing in round the cave.
  town.paint((x, y) => hash(x, y, 1) < 0.06, Tile.Flower);
  town.paint((x, y) => y > RIVER.y1 + 1 && (x < WAY.x0 - 1 || x > WAY.x1 + 1) && hash(x, y, 2) < 0.4, Tile.Tree);

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
  town.fill([WAY.x0 + 1, WALL_Y - 3, 3, 7], Tile.Cobble);       // the gate passage
  // The moat, crossed by the drawbridge, and the barbican before it.
  town.paint((_x, y) => y >= MOAT.y0 && y <= MOAT.y1, Tile.Water);
  town.fill([WAY.x0 + 1, WALL_Y + 2, 3, MOAT.y1 - WALL_Y - 1], Tile.Cobble);
  town.add({ kind: "drawbridge", rect: px([WAY.x0 + 1, MOAT.y0 - 1, 3, MOAT.y1 - MOAT.y0 + 2]) });
  town.fill([WAY.x0 + 1, BARBICAN[1], 3, BARBICAN[3]], Tile.Cobble);
  town.add({ kind: "barbican", rect: px(BARBICAN), facing: "south", height: 6.5 });
  for (const x of [WAY.x0 + 0.7, WAY.x1 + 0.3]) town.add({ kind: "torch", x: x * T, y: (BARBICAN[1] + BARBICAN[3] - 0.55) * T, facing: "south", height: 2.8 });

  // The Gate Plaza: flagstones, a great fountain either side of the way, braziers, the kingdom's
  // standards along it, guards before the barbican.
  town.fill([PLAZA.x0, PLAZA.y0, PLAZA.x1 - PLAZA.x0 + 1, PLAZA.y1 - PLAZA.y0 + 1], Tile.Cobble);
  town.add({ kind: "plaza", rect: px([PLAZA.x0, PLAZA.y0, PLAZA.x1 - PLAZA.x0 + 1, PLAZA.y1 - PLAZA.y0 + 1]), centre: corner(MID, 26.5) });
  for (const x of [38, 59]) town.add({ kind: "fountain", ...corner(x, 26.5), radius: 1.9 });
  for (const x of [PLAZA.x0 + 1, PLAZA.x1 - 1]) town.add({ kind: "brazier", ...at(x, PLAZA.y0 + 2) });
  for (const x of [33, 43, 54, 64]) town.add({ kind: "standard", ...at(x, PLAZA.y0) });
  for (const x of [WAY.x0, WAY.x1]) town.add({ kind: "guard", ...at(x, PLAZA.y0 + 1), facing: "south" });

  // The merchant palaces either side of the plaza, their gardens running down to the quay.
  for (const r of [[3, 19, 12, 8], [17, 19, 11, 8], [69, 19, 11, 8], [82, 19, 12, 8]] as TileRect[]) {
    town.add({ kind: "hall", rect: px(r), door: "south", roof: "#7a3a2a", storeys: 3, stone: true, chimneys: 2 });
    town.fill([r[0], r[1] + r[3], r[2], QUAY.y0 - r[1] - r[3]], Tile.Flower);
    for (const x of [r[0], r[0] + r[2] - 1]) town.set(x, QUAY.y0 - 1, Tile.Tree);
  }

  // The harbour quay along the north bank: cranes out over the water, the customs house on its arcade
  // and the merchants' guildhall either side of the bridge, stock about; ships moored in the river.
  town.fill([0, QUAY.y0, W, QUAY.y1 - QUAY.y0 + 1], Tile.Cobble);
  town.add({ kind: "hall", rect: px([31, QUAY.y0, 10, 3]), door: "south", roof: "#a8473a", storeys: 2, stone: true, arcade: true });   // the customs house
  town.add({ kind: "hall", rect: px([56, QUAY.y0, 10, 3]), door: "south", roof: "#4a5a7a", storeys: 2, stone: true, chimneys: 2 });   // the merchants' guildhall
  for (const x of [10, 24, 72, 86]) town.add({ kind: "crane", ...at(x, QUAY.y1), facing: "south" });
  for (const [x, y, what] of [[6, 30, "barrels"], [18, 31, "crates"], [28, 30, "sacks"], [68, 31, "barrels"], [78, 30, "crates"], [91, 31, "sacks"]] as const) town.add({ kind: "stock", ...at(x, y), what });
  town.paint((_x, y) => y >= RIVER.y0 && y <= RIVER.y1, Tile.Water);
  for (const [x, y, facing] of [[9, 36.5, "east"], [26, 40.5, "west"], [70, 36.5, "east"], [87, 40.5, "west"]] as const) town.add({ kind: "boat", x: x * T, y: y * T, facing, size: "cog" });
  for (const [x, y, facing] of [[18, 42.5, "east"], [33, 37.5, "west"], [63, 42.5, "west"], [79, 38.5, "east"]] as const) town.add({ kind: "boat", x: x * T, y: y * T, facing, size: "rowing" });

  // The King's Bridge: a broad deck between pinnacled parapets, a great gate tower in the stream at
  // either end, standards and braziers along it between them, guards at its south end.
  town.fill(BRIDGE, Tile.Cobble);
  town.add({ kind: "stoneBridge", rect: px(BRIDGE) });
  town.add({ kind: "barbican", rect: px(NORTH_GATE), facing: "north", height: 7.5, gap: 5 });
  town.add({ kind: "barbican", rect: px(SOUTH_GATE), facing: "south", height: 7.5, gap: 5 });
  for (const y of [RIVER.y0 + 4, RIVER.y1 - 4]) for (const x of [BRIDGE[0] + 1, BRIDGE[0] + BRIDGE[2] - 2]) town.add({ kind: "standard", ...at(x, y) });
  for (const x of [BRIDGE[0] + 1, BRIDGE[0] + BRIDGE[2] - 2]) town.add({ kind: "brazier", ...at(x, (RIVER.y0 + RIVER.y1) / 2) });
  for (const x of [WAY.x0 - 1, WAY.x1 + 1]) town.add({ kind: "guard", ...at(x, RIVER.y1 + 2), facing: "south" });

  // The south bank: the way from the bridge into the trees and the cave.
  town.fill([WAY.x0, RIVER.y1 + 1, WAY.x1 - WAY.x0 + 1, H], Tile.Cobble);
  town.fill([WAY.x0 + 1, H - 2, 3, 2], Tile.Path);
  town.add({ kind: "cave", x: MID * T, y: H * T, facing: "north" });

  return town.layout(
    // Coming up out of the cave, at the bridge's foot; coming out of Southgate, on the drawbridge.
    { cave: { x: 48 * T, y: (H - 4) * T }, gate: { x: 48 * T, y: (MOAT.y0 - 1) * T } },
    [
      edgeExit("south", WAY.x0 + 1, WAY.x0 + 3, W, H, { area: "witchwood", entry: "cave" }),
      { rect: { x: (WAY.x0 + 1) * T, y: (WALL_Y - 3) * T, w: 3 * T, h: 2 * T }, to: { area: "capital", entry: "southgate" } },
    ],
  );
}

export const area: AreaDef = {
  id: "kingsroad",
  name: "Capital City: the King's Bridge",
  build,
  life: { enemies: false, potions: false, ambient: true },
};
