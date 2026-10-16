// Ael's old stones, where STORY.md puts them: the Ranger's stone at the start of the Clearing, the fountain stone in
// the Market Quarter, the ash stone just in from the barricade, and the hollow stone. Each sits on open ground with
// somewhere clear to wake beside it, and a fall after touching one wakes him there, whole, with his level kept.
import { describe, expect, it } from "vitest";
import { loadArea } from "../src/areas/index.ts";
import { HALF } from "../src/data/world.ts";
import { createGame, setState } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { lastStone, stoneSystem, wakeOnStone } from "../src/game/stones.ts";
import { arrive, enterArea } from "../src/game/travel.ts";
import { blocked, solidAt } from "../src/world/collision.ts";

const STONES = [
  { area: "witchwood", name: "The Ranger's stone" },
  { area: "capital", name: "The fountain stone" },
  { area: "ashwild", name: "The ash stone" },
  { area: "hollow", name: "The hollow stone" },
] as const;

describe("the old stones", () => {
  for (const { area, name } of STONES) {
    it(`${name}: on open ground, somewhere clear to wake by it, and waking there after a fall`, async () => {
      const def = await loadArea(area), layout = def.build();
      const stone = layout.props.find(p => p.kind === "oldStone");
      if (!stone || stone.kind !== "oldStone") throw new Error(`no stone in ${area}`);
      expect(stone.name).toBe(name);
      expect(solidAt(layout.map, stone.x, stone.y)).toBe(false);
      const wake = layout.entries[stone.entry]!;
      expect(wake).toBeDefined();
      expect(blocked(layout.map, wake.x, wake.y, true)).toBe(false);

      const g = createGame();
      resetGame(g);
      setState(g, "play");
      enterArea(g, def, stone.entry);
      const p = g.world.need(g.player, "transform");
      Object.assign(p, { x: stone.x - HALF, y: stone.y - HALF });
      stoneSystem(g);
      expect(lastStone(g)).toEqual({ area, entry: stone.entry, name });
      Object.assign(g.world.need(g.player, "hero"), { level: 4 });
      const health = g.world.need(g.player, "health");
      health.hp = 0;
      setState(g, "dead");
      expect(wakeOnStone(g)).toBe(true);
      arrive(g, def);
      expect(g.area.def.id).toBe(area);
      expect({ x: p.x, y: p.y }).toEqual(wake);
      expect(health.hp).toBe(health.maxHp);
      expect(g.world.need(g.player, "hero").level).toBe(4);
    });
  }

  it("the Ranger's stone is under him as a run starts: touched straight away", async () => {
    const g = createGame();
    resetGame(g);
    setState(g, "play");
    stoneSystem(g);
    expect(lastStone(g)?.name).toBe("The Ranger's stone");
  });
});
