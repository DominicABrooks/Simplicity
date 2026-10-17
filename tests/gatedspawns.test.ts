// Nothing turns up behind those who stand in the way: Yssa on the Ashwild's track west and at the foot of the Hollow's
// climb, and the woodwardens in the Witchwood's barricade gate. While they're there, slimes and mages only come where
// the hero could walk to; once they've stepped aside, the ground past them is fair game again.
import { describe, expect, it } from "vitest";
import { loadArea } from "../src/areas/index.ts";
import { HALF, T } from "../src/data/world.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { spawnEnemy } from "../src/game/spawn.ts";
import { enterArea } from "../src/game/travel.ts";
import { passBarricade, wardenSystem } from "../src/game/watchword.ts";
import { passYssa, yssaSystem, type YssaAsks } from "../src/game/yssa.ts";
import { walkableFrom } from "../src/world/map.ts";

interface Gate { area: string; from: string; keep: (g: Game) => void; pass: (g: Game) => void }
const yssa = (area: string, from: string, asks: YssaAsks): Gate =>
  ({ area, from, keep: g => yssaSystem(g, 1 / 60), pass: g => passYssa(g, asks) });
const GATES: Record<string, Gate> = {
  "Yssa on the Ashwild's track west": yssa("ashwild", "witchwood", "name"),
  "Yssa at the foot of the Hollow's climb": yssa("hollow", "ashwild", "river"),
  "the woodwardens in the Witchwood's barricade": { area: "witchwood", from: "start", keep: g => wardenSystem(g, Infinity), pass: passBarricade },
};

async function at(gate: Gate): Promise<Game> {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  enterArea(g, await loadArea(gate.area), gate.from);
  gate.keep(g);
  return g;
}

/** The tiles he can walk to from where he stands, as g.map is now. */
function walkable(g: Game): Set<number> {
  const p = g.world.need(g.player, "transform");
  return walkableFrom(g.map, Math.floor((p.x + HALF) / T), Math.floor((p.y + HALF) / T));
}

/** Where the enemies have turned up, as tile keys. */
const enemyTiles = (g: Game): number[] =>
  g.world.query("enemy", "transform").map(([, { transform: t }]) => Math.floor(t.y / T) * g.map.width + Math.floor(t.x / T));

describe("spawning behind those who stand in the way", () => {
  for (const [name, gate] of Object.entries(GATES)) {
    it(`never happens behind ${name}, and does once they've stepped aside`, async () => {
      const shut = await at(gate), shutReach = walkable(shut);
      const open = await at(gate);
      gate.pass(open);
      gate.keep(open);
      const behind = [...walkable(open)].filter(k => !shutReach.has(k));
      expect(behind.length).toBeGreaterThan(0);              // there is ground past them

      for (let i = 0; i < 1500; i++) spawnEnemy(shut, 40);
      const spawned = enemyTiles(shut);
      expect(spawned.length).toBeGreaterThan(1000);
      expect(spawned.filter(k => behind.includes(k))).toEqual([]);

      for (let i = 0; i < 1500; i++) spawnEnemy(open, 40);
      expect(enemyTiles(open).some(k => behind.includes(k))).toBe(true);
    });
  }
});
