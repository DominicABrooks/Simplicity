// The city after dark: now and then, while the hero walks the Market Quarter's streets at night, something
// unsettling happens. Never by day, never indoors or anywhere else, never while he's busy or the Grey Ringer's
// out, never by her churchyard; and each one only where it can (a lamp to gutter, a well to whisper).
import { describe, expect, it } from "vitest";
import { loadArea } from "../src/areas/index.ts";
import { EERIE, type EerieId } from "../src/data/eerie.ts";
import { HALF } from "../src/data/world.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { eerieCan, eerieHere, eerieNow, eerieSystem, pickEerie, startEerie, uneaseOf } from "../src/game/eerie.ts";
import { churchyardOf, riseGhost } from "../src/game/ghost.ts";
import { lampLit, lampsHere, setLamps } from "../src/game/lamps.ts";
import { resetGame } from "../src/game/reset.ts";
import { enterArea } from "../src/game/travel.ts";
import { spentCurios } from "../src/game/curios.ts";

const DT = 1 / 30;
const MIDNIGHT = 0, NOON = 12;

/** In an area at an hour, standing at a spot (px, his middle) if given. */
async function at(area: string, hour: number, spot?: { x: number; y: number }): Promise<Game> {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  enterArea(g, await loadArea(area), Object.keys((await loadArea(area)).build().entries)[0]!);
  g.hour = hour;
  setLamps(g);
  if (spot) place(g, spot);
  return g;
}
const place = (g: Game, spot: { x: number; y: number }) => Object.assign(g.world.need(g.player, "transform"), { x: spot.x - HALF, y: spot.y - HALF });
/** Run the night's clock for this long (the hour held still, so it stays night). */
const run = (g: Game, seconds: number) => { for (let t = 0; t < seconds; t += DT) { eerieSystem(g, DT); } };
/** The square's middle, by the fountain: open street, lamps round about, away from the churchyard. */
const square = (g: Game) => { const f = g.area.layout.props.find(p => p.kind === "fountain")!; return { x: f.x, y: f.y + 40 }; };

describe("the city after dark", () => {
  it("only in the city's streets, only at night", async () => {
    expect(eerieHere(await at("capital", MIDNIGHT))).toBe(true);
    expect(eerieHere(await at("capital", 22))).toBe(true);
    expect(eerieHere(await at("capital", 4.9))).toBe(true);
    expect(eerieHere(await at("capital", NOON))).toBe(false);
    expect(eerieHere(await at("capital", 5))).toBe(false);
    expect(eerieHere(await at("capital", 20.9))).toBe(false);
    expect(eerieHere(await at("kingsroad", MIDNIGHT))).toBe(false);
    expect(eerieHere(await at("castle", MIDNIGHT))).toBe(false);
  });

  it("never indoors, even in the city at midnight", async () => {
    const g = await at("capital", MIDNIGHT);
    g.area = { ...g.area, def: { ...g.area.def, indoors: true } };
    expect(eerieHere(g)).toBe(false);
  });

  it("happens now and then through a night in the streets, but no more than so many", async () => {
    const g = await at("capital", MIDNIGHT);
    place(g, square(g));
    g.world.need(g.player, "motion").moving = true;
    run(g, EERIE.settle - 1);
    expect(uneaseOf(g).tonight).toBe(0);                      // a moment to settle first
    run(g, 600);
    expect(uneaseOf(g).tonight).toBeGreaterThan(0);
    expect(uneaseOf(g).tonight).toBeLessThanOrEqual(EERIE.most);
  });

  it("never by day, however long he walks", async () => {
    const g = await at("capital", NOON);
    place(g, square(g));
    g.world.need(g.player, "motion").moving = true;
    run(g, 600);
    expect(uneaseOf(g).tonight).toBe(0);
    expect(eerieNow(g)).toBeNull();
    for (const id of Object.keys(EERIE.weights) as EerieId[]) expect(startEerie(g, id)).toBe(false);
  });

  it("never anywhere else at night", async () => {
    const g = await at("kingsroad", MIDNIGHT);
    g.world.need(g.player, "motion").moving = true;
    run(g, 600);
    expect(uneaseOf(g).tonight).toBe(0);
  });

  it("leaves the churchyard to the Grey Ringer, and holds off while she's out", async () => {
    const g = await at("capital", MIDNIGHT), yard = churchyardOf(g)!;
    place(g, { x: yard.x + yard.w / 2, y: yard.y + yard.h + 10 });
    g.world.need(g.player, "motion").moving = true;
    run(g, 600);
    expect(uneaseOf(g).tonight).toBe(0);

    const h = await at("capital", MIDNIGHT);
    riseGhost(h, churchyardOf(h)!);
    place(h, square(h));
    h.world.need(h.player, "motion").moving = true;
    run(h, 600);
    expect(uneaseOf(h).tonight).toBe(0);
  });

  it("stops, leaving nothing behind, when the day comes", async () => {
    const g = await at("capital", MIDNIGHT);
    place(g, square(g));
    expect(startEerie(g, "watcher")).toBe(true);
    expect(g.world.query("watcher").length).toBe(1);
    g.hour = 6;
    eerieSystem(g, DT);
    expect(eerieNow(g)).toBeNull();
    expect(g.world.query("watcher").length).toBe(0);
    expect(uneaseOf(g).tonight).toBe(0);
  });
});

describe("each of them", () => {
  it("footsteps only follow a hero who's walking, and stop when he does", async () => {
    const g = await at("capital", MIDNIGHT), motion = () => g.world.need(g.player, "motion");
    place(g, square(g));
    motion().moving = false;
    expect(eerieCan(g, "footsteps")).toBe(false);
    motion().moving = true;
    expect(startEerie(g, "footsteps")).toBe(true);
    run(g, EERIE.footsteps.least + 0.5);
    expect(g.sfx.some(s => s.id === "footstep")).toBe(true);
    expect(eerieNow(g)).toBe("footsteps");
    motion().moving = false;
    run(g, DT * 2);
    expect(eerieNow(g)).toBeNull();
  });

  it("a lamp only gutters if one's burning beside him, and catches again", async () => {
    const g = await at("capital", MIDNIGHT), lamp = lampsHere()[0]!;
    place(g, square(g));
    expect(eerieCan(g, "lamp")).toBe(lampsHere().some(l => Math.hypot(l.x - square(g).x, l.y - square(g).y) <= EERIE.lamp.near));
    place(g, { x: lamp.x + 10, y: lamp.y });
    expect(lampLit(lamp)).toBe(true);
    expect(startEerie(g, "lamp")).toBe(true);
    expect(lampLit(lamp)).toBe(false);
    run(g, EERIE.lamp.out + 0.1);
    expect(lampLit(lamp)).toBe(true);
    expect(eerieNow(g)).toBeNull();
  });

  it("a well only whispers to someone standing by it", async () => {
    const g = await at("capital", MIDNIGHT), well = g.area.layout.props.find(p => p.kind === "well")!;
    place(g, square(g));
    expect(eerieCan(g, "well")).toBe(false);
    place(g, { x: well.x + 16, y: well.y });
    expect(startEerie(g, "well")).toBe(true);
    run(g, EERIE.well.gap * (EERIE.well.lines + 1));
    expect(g.floaters.length).toBeGreaterThanOrEqual(EERIE.well.lines);
    expect(eerieNow(g)).toBeNull();
  });

  it("the watcher stands down the street, and is gone when he comes close", async () => {
    const g = await at("capital", MIDNIGHT);
    place(g, square(g));
    expect(startEerie(g, "watcher")).toBe(true);
    const [e, c] = g.world.query("watcher", "transform")[0]!;
    const hero = g.world.need(g.player, "transform"), far = Math.hypot(c.transform.x - hero.x, c.transform.y - hero.y);
    expect(far).toBeGreaterThan(EERIE.watcher.near);
    run(g, 2);
    expect(c.watcher.shown).toBe(1);
    Object.assign(hero, { x: c.transform.x + 10, y: c.transform.y });
    run(g, 1);
    expect(g.world.isAlive(e) && g.world.has(e, "watcher")).toBe(false);
    expect(eerieNow(g)).toBeNull();
  });

  it("the little bell rings nine only in the curfew hour, once a night, and never once it's back with Ismay", async () => {
    const g = await at("capital", 21.5);
    place(g, square(g));
    expect(eerieCan(g, "curfew")).toBe(true);
    g.hour = MIDNIGHT;
    expect(eerieCan(g, "curfew")).toBe(false);
    g.hour = 21.5;
    expect(startEerie(g, "curfew")).toBe(true);
    run(g, EERIE.curfew.gap * (EERIE.curfew.strokes + 1));
    expect(g.sfx.filter(s => s.id === "handbell").length).toBe(EERIE.curfew.strokes);
    expect(eerieCan(g, "curfew")).toBe(false);               // rung tonight

    const h = await at("capital", 21.5);
    spentCurios(h).add("bell");
    expect(eerieCan(h, "curfew")).toBe(false);
  });

  it("goes by the weights: one weighted 0 never happens", async () => {
    const g = await at("capital", MIDNIGHT), weights = EERIE.weights as Record<EerieId, number>, saved = { ...weights };
    place(g, square(g));
    g.world.need(g.player, "motion").moving = true;
    try {
      for (const id of Object.keys(weights) as EerieId[]) weights[id] = id === "footsteps" ? 1 : 0;
      for (let i = 0; i < 50; i++) expect(pickEerie(g)).toBe("footsteps");
      weights.footsteps = 0;
      expect(pickEerie(g)).toBeNull();
    } finally {
      Object.assign(weights, saved);
    }
  });
});
