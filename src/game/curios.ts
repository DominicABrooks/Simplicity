// What becomes of the curiosities fished up (src/data/items.ts CURIOS): each has somewhere it belongs, and
// taking it there spends it. A spent curiosity is gone for the rest of the run: out of the bag, and never on
// the line again. Where each one goes is told in its own place (the bell: src/game/ghost.ts).
import { CURIO_WINDOW, type CurioId } from "../data/items.ts";
import type { Game } from "./game.ts";

/** The curiosities spent this run, per game: a new run (the hero waking again) has them all back in the water. */
const spent = new WeakMap<Game, Set<CurioId>>();
export function spentCurios(g: Game): Set<CurioId> {
  let s = spent.get(g);
  if (!s) {
    const fresh = new Set<CurioId>();
    spent.set(g, s = fresh);
    g.events.on("reset", () => fresh.clear());
  }
  return s;
}

/**
 * Is this catch a curiosity? Catches go in windows, and one in each window (which one is picked as it opens) is: so a
 * curiosity can't keep away for long, however the dice fall. A run's first window is CURIO_WINDOW.first catches long,
 * so the first comes up soon; every one after, CURIO_WINDOW.after. A new run starts afresh.
 */
const windows = new WeakMap<Game, { n: number; at: number; size: number }>();
export function curioDue(g: Game): boolean {
  let w = windows.get(g);
  if (!w) {
    const fresh = { n: 0, at: 0, size: CURIO_WINDOW.first as number };
    windows.set(g, w = fresh);
    g.events.on("reset", () => { fresh.n = 0; fresh.size = CURIO_WINDOW.first; });
  }
  if (w.n === 0) w.at = g.rng.int(0, w.size - 1);
  const due = w.n === w.at;
  if (++w.n === w.size) { w.n = 0; w.size = CURIO_WINDOW.after; }
  return due;
}

/** Is the hero carrying this curiosity: in the bag, or in hand (on the cursor)? */
export const carryingCurio = (g: Game, id: CurioId): boolean =>
  g.inventory.grid.some(e => e.item.curio === id) || g.inventory.held?.curio === id;

/** Is it out of the water already: carried, or lying on the ground here (dropped, or caught with the bag full)? */
export const curioFound = (g: Game, id: CurioId): boolean =>
  carryingCurio(g, id) || g.world.query("pickup").some(([, c]) => c.pickup.kind === "loot" && c.pickup.item.curio === id);

/** Hand it over: out of the bag (or hand), and spent for good this run. */
export function spendCurio(g: Game, id: CurioId): void {
  spentCurios(g).add(id);
  const inv = g.inventory, before = inv.grid.length;
  inv.grid = inv.grid.filter(e => e.item.curio !== id);
  const held = inv.held?.curio === id;
  if (held) inv.held = null;
  if (held || inv.grid.length !== before) inv.changed();
}
