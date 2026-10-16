// A curiosity counts as found wherever it is: in the bag, in hand on the cursor, or lying on the ground. Handing one
// over takes it from the hand as well as the bag.
import { describe, expect, it } from "vitest";
import { carryingCurio, curioFound, spendCurio, spentCurios } from "../src/game/curios.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { dropLoot } from "../src/game/spawn.ts";
import { makeCurio } from "../src/items/items.ts";

function fresh(): Game {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  return g;
}

describe("where a curiosity is", () => {
  it("is carried in hand on the cursor as much as in the bag, and spending it takes it from the hand", () => {
    const g = fresh();
    g.inventory.held = makeCurio("key");
    expect(carryingCurio(g, "key")).toBe(true);
    expect(curioFound(g, "key")).toBe(true);
    spendCurio(g, "key");
    expect(g.inventory.held).toBeNull();
    expect(spentCurios(g).has("key")).toBe(true);
  });

  it("is found, though not carried, lying on the ground: so the river won't give up a second one", () => {
    const g = fresh();
    expect(curioFound(g, "eye")).toBe(false);
    dropLoot(g, 40, 40, makeCurio("eye"));
    expect(carryingCurio(g, "eye")).toBe(false);
    expect(curioFound(g, "eye")).toBe(true);
  });
});
