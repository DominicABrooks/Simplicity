import { describe, expect, it } from "vitest";
import { loadArea } from "../src/areas/index.ts";
import type { Entity } from "../src/core/ecs.ts";
import { TALK } from "../src/data/dialogue.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { advanceTalk, chatsWith, endTalk, jobLine, startTalk, talking, updateTalk } from "../src/game/talk.ts";
import { enterArea } from "../src/game/travel.ts";
import { updateTarget } from "../src/input/targeting.ts";
import type { Projector } from "../src/render/projector.ts";
import { GUARD, GUARD_AGAIN } from "../src/data/voices.ts";

/** At the castle, by a guard. */
async function byGuard(): Promise<{ g: Game; guard: Entity }> {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  enterArea(g, await loadArea("castle"), "town");
  const [guard, { transform }] = g.world.query("sentry", "transform")[0]!;
  Object.assign(g.world.need(g.player, "transform"), { x: transform.x, y: transform.y + 12 });
  return { g, guard };
}

describe("talking", () => {
  it("to a guard close by: a greeting, a word about their post, sometimes more", async () => {
    const { g, guard } = await byGuard();
    expect(startTalk(g, guard)).toBe(true);
    const c = talking(g)!;
    expect(c.name).toBe("Royal Guard");
    expect(c.lines.length).toBeGreaterThanOrEqual(2);
    expect(c.lines.length).toBeLessThanOrEqual(4);
    expect(GUARD.greet).toContain(c.lines[0]);
    expect(GUARD.post.castle).toContain(c.lines[1]);
  });

  it("types each line out; going on first shows the rest, then the next line, and ends after the last", async () => {
    const { g, guard } = await byGuard();
    startTalk(g, guard);
    const c = talking(g)!;
    updateTalk(g, 0.05);
    expect(Math.floor(c.t * TALK.charsPerSecond)).toBeLessThan(c.lines[0]!.length);
    advanceTalk(g);                                          // the rest of the line
    expect(c.line).toBe(0);
    expect(Math.floor(c.t * TALK.charsPerSecond)).toBe(c.lines[0]!.length);
    for (let i = 1; i < c.lines.length; i++) { advanceTalk(g); expect(c.line).toBe(i); advanceTalk(g); }
    advanceTalk(g);
    expect(talking(g)).toBeNull();
  });

  it("is always with the one you're targeting: talking to someone makes them the target", async () => {
    const { g, guard } = await byGuard();
    const [dummy] = g.world.query("dummy")[0]!;
    g.target = dummy;
    startTalk(g, guard);
    expect(g.target).toBe(guard);
  });

  it("keeps them targeted while you talk, whatever the cursor passes over", async () => {
    const { g, guard } = await byGuard();
    startTalk(g, guard);
    const [dummy] = g.world.query("dummy")[0]!;
    g.target = dummy;                                        // as if the cursor had wandered onto the dummy
    updateTarget(g, {} as Projector, { x: 0, y: 0 }, false);
    expect(g.target).toBe(guard);
  });

  it("remembers you: the same guard greets you differently the second time, and a new run forgets", async () => {
    const { g, guard } = await byGuard();
    startTalk(g, guard);
    endTalk(g);
    startTalk(g, guard);
    expect(GUARD_AGAIN.again).toContain(talking(g)!.lines[0]);
    endTalk(g);
    expect([...chatsWith(g).values()]).toEqual([2]);
    resetGame(g);
    expect(chatsWith(g).size).toBe(0);
  });

  it("ends when the hero walks off", async () => {
    const { g, guard } = await byGuard();
    startTalk(g, guard);
    g.world.need(g.player, "transform").y += TALK.leave + 10;
    updateTalk(g, 0.016);
    expect(talking(g)).toBeNull();
  });

  it("needs them close, and friendly", async () => {
    const { g, guard } = await byGuard();
    g.world.need(g.player, "transform").y += TALK.reach + 10;
    expect(startTalk(g, guard)).toBe(true);                  // still theirs to answer: too far away
    expect(talking(g)).toBeNull();
    const [dummy] = g.world.query("dummy")[0]!;
    expect(startTalk(g, dummy)).toBe(false);                 // a click on a dummy is an attack
    expect(startTalk(g, null)).toBe(false);
  });
});

describe("what people say they do", () => {
  it.each([
    ["keeps the accounts", "I keep the accounts."],
    ["helps with the saddler's work", "I help with the saddler's work."],
    ["minds the little ones", "I mind the little ones."],
    ["goes to the song school", "I go to the song school."],
    ["carries water", "I carry water."],
    ["washes the floors", "I wash the floors."],
    ["Master goldbeater", "I'm a master goldbeater."],
    ["Herbwife", "I'm a herbwife."],
    ["apprentice to the Maddoxes", "I'm an apprentice to the Maddoxes."],
    ["Ralph's daughter", "I'm Ralph's daughter."],
    ["His wife", "I'm the wife."],
    ["Eldest son", "I'm the eldest son."],
    ["too little to work", "I'm too little to work."],
    ["The King's Ranger", "I'm the King's Ranger."],
    ["almsfolk, once a weaver", "I'm almsfolk, once a weaver."],
  ])("%s: %s", (job, said) => expect(jobLine(job)).toBe(said));
});
