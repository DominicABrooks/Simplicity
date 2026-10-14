// Everyone in Kingsholm, one by one: the census adds up, every named person is in it once, everyone in a
// house is inside that house, and everyone stands somewhere real on the map.
import { describe, expect, it } from "vitest";
import { area as capital } from "../src/areas/capital.ts";
import { area as castle } from "../src/areas/castle.ts";
import { area as kingsroad } from "../src/areas/kingsroad.ts";
import { T } from "../src/data/world.ts";
import { BEYOND_HOUSES, FAMILIES, householdsOf } from "../src/world/people.ts";
import { departedOf, residentsOf, type CityProps } from "../src/world/residents.ts";
import { gravePlan } from "../src/world/solids.ts";

const layouts = { capital: capital.build(), castle: castle.build(), kingsroad: kingsroad.build() };
const props: CityProps = { capital: layouts.capital.props, castle: layouts.castle.props, kingsroad: layouts.kingsroad.props };
const people = residentsOf(props);
const households = (["capital", "castle"] as const).flatMap(d => householdsOf(d, props[d]));
const gone = FAMILIES.flatMap(f => f.members.filter(m => m.gone));
const dead = departedOf(props, people);

describe("the residents of Kingsholm", () => {
  it("counts everyone the households and institutions hold, and the prisoners", () => {
    const population = households.reduce((s, h) => s + h.people, 0) + BEYOND_HOUSES;
    expect(people).toHaveLength(population + gone.length);
    expect(people.filter(r => r.prisoner)).toHaveLength(gone.length);
  });

  it("gives everyone a unique id, a sensible age and two different traits", () => {
    expect(new Set(people.map(r => r.id)).size).toBe(people.length);
    for (const r of people) {
      expect(r.age, r.name).toBeGreaterThanOrEqual(0);
      expect(r.age, r.name).toBeLessThan(100);
      expect(r.traits[0], r.name).not.toBe(r.traits[1]);
    }
  });

  it("includes every named family member exactly once", () => {
    for (const f of FAMILIES) for (const m of f.members) {
      expect(people.filter(r => r.family === f.id && r.name === m.name), `${f.id}: ${m.name}`).toHaveLength(1);
    }
  });

  it("puts each household inside its own house (the inns have guests too)", () => {
    for (const h of households) {
      const r = h.house.rect, x0 = r.x / T, y0 = r.y / T;
      const inside = people.filter(p => !p.prisoner && p.role !== "guest" && p.home.area === h.district && p.home.x >= x0 && p.home.x < x0 + r.w / T && p.home.y >= y0 && p.home.y < y0 + r.h / T && p.home.floor !== undefined && p.home.floor < h.house.storeys);
      expect(inside.length, `house at ${x0},${y0}`).toBe(h.people);
    }
  });

  it("stands everyone somewhere on their area's map, at home and by day", () => {
    for (const r of people) for (const s of [r.home, r.day]) {
      const map = layouts[s.area].map;
      expect(s.x >= 0 && s.x < map.width && s.y >= 0 && s.y < map.height, `${r.name} at ${s.place}`).toBe(true);
    }
  });

  it("never gives two people the same name, living or dead", () => {
    const names = [...people, ...dead].map(r => r.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("buries someone in every grave, each born before they died", () => {
    const graves = (["capital", "castle"] as const).flatMap(a => props[a].flatMap(p => (p.kind === "graves" ? gravePlan(p.rect) : [])));
    expect(dead.filter(d => d.grave.marker >= 0)).toHaveLength(graves.length);
    for (const d of dead) {
      expect(d.born, d.name).toBeLessThan(d.died);
      expect(d.died, d.name).toBeLessThanOrEqual(600);
      if (d.grave.marker === 5) expect(d.died, `${d.name} is fresh`).toBe(600);
    }
  });

  it("makes the same people every time", () => {
    expect(residentsOf(props)).toEqual(people);
    expect(departedOf(props, people)).toEqual(dead);
  });
});
