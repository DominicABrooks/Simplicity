// The third time under the hill, with only the watchers there: they murmur, a line at a time over one of them, with a
// low voice; and it all stops when he leaves.
import { describe, expect, it } from "vitest";
import { HOME, loadArea } from "../src/areas/index.ts";
import { UNDERHILL } from "../src/data/underhill.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { arrive, enterArea } from "../src/game/travel.ts";
import { followAcorn, heldByFey, hurryErlKing, murmurOf, underhillSystem, visitsUnderhill, watched } from "../src/game/underhill.ts";
import { makeItem } from "../src/items/items.ts";

const run = (g: Game, seconds: number) => { for (let t = 0; t < seconds; t += 0.1) underhillSystem(g, 0.1); };

/** Down under the hill as many times as it takes to find only the watchers there. */
async function third(): Promise<Game> {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  while (visitsUnderhill(g) < 3) {
    enterArea(g, HOME, "start");
    followAcorn(g, makeItem("acorn", "rare", {}, "Fey Acorn"));
    run(g, UNDERHILL.going + 0.2);
    arrive(g, await loadArea("underhill"));
    underhillSystem(g, 0.1);
    hurryErlKing(g, true);
    run(g, UNDERHILL.clearing + 0.5);
    expect(heldByFey(g)).toBe(false);
  }
  return g;
}

describe("the watchers' murmurs", () => {
  it("aren't there anywhere else", () => {
    const g = createGame();
    resetGame(g);
    expect(watched(g)).toBe(false);
  });

  it("come once they're out of the dark, over one of them, with a low voice, and never the same line twice running", async () => {
    const g = await third();
    expect(watched(g)).toBe(true);
    g.sfx.length = 0;
    const said: string[] = [], before = (murmurOf(g)?.n ?? -1) + 1;   // any murmured before we started listening
    for (let t = 0; t < 40; t += 0.1) {
      underhillSystem(g, 0.1);
      const m = murmurOf(g);
      if (!m) continue;
      expect(g.world.get(m.who, "watcher")).toBeDefined();         // it's one of them speaking
      said[m.n] = m.text;
    }
    expect(said.length).toBeGreaterThan(4);
    for (const line of said) expect(UNDERHILL.murmurs.lines).toContain(line);
    for (let i = 1; i < said.length; i++) expect(said[i]).not.toBe(said[i - 1]);
    expect(g.sfx.filter(s => s.id === "murmur").length).toBe(said.length - before);
  });

  it("stop when he leaves", async () => {
    const g = await third();
    run(g, UNDERHILL.murmurs.from + 1);
    expect(murmurOf(g)).not.toBeNull();
    enterArea(g, HOME, "start");
    underhillSystem(g, 0.1);
    expect(watched(g)).toBe(false);
    expect(murmurOf(g)).toBeNull();
  });
});
