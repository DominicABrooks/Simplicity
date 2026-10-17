// The Ranger's bow: in the Fells' house in the Wallside it leans by the chest, a legendary longbow, there whenever he's
// inside till he has it, and he's told the first time each run. Nobody else's house has it. The Fells always ask him in.
import { beforeAll, describe, expect, it } from "vitest";
import { loadArea } from "../src/areas/index.ts";
import { RANGERS_BOW, RANGERS_BOW_SAYS } from "../src/data/fells.ts";
import { T } from "../src/data/world.ts";
import { rangersBowSystem } from "../src/game/fells.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { goInside } from "../src/game/interiors.ts";
import { resetGame } from "../src/game/reset.ts";
import { loadCensus } from "../src/game/townsfolk.ts";
import { arrive } from "../src/game/travel.ts";
import type { Prop } from "../src/world/area.ts";
import { blocked } from "../src/world/collision.ts";
import { layoutOf } from "../src/world/layouts.ts";
import type { Resident } from "../src/world/residents.ts";

type House = Extract<Prop, { kind: "house" }>;
let people: Resident[] = [];
beforeAll(async () => { people = await loadCensus(); });

/** A house, by who lives in it: the house round their home, and everyone living there. */
async function houseOf(who: Resident): Promise<{ area: string; house: House; household: Resident[] }> {
  const area = who.home.area, px = (who.home.x + 0.5) * T, py = (who.home.y + 0.5) * T;
  const house = layoutOf(await loadArea(area)).props.find((p): p is House =>
    p.kind === "house" && px >= p.rect.x && py >= p.rect.y && px <= p.rect.x + p.rect.w && py <= p.rect.y + p.rect.h)!;
  const r = house.rect, household = people.filter(p => p.home.area === area && p.home.x * T >= r.x && p.home.y * T >= r.y && p.home.x * T < r.x + r.w && p.home.y * T < r.y + r.h);
  return { area, house, household };
}
/** A fresh run, and in through this house's door. */
async function inside(g: Game, at: { area: string; house: House; household: Resident[] }): Promise<void> {
  goInside(g, at.area, at.house, at.household, at.household, "The house");
  arrive(g, await loadArea(g.travel!.area));
}
function game(): { g: Game; toasts: string[] } {
  const g = createGame(), toasts: string[] = [];
  resetGame(g);
  setState(g, "play");
  g.events.on("toast", t => toasts.push(t.text));
  return { g, toasts };
}
const bowsHere = (g: Game) => g.world.query("pickup").flatMap(([e, c]) => (c.pickup.kind === "loot" && c.pickup.item.name === RANGERS_BOW.name ? [{ e, item: c.pickup.item }] : []));
const fells = () => people.find(r => r.family === "fell" && !r.prisoner)!;

describe("the Ranger's bow", () => {
  it("leans by the chest in the Fells' house: a legendary bow, where he can reach it, and he's told once", async () => {
    const { g, toasts } = game();
    await inside(g, await houseOf(fells()));
    rangersBowSystem(g);
    rangersBowSystem(g);
    const bows = bowsHere(g);
    expect(bows).toHaveLength(1);
    expect(bows[0]!.item).toMatchObject({ type: "bow", rarity: "legendary", name: RANGERS_BOW.name, note: RANGERS_BOW.note });
    expect(bows[0]!.item.mods).toEqual(RANGERS_BOW.mods);
    const at = g.world.need(bows[0]!.e, "transform");
    expect(blocked(g.map, at.x, at.y, true)).toBe(false);
    expect(g.world.has(bows[0]!.e, "despawn")).toBe(false);
    expect(toasts.filter(t => t === RANGERS_BOW_SAYS)).toHaveLength(1);
  });

  it("is there again if he leaves it, but not once he has it", async () => {
    const { g, toasts } = game(), fellsHouse = await houseOf(fells());
    await inside(g, fellsHouse);
    rangersBowSystem(g);
    await inside(g, fellsHouse);
    rangersBowSystem(g);
    const [bow] = bowsHere(g);
    expect(bow).toBeDefined();
    expect(toasts.filter(t => t === RANGERS_BOW_SAYS)).toHaveLength(1);
    g.inventory.add(bow!.item);
    g.world.destroy(bow!.e);
    await inside(g, fellsHouse);
    rangersBowSystem(g);
    expect(bowsHere(g)).toHaveLength(0);
  });

  it("isn't in anybody else's house", async () => {
    const { g } = game(), someone = people.find(r => r.family !== "fell" && r.home.area === fells().home.area && !r.prisoner)!;
    const other = await houseOf(someone);
    expect(other.household.some(r => r.family === "fell")).toBe(false);
    await inside(g, other);
    rangersBowSystem(g);
    expect(bowsHere(g)).toHaveLength(0);
  });
});
