// Yssa on the track west out of the Ashwild: she stands in it until the hero writes her her name, wherever he learnt
// it (from Cinder as he falls, or from last time: the woodcutters' hut door only warns she'll ask); then she steps aside, and the
// track runs on to the Frozen Hollow. A new run starts her afresh.
import { describe, expect, it } from "vitest";
import { loadArea } from "../src/areas/index.ts";
import { area as hollow } from "../src/areas/hollow.ts";
import { CINDER_LAST_WORDS, HUT_CARVING, YSSA, YSSA_TALK, YSSA_TRACK } from "../src/data/ashwild.ts";
import { HALF, T } from "../src/data/world.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { advanceTalk, startTalk, talking } from "../src/game/talk.ts";
import { enterArea } from "../src/game/travel.ts";
import { handBack, paperAsks, writingFor } from "../src/game/watchword.ts";
import { passedYssa, yssaSystem } from "../src/game/yssa.ts";
import { moveBy } from "../src/world/collision.ts";

async function inAshwild(): Promise<Game> {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  enterArea(g, await loadArea("ashwild"), "witchwood");
  yssaSystem(g, 1 / 60);
  return g;
}
const her = (g: Game) => g.world.query("renderable", "transform").find(([, c]) => c.renderable.kind === "yssa")!;

/** Stand him on the track a few tiles east of her and walk him west; how far did he get (px)? */
function walkWest(g: Game, tiles = 6): number {
  const p = g.world.need(g.player, "transform");
  Object.assign(p, { x: (YSSA_TRACK.post + 3) * T, y: YSSA_TRACK.row * T });
  const from = p.x;
  for (let i = 0; i < tiles * 4; i++) moveBy(g.map, p, -T / 4, 0, false);
  return from - p.x;
}

/** Up to her, hear her out, and hand her back the bark with `written` on it. */
function write(g: Game, written: string | null) {
  const [e, { transform: t }] = her(g);
  Object.assign(g.world.need(g.player, "transform"), { x: t.x + 12, y: t.y });
  startTalk(g, e);
  const heard = [...talking(g)!.lines];
  while (talking(g)) { advanceTalk(g); advanceTalk(g); }
  expect(writingFor(g)).toBe(e);
  expect(paperAsks(g)).toBe("name");
  handBack(g, written);
  return { heard, said: [...talking(g)!.lines] };
}

describe("Yssa's track", () => {
  it("runs west from the Ashwild to the Frozen Hollow, and back", () => {
    expect(hollow.build().exits.map(x => x.to)).toContainEqual({ area: "ashwild", entry: "hollow" });
    expect(hollow.build().entries.ashwild).toBeDefined();
  });

  it("has her standing in it, and nobody gets by her", async () => {
    const g = await inAshwild(), [, { transform: t }] = her(g);
    expect(t.x + HALF).toBeCloseTo((YSSA_TRACK.post + 0.5) * T);
    expect(walkWest(g)).toBeLessThan(3 * T);
  });

  it("asks for her name on birch bark, and a wrong one won't do", async () => {
    const g = await inAshwild(), { heard, said } = write(g, "Frost Witch");
    expect(heard).toEqual(YSSA_TALK.ask);
    expect(said[0]).toContain("Frost Witch");
    expect(passedYssa(g)).toBe(false);
  });

  it("steps aside for her name, written any old way, and for the rest of the run", async () => {
    const g = await inAshwild(), { said } = write(g, "  ySSa ");
    expect(said).toEqual(YSSA_TALK.right);
    expect(passedYssa(g)).toBe(true);
    for (let i = 0; i < 120; i++) yssaSystem(g, 1 / 20);
    expect(walkWest(g)).toBe(6 * T);
    resetGame(g);
    setState(g, "play");
    enterArea(g, await loadArea("ashwild"), "witchwood");
    yssaSystem(g, 1 / 60);
    expect(walkWest(g)).toBeLessThan(3 * T);                 // a new run: back in the track
  });

  it("is named by Cinder as he falls; the woodcutters' hut door warns she'll ask, but doesn't name her", async () => {
    expect(CINDER_LAST_WORDS.join(" ")).toContain(YSSA.word);
    expect(HUT_CARVING.lines.join(" ").toLowerCase()).not.toContain(YSSA.word.toLowerCase());
    const g = await inAshwild(), hut = g.area.layout.props.find(p => p.kind === "hall")!;
    if (hut.kind !== "hall") throw new Error("no hut");
    Object.assign(g.world.need(g.player, "transform"), { x: hut.rect.x + hut.rect.w / 2 - HALF, y: hut.rect.y + hut.rect.h - HALF });
    yssaSystem(g, 1 / 60);
    expect(talking(g)?.lines).toEqual(HUT_CARVING.lines);
  });
});
