// Entity factories: every kind of thing in the world, assembled from components.
import type { Entity } from "../core/ecs.ts";
import { MAGE, MAGE_TARGET, MAGE_MIN_KILLS, SLIME_TARGET, SCHOOLS, SCHOOL_ORDER, SLIME, mageCap, mageChance, mageHp, type BoltKind } from "../data/enemies.ts";
import { LOOT_DESPAWN } from "../data/items.ts";
import { BASE_HP } from "../data/player.ts";
import { CAMP, CAMPFIRE_TARGET, SPAWN } from "../data/world.ts";
import type { Item } from "../items/items.ts";
import { randomGroundSpot } from "../world/collision.ts";
import type { Game } from "./game.ts";
import { toast } from "./game.ts";

export function createHero(g: Game): Entity {
  return g.world.create({
    transform: { x: SPAWN.x, y: SPAWN.y },
    knockback: { vx: 0, vy: 0 },
    health: { hp: BASE_HP, maxHp: BASE_HP },
    hero: { level: 1, xp: 0, damage: 1, speedMul: 1, dashMul: 1, gear: null },
    motion: { aim: 0, face: 1, moving: false, swimming: false, dash: 0, dashX: 0, dashY: 0, dashCooldown: 0, jump: 0 },
    status: { hurt: 0, sheep: 0, frozen: 0, chill: 0 },
    actions: {
      attack: 0, cooldown: 0, hit: false, swingAim: 0, swingSide: 0, swingK: 0, swingRel: 0,
      swipe: null, draw: null, windup: null, fishing: null, catchAnim: null,
    },
    renderable: { kind: "hero" },
  });
}

/**
 * A new enemy somewhere at least minDist px from the hero: usually a slime, but once you've proven
 * yourself, sometimes a mage (more often, and more at once, as you level).
 */
export function spawnEnemy(g: Game, minDist: number): void {
  const hero = g.world.get(g.player, "transform");
  const p = hero && randomGroundSpot(g.map, g.rng, hero, minDist);
  if (!p) return;
  const level = g.world.get(g.player, "hero")?.level ?? 1;
  if (g.kills >= MAGE_MIN_KILLS && g.world.count("mage") < mageCap(level) && g.rng.next() < mageChance(level)) {
    const school = SCHOOL_ORDER[Math.floor(g.rng.next() * SCHOOL_ORDER.length)]!;
    const hp = mageHp(level);
    g.world.create({
      transform: p,
      knockback: { vx: 0, vy: 0 },
      health: { hp, maxHp: hp },
      enemy: { kind: "mage", flash: 0, face: 1 },
      mage: {
        school, timer: 1.5, casting: false, castT: 0, castK: 0, spell: null, strafe: 1, strafeT: 0, stuckT: 0,
        blinkCD: 2, specialCD: 4, moving: false, melee: false, swing: null, swingCD: 0, swingSide: 0, swingK: 0, swingRel: 0,
      },
      targetable: { name: SCHOOLS[school].name, hostile: true, ...MAGE_TARGET },
      renderable: { kind: "mage" },
    });
    toast(g, `A ${SCHOOLS[school].name} appears!`);
    return;
  }
  g.world.create({
    transform: p,
    knockback: { vx: 0, vy: 0 },
    health: { hp: SLIME.hp, maxHp: SLIME.hp },
    enemy: { kind: "slime", flash: 0, face: 1 },
    slime: { timer: SLIME.firstHop + g.rng.next(), hop: 0, dx: 0, dy: 0 },
    targetable: { hostile: true, ...SLIME_TARGET },
    renderable: { kind: "slime" },
  });
}

/** The camp's campfire. It's drawn with the camp scenery; as an entity it can be targeted. */
export function spawnCampfire(g: Game): Entity {
  return g.world.create({ transform: { x: CAMP.fire.x, y: CAMP.fire.y }, targetable: { hostile: false, ...CAMPFIRE_TARGET } });
}

export function spawnPotion(g: Game, x: number, y: number): Entity {
  return g.world.create({ transform: { x, y }, pickup: { kind: "potion" }, renderable: { kind: "potion" } });
}

/** An item on the ground. `ignore` makes the hero step off it before it can be picked up again. */
export function dropLoot(g: Game, x: number, y: number, item: Item, ignore = false): Entity {
  return g.world.create({
    transform: { x, y },
    pickup: { kind: "loot", item, ignore },
    despawn: { left: LOOT_DESPAWN.after },
    renderable: { kind: "loot" },
  });
}

export function spawnArrow(g: Game, x: number, y: number, vx: number, vy: number, life: number, damage: number, power: boolean, dud = false): Entity {
  return g.world.create({
    transform: { x, y },
    arrow: { vx, vy, life, flight: life, damage, power, dud, stuck: 0, grounded: false, bounced: false },
    renderable: { kind: "arrow" },
  });
}

export function spawnBolt(g: Game, kind: BoltKind, x: number, y: number, vx: number, vy: number): Entity {
  return g.world.create({ transform: { x, y }, bolt: { kind, vx, vy, life: MAGE.boltLife, lost: false }, renderable: { kind: "bolt" } });
}

export function spawnStrike(g: Game, x: number, y: number, delay: number): Entity {
  return g.world.create({ transform: { x, y }, strike: { t: delay, total: delay }, renderable: { kind: "strike" } });
}
