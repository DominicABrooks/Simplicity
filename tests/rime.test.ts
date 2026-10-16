// Rime, under the ice in the middle of the Frozen Hollow's lake: out of it as the hero steps onto her runes, a Frost
// mage with wider novas and faster bolts, frost setting under his feet; once beaten, beaten for the run, her circlet
// left behind and the lake thawed in a ring round where she stood. And the hunter's longbow, in his doorway.
import { describe, expect, it } from "vitest";
import { loadArea } from "../src/areas/index.ts";
import { RIME_AT } from "../src/areas/hollow.ts";
import { SPELLS } from "../src/data/enemies.ts";
import { HUNTERS_LONGBOW, RIME, RIME_CIRCLET, RIME_FALLS, RIME_FIGHT, RIME_LAST_WORDS } from "../src/data/hollow.ts";
import { T, Tile } from "../src/data/world.ts";
import { bossBar } from "../src/game/bossbar.ts";
import { beaten, bossSystem, bossWaiting } from "../src/game/bosses.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { bowSpot, hunterHutSystem, tookBow } from "../src/game/hunterhut.ts";
import { resetGame } from "../src/game/reset.ts";
import { inThaw, rimeFight, rimeFightSystem } from "../src/game/rimefight.ts";
import { talking } from "../src/game/talk.ts";
import { enterArea } from "../src/game/travel.ts";
import { deathSystem } from "../src/systems/enemies.ts";
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
  it("waits under the ice until he steps onto her runes", async () => {
    const g = await inHollow();
    expect(bossWaiting(g)).toBe("rime");
    expect(standOff(g, 6)).toBeUndefined();
    const [, c] = standOff(g, 3)!;
    expect(c.mage.school).toBe("frost");
    expect(c.health.maxHp).toBe(RIME.hp);
    expect(c.transform).toEqual({ x: RIME_AT.x, y: RIME_AT.y });
    expect(bossBar(g)).toMatchObject({ name: RIME.name, title: RIME.title });
  });

  it("novas wider than any Frost mage, and throws faster bolts", async () => {
    const g = await inHollow(), [, { mage, transform }] = standOff(g, 3)!;
    expect(novaRadius(mage)).toBeCloseTo(SPELLS.nova.radius! * RIME.nova);
    // Out past an ordinary mage's nova, but inside hers: she novas.
    Object.assign(g.world.need(g.player, "transform"), { x: transform.x, y: transform.y + SPELLS.nova.radius! + 8 });
    mage.specialCD = 0;
    mageSystem(g, DT);
    expect(mage.spell).toBe("nova");
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
    expect(g.map.tiles.flat().filter(t => t === Tile.Water).length).toBeGreaterThan(thawed);
    resetGame(g);
    setState(g, "play");
    enterArea(g, await loadArea("hollow"), "stone");
    expect(standOff(g, 3)).toBeDefined();
    expect(g.map).toBe(g.area.layout.map);
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
