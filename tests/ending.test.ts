// The end of the story path (STORY.md, "0:55 The head, the King, the credits"): Calder beaten and the crack shut, the
// rift stone glows; touching it wakes the hero at the fountain stone at dawn; the townsfolk stop and stare at him
// carrying the head, and fall in behind him; on the keep steps he sets it at the King's feet, the King has his say,
// and the credits roll; after, the game goes on.
import { describe, expect, it } from "vitest";
import { loadArea } from "../src/areas/index.ts";
import { area as capital } from "../src/areas/capital.ts";
import { area as castle } from "../src/areas/castle.ts";
import { area as kingsroad } from "../src/areas/kingsroad.ts";
import { CALDER_STAND } from "../src/areas/rift.ts";
import { SCENES } from "../src/data/cutscenes.ts";
import { CROWD, HOMECOMING, KING_AFTER, KING_HOMECOMING, KING_NO_PROOF, SHOT_SAYS } from "../src/data/ending.ts";
import { AFTER, AFTER_GUARD, HEAD, HEAD_GUARD } from "../src/data/endtalk.ts";
import { CALDER_FIGHT as F, CALDERS_HEAD } from "../src/data/rift.ts";
import { HALF, T } from "../src/data/world.ts";
import { beaten, bossSystem } from "../src/game/bosses.ts";
import { calderFightSystem } from "../src/game/calderfight.ts";
import { crowdOf, placeInCrowd, processionOn } from "../src/game/crowd.ts";
import { cutscene, holdInput, skipCutscene, updateCutscene, watchCutscenes } from "../src/game/cutscene.ts";
import { endCredits, headLaid, homeStoneSystem, watchEnding, wayHomeOpen } from "../src/game/ending.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { carryingHead, giveUpHead, HEAD_NAME } from "../src/game/head.ts";
import { creditsCamera, creditsShot, rollCredits, runSum, updateCredits } from "../src/game/credits.ts";
import { resetGame } from "../src/game/reset.ts";
import { advanceTalk, endTalk, startTalk, talking, updateTalk } from "../src/game/talk.ts";
import { populate, residentById, setCensus, updateTownsfolk } from "../src/game/townsfolk.ts";
import { arrive, enterArea } from "../src/game/travel.ts";
import { dropItem } from "../src/game/actions.ts";
import { despawnSystem, pickupSystem } from "../src/systems/pickups.ts";
import { layoutOf } from "../src/world/layouts.ts";
import { makeItem } from "../src/items/items.ts";
import { deathSystem } from "../src/systems/enemies.ts";
import { residentsOf } from "../src/world/residents.ts";

const people = setCensus(residentsOf({ capital: capital.build().props, castle: castle.build().props, kingsroad: kingsroad.build().props }));
const DT = 1 / 30;
const homecoming = SCENES.find(s => s.id === "homecoming")!;

/** A run with Calder just beaten at the edge of the great crack, the hero standing in the glade. */
async function calderBeaten(): Promise<Game> {
  const g = createGame();
  watchCutscenes(g);
  watchEnding(g);
  resetGame(g);
  setState(g, "play");
  enterArea(g, await loadArea("rift"), "stone");
  for (const [e] of g.world.query("enemy")) g.world.destroy(e);
  Object.assign(g.world.need(g.player, "transform"), { x: CALDER_STAND.x * T, y: (CALDER_STAND.y + 4) * T });
  calderFightSystem(g, DT);
  const calder = g.world.query("renderable", "health").find(([, c]) => c.renderable.kind === "calder")!;
  calder[1].health.hp = 0;
  bossSystem(g, DT);
  deathSystem(g);
  calderFightSystem(g, DT);
  endTalk(g);
  return g;
}
const riftStone = (g: Game) => g.area.layout.props.find(p => p.kind === "oldStone")!;
const glowing = (g: Game) => g.world.query("renderable").some(([, c]) => c.renderable.kind === "homestone");
const kingOf = (g: Game) => g.world.query("renderable", "transform").find(([, c]) => c.renderable.kind === "king");
const frame = (g: Game) => { holdInput(g); updateCutscene(g, DT); updateTalk(g, DT); };

/** Home: from the glowing rift stone to the fountain stone, carrying the head. */
async function home(): Promise<Game> {
  const g = await calderBeaten();
  g.inventory.add(makeItem(...CALDERS_HEAD));
  for (let t = 0; t < F.crack.shut + 0.1; t += DT) calderFightSystem(g, DT);
  const stone = riftStone(g);
  Object.assign(g.world.need(g.player, "transform"), { x: stone.x - HALF, y: stone.y - HALF });
  homeStoneSystem(g);
  arrive(g, await loadArea("capital"));
  return g;
}

describe("the end of the story path", () => {
  it("there's plenty for the city to say: hundreds of ways for each stance to put it, on the way up and after", () => {
    for (const pieces of [HEAD, AFTER]) for (const stance of Object.keys(pieces.take) as (keyof typeof pieces.take)[]) {
      const ways = Object.values(pieces.open).reduce((n, o) => n + o.length, 1) * pieces.take[stance].length * (pieces.close[stance].length + 1);
      expect(pieces.take[stance].length).toBeGreaterThanOrEqual(14);
      expect(ways).toBeGreaterThan(1000);
    }
  });

  it("the rift stone glows once Calder's gone and the crack has shut, and not before", async () => {
    const g = await calderBeaten();
    expect(beaten(g, "calder")).toBe(true);
    homeStoneSystem(g);
    expect(wayHomeOpen(g)).toBe(false);                      // the crack's still groaning shut
    expect(glowing(g)).toBe(false);
    for (let t = 0; t < F.crack.shut + 0.1; t += DT) calderFightSystem(g, DT);
    const toasts: string[] = [];
    g.events.on("toast", ({ text }) => toasts.push(text));
    homeStoneSystem(g);
    expect(wayHomeOpen(g)).toBe(true);
    expect(glowing(g)).toBe(true);
    expect(toasts).toContain(HOMECOMING.glows);
    expect(g.state).toBe("play");                            // he's not touched it yet
  });

  it("touching it wakes him at the fountain stone, at dawn, the head still in his bag", async () => {
    const g = await home();
    expect(g.area.def.id).toBe("capital");
    expect(g.world.need(g.player, "transform")).toMatchObject(g.area.layout.entries.stone!);
    expect(g.hour).toBe(HOMECOMING.dawn);
    expect(carryingHead(g)).toBe(true);
    expect(processionOn(g)).toBe(true);
  });

  it("the stone stays dark in a run where he hasn't beaten Calder", async () => {
    const g = createGame();
    resetGame(g);
    setState(g, "play");
    enterArea(g, await loadArea("rift"), "stone");
    const stone = riftStone(g);
    Object.assign(g.world.need(g.player, "transform"), { x: stone.x - HALF, y: stone.y - HALF });
    homeStoneSystem(g);
    expect(glowing(g)).toBe(false);
    expect(g.travel).toBeNull();
  });

  it("people stop and stare as he goes by with it, and some fall in behind him, who come along into the castle", async () => {
    const g = await home();
    populate(g, people);
    const hero = g.world.need(g.player, "transform");
    const walkers = () => g.world.query("walker", "transform");
    // Go and stand by each of them in turn.
    let stared = 0;
    for (const [e] of walkers()) {
      const t = g.world.get(e, "transform"), w = g.world.get(e, "walker");
      if (!t || !w || w.follow || w.crowd) continue;
      Object.assign(hero, { x: t.x + 10, y: t.y });
      updateTownsfolk(g, DT);
      if ((w.crowd as { mode: string } | undefined)?.mode === "stare") stared++;   // set by the frame just run
      expect(w.moving).toBe(false);
      Object.assign(hero, { x: t.x + 400, y: t.y });
      updateTownsfolk(g, DT);
    }
    expect(stared).toBeGreaterThan(3);
    const following = [...crowdOf(g).following];
    expect(following.length).toBeGreaterThan(0);
    expect(following.length).toBeLessThanOrEqual(CROWD.most);
    // In rows behind him, as he walks north up toward the castle.
    for (let i = 0; i < 20; i++) { hero.y -= 2; updateTownsfolk(g, DT); }
    const [x, y] = placeInCrowd(g, 0);
    expect(y).toBeGreaterThan(hero.y + HALF);
    expect(Math.abs(x - hero.x - HALF)).toBeLessThan(CROWD.side * 2);
    // Up into the castle: they come too.
    enterArea(g, await loadArea("castle"), "town");
    populate(g, people);
    const there = walkers().filter(([, c]) => c.walker.crowd?.mode === "follow").map(([, c]) => c.walker.id);
    expect(there.sort()).toEqual(following.sort());
  });

  it("on the keep steps he sets the head at the King's feet, the King has his say, and the credits roll", async () => {
    const g = await home();
    enterArea(g, await loadArea("castle"), "town");
    const king = kingOf(g);
    expect(king).toBeDefined();
    expect(king![1].transform).toEqual(g.area.layout.entries.keep);   // at the foot of the keep's stairs
    // Coming up to him: the scene starts once he's near.
    const hero = g.world.need(g.player, "transform"), at = king![1].transform;
    Object.assign(hero, { x: at.x, y: at.y + homecoming.near! + 20 });
    frame(g);
    expect(cutscene(g)).toBeNull();
    Object.assign(hero, { x: at.x, y: at.y + homecoming.near! - 4 });
    frame(g);
    expect(cutscene(g)?.scene).toBe("homecoming");
    const heard: string[] = [];
    for (let t = 0; t < 120 && cutscene(g); t += DT) {
      const c = talking(g);
      if (c) { heard.push(c.lines[c.line]!); advanceTalk(g); advanceTalk(g); }
      frame(g);
    }
    expect(heard).toEqual(KING_HOMECOMING);
    expect(headLaid(g)).toBe(true);
    expect(carryingHead(g)).toBe(false);
    expect(g.world.query("renderable").some(([, c]) => c.renderable.kind === "head")).toBe(true);
    expect(g.state).toBe("credits");
    const was = { x: hero.x, y: hero.y };
    endCredits(g);
    expect(g.state).toBe("play");
    expect(g.area.def.id).toBe("castle");                    // back in the ward, where he stood
    expect({ x: hero.x, y: hero.y }).toEqual(was);
    // Talking to him afterwards, back on his throne: thanks, not the task.
    enterArea(g, await loadArea("throneroom"), "door");
    endTalk(g);
    const [throned, { transform: seat }] = kingOf(g)!;
    Object.assign(hero, { x: seat.x, y: seat.y + 10 });
    startTalk(g, throned);
    expect(KING_AFTER).toContain(talking(g)!.lines[0]);
  });

  it("the credits show what came of this run, shot by shot in the places it changed, and then put him back", async () => {
    const g = await home();
    enterArea(g, await loadArea("castle"), "town");
    const at = kingOf(g)![1].transform, hero = g.world.need(g.player, "transform");
    Object.assign(hero, { x: at.x, y: at.y + 40 });
    frame(g);
    skipCutscene(g);
    expect(g.state).toBe("credits");
    const was = { x: hero.x, y: hero.y };
    // This run: never saw the King, beat only Calder. What it meant, in order, each with its line (no lake, no
    // churchyard, no Yssa at the fountain: he never beat Rime, laid the Ringer to rest or met her).
    await new Promise(r => setTimeout(r, 0));
    await rollCredits(g);
    const seen: string[] = [], said: string[] = [];
    for (let i = 0; i < 60 * 120 && !updateCredits(g, 1 / 60); i++) {
      const shot = creditsShot(g), cam = creditsCamera(g);
      if (shot && seen[seen.length - 1] !== g.area.def.id + shot.says) { seen.push(g.area.def.id + shot.says); said.push(shot.says); expect(cam).not.toBeNull(); }
    }
    expect(said).toEqual([SHOT_SAYS.greyed, SHOT_SAYS.slimes, SHOT_SAYS.chronicle, SHOT_SAYS.eggs, SHOT_SAYS.hatch, SHOT_SAYS.fells]);
    expect(runSum(g)).toContain("Level");
    endCredits(g);
    expect(g.area.def.id).toBe("castle");
    expect({ x: hero.x, y: hero.y }).toEqual(was);
    expect(carryingHead(g)).toBe(false);                     // the head on screen was only for the pictures
    expect(creditsCamera(g)).toBeNull();
  });

  it("skipping the scene still sets the head down and rolls the credits", async () => {
    const g = await home();
    enterArea(g, await loadArea("castle"), "town");
    const at = kingOf(g)![1].transform;
    Object.assign(g.world.need(g.player, "transform"), { x: at.x, y: at.y + 40 });
    frame(g);
    expect(cutscene(g)).not.toBeNull();
    skipCutscene(g);
    expect(headLaid(g)).toBe(true);
    expect(g.state).toBe("credits");
  });

  it("without the head, the King isn't on the steps, and on his throne he wants proof", async () => {
    const g = await home();
    giveUpHead(g);
    enterArea(g, await loadArea("castle"), "town");
    expect(kingOf(g)).toBeUndefined();
    enterArea(g, await loadArea("throneroom"), "door");
    if (cutscene(g)) skipCutscene(g);
    endTalk(g);
    const [king, { transform }] = kingOf(g)!;
    Object.assign(g.world.need(g.player, "transform"), { x: transform.x, y: transform.y + 10 });
    startTalk(g, king);
    expect(talking(g)!.lines).toEqual(KING_NO_PROOF);
  });

  it("on his way up with the head, the townsfolk and the guards talk about nothing else; after, each has a word on it once", async () => {
    const g = await home();
    populate(g, people);
    const hero = g.world.need(g.player, "transform");
    /** Talk to them: what they say. */
    const hear = (e: number) => {
      endTalk(g);
      const t = g.world.need(e, "transform");
      Object.assign(hero, { x: t.x + 6, y: t.y });
      startTalk(g, e);
      return talking(g)!.lines;
    };
    const grownUp = g.world.query("walker").find(([, c]) => (residentById(c.walker.id)?.age ?? 0) >= 14)!;
    const r = residentById(grownUp[1].walker.id)!, takes = HEAD.take[r.stance];
    // How they take it, every time, and never the same take twice till they've all been said; said many ways.
    const said: string[] = [], heard = new Set<string>();
    for (let i = 0; i < takes.length; i++) {
      const lines = hear(grownUp[0]), last = lines[lines.length - 1]!;
      heard.add(lines.join(" / "));
      const take = takes.find(t => last.startsWith(t));
      expect(take).toBeDefined();
      said.push(take!);
    }
    expect(new Set(said).size).toBe(takes.length);
    expect(heard.size).toBe(takes.length);
    // The guards at the castle gate.
    enterArea(g, await loadArea("castle"), "town");
    const guard = g.world.query("sentry", "renderable").find(([, c]) => c.renderable.kind === "guard")![0];
    expect(HEAD_GUARD).toContain(hear(guard)[0]);
    // The head laid at the King's feet: a word on that, the first time, and then their usual.
    const at = kingOf(g)![1].transform;
    endTalk(g);
    Object.assign(hero, { x: at.x, y: at.y + 40 });
    frame(g);
    skipCutscene(g);
    endCredits(g);
    const after = g.world.query("sentry", "renderable").find(([, c]) => c.renderable.kind === "guard")![0];
    expect(AFTER_GUARD).toContain(hear(after)[0]);
    expect(AFTER_GUARD).not.toContain(hear(after)[0]);
  });

  it("the head never fades on the ground: dropped from the bag, it's still there long after, to pick up again", async () => {
    const g = createGame();
    resetGame(g);
    setState(g, "play");
    const capitalDef = await loadArea("capital");
    enterArea(g, capitalDef, entryOf(capitalDef));
    const head = makeItem(...CALDERS_HEAD);
    g.inventory.add(head);
    g.inventory.grid = g.inventory.grid.filter(e => e.item !== head);   // taken out of the bag, as the UI does
    dropItem(g, head);
    expect(carryingHead(g)).toBe(false);
    for (let t = 0; t < 120; t += DT) despawnSystem(g, DT);
    expect(headsLying(g)).toHaveLength(1);
    const p = g.world.need(g.player, "transform");
    p.x += 3 * T; pickupSystem(g);                           // steps off it...
    p.x -= 3 * T; pickupSystem(g);                           // ...and back on
    expect(carryingHead(g)).toBe(true);
    expect(headsLying(g)).toHaveLength(0);
  });

  it("left lying, the head waits where he left it while he's elsewhere, and a new run forgets it", async () => {
    const g = await calderBeaten();                          // Calder's dropped it at the crack; he doesn't pick it up
    const [[, left]] = headsLying(g);
    const at = { x: left.transform.x, y: left.transform.y };
    const capitalDef = await loadArea("capital"), riftDef = await loadArea("rift");
    enterArea(g, capitalDef, entryOf(capitalDef));
    expect(headsLying(g)).toHaveLength(0);
    for (let t = 0; t < 60; t += DT) despawnSystem(g, DT);
    enterArea(g, riftDef, "stone");
    const back = headsLying(g);
    expect(back).toHaveLength(1);
    expect(back[0][1].transform).toMatchObject(at);
    expect(g.world.has(back[0][0], "despawn")).toBe(false);
    enterArea(g, capitalDef, entryOf(capitalDef));                    // and again, any number of times
    enterArea(g, riftDef, "stone");
    expect(headsLying(g)).toHaveLength(1);

    enterArea(g, capitalDef, entryOf(capitalDef));
    resetGame(g);
    enterArea(g, riftDef, "stone");
    expect(headsLying(g)).toHaveLength(0);
  });
});

const entryOf = (def: Awaited<ReturnType<typeof loadArea>>) => Object.keys(layoutOf(def).entries)[0];

function headsLying(g: Game) {
  return g.world.query("pickup", "transform").filter(([, c]) => c.pickup.kind === "loot" && c.pickup.item.name === HEAD_NAME);
}
