// The Frozen Hollow: always winter, a frozen lake you can walk on, the hollow stone at its entrance (touch it and,
// falling, you wake there), Frost mages out on the ice, Rime's stage ready, trails to everything, and the way into the
// ice cave under the rim where the koi are (tests/grotto.test.ts).
import { describe, expect, it } from "vitest";
import { loadArea } from "../src/areas/index.ts";
import { GROTTO_MOUTH, HOLLOW_STONE, RIME_AT, area as hollow } from "../src/areas/hollow.ts";
import { CLIMB } from "../src/data/hollow.ts";
import { HALF, T, Tile } from "../src/data/world.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { spawnEnemy } from "../src/game/spawn.ts";
import { lastStone, stoneSystem, wakeOnStone } from "../src/game/stones.ts";
import { arrive, enterArea } from "../src/game/travel.ts";
import { step } from "../src/systems/index.ts";
import { arenaPlan } from "../src/world/arena.ts";
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

  it("has Rime's arena out in the middle of the ice: a ring of ice pillars, open to the east, and nowhere to hide inside", () => {
    const stage = layout.props.find(p => p.kind === "rimeStage");
    if (stage?.kind !== "rimeStage") throw new Error("no stage");
    expect(stage.x - HALF).toBe(RIME_AT.x);
    expect(stage.y - HALF).toBe(RIME_AT.y);
    const inner = stage.radius - 1;
    for (let y = Math.floor(stage.y / T - inner); y <= stage.y / T + inner; y++)
      for (let x = Math.floor(stage.x / T - inner); x <= stage.x / T + inner; x++)
        if (Math.hypot(x + 0.5 - stage.x / T, y + 0.5 - stage.y / T) <= inner) expect(layout.map.tiles[y]![x]).toBe(Tile.Ice);
    // The pillars are solid; the way in, from the east (the side the track comes down), isn't.
    const pillars = arenaPlan(stage);
    expect(pillars).toHaveLength(stage.pillars - 1);
    for (const s of pillars) expect(blocked(layout.map, s.x * T - HALF, s.z * T - HALF, false)).toBe(true);
    expect(blocked(layout.map, stage.x + stage.radius * T - HALF, stage.y - HALF, false)).toBe(false);
  });

  it("has no hole in its ice: the koi are fished in the grotto, whose mouth is under the north rim", () => {
    expect(layout.map.tiles.flat()).not.toContain(Tile.Water);
    const cave = layout.props.find(p => p.kind === "cave");
    expect(cave).toMatchObject({ x: GROTTO_MOUTH.x * T, y: GROTTO_MOUTH.y * T, facing: "south" });
    const exit = layout.exits.find(x => x.to.area === "grotto")!;
    expect(exit.to).toEqual({ area: "grotto", entry: "hollow" });
    // Walking up to it from the bowl, he walks into it; coming out, he's just below it, and not in it again.
    expect(blocked(layout.map, exit.rect.x, exit.rect.y, false)).toBe(false);
    const back = layout.entries.grotto!;
    expect(back.y).toBeGreaterThan(exit.rect.y + exit.rect.h);
    expect(back.y).toBeLessThan(exit.rect.y + 2 * T);
  });

  it("has trails from the track to the lake shore, the hut door, the cave mouth and the foot of the climb", () => {
    const { tiles, width: W } = layout.map, path = (x: number, y: number) => tiles[y]?.[x] === Tile.Path;
    const seen = new Set<number>(), todo = [[W - 1, 17] as [number, number]];
    while (todo.length) {
      const [x, y] = todo.pop()!;
      if (!path(x, y) || seen.has(y * W + x)) continue;
      seen.add(y * W + x);
      todo.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    const on = (x: number, y: number) => seen.has(y * W + x);
    const near = (test: (x: number, y: number) => boolean) => [...seen].some(i => {
      const x = i % W, y = Math.floor(i / W);
      return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => test(x + dx!, y + dy!));
    });
    expect(near((x, y) => tiles[y]?.[x] === Tile.Ice)).toBe(true);                         // down to the shore
    const hut = layout.props.find(p => p.kind === "hall");
    if (hut?.kind !== "hall") throw new Error("no hut");
    expect(on(Math.floor((hut.rect.x + hut.rect.w / 2) / T), (hut.rect.y + hut.rect.h) / T)).toBe(true);   // past his door
    expect(on(GROTTO_MOUTH.x, GROTTO_MOUTH.y + 1) || on(GROTTO_MOUTH.x - 1, GROTTO_MOUTH.y + 1)).toBe(true);
    expect(on(CLIMB.x, CLIMB.post)).toBe(true);
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
