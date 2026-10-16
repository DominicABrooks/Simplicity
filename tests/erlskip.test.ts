// Hurrying the Erl-King: on to his next line, or past all of it with his gift still given.
import { describe, expect, it } from "vitest";
import { HOME, loadArea } from "../src/areas/index.ts";
import { FIRST_VISIT, REEL_RING, UNDERHILL } from "../src/data/underhill.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { arrive, enterArea } from "../src/game/travel.ts";
import { erlKingSays, followAcorn, heldByFey, hurryErlKing, underhillSystem } from "../src/game/underhill.ts";
import { makeItem } from "../src/items/items.ts";

const run = (g: Game, seconds: number) => { for (let t = 0; t < seconds; t += 0.1) underhillSystem(g, 0.1); };
const loot = (g: Game) => g.world.query("pickup").flatMap(([, c]) => (c.pickup.kind === "loot" ? [c.pickup.item] : []));

/** Under the hill for the first time, the Erl-King about to speak. */
async function before(): Promise<Game> {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  enterArea(g, HOME, "start");
  followAcorn(g, makeItem("acorn", "rare", {}, "Fey Acorn"));
  run(g, UNDERHILL.going + 0.2);
  arrive(g, await loadArea("underhill"));
  underhillSystem(g, 0.1);
  return g;
}

describe("hurrying the Erl-King", () => {
  it("brings on his first word, then each next line", async () => {
    const g = await before();
    expect(erlKingSays(g)!.age).toBeLessThan(0);
    hurryErlKing(g, false);
    expect(erlKingSays(g)!.age).toBe(0);
    for (let i = 1; i < 3; i++) {
      hurryErlKing(g, false);                               // this line fades now
      run(g, UNDERHILL.line.out + 0.1);
      hurryErlKing(g, false);                               // and the next comes
      underhillSystem(g, 0.1);
      expect(erlKingSays(g)!.lines[erlKingSays(g)!.i]).toBe(FIRST_VISIT[i]);
    }
  });

  it("skips it all, and still gives the ring, and lets him go", async () => {
    const g = await before();
    expect(hurryErlKing(g, true)).toBe(true);
    expect(erlKingSays(g)).toBeNull();
    expect(loot(g).map(i => i.name)).toContain(REEL_RING.name);
    run(g, UNDERHILL.clearing + 0.5);
    expect(heldByFey(g)).toBe(false);
    expect(hurryErlKing(g, true)).toBe(false);
  });
});
