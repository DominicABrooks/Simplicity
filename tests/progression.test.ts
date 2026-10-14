import { describe, expect, it } from "vitest";
import { MAGE, mageCap, mageChance, mageHp } from "../src/data/enemies.ts";
import { levelBonus, xpToNext } from "../src/data/progression.ts";

describe("progression", () => {
  it("needs 40 more XP each level", () => {
    expect([1, 2, 3, 19].map(xpToNext)).toEqual([50, 90, 130, 770]);
  });

  it("grants raw stats per level", () => {
    expect(levelBonus(1)).toEqual({ level: 1, speed: 0, life: 0, damage: 0 });
    expect(levelBonus(5)).toEqual({ level: 5, speed: 8, life: 2, damage: 1 });
    expect(levelBonus(20)).toEqual({ level: 20, speed: 38, life: 9, damage: 4 });
  });
});

describe("mage scaling", () => {
  it.each([
    [1, 0.15, 1, MAGE.hp],
    [6, 0.25, 2, MAGE.hp + 10],
    [16, 0.45, 4, MAGE.hp + 30],
    [20, 0.5, 4, MAGE.hp + 38],
  ])("level %i: chance %f, cap %i, hp %i", (level, chance, cap, hp) => {
    expect(mageChance(level)).toBeCloseTo(chance);
    expect(mageCap(level)).toBe(cap);
    expect(mageHp(level)).toBe(hp);
  });
});
