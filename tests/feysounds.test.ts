// What he hears in the Witchwood's fairy ring after dark: bells in as he steps in, bells twinkling and (once he's well in)
// a low hum while he stands there, far-off voices when the fair folk speak, and bells out as he leaves. By day,
// nothing.
import { describe, expect, it } from "vitest";
import { HOME } from "../src/areas/index.ts";
import { FAIRY_RING } from "../src/data/fey.ts";
import { HALF } from "../src/data/world.ts";
import { fairyRingSystem, ringHere } from "../src/game/fairyring.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { enterArea } from "../src/game/travel.ts";

/** A game in the Witchwood at `hour`, the hero a little way east of the ring, out of it, and nothing heard yet. */
function byRing(hour: number): Game {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  enterArea(g, HOME, "start");
  g.hour = hour;
  const ring = ringHere(g)!, p = g.world.need(g.player, "transform");
  p.x = ring.x - HALF + ring.radius * 3 * HALF; p.y = ring.y - HALF;
  fairyRingSystem(g, 0.1);
  g.sfx.length = 0;
  return g;
}
const step = (g: Game, dx: number) => { g.world.need(g.player, "transform").x += dx; fairyRingSystem(g, 0.1); };
/** Stand for `seconds`, and what was heard meanwhile (emptied after). */
const stand = (g: Game, seconds: number) => {
  for (let t = 0; t < seconds; t += 0.1) fairyRingSystem(g, 0.1);
  return g.sfx.splice(0).map(s => s.id);
};
const into = (g: Game) => { step(g, -ringHere(g)!.radius * 3 * HALF); return g.sfx.splice(0).map(s => s.id); };

describe("the fairy ring's sounds", () => {
  it("ring in as he steps in, and out as he steps out", () => {
    const g = byRing(23);
    expect(into(g)).toEqual(["feyEnter"]);
    step(g, ringHere(g)!.radius * 3 * HALF);
    expect(g.sfx.map(s => s.id)).toContain("feyLeave");
  });

  it("twinkle while he's in it, and hum low once he's well in", () => {
    const g = byRing(23);
    into(g);
    const heard = stand(g, FAIRY_RING.full + 4);
    expect(heard.filter(id => id === "feyChime").length).toBeGreaterThan(3);
    expect(heard).toContain("feyHum");
  });

  it("breathe as the fair folk speak", () => {
    const g = byRing(23);
    into(g);
    expect(stand(g, FAIRY_RING.speakFrom + 0.5)).toContain("feyVoice");
  });

  it("aren't there by day", () => {
    const g = byRing(12);
    into(g);
    expect(stand(g, 5)).toEqual([]);
  });
});
