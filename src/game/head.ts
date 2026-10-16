// Calder's head (src/data/rift.ts, CALDERS_HEAD): all that's left whole of him when he falls, a round grey stone with the
// dark gone out of its face, for carrying home to the King (src/game/ending.ts). It's an ordinary item in the bag,
// known by its name. There's only the one and Calder can't be fought again, so it never fades on the ground, and if
// he leaves it lying somewhere (where Calder dropped it, say) it's still there when he comes back. Once he's picked it
// up he won't let go of it: dropped, it goes straight back in the bag, till it's at the King's feet.
import { CALDERS_HEAD, HEAD_KEPT } from "../data/rift.ts";
import type { Entity } from "../core/ecs.ts";
import type { Item } from "../items/items.ts";
import { toast, type Game } from "./game.ts";
import { dropLoot } from "./spawn.ts";

export const HEAD_NAME = CALDERS_HEAD[3];

/** Where he left it lying, while he's somewhere else (the area's id, cell top-left). */
interface Lying { area: string; x: number; y: number; item: Item }
const lying = new WeakMap<Game, { at: Lying | null }>();
function state(g: Game): { at: Lying | null } {
  let s = lying.get(g);
  if (!s) {
    const fresh = { at: null as Lying | null };
    lying.set(g, s = fresh);
    g.events.on("reset", () => {                             // a new run: none of it happened (and arriving home may have laid it)
      fresh.at = null;
      for (const [e] of lyingHere(g)) g.world.destroy(e);
    });
  }
  return s;
}

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
  state(g).at = null;                                        // it's the King's now, wherever it was
  if (had) inv.changed();
  return had;
}

/**
 * Something he's let go of (out of the bag, or off the cursor): if it's the head, back in the bag it goes instead, and
 * true. If the bag's full, whatever else is in it goes on the ground at his feet to make room.
 */
export function holdOntoHead(g: Game, item: Item, drop: (item: Item) => void): boolean {
  if (item.name !== HEAD_NAME) return false;
  const inv = g.inventory;
  while (!inv.add(item)) {
    const other = inv.grid.find(e => e.item.name !== HEAD_NAME);
    if (!other) return true;                                 // a bag that can't hold even the head: never so
    inv.grid = inv.grid.filter(e => e !== other);
    drop(other.item);
  }
  toast(g, HEAD_KEPT);
  return true;
}

/** Something on the ground: if it's the head, it doesn't fade. */
export function keepIfHead(g: Game, e: Entity, item: Item): void {
  if (item.name === HEAD_NAME) g.world.remove(e, "despawn");
}

/** Leaving an area (before it's cleared): if the head's lying here, remember where. */
export function leaveHead(g: Game): void {
  for (const [e, item] of lyingHere(g)) {
    const { x, y } = g.world.need(e, "transform");
    state(g).at = { area: g.area.def.id, x, y, item };
  }
}

/** The head on the ground here, if it is (as a list: none or the one). */
function lyingHere(g: Game): [Entity, Item][] {
  const found: [Entity, Item][] = [];
  for (const [e, { pickup }] of g.world.query("pickup")) if (pickup.kind === "loot" && pickup.item.name === HEAD_NAME) found.push([e, pickup.item]);
  return found;
}

/** Arriving in an area: if he left the head lying here, it's where he left it. */
export function layHead(g: Game): void {
  const s = state(g), at = s.at;
  if (!at || at.area !== g.area.def.id) return;
  s.at = null;                                               // on the ground again: leaving remembers it afresh
  keepIfHead(g, dropLoot(g, at.x, at.y, at.item), at.item);
}
