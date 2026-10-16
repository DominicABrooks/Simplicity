// Sleeping in a tent or a bed. Click one close by (or press E with it targeted) and the hero crawls into the
// tent or lies down on the bed, shuts his eyes, and the hours run by fast (SLEEP.hoursPerSecond), a heart back
// for each hour slept. Any key or click wakes him, and so does being hurt; he gets up where he was standing.
import type { Entity } from "../core/ecs.ts";
import { BED_TARGET, SLEEP, TENT_TARGET } from "../data/rest.ts";
import { HALF } from "../data/world.ts";
import { COMBAT_COLORS } from "../data/ui.ts";
import { FACING_ANGLE, type Prop } from "../world/area.ts";
import { combatText } from "./combat.ts";
import { toast, type Game } from "./game.ts";
import { stopResting } from "./resting.ts";

/** A camp's tent: picked at its middle, and slept in lying from its middle to the doorway (south), feet poking out of it. */
export function spawnTent(g: Game, tent: { x: number; y: number; w: number; h: number }): Entity {
  const cx = tent.x + tent.w / 2 - HALF, cy = tent.y + tent.h / 2 - HALF;
  return g.world.create({
    transform: { x: cx, y: cy },
    targetable: { hostile: false, ...TENT_TARGET },
    bed: { x: cx, y: cy, face: FACING_ANGLE.south, ahead: 0.9, lift: 0.3 },
  });
}

/** A bed in a house: its head to the wall at its back, so his feet point the way it faces. */
export function spawnBed(g: Game, p: Extract<Prop, { kind: "furniture" }>): Entity {
  const x = p.x - HALF, y = p.y - HALF;
  return g.world.create({
    transform: { x, y },
    targetable: { hostile: false, ...BED_TARGET },
    bed: { x, y, face: FACING_ANGLE[p.facing], ahead: 0.5, lift: 0.72 },
  });
}

/** The tent or the bed the hero is asleep in, if he is. */
export const sleeping = (g: Game) => g.world.get(g.player, "sleeping") ?? null;

/** Lie down in it, if it's a tent or a bed and close enough (or say it's too far). Returns whether it was one at all. */
export function startSleeping(g: Game, e: Entity | null): boolean {
  const bed = e !== null ? g.world.get(e, "bed") : undefined;
  if (e === null || !bed) return false;
  g.target = e;
  const hero = g.world.need(g.player, "transform"), at = g.world.need(e, "transform");
  if (Math.hypot(hero.x - at.x, hero.y - at.y) > SLEEP.reach) { toast(g, "Too far away to sleep"); return true; }
  if (sleeping(g)) return true;
  stopResting(g);
  const health = g.world.need(g.player, "health");
  g.world.add(g.player, "sleeping", { bed: e, from: { x: hero.x, y: hero.y }, area: g.area.def.id, slept: 0, heal: SLEEP.healEvery, snore: SLEEP.snore / 2, hp: health.hp });
  hero.x = bed.x; hero.y = bed.y;
  const kb = g.world.need(g.player, "knockback");
  kb.vx = kb.vy = 0;
  toast(g, g.world.need(e, "targetable").name === TENT_TARGET.name ? "You crawl into the tent. Any key wakes you" : "You lie down. Any key wakes you", true);
  return true;
}

/** Wake up, and get up where he was standing (unless he's somewhere else by now). */
export function wake(g: Game): void {
  const s = sleeping(g);
  if (!s) return;
  g.world.remove(g.player, "sleeping");
  if (s.area === g.area.def.id) Object.assign(g.world.need(g.player, "transform"), s.from);
  const hours = Math.round(s.slept);
  toast(g, hours >= 1 ? `You wake, ${hours} hour${hours === 1 ? "" : "s"} later` : "You wake", true);
}

/**
 * Every frame, before the hero moves: wake if he was hurt, the bed's gone, or the game's not on; otherwise
 * he lies still whatever's held, the hours run by, and now and then a heart comes back.
 */
export function updateSleeping(g: Game, dt: number): void {
  const s = sleeping(g);
  if (!s) return;
  const health = g.world.need(g.player, "health"), status = g.world.need(g.player, "status");
  if (g.state !== "play" || s.area !== g.area.def.id || !g.world.has(s.bed, "bed") || health.hp < s.hp || status.sheep > 0) { wake(g); return; }
  const input = g.input;
  input.keys.clear();
  input.attackPressed = input.attackReleased = input.jumpPressed = false;
  input.dashRequest = null;
  const hours = dt * SLEEP.hoursPerSecond;
  g.hour = (g.hour + hours) % 24;
  s.slept += hours;
  const p = g.world.need(g.player, "transform");
  if ((s.snore -= dt) <= 0) { s.snore = SLEEP.snore; combatText(g, p.x, p.y, "z", COMBAT_COLORS.glance, false, 1.4); }
  if ((s.heal -= hours) <= 0) {
    s.heal = SLEEP.healEvery;
    if (health.hp < health.maxHp) {
      health.hp += 1;
      combatText(g, p.x, p.y, "+1", COMBAT_COLORS.heal);
    }
  }
  s.hp = health.hp;
}
