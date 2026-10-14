// The King's Bridge: the way into Capital City, the seat of the kingdom of men, up the cave from Witchwood.
//
// Nothing here but the bridge, and the bridge is meant to tell you how rich the kingdom is before you're
// even inside it. From the cave, between two gilded lions on their marble plinths, it runs over the great
// river to Southgate in the city wall: white marble, a gold-leafed cornice and a gold-tipped pinnacle on
// every post of its parapets, the kingdom's arms on every post and its banners hung down its sides,
// gilded braziers and standards along it, and a great gate tower standing in the stream at its foot under
// gilded roofs, guarded. Through Southgate you see the city as it is: the Market Quarter's own high street,
// houses and guards, copied from its layout.
import { T, Tile } from "../data/world.ts";
import type { AreaDef, AreaLayout } from "../world/area.ts";
import { Town, at, corner, edgeExit, hash, px, type TileRect } from "../world/townkit.ts";
import { area as capital, SOUTHGATE } from "./capital.ts";

/** Rows of the city shown beyond the wall, then the bridge's part of the map below them. */
const CITY_ROWS = 12;
const W = 31, H = 30 + CITY_ROWS;
/** The bridge's line; its deck (its parapets standing on the outermost tiles), and the way along it. */
const MID = 15.5, WALL_Y = 3 + CITY_ROWS, RIVER = { y0: WALL_Y + 2, y1: WALL_Y + 21 };
const BRIDGE: TileRect = [11, WALL_Y + 1, 9, 22], WAY = { x0: 13, x1: 17 };
/** The bridge's great gate tower, at its south end. */
const GATE: TileRect = [6, RIVER.y1 - 2, 19, 3];
/** Where the Market Quarter's tiles go here: its Southgate lines up with ours. */
const DX = MID - SOUTHGATE.x, DY = WALL_Y - SOUTHGATE.y;

function build(): AreaLayout {
  const town = new Town(W, H);

  // Beyond the wall, the city: the Market Quarter's south end, its tiles and buildings as they are there.
  town.copy(capital.build(), [-DX, -DY, W, WALL_Y - 1], 0, 0, ["curtainWall"]);

  // The river, bank to bank, and the woods on the south bank round the cave.
  town.paint((_x, y) => y >= RIVER.y0 && y <= RIVER.y1, Tile.Water);
  town.paint((x, y) => y > RIVER.y1 && hash(x, y, 1) < 0.08, Tile.Flower);
  town.paint((x, y) => y > RIVER.y1 + 1 && (x < BRIDGE[0] - 2 || x > BRIDGE[0] + BRIDGE[2] + 1) && hash(x, y, 2) < 0.45, Tile.Tree);

  // The city wall, its towers where the Market Quarter's are, and Southgate in it at the bridge's head.
  town.add({
    kind: "curtainWall", points: SOUTHGATE.towers.map(x => corner(x + DX, WALL_Y)), closed: false, inside: corner(MID, 0),
    gates: [{ at: corner(MID, WALL_Y), width: 3 * T }], height: 8, thickness: 2.4, tower: { radius: 2.3, height: 13, roof: "#4a5a7a" },
  });
  town.fill([WAY.x0 + 1, WALL_Y - 3, 3, 5], Tile.Cobble);       // through Southgate

  // The King's Bridge: marble and gold, its gate tower, standards and braziers along it.
  town.fill(BRIDGE, Tile.Cobble);
  town.add({ kind: "stoneBridge", rect: px(BRIDGE), rich: true });
  town.add({ kind: "barbican", rect: px(GATE), facing: "south", height: 8, gap: 5, rich: true });
  for (const y of [4, 8, 12, 16].map(y => y + WALL_Y)) for (const x of [WAY.x0 - 1, WAY.x1 + 1]) town.add({ kind: "standard", ...at(x, y) });
  for (const y of [6, 10, 14].map(y => y + WALL_Y)) for (const x of [WAY.x0 - 1, WAY.x1 + 1]) town.add({ kind: "brazier", x: (x + 0.5) * T, y: y * T });

  // At its foot on the south bank: the lions, guards, and the way into the trees and the cave.
  for (const x of [BRIDGE[0] - 1.5, BRIDGE[0] + BRIDGE[2] + 1.5]) town.add({ kind: "lion", x: x * T, y: (RIVER.y1 + 2.5) * T, facing: "south" });
  for (const x of [WAY.x0 - 1, WAY.x1 + 1]) town.add({ kind: "guard", ...at(x, RIVER.y1 + 2), facing: "south" });
  town.fill([WAY.x0, RIVER.y1 + 1, WAY.x1 - WAY.x0 + 1, 2], Tile.Cobble);
  town.fill([WAY.x0 + 1, RIVER.y1 + 3, 3, H], Tile.Path);
  town.add({ kind: "cave", x: MID * T, y: H * T, facing: "north" });

  // Ships moored either side of the bridge.
  for (const [x, y, facing] of [[5, WALL_Y + 6.5, "east"], [26, WALL_Y + 14.5, "west"]] as const) town.add({ kind: "boat", x: x * T, y: y * T, facing, size: "cog" });
  for (const [x, y, facing] of [[6.5, WALL_Y + 17.5, "west"], [24.5, WALL_Y + 5.5, "east"]] as const) town.add({ kind: "boat", x: x * T, y: y * T, facing, size: "rowing" });

  return town.layout(
    // Coming up out of the cave, at the bridge's foot; coming out of Southgate, at its head.
    { cave: { x: 15 * T, y: (H - 4) * T }, gate: { x: 15 * T, y: (WALL_Y + 3) * T } },
    [
      edgeExit("south", WAY.x0 + 1, WAY.x0 + 3, W, H, { area: "witchwood", entry: "cave" }),
      // Through Southgate: into the city, just inside the gate, where the Market Quarter takes over.
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
