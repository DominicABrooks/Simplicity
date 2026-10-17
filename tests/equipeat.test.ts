import { describe, expect, it } from "vitest";
import { eatItem } from "../src/game/actions.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { makeFish, makeItem } from "../src/items/items.ts";

function fresh(): { g: Game; toasts: string[] } {
  const g = createGame(), toasts: string[] = [];
  resetGame(g);
  setState(g, "play");
  g.events.on("toast", ({ text }) => toasts.push(text));
  return { g, toasts };
}

describe("putting something on", () => {
  it("says what he's equipped, dragged to its slot or right-clicked", () => {
    const { g, toasts } = fresh(), boots = makeItem("boots", "magic", {}, "Swift Boots"), helm = makeItem("hood", "normal", {}, "Old Cap");
    g.inventory.add(boots);
    g.inventory.equipFromGrid(g.inventory.grid.find(e => e.item === boots)!);
    expect(toasts).toContain("Equipped Swift Boots");
    g.inventory.held = helm;
    g.inventory.putHeldInSlot("helm");
    expect(toasts).toContain("Equipped Old Cap");
    const brief: (boolean | undefined)[] = [];
    g.events.on("toast", e => brief.push(e.brief));
    g.inventory.equipFromGrid(g.inventory.grid.find(e => e.item.slot === "boots")!);
    expect(brief).toEqual([true]);                             // a brief note: the next one replaces it at once
  });

  it("says nothing when a new run dresses him", () => {
    const { g, toasts } = fresh();
    resetGame(g);
    expect(toasts.filter(t => t.startsWith("Equipped"))).toEqual([]);
  });
});

describe("eating", () => {
  it("heals what it can, and he can eat at full health too", () => {
    const { g } = fresh(), health = g.world.need(g.player, "health");
    health.hp = health.maxHp - 1;
    expect(eatItem(g, makeFish("rare"))).toBe(true);           // heals 4, but only 1 was missing
    expect(health.hp).toBe(health.maxHp);
    expect(eatItem(g, makeFish("normal"))).toBe(true);         // full: eaten all the same
    expect(health.hp).toBe(health.maxHp);
  });
});
