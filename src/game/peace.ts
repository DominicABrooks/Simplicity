// After the end (HERO.md, "The end"): once Calder's head is at the King's feet, the Greyed have no one left to follow
// and stop coming (src/game/spawn.ts), and the slimes stop bouncing at anyone (src/systems/enemies.ts): they're still
// about the woods, hopping where they please, but they don't chase him or hurt him; nor he them: they're the people of
// the Deep Hall to be, not anything to fight, so they can't be targeted or hit and give nothing for it. For the rest of
// the run; a new run starts the story, and its trouble, afresh.
import type { Entity } from "../core/ecs.ts";
import type { Game } from "./game.ts";

const peace = new WeakMap<Game, { on: boolean }>();
function stateOf(g: Game): { on: boolean } {
  let s = peace.get(g);
  if (!s) {
    const fresh = { on: false };
    peace.set(g, s = fresh);
    g.events.on("reset", () => { fresh.on = false; });
  }
  return s;
}

/** Is the valley at peace: the head laid at the King's feet this run? */
export const atPeace = (g: Game): boolean => peace.get(g)?.on ?? false;

/** Is this one to be let be: a slime, once there's peace? (Blows, shots and the target ring pass it by.) */
export const spared = (g: Game, e: Entity): boolean => atPeace(g) && g.world.get(e, "enemy")?.kind === "slime";

/** The head's at the King's feet: from now on, peace (src/game/ending.ts). */
export function makePeace(g: Game): void { stateOf(g).on = true; }
