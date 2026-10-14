// Townsfolk talking to each other: who knows whom, what they say (never their own names), and two of
// them meeting in the street, stopping, turning to each other, having their say and carrying on.
import { describe, expect, it } from "vitest";
import { loadArea } from "../src/areas/index.ts";
import { area as capital } from "../src/areas/capital.ts";
import { area as castle } from "../src/areas/castle.ts";
import { area as kingsroad } from "../src/areas/kingsroad.ts";
import { Rng } from "../src/core/rng.ts";
import { CHATTER } from "../src/data/chatter.ts";
import { bondOf, chatLines, chatsNow, updateChatter } from "../src/game/chatter.ts";
import { createGame, setState } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { startTalk } from "../src/game/talk.ts";
import { populate, setCensus } from "../src/game/townsfolk.ts";
import { enterArea } from "../src/game/travel.ts";
import { residentsOf, type Resident } from "../src/world/residents.ts";

const people = setCensus(residentsOf({ capital: capital.build().props, castle: castle.build().props, kingsroad: kingsroad.build().props }));
const surname = (r: Resident) => r.name.split(" ").pop()!;
const first = (r: Resident) => r.name.replace(/^(Lord|Lady|Master|Mistress|Father|Old Mother|Old|Little|Widow|Gran)\s+/, "").replace(/"/g, "").split(" ")[0]!;
const adults = people.filter(r => r.age >= 18 && !r.prisoner && !r.family);
/** Two grown-ups under one roof with one surname. */
const [mum, dad] = (() => {
  for (const a of adults) {
    const b = adults.find(o => o.id !== a.id && o.home.place === a.home.place && o.home.area === a.home.area && surname(o) === surname(a));
    if (b) return [a, b];
  }
  throw new Error("no family in the census");
})();

describe("who knows whom", () => {
  it("family: under one roof with one name", () => expect(bondOf(mum!, dad!)).toBe("family"));

  it("friends: the named families' ties (the Fells and the Hawkes keep the falcon post)", () => {
    const fell = people.find(r => r.family === "fell" && r.role === "family" && r.age >= 14 && !r.prisoner)!;
    const hawke = people.find(r => r.family === "hawke" && r.role === "family" && r.age >= 14)!;
    expect(bondOf(fell, hawke)).toBe("friends");
  });

  it("strangers: most people, across the city", () => {
    const castleFolk = adults.filter(r => r.home.area === "castle"), quarter = adults.filter(r => r.home.area === "capital");
    const pairs = castleFolk.slice(0, 40).flatMap(a => quarter.slice(0, 40).map(b => bondOf(a, b)));
    expect(pairs.filter(b => b === null).length / pairs.length).toBeGreaterThan(0.7);
  });

  it("nobody knows themselves", () => expect(bondOf(mum!, mum!)).toBeNull());
});

describe("what they say to each other", () => {
  it("takes turns, fills every name, and nobody ever says their own name", () => {
    const rng = new Rng(9);
    for (let i = 0; i < 600; i++) {
      const a = people[rng.int(0, people.length - 1)]!, b = people[rng.int(0, people.length - 1)]!;
      if (a.id === b.id) continue;
      for (const bond of ["family", "friends", "workmates", "neighbours", "kids"] as const) {
        const lines = chatLines(rng, a, b, bond);
        expect(lines.length).toBeGreaterThanOrEqual(2);
        lines.forEach((l, n) => {
          expect(l.by).toBe(n % 2);
          expect(l.text).not.toMatch(/\{\w\}/);
          const own = l.by === 0 ? first(a) : first(b), other = l.by === 0 ? first(b) : first(a);
          if (own !== other) expect(new RegExp(`\\b${own}\\b`).test(l.text), `${own}: ${l.text}`).toBe(false);
        });
      }
    }
  });
});

describe("meeting in the street", () => {
  /** The Market Quarter at noon, with two of its walkers made into a couple standing side by side. */
  async function aCouple() {
    const g = createGame();
    resetGame(g);
    setState(g, "play");
    (g as unknown as { hour: number }).hour = 12;
    enterArea(g, await loadArea("capital"), "southgate");
    populate(g, people);
    const [[a, wa], [b, wb]] = g.world.query("walker", "transform").filter(([, { walker }]) => !walker.follow).slice(0, 2).map(([e, c]) => [e, c] as const);
    wa!.walker.id = mum!.id;
    wb!.walker.id = dad!.id;
    Object.assign(wb!.transform, { x: wa!.transform.x + 6, y: wa!.transform.y });
    // Nobody else nearby to chat instead.
    for (const [e, { transform }] of g.world.query("walker", "transform")) if (e !== a && e !== b) transform.x += 4000;
    return { g, a: a!, b: b!, wa: wa!.walker, wb: wb!.walker };
  }
  const run = (g: Parameters<typeof updateChatter>[0], seconds: number) => { for (let t = 0; t < seconds; t += 1 / 30) updateChatter(g, 1 / 30); };
  const theirs = (g: Parameters<typeof updateChatter>[0], a: number) => chatsNow(g).find(c => c.who.includes(a));

  it("they stop, face each other, say their lines one at a time, and carry on", async () => {
    const { g, a, wa, wb } = await aCouple();
    run(g, 6);
    expect(theirs(g, a)).toBeDefined();
    expect(wa.moving).toBe(false);
    expect(wb.moving).toBe(false);
    expect(Math.abs(Math.abs(wa.facing - wb.facing) - Math.PI)).toBeLessThan(0.01);    // face to face
    const lines = theirs(g, a)!.lines.map(l => l.text);
    expect(g.floaters.some(f => lines.includes(f.text) && f.color === CHATTER.color)).toBe(true);
    run(g, lines.length * CHATTER.gap + 2);
    expect(theirs(g, a)).toBeUndefined();
  });

  it("stop if the hero starts talking to one of them", async () => {
    const { g, a } = await aCouple();
    run(g, 6);
    expect(theirs(g, a)).toBeDefined();
    Object.assign(g.world.need(g.player, "transform"), { ...g.world.need(a, "transform") });
    startTalk(g, a);
    run(g, 0.1);
    expect(theirs(g, a)).toBeUndefined();
  });

  it("don't stop again straight away", async () => {
    const { g, a } = await aCouple();
    run(g, 6);
    const lines = theirs(g, a)!.lines.length;
    run(g, lines * CHATTER.gap + 2);
    run(g, 20);
    expect(theirs(g, a)).toBeUndefined();
  });
});
