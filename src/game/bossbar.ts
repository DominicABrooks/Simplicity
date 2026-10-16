// The boss bar: who the hero is up against, when it's a boss, for the HUD to show across the top of the
// screen (src/ui/hud.ts). It shows once he's close enough to be in the fight, or has struck the first blow,
// and goes when they fall or he leaves.
import { GHOST_NAME, GHOST_TITLE } from "../data/ghost.ts";
import type { Entity } from "../core/ecs.ts";
import { LIEUTENANTS, bossHere, bossWho } from "./bosses.ts";
import type { Game } from "./game.ts";
import { ghostOut } from "./ghost.ts";
import { greatKoiOut } from "./greatkoi.ts";
import { calderFight } from "./calderfight.ts";
import { cinderFight } from "./cinderfight.ts";
import { rimeFight } from "./rimefight.ts";
import { victoryOf } from "./victory.ts";
import { GREAT_KOI } from "../data/hollow.ts";

export interface BossBar {
  name: string;
  title: string;
  hp: number;
  maxHp: number;
  /** In their second wind (the Grey Ringer below half health). */
  angry: boolean;
}

/** How close (game px) the hero has to come for the fight to count as on. */
export const BOSS_BAR_NEAR = 110;

/** The boss the hero's fighting, if any. */
export function bossBar(g: Game): BossBar | null {
  const boss = bossHere(g), who = bossWho(g);
  if (boss !== null && who) return engaged(g, boss) ? { name: LIEUTENANTS[who].name, title: LIEUTENANTS[who].title, ...hpOf(g, boss), angry: false } : null;
  const ghost = ghostOut(g), brain = ghost === null ? null : g.world.get(ghost, "ghost");
  if (ghost !== null && brain && !brain.calm && engaged(g, ghost)) return { name: GHOST_NAME, title: GHOST_TITLE, ...hpOf(g, ghost), angry: brain.angry };
  const koi = greatKoiOut(g);
  if (koi !== null && engaged(g, koi)) { const hp = hpOf(g, koi); return { name: GREAT_KOI.name, title: GREAT_KOI.title, ...hp, angry: hp.hp <= hp.maxHp / 2 }; }
  return null;
}

/**
 * Whether a boss fight's on: from the moment its arena shuts (or the Grey Ringer rises, or the Great Koi takes the
 * line) till the victory's been celebrated. The messages across the top keep quiet for it (src/ui/screens.ts).
 */
export function inBossFight(g: Game): boolean {
  if (cinderFight(g) || rimeFight(g) || calderFight(g) || victoryOf(g) || bossBar(g) || greatKoiOut(g) !== null) return true;
  const ghost = ghostOut(g);
  return ghost !== null && !g.world.get(ghost, "ghost")?.calm;
}

const hpOf = (g: Game, e: Entity) => { const h = g.world.need(e, "health"); return { hp: Math.max(0, h.hp), maxHp: h.maxHp }; };

function engaged(g: Game, e: Entity): boolean {
  const health = g.world.get(e, "health"), at = g.world.get(e, "transform"), p = g.world.get(g.player, "transform");
  if (!health || !at || !p || health.hp <= 0) return false;
  return health.hp < health.maxHp || Math.hypot(at.x - p.x, at.y - p.y) < BOSS_BAR_NEAR;
}
