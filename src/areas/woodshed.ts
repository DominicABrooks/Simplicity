// Inside the woodcutters' other hut in the Ashwild (src/areas/ashwild.ts, the first glade's west-door hut): their
// workshop and store, left as it was the night the woods went grey. One timber room: the workbench where the axes were
// ground, barrels and a chest along the walls, a shelf, a bench. Nothing in it now but sawdust. Out through the door,
// and you're on the step outside it again.
import { HALF, T, Tile } from "../data/world.ts";
import type { AreaDef, AreaLayout, Facing, FurnitureItem } from "../world/area.ts";
import { Town, px } from "../world/townkit.ts";

const W = 9, H = 8;
/** Which tile along the south wall the door is in, and how thick the walls are (tiles). */
const DOOR_AT = Math.floor(W / 2) - 1, WALL = 0.35;

function build(): AreaLayout {
  const town = new Town(W, H, Tile.Cobble);
  town.add({ kind: "room", rect: px([0, 0, W, H]), floor: "planks", wall: "#cfc6b2", door: "south", doorAt: DOOR_AT });
  const add = (item: FurnitureItem, x: number, y: number, facing: Facing) => town.add({ kind: "furniture", item, x: x * T, y: y * T, facing });
  add("workbench", W - 2.2, 2.2, "west");
  add("chest", W / 2 - 1.6, WALL + 0.3, "south");
  add("shelf", WALL + 0.2, 2.6, "east");
  add("barrel", 1.1, H - 1.6, "east");
  add("barrel", 1.1, H - 2.7, "east");
  add("barrel", W - 0.85, H - 1.6, "west");
  add("bench", W / 2, H / 2 + 0.4, "south");
  return town.layout(
    { in: { x: (DOOR_AT + 0.65) * T - HALF, y: (H - 1.6) * T - HALF } },
    [{ rect: { x: DOOR_AT * T, y: (H - 1) * T + 3, w: 1.3 * T, h: T - 3 }, to: { area: "ashwild", entry: "woodshed" } }],
  );
}

export const area: AreaDef = {
  id: "woodshed",
  name: "The woodcutters' workshop",
  build,
  life: { enemies: false, potions: false, ambient: false },
  indoors: true,
};
