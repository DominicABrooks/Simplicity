// Behind the little door at the back of the Undercroft, the one carved with three flames, a snowflake and a lightning
// bolt that the Kellets keep sealing: not a door but the Vael's lock on somebody else's door (HISTORY.md), which the
// Ringstone Pendant opens once it's drunk from all five of Ael's old stones (src/game/pendant.ts). The deep places: a
// low round room older than the ring, and cold; the stone nest where the Old Mother laid her three eggs right on the
// crack to hold it shut, flecks of gilt still in its hollows; the Song of the Seal carved round the walls; and the
// crack, the somebody else's door, held now only by the Vael's stitches, two of them snapped, an eye under it looking
// up, till the burning pendant pulls them tight. What's said there is CHAMBER_SAYS (src/data/undercroft.ts);
// src/game/sealchamber.ts says it.
import { HALF, T, Tile } from "../data/world.ts";
import type { AreaDef, AreaLayout } from "../world/area.ts";
import { ROOM_WALL } from "../world/plans.ts";
import { Town, px } from "../world/townkit.ts";

const W = 10, H = 9, MID = W / 2, DOOR_AT = MID - 1;
/** The nest's middle (tiles). */
export const NEST = { x: MID, y: 3.8 } as const;

function build(): AreaLayout {
  const town = new Town(W, H, Tile.Cobble);
  town.add({ kind: "room", rect: px([0, 0, W, H]), floor: "flags", wall: "#4f5654", door: "south", doorAt: DOOR_AT });
  town.add({ kind: "vaelNest", x: NEST.x * T, y: NEST.y * T, back: ROOM_WALL.thick });
  return town.layout(
    // Just in through the little door.
    { door: { x: MID * T - HALF, y: (H - 2.4) * T - HALF } },
    // Back out of it, into the Undercroft behind the ring.
    [{ rect: { x: DOOR_AT * T, y: (H - 1) * T + 3, w: 1.3 * T, h: T - 3 }, to: { area: "undercroft", entry: "seal" } }],
  );
}

export const area: AreaDef = {
  id: "sealchamber",
  name: "St Mary's: the Deep Places",
  build,
  life: { enemies: false, potions: false, ambient: false },
  indoors: true,
};
