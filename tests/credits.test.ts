// The credits after the King's had his say (src/game/credits.ts), and the world after them (src/game/peace.ts): each
// shot holds long enough for its line to be read; the walk home and the head at the King's feet aren't played over
// again; the chronicle says how many followed him up; the last shot is his own, asleep in the top room of the Fells'
// house with a lantern of his own lit in the window, the Ranger home by the fire with Meg; a tune comes round under the
// whole reel; and once it's over the Greyed stop coming, the slimes let him be (and he them), and the city's talk is
// done with the Edict.
import { describe, expect, it } from "vitest";
import { loadArea } from "../src/areas/index.ts";
import { area as capital } from "../src/areas/capital.ts";
import { area as castle } from "../src/areas/castle.ts";
import { area as kingsroad } from "../src/areas/kingsroad.ts";
import { CALDER_STAND } from "../src/areas/rift.ts";
import { CREDITS_TIME, CROWD_OF, SHOT_SAYS, SHOT_SAYS_TOO } from "../src/data/ending.ts";
import { CALDER_FIGHT as F, CALDERS_HEAD } from "../src/data/rift.ts";
import { SLIME } from "../src/data/enemies.ts";
import { T } from "../src/data/world.ts";
import { bossSystem } from "../src/game/bosses.ts";
import { calderFightSystem } from "../src/game/calderfight.ts";
import { CREDITS_AIR } from "../src/data/sfx.ts";
import { BEFORE_ONLY, EDICT, EDICT_AFTER, STALE_AFTER } from "../src/data/voices.ts";
import { folkLines, guardLines } from "../src/game/conversation.ts";
import { creditsAsleep, creditsShot, rollCredits, shotLength, updateCredits } from "../src/game/credits.ts";
import { Rng } from "../src/core/rng.ts";
import { crowdOf } from "../src/game/crowd.ts";
import { holdInput, skipCutscene, updateCutscene, watchCutscenes } from "../src/game/cutscene.ts";
import { endCredits, homeStoneSystem, watchEnding } from "../src/game/ending.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { atPeace, spared } from "../src/game/peace.ts";
import { resetGame } from "../src/game/reset.ts";
import { spawnEnemy } from "../src/game/spawn.ts";
import { endTalk, updateTalk } from "../src/game/talk.ts";
import { residentById, setCensus } from "../src/game/townsfolk.ts";
import { arrive, enterArea } from "../src/game/travel.ts";
import { makeItem } from "../src/items/items.ts";
import { deathSystem, slimeSystem } from "../src/systems/enemies.ts";
import { FAMILIES } from "../src/world/people.ts";
import { residentsOf } from "../src/world/residents.ts";

const people = setCensus(residentsOf({ capital: capital.build().props, castle: castle.build().props, kingsroad: kingsroad.build().props }));
const DT = 1 / 30;
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** A run with Calder beaten, the crack shut, home at the fountain with the head, and in at the castle gate. */
async function atTheCastle(): Promise<Game> {
  const g = createGame();
  watchCutscenes(g);
  watchEnding(g);
  resetGame(g);
  setState(g, "play");
  enterArea(g, await loadArea("rift"), "stone");
  for (const [e] of g.world.query("enemy")) g.world.destroy(e);
  Object.assign(g.world.need(g.player, "transform"), { x: CALDER_STAND.x * T, y: (CALDER_STAND.y + 4) * T });
  calderFightSystem(g, DT);
  g.world.query("renderable", "health").find(([, c]) => c.renderable.kind === "calder")![1].health.hp = 0;
  bossSystem(g, DT);
  deathSystem(g);
  calderFightSystem(g, DT);
  endTalk(g);
  g.inventory.add(makeItem(...CALDERS_HEAD));
  calderFightSystem(g, F.crack.shut + 0.1);
  const stone = g.area.layout.props.find(p => p.kind === "oldStone")!;
  Object.assign(g.world.need(g.player, "transform"), { x: stone.x - 4, y: stone.y - 4 });
  homeStoneSystem(g);
  arrive(g, await loadArea("capital"));
  enterArea(g, await loadArea("castle"), "town");
  return g;
}

/** Up to the King on the keep steps: the scene starts, is skipped (the head laid), and the credits begin. */
function toTheKing(g: Game): void {
  const king = g.world.query("renderable", "transform").find(([, c]) => c.renderable.kind === "king")![1].transform;
  Object.assign(g.world.need(g.player, "transform"), { x: king.x, y: king.y + 40 });
  holdInput(g); updateCutscene(g, DT); updateTalk(g, DT);
  skipCutscene(g);
}

interface Played { says: string; held: number; asleep: boolean; folk: string[]; dragons: number; open: number }
/** The tunes heard over the last credits played through. */
let heard: string[] = [];
const listen = (g: Game) => { heard.push(...g.sfx.map(s => s.id).filter(id => (CREDITS_AIR.turns as readonly string[]).includes(id))); g.sfx = []; };
/** Play the credits through: each shot's line, how long it held, whether he was asleep in it, and who of the townsfolk was in it. */
async function playThrough(g: Game): Promise<Played[]> {
  heard = [];
  await rollCredits(g);
  listen(g);
  const shots: Played[] = [];
  for (let i = 0; i < 60 * 240 && !updateCredits(g, 1 / 60); i++) {
    listen(g);
    const shot = creditsShot(g), last = shots[shots.length - 1];
    if (shot && last?.says === shot.says) {
      last.held += 1 / 60;
      last.asleep ||= creditsAsleep(g) !== null;
      last.dragons = Math.max(last.dragons, g.world.query("dragon").length);
      last.open = Math.max(last.open, g.world.query("egg").filter(([, c]) => c.egg.open).length);
    }
    else if (shot) {
      const folk = g.world.query("walker").map(([, c]) => residentById(c.walker.id)?.name ?? "");
      shots.push({ says: shot.says, held: 1 / 60, asleep: creditsAsleep(g) !== null, folk, dragons: 0, open: 0 });
    }
  }
  return shots;
}

describe("the credits", () => {
  it("hold each shot long enough to read its line, and never less than the usual", () => {
    expect(shotLength("A short line.")).toBe(CREDITS_TIME.shot);
    for (const says of Object.values(SHOT_SAYS)) {
      expect(shotLength(says)).toBeGreaterThanOrEqual(words(says) / CREDITS_TIME.read + 2 * CREDITS_TIME.fade - 1e-9);
    }
    expect(shotLength(SHOT_SAYS.eggs)).toBeGreaterThan(CREDITS_TIME.shot);
  });

  it("keep what it all meant short, and let the pictures carry it", () => {
    for (const says of [SHOT_SAYS.greyed, SHOT_SAYS.slimes, SHOT_SAYS.chronicle, SHOT_SAYS.fells, ...Object.values(SHOT_SAYS_TOO.followed)]) {
      expect(words(says), says).toBeLessThanOrEqual(25);
    }
  });

  it("don't play back what he did, only what came of it; the chronicle says a crowd followed him; the last shot is his own", async () => {
    const g = await atTheCastle();
    crowdOf(g).following = people.filter(r => r.age >= 14).slice(0, CROWD_OF + 2).map(r => r.id);
    toTheKing(g);
    expect(g.state).toBe("credits");
    const shots = await playThrough(g);
    const said = shots.map(s => s.says);
    expect(said[0]).toBe(SHOT_SAYS.greyed);                  // straight to what it meant: no stone, no King, no Calder
    expect(said.some(s => /woke|followed you up the hill with|at the King's feet|Calder looked/.test(s))).toBe(false);
    expect(said).toEqual([SHOT_SAYS.greyed, SHOT_SAYS.slimes, `${SHOT_SAYS.chronicle} ${SHOT_SAYS_TOO.followed.crowd}`, SHOT_SAYS.eggs, SHOT_SAYS.hatch, SHOT_SAYS.fells]);
    expect(said).toContain(`${SHOT_SAYS.chronicle} ${SHOT_SAYS_TOO.followed.crowd}`);
    const last = shots[shots.length - 1]!;
    expect(last.says).toBe(SHOT_SAYS.fells);
    expect(last.asleep).toBe(true);                          // in the bed in the Fells' top room
    expect(last.folk).toEqual(expect.arrayContaining(["Wystan Fell", "Meg Fell"]));   // the Ranger home, and Meg
    // The Old Mother flies over the bridge for her eggs; under the Greyspines all three hatch beside her.
    const eggs = shots.find(s => s.says === SHOT_SAYS.eggs)!, hatch = shots.find(s => s.says === SHOT_SAYS.hatch)!;
    expect(eggs.dragons).toBe(1);
    expect(hatch.open).toBe(3);
    expect(hatch.dragons).toBe(4);
    expect(hatch.held).toBeGreaterThan(shotLength(SHOT_SAYS.hatch));   // held for the spectacle, not just the line
    // The tune comes round under the whole reel, every time a little different.
    const reel = shots.reduce((t, s) => t + s.held, 0);
    expect(heard.length).toBeGreaterThanOrEqual(Math.floor(reel / CREDITS_AIR.every));
    expect(new Set(heard).size).toBe(CREDITS_AIR.turns.length);
    for (const s of shots) expect(s.held).toBeGreaterThanOrEqual(shotLength(s.says) - 0.05);
    endCredits(g);
    expect(g.area.def.id).toBe("castle");
    expect(creditsAsleep(g)).toBeNull();
  });

  it("say only the chronicle when nobody followed him up", async () => {
    const g = await atTheCastle();
    crowdOf(g).following = [];
    toTheKing(g);
    const said = (await playThrough(g)).map(s => s.says);
    expect(said).toContain(SHOT_SAYS.chronicle);
  });
});

describe("after the end", () => {
  it("the Greyed stop coming and the slimes let him be, once the head's at the King's feet", async () => {
    const g = await atTheCastle();
    expect(atPeace(g)).toBe(false);
    toTheKing(g);
    expect(atPeace(g)).toBe(true);
    endCredits(g);
    // Deep in the Witchwood, where mages always came: none now, only slimes.
    enterArea(g, await loadArea("rift"), "stone");
    for (const [e] of g.world.query("enemy")) g.world.destroy(e);
    for (let i = 0; i < 60; i++) spawnEnemy(g, 40);
    expect(g.world.query("mage").length).toBe(0);
    expect(g.world.query("slime").length).toBeGreaterThan(0);
    // A slime on top of him: it doesn't hurt him, and when it hops it isn't after him.
    const hero = g.world.need(g.player, "transform"), health = g.world.need(g.player, "health"), hp = health.hp;
    const [e] = g.world.query("slime")[0]!;
    Object.assign(g.world.need(e, "transform"), { x: hero.x, y: hero.y });
    for (let t = 0; t < SLIME.hopEvery * 3; t += DT) slimeSystem(g, DT);
    expect(health.hp).toBe(hp);
    // And they're nothing to fight now: no ring on them, and his blows pass them by.
    expect(g.world.has(e, "targetable")).toBe(false);
    expect(spared(g, e)).toBe(true);
    // Nor does the city talk as if the Edict were still about: no fear of the weather, no Ranger in the dungeon.
    const rng = new Rng(7), fear = new Set(Object.values(EDICT).flat()), now = new Set(Object.values(EDICT_AFTER).flat());
    const stale = FAMILIES.flatMap(f => [...f.rumours.map(r => r.says), f.secret ?? ""]).filter(s => STALE_AFTER.test(s));
    const talk = people.filter(r => r.age >= 12 && !r.prisoner).flatMap(r => [0, 3].flatMap(v => folkLines(rng, r, [], v, undefined, true)));
    const guards = Array.from({ length: 200 }, (_, i) => guardLines(rng, "castle", i % 2, undefined, true)).flat();
    for (const line of [...talk, ...guards]) {
      expect(fear.has(line) || BEFORE_ONLY.has(line), line).toBe(false);
      for (const s of stale) expect(line.includes(s), line).toBe(false);
    }
    expect(talk.some(l => now.has(l))).toBe(true);
    // A new run starts the trouble afresh.
    resetGame(g);
    expect(atPeace(g)).toBe(false);
  });
});
