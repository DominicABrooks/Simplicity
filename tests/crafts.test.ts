// Work you can see: the castle smith at the anvil (its sparks are his hammer's), and a minstrel playing to the
// market square at the fountain, both only while they're at work.
import { describe, expect, it } from "vitest";
import { loadArea } from "../src/areas/index.ts";
import { area as capital } from "../src/areas/capital.ts";
import { area as castle } from "../src/areas/castle.ts";
import { area as kingsroad } from "../src/areas/kingsroad.ts";
import { HALF, T } from "../src/data/world.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { populate, residentById, setCensus, updateTownsfolk } from "../src/game/townsfolk.ts";
import { enterArea } from "../src/game/travel.ts";
import { residentsOf } from "../src/world/residents.ts";
import { walkable, walkwaysOf } from "../src/world/walkways.ts";
import { ANVIL_WORK, MUSIC_WORK, anvilOf } from "../src/world/workplaces.ts";

const people = setCensus(residentsOf({ capital: capital.build().props, castle: castle.build().props, kingsroad: kingsroad.build().props }));
const DT = 1 / 30;

async function inArea(id: "castle" | "capital", hour: number): Promise<Game> {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  (g as unknown as { hour: number }).hour = hour;
  enterArea(g, await loadArea(id), id === "castle" ? "town" : "southgate");
  populate(g, people);
  return g;
}
const run = (g: Game, seconds: number) => { for (let t = 0; t < seconds; t += DT) updateTownsfolk(g, DT); };
/** Run until someone's at a task (they take the odd break, to a stall or a chat), for up to `most` seconds. */
const until = (g: Game, task: string, most: number) => { for (let t = 0; t < most && !atTask(g, task).length; t += DT) updateTownsfolk(g, DT); };
const tileUnder = (t: { x: number; y: number }) => [Math.floor((t.x + HALF) / T), Math.floor((t.y + HALF) / T)];
/** Who's out at a task, and where they stand, once they've got there. */
const atTask = (g: Game, task: string) => g.world.query("walker", "transform").filter(([, c]) => c.walker.task === task && c.walker.plan === "work" && !c.walker.moving)
  .map(([e, c]) => ({ e, r: residentById(c.walker.id)!, tile: tileUnder(c.transform), w: c.walker }));

describe("the castle smith", () => {
  const smithy = castle.build().props.find(p => p.kind === "smithy")!;
  if (smithy.kind !== "smithy") throw new Error("no smithy");
  const anvil = anvilOf(smithy.rect);

  it("has somewhere to stand at the anvil, and someone to stand there", () => {
    const ways = walkwaysOf(castle.build().map);
    expect(walkable(ways, ...anvil.stand)).toBe(true);
    expect(walkable(ways, Math.floor(anvil.x), Math.floor(anvil.y))).toBe(false);   // the anvil's in the way of anyone else
    expect(people.some(r => r.day.area === "castle" && ANVIL_WORK.test(r.job))).toBe(true);
  });

  it("works at the anvil in working hours, facing it, and only he stands there", async () => {
    const g = await inArea("castle", 10);
    until(g, "anvil", 120);
    const smiths = atTask(g, "anvil");
    expect(smiths).toHaveLength(1);
    const [smith] = smiths;
    expect(smith!.r.job).toMatch(ANVIL_WORK);
    expect(smith!.tile).toEqual([...anvil.stand]);
    expect(Math.cos(smith!.w.face!)).toBeGreaterThan(0.9);   // east, to the anvil
    const others = g.world.query("walker", "transform").filter(([e]) => e !== smith!.e).map(([, c]) => tileUnder(c.transform).join());
    expect(others).not.toContain(anvil.stand.join());
  });

  it("isn't at it out of hours", async () => {
    const g = await inArea("castle", 20);
    run(g, 60);
    expect(atTask(g, "anvil")).toHaveLength(0);
  });
});

describe("the minstrel", () => {
  it("plays to the market square from the fountain's rim in working hours, notes floating up", async () => {
    const g = await inArea("capital", 11);
    until(g, "lute", 120);
    const players = atTask(g, "lute");
    expect(players).toHaveLength(1);
    expect(players[0]!.r.job).toMatch(MUSIC_WORK);
    const fountain = capital.build().props.find(p => p.kind === "fountain")!;
    if (fountain.kind !== "fountain") throw new Error("no fountain");
    const [tx, ty] = players[0]!.tile;
    expect(Math.hypot(tx! + 0.5 - fountain.x / T, ty! + 0.5 - fountain.y / T)).toBeLessThan(fountain.radius + 3);
    expect(ty! + 0.5).toBeGreaterThan(fountain.y / T);         // the south side, facing out
    g.floaters.length = 0;
    run(g, 1.6);
    expect(g.floaters.some(f => f.text === "♪" || f.text === "♫")).toBe(true);
  });

  it("isn't playing out of hours", async () => {
    const g = await inArea("capital", 21);
    run(g, 60);
    expect(atTask(g, "lute")).toHaveLength(0);
  });
});
