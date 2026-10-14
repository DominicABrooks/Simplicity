import { describe, expect, it } from "vitest";
import { BESTIARY, emptyJournal } from "../src/data/bestiary.ts";
import { createGame, setState, type GameEvents } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { step } from "../src/systems/index.ts";

function playing() {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  for (const [e] of g.world.query("enemy")) g.world.destroy(e);
  g.spawnTimer = 1e9;
  return g;
}

/** Kill one enemy of a kind next to nothing in particular, and step so the death is processed. */
function kill(g: ReturnType<typeof playing>, kind: "slime" | "ember" | "frost" | "storm") {
  const p = g.world.need(g.player, "transform");
  const base = { transform: { x: p.x + 80, y: p.y }, knockback: { vx: 0, vy: 0 }, health: { hp: 0, maxHp: 3 } };
  if (kind === "slime") g.world.create({ ...base, enemy: { kind: "slime", flash: 0, face: 1 }, slime: { timer: 99, hop: 0, dx: 0, dy: 0 } });
  else g.world.create({
    ...base, enemy: { kind: "mage", flash: 0, face: 1 },
    mage: { school: kind, timer: 99, casting: false, castT: 0, castK: 0, spell: null, strafe: 1, strafeT: 0, stuckT: 0, blinkCD: 9, specialCD: 9, moving: false, melee: false, swing: null, swingCD: 0, swingSide: 0, swingK: 0, swingRel: 0 },
  });
  step(g, 1 / 60);
}

describe("journal", () => {
  it("has a page for every kind of enemy, in a fixed order", () => {
    expect(BESTIARY.map(b => b.id)).toEqual(Object.keys(emptyJournal()));
  });

  it("counts kills by kind, and announces only the first of each", () => {
    const g = playing();
    const events: GameEvents["journal"][] = [], toasts: string[] = [];
    g.events.on("journal", e => events.push(e));
    g.events.on("toast", t => toasts.push(t.text));
    kill(g, "slime");
    kill(g, "slime");
    kill(g, "frost");
    expect(g.journal).toEqual({ slime: 2, ember: 0, frost: 1, storm: 0 });
    expect(events).toEqual([{ id: "slime", first: true }, { id: "slime", first: false }, { id: "frost", first: true }]);
    expect(toasts.filter(t => t.startsWith("New journal entry"))).toEqual(["New journal entry: Slime", "New journal entry: Frost Mage"]);
  });

  it("survives a reset (it's a record across runs)", () => {
    const g = playing();
    kill(g, "storm");
    resetGame(g);
    expect(g.journal.storm).toBe(1);
  });
});
