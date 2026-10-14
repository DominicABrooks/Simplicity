import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Rng } from "../src/core/rng.ts";
import { AFFIXES, BASES, type StatKey } from "../src/data/items.ts";
import { makeFish, rollItem, type Item } from "../src/items/items.ts";

const strip = ({ id: _id, ...rest }: Item) => rest;

describe("rollItem", () => {
  it("is stable for a seed", () => {
    const a = new Rng(42), b = new Rng(42);
    for (let i = 0; i < 50; i++) expect(strip(rollItem(a))).toEqual(strip(rollItem(b)));
  });

  it("rolls exactly what the original game rolled for the same seed", () => {
    const fixture = JSON.parse(readFileSync(new URL("./fixtures/loot.json", import.meta.url), "utf8"));
    const rng = new Rng(1234);
    const rolls = fixture.map((_: unknown, i: number) => strip(rollItem(rng, i % 4 === 0 ? "magic" : "normal")));
    expect(rolls).toEqual(fixture);
  });

  it("never drops starter-only items and only rolls affixes that suit the slot", () => {
    const rng = new Rng(7);
    for (let i = 0; i < 500; i++) {
      const item = rollItem(rng);
      expect(BASES[item.type].noLoot).toBeFalsy();
      for (const [k, v] of Object.entries(item.mods) as [StatKey, number][]) {
        expect(AFFIXES[k].slots).toContain(item.slot);
        expect(v).toBeGreaterThanOrEqual(AFFIXES[k].min);
        expect(v).toBeLessThanOrEqual(AFFIXES[k].max);
      }
      const n = Object.keys(item.mods).length;
      if (item.rarity === "normal") expect(n).toBe(0);
      if (item.rarity === "magic") expect([1, 2]).toContain(n);
    }
  });

  it("names magic items by their affixes", () => {
    const rng = new Rng(11);
    for (let i = 0; i < 200; i++) {
      const item = rollItem(rng, "magic");
      if (item.rarity !== "magic") continue;
      const keys = Object.keys(item.mods) as StatKey[];
      const pre = keys.find(k => AFFIXES[k].prefix), suf = keys.find(k => AFFIXES[k].suffix);
      if (pre) expect(item.name.startsWith(AFFIXES[pre].prefix!)).toBe(true);
      if (suf) expect(item.name.endsWith(AFFIXES[suf].suffix!)).toBe(true);
      expect(item.name).toContain(BASES[item.type].name);
    }
  });

  it("honours a minimum rarity", () => {
    const rng = new Rng(99);
    for (let i = 0; i < 200; i++) expect(rollItem(rng, "magic").rarity).not.toBe("normal");
  });

  it("gives unique ids", () => {
    const rng = new Rng(3);
    expect(rollItem(rng).id).not.toBe(rollItem(rng).id);
  });
});

describe("makeFish", () => {
  it("names and heals by rarity", () => {
    expect(makeFish("normal")).toMatchObject({ name: "Pond Koi", heal: 1, slot: null });
    expect(makeFish("rare")).toMatchObject({ name: "Golden Koi", heal: 4 });
  });
});
