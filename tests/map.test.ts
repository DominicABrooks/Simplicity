import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MAP_H, MAP_W, SPAWN, T, Tile } from "../src/data/world.ts";
import { isOpenGround, makeMap, reachableFrom } from "../src/world/map.ts";

describe("makeMap", () => {
  const map = makeMap();

  it("matches the world captured from the original game, tile for tile", () => {
    const fixture = readFileSync(new URL("./fixtures/map.txt", import.meta.url), "utf8").trim().split(/\r?\n/);
    expect(map.tiles.map(r => r.join(""))).toEqual(fixture);
  });

  it("is the expected size and sealed by forest on every edge", () => {
    expect(map.width).toBe(MAP_W);
    expect(map.height).toBe(MAP_H);
    for (let x = 0; x < MAP_W; x++) {
      expect(map.tiles[0]![x]).toBe(Tile.Tree);
      expect(map.tiles[MAP_H - 1]![x]).toBe(Tile.Tree);
    }
  });

  it("leaves no open ground you can't walk to from the spawn", () => {
    const reached = reachableFrom(map, SPAWN.x / T, SPAWN.y / T);
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++)
        if (isOpenGround(map.tiles[y]![x]!)) expect(reached.has(y * MAP_W + x)).toBe(true);
  });

  it("keeps the spawn clear", () => {
    expect(isOpenGround(map.tiles[SPAWN.y / T]![SPAWN.x / T]!)).toBe(true);
  });

  it("is deterministic", () => {
    expect(makeMap().tiles).toEqual(map.tiles);
  });
});

describe("the camp", () => {
  const map = makeMap();

  it("stands on open ground near the spawn, and the spawn is free to move", async () => {
    const { CAMP_SOLIDS } = await import("../src/data/world.ts");
    const { blocked } = await import("../src/world/collision.ts");
    for (const r of CAMP_SOLIDS)
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++)
        expect(isOpenGround(map.tiles[Math.floor(y / T)]![Math.floor(x / T)]!)).toBe(true);
    expect(blocked(map, SPAWN.x, SPAWN.y, true)).toBe(false);
    expect(blocked(map, CAMP_SOLIDS[1]!.x, CAMP_SOLIDS[1]!.y - 4, true)).toBe(true);   // walking into the fire
  });
});
