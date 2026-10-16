import { describe, expect, it } from "vitest";
import { SWIPE, CRIT } from "../src/data/player.ts";
import { damagePlayer, grantXP, hitEnemy, polymorph } from "../src/game/combat.ts";
import { createGame, setState } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { mageSwingK, swingRel, sweptThrough, MAGE_SWING_TIME } from "../src/game/swing.ts";
import { makeItem } from "../src/items/items.ts";
import { step } from "../src/systems/index.ts";

function playing() {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  // An empty world around the hero, for controlled tests.
  for (const [e] of g.world.query("enemy")) g.world.destroy(e);
  for (const [e] of g.world.query("pickup")) g.world.destroy(e);
  return g;
}

function addSlime(g: ReturnType<typeof playing>, dx: number, dy: number, hp = 3) {
  const p = g.world.need(g.player, "transform");
  return g.world.create({
    transform: { x: p.x + dx, y: p.y + dy },
    knockback: { vx: 0, vy: 0 },
    health: { hp, maxHp: hp },
    enemy: { kind: "slime", flash: 0, face: 1 },
    slime: { timer: 99, hop: 0, dx: 0, dy: 0 },
    renderable: { kind: "slime" },
  });
}

describe("swingRel", () => {
  it("winds up to one side, sweeps across, and recovers", () => {
    expect(swingRel(1, 0)).toBeCloseTo(SWIPE.arc * 0.4);
    expect(swingRel(1, SWIPE.sweepStart)).toBeCloseTo(SWIPE.arc);
    expect(swingRel(1, SWIPE.sweepEnd)).toBeCloseTo(-SWIPE.arc);
    expect(swingRel(1, 1)).toBeCloseTo(0);
    expect(swingRel(-1, SWIPE.sweepStart)).toBeCloseTo(-SWIPE.arc);
  });

  it("hits only what the blade sweeps through, during the sweep", () => {
    expect(sweptThrough(1, 0.3, 0.45, 0)).toBe(true);          // straight ahead, mid-sweep
    expect(sweptThrough(1, 0.3, 0.45, Math.PI)).toBe(false);   // behind
    expect(sweptThrough(1, 0.0, 0.2, 0)).toBe(false);          // still winding up
    expect(sweptThrough(1, 0.7, 0.9, 0)).toBe(false);          // recovering
  });

  it("maps a mage swing onto the same curve", () => {
    expect(mageSwingK(0)).toBe(0);
    expect(mageSwingK(MAGE_SWING_TIME)).toBeCloseTo(1);
    expect(mageSwingK(MAGE_SWING_TIME + 1)).toBe(1);
  });
});

describe("combat", () => {
  it("crits deal double damage", () => {
    const g = playing();
    const crits = new Set<number>();
    for (let i = 0; i < 200; i++) crits.add(hitEnemy(g, addSlime(g, 30, 0, 100), 3));
    expect([...crits].sort()).toEqual([3, 3 * CRIT.multiplier]);
  });

  it("gear's crit chance comes on top of everyone's", () => {
    const crits = (bonus: number) => {
      const g = playing();
      g.world.need(g.player, "hero").crit = bonus;
      let n = 0;
      g.rng.next = () => CRIT.chance + 0.05;                  // just past everyone's chance
      for (let i = 0; i < 20; i++) if (hitEnemy(g, addSlime(g, 30, 0, 100), 3) === 3 * CRIT.multiplier) n++;
      return n;
    };
    expect(crits(0)).toBe(0);
    expect(crits(6)).toBe(20);
  });

  it("damage breaks a polymorph and knocks the hero back", () => {
    const g = playing();
    polymorph(g);
    expect(g.world.need(g.player, "status").sheep).toBeGreaterThan(0);
    const hp = g.world.need(g.player, "health").hp;
    const p = g.world.need(g.player, "transform");
    damagePlayer(g, p.x - 10, p.y);
    expect(g.world.need(g.player, "status").sheep).toBe(0);
    expect(g.world.need(g.player, "health").hp).toBe(hp - 1);
    expect(g.world.need(g.player, "knockback").vx).toBeGreaterThan(0);
  });

  it("falls at 0 hp", () => {
    const g = playing();
    g.world.need(g.player, "health").hp = 1;
    damagePlayer(g, 0, 0);
    expect(g.state).toBe("dead");
  });

  it("levels up through several levels at once, healing fully and raising max HP", () => {
    const g = playing();
    g.world.need(g.player, "health").hp = 1;
    grantXP(g, 50 + 90 + 10, 0, 0);
    const hero = g.world.need(g.player, "hero"), health = g.world.need(g.player, "health");
    expect(hero.level).toBe(3);
    expect(hero.xp).toBe(10);
    expect(health.maxHp).toBe(6);
    expect(health.hp).toBe(6);
  });

  it("a sword swipe hits a slime in front and not one behind", () => {
    const g = playing();
    g.inventory.reset([makeItem("blade")]);
    g.world.need(g.player, "motion").aim = 0;
    const front = addSlime(g, 12, 0, 100), back = addSlime(g, -12, 0, 100);
    g.input.attackPressed = true;
    for (let i = 0; i < 30; i++) step(g, 1 / 60);
    expect(g.world.need(front, "health").hp).toBeLessThan(100);
    expect(g.world.need(back, "health").hp).toBe(100);
  });

  it("kills give XP and count toward the spawn cap", () => {
    const g = playing();
    const slime = addSlime(g, 60, 0, 1);
    hitEnemy(g, slime, 5);
    for (let i = 0; i < 10; i++) step(g, 1 / 60);           // past the hitstop, if it crit
    expect(g.world.isAlive(slime)).toBe(false);
    expect(g.kills).toBe(1);
    expect(g.world.need(g.player, "hero").xp).toBe(10);
  });
});

describe("simulation", () => {
  it("runs a few minutes of idle play without errors", () => {
    const g = createGame();
    resetGame(g);
    setState(g, "play");
    for (let i = 0; i < 60 * 180 && g.state === "play"; i++) step(g, 1 / 60);
    expect(["play", "dead"]).toContain(g.state);
  });
});
