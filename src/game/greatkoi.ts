// The Great Koi (STORY.md: "something big swims under the ice now and then; it's only a very large koi"). Fish through
// the hole in the Frozen Hollow's ice while it's still down there and it's what takes the line: out it bursts through
// the ice, and it's no fish to eat. It flops after the hero across the ice in great leaps, slamming down where it
// lands, and spits fans of freezing water (the numbers are GREAT_KOI, in src/data/hollow.ts). While it's out, nothing
// else comes near, nor after it's landed, until the hero leaves and comes back. Beaten, it stays beaten for the run (and the hole gives golden koi again), and it leaves the
// legendary pole strung with its whisker.
import type { Entity } from "../core/ecs.ts";
import { MAGE } from "../data/enemies.ts";
import { GREAT_KOI as K, WHISKER_NOTE, WHISKER_ROD } from "../data/hollow.ts";
import { makeItem } from "../items/items.ts";
import { moveBy } from "../world/collision.ts";
import { quietHere } from "./bosses.ts";
import { isFrozen } from "./cheats.ts";
import { damagePlayer, grantXP } from "./combat.ts";
import { toast, type Game } from "./game.ts";
import { heroParts } from "./hero.ts";
import { sound } from "./sfx.ts";
import { dropLoot, spawnBolt, spawnPotion } from "./spawn.ts";

const beatenIn = new WeakMap<Game, { beaten: boolean }>();
function stateOf(g: Game): { beaten: boolean } {
  let s = beatenIn.get(g);
  if (!s) {
    const fresh = { beaten: false };
    beatenIn.set(g, s = fresh);
    g.events.on("reset", () => { fresh.beaten = false; });
  }
  return s;
}

/** Has the hero landed the Great Koi this run? */
export const greatKoiBeaten = (g: Game): boolean => stateOf(g).beaten;

/** The Great Koi, out of the water, if it is. */
export const greatKoiOut = (g: Game): Entity | null => g.world.query("koi").at(0)?.[0] ?? null;

/**
 * A bite at the hole in the ice, struck: if the Great Koi's still down there, it's what's on the line, and out it
 * comes (true: there's no fish to land). Otherwise false, and it's an ordinary catch.
 */
export function hookGreatKoi(g: Game, x: number, y: number): boolean {
  if (g.area.def.id !== "hollow" || greatKoiBeaten(g) || greatKoiOut(g) !== null) return false;
  for (const [e, { enemy }] of g.world.query("enemy")) if (enemy.kind !== "dummy") {   // everything else scatters
    const at = g.world.get(e, "transform");
    if (at) g.fx.push({ type: "burst", x: at.x, y: at.y, palette: "arcane" });
    g.world.destroy(e);
  }
  g.world.create({
    transform: { x, y },
    knockback: { vx: 0, vy: 0 },
    health: { hp: K.hp, maxHp: K.hp },
    enemy: { kind: "koi", flash: 0, face: 1 },
    koi: { timer: 1.2, hop: 0, hopTime: K.hop, dx: 0, dy: 0, spit: K.spit.every[0], wind: 0 },
    targetable: { name: K.name, hostile: true, radius: K.radius, height: K.height },
    renderable: { kind: "greatkoi" },
  });
  for (let i = 0; i < 3; i++) g.fx.push({ type: "burst", x: x + (i - 1) * 6, y, palette: "frost" });
  g.shake = Math.max(g.shake, 3);
  sound(g, "thunder", { x, y });
  toast(g, K.say.bite, true);
  toast(g, K.say.out);
  return true;
}

/** Every frame: the Great Koi flops after the hero, slams down where it lands, and spits. */
export function greatKoiSystem(g: Game, dt: number): void {
  const h = heroParts(g), p = h.pos;
  for (const [, { transform: s, koi, enemy, health }] of g.world.query("koi", "transform", "enemy", "health")) {
    if (isFrozen(g) || health.hp <= 0) continue;            // playtesting: held still
    const angry = health.hp <= health.maxHp / 2 ? 1 : 0, dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy) || 1;
    enemy.face = dx >= 0 ? 1 : -1;
    if (koi.hop > 0) {                                       // in the air
      koi.hop = Math.max(0, koi.hop - dt);
      moveBy(g.map, s, koi.dx * K.speed * dt, koi.dy * K.speed * dt, false);
      if (koi.hop === 0) slam(g, s);
      continue;
    }
    // Drawing breath to spit, and then the spit: a fan of freezing water at him.
    if (koi.wind > 0) {
      koi.wind = Math.max(0, koi.wind - dt);
      if (koi.wind > 0) continue;
      const n = K.spit.fan[angry], a0 = Math.atan2(dy, dx), o = MAGE.boltOffset + 4;
      for (let i = 0; i < n; i++) {
        const a = a0 + (i - (n - 1) / 2) * K.spit.spread;
        spawnBolt(g, "frost", s.x + Math.cos(a) * o, s.y + Math.sin(a) * o, Math.cos(a) * 58, Math.sin(a) * 58);
      }
      sound(g, "spell", s);
      koi.spit = K.spit.every[angry];
      koi.timer = Math.max(koi.timer, 0.5);
      continue;
    }
    if ((koi.spit -= dt) <= 0) { koi.wind = K.spit.wind; continue; }
    if ((koi.timer -= dt) <= 0) {                            // a leap at him
      koi.dx = dx / d; koi.dy = dy / d;
      koi.hop = koi.hopTime = K.hop * Math.max(0.3, Math.min(1, d / (K.speed * K.hop)));   // onto him, not past him
      koi.timer = K.every[angry];
      sound(g, "jump", s);
    }
  }
}

/** Down it comes: the ice shakes, and anyone under it is hurt. */
function slam(g: Game, s: { x: number; y: number }): void {
  const h = heroParts(g);
  g.fx.push({ type: "burst", x: s.x, y: s.y, palette: "frost" });
  g.shake = Math.max(g.shake, 1.2);
  sound(g, "hit", s);
  if (h.status.hurt <= 0 && h.motion.dash <= 0 && h.motion.jump <= 0 && Math.hypot(h.pos.x - s.x, h.pos.y - s.y) < K.slam) damagePlayer(g, s.x, s.y, K.damage);
}

/** Landed at last (src/systems/enemies.ts calls this as it falls): the pole in its whiskers, potions, and the news. */
export function landGreatKoi(g: Game, x: number, y: number): void {
  stateOf(g).beaten = true;
  quietHere(g);                                              // like any boss: nothing more turns up till he's left and come back
  grantXP(g, K.xp, x, y);
  const rod = makeItem(...WHISKER_ROD);
  rod.note = WHISKER_NOTE;
  g.world.remove(dropLoot(g, x, y, rod), "despawn");         // one of a kind: it doesn't fade
  for (let i = 0; i < K.potions; i++) spawnPotion(g, x + (i - (K.potions - 1) / 2) * 10, y + 10);
  g.fx.push({ type: "burst", x, y, palette: "frost" });
  g.shake = Math.max(g.shake, 2);
  sound(g, "catch", { x, y });
  toast(g, K.say.landed, true);
}
