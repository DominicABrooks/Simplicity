// The mysterious stone: one catch in twenty comes up a stone instead of a koi.
import { describe, expect, it } from "vitest";
import { MYSTERIOUS_STONE } from "../src/data/items.ts";
import { T, Tile } from "../src/data/world.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { makeItem } from "../src/items/items.ts";
import { step } from "../src/systems/index.ts";
import { blocked } from "../src/world/collision.ts";

const DT = 1 / 60;

/** Rod in hand on the shore, line in the water, and a fish biting. */
function biting(): { g: Game; toasts: string[] } {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  g.inventory.reset([makeItem("rod")]);
  const toasts: string[] = [];
  g.events.on("toast", t => toasts.push(t.text));
  let shore: { stand: { x: number; y: number }; water: { x: number; y: number } } | null = null;
  for (let y = 1; y < g.map.height - 1 && !shore; y++) for (let x = 2; x < g.map.width - 1 && !shore; x++)
    if (g.map.tiles[y]![x] === Tile.Water && g.map.tiles[y]![x - 2] === Tile.Grass && !blocked(g.map, (x - 2) * T, y * T, true))
      shore = { stand: { x: (x - 2) * T, y: y * T }, water: { x: x * T, y: y * T } };
  Object.assign(g.world.need(g.player, "transform"), shore!.stand);
  const a = g.world.need(g.player, "actions");
  a.fishing = { phase: "bite", x: shore!.water.x, y: shore!.water.y, t: 0, biteAt: 0 } as typeof a.fishing;
  return { g, toasts };
}

/** Strike while it bites, with every roll of the dice coming up `roll`. */
function strike(roll: number) {
  const { g, toasts } = biting();
  g.rng.next = () => roll;
  g.input.attackPressed = true;
  step(g, DT);
  return { g, toasts, caught: g.inventory.grid.map(e => e.item), anim: g.world.need(g.player, "actions").catchAnim };
}

describe("the mysterious stone", () => {
  it("comes up one catch in twenty", () => {
    expect(MYSTERIOUS_STONE.chance).toBeCloseTo(1 / 20);
  });

  it("when the roll goes its way, a stone comes up instead of a koi", () => {
    const { caught, toasts, anim } = strike(0);
    const stone = caught.find(i => i.name === MYSTERIOUS_STONE.name);
    expect(stone).toBeDefined();
    expect(stone!.type).toBe("stone");
    expect(stone!.rarity).toBe("rare");
    expect(caught.some(i => i.type === "fish")).toBe(false);
    expect(toasts).toContain(`Something heavy on the line... a ${MYSTERIOUS_STONE.name}!`);
    expect(anim?.stone).toBe(true);                         // and it's a stone that leaps out, not a koi
  });

  it("otherwise it's a koi, as ever", () => {
    const { caught, anim } = strike(0.5);
    expect(caught.some(i => i.type === "fish")).toBe(true);
    expect(caught.some(i => i.name === MYSTERIOUS_STONE.name)).toBe(false);
    expect(anim?.stone).toBe(false);
  });
});
