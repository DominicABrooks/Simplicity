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
  solids: [{ kind: "box", x: 16, y: 32, w: 6, h: 6 }],
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

  it("centres the feet box in the cell, so you stop as close to a tree above as to one below", () => {
    expect(blocked(map, 3 * T, 3 * T - 1, false)).toBe(false);  // feet top 2 px below the tree
    expect(blocked(map, 3 * T, 3 * T - 3, false)).toBe(true);
    expect(blocked(map, 3 * T, T + 1, false)).toBe(false);      // feet bottom 1 px above it
    expect(blocked(map, 3 * T, T + 3, false)).toBe(true);
  });

  it("slides along walls one axis at a time", () => {
    const p = { x: T, y: T };
    moveBy(map, p, -3, 2, false);                           // the wall stops x, y still moves
    expect(p).toEqual({ x: T, y: T + 2 });
  });

  describe("steering round trees", () => {
    // The tree at (3,2) is px 24..32 across, 16..24 down; feet are x+1..x+7, y+2..y+6.
    const walk = (p: { x: number; y: number }, dx: number, dy: number, frames: number) => {
      for (let i = 0; i < frames; i++) {
        moveBy(map, p, dx, dy, false);
        expect(blocked(map, p.x, p.y, false)).toBe(false);   // never inside it
      }
      return p;
    };

    it("slides round a trunk he catches the edge of, to whichever side is nearer", () => {
      const left = walk({ x: 18, y: 24 }, 0, -1, 20);         // feet 19..25: 1 px over its west edge
      expect(left.x).toBe(17);
      expect(left.y).toBeLessThan(16);                        // past it
      const right = walk({ x: 30, y: 24 }, 0, -1, 20);        // feet 31..37: 1 px over its east edge
      expect(right.x).toBe(31);
      expect(right.y).toBeLessThan(16);
      const above = walk({ x: 32, y: 11 }, -1, 0, 20);        // walking west, feet 13..17: 1 px over its top
      expect(above.y).toBe(10);
      expect(above.x).toBeLessThan(17);
    });

    it("keeps his speed going round: the step he'd have taken forwards goes sideways", () => {
      const p = { x: 18, y: 22 };                             // flush under the tree, 1 px over its edge
      moveBy(map, p, 0, -0.5, false);
      expect(p).toEqual({ x: 17.5, y: 22 });
      moveBy(map, p, 0, -0.5, false);
      expect(p).toEqual({ x: 17, y: 22 });
      moveBy(map, p, 0, -0.5, false);
      expect(p).toEqual({ x: 17, y: 21.5 });                  // clear: on he goes
    });

    it("steers round it heading nearly straight at it, even leaning the other way", () => {
      const p = walk({ x: 18, y: 24 }, 0.3, -1, 20);
      expect(p.y).toBeLessThan(16);
    });

    it("dashes round it too", () => {
      const p = { x: 18, y: 24 };
      moveBy(map, p, 0, -40, false);
      expect(p).toEqual({ x: 17, y: 6 });                     // round the tree and up to the forest's edge
    });

    it("stops head-on into the middle of a trunk, or into a wall that runs on", () => {
      expect(walk({ x: 24, y: 24 }, 0, -1, 10)).toEqual({ x: 24, y: 22 });
      expect(walk({ x: 12, y: 10 }, 0, -1, 10)).toEqual({ x: 12, y: 6 });
    });

    it("slides round a round post as well", () => {
      const open: TileMap = { ...map, tiles: map.tiles.map(row => row.map(() => G)), solids: [{ kind: "circle", x: 24, y: 20, r: 3 }] };
      const p = { x: 21.5, y: 28 };                           // feet 22.5..28.5: their middle 1.5 px east of the post's
      for (let i = 0; i < 30; i++) {
        moveBy(open, p, 0, -1, false);
        expect(blocked(open, p.x, p.y, false)).toBe(false);
      }
      expect(p.y).toBeLessThan(12);
      expect(p.x).toBeGreaterThan(21.5);                      // round its east side
    });
  });

  it("blocks solids, by the feet box", () => {
    expect(blocked(map, 16, 26, false)).toBe(false);          // standing just above: feet clear of it
    expect(blocked(map, 16, 28, false)).toBe(true);
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
