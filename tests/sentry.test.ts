import { describe, expect, it } from "vitest";
import { loadArea } from "../src/areas/index.ts";
import { angleDiff } from "../src/core/math.ts";
import { GUARD } from "../src/data/npcs.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { enterArea } from "../src/game/travel.ts";
import { sentrySystem } from "../src/systems/sentry.ts";

const DT = 1 / 60;

async function inCapital(): Promise<Game> {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  enterArea(g, await loadArea("capital"), "cave");
  return g;
}

const guards = (g: Game) => g.world.query("transform", "sentry", "targetable");
const run = (g: Game, seconds: number) => { for (let t = 0; t < seconds; t += DT) sentrySystem(g, DT); };

describe("guards", () => {
  it("stand at their posts in the capital as friendly targets", async () => {
    const g = await inCapital();
    const all = guards(g);
    expect(all.length).toBe(4);
    for (const [, { targetable }] of all) {
      expect(targetable.hostile).toBe(false);
      expect(targetable.name).toBe(GUARD.name);
    }
  });

  it("turn to watch the hero who comes close in front, smoothly, and back to their post when they leave", async () => {
    const g = await inCapital();
    const [e, { transform: t, sentry: s }] = guards(g)[0]!, hero = g.world.need(g.player, "transform");
    // Away: keeping watch, never far from straight ahead.
    hero.x = t.x + 200; hero.y = t.y - 200;
    run(g, 10);
    expect(Math.abs(angleDiff(s.look, s.post))).toBeLessThan(0.7);
    // Close, ahead and to one side: they turn to look, a little at a time.
    hero.x = t.x + 16; hero.y = t.y + 16;
    const before = s.look;
    sentrySystem(g, DT);
    const first = Math.abs(angleDiff(s.look, before));     // how far they turned in one frame
    run(g, 2);
    const toHero = Math.atan2(hero.y - t.y, hero.x - t.x);
    expect(Math.abs(angleDiff(s.look, toHero))).toBeLessThan(0.05);
    expect(first).toBeLessThan(0.1);                          // no snapping round
    // Gone: back to keeping watch.
    hero.x = t.x - 300;
    run(g, 12);
    expect(Math.abs(angleDiff(s.look, s.post))).toBeLessThan(0.7);
    expect(g.world.has(e, "targetable")).toBe(true);
  });

  it("never turn their back on their post, whatever's behind them", async () => {
    const g = await inCapital();
    const [, { transform: t, sentry: s }] = guards(g)[0]!, hero = g.world.need(g.player, "transform");
    hero.x = t.x; hero.y = t.y - 12;                           // right behind (posts face south)
    run(g, 5);
    expect(Math.abs(angleDiff(s.look, s.post))).toBeLessThanOrEqual(0.7);
  });
});
