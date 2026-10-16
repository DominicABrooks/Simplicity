import { HOME } from "../areas/index.ts";
import { STARTER_KIT } from "../data/items.ts";
import { makeItem } from "../items/items.ts";
import type { Game } from "./game.ts";
import { createHero } from "./spawn.ts";
import { enterArea } from "./travel.ts";

/** Start a new run: a fresh hero with the starter kit in the bag, back home at the start. */
export function resetGame(g: Game): void {
  g.rng.reseed((Date.now() % 100000) + 1);
  g.world.clear();
  g.player = createHero(g);
  // Start naked, with a plain starter set in the bag to put on.
  g.inventory.reset([]);
  for (const [type, name] of STARTER_KIT) g.inventory.add(makeItem(type, "normal", {}, name));
  g.kills = 0; g.clock = 0; g.runTime = 0; g.hitstop = 0; g.shake = 0;
  enterArea(g, HOME, "start");
  g.events.emit("reset", {});
}
