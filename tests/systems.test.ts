import { describe, expect, it } from "vitest";
import { BOW, DASH, FISHING } from "../src/data/player.ts";
import { T, Tile } from "../src/data/world.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { spawnBolt } from "../src/game/spawn.ts";
import { makeItem } from "../src/items/items.ts";
import { step } from "../src/systems/index.ts";
import { blocked } from "../src/world/collision.ts";

const DT = 1 / 60;

function playing(): Game {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  for (const [e] of g.world.query("enemy")) g.world.destroy(e);
  for (const [e] of g.world.query("pickup")) g.world.destroy(e);
  g.spawnTimer = 1e9;
  return g;
}
const run = (g: Game, seconds: number) => { for (let t = 0; t < seconds; t += DT) step(g, DT); };
const hero = (g: Game) => ({
  pos: g.world.need(g.player, "transform"),
  motion: g.world.need(g.player, "motion"),
  actions: g.world.need(g.player, "actions"),
  status: g.world.need(g.player, "status"),
});

describe("bow", () => {
  it("draws while held and shoots on release, faster after a full draw", () => {
    const g = playing();
    g.inventory.reset([makeItem("bow")]);
    hero(g).motion.aim = 0;
    g.input.attackPressed = true;
    run(g, BOW.drawTime + 0.05);
    expect(hero(g).actions.draw).not.toBeNull();
    g.input.attackReleased = true;
    step(g, DT);
    const arrows = g.world.query("arrow");
    expect(arrows).toHaveLength(1);
    const [, { arrow }] = arrows[0]!;
    expect(arrow.power).toBe(true);
    expect(arrow.vx).toBeCloseTo(BOW.minSpeed + BOW.maxSpeedBonus);
  });
});

describe("bow damage", () => {
  /** Draw for drawTime, release, and return the arrow loosed (if any). */
  function shoot(g: Game, drawTime: number) {
    for (const [e] of g.world.query("arrow")) g.world.destroy(e);
    g.world.need(g.player, "actions").cooldown = 0;
    g.input.attackPressed = true;
    run(g, drawTime);
    g.input.attackReleased = true;
    step(g, DT);
    return g.world.query("arrow")[0]?.[1].arrow ?? null;
  }

  it("only a full draw does real damage; a weak draw's arrow just drops to the ground", () => {
    const g = playing();
    g.inventory.reset([makeItem("bow")]);
    const hero = g.world.need(g.player, "hero");
    const dud = shoot(g, 0.1)!;                               // a quick shot at level 1
    expect(dud.dud).toBe(true);
    expect(dud.damage).toBe(0);
    expect(shoot(g, BOW.drawTime + 0.05)?.damage).toBe(hero.damage + 1);
    hero.damage = 6;                                         // later, with gear and levels
    expect(shoot(g, BOW.drawTime * 0.8)?.damage).toBe(2);
    expect(shoot(g, BOW.drawTime + 0.05)?.damage).toBe(7);
  });

  it("a dud lands further the more you drew, hurts nothing, then disappears", () => {
    const g = playing();
    g.inventory.reset([makeItem("bow")]);
    const p = hero(g).pos, motion = hero(g).motion;
    const landing = (drawTime: number) => {
      motion.aim = 0;
      const a = shoot(g, drawTime)!;
      const [e] = g.world.query("arrow")[0]!;
      run(g, BOW.dud.flightTime + 0.05);
      expect(a.grounded).toBe(true);
      return g.world.need(e, "transform").x - p.x;
    };
    const short = landing(0.05), long = landing(BOW.drawTime * 0.9);
    expect(long).toBeGreaterThan(short + 15);
    // Right in front of a slime: it lands without hurting it.
    const slime = g.world.create({
      transform: { x: p.x + 8, y: p.y }, knockback: { vx: 0, vy: 0 }, health: { hp: 3, maxHp: 3 },
      enemy: { kind: "slime", flash: 0, face: 1 }, slime: { timer: 99, hop: 0, dx: 0, dy: 0 },
    });
    landing(0.3);
    expect(g.world.need(slime, "health").hp).toBe(3);
    expect(g.world.need(slime, "knockback")).toEqual({ vx: 0, vy: 0 });
    run(g, BOW.stuckTime + 0.1);
    expect(g.world.query("arrow")).toHaveLength(0);
  });
});

describe("glancing arrows", () => {
  it("a dud that reaches an enemy bounces back off it, harmlessly, and lands", () => {
    const g = playing();
    g.inventory.reset([makeItem("bow")]);
    const p = hero(g).pos;
    hero(g).motion.aim = 0;
    const slime = g.world.create({
      transform: { x: p.x + 16, y: p.y }, knockback: { vx: 0, vy: 0 }, health: { hp: 3, maxHp: 3 },
      enemy: { kind: "slime", flash: 0, face: 1 }, slime: { timer: 99, hop: 0, dx: 0, dy: 0 },
    });
    const fx: string[] = [];
    g.world.need(g.player, "actions").cooldown = 0;
    g.input.attackPressed = true;
    run(g, 0.3);                                             // a half draw: a dud that would land past the slime
    g.input.attackReleased = true;
    step(g, DT);
    const [e, { arrow }] = g.world.query("arrow")[0]!;
    for (let t = 0; t < 0.6; t += DT) { step(g, DT); fx.push(...g.fx.map(f => f.type)); g.fx = []; }
    expect(arrow.bounced).toBe(true);
    expect(arrow.grounded).toBe(true);
    expect(g.world.need(e, "transform").x).toBeLessThan(p.x + 16);   // it came back off the slime
    expect(g.world.need(slime, "health").hp).toBe(3);
    expect(g.floaters.map(f => [f.text, f.crit])).toEqual([["0", false]]);
    expect(fx).toContain("hit");
  });
});

describe("dash", () => {
  it("covers two tiles, then waits out its cooldown", () => {
    const g = playing();
    const { pos } = hero(g);
    const x0 = pos.x;
    g.input.dashRequest = [1, 0];
    run(g, DASH.time + 0.05);
    expect(pos.x - x0).toBeGreaterThan(T * 1.5);
    const x1 = pos.x;
    g.input.dashRequest = [1, 0];
    step(g, DT);
    expect(pos.x).toBe(x1);                                  // still cooling down
  });
});

describe("fishing", () => {
  // A water tile with walkable ground beside it, to stand on.
  function shore(g: Game) {
    for (let y = 1; y < g.map.height - 1; y++) for (let x = 2; x < g.map.width - 1; x++)
      if (g.map.tiles[y]![x] === Tile.Water && g.map.tiles[y]![x - 2] === Tile.Grass && !blocked(g.map, (x - 2) * T, y * T, true))
        return { stand: { x: (x - 2) * T, y: y * T }, water: { x: x * T, y: y * T } };
    throw new Error("no shore");
  }

  it("casts over water, waits for a bite, and lands a fish", () => {
    const g = playing();
    g.inventory.reset([makeItem("rod")]);
    const { stand, water } = shore(g);
    Object.assign(hero(g).pos, stand);
    g.input.pointer = water;
    g.input.attackPressed = true;
    run(g, 0.2);
    expect(hero(g).actions.windup?.water).toBe(true);
    g.input.attackReleased = true;
    step(g, DT);
    const a = hero(g).actions;
    expect(a.fishing?.phase).toBe("cast");
    run(g, FISHING.castTime + 0.05);
    expect(a.fishing?.phase).toBe("wait");
    a.fishing!.biteAt = 0;
    step(g, DT);
    expect(a.fishing?.phase).toBe("bite");
    g.input.attackPressed = true;
    step(g, DT);
    expect(a.fishing).toBeNull();
    expect(g.inventory.grid.some(e => e.item.type === "fish")).toBe(true);
  });

  it("reels in when you walk away", () => {
    const g = playing();
    g.inventory.reset([makeItem("rod")]);
    const { stand, water } = shore(g);
    Object.assign(hero(g).pos, stand);
    hero(g).actions.fishing = { phase: "wait", x: water.x, y: water.y, t: 0, biteAt: 99 };
    g.input.keys.add("a");
    step(g, DT);
    expect(hero(g).actions.fishing).toBeNull();
  });
});

describe("spells", () => {
  it("a polymorph bolt turns the hero into a sheep; a dash dodges bolts", () => {
    const g = playing();
    const { pos, status, motion } = hero(g);
    spawnBolt(g, "poly", pos.x - 2, pos.y, 0, 0);
    motion.dash = 0.05;
    step(g, DT);
    expect(status.sheep).toBe(0);
    run(g, 0.1);
    expect(status.sheep).toBeGreaterThan(0);
  });
});

describe("loot on the ground", () => {
  it("blinks for its last seconds, then despawns after 20 s", async () => {
    const { LOOT_DESPAWN } = await import("../src/data/items.ts");
    const { blinkVisible } = await import("../src/game/despawn.ts");
    const { dropLoot } = await import("../src/game/spawn.ts");
    const g = playing();
    const p = hero(g).pos;
    const loot = dropLoot(g, p.x + 60, p.y, makeItem("ring"));
    run(g, LOOT_DESPAWN.after - LOOT_DESPAWN.blinkFor - 0.5);
    expect(g.world.isAlive(loot)).toBe(true);
    expect(blinkVisible(g.world.need(loot, "despawn").left)).toBe(true);
    const seen = new Set<boolean>();
    for (let t = 0; t < LOOT_DESPAWN.blinkFor - 0.1; t += DT) { step(g, DT); seen.add(blinkVisible(g.world.need(loot, "despawn").left)); }
    expect(seen).toEqual(new Set([true, false]));           // blinking
    run(g, 0.7);                                           // past 20 s in all
    expect(g.world.isAlive(loot)).toBe(false);
  });
});
