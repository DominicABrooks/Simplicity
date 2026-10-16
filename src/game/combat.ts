// Shared combat rules: dealing and taking damage, status effects, combat text and experience.
import type { Entity } from "../core/ecs.ts";
import { STAGGER } from "../data/enemies.ts";
import { CRIT, HURT } from "../data/player.ts";
import { XP, xpToNext } from "../data/progression.ts";
import { COMBAT_COLORS } from "../data/ui.ts";
import { SPELLS } from "../data/enemies.ts";
import { isGod } from "./cheats.ts";
import type { Actions } from "./components.ts";
import { setState, toast, type Game } from "./game.ts";
import { sound } from "./sfx.ts";

/** Floating combat text at a game position. */
export function combatText(g: Game, x: number, y: number, text: string, color: string, crit = false, life = crit ? 1.1 : 0.85): void {
  g.floaters.push({ x, y, text, color, crit, life, t: 1, jx: Math.round((Math.random() - 0.5) * 10) });
}

/** Hit an enemy: 10% crits for double damage, with a flash, a number, and extra weight on crits. */
export function hitEnemy(g: Game, e: Entity, damage: number): number {
  const health = g.world.need(e, "health"), enemy = g.world.need(e, "enemy"), at = g.world.need(e, "transform");
  const crit = g.rng.next() < CRIT.chance;
  const dealt = crit ? damage * CRIT.multiplier : damage;
  health.hp -= dealt;
  enemy.flash = crit ? 0.22 : 0.15;
  sound(g, crit ? "crit" : "hit", at);
  combatText(g, at.x, at.y, crit ? `${dealt}!` : `${dealt}`, crit ? COMBAT_COLORS.crit : COMBAT_COLORS.hit, crit);
  if (crit) {
    g.hitstop = Math.max(g.hitstop, CRIT.hitstop);
    g.shake = Math.max(g.shake, CRIT.shake);
    g.fx.push({ type: "burst", x: at.x, y: at.y, palette: "spark" });
  }
  return dealt;
}

/** Knock a hit enemy along (nx, ny), make it hold still for a moment, and spark where it was hit. */
export function stagger(g: Game, e: Entity, nx: number, ny: number, knock: number): void {
  const kb = g.world.need(e, "knockback"), at = g.world.need(e, "transform");
  kb.vx = nx * knock;
  kb.vy = ny * knock;
  const brain = g.world.get(e, "slime") ?? g.world.get(e, "mage");
  if (brain) brain.timer = STAGGER;
  g.fx.push({ type: "hit", x: at.x, y: at.y });
}

/** Drop whatever the hero was doing: fishing, aiming, drawing, swinging. */
export function cancelActions(a: Actions): void {
  a.fishing = null;
  a.windup = null;
  a.draw = null;
  a.swipe = null;
  a.attack = 0;
}

/** Hearts of damage (one, unless said) from something at (sx, sy): knock back, cancel what you were doing. */
export function damagePlayer(g: Game, sx: number, sy: number, amount = 1): void {
  const w = g.world, e = g.player;
  const p = w.need(e, "transform"), kb = w.need(e, "knockback"), health = w.need(e, "health"), status = w.need(e, "status");
  status.sheep = 0;                                          // any damage breaks a polymorph
  if (!isGod(g)) health.hp -= amount;                       // (a playtesting switch: see cheats.ts)
  status.hurt = HURT.invulnerable;
  cancelActions(w.need(e, "actions"));
  combatText(g, p.x, p.y, `-${amount}`, COMBAT_COLORS.taken);
  g.shake = Math.max(g.shake, HURT.shake);
  const d = Math.hypot(p.x - sx, p.y - sy) || 1;
  kb.vx = ((p.x - sx) / d) * HURT.knock;
  kb.vy = ((p.y - sy) / d) * HURT.knock;
  sound(g, health.hp <= 0 ? "death" : "hurt");
  if (health.hp <= 0) setState(g, "dead");
}

/** Polymorph: a sheep for a few seconds. Sheep can only walk; any damage breaks it early. */
export function polymorph(g: Game): void {
  g.world.need(g.player, "status").sheep = SPELLS.poly.sheep!;
  cancelActions(g.world.need(g.player, "actions"));
  toast(g, "Polymorphed!");
}

/** Experience from a kill at (x, y). Each level needs a bit more, grants raw stats and fully heals. */
export function grantXP(g: Game, amount: number, x: number, y: number): void {
  const w = g.world, e = g.player;
  const hero = w.need(e, "hero"), health = w.need(e, "health"), p = w.need(e, "transform");
  if (hero.level >= XP.maxLevel) return;
  hero.xp += amount;
  combatText(g, x, y, `+${amount} XP`, COMBAT_COLORS.xp, false, 1.3);
  while (hero.level < XP.maxLevel && hero.xp >= xpToNext(hero.level)) {
    hero.xp -= xpToNext(hero.level);
    hero.level++;
    g.inventory.changed();                                  // new raw stats flow into damage, life and speed
    if (health.hp < health.maxHp) combatText(g, p.x, p.y, `+${health.maxHp - health.hp}`, COMBAT_COLORS.heal);
    health.hp = health.maxHp;                               // a level-up fully heals, as in WoW
    g.fx.push({ type: "levelUp", x: p.x, y: p.y });
    sound(g, "levelUp");
    toast(g, `Level ${hero.level}!`, true);
  }
  if (hero.level >= XP.maxLevel) hero.xp = 0;
}
