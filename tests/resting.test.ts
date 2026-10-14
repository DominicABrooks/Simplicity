// Resting by the campfire: click it close by and the hero sits, a heart back every few seconds, until he does
// something else or something hurts him.
import { describe, expect, it } from "vitest";
import type { Entity } from "../src/core/ecs.ts";
import { REST } from "../src/data/rest.ts";
import { damagePlayer } from "../src/game/combat.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { isCampfire, resting, startResting, updateResting } from "../src/game/resting.ts";

/** At the camp, beside the fire, two hearts down. */
function byTheFire(): { g: Game; fire: Entity; toasts: string[] } {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  const fire = g.world.query("targetable", "transform").map(([e]) => e).find(e => isCampfire(g, e))!;
  const at = g.world.need(fire, "transform");
  Object.assign(g.world.need(g.player, "transform"), { x: at.x - 10, y: at.y });
  g.world.need(g.player, "health").hp -= 2;
  const toasts: string[] = [];
  g.events.on("toast", t => toasts.push(t.text));
  return { g, fire, toasts };
}
const hp = (g: Game) => g.world.need(g.player, "health").hp;
const wait = (g: Game, seconds: number) => { for (let t = 0; t < seconds; t += 0.05) updateResting(g, 0.05); };

describe("resting by the campfire", () => {
  it("sits the hero down and gives a heart back every few seconds, up to full", () => {
    const { g, fire, toasts } = byTheFire();
    const { maxHp } = g.world.need(g.player, "health"), start = hp(g);
    expect(startResting(g, fire)).toBe(true);
    expect(resting(g)?.fire).toBe(fire);
    expect(g.target).toBe(fire);
    wait(g, REST.every - 0.2);
    expect(hp(g)).toBe(start);                     // slowly
    wait(g, 0.4);
    expect(hp(g)).toBe(start + 1);
    wait(g, REST.every * 3);
    expect(hp(g)).toBe(maxHp);                     // never past full
    expect(toasts).toContain("Fully rested");
    expect(resting(g)).not.toBeNull();             // and stays sat
  });

  it("gets up when he's attacked, and stops healing", () => {
    const { g, fire } = byTheFire();
    startResting(g, fire);
    wait(g, REST.every + 0.1);
    damagePlayer(g, 0, 0);
    const after = hp(g);
    wait(g, 0.05);
    expect(resting(g)).toBeNull();
    wait(g, REST.every * 2);
    expect(hp(g)).toBe(after);
  });

  it("gets up when he moves, attacks, jumps or dashes", () => {
    for (const act of [(g: Game) => g.input.keys.add("w"), (g: Game) => { g.input.attackPressed = true; }, (g: Game) => { g.input.jumpPressed = true; }, (g: Game) => { g.input.dashRequest = [1, 0]; }]) {
      const { g, fire } = byTheFire();
      startResting(g, fire);
      wait(g, 0.5);
      act(g);
      updateResting(g, 0.05);
      expect(resting(g)).toBeNull();
    }
  });

  it("is only by a fire close by", () => {
    const { g, fire, toasts } = byTheFire();
    const at = g.world.need(fire, "transform");
    Object.assign(g.world.need(g.player, "transform"), { x: at.x - REST.reach - 10, y: at.y });
    expect(startResting(g, fire)).toBe(true);      // it was the fire: no attack
    expect(resting(g)).toBeNull();
    expect(toasts).toContain("Too far away to rest");
    expect(startResting(g, g.player)).toBe(false); // not a fire
  });
});
