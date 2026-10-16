// Cinder's fight in his arena: step in among the stones and the fire shuts you in until he falls; the ground
// erupts under you (dash or jump clear), and walls of fire sweep across the circle (jump them).
import { describe, expect, it } from "vitest";
import { loadArea } from "../src/areas/index.ts";
import { CINDER_AT } from "../src/areas/ashwild.ts";
import { CINDER, CINDER_FIGHT as F } from "../src/data/ashwild.ts";
import { bossSystem } from "../src/game/bosses.ts";
import { cinderFight, cinderFightSystem } from "../src/game/cinderfight.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { enterArea } from "../src/game/travel.ts";

async function atCinder(stepIn = true): Promise<Game> {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  enterArea(g, await loadArea("ashwild"), "witchwood");
  Object.assign(hero(g), { x: CINDER_AT.x, y: CINDER_AT.y + (stepIn ? 20 : 80) });
  cinderFightSystem(g, 0.01);
  return g;
}
const hero = (g: Game) => g.world.need(g.player, "transform");
const hp = (g: Game) => g.world.need(g.player, "health");
const cinder = (g: Game) => g.world.query("targetable", "health").find(([, c]) => c.targetable.name === CINDER.name)!;
/** Run the fight on for a while, healing the hero (and clearing his i-frames) each step. */
function run(g: Game, seconds: number, each?: () => void) {
  for (let t = 0; t < seconds; t += 0.05) { each?.(); cinderFightSystem(g, 0.05); }
}

describe("Cinder's fight", () => {
  it("shuts only once the hero steps in among the stones", async () => {
    expect(cinderFight(await atCinder(false))).toBeNull();
    const g = await atCinder();
    expect(cinderFight(g)).not.toBeNull();
    expect(g.world.query("renderable").some(([, c]) => c.renderable.kind === "blaze")).toBe(true);
  });

  it("keeps the hero inside the fire", async () => {
    const g = await atCinder();
    Object.assign(hero(g), { x: CINDER_AT.x, y: CINDER_AT.y - 200 });
    cinderFightSystem(g, 0.01);
    expect(Math.hypot(hero(g).x - CINDER_AT.x, hero(g).y - CINDER_AT.y)).toBeCloseTo(F.keepIn, 5);
  });

  it("erupts under the hero: it burns if he stands there, not if he jumps", async () => {
    const stand = await atCinder(), before = hp(stand).hp;
    run(stand, 1.5 + F.flare.warn);
    expect(hp(stand).hp).toBeLessThan(before);

    const leap = await atCinder(), full = hp(leap).hp, motion = leap.world.need(leap.player, "motion");
    run(leap, 1.5 + F.flare.warn + 0.2, () => { motion.jump = 0.3; });
    expect(hp(leap).hp).toBe(full);
  });

  it("sweeps a wall of fire across the circle that only a jump or a dash beats", async () => {
    const g = await atCinder(), f = cinderFight(g)!;
    f.nextFlares = 999;                                       // just the wall
    run(g, F.beam.first + F.beam.warn + F.beam.sweep, () => { g.world.need(g.player, "status").hurt = 0; });
    expect(hp(g).maxHp - hp(g).hp).toBe(F.beam.damage);

    const j = await atCinder(), fj = cinderFight(j)!, motion = j.world.need(j.player, "motion");
    fj.nextFlares = 999;
    run(j, F.beam.first + F.beam.warn + F.beam.sweep, () => { motion.jump = 0.3; });
    expect(hp(j).hp).toBe(hp(j).maxHp);
  });

  it("opens when Cinder falls", async () => {
    const g = await atCinder();
    cinder(g)[1].health.hp = 0;
    bossSystem(g, 1 / 60);
    cinderFightSystem(g, 1 / 60);
    expect(cinderFight(g)).toBeNull();
    expect(g.world.query("renderable").some(([, c]) => c.renderable.kind === "blaze")).toBe(false);
  });
});
