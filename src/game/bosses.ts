// The Greyed's named lieutenants, waiting where the story puts them (a "boss" prop, see src/areas/), and
// summoned only when their fight starts (Cinder's: src/game/cinderfight.ts; Rime's: src/game/rimefight.ts). Each is
// a mage underneath (src/systems/mage.ts runs them; each has a body all their own), only far tougher, and hurried
// along here: their casts, specials and blinks come back faster. Cinder, in the Ashwild, is an Ember mage; Rime, out
// on the Frozen Hollow's lake, a Frost mage with wider novas and faster bolts. Beat one and they stay beaten for the
// run; each always leaves something fine behind (Cinder a weapon, Rime her circlet); and the game says so.
import type { Entity } from "../core/ecs.ts";
import type { Rng } from "../core/rng.ts";
import { CINDER, CINDER_FALLS, CINDER_LAST_WORDS } from "../data/ashwild.ts";
import { MAGE_TARGET, type School } from "../data/enemies.ts";
import { RIME, RIME_CIRCLET, RIME_FALLS, RIME_LAST_WORDS } from "../data/hollow.ts";
import { XP } from "../data/progression.ts";
import { makeItem, rollItem, type Item } from "../items/items.ts";
import { isFrozen } from "./cheats.ts";
import { grantXP } from "./combat.ts";
import type { MageBrain, RenderKind } from "./components.ts";
import { dropLoot } from "./spawn.ts";
import { toast, type Game } from "./game.ts";

export type Who = "cinder" | "rime";

/** Each lieutenant: their numbers, their school, their look, what they leave, and what they say as they fall. */
interface Lieutenant {
  name: string; title: string; hp: number; radius: number; height: number; hurry: number; xp: number;
  school: School; look: RenderKind; boost?: MageBrain["boost"]; palette: "fire" | "frost";
  /** Won't fall to the first blow that would finish them (see Enemy.lastStand). */
  lastStand?: boolean;
  drop(rng: Rng): Item;
  falls: readonly string[]; lastWords: readonly string[];
}
export const LIEUTENANTS: Record<Who, Lieutenant> = {
  cinder: {
    ...CINDER, school: "ember", look: "cinder", palette: "fire", falls: CINDER_FALLS, lastWords: CINDER_LAST_WORDS,
    drop(rng) {                                              // always a weapon
      let item = rollItem(rng, "rare");
      for (let i = 0; i < 20 && item.slot !== "weapon"; i++) item = rollItem(rng, "rare");
      return item;
    },
  },
  rime: {
    ...RIME, school: "frost", look: "rime", palette: "frost", boost: { nova: RIME.nova, bolt: RIME.bolt }, lastStand: true, falls: RIME_FALLS, lastWords: RIME_LAST_WORDS,
    drop: () => makeItem(...RIME_CIRCLET),
  },
};

/**
 * Who's been beaten this run (by name); the boss whose lair this area is, waiting to be summoned (no one's
 * there until the fight starts: see summonBoss); and the boss out in the area now, with where they last stood.
 */
interface Bosses {
  beaten: Set<Who>;
  fell: Map<Who, { x: number; y: number }>;
  /** The visit to an area in which a boss fell there (each arrival is a new one): nothing turns up again until he's left and come back. */
  quietIn: Game["area"] | null;
  lair: { who: Who; x: number; y: number } | null;
  here: { e: Entity; who: Who; x: number; y: number } | null;
}
const state = new WeakMap<Game, Bosses>();
function bossesOf(g: Game): Bosses {
  let s = state.get(g);
  if (!s) {
    const fresh: Bosses = { beaten: new Set(), fell: new Map(), quietIn: null, lair: null, here: null };
    state.set(g, s = fresh);
    g.events.on("reset", () => { fresh.beaten.clear(); fresh.fell.clear(); fresh.lair = fresh.here = fresh.quietIn = null; });
  }
  return s;
}

/** The boss in this area, if there's one still standing. */
export const bossHere = (g: Game): Entity | null => state.get(g)?.here?.e ?? null;

/** Is it quiet here: a boss fell on this visit? Then nothing turns up until the hero leaves and comes back. */
export const quietAfterBoss = (g: Game): boolean => state.get(g)?.quietIn === g.area;

/** A boss fell here (one that isn't a lieutenant: the Great Koi): quiet until the hero leaves and comes back. */
export function quietHere(g: Game): void {
  bossesOf(g).quietIn = g.area;
}

/** Who the boss in this area is, if there's one still standing. */
export const bossWho = (g: Game): Who | null => state.get(g)?.here?.who ?? null;

/** Where someone fell this run (cell top-left), if they have: Rime's thaw rings out from there. */
export const fellAt = (g: Game, who: Who): { x: number; y: number } | null => state.get(g)?.fell.get(who) ?? null;

/** Whether the hero has beaten someone this run. */
export const beaten = (g: Game, who: Who): boolean => bossesOf(g).beaten.has(who);

/**
 * This area's a boss's lair: they'll be summoned at (x, y) (cell top-left, game px) when the fight starts,
 * unless they're already beaten. Not before: nobody can pick at them from outside their arena.
 */
export function awaitBoss(g: Game, who: Who, x: number, y: number): void {
  const s = bossesOf(g);
  s.lair = s.beaten.has(who) ? null : { who, x, y };
}

/** The boss waiting in this area's lair to be summoned, if there's one. */
export const bossWaiting = (g: Game): Who | null => state.get(g)?.lair?.who ?? null;

/** The fight starts: out comes the boss waiting here, where their lair puts them. */
export function summonBoss(g: Game): Entity | null {
  const s = bossesOf(g), lair = s.lair;
  if (!lair) return null;
  const { who, x, y } = lair, L = LIEUTENANTS[who];
  s.lair = null;
  const e = g.world.create({
    transform: { x, y },
    knockback: { vx: 0, vy: 0 },
    health: { hp: L.hp, maxHp: L.hp },
    enemy: { kind: "mage", flash: 0, face: 1, ...(L.lastStand ? { lastStand: "ready" as const } : {}) },
    mage: {
      school: L.school, timer: 2, casting: false, castT: 0, castK: 0, spell: null, strafe: 1, strafeT: 0, stuckT: 0,
      blinkCD: 1, specialCD: 2, moving: false, melee: false, swing: null, swingCD: 0, swingSide: 0, swingK: 0, swingRel: 0,
      ...(L.boost ? { boost: L.boost } : {}),
    },
    targetable: { ...MAGE_TARGET, name: L.name, hostile: true, radius: L.radius, height: L.height },
    renderable: { kind: L.look },                           // their own look: see src/render/models/
  });
  s.here = { e, who, x, y };
  clearTheField(g, e);
  g.fx.push({ type: "burst", x, y, palette: L.palette });
  return e;
}

/** A boss fight's just them and the hero: the slimes and mages about scatter (and none come while it's on: see spawnerSystem). */
function clearTheField(g: Game, boss: Entity): void {
  for (const [e, { transform }] of g.world.query("enemy", "transform")) {
    if (e === boss || g.world.has(e, "dummy")) continue;
    g.fx.push({ type: "burst", x: transform.x, y: transform.y, palette: "arcane" });
    g.world.destroy(e);
  }
}

/** Every frame: hurry the boss along; when they fall, they stay beaten, drop a fine weapon, and the game says so. */
export function bossSystem(g: Game, dt: number): void {
  const s = state.get(g), here = s?.here;
  if (!s || !here) return;
  const t = g.world.get(here.e, "transform"), m = g.world.get(here.e, "mage"), hp = g.world.get(here.e, "health");
  if (t && m && hp && hp.hp > 0) {
    if (isFrozen(g)) {                                       // playtesting: held still where he stands, casting nothing
      t.x = here.x; t.y = here.y;
      Object.assign(m, { casting: false, castK: 0, spell: null, moving: false, melee: false, swing: null });
      m.timer = m.blinkCD = m.specialCD = m.swingCD = 1;
      return;
    }
    here.x = t.x; here.y = t.y;
    const more = dt * (LIEUTENANTS[here.who].hurry - 1);
    m.timer -= more;
    m.specialCD = Math.max(0, m.specialCD - more);
    m.blinkCD = Math.max(0, m.blinkCD - more);
    return;
  }
  // Fallen (leaving the area forgets them first: see leaveBosses), and for good: something fine, more
  // experience than any mage, their last words, and the news.
  const L = LIEUTENANTS[here.who];
  s.beaten.add(here.who);
  s.fell.set(here.who, { x: here.x, y: here.y });
  s.quietIn = g.area;
  dropLoot(g, here.x, here.y, L.drop(g.rng));
  grantXP(g, L.xp - XP.mage, here.x, here.y);               // the mage's own share comes with the kill
  L.falls.forEach(line => toast(g, line));
  g.world.add(g.player, "conversation", { with: g.player, name: L.name, key: here.who, lines: [...L.lastWords], line: 0, t: 0 });
  s.here = null;
}

/** Leaving an area: forget its boss (and its lair) without counting them beaten. */
export function leaveBosses(g: Game): void {
  const s = state.get(g);
  if (s) s.lair = s.here = null;
}
