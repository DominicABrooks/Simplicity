// The Greyed's named lieutenants, waiting where the story puts them (a "boss" prop, see src/areas/). Cinder,
// in the Ashwild, is an Ember mage underneath (src/systems/mage.ts runs him; he has a body all his own), only far tougher,
// and hurried along here: his casts, sheep orbs and blinks come back faster. Beat him and he stays beaten
// for the run; he always leaves a fine weapon behind; and the game says so.
import type { Entity } from "../core/ecs.ts";
import { CINDER, CINDER_FALLS } from "../data/ashwild.ts";
import { MAGE_TARGET } from "../data/enemies.ts";
import { XP } from "../data/progression.ts";
import { rollItem } from "../items/items.ts";
import { grantXP } from "./combat.ts";
import { dropLoot } from "./spawn.ts";
import { toast, type Game } from "./game.ts";

type Who = "cinder";

/** Who's been beaten this run (by name), and the boss in the area now, with where they last stood. */
interface Bosses { beaten: Set<Who>; here: { e: Entity; who: Who; x: number; y: number } | null }
const state = new WeakMap<Game, Bosses>();
function bossesOf(g: Game): Bosses {
  let s = state.get(g);
  if (!s) {
    const fresh: Bosses = { beaten: new Set(), here: null };
    state.set(g, s = fresh);
    g.events.on("reset", () => { fresh.beaten.clear(); fresh.here = null; });
  }
  return s;
}

/** Whether the hero has beaten someone this run. */
export const beaten = (g: Game, who: Who): boolean => bossesOf(g).beaten.has(who);

/** Put a boss where the area wants them, unless they're already beaten. Cell top-left, game px. */
export function spawnBoss(g: Game, who: Who, x: number, y: number): Entity | null {
  const s = bossesOf(g);
  if (s.beaten.has(who)) return null;
  const e = g.world.create({
    transform: { x, y },
    knockback: { vx: 0, vy: 0 },
    health: { hp: CINDER.hp, maxHp: CINDER.hp },
    enemy: { kind: "mage", flash: 0, face: 1 },
    mage: {
      school: "ember", timer: 2, casting: false, castT: 0, castK: 0, spell: null, strafe: 1, strafeT: 0, stuckT: 0,
      blinkCD: 1, specialCD: 2, moving: false, melee: false, swing: null, swingCD: 0, swingSide: 0, swingK: 0, swingRel: 0,
    },
    targetable: { ...MAGE_TARGET, name: CINDER.name, hostile: true, radius: CINDER.radius, height: CINDER.height },
    renderable: { kind: "cinder" },                         // his own look: see src/render/models/cinder.ts
  });
  s.here = { e, who, x, y };
  return e;
}

/** Every frame: hurry the boss along; when they fall, they stay beaten, drop a fine weapon, and the game says so. */
export function bossSystem(g: Game, dt: number): void {
  const s = state.get(g), here = s?.here;
  if (!s || !here) return;
  const t = g.world.get(here.e, "transform"), m = g.world.get(here.e, "mage"), hp = g.world.get(here.e, "health");
  if (t && m && hp && hp.hp > 0) {
    here.x = t.x; here.y = t.y;
    const more = dt * (CINDER.hurry - 1);
    m.timer -= more;
    m.specialCD = Math.max(0, m.specialCD - more);
    m.blinkCD = Math.max(0, m.blinkCD - more);
    return;
  }
  // Fallen (leaving the area forgets them first: see leaveBosses), and for good: a fine weapon, more
  // experience than any mage, and the news.
  s.beaten.add(here.who);
  let item = rollItem(g.rng, "rare");
  for (let i = 0; i < 20 && item.slot !== "weapon"; i++) item = rollItem(g.rng, "rare");
  dropLoot(g, here.x, here.y, item);
  grantXP(g, CINDER.xp - XP.mage, here.x, here.y);          // the mage's own share comes with the kill
  CINDER_FALLS.forEach((line, i) => toast(g, line, i === 0));
  s.here = null;
}

/** Leaving an area: forget its boss without counting them beaten. */
export function leaveBosses(g: Game): void {
  const s = state.get(g);
  if (s) s.here = null;
}
