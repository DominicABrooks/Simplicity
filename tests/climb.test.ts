// The way up out of the Frozen Hollow: the frozen stream north from the bowl's rim, with Yssa at the foot of it. She
// stands in it until the hero writes her the river's name, wherever he learnt it (from Rime as she falls, from the
// hunter's hut door, or from the guards on the King's Bridge); then she steps aside, and once he's been down to the
// Hollow she's no longer on the Ashwild's track. A new run starts her afresh.
import { describe, expect, it } from "vitest";
import { loadArea } from "../src/areas/index.ts";
import { area as hollow } from "../src/areas/hollow.ts";
import { CLIMB, CLIMB_TALK, HUNTER_NOTE, RIME_LAST_WORDS } from "../src/data/hollow.ts";
import { GUARD } from "../src/data/voices.ts";
import { HALF, T, Tile } from "../src/data/world.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { advanceTalk, startTalk, talking } from "../src/game/talk.ts";
import { enterArea } from "../src/game/travel.ts";
import { handBack, paperAsks, writingFor } from "../src/game/watchword.ts";
import { passedClimb, passedYssa, yssaSystem } from "../src/game/yssa.ts";
import { moveBy } from "../src/world/collision.ts";

async function inHollow(g = createGame()): Promise<Game> {
  resetGame(g);
  setState(g, "play");
  enterArea(g, await loadArea("hollow"), "ashwild");
  yssaSystem(g, 1 / 60);
  return g;
}
const her = (g: Game) => g.world.query("renderable", "transform").find(([, c]) => c.renderable.kind === "yssa");

/** Stand him on the climb a few tiles below her and walk him north; how far did he get (px)? */
function walkUp(g: Game, tiles = 6): number {
  const p = g.world.need(g.player, "transform");
  Object.assign(p, { x: CLIMB.x * T, y: (CLIMB.post + 1) * T });
  const from = p.y;
  for (let i = 0; i < tiles * 4; i++) moveBy(g.map, p, 0, -T / 4, false);
  return from - p.y;
}

/** Up to her, hear her out, and hand her back the bark with `written` on it. */
function write(g: Game, written: string | null) {
  const [e, { transform: t }] = her(g)!;
  Object.assign(g.world.need(g.player, "transform"), { x: t.x, y: t.y + 12 });
  startTalk(g, e);
  const heard = [...talking(g)!.lines];
  while (talking(g)) { advanceTalk(g); advanceTalk(g); }
  expect(writingFor(g)).toBe(e);
  expect(paperAsks(g)).toBe("river");
  handBack(g, written);
  return { heard, said: [...talking(g)!.lines] };
}

describe("The climb out of the Hollow", () => {
  it("runs north from the bowl to the map's edge, one frozen stream wide", () => {
    const { map } = hollow.build();
    for (let y = 0; y <= CLIMB.post; y++) expect(map.tiles[y]![CLIMB.x]).toBe(Tile.Path);
    expect(map.tiles[CLIMB.post]![CLIMB.x - 1]).toBe(Tile.Grass);                 // her notch
    expect(map.tiles[CLIMB.post - 1]![CLIMB.x - 1]).toBe(Tile.Tree);             // and no way round her
    expect(map.tiles[CLIMB.post - 1]![CLIMB.x + 1]).toBe(Tile.Tree);
  });

  it("has her standing at the foot of it, and nobody gets by her", async () => {
    const g = await inHollow(), [, { transform: t }] = her(g)!;
    expect(t.x + HALF).toBeCloseTo((CLIMB.x + 0.5) * T);
    expect(t.y + HALF).toBeCloseTo((CLIMB.post + 0.5) * T);
    expect(walkUp(g)).toBeLessThan(T);
  });

  it("asks for the river's name on birch bark, and a wrong one won't do", async () => {
    const g = await inHollow(), { heard, said } = write(g, "Yssa");
    expect(heard).toEqual(CLIMB_TALK.ask);
    expect(said[0]).toContain("Yssa");
    expect(passedClimb(g)).toBe(false);
  });

  it("steps aside for it, written any old way, and for the rest of the run", async () => {
    const g = await inHollow(), { said } = write(g, " aUREL. ");
    expect(said).toEqual(CLIMB_TALK.right);
    expect(passedClimb(g)).toBe(true);
    for (let i = 0; i < 120; i++) yssaSystem(g, 1 / 20);
    expect(walkUp(g)).toBe(6 * T);
    await inHollow(g);                                         // a new run: back in the way
    expect(walkUp(g)).toBeLessThan(T);
  });

  it("is named by Rime as she falls, on the hunter's hut door, and by the guards on the King's Bridge", async () => {
    const said = (lines: readonly string[]) => lines.join(" ").toLowerCase().includes(CLIMB.word.toLowerCase());
    expect(said(RIME_LAST_WORDS)).toBe(true);
    expect(said(HUNTER_NOTE.lines)).toBe(true);
    expect(said(GUARD.post.kingsroad)).toBe(true);
    const g = await inHollow(), hut = g.area.layout.props.find(p => p.kind === "hall")!;
    if (hut.kind !== "hall") throw new Error("no hut");
    Object.assign(g.world.need(g.player, "transform"), { x: hut.rect.x + hut.rect.w / 2 - HALF, y: hut.rect.y + hut.rect.h - HALF });
    yssaSystem(g, 1 / 60);
    expect(talking(g)?.lines).toEqual(HUNTER_NOTE.lines);
  });

  it("leaves the Ashwild's track empty once he's been down to the Hollow past her", async () => {
    const g = createGame();
    resetGame(g);
    setState(g, "play");
    enterArea(g, await loadArea("ashwild"), "witchwood");
    yssaSystem(g, 1 / 60);
    expect(her(g)).toBeDefined();
    const [e] = her(g)!;
    Object.assign(g.world.need(g.player, "transform"), { x: g.world.need(e, "transform").x + 12, y: g.world.need(e, "transform").y });
    startTalk(g, e);
    while (talking(g)) { advanceTalk(g); advanceTalk(g); }
    handBack(g, "Yssa");
    expect(passedYssa(g)).toBe(true);
    enterArea(g, await loadArea("hollow"), "ashwild");
    yssaSystem(g, 1 / 60);
    enterArea(g, await loadArea("ashwild"), "hollow");
    yssaSystem(g, 1 / 60);
    expect(her(g)).toBeUndefined();
  });
});
