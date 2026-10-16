// Calder's head (src/data/rift.ts, CALDERS_HEAD): all that's left whole of him when he falls, a round grey stone with the
// dark gone out of its face, for carrying home to the King (src/game/ending.ts). It's an ordinary item in the bag,
// known by its name.
import { CALDERS_HEAD } from "../data/rift.ts";
import type { Game } from "./game.ts";

export const HEAD_NAME = CALDERS_HEAD[3];

/** Is he carrying Calder's head: in the bag, or held on the cursor? */
export function carryingHead(g: Game): boolean {
  const inv = g.inventory;
  return inv.held?.name === HEAD_NAME || inv.grid.some(e => e.item.name === HEAD_NAME);
}

/** He puts it down: out of the bag (or off the cursor). Whether he had it to put down. */
export function giveUpHead(g: Game): boolean {
  const inv = g.inventory, had = carryingHead(g);
  if (inv.held?.name === HEAD_NAME) inv.held = null;
  inv.grid = inv.grid.filter(e => e.item.name !== HEAD_NAME);
  if (had) inv.changed();
  return had;
}
