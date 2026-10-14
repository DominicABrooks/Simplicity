// Things the player does through the UI rather than the controls.
import { COMBAT_COLORS } from "../data/ui.ts";
import type { Item } from "../items/items.ts";
import { combatText } from "./combat.ts";
import { toast, type Game } from "./game.ts";
import { dropLoot } from "./spawn.ts";

/** Drop an item at the hero's feet. It waits for them to step off before it can be picked up again. */
export function dropItem(g: Game, item: Item): void {
  const p = g.world.need(g.player, "transform");
  dropLoot(g, p.x, p.y, item, true);
}

/** Eat a fish from the bag. False (and the fish is kept) at full health. */
export function eatItem(g: Game, item: Item): boolean {
  const health = g.world.need(g.player, "health"), p = g.world.need(g.player, "transform");
  if (health.hp >= health.maxHp) {
    toast(g, "Already at full health");
    return false;
  }
  const heal = item.heal ?? 0;
  health.hp = Math.min(health.maxHp, health.hp + heal);
  combatText(g, p.x, p.y, `+${heal}`, COMBAT_COLORS.heal);
  return true;
}
