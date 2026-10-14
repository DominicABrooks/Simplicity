// When someone says they're giving the hero something, they do: every line that hands something over is
// tagged with what it gives, and the item lands in the bag as the line is said. Nobody gives twice, nobody
// offers what won't fit, and no untagged line so much as offers anything.
import { describe, expect, it } from "vitest";
import { area as capital } from "../src/areas/capital.ts";
import { area as castle } from "../src/areas/castle.ts";
import { area as kingsroad } from "../src/areas/kingsroad.ts";
import { loadArea } from "../src/areas/index.ts";
import { SPRITES } from "../src/assets/generated/sprites.ts";
import { Rng } from "../src/core/rng.ts";
import { BASES } from "../src/data/items.ts";
import * as voices from "../src/data/voices.ts";
import { GIFT_OF } from "../src/data/voices.ts";
import { folkLines } from "../src/game/conversation.ts";
import { createGame, setState } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { advanceTalk, giftsFrom, startTalk, talking } from "../src/game/talk.ts";
import { enterArea } from "../src/game/travel.ts";
import { makeGift, makeItem } from "../src/items/items.ts";
import { residentsOf } from "../src/world/residents.ts";

/** Words that hand something over: "here, take", "have this", "for you", "it's yours"... */
const OFFERS = /\bhere[,.!]? (take|have|it's yours)|\b(take|have) (this|that|one|these|some|my)\b(?! (look|word|chat|seat|rest|think))|\bfor you\b|\byou can have\b|\bgive you\b|\bit's yours\b|\bkeep it\b|\bsaved you\b/i;

/** Every string in src/data/voices.ts, wherever it sits. */
function strings(v: unknown): string[] {
  if (typeof v === "string") return [v];
  if (v instanceof RegExp || typeof v !== "object" || v === null) return [];
  return Object.values(v).flatMap(strings);
}

describe("gift lines", () => {
  it("each give a real item from the catalog, with an icon", () => {
    expect(GIFT_OF.size).toBeGreaterThan(0);
    for (const [line, kind] of GIFT_OF) {
      const item = makeGift(kind);
      expect(BASES[item.type], line).toBeDefined();
      expect(SPRITES.sprites[item.type], line).toBeDefined();
      expect(item.name.length).toBeGreaterThan(0);
      expect(line, "gift lines are said as written").not.toMatch(/\{\w+\}/);
    }
  });

  it("all read as giving something, and no other line does", () => {
    for (const line of GIFT_OF.keys()) expect(line).toMatch(OFFERS);
    const { GIFT: _, GIFT_OF: __, ...rest } = voices;
    const offering = strings(rest).filter(l => OFFERS.test(l));
    expect(offering).toEqual([]);
  });

  it("are only said by someone allowed to give", () => {
    const people = residentsOf({ capital: capital.build().props, castle: castle.build().props, kingsroad: kingsroad.build().props }).filter(r => !r.prisoner && r.age >= 4);
    const rng = new Rng(3);
    let offered = 0;
    for (const r of people) for (const v of [0, 1, 3, 4]) {
      expect(folkLines(rng, r, [], v).some(l => GIFT_OF.has(l)), r.name).toBe(false);
      if (folkLines(rng, r, [], v, () => true).some(l => GIFT_OF.has(l))) offered++;
    }
    expect(offered).toBeGreaterThan(20);   // bakers, fishers, the warm-hearted and children all do
  });
});

describe("being given something", () => {
  /** At the castle, by a guard who knows the hero well enough to share the cook's bread (three talks in). */
  async function friendlyGuard() {
    const g = createGame();
    resetGame(g);
    setState(g, "play");
    enterArea(g, await loadArea("castle"), "town");
    const [guard, { transform }] = g.world.query("sentry", "transform")[0]!;
    Object.assign(g.world.need(g.player, "transform"), { x: transform.x, y: transform.y + 12 });
    for (let i = 0; i < 3; i++) startTalk(g, guard);
    return { g, guard };
  }
  const loaves = (g: Awaited<ReturnType<typeof friendlyGuard>>["g"]) => g.inventory.grid.filter(e => e.item.name === "Three-Cut Loaf").length;

  it("lands in the bag as the line is said, once", async () => {
    const { g, guard } = await friendlyGuard();
    const toasts: string[] = [];
    g.events.on("toast", t => toasts.push(t.text));
    startTalk(g, guard);
    const c = talking(g)!, at = c.lines.findIndex(l => GIFT_OF.has(l));
    expect(at).toBe(1);
    expect(loaves(g)).toBe(0);                     // not before it's said
    advanceTalk(g); advanceTalk(g);                // the rest of the first line, then the gift line
    expect(c.line).toBe(at);
    expect(loaves(g)).toBe(1);
    expect(toasts).toContain("Received Three-Cut Loaf");
    advanceTalk(g); advanceTalk(g);
    expect(loaves(g)).toBe(1);
    // Talked to again, they don't give it again.
    startTalk(g, guard);
    expect(talking(g)!.lines.some(l => GIFT_OF.has(l))).toBe(false);
    expect(loaves(g)).toBe(1);
  });

  it("isn't offered when the bag is full, and is once there's room", async () => {
    const { g, guard } = await friendlyGuard();
    while (g.inventory.add(makeItem("ring")));
    startTalk(g, guard);
    expect(talking(g)!.lines.some(l => GIFT_OF.has(l))).toBe(false);
    expect(giftsFrom(g).size).toBe(0);
  });

  it("says the bag's full if it filled up while they were talking, and keeps the gift for later", async () => {
    const { g, guard } = await friendlyGuard();
    const toasts: string[] = [];
    g.events.on("toast", t => toasts.push(t.text));
    startTalk(g, guard);
    while (g.inventory.add(makeItem("ring")));
    advanceTalk(g); advanceTalk(g);
    expect(toasts).toContain("Inventory full");
    expect(loaves(g)).toBe(0);
    expect(giftsFrom(g).size).toBe(0);
  });
});
