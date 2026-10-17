import { describe, expect, it } from "vitest";
import { area as castle } from "../src/areas/castle.ts";
import { area as kingsroad } from "../src/areas/kingsroad.ts";
import { T, Tile } from "../src/data/world.ts";
import { FEET, blocked, moveBy, solidAt } from "../src/world/collision.ts";
import type { TileMap } from "../src/world/map.ts";
import { anyContains, anyOverlaps, contains, overlapsBox, type Shape } from "../src/world/shapes.ts";

const open = (solids: Shape[]): TileMap => ({ width: 20, height: 20, tiles: Array.from({ length: 20 }, () => Array<Tile>(20).fill(Tile.Grass)), solids });

describe("shapes", () => {
  const b = { x0: 10, y0: 10, x1: 16, y1: 14 };

  it("boxes overlap boxes, but not when only touching", () => {
    expect(overlapsBox({ kind: "box", x: 15, y: 13, w: 4, h: 4 }, b)).toBe(true);
    expect(overlapsBox({ kind: "box", x: 16, y: 10, w: 4, h: 4 }, b)).toBe(false);
  });

  it("circles overlap a box by the nearest point, corners included", () => {
    expect(overlapsBox({ kind: "circle", x: 18, y: 12, r: 2.5 }, b)).toBe(true);
    expect(overlapsBox({ kind: "circle", x: 18, y: 16, r: 2.5 }, b)).toBe(false);   // corner is 2.83 away
    expect(overlapsBox({ kind: "circle", x: 18, y: 16, r: 3 }, b)).toBe(true);
  });

  it("capsules (thick lines) overlap where they cross a box or come within their radius", () => {
    expect(overlapsBox({ kind: "capsule", ax: 0, ay: 0, bx: 30, by: 30, r: 0.5 }, b)).toBe(true);   // passes through
    expect(overlapsBox({ kind: "capsule", ax: 0, ay: 20, bx: 30, by: 20, r: 5 }, b)).toBe(false);   // 6 below, reaching 5
    expect(overlapsBox({ kind: "capsule", ax: 0, ay: 20, bx: 30, by: 20, r: 6.5 }, b)).toBe(true);
    expect(overlapsBox({ kind: "capsule", ax: 20, ay: 0, bx: 30, by: 10, r: 4 }, b)).toBe(false);   // diagonal, off the corner
  });

  it("contain points", () => {
    expect(contains({ kind: "circle", x: 0, y: 0, r: 2 }, 1, 1)).toBe(true);
    expect(contains({ kind: "capsule", ax: 0, ay: 0, bx: 10, by: 0, r: 1 }, 5, 0.9)).toBe(true);
    expect(contains({ kind: "capsule", ax: 0, ay: 0, bx: 10, by: 0, r: 1 }, 12, 0)).toBe(false);
  });

  it("find the right shape among many through the grid", () => {
    const many: Shape[] = Array.from({ length: 2000 }, (_, i) => ({ kind: "circle", x: (i % 50) * 40, y: Math.floor(i / 50) * 40, r: 3 }));
    expect(anyContains(many, 400 + 2, 400)).toBe(true);
    expect(anyContains(many, 400 + 20, 400)).toBe(false);
    expect(anyOverlaps(many, { x0: 437, y0: 398, x1: 443, y1: 402 })).toBe(true);
  });
});

describe("collision against shapes", () => {
  it("stops you flush against a round tower, and slides you round it", () => {
    const map = open([{ kind: "circle", x: 80, y: 80, r: 12 }]);
    const p = { x: 40, y: 80 - FEET.y - FEET.h / 2 };            // feet centred on the tower's row
    moveBy(map, p, 60, 0, false);
    const right = p.x + FEET.x + FEET.w;
    expect(80 - 12 - right).toBeGreaterThanOrEqual(0);
    expect(80 - 12 - right).toBeLessThan(2.1);                     // within one step of touching
    const before = { ...p };
    moveBy(map, p, 6, -6, false);                                  // pushing diagonally: slides up and round
    expect(p.y).toBeLessThan(before.y);
  });

  it("never lets a fast move skip through a thin wall", () => {
    const map = open([{ kind: "box", x: 79, y: 40, w: 1, h: 80 }]);
    const p = { x: 60, y: 80 - FEET.y - FEET.h / 2 };
    moveBy(map, p, 40, 0, false);                                  // a whole dash in one frame
    expect(p.x + FEET.x + FEET.w).toBeLessThanOrEqual(79);
  });

  it("goes round a thin post rather than through it", () => {
    const map = open([{ kind: "circle", x: 80, y: 80, r: 1 }]);
    const p = { x: 60, y: 80 - FEET.y - FEET.h / 2 };
    for (let x = 0; x < 40; x += 2) {                              // a dash, frame by frame
      moveBy(map, p, 2, 0, false);
      expect(blocked(map, p.x, p.y, false)).toBe(false);
    }
    expect(p.x + FEET.x).toBeGreaterThan(81);                      // past it
  });

  it("stops shots in shapes and trees but not in open air", () => {
    const map = open([{ kind: "box", x: 40, y: 40, w: 8, h: 8 }]);
    map.tiles[0]![0] = Tile.Tree;
    expect(solidAt(map, 44, 44)).toBe(true);
    expect(solidAt(map, 4, 4)).toBe(true);
    expect(solidAt(map, 60, 60)).toBe(false);
  });
});

/** Flood out from a point at the collision box's real steps; does it ever reach somewhere `outside` says is out? */
function floodEscapes(map: TileMap, from: [number, number], outside: (x: number, y: number) => boolean): { escaped: boolean; seen: number } {
  const seen = new Set<number>(), todo: [number, number][] = [from];
  while (todo.length) {
    const [x, y] = todo.pop()!, k = x * 4096 + y;
    if (seen.has(k)) continue;
    seen.add(k);
    if (outside(x, y)) return { escaped: true, seen: seen.size };
    for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]] as const) if (!blocked(map, x + dx, y + dy, true)) todo.push([x + dx, y + dy]);
  }
  return { escaped: false, seen: seen.size };
}
const shut = (map: TileMap, gate: Shape): TileMap => ({ ...map, solids: [...map.solids, gate] });

describe("Capital City's walls", () => {
  it("make everything built solid by its shape", () => {
    const { map } = kingsroad.build();
    expect(map.solids.length).toBeGreaterThan(20);
    expect(map.solids.some(s => s.kind === "capsule")).toBe(true);
  });

  it("keep the great south wall unbroken: shut Southgate and nothing on the bridge gets in", () => {
    const { map } = kingsroad.build();
    const gate: Shape = { kind: "box", x: 12 * T, y: 11 * T, w: 7 * T, h: 7 * T };   // Southgate, at row 15
    const r = floodEscapes(shut(map, gate), [15 * T, 30 * T], (_x, y) => y < 10 * T);
    expect(r.seen).toBeGreaterThan(1000);
    expect(r.escaped).toBe(false);
  });

  it("keep the castle's ward shut off: close its gate and nothing in the city gets in", () => {
    const { map } = castle.build();
    const gate: Shape = { kind: "box", x: 24 * T, y: 31 * T, w: 9 * T, h: 6 * T };
    const r = floodEscapes(shut(map, gate), [28 * T, 44 * T], (x, y) => y < 30 * T && x > 10 * T && x < 47 * T);
    expect(r.seen).toBeGreaterThan(1000);
    expect(r.escaped).toBe(false);
  });
});
