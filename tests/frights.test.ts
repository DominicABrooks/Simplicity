// The townsfolk remember being frightened after dark: who ran remembers what it was, where and when, and tells the
// hero about it next time he talks to them, in their own voice and by their stance on the Edict, then less and less.
import { describe, expect, it } from "vitest";
import { area as capitalArea } from "../src/areas/capital.ts";
import { area as castleArea } from "../src/areas/castle.ts";
import { area as kingsroadArea } from "../src/areas/kingsroad.ts";
import { loadArea } from "../src/areas/index.ts";
import { SECONDS_PER_HOUR } from "../src/data/daylight.ts";
import type { EerieId } from "../src/data/eerie.ts";
import { AFTER, FRIGHT_MEMORY, FRIGHT_PLACES, FRIGHT_TALK, KID_AFTER, OPENERS, WHEN } from "../src/data/frighttalk.ts";
import { HALF, T } from "../src/data/world.ts";
import { voiceOf } from "../src/game/conversation.ts";
import { eerieSystem, startEerie } from "../src/game/eerie.ts";
import { frightLines, frightOf, placeOf, rememberFright, tickFrights, whenOf } from "../src/game/frights.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { startTalk } from "../src/game/talk.ts";
import { populate, residentById, setCensus, updateTownsfolk } from "../src/game/townsfolk.ts";
import { enterArea } from "../src/game/travel.ts";
import { residentsOf, type Resident } from "../src/world/residents.ts";

const people = setCensus(residentsOf({ capital: capitalArea.build().props, castle: castleArea.build().props, kingsroad: kingsroadArea.build().props }));
const grown = people.filter(r => r.age >= 16 && !r.prisoner);
const DT = 1 / 30;
const IDS = Object.keys(FRIGHT_TALK) as EerieId[];

async function inCapital(hour: number): Promise<Game> {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  enterArea(g, await loadArea("capital"), "southgate");
  g.hour = hour;
  return g;
}
/** Let this many hours go by on the clock they remember by. */
const pass = (g: Game, hours: number) => tickFrights(g, hours * SECONDS_PER_HOUR);
const square = { x: 48 * T, y: 36 * T };
/** Every line any of them could say about this fright, with the place and time filled in any way. */
const anyOf = (lines: readonly string[]) => lines.map(l => new RegExp(`^${l.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\\?\{[wW]h(ere|en)\\?\}/g, ".+")}$`));
const matches = (line: string, lines: readonly string[]) => anyOf(lines).some(re => re.test(line));

describe("what the townsfolk have to say about a fright", () => {
  it("has a few dozen lines for every fright, and every place and time fills in", () => {
    for (const id of IDS) {
      const t = FRIGHT_TALK[id], own = t.saw.length + Object.values(t.take).flat().length + t.again.length + t.kid.length;
      expect(own).toBeGreaterThanOrEqual(30);
      expect(t.saw.length).toBeGreaterThanOrEqual(10);
      for (const take of Object.values(t.take)) expect(take.length).toBeGreaterThanOrEqual(3);
      for (const line of [...t.saw, ...Object.values(t.take).flat(), ...t.again, ...t.kid]) expect(line).not.toMatch(/\{(?!where|Where|when|When)/);
    }
    expect(AFTER.length).toBeGreaterThanOrEqual(10);
  });

  it("names the Market Quarter's places, and the wild by name", async () => {
    const g = await inCapital(0);
    expect(placeOf(g, { x: 48 * T, y: 36 * T })).toBe("in the market square");
    expect(placeOf(g, { x: 59 * T, y: 41 * T })).toBe("by the well in the square");
    expect(placeOf(g, { x: 48 * T, y: 62 * T })).toBe("on the high street");
    expect(placeOf(g, { x: 48 * T, y: 10 * T })).toBe("on Castle Street");
    expect(placeOf(g, { x: 80 * T, y: 40 * T })).toBe("on East Street");
    expect(placeOf(g, { x: 85 * T, y: 10 * T })).toBe(FRIGHT_PLACES.capital!.else);
  });

  it("is the whole story the first time: what they saw, where, and what they make of it", async () => {
    const g = await inCapital(0);
    for (const id of IDS) for (const r of grown.slice(0, 60)) {
      rememberFright(g, [r.id], id, square);
      const lines = frightLines(g, r, voiceOf(r)), t = FRIGHT_TALK[id];
      const saw = lines.find(l => matches(l, t.saw));
      expect(saw).toBeDefined();                               // what it was, always
      if (/\{where\}/i.test(t.saw.find(l => matches(saw!, [l]))!)) expect(saw!.toLowerCase()).toContain("in the market square");
      if (voiceOf(r) !== "shy") expect(lines.some(l => matches(l, Object.values(t.take).flat()))).toBe(true);
      if (voiceOf(r) === "gruff") {                            // what it was and what they think, and (still running) that they saw it
        expect(lines.length).toBeLessThanOrEqual(3);
        expect(lines.some(l => AFTER.includes(l))).toBe(false);
      }
      for (const l of lines) expect(l).not.toMatch(/\{/);
    }
  });

  it("depends on where they stand on the Edict: deniers deny it, informers report it, whisperers know what it means", async () => {
    const g = await inCapital(0);
    const byStance = (stance: Resident["stance"]) => grown.filter(r => r.stance === stance && voiceOf(r) !== "shy");
    for (const [stance, take] of [["denies", "deny"], ["loyal", "deny"], ["quiet", "shaken"], ["whispering", "hushed"], ["defiant", "defiant"], ["informer", "informer"]] as const) {
      for (const r of byStance(stance).slice(0, 10)) {
        rememberFright(g, [r.id], "watcher", square);
        const lines = frightLines(g, r, voiceOf(r));
        expect(lines.some(l => FRIGHT_TALK.watcher.take[take].includes(l))).toBe(true);
        if (take === "deny") expect(lines.some(l => AFTER.includes(l))).toBe(false);   // nothing to do about nothing
      }
    }
  });

  it("is told differently every time: many different tellings of the same fright", async () => {
    const g = await inCapital(0), told = new Set<string>();
    for (const r of grown.slice(0, 200)) {
      rememberFright(g, [r.id], "well", square);
      told.add(frightLines(g, r, voiceOf(r)).join(" | "));
    }
    expect(told.size).toBeGreaterThan(150);
  });

  it("goes by how long ago it was: just now, earlier tonight, last night, the other night, then not at all", async () => {
    const g = await inCapital(23), r = grown[0]!;
    rememberFright(g, [r.id], "lamp", square);
    const f = () => frightOf(g, r.id)!;
    expect(whenOf(g, f())).toBe("now");
    pass(g, 1);
    expect(whenOf(g, f())).toBe("tonight");
    pass(g, 12);                                               // the next day
    expect(whenOf(g, f())).toBe("lastNight");
    pass(g, 24);
    expect(whenOf(g, f())).toBe("before");
    pass(g, 24 * FRIGHT_MEMORY.days);
    expect(whenOf(g, f())).toBeNull();
    expect(frightLines(g, r, voiceOf(r))).toEqual([]);
    expect(frightOf(g, r.id)).toBeUndefined();                 // put behind them

    // Talked to the morning after, a chatty one starts with last night.
    const h = await inCapital(23), chatty = grown.find(p => voiceOf(p) === "chatty")!;
    rememberFright(h, [chatty.id], "lamp", square);
    pass(h, 10);
    const lines = frightLines(h, chatty, "chatty");
    expect(OPENERS.lastNight).toContain(lines[0]);
    expect(WHEN.lastNight).toBe("last night");
  });

  it("is brought up less after, and then not at all", async () => {
    const g = await inCapital(0);
    let again = 0;
    for (const r of grown.slice(0, 100)) {
      rememberFright(g, [r.id], "shutter", square);
      expect(frightLines(g, r, voiceOf(r)).length).toBeGreaterThan(0);
      for (let i = 1; i < FRIGHT_MEMORY.tellings; i++) {
        const later = frightLines(g, r, voiceOf(r));
        expect(later.length).toBeLessThanOrEqual(1);
        if (later.length) { again++; expect(FRIGHT_TALK.shutter.again).toContain(later[0]); }
      }
      expect(frightLines(g, r, voiceOf(r))).toEqual([]);
    }
    expect(again).toBeGreaterThan(30);
  });

  it("is a child's own version, from a child", async () => {
    const g = await inCapital(0);
    for (const r of people.filter(p => p.age >= 4 && p.age < 12).slice(0, 30)) {
      rememberFright(g, [r.id], "curfew", square);
      const lines = frightLines(g, r, voiceOf(r));
      expect(FRIGHT_TALK.curfew.kid).toContain(lines[0]);
      if (lines[1]) expect(KID_AFTER).toContain(lines[1]);
    }
  });
});

describe("talking to someone who was frightened", () => {
  it("those who ran remember it, and it's what they talk about first when the hero comes to talk", async () => {
    const g = await inCapital(12);                            // a busy street, for the test
    populate(g, people);
    for (let i = 0; i < 50; i++) updateTownsfolk(g, 0.2);
    const [first, c] = g.world.query("walker", "transform")[0]!;
    const spot = { x: c.transform.x + HALF, y: c.transform.y + HALF };
    g.hour = 0;
    Object.assign(g.world.need(g.player, "transform"), { x: spot.x - HALF, y: spot.y - HALF });
    g.world.need(g.player, "motion").moving = true;
    expect(startEerie(g, "footsteps")).toBe(true);
    eerieSystem(g, DT);
    const w = g.world.need(first, "walker");
    expect(w.fleeing).toBe(true);
    expect(frightOf(g, w.id)).toMatchObject({ id: "footsteps", told: 0 });

    g.world.need(g.player, "motion").moving = false;
    for (let t = 0; t < 2; t += DT) eerieSystem(g, DT);
    Object.assign(g.world.need(g.player, "transform"), { x: c.transform.x, y: c.transform.y + 4 });
    expect(startTalk(g, first)).toBe(true);
    const lines = g.world.need(g.player, "conversation").lines;
    const r = residentById(w.id)!, from = r.age < 12 ? FRIGHT_TALK.footsteps.kid : FRIGHT_TALK.footsteps.saw;
    expect(lines.slice(1, 4).some(l => matches(l, from))).toBe(true);   // straight after their greeting
    expect(frightOf(g, w.id)!.told).toBe(1);
  });
});
