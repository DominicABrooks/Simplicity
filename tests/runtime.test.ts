// The speedrun timer (src/game/game.ts, shown under The End by src/ui/credits.ts): it runs through the run by the wall
// clock, not on the title or in the credits, starts again with a new run, and reads like a speedrun timer.
import { describe, expect, it } from "vitest";
import { createGame, formatRunTime, tickRunTime } from "../src/game/game.ts";

describe("the speedrun timer", () => {
  it("runs through play, deaths and travel, and stands still on the title and in the credits", () => {
    const g = createGame();
    tickRunTime(g, 5);
    expect(g.runTime).toBe(0);
    for (const s of ["play", "dead", "travel"] as const) { g.state = s; tickRunTime(g, 0.5); }
    expect(g.runTime).toBeCloseTo(1.5);
    g.state = "credits";
    tickRunTime(g, 10);
    expect(g.runTime).toBeCloseTo(1.5);
  });

  it("doesn't count a long gap, the tab put away", () => {
    const g = createGame();
    g.state = "play";
    tickRunTime(g, 600);
    expect(g.runTime).toBe(1);
  });

  it("reads minutes, seconds and hundredths, with the hours once there are any", () => {
    expect(formatRunTime(0)).toBe("0:00.00");
    expect(formatRunTime(63.456)).toBe("1:03.45");
    expect(formatRunTime(3723.05)).toBe("1:02:03.05");
  });
});
