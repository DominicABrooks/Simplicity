// Resting by a campfire. Click the fire close by (or press E with it targeted) and the hero sits down by it,
// getting a heart back every few seconds until he's whole. He stays sat until he does something else (walks,
// attacks, jumps, dashes) or something hurts him. It lives on the hero (see Resting), so it's gone with the area.
import type { Entity } from "../core/ecs.ts";
import { REST } from "../data/rest.ts";
import { CAMPFIRE_TARGET } from "../data/world.ts";
import { COMBAT_COLORS } from "../data/ui.ts";
import { combatText } from "./combat.ts";
import { toast, type Game } from "./game.ts";

const MOVE_KEYS = ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"];

/** Is this a campfire? */
export const isCampfire = (g: Game, e: Entity | null): e is Entity => e !== null && g.world.get(e, "targetable")?.name === CAMPFIRE_TARGET.name;

/** The fire the hero is resting by, if he is. */
export const resting = (g: Game) => g.world.get(g.player, "resting") ?? null;

/** Sit down by it, if it's a campfire and close enough (or say it's too far). Returns whether it was a campfire at all. */
export function startResting(g: Game, e: Entity | null): boolean {
  if (!isCampfire(g, e)) return false;
  g.target = e;
  const hero = g.world.need(g.player, "transform"), fire = g.world.need(e, "transform");
  if (Math.hypot(hero.x - fire.x, hero.y - fire.y) > REST.reach) { toast(g, "Too far away to rest"); return true; }
  if (resting(g)) return true;
  const health = g.world.need(g.player, "health");
  g.world.add(g.player, "resting", { fire: e, heal: REST.every, hp: health.hp });
  toast(g, health.hp < health.maxHp ? "Resting by the fire" : "Sitting by the fire", true);
  return true;
}

export function stopResting(g: Game): void {
  g.world.remove(g.player, "resting");
}

/**
 * Every frame, before the hero moves: get up if he's doing anything else, was hurt, or the fire's gone;
 * otherwise a heart back now and then.
 */
export function updateResting(g: Game, dt: number): void {
  const r = resting(g);
  if (!r) return;
  const health = g.world.need(g.player, "health"), status = g.world.need(g.player, "status"), input = g.input;
  const busy = MOVE_KEYS.some(k => input.keys.has(k)) || input.attackPressed || input.jumpPressed || input.dashRequest !== null;
  if (g.state !== "play" || !g.world.has(r.fire, "transform") || busy || health.hp < r.hp || status.sheep > 0) { stopResting(g); return; }
  if (health.hp >= health.maxHp) { r.heal = REST.every; r.hp = health.hp; return; }
  if ((r.heal -= dt) <= 0) {
    r.heal = REST.every;
    health.hp = Math.min(health.maxHp, health.hp + 1);
    const p = g.world.need(g.player, "transform");
    combatText(g, p.x, p.y, "+1", COMBAT_COLORS.heal);
    if (health.hp >= health.maxHp) toast(g, "Fully rested", true);
  }
  r.hp = health.hp;
}
