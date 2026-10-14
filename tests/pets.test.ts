import { describe, expect, it } from "vitest";
import { loadArea } from "../src/areas/index.ts";
import { PETS } from "../src/data/pets.ts";
import { HALF, T } from "../src/data/world.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { enterPets, petSystem } from "../src/game/pets.ts";
import { resetGame } from "../src/game/reset.ts";
import { enterArea } from "../src/game/travel.ts";
import { walkable, walkwaysOf } from "../src/world/walkways.ts";

async function inArea(id: string, entry: string): Promise<Game> {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  enterArea(g, await loadArea(id), entry);
  enterPets(g);
  return g;
}
const pets = (g: Game) => g.world.query("pet", "transform");
const tileUnder = (t: { x: number; y: number }) => [Math.floor((t.x + HALF) / T), Math.floor((t.y + HALF) / T)] as const;
/** Put the hero far off in a corner, out of everyone's way. */
const heroAway = (g: Game) => Object.assign(g.world.need(g.player, "transform"), { x: -1000, y: -1000 });

describe("dogs and cats", () => {
  it("are about in the Market Quarter, as many as it has", async () => {
    const g = await inArea("capital", "southgate"), all = pets(g);
    expect(all.filter(([, { pet }]) => pet.species === "dog")).toHaveLength(PETS.out.capital!.dog);
    expect(all.filter(([, { pet }]) => pet.species === "cat")).toHaveLength(PETS.out.capital!.cat);
    for (const [, { renderable }] of g.world.query("pet", "renderable")) expect(renderable.kind).toBe("pet");
  });

  it("aren't anywhere they don't belong", async () => {
    const g = await inArea("kingsroad", "gate");
    expect(pets(g)).toHaveLength(0);
  });

  it("go about the streets, never through anything built or into the water", async () => {
    const g = await inArea("capital", "southgate"), ways = walkwaysOf(g.map);
    heroAway(g);
    const start = new Map(pets(g).map(([e, { transform }]) => [e, { ...transform }]));
    for (let i = 0; i < 3000; i++) {                       // two and a half minutes
      petSystem(g, 0.05);
      if (i % 10) continue;
      for (const [, { transform }] of pets(g)) {
        const [x, y] = tileUnder(transform);
        expect(walkable(ways, x, y), `a pet at tile ${x},${y}`).toBe(true);
      }
    }
    const moved = pets(g).filter(([e, { transform }]) => Math.hypot(transform.x - start.get(e)!.x, transform.y - start.get(e)!.y) > 2 * T);
    const dogs = moved.filter(([, { pet }]) => pet.species === "dog").length, cats = moved.length - dogs;
    expect(dogs).toBeGreaterThanOrEqual(PETS.out.capital!.dog * 0.6);
    expect(cats).toBeGreaterThan(0);
  });

  it("a cat bolts from the hero who comes too close", async () => {
    const g = await inArea("capital", "southgate");
    const [, { pet, transform }] = pets(g).find(([, { pet }]) => pet.species === "cat")!;
    Object.assign(pet, { pose: "sit", wait: 30, calm: 0 });
    Object.assign(g.world.need(g.player, "transform"), { x: transform.x + 5, y: transform.y });
    petSystem(g, 0.05);
    expect(pet.running).toBe(true);
    expect(pet.path.length).toBeGreaterThan(0);
    const [ex, ey] = pet.path[pet.path.length - 1]!;
    expect(Math.hypot((ex + 0.5) * T - transform.x - 5, (ey + 0.5) * T - transform.y)).toBeGreaterThan(3 * T);   // away from the hero
  });

  it("dogs come up to the hero and sit by them, wagging", async () => {
    const g = await inArea("capital", "southgate"), hero = g.world.need(g.player, "transform");
    const dogs = pets(g).filter(([, { pet }]) => pet.species === "dog");
    let greeted = 0;
    for (const [, { pet, transform }] of dogs) {           // the hero stands near each in turn: about half come over
      Object.assign(pet, { pose: "sit", wait: 30, calm: 0, moving: false, running: false, greeting: false, path: [] });
      Object.assign(hero, { x: transform.x + 16, y: transform.y });
      for (let i = 0; i < 60 && !(pet.greeting && !pet.moving); i++) petSystem(g, 0.05);
      if (pet.greeting && !pet.moving) {
        greeted++;
        expect(pet.pose).toBe("sit");
        expect(Math.hypot(hero.x - transform.x, hero.y - transform.y)).toBeLessThanOrEqual(PETS.greet.near);
      }
    }
    expect(greeted).toBeGreaterThan(0);
  });

  it("cats go to the doorsteps and curl up in the rain", async () => {
    const g = await inArea("capital", "southgate");
    heroAway(g);
    g.weather.rain = 1;
    g.hour = 12;
    for (const [, { pet }] of pets(g)) pet.wait = 0;
    for (let i = 0; i < 2400; i++) petSystem(g, 0.05);
    const cats = pets(g).filter(([, { pet }]) => pet.species === "cat");
    const curled = cats.filter(([, { pet }]) => pet.pose === "lie" && !pet.moving);
    expect(curled.length).toBeGreaterThanOrEqual(cats.length * 0.75);
  });
});
