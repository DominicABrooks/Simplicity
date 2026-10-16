// The barricade on the trail south out of the Witchwood: not knowing the King's watchword the hero is turned back with a
// word, and still with a word after he's fallen and woken again (a new run starts its clock at 0).
import { describe, expect, it } from "vitest";
import { HOME } from "../src/areas/index.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { enterArea, travelSystem } from "../src/game/travel.ts";
import { handBack, handPaper, wardenSystem } from "../src/game/watchword.ts";
import { WOODWARDEN } from "../src/data/ashwild.ts";
import { WATCHWORD } from "../src/data/king.ts";
import { HALF, T } from "../src/data/world.ts";
import { moveBy } from "../src/world/collision.ts";

/** Walk into the barricade's gate; true if someone said something about it. */
function walkIntoGate(g: Game): boolean {
  const exit = HOME.build().exits.find(e => e.needs)!;
  enterArea(g, HOME, "start");
  const p = g.world.need(g.player, "transform");
  p.x = exit.rect.x; p.y = exit.rect.y - 2;
  let said = false;
  const off = g.events.on("toast", () => { said = true; });
  const before = g.floaters.length;
  travelSystem(g);
  off?.();
  return said || g.floaters.length > before;
}

describe("the barricade", () => {
  it("turns you back with a word, and again after you've fallen and woken", () => {
    const g = createGame();
    resetGame(g);
    setState(g, "play");
    g.clock = 100;
    expect(walkIntoGate(g)).toBe(true);
    expect(g.state).toBe("play");                            // not through
    resetGame(g);
    setState(g, "play");
    g.clock = 5;
    expect(walkIntoGate(g)).toBe(true);
  });
});

describe("the woodwardens", () => {
  /** Stand him in front of the gate's middle and walk him three tiles south; how far did he get (px)? */
  function walkThrough(g: Game): number {
    const bar = g.area.layout.props.find(p => p.kind === "barricade")!;
    if (bar.kind !== "barricade") throw new Error("no barricade");
    const p = g.world.need(g.player, "transform");
    p.x = bar.rect.x + (bar.gate + bar.gateW / 2) * T - HALF; p.y = bar.rect.y - 2.5 * T;
    const from = p.y;
    moveBy(g.map, p, 0, 3 * T, false);
    return p.y - from;
  }

  it("stand in the gate until he's written the watchword, then step aside", () => {
    const g = createGame();
    resetGame(g);
    setState(g, "play");
    enterArea(g, HOME, "start");
    expect(walkThrough(g)).toBeLessThan(2 * T);              // stopped at the wardens
    const warden = g.world.query("targetable").find(([, c]) => c.targetable.name === WOODWARDEN.name)![0];
    handPaper(g, warden);
    const hero = g.world.need(g.player, "transform"), them = g.world.need(warden, "transform");
    hero.x = them.x; hero.y = them.y - T;                    // stood by, writing
    handBack(g, WATCHWORD);
    for (let i = 0; i < 60; i++) wardenSystem(g, 1 / 20);
    expect(walkThrough(g)).toBe(3 * T);                      // through
    resetGame(g);
    setState(g, "play");
    enterArea(g, HOME, "start");
    expect(walkThrough(g)).toBeLessThan(2 * T);              // a new run: back in the gate
  });
  it("mind him as they step aside: they wait while he's in the way, and are never solid round him", () => {
    const g = createGame();
    resetGame(g);
    setState(g, "play");
    enterArea(g, HOME, "start");
    const wardens = g.world.query("targetable").filter(([, c]) => c.targetable.name === WOODWARDEN.name).map(([e]) => g.world.need(e, "transform"));
    const west = wardens.reduce((a, b) => (b.x < a.x ? b : a));
    handPaper(g, g.world.query("targetable").find(([, c]) => c.targetable.name === WOODWARDEN.name)![0]);
    // He stands right where the west warden's post is, writing (the way that used to shut him in).
    const hero = g.world.need(g.player, "transform");
    hero.x = west.x - 1.1 * T; hero.y = west.y;
    handBack(g, WATCHWORD);
    for (let i = 0; i < 100; i++) wardenSystem(g, 1 / 20);
    expect(Math.abs(west.x - hero.x)).toBeGreaterThanOrEqual(0.8 * T - 1);   // waited for him, not on top of him
    for (const [dx, dy] of [[-T, 0], [0, -T], [T, 0]]) {      // and he can still walk off any way
      const from = { x: hero.x, y: hero.y }, moved = { ...from };
      moveBy(g.map, moved, dx!, dy!, false);
      expect(Math.hypot(moved.x - from.x, moved.y - from.y)).toBeGreaterThan(0);
    }
    hero.y -= 3 * T;                                         // he walks off: the warden goes to his post
    for (let i = 0; i < 100; i++) wardenSystem(g, 1 / 20);
    expect(walkThrough(g)).toBe(3 * T);                      // and the way's open
  });
});
