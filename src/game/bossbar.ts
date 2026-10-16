// The boss bar: who the hero is up against, when it's a boss, for the HUD to show across the top of the
// screen (src/ui/hud.ts). It shows once he's close enough to be in the fight, or has struck the first blow,
// and goes when they fall or he leaves.
import { GHOST_NAME, GHOST_TITLE } from "../data/ghost.ts";
import type { Entity } from "../core/ecs.ts";
import { LIEUTENANTS, bossHere, bossWho } from "./bosses.ts";
import type { Game } from "./game.ts";
import { ghostOut } from "./ghost.ts";

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
  return null;
}

const hpOf = (g: Game, e: Entity) => { const h = g.world.need(e, "health"); return { hp: Math.max(0, h.hp), maxHp: h.maxHp }; };

function engaged(g: Game, e: Entity): boolean {
  const health = g.world.get(e, "health"), at = g.world.get(e, "transform"), p = g.world.get(g.player, "transform");
  if (!health || !at || !p || health.hp <= 0) return false;
  return health.hp < health.maxHp || Math.hypot(at.x - p.x, at.y - p.y) < BOSS_BAR_NEAR;
}
