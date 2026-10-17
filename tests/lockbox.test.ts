// The woodcutters' strongbox: in the Coppins' hut in the Ashwild it stands shut, and set to the right four numbers it
// opens on Abel's legendary boots, which lie in front of it till he has them. Wrong numbers don't open it; a new run
// shuts it again. The number's to be had three ways: from Abel Coppin in the Wallside lanes in Kingsholm, from the fair folk in the ring
// (the first thing they say), and maybe from the letter in the bottle (src/game/quay.ts; tests/quay.test.ts).
import { describe, expect, it } from "vitest";
import { HOME, loadArea } from "../src/areas/index.ts";
import { FAIRY_RING } from "../src/data/fey.ts";
import { ABEL, ABEL_TALK, ASHWALKERS, LOCKBOX, LOCKBOX_FEY, LOCKBOX_SAYS } from "../src/data/lockbox.ts";
import { HALF, T } from "../src/data/world.ts";
import { TOWNSFOLK } from "../src/data/townsfolk.ts";
import { fairyRingSystem, ringHere, sayingOf } from "../src/game/fairyring.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { abelLines, isAbel, isLockbox, LOCKBOX_AREA, lockboxOpen, lockboxSystem, openLockbox, settingWheels, setWheels, tryLockbox, wheels } from "../src/game/lockbox.ts";
import { resetGame } from "../src/game/reset.ts";
import { startTalk, talking } from "../src/game/talk.ts";
import { enterArea } from "../src/game/travel.ts";
import { blocked } from "../src/world/collision.ts";

function game(): { g: Game; toasts: string[] } {
  const g = createGame(), toasts: string[] = [];
  resetGame(g);
  setState(g, "play");
  g.events.on("toast", t => toasts.push(t.text));
  return { g, toasts };
}
/** A fresh run, in the Market Quarter at `hour`, and a moment there. */
async function inTown(hour: number): Promise<{ g: Game; toasts: string[] }> {
  const run = game(), area = await loadArea(ABEL.area);
  enterArea(run.g, area, Object.keys(area.build().entries)[0]!);
  run.g.hour = hour;
  lockboxSystem(run.g);
  return run;
}
/** In through the hut's door, and a moment there. */
async function inTheHut(g: Game): Promise<void> {
  enterArea(g, await loadArea(LOCKBOX_AREA), "in");
  lockboxSystem(g);
}
const theBox = (g: Game) => g.world.query("renderable").find(([e]) => isLockbox(g, e))![0];
/** Stood right in front of it. */
function upTo(g: Game): void {
  const it = g.world.need(theBox(g), "transform");
  Object.assign(g.world.need(g.player, "transform"), { x: it.x, y: it.y + 8 });
}
const bootsHere = (g: Game) => g.world.query("pickup").flatMap(([e, c]) => (c.pickup.kind === "loot" && c.pickup.item.name === ASHWALKERS.name ? [{ e, item: c.pickup.item }] : []));

describe("the woodcutters' strongbox", () => {
  it("stands shut in the hut, and he's told so the first time", async () => {
    const { g, toasts } = game();
    await inTheHut(g);
    lockboxSystem(g);
    expect(g.world.query("renderable").filter(([e]) => isLockbox(g, e))).toHaveLength(1);
    expect(lockboxOpen(g)).toBe(false);
    expect(toasts.filter(t => t === LOCKBOX_SAYS.seen)).toHaveLength(1);
    expect(bootsHere(g)).toHaveLength(0);
  });

  it("has to be reached to be tried, and then the wheels come up for the player", async () => {
    const { g, toasts } = game();
    await inTheHut(g);
    expect(tryLockbox(g, theBox(g))).toBe(true);           // from the door: too far
    expect(settingWheels(g)).toBeNull();
    expect(toasts).toContain(LOCKBOX_SAYS.far);
    upTo(g);
    tryLockbox(g, theBox(g));
    expect(settingWheels(g)).toBe(theBox(g));
    expect(tryLockbox(g, g.player)).toBe(false);           // not everything's the strongbox
  });

  it("stays shut for the wrong number, and for none", async () => {
    const { g, toasts } = game();
    await inTheHut(g);
    upTo(g);
    tryLockbox(g, theBox(g));
    setWheels(g, "1234");
    expect(lockboxOpen(g)).toBe(false);
    expect(toasts).toContain(LOCKBOX_SAYS.wrong.replace("{code}", "1234"));
    tryLockbox(g, theBox(g));
    setWheels(g, null);
    expect(lockboxOpen(g)).toBe(false);
    expect(settingWheels(g)).toBeNull();
    lockboxSystem(g);
    expect(bootsHere(g)).toHaveLength(0);
  });

  it("opens for the right number, on legendary boots in front of it that stay till he has them", async () => {
    const { g, toasts } = game();
    await inTheHut(g);
    upTo(g);
    tryLockbox(g, theBox(g));
    setWheels(g, ` ${LOCKBOX.code.split("").join("-")} `);   // however he sets them, the wheels only show the numbers
    expect(lockboxOpen(g)).toBe(true);
    expect(toasts).toContain(LOCKBOX_SAYS.opens);
    lockboxSystem(g);
    lockboxSystem(g);
    const boots = bootsHere(g);
    expect(boots).toHaveLength(1);
    expect(boots[0]!.item).toMatchObject({ type: "boots", rarity: "legendary", name: ASHWALKERS.name, note: ASHWALKERS.note });
    expect(boots[0]!.item.mods).toEqual(ASHWALKERS.mods);
    expect(g.world.has(boots[0]!.e, "despawn")).toBe(false);
    const at = g.world.need(boots[0]!.e, "transform");
    expect(blocked(g.map, at.x, at.y, true)).toBe(false);
    // Out and back in without them: they're still there. Taken: gone for good, and the box is empty.
    await inTheHut(g);
    expect(bootsHere(g)).toHaveLength(1);
    g.inventory.add(bootsHere(g)[0]!.item);
    g.world.destroy(bootsHere(g)[0]!.e);
    lockboxSystem(g);
    await inTheHut(g);
    lockboxSystem(g);
    expect(bootsHere(g)).toHaveLength(0);
    upTo(g);
    tryLockbox(g, theBox(g));
    expect(settingWheels(g)).toBeNull();
    expect(toasts.at(-1)).toBe(LOCKBOX_SAYS.empty);
  });

  it("is shut again in a new run", async () => {
    const { g } = game();
    openLockbox(g);
    resetGame(g);
    expect(lockboxOpen(g)).toBe(false);
  });

  it("only shows numbers on its wheels, four at most", () => {
    expect(wheels("4 9-1x7")).toBe("4917");
    expect(wheels("123456")).toBe("1234");
    expect(wheels("abc")).toBe("");
  });

  it("can be gone into from the Ashwild, both huts", async () => {
    const exits = (await loadArea("ashwild")).build().exits.map(x => x.to.area);
    expect(exits).toContain(LOCKBOX_AREA);
    expect(exits).toContain("woodshed");
  });
});

describe("the strongbox's number", () => {
  it("Abel Coppin, the woodcutter, stands in the Wallside lane in Kingsholm by day, where he can be walked up to", async () => {
    const { g } = await inTown(12);
    lockboxSystem(g);
    const abel = g.world.query("renderable").filter(([e]) => isAbel(g, e));
    expect(abel).toHaveLength(1);
    const at = g.world.need(abel[0]![0], "transform");
    expect(blocked(g.map, at.x, at.y, true)).toBe(false);
    expect(g.world.need(abel[0]![0], "targetable").name).toBe(ABEL.name);
  });

  it("Abel tells it the first time he's talked to, and after; once it's open, he's glad", async () => {
    const { g } = await inTown(12), code = LOCKBOX.code.split("").join("-");
    const abel = g.world.query("renderable").find(([e]) => isAbel(g, e))![0], at = g.world.need(abel, "transform");
    Object.assign(g.world.need(g.player, "transform"), { x: at.x, y: at.y + 8 });
    expect(startTalk(g, abel)).toBe(true);
    expect(talking(g)!.lines.join(" ")).toContain(code);
    expect(abelLines(g, 1).join(" ")).toContain(code);
    openLockbox(g);
    expect(abelLines(g, 0)).toEqual([...ABEL_TALK.opened]);
  });

  it("Abel keeps the townsfolk's hours: indoors at night, home through his door at bedtime, out of it again in the morning", async () => {
    const abel = (g: Game) => g.world.query("renderable").find(([e]) => isAbel(g, e))?.[0];
    const { g } = await inTown(2);
    expect(abel(g)).toBeUndefined();                         // arriving at night: he's in bed
    g.hour = TOWNSFOLK.hours.workFrom;                       // the morning: out of his door, over to his place
    lockboxSystem(g, 0.1);
    const out = g.world.need(abel(g)!, "transform"), door = { x: out.x, y: out.y };
    expect(Math.hypot(door.x - (ABEL.x * T - HALF), door.y - (ABEL.y * T - HALF))).toBeGreaterThan(4);
    for (let t = 0; t < 10; t += 0.1) lockboxSystem(g, 0.1);
    expect(g.world.need(abel(g)!, "transform")).toMatchObject({ x: ABEL.x * T - HALF, y: ABEL.y * T - HALF });
    g.hour = TOWNSFOLK.hours.bedtime;                        // bedtime: back to his door, and in
    lockboxSystem(g, 0.1);
    expect(abel(g)).toBeDefined();                           // walking there first, not gone on the spot
    for (let t = 0; t < 10; t += 0.1) lockboxSystem(g, 0.1);
    expect(abel(g)).toBeUndefined();
  });

  it("is the first thing the fair folk say in the ring, while it's still shut, and only once a run", () => {
    const stand = (g: Game, seconds: number) => { for (let t = 0; t < seconds; t += 0.1) fairyRingSystem(g, 0.1); };
    const { g } = game();
    enterArea(g, HOME, "start");
    g.hour = 23;
    const ring = ringHere(g)!, p = g.world.need(g.player, "transform");
    p.x = ring.x - HALF; p.y = ring.y - HALF;
    stand(g, FAIRY_RING.speakFrom + 0.5);
    expect(sayingOf(g)?.text).toBe(LOCKBOX_FEY);
    const said = new Set<string>();
    for (let t = 0; t < 120; t += 0.1) { fairyRingSystem(g, 0.1); const s = sayingOf(g); if (s && s.n > 0) said.add(s.text); }
    expect(said.size).toBeGreaterThan(3);
    expect(said.has(LOCKBOX_FEY)).toBe(false);
  });

  it("isn't what the fair folk say once the box is open", () => {
    const { g } = game();
    openLockbox(g);
    enterArea(g, HOME, "start");
    g.hour = 23;
    const ring = ringHere(g)!, p = g.world.need(g.player, "transform");
    p.x = ring.x - HALF; p.y = ring.y - HALF;
    for (let t = 0; t < FAIRY_RING.speakFrom + 0.5; t += 0.1) fairyRingSystem(g, 0.1);
    expect(sayingOf(g)?.text).not.toBe(LOCKBOX_FEY);
  });
});
