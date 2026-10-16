// Boss music: every fight has its own, from the moment the boss bar shows till it goes, over whatever the area plays;
// and it gets fiercer as the fight does.
import { describe, expect, it } from "vitest";
import { loadArea } from "../src/areas/index.ts";
import { CINDER_AT } from "../src/areas/ashwild.ts";
import { THEMES, themeFor } from "../src/data/music.ts";
import { LIEUTENANTS } from "../src/game/bosses.ts";
import { cinderFight, cinderFightSystem } from "../src/game/cinderfight.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { enterArea } from "../src/game/travel.ts";
import { fighting } from "../src/audio/music.ts";

async function atCinder(stepIn: boolean): Promise<Game> {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  enterArea(g, await loadArea("ashwild"), "witchwood");
  Object.assign(g.world.need(g.player, "transform"), { x: CINDER_AT.x, y: CINDER_AT.y + (stepIn ? 20 : 300) });
  cinderFightSystem(g, 0.01);
  return g;
}

describe("boss music", () => {
  it("has a theme for every boss: the three lieutenants, the Grey Ringer and the Great Koi", () => {
    for (const who of [...Object.keys(LIEUTENANTS), "ringer", "greatkoi"]) expect(THEMES, who).toHaveProperty(who);
  });

  it("plays over the area's own, day or night, indoors or out", () => {
    expect(themeFor("play", { id: "ashwild" }, { boss: "cinder", hour: 2 })).toBe("cinder");
    expect(themeFor("play", { id: "capital" }, { boss: "ringer", hour: 23 })).toBe("ringer");
    expect(themeFor("play", { id: "underhill" }, { boss: "calder", fey: true })).toBe("calder");
    expect(themeFor("dead", { id: "ashwild" }, { boss: "cinder" })).toBeNull();     // not once he's fallen
  });

  it("starts with the fight, and gets fiercer in his rage", async () => {
    expect(fighting(await atCinder(false))).toBeNull();         // not till he's stepped in
    const g = await atCinder(true);
    expect(fighting(g)).toEqual({ who: "cinder", fury: 0 });
    cinderFight(g)!.angry = true;
    expect(fighting(g)).toEqual({ who: "cinder", fury: 1 });
  });
});
