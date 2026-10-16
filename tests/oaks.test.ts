// The fair folk's acorns, planted: only in open grass outdoors, not in their ring, not crowding another; a shoot at
// first, a gilded oak once a nightfall has come; and after dark, come near a grown one and it whispers what it held.
import { describe, expect, it } from "vitest";
import { HOME, loadArea } from "../src/areas/index.ts";
import { FEY_GIFT, GILDED_OAK } from "../src/data/fey.ts";
import { T, Tile } from "../src/data/world.ts";
import { ringHere } from "../src/game/fairyring.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { oakSystem, oaksHere, plantAcorn, whisperOf } from "../src/game/oaks.ts";
import { resetGame } from "../src/game/reset.ts";
import { enterArea } from "../src/game/travel.ts";
import { makeItem } from "../src/items/items.ts";

const LINE = "Hush. The grass is thinking.";
function acorn() {
  const a = makeItem("acorn", "rare", {}, FEY_GIFT.name);
  a.note = FEY_GIFT.note(LINE);
  a.heard = LINE;
  return a;
}
function game(hour: number): Game {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  enterArea(g, HOME, "start");
  g.hour = hour;
  oakSystem(g, 0);
  return g;
}
/** Stand him with his middle at tile (tx, ty)'s middle. */
function standAt(g: Game, tx: number, ty: number) {
  const p = g.world.need(g.player, "transform");
  p.x = tx * T; p.y = ty * T;
}
/** A grass tile in the Witchwood well away from the ring, with grass round it. */
function grass(g: Game, skip = 0): [number, number] {
  const ring = ringHere(g)!;
  for (let y = 2; y < g.map.height - 2; y++) for (let x = 2; x < g.map.width - 2; x++) {
    if (g.map.tiles[y]![x] !== Tile.Grass || Math.hypot(x * T - ring.x, y * T - ring.y) < 6 * T) continue;
    if (skip-- <= 0) return [x, y];
  }
  throw new Error("no grass");
}
const tick = (g: Game, seconds: number, step = 0.1) => { for (let t = 0; t < seconds; t += step) oakSystem(g, step); };

describe("gilded oaks", () => {
  it("only take in open grass, outside the fair folk's ring, with room to grow", () => {
    const g = game(12);
    const ring = ringHere(g)!;
    standAt(g, Math.floor(ring.x / T), Math.floor(ring.y / T));
    expect(plantAcorn(g, acorn())).toBe(false);              // in the ring
    const path = (() => { for (let y = 0; y < g.map.height; y++) for (let x = 0; x < g.map.width; x++) if (g.map.tiles[y]![x] === Tile.Path) return [x, y] as const; })()!;
    standAt(g, path[0], path[1]);
    expect(plantAcorn(g, acorn())).toBe(false);              // on the path
    const [x, y] = grass(g);
    standAt(g, x, y);
    expect(plantAcorn(g, acorn())).toBe(true);
    expect(plantAcorn(g, acorn())).toBe(false);              // right on top of it
    expect(oaksHere(g)).toHaveLength(1);
    expect(oaksHere(g)[0]!.line).toBe(LINE);
    expect(oaksHere(g)[0]!.grown).toBe(false);
  });

  it("grow at the next nightfall, and stay where they were planted when he comes back, new run or not", async () => {
    const g = game(12);
    const [x, y] = grass(g);
    standAt(g, x, y);
    plantAcorn(g, acorn());
    g.hour = 20.9; oakSystem(g, 0.1);
    expect(oaksHere(g)[0]!.grown).toBe(false);
    g.hour = 21.05; oakSystem(g, 0.1);
    expect(oaksHere(g)[0]!.grown).toBe(true);
    enterArea(g, await loadArea("kingsroad"), "cave");
    expect(oaksHere(g)).toHaveLength(0);
    resetGame(g);
    enterArea(g, HOME, "start");
    expect(oaksHere(g)).toHaveLength(1);
  });

  it("planted at night, wait for the next night, not the next minute", () => {
    const g = game(23);
    const [x, y] = grass(g);
    standAt(g, x, y);
    plantAcorn(g, acorn());
    for (const h of [0.5, 5, 12, 20.5]) { g.hour = h; oakSystem(g, 0.1); }
    expect(oaksHere(g)[0]!.grown).toBe(false);
    g.hour = 21.2; oakSystem(g, 0.1);
    expect(oaksHere(g)[0]!.grown).toBe(true);
  });

  it("whisper their line after dark when he comes near, not by day, and not again straight away", () => {
    const g = game(12);
    const [x, y] = grass(g);
    standAt(g, x, y);
    plantAcorn(g, acorn());
    standAt(g, x + 6, y);
    g.hour = 21.1; oakSystem(g, 0.1);
    g.hour = 12;
    standAt(g, x, y);
    tick(g, 1);
    expect(whisperOf(g)).toBeNull();                         // by day, quiet
    g.hour = 23;
    standAt(g, x + 6, y);
    tick(g, 1);
    expect(whisperOf(g)).toBeNull();                         // too far off
    standAt(g, x, y);
    tick(g, 0.2);
    expect(whisperOf(g)?.oak.line).toBe(LINE);
    tick(g, 12);
    expect(whisperOf(g)).toBeNull();                         // said, and gone
    tick(g, 5);
    expect(whisperOf(g)).toBeNull();                         // not again so soon
    tick(g, GILDED_OAK.again - 17 + 1);                      // and again, once it's had a rest
    expect(whisperOf(g)?.oak.line).toBe(LINE);
  });

  it("won't grow indoors", async () => {
    const g = game(12);
    const inside = (await loadArea("throneroom"));
    enterArea(g, inside, Object.keys(inside.build().entries)[0]!);
    expect(plantAcorn(g, acorn())).toBe(false);
  });
});
