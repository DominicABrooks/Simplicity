// The debug handle, on `window.simplicity`: in development for the browser console (simplicity.hero(), ...),
// and in the end-to-end build (`vite build --mode e2e`) for the Playwright specs in e2e/ to read the game
// and set a scene up. Never in the published game: main.ts only calls this behind those two flags.
import type { Game } from "./game/game.ts";
import { hauntingOf } from "./game/ghost.ts";
import { isDoor, whoIsHome } from "./game/townsfolk.ts";
import type { Renderer } from "./render/renderer.ts";

export function exposeDebug(g: Game, view: Renderer): void {
  Object.assign(window, {
    simplicity: {
      game: g, view, world: g.world,
      hero: () => g.world.need(g.player, "transform"),
      critters: () => view.critters(),
      memory: () => view.memory(),
      /** How the churchyard's haunting stands (see src/game/ghost.ts). */
      haunting: () => hauntingOf(g),
      /** The front doors in this area you can knock at, their names, and how many are home behind each. */
      doors: () => g.world.query("targetable", "transform").flatMap(([e, c]) =>
        isDoor(e) ? [{ id: e, name: c.targetable.name, x: c.transform.x, y: c.transform.y, home: whoIsHome(g, e).length }] : []),
    },
  });
}
