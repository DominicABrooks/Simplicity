// Beating a boss is a moment: the world stops dead, a blaze of light, a fanfare (the music holding off for it),
// fireworks round the hero for a few seconds, and VICTORY; and a lieutenant's last words wait till it's over.
import { describe, expect, it } from "vitest";
import { loadArea } from "../src/areas/index.ts";
import { CINDER_AT } from "../src/areas/ashwild.ts";
import { CINDER } from "../src/data/ashwild.ts";
import { VICTORY as V } from "../src/data/victory.ts";
import { bossSystem } from "../src/game/bosses.ts";
import { inBossFight } from "../src/game/bossbar.ts";
import { cinderFightSystem } from "../src/game/cinderfight.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { landGreatKoi } from "../src/game/greatkoi.ts";
import { resetGame } from "../src/game/reset.ts";
import { enterArea } from "../src/game/travel.ts";
import { victoryOf, victorySystem } from "../src/game/victory.ts";

async function cinderFalls(): Promise<Game> {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  enterArea(g, await loadArea("ashwild"), "witchwood");
  Object.assign(g.world.need(g.player, "transform"), { x: CINDER_AT.x, y: CINDER_AT.y + 20 });
  cinderFightSystem(g, 0.01);
  const cinder = g.world.query("targetable", "health").find(([, c]) => c.targetable.name === CINDER.name)![0];
  g.sfx.length = 0;
  g.world.need(cinder, "health").hp = 0;
  bossSystem(g, 0.01);
  return g;
}

describe("a boss beaten", () => {
  it("is celebrated: the world stops dead, a fanfare plays, and VICTORY goes up over their name", async () => {
    const g = await cinderFalls();
    expect(victoryOf(g)).toMatchObject({ name: CINDER.name, title: CINDER.title });
    expect(g.hitstop).toBeGreaterThanOrEqual(V.hitstop);
    expect(g.sfx.map(s => s.id)).toContain("victory");
  });

  it("sets fireworks off round the hero for a few seconds, then it's over", async () => {
    const g = await cinderFalls();
    g.sfx.length = 0;
    for (let t = 0; t < V.fireworks.until; t += 0.05) victorySystem(g, 0.05);
    expect(g.sfx.filter(s => s.id === "firework").length).toBeGreaterThan(5);
    for (let t = 0; t < V.last; t += 0.05) victorySystem(g, 0.05);
    expect(victoryOf(g)).toBeNull();
  });

  it("keeps a lieutenant's last words till it's over", async () => {
    const g = await cinderFalls();
    expect(g.world.get(g.player, "conversation")).toBeUndefined();
    for (let t = 0; t < V.last - 0.2; t += 0.05) victorySystem(g, 0.05);
    expect(g.world.get(g.player, "conversation")).toBeUndefined();   // still celebrating
    for (let t = 0; t < 0.4; t += 0.05) victorySystem(g, 0.05);
    expect(g.world.get(g.player, "conversation")).toMatchObject({ name: CINDER.name, line: 0 });
  });

  it("is a boss fight, for the messages across the top to keep quiet through, till it's over", async () => {
    const g = await cinderFalls();
    expect(inBossFight(g)).toBe(true);
    for (let t = 0; t < V.last + 0.1; t += 0.05) { victorySystem(g, 0.05); cinderFightSystem(g, 0.05); }   // the fire out, the cheering done
    expect(inBossFight(g)).toBe(false);
  });

  it("is the same for the Great Koi on the end of the line", () => {
    const g = createGame();
    resetGame(g);
    setState(g, "play");
    landGreatKoi(g, 40, 40);
    expect(victoryOf(g)).toMatchObject({ name: "The Great Koi" });
  });
});
