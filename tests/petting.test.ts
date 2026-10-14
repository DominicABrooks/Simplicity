import { describe, expect, it } from "vitest";
import { loadArea } from "../src/areas/index.ts";
import type { Entity } from "../src/core/ecs.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { PETTING, isPetted, startPetting, updatePetting } from "../src/game/petting.ts";
import { enterPets, petSystem } from "../src/game/pets.ts";
import { resetGame } from "../src/game/reset.ts";
import { enterArea } from "../src/game/travel.ts";

const DT = 1 / 30;

/** In the Market Quarter with its dogs and cats about, each named and ringed. */
async function withPets(): Promise<Game> {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  enterArea(g, await loadArea("capital"), "southgate");
  enterPets(g);
  updatePetting(g, DT);
  return g;
}
const pets = (g: Game) => g.world.query("pet", "transform", "targetable");
const run = (g: Game, seconds: number) => { for (let t = 0; t < seconds; t += DT) { petSystem(g, DT); updatePetting(g, DT); } };
/** Stand the hero `d` px south of a pet. */
const standBy = (g: Game, e: Entity, d: number) => { const t = g.world.need(e, "transform"); Object.assign(g.world.need(g.player, "transform"), { x: t.x, y: t.y + d }); };

describe("the dogs and cats", () => {
  it("are friendly targets, each with a name", async () => {
    const g = await withPets(), all = pets(g);
    expect(all.length).toBeGreaterThan(5);
    for (const [, { pet, targetable }] of all) {
      expect(targetable.hostile).toBe(false);
      expect(targetable.name).toMatch(new RegExp(`^[A-Z][a-z]+ the ${pet.species}$`));
    }
  });

  it("can be petted close by, and then stay put, sat facing you, with hearts", async () => {
    for (const species of ["dog", "cat"] as const) {
      const g = await withPets(), [e] = pets(g).find(([, { pet }]) => pet.species === species)!;
      standBy(g, e, 10);
      expect(startPetting(g, e)).toBe(true);
      expect(isPetted(e)).toBe(true);
      const at = { ...g.world.need(e, "transform") }, hearts = g.floaters.length;
      run(g, PETTING.pat - 0.5);
      const pet = g.world.need(e, "pet"), t = g.world.need(e, "transform"), hero = g.world.need(g.player, "transform");
      expect(t).toEqual(at);
      expect(pet.moving).toBe(false);
      expect(["sit", "lie"]).toContain(pet.pose);
      expect(pet.facing).toBeCloseTo(Math.atan2(hero.y - t.y, hero.x - t.x));
      expect(g.floaters.length).toBeGreaterThan(hearts);
      expect(g.floaters.some(f => f.text === "♥")).toBe(true);
    }
  });

  it("keep being petted as long as you keep at it, then go back to their own business", async () => {
    const g = await withPets(), [e] = pets(g)[0]!;
    standBy(g, e, 10);
    startPetting(g, e);
    run(g, 2);
    startPetting(g, e);                                      // another pat
    run(g, 2);
    expect(isPetted(e)).toBe(true);
    run(g, PETTING.most + 1);
    expect(isPetted(e)).toBe(false);
  });

  it("can't be petted from afar, and walking off ends it", async () => {
    const g = await withPets(), [e] = pets(g)[0]!;
    standBy(g, e, PETTING.reach + 10);
    expect(startPetting(g, e)).toBe(true);                   // a pet, but too far: nothing happens
    expect(isPetted(e)).toBe(false);
    standBy(g, e, 10);
    startPetting(g, e);
    g.world.need(g.player, "transform").y += 60;
    run(g, DT);
    expect(isPetted(e)).toBe(false);
  });

  it("include a cat that won't bolt while you've got it targeted", async () => {
    const g = await withPets(), [e] = pets(g).find(([, { pet }]) => pet.species === "cat")!;
    g.target = e;
    standBy(g, e, 10);
    const at = { ...g.world.need(e, "transform") };
    run(g, 1);
    expect(g.world.need(e, "pet").running).toBe(false);
    expect(Math.hypot(g.world.need(e, "transform").x - at.x, g.world.need(e, "transform").y - at.y)).toBeLessThan(8);
  });

  it("aren't anyone else: people and dummies can't be petted", async () => {
    const g = await withPets();
    expect(startPetting(g, g.player)).toBe(false);
    expect(startPetting(g, null)).toBe(false);
  });
});
