// The Thunder Rift: up the frozen stream out of the Frozen Hollow, the trail climbing through the old trees to the great
// crack, which nobody crosses; the rift stone below it; Storm mages (and by the top everything else); and lightning
// all round out of a clear sky that never comes down on the hero.
import { describe, expect, it } from "vitest";
import { loadArea } from "../src/areas/index.ts";
import { area as hollow } from "../src/areas/hollow.ts";
import { GREAT_CRACK, area as rift } from "../src/areas/rift.ts";
import { T } from "../src/data/world.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { RIFT_STORM, riftSystem } from "../src/game/rift.ts";
import { enterArea } from "../src/game/travel.ts";
import { moveBy } from "../src/world/collision.ts";

async function inRift(): Promise<Game> {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  enterArea(g, await loadArea("rift"), "hollow");
  return g;
}

describe("The Thunder Rift", () => {
  it("is up the climb out of the Hollow, and back down it", () => {
    expect(hollow.build().exits.map(x => x.to)).toContainEqual({ area: "rift", entry: "hollow" });
    expect(rift.build().exits.map(x => x.to)).toEqual([{ area: "hollow", entry: "rift" }]);
    expect(rift.build().map.look).toBe("storm");
  });

  it("has the rift stone below the great crack, and the great crack in the way of anyone walking north", async () => {
    const g = await inRift(), stone = g.area.layout.props.find(p => p.kind === "oldStone")!;
    if (stone.kind !== "oldStone") throw new Error("no stone");
    expect(stone.name).toBe("The rift stone");
    expect(stone.y).toBeGreaterThan((GREAT_CRACK.y + GREAT_CRACK.wide) * T);
    const p = g.world.need(g.player, "transform");
    Object.assign(p, { x: GREAT_CRACK.x * T, y: (GREAT_CRACK.y + 3) * T });
    for (let i = 0; i < 40; i++) moveBy(g.map, p, 0, -T / 4, false);
    expect(p.y).toBeGreaterThan(GREAT_CRACK.y * T);
  });

  it("is held by Storm mages, with Ember and Frost ones too", () => {
    const schools = rift.life!.mages!.schools;
    expect(schools.filter(s => s === "storm").length).toBeGreaterThan(schools.length / 2);
    expect(new Set(schools)).toEqual(new Set(["storm", "ember", "frost"]));
  });

  it("has lightning all round him out of a clear sky, and none of it on him", async () => {
    const g = await inRift(), hero = g.world.need(g.player, "transform"), hp = g.world.need(g.player, "health").hp;
    Object.assign(hero, { x: 24 * T, y: 36 * T });
    for (let i = 0; i < 60 * 30; i++) riftSystem(g, 1 / 60);
    const bolts = g.fx.filter(f => f.type === "bolt");
    expect(bolts.length).toBeGreaterThanOrEqual(30 / RIFT_STORM.every[1]);
    for (const b of bolts) expect(Math.hypot(b.x - hero.x, b.y - hero.y)).toBeGreaterThanOrEqual(RIFT_STORM.near * T - 0.01);
    expect(g.world.need(g.player, "health").hp).toBe(hp);
  });
});
