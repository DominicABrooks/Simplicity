// Cinder's inferno: down to a quarter of his health, he steps out through the fire, out of reach, and the circle becomes
// a furnace for a while (a wheel of fire turning from the middle, fans of fire thrown across it from outside); then he
// bursts back in, a ring of fire flying out round him, and the fight goes on. Once a fight.
import { describe, expect, it } from "vitest";
import { loadArea } from "../src/areas/index.ts";
import { CINDER_AT } from "../src/areas/ashwild.ts";
import { CINDER, CINDER_FIGHT as F } from "../src/data/ashwild.ts";
import { cinderFight, cinderFightSystem, spokesOf, wheelStill } from "../src/game/cinderfight.ts";
import { hitEnemy } from "../src/game/combat.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { enterArea } from "../src/game/travel.ts";

async function inFight(): Promise<Game> {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  enterArea(g, await loadArea("ashwild"), "witchwood");
  Object.assign(hero(g), { x: CINDER_AT.x, y: CINDER_AT.y + 20 });
  cinderFightSystem(g, 0.01);
  return g;
}
const hero = (g: Game) => g.world.need(g.player, "transform");
const cinder = (g: Game) => g.world.query("targetable", "health").find(([, c]) => c.targetable.name === CINDER.name)![0];
const fires = (g: Game) => g.world.query("bolt").filter(([, c]) => c.bolt.kind === "fire").length;
/** Bring him down to a quarter, and run the fight a step so the inferno starts. */
function toAQuarter(g: Game): void {
  const hp = g.world.need(cinder(g), "health");
  hp.hp = Math.floor(hp.maxHp * F.inferno.at);
  cinderFightSystem(g, 0.01);
}
/** Run the fight on, the hero healed and clear of i-frames each step. */
function run(g: Game, seconds: number, each?: () => void) {
  for (let t = 0; t < seconds; t += 0.05) {
    const hp = g.world.need(g.player, "health"), st = g.world.need(g.player, "status");
    hp.hp = hp.maxHp; st.hurt = 0;
    each?.();
    cinderFightSystem(g, 0.05);
  }
}

describe("Cinder's inferno", () => {
  it("isn't there above a quarter of his health", async () => {
    const g = await inFight();
    run(g, 3);
    expect(cinderFight(g)!.inferno).toBeNull();
  });

  it("takes him out through the fire at a quarter, out of reach, blows glancing off", async () => {
    const g = await inFight();
    toAQuarter(g);
    const f = cinderFight(g)!, at = g.world.need(cinder(g), "transform");
    expect(f.inferno).not.toBeNull();
    expect(Math.hypot(at.x - f.x, at.y - f.y)).toBeGreaterThan(f.r);   // out past the fire
    const before = g.world.need(cinder(g), "health").hp;
    expect(hitEnemy(g, cinder(g), 5)).toBe(0);
    expect(g.world.need(cinder(g), "health").hp).toBe(before);
  });

  it("turns a wheel of fire that burns him where he stands, but not if he jumps it", async () => {
    const g = await inFight();
    toAQuarter(g);
    const f = cinderFight(g)!;
    run(g, F.inferno.wheel.warn + 0.1);
    const onSpoke = () => { const { a } = spokesOf(f)[0]!; Object.assign(hero(g), { x: f.x + Math.cos(a) * 20, y: f.y + Math.sin(a) * 20 }); };
    const hp = g.world.need(g.player, "health"), motion = g.world.need(g.player, "motion");
    run(g, 0.5, () => { onSpoke(); motion.jump = 0.3; });
    expect(hp.hp).toBe(hp.maxHp);                                // jumped it
    run(g, 0.05, () => { onSpoke(); motion.jump = 0; });
    expect(hp.hp).toBeLessThan(hp.maxHp);                        // stood in it
  });

  it("turns back fair: slows to a stop, stands still while one more spoke smoulders up away from him, then speeds up the other way", async () => {
    const g = await inFight();
    toAQuarter(g);
    const f = cinderFight(g)!, B = F.inferno.wheel.turnBack, angle = () => f.inferno!.wheel;
    run(g, B.at - 0.5);
    const a0 = angle(); run(g, 0.2); const full = angle() - a0;                 // turning at full speed
    run(g, 0.3 + B.slow / 2);
    const a1 = angle(); run(g, 0.2); const slowing = angle() - a1;
    expect(Math.abs(slowing)).toBeLessThan(Math.abs(full));                     // slowing, the same way
    expect(Math.sign(slowing)).toBe(Math.sign(full));
    const before = spokesOf(f).map(s => s.a);
    run(g, B.slow / 2 + 0.1);                                                   // stood still now
    expect(wheelStill(f)).toBe(true);
    const spokes = spokesOf(f);
    expect(spokes).toHaveLength(F.inferno.wheel.spokes + 1);
    spokes.slice(0, -1).forEach((s, i) => expect(s.a).toBeCloseTo(before[i]!, 1));   // the others didn't move
    expect(spokes.at(-1)!.live).toBe(false);                                    // the new one smoulders first
    const facing = Math.atan2(hero(g).y - f.y, hero(g).x - f.x), off = spokes.at(-1)!.a - facing;
    expect(Math.abs(Math.atan2(Math.sin(off), Math.cos(off)))).toBeGreaterThan(Math.PI / 2);   // on the far side from him
    const a2 = angle(); run(g, 0.5); expect(angle()).toBeCloseTo(a2, 5);         // and the wheel holds still
    run(g, B.hold);
    expect(spokesOf(f).every(s => s.live)).toBe(true);
    const a3 = angle(); run(g, 0.2); const back = angle() - a3;
    expect(Math.sign(back)).toBe(-Math.sign(full));                             // the other way now
    expect(Math.abs(back)).toBeLessThan(Math.abs(full));                        // and gathering speed
  });

  it("throws fans of fire across the circle from outside", async () => {
    const g = await inFight();
    toAQuarter(g);
    run(g, F.inferno.fan.first + 0.1);
    expect(fires(g)).toBeGreaterThanOrEqual(F.inferno.fan.count);
  });

  it("bursts back into the middle when it's spent, in a ring of fire, and doesn't come again", async () => {
    const g = await inFight();
    toAQuarter(g);
    for (const [e] of g.world.query("bolt")) g.world.destroy(e);
    run(g, F.inferno.last + 0.1);
    const f = cinderFight(g)!, at = g.world.need(cinder(g), "transform");
    expect(f.inferno).toBeNull();
    expect(Math.hypot(at.x - f.x, at.y - f.y)).toBeLessThan(1);
    expect(fires(g)).toBeGreaterThanOrEqual(F.inferno.burst.count);
    expect(hitEnemy(g, cinder(g), 1)).toBeGreaterThan(0);       // in reach again
    run(g, 2);
    expect(cinderFight(g)!.inferno).toBeNull();
  });
});
