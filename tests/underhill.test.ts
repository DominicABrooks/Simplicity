// Following a Fey Acorn under the hill: held while the magic comes up, then there; the first time the Erl-King tells
// his secret and gives the Ring of the Long Reel, the second he warns him off, and from the third the throne's empty and
// watchers stare at him from all round the glade, more each time. Not from indoors.
import { describe, expect, it } from "vitest";
import { HOME, loadArea } from "../src/areas/index.ts";
import { FIRST_VISIT, REEL_RING, SECOND_VISIT, UNDERHILL } from "../src/data/underhill.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { arrive, enterArea } from "../src/game/travel.ts";
import { erlKingHere, erlKingSays, followAcorn, heldByFey, holdForFey, journeyMagic, underhillSystem, visitsUnderhill } from "../src/game/underhill.ts";
import { makeItem } from "../src/items/items.ts";

const acorn = () => makeItem("acorn", "rare", {}, "Fey Acorn");
function game(): Game {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  enterArea(g, HOME, "start");
  return g;
}
const run = (g: Game, seconds: number) => { for (let t = 0; t < seconds; t += 0.1) underhillSystem(g, 0.1); };
const loot = (g: Game) => g.world.query("pickup").flatMap(([, c]) => (c.pickup.kind === "loot" ? [c.pickup.item] : []));
const watchers = (g: Game) => g.world.query("watcher").length;

/** Follow an acorn from the Witchwood, all the way there, and let whatever happens there happen; then walk back out. */
async function visit(g: Game): Promise<{ said: string[] }> {
  if (g.area.def.id !== "witchwood") enterArea(g, HOME, "ring");
  expect(followAcorn(g, acorn())).toBe(true);
  run(g, UNDERHILL.going + 0.2);
  expect(g.state).toBe("travel");
  arrive(g, await loadArea("underhill"));
  const said: string[] = [];
  for (let t = 0; t < 200; t += 0.1) {
    underhillSystem(g, 0.1);
    const s = erlKingSays(g);
    if (s && s.age >= 0 && said[said.length - 1] !== s.lines[s.i]) said.push(s.lines[s.i]!);
    if (!heldByFey(g) && t > UNDERHILL.clearing + 1) break;
  }
  return { said };
}

describe("under the hill", () => {
  it("holds him while the magic comes up, and takes him there", () => {
    const g = game();
    followAcorn(g, acorn());
    run(g, UNDERHILL.going / 2);
    expect(journeyMagic(g)).toBeGreaterThan(0.4);
    g.input.keys.add("w");
    holdForFey(g);
    expect(g.input.keys.size).toBe(0);
    run(g, UNDERHILL.going);
    expect(g.travel).toEqual({ area: "underhill", entry: "arrive" });
  });

  it("the first time: the Erl-King tells it all, then gives the Ring of the Long Reel", async () => {
    const g = game();
    const { said } = await visit(g);
    expect(visitsUnderhill(g)).toBe(1);
    expect(erlKingHere(g)).toBe(true);
    expect(said).toEqual([...FIRST_VISIT]);
    const [ring] = loot(g);
    expect(ring?.name).toBe(REEL_RING.name);
    expect(ring?.rarity).toBe("legendary");
    expect(ring?.mods).toEqual(REEL_RING.mods);
    expect(heldByFey(g)).toBe(false);
  });

  it("the second time: a warning, and no second ring", async () => {
    const g = game();
    await visit(g);
    const { said } = await visit(g);
    expect(said).toEqual([...SECOND_VISIT]);
    expect(loot(g)).toEqual([]);
    expect(erlKingHere(g)).toBe(true);
  });

  it("the third time and after: no king, only watchers staring, more each time; and it's the world's count, not the run's", async () => {
    const g = game();
    await visit(g);
    await visit(g);
    resetGame(g);
    setState(g, "play");
    const { said } = await visit(g);
    expect(visitsUnderhill(g)).toBe(3);
    expect(said).toEqual([]);
    expect(erlKingHere(g)).toBe(false);
    expect(heldByFey(g)).toBe(false);
    expect(watchers(g)).toBe(UNDERHILL.watchers.first);
    for (const [, c] of g.world.query("watcher")) expect(c.watcher.shown).toBeGreaterThan(0.5);
    await visit(g);
    expect(watchers(g)).toBe(UNDERHILL.watchers.first + UNDERHILL.watchers.more);
    enterArea(g, HOME, "ring");
    underhillSystem(g, 0.1);
    expect(watchers(g)).toBe(0);
  });

  it("won't take him from indoors", async () => {
    const g = game();
    const inside = await loadArea("throneroom");
    enterArea(g, inside, "door");
    expect(followAcorn(g, acorn())).toBe(false);
    expect(heldByFey(g)).toBe(false);
  });
});
