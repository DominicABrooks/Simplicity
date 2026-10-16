// Rime, under the ice in the middle of the Frozen Hollow's lake: out of it as the hero steps onto her runes, a Frost
// mage with wider novas and faster bolts, frost setting under his feet; once beaten, beaten for the run, her circlet
// left behind and the lake thawed in a ring round where she stood. And the hunter's longbow, in his doorway.
import { describe, expect, it } from "vitest";
import { loadArea } from "../src/areas/index.ts";
import { RIME_AT } from "../src/areas/hollow.ts";
import { SPELLS } from "../src/data/enemies.ts";
import { HUNTERS_LONGBOW, RIME, RIME_CIRCLET, RIME_FALLS, RIME_FIGHT, RIME_LAST_WORDS, RIME_READY } from "../src/data/hollow.ts";
import type { KitPiece } from "../src/data/items.ts";
import { LAIRS } from "../src/game/lairs.ts";
import { makeItem } from "../src/items/items.ts";
import { T, Tile } from "../src/data/world.ts";
import { bossBar } from "../src/game/bossbar.ts";
import { beaten, bossSystem, bossWaiting } from "../src/game/bosses.ts";
import { victorySystem } from "../src/game/victory.ts";
import { VICTORY } from "../src/data/victory.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { bowSpot, hunterHutSystem, tookBow } from "../src/game/hunterhut.ts";
import { resetGame } from "../src/game/reset.ts";
import { spawnEnemy } from "../src/game/spawn.ts";
import { inThaw, rimeFight, rimeFightSystem } from "../src/game/rimefight.ts";
import { talking } from "../src/game/talk.ts";
import { hitEnemy } from "../src/game/combat.ts";
import { enterArea } from "../src/game/travel.ts";
import { deathSystem, spawnerSystem } from "../src/systems/enemies.ts";
import { mageSystem, novaRadius } from "../src/systems/mage.ts";
import { pickupSystem } from "../src/systems/pickups.ts";

const DT = 1 / 60;

async function inHollow(): Promise<Game> {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  enterArea(g, await loadArea("hollow"), "stone");
  for (const [e] of g.world.query("enemy")) g.world.destroy(e);
  return g;
}
const rimeOf = (g: Game) => g.world.query("renderable", "mage", "health", "transform").find(([, c]) => c.renderable.kind === "rime");
/** Stand him `tiles` south of the middle of her stage, and let a frame of her fight go by. */
function standOff(g: Game, tiles: number) {
  Object.assign(g.world.need(g.player, "transform"), { x: RIME_AT.x, y: RIME_AT.y + tiles * T });
  rimeFightSystem(g, DT);
  return rimeOf(g);
}

describe("Rime", () => {
  it("waits under the ice until he steps in among her pillars; then the ice shuts him in, and he can't leave", async () => {
    const g = await inHollow(), toasts: string[] = [];
    g.events.on("toast", ({ text }) => toasts.push(text));
    expect(standOff(g, 6)).toBeUndefined();
    expect(rimeFight(g)).toBeNull();
    standOff(g, 4);
    expect(rimeFight(g)).not.toBeNull();
    expect(toasts).toEqual(expect.arrayContaining([RIME_FIGHT.say.shut, RIME_FIGHT.say.rise]));
    const me = g.world.need(g.player, "transform");
    Object.assign(me, { x: RIME_AT.x + 12 * T, y: RIME_AT.y });         // out through where the way in was
    rimeFightSystem(g, DT);
    expect(Math.hypot(me.x - RIME_AT.x, me.y - RIME_AT.y)).toBeCloseTo(RIME_FIGHT.keepIn);
    // And everything the frost does, it does inside.
    rimeFight(g)!.nextPatches = 0;
    rimeFightSystem(g, DT);
    for (const pa of rimeFight(g)!.patches) expect(Math.hypot(pa.x - RIME_AT.x, pa.y - RIME_AT.y)).toBeLessThanOrEqual(RIME_FIGHT.keepIn + 0.001);
  });

  it("rises in the middle: a Frost mage, tougher than any, with a boss bar", async () => {
    const g = await inHollow();
    expect(bossWaiting(g)).toBe("rime");
    expect(standOff(g, 6)).toBeUndefined();
    const [, c] = standOff(g, 3)!;
    expect(c.mage.school).toBe("frost");
    expect(c.health.maxHp).toBe(RIME.hp);
    expect(c.transform).toEqual({ x: RIME_AT.x, y: RIME_AT.y });
    expect(bossBar(g)).toMatchObject({ name: RIME.name, title: RIME.title });
  });

  it("has the lake to herself: the slimes and mages scatter as she rises, and none turn up while she stands", async () => {
    const g = await inHollow();
    for (let i = 0; i < 10; i++) spawnEnemy(g, 40);
    const [e] = standOff(g, 3)!;
    expect(g.world.query("enemy").map(([id]) => id)).toEqual([e]);
    for (let i = 0; i < 20; i++) { g.spawnTimer = 0; spawnerSystem(g, 1); }
    expect(g.world.count("enemy")).toBe(1);
  });

  it("novas wider than any Frost mage, and throws faster bolts", async () => {
    const g = await inHollow(), [, { mage, transform }] = standOff(g, 3)!;
    expect(novaRadius(mage)).toBeCloseTo(SPELLS.nova.radius! * RIME.nova);
    // Out past an ordinary mage's nova, but inside hers: she novas.
    Object.assign(g.world.need(g.player, "transform"), { x: transform.x, y: transform.y + SPELLS.nova.radius! + 8 });
    mage.specialCD = 0;
    mageSystem(g, DT);
    expect(mage.spell).toBe("nova");
    // It charges slower than an ordinary mage's, time to see it coming and get clear; and comes round again later.
    for (let t = DT; t < SPELLS.nova.charge * 1.5; t += DT) mageSystem(g, DT);
    expect(mage.casting).toBe(true);
    for (let t = 0; t < SPELLS.nova.charge * RIME.novaCharge && mage.casting; t += DT) mageSystem(g, DT);
    expect(mage.casting).toBe(false);
    expect(mage.specialCD).toBeCloseTo(SPELLS.nova.cooldown! * RIME.novaCooldown, 0);
    // A bolt: faster than a Frost mage's.
    Object.assign(mage, { casting: true, castT: SPELLS.frost.charge, spell: "frost", melee: false });
    mageSystem(g, DT);
    const [, { bolt }] = g.world.query("bolt").at(-1)!;
    expect(Math.hypot(bolt.vx, bolt.vy)).toBeCloseTo(SPELLS.frost.speed! * RIME.bolt);
  });

  it("sets frost under his feet that freezes him solid, unless he dashes clear", async () => {
    const g = await inHollow();
    standOff(g, 3);
    const f = rimeFight(g)!, status = g.world.need(g.player, "status"), motion = g.world.need(g.player, "motion");
    f.nextPatches = 0;
    rimeFightSystem(g, DT);
    expect(f.patches.length).toBeGreaterThan(0);
    const under = f.patches[0]!, me = g.world.need(g.player, "transform");
    expect({ x: under.x, y: under.y }).toEqual({ x: me.x, y: me.y });
    f.nextPatches = 99;
    for (let t = 0; t < RIME_FIGHT.patch.warn - 0.1; t += DT) rimeFightSystem(g, DT);
    expect(status.frozen).toBe(0);
    rimeFightSystem(g, 0.2);
    expect(status.frozen).toBe(RIME_FIGHT.patch.freeze);

    status.frozen = 0;
    f.patches = [{ x: me.x, y: me.y, t: 0, hit: false }];
    motion.dash = 0.2;
    rimeFightSystem(g, RIME_FIGHT.patch.warn + 0.01);
    expect(status.frozen).toBe(0);
  });

  it("once beaten, stays beaten for the run: her circlet, her last words, and the lake thawed round where she fell", async () => {
    const g = await inHollow(), toasts: string[] = [];
    g.events.on("toast", ({ text }) => toasts.push(text));
    const [e, { health, transform }] = standOff(g, 3)!;
    const at = { ...transform };
    health.hp = 0;
    bossSystem(g, DT);
    deathSystem(g);
    rimeFightSystem(g, DT);
    expect(beaten(g, "rime")).toBe(true);
    expect(g.world.isAlive(e)).toBe(false);
    expect(rimeFight(g)).toBeNull();
    expect(toasts).toEqual(expect.arrayContaining([...RIME_FALLS, RIME_FIGHT.say.thaw]));
    victorySystem(g, VICTORY.last);                          // the victory celebrated: then the last words
    expect(talking(g)?.lines).toEqual(RIME_LAST_WORDS);
    expect(g.world.query("pickup").some(([, { pickup }]) => pickup.kind === "loot" && pickup.item.name === RIME_CIRCLET[3])).toBe(true);

    // The thaw: every ice tile in the ring is open water now; the ice inside and outside it holds.
    const cx = at.x / T + 0.5, cy = at.y / T + 0.5, lake = g.area.layout.map.tiles;
    let thawed = 0;
    for (let y = 0; y < lake.length; y++) for (let x = 0; x < lake[0]!.length; x++) {
      if (lake[y]![x] !== Tile.Ice) continue;
      expect(g.map.tiles[y]![x]).toBe(inThaw(x, y, cx, cy) ? Tile.Water : Tile.Ice);
      if (inThaw(x, y, cx, cy)) thawed++;
    }
    expect(thawed).toBeGreaterThan(20);
    expect(g.map.tiles[Math.floor(cy)]![Math.floor(cx)]).toBe(Tile.Ice);   // where she stood

    // Gone, and thawed, the next time he comes; back, and frozen, in a new run.
    enterArea(g, await loadArea("hollow"), "stone");
    expect(standOff(g, 3)).toBeUndefined();
    expect(g.map.tiles.flat().filter(t => t === Tile.Water).length).toBe(thawed);   // the thawed ring is the lake's only open water
    resetGame(g);
    setState(g, "play");
    enterArea(g, await loadArea("hollow"), "stone");
    expect(standOff(g, 3)).toBeDefined();
    expect(g.map).toBe(g.area.layout.map);
  });
});

describe("Rime's icicles and her ice block", () => {
  /** Her fight, risen, with the hero standing `tiles` south of the middle. */
  async function fighting(tiles = 3) {
    const g = await inHollow(), [e] = standOff(g, tiles)!;
    return { g, e, f: rimeFight(g)! };
  }
  const icicles = (g: Game) => g.world.query("bolt", "transform").filter(([, c]) => c.bolt.kind === "icicle");

  it("stands still and draws the cold in, then throws rings of icicles, each ring turned from the last", async () => {
    const { g, e, f } = await fighting();
    f.nextVolley = 0;
    f.nextPattern = "rings";
    rimeFightSystem(g, DT);
    expect(f.volley?.pattern).toBe("rings");
    expect(g.world.need(e, "mage").held).toBe(true);        // winding up: still
    expect(icicles(g)).toHaveLength(0);
    rimeFightSystem(g, RIME_FIGHT.volley.wind);
    rimeFightSystem(g, DT);
    const first = icicles(g), V = RIME_FIGHT.volley;
    expect(first).toHaveLength(V.rings.count[0]);
    // Flying straight out from her, at the icicles' speed.
    const angles = first.map(([, c]) => Math.atan2(c.bolt.vy, c.bolt.vx));
    for (const [, c] of first) expect(Math.hypot(c.bolt.vx, c.bolt.vy)).toBeCloseTo(V.speed);
    rimeFightSystem(g, V.rings.gap + 0.001);
    const second = icicles(g).slice(first.length).map(([, c]) => Math.atan2(c.bolt.vy, c.bolt.vx));
    expect(second).toHaveLength(V.rings.count[0]);
    const step = (Math.PI * 2) / V.rings.count[0], near = (a: number) => Math.min(...angles.map(b => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))));
    for (const a of second) expect(near(a)).toBeCloseTo(step / 2);   // into the last ring's gaps
    for (let i = 0; i < 10; i++) rimeFightSystem(g, V.rings.gap + 0.001);
    expect(f.volley).toBeNull();
    expect(f.nextPattern).toBe("spiral");
    expect(g.world.need(e, "mage").held).toBe(false);
  });

  it("throws a spiral too, its arms turning as they fire; and the icicles shatter on the wall", async () => {
    const { g, f } = await fighting();
    f.nextVolley = 0;
    f.nextPattern = "spiral";
    rimeFightSystem(g, DT);
    rimeFightSystem(g, RIME_FIGHT.volley.wind);
    const S = RIME_FIGHT.volley.spiral;
    for (let i = 0; i < S.shots[0]; i++) rimeFightSystem(g, S.gap + 0.001);
    expect(icicles(g)).toHaveLength(S.arms[0] * S.shots[0]);
    const [, last] = icicles(g).at(-1)!, [, first] = icicles(g)[0]!;
    const turned = Math.atan2(last.bolt.vy, last.bolt.vx) - Math.atan2(first.bolt.vy, first.bolt.vx);
    expect(Math.abs(Math.atan2(Math.sin(turned), Math.cos(turned)))).toBeGreaterThan(0.1);
    // One out past the wall goes.
    const [, out] = icicles(g)[0]!;
    Object.assign(out.transform, { x: f.x + RIME_FIGHT.keepIn + 10, y: f.y });
    rimeFightSystem(g, DT);
    expect(out.bolt.life).toBe(0);
  });

  it("seals herself in ice when he carves too much off her up close (arrows don't count), and nothing hurts her in it", async () => {
    const { g, e, f } = await fighting(), hp = g.world.need(e, "health"), enemy = g.world.need(e, "enemy");
    g.rng.next = () => 0.5;                                   // no crits
    for (let i = 0; i < 6; i++) hitEnemy(g, e, 2, false);     // shot, from range
    rimeFightSystem(g, DT);
    expect(f.block).toBeNull();
    for (let i = 0; i < Math.ceil(RIME_FIGHT.block.melee / 2) + 1; i++) hitEnemy(g, e, 2);   // up close, a little past it
    rimeFightSystem(g, DT);
    expect(f.block).not.toBeNull();
    expect(enemy.warded).toBe(true);
    expect(g.world.need(e, "mage").held).toBe(true);
    const before = hp.hp;
    expect(hitEnemy(g, e, 5)).toBe(0);
    expect(hp.hp).toBe(before);
  });

  it("a few blows spread out don't do it: the melee wears off", async () => {
    const { g, e, f } = await fighting();
    g.rng.next = () => 0.5;
    for (let i = 0; i < 8; i++) { hitEnemy(g, e, 2); for (let t = 0; t < 2; t += 0.1) rimeFightSystem(g, 0.1); }
    expect(f.block).toBeNull();
  });

  it("fills the floor with falling icicles while she's in the block, then bursts out freezing anyone at her side", async () => {
    const { g, e, f } = await fighting(), B = RIME_FIGHT.block;
    g.world.need(e, "enemy").melee = B.melee + 1;
    rimeFightSystem(g, DT);
    expect(f.block).not.toBeNull();
    f.nextPatches = 99;
    const me = g.world.need(g.player, "transform"), health = g.world.need(g.player, "health"), status = g.world.need(g.player, "status");
    for (let t = 0; t < 2; t += 0.05) rimeFightSystem(g, 0.05);
    expect(f.falls.length).toBeGreaterThan(B.falls.count);
    for (const fa of f.falls) expect(Math.hypot(fa.x - f.x, fa.y - f.y)).toBeLessThanOrEqual(RIME_FIGHT.keepIn);
    // One right on him: it hurts as it lands, unless he dashes.
    status.hurt = 0;
    const hp0 = health.hp;
    f.falls = [{ x: me.x, y: me.y, t: B.falls.warn - 0.01, hit: false }];
    rimeFightSystem(g, 0.02);
    expect(health.hp).toBe(hp0 - B.falls.damage);
    // Out she bursts, freezing him up against her.
    const her = g.world.need(e, "transform");
    Object.assign(me, { x: her.x + 10, y: her.y });
    status.frozen = 0; f.falls = [];
    rimeFightSystem(g, B.hold);
    expect(f.block).toBeNull();
    expect(g.world.need(e, "enemy").warded).toBe(false);
    expect(status.frozen).toBe(B.burst.freeze);
    // And not again straight away.
    g.world.need(e, "enemy").melee = B.melee * 2;
    rimeFightSystem(g, DT);
    expect(f.block).toBeNull();
  });
});

describe("Rime's last stand", () => {
  it("won't fall to the first blow that should finish her: keeps her health, blinks to the middle and seals herself in", async () => {
    const g = await inHollow(), [e, { health, transform }] = standOff(g, 3)!, f = rimeFight(g)!, enemy = g.world.need(e, "enemy");
    g.rng.next = () => 0.5;                                   // no crits
    Object.assign(transform, { x: f.x + 20, y: f.y - 10 });
    health.hp = 3;
    expect(hitEnemy(g, e, 5)).toBe(0);
    expect(health.hp).toBe(3);
    bossSystem(g, DT);
    deathSystem(g);
    rimeFightSystem(g, DT);
    expect(g.world.isAlive(e)).toBe(true);
    expect(beaten(g, "rime")).toBe(false);
    expect(f.stand).not.toBeNull();
    expect({ x: transform.x, y: transform.y }).toEqual({ x: f.x, y: f.y });
    expect(enemy.warded).toBe(true);
    expect(hitEnemy(g, e, 5)).toBe(0);                       // nothing gets through the ice
    expect(health.hp).toBe(3);
  });

  it("pours icicles out for 15 seconds, a spiral and rings through it, and no frost creeping", async () => {
    const g = await inHollow(), [e, { health }] = standOff(g, 3)!, f = rimeFight(g)!, S = RIME_FIGHT.lastStand;
    g.rng.next = () => 0.5;
    health.hp = 1;
    hitEnemy(g, e, 5);
    rimeFightSystem(g, DT);
    let fired = 0;
    const seen = new Set<number>();
    for (let t = 0; t < S.hold - 0.5; t += 0.05) {
      rimeFightSystem(g, 0.05);
      for (const [b, { bolt }] of g.world.query("bolt")) if (bolt.kind === "icicle" && !seen.has(b)) { seen.add(b); fired++; }
      for (const [b] of g.world.query("bolt")) g.world.destroy(b);   // out of the way, counted
    }
    const spiral = Math.floor((S.hold - 1.5) / S.spiral.gap) * S.spiral.arms, rings = Math.floor((S.hold - 2.5) / S.rings.every) * S.rings.count;
    expect(fired).toBeGreaterThanOrEqual(spiral + rings - 20);
    expect(f.patches).toHaveLength(0);
    expect(f.falls.length).toBeGreaterThan(0);
    expect(f.stand).not.toBeNull();
  });

  it("comes out after it, spent, still with the health she had; and the next blow that should finish her does", async () => {
    const g = await inHollow(), [e, { health }] = standOff(g, 3)!, f = rimeFight(g)!, enemy = g.world.need(e, "enemy");
    g.rng.next = () => 0.5;
    health.hp = 2;
    hitEnemy(g, e, 5);
    rimeFightSystem(g, DT);
    rimeFightSystem(g, RIME_FIGHT.lastStand.hold);
    expect(f.stand).toBeNull();
    expect(enemy.lastStand).toBe("spent");
    expect(enemy.warded).toBe(false);
    expect(g.world.need(e, "mage").held).toBe(false);
    expect(health.hp).toBe(2);
    hitEnemy(g, e, 5);
    expect(health.hp).toBeLessThanOrEqual(0);
    bossSystem(g, DT);
    deathSystem(g);
    expect(beaten(g, "rime")).toBe(true);
    // The Hollow stays quiet after her, until he leaves and comes back.
    for (let i = 0; i < 20; i++) { g.spawnTimer = 0; spawnerSystem(g, 1); }
    expect(g.world.count("enemy")).toBe(0);
    enterArea(g, await loadArea("hollow"), "stone");
    expect(g.world.count("enemy")).toBeGreaterThan(0);
  });
});

describe("coming to Rime ready, to playtest (?boss=rime)", () => {
  // Each piece as GEAR.md has it at Rime: about level 7, the bow in hand and Cinder's Brand in the bag, two or three
  // Cinderward or Rimewake pieces, and the King's signet.
  const total = (p: KitPiece) => { const it = makeItem(...p), s: Record<string, number> = {}; for (const st of [it.base, it.mods]) for (const [k, v] of Object.entries(st)) s[k] = (s[k] ?? 0) + v!; return { name: it.name, slot: it.slot, ...s }; };

  it("is about level 7, in the pieces a player would have by then", () => {
    expect(RIME_READY.level).toBe(7);
    expect(RIME_READY.kit.map(total)).toEqual([
      { name: "Hunter's Longbow", slot: "weapon", damage: 1, crit: 2 },
      { name: "Ember Cowl", slot: "helm", life: 1 },
      { name: "Ashen Robe", slot: "armor", life: 2 },
      { name: "Icewalk Boots", slot: "boots", speed: 6, dash: 10 },
      { name: "Signet of Aurenmark", slot: "amulet", life: 1 },
    ]);
    expect(RIME_READY.bag.map(total)).toEqual([{ name: "Cinder's Brand", slot: "weapon", damage: 1, crit: 2 }]);
  });

  it("doesn't leave a second longbow in the hut when he's carrying one", async () => {
    const g = await inHollow();
    LAIRS.rime.stage(g);
    hunterHutSystem(g);
    expect(tookBow(g)).toBe(true);
    expect(g.world.query("pickup").some(([, { pickup }]) => pickup.kind === "loot" && pickup.item.name === HUNTERS_LONGBOW[3])).toBe(false);
  });
});

describe("the hunter's hut", () => {
  it("has his longbow in the doorway, once a run, and it doesn't fade", async () => {
    const g = await inHollow();
    hunterHutSystem(g);
    const bows = () => g.world.query("pickup", "transform").filter(([, { pickup }]) => pickup.kind === "loot" && pickup.item.name === HUNTERS_LONGBOW[3]);
    expect(bows()).toHaveLength(1);
    const [bow, { transform }] = bows()[0]!, spot = bowSpot(g)!;
    expect(transform.x + T / 2).toBeCloseTo(spot.x);
    expect(g.world.has(bow, "despawn")).toBe(false);
    expect(g.map.tiles[Math.floor(spot.y / T)]![Math.floor(spot.x / T)]).not.toBe(Tile.Wall);

    Object.assign(g.world.need(g.player, "transform"), { x: transform.x, y: transform.y });
    pickupSystem(g);
    hunterHutSystem(g);
    expect(tookBow(g)).toBe(true);
    expect(g.inventory.grid.some(e => e.item.name === HUNTERS_LONGBOW[3])).toBe(true);

    enterArea(g, await loadArea("hollow"), "stone");
    hunterHutSystem(g);
    expect(bows()).toHaveLength(0);
    resetGame(g);
    enterArea(g, await loadArea("hollow"), "stone");
    hunterHutSystem(g);
    expect(bows()).toHaveLength(1);
  });
});
