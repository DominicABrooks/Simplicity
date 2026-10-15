// Townsfolk noticing a curiosity the hero's carrying, and passing on a clue about it.
import { describe, expect, it } from "vitest";
import { area as capital } from "../src/areas/capital.ts";
import { area as castle } from "../src/areas/castle.ts";
import { area as kingsroad } from "../src/areas/kingsroad.ts";
import { loadArea } from "../src/areas/index.ts";
import { CLUE_CHANCE, CLUES } from "../src/data/clues.ts";
import { CURIO_IDS, type CurioId } from "../src/data/items.ts";
import { curioClue } from "../src/game/clues.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { startTalk, talking } from "../src/game/talk.ts";
import { populate, setCensus, updateTownsfolk } from "../src/game/townsfolk.ts";
import { enterArea } from "../src/game/travel.ts";
import { makeCurio } from "../src/items/items.ts";
import { residentsOf } from "../src/world/residents.ts";

const people = setCensus(residentsOf({ capital: capital.build().props, castle: castle.build().props, kingsroad: kingsroad.build().props }));

/** In the Market Quarter at noon, carrying these curiosities, with every roll of the dice coming up `roll`. */
async function inTheMarket(carrying: CurioId[], roll: number): Promise<Game> {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  enterArea(g, await loadArea("capital"), "southgate");
  g.hour = 12;
  for (const id of carrying) g.inventory.add(makeCurio(id));
  g.rng.next = () => roll;
  return g;
}

/** Talk to the first townsperson out in the street; what do they say? */
function talkToSomeone(g: Game): string[] {
  populate(g, people);
  for (let i = 0; i < 300 && !g.world.query("walker").length; i++) updateTownsfolk(g, 0.2);
  const [e, { transform: t }] = g.world.query("walker", "transform")[0]!;
  Object.assign(g.world.need(g.player, "transform"), { x: t.x + 6, y: t.y });
  expect(startTalk(g, e)).toBe(true);
  return [...talking(g)!.lines];
}

const allClues = new Set(Object.values(CLUES).flat());

describe("curiosity clues", () => {
  it("every curiosity has a few, and they come up a third of the time", () => {
    expect(CLUE_CHANCE).toBeCloseTo(1 / 3);
    for (const id of CURIO_IDS) expect(CLUES[id].length).toBeGreaterThanOrEqual(2);
  });

  it("nobody has anything to say about curiosities he isn't carrying", async () => {
    expect(curioClue(await inTheMarket([], 0))).toBeNull();
  });

  it("when the roll goes that way, it's a clue about one he's carrying", async () => {
    expect(CLUES.bell).toContain(curioClue(await inTheMarket(["bell"], 0)));
    expect(curioClue(await inTheMarket(["bell"], 0.9))).toBeNull();
  });

  it("a townsperson brings it up after their greeting", async () => {
    const lines = talkToSomeone(await inTheMarket(["stone"], 0));
    expect(CLUES.stone).toContain(lines[1]);
    expect(lines.filter(l => allClues.has(l))).toHaveLength(1);
  });

  it("and says nothing of the kind when he carries none", async () => {
    const lines = talkToSomeone(await inTheMarket([], 0));
    expect(lines.some(l => allClues.has(l))).toBe(false);
  });
});
