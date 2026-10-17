// The Grey Ringer: the rumour raises the chance she rises; she rises only at night in St Mary's churchyard,
// fights hard, can be beaten, and the townsfolk near her run for it.
import { describe, expect, it } from "vitest";
import { area as capital } from "../src/areas/capital.ts";
import { area as castle } from "../src/areas/castle.ts";
import { area as kingsroad } from "../src/areas/kingsroad.ts";
import { loadArea } from "../src/areas/index.ts";
import { Rng } from "../src/core/rng.ts";
import { GHOST, GHOST_RUMOURS, RINGERS_SHROUD, ghostChance, ghostHp, isGhostRumour } from "../src/data/ghost.ts";
import { folkLines } from "../src/game/conversation.ts";
import { hitEnemy } from "../src/game/combat.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { churchyardOf, ghostOut, hauntSystem, hauntingOf, riseChance, riseGhost } from "../src/game/ghost.ts";
import { resetGame } from "../src/game/reset.ts";
import { advanceTalk, startTalk, talking } from "../src/game/talk.ts";
import { populate, setCensus, updateTownsfolk } from "../src/game/townsfolk.ts";
import { enterArea } from "../src/game/travel.ts";
import { step } from "../src/systems/index.ts";
import { residentsOf } from "../src/world/residents.ts";

const people = setCensus(residentsOf({ capital: capital.build().props, castle: castle.build().props, kingsroad: kingsroad.build().props }));
const DT = 1 / 30;

/** In the Market Quarter at an hour of the day, standing in St Mary's churchyard (or at the gate). */
async function inCapital(hour: number, inYard = true): Promise<Game> {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  enterArea(g, await loadArea("capital"), "southgate");
  g.hour = hour;
  if (inYard) { const y = churchyardOf(g)!; Object.assign(g.world.need(g.player, "transform"), { x: y.x + y.w / 2, y: y.y + y.h + 6 }); }
  return g;
}
const run = (g: Game, seconds: number) => { for (let t = 0; t < seconds; t += DT) step(g, DT); };
/** Get her up and fighting (skipping the night's roll and her rising). */
function risen(g: Game) {
  const e = riseGhost(g, churchyardOf(g)!);
  run(g, GHOST.rise + 0.1);
  return e;
}

describe("the Grey Ringer's rumour", () => {
  it("is the only way to see her: no chance unheard, more with every telling, never quite certain", () => {
    expect(ghostChance(0)).toBe(0);
    for (let n = 1; n < 12; n++) expect(ghostChance(n)).toBeGreaterThanOrEqual(ghostChance(n - 1));
    expect(ghostChance(1)).toBeGreaterThan(0);
    expect(ghostChance(4)).toBeGreaterThan(ghostChance(1) * 3);
    expect(ghostChance(50)).toBeLessThan(1);
  });

  it("goes round the city: the townsfolk pass it on now and then, the gossips and the superstitious most", () => {
    const rng = new Rng(11), talkers = people.filter(r => !r.prisoner && r.age >= 12);
    const told = talkers.filter(r => folkLines(rng, r).some(isGhostRumour));
    expect(told.length).toBeGreaterThan(talkers.length * 0.02);
    expect(told.length).toBeLessThan(talkers.length * 0.15);
  });

  it("counts every time the hero hears it, and each telling makes her likelier", async () => {
    const g = createGame();
    resetGame(g);
    setState(g, "play");
    enterArea(g, await loadArea("castle"), "town");
    const [guard, { transform }] = g.world.query("sentry", "transform")[0]!;
    Object.assign(g.world.need(g.player, "transform"), { x: transform.x, y: transform.y + 12 });
    for (let told = 1; told <= 3; told++) {
      startTalk(g, guard);
      const before = hauntingOf(g).heard, chance = riseChance(g), c = talking(g)!;
      c.lines = ["Evening.", `You didn't hear it from me, but... "${GHOST_RUMOURS[told]!}."`, "Off you go."];
      advanceTalk(g); advanceTalk(g);                         // the rest of the first line, then the rumour
      expect(hauntingOf(g).heard).toBe(before + 1);
      expect(riseChance(g)).toBeGreaterThan(chance);
      advanceTalk(g); advanceTalk(g); advanceTalk(g);         // and goodbye: no more told
      expect(hauntingOf(g).heard).toBe(before + 1);
    }
  });
});

describe("her rising", () => {
  it("never happens by day, or to a hero who's heard nothing of her", async () => {
    const day = await inCapital(12);
    hauntingOf(day).heard = 20;
    run(day, 1);
    expect(ghostOut(day)).toBeNull();
    const unheard = await inCapital(23);
    run(unheard, 1);
    expect(ghostOut(unheard)).toBeNull();
    expect(hauntingOf(unheard).night).toBe("quiet");
  });

  it("happens at night in the churchyard, more often the more the hero's heard", async () => {
    const g = await inCapital(23);
    const rate = (heard: number) => {
      let rose = 0;
      for (let i = 0; i < 1000; i++) {
        Object.assign(hauntingOf(g), { heard, night: "waiting" });
        hauntSystem(g);
        const e = ghostOut(g);
        if (e !== null) { rose++; g.world.destroy(e); }
      }
      return rose / 1000;
    };
    const once = rate(1), often = rate(5);
    expect(once).toBeCloseTo(ghostChance(1), 1);
    expect(often).toBeCloseTo(ghostChance(5), 1);
    expect(often).toBeGreaterThan(once * 3);
  });

  it("only in the churchyard, once a night: a quiet night stays quiet till the next", async () => {
    const far = await inCapital(23, false);
    hauntingOf(far).heard = 20;
    run(far, 1);
    expect(ghostOut(far)).toBeNull();                         // at the gate, nothing
    const g = await inCapital(23);
    Object.assign(hauntingOf(g), { heard: 1, night: "quiet" });
    run(g, 2);
    expect(ghostOut(g)).toBeNull();
    g.hour = 12;
    run(g, DT);
    expect(hauntingOf(g).night).toBe("waiting");              // a new day, a new night's chance
  });

  it("waits for you if you leave and come back the same night, and goes at first light", async () => {
    const g = await inCapital(23);
    Object.assign(hauntingOf(g), { heard: 1, night: "risen" });
    run(g, DT);
    expect(ghostOut(g)).not.toBeNull();
    g.hour = 5.5;
    run(g, DT);
    expect(ghostOut(g)).toBeNull();
  });
});

describe("the fight", () => {
  it("can't touch her while she rises; then she's a hostile target, far tougher than a mage", async () => {
    const g = await inCapital(23);
    const e = riseGhost(g, churchyardOf(g)!);
    expect(g.world.has(e, "enemy")).toBe(false);
    expect(g.world.has(e, "targetable")).toBe(false);
    run(g, GHOST.rise + 0.1);
    expect(g.world.need(e, "targetable").hostile).toBe(true);
    expect(g.world.need(e, "health").maxHp).toBe(ghostHp(1));
    expect(ghostHp(1)).toBeGreaterThanOrEqual(20);
  });

  it("tolls her bell for two hearts on whoever's near; a dash goes through it", async () => {
    const g = await inCapital(23);
    const e = risen(g), at = g.world.need(e, "transform"), b = g.world.need(e, "ghost");
    const hero = g.world.need(g.player, "transform"), health = g.world.need(g.player, "health");
    Object.assign(hero, { x: at.x + 20, y: at.y });
    health.hp = health.maxHp;
    Object.assign(b, { act: "toll", t: 0 });
    run(g, GHOST.toll.charge + 0.05);
    expect(health.maxHp - health.hp).toBe(GHOST.toll.damage);
    g.world.need(g.player, "status").hurt = 0;
    health.hp = health.maxHp;
    Object.assign(hero, { x: at.x + 20, y: at.y });
    Object.assign(b, { act: "toll", t: GHOST.toll.charge - 0.02 });
    g.world.need(g.player, "motion").dash = 0.2;
    run(g, 0.05);
    expect(health.hp).toBe(health.maxHp);
  });

  it("can't be knocked about, and won't be led away from her grave: she goes back and mends", async () => {
    const g = await inCapital(23);
    const e = risen(g), at = g.world.need(e, "transform"), health = g.world.need(e, "health"), home = { ...g.world.need(e, "ghost").home };
    Object.assign(g.world.need(e, "knockback"), { vx: 300, vy: 0 });
    const x = at.x;
    run(g, DT);
    expect(Math.abs(at.x - x)).toBeLessThan(2);
    health.hp = 5;
    Object.assign(g.world.need(g.player, "transform"), { x: home.x - GHOST.leash - 40, y: home.y });
    run(g, 3);
    expect(g.world.need(e, "ghost").act).not.toBe("toll");
    expect(health.hp).toBeGreaterThan(5);
  });

  it("can be beaten: she leaves the Ringer's Shroud, rare things and potions, a journal page, and the rumour dies with her", async () => {
    const g = await inCapital(23);
    hauntingOf(g).heard = 4;
    const e = risen(g), at = g.world.need(e, "transform");
    Object.assign(g.world.need(g.player, "transform"), { x: at.x - 60, y: at.y });   // out of the way of what she leaves
    g.world.need(e, "health").hp = 1;
    hitEnemy(g, e, 5);
    run(g, 0.5);                                              // past the hitstop, if the blow was a crit
    expect(ghostOut(g)).toBeNull();
    const loot = g.world.query("pickup").map(([, { pickup }]) => pickup);
    expect(loot.filter(p => p.kind === "loot" && p.item.rarity === "rare").length).toBe(GHOST.reward.items);
    // By rarity, not name, so a rare that happens to share the name can't count as hers.
    const shroud = loot.filter(p => p.kind === "loot" && p.item.rarity === "legendary");
    expect(shroud.map(p => p.kind === "loot" && p.item.type + " " + p.item.name)).toEqual([`robe ${RINGERS_SHROUD[3]}`]);
    expect(loot.filter(p => p.kind === "potion").length).toBeGreaterThanOrEqual(GHOST.reward.potions);
    expect(g.journal.ghost).toBe(1);
    expect(hauntingOf(g)).toEqual({ heard: 0, night: "laid" });
    run(g, 1);
    expect(ghostOut(g)).toBeNull();                         // at rest for the night
  });
});

describe("the townsfolk", () => {
  it("run from her, home or out of the quarter, and nobody comes out while she's about", async () => {
    const g = await inCapital(12);                            // a busy street, for the test (she only rises at night)
    populate(g, people);
    const yard = churchyardOf(g)!, at = { x: yard.x + yard.w - 16, y: yard.y + yard.h / 2 - 4 };   // where she rises
    const near = () => g.world.query("walker", "transform").filter(([, { transform: t }]) => Math.hypot(t.x - at.x, t.y - at.y) < GHOST.scare);
    for (let i = 0; i < 300 && near().length < 3; i++) updateTownsfolk(g, 0.2);
    expect(near().length).toBeGreaterThan(0);
    expect(g.world.need(riseGhost(g, yard), "transform")).toEqual(at);
    updateTownsfolk(g, DT);
    for (const [, { walker }] of near()) expect(walker.fleeing).toBe(true);
    const out = g.world.count("walker");
    for (let t = 0; t < 40; t += DT) updateTownsfolk(g, DT);
    expect(near().length).toBe(0);
    expect(g.world.count("walker")).toBeLessThanOrEqual(out);
  });
});
