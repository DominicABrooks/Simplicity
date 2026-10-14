import { describe, expect, it } from "vitest";
import { loadArea } from "../src/areas/index.ts";
import { area as capital } from "../src/areas/capital.ts";
import { area as castle } from "../src/areas/castle.ts";
import { area as kingsroad } from "../src/areas/kingsroad.ts";
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

async function inArea(id: string): Promise<Game> {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  enterArea(g, await loadArea(id), id === "castle" ? "town" : id === "kingsroad" ? "gate" : "southgate");
  populate(g, people);
  return g;
}
const folk = (g: Game) => g.world.query("walker", "transform", "targetable");
const tileUnder = (_g: Game, t: { x: number; y: number }) => [Math.floor((t.x + HALF) / T), Math.floor((t.y + HALF) / T)] as const;

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
    const square = nearestWalkable(ways, 40, 34)!;
    const houses = built.props.filter(p => p.kind === "house");
    let reached = 0;
    for (const h of houses) {
      const door = doorOf(ways, built.props, Math.floor(h.rect.x / T) + 1, Math.floor(h.rect.y / T) + 1);
      if (door && findPath(ways, door, square)) reached++;
    }
    expect(reached / houses.length).toBeGreaterThan(0.95);
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

  it("fill the streets, each by their own name, standing on walkable ground", async () => {
    const g = await inArea("capital"), ways = walkwaysOf(g.map), all = folk(g);
    expect(all.length).toBe(TOWNSFOLK.out.capital);
    const names = new Set<string>();
    for (const [, { walker, transform, targetable }] of all) {
      const r = residentById(walker.id)!;
      expect(targetable.name).toBe(r.name);
      expect(targetable.hostile).toBe(false);
      expect(walkable(ways, ...tileUnder(g, transform))).toBe(true);
      names.add(r.name);
    }
    expect(names.size).toBe(all.length);
  });

  it("walk about, go in, and others come out, never more than the area holds", async () => {
    const g = await inArea("capital"), ways = walkwaysOf(g.map), first = new Set(folk(g).map(([, { walker }]) => walker.id));
    const start = new Map(folk(g).map(([e, { transform }]) => [e, { ...transform }]));
    let moved = 0;
    for (let t = 0; t < 120; t += 1 / 30) {
      updateTownsfolk(g, 1 / 30);
      expect(folk(g).length).toBeLessThanOrEqual(TOWNSFOLK.out.capital);
      if (t > 1 && t < 1.05) for (const [e, { transform }] of folk(g)) { const s = start.get(e); if (s && (s.x !== transform.x || s.y !== transform.y)) moved++; }
    }
    expect(moved).toBeGreaterThan(TOWNSFOLK.out.capital / 2);
    const now = folk(g);
    expect(now.some(([, { walker }]) => !first.has(walker.id))).toBe(true);          // someone new came out
    for (const [, { transform }] of now) expect(walkable(ways, ...tileUnder(g, transform))).toBe(true);
  });

  it("are out in the castle and on the King's Bridge too", async () => {
    expect(folk(await inArea("castle")).length).toBeGreaterThan(0);
    expect(folk(await inArea("kingsroad")).length).toBeGreaterThan(0);
  });

  it("stop to talk, and say who they are", async () => {
    const g = await inArea("capital"), [e, { walker, transform }] = folk(g).find(([, { walker }]) => residentById(walker.id)!.age >= 12)!;
    Object.assign(g.world.need(g.player, "transform"), { x: transform.x, y: transform.y + 10 });
    expect(startTalk(g, e)).toBe(true);
    const r = residentById(walker.id)!, c = talking(g)!;
    expect(c.name).toBe(r.name);
    expect(c.lines[0]).toContain(`I'm ${r.name.split(" ")[0]}.`);
    const at = { ...transform };
    for (let i = 0; i < 60; i++) updateTownsfolk(g, 1 / 30);
    expect(g.world.need(e, "transform")).toEqual(at);                                    // they stand still while you talk
  });
});
