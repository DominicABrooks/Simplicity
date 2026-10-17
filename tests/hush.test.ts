// The hush (src/game/hush.ts): talking to someone, the slimes and mages about let him be, and nothing new turns up;
// for a moment after too. A blow from him ends it; a boss fight is never hushed.
import { describe, expect, it } from "vitest";
import type { Entity } from "../src/core/ecs.ts";
import { loadArea } from "../src/areas/index.ts";
import { RIME_AT } from "../src/areas/hollow.ts";
import { HUSH } from "../src/data/dialogue.ts";
import { SLIME } from "../src/data/enemies.ts";
import { T } from "../src/data/world.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { hushed } from "../src/game/hush.ts";
import { resetGame } from "../src/game/reset.ts";
import { rimeFightSystem } from "../src/game/rimefight.ts";
import { spawnEnemy } from "../src/game/spawn.ts";
import { endTalk, startTalk, talking } from "../src/game/talk.ts";
import { enterArea } from "../src/game/travel.ts";
import { step } from "../src/systems/index.ts";

const DT = 1 / 60;

/** In the Ashwild, by Yssa at her post, with nothing else about. */
async function byYssa(): Promise<{ g: Game; her: Entity }> {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  enterArea(g, await loadArea("ashwild"), "witchwood");
  for (const [e] of g.world.query("enemy")) g.world.destroy(e);
  const [her, { transform: t }] = g.world.query("renderable", "transform").find(([, c]) => c.renderable.kind === "yssa")!;
  Object.assign(g.world.need(g.player, "transform"), { x: t.x + 12, y: t.y });
  return { g, her };
}

/** A slime right on top of him. */
function slimeOnHim(g: Game): Entity {
  const p = g.world.need(g.player, "transform");
  return g.world.create({
    transform: { x: p.x, y: p.y }, knockback: { vx: 0, vy: 0 }, health: { hp: SLIME.hp, maxHp: SLIME.hp },
    enemy: { kind: "slime", flash: 0, face: 1 }, slime: { timer: 0, hop: 0, dx: 0, dy: 0 },
    targetable: { hostile: true, name: "Slime", radius: 5, height: 1 },
    renderable: { kind: "slime" },
  });
}

/** Run every system for `s` seconds, keeping the slime on top of him (hops would carry it off). */
function hold(g: Game, slime: Entity, s: number) {
  const p = g.world.need(g.player, "transform");
  for (let t = 0; t < s; t += DT) { Object.assign(g.world.need(slime, "transform"), { x: p.x, y: p.y }); step(g, DT); }
}

describe("the hush while he's talking", () => {
  it("a slime touching him mid-talk doesn't hurt; nothing new turns up; once the talk's over and the grace runs out, it does hurt", async () => {
    const { g, her } = await byYssa(), health = g.world.need(g.player, "health"), hp = health.hp;
    startTalk(g, her);
    expect(talking(g)).not.toBeNull();
    const slime = slimeOnHim(g);
    g.spawnTimer = 0;
    hold(g, slime, 2);
    expect(hushed(g)).toBe(true);
    expect(health.hp).toBe(hp);
    expect(g.world.count("enemy")).toBe(1);                    // the spawner holds off

    endTalk(g);
    hold(g, slime, HUSH.grace * 0.5);
    expect(hushed(g)).toBe(true);                              // a moment's grace after
    expect(health.hp).toBe(hp);
    hold(g, slime, HUSH.grace);
    expect(hushed(g)).toBe(false);
    expect(health.hp).toBeLessThan(hp);
  });

  it("a slime coming at him turns away", async () => {
    const { g, her } = await byYssa(), p = g.world.need(g.player, "transform");
    const e = slimeOnHim(g), s = g.world.need(e, "transform"), slime = g.world.need(e, "slime");
    Object.assign(s, { x: p.x - 2 * T, y: p.y });
    Object.assign(slime, { dx: 1, dy: 0, hop: SLIME.hopTime, timer: 1 });   // mid-hop, straight at him
    startTalk(g, her);
    step(g, DT);
    expect(slime.dx).toBeLessThan(0);
    for (let t = 0; t < 2; t += DT) step(g, DT);
    expect(Math.hypot(s.x - p.x, s.y - p.y)).toBeGreaterThan(T);
  });

  it("the mages hold their spells: none starts, and one being gathered is let go", async () => {
    const { g, her } = await byYssa(), p = g.world.need(g.player, "transform");
    for (let i = 0; i < 40 && g.world.count("mage") === 0; i++) { g.kills = 999; spawnEnemy(g, 40); }
    for (const [e] of g.world.query("slime")) g.world.destroy(e);
    const [m, { transform: s, mage }] = g.world.query("mage", "transform")[0]!;
    Object.assign(s, { x: p.x + 5 * T, y: p.y });
    Object.assign(mage, { casting: true, castT: 0, castK: 0.5, spell: "fireball", timer: 0 });   // halfway through gathering one
    startTalk(g, her);
    for (let t = 0; t < 3; t += DT) { step(g, DT); expect(mage.casting).toBe(false); }
    expect(g.world.query("bolt").length).toBe(0);
    expect(g.world.isAlive(m)).toBe(true);
  });

  it("a blow from him ends it, for the rest of that talk", async () => {
    const { g, her } = await byYssa(), health = g.world.need(g.player, "health"), hp = health.hp;
    startTalk(g, her);
    const slime = slimeOnHim(g);
    hold(g, slime, 0.2);
    expect(hushed(g)).toBe(true);
    g.world.need(g.player, "actions").attack = 0.1;            // he swings
    step(g, DT);
    expect(hushed(g)).toBe(false);
    expect(talking(g)).not.toBeNull();                         // still talking, but it's broken
    hold(g, slime, 1);
    expect(hushed(g)).toBe(false);
    expect(health.hp).toBeLessThan(hp);
  });

  it("never in a boss fight: Rime throws her icicles at him whoever he's talking to", async () => {
    const g = createGame();
    resetGame(g);
    setState(g, "play");
    enterArea(g, await loadArea("hollow"), "stone");
    for (const [e] of g.world.query("enemy")) g.world.destroy(e);
    Object.assign(g.world.need(g.player, "transform"), { x: RIME_AT.x, y: RIME_AT.y + 3 * T });
    rimeFightSystem(g, DT);
    const [, { mage }] = g.world.query("renderable", "mage").find(([, c]) => c.renderable.kind === "rime")!;
    g.world.add(g.player, "conversation", { with: g.player, name: "test", key: "carving", lines: ["..."], line: 0, t: 0 });
    let cast = false, bolts = 0;
    for (let t = 0; t < 8; t += DT) { step(g, DT); cast ||= mage.casting; bolts = Math.max(bolts, g.world.query("bolt").length); expect(hushed(g)).toBe(false); }
    expect(cast || bolts > 0).toBe(true);                      // her first volley's out by now
  });
});
