// After dark in the Witchwood, fireflies lead the hero to the fairy ring from wherever he is: only at night, only to a
// whole ring, and only till he's first stood in it this run. The way they lead starts where he stands, goes a step at
// a time, never through trees or water, and ends in the ring.
import { describe, expect, it } from "vitest";
import { HOME, loadArea } from "../src/areas/index.ts";
import { HALF, T, isSolidTile } from "../src/data/world.ts";
import { fairyRingSystem, fireflyLead, ringHere, wayToRing } from "../src/game/fairyring.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { enterArea } from "../src/game/travel.ts";
import { reachableFrom } from "../src/world/map.ts";

/** A game in the Witchwood at `hour`, the hero at the start. */
function witchwood(hour: number): Game {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  enterArea(g, HOME, "start");
  g.hour = hour;
  return g;
}
/** Stand in the middle of the ring a while. */
function standIn(g: Game): void {
  const ring = ringHere(g)!, p = g.world.need(g.player, "transform");
  p.x = ring.x - HALF; p.y = ring.y - HALF;
  for (let t = 0; t < 1; t += 0.1) fairyRingSystem(g, 0.1);
}

describe("the fireflies' way to the fairy ring", () => {
  it("leads from anywhere he can walk in the Witchwood to the ring, a step at a time and never through trees or water", () => {
    const g = witchwood(23), ring = ringHere(g)!, { tiles, width, height } = g.area.layout.map;
    const start = g.area.layout.entries.start!, reached = reachableFrom(g.area.layout.map, start.x / T, start.y / T);
    let tried = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (!reached.has(y * width + x)) continue;
      const way = wayToRing(g, x * T, y * T);
      expect(way[0], `from ${x},${y}`).toEqual([(x + 0.5) * T, (y + 0.5) * T]);
      const [ex, ey] = way[way.length - 1]!;
      expect([Math.floor(ex / T), Math.floor(ey / T)]).toEqual([Math.floor(ring.x / T), Math.floor(ring.y / T)]);
      for (const [i, [wx, wy]] of way.entries()) {
        expect(isSolidTile(tiles[Math.floor(wy / T)]![Math.floor(wx / T)]!)).toBe(false);
        if (i) expect(Math.abs(wx - way[i - 1]![0]) + Math.abs(wy - way[i - 1]![1])).toBe(T);
      }
      tried++;
    }
    expect(tried).toBeGreaterThan(1000);
  });

  it("starts from the nearest tile he could walk on when he's at the trees' edge", () => {
    const g = witchwood(23), { tiles, width, height } = g.area.layout.map;
    let edge: [number, number] | null = null;
    for (let y = 1; y < height - 1 && !edge; y++) for (let x = 1; x < width - 1 && !edge; x++)
      if (isSolidTile(tiles[y]![x]!) && !isSolidTile(tiles[y]![x + 1]!) && wayToRing(g, (x + 1) * T, y * T).length) edge = [x, y];
    const [x, y] = edge!;
    expect(wayToRing(g, x * T, y * T).length).toBeGreaterThan(0);
  });

  it("leads nowhere where there's no ring to be led to", async () => {
    const g = witchwood(23);
    enterArea(g, await loadArea("kingsroad"), "cave");
    expect(wayToRing(g, 0, 0)).toEqual([]);
  });
});

describe("the fireflies leading the way", () => {
  it("are out all night, coming on at sunset and going by sunrise, and never by day", () => {
    expect(fireflyLead(witchwood(23))).toBe(1);
    expect(fireflyLead(witchwood(2))).toBe(1);
    expect(fireflyLead(witchwood(21.5))).toBeCloseTo(0.5);
    expect(fireflyLead(witchwood(4.5))).toBeCloseTo(0.5);
    expect(fireflyLead(witchwood(12))).toBe(0);
    expect(fireflyLead(witchwood(20.5))).toBe(0);
  });

  it("go once he's stood in the ring, and are back the next run", () => {
    const g = witchwood(23);
    standIn(g);
    expect(fireflyLead(g)).toBe(0);
    resetGame(g);
    enterArea(g, HOME, "start");
    g.hour = 23;
    expect(fireflyLead(g)).toBe(1);
  });

  it("don't go for standing in it by day", () => {
    const g = witchwood(12);
    standIn(g);
    g.hour = 23;
    expect(fireflyLead(g)).toBe(1);
  });

  it("lead nowhere to a broken ring", () => {
    const g = witchwood(23), ring = ringHere(g)!;
    ring.broken = true;
    try { expect(fireflyLead(g)).toBe(0); } finally { ring.broken = false; }
  });

  it("are only in the Witchwood", async () => {
    const g = witchwood(23);
    enterArea(g, await loadArea("kingsroad"), "cave");
    g.hour = 23;
    expect(fireflyLead(g)).toBe(0);
  });
});
