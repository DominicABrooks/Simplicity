// The story's big beats, played through in the browser: waking in the Witchwood, the road north to Kingsholm,
// and the King's audience in the Throne Room (the cutscene, his speech, his watchword and his task).
import { expect, test, type Page } from "@playwright/test";
import { WARDEN_TALK, WOODWARDEN } from "../src/data/ashwild.ts";
import { KING, KING_AGAIN, KING_AUDIENCE, KINGS_TASK, WATCHWORD } from "../src/data/king.ts";
import { areaId, clearEnemies, clickOn, expectToast, find, hold, journey, placeHero, play, readConversation, startGame, toasts, travel, waitFor } from "./game.ts";

const ROAD_TO_THE_KING = ["kingsroad", "capital", "castle", "throneroom"];
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
  test("plays as a cutscene: control taken, walked up the carpet, the speech, the watchword and the task", async ({ page }) => {
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

    // The scene ends: control back, and the task.
    await expect(inCutscene(page)).toHaveCount(0);
    await expectToast(page, KINGS_TASK);
    await hold(page, "s", 0.5);
    const free = await page.evaluate(() => ({ ...window.simplicity.hero() }));
    expect(Math.hypot(free.x - hero.x, free.y - hero.y)).toBeGreaterThan(3);
  });

  test("Escape skips it, and still sets the task", async ({ page }) => {
    await startGame(page);
    await journey(page, ...ROAD_TO_THE_KING);
    await expect(inCutscene(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(inCutscene(page)).toHaveCount(0);
    await expect(page.locator("#dialogue")).toBeHidden();
    await expectToast(page, KINGS_TASK);
    // He's where the scene would have walked him: before the King.
    const king = (await find(page, "king"))!, hero = await page.evaluate(() => ({ ...window.simplicity.hero() }));
    expect(Math.hypot(king.x - hero.x, king.y - hero.y)).toBeLessThan(40);
  });

  test("plays once: going back in, there's no scene, and the King tells him to get on with it", async ({ page }) => {
    await startGame(page);
    await journey(page, ...ROAD_TO_THE_KING);
    await page.keyboard.press("Escape");
    await expect(inCutscene(page)).toHaveCount(0);

    await journey(page, "castle", "throneroom");
    await play(page, 1);
    await expect(inCutscene(page)).toHaveCount(0);

    // Up to the King and click on him.
    const king = (await find(page, "king"))!;
    await placeHero(page, { x: king.x, y: king.y + 20 });
    await play(page, 1.5);                                   // the camera glides after him
    // A slow frame can leave the camera moving under the cursor: click again until he's talking, as a player would.
    for (let i = 0; i < 5 && !(await page.locator("#dialogue").isVisible()); i++) {
      await clickOn(page, king.id, 1);
      await play(page, 0.5);
    }
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
    await journey(page, ...ROAD_TO_THE_KING);
    await expect(inCutscene(page)).toBeVisible();
  });
});

test.describe("the woodwardens' barricade", () => {
  /** Up to a warden, click on them, and hear them out: they hand over the paper. */
  async function askedForIt(page: Page): Promise<string[]> {
    const warden = await page.evaluate(name => {
      const g = window.simplicity.game, hit = g.world.query("targetable", "transform").find(([, c]) => c.targetable.name === name)!;
      return { id: hit[0], x: hit[1].transform.x, y: hit[1].transform.y };
    }, WOODWARDEN.name);
    await placeHero(page, { x: warden.x, y: warden.y - 14 });
    await play(page, 1.5);                                   // the camera glides after him
    for (let i = 0; i < 5 && !(await page.locator("#dialogue").isVisible()); i++) {
      await clickOn(page, warden.id, 1);
      await play(page, 0.5);
    }
    return readConversation(page, WOODWARDEN.name);
  }
  /** Into the gate in the barricade: through it to the Ashwild, or turned back. */
  const tryTheGate = (page: Page) => page.evaluate(() => {
    const g = window.simplicity.game, exit = g.area.layout.exits.find(e => e.to.area === "ashwild")!;
    Object.assign(window.simplicity.hero(), { x: exit.rect.x + exit.rect.w / 2 - 4, y: exit.rect.y + exit.rect.h / 2 - 4 });
  });

  test("hands you paper and a crayon: the wrong word turns you back, the King's watchword lets you through", async ({ page }) => {
    test.slow();                                             // three conversations, typed out at the game's pace
    await startGame(page);
    await clearEnemies(page);                                // the barricade is in slime country: none to cut the talk short
    await tryTheGate(page);
    await play(page, 1);
    expect(await areaId(page)).toBe("witchwood");

    // They ask, and hand over the paper: what he types goes on it, not into walking about.
    expect(await askedForIt(page)).toEqual([...WARDEN_TALK.ask]);
    const paper = page.locator("#paper"), crayon = paper.locator(".crayon");
    await expect(paper).toBeVisible();
    await expect(crayon).toBeFocused();
    const before = await page.evaluate(() => ({ ...window.simplicity.hero() }));
    await crayon.pressSequentially("wasd");
    await crayon.fill("");
    await crayon.pressSequentially("Open sesame");
    expect(await page.evaluate(() => ({ ...window.simplicity.hero() }))).toEqual(before);
    await crayon.press("Enter");
    await expect(paper).toBeHidden();
    const wrong = await readConversation(page, WOODWARDEN.name);
    expect(wrong[0]).toContain('"Open sesame"? That\'s not it.');
    await tryTheGate(page);
    await play(page, 1);
    expect(await areaId(page)).toBe("witchwood");

    // Again, with the watchword: and through the gate.
    await askedForIt(page);
    await crayon.pressSequentially(WATCHWORD.toLowerCase());
    await paper.getByRole("button", { name: "Hand it back" }).click();
    expect(await readConversation(page, WOODWARDEN.name)).toEqual([...WARDEN_TALK.right]);
    await travel(page, "ashwild");
    expect(await areaId(page)).toBe("ashwild");
  });
});
