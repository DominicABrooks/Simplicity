// The debug handle, on `window.simplicity`: in development for the browser console (simplicity.hero(), ...),
// and in the end-to-end build (`vite build --mode e2e`) for the Playwright specs in e2e/ to read the game
// and set a scene up. Never in the published game: main.ts only calls this behind those two flags.
import { loadArea } from "./areas/index.ts";
import { STARTER_KIT } from "./data/items.ts";
import { LAIRS, type Lair, type LairName } from "./game/lairs.ts";
import { isFrozen, isGod, setFrozen, setGod } from "./game/cheats.ts";
import { setState, type Game } from "./game/game.ts";
import { hauntingOf } from "./game/ghost.ts";
import { isDoor, whoIsHome } from "./game/townsfolk.ts";
import { resetGame } from "./game/reset.ts";
import { makeItem } from "./items/items.ts";
import { enterArea } from "./game/travel.ts";
import type { Renderer } from "./render/renderer.ts";

export function exposeDebug(g: Game, view: Renderer): void {
  /** A fresh run, straight into a boss's lair and face to face with them, at the level and in the gear a player
   *  would have by then (the rest of the starter kit, and anything else they'd be carrying, in the bag). */
  async function boss(who: string = "cinder"): Promise<string> {
    const lair = Object.hasOwn(LAIRS, who) ? LAIRS[who as LairName] : null;
    if (!lair) return `No boss "${who}". Try: ${Object.keys(LAIRS).join(", ")}`;
    const def = await loadArea(lair.area);
    resetGame(g);
    setState(g, "play");
    enterArea(g, def, lair.entry);
    Object.assign(g.world.need(g.player, "hero"), { level: lair.ready.level, xp: 0 });
    const kit = lair.ready.kit.map(([type, rarity, mods, name]) => makeItem(type, rarity, { ...mods }, name));
    const ready: Lair["ready"] = lair.ready, bag = (ready.bag ?? []).map(([type, rarity, mods, name]) => makeItem(type, rarity, { ...mods }, name));
    g.inventory.reset(kit);                                  // worn, and the level's raw stats with it
    for (const item of bag) g.inventory.add(item);
    for (const [type, name] of STARTER_KIT) if (![...kit, ...bag].some(k => k.type === type)) g.inventory.add(makeItem(type, "normal", {}, name));
    const health = g.world.need(g.player, "health");
    health.hp = health.maxHp;
    Object.assign(g.world.need(g.player, "transform"), lair.stage(g));
    return `${who}: level ${lair.ready.level}, ${health.maxHp} hearts; god ${isGod(g) ? "on" : "off"}, freeze ${isFrozen(g) ? "on" : "off"}`;
  }
  Object.assign(window, {
    simplicity: {
      game: g, view, world: g.world,
      hero: () => g.world.need(g.player, "transform"),
      critters: () => view.critters(),
      memory: () => view.memory(),
      /** How the churchyard's haunting stands (see src/game/ghost.ts). */
      haunting: () => hauntingOf(g),
      /** Playtesting the bosses: boss("cinder") or boss("ringer") starts a fresh run in their lair (or load the page with ?boss=cinder,
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
  if (who) void boss(who);
}
