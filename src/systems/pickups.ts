// Walk over potions to drink them (when hurt) and over loot to pick it up.
import { DROPS } from "../data/items.ts";
import { COMBAT_COLORS } from "../data/ui.ts";
import { combatText } from "../game/combat.ts";
import { toast, type Game } from "../game/game.ts";
import { heroParts } from "../game/hero.ts";
import { sound } from "../game/sfx.ts";
import { overlap } from "../world/collision.ts";

/** Count down despawn timers and remove whatever has run out. */
export function despawnSystem(g: Game, dt: number): void {
  for (const [e, { despawn }] of g.world.query("despawn")) {
    despawn.left -= dt;
    if (despawn.left <= 0) g.world.destroy(e);
  }
}

export function pickupSystem(g: Game): void {
  const { pos, health } = heroParts(g), w = g.world;
  for (const [e, { transform: t, pickup }] of w.query("pickup", "transform")) {
    if (pickup.kind === "potion") {
      if (!overlap(pos, t) || health.hp >= health.maxHp) continue;
      const healed = Math.min(DROPS.potionHeal, health.maxHp - health.hp);
      health.hp += healed;
      w.destroy(e);
      combatText(g, pos.x, pos.y, `+${healed}`, COMBAT_COLORS.heal);
      sound(g, "drink");
      continue;
    }
    // Dropped items wait until you step off them.
    if (!overlap(pos, t)) { pickup.ignore = false; continue; }
    if (pickup.ignore) continue;
    if (g.inventory.add(pickup.item)) { w.destroy(e); sound(g, "pickup"); }
    else { pickup.ignore = true; toast(g, "Inventory full"); }
  }
}
