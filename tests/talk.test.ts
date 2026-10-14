import { describe, expect, it } from "vitest";
import { loadArea } from "../src/areas/index.ts";
import type { Entity } from "../src/core/ecs.ts";
import { TALK } from "../src/data/dialogue.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { advanceTalk, startTalk, talking, updateTalk } from "../src/game/talk.ts";
import { enterArea } from "../src/game/travel.ts";
import { FAMILIES } from "../src/world/people.ts";

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
  it("to a guard close by: a greeting, their post, a rumour from the city, and goodbye", async () => {
    const { g, guard } = await byGuard();
    expect(startTalk(g, guard)).toBe(true);
    const c = talking(g)!;
    expect(c.name).toBe("Royal Guard");
    expect(c.lines).toHaveLength(4);
    const rumours = FAMILIES.flatMap(f => f.rumours.map(r => r.says));
    expect(rumours.some(r => c.lines[2]!.includes(`"${r}."`))).toBe(true);
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
