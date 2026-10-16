// Getting about quickly in development (?area=hollow): every area has a way in, and the gates behind the deep ones open.
import { describe, expect, it } from "vitest";
import { AREA_IDS, loadArea } from "../src/areas/index.ts";
import { createGame } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { passedBarricade } from "../src/game/watchword.ts";
import { passedYssa } from "../src/game/yssa.ts";
import { ZONES } from "../src/game/zones.ts";

describe("zones to arrive in", () => {
  it("cover every area, each through one of its own ways in", async () => {
    expect(Object.keys(ZONES).sort()).toEqual([...AREA_IDS].sort());
    for (const [id, zone] of Object.entries(ZONES)) expect(Object.keys((await loadArea(id)).build().entries), id).toContain(zone.entry);
  });

  it("open the gates he'd have come through", () => {
    const g = createGame();
    resetGame(g);
    ZONES.ashwild!.passed!(g);
    expect([passedBarricade(g), passedYssa(g)]).toEqual([true, false]);
    resetGame(g);
    ZONES.hollow!.passed!(g);
    expect([passedBarricade(g), passedYssa(g)]).toEqual([true, true]);
  });
});
