// The Throne Room, inside the keep: where King Osric holds court, up the keep's stairs from the castle ward.
//
// Everything the Gilding bought, in one hall. A floor of white marble with gold inlay; tall stained-glass
// windows and dragon tapestries behind the throne; the kingdom's standards down the walls; two rows of
// white marble pillars, fluted and capped in gold, each hung with the kingdom's crimson banner; a crimson carpet edged in gold running the length of the hall
// from the doors to the dais; gold chandeliers blazing overhead and tall gold candelabras along the way;
// gilded urns of flowers; two gilded lions on their plinths and burning braziers at the foot of the dais;
// the kingdom's standards behind it; and on the dais, under the arms of Aurenmark, the golden throne, and
// the King before it. Royal Guards line the carpet.
import { HALF, T, Tile } from "../data/world.ts";
import type { AreaDef, AreaLayout, Facing, FurnitureItem } from "../world/area.ts";
import { Town, px } from "../world/townkit.ts";

const W = 20, H = 26;
/** The doors, mid-south wall (on a whole tile, so the doorway's tile is open), the hall's middle line, and where the dais's front edge is. */
const DOOR_AT = W / 2 - 1, MID = W / 2, DAIS_FRONT = 5.4;

function build(): AreaLayout {
  const town = new Town(W, H, Tile.Cobble);
  town.add({ kind: "room", rect: px([0, 0, W, H]), floor: "marble", wall: "#e9dcc4", door: "south", doorAt: DOOR_AT });
  const add = (item: FurnitureItem, x: number, y: number, facing: Facing) => town.add({ kind: "furniture", item, x: x * T, y: y * T, facing });

  // The dais across the north end, the throne on it, and the King before the throne.
  add("dais", MID, 3.6, "south");
  add("throne", MID, 2.3, "south");
  town.add({ kind: "king", x: MID * T, y: 3.9 * T, facing: "south" });
  // Behind and beside the throne, on the north wall that faces the hall: the standards, stained glass and tapestries.
  for (const dx of [-3.2, 3.2]) town.add({ kind: "standard", x: (MID + dx) * T, y: 1.4 * T });
  for (const dx of [-5.6, -4.2, 4.2, 5.6]) add("window", MID + dx, 0.41, "south");   // its frame (0.12 deep) against the wall's face, not sunk in it
  for (const dx of [-7.9, 7.9]) add("tapestry", MID + dx, 0.39, "south");   // on the wall's face (0.35 thick, its gold band 0.375), not in it
  // At its foot: the gilded lions and the braziers.
  for (const dx of [-3.8, 3.8]) {
    town.add({ kind: "lion", x: (MID + dx) * T, y: (DAIS_FRONT + 1.1) * T, facing: "south" });
    town.add({ kind: "brazier", x: (MID + dx * 0.62) * T, y: (DAIS_FRONT + 0.6) * T });
  }

  // The carpet, from the doors to the dais, in lengths.
  for (let y = H - 2.2; y > DAIS_FRONT + 1; y -= 3.8) add("carpet", MID, y, "south");
  // The pillars down either side, a banner on each; candelabras and urns between; and along the side walls,
  // the kingdom's standards.
  for (const [i, y] of [8.5, 12.5, 16.5, 20.5].entries()) {
    for (const side of [-1, 1]) {
      const x = MID + side * 5.2, inward: Facing = side < 0 ? "east" : "west";
      add("pillar", x, y, inward);
      add(i % 2 ? "urn" : "candelabra", MID + side * 3.1, y + 2, "south");
      town.add({ kind: "standard", x: (side < 0 ? 1.1 : W - 1.1) * T, y: (y + 2) * T });
    }
  }
  // Chandeliers down the hall, over the carpet.
  for (const y of [9.5, 14.5, 19.5]) add("chandelier", MID, y, "south");

  // The Royal Guard: two by the doors, two at the foot of the carpet's end, facing in.
  for (const dx of [-1.9, 1.9]) town.add({ kind: "guard", x: (MID + dx) * T, y: (H - 2.2) * T, facing: "north" });
  town.add({ kind: "guard", x: (MID - 2.4) * T, y: (DAIS_FRONT + 2.6) * T, facing: "east" });
  town.add({ kind: "guard", x: (MID + 2.4) * T, y: (DAIS_FRONT + 2.6) * T, facing: "west" });

  return town.layout(
    // In through the doors, at the foot of the carpet.
    { door: { x: MID * T - HALF, y: (H - 3.6) * T - HALF } },
    // Out through the doors, onto the keep's stairs in the castle ward.
    [{ rect: { x: DOOR_AT * T, y: (H - 1) * T + 3, w: 1.3 * T, h: T - 3 }, to: { area: "castle", entry: "keep" } }],
  );
}

export const area: AreaDef = {
  id: "throneroom",
  name: "The Castle: the Throne Room",
  build,
  life: { enemies: false, potions: false, ambient: false },
  indoors: true,
};
