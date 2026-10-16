// The credits after the King's had his say (src/game/credits.ts), and the world after them (src/game/peace.ts): each
// shot holds long enough for its line to be read; the walk home and the head at the King's feet aren't played over
// again; the chronicle says how many followed him up; the last shot is his own, asleep in the top room of the Fells'
// house with a lantern of his own lit in the window; and once it's over the Greyed stop coming and the slimes let him be.
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
import { creditsAsleep, creditsShot, rollCredits, shotLength, updateCredits } from "../src/game/credits.ts";
import { crowdOf } from "../src/game/crowd.ts";
import { holdInput, skipCutscene, updateCutscene, watchCutscenes } from "../src/game/cutscene.ts";
import { endCredits, homeStoneSystem, watchEnding } from "../src/game/ending.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { atPeace } from "../src/game/peace.ts";
import { resetGame } from "../src/game/reset.ts";
import { spawnEnemy } from "../src/game/spawn.ts";
import { endTalk, updateTalk } from "../src/game/talk.ts";
import { setCensus } from "../src/game/townsfolk.ts";
import { arrive, enterArea } from "../src/game/travel.ts";
import { makeItem } from "../src/items/items.ts";
import { deathSystem, slimeSystem } from "../src/systems/enemies.ts";
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

/** Play the credits through: each shot's line, how long it held, and whether he was asleep in it. */
async function playThrough(g: Game): Promise<{ says: string; held: number; asleep: boolean }[]> {
  await rollCredits(g);
  const shots: { says: string; held: number; asleep: boolean }[] = [];
  for (let i = 0; i < 60 * 240 && !updateCredits(g, 1 / 60); i++) {
    const shot = creditsShot(g), last = shots[shots.length - 1];
    if (shot && last?.says === shot.says) { last.held += 1 / 60; last.asleep ||= creditsAsleep(g) !== null; }
    else if (shot) shots.push({ says: shot.says, held: 1 / 60, asleep: creditsAsleep(g) !== null });
  }
  return shots;
}

describe("the credits", () => {
  it("hold each shot long enough to read its line, and never less than the usual", () => {
    expect(shotLength("A short line.")).toBe(CREDITS_TIME.shot);
    for (const says of Object.values(SHOT_SAYS)) {
      expect(shotLength(says)).toBeGreaterThanOrEqual(words(says) / CREDITS_TIME.read + 2 * CREDITS_TIME.fade - 1e-9);
    }
    expect(shotLength(SHOT_SAYS.greyed)).toBeGreaterThan(CREDITS_TIME.shot);
  });

  it("don't play the walk home or the King's feet again; the chronicle says a crowd followed him; the last shot is his own", async () => {
    const g = await atTheCastle();
    crowdOf(g).following = people.filter(r => r.age >= 14).slice(0, CROWD_OF + 2).map(r => r.id);
    toTheKing(g);
    expect(g.state).toBe("credits");
    const shots = await playThrough(g);
    const said = shots.map(s => s.says);
    expect(said[0]).toBe(SHOT_SAYS.woke);
    expect(said.some(s => /followed you up the hill with|at the King's feet/.test(s))).toBe(false);
    expect(said).toContain(`${SHOT_SAYS.chronicle} ${SHOT_SAYS_TOO.followed.crowd}`);
    const last = shots[shots.length - 1]!;
    expect(last.says).toBe(SHOT_SAYS.fells);
    expect(last.asleep).toBe(true);                          // in the bed in the Fells' top room
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
    // A new run starts the trouble afresh.
    resetGame(g);
    expect(atPeace(g)).toBe(false);
  });
});
