// Once he's come back up from the hill the third time, with the watchers there and the Erl-King gone, the Witchwood's
// fairy ring is broken: nothing happens in it any more, after dark or ever.
import { describe, expect, it } from "vitest";
import { HOME, loadArea } from "../src/areas/index.ts";
import { UNDERHILL } from "../src/data/underhill.ts";
import { HALF } from "../src/data/world.ts";
import { fairyRingSystem, ringHere, tranceOf } from "../src/game/fairyring.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { arrive, enterArea } from "../src/game/travel.ts";
import { followAcorn, hurryErlKing, underhillSystem, visitsUnderhill } from "../src/game/underhill.ts";
import { makeItem } from "../src/items/items.ts";

const run = (g: Game, seconds: number) => { for (let t = 0; t < seconds; t += 0.1) underhillSystem(g, 0.1); };
const ring = (g: Game) => g.area.layout.props.find(p => p.kind === "fairyRing");

/** Down under the hill and back up to the Witchwood, `times` times. */
async function visit(g: Game, times: number): Promise<void> {
  for (let i = 0; i < times; i++) {
    enterArea(g, HOME, "start");
    followAcorn(g, makeItem("acorn", "rare", {}, "Fey Acorn"));
    run(g, UNDERHILL.going + 0.2);
    arrive(g, await loadArea("underhill"));
    underhillSystem(g, 0.1);
    hurryErlKing(g, true);
    run(g, UNDERHILL.clearing + 0.5);
  }
  enterArea(g, HOME, "start");
}
function game(): Game {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  return g;
}
/** Stand in the middle of the ring at midnight a while, and say how deep its spell went. */
function standIn(g: Game, at: { x: number; y: number }): number {
  g.hour = 0;
  const p = g.world.need(g.player, "transform");
  p.x = at.x - HALF; p.y = at.y - HALF;
  for (let t = 0; t < 3; t += 0.1) fairyRingSystem(g, 0.1);
  return tranceOf(g);
}

describe("the broken fairy ring", () => {
  it("is whole till the third time he's been under the hill", async () => {
    const g = game();
    await visit(g, 2);
    expect(ring(g)).toMatchObject({ broken: false });
    expect(standIn(g, ring(g)!)).toBeGreaterThan(0);
  });

  it("is broken once he's come back up the third time, and its spell doesn't take him", async () => {
    const g = game();
    await visit(g, 3);
    expect(visitsUnderhill(g)).toBe(3);
    expect(ring(g)).toMatchObject({ broken: true });
    expect(ringHere(g)).toBeUndefined();
    g.sfx.length = 0;
    expect(standIn(g, ring(g)!)).toBe(0);
    expect(g.sfx.filter(s => s.id.startsWith("fey"))).toEqual([]);
  });

  it("leaves the rings under the hill as they were", async () => {
    const g = game();
    await visit(g, 3);
    const under = (await loadArea("underhill")).build().props.filter(p => p.kind === "fairyRing");
    for (const p of under) expect(p).not.toHaveProperty("broken", true);
  });
});
