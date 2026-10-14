import type { Game } from "./game.ts";

/** Every component of the hero, for systems that work on the player. */
export function heroParts(g: Game) {
  const w = g.world, e = g.player;
  return {
    e,
    pos: w.need(e, "transform"),
    knockback: w.need(e, "knockback"),
    health: w.need(e, "health"),
    hero: w.need(e, "hero"),
    motion: w.need(e, "motion"),
    status: w.need(e, "status"),
    actions: w.need(e, "actions"),
  };
}

export type HeroParts = ReturnType<typeof heroParts>;

/** The equipped weapon type, if any. */
export const weaponOf = (h: HeroParts) => h.hero.gear?.weaponType ?? null;
