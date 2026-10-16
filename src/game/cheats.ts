// Playtesting switches, flipped only from the debug handle (src/debug.ts), which the published game never has.
// God: hits still land (the shove, the number, the flash) but take no hearts. Freeze: the boss here stands
// where he is, casting nothing, so you can walk round him and look.
import type { Game } from "./game.ts";

const god = new WeakSet<Game>(), freeze = new WeakSet<Game>();
const flip = (set: WeakSet<Game>, g: Game, on: boolean): boolean => (on ? set.add(g) : set.delete(g), on);

export const isGod = (g: Game): boolean => god.has(g);
export const setGod = (g: Game, on: boolean): boolean => flip(god, g, on);
export const isFrozen = (g: Game): boolean => freeze.has(g);
export const setFrozen = (g: Game, on: boolean): boolean => flip(freeze, g, on);
