// Fishing, played in the browser: take the pole out of the bag, cast into the Witchwood's water, wait for the
// bite, strike, and land a koi; and now and then a curiosity instead, with a line of its own in the tooltip.
import { expect, test, type Page } from "@playwright/test";
import { CURIOS } from "../src/data/items.ts";
import { bag, clearEnemies, placeHero, play, startGame } from "./game.ts";

/** Open the bag, find the fishing pole by its tooltip, and right-click it to take it in hand. */
async function takeUpThePole(page: Page): Promise<void> {
  await page.keyboard.press("i");
  await expect(page.locator("#inventory")).toBeVisible();
  const items = page.locator("#invGrid .item");
  for (let i = 0; i < (await items.count()); i++) {
    await items.nth(i).hover();
    if (/Fishing Pole/.test((await page.locator("#tooltip .tip-name").textContent()) ?? "")) {
      await items.nth(i).click({ button: "right" });
      break;
    }
  }
  await expect.poll(() => page.evaluate(() => { const g = window.simplicity.game; return g.world.need(g.player, "hero").gear?.weaponType; })).toBe("rod");
  await page.keyboard.press("i");
  await expect(page.locator("#inventory")).toBeHidden();
}

/** Stand on the shore of the Witchwood's water, two tiles from it. Returns a water cell to cast at. */
async function toTheShore(page: Page) {
  const shore = await page.evaluate(() => {
    const m = window.simplicity.game.map, T = 8, WATER = 2, GRASS = 0;
    for (let y = 1; y < m.height - 1; y++) for (let x = 3; x < m.width - 1; x++)
      if (m.tiles[y]![x] === WATER && m.tiles[y]![x - 2] === GRASS && m.tiles[y]![x - 3] === GRASS) return { stand: { x: (x - 2) * T, y: y * T }, water: { x: x * T, y: y * T } };
    return null;
  });
  expect(shore).not.toBeNull();
  await clearEnemies(page);                                  // no slime to knock him in while he waits
  await placeHero(page, shore!.stand);
  await play(page, 1);                                       // the camera glides after him
  return shore!.water;
}

const fishing = (page: Page) => page.evaluate(() => { const g = window.simplicity.game; return g.world.need(g.player, "actions").fishing?.phase ?? null; });

/**
 * Cast at the water (press, wind up, release), wait for the bite, and strike, every roll of the dice at the strike
 * coming up `roll`: the lowest makes it a curiosity (one in twenty), a middling one an ordinary koi.
 */
async function castAndStrike(page: Page, water: { x: number; y: number }, roll: number): Promise<void> {
  const at = await page.evaluate(w => window.simplicity.view.gameToScreen(w.x, w.y, 0), water);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await play(page, 0.3);
  await page.mouse.up();
  await expect.poll(() => fishing(page)).toBe("wait");
  await page.waitForFunction(() => { const g = window.simplicity.game; return g.world.need(g.player, "actions").fishing?.phase === "bite"; }, undefined, { timeout: 60_000 });
  await page.evaluate(roll => { const r = window.simplicity.game.rng, next = r.next.bind(r); r.next = () => roll; setTimeout(() => { r.next = next; }, 1500); }, roll);
  await page.mouse.down();
  await page.mouse.up();
  await expect.poll(() => fishing(page)).toBeNull();
}

test("cast into the water, wait for the bite, strike, and land a koi", async ({ page }) => {
  await startGame(page);
  await takeUpThePole(page);
  const water = await toTheShore(page);
  const before = (await bag(page)).length;
  await castAndStrike(page, water, 0.5);
  await expect.poll(async () => (await bag(page)).length).toBe(before + 1);
  expect((await bag(page)).some(n => /Koi$/.test(n))).toBe(true);
  await expect.poll(() => page.locator("#toast").textContent()).toMatch(/^Caught a .*Koi!$/);
});

test("a curiosity comes up instead, and says something of itself", async ({ page }) => {
  await startGame(page);
  await takeUpThePole(page);
  const water = await toTheShore(page);
  await castAndStrike(page, water, 0);
  await expect.poll(() => page.locator("#toast").textContent()).toMatch(/^Something heavy on the line\.\.\. a /);
  const name = await page.evaluate(() => window.simplicity.game.inventory.grid.find(e => e.item.curio)?.item.name ?? null);
  const curio = Object.values(CURIOS).find(c => c.name === name);
  expect(curio, `a curiosity in the bag (got ${name})`).toBeDefined();

  // Its tooltip: its name, "Curiosity", and its line.
  await page.keyboard.press("i");
  const items = page.locator("#invGrid .item");
  let tip = "";
  for (let i = 0; i < (await items.count()) && !tip.includes(curio!.name); i++) {
    await items.nth(i).hover();
    tip = (await page.locator("#tooltip").textContent()) ?? "";
  }
  expect(tip).toContain(curio!.name);
  expect(tip).toContain("Curiosity");
  expect(tip).toContain(curio!.note);
});
