import { describe, expect, it } from "vitest";
import { damagePlayer, grantXP } from "../src/game/combat.ts";
import { createGame, setState } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { step } from "../src/systems/index.ts";

function play() {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  g.sfx.length = 0;
  return g;
}
const ids = (g: ReturnType<typeof play>) => g.sfx.map(s => s.id);

describe("sound effects", () => {
  it("are queued for getting hurt, and a different one for falling", () => {
    const g = play(), hp = g.world.need(g.player, "health");
    hp.hp = 2;
    damagePlayer(g, 0, 0);
    expect(ids(g)).toEqual(["hurt"]);
    g.sfx.length = 0;
    damagePlayer(g, 0, 0);
    expect(ids(g)).toEqual(["death"]);
  });

  it("ring out on a level-up", () => {
    const g = play();
    grantXP(g, 10_000, 0, 0);
    expect(ids(g)).toContain("levelUp");
  });

  it("follow the hero's jumps and dashes", () => {
    const g = play();
    g.input.jumpPressed = true;
    step(g, 1 / 60);
    expect(ids(g)).toContain("jump");
    g.sfx.length = 0;
    g.world.need(g.player, "motion").jump = 0;
    g.input.dashRequest = [1, 0];
    step(g, 1 / 60);
    expect(ids(g)).toContain("dash");
  });
});
