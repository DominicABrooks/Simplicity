// The beaten lieutenants' spirits: once Cinder or Rime has fallen and said their last words, their spirit rises in the
// middle of their arena and tells the hero again what the way on needs (Yssa's name; the river's). It's there every
// time he comes back that run, and gone on a new one.
import { describe, expect, it } from "vitest";
import { loadArea } from "../src/areas/index.ts";
import { YSSA } from "../src/data/ashwild.ts";
import { CLIMB } from "../src/data/hollow.ts";
import { HALF } from "../src/data/world.ts";
import { bossSystem, summonBoss } from "../src/game/bosses.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { SPIRITS, spiritHere, spiritSystem, type Spirited as Who } from "../src/game/spirits.ts";
import { endTalk, startTalk, talking } from "../src/game/talk.ts";
import { enterArea } from "../src/game/travel.ts";
import type { Prop } from "../src/world/area.ts";

const LAIRS: Record<Who, { area: string; entry: string; word: string }> = {
  cinder: { area: "ashwild", entry: "witchwood", word: YSSA.word },
  rime: { area: "hollow", entry: "ashwild", word: CLIMB.word },
};

async function into(g: Game, who: Who): Promise<void> {
  enterArea(g, await loadArea(LAIRS[who].area), LAIRS[who].entry);
}
const lairOf = (g: Game) => g.area.layout.props.find((p): p is Extract<Prop, { kind: "boss" }> => p.kind === "boss")!;

/** A fresh run, in their lair, and they fall: their last words are said, and heard out. */
async function beat(who: Who): Promise<Game> {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  await into(g, who);
  spiritSystem(g);
  expect(spiritHere(g)).toBeNull();                          // nobody's spirit before they're beaten
  g.world.need(summonBoss(g)!, "health").hp = 0;
  bossSystem(g, 1 / 60);
  spiritSystem(g);
  expect(spiritHere(g)).toBeNull();                          // not over their last words
  endTalk(g);
  spiritSystem(g);
  return g;
}

describe.each(Object.keys(LAIRS) as Who[])("%s's spirit", who => {
  it("rises in the middle of the arena once they've fallen, and tells him the word again", async () => {
    const g = await beat(who), e = spiritHere(g)!, lair = lairOf(g), at = g.world.need(e, "transform");
    expect({ x: at.x + HALF, y: at.y + HALF }).toEqual({ x: lair.x, y: lair.y });
    expect(g.world.need(e, "targetable")).toMatchObject({ hostile: false, name: SPIRITS[who].name });
    Object.assign(g.world.need(g.player, "transform"), { x: at.x, y: at.y + 12 });
    expect(startTalk(g, e)).toBe(true);
    expect(talking(g)!.lines).toEqual(SPIRITS[who].lines);
    expect(SPIRITS[who].lines.join(" ")).toContain(LAIRS[who].word);
  });

  it("is there whenever he comes back that run, and gone on a new one", async () => {
    const g = await beat(who);
    await into(g, who);
    spiritSystem(g);
    spiritSystem(g);
    expect(g.world.query("spirit")).toHaveLength(1);
    resetGame(g);
    setState(g, "play");
    await into(g, who);
    spiritSystem(g);
    expect(spiritHere(g)).toBeNull();
  });
});
