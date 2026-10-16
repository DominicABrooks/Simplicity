// The Ringstone Pendant (src/data/undercroft.ts): a chip of the ring under St Mary's, cool where the old stones are
// warm. Ael's stones are all one stone underneath, and it wants to drink from each of them: worn, every old stone he
// touches (src/game/stones.ts) gives it a little of its warmth, and when it's had all five it burns. Burning, it's the
// key to the little door behind the ring (src/game/undercroft.ts). A new run forgets what it drank.
import { PENDANT, UNDERCROFT, UNDERCROFT_SAYS } from "../data/undercroft.ts";
import type { Touched } from "./stones.ts";
import { toast, type Game } from "./game.ts";
import { sound } from "./sfx.ts";

const drunk = new WeakMap<Game, Set<string>>();
function state(g: Game): Set<string> {
  let s = drunk.get(g);
  if (!s) {
    const fresh = new Set<string>();
    drunk.set(g, s = fresh);
    g.events.on("reset", () => fresh.clear());
  }
  return s;
}

/** Is he wearing it? */
export const wearingPendant = (g: Game): boolean => g.inventory.equip.amulet?.name === UNDERCROFT.reward.name;

/** How many of the old stones it's drunk from, this run. */
export const pendantCharge = (g: Game): number => state(g).size;

/** Has it drunk from them all: is it burning? */
export const pendantCharged = (g: Game): boolean => pendantCharge(g) >= PENDANT.stones;

/** He's at an old stone (just touched, or standing on it again): worn, the pendant drinks from it, if it hasn't yet. Quietly, for trying it out (src/debug.ts). */
export function chargePendant(g: Game, stone: Touched, quiet = false): void {
  const s = state(g), key = `${stone.area}:${stone.entry}`, pendant = g.inventory.equip.amulet;
  if (!wearingPendant(g) || !pendant || s.has(key) || s.size >= PENDANT.stones) return;
  s.add(key);
  pendant.note = PENDANT.note(s.size);
  if (quiet) return;
  sound(g, s.size >= PENDANT.stones ? "toll" : "pickup");
  toast(g, s.size >= PENDANT.stones ? UNDERCROFT_SAYS.charged : UNDERCROFT_SAYS.drinks(stone.name, s.size), true);
}
