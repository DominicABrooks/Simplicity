// Going back and forth between areas mustn't leak: each area's scenery is built on arrival and thrown away on
// leaving, so the GPU's geometries and textures settle at the same level however many times you go round.
import { expect, test, type Page } from "@playwright/test";
import { journey, play, startGame, travel } from "./game.ts";

const memory = (page: Page) => page.evaluate(() => window.simplicity.view.memory());

/** Go round `there` and back `times` times, noting memory each time we're back. */
async function roundTrips(page: Page, there: string, back: string, times: number) {
  const seen: { geometries: number; textures: number }[] = [];
  for (let i = 0; i < times; i++) {
    await travel(page, there);
    await page.keyboard.press("Escape");                     // past any scene that plays on arrival
    await travel(page, back);
    await play(page, 0.5);
    seen.push(await memory(page));
  }
  return seen;
}

test("nothing leaks going back and forth between areas, outdoors or in", async ({ page }) => {
  await startGame(page);
  await journey(page, "kingsroad", "capital");
  // The first trip builds what's shared and kept (materials, the rug and stone textures): count from after it.
  const town = await roundTrips(page, "kingsroad", "capital", 4);
  await travel(page, "castle");
  const keep = await roundTrips(page, "throneroom", "castle", 4);

  for (const seen of [town, keep]) {
    const [first, ...rest] = seen.slice(1);
    for (const now of rest) {
      expect(now.textures).toBeLessThanOrEqual(first!.textures);
      // Geometries come and go with effects, people and pickups: allow some drift, but not a climb.
      expect(now.geometries).toBeLessThan(first!.geometries * 1.25 + 20);
    }
  }
});
