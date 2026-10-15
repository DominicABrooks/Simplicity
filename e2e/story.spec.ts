// The story's big beats, played through in the browser: waking in the Witchwood, the road north to Kingsholm,
// and the King's audience in the Throne Room (the cutscene, his speech, his writ and his task).
import { expect, test, type Page } from "@playwright/test";
import { KING, KING_AGAIN, KING_AUDIENCE, KINGS_TASK } from "../src/data/king.ts";
import { areaId, bag, clickOn, expectToast, find, hold, journey, placeHero, play, readConversation, startGame, toasts, travel, waitFor } from "./game.ts";

const ROAD_TO_THE_KING = ["kingsroad", "capital", "castle", "throneroom"];
const WRIT = "The King's Writ";
const inCutscene = (page: Page) => page.locator("body.in-cutscene");

test("the title screen gives way to the hero waking in the Witchwood", async ({ page }) => {
  await startGame(page);
  expect(await areaId(page)).toBe("witchwood");
  await expect(page.locator("#screen")).toBeVisible();
  // He moves: walk each way for a moment (one of them is bound to be open, whatever's beside the stone).
  let furthest = 0;
  for (const key of ["d", "s", "a", "w"]) {
    const before = await page.evaluate(() => ({ ...window.simplicity.hero() }));
    await hold(page, key, 0.5);
    const after = await page.evaluate(() => ({ ...window.simplicity.hero() }));
    furthest = Math.max(furthest, Math.hypot(after.x - before.x, after.y - before.y));
  }
  expect(furthest).toBeGreaterThan(5);
});

test("the road north: through the cave, over the King's Bridge, the city, the castle, and into the Throne Room", async ({ page }) => {
  await startGame(page);
  for (const area of ROAD_TO_THE_KING) {
    await travel(page, area);
    expect(await areaId(page)).toBe(area);
  }
  // And back out the way he came.
  await journey(page, "castle", "capital", "kingsroad", "witchwood");
  expect(await areaId(page)).toBe("witchwood");
});

test.describe("the King's audience", () => {
  test("plays as a cutscene: control taken, walked up the carpet, the speech, the writ and the task", async ({ page }) => {
    await startGame(page);
    await journey(page, ...ROAD_TO_THE_KING);

    // The letterbox slides in, and nothing the player presses moves the hero while the scene holds at the door.
    await expect(inCutscene(page)).toBeVisible();
    await expect(page.locator(".letterbox.bottom.on .skip")).toHaveText("esc: skip");
    const atDoor = await page.evaluate(() => ({ ...window.simplicity.hero() }));
    await hold(page, "a", 0.5);
    const held = await page.evaluate(() => ({ ...window.simplicity.hero() }));
    expect(held.x).toBeCloseTo(atDoor.x, 0);

    // He's walked up the carpet to the King, who says his whole piece.
    const heard = await readConversation(page, KING.name);
    expect(heard).toEqual([...KING_AUDIENCE]);
    const king = (await find(page, "king"))!, hero = await page.evaluate(() => ({ ...window.simplicity.hero() }));
    expect(Math.hypot(king.x - hero.x, king.y - hero.y)).toBeLessThan(40);

    // The scene ends: control back, the writ in the bag, and the task.
    await expect(inCutscene(page)).toHaveCount(0);
    expect(await bag(page)).toContain(WRIT);
    await expectToast(page, KINGS_TASK);
    await hold(page, "s", 0.5);
    const free = await page.evaluate(() => ({ ...window.simplicity.hero() }));
    expect(Math.hypot(free.x - hero.x, free.y - hero.y)).toBeGreaterThan(3);
  });

  test("Escape skips it, and still hands over the writ and the task", async ({ page }) => {
    await startGame(page);
    await journey(page, ...ROAD_TO_THE_KING);
    await expect(inCutscene(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(inCutscene(page)).toHaveCount(0);
    await expect(page.locator("#dialogue")).toBeHidden();
    expect(await bag(page)).toContain(WRIT);
    await expectToast(page, KINGS_TASK);
    // He's where the scene would have walked him: before the King.
    const king = (await find(page, "king"))!, hero = await page.evaluate(() => ({ ...window.simplicity.hero() }));
    expect(Math.hypot(king.x - hero.x, king.y - hero.y)).toBeLessThan(40);
  });

  test("plays once: going back in, there's no scene, one writ, and the King tells him to get on with it", async ({ page }) => {
    await startGame(page);
    await journey(page, ...ROAD_TO_THE_KING);
    await page.keyboard.press("Escape");
    await expect(inCutscene(page)).toHaveCount(0);

    await journey(page, "castle", "throneroom");
    await play(page, 1);
    await expect(inCutscene(page)).toHaveCount(0);
    expect((await bag(page)).filter(n => n === WRIT)).toHaveLength(1);

    // Up to the King and click on him.
    const king = (await find(page, "king"))!;
    await placeHero(page, { x: king.x, y: king.y + 20 });
    await clickOn(page, king.id, 1);
    const heard = await readConversation(page, KING.name);
    expect(KING_AGAIN).toContain(heard[0]);
    expect(await toasts(page)).not.toContain("Too far away to talk");
  });

  test("a new run (hold R) plays it again", async ({ page }) => {
    await startGame(page);
    await journey(page, ...ROAD_TO_THE_KING);
    await page.keyboard.press("Escape");
    await expect(inCutscene(page)).toHaveCount(0);

    await page.keyboard.down("r");
    await waitFor(page, () => window.simplicity.game.area.def.id === "witchwood");
    await page.keyboard.up("r");
    await waitFor(page, () => window.simplicity.game.state === "play");
    expect(await bag(page)).not.toContain(WRIT);
    await journey(page, ...ROAD_TO_THE_KING);
    await expect(inCutscene(page)).toBeVisible();
  });
});
