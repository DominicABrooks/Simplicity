// The Ashwild, past the King's woodwardens: the barricade turns you back until you've written the
// wardens the King's watchword on their scrap of paper; the woods there are ash-grey and only Ember mages hunt them; and Cinder waits at the
// Greyed's camp, tougher and quicker than any mage, and once beaten, beaten for the run.
import { describe, expect, it } from "vitest";
import { loadArea } from "../src/areas/index.ts";
import { area as ashwild, CINDER_AT } from "../src/areas/ashwild.ts";
import { area as witchwood } from "../src/areas/witchwood.ts";
import { CINDER, CINDER_FALLS, CINDER_LAST_WORDS, WARDEN_TALK, WOODWARDEN } from "../src/data/ashwild.ts";
import { WATCHWORD } from "../src/data/king.ts";
import { beaten, bossSystem } from "../src/game/bosses.ts";
import { victorySystem } from "../src/game/victory.ts";
import { VICTORY } from "../src/data/victory.ts";
import { cinderFightSystem } from "../src/game/cinderfight.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { spawnEnemy } from "../src/game/spawn.ts";
import { advanceTalk, endTalk, startTalk, talking } from "../src/game/talk.ts";
import { enterArea, travelSystem } from "../src/game/travel.ts";
import { handBack, passedBarricade, writingFor } from "../src/game/watchword.ts";
import { deathSystem, spawnerSystem } from "../src/systems/enemies.ts";
import { FEET } from "../src/world/collision.ts";

async function inWitchwood(): Promise<Game> {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  enterArea(g, await loadArea("witchwood"), "start");
  return g;
}
/** Up to a warden and hear them out, to the end: they hand over the paper. */
function askedForIt(g: Game) {
  const [warden, { transform }] = g.world.query("targetable", "transform").find(([, c]) => c.targetable.name === WOODWARDEN.name)!;
  Object.assign(g.world.need(g.player, "transform"), { x: transform.x, y: transform.y - 12 });
  startTalk(g, warden);
  const heard = [...talking(g)!.lines];
  while (talking(g)) { advanceTalk(g); advanceTalk(g); }
  return { warden, heard };
}
/** Stand the hero with his feet in the trail's exit south. */
function atTheGate(g: Game) {
  const exit = g.area.layout.exits.find(x => x.to.area === "ashwild")!, p = g.world.need(g.player, "transform");
  Object.assign(p, { x: exit.rect.x + 4 - FEET.x, y: exit.rect.y + 1 - FEET.y });
  return { exit, p };
}

describe("the woodwardens' barricade", () => {
  it("bars the old trail south: its way on into the Ashwild needs the King's watchword", () => {
    const exit = witchwood.build().exits.find(x => x.to.area === "ashwild");
    expect(exit).toMatchObject({ needs: "watchword", to: { entry: "witchwood" } });
    expect(witchwood.build().props.filter(p => p.kind === "guard" && p.name === WOODWARDEN.name)).toHaveLength(2);
  });

  it("turns you back until you've written them the watchword", async () => {
    const g = await inWitchwood(), { p } = atTheGate(g), y = p.y;
    travelSystem(g);
    expect(g.travel).toBeNull();
    expect(p.y).toBeLessThan(y);                             // put back a step, north
  });

  it("has wardens who ask for it, and hand over paper and crayon once they've had their say", async () => {
    const g = await inWitchwood(), { warden, heard } = askedForIt(g);
    expect(heard).toEqual(WARDEN_TALK.ask);
    expect(writingFor(g)).toBe(warden);
  });

  it("don't hand over the paper if you walk off before they've finished", async () => {
    const g = await inWitchwood();
    const [warden, { transform }] = g.world.query("targetable", "transform").find(([, c]) => c.targetable.name === WOODWARDEN.name)!;
    Object.assign(g.world.need(g.player, "transform"), { x: transform.x, y: transform.y - 12 });
    startTalk(g, warden);
    endTalk(g);
    expect(writingFor(g)).toBeNull();
  });

  it("reads it back, and the wrong word won't do", async () => {
    const g = await inWitchwood();
    askedForIt(g);
    handBack(g, "Open sesame");
    expect(writingFor(g)).toBeNull();
    expect(talking(g)!.lines[0]).toContain('"Open sesame"? That\'s not it.');
    expect(passedBarricade(g)).toBe(false);
    endTalk(g);
    atTheGate(g);
    travelSystem(g);
    expect(g.travel).toBeNull();
  });

  it("nor a blank page, nor keeping the paper", async () => {
    const g = await inWitchwood();
    askedForIt(g);
    handBack(g, "   ");
    expect(talking(g)!.lines).toEqual(WARDEN_TALK.blank);
    endTalk(g);
    askedForIt(g);
    handBack(g, null);
    expect(talking(g)!.lines).toEqual(WARDEN_TALK.kept);
    expect(passedBarricade(g)).toBe(false);
  });

  it("lets you through once you've written it, however you spell the case and spacing", async () => {
    const g = await inWitchwood();
    askedForIt(g);
    handBack(g, `  ${WATCHWORD.toLowerCase().replace(" ", "   ")}! `);
    expect(talking(g)!.lines).toEqual(WARDEN_TALK.right);
    endTalk(g);
    atTheGate(g);
    travelSystem(g);
    expect(g.travel).toEqual({ area: "ashwild", entry: "witchwood" });
  });

  it("waves you on after, without asking again, until a new run", async () => {
    const g = await inWitchwood();
    askedForIt(g);
    handBack(g, WATCHWORD);
    endTalk(g);
    expect(askedForIt(g).heard).toEqual(WARDEN_TALK.through);
    expect(writingFor(g)).toBeNull();
    resetGame(g);
    expect(passedBarricade(g)).toBe(false);
  });
});

describe("the Ashwild", () => {
  async function inAshwild(): Promise<Game> {
    const g = createGame();
    resetGame(g);
    setState(g, "play");
    enterArea(g, await loadArea("ashwild"), "witchwood");
    return g;
  }
  const cinder = (g: Game) => g.world.query("targetable", "health").find(([, c]) => c.targetable.name === CINDER.name);
  /** Walk in among the arena's stones (where the fire shuts and he comes out). */
  function stepIn(g: Game) {
    Object.assign(g.world.need(g.player, "transform"), { x: CINDER_AT.x, y: CINDER_AT.y + 20 });
    cinderFightSystem(g, 1 / 60);
    return cinder(g);
  }

  it("is ash woods, back up the trail to the Witchwood, and down Yssa's track to the Frozen Hollow", () => {
    const layout = ashwild.build();
    expect(layout.map.look).toBe("ash");
    expect(layout.exits.map(x => x.to)).toEqual([{ area: "witchwood", entry: "ashwild" }, { area: "hollow", entry: "ashwild" }]);
    expect(layout.props.filter(p => p.kind === "crack").length).toBeGreaterThan(10);
  });

  it("is hunted by Ember mages only, from the moment you arrive", async () => {
    const g = await inAshwild();
    for (let i = 0; i < 200; i++) spawnEnemy(g, 40);
    const schools = new Set(g.world.query("mage").map(([, { mage }]) => mage.school));
    expect([...schools]).toEqual(["ember"]);
  });

  it("has Cinder waiting at the Greyed's camp, out of sight until you step in among the stones", async () => {
    const g = await inAshwild();
    expect(cinder(g)).toBeUndefined();
    Object.assign(g.world.need(g.player, "transform"), { x: CINDER_AT.x, y: CINDER_AT.y + 80 });   // just outside them
    cinderFightSystem(g, 1 / 60);
    expect(cinder(g)).toBeUndefined();
    expect(stepIn(g)).toBeDefined();
  });

  it("brings Cinder out into the middle: tougher than any mage, and quicker", async () => {
    const g = await inAshwild();
    const [e, { health }] = stepIn(g)!;
    expect(health.maxHp).toBe(CINDER.hp);
    expect(g.world.need(e, "transform")).toMatchObject(CINDER_AT);
    const m = g.world.need(e, "mage");
    m.blinkCD = m.specialCD = 5;
    bossSystem(g, 1);
    expect(m.specialCD).toBeCloseTo(5 - (CINDER.hurry - 1), 5);
  });

  it("has Cinder to himself: the slimes and mages scatter as he comes out, and none turn up again until you leave and come back", async () => {
    const g = await inAshwild();
    for (let i = 0; i < 10; i++) spawnEnemy(g, 40);
    expect(g.world.count("enemy")).toBeGreaterThan(10);
    const [e, { health }] = stepIn(g)!;
    expect(g.world.query("enemy").map(([id]) => id)).toEqual([e]);
    for (let i = 0; i < 20; i++) { g.spawnTimer = 0; spawnerSystem(g, 1); }
    expect(g.world.count("enemy")).toBe(1);
    health.hp = 0;
    bossSystem(g, 1 / 60);
    deathSystem(g);
    for (let i = 0; i < 20; i++) { g.spawnTimer = 0; spawnerSystem(g, 1); }
    expect(g.world.count("enemy")).toBe(0);                  // quiet, now he's gone
    enterArea(g, await loadArea("ashwild"), "witchwood");    // out and back in: the slimes are back
    expect(g.world.count("enemy")).toBeGreaterThan(0);
    for (const [id] of g.world.query("enemy")) g.world.destroy(id);
    g.spawnTimer = 0;
    spawnerSystem(g, 1);
    expect(g.world.count("enemy")).toBe(1);                  // and they keep coming
  });

  it("once beaten, stays beaten for the run, leaving a fine weapon and the news; a new run brings him back", async () => {
    const g = await inAshwild(), toasts: string[] = [];
    g.events.on("toast", ({ text }) => toasts.push(text));
    const [e, { health }] = stepIn(g)!;
    health.hp = 0;
    bossSystem(g, 1 / 60);
    deathSystem(g);
    expect(beaten(g, "cinder")).toBe(true);
    expect(toasts).toEqual(expect.arrayContaining([...CINDER_FALLS]));
    victorySystem(g, VICTORY.last);                          // the victory celebrated: then the last words
    expect(talking(g)?.lines).toEqual(CINDER_LAST_WORDS);   // his last words, in the dialogue box
    expect(g.world.query("pickup").some(([, { pickup }]) => pickup.kind === "loot" && pickup.item.slot === "weapon" && pickup.item.rarity === "rare")).toBe(true);
    expect(g.world.has(e, "transform")).toBe(false);
    enterArea(g, await loadArea("ashwild"), "witchwood");
    expect(stepIn(g)).toBeUndefined();
    resetGame(g);
    enterArea(g, await loadArea("ashwild"), "witchwood");
    expect(stepIn(g)).toBeDefined();
  });

  it("isn't counted beaten just because you left", async () => {
    const g = await inAshwild();
    stepIn(g);
    enterArea(g, await loadArea("witchwood"), "ashwild");
    bossSystem(g, 1 / 60);
    expect(beaten(g, "cinder")).toBe(false);
  });
});
