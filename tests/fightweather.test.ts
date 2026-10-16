// There's no weather in a boss fight: rain or fog that's on when it starts clears quickly, none comes while it's on, and
// once it's over the weather goes on turning as before.
import { describe, expect, it } from "vitest";
import { loadArea } from "../src/areas/index.ts";
import { CINDER_AT } from "../src/areas/ashwild.ts";
import { FIGHT_CLEARS } from "../src/data/weather.ts";
import { cinderFightSystem } from "../src/game/cinderfight.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { enterArea } from "../src/game/travel.ts";
import { weatherSystem } from "../src/systems/weather.ts";

async function byCinder(): Promise<Game> {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  enterArea(g, await loadArea("ashwild"), "witchwood");
  Object.assign(g.weather, { kind: "rain", rain: 1, fog: 0.6, timer: 100 });
  return g;
}
const stepIn = (g: Game) => { Object.assign(g.world.need(g.player, "transform"), { x: CINDER_AT.x, y: CINDER_AT.y + 20 }); cinderFightSystem(g, 0.01); };
const run = (g: Game, seconds: number) => { for (let t = 0; t < seconds; t += 0.05) weatherSystem(g, 0.05); };

describe("the weather in a boss fight", () => {
  it("clears quickly when the fight starts", async () => {
    const g = await byCinder();
    stepIn(g);
    run(g, FIGHT_CLEARS + 0.1);
    expect(g.weather).toMatchObject({ kind: "clear", rain: 0, fog: 0 });
  });

  it("doesn't turn while the fight's on, however long it goes", async () => {
    const g = await byCinder();
    stepIn(g);
    g.weather.timer = 0.1;                                    // the spell's up: it would turn now
    run(g, 30);
    expect(g.weather).toMatchObject({ kind: "clear", rain: 0, fog: 0 });
  });

  it("is left alone outside a fight", async () => {
    const g = await byCinder();
    run(g, 2);
    expect(g.weather.kind).toBe("rain");
    expect(g.weather.rain).toBe(1);
  });
});
