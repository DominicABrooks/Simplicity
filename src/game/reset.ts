import { SPAWNING } from "../data/enemies.ts";
import { STARTER_KIT } from "../data/items.ts";
import { makeItem } from "../items/items.ts";
import { randomGroundSpot } from "../world/collision.ts";
import { makeMap } from "../world/map.ts";
import type { Game } from "./game.ts";
import { createHero, spawnCampfire, spawnEnemy, spawnPotion } from "./spawn.ts";

/** Start a new run: fresh map, hero, enemies and potions, and the starter kit in the bag. */
export function resetGame(g: Game): void {
  g.map = makeMap();
  g.rng.reseed((Date.now() % 100000) + 1);
  g.world.clear();
  g.fx = [];
  g.target = null;
  g.floaters = [];
  g.player = createHero(g);
  spawnCampfire(g);
  // Start naked, with a plain starter set in the bag to put on.
  g.inventory.reset([]);
  for (const [type, name] of STARTER_KIT) g.inventory.add(makeItem(type, "normal", {}, name));
  g.kills = 0; g.clock = 0; g.spawnTimer = 0; g.hitstop = 0; g.shake = 0;
  for (let i = 0; i < SPAWNING.startSlimes; i++) spawnEnemy(g, 80);
  const hero = g.world.need(g.player, "transform");
  for (let i = 0; i < SPAWNING.startPotions; i++) {
    const p = randomGroundSpot(g.map, g.rng, hero, 40);
    if (p) spawnPotion(g, p.x, p.y);
  }
  g.events.emit("reset", { map: g.map });
}

