// The debug handle, on `window.simplicity`: in development for the browser console (simplicity.hero(), ...),
// and in the end-to-end build (`vite build --mode e2e`) for the Playwright specs in e2e/ to read the game
// and set a scene up. Never in the published game: main.ts only calls this behind those two flags.
import { loadArea } from "./areas/index.ts";
import { HALF, T } from "./data/world.ts";
import { LAIRS, type Who } from "./game/bosses.ts";
import { isFrozen, isGod, setFrozen, setGod } from "./game/cheats.ts";
import { setState, type Game } from "./game/game.ts";
import { hauntingOf } from "./game/ghost.ts";
import { isDoor, whoIsHome } from "./game/townsfolk.ts";
import { resetGame } from "./game/reset.ts";
import { enterArea } from "./game/travel.ts";
import type { Renderer } from "./render/renderer.ts";

export function exposeDebug(g: Game, view: Renderer): void {
  /** A fresh run, straight into a boss's lair, standing a few steps south of them. */
  async function boss(who: Who = "cinder"): Promise<string> {
    const lair = LAIRS[who];
    if (!lair) return `No boss "${who}". Try: ${Object.keys(LAIRS).join(", ")}`;
    const def = await loadArea(lair.area);
    resetGame(g);
    setState(g, "play");
    enterArea(g, def, lair.entry);
    const at = g.area.layout.props.find(p => p.kind === "boss" && p.who === who);
    if (at && at.kind === "boss") Object.assign(g.world.need(g.player, "transform"), { x: at.x - HALF, y: at.y - HALF + 5 * T });
    return `${who}: god ${isGod(g) ? "on" : "off"}, freeze ${isFrozen(g) ? "on" : "off"}`;
  }
  Object.assign(window, {
    simplicity: {
      game: g, view, world: g.world,
      hero: () => g.world.need(g.player, "transform"),
      critters: () => view.critters(),
      memory: () => view.memory(),
      /** How the churchyard's haunting stands (see src/game/ghost.ts). */
      haunting: () => hauntingOf(g),
      /** Playtesting the bosses: boss("cinder") starts a fresh run in their lair (or load the page with ?boss=cinder,
       *  adding &god and/or &freeze); god() and freeze() flip the switches in src/game/cheats.ts, or set them with true/false. */
      boss,
      god: (on = !isGod(g)) => `god ${setGod(g, on) ? "on" : "off"}`,
      freeze: (on = !isFrozen(g)) => `freeze ${setFrozen(g, on) ? "on" : "off"}`,
      /** The front doors in this area you can knock at, their names, and how many are home behind each. */
      doors: () => g.world.query("targetable", "transform").flatMap(([e, c]) =>
        isDoor(e) ? [{ id: e, name: c.targetable.name, x: c.transform.x, y: c.transform.y, home: whoIsHome(g, e).length }] : []),
    },
  });
  // ?boss=cinder (with &god, &freeze): straight into the fight, after main.ts has put the title up.
  const q = new URLSearchParams(location.search), who = q.get("boss");
  if (q.has("god")) setGod(g, true);
  if (q.has("freeze")) setFrozen(g, true);
  if (who) void boss(who as Who);
}
