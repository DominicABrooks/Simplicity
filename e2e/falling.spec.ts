// Falling and rising, in the browser: a slime catches the hero on his last heart, the screen says how to rise
// again, and R starts a new run back at the start: full health, the starter kit, and the city's hour kept.
import { expect, test } from "@playwright/test";
import { areaId, bag, placeHero, startGame, waitFor } from "./game.ts";

test("a slime takes his last heart; R rises again at the start, whole", async ({ page }) => {
  await startGame(page);
  const kit = await bag(page);
  await page.evaluate(() => { const g = window.simplicity.game; g.world.need(g.player, "health").hp = 1; g.hour = 12; });

  // Stand on a slime until it bumps him (they come to him anyway).
  await waitFor(page, () => window.simplicity.game.world.query("slime", "transform").length > 0, 60_000);
  for (let i = 0; i < 60; i++) {
    if (await page.evaluate(() => window.simplicity.game.state === "dead")) break;
    const slime = await page.evaluate(() => {
      const hit = window.simplicity.game.world.query("slime", "transform")[0];
      return hit ? { x: hit[1].transform.x, y: hit[1].transform.y } : null;
    });
    if (slime) await placeHero(page, slime);
    // A moment of game time, or until he's down (the clock stops then).
    const from = await page.evaluate(() => window.simplicity.game.clock);
    await page.waitForFunction(from => window.simplicity.game.state === "dead" || window.simplicity.game.clock >= from + 0.3, from);
  }
  expect(await page.evaluate(() => window.simplicity.game.state)).toBe("dead");
  await expect(page.locator("#overlay")).toBeVisible();
  await expect(page.locator("#message")).toHaveText("Press R to rise again.");

  // Any other key does nothing; R rises.
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => window.simplicity.game.state)).toBe("dead");
  const hour = await page.evaluate(() => window.simplicity.game.hour);
  await page.keyboard.press("r");
  await expect(page.locator("#overlay")).toBeHidden();
  await waitFor(page, () => window.simplicity.game.state === "play");

  expect(await areaId(page)).toBe("witchwood");
  const health = await page.evaluate(() => { const g = window.simplicity.game, h = g.world.need(g.player, "health"); return { hp: h.hp, maxHp: h.maxHp }; });
  expect(health.hp).toBe(health.maxHp);
  expect((await bag(page)).sort()).toEqual([...kit].sort());
  // The day goes on where it was: falling doesn't turn the clock back.
  expect(await page.evaluate(() => window.simplicity.game.hour)).toBeGreaterThanOrEqual(hour);
});
