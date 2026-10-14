import { describe, expect, it } from "vitest";
import { loadArea } from "../src/areas/index.ts";
import { TRAINING, TRAINING_HP } from "../src/data/npcs.ts";
import { hitEnemy, stagger } from "../src/game/combat.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { enterArea } from "../src/game/travel.ts";
import { deathSystem, enemyPhysicsSystem } from "../src/systems/enemies.ts";

/** At the castle, whose training corner has a dummy and two archery butts. */
async function atCastle(): Promise<Game> {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  enterArea(g, await loadArea("castle"), "town");
  return g;
}

const dummies = (g: Game) => g.world.query("dummy", "enemy", "health", "transform", "targetable");

describe("training dummies and archery butts", () => {
  it("stand in the castle yard as hostile targets", async () => {
    const g = await atCastle();
    const all = dummies(g);
    expect(all.map(([, { dummy }]) => dummy.kind).sort()).toEqual(["butt", "butt", "dummy"]);
    for (const [, { targetable, enemy, dummy }] of all) {
      expect(targetable.hostile).toBe(true);
      expect(targetable.name).toBe(TRAINING[dummy.kind].name);
      expect(enemy.kind).toBe("dummy");
    }
  });

  it.each(["dummy", "butt"] as const)("a %s takes every hit but never goes down, gives no XP and never moves", async kind => {
    const g = await atCastle();
    const [e, { transform }] = dummies(g).find(([, { dummy }]) => dummy.kind === kind)!;
    const at = { ...transform }, xp = g.world.need(g.player, "hero").xp;
    for (let i = 0; i < 50; i++) {
      expect(hitEnemy(g, e, 25)).toBeGreaterThan(0);
      stagger(g, e, 1, 0, 200);
      enemyPhysicsSystem(g, 1 / 60);
      deathSystem(g);
    }
    expect(g.world.isAlive(e)).toBe(true);
    expect(g.world.need(e, "health").hp).toBe(TRAINING_HP);
    expect(g.kills).toBe(0);
    expect(g.world.need(g.player, "hero").xp).toBe(xp);
    expect(g.world.need(e, "transform")).toEqual(at);
  });
});
