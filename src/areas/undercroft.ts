// The Undercroft: down the steps behind the low door at the foot of St Mary's tower, which the sexton's lost
// key opens (see docs/CURIOSITIES.md). The church's dead lie along the walls in their chest tombs, the Kellets'
// mason marks on every one, a few of the Waxleys' candles still burning. And at the north end, older and rougher
// than any of it, the floor of the temple Hereward built the church on top of: a ring of grey standing stones,
// faintly warm, one of them missing.
import { HALF, T, Tile } from "../data/world.ts";
import type { AreaDef, AreaLayout, Facing, FurnitureItem } from "../world/area.ts";
import { Town, px } from "../world/townkit.ts";

const W = 18, H = 18;
/** The door, mid-south wall; the room's middle line; the ring's centre. */
const DOOR_AT = W / 2 - 1, MID = W / 2;
export const RING = { x: MID, y: 5.6, radius: 2.7, stones: 7, gap: 3 } as const;

function build(): AreaLayout {
  const town = new Town(W, H, Tile.Cobble);
  town.add({ kind: "room", rect: px([0, 0, W, H]), floor: "flags", wall: "#5d5850", door: "south", doorAt: DOOR_AT });
  const add = (item: FurnitureItem, x: number, y: number, facing: Facing) => town.add({ kind: "furniture", item, x: x * T, y: y * T, facing });

  // The temple floor: the ring of old stones, the gap in it facing the way in.
  town.add({ kind: "stoneRing", x: RING.x * T, y: RING.y * T, radius: RING.radius, stones: RING.stones, gap: RING.gap });

  // The dead of St Mary's, in two rows down the walls, their feet to the middle; the oldest have effigies.
  for (const [i, y] of [9.5, 12.2, 14.9].entries()) {
    town.add({ kind: "tomb", x: 2.2 * T, y: y * T, facing: "east", effigy: i !== 1 });
    town.add({ kind: "tomb", x: (W - 2.2) * T, y: y * T, facing: "west", effigy: i !== 2 });
  }
  // The Waxleys' candles between them, and the sexton's stores by the door.
  for (const y of [10.85, 13.55]) for (const x of [3.6, W - 3.6]) add("candelabra", x, y, "south");
  add("barrel", 2.2, H - 1.6, "north");
  add("shelf", W - 2.4, H - 1.2, "north");
  add("chest", W - 4, H - 1.5, "north");

  return town.layout(
    // Down the steps, just inside the door.
    { steps: { x: MID * T - HALF, y: (H - 2.6) * T - HALF } },
    // Back up the steps, into St Mary's churchyard.
    [{ rect: { x: DOOR_AT * T, y: (H - 1) * T + 3, w: 1.3 * T, h: T - 3 }, to: { area: "capital", entry: "undercroft" } }],
  );
}

export const area: AreaDef = {
  id: "undercroft",
  name: "St Mary's: the Undercroft",
  build,
  life: { enemies: false, potions: false, ambient: false },
  indoors: true,
};
