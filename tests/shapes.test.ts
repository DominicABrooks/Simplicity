import { describe, expect, it } from "vitest";
import { area as capital } from "../src/areas/capital.ts";
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

  it("never lets a fast move skip through a thin post", () => {
    const map = open([{ kind: "circle", x: 80, y: 80, r: 1 }]);
    const p = { x: 60, y: 80 - FEET.y - FEET.h / 2 };
    moveBy(map, p, 40, 0, false);                                  // a whole dash in one frame
    expect(p.x + FEET.x + FEET.w).toBeLessThanOrEqual(79);
  });

  it("stops shots in shapes and trees but not in open air", () => {
    const map = open([{ kind: "box", x: 40, y: 40, w: 8, h: 8 }]);
    map.tiles[0]![0] = Tile.Tree;
    expect(solidAt(map, 44, 44)).toBe(true);
    expect(solidAt(map, 4, 4)).toBe(true);
    expect(solidAt(map, 60, 60)).toBe(false);
  });
});

describe("Capital City's collision", () => {
  const { map } = capital.build();

  it("makes everything built solid by its shape", () => {
    expect(map.solids.length).toBeGreaterThan(100);
    expect(map.solids.some(s => s.kind === "capsule")).toBe(true);
  });

  it("keeps the town wall unbroken: shut the gate and nothing inside gets out", () => {
    const gateY = 65;                                              // the gate's row, below the square
    const shut = { ...map, solids: [...map.solids, { kind: "box", x: 40 * T, y: (gateY - 3) * T, w: 8 * T, h: 6 * T } as Shape] };
    const seen = new Set<number>(), todo: [number, number][] = [[44 * T, 45 * T + 4]];
    let escaped = false;
    while (todo.length && !escaped) {
      const [x, y] = todo.pop()!, k = x * 4096 + y;
      if (seen.has(k)) continue;
      seen.add(k);
      if (Math.hypot((x / T - 44) / 37, (y / T - 37) / 29) > 1.08) escaped = true;
      for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]] as const) if (!blocked(shut, x + dx, y + dy, true)) todo.push([x + dx, y + dy]);
    }
    expect(seen.size).toBeGreaterThan(1000);
    expect(escaped).toBe(false);
  });
});
