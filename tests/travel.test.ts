import { describe, expect, it } from "vitest";
import { HOME, loadArea } from "../src/areas/index.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { arrive, enterArea } from "../src/game/travel.ts";
import { makeItem } from "../src/items/items.ts";
import { step } from "../src/systems/index.ts";

const DT = 1 / 60;

function playing(): Game {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  for (const [e] of g.world.query("enemy")) g.world.destroy(e);
  return g;
}

/** Walk north (holding W) until something happens or a few seconds pass. */
function walkNorth(g: Game, seconds = 3): void {
  g.input.keys.add("w");
  for (let t = 0; t < seconds && g.state === "play"; t += DT) step(g, DT);
  g.input.keys.clear();
}

describe("travel", () => {
  it("starts every run at home, by the camp", () => {
    const g = playing();
    expect(g.area.def.id).toBe(HOME.id);
    expect(g.world.query("targetable").some(([, { targetable }]) => targetable.name === "Campfire")).toBe(true);
  });

  it("walking into the cave north of the camp takes you to the next area, gear and all", async () => {
    const g = playing();
    g.inventory.reset([makeItem("blade", "rare")]);
    const hero = g.world.need(g.player, "hero");
    hero.level = 4;
    // Stand at the cave's arrival point and walk up into its mouth.
    enterArea(g, HOME, "cave");
    walkNorth(g);
    expect(g.state).toBe("travel");
    expect(g.travel).toEqual({ area: "uncharted", entry: "cave" });
    // The world holds still while the next area loads.
    const before = { ...g.world.need(g.player, "transform") };
    step(g, DT);
    expect(g.world.need(g.player, "transform")).toEqual(before);

    arrive(g, await loadArea("uncharted"));
    expect(g.state).toBe("play");
    expect(g.area.def.id).toBe("uncharted");
    expect(g.world.need(g.player, "transform")).toEqual(g.area.layout.entries.cave);
    expect(g.world.need(g.player, "hero").level).toBe(4);
    expect(g.inventory.equip.weapon?.rarity).toBe("rare");
  });

  it("the new area is empty, and stays empty", async () => {
    const g = playing();
    enterArea(g, await loadArea("uncharted"), "cave");
    expect(g.world.entities()).toEqual([g.player]);
    for (let t = 0; t < 10; t += DT) step(g, DT);           // long enough for several spawn ticks
    expect(g.world.count("enemy")).toBe(0);
  });

  it("leaving an area clears it, and coming back fills it again", async () => {
    const g = playing();
    const uncharted = await loadArea("uncharted");
    enterArea(g, uncharted, "cave");
    // Walk back south into the cave.
    g.input.keys.add("s");
    for (let t = 0; t < 3 && g.state === "play"; t += DT) step(g, DT);
    g.input.keys.clear();
    expect(g.travel).toEqual({ area: "greenhollow", entry: "cave" });
    arrive(g, HOME);
    expect(g.area.def.id).toBe("greenhollow");
    expect(g.world.count("enemy")).toBeGreaterThan(0);
  });

  it("refuses an arrival point that doesn't exist", () => {
    const g = playing();
    expect(() => enterArea(g, HOME, "nowhere")).toThrow();
  });
});
