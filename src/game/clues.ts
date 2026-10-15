// Townsfolk noticing a curiosity the hero's carrying, now and then, and passing on a clue about it (src/data/clues.ts).
import { CLUE_CHANCE, CLUES } from "../data/clues.ts";
import type { CurioId } from "../data/items.ts";
import type { Game } from "./game.ts";

/** The curiosities in the hero's bag. */
export const curiosCarried = (g: Game): CurioId[] => g.inventory.grid.flatMap(e => (e.item.curio ? [e.item.curio] : []));

/** A clue someone might pass on about one of them, this time (one time in CLUE_CHANCE); none if he carries none. */
export function curioClue(g: Game): string | null {
  const carried = curiosCarried(g);
  if (!carried.length || g.rng.next() >= CLUE_CHANCE) return null;
  const lines = CLUES[carried[g.rng.int(0, carried.length - 1)]!];
  return lines[g.rng.int(0, lines.length - 1)]!;
}
