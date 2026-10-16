// The seal-keepers' chamber behind the Undercroft's little door (src/areas/sealchamber.ts): the first time in, a word
// on where he is; the first time up by the nest, what it was, and what's left folded beside it (once a run).
import { NEST } from "../areas/sealchamber.ts";
import { CHAMBER, CHAMBER_SAYS } from "../data/undercroft.ts";
import { HALF, T } from "../data/world.ts";
import { makeItem } from "../items/items.ts";
import { toast, type Game } from "./game.ts";
import { dropLoot } from "./spawn.ts";

/** This run, per game: been in, read the nest, been given the wrap. */
interface Run { arrived: boolean; read: boolean }
const runs = new WeakMap<Game, Run>();
function runOf(g: Game): Run {
  let r = runs.get(g);
  if (!r) {
    const fresh = { arrived: false, read: false };
    runs.set(g, r = fresh);
    g.events.on("reset", () => { fresh.arrived = fresh.read = false; });
  }
  return r;
}

/** Where the nest is (game px, an entity's top-left). */
export const nestAt = (): { x: number; y: number } => ({ x: NEST.x * T - HALF, y: NEST.y * T - HALF });

/** Every frame, in the chamber. */
export function sealChamberSystem(g: Game): void {
  if (g.area.def.id !== "sealchamber") return;
  const run = runOf(g);
  if (!run.arrived) { run.arrived = true; toast(g, CHAMBER_SAYS.arrive, true); }
  const p = g.world.need(g.player, "transform"), nest = nestAt();
  if (run.read || Math.hypot(p.x - nest.x, p.y - nest.y) > CHAMBER.near) return;
  run.read = true;
  for (const line of CHAMBER_SAYS.nest) toast(g, line, true);
  const w = CHAMBER.gift;
  const wrap = dropLoot(g, nest.x + 1.7 * T, nest.y + 0.4 * T, { ...makeItem(w.type, w.rarity, { ...w.mods }, w.name), note: w.note });
  g.world.remove(wrap, "despawn");                           // it'll wait for him, if his bag's full
  toast(g, CHAMBER_SAYS.gift, true);
}
