// The Undercroft under St Mary's: the Rusted Key opens the low door at the foot of the tower (and it stays open),
// and down below, the Mysterious Stone goes home to the gap in the ring of old stones, which wakes.
import { describe, expect, it } from "vitest";
import { area as capital } from "../src/areas/capital.ts";
import { area as castle } from "../src/areas/castle.ts";
import { area as kingsroad } from "../src/areas/kingsroad.ts";
import { loadArea } from "../src/areas/index.ts";
import { UNDERCROFT, UNDERCROFT_SAYS } from "../src/data/undercroft.ts";
import { carryingCurio, spentCurios } from "../src/game/curios.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { setCensus } from "../src/game/townsfolk.ts";
import { arrive, enterArea } from "../src/game/travel.ts";
import { sealOf, socketOf } from "../src/game/undercroft.ts";
import { makeCurio } from "../src/items/items.ts";
import { step } from "../src/systems/index.ts";
import { blocked } from "../src/world/collision.ts";
import { layoutOf } from "../src/world/layouts.ts";

setCensus((await import("../src/world/residents.ts")).residentsOf({ capital: capital.build().props, castle: castle.build().props, kingsroad: kingsroad.build().props }));
const DT = 1 / 30;
const hero = (g: Game) => g.world.need(g.player, "transform");

async function at(area: string, entry: string, curios: ("key" | "stone")[] = []): Promise<{ g: Game; toasts: string[] }> {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  for (const c of curios) g.inventory.add(makeCurio(c));
  enterArea(g, await loadArea(area), entry);
  const toasts: string[] = [];
  g.events.on("toast", t => toasts.push(t.text));
  return { g, toasts };
}

/** Walk him up to the door down (the exit to the Undercroft), from the churchyard side, and take a step. */
function tryTheDoor(g: Game) {
  const door = g.area.layout.exits.find(x => x.to.area === "undercroft")!;
  Object.assign(hero(g), { x: door.rect.x + door.rect.w / 2 - 4, y: door.rect.y + door.rect.h - 3 });
  step(g, DT);
}

describe("the low door at the foot of St Mary's tower", () => {
  it("is locked to anyone without the key: he's put back a step and told so, and nowhere to go", async () => {
    const { g, toasts } = await at("capital", "southgate");
    tryTheDoor(g);
    expect(g.state).toBe("play");
    expect(toasts).toContain(UNDERCROFT_SAYS.locked);
    expect(blocked(g.map, hero(g).x, hero(g).y, true)).toBe(false);
  });

  it("opens to the Rusted Key, which stays in the lock: the door's open the rest of the run, and the key's off the line", async () => {
    const { g, toasts } = await at("capital", "southgate", ["key"]);
    tryTheDoor(g);
    expect(g.state).toBe("travel");
    expect(g.travel).toEqual({ area: "undercroft", entry: "steps" });
    expect(toasts).toContain(UNDERCROFT_SAYS.unlock);
    expect(carryingCurio(g, "key")).toBe(false);
    expect(spentCurios(g).has("key")).toBe(true);
    arrive(g, await loadArea("undercroft"));
    // Back up, and down again with no key at all.
    const up = g.area.layout.exits[0]!;
    Object.assign(hero(g), { x: up.rect.x + 2, y: up.rect.y });
    step(g, DT);
    expect(g.travel).toEqual({ area: "capital", entry: "undercroft" });
    arrive(g, await loadArea("capital"));
    expect(blocked(g.map, hero(g).x, hero(g).y, true)).toBe(false);
    step(g, DT);
    expect(g.state).toBe("play");                              // arriving outside isn't walking straight back in
    tryTheDoor(g);
    expect(g.state).toBe("travel");
  });
});

describe("the ring of old stones", () => {
  it("is down the steps, with room to walk from the door to the socket", async () => {
    const { g, toasts } = await at("undercroft", "steps");
    step(g, DT);
    expect(toasts).toContain(UNDERCROFT_SAYS.arrive);
    const map = layoutOf(g.area.def).map, s = socketOf(g)!;
    expect(blocked(map, hero(g).x, hero(g).y, true)).toBe(false);
    expect(blocked(map, s.x, s.y, true)).toBe(false);
    for (let y = hero(g).y; y > s.y + UNDERCROFT.reach; y -= 2) expect(blocked(map, s.x, y, true)).toBe(false);
  });

  it("takes the Mysterious Stone back into its socket: it wakes, heals him, and leaves him the Ringstone Pendant", async () => {
    const { g, toasts } = await at("undercroft", "steps", ["stone"]);
    g.world.need(g.player, "health").hp = 1;
    const s = socketOf(g)!;
    Object.assign(hero(g), { x: s.x, y: s.y + UNDERCROFT.hint - 4 });
    step(g, DT);
    expect(toasts).toContain(UNDERCROFT_SAYS.warm);
    expect(carryingCurio(g, "stone")).toBe(true);
    Object.assign(hero(g), { x: s.x, y: s.y + UNDERCROFT.reach - 2 });
    step(g, DT);
    expect(carryingCurio(g, "stone")).toBe(false);
    expect(spentCurios(g).has("stone")).toBe(true);
    for (const line of UNDERCROFT_SAYS.wake) expect(toasts).toContain(line);
    const health = g.world.need(g.player, "health");
    expect(health.hp).toBe(health.maxHp);
    const loot = g.world.query("pickup").map(([, c]) => c.pickup).filter(p => p.kind === "loot");
    expect(loot.map(p => p.kind === "loot" && p.item.name)).toContain(UNDERCROFT.reward.name);
    expect(g.world.query("renderable").filter(([, c]) => c.renderable.kind === "ringstone")).toHaveLength(1);
  });

  it("keeps the stone in the ring when he comes back, and only one", async () => {
    const { g } = await at("undercroft", "steps", ["stone"]);
    const s = socketOf(g)!;
    Object.assign(hero(g), { x: s.x, y: s.y + 4 });
    step(g, DT);
    enterArea(g, await loadArea("undercroft"), "steps");
    step(g, DT); step(g, DT);
    expect(g.world.query("renderable").filter(([, c]) => c.renderable.kind === "ringstone")).toHaveLength(1);
  });
});

describe("the little sealed door behind the ring", () => {
  it("can be walked up to round the ring, and says what it is once a run", async () => {
    const { g, toasts } = await at("undercroft", "steps");
    const seal = sealOf(g)!;
    expect(seal).not.toBeNull();
    expect(blocked(g.map, seal.x, seal.y, true)).toBe(false);
    expect(toasts.filter(t => UNDERCROFT_SAYS.seal.includes(t as never))).toEqual([]);
    Object.assign(hero(g), seal);
    step(g, DT);
    expect(toasts.filter(t => UNDERCROFT_SAYS.seal.includes(t as never))).toEqual([...UNDERCROFT_SAYS.seal]);
    step(g, DT);
    expect(toasts.filter(t => UNDERCROFT_SAYS.seal.includes(t as never))).toHaveLength(UNDERCROFT_SAYS.seal.length);
  });
});
