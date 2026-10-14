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
import { endTalk, startTalk, talking } from "../src/game/talk.ts";
import { isCommoner, isDoor, knock, populate, residentById, setCensus, updateTownsfolk, walkersOf, whoIsHome } from "../src/game/townsfolk.ts";
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

describe("knocking at doors", () => {
  const doorsOf = (g: Game) => g.world.entities().flatMap(e => (isDoor(e) ? [e] : []));
  const standAt = (g: Game, door: Entity, d = 6) => { const t = g.world.need(door, "transform"); Object.assign(g.world.need(g.player, "transform"), { x: t.x, y: t.y + d }); };
  const toasts = (g: Game) => { const said: string[] = []; g.events.on("toast", ({ text }) => said.push(text)); return said; };

  it("every house with people in it has a door to knock at, named for the house", async () => {
    const g = await inArea("capital", 12), all = doorsOf(g);
    expect(all.length).toBeGreaterThan(60);
    for (const d of all) expect(g.world.need(d, "targetable").name).toMatch(/^[A-Z]/);
    expect(all.some(d => /house$/.test(g.world.need(d, "targetable").name))).toBe(true);
    expect(all.some(d => /^The (Crown|Bell)/.test(g.world.need(d, "targetable").name))).toBe(true);
  });

  it("only ever brings someone who lives there and is home right now; an empty house, nobody", async () => {
    const g = await inArea("capital", 12), said = toasts(g);
    let answered = 0, empty = 0;
    for (const door of doorsOf(g)) {
      const out = new Set(folk(g).map(([, { walker }]) => walker.id)), home = whoIsHome(g, door), name = g.world.need(door, "targetable").name;
      for (const r of home) {
        expect(out.has(r.id)).toBe(false);                                         // not out in the streets
        expect(r.day.area === r.home.area && r.day.x === r.home.x && r.day.y === r.home.y).toBe(true);   // at noon, only those who spend the day at home
      }
      const before = new Set(folk(g).map(([e]) => e));
      standAt(g, door);
      knock(g, door);
      run(g, TOWNSFOLK.knock.answer + 0.1);
      const came = folk(g).find(([e, { walker }]) => !before.has(e) && walker.plan === "answer");
      if (came) {
        answered++;
        expect(home.map(r => r.id)).toContain(came[1].walker.id);                  // one of the household, at home
      } else if (!home.some(r => r.age >= 10)) {
        empty++;
        expect(said[said.length - 1]).toBe(`No answer at ${name}.`);                // nobody in: nobody comes
      }
      g.world.need(g.player, "transform").y += 60;                                // walk off; whoever came goes back in
      run(g, 0.2);
    }
    expect(answered).toBeGreaterThan(0);
    expect(empty).toBeGreaterThan(0);
  });

  it("brings them to stand in the doorway facing you, and they go back in when you go", async () => {
    const g = await inArea("capital", 20), said = toasts(g);                    // evening: most are in
    let answered: Entity | null = null;
    for (const door of doorsOf(g)) {
      if (!whoIsHome(g, door).length) continue;
      const before = new Set(folk(g).map(([e]) => e));
      standAt(g, door);
      knock(g, door);
      run(g, TOWNSFOLK.knock.answer + 0.1);
      answered = folk(g).find(([e, { walker }]) => !before.has(e) && walker.plan === "answer")?.[0] ?? null;
      if (answered) break;
    }
    expect(answered).not.toBeNull();
    const w = g.world.need(answered!, "walker"), t = { ...g.world.need(answered!, "transform") }, hero = g.world.need(g.player, "transform");
    expect(g.target).toBe(answered);
    expect(said.some(s => s.endsWith("comes to the door."))).toBe(true);
    run(g, 1);
    expect(g.world.need(answered!, "transform")).toEqual(t);                     // stays in the doorway
    expect(w.facing).toBeCloseTo(Math.atan2(hero.y - t.y, hero.x - t.x));
    hero.y += 60;
    run(g, 0.2);
    expect(g.world.isAlive(answered!)).toBe(false);
  });

  it("knows who's out: nobody walking the streets is at home", async () => {
    const g = await inArea("capital", 12), out = new Set(folk(g).map(([, { walker }]) => walker.id));
    for (const door of doorsOf(g)) for (const r of whoIsHome(g, door)) expect(out.has(r.id)).toBe(false);
  });

  it("can't be done from afar, and late at night mostly gets no answer", async () => {
    const g = await inArea("capital", 3), said = toasts(g), [door] = doorsOf(g);
    standAt(g, door!, TOWNSFOLK.knock.reach + 12);
    expect(knock(g, door!)).toBe(true);
    expect(said).toContain("Too far away to knock");
    for (const d of doorsOf(g).slice(0, 12)) { standAt(g, d); knock(g, d); run(g, TOWNSFOLK.knock.answer + 0.1); g.world.need(g.player, "transform").y += 60; run(g, 0.1); }
    expect(said.some(s => /No answer at .*asleep/.test(s))).toBe(true);
  });

  it("isn't anything but a door", async () => {
    const g = await inArea("capital", 12), [e] = folk(g)[0]!;
    expect(knock(g, e)).toBe(false);
    expect(knock(g, null)).toBe(false);
  });
});

describe("talking to one of a party on the move", () => {
  /** A child keeping with a leader who's walking somewhere a while yet, the hero beside the child. */
  async function partyOnTheMove(): Promise<{ g: Game; kid: Entity; leader: Entity }> {
    for (const hour of [10, 11, 13, 14, 15]) {
      const g = await inArea("capital", hour);
      for (let t = 0; t < 40; t += 0.5) {
        const found = folk(g).find(([, { walker }]) => {
          const lw = walker.follow && g.world.get(walker.follow.leader, "walker");
          return lw && lw.moving && lw.path.length > 8 && !walker.catchingUp;
        });
        if (found) {
          const [kid, { walker, transform }] = found;
          Object.assign(g.world.need(g.player, "transform"), { x: transform.x, y: transform.y + 8 });
          return { g, kid, leader: walker.follow!.leader };
        }
        run(g, 0.5);
      }
    }
    throw new Error("no party on the move");
  }
  /** Run, recording the furthest anyone moved in one frame (no jumping about). */
  const runWatching = (g: Game, seconds: number, who: Entity[]) => {
    let most = 0;
    for (let t = 0; t < seconds; t += DT) {
      const before = who.map(e => ({ ...g.world.need(e, "transform") }));
      updateTownsfolk(g, DT);
      who.forEach((e, i) => { const now = g.world.need(e, "transform"); most = Math.max(most, Math.hypot(now.x - before[i]!.x, now.y - before[i]!.y)); });
    }
    return most;
  };
  const withWait = async <R>(chance: number, f: () => Promise<R>) => {
    const party = TOWNSFOLK.party as { wait: number }, was = party.wait;
    party.wait = chance;
    try { return await f(); } finally { party.wait = was; }
  };

  it("mostly waits: the leader stops and watches while you talk, then they go on together", () => withWait(1, async () => {
    const { g, kid, leader } = await partyOnTheMove();
    expect(startTalk(g, kid)).toBe(true);
    run(g, DT);
    const at = { ...g.world.need(leader, "transform") };
    run(g, 2);
    expect(g.world.need(leader, "transform")).toEqual(at);                     // waiting
    expect(g.world.need(leader, "walker").holdFor).toBe(kid);
    endTalk(g);
    const jump = runWatching(g, 3, [kid, leader]);
    expect(g.world.need(leader, "walker").holdFor).toBeNull();
    expect(Math.hypot(g.world.need(leader, "transform").x - at.x, g.world.need(leader, "transform").y - at.y)).toBeGreaterThan(10);   // on their way again
    expect(jump).toBeLessThan(4);                                              // nobody teleports
    const k = g.world.need(kid, "transform"), l = g.world.need(leader, "transform");
    expect(Math.hypot(k.x - l.x, k.y - l.y)).toBeLessThan(24);                 // together
  }));

  it("or goes on without them: they say they've got to go, run after it, and won't stop to talk till they've caught up", () => withWait(0, async () => {
    const { g, kid, leader } = await partyOnTheMove();
    startTalk(g, kid);
    run(g, DT);
    const c = talking(g)!, lines = [...TOWNSFOLK.gotToGo.parent, ...TOWNSFOLK.gotToGo.band].map(l => l.split("{who}")[0]!);
    expect(c.lines).toHaveLength(1);
    expect(lines.some(l => c.lines[0]!.startsWith(l))).toBe(true);
    const at = { ...g.world.need(leader, "transform") };
    run(g, TOWNSFOLK.party.sayBye + 0.2);
    expect(Math.hypot(g.world.need(leader, "transform").x - at.x, g.world.need(leader, "transform").y - at.y)).toBeGreaterThan(5);   // didn't wait
    expect(talking(g)).toBeNull();                                             // said it, and off
    expect(g.world.need(kid, "walker").catchingUp).toBe(true);
    const floaters = g.floaters.length;
    Object.assign(g.world.need(g.player, "transform"), { ...g.world.need(kid, "transform") });
    startTalk(g, kid);                                                         // try again: no
    run(g, DT);
    expect(talking(g)).toBeNull();
    expect(g.floaters.slice(floaters).some(f => (TOWNSFOLK.brushOff as readonly string[]).includes(f.text))).toBe(true);
    const jump = runWatching(g, 8, [kid]);
    expect(jump).toBeLessThan(4);                                              // ran, didn't jump
    expect(g.world.isAlive(kid) ? g.world.need(kid, "walker").catchingUp : false).toBe(false);   // caught up (or gone in with them)
  }));
});
