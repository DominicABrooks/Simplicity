import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CAMP_SOLIDS, SPAWN, buildMap } from "../src/areas/witchwood.ts";
import { T, Tile } from "../src/data/world.ts";
import { blocked } from "../src/world/collision.ts";
import { isOpenGround, reachableFrom } from "../src/world/map.ts";

describe("Witchwood's map", () => {
  const map = buildMap();

  it("matches the fixture tile for tile (the original world, plus the path to the cave and the trail south)", () => {
    const fixture = readFileSync(new URL("./fixtures/map.txt", import.meta.url), "utf8").trim().split(/\r?\n/);
    expect(map.tiles.map(r => r.join(""))).toEqual(fixture);
  });

  it("is sealed by forest on every edge, except where the path reaches the cave and the trail runs south", () => {
    for (let x = 0; x < map.width; x++) {
      expect([Tile.Tree, Tile.Path]).toContain(map.tiles[0]![x]);
      expect([Tile.Tree, Tile.Path]).toContain(map.tiles[map.height - 1]![x]);
    }
    expect(map.tiles[0]!.filter(t => t === Tile.Path)).toHaveLength(2);
    expect(map.tiles[map.height - 1]!.filter(t => t === Tile.Path)).toHaveLength(2);
  });

  it("leaves no open ground you can't walk to from the spawn", () => {
    const reached = reachableFrom(map, SPAWN.x / T, SPAWN.y / T);
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++)
        if (isOpenGround(map.tiles[y]![x]!)) expect(reached.has(y * map.width + x)).toBe(true);
  });

  it("keeps the spawn clear", () => {
    expect(isOpenGround(map.tiles[SPAWN.y / T]![SPAWN.x / T]!)).toBe(true);
  });

  it("is deterministic", () => {
    expect(buildMap().tiles).toEqual(map.tiles);
  });
});

describe("the camp", () => {
  const map = buildMap();

  it("stands on open ground near the spawn, and the spawn is free to move", () => {
    for (const r of CAMP_SOLIDS)
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++)
        expect(isOpenGround(map.tiles[Math.floor(y / T)]![Math.floor(x / T)]!)).toBe(true);
    expect(blocked(map, SPAWN.x, SPAWN.y, true)).toBe(false);
    expect(blocked(map, CAMP_SOLIDS[1]!.x, CAMP_SOLIDS[1]!.y - 4, true)).toBe(true);   // walking into the fire
  });
});
