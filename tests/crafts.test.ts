// Work you can see: the castle smith at the anvil (its sparks are his hammer's), and a minstrel playing to the
// market square at the fountain, both only while they're at work; and at dusk, the lamplighter lighting the street lamps.
import { describe, expect, it } from "vitest";
import { loadArea } from "../src/areas/index.ts";
import { area as capital } from "../src/areas/capital.ts";
import { area as castle } from "../src/areas/castle.ts";
import { area as kingsroad } from "../src/areas/kingsroad.ts";
import { CRAFTS } from "../src/data/crafts.ts";
import { SECONDS_PER_HOUR } from "../src/data/daylight.ts";
import { TOWNSFOLK } from "../src/data/townsfolk.ts";
import { HALF, T, Tile } from "../src/data/world.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { lampsHere } from "../src/game/lamps.ts";
import { resetGame } from "../src/game/reset.ts";
import { populate, residentById, setCensus, updateTownsfolk } from "../src/game/townsfolk.ts";
import { enterArea } from "../src/game/travel.ts";
import { houseDoor } from "../src/world/plans.ts";
import { residentsOf } from "../src/world/residents.ts";
import { doorOf, walkable, walkwaysOf } from "../src/world/walkways.ts";
import { ANVIL_WORK, BROOM_WORK, FISH_WORK, HAWK_WORK, HOME_TRADES, LAMP_HELP, LAMP_WORK, MASON_WORK, loadOf, MUSIC_WORK, SQUARE_TRADES, WASH_WORK, WATER_WORK, anvilOf, yardOf, yardTask } from "../src/world/workplaces.ts";

const people = setCensus(residentsOf({ capital: capital.build().props, castle: castle.build().props, kingsroad: kingsroad.build().props }));
const DT = 1 / 30;

async function inArea(id: "castle" | "capital" | "kingsroad", hour: number): Promise<Game> {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  (g as unknown as { hour: number }).hour = hour;
  enterArea(g, await loadArea(id), { castle: "town", capital: "southgate", kingsroad: "gate" }[id]);
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
    const others = g.world.query("walker", "transform").filter(([e, c]) => e !== smith!.e && !c.walker.moving).map(([, c]) => tileUnder(c.transform).join());   // passing through is fine
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

describe("the square's sweepers, laundresses and water-carriers", () => {
  const well = capital.build().props.find(p => p.kind === "well" && p.x / T > 50 && p.x / T < 70)!;
  if (well.kind !== "well") throw new Error("no well on the square");
  const wx = well.x / T, wy = well.y / T;

  it("are in the census, working on the square", () => {
    for (const job of [BROOM_WORK, WASH_WORK, WATER_WORK]) expect(people.some(r => r.day.area === "capital" && r.day.place === "the market square" && job.test(r.job))).toBe(true);
  });

  it("do the washing at tubs round the square's well, facing it, one to a tub", async () => {
    const g = await inArea("capital", 10);
    until(g, "wash", 150);
    run(g, 20);
    const washing = atTask(g, "wash");
    expect(washing.length).toBeGreaterThan(0);
    for (const l of washing) {
      expect(l.r.job).toMatch(WASH_WORK);
      expect(Math.hypot(l.tile[0]! + 0.5 - wx, l.tile[1]! + 0.5 - wy)).toBeLessThan(3);
      const toWell = Math.atan2(wy - l.tile[1]! - 0.5, wx - l.tile[0]! - 0.5);
      expect(Math.cos(l.w.face! - toWell)).toBeGreaterThan(0.9);
    }
    expect(new Set(washing.map(l => l.tile.join())).size).toBe(washing.length);
  });

  it("wind up water at the well's crank, on its east side facing west", async () => {
    const g = await inArea("capital", 10);
    until(g, "crank", 200);
    const at = atTask(g, "crank");
    expect(at).toHaveLength(1);
    expect(at[0]!.r.job).toMatch(WATER_WORK);
    expect(at[0]!.tile).toEqual([Math.floor(wx) + 2, Math.floor(wy)]);   // two out: the well's footing fills the tile beside it
    expect(Math.cos(at[0]!.w.face!)).toBeLessThan(-0.9);
  });

  it("sweep the square with a broom", async () => {
    const g = await inArea("capital", 10);
    until(g, "broom", 200);
    const sweeping = atTask(g, "broom");
    expect(sweeping.length).toBeGreaterThan(0);
    for (const sw of sweeping) expect(sw.r.job).toMatch(BROOM_WORK);
  });

  it("aren't at it out of hours", async () => {
    const g = await inArea("capital", 21);
    run(g, 60);
    for (const task of ["wash", "crank", "broom"]) expect(atTask(g, task)).toHaveLength(0);
  });
});

describe("the fisherman on the King's Bridge", () => {
  const bridge = kingsroad.build().props.find(p => p.kind === "stoneBridge")!;
  if (bridge.kind !== "stoneBridge") throw new Error("no bridge");
  const mid = (bridge.rect.x + bridge.rect.w / 2) / T;

  it("fishes from a refuge in the parapet, side-on, facing out over the river", async () => {
    expect(people.some(r => r.day.area === "kingsroad" && FISH_WORK.test(r.job))).toBe(true);
    const g = await inArea("kingsroad", 10);
    until(g, "fish", 200);
    const [fisher] = atTask(g, "fish");
    expect(fisher).toBeDefined();
    expect(fisher!.r.job).toMatch(FISH_WORK);
    const [x, y] = fisher!.tile as [number, number], ways = walkwaysOf(g.map), out = x + 0.5 < mid ? -1 : 1;
    expect(walkable(ways, x - out, y)).toBe(true);              // the roadway behind him
    expect(walkable(ways, x + out, y)).toBe(false);             // the parapet in front
    expect(walkable(ways, x, y - 1) || walkable(ways, x, y + 1)).toBe(false);   // walled in either side: a refuge
    expect(Math.cos(fisher!.w.face!)).toBeCloseTo(out);
  });
});

describe("the falconers", () => {
  it("stand on open ground in from the castle gate with a hawk, turned toward the camera", async () => {
    const hawkers = people.filter(r => r.day.area === "castle" && HAWK_WORK.test(r.job));
    expect(hawkers.map(r => r.job)).toEqual(expect.arrayContaining(["His daughter, falconer", "Master falconer"]));
    const g = await inArea("castle", 10);
    until(g, "hawk", 200);
    const [f] = atTask(g, "hawk");
    expect(f).toBeDefined();
    expect(f!.r.job).toMatch(HAWK_WORK);
    expect(Math.hypot(f!.tile[0]! - f!.r.day.x, f!.tile[1]! - f!.r.day.y)).toBeLessThan(17);
    const ways = walkwaysOf(g.map);                            // in the clear, not in the gate's passage
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) expect(walkable(ways, f!.tile[0]! + i, f!.tile[1]! + j)).toBe(true);
    expect(Math.sin(f!.w.face!)).toBeGreaterThan(0.8);         // southward, to the camera
  });

  it("aren't out with the hawks, nor the fisherman on the bridge, at night", async () => {
    for (const [id, task] of [["castle", "hawk"], ["kingsroad", "fish"]] as const) {
      const g = await inArea(id, 21);
      run(g, 60);
      expect(atTask(g, task)).toHaveLength(0);
    }
  });
});

describe("the smithy's yard", () => {
  const smithy = castle.build().props.find(p => p.kind === "smithy")!;
  if (smithy.kind !== "smithy") throw new Error("no smithy");
  const stations = yardOf(smithy.rect);

  it("has a station for each trade, all on open ground, none in the smith's way", () => {
    const ways = walkwaysOf(castle.build().map), anvil = anvilOf(smithy.rect);
    for (const st of stations) {
      expect(walkable(ways, ...st.tile)).toBe(true);
      expect(st.tile).not.toEqual([...anvil.stand]);
    }
    expect(new Set(stations.map(st => st.task))).toEqual(new Set(["stave", "fletch", "stitch", "grind"]));
  });

  it("sets the bowyers, fletchers, harness-maker and grinder each to their own work at their stations", async () => {
    const g = await inArea("castle", 10);
    for (const task of ["stave", "fletch", "stitch", "grind"] as const) {
      until(g, task, 240);
      const at = atTask(g, task);
      expect(at.length, task).toBeGreaterThan(0);
      for (const w of at) {
        expect(yardTask(w.r.job)).toBe(task);
        expect(stations.some(st => st.task === task && st.tile.join() === w.tile.join() && st.face === w.w.face)).toBe(true);
      }
    }
  });
});

describe("the travellers on the square, and the masons at St Mary's", () => {
  it("ply their trades out on the open square, not gone in at some door", async () => {
    const g = await inArea("capital", 10);
    for (const [job, task] of SQUARE_TRADES) {
      expect(people.some(r => r.day.area === "capital" && job.test(r.job)), task).toBe(true);
      until(g, task, 300);
      const at = atTask(g, task).filter(a => job.test(a.r.job));
      expect(at.length, task).toBeGreaterThan(0);
    }
  });

  it("tells a tale a line at a time, and folk out for a chat gather round to hear it", async () => {
    const g = await inArea("capital", 11);
    until(g, "tell", 300);
    const [teller] = atTask(g, "tell");
    expect(teller).toBeDefined();
    g.floaters.length = 0;
    let listening = 0;
    for (let t = 0; t < 120 && !listening; t += 1) {
      run(g, 1);
      listening = g.world.query("walker", "transform").filter(([e, c]) => e !== teller!.e && c.walker.plan === "chat" && !c.walker.moving
        && Math.hypot(tileUnder(c.transform)[0]! - teller!.tile[0]!, tileUnder(c.transform)[1]! - teller!.tile[1]!) <= 2.5).length;
    }
    expect(g.floaters.some(f => CRAFTS.tales.includes(f.text))).toBe(true);
    expect(listening).toBeGreaterThan(0);
  });

  it("set a mason carving a block outside St Mary's", async () => {
    const g = await inArea("capital", 10);
    until(g, "chisel", 300);
    const [mason] = atTask(g, "chisel");
    expect(mason).toBeDefined();
    expect(mason!.r.job).toMatch(MASON_WORK);
    expect(mason!.r.day.place).toBe("St Mary's");
    const door = doorOf(walkwaysOf(g.map), g.area.layout.props, mason!.r.day.x, mason!.r.day.y)!;
    expect(Math.hypot(mason!.tile[0]! - door[0], mason!.tile[1]! - door[1])).toBeLessThan(6);   // out by its door
    expect(Math.sin(mason!.w.face!)).toBeGreaterThan(0.9);       // to the camera
  });
});

describe("the trades worked at home", () => {
  it("are out at their own front doors in working hours, beside the doorway, each at their work", async () => {
    const g = await inArea("capital", 10), ways = walkwaysOf(g.map), props = g.area.layout.props;
    const kinds = new Set<string>();
    for (let t = 0; t < 900 && kinds.size < 5; t += 5) {
      run(g, 5);
      for (const [, c] of g.world.query("walker", "transform")) {
        const r = residentById(c.walker.id)!, w = c.walker;
        if (w.plan !== "work" || w.moving || r.day.x !== r.home.x || r.day.y !== r.home.y) continue;
        const task = HOME_TRADES.find(([job]) => job.test(r.job))?.[1];
        if (!w.task) continue;                                   // between places: a door's both benches were taken
        expect(w.task, r.job).toBe(task);
        const door = doorOf(ways, props, r.home.x, r.home.y)!, at = tileUnder(c.transform);
        expect(Math.abs(at[0]! - door[0]) + Math.abs(at[1]! - door[1]), r.job).toBe(1);   // right beside it, not in it
        kinds.add(task!);
      }
    }
    expect(kinds.size).toBeGreaterThanOrEqual(5);
  });

  it("leave the market to its buyers: no more than a few at their doors at once", async () => {
    const g = await inArea("capital", 10);
    for (let t = 0; t < 120; t += 10) {
      run(g, 10);
      const folk = g.world.query("walker").map(([, c]) => ({ w: c.walker, r: residentById(c.walker.id)! }));
      const atDoors = folk.filter(({ w, r }) => w.plan === "work" && r.day.x === r.home.x && r.day.y === r.home.y).length;
      expect(atDoors).toBeLessThanOrEqual(TOWNSFOLK.doorsteps + 2);   // (a couple over, while those already out finish)
    }
    run(g, 60);
    expect(g.world.query("walker").filter(([, c]) => c.walker.plan === "shop").length).toBeGreaterThan(0);
  });

  it("are all indoors at night", async () => {
    const g = await inArea("capital", 21);
    run(g, 60);
    for (const [, c] of g.world.query("walker")) expect(HOME_TRADES.map(([, task]) => task as string)).not.toContain(c.walker.plan === "work" ? c.walker.task : "");
  });
});

describe("what people carry about on the job", () => {
  it("goes by their trade: porters, water-carriers, wood-carriers, laundresses, bakers; not the retired", () => {
    expect(loadOf("lodger, a porter")).toBe("sack");
    expect(loadOf("water-carrier")).toBe("yoke");
    expect(loadOf("helps with the wood-carrier's work")).toBe("sticks");
    expect(loadOf("castle laundress")).toBe("washing");
    expect(loadOf("Their daughter, delivers bread before dawn")).toBe("bread");
    expect(loadOf("retired porter")).toBeNull();
    expect(loadOf("cooper")).toBeNull();
    expect(people.filter(r => r.age >= 14 && loadOf(r.job)).length).toBeGreaterThan(40);
  });
});

describe("the street lamps, and the lamplighter", () => {
  const built = capital.build(), ways = walkwaysOf(built.map);
  const lamps = built.props.flatMap(p => (p.kind === "lamp" ? [[Math.floor(p.x / T), Math.floor(p.y / T)] as const] : []));
  const lit = () => lampsHere().filter(l => l.lit).length;

  it("stand along the main streets and round the square: on the paving, clear of the doors and the stalls, room to walk round", () => {
    expect(lamps.length).toBeGreaterThanOrEqual(16);
    const doors = built.props.flatMap(p => (p.kind === "house" ? [houseDoor(p).at] : []));
    const stalls = built.props.flatMap(p => (p.kind === "stall" ? [p.rect] : []));
    for (const [x, y] of lamps) {
      expect([[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([i, j]) => built.map.tiles[y + j!]![x + i!] === Tile.Cobble).length).toBeGreaterThanOrEqual(2);
      expect(walkable(ways, x, y)).toBe(false);                                                  // its post's solid
      expect([[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([i, j]) => walkable(ways, x + i!, y + j!)).length).toBeGreaterThanOrEqual(2);
      for (const d of doors) expect(Math.hypot(d.x - x - 0.5, d.z - y - 0.5)).toBeGreaterThanOrEqual(2);
      for (const r of stalls) {                                                                 // not behind a counter, nor in front of one
        const inside = x + 0.5 > r.x / T && x + 0.5 < (r.x + r.w) / T && y + 0.5 > r.y / T - 1 && y + 0.5 < (r.y + r.h) / T + 1;
        expect(inside).toBe(false);
      }
    }
  });

  it("has the lamplighter in the census, and sweeps' helpers to help him round", () => {
    expect(people.some(r => r.home.area === "capital" && LAMP_WORK.test(r.job))).toBe(true);
    expect(people.filter(r => r.home.area === "capital" && LAMP_HELP.test(r.job)).length).toBeGreaterThanOrEqual(CRAFTS.lamps.crew - 1);
  });

  it("are dark by day, burn through the night, and go out at dawn", async () => {
    for (const [hour, n] of [[12, 0], [17, 0], [21, lamps.length], [23, lamps.length], [3, lamps.length], [7, 0]] as const) {
      await inArea("capital", hour);
      expect(lampsHere()).toHaveLength(lamps.length);
      expect(lit()).toBe(n);
    }
  });

  it("are lit one at a time at dusk, by a lamplighter facing each with his pole up to it, all before nightfall", async () => {
    const g = await inArea("capital", CRAFTS.lamps.from - 0.1);
    expect(lit()).toBe(0);
    const lighters = new Set<string>();
    let was = lampsHere().map(l => l.lit);
    while (g.hour < CRAFTS.lamps.by - 0.05 && lit() < lamps.length) {
      g.hour += DT / SECONDS_PER_HOUR;
      updateTownsfolk(g, DT);
      const now = lampsHere().map(l => l.lit);
      now.forEach((on, i) => {
        if (!on || was[i]) return;
        const [x, y] = lampsHere()[i]!.tile;
        const by = atTask(g, "lamp").find(l => Math.abs(l.tile[0]! - x) + Math.abs(l.tile[1]! - y) === 1);
        expect(by, `lamp ${x},${y}`).toBeDefined();
        expect(Math.cos(by!.w.face! - Math.atan2(y - by!.tile[1]!, x - by!.tile[0]!))).toBeGreaterThan(0.9);
        expect(by!.r.job).toMatch(new RegExp(`${LAMP_WORK.source}|${LAMP_HELP.source}`, "i"));
        lighters.add(by!.r.job);
      });
      expect(now.filter((on, i) => on && !was[i]).length).toBeLessThanOrEqual(CRAFTS.lamps.crew);
      was = now;
    }
    expect(lit()).toBe(lamps.length);                         // every one by hand, before the rest would light of themselves
    expect([...lighters].some(job => LAMP_WORK.test(job))).toBe(true);
  });
});
