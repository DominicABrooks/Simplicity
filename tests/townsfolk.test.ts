import { describe, expect, it } from "vitest";
import { loadArea } from "../src/areas/index.ts";
import { area as capital } from "../src/areas/capital.ts";
import { area as castle } from "../src/areas/castle.ts";
import { area as kingsroad } from "../src/areas/kingsroad.ts";
import type { Entity } from "../src/core/ecs.ts";
import { TOWNSFOLK } from "../src/data/townsfolk.ts";
import { HALF, T, Tile } from "../src/data/world.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { startTalk, talking } from "../src/game/talk.ts";
import { isCommoner, populate, residentById, setCensus, updateTownsfolk, walkersOf } from "../src/game/townsfolk.ts";
import { enterArea } from "../src/game/travel.ts";
import { FAMILIES } from "../src/world/people.ts";
import { residentsOf } from "../src/world/residents.ts";
import { doorOf, findPath, nearestWalkable, walkable, walkwaysOf } from "../src/world/walkways.ts";

const people = setCensus(residentsOf({ capital: capital.build().props, castle: castle.build().props, kingsroad: kingsroad.build().props }));
const DT = 1 / 30;

/** In an area at an hour of the day, its streets filled. */
async function inArea(id: string, hour = 12): Promise<Game> {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  (g as unknown as { hour: number }).hour = hour;
  enterArea(g, await loadArea(id), id === "castle" ? "town" : id === "kingsroad" ? "gate" : "southgate");
  populate(g, people);
  return g;
}
const folk = (g: Game) => g.world.query("walker", "transform", "targetable");
const run = (g: Game, seconds: number) => { for (let t = 0; t < seconds; t += DT) updateTownsfolk(g, DT); };
const tileUnder = (t: { x: number; y: number }) => [Math.floor((t.x + HALF) / T), Math.floor((t.y + HALF) / T)] as const;
const capAt = (area: string, hour: number) => Math.round((TOWNSFOLK.out[area] ?? 0) * TOWNSFOLK.busy[hour]!);
const home = (r: { home: { area: string; place: string } }) => `${r.home.area}|${r.home.place}`;

describe("walkways", () => {
  const built = capital.build(), map = built.map, ways = walkwaysOf(map);
  it("are the open tiles: streets and grass, never water, trees or anything built", () => {
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
      const t = map.tiles[y]![x]!;
      if (t === Tile.Water || t === Tile.Tree || t === Tile.Wall) expect(walkable(ways, x, y)).toBe(false);
    }
    expect(ways.streets.length).toBeGreaterThan(1000);
  });

  it("lead from every house door in the Market Quarter to the square", () => {
    const square = nearestWalkable(ways, 40, 34)!, houses = built.props.filter(p => p.kind === "house");
    let reached = 0;
    for (const h of houses) {
      const door = doorOf(ways, built.props, Math.floor(h.rect.x / T) + 1, Math.floor(h.rect.y / T) + 1);
      if (door && findPath(ways, door, square)) reached++;
    }
    expect(reached).toBe(houses.length);
  });
});

describe("townsfolk", () => {
  it("are the city's common people, never the royal or noble families, the court or the soldiers", () => {
    const highborn = new Set(FAMILIES.filter(f => f.rank === "royal" || f.rank === "noble").map(f => f.id));
    const walkers = walkersOf(people, "capital");
    expect(walkers.length).toBeGreaterThan(300);
    for (const r of walkers) {
      expect(isCommoner(r)).toBe(true);
      expect(r.role === "family" && r.family && highborn.has(r.family)).toBeFalsy();
      expect(["soldier", "courtier", "prisoner"]).not.toContain(r.role);
    }
  });

  it("fill the streets by day, each by their own name, standing on walkable ground", async () => {
    const g = await inArea("capital", 12), ways = walkwaysOf(g.map), all = folk(g);
    expect(all.length).toBeGreaterThanOrEqual(capAt("capital", 12));
    expect(all.length).toBeLessThanOrEqual(capAt("capital", 12) + 2);   // a party may tip it over by a child or two
    const names = new Set<string>();
    for (const [, { walker, transform, targetable }] of all) {
      expect(targetable.name).toBe(residentById(walker.id)!.name);
      expect(walkable(ways, ...tileUnder(transform))).toBe(true);
      names.add(targetable.name);
    }
    expect(names.size).toBe(all.length);
  });

  it("are all but gone at night", async () => {
    const g = await inArea("capital", 3);
    expect(folk(g).length).toBeLessThanOrEqual(capAt("capital", 3) + 2);
    expect(capAt("capital", 3)).toBeLessThan(capAt("capital", 12) / 5);
  });

  it("go about the day: stallholders behind their own stalls facing out, buyers in front facing them", async () => {
    const g = await inArea("capital", 10), stalls = g.area.layout.props.flatMap(p => (p.kind === "stall" ? [p] : []));
    run(g, 90);
    const side = (x: number, y: number, dir: 1 | -1) => stalls.find(s => x >= s.rect.x / T && x < (s.rect.x + s.rect.w) / T && y === s.rect.y / T + dir * (s.facing === "south" ? 1 : -1));
    let vendors = 0, buyers = 0;
    for (const [, { walker, transform }] of folk(g)) {
      if (walker.moving || walker.follow) continue;
      const [x, y] = tileUnder(transform), out = (s: { facing: string }) => (s.facing === "south" ? Math.PI / 2 : -Math.PI / 2);
      const behind = walker.plan === "work" ? side(x, y, -1) : undefined, before = walker.plan === "shop" ? side(x, y, 1) : undefined;
      if (behind) { vendors++; expect(walker.facing).toBeCloseTo(out(behind)); }
      if (before) { buyers++; expect(walker.facing).toBeCloseTo(-out(before)); }
    }
    expect(vendors).toBeGreaterThan(0);
    expect(buyers + vendors).toBeGreaterThan(1);
  });

  it("go to the inns of an evening", async () => {
    const g = await inArea("capital", 19);
    run(g, 120);
    expect(folk(g).some(([, { walker }]) => walker.plan === "drink")).toBe(true);
  });

  it("never let a child out alone: with a grown-up of their own house, or with children near their age", async () => {
    for (const hour of [10, 14]) {
      const g = await inArea("capital", hour);
      const check = () => {
        const all = folk(g), followers = new Map<Entity, number>();
        for (const [, { walker }] of all) if (walker.follow) followers.set(walker.follow.leader, (followers.get(walker.follow.leader) ?? 0) + 1);
        for (const [e, { walker }] of all) {
          const kid = residentById(walker.id)!;
          if (kid.age >= 14) continue;
          if (walker.follow) {
            const leader = residentById(g.world.need(walker.follow.leader, "walker").id)!;
            if (leader.age >= 14) expect(home(leader)).toBe(home(kid));        // a grown-up of their own house
            else expect(Math.abs(leader.age - kid.age)).toBeLessThanOrEqual(3); // or the oldest of their band
          } else if (walker.plan !== "home") expect(followers.get(e) ?? 0).toBeGreaterThan(0);   // leading their band (alone only on the way home)
        }
      };
      check();
      for (let i = 0; i < 6; i++) { run(g, 10); check(); }
    }
    const g = await inArea("capital", 11);
    expect(folk(g).some(([, { walker }]) => residentById(walker.id)!.age < 14)).toBe(true);
  });

  it("walk about, go in, and others come out, never far over what the hour holds", async () => {
    const g = await inArea("capital", 12), first = new Set(folk(g).map(([, { walker }]) => walker.id));
    for (let t = 0; t < 120; t += DT) {
      updateTownsfolk(g, DT);
      expect(folk(g).length).toBeLessThanOrEqual(capAt("capital", 12) + 3);
    }
    expect(folk(g).some(([, { walker }]) => !first.has(walker.id))).toBe(true);
  });

  it("are out in the castle and on the King's Bridge too", async () => {
    expect(folk(await inArea("castle")).length).toBeGreaterThan(0);
    expect(folk(await inArea("kingsroad")).length).toBeGreaterThan(0);
  });

  it("stop to talk, and say who they are", async () => {
    const g = await inArea("capital"), [e, { walker, transform }] = folk(g).find(([, { walker }]) => residentById(walker.id)!.age >= 16 && !walker.follow)!;
    Object.assign(g.world.need(g.player, "transform"), { x: transform.x, y: transform.y + 10 });
    expect(startTalk(g, e)).toBe(true);
    expect(talking(g)!.name).toBe(residentById(walker.id)!.name);
    const at = { ...transform };
    run(g, 2);
    expect(g.world.need(e, "transform")).toEqual(at);                                    // they stand still while you talk
  });
});
