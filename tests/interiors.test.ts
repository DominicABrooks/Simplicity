import { describe, expect, it } from "vitest";
import { loadArea } from "../src/areas/index.ts";
import { area as capital } from "../src/areas/capital.ts";
import { area as castle } from "../src/areas/castle.ts";
import { area as kingsroad } from "../src/areas/kingsroad.ts";
import type { Entity } from "../src/core/ecs.ts";
import { TOWNSFOLK } from "../src/data/townsfolk.ts";
import { HALF, T } from "../src/data/world.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { enterInterior } from "../src/game/interiors.ts";
import { resetGame } from "../src/game/reset.ts";
import { endTalk, startTalk, talking } from "../src/game/talk.ts";
import { isDoor, knock, populate, residentById, setCensus, updateTownsfolk, whoIsHome } from "../src/game/townsfolk.ts";
import { enterArea } from "../src/game/travel.ts";
import { interiorOf } from "../src/world/interiors.ts";
import { residentsOf } from "../src/world/residents.ts";
import { doorKey, doorStep } from "../src/world/townkit.ts";
import { findPath, nearestWalkable, walkwaysOf } from "../src/world/walkways.ts";

const people = setCensus(residentsOf({ capital: capital.build().props, castle: castle.build().props, kingsroad: kingsroad.build().props }));
const DT = 1 / 30;
const run = (g: Game, seconds: number) => { for (let t = 0; t < seconds; t += DT) updateTownsfolk(g, DT); };

describe("the inside of a house", () => {
  const outside = capital.build(), houses = outside.props.flatMap(p => (p.kind === "house" ? [p] : []));
  const lives = (h: (typeof houses)[number]) => people.filter(r => r.home.area === "capital" && r.home.x * T >= h.rect.x && r.home.y * T >= h.rect.y && r.home.x * T < h.rect.x + h.rect.w && r.home.y * T < h.rect.y + h.rect.h);

  it("has a room with a door, a hearth, a table and beds, and walking out its door is the step outside the house", () => {
    const house = houses[10]!, household = lives(house), { def } = interiorOf("capital", house, household, "The house");
    const inside = def.build(), kinds = inside.props.map(p => (p.kind === "furniture" ? p.item : p.kind));
    expect(def.indoors).toBe(true);
    expect(kinds).toEqual(expect.arrayContaining(["room", "hearth", "table", "bench", "bed", "rug"]));
    expect(inside.exits).toHaveLength(1);
    expect(inside.exits[0]!.to).toEqual({ area: "capital", entry: doorKey(house) });
    expect(doorStep(outside, doorKey(house))).toBeDefined();               // there's a step outside to come out on
    const ways = walkwaysOf(inside.map), from = inside.entries.in!, exit = inside.exits[0]!.rect;
    const a = nearestWalkable(ways, (from.x + HALF) / T - 0.5, (from.y + HALF) / T - 0.5, 1)!, b = nearestWalkable(ways, (exit.x + exit.w / 2) / T - 0.5, (exit.y + exit.h / 2) / T - 0.5, 1)!;
    expect(findPath(ways, a, b)).not.toBeNull();                          // in at the door, and out again
  });

  it("is an inn's hall at the Crown: a counter, barrels and long tables, no beds", () => {
    const crown = houses.find(h => lives(h).some(r => r.family === "maddox"))!;
    const kinds = interiorOf("capital", crown, lives(crown), "The Crown").def.build().props.map(p => (p.kind === "furniture" ? p.item : p.kind));
    expect(kinds).toEqual(expect.arrayContaining(["counter", "barrel", "table", "bench", "hearth"]));
    expect(kinds).not.toContain("bed");
  });
});

describe("being asked in", () => {
  const invite = TOWNSFOLK.invite as unknown as Record<string, number>;
  async function askedIn(chance: number) {
    const was = { ...invite };
    for (const k of ["inn", "cheerful", "day", "nervous"]) invite[k] = chance;
    try {
      const g = createGame();
      resetGame(g);
      setState(g, "play");
      (g as unknown as { hour: number }).hour = 18.5;                      // home from work, not yet abed
      enterArea(g, await loadArea("capital"), "southgate");
      populate(g, people);
      for (const door of g.world.entities().filter(e => isDoor(e))) {
        if (!whoIsHome(g, door).some(r => r.age >= 16 && r.stance !== "informer")) continue;
        const before = new Set(g.world.query("walker").map(([e]) => e)), t = g.world.need(door, "transform");
        Object.assign(g.world.need(g.player, "transform"), { x: t.x, y: t.y + 6 });
        knock(g, door);
        run(g, TOWNSFOLK.knock.answer + 0.1);
        const came = g.world.query("walker").find(([e, { walker }]) => !before.has(e) && walker.plan === "answer");
        if (!came || residentById(came[1].walker.id)!.age < 16) { g.world.need(g.player, "transform").y += 60; run(g, 0.2); continue; }
        const home = whoIsHome(g, door).map(r => r.id).concat(came[1].walker.id);
        startTalk(g, came[0]);
        run(g, DT);
        return { g, door, who: came[0] as Entity, home, lines: [...talking(g)!.lines] };
      }
      throw new Error("nobody grown came to any door");
    } finally { Object.assign(invite, was); }
  }

  it("asks you in, and the door says so", async () => {
    const { g, door, lines } = await askedIn(1);
    expect(lines.some(l => ([...TOWNSFOLK.atTheDoor.come, ...TOWNSFOLK.atTheDoor.comeInn] as string[]).includes(l))).toBe(true);
    expect(g.world.need(door, "targetable").name).toMatch(/\(go in\)$/);
  });

  it("lets you in at the door again, with whoever was home inside to talk to, and out again onto the step", async () => {
    const { g, door, home } = await askedIn(1);
    endTalk(g);
    expect(knock(g, door)).toBe(true);
    expect(g.state).toBe("travel");
    const to = g.travel!;
    expect(to.area).toMatch(/^inside:capital:/);
    const inside = await loadArea(to.area);
    enterArea(g, inside, to.entry);
    enterInterior(g);
    expect(g.area.def.indoors).toBe(true);
    const there = g.world.query("walker", "targetable").map(([, { walker }]) => walker.id);
    const was = [...new Set(home)];
    for (const id of there) expect(was).toContain(id);                       // only who was home...
    const inn = g.area.layout.props.some(p => p.kind === "furniture" && p.item === "counter");
    expect(there.length).toBe(Math.min(was.length, inn ? 12 : 7));                      // ...as many as there's room for (the rest are upstairs)
    expect(new Set(there).size).toBe(there.length);
    // Out through the door: the step outside the house.
    const exit = g.area.layout.exits[0]!;
    enterArea(g, await loadArea(exit.to.area), exit.to.entry);
    expect(g.area.def.id).toBe("capital");
    expect(g.world.need(g.player, "transform")).toEqual(doorStep(g.area.layout, exit.to.entry));   // on the step outside that door
  });

  it("without being asked, knocking again only knocks", async () => {
    const { g, door } = await askedIn(0);
    endTalk(g);
    run(g, TOWNSFOLK.doorstep.shut + 0.3);
    knock(g, door);
    expect(g.state).toBe("play");
    expect(g.world.need(door, "targetable").name).not.toMatch(/go in/);
  });
});
