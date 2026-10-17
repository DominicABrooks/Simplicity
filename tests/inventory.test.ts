import { describe, expect, it } from "vitest";
import { levelBonus } from "../src/data/progression.ts";
import { COLS, Inventory, ROWS } from "../src/items/inventory.ts";
import { makeFish, makeItem } from "../src/items/items.ts";

const fresh = (level = 1) => new Inventory(() => levelBonus(level));

describe("Inventory", () => {
  it("fills free spots column by column", () => {
    const inv = fresh();
    expect(inv.add(makeItem("ring"))).toBe(true);
    expect(inv.add(makeItem("ring"))).toBe(true);
    expect(inv.grid.map(e => [e.x, e.y])).toEqual([[0, 0], [0, 1]]);
  });

  it("refuses items when the bag is full", () => {
    const inv = fresh();
    for (let i = 0; i < COLS * ROWS; i++) expect(inv.add(makeItem("amulet"))).toBe(true);
    expect(inv.add(makeItem("ring"))).toBe(false);
  });

  it("places the held item, swapping with at most one item under it", () => {
    const inv = fresh();
    inv.add(makeItem("ring"));
    inv.add(makeItem("ring"));
    inv.held = makeItem("hood");                            // 2x2 over both rings: refused
    expect(inv.placeHeldAt(0, 0)).toBe(false);
    const ring = inv.grid[0]!.item;
    inv.held = makeItem("amulet");                          // 1x1 over one ring: swap
    expect(inv.placeHeldAt(0, 0)).toBe(true);
    expect(inv.held).toBe(ring);
    expect(inv.grid.find(e => e.x === 0 && e.y === 0)!.item.type).toBe("amulet");
  });

  it("right-click equip puts the old item back where the new one was", () => {
    const inv = fresh();
    const old = makeItem("blade"), next = makeItem("blade", "magic");
    inv.reset([old]);
    inv.add(next);
    inv.equipFromGrid(inv.grid[0]!);
    expect(inv.equip.weapon).toBe(next);
    expect(inv.grid).toEqual([{ item: old, x: 0, y: 0 }]);
  });

  it("right-click equip undoes itself when the old item has nowhere to go", () => {
    const inv = fresh();
    const bow = makeItem("bow");
    inv.reset([bow]);
    for (let i = 0; i < COLS * ROWS; i++) inv.add(makeItem("ring"));
    const first = inv.grid.shift()!;                        // swap the first ring for a blade: the full bag can't take the 2x3 bow back
    const blade = makeItem("blade");
    inv.grid.push({ item: blade, x: first.x, y: first.y });
    inv.equipFromGrid(inv.grid.at(-1)!);
    expect(inv.equip.weapon).toBe(bow);
    expect(inv.grid.some(e => e.item === blade)).toBe(true);
  });

  it("unequips into the bag only when there is room", () => {
    const inv = fresh();
    inv.reset([makeItem("robe")]);
    expect(inv.unequipToGrid("armor")).toBe(true);
    expect(inv.equip.armor).toBeNull();
    expect(inv.unequipToGrid("armor")).toBe(false);
  });

  it("puts the held item in a matching slot only", () => {
    const inv = fresh();
    inv.held = makeItem("boots");
    inv.putHeldInSlot("helm");
    expect(inv.equip.helm).toBeNull();
    inv.putHeldInSlot("boots");
    expect(inv.equip.boots?.type).toBe("boots");
    expect(inv.held).toBeNull();
  });

  it("eats food only when the use callback accepts it", () => {
    const inv = fresh();
    inv.add(makeFish("rare"));
    inv.useFromGrid(inv.grid[0]!, () => false);
    expect(inv.grid).toHaveLength(1);
    inv.useFromGrid(inv.grid[0]!, item => item.heal === 4);
    expect(inv.grid).toHaveLength(0);
  });

  it("totals gear and level bonuses, capping dash recovery at 60%", () => {
    const inv = fresh(9);
    inv.reset([
      makeItem("blade", "magic", { crit: 2 }),
      makeItem("boots", "rare", { dash: 50, life: 2 }),
      makeItem("ring", "magic", { dash: 20 }),
    ]);
    const s = inv.stats();
    expect(s).toMatchObject({ level: 9, damage: 1, crit: 2, life: 2 + 4, speed: 5 + 16, dash: 60 });
    expect(s.gear).toMatchObject({ weapon: "magic", boots: "rare", ring: "magic", helm: null, weaponType: "blade" });
  });

  it("deals at least 1 damage unarmed", () => {
    expect(fresh().stats().damage).toBe(1);
  });

  it("notifies subscribers on change", () => {
    const inv = fresh();
    const seen: number[] = [];
    inv.subscribe(s => seen.push(s.life));
    inv.reset([makeItem("robe")]);
    expect(seen).toEqual([2]);
  });
});

describe("Inventory, shuffled at random", () => {
  // A thousand random clicks about the bag and the slots: whatever's done, nothing overlaps, nothing hangs off
  // the grid, nothing is in the wrong slot, and no item is lost or turns up twice.
  it("never overlaps, spills off the grid, misplaces, loses or copies an item", () => {
    const types = ["blade", "hood", "robe", "boots", "ring", "amulet", "bow", "rod", "bread"] as const;
    let s = 12345;
    const roll = (n: number) => (s = (s * 48271) % 2147483647) % n;
    const inv = fresh(3);
    const all = new Set<number>();
    for (let i = 0; i < 14; i++) { const it = makeItem(types[roll(types.length)]!); if (inv.add(it)) all.add(it.id); }
    const where = () => [...inv.grid.map(e => e.item), ...Object.values(inv.equip).filter(x => x !== null), ...(inv.held ? [inv.held] : [])];
    for (let step = 0; step < 1000; step++) {
      const slots = Object.keys(inv.equip) as (keyof typeof inv.equip)[];
      switch (roll(6)) {
        case 0: if (!inv.held && inv.grid.length) inv.pickFromGrid(inv.grid[roll(inv.grid.length)]!); break;
        case 1: if (!inv.held) inv.pickFromSlot(slots[roll(slots.length)]!); break;
        case 2: inv.placeHeldAt(roll(COLS + 2) - 1, roll(ROWS + 2) - 1); break;   // the UI clamps; the model mustn't rely on it
        case 3: inv.putHeldInSlot(slots[roll(slots.length)]!); break;
        case 4: if (!inv.held && inv.grid.length) inv.equipFromGrid(inv.grid[roll(inv.grid.length)]!); break;
        case 5: if (!inv.held) inv.unequipToGrid(slots[roll(slots.length)]!); break;
      }
      for (const e of inv.grid) {
        expect(inv.inBounds(e.x, e.y, e.item.w, e.item.h), `step ${step}: ${e.item.name} at ${e.x},${e.y}`).toBe(true);
        expect(inv.overlapping(e.x, e.y, e.item.w, e.item.h), `step ${step}: overlap at ${e.x},${e.y}`).toEqual([e]);
      }
      for (const [slot, item] of Object.entries(inv.equip)) if (item) expect(item.slot, `step ${step}`).toBe(slot);
      const ids = where().map(i => i.id);
      expect(new Set(ids).size, `step ${step}: an item twice`).toBe(ids.length);
      expect(new Set(ids), `step ${step}: an item lost`).toEqual(all);
    }
  });
});
