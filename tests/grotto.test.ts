// The Koi Grotto: the ice cave under the Frozen Hollow's rim, there for the fishing. A hole cut in its ice floor, room
// round it for the Great Koi, nothing else living in it, and the way back out to the Hollow.
import { describe, expect, it } from "vitest";
import { ICE_HOLE, area as grotto } from "../src/areas/grotto.ts";
import { loadArea } from "../src/areas/index.ts";
import { FISH } from "../src/data/items.ts";
import { T, Tile } from "../src/data/world.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { landGreatKoi } from "../src/game/greatkoi.ts";
import { resetGame } from "../src/game/reset.ts";
import { enterArea } from "../src/game/travel.ts";
import { makeItem } from "../src/items/items.ts";
import { spawnerSystem } from "../src/systems/enemies.ts";
import { waterAt } from "../src/systems/fishing.ts";
import { step } from "../src/systems/index.ts";
import { reachableFrom } from "../src/world/map.ts";

const DT = 1 / 60;
const layout = grotto.build();

async function inGrotto(): Promise<Game> {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  enterArea(g, await loadArea("grotto"), "hollow");
  return g;
}

describe("the Koi Grotto", () => {
  it("is a cave: indoors, an ice floor walled in rock", () => {
    expect(grotto.indoors).toBe(true);
    const tiles = layout.map.tiles.flat();
    expect(new Set(tiles)).toEqual(new Set([Tile.Wall, Tile.Ice, Tile.Water]));
    const walls = layout.props.find(p => p.kind === "iceWalls");
    if (walls?.kind !== "iceWalls") throw new Error("no walls");
    expect(walls.cells).toHaveLength(tiles.filter(t => t === Tile.Wall).length);
  });

  it("has room on the ice for a fight with the Great Koi, all of it reachable from the way in", () => {
    const { map, entries } = layout, hollow = entries.hollow!;
    const reached = reachableFrom(map, Math.floor(hollow.x / T + 0.5), Math.floor(hollow.y / T + 0.5));
    const ice = map.tiles.flatMap((row, y) => row.flatMap((t, x) => (t === Tile.Ice ? [y * map.width + x] : [])));
    expect(ice.length).toBeGreaterThan(150);
    for (const i of ice) expect(reached.has(i)).toBe(true);
  });

  it("leads back out to the Hollow, under its rim", async () => {
    expect(layout.exits.map(x => x.to)).toEqual([{ area: "hollow", entry: "grotto" }]);
    const hollow = (await loadArea("hollow")).build();
    expect(hollow.exits.map(x => x.to)).toContainEqual({ area: "grotto", entry: "hollow" });
    expect(hollow.entries.grotto).toBeDefined();
  });

  it("has nothing else living in it: no slimes or mages ever come", async () => {
    const g = await inGrotto();
    for (let i = 0; i < 40; i++) { g.spawnTimer = 0; spawnerSystem(g, 1); }
    expect(g.world.count("enemy")).toBe(0);
  });
});

describe("the hole in the ice", () => {
  it("is open water with ice all round it", async () => {
    const g = await inGrotto();
    const { x: x0, y: y0, w, h } = ICE_HOLE, inside = (x: number, y: number) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;
    for (let y = y0 - 1; y <= y0 + h; y++) for (let x = x0 - 1; x <= x0 + w; x++) {
      const corner = (x < x0 || x >= x0 + w) && (y < y0 || y >= y0 + h);
      if (!corner) expect(g.map.tiles[y]![x], `${x},${y}`).toBe(inside(x, y) ? Tile.Water : Tile.Ice);
    }
    expect(waterAt(g, ICE_HOLE.x * T, ICE_HOLE.y * T)).toBe("hole");
  });

  it("once the Great Koi's landed, gives up a golden koi every time, never anything else", async () => {
    const g = await inGrotto();
    landGreatKoi(g, 0, 0);                                    // the big one's out of there (see tests/greatkoi.test.ts)
    g.hitstop = 0;                                           // the world moving again, after the victory's dead stop
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
