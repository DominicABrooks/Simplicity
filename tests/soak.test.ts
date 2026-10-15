// A soak test: in every area, from every arrival point, a monkey plays for a while with each weapon in
// hand, at noon and at midnight. It walks about, mashes attack, jump and dash, talks to whoever it's
// facing, knocks on doors, sits by fires and pets dogs, and follows any exit or door it walks into. The
// frame is the real game's (src/main.ts) without the drawing: the townsfolk, the houses' insides, the
// pets, cutscenes and talk all run. After every frame the world must still make sense: nothing at NaN,
// the hero's hearts in range, the hero never stuck in something solid, and no pile-up of entities. It
// doesn't know what the game is meant to do, only what it must never do.
import { beforeAll, describe, expect, it } from "vitest";
import { AREA_IDS, loadArea } from "../src/areas/index.ts";
import { updateChatter } from "../src/game/chatter.ts";
import { holdInput, skipCutscene, updateCutscene, watchCutscenes, cutscene } from "../src/game/cutscene.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { enterPets } from "../src/game/pets.ts";
import { startPetting, updatePetting } from "../src/game/petting.ts";
import { resetGame } from "../src/game/reset.ts";
import { startResting, updateResting } from "../src/game/resting.ts";
import { advanceTalk, endTalk, startTalk, talking, updateTalk } from "../src/game/talk.ts";
import { enterTownsfolk, knock, loadCensus, updateTownsfolk } from "../src/game/townsfolk.ts";
import { enterInterior, goInside, updateInterior } from "../src/game/interiors.ts";
import { arrive, enterArea } from "../src/game/travel.ts";
import type { ItemType } from "../src/data/items.ts";
import { makeItem } from "../src/items/items.ts";
import { step } from "../src/systems/index.ts";
import { blocked } from "../src/world/collision.ts";
import { layoutOf } from "../src/world/layouts.ts";
import type { Prop } from "../src/world/area.ts";
import { doorKey, doorStep } from "../src/world/townkit.ts";
import { T } from "../src/data/world.ts";
import type { Entity } from "../src/core/ecs.ts";

const DT = 1 / 60;
const SECONDS = 20;
const WEAPONS: (ItemType | null)[] = [null, "blade", "bow", "rod"];
const KEYS = ["w", "a", "s", "d"];
const MAX_ENTITIES = 1500;
/** More runs, each with its own dice: SOAK_SEEDS=50 npx vitest run tests/soak.test.ts digs deeper. */
const SEEDS = Number(process.env.SOAK_SEEDS ?? 1);

/** The monkey's own dice, so its moves don't disturb the game's seeded rolls. */
function dice(seed: number): () => number {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 48271) % 2147483647) / 2147483647;
}

/** A game wired up the way src/main.ts wires it, minus the DOM. */
function wiredGame(): Game {
  const g = createGame();
  g.events.on("area", () => enterTownsfolk(g));
  g.events.on("area", () => enterInterior(g));
  g.events.on("area", () => enterPets(g));
  watchCutscenes(g);
  resetGame(g);
  setState(g, "play");
  return g;
}

/** One frame of src/main.ts's loop, without the drawing. */
function frame(g: Game, dt: number): void {
  holdInput(g);
  updateResting(g, dt);
  step(g, dt);
  updateCutscene(g, dt);
  updateTalk(g, dt);
  updateTownsfolk(g, g.hitstop > 0 ? 0 : dt);
  updateInterior(g);
  updateChatter(g, g.hitstop > 0 ? 0 : dt);
  updatePetting(g, g.hitstop > 0 ? 0 : dt);
}

/** The nearest thing you could click on, as the cursor would pick it. */
function nearestTarget(g: Game): Entity | null {
  const me = g.world.need(g.player, "transform");
  let best: Entity | null = null, bestD = 24;
  for (const [e, { transform }] of g.world.query("transform", "targetable")) {
    const d = Math.hypot(transform.x - me.x, transform.y - me.y);
    if (e !== g.player && d < bestD) { best = e; bestD = d; }
  }
  return best;
}

function check(g: Game, where: string): void {
  for (const [e, { transform }] of g.world.query("transform")) {
    if (!Number.isFinite(transform.x) || !Number.isFinite(transform.y)) {
      throw new Error(`${where}: entity ${e} (${JSON.stringify(g.world.get(e, "renderable"))}) at ${transform.x},${transform.y}`);
    }
  }
  const health = g.world.need(g.player, "health");
  if (!(health.hp <= health.maxHp) || !Number.isFinite(health.hp)) throw new Error(`${where}: hero hp ${health.hp}/${health.maxHp}`);
  const n = g.world.entities().length;
  if (n > MAX_ENTITIES) throw new Error(`${where}: ${n} entities`);
  if (g.state === "play" && !cutscene(g)) {
    const pos = g.world.need(g.player, "transform"), motion = g.world.need(g.player, "motion");
    if (motion.jump <= 0 && blocked(g.map, pos.x, pos.y, false)) {
      throw new Error(`${where}: hero stuck in something solid at ${pos.x.toFixed(1)},${pos.y.toFixed(1)}`);
    }
  }
}

/**
 * Play about for a while from an area's arrival point (or wherever `start` puts the hero), and return the
 * areas visited.
 */
async function monkey(areaId: string, entry: string, weapon: ItemType | null, hour: number, seed: number,
  seconds = SECONDS, start?: (g: Game) => Promise<void>): Promise<string[]> {
  const g = wiredGame();
  g.hour = hour;
  g.inventory.reset(weapon ? [makeItem(weapon)] : []);
  enterArea(g, await loadArea(areaId), entry);
  if (start) await start(g);
  const roll = dice(seed);
  const visited = [areaId];
  let holdFor = 0, goal: { x: number; y: number } | null = null;
  for (let f = 0; f < seconds / DT; f++) {
    const where = `${visited.join(" > ")} (from ${areaId}:${entry} with ${weapon ?? "fists"} at ${hour}h, frame ${f})`;
    // Walk one way for a second or two, as a player would, not jitter on the spot; or head for somewhere:
    // an exit, or someone or something to click on.
    if (--holdFor <= 0) {
      holdFor = 30 + Math.floor(roll() * 150);
      g.input.keys.clear();
      goal = null;
      const exits = g.area.layout.exits, things = g.world.query("transform", "targetable").filter(([e]) => e !== g.player);
      const pick = roll();
      if (pick < 0.3 && exits.length) {
        const { rect } = exits[Math.floor(roll() * exits.length)]!;
        goal = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
      } else if (pick < 0.6 && things.length) {
        const { transform } = things[Math.floor(roll() * things.length)]![1];
        goal = { x: transform.x, y: transform.y };
      } else for (const k of KEYS) if (roll() < 0.35) g.input.keys.add(k);
    }
    if (goal && f % 6 === 0) {
      const me = g.world.need(g.player, "transform"), dx = goal.x - me.x, dy = goal.y - me.y;
      g.input.keys.clear();
      if (dx > 2) g.input.keys.add("d"); else if (dx < -2) g.input.keys.add("a");
      if (dy > 2) g.input.keys.add("s"); else if (dy < -2) g.input.keys.add("w");
    }
    const r = roll();
    if (r < 0.04) g.input.attackPressed = true;
    else if (r < 0.07) g.input.attackReleased = true;
    else if (r < 0.08) g.input.jumpPressed = true;
    else if (r < 0.085) g.input.dashRequest = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(roll() * 4)] as [number, number];
    else if (r < 0.1) {
      // E: go on with whoever's talking, or knock, sit, pet or talk to what's nearest.
      if (talking(g)) advanceTalk(g);
      else if (!cutscene(g)) {
        g.target = nearestTarget(g);
        void (knock(g, g.target) || startResting(g, g.target) || startPetting(g, g.target) || startTalk(g, g.target));
      }
    } else if (r < 0.102) {
      if (cutscene(g)) skipCutscene(g);
      else if (talking(g)) endTalk(g);
    }
    frame(g, DT);
    if (g.state === "travel" && g.travel) {
      visited.push(g.travel.area);
      arrive(g, await loadArea(g.travel.area));
    } else if (g.state === "dead") {
      resetGame(g);
      setState(g, "play");
    }
    check(g, where);
  }
  return visited;
}

describe("soak: playing about everywhere", async () => {
  beforeAll(async () => { await loadCensus(); });

  const cases: [string, string][] = [];
  for (const id of AREA_IDS) {
    for (const entry of Object.keys(layoutOf(await loadArea(id)).entries)) cases.push([id, entry]);
  }

  it.each(cases)("%s, arriving at %s", async (id, entry) => {
    for (let run = 0; run < SEEDS; run++) {
      for (const [i, weapon] of WEAPONS.entries()) {
        for (const hour of [12, 0, 7 + run % 14]) {
          const seed = 1 + run * 15485863 + i * 7919 + hour * 104729 + [...`${id}:${entry}`].reduce((s, c) => (s * 31 + c.charCodeAt(0)) % 1e9, 0);
          const visited = await monkey(id, entry, weapon, hour, seed);
          if (process.env.SOAK_LOG) console.log(`VISITED ${visited.join(">")}`);
        }
      }
    }
  }, 120_000 * SEEDS);
});

describe("soak: inside every house", async () => {
  const people = await loadCensus();
  const cases: [string, number][] = [];
  for (const id of ["capital", "castle", "kingsroad"]) {
    layoutOf(await loadArea(id)).props.forEach((p, i) => { if (p.kind === "house") cases.push([id, i]); });
  }

  it.each(cases)("%s, house %i: in at the door, about the room, and out onto the step", async (id, i) => {
    const outside = layoutOf(await loadArea(id)), house = outside.props[i] as Extract<Prop, { kind: "house" }>;
    const r = house.rect, household = people.filter(p => p.home.area === id && p.home.x * T >= r.x && p.home.y * T >= r.y && p.home.x * T < r.x + r.w && p.home.y * T < r.y + r.h);
    if (!household.length) return;                           // nobody lives there (scenery past the map's edge): no door
    // The step outside the door is somewhere you can stand.
    const step = doorStep(outside, doorKey(house));
    expect(step, "a step outside the door").toBeDefined();
    expect(blocked(outside.map, step!.x, step!.y, true), `the step outside at ${step!.x},${step!.y}`).toBe(false);
    const goIn = async (g: Game) => {
      goInside(g, id, house, household, household, "The house");
      arrive(g, await loadArea(g.travel!.area));
      const at = g.world.need(g.player, "transform");
      expect(blocked(g.map, at.x, at.y, true), `in at the door, ${at.x},${at.y}`).toBe(false);
    };
    for (let run = 0; run < SEEDS; run++) {
      const hour = (i + run) % 2 ? 0 : 12;                   // by day for some houses, by night for the rest
      await monkey(id, Object.keys(outside.entries)[0]!, null, hour, 1 + run * 15485863 + i * 131 + hour, 6, goIn);
    }
  }, 30_000 * SEEDS);
});
