import { describe, expect, it } from "vitest";
import { loadArea } from "../src/areas/index.ts";
import { DUMMY } from "../src/data/npcs.ts";
import { hitEnemy, stagger } from "../src/game/combat.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { enterArea } from "../src/game/travel.ts";
import { deathSystem, enemyPhysicsSystem } from "../src/systems/enemies.ts";

/** At the castle, whose training corner has a dummy. */
async function atCastle(): Promise<Game> {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  enterArea(g, await loadArea("castle"), "town");
  return g;
}

const dummies = (g: Game) => g.world.query("dummy", "enemy", "health", "transform", "targetable");

describe("training dummies", () => {
  it("stand in the castle yard as hostile targets", async () => {
    const g = await atCastle();
    const all = dummies(g);
    expect(all.length).toBe(1);
    for (const [, { targetable, enemy }] of all) {
      expect(targetable.hostile).toBe(true);
      expect(targetable.name).toBe(DUMMY.name);
      expect(enemy.kind).toBe("dummy");
    }
  });

  it("take every hit but never go down, give no XP and never move", async () => {
    const g = await atCastle();
    const [[e, { transform }]] = dummies(g) as [ReturnType<typeof dummies>[number]];
    const at = { ...transform }, xp = g.world.need(g.player, "hero").xp;
    for (let i = 0; i < 50; i++) {
      expect(hitEnemy(g, e, 25)).toBeGreaterThan(0);
      stagger(g, e, 1, 0, 200);
      enemyPhysicsSystem(g, 1 / 60);
      deathSystem(g);
    }
    expect(g.world.isAlive(e)).toBe(true);
    expect(g.world.need(e, "health").hp).toBe(DUMMY.hp);
    expect(g.kills).toBe(0);
    expect(g.world.need(g.player, "hero").xp).toBe(xp);
    expect(g.world.need(e, "transform")).toEqual(at);
  });
});
