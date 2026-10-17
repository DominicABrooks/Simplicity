// Old Gil and his glass eye, Ael's Thorn on the lake bed, and the letter in the bottle.
import { describe, expect, it } from "vitest";
import { area as capital } from "../src/areas/capital.ts";
import { area as castle } from "../src/areas/castle.ts";
import { area as kingsroad } from "../src/areas/kingsroad.ts";
import { HOME, loadArea } from "../src/areas/index.ts";
import { GIL_TALK, LETTER, THORN, THORN_SAYS } from "../src/data/quay.ts";
import { Tile } from "../src/data/world.ts";
import { carryingCurio, spentCurios } from "../src/game/curios.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { gilHere, letterLines, lakeBed, useCurio } from "../src/game/quay.ts";
import { resetGame } from "../src/game/reset.ts";
import { endTalk, startTalk, talking } from "../src/game/talk.ts";
import { setCensus } from "../src/game/townsfolk.ts";
import { enterArea } from "../src/game/travel.ts";
import { makeCurio } from "../src/items/items.ts";
import { step } from "../src/systems/index.ts";
import { blocked } from "../src/world/collision.ts";
import { residentsOf } from "../src/world/residents.ts";

setCensus(residentsOf({ capital: capital.build().props, castle: castle.build().props, kingsroad: kingsroad.build().props }));
const DT = 1 / 30;
const hero = (g: Game) => g.world.need(g.player, "transform");

async function at(area: string, entry: string, curios: ("eye" | "bottle" | "key")[] = []): Promise<{ g: Game; toasts: string[] }> {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  for (const c of curios) g.inventory.add(makeCurio(c));
  enterArea(g, area === HOME.id ? HOME : await loadArea(area), entry);
  const toasts: string[] = [];
  g.events.on("toast", t => toasts.push(t.text));
  step(g, DT);
  return { g, toasts };
}

/** Walk up to Gil (in front of him, on the bank) and talk. */
function talkToGil(g: Game): string[] {
  const gil = gilHere(g)!, t = g.world.need(gil, "transform");
  Object.assign(hero(g), { x: t.x, y: t.y + 8 });
  if (talking(g)) endTalk(g);
  startTalk(g, gil);
  return talking(g)!.lines;
}

describe("Old Gil", () => {
  it("sits by his boat at the foot of the King's Bridge, on open ground the hero can walk up to", async () => {
    const { g } = await at("kingsroad", "cave");
    const gil = gilHere(g)!;
    expect(gil).not.toBeNull();
    const t = g.world.need(gil, "transform");
    expect(blocked(g.map, t.x, t.y + 8, true)).toBe(false);
    expect(g.world.need(gil, "targetable").name).toBe("Old Gil");
  });

  it("tells of his lost eye; given it back, he takes it and tells of the Thorn; after that, he's grateful", async () => {
    const { g } = await at("kingsroad", "cave");
    expect(talkToGil(g)).toEqual([...GIL_TALK.without]);
    g.inventory.add(makeCurio("eye"));
    expect(talkToGil(g)).toEqual([...GIL_TALK.given]);
    expect(carryingCurio(g, "eye")).toBe(false);
    expect(spentCurios(g).has("eye")).toBe(true);
    expect(talkToGil(g)).toEqual([...GIL_TALK.after]);
  });
});

describe("Ael's Thorn", () => {
  it("lies on the lake bed in the Clearing once Gil's told of it, out in deep water, and stays there", async () => {
    const { g, toasts } = await at(HOME.id, "cave");
    const thorn = () => g.world.query("pickup").filter(([, c]) => c.pickup.kind === "loot" && c.pickup.item.name === THORN.name);
    expect(thorn()).toHaveLength(0);
    spentCurios(g).add("eye");
    step(g, DT);
    expect(thorn()).toHaveLength(1);
    expect(thorn().map(([, c]) => c.pickup.kind === "loot" && c.pickup.item.rarity)).toEqual(["legendary"]);
    expect(toasts).toContain(THORN_SAYS);
    const [e] = thorn()[0]!, c = { transform: g.world.need(e, "transform") }, bed = lakeBed(g)!;
    expect(g.map.tiles[Math.floor((c.transform.y + 4) / 8)]![Math.floor((c.transform.x + 4) / 8)]).toBe(Tile.Water);
    expect(c.transform).toMatchObject(bed);
    expect(g.world.has(e, "despawn")).toBe(false);
    step(g, DT);
    expect(thorn()).toHaveLength(1);
  });
});

describe("the letter in the bottle", () => {
  it("is opened from the bag and read, as soon as he's free to: a hint for each curiosity still to take home", async () => {
    const { g } = await at(HOME.id, "cave", ["bottle"]);
    spentCurios(g).add("bell");
    const bottle = g.inventory.grid.find(e => e.item.curio === "bottle")!;
    setState(g, "travel");
    g.inventory.useFromGrid(bottle, item => useCurio(g, item));
    expect(carryingCurio(g, "bottle")).toBe(false);
    step(g, DT);
    expect(talking(g)).toBeNull();
    setState(g, "play");
    step(g, DT);
    const c = talking(g)!;
    expect(c.name).toBe(LETTER.name);
    expect(c.lines[0]).toBe(LETTER.open);
    expect(c.lines).toContain(LETTER.hints.key);
    expect(c.lines).not.toContain(LETTER.hints.bell);
    expect(c.lines.at(-1)).toBe(LETTER.close);
  });

  it("knows when there's nothing left to find", async () => {
    const { g } = await at(HOME.id, "cave");
    for (const id of ["stone", "key", "eye", "bell"] as const) spentCurios(g).add(id);
    expect(letterLines(g)).toEqual([LETTER.open, LETTER.none, LETTER.close]);
  });
});
