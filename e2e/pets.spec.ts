// The city's dogs and cats, in the browser: each is a named friendly target; click one close by and you pet it,
// and it sits facing you, hearts floating up, holding still for as long as you keep at it.
import { expect, test, type Page } from "@playwright/test";
import { clickOn, journey, placeHero, play, setHour, startGame, waitFor } from "./game.ts";

/** A pet's name, pose, and where it is. */
const petInfo = (page: Page, id: number) =>
  page.evaluate(id => {
    const g = window.simplicity.game, t = g.world.get(id, "transform"), pet = g.world.get(id, "pet");
    return t && pet ? { x: t.x, y: t.y, pose: pet.pose, moving: pet.moving, name: g.world.get(id, "targetable")?.name ?? "" } : null;
  }, id);

test("pet a dog or cat: it sits facing you, hearts float up, and it stays put", async ({ page }) => {
  await startGame(page);
  await journey(page, "kingsroad", "capital");
  await setHour(page, 10);
  await waitFor(page, () => window.simplicity.game.world.query("pet", "targetable").length > 0, 30_000);
  const id = await page.evaluate(() => window.simplicity.game.world.query("pet", "targetable")[0]![0]);

  // Named, like anyone else.
  const before = (await petInfo(page, id))!;
  expect(before.name).toMatch(/^\w+ the (dog|cat)$/);

  // Up close, and click it (a cat you've targeted doesn't bolt as you come near).
  await placeHero(page, { x: before.x - 9, y: before.y });
  await play(page, 0.5);
  const near = (await petInfo(page, id))!;
  await placeHero(page, { x: near.x - 9, y: near.y });
  await clickOn(page, id, 0.4);

  // Hearts float up, and it sits (or a cat stays lying) and goes nowhere while you keep at it.
  await expect.poll(() => page.evaluate(() => window.simplicity.game.floaters.some(f => f.text === "♥"))).toBe(true);
  const held = (await petInfo(page, id))!;
  expect(["sit", "lie"]).toContain(held.pose);
  await play(page, 2);
  const after = (await petInfo(page, id))!;
  expect(after.moving).toBe(false);
  expect(Math.hypot(after.x - held.x, after.y - held.y)).toBeLessThan(0.5);
});
