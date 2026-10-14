import { describe, expect, it } from "vitest";
import { area as capital } from "../src/areas/capital.ts";
import { area as castle } from "../src/areas/castle.ts";
import { area as kingsroad } from "../src/areas/kingsroad.ts";
import { residentsOf } from "../src/world/residents.ts";
import { DYES, dressFor } from "../src/world/wardrobe.ts";

const people = residentsOf({ capital: capital.build().props, castle: castle.build().props, kingsroad: kingsroad.build().props });

describe("how people dress", () => {
  it("is kept on every one of them, and is always the same for the same person", () => {
    for (const r of people) {
      expect(r.dress).toBeDefined();
      expect(dressFor(r)).toEqual(r.dress);
    }
  });

  it("varies across the city: garments, patterns, over-garments, headwear and what they carry", () => {
    const kinds = (f: (d: (typeof people)[number]["dress"]) => string) => new Set(people.map(r => f(r.dress))).size;
    expect(kinds(d => d.garment)).toBe(7);
    expect(kinds(d => d.pattern)).toBe(3);
    expect(kinds(d => d.over)).toBe(7);
    expect(kinds(d => d.head)).toBe(10);
    expect(kinds(d => d.carry)).toBe(9);
    expect(kinds(d => d.cloth)).toBeGreaterThan(20);
    // Hardly anyone dresses exactly like anyone else.
    const outfits = new Set(people.map(r => JSON.stringify(r.dress)));
    expect(outfits.size / people.length).toBeGreaterThan(0.9);
  });

  it("suits who they are", () => {
    for (const r of people) {
      const d = r.dress, job = r.job.toLowerCase();
      if (/priest|deacon/.test(job)) { expect(d.garment).toBe("robe"); expect(DYES.clergy).toContain(d.cloth as never); }
      if (r.sex === "m" && r.age >= 14 && !/priest|deacon|chaplain|choir|warden|sexton|dean/.test(job)) expect(["gown", "kirtle"]).not.toContain(d.garment);
      if (/maid|scullion|laundress/.test(job)) expect(d.over).toBe("apron");
      if (r.age >= 60) expect(DYES.grey).toContain(d.hair as never);
      if (/pilgrim/.test(job)) expect(d.carry).toBe("staff");
    }
  });
});
