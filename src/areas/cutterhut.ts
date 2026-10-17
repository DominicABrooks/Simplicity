// Inside the woodcutters' hut in the Ashwild (src/areas/ashwild.ts, the first glade's south-door hut, the one with
// Wat's warning cut in the door): the Coppins' home, left in a hurry the night the woods went grey. One timber room,
// no fire in it for months: the beds along one side, the table and benches, a shelf and a barrel, and against the back
// wall Abel Coppin's iron strongbox (src/game/lockbox.ts), still shut on his good boots. Out through the door, and
// you're on the step outside it again.
import { LOCKBOX } from "../data/lockbox.ts";
import { HALF, T, Tile } from "../data/world.ts";
import type { AreaDef, AreaLayout, Facing, FurnitureItem } from "../world/area.ts";
import { Town, px } from "../world/townkit.ts";

const W = 9, H = 8;
/** Which tile along the south wall the door is in, and how thick the walls are (tiles). */
const DOOR_AT = Math.floor(W / 2) - 1, WALL = 0.35;
/** The strongbox's footprint (world units: wide, deep), to stand solid in the room. */
const BOX = { w: 0.5, d: 0.32 } as const;

function build(): AreaLayout {
  const town = new Town(W, H, Tile.Cobble);
  town.add({ kind: "room", rect: px([0, 0, W, H]), floor: "planks", wall: "#d8cfbd", door: "south", doorAt: DOOR_AT });
  const add = (item: FurnitureItem, x: number, y: number, facing: Facing) => town.add({ kind: "furniture", item, x: x * T, y: y * T, facing });
  add("bed", WALL + 0.95, WALL + 0.75, "east");               // Abel and Edith's
  add("bed", WALL + 0.95, WALL + 1.9, "east");                // Wat's
  add("table", W / 2, H / 2 + 0.6, "south");
  add("bench", W / 2, H / 2 - 0.2, "south");
  add("bench", W / 2, H / 2 + 1.4, "north");
  add("shelf", W - WALL - 0.2, 1.9, "west");
  add("barrel", W - 0.85, H - 1.6, "west");
  const layout = town.layout(
    { in: { x: (DOOR_AT + 0.65) * T - HALF, y: (H - 1.6) * T - HALF } },
    [{ rect: { x: DOOR_AT * T, y: (H - 1) * T + 3, w: 1.3 * T, h: T - 3 }, to: { area: "ashwild", entry: "cutterhut" } }],
  );
  // The strongbox stands where src/game/lockbox.ts puts it, and is as solid as the rest of the furniture.
  const box = { kind: "box" as const, x: LOCKBOX.at.x * T - (BOX.w * T) / 2, y: LOCKBOX.at.y * T - (BOX.d * T) / 2, w: BOX.w * T, h: BOX.d * T };
  return { ...layout, map: { ...layout.map, solids: [...layout.map.solids, box] } };
}

export const area: AreaDef = {
  id: "cutterhut",
  name: "The woodcutters' hut",
  build,
  life: { enemies: false, potions: false, ambient: false },
  indoors: true,
};
