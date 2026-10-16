// The city after dark: now and then, while the hero walks the Market Quarter's streets at night, something
// unsettling happens. Never by day, never indoors or anywhere else, never while he's busy or the Grey Ringer's
// out, never by her churchyard; and each one only where it can (a lamp to gutter, a well to whisper). Nothing says
// so: each is seen and heard (sounds and effects), never told in a message.
import { describe, expect, it } from "vitest";
import { loadArea } from "../src/areas/index.ts";
import { EERIE, type EerieId } from "../src/data/eerie.ts";
import { HALF } from "../src/data/world.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { eerieCan, eerieHere, eerieNow, eerieSystem, pickEerie, startEerie, uneaseOf, watcherSpot } from "../src/game/eerie.ts";
import { T, Tile } from "../src/data/world.ts";
import { tileAt } from "../src/world/collision.ts";
import { churchyardOf, riseGhost } from "../src/game/ghost.ts";
import { lampLit, lampsHere, setLamps } from "../src/game/lamps.ts";
import { resetGame } from "../src/game/reset.ts";
import { enterArea } from "../src/game/travel.ts";
import { spentCurios } from "../src/game/curios.ts";
import { FRIGHT } from "../src/data/eerie.ts";
import { populate, setCensus, updateTownsfolk } from "../src/game/townsfolk.ts";
import { residentsOf } from "../src/world/residents.ts";
import { area as capitalArea } from "../src/areas/capital.ts";
import { area as castleArea } from "../src/areas/castle.ts";
import { area as kingsroadArea } from "../src/areas/kingsroad.ts";

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
/** Halfway down the high street, between its houses. */
const highStreet = { x: 48.5 * 8, y: 62 * 8 };

describe("the city after dark", () => {
  it("only in the city's streets, only at night", async () => {
    expect(eerieHere(await at("capital", MIDNIGHT))).toBe(true);
    expect(eerieHere(await at("capital", 22))).toBe(true);
    expect(eerieHere(await at("capital", 4.9))).toBe(true);
    expect(eerieHere(await at("capital", NOON))).toBe(false);
    expect(eerieHere(await at("capital", 5))).toBe(false);
    expect(eerieHere(await at("capital", 20.9))).toBe(false);
    expect(eerieHere(await at("castle", MIDNIGHT))).toBe(false);
    for (const wild of ["kingsroad", "witchwood", "ashwild", "hollow"]) {
      expect(eerieHere(await at(wild, MIDNIGHT))).toBe(true);
      expect(eerieHere(await at(wild, NOON))).toBe(false);
    }
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
    for (const id of Object.keys(EERIE.areas.capital!.weights) as EerieId[]) expect(startEerie(g, id)).toBe(false);
  });

  it("never anywhere else at night", async () => {
    const g = await at("castle", MIDNIGHT);
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
  it("is never told in a message, only seen and heard", async () => {
    const g = await at("capital", MIDNIGHT), told: string[] = [];
    g.events.on("toast", ({ text }) => told.push(text));
    const well = g.area.layout.props.find(p => p.kind === "well")!;
    g.world.need(g.player, "motion").moving = true;
    for (const [id, spot] of [["watcher", square(g)], ["footsteps", square(g)], ["well", { x: well.x + 16, y: well.y }], ["shutter", highStreet]] as const) {
      place(g, spot);
      startEerie(g, id);
      run(g, 16);
    }
    expect(uneaseOf(g).tonight).toBeGreaterThan(2);
    expect(told).toEqual([]);
  });

  it("a shutter swings out over the street from a house in sight, and slams, and slams, and slams", async () => {
    const g = await at("capital", MIDNIGHT);
    place(g, highStreet);
    expect(eerieCan(g, "shutter")).toBe(true);
    expect(startEerie(g, "shutter")).toBe(true);
    const fx = g.fx.find(f => f.type === "shutter");
    expect(fx && fx.type === "shutter" && fx.facing).not.toBe("north");   // its back's to us: we'd never see it
    let jolts = 0;
    for (let t = 0; t < 5; t += DT) { g.shake = 0; run(g, DT); if (g.shake > 0) jolts++; }
    expect(jolts).toBe(EERIE.shutter.slams.length);
    expect(g.sfx.filter(s => s.id === "shutter").length).toBe(EERIE.shutter.slams.length);
    expect(eerieNow(g)).toBeNull();
  });

  it("footsteps only follow a hero who's walking, and stop when he does", async () => {
    const g = await at("capital", MIDNIGHT), motion = () => g.world.need(g.player, "motion");
    place(g, square(g));
    motion().moving = false;
    expect(eerieCan(g, "footsteps")).toBe(false);
    motion().moving = true;
    expect(startEerie(g, "footsteps")).toBe(true);
    run(g, EERIE.footsteps.least + 0.5);
    expect(g.sfx.some(s => s.id === "footstep")).toBe(true);
    const prints = g.fx.filter(f => f.type === "footprint");
    expect(prints.length).toBeGreaterThan(1);                // a print for every step, left and right
    expect(new Set(prints.map(f => f.type === "footprint" && f.left)).size).toBe(2);
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
    let flickers = 0, was = lampLit(lamp);
    for (let t = 0; t < EERIE.lamp.gutter; t += DT) { run(g, DT); if (lampLit(lamp) !== was) { flickers++; was = !was; } }
    expect(flickers).toBeGreaterThan(2);                     // it sputters first
    run(g, 0.2);
    expect(lampLit(lamp)).toBe(false);                       // then it's out
    run(g, EERIE.lamp.out + EERIE.lamp.catch);
    expect(lampLit(lamp)).toBe(true);                        // and back
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
    expect(g.fx.filter(f => f.type === "puff").length).toBe(EERIE.well.lines);   // a breath of mist with each
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
    const rings = g.fx.filter(f => f.type === "chime"), hero = g.world.need(g.player, "transform");
    expect(rings.length).toBe(EERIE.curfew.strokes);         // each stroke seen as a ring, from the river's side
    expect(rings.every(f => f.y > hero.y)).toBe(true);
    expect(eerieCan(g, "curfew")).toBe(false);               // rung tonight

    const h = await at("capital", 21.5);
    spentCurios(h).add("bell");
    expect(eerieCan(h, "curfew")).toBe(false);
  });

  it("goes by the weights: one weighted 0 never happens", async () => {
    const g = await at("capital", MIDNIGHT), weights = EERIE.areas.capital!.weights as Record<EerieId, number>, saved = { ...weights };
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

describe("the townsfolk", () => {
  const people = setCensus(residentsOf({ capital: capitalArea.build().props, castle: castleArea.build().props, kingsroad: kingsroadArea.build().props }));

  it("anyone near when it happens shouts and runs for home; anyone further off doesn't notice", async () => {
    const g = await at("capital", NOON);                     // a busy street to start with (it only happens at night)
    populate(g, people);
    for (let i = 0; i < 50; i++) updateTownsfolk(g, 0.2);
    const walkers = () => g.world.query("walker", "transform");
    const [, first] = walkers()[0]!;
    const spot = { x: first.transform.x + HALF, y: first.transform.y + HALF };
    const near = () => walkers().filter(([, { transform: t }]) => Math.hypot(t.x + HALF - spot.x, t.y + HALF - spot.y) <= FRIGHT.radius);
    const far = walkers().filter(([, { transform: t }]) => Math.hypot(t.x + HALF - spot.x, t.y + HALF - spot.y) > FRIGHT.radius * 1.5).map(([e]) => e);
    expect(near().length).toBeGreaterThan(0);
    g.hour = MIDNIGHT;
    place(g, spot);
    g.world.need(g.player, "motion").moving = true;
    expect(startEerie(g, "footsteps")).toBe(true);           // followed, right here among them
    const shouted = g.floaters.length;
    eerieSystem(g, DT);
    for (const [, { walker }] of near()) expect(walker.fleeing).toBe(true);
    expect(g.floaters.length - shouted).toBeGreaterThanOrEqual(near().length);   // each with a shout
    for (const e of far) expect(g.world.get(e, "walker")?.fleeing ?? false).toBe(false);
  });
});

/**
 * Somewhere in the wild the watcher could be seen from: open ground with the treeline in sight, away from any
 * boss's arena (tried at open tiles across the map, the hero facing every way in turn). Where he'd stand, and from where.
 */
function lookOut(g: Game): { from: { x: number; y: number }; spot: { x: number; y: number } } | null {
  const motion = g.world.need(g.player, "motion");
  for (let ty = 2; ty < g.map.height - 2; ty += 3) for (let tx = 2; tx < g.map.width - 2; tx += 3) {
    const from = { x: tx * T + HALF, y: ty * T + HALF };
    if (tileAt(g.map, from.x, from.y) === Tile.Tree || tileAt(g.map, from.x, from.y) === Tile.Water) continue;
    place(g, from);
    for (const aim of [-Math.PI / 2, 0, Math.PI, Math.PI / 2]) {
      motion.aim = aim;
      const spot = watcherSpot(g);
      if (spot && startEerie(g, "watcher")) { stopIt(g); return { from, spot }; }
    }
  }
  return null;
}
/** Send him off again (he'll go at first light). */
const stopIt = (g: Game) => { const h = g.hour; g.hour = NOON; eerieSystem(g, DT); g.hour = h; };

describe("out in the wild", () => {
  for (const wild of ["kingsroad", "witchwood", "ashwild", "hollow"]) {
    it(`${wild}: only the watcher, and he stands just inside the trees, and is gone when the hero comes`, async () => {
      const g = await at(wild, MIDNIGHT);
      g.world.need(g.player, "motion").moving = true;
      for (const id of ["shutter", "footsteps", "lamp", "well", "curfew"] as const) expect(eerieCan(g, id)).toBe(false);
      const seen = lookOut(g);
      expect(seen).not.toBeNull();
      const { from, spot } = seen!;
      expect(tileAt(g.map, spot.x, spot.y)).toBe(Tile.Tree);             // among the trees
      const d = Math.hypot(spot.x - from.x, spot.y - from.y), edge = { x: spot.x - ((spot.x - from.x) / d) * T, y: spot.y - ((spot.y - from.y) / d) * T };
      expect(tileAt(g.map, edge.x, edge.y)).not.toBe(Tile.Tree);         // a step inside the treeline, open ground before him

      place(g, from);
      expect(startEerie(g, "watcher")).toBe(true);
      const [e, c] = g.world.query("watcher", "transform")[0]!;
      run(g, 1);
      expect(c.watcher.shown).toBeGreaterThan(0);
      place(g, { x: c.transform.x + HALF, y: c.transform.y + HALF + 6 });
      run(g, 1);
      expect(g.world.has(e, "watcher")).toBe(false);
    });
  }

  it("keeps away from the bosses' arenas, Cinder's stones and Rime's ice", async () => {
    for (const [wild, kind] of [["ashwild", "arena"], ["hollow", "rimeStage"]] as const) {
      const g = await at(wild, MIDNIGHT), ring = g.area.layout.props.find(p => p.kind === kind)!;
      if (ring.kind !== "arena" && ring.kind !== "rimeStage") throw new Error(kind);
      const keep = (ring.radius + EERIE.arena) * T;
      // In the ring, or by it: nothing.
      place(g, { x: ring.x, y: ring.y + ring.radius * T - 4 });
      expect(startEerie(g, "watcher")).toBe(false);
      run(g, 400);
      expect(uneaseOf(g).tonight).toBe(0);
      // From anywhere else, he never stands by it.
      const motion = g.world.need(g.player, "motion");
      for (let ty = 2; ty < g.map.height - 2; ty += 4) for (let tx = 2; tx < g.map.width - 2; tx += 4) {
        place(g, { x: tx * T + HALF, y: ty * T + HALF });
        for (const aim of [-Math.PI / 2, 0, Math.PI, Math.PI / 2]) {
          motion.aim = aim;
          const spot = watcherSpot(g);
          if (spot) expect(Math.hypot(spot.x - ring.x, spot.y - ring.y)).toBeGreaterThanOrEqual(keep);
        }
      }
    }
  });

  it("holds off while a boss is up, and goes if one turns up while he's standing there", async () => {
    const g = await at("witchwood", MIDNIGHT), seen = lookOut(g)!;
    place(g, seen.from);
    const koi = g.world.create({ koi: {} as never });           // the Great Koi, up out of the ice
    expect(startEerie(g, "watcher")).toBe(false);
    g.world.destroy(koi);
    expect(startEerie(g, "watcher")).toBe(true);
    g.world.create({ koi: {} as never });
    eerieSystem(g, DT);
    expect(eerieNow(g)).toBeNull();
    expect(g.world.query("watcher").length).toBe(0);
  });
});
