// The fishing pole: press winds up a cast, release throws it at the cursor. Over water the line
// goes out: wait for a bite, then click during the bite to catch. Released over land, it's a weak bonk.
import { CATCH_ODDS, MYSTERIOUS_STONE, type Rarity } from "../data/items.ts";
import { FISHING } from "../data/player.ts";
import { HALF, Tile } from "../data/world.ts";
import { toast, type Game } from "../game/game.ts";
import { sound } from "../game/sfx.ts";
import { heroParts, weaponOf, type HeroParts } from "../game/hero.ts";
import { dropLoot } from "../game/spawn.ts";
import { makeFish, makeMysteriousStone } from "../items/items.ts";
import { tileAt, type Point } from "../world/collision.ts";

/** Where a cast would land: exactly at the cursor, pulled in to the pole's reach. Without a mouse it goes 3 tiles along the aim. */
export function castTarget(h: HeroParts, pointer: Point | null): Point {
  const { pos, motion } = h;
  const dx = pointer ? pointer.x - pos.x : Math.cos(motion.aim) * FISHING.noMouseReach;
  const dy = pointer ? pointer.y - pos.y : Math.sin(motion.aim) * FISHING.noMouseReach;
  const d = Math.hypot(dx, dy) || 1, k = Math.max(FISHING.castMin, Math.min(FISHING.castMax, d)) / d;
  return { x: pos.x + dx * k, y: pos.y + dy * k };
}

/** A line in the water: cast -> wait for a bite -> click during the bite to catch. Moving reels in. */
export function fishingSystem(g: Game, dt: number): void {
  const h = heroParts(g), { pos, motion: m, actions: a } = h, input = g.input;
  const f = a.fishing;
  if (!f) return;
  if (m.moving || m.dash > 0 || m.jump > 0 || m.swimming || weaponOf(h) !== "rod") { a.fishing = null; return; }
  f.t += dt;
  m.aim = Math.atan2(f.y - pos.y, f.x - pos.x);              // keep facing the bobber
  if (f.phase === "cast" && f.t >= FISHING.castTime) {
    f.phase = "wait"; f.t = 0;
    f.biteAt = FISHING.biteMin + g.rng.next() * FISHING.biteRange;
  } else if (f.phase === "wait") {
    if (input.attackPressed) a.fishing = null;               // reeled in too early
    else if (f.t >= f.biteAt) { f.phase = "bite"; f.t = 0; sound(g, "bite", f); }
  } else if (f.phase === "bite") {
    if (input.attackPressed) {
      const r = g.rng.next();
      const rarity: Rarity = r < CATCH_ODDS.rare ? "rare" : r < CATCH_ODDS.magic ? "magic" : "normal";
      const stone = g.rng.next() < MYSTERIOUS_STONE.chance;   // now and then, something that isn't a fish at all
      const item = stone ? makeMysteriousStone() : makeFish(rarity);
      if (!g.inventory.add(item)) dropLoot(g, pos.x, pos.y, item, true);
      sound(g, "catch");
      a.catchAnim = { x: f.x, y: f.y, t0: g.clock, rarity, stone };
      toast(g, stone ? `Something heavy on the line... a ${item.name}!` : `Caught a ${item.name}!`, true);
      a.fishing = null;
    } else if (f.t >= FISHING.biteWindow) {
      toast(g, "It got away");
      a.fishing = null;
    }
  }
  input.attackPressed = false;                               // clicks belong to the line while fishing
}

/** With the pole equipped (and no line out): press winds up, release casts at the cursor. */
export function rodSystem(g: Game, dt: number): void {
  const h = heroParts(g), { motion: m, actions: a } = h, input = g.input;
  const rod = weaponOf(h) === "rod";
  if (!rod) a.windup = null;
  if (!rod || a.fishing) return;
  if (input.attackPressed && !a.windup && a.cooldown <= 0 && !m.swimming) {
    a.windup = { t: 0, x: 0, y: 0, water: false };
    input.attackPressed = false;
  }
  const w = a.windup;
  if (!w) return;
  w.t += dt;
  const target = castTarget(h, input.pointer);
  w.x = target.x; w.y = target.y;
  w.water = tileAt(g.map, target.x + HALF, target.y + HALF) === Tile.Water;
  if (m.swimming || m.dash > 0 || m.jump > 0) a.windup = null;
  else if (input.attackReleased) {
    if (w.water) {
      a.fishing = { phase: "cast", x: target.x, y: target.y, t: 0, biteAt: 0 };
      a.cooldown = FISHING.castCooldown;
      sound(g, "castLine");
    } else input.attackPressed = true;                       // over land: bonk (the thrust system takes the press)
    a.windup = null;
  }
}
