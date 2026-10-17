import { describe, expect, it } from "vitest";
import { createGame, setState } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { pickTarget, updateTarget } from "../src/input/targeting.ts";
import type { Projector } from "../src/render/projector.ts";

// A flat, top-down "screen": 4 screen px per game px, height lifts things straight up the screen.
const flat: Projector = {
  gameToScreen: (x, y, h = 0) => ({ x: x * 4, y: y * 4 - h * 32 }),
  screenToGame: (x, y) => ({ x: x / 4, y: y / 4 }),
};

function setup() {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  for (const [e] of g.world.query("enemy")) g.world.destroy(e);
  const slime = g.world.create({
    transform: { x: 100, y: 100 },
    targetable: { name: "Slime", hostile: true, radius: 4.5, height: 0.6 },
  });
  return { g, slime };
}

describe("targeting", () => {
  it("picks what's under the cursor, anywhere from its feet to its head", () => {
    const { g, slime } = setup();
    expect(pickTarget(g, flat, { x: 400, y: 400 })).toBe(slime);
    expect(pickTarget(g, flat, { x: 400, y: 400 - 0.6 * 32 })).toBe(slime);
    expect(pickTarget(g, flat, { x: 400 + 30, y: 400 })).toBeNull();
  });

  it("never picks someone behind the camera, whose capsule the projection flings across the screen", () => {
    const { g, slime } = setup();
    // Feet thrown far off one way and head far off the other, the line between them crossing the cursor.
    const flipped: Projector = { ...flat, gameToScreen: (_x, _y, h = 0) => (h ? { x: -4e5, y: -4e5 } : { x: 4e5, y: 4e5 }) };
    expect(pickTarget(g, flipped, { x: 400, y: 400 })).toBeNull();
    // Far behind it, the head comes out below the feet.
    const behind: Projector = { ...flat, gameToScreen: (x, y, h = 0) => ({ x: x * 4, y: y * 4 + h * 32 }) };
    expect(pickTarget(g, behind, { x: 400, y: 400 })).toBeNull();
    expect(pickTarget(g, flat, { x: 400, y: 400 })).toBe(slime);
  });

  it("can target the campfire", () => {
    const { g } = setup();
    const [fire] = g.world.query("targetable", "transform").find(([, { targetable }]) => targetable.name === "Campfire")!;
    const t = g.world.need(fire, "transform");
    updateTarget(g, flat, flat.gameToScreen(t.x, t.y), false);
    expect(g.target).toBe(fire);
    expect(g.world.need(fire, "targetable").hostile).toBe(false);
  });

  it("keeps the target when hovering nothing, ignores the UI, and drops targets that are gone", () => {
    const { g, slime } = setup();
    updateTarget(g, flat, { x: 400, y: 400 }, false);
    expect(g.target).toBe(slime);
    updateTarget(g, flat, { x: 0, y: 0 }, false);
    expect(g.target).toBe(slime);
    g.target = null;
    updateTarget(g, flat, { x: 400, y: 400 }, true);
    expect(g.target).toBeNull();
    updateTarget(g, flat, { x: 400, y: 400 }, false);
    g.world.destroy(slime);
    updateTarget(g, flat, null, false);
    expect(g.target).toBeNull();
  });
});
