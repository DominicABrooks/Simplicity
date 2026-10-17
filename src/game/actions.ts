// Things the player does through the UI rather than the controls.
import { COMBAT_COLORS } from "../data/ui.ts";
import type { Item } from "../items/items.ts";
import { combatText } from "./combat.ts";
import type { Game } from "./game.ts";
import { holdOntoHead, keepIfHead } from "./head.ts";
import { dropLoot } from "./spawn.ts";

/** Drop an item at the hero's feet. It waits for them to step off before it can be picked up again. Not Calder's head: he keeps hold of that. */
export function dropItem(g: Game, item: Item): void {
  if (holdOntoHead(g, item, other => dropItem(g, other))) return;
  const p = g.world.need(g.player, "transform");
  keepIfHead(g, dropLoot(g, p.x, p.y, item, true), item);   // there's only the one
}

/** Eat a fish from the bag: it heals what it can, and can be eaten at full health too. */
export function eatItem(g: Game, item: Item): boolean {
  const health = g.world.need(g.player, "health"), p = g.world.need(g.player, "transform");
  const heal = Math.min(item.heal ?? 0, Math.max(0, health.maxHp - health.hp));
  health.hp += heal;
  combatText(g, p.x, p.y, heal > 0 ? `+${heal}` : "Tasty", COMBAT_COLORS.heal);
  return true;
}
