// The Undercroft under St Mary's: the Rusted Key opens the low door at the foot of the tower (and it stays open),
// and down below, the Mysterious Stone goes home to the gap in the ring of old stones, which wakes.
import { describe, expect, it } from "vitest";
import { area as capital } from "../src/areas/capital.ts";
import { area as castle } from "../src/areas/castle.ts";
import { area as kingsroad } from "../src/areas/kingsroad.ts";
import { loadArea } from "../src/areas/index.ts";
import { CHAMBER, CHAMBER_SAYS, PENDANT, UNDERCROFT, UNDERCROFT_SAYS } from "../src/data/undercroft.ts";
import { carryingCurio, spentCurios } from "../src/game/curios.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { setCensus } from "../src/game/townsfolk.ts";
import { arrive, enterArea } from "../src/game/travel.ts";
import { lastStone, stoneSystem, touchStone, wakeOnStone } from "../src/game/stones.ts";
import { chargePendant, pendantCharge, pendantCharged } from "../src/game/pendant.ts";
import { sealOf, sealOpen, socketOf } from "../src/game/undercroft.ts";
import { crackAt, nestAt, stitchesMended } from "../src/game/sealchamber.ts";
import { cutscene, holdInput, skipCutscene, updateCutscene } from "../src/game/cutscene.ts";
import { CLUES } from "../src/data/clues.ts";
import { makeCurio } from "../src/items/items.ts";
import { step } from "../src/systems/index.ts";
import { FEET, blocked } from "../src/world/collision.ts";
import { layoutOf } from "../src/world/layouts.ts";

setCensus((await import("../src/world/residents.ts")).residentsOf({ capital: capital.build().props, castle: castle.build().props, kingsroad: kingsroad.build().props }));
const DT = 1 / 30;
const hero = (g: Game) => g.world.need(g.player, "transform");

async function at(area: string, entry: string, curios: ("key" | "stone")[] = []): Promise<{ g: Game; toasts: string[] }> {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  for (const c of curios) g.inventory.add(makeCurio(c));
  enterArea(g, await loadArea(area), entry);
  const toasts: string[] = [];
  g.events.on("toast", t => toasts.push(t.text));
  return { g, toasts };
}

/** Walk him up to the door down (the exit to the Undercroft), from the churchyard side, and take a step. */
function tryTheDoor(g: Game) {
  const door = g.area.layout.exits.find(x => x.to.area === "undercroft")!;
  Object.assign(hero(g), { x: door.rect.x + door.rect.w / 2 - 4, y: door.rect.y + door.rect.h - 3 });
  step(g, DT);
}

describe("the low door at the foot of St Mary's tower", () => {
  it("is locked to anyone without the key: he's put back a step and told so, and nowhere to go", async () => {
    const { g, toasts } = await at("capital", "southgate");
    tryTheDoor(g);
    expect(g.state).toBe("play");
    expect(toasts).toContain(UNDERCROFT_SAYS.locked);
    expect(blocked(g.map, hero(g).x, hero(g).y, true)).toBe(false);
  });

  it("opens to the Rusted Key, which stays in the lock: the door's open the rest of the run, and the key's off the line", async () => {
    const { g, toasts } = await at("capital", "southgate", ["key"]);
    tryTheDoor(g);
    expect(g.state).toBe("travel");
    expect(g.travel).toEqual({ area: "undercroft", entry: "steps" });
    expect(toasts).toContain(UNDERCROFT_SAYS.unlock);
    expect(carryingCurio(g, "key")).toBe(false);
    expect(spentCurios(g).has("key")).toBe(true);
    arrive(g, await loadArea("undercroft"));
    // Back up, and down again with no key at all.
    const up = g.area.layout.exits[0]!;
    Object.assign(hero(g), { x: up.rect.x + 2, y: up.rect.y });
    step(g, DT);
    expect(g.travel).toEqual({ area: "capital", entry: "undercroft" });
    arrive(g, await loadArea("capital"));
    expect(blocked(g.map, hero(g).x, hero(g).y, true)).toBe(false);
    step(g, DT);
    expect(g.state).toBe("play");                              // arriving outside isn't walking straight back in
    tryTheDoor(g);
    expect(g.state).toBe("travel");
  });
});

describe("the ring of old stones", () => {
  it("is down the steps, with room to walk from the door to the socket", async () => {
    const { g, toasts } = await at("undercroft", "steps");
    step(g, DT);
    expect(toasts).toContain(UNDERCROFT_SAYS.arrive);
    const map = layoutOf(g.area.def).map, s = socketOf(g)!;
    expect(blocked(map, hero(g).x, hero(g).y, true)).toBe(false);
    expect(blocked(map, s.x, s.y, true)).toBe(false);
    for (let y = hero(g).y; y > s.y + UNDERCROFT.reach; y -= 2) expect(blocked(map, s.x, y, true)).toBe(false);
  });

  it("takes the Mysterious Stone back into its socket: it wakes, heals him, and leaves him the Ringstone Pendant", async () => {
    const { g, toasts } = await at("undercroft", "steps", ["stone"]);
    g.world.need(g.player, "health").hp = 1;
    const s = socketOf(g)!;
    Object.assign(hero(g), { x: s.x, y: s.y + UNDERCROFT.hint - 4 });
    step(g, DT);
    expect(toasts).toContain(UNDERCROFT_SAYS.warm);
    expect(carryingCurio(g, "stone")).toBe(true);
    Object.assign(hero(g), { x: s.x, y: s.y + UNDERCROFT.reach - 2 });
    step(g, DT);
    expect(carryingCurio(g, "stone")).toBe(false);
    expect(spentCurios(g).has("stone")).toBe(true);
    for (const line of UNDERCROFT_SAYS.wake) expect(toasts).toContain(line);
    const health = g.world.need(g.player, "health");
    expect(health.hp).toBe(health.maxHp);
    const loot = g.world.query("pickup").map(([, c]) => c.pickup).filter(p => p.kind === "loot");
    expect(loot.map(p => p.kind === "loot" && p.item.name)).toContain(UNDERCROFT.reward.name);
    expect(g.world.query("renderable").filter(([, c]) => c.renderable.kind === "ringstone")).toHaveLength(1);
  });

  it("keeps the stone in the ring when he comes back, and only one", async () => {
    const { g } = await at("undercroft", "steps", ["stone"]);
    const s = socketOf(g)!;
    Object.assign(hero(g), { x: s.x, y: s.y + 4 });
    step(g, DT);
    enterArea(g, await loadArea("undercroft"), "steps");
    step(g, DT); step(g, DT);
    expect(g.world.query("renderable").filter(([, c]) => c.renderable.kind === "ringstone")).toHaveLength(1);
  });
});

describe("the little sealed door behind the ring", () => {
  it("can be walked up to round the ring, and says what it is once a run", async () => {
    const { g, toasts } = await at("undercroft", "steps");
    const seal = sealOf(g)!;
    expect(seal).not.toBeNull();
    expect(blocked(g.map, seal.x, seal.y, true)).toBe(false);
    expect(toasts).not.toContain(UNDERCROFT_SAYS.seal);
    Object.assign(hero(g), seal);
    step(g, DT);
    step(g, DT);
    expect(toasts.filter(t => t === UNDERCROFT_SAYS.seal)).toHaveLength(1);
  });
});

describe("the ring, woken", () => {
  /** Set the stone home: he's carrying it, and walks up to the socket. */
  async function woken() {
    const r = await at("undercroft", "steps", ["stone"]), s = socketOf(r.g)!;
    Object.assign(hero(r.g), { x: s.x, y: s.y + 4 });
    step(r.g, DT);
    return { ...r, s };
  }

  it("says what the ring was: the Vael's temple floor, where the eggs were laid and taken from", async () => {
    const { toasts } = await woken();
    expect(toasts.join(" ")).toMatch(/temple floor.*three eggs.*Aldric.*Hereward.*crack/s);
  });

  it("is an old stone now: a fall wakes him in the ring, whole, his level kept", async () => {
    const { g } = await woken();
    expect(lastStone(g)).toEqual({ area: "undercroft", entry: "ring", name: UNDERCROFT.stone.name });
    const wake = g.area.layout.entries.ring!;
    expect(blocked(g.map, wake.x, wake.y, true)).toBe(false);
    Object.assign(g.world.need(g.player, "hero"), { level: 5 });
    g.world.need(g.player, "health").hp = 0;
    setState(g, "dead");
    expect(wakeOnStone(g)).toBe(true);
    arrive(g, await loadArea("undercroft"));
    expect({ x: hero(g).x, y: hero(g).y }).toEqual(wake);
    expect(g.world.need(g.player, "hero").level).toBe(5);
  });

  it("is touched again when he comes back to it after touching another stone", async () => {
    const { g, toasts, s } = await woken();
    // He's touched the fountain stone since; then he walks up to the ring.
    touchStone(g, { area: "capital", entry: "stone", name: "The fountain stone" }, 0, 0, true);
    Object.assign(hero(g), { x: s.x, y: s.y + 4 });
    step(g, DT);
    expect(lastStone(g)?.entry).toBe("ring");
    expect(toasts).toContain(`${UNDERCROFT.stone.name} glows under your hand`);
  });

});

describe("the stone's clues", () => {
  it("one of them points to St Mary's, where it belongs", () => {
    expect(CLUES.stone.some(l => l.includes("St Mary's"))).toBe(true);
  });
});

/** The five old stones the pendant drinks from. */
const OLD_STONES = [
  { area: "witchwood", entry: "start", name: "The Ranger's stone" }, { area: "capital", entry: "stone", name: "The fountain stone" },
  { area: "ashwild", entry: "stone", name: "The ash stone" }, { area: "hollow", entry: "stone", name: "The hollow stone" },
  { area: "rift", entry: "stone", name: "The rift stone" },
];

/** He's woken the ring, picked the pendant up and put it on. */
async function wearing() {
  const r = await at("undercroft", "steps", ["stone"]), s = socketOf(r.g)!;
  Object.assign(hero(r.g), { x: s.x, y: s.y + 4 });
  step(r.g, DT);
  const [e, c] = r.g.world.query("pickup").find(([, c]) => c.pickup.kind === "loot" && c.pickup.item.name === UNDERCROFT.reward.name)!;
  if (c.pickup.kind !== "loot") throw new Error("no pendant");
  r.g.inventory.equip.amulet = c.pickup.item;
  r.g.world.destroy(e);
  return r;
}

describe("the Ringstone Pendant", () => {
  it("is legendary, and its note says it wants to drink from the old stones", async () => {
    const { g } = await wearing();
    const pendant = g.inventory.equip.amulet!;
    expect(pendant.rarity).toBe("legendary");
    expect(pendant.note).toBe(PENDANT.note(0));
    expect(pendant.note).toMatch(/drink from each/);
  });

  it("drinks from each old stone once, worn, till it's had all five and burns; its note says how far it's got", async () => {
    const { g, toasts } = await wearing();
    for (const [i, stone] of OLD_STONES.entries()) {
      chargePendant(g, stone);
      chargePendant(g, stone);
      expect(pendantCharge(g)).toBe(i + 1);
    }
    expect(pendantCharged(g)).toBe(true);
    expect(toasts).toContain(UNDERCROFT_SAYS.drinks("The fountain stone", 2));
    expect(toasts).toContain(UNDERCROFT_SAYS.charged);
    expect(g.inventory.equip.amulet!.note).toBe(PENDANT.note(5));
  });

  it("drinks when he touches a real old stone, but not from the bag", async () => {
    const { g } = await wearing();
    const pendant = g.inventory.equip.amulet!;
    g.inventory.equip.amulet = null;
    enterArea(g, await loadArea("capital"), "stone");
    const stone = g.area.layout.props.find(p => p.kind === "oldStone")!;
    if (stone.kind !== "oldStone") throw new Error();
    Object.assign(hero(g), { x: stone.x - 4, y: stone.y - 4 });
    stoneSystem(g);
    expect(pendantCharge(g)).toBe(0);
    g.inventory.equip.amulet = pendant;
    stoneSystem(g);                                         // still standing on it: it knows him; the pendant drinks
    expect(pendantCharge(g)).toBe(1);
  });
});

describe("the little door, opened", () => {
  /** Walk him north from in front of the door, as far as he can go: into the doorway. */
  function walkIn(g: Game) {
    const seal = sealOf(g)!;
    Object.assign(hero(g), seal);
    while (!blocked(g.map, hero(g).x, hero(g).y - 1, true) && hero(g).y > 0) hero(g).y -= 1;
    step(g, DT);
  }

  it("won't move without the pendant burning, and he's kept out", async () => {
    const { g, toasts } = await wearing();
    walkIn(g);
    expect(g.state).toBe("play");
    expect(toasts).toContain(UNDERCROFT_SAYS.sealShut);
    expect(sealOpen(g)).toBe(false);
  });

  it("can be reached: the doorway's within his walk", async () => {
    const { g } = await at("undercroft", "steps");
    const exit = g.area.layout.exits.find(x => x.sealed)!, seal = sealOf(g)!;
    Object.assign(hero(g), seal);
    while (!blocked(g.map, hero(g).x, hero(g).y - 1, true) && hero(g).y > 0) hero(g).y -= 1;
    expect(hero(g).y + FEET.y).toBeLessThan(exit.rect.y + exit.rect.h);
  });

  it("opens to the burning pendant (he's put back a step to see it), then lets him through into the chamber", async () => {
    const { g } = await wearing();
    for (const stone of OLD_STONES) chargePendant(g, stone);
    walkIn(g);
    expect(g.state).toBe("play");
    expect(sealOpen(g)).toBe(true);
    expect(g.world.query("renderable").filter(([, c]) => c.renderable.kind === "sealdoor")).toHaveLength(1);
    walkIn(g);
    expect(g.state).toBe("play");                           // still swinging open: he's kept back to watch it
    for (let t = 0; t < UNDERCROFT.swing + 0.1; t += DT) step(g, DT);
    walkIn(g);
    expect(g.state).toBe("travel");
    expect(g.travel).toEqual({ area: "sealchamber", entry: "door" });
  });
});

describe("the deep places behind the door", () => {
  it("has somewhere to come in, the nest to walk up to, and the way back out to the door behind the ring", async () => {
    const { g } = await at("sealchamber", "door");
    step(g, DT);
    expect(blocked(g.map, hero(g).x, hero(g).y, true)).toBe(false);
    const back = g.area.layout.exits[0]!;
    expect(back.to).toEqual({ area: "undercroft", entry: "seal" });
    const under = layoutOf(await loadArea("undercroft"));
    const seal = under.entries.seal!;
    expect(blocked(under.map, seal.x, seal.y, true)).toBe(false);
  });

  it("tells what the nest was, and leaves him a warden's wrap, once", async () => {
    const { g, toasts } = await at("sealchamber", "door");
    pastTheEye(g);
    const nest = nestAt();
    for (let y = hero(g).y; y > nest.y + CHAMBER.near - 2; y -= 2) expect(blocked(g.map, hero(g).x, y, true)).toBe(false);
    Object.assign(hero(g), { y: nest.y + CHAMBER.near - 4 });
    step(g, DT);
    step(g, DT);
    for (const line of CHAMBER_SAYS.nest) expect(toasts.filter(t => t === line)).toHaveLength(1);
    const wraps = g.world.query("pickup").filter(([, c]) => c.pickup.kind === "loot" && c.pickup.item.name === CHAMBER.gift.name);
    expect(wraps).toHaveLength(1);
    const [, c] = wraps[0]!;
    if (c.pickup.kind === "loot") expect(c.pickup.item.rarity).toBe("legendary");
  });
});

describe("the crack in the deep places", () => {
  it("is held by the Vael's stitches, coming loose, an eye under it; the pendant, worn, pulls them tight, once", async () => {
    const { g, toasts } = await wearing();
    enterArea(g, await loadArea("sealchamber"), "door");
    pastTheEye(g);
    expect(stitchesMended(g)).toBe(false);
    expect(g.world.query("renderable").filter(([, c]) => c.renderable.kind === "stitches")).toHaveLength(1);
    expect(blocked(g.map, crackAt().x, crackAt().y, true)).toBe(false);
    Object.assign(hero(g), crackAt());
    step(g, DT);
    step(g, DT);
    expect(stitchesMended(g)).toBe(true);
    expect(toasts).not.toContain(CHAMBER_SAYS.unworn);       // nothing said: it's seen
  });

  it("stays loose without the pendant on, and says something of Ael's would know how", async () => {
    const { g, toasts } = await at("sealchamber", "door");
    pastTheEye(g);
    Object.assign(hero(g), crackAt());
    step(g, DT);
    expect(stitchesMended(g)).toBe(false);
    expect(toasts).toContain(CHAMBER_SAYS.unworn);
  });

  it("isn't reached on arrival: he walks up to it", async () => {
    const { g, toasts } = await at("sealchamber", "door");
    step(g, DT);
    expect(toasts).not.toContain(CHAMBER_SAYS.unworn);
    expect(toasts).not.toContain(CHAMBER_SAYS.nest[0]);
  });
});

/** A frame as the game plays it, with the cutscene's part (src/main.ts). */
const frame = (g: Game) => { holdInput(g); step(g, DT); updateCutscene(g, DT); };
/** Come in and skip the eye's scene: the crack waits for it. */
function pastTheEye(g: Game): void { frame(g); frame(g); skipCutscene(g); }

describe("the eye, the first time in", () => {
  it("plays once as he comes in: he's held while the camera goes down to the eye and back, then he's free", async () => {
    const { g } = await at("sealchamber", "door");
    frame(g);
    frame(g);
    expect(cutscene(g)?.scene).toBe("eye");
    const from = { ...hero(g) };
    g.input.keys.add("KeyW");
    for (let t = 0; t < 6; t += DT) { g.input.keys.add("KeyW"); frame(g); if (!cutscene(g)) break; }
    expect(cutscene(g)).toBeNull();
    expect({ x: hero(g).x, y: hero(g).y }).toEqual({ x: from.x, y: from.y });
    expect(stitchesMended(g)).toBe(false);
    enterArea(g, await loadArea("undercroft"), "seal");
    enterArea(g, await loadArea("sealchamber"), "door");
    frame(g); frame(g);
    expect(cutscene(g)).toBeNull();
  });

  it("can be skipped", async () => {
    const { g } = await at("sealchamber", "door");
    frame(g); frame(g);
    skipCutscene(g);
    expect(cutscene(g)).toBeNull();
  });
});

describe("the crack, coming in still walking", () => {
  it("waits for the eye's scene: he can't mend it before he's seen what's under it", async () => {
    const { g } = await wearing();
    enterArea(g, await loadArea("sealchamber"), "door");
    Object.assign(hero(g), crackAt());                       // as if he'd walked straight on in
    step(g, DT);
    expect(stitchesMended(g)).toBe(false);
    frame(g);
    expect(cutscene(g)?.scene).toBe("eye");
  });
});
