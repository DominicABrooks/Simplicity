// Every enemy: knockback and hit flashes, slime AI, deaths and drops, and spawning more.
import { DROPS } from "../data/items.ts";
import { SLIME, SPAWNING } from "../data/enemies.ts";
import { XP } from "../data/progression.ts";
import { damagePlayer, grantXP } from "../game/combat.ts";
import type { Game } from "../game/game.ts";
import { heroParts } from "../game/hero.ts";
import { dropLoot, spawnEnemy, spawnPotion } from "../game/spawn.ts";
import { rollItem } from "../items/items.ts";
import { moveBy, overlap } from "../world/collision.ts";

/** Hit flashes fade, and knockback slides enemies along (they can't be knocked into water). */
export function enemyPhysicsSystem(g: Game, dt: number): void {
  for (const [, { transform: t, knockback: kb, enemy }] of g.world.query("enemy", "transform", "knockback")) {
    enemy.flash = Math.max(0, enemy.flash - dt);
    moveBy(g.map, t, kb.vx * dt, kb.vy * dt, true);
    kb.vx *= Math.pow(SLIME.drag, dt);
    kb.vy *= Math.pow(SLIME.drag, dt);
  }
}

/** Slimes hop: toward the hero when they can see you (and you're not swimming), otherwise anywhere. Touching you hurts. */
export function slimeSystem(g: Game, dt: number): void {
  const { pos: p, motion, status } = heroParts(g);
  for (const [, { transform: s, slime, enemy }] of g.world.query("slime", "transform", "enemy")) {
    if (slime.hop > 0) {
      slime.hop = Math.max(0, slime.hop - dt);
      moveBy(g.map, s, slime.dx * SLIME.hopSpeed * dt, slime.dy * SLIME.hopSpeed * dt, true);
    } else if ((slime.timer -= dt) <= 0) {
      const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy);
      if (d < SLIME.sight && !motion.swimming) { slime.dx = dx / d; slime.dy = dy / d; }
      else { const a = g.rng.next() * Math.PI * 2; slime.dx = Math.cos(a); slime.dy = Math.sin(a); }
      if (slime.dx) enemy.face = Math.sign(slime.dx);
      slime.hop = SLIME.hopTime;
      slime.timer = SLIME.hopEvery + g.rng.next() * SLIME.hopEvery;
    }
    if (status.hurt <= 0 && motion.jump <= 0 && motion.dash <= 0 && overlap(p, s)) damagePlayer(g, s.x, s.y);
  }
}

/** Dead enemies give XP and drops. Mages always drop a magic-or-better item and sometimes a potion; slimes drop one thing at most. */
export function deathSystem(g: Game): void {
  const w = g.world;
  for (const [e, { transform: s, health, enemy }] of w.query("enemy", "transform", "health")) {
    if (health.hp > 0) continue;
    g.kills++;
    grantXP(g, enemy.kind === "mage" ? XP.mage : XP.slime, s.x, s.y);
    if (enemy.kind === "mage") {
      g.fx.push({ type: "burst", x: s.x, y: s.y, palette: "fire" });
      dropLoot(g, s.x, s.y, rollItem(g.rng, "magic"));
      if (g.rng.next() < DROPS.magePotion) spawnPotion(g, s.x + 6, s.y);
    } else {
      g.fx.push({ type: "burst", x: s.x, y: s.y, palette: "slime" });
      const drop = g.rng.next();
      if (drop < DROPS.slimePotion) spawnPotion(g, s.x, s.y);
      else if (drop < DROPS.slimeItem) dropLoot(g, s.x, s.y, rollItem(g.rng));
    }
    w.destroy(e);
  }
}

/** Every few seconds, top the enemies up. The cap grows with kills. */
export function spawnerSystem(g: Game, dt: number): void {
  const cap = Math.min(SPAWNING.maxCap, SPAWNING.baseCap + Math.floor(g.kills / SPAWNING.killsPerCap));
  if ((g.spawnTimer -= dt) > 0) return;
  g.spawnTimer = SPAWNING.every;
  if (g.world.count("enemy") < cap) spawnEnemy(g, 110);
}
