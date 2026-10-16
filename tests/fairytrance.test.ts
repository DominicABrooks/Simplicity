// Standing in the Witchwood's fairy ring after dark: the spell takes him the moment he's in, deepens the longer he stands
// still (all the way after a few seconds), eases back when he moves, and isn't there by day or out of the ring.
import { describe, expect, it } from "vitest";
import { HOME } from "../src/areas/index.ts";
import { FAIRY_RING, FEY_GIFT } from "../src/data/fey.ts";
import { FEY_SAYINGS } from "../src/data/feysayings.ts";
import { HALF } from "../src/data/world.ts";
import { fairyRingSystem, ringHere, sayingOf, tranceOf, uiFadeOf } from "../src/game/fairyring.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { enterArea } from "../src/game/travel.ts";

/** A game in the Witchwood at `hour`, the hero standing at the ring's middle (or `off` px east of it). */
function inRing(hour: number, off = 0): Game {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  enterArea(g, HOME, "start");
  g.hour = hour;
  const ring = ringHere(g)!, p = g.world.need(g.player, "transform");
  p.x = ring.x - HALF + off; p.y = ring.y - HALF;
  return g;
}
/** What's lying on the ground. */
const loot = (g: Game) => g.world.query("pickup").flatMap(([, c]) => (c.pickup.kind === "loot" ? [c.pickup.item] : []));
const stand = (g: Game, seconds: number) => { for (let t = 0; t < seconds; t += 0.1) fairyRingSystem(g, 0.1); };

describe("the fairy ring's spell", () => {
  it("takes him a little the moment he's in it at night, and all the way after standing still long enough", () => {
    const g = inRing(23);
    stand(g, 0.2);
    expect(tranceOf(g)).toBeGreaterThanOrEqual(FAIRY_RING.base);
    expect(tranceOf(g)).toBeLessThan(0.5);
    stand(g, FAIRY_RING.full / 2);
    const half = tranceOf(g);
    expect(half).toBeGreaterThan(0.5);
    expect(half).toBeLessThan(1);
    stand(g, FAIRY_RING.full);
    expect(tranceOf(g)).toBe(1);
  });

  it("eases back to the start of it when he moves, but stays while he's in the ring", () => {
    const g = inRing(23);
    stand(g, FAIRY_RING.full + 1);
    g.world.need(g.player, "transform").x += 1;
    fairyRingSystem(g, 0.1);
    expect(tranceOf(g)).toBe(FAIRY_RING.base);
  });

  it("isn't there by day, or out of the ring", () => {
    const day = inRing(12);
    stand(day, FAIRY_RING.full + 1);
    expect(tranceOf(day)).toBe(0);
    const out = inRing(23, 4 * 2 * HALF);
    stand(out, FAIRY_RING.full + 1);
    expect(tranceOf(out)).toBe(0);
  });

  it("fades the screen's hearts and bars too, once he's stood still long after it's taken him, and brings them back when he moves", () => {
    const g = inRing(23);
    stand(g, FAIRY_RING.uiFrom - 0.5);
    expect(tranceOf(g)).toBe(1);
    expect(uiFadeOf(g)).toBe(0);
    stand(g, FAIRY_RING.uiOver / 2 + 0.5);
    expect(uiFadeOf(g)).toBeGreaterThan(0);
    expect(uiFadeOf(g)).toBeLessThan(1);
    stand(g, FAIRY_RING.uiOver);
    expect(uiFadeOf(g)).toBe(1);
    g.world.need(g.player, "transform").x += 1;
    fairyRingSystem(g, 0.1);
    expect(uiFadeOf(g)).toBe(0);
  });

  it("has the fair folk talk to him once he's stood long enough, a line at a time, none twice till all are said", () => {
    const g = inRing(23);
    stand(g, FAIRY_RING.speakFrom - 0.5);
    expect(sayingOf(g)).toBeNull();
    const heard = new Map<number, string>();
    for (let i = 0; heard.size < FEY_SAYINGS.length && i < 60000; i++) {
      fairyRingSystem(g, 0.1);
      const s = sayingOf(g);
      if (s) heard.set(s.n, s.text);
    }
    expect([...heard.keys()]).toEqual(FEY_SAYINGS.map((_, i) => i));
    expect(new Set(heard.values()).size).toBe(FEY_SAYINGS.length);
  });

  it("lets the line fade when he moves, and says nothing more till he's still again", () => {
    const g = inRing(23);
    stand(g, FAIRY_RING.speakFrom + 2);
    const said = sayingOf(g)!;
    expect(said).not.toBeNull();
    g.world.need(g.player, "transform").x += 1;
    stand(g, FAIRY_RING.line.out + 0.2);
    expect(sayingOf(g)).toBeNull();
    stand(g, 3);
    expect(sayingOf(g)).toBeNull();
  });

  it("leaves him a Fey Acorn when he comes out of the ring, holding the last thing they said, if they said anything", () => {
    const quiet = inRing(23);
    stand(quiet, FAIRY_RING.speakFrom - 1);
    quiet.world.need(quiet.player, "transform").x += 4 * 2 * HALF;
    fairyRingSystem(quiet, 0.1);
    expect(loot(quiet)).toEqual([]);

    const g = inRing(23);
    stand(g, FAIRY_RING.speakFrom + 2);
    const last = sayingOf(g)!.text;
    g.world.need(g.player, "transform").x += 4 * 2 * HALF;
    fairyRingSystem(g, 0.1);
    const [acorn] = loot(g);
    expect(acorn?.name).toBe(FEY_GIFT.name);
    expect(acorn?.note).toContain(last);
    fairyRingSystem(g, 0.1);
    expect(loot(g)).toHaveLength(1);                         // once, for once in the ring
  });

  it("leaves it at dawn too, if he's still standing there", () => {
    const g = inRing(4.9);
    stand(g, FAIRY_RING.speakFrom + 2);
    g.hour = 5.1;
    fairyRingSystem(g, 0.1);
    expect(loot(g).map(i => i.name)).toEqual([FEY_GIFT.name]);
  });

  it("has a few hundred things to say, none twice, all in letters the pixel font has", () => {
    expect(FEY_SAYINGS.length).toBeGreaterThanOrEqual(400);
    expect(new Set(FEY_SAYINGS).size).toBe(FEY_SAYINGS.length);
    for (const s of FEY_SAYINGS) expect(s).toMatch(/^[A-Za-z0-9 .,:;!?'\-+=/()[\]<>%_&*]+$/);
  });
});
