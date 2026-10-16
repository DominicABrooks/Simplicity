// Sleeping in the camp's tent: click it close by and the hero crawls in, the hours run by fast with a heart
// back for each, until something wakes him; then he's up where he was standing.
import { describe, expect, it } from "vitest";
import type { Entity } from "../src/core/ecs.ts";
import { SLEEP, TENT_TARGET } from "../src/data/rest.ts";
import { damagePlayer } from "../src/game/combat.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { sleeping, startSleeping, updateSleeping, wake } from "../src/game/sleeping.ts";

/** At the camp, beside the tent, two hearts down. */
function byTheTent(): { g: Game; tent: Entity; toasts: string[] } {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  const tent = g.world.query("targetable", "transform").map(([e]) => e).find(e => g.world.get(e, "targetable")?.name === TENT_TARGET.name)!;
  const at = g.world.need(tent, "transform");
  Object.assign(g.world.need(g.player, "transform"), { x: at.x, y: at.y + 12 });
  g.world.need(g.player, "health").hp -= 2;
  const toasts: string[] = [];
  g.events.on("toast", t => toasts.push(t.text));
  return { g, tent, toasts };
}
const hp = (g: Game) => g.world.need(g.player, "health").hp;
const wait = (g: Game, seconds: number) => { for (let t = 0; t < seconds; t += 0.05) updateSleeping(g, 0.05); };

describe("sleeping in the tent", () => {
  it("crawls in, runs the clock fast and heals, then wakes where he stood", () => {
    const { g, tent } = byTheTent();
    const from = { ...g.world.need(g.player, "transform") }, hour = g.hour, start = hp(g);
    expect(startSleeping(g, tent)).toBe(true);
    expect(sleeping(g)?.bed).toBe(tent);
    expect(g.world.need(g.player, "transform")).not.toEqual(from);   // into the tent
    g.input.keys.add("w");
    wait(g, 2.5 / SLEEP.hoursPerSecond);
    expect((g.hour - hour + 24) % 24).toBeCloseTo(2.5, 0);
    expect(hp(g)).toBe(start + 2);
    expect(g.input.keys.size).toBe(0);                                // held keys don't walk him off
    wake(g);
    expect(sleeping(g)).toBeNull();
    expect(g.world.need(g.player, "transform")).toEqual(from);
  });

  it("wakes when he's hurt", () => {
    const { g, tent } = byTheTent();
    startSleeping(g, tent);
    wait(g, 0.2);
    damagePlayer(g, 0, 0);
    wait(g, 0.05);
    expect(sleeping(g)).toBeNull();
  });

  it("is only in a tent close by", () => {
    const { g, tent, toasts } = byTheTent();
    const at = g.world.need(tent, "transform");
    Object.assign(g.world.need(g.player, "transform"), { x: at.x - SLEEP.reach - 10, y: at.y });
    expect(startSleeping(g, tent)).toBe(true);
    expect(sleeping(g)).toBeNull();
    expect(toasts).toContain("Too far away to sleep");
    expect(startSleeping(g, g.player)).toBe(false);
  });
});
