// Once he's given the woodwardens the King's watchword and gone through the gate, a warden calls a warning after him as
// he comes to the end of the trail, just before he's out of the Witchwood: it's dangerous out there, jump with Space,
// dodge by double-tapping a direction. Once a run; he stands and hears it out; never before he's through.
import { describe, expect, it } from "vitest";
import { HOME } from "../src/areas/index.ts";
import { WARDEN_TALK, WOODWARDEN } from "../src/data/ashwild.ts";
import { T } from "../src/data/world.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { endTalk, talking } from "../src/game/talk.ts";
import { enterArea } from "../src/game/travel.ts";
import { holdForWarning, passBarricade, wardenSystem, warned, warningFrom } from "../src/game/watchword.ts";
import { sentrySystem } from "../src/systems/sentry.ts";
import { angleDiff } from "../src/core/math.ts";

const DT = 1 / 60;
/** The trail's way out to the Ashwild. */
const exitOut = () => HOME.build().exits.find(e => e.needs === "watchword")!.rect;
function inWitchwood(): Game {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  enterArea(g, HOME, "start");
  return g;
}
/** Stood on the trail, `short` px short of its end. */
function standShort(g: Game, short: number): void {
  const r = exitOut();
  Object.assign(g.world.need(g.player, "transform"), { x: r.x + 4, y: r.y - short - 6 });
}

describe("the woodwarden's warning", () => {
  it("is called after him near the end of the trail, once he's through the gate, and is about jumping and dodging", () => {
    const g = inWitchwood();
    passBarricade(g);
    standShort(g, 4 * T);                                    // just through the gate: not yet
    wardenSystem(g, DT);
    expect(talking(g)).toBeNull();
    standShort(g, 1 * T);                                    // a step or two from the end
    wardenSystem(g, DT);
    const c = talking(g)!;
    expect(c.name).toBe(WOODWARDEN.name);
    expect(c.lines).toEqual([...WARDEN_TALK.warn]);
    expect(c.lines.join(" ")).toMatch(/Space/);
    expect(c.lines.join(" ")).toMatch(/double-tapping/);
    expect(warned(g)).toBe(true);
  });

  it("is called by the nearer warden, who turns round to face him while he says it, and back to his watch after", () => {
    const g = inWitchwood();
    passBarricade(g);
    for (let t = 0; t < 4; t += DT) wardenSystem(g, DT);     // the wardens step aside to their posts
    standShort(g, 1 * T);
    wardenSystem(g, DT);
    const w = warningFrom(g)!;
    expect(w).not.toBeNull();
    expect(g.world.need(w, "targetable").name).toBe(WOODWARDEN.name);
    expect(g.target).toBe(w);
    for (let t = 0; t < 2; t += DT) { sentrySystem(g, DT); wardenSystem(g, DT); }
    const s = g.world.need(w, "sentry"), at = g.world.need(w, "transform"), hero = g.world.need(g.player, "transform");
    expect(Math.abs(angleDiff(s.look, Math.atan2(hero.y - at.y, hero.x - at.x)))).toBeLessThan(0.1);
    endTalk(g);
    wardenSystem(g, DT);
    expect(s.heed).toBe(false);
    expect(warningFrom(g)).toBeNull();
    for (let t = 0; t < 6; t += DT) sentrySystem(g, DT);
    expect(Math.abs(angleDiff(s.look, s.post))).toBeLessThan(0.8);   // looking back up the trail, more or less
  });

  it("holds him still while it's up, and lets him go once it's done", () => {
    const g = inWitchwood();
    passBarricade(g);
    standShort(g, 1 * T);
    wardenSystem(g, DT);
    g.input.keys.add("s");
    g.input.dashRequest = [0, 1];
    holdForWarning(g);
    expect(g.input.keys.size).toBe(0);
    expect(g.input.dashRequest).toBeNull();
    endTalk(g);
    g.input.keys.add("s");
    holdForWarning(g);
    expect(g.input.keys.has("s")).toBe(true);
  });

  it("isn't said before he's through the gate, nor twice in a run, but is again in the next", () => {
    const g = inWitchwood();
    standShort(g, 1 * T);
    wardenSystem(g, DT);
    expect(talking(g)?.lines ?? []).not.toEqual([...WARDEN_TALK.warn]);
    passBarricade(g);
    wardenSystem(g, DT);
    endTalk(g);
    wardenSystem(g, DT);
    expect(talking(g)).toBeNull();
    resetGame(g);
    setState(g, "play");
    enterArea(g, HOME, "start");
    passBarricade(g);
    standShort(g, 1 * T);
    wardenSystem(g, DT);
    expect(talking(g)?.lines).toEqual([...WARDEN_TALK.warn]);
  });
});
