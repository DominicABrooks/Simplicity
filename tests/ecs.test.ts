import { describe, expect, it } from "vitest";
import { World } from "../src/core/ecs.ts";
import { EventBus } from "../src/core/events.ts";

interface C {
  pos: { x: number };
  hp: { hp: number };
  tag: true;
}

describe("World", () => {
  it("creates entities with components and queries by all keys", () => {
    const w = new World<C>();
    const a = w.create({ pos: { x: 1 }, hp: { hp: 3 } });
    w.create({ pos: { x: 2 } });
    expect(w.query("pos", "hp")).toEqual([[a, { pos: { x: 1 }, hp: { hp: 3 } }]]);
  });

  it("destroy removes every component, and is safe mid-query", () => {
    const w = new World<C>();
    const ids = [1, 2, 3].map(x => w.create({ pos: { x } }));
    for (const [e] of w.query("pos")) w.destroy(e);
    expect(w.count("pos")).toBe(0);
    expect(ids.some(e => w.isAlive(e))).toBe(false);
  });

  it("add, get, need, has, remove", () => {
    const w = new World<C>();
    const e = w.create();
    expect(w.get(e, "tag")).toBeUndefined();
    expect(() => w.need(e, "hp")).toThrow();
    w.add(e, "tag", true);
    expect(w.has(e, "tag")).toBe(true);
    w.remove(e, "tag");
    expect(w.has(e, "tag")).toBe(false);
    expect(w.query("tag")).toEqual([]);
  });

  it("clear empties the world but keeps ids unique", () => {
    const w = new World<C>();
    const a = w.create({ tag: true });
    w.clear();
    expect(w.count("tag")).toBe(0);
    expect(w.create()).not.toBe(a);
  });
});

describe("EventBus", () => {
  it("delivers typed events and unsubscribes", () => {
    const bus = new EventBus<{ toast: { text: string } }>();
    const got: string[] = [];
    const off = bus.on("toast", e => got.push(e.text));
    bus.emit("toast", { text: "a" });
    off();
    bus.emit("toast", { text: "b" });
    expect(got).toEqual(["a"]);
  });
});
