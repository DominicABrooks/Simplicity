// The people of the capital: every house in every district lived in, every named family housed once
// in a house that suits it, and the city about the size LORE.md says it is.
import { describe, expect, it } from "vitest";
import { area as capital } from "../src/areas/capital.ts";
import { area as castle } from "../src/areas/castle.ts";
import { T } from "../src/data/world.ts";
import { BEYOND_HOUSES, FAMILIES, householdsOf, type District } from "../src/world/people.ts";

const DISTRICTS: Record<District, typeof capital> = { capital, castle };
const all = Object.entries(DISTRICTS).flatMap(([d, def]) => householdsOf(d as District, def.build().props));

describe("the people of Kingsholm", () => {
  it("lives in every house, at least one family to each", () => {
    for (const [d, def] of Object.entries(DISTRICTS)) {
      const houses = def.build().props.filter(p => p.kind === "house").length;
      expect(all.filter(h => h.district === d)).toHaveLength(houses);
    }
    expect(all.every(h => h.folk.length >= 1 && h.people > 0)).toBe(true);
  });

  it("houses every named family with a seat exactly once, in the kind of house it asked for", () => {
    for (const f of FAMILIES.filter(f => f.seat)) {
      const homes = all.filter(h => h.family === f);
      expect(homes, f.id).toHaveLength(1);
      const { house } = homes[0]!, seat = f.seat!;
      if (seat.tile) expect([house.rect.x / T, house.rect.y / T], f.id).toEqual(seat.tile);
      if (seat.shop) expect(house.shop, f.id).toBe(seat.shop);
      if (!seat.shop) expect(house.shop, f.id).toBeUndefined();
    }
  });

  it("gives every family a unique id", () => {
    expect(new Set(FAMILIES.map(f => f.id)).size).toBe(FAMILIES.length);
  });

  it("ties every family to others that exist, and gives each a rumour", () => {
    const ids = new Set(FAMILIES.map(f => f.id));
    for (const f of FAMILIES) {
      expect(f.ties.length, f.id).toBeGreaterThan(0);
      expect(f.rumours.length, f.id).toBeGreaterThan(0);
      for (const t of f.ties) {
        expect(ids.has(t.to), `${f.id} -> ${t.to}`).toBe(true);
        expect(t.to, f.id).not.toBe(f.id);
      }
    }
  });

  it("comes to about the 1,500 souls the lore gives", () => {
    const total = all.reduce((s, h) => s + h.people, 0) + BEYOND_HOUSES;
    expect(total).toBeGreaterThan(1200);
    expect(total).toBeLessThan(1800);
  });
});
