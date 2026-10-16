// The fishing pole: press winds up a cast, release throws it at the cursor. Over water the line
// goes out: wait for a bite, then click during the bite to catch. Released over land, it's a weak bonk.
// Through a hole in the ice (the Frozen Hollow's lake), it's always the big one: a golden koi; or while the Great Koi's
// still under the ice, the Great Koi itself, and that's a fight (src/game/greatkoi.ts). A legendary pole catches better.
import { CATCH_ODDS, CURIO_IDS, LEGENDARY_CATCH_ODDS, type CurioId, type Rarity } from "../data/items.ts";
import { FISHING } from "../data/player.ts";
import { HALF, T, Tile } from "../data/world.ts";
import { toast, type Game } from "../game/game.ts";
import { sound } from "../game/sfx.ts";
import { heroParts, weaponOf, type HeroParts } from "../game/hero.ts";
import { dropLoot } from "../game/spawn.ts";
import { hookGreatKoi } from "../game/greatkoi.ts";
import { curioDue, curioFound, spentCurios } from "../game/curios.ts";
import { makeCurio, makeFish } from "../items/items.ts";
import { tileAt, type Point } from "../world/collision.ts";
import { onFountainPool } from "../world/plans.ts";

/** What water a cast at (x, y) lands in: a pond or river, a fountain's pool up in its basin, a hole in the ice, or none (land). */
export function waterAt(g: Game, x: number, y: number): "open" | "basin" | "hole" | null {
  const cx = x + HALF, cy = y + HALF;
  for (const p of g.area.layout.props) if (p.kind === "fountain" && onFountainPool(p, cx / T, cy / T)) return "basin";
  if (tileAt(g.map, cx, cy) !== Tile.Water) return null;
  return [[T, 0], [-T, 0], [0, T], [0, -T]].some(([dx, dy]) => tileAt(g.map, cx + dx!, cy + dy!) === Tile.Ice) ? "hole" : "open";
}

/** Is the pole in his hands a legendary one (the Great Koi's)? */
const legendaryRod = (g: Game): boolean => g.inventory.equip.weapon?.type === "rod" && g.inventory.equip.weapon.rarity === "legendary";

/** A curiosity still in the water for the hero to find: not one he's carrying, left lying about, or given up (none, once he has them all). */
function curioToFind(g: Game): CurioId | null {
  const spent = spentCurios(g), left = CURIO_IDS.filter(id => !spent.has(id) && !curioFound(g, id));
  return left.length ? left[g.rng.int(0, left.length - 1)]! : null;
}

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
    f.biteAt = (FISHING.biteMin + g.rng.next() * FISHING.biteRange) * (legendaryRod(g) ? LEGENDARY_CATCH_ODDS.bite : 1);
  } else if (f.phase === "wait") {
    if (input.attackPressed) a.fishing = null;               // reeled in too early
    else if (f.t >= f.biteAt) { f.phase = "bite"; f.t = 0; sound(g, "bite", f); }
  } else if (f.phase === "bite") {
    if (input.attackPressed) {
      const r = g.rng.next(), hole = waterAt(g, f.x, f.y) === "hole";
      if (hole && hookGreatKoi(g, f.x, f.y)) {                 // the big one, and it's coming out
        a.fishing = null;
        input.attackPressed = false;
        return;
      }
      const odds = legendaryRod(g) ? LEGENDARY_CATCH_ODDS : CATCH_ODDS;
      const rarity: Rarity = hole || r < odds.rare ? "rare" : r < odds.magic ? "magic" : "normal";
      const curio = !hole && curioDue(g) ? curioToFind(g) : null;        // now and then, something that isn't a fish at all (never through the ice)
      const item = curio ? makeCurio(curio) : makeFish(rarity);
      if (!g.inventory.add(item)) dropLoot(g, pos.x, pos.y, item, true);
      sound(g, "catch");
      a.catchAnim = { x: f.x, y: f.y, t0: g.clock, rarity, curio, basin: f.basin };
      toast(g, curio ? `Something heavy on the line... a ${item.name}!` : `Caught a ${item.name}!`, true);
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
    a.windup = { t: 0, x: 0, y: 0, water: false, basin: false };
    input.attackPressed = false;
  }
  const w = a.windup;
  if (!w) return;
  w.t += dt;
  const target = castTarget(h, input.pointer);
  w.x = target.x; w.y = target.y;
  const water = waterAt(g, target.x, target.y);
  w.water = !!water; w.basin = water === "basin";
  if (m.swimming || m.dash > 0 || m.jump > 0) a.windup = null;
  else if (input.attackReleased) {
    if (w.water) {
      a.fishing = { phase: "cast", x: target.x, y: target.y, t: 0, biteAt: 0, basin: w.basin };
      a.cooldown = FISHING.castCooldown;
      sound(g, "castLine");
    } else input.attackPressed = true;                       // over land: bonk (the thrust system takes the press)
    a.windup = null;
  }
}
