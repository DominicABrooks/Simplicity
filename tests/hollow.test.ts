// The Frozen Hollow: always winter, a frozen lake you can walk on, the hollow stone at its entrance (touch it and,
// falling, you wake there), Frost mages out on the ice, the golden koi through a hole in it, and Rime's stage ready.
import { describe, expect, it } from "vitest";
import { loadArea } from "../src/areas/index.ts";
import { HOLLOW_STONE, ICE_HOLE, RIME_AT, area as hollow } from "../src/areas/hollow.ts";
import { FISH } from "../src/data/items.ts";
import { HALF, T, Tile } from "../src/data/world.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { spawnEnemy } from "../src/game/spawn.ts";
import { lastStone, stoneSystem, wakeOnStone } from "../src/game/stones.ts";
import { arrive, enterArea } from "../src/game/travel.ts";
import { makeItem } from "../src/items/items.ts";
import { waterAt } from "../src/systems/fishing.ts";
import { step } from "../src/systems/index.ts";
import { blocked, moveBy, tileAt } from "../src/world/collision.ts";

const DT = 1 / 60;
const layout = hollow.build();

async function inHollow(entry = "ashwild"): Promise<Game> {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  enterArea(g, await loadArea("hollow"), entry);
  return g;
}
const iceTiles = () => layout.map.tiles.flatMap((row, y) => row.flatMap((t, x) => (t === Tile.Ice ? [{ x, y }] : [])));

describe("the Frozen Hollow", () => {
  it("is always winter: the snow look, its lake frozen over", () => {
    expect(layout.map.look).toBe("snow");
    expect(iceTiles().length).toBeGreaterThan(150);
  });

  it("has ice you can walk out on, without swimming", async () => {
    const g = await inHollow(), p = g.world.need(g.player, "transform");
    const { x, y } = iceTiles().find(c => c.x === Math.round(RIME_AT.x / T) - 2 && c.y === Math.round(RIME_AT.y / T))!;
    Object.assign(p, { x: x * T, y: y * T });
    expect(blocked(g.map, p.x, p.y, true)).toBe(false);      // even for things that can't swim
    moveBy(g.map, p, 2 * T, 0, true);
    expect(p.x).toBe((x + 2) * T);
    step(g, DT);
    expect(g.world.need(g.player, "motion").swimming).toBe(false);
  });

  it("has Rime's stage out in the middle of the ice, with nowhere to hide on it", () => {
    const stage = layout.props.find(p => p.kind === "rimeStage");
    if (stage?.kind !== "rimeStage") throw new Error("no stage");
    expect(stage.x - HALF).toBe(RIME_AT.x);
    expect(stage.y - HALF).toBe(RIME_AT.y);
    for (let y = Math.floor(stage.y / T - stage.radius); y <= stage.y / T + stage.radius; y++)
      for (let x = Math.floor(stage.x / T - stage.radius); x <= stage.x / T + stage.radius; x++)
        if (Math.hypot(x + 0.5 - stage.x / T, y + 0.5 - stage.y / T) <= stage.radius) expect(layout.map.tiles[y]![x]).toBe(Tile.Ice);
  });

  it("is hunted by Frost mages only, out on the ice", async () => {
    const g = await inHollow();
    for (let i = 0; i < 200; i++) spawnEnemy(g, 40);
    const mages = g.world.query("mage", "transform");
    expect(mages.length).toBeGreaterThan(0);
    expect(new Set(mages.map(([, c]) => c.mage.school))).toEqual(new Set(["frost"]));
    for (const [, { transform: t }] of mages) expect(tileAt(g.map, t.x + HALF, t.y + HALF)).toBe(Tile.Ice);
  });
});

describe("the hole in the ice", () => {
  it("is open water with ice all round it", async () => {
    const g = await inHollow();
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) expect(g.map.tiles[ICE_HOLE.y + dy]![ICE_HOLE.x + dx]).toBe(Tile.Water);
    for (let x = ICE_HOLE.x - 1; x <= ICE_HOLE.x + 2; x++) for (const y of [ICE_HOLE.y - 1, ICE_HOLE.y + 2]) expect(g.map.tiles[y]![x]).toBe(Tile.Ice);
    expect(waterAt(g, ICE_HOLE.x * T, ICE_HOLE.y * T)).toBe("hole");
  });

  it("gives up a golden koi every time, never anything else", async () => {
    const g = await inHollow();
    g.inventory.reset([makeItem("rod")]);
    Object.assign(g.world.need(g.player, "transform"), { x: (ICE_HOLE.x - 2) * T, y: ICE_HOLE.y * T });
    const a = g.world.need(g.player, "actions");
    for (let i = 0; i < 12; i++) {
      a.fishing = { phase: "bite", x: ICE_HOLE.x * T, y: ICE_HOLE.y * T, t: 0, biteAt: 0, basin: false };
      a.cooldown = 0;
      const before = new Set(g.inventory.grid.map(e => e.item.id));
      g.rng.next = () => 0.99;                               // the dice that would give a pond koi, and no curio
      g.input.attackPressed = true;
      step(g, DT);
      const caught = g.inventory.grid.map(e => e.item).find(it => !before.has(it.id));
      expect(caught?.name).toBe(FISH.rare.name);
      expect(caught?.heal).toBe(FISH.rare.heal);
      g.inventory.reset([makeItem("rod")]);
    }
  });
});

describe("the hollow stone", () => {
  const stone = layout.props.find(p => p.kind === "oldStone");

  it("lies on the track at the Hollow's entrance, with somewhere to wake beside it", () => {
    if (stone?.kind !== "oldStone") throw new Error("no stone");
    expect(stone.name).toBe("The hollow stone");
    expect(Math.floor(stone.x / T)).toBe(HOLLOW_STONE.x);
    expect(layout.map.tiles[HOLLOW_STONE.y]![HOLLOW_STONE.x]).toBe(Tile.Path);
    const wake = layout.entries[stone.entry]!, from = layout.entries.ashwild!;
    expect(Math.hypot(wake.x + HALF - stone.x, wake.y + HALF - stone.y)).toBeLessThan(2 * T);
    expect(stone.x).toBeLessThan(from.x);                    // past it coming in, before the bowl
    expect(stone.x).toBeGreaterThan(layout.map.width * T - 12 * T);
  });

  it("is touched walking in from the Ashwild, once", async () => {
    const g = await inHollow(), toasts: string[] = [];
    g.events.on("toast", t => toasts.push(t.text));
    expect(lastStone(g)).toBeNull();
    const p = g.world.need(g.player, "transform");
    for (let i = 0; i < 40; i++) { moveBy(g.map, p, -T / 4, 0, false); stoneSystem(g); }
    expect(lastStone(g)).toEqual({ area: "hollow", entry: "stone", name: "The hollow stone" });
    expect(toasts.filter(t => t.includes("hollow stone"))).toHaveLength(1);
  });

  it("wakes him beside it if he falls, whole again and with his gear", async () => {
    const g = await inHollow();
    const p = g.world.need(g.player, "transform"), stoneAt = layout.entries.stone!;
    Object.assign(p, stoneAt);
    p.x += T;                                                 // onto the stone
    stoneSystem(g);
    const bag = g.inventory.grid.map(e => e.item.id), health = g.world.need(g.player, "health");
    Object.assign(p, { x: RIME_AT.x, y: RIME_AT.y });
    health.hp = 0;
    setState(g, "dead");
    expect(wakeOnStone(g)).toBe(true);
    expect(g.state).toBe("travel");
    expect(g.travel).toEqual({ area: "hollow", entry: "stone" });
    arrive(g, await loadArea("hollow"));
    expect(g.state).toBe("play");
    expect({ x: p.x, y: p.y }).toEqual(stoneAt);
    expect(health.hp).toBe(health.maxHp);
    expect(g.inventory.grid.map(e => e.item.id)).toEqual(bag);
  });

  it("is forgotten in a new run, and without a stone a fall is a new run", async () => {
    const g = await inHollow("stone");
    const p = g.world.need(g.player, "transform");
    p.x += T;
    stoneSystem(g);
    expect(lastStone(g)).not.toBeNull();
    resetGame(g);
    expect(lastStone(g)).toBeNull();
    setState(g, "dead");
    expect(wakeOnStone(g)).toBe(false);
    expect(g.state).toBe("dead");
  });
});
