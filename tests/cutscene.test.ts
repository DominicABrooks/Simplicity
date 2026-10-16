// The King's audience as a cutscene: the first time the hero walks into the Throne Room, the scene takes over,
// walks him up the carpet, the King has his say and tells him the watchword, and then the hero's his own again.
import { describe, expect, it } from "vitest";
import { loadArea } from "../src/areas/index.ts";
import type { Entity } from "../src/core/ecs.ts";
import { SCENES } from "../src/data/cutscenes.ts";
import { KING_AGAIN, KING_AUDIENCE, KING_WATCHWORD, KINGS_TASK } from "../src/data/king.ts";
import { cutscene, holdInput, skipCutscene, updateCutscene, watchCutscenes } from "../src/game/cutscene.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { advanceTalk, startTalk, talking, updateTalk } from "../src/game/talk.ts";
import { enterArea } from "../src/game/travel.ts";

const DT = 1 / 30;
const audience = SCENES.find(s => s.id === "audience")!;

/** Into the Throne Room, by its doors. */
async function intoTheThroneRoom(g?: Game): Promise<{ g: Game; king: Entity; toasts: string[] }> {
  if (!g) {
    g = createGame();
    watchCutscenes(g);
    resetGame(g);
    setState(g, "play");
  }
  const toasts: string[] = [];
  g.events.on("toast", t => toasts.push(t.text));
  enterArea(g, await loadArea("throneroom"), "door");
  const king = g.world.query("renderable").find(([, c]) => c.renderable.kind === "king")![0];
  return { g, king, toasts };
}
/** A frame of the scene, as main.ts runs it. */
const frame = (g: Game) => { holdInput(g); updateCutscene(g, DT); updateTalk(g, DT); };
/** Play until the King starts talking (or `most` seconds). */
const untilSpeech = (g: Game, most = 30) => { for (let t = 0; t < most && !talking(g); t += DT) frame(g); };
/** Click through everything he says, then let the scene finish. */
function hearHimOut(g: Game): string[] {
  const heard: string[] = [];
  while (talking(g)) { const c = talking(g)!; heard.push(c.lines[c.line]!); advanceTalk(g); advanceTalk(g); frame(g); }
  for (let t = 0; t < 10 && cutscene(g); t += DT) frame(g);
  return heard;
}

describe("the King's audience", () => {
  it("plays the first time the hero walks into the Throne Room", async () => {
    const { g } = await intoTheThroneRoom();
    expect(cutscene(g)?.scene).toBe("audience");
  });

  it("takes control away: keys and clicks don't move him or swing at anything", async () => {
    const { g } = await intoTheThroneRoom();
    g.input.keys.add("w");
    g.input.attackPressed = true;
    holdInput(g);
    expect(g.input.keys.size).toBe(0);
    expect(g.input.attackPressed).toBe(false);
  });

  it("walks him up the carpet to stand before the King, who then says his piece and tells him the watchword", async () => {
    const { g, king, toasts } = await intoTheThroneRoom();
    const hero = g.world.need(g.player, "transform"), at = g.world.need(king, "transform"), start = hero.y;
    untilSpeech(g);
    expect(hero.y).toBeLessThan(start - 60);                            // a long walk up the hall
    expect(Math.hypot(hero.x - at.x, hero.y - at.y)).toBeCloseTo(audience.beats.find(b => b.approach)!.approach!, 0);
    expect(talking(g)?.name).toBe("King Osric");
    expect(hearHimOut(g)).toEqual([...KING_AUDIENCE]);
    expect(KING_AUDIENCE).toContain(KING_WATCHWORD);
    expect(toasts).toContain(KINGS_TASK);
    expect(cutscene(g)).toBeNull();
  });

  it("is over once played: back in later, it doesn't play again, and the King just reminds him", async () => {
    const { g } = await intoTheThroneRoom();
    untilSpeech(g);
    hearHimOut(g);
    const { king } = await intoTheThroneRoom(g);
    expect(cutscene(g)).toBeNull();
    const at = g.world.need(king, "transform");
    Object.assign(g.world.need(g.player, "transform"), { x: at.x, y: at.y + 20 });
    startTalk(g, king);
    expect(KING_AGAIN).toContain(talking(g)!.lines[0]);
  });

  it("plays again on a new run", async () => {
    const { g } = await intoTheThroneRoom();
    skipCutscene(g);
    resetGame(g);
    setState(g, "play");
    await intoTheThroneRoom(g);
    expect(cutscene(g)).not.toBeNull();
  });

  it("can be skipped: the task's set, and he's standing before the King", async () => {
    const { g, king, toasts } = await intoTheThroneRoom();
    for (let i = 0; i < 20; i++) frame(g);                              // partway in
    skipCutscene(g);
    expect(cutscene(g)).toBeNull();
    expect(talking(g)).toBeNull();
    expect(toasts).toContain(KINGS_TASK);
    const hero = g.world.need(g.player, "transform"), at = g.world.need(king, "transform");
    expect(Math.hypot(hero.x - at.x, hero.y - at.y)).toBeLessThan(30);
  });
});
