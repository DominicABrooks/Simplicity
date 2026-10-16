// Every enemy: knockback and hit flashes, slime AI, deaths and drops, and spawning more.
import { DROPS } from "../data/items.ts";
import { SLIME, SPAWNING } from "../data/enemies.ts";
import { GHOST } from "../data/ghost.ts";
import { XP } from "../data/progression.ts";
import { damagePlayer, grantXP } from "../game/combat.ts";
import { BESTIARY, type BestiaryId } from "../data/bestiary.ts";
import { FEATURES } from "../data/features.ts";
import { bossHere, quietAfterBoss } from "../game/bosses.ts";
import { greatKoiOut, landGreatKoi } from "../game/greatkoi.ts";
import { toast, type Game } from "../game/game.ts";
import { sound } from "../game/sfx.ts";
import { laidToRest } from "../game/ghost.ts";
import { heroParts } from "../game/hero.ts";
import { dropLoot, spawnEnemy, spawnPotion } from "../game/spawn.ts";
import { rollItem } from "../items/items.ts";
import { moveBy, overlap } from "../world/collision.ts";
import { atPeace } from "../game/peace.ts";

/** Hit flashes fade, and knockback slides enemies along (they can't be knocked into water). A dummy stays on its post; blows pass through a ghost. */
export function enemyPhysicsSystem(g: Game, dt: number): void {
  for (const [, { transform: t, knockback: kb, enemy }] of g.world.query("enemy", "transform", "knockback")) {
    enemy.flash = Math.max(0, enemy.flash - dt);
    if (enemy.kind !== "dummy" && enemy.kind !== "ghost") moveBy(g.map, t, kb.vx * dt, kb.vy * dt, true);
    kb.vx *= Math.pow(SLIME.drag, dt);
    kb.vy *= Math.pow(SLIME.drag, dt);
  }
}

/** Slimes hop: toward the hero when they can see you (and you're not swimming), otherwise anywhere. Touching you hurts. */
export function slimeSystem(g: Game, dt: number): void {
  const { pos: p, motion, status } = heroParts(g), calm = atPeace(g);   // once it's all over, they let him be (src/game/peace.ts)
  for (const [, { transform: s, slime, enemy }] of g.world.query("slime", "transform", "enemy")) {
    if (slime.hop > 0) {
      slime.hop = Math.max(0, slime.hop - dt);
      moveBy(g.map, s, slime.dx * SLIME.hopSpeed * dt, slime.dy * SLIME.hopSpeed * dt, true);
    } else if ((slime.timer -= dt) <= 0) {
      const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy);
      if (d < SLIME.sight && !motion.swimming && !calm) { slime.dx = dx / d; slime.dy = dy / d; }
      else { const a = g.rng.next() * Math.PI * 2; slime.dx = Math.cos(a); slime.dy = Math.sin(a); }
      if (slime.dx) enemy.face = Math.sign(slime.dx);
      slime.hop = SLIME.hopTime;
      slime.timer = SLIME.hopEvery + g.rng.next() * SLIME.hopEvery;
    }
    if (!calm && status.hurt <= 0 && motion.jump <= 0 && motion.dash <= 0 && overlap(p, s)) damagePlayer(g, s.x, s.y);
  }
}

/**
 * Dead enemies give XP and drops. Mages always drop a magic-or-better item and sometimes a potion; slimes drop one thing at most.
 * The Grey Ringer leaves her grave goods (rare things) and potions, and is laid to rest.
 */
export function deathSystem(g: Game): void {
  const w = g.world;
  for (const [e, { transform: s, health, enemy }] of w.query("enemy", "transform", "health")) {
    if (enemy.kind === "dummy") { health.hp = health.maxHp; continue; }   // takes every hit, never goes down
    if (health.hp > 0) continue;
    g.kills++;
    if (enemy.kind === "ghost") { layGhost(g, s.x, s.y); w.destroy(e); continue; }
    if (enemy.kind === "koi") { landGreatKoi(g, s.x, s.y); w.destroy(e); continue; }
    recordKill(g, enemy.kind === "mage" ? w.need(e, "mage").school : "slime");
    grantXP(g, enemy.kind === "mage" ? XP.mage : XP.slime, s.x, s.y);
    if (enemy.kind === "mage") {
      g.fx.push({ type: "burst", x: s.x, y: s.y, palette: "fire" });
      sound(g, "mageDie", s);
      dropLoot(g, s.x, s.y, rollItem(g.rng, "magic"));
      if (g.rng.next() < DROPS.magePotion) spawnPotion(g, s.x + 6, s.y);
    } else {
      g.fx.push({ type: "burst", x: s.x, y: s.y, palette: "slime" });
      sound(g, "slimeDie", s);
      const drop = g.rng.next();
      if (drop < DROPS.slimePotion) spawnPotion(g, s.x, s.y);
      else if (drop < DROPS.slimeItem) dropLoot(g, s.x, s.y, rollItem(g.rng));
    }
    w.destroy(e);
  }
}

/** The Grey Ringer beaten: a great burst, her reward, and the rumour laid to rest with her. */
function layGhost(g: Game, x: number, y: number): void {
  recordKill(g, "ghost");
  grantXP(g, XP.ghost, x, y);
  g.fx.push({ type: "toll", x, y, radius: GHOST.toll.radius * 1.5 });
  sound(g, "toll", { x, y });
  g.fx.push({ type: "burst", x, y, palette: "frost" });
  g.shake = Math.max(g.shake, 4);
  for (let i = 0; i < GHOST.reward.items; i++) dropLoot(g, x + (i - (GHOST.reward.items - 1) / 2) * 10, y, rollItem(g.rng, "rare"));
  for (let i = 0; i < GHOST.reward.potions; i++) spawnPotion(g, x + (i - (GHOST.reward.potions - 1) / 2) * 10, y + 9);
  laidToRest(g);
}

/** Every few seconds, top the enemies up. The cap grows with kills. */
export function spawnerSystem(g: Game, dt: number): void {
  if (!g.area.def.life?.enemies) return;                    // only where enemies live
  if (bossHere(g) !== null) return;                          // nothing else turns up while a boss fight's on,
  if (quietAfterBoss(g)) return;                             // nor after it, until he's left and come back,
  if (greatKoiOut(g) !== null) return;                       // nor while the Great Koi's out of the water
  const cap = Math.min(SPAWNING.maxCap, SPAWNING.baseCap + Math.floor(g.kills / SPAWNING.killsPerCap));
  if ((g.spawnTimer -= dt) > 0) return;
  g.spawnTimer = SPAWNING.every;
  if (g.world.count("enemy") - g.world.count("dummy") < cap) spawnEnemy(g, 110);
}

/** Count a kill in the journal; the first of a kind discovers its page. */
function recordKill(g: Game, id: BestiaryId): void {
  const first = g.journal[id] === 0;
  g.journal[id]++;
  if (first && FEATURES.journal) toast(g, `New journal entry: ${BESTIARY.find(b => b.id === id)!.name}`, true);
  g.events.emit("journal", { id, first });
}
