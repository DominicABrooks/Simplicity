// Calder, at the edge of the great crack at the top of the Thunder Rift: lightning shuts the hero in the glade as he
// comes close, a Storm mage far tougher than any, in all lightning's shapes: forking sparks; lines, stars and rings of
// strikes; rods with lightning running between them, and him blinking rod to rod (open to a blade after each blink);
// static that turns all but a full draw; and the crack opening as the hero's knocked about and closing as he lands hits.
// Once beaten, beaten for the run: his last words, his head left lying, the crack shut.
import { describe, expect, it } from "vitest";
import type { Entity } from "../src/core/ecs.ts";
import { loadArea } from "../src/areas/index.ts";
import { CALDER_STAND, GREAT_CRACK } from "../src/areas/rift.ts";
import { CALDER, CALDER_FALLS, CALDER_FIGHT as F, CALDER_LAST_WORDS, CALDER_READY, CALDERS_HEAD } from "../src/data/rift.ts";
import { MAGE } from "../src/data/enemies.ts";
import { HALF, T, Tile } from "../src/data/world.ts";
import { bossBar } from "../src/game/bossbar.ts";
import { beaten, bossSystem, bossWaiting } from "../src/game/bosses.ts";
import { calderFight, calderFightSystem, crackSealed, crackWidth, nearestOnCrack } from "../src/game/calderfight.ts";
import { damagePlayer, hitEnemy } from "../src/game/combat.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { LAIRS } from "../src/game/lairs.ts";
import { resetGame } from "../src/game/reset.ts";
import { spawnArrow, spawnBolt, spawnEnemy } from "../src/game/spawn.ts";
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
    expect(Math.hypot((me.x - f.x) / f.rx, (me.y - f.y) / f.ry)).toBeCloseTo(1, 1);   // (the crack's cold drawing him back in a touch)
  });

  it("fights him in the whole glade below the crack: a wide oval of open ground", async () => {
    const { g, f } = await fighting();
    expect(f.rx).toBe(F.arena.rx * T);
    expect(f.rx).toBeGreaterThan(2 * f.ry);
    expect(f.ry).toBeGreaterThan(4 * T);
    // Everything well inside the oval is open ground, and its north side comes up to the crack.
    for (let y = 0; y < g.map.height; y++) for (let x = 0; x < g.map.width; x++) {
      if (Math.hypot((x * T - f.x) / (f.rx * 0.9), (y * T - f.y) / (f.ry * 0.9)) > 1) continue;
      expect([Tile.Tree, Tile.Wall]).not.toContain(g.map.tiles[y]![x]);
    }
    expect(f.y - f.ry).toBeLessThan((GREAT_CRACK.y + GREAT_CRACK.wide) * T);
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
  const strikes = (g: Game) => g.world.query("strike", "transform").map(([, c]) => ({ x: c.transform.x, y: c.transform.y, t: c.strike.t }));
  const clear = (g: Game) => { for (const [e] of g.world.query("strike")) g.world.destroy(e); };
  /** Down to `share` of his health: into that mood. */
  const weaken = (g: Game, e: Entity, share: number) => { const h = g.world.need(e, "health"); h.hp = Math.floor(h.maxHp * share); calderFightSystem(g, DT); };

  it("forks his sparks as they fly: each one splits in three a moment out", async () => {
    const { g, e } = await fighting();
    for (const [b] of g.world.query("bolt")) g.world.destroy(b);
    const him = g.world.need(e, "transform");
    const spark = spawnBolt(g, "spark", him.x + MAGE.boltOffset, him.y, 100, 0);
    calderFightSystem(g, DT);
    for (let t = 0; t < F.fork.after + 0.05; t += DT) calderFightSystem(g, DT);
    expect(g.world.isAlive(spark)).toBe(false);
    const forks = g.world.query("bolt").map(([, c]) => Math.atan2(c.bolt.vy, c.bolt.vx)).sort((a, b) => a - b);
    expect(forks).toHaveLength(F.fork.count);
    expect(forks[0]).toBeCloseTo(-F.fork.spread);
    expect(forks[1]).toBeCloseTo(0);
    expect(forks[2]).toBeCloseTo(F.fork.spread);
  });

  it("marks his lightning on the ground in shapes: a line walking out at the hero, then a star bursting from him", async () => {
    const { g, e, f } = await fighting();
    const him = g.world.need(e, "transform"), me = g.world.need(g.player, "transform");
    Object.assign(him, { x: f.x - 60, y: f.y });
    Object.assign(me, { x: f.x + 40, y: f.y + 10 });
    clear(g);
    f.nextShape = 0;
    calderFightSystem(g, DT);
    const walk = strikes(g), toward = Math.atan2(me.y - him.y, me.x - him.x);
    expect(walk.length).toBeGreaterThan(4);
    for (const [i, s] of walk.entries()) {
      expect(Math.atan2(s.y - him.y, s.x - him.x)).toBeCloseTo(toward);   // all along the line at him
      expect(s.t).toBeCloseTo(F.warn + i * F.walk.gap);                    // each a moment after the last
    }
    clear(g);
    f.nextShape = 0;
    calderFightSystem(g, DT);
    const star = strikes(g), arms = new Set(star.map(s => Math.round(Math.atan2(s.y - him.y, s.x - him.x) * 100)));
    expect(star.length).toBeGreaterThan(F.star.arms * 2);
    expect(arms.size).toBeLessThanOrEqual(F.star.arms);
    for (const s of star) expect(Math.hypot((s.x - f.x) / f.rx, (s.y - f.y) / f.ry)).toBeLessThanOrEqual(1.0001);
  });

  it("drives three rods in as he weakens, and lightning runs round the triangle between them: jump it, or be struck", async () => {
    const { g, e, f } = await fighting(), toasts: string[] = [];
    g.events.on("toast", ({ text }) => toasts.push(text));
    weaken(g, e, 0.6);
    expect(f.mood).toBe(1);
    expect(toasts).toContain(F.say.rods);
    expect(f.rods).toHaveLength(3);
    for (const r of f.rods) expect(Math.hypot((r.x - f.x) / f.rx, (r.y - f.y) / f.ry)).toBeCloseTo(F.rods.out);
    f.nextBlink = 99;
    f.nextShape = 99;
    for (let t = 0; t < F.rods.plant + 0.05; t += DT) calderFightSystem(g, DT);
    const arc = f.arcs[0]!;
    expect(arc).toBeDefined();
    expect([arc.a, arc.b]).toEqual([f.rods[0], f.rods[1]]);
    // Stand on it: struck once it's live. Jumping over it: not.
    const me = g.world.need(g.player, "transform"), status = g.world.need(g.player, "status"), hp = g.world.need(g.player, "health");
    const on = (a: typeof arc) => Object.assign(me, { x: (a.a.x + a.b.x) / 2, y: (a.a.y + a.b.y) / 2 });
    status.hurt = 0;
    const before = hp.hp;
    for (let t = DT; t < F.rods.arc.warn - 0.1; t += DT) { on(arc); calderFightSystem(g, DT); }
    expect(hp.hp).toBe(before);
    for (let t = 0; t < 0.2; t += DT) { on(arc); calderFightSystem(g, DT); }
    expect(hp.hp).toBe(before - 1);
    // The next side along, round and round.
    for (let t = 0; t < F.rods.every[0]; t += DT) calderFightSystem(g, DT);
    const next = f.arcs.at(-1)!;
    expect([next.a, next.b]).toEqual([f.rods[1], f.rods[2]]);
    status.hurt = 0;
    g.world.need(g.player, "motion").jump = 1;
    on(next);
    const now = hp.hp;
    next.t = next.warn;
    calderFightSystem(g, DT);
    expect(hp.hp).toBe(now);
  });

  it("blinks from rod to rod, the air crackling behind him, and stops to earth himself: a blade then cuts twice as deep", async () => {
    const { g, e, f } = await fighting();
    weaken(g, e, 0.6);
    f.planted = F.rods.plant;
    f.nextArc = 99;
    f.nextShape = 99;
    f.nextBlink = 0;
    const him = g.world.need(e, "transform"), from = { x: him.x, y: him.y };
    calderFightSystem(g, DT);
    expect({ x: him.x, y: him.y }).toEqual(f.rods[1]);
    expect(f.arcs.at(-1)).toMatchObject({ a: from, b: f.rods[1], warn: F.rods.trail.warn });
    calderFightSystem(g, DT);
    expect(f.earth).toBeGreaterThan(0);
    expect(g.world.need(e, "mage").held).toBe(true);
    const health = g.world.need(e, "health"), before = health.hp;
    g.rng.next = () => 0.99;                                  // no crit
    hitEnemy(g, e, 3, true);
    calderFightSystem(g, DT);
    expect(before - health.hp).toBe(3 * F.cut);
    for (let t = 0; t < F.earth + 0.1; t += DT) calderFightSystem(g, DT);
    expect(g.world.need(e, "mage").held).toBe(false);
    const now = health.hp;
    hitEnemy(g, e, 3, true);
    calderFightSystem(g, DT);
    expect(now - health.hp).toBe(3);
  });

  it("calls the whole storm down at the end: rings of strikes closing in on the hero, the last where he stood", async () => {
    const { g, e, f } = await fighting(), toasts: string[] = [];
    g.events.on("toast", ({ text }) => toasts.push(text));
    weaken(g, e, 0.3);
    expect(f.mood).toBe(2);
    expect(f.rods).toHaveLength(3);                            // straight past the rods: in they go too
    expect(toasts).toEqual(expect.arrayContaining([F.say.rods, F.say.eye]));
    const me = g.world.need(g.player, "transform");
    Object.assign(me, { x: f.x, y: f.y });
    clear(g);
    f.shapes = 0;
    f.nextShape = 0;
    calderFightSystem(g, DT);
    const marks = strikes(g), B = F.bullseye;
    const at = (r: number) => marks.filter(s => Math.abs(Math.hypot(s.x - me.x, s.y - me.y) - r) < 0.5);
    expect(at(B.rings[0]!.r).length).toBeGreaterThan(B.rings[0]!.count / 2);
    expect(at(B.rings[0]!.r).every(s => Math.abs(s.t - F.warn) < 1e-9)).toBe(true);
    expect(at(B.rings[1]!.r)).toHaveLength(B.rings[1]!.count);
    expect(at(B.rings[1]!.r).every(s => Math.abs(s.t - F.warn - B.between) < 1e-9)).toBe(true);
    expect(at(0)).toHaveLength(1);
    expect(at(0)[0]!.t).toBeCloseTo(F.warn + 2 * B.between);
    // And the rods arc all at once.
    f.planted = F.rods.plant;
    f.arcs = [];
    f.side = 0;
    f.nextArc = 0;
    f.nextBlink = 99;
    calderFightSystem(g, DT);
    expect(f.arcs).toHaveLength(3);
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
