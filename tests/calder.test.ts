// Calder, at the edge of the great crack at the top of the Thunder Rift: lightning shuts the hero in as he comes close,
// a Storm mage far tougher than any, with storms of marked circles, a blink that leaves him in three places (and open
// to a blade a moment after), static that turns all but a full draw, and the crack opening as the hero's knocked about
// and closing as he lands his hits. Once beaten, beaten for the run: his last words, his head left lying, the crack shut.
import { describe, expect, it } from "vitest";
import { loadArea } from "../src/areas/index.ts";
import { CALDER_STAND, GREAT_CRACK } from "../src/areas/rift.ts";
import { CALDER, CALDER_FALLS, CALDER_FIGHT as F, CALDER_LAST_WORDS, CALDER_READY, CALDERS_HEAD } from "../src/data/rift.ts";
import { HALF, T } from "../src/data/world.ts";
import { bossBar } from "../src/game/bossbar.ts";
import { beaten, bossSystem, bossWaiting } from "../src/game/bosses.ts";
import { calderFight, calderFightSystem, crackSealed, crackWidth, nearestOnCrack } from "../src/game/calderfight.ts";
import { damagePlayer, hitEnemy } from "../src/game/combat.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { LAIRS } from "../src/game/lairs.ts";
import { resetGame } from "../src/game/reset.ts";
import { spawnArrow, spawnEnemy } from "../src/game/spawn.ts";
import { spiritHere, spiritSystem } from "../src/game/spirits.ts";
import { endTalk, talking } from "../src/game/talk.ts";
import { enterArea } from "../src/game/travel.ts";
import { deathSystem, spawnerSystem } from "../src/systems/enemies.ts";
import type { Prop } from "../src/world/area.ts";

const DT = 1 / 60;
/** Where he stands (cell top-left). */
const STAND = { x: CALDER_STAND.x * T, y: CALDER_STAND.y * T };

async function inRift(): Promise<Game> {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  enterArea(g, await loadArea("rift"), "stone");
  for (const [e] of g.world.query("enemy")) g.world.destroy(e);
  return g;
}
const calderOf = (g: Game) => g.world.query("renderable", "mage", "health", "transform", "enemy").find(([, c]) => c.renderable.kind === "calder");
/** Stand him `tiles` south of where Calder stands, and let a frame of the fight go by. */
function standOff(g: Game, tiles: number) {
  Object.assign(g.world.need(g.player, "transform"), { x: STAND.x, y: STAND.y + tiles * T });
  calderFightSystem(g, DT);
  return calderOf(g);
}
/** The fight on, the hero `tiles` south of him. */
async function fighting(tiles = 4) {
  const g = await inRift(), [e, c] = standOff(g, tiles)!;
  return { g, e, c, f: calderFight(g)! };
}

describe("Calder", () => {
  it("stands at the edge of the great crack, just above the rift stone", async () => {
    const g = await inRift();
    const boss = g.area.layout.props.find((p): p is Extract<Prop, { kind: "boss" }> => p.kind === "boss")!;
    expect(boss.who).toBe("calder");
    expect({ x: boss.x - HALF, y: boss.y - HALF }).toEqual(STAND);
    expect(CALDER_STAND.y).toBeGreaterThan(GREAT_CRACK.y + GREAT_CRACK.wide / 2);   // south of it, on this side
    const stone = g.area.layout.props.find(p => p.kind === "oldStone")!;
    expect(stone.y).toBeGreaterThan(boss.y + F.shutAt);      // the stone's below, out of the fight
    expect(bossWaiting(g)).toBe("calder");
  });

  it("waits until the hero comes close; then lightning shuts him in, and he can't leave", async () => {
    const g = await inRift(), toasts: string[] = [];
    g.events.on("toast", ({ text }) => toasts.push(text));
    expect(standOff(g, 8)).toBeUndefined();
    expect(calderFight(g)).toBeNull();
    const [, c] = standOff(g, 5)!;
    expect(toasts).toEqual(expect.arrayContaining([F.say.shut, F.say.rise]));
    expect(c.mage.school).toBe("storm");
    expect(c.health.maxHp).toBe(CALDER.hp);
    expect(bossBar(g)).toMatchObject({ name: CALDER.name, title: CALDER.title });
    const f = calderFight(g)!, me = g.world.need(g.player, "transform");
    Object.assign(me, { x: f.x, y: f.y + 12 * T });          // off back down the trail
    calderFightSystem(g, DT);
    expect(Math.hypot(me.x - f.x, me.y - f.y)).toBeCloseTo(F.keepIn, 0);   // (and the crack's cold drawing him back in a touch)
  });

  it("has the glade to himself: everything else scatters, and nothing comes while he stands", async () => {
    const g = await inRift();
    for (let i = 0; i < 10; i++) spawnEnemy(g, 40);
    const [e] = standOff(g, 4)!;
    expect(g.world.query("enemy").map(([id]) => id)).toEqual([e]);
    for (let i = 0; i < 20; i++) { g.spawnTimer = 0; spawnerSystem(g, 1); }
    expect(g.world.count("enemy")).toBe(1);
  });

  it("is where ?boss=calder puts a level-9 hero: close enough that the fight starts", async () => {
    const g = await inRift(), at = LAIRS.calder.stage(g);
    expect(LAIRS.calder).toMatchObject({ area: "rift", ready: CALDER_READY });
    expect(CALDER_READY.level).toBe(9);
    expect(Math.hypot(at.x - STAND.x, at.y - STAND.y)).toBeLessThanOrEqual(F.shutAt);
    Object.assign(g.world.need(g.player, "transform"), at);
    calderFightSystem(g, DT);
    expect(calderFight(g)).not.toBeNull();
  });
});

describe("Calder's fight", () => {
  const strikes = (g: Game) => g.world.query("strike", "transform").map(([, c]) => c.transform);

  it("brings lightning down in three marked circles at a time, one where the hero stands", async () => {
    const { g, f } = await fighting();
    for (const [e] of g.world.query("strike")) g.world.destroy(e);
    f.nextStorm = 0;
    calderFightSystem(g, DT);
    const marks = strikes(g), me = g.world.need(g.player, "transform");
    expect(marks).toHaveLength(F.storm.count);
    expect(marks[0]).toEqual({ x: me.x, y: me.y });
    for (const m of marks) expect(Math.hypot(m.x - f.x, m.y - f.y)).toBeLessThanOrEqual(F.keepIn + 0.001);
    expect(g.world.query("strike")[0]![1].strike.t).toBe(F.storm.warn);
  });

  it("opens the great crack wider every time the hero's knocked back, and closes it a little every time he lands a hit", async () => {
    const { g, e, f } = await fighting();
    const was = f.open, wide = crackWidth(g);
    const me = g.world.need(g.player, "transform");
    damagePlayer(g, me.x + 4, me.y, 1);
    calderFightSystem(g, DT);
    expect(f.open).toBeCloseTo(was + F.crack.knock);
    expect(crackWidth(g)).toBeGreaterThan(wide);
    hitEnemy(g, e, 2, false);
    calderFightSystem(g, DT);
    expect(f.open).toBeCloseTo(was + F.crack.knock - F.crack.hit);
    // Wide open, its dark reaches out across the ground: step in it and it bites, and throws him back out.
    const status = g.world.need(g.player, "status"), hp = g.world.need(g.player, "health");
    status.hurt = 0;
    f.open = 1;
    const crack = g.area.layout.props.find((p): p is Extract<Prop, { kind: "greatCrack" }> => p.kind === "greatCrack")!;
    const edge = { x: GREAT_CRACK.x * T - HALF, y: (GREAT_CRACK.y + GREAT_CRACK.wide / 2 * 1.4) * T - HALF };
    expect(nearestOnCrack(crack, edge, 1).inside).toBe(false);
    expect(nearestOnCrack(crack, edge, crackWidth(g)).inside).toBe(true);
    Object.assign(me, edge);
    const before = hp.hp;
    calderFightSystem(g, DT);
    expect(hp.hp).toBe(before - 1);
    expect(g.world.need(g.player, "knockback").vy).toBeGreaterThan(0);   // thrown south, away from it
  });

  it("blinks so fast he seems to be in three places: close by the hero, with two echoes; and a blade then cuts twice as deep", async () => {
    const { g, e, f } = await fighting();
    const me = g.world.need(g.player, "transform"), him = g.world.need(e, "transform");
    Object.assign(him, { x: me.x + 60, y: me.y - 10 });     // his blink, from the mage's brain: far off
    calderFightSystem(g, DT);
    expect(Math.hypot(him.x - me.x, him.y - me.y)).toBeLessThan(F.blink.land + 2);
    expect(f.echoes).toHaveLength(2);
    for (const echo of f.echoes) expect(Math.hypot(echo.x - me.x, echo.y - me.y)).toBeLessThan(F.blink.land + 2);
    expect(f.daze).toBeGreaterThan(0);
    expect(g.world.need(e, "mage").held).toBe(true);
    // Caught in that moment: double.
    const health = g.world.need(e, "health"), before = health.hp;
    g.rng.next = () => 0.99;                                  // no crit
    hitEnemy(g, e, 3, true);
    calderFightSystem(g, DT);
    expect(before - health.hp).toBe(3 * F.blink.cut);
    // The echoes throw their sparks and are gone; he's himself again.
    const sparks = g.world.count("bolt");
    for (let t = 0; t < F.blink.daze + 0.1; t += DT) calderFightSystem(g, DT);
    expect(f.echoes).toHaveLength(0);
    expect(g.world.count("bolt")).toBe(sparks + 2);
    expect(g.world.need(e, "mage").held).toBe(false);
    // And out of it, a blade's only a blade.
    const now = health.hp;
    hitEnemy(g, e, 3, true);
    calderFightSystem(g, DT);
    expect(now - health.hp).toBe(3);
  });

  it("turns aside any arrow short of a full draw", async () => {
    const { g, e } = await fighting();
    const him = g.world.need(e, "transform");
    const weak = spawnArrow(g, him.x - 10, him.y, 200, 0, 0.4, 1, false);
    const full = spawnArrow(g, him.x, him.y - 10, 0, 200, 0.4, 4, true);
    calderFightSystem(g, DT);
    expect(g.world.isAlive(weak)).toBe(false);
    expect(g.world.isAlive(full)).toBe(true);
  });

  it("once beaten, stays beaten for the run: his last words, his head left lying, and the crack groaning shut", async () => {
    const { g, e } = await fighting(), toasts: string[] = [];
    g.events.on("toast", ({ text }) => toasts.push(text));
    g.world.need(e, "health").hp = 0;
    bossSystem(g, DT);
    deathSystem(g);
    calderFightSystem(g, DT);
    expect(beaten(g, "calder")).toBe(true);
    expect(g.world.isAlive(e)).toBe(false);
    expect(calderFight(g)).toBeNull();
    expect(toasts).toEqual(expect.arrayContaining([...CALDER_FALLS, F.say.shutCrack]));
    expect(talking(g)?.lines).toEqual(CALDER_LAST_WORDS);
    expect(CALDER_LAST_WORDS.join(" ")).toContain("Oh. He sent you. Good.");
    const head = g.world.query("pickup").find(([, { pickup }]) => pickup.kind === "loot" && pickup.item.name === CALDERS_HEAD[3]);
    expect(head).toBeDefined();
    expect(g.world.has(head![0], "despawn")).toBe(false);   // it doesn't fade where it lies
    // The crack groans shut, and stays shut.
    for (let t = 0; t < F.crack.shut + 0.1; t += DT) calderFightSystem(g, DT);
    expect(crackWidth(g)).toBeCloseTo(F.crack.seam);
    expect(crackSealed(g)).toBe(1);
    // No spirit: his went home south.
    endTalk(g);
    spiritSystem(g);
    expect(spiritHere(g)).toBeNull();
    // Gone, and the crack shut, the next time he comes; back, and open, in a new run.
    enterArea(g, await loadArea("rift"), "stone");
    expect(standOff(g, 4)).toBeUndefined();
    expect(crackSealed(g)).toBe(1);
    resetGame(g);
    setState(g, "play");
    enterArea(g, await loadArea("rift"), "stone");
    expect(crackWidth(g)).toBe(1);
    expect(crackSealed(g)).toBe(0);
    expect(standOff(g, 4)).toBeDefined();
  });
});
