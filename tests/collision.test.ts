import { describe, expect, it } from "vitest";
import { Rng } from "../src/core/rng.ts";
import { T, Tile } from "../src/data/world.ts";
import { blocked, moveBy, overlap, randomGroundSpot, tileAt } from "../src/world/collision.ts";
import { isOpenGround, type TileMap } from "../src/world/map.ts";

// 6x6: forest border, one tree at (3,2), water at (2,3).
const G = Tile.Grass, X = Tile.Tree, W = Tile.Water;
const map: TileMap = {
  width: 6,
  height: 6,
  solids: [{ x: 16, y: 32, w: 6, h: 6 }],
  tiles: [
    [X, X, X, X, X, X],
    [X, G, G, G, G, X],
    [X, G, G, X, G, X],
    [X, G, W, G, G, X],
    [X, G, G, G, G, X],
    [X, X, X, X, X, X],
  ],
};

describe("collision", () => {
  it("treats outside the map as forest", () => {
    expect(tileAt(map, -1, 10)).toBe(Tile.Tree);
    expect(tileAt(map, 100, 10)).toBe(Tile.Tree);
  });

  it("blocks trees, and water only when asked", () => {
    expect(blocked(map, T, T, true)).toBe(false);
    expect(blocked(map, 3 * T, 2 * T, false)).toBe(true);
    expect(blocked(map, 2 * T, 3 * T, false)).toBe(false);
    expect(blocked(map, 2 * T, 3 * T, true)).toBe(true);
  });

  it("checks only the feet, so a sprite's top half can overlap a tree above it", () => {
    expect(blocked(map, 3 * T, 3 * T - 3, false)).toBe(false);
    expect(blocked(map, 3 * T, 3 * T - 5, false)).toBe(true);
  });

  it("slides along walls one axis at a time", () => {
    const p = { x: T, y: T };
    moveBy(map, p, -3, 2, false);                           // the wall stops x, y still moves
    expect(p).toEqual({ x: T, y: T + 2 });
  });

  it("blocks solids, by the feet box", () => {
    expect(blocked(map, 16, 24, false)).toBe(false);          // standing just above: feet clear of it
    expect(blocked(map, 16, 26, false)).toBe(true);
    expect(blocked(map, 20, 32, false)).toBe(true);           // feet x 21..27 vs solid 16..22
    expect(blocked(map, 21, 32, false)).toBe(false);
    expect(blocked(map, 10, 32, false)).toBe(true);
    expect(blocked(map, 9, 32, false)).toBe(false);
  });

  it("overlaps within 6 px on both axes", () => {
    expect(overlap({ x: 0, y: 0 }, { x: 5, y: -5 })).toBe(true);
    expect(overlap({ x: 0, y: 0 }, { x: 6, y: 0 })).toBe(false);
  });

  it("finds open ground away from a point", () => {
    const rng = new Rng(5);
    for (let i = 0; i < 20; i++) {
      const s = randomGroundSpot(map, rng, { x: T, y: T }, 16)!;
      expect(isOpenGround(map.tiles[s.y / T]![s.x / T]!)).toBe(true);
      expect(Math.hypot(s.x - T, s.y - T)).toBeGreaterThanOrEqual(16);
    }
  });
});
