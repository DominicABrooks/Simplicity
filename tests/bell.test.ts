// The bell come home: carry Ismay's little handbell into St Mary's churchyard after dark and she rises for it,
// rumour or none, takes it back without a fight, rings it one last time and rests for good.
import { describe, expect, it } from "vitest";
import { area as capital } from "../src/areas/capital.ts";
import { area as castle } from "../src/areas/castle.ts";
import { area as kingsroad } from "../src/areas/kingsroad.ts";
import { loadArea } from "../src/areas/index.ts";
import { BELL_HOME, GHOST, HOLLOW_BITE } from "../src/data/ghost.ts";
import { carryingCurio, spentCurios } from "../src/game/curios.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { churchyardOf, ghostOut, hauntingOf, riseGhost } from "../src/game/ghost.ts";
import { resetGame } from "../src/game/reset.ts";
import { advanceTalk, talking } from "../src/game/talk.ts";
import { setCensus } from "../src/game/townsfolk.ts";
import { enterArea } from "../src/game/travel.ts";
import { makeCurio } from "../src/items/items.ts";
import { step } from "../src/systems/index.ts";
import { residentsOf } from "../src/world/residents.ts";

setCensus(residentsOf({ capital: capital.build().props, castle: castle.build().props, kingsroad: kingsroad.build().props }));
const DT = 1 / 30;
const run = (g: Game, seconds: number) => { for (let t = 0; t < seconds; t += DT) step(g, DT); };

/** In the Market Quarter at an hour, by St Mary's churchyard, the bell in the bag if `bell`. */
async function inCapital(hour: number, bell: boolean): Promise<{ g: Game; toasts: string[] }> {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  if (bell) g.inventory.add(makeCurio("bell"));
  enterArea(g, await loadArea("capital"), "southgate");
  g.hour = hour;
  const toasts: string[] = [];
  g.events.on("toast", t => toasts.push(t.text));
  const y = churchyardOf(g)!;
  Object.assign(g.world.need(g.player, "transform"), { x: y.x + y.w / 2, y: y.y + y.h + 6 });
  return { g, toasts };
}

/** Let her come, and hear her out. */
function hearHerOut(g: Game) {
  for (let t = 0; t < 20 && !talking(g); t += DT) step(g, DT);
  expect(talking(g)?.name).toBe(BELL_HOME.name);
  for (let i = 0; i < 40 && talking(g); i++) advanceTalk(g);
  step(g, DT);                                            // and she takes it
}

describe("Ismay's bell", () => {
  it("raises her at night even if the hero's heard nothing of her, and calm: not a foe", async () => {
    const { g, toasts } = await inCapital(23, true);
    expect(hauntingOf(g).heard).toBe(0);
    step(g, DT);
    const e = ghostOut(g)!;
    expect(e).not.toBeNull();
    expect(g.world.need(e, "ghost").calm).toBe(true);
    expect(toasts).toContain(BELL_HOME.wake);
    run(g, GHOST.rise + 0.2);
    expect(g.world.has(e, "enemy")).toBe(false);
    expect(g.world.need(e, "targetable")).toMatchObject({ name: BELL_HOME.name, hostile: false });
  });

  it("does nothing by day", async () => {
    const { g } = await inCapital(12, true);
    run(g, 1);
    expect(ghostOut(g)).toBeNull();
  });

  it("is taken back after she's had her say; she rings it, leaves her grave goods and never rises again", async () => {
    const { g, toasts } = await inCapital(23, true);
    const hp = g.world.need(g.player, "health").hp;
    step(g, DT);
    hearHerOut(g);
    expect(carryingCurio(g, "bell")).toBe(false);
    expect(spentCurios(g).has("bell")).toBe(true);
    const loot = g.world.count("pickup");
    run(g, BELL_HOME.ring + 0.5);
    expect(ghostOut(g)).toBeNull();
    expect(toasts).toContain(BELL_HOME.rest);
    expect(g.world.count("pickup")).toBeGreaterThan(loot);
    expect(g.world.query("pickup").filter(([, c]) => c.pickup.kind === "loot" && c.pickup.item.name === HOLLOW_BITE[3] && c.pickup.item.rarity === "legendary")).toHaveLength(1);
    expect(g.world.need(g.player, "health").hp).toBeGreaterThanOrEqual(hp);   // her tolls hurt nobody now
    // Another night, the whole city whispering about her: she stays down.
    hauntingOf(g).heard = 50;
    hauntingOf(g).night = "waiting";
    run(g, 2);
    expect(ghostOut(g)).toBeNull();
  });

  it("stops a fight: the Grey Ringer already up hears it in the bag and comes for it instead", async () => {
    const { g, toasts } = await inCapital(23, false);
    const e = riseGhost(g, churchyardOf(g)!);
    run(g, GHOST.rise + 0.2);
    expect(g.world.has(e, "enemy")).toBe(true);
    g.inventory.add(makeCurio("bell"));
    step(g, DT);
    expect(g.world.need(e, "ghost").calm).toBe(true);
    expect(g.world.has(e, "enemy")).toBe(false);
    expect(toasts).toContain(BELL_HOME.hush);
    hearHerOut(g);
    expect(carryingCurio(g, "bell")).toBe(false);
  });

  it("comes home once a run: a new run has it back in the river", async () => {
    const { g } = await inCapital(23, true);
    step(g, DT);
    hearHerOut(g);
    expect(spentCurios(g).has("bell")).toBe(true);
    resetGame(g);
    expect(spentCurios(g).size).toBe(0);
  });
});
