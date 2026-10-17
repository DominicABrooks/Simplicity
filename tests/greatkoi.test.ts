// The Great Koi: the very large koi under the ice in the Koi Grotto. Fish through the hole while it's down there and it
// takes the line, bursts out through the ice, and has to be fought: leaping and slamming down, spitting freezing water.
// Landed, it leaves the legendary pole strung with its whisker, which catches better; and the hole gives golden koi.
import { describe, expect, it } from "vitest";
import { loadArea } from "../src/areas/index.ts";
import { ICE_HOLE } from "../src/areas/grotto.ts";
import { GREAT_KOI, WHISKER_ROD } from "../src/data/hollow.ts";
import { CATCH_ODDS, CURIO_IDS, FISH, LEGENDARY_CATCH_ODDS } from "../src/data/items.ts";
import { FISHING } from "../src/data/player.ts";
import { T, Tile } from "../src/data/world.ts";
import { bossBar } from "../src/game/bossbar.ts";
import { spentCurios } from "../src/game/curios.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { greatKoiBeaten, greatKoiOut, greatKoiSystem } from "../src/game/greatkoi.ts";
import { LAIRS } from "../src/game/lairs.ts";
import { resetGame } from "../src/game/reset.ts";
import { spawnEnemy } from "../src/game/spawn.ts";
import { enterArea } from "../src/game/travel.ts";
import { makeItem } from "../src/items/items.ts";
import { deathSystem, spawnerSystem } from "../src/systems/enemies.ts";
import { step } from "../src/systems/index.ts";

const DT = 1 / 60;
const HOLE = { x: ICE_HOLE.x * T, y: ICE_HOLE.y * T };

async function atTheHole(rod = makeItem("rod")): Promise<Game> {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  enterArea(g, await loadArea("grotto"), "hollow");
  g.inventory.reset([rod]);
  Object.assign(g.world.need(g.player, "transform"), { x: HOLE.x - 2 * T, y: HOLE.y });
  return g;
}
/** A bite on the line at (x, y), struck: what came up (the new thing in the bag, if anything)? */
function strike(g: Game, at = HOLE, roll = 0.99) {
  const a = g.world.need(g.player, "actions"), before = new Set(g.inventory.grid.map(e => e.item.id));
  a.fishing = { phase: "bite", x: at.x, y: at.y, t: 0, biteAt: 0, basin: false };
  a.cooldown = 0;
  const next = g.rng.next;
  g.rng.next = () => roll;
  g.input.attackPressed = true;
  step(g, DT);
  g.rng.next = next;
  return g.inventory.grid.map(e => e.item).find(it => !before.has(it.id));
}
/** Somewhere to fish that isn't the hole: the open water of a pond in the Witchwood. */
async function pondside(rod: ReturnType<typeof makeItem>) {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  g.inventory.reset([rod]);
  const { tiles } = g.map;
  for (let y = 1; y < tiles.length - 1; y++) for (let x = 2; x < tiles[0]!.length - 1; x++)
    if (tiles[y]![x] === Tile.Water && tiles[y]![x - 2] === Tile.Grass) { Object.assign(g.world.need(g.player, "transform"), { x: (x - 2) * T, y: y * T }); return { g, water: { x: x * T, y: y * T } }; }
  throw new Error("no pond");
}
const koiOf = (g: Game) => g.world.query("koi", "transform", "health").at(0);
/** Beat it, and let it fall. */
function land(g: Game) {
  koiOf(g)![1].health.hp = 0;
  deathSystem(g);
}

describe("the Great Koi", () => {
  it("takes the line through the hole in the ice, and bursts out: no fish to land, and everything else scatters", async () => {
    const g = await atTheHole(), toasts: string[] = [];
    g.events.on("toast", ({ text }) => toasts.push(text));
    for (let i = 0; i < 6; i++) spawnEnemy(g, 40);
    expect(greatKoiOut(g)).toBeNull();
    expect(strike(g)).toBeUndefined();
    const koi = koiOf(g);
    expect(koi).toBeDefined();
    expect(koi![1].transform).toEqual(HOLE);
    expect(g.world.query("enemy").map(([e]) => e)).toEqual([koi![0]]);
    expect(toasts).toEqual(expect.arrayContaining([GREAT_KOI.say.bite, GREAT_KOI.say.out]));
    expect(bossBar(g)).toMatchObject({ name: GREAT_KOI.name, title: GREAT_KOI.title });
    // Only ever one of it.
    strike(g);
    expect(g.world.query("koi")).toHaveLength(1);
  });

  it("isn't on the line anywhere but the hole", async () => {
    const { g, water } = await pondside(makeItem("rod"));
    expect(strike(g, water)?.type).toBe("fish");
    expect(greatKoiOut(g)).toBeNull();
  });

  it("leaps at him and slams down where it lands", async () => {
    const g = await atTheHole();
    strike(g);
    const [, { transform: k, koi }] = koiOf(g)!, me = g.world.need(g.player, "transform"), health = g.world.need(g.player, "health");
    Object.assign(me, { x: k.x - 24, y: k.y });               // west, out on the ice
    koi.timer = 0; koi.spit = 99;
    greatKoiSystem(g, DT);
    expect(koi.hop).toBeGreaterThan(0);
    expect(koi.dx).toBeCloseTo(-1);
    const hp0 = health.hp;
    for (let i = 0; i < 60 && koi.hop > 0; i++) greatKoiSystem(g, DT);
    expect(koi.hop).toBe(0);
    expect(Math.hypot(me.x - k.x, me.y - k.y)).toBeLessThan(GREAT_KOI.slam);
    expect(health.hp).toBe(hp0 - GREAT_KOI.damage);
  });

  it("draws breath and spits a fan of freezing water at him", async () => {
    const g = await atTheHole();
    strike(g);
    const [, { koi }] = koiOf(g)!;
    koi.spit = 0; koi.timer = 99;
    greatKoiSystem(g, DT);
    expect(koi.wind).toBeGreaterThan(0);
    expect(g.world.query("bolt")).toHaveLength(0);
    greatKoiSystem(g, GREAT_KOI.spit.wind);
    const bolts = g.world.query("bolt");
    expect(bolts).toHaveLength(GREAT_KOI.spit.fan[0]);
    expect(bolts.every(([, c]) => c.bolt.kind === "frost")).toBe(true);
  });

  it("has the grotto to itself: nothing else comes in, before it's out, while it's out, or after it's landed", async () => {
    const g = await atTheHole(), quiet = () => { for (let i = 0; i < 20; i++) { g.spawnTimer = 0; spawnerSystem(g, 1); } };
    quiet();
    expect(g.world.count("enemy")).toBe(0);
    strike(g);
    quiet();
    expect(g.world.count("enemy")).toBe(1);
    land(g);
    quiet();
    expect(g.world.count("enemy")).toBe(0);
  });

  it("landed, leaves the legendary pole (for good: it doesn't fade), and the hole gives golden koi; a new run puts it back", async () => {
    const g = await atTheHole();
    strike(g);
    const potions = g.world.query("pickup").filter(([, c]) => c.pickup.kind === "potion").length;
    land(g);
    expect(greatKoiBeaten(g)).toBe(true);
    expect(greatKoiOut(g)).toBeNull();
    const [rodE, { pickup }] = g.world.query("pickup").find(([, c]) => c.pickup.kind === "loot" && c.pickup.item.type === "rod")!;
    if (pickup.kind !== "loot") throw new Error("no rod");
    expect(pickup.item).toMatchObject({ type: "rod", rarity: "legendary", name: WHISKER_ROD[3] });
    expect(pickup.item.note).toBeTruthy();
    expect(g.world.has(rodE, "despawn")).toBe(false);
    expect(g.world.query("pickup").filter(([, c]) => c.pickup.kind === "potion").length - potions).toBe(GREAT_KOI.potions);
    g.hitstop = 0;                                           // the world moving again, after the victory's dead stop
    expect(strike(g)?.name).toBe(FISH.rare.name);
    expect(greatKoiOut(g)).toBeNull();
    resetGame(g);
    setState(g, "play");
    enterArea(g, await loadArea("grotto"), "hollow");
    g.inventory.reset([makeItem("rod")]);
    Object.assign(g.world.need(g.player, "transform"), { x: HOLE.x - 2 * T, y: HOLE.y });
    strike(g);
    expect(greatKoiOut(g)).not.toBeNull();
  });
});

describe("the legendary pole", () => {
  const rod = () => { const r = makeItem(...WHISKER_ROD); return r; };

  it("lands golden koi far more often", async () => {
    const roll = (CATCH_ODDS.rare + LEGENDARY_CATCH_ODDS.rare) / 2;   // silver with an old pole, golden with this one
    const old = await pondside(makeItem("rod")), great = await pondside(rod());
    for (const { g } of [old, great]) for (const id of CURIO_IDS) spentCurios(g).add(id);   // koi only: no curiosity on the line
    expect(strike(old.g, old.water, roll)?.name).toBe(FISH.magic.name);
    expect(strike(great.g, great.water, roll)?.name).toBe(FISH.rare.name);
  });

  it("gets bites twice as quick", async () => {
    const { g, water } = await pondside(rod()), a = g.world.need(g.player, "actions");
    g.rng.next = () => 1;
    a.fishing = { phase: "cast", x: water.x, y: water.y, t: FISHING.castTime, biteAt: 0, basin: false };
    step(g, DT);
    expect(a.fishing?.biteAt).toBeCloseTo((FISHING.biteMin + FISHING.biteRange) * LEGENDARY_CATCH_ODDS.bite);
  });
});

describe("coming to the Great Koi ready, to playtest (?boss=koi)", () => {
  it("in the grotto, it's hooked and out on the ice, and he's a few steps south of the hole, clear of it", async () => {
    const g = createGame();
    resetGame(g);
    setState(g, "play");
    const lair = LAIRS.koi;
    enterArea(g, await loadArea(lair.area), lair.entry);
    const at = lair.stage(g), koi = greatKoiOut(g);
    expect(koi).not.toBeNull();
    const k = g.world.need(koi!, "transform");
    expect(at.y - k.y).toBeGreaterThanOrEqual(4 * T);
    expect(g.map.tiles[Math.floor((at.y + 4) / T)]![Math.floor((at.x + 4) / T)]).toBe(Tile.Ice);
  });
});
