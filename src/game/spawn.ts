// Entity factories: every kind of thing in the world, assembled from components.
import type { Entity } from "../core/ecs.ts";
import { MAGE, MAGE_TARGET, MAGE_MIN_KILLS, SLIME_TARGET, SCHOOLS, SCHOOL_ORDER, SLIME, mageCap, mageChance, mageHp, type BoltKind } from "../data/enemies.ts";
import { LOOT_DESPAWN } from "../data/items.ts";
import { BASE_HP } from "../data/player.ts";
import { KING } from "../data/king.ts";
import { GUARD, TRAINING, TRAINING_HP, type TrainingKind } from "../data/npcs.ts";
import { CAMPFIRE_TARGET } from "../data/world.ts";
import type { Item } from "../items/items.ts";
import { randomGroundSpot } from "../world/collision.ts";
import type { Game } from "./game.ts";
import { toast } from "./game.ts";

export function createHero(g: Game): Entity {
  return g.world.create({
    transform: { x: 0, y: 0 },                             // placed when it enters an area
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
  // Where the area says which mages live there (the deep woods), they come from the start, and more of them.
  const mages = g.area.def.life?.mages, schools = mages?.schools ?? SCHOOL_ORDER;
  const cap = mageCap(level) + (mages?.extra ?? 0), chance = mages ? Math.max(0.45, mageChance(level)) : mageChance(level);
  if ((mages || g.kills >= MAGE_MIN_KILLS) && g.world.count("mage") < cap && g.rng.next() < chance) {
    const school = schools[Math.floor(g.rng.next() * schools.length)]!;
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

/** A camp's campfire. It's drawn with the camp scenery; as an entity it can be targeted. */
export function spawnCampfire(g: Game, x: number, y: number): Entity {
  return g.world.create({ transform: { x, y }, targetable: { hostile: false, ...CAMPFIRE_TARGET } });
}

/** A guard at their post, facing `post` (a game angle): a friendly target that keeps watch. */
export function spawnGuard(g: Game, x: number, y: number, post: number, name: string = GUARD.name): Entity {
  return g.world.create({
    transform: { x, y },
    targetable: { hostile: false, name, radius: GUARD.radius, height: GUARD.height },
    sentry: { post, look: post, want: post, next: GUARD.glance[0] * (0.5 + g.rng.next()) },
    renderable: { kind: "guard" },
  });
}

/** The King on his throne, looking out along `post` (a game angle): someone to talk to, who watches you as you come. */
export function spawnKing(g: Game, x: number, y: number, post: number): Entity {
  return g.world.create({
    transform: { x, y },
    targetable: { hostile: false, name: KING.name, radius: KING.radius, height: KING.height },
    sentry: { post, look: post, want: post, next: GUARD.glance[0] * (0.5 + g.rng.next()) },
    renderable: { kind: "king" },
  });
}

export function spawnPotion(g: Game, x: number, y: number): Entity {
  return g.world.create({ transform: { x, y }, pickup: { kind: "potion" }, renderable: { kind: "potion" } });
}

/** A training dummy or an archery butt, facing `facing` (a game angle): hit it all you like, it won't go down. */
export function spawnTraining(g: Game, kind: TrainingKind, x: number, y: number, facing: number): Entity {
  const { name, radius, height } = TRAINING[kind];
  return g.world.create({
    transform: { x, y },
    knockback: { vx: 0, vy: 0 },                             // never moves it: the view rocks it on its stand instead
    health: { hp: TRAINING_HP, maxHp: TRAINING_HP },
    enemy: { kind: "dummy", flash: 0, face: 1 },
    targetable: { hostile: true, name, radius, height },
    dummy: { kind, facing },
    renderable: { kind: "dummy" },
  });
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
