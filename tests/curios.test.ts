// Curiosities: one catch in twenty comes up something stranger than a koi, never one the hero's already carrying.
import { describe, expect, it } from "vitest";
import { CURIO_CHANCE, CURIO_IDS, CURIOS } from "../src/data/items.ts";
import { T, Tile } from "../src/data/world.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { makeCurio, makeItem } from "../src/items/items.ts";
import { step } from "../src/systems/index.ts";
import { blocked } from "../src/world/collision.ts";

const DT = 1 / 60;

/** Rod in hand on the shore, with an empty bag. */
function fisher(): { g: Game; toasts: string[] } {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  g.inventory.reset([makeItem("rod")]);
  const toasts: string[] = [];
  g.events.on("toast", t => toasts.push(t.text));
  return { g, toasts };
}

/** A fish biting at the line; strike with every roll of the dice coming up `roll`. What came up? */
function strike(g: Game, roll: number) {
  let shore: { stand: { x: number; y: number }; water: { x: number; y: number } } | null = null;
  for (let y = 1; y < g.map.height - 1 && !shore; y++) for (let x = 2; x < g.map.width - 1 && !shore; x++)
    if (g.map.tiles[y]![x] === Tile.Water && g.map.tiles[y]![x - 2] === Tile.Grass && !blocked(g.map, (x - 2) * T, y * T, true))
      shore = { stand: { x: (x - 2) * T, y: y * T }, water: { x: x * T, y: y * T } };
  Object.assign(g.world.need(g.player, "transform"), shore!.stand);
  const a = g.world.need(g.player, "actions");
  a.fishing = { phase: "bite", x: shore!.water.x, y: shore!.water.y, t: 0, biteAt: 0 } as typeof a.fishing;
  a.cooldown = 0;
  const before = new Set(g.inventory.grid.map(e => e.item.id));
  g.rng.next = () => roll;
  g.input.attackPressed = true;
  step(g, DT);
  return { item: g.inventory.grid.map(e => e.item).find(i => !before.has(i.id))!, anim: a.catchAnim };
}

describe("curiosities", () => {
  it("come up one catch in twenty", () => {
    expect(CURIO_CHANCE).toBeCloseTo(1 / 20);
  });

  it("the mysterious stone says someone may be interested in it", () => {
    expect(CURIOS.stone.name).toBe("Mysterious Stone");
    expect(CURIOS.stone.note).toBe("Maybe someone is interested in this...");
    const stone = makeCurio("stone");
    expect(stone.curio).toBe("stone");
    expect(stone.rarity).toBe("rare");
  });

  it("there are a few, each with a name and a line of its own", () => {
    expect(CURIO_IDS.length).toBeGreaterThanOrEqual(5);
    expect(new Set(CURIO_IDS.map(id => CURIOS[id].name)).size).toBe(CURIO_IDS.length);
    for (const id of CURIO_IDS) expect(CURIOS[id].note.length).toBeGreaterThan(10);
  });

  it("when the roll goes their way, one comes up instead of a koi, and leaps out of the water as itself", () => {
    const { g, toasts } = fisher(), { item, anim } = strike(g, 0);
    expect(item.curio).toBeDefined();
    expect(item.name).toBe(CURIOS[item.curio!].name);
    expect(toasts).toContain(`Something heavy on the line... a ${item.name}!`);
    expect(anim?.curio).toBe(item.curio);
  });

  it("never one he's already carrying: each comes up once, and then it's koi", () => {
    const { g } = fisher(), found: string[] = [];
    for (let i = 0; i < CURIO_IDS.length; i++) found.push(strike(g, 0).item.curio!);
    expect(found.sort()).toEqual([...CURIO_IDS].sort());
    const after = strike(g, 0);
    expect(after.item.type).toBe("fish");
    expect(after.anim?.curio ?? null).toBeNull();
  });

  it("otherwise it's a koi, as ever", () => {
    const { g } = fisher(), { item, anim } = strike(g, 0.5);
    expect(item.type).toBe("fish");
    expect(anim?.curio ?? null).toBeNull();
  });
});
