// The Grey Ringer, St Mary's ghost, played in the browser: she only rises at night for a hero who's heard the
// city whisper about her; she's fought among the graves until she's laid to rest; and dawn sends her back.
import { expect, test, type Page } from "@playwright/test";
import { GHOST_NAME, GHOST_SAYS } from "../src/data/ghost.ts";
import { aimAt, expectToast, find, journey, keepHeroAlive, placeHero, setHour, startGame, toasts, waitFor } from "./game.ts";

/** To the Market Quarter at midnight, having heard the rumour `heard` times, standing by the churchyard gate. */
async function toTheChurchyard(page: Page, heard: number): Promise<void> {
  await startGame(page);
  await journey(page, "kingsroad", "capital");
  await page.evaluate(heard => {
    const s = window.simplicity;
    s.haunting().heard = heard;
    s.haunting().night = "waiting";
    // Tonight's roll comes up for her whenever she can rise at all (the odds are the unit tests' business).
    const rng = s.game.rng, next = rng.next.bind(rng);
    let rolled = false;
    rng.next = () => { if (!rolled && s.haunting().night === "waiting" && heard > 0) { rolled = true; return 0; } return next(); };
  }, heard);
  await setHour(page, 0);
  await keepHeroAlive(page);
  const yard = await page.evaluate(() => {
    const p = window.simplicity.game.area.layout.props.find(p => p.kind === "graves");
    return p && "rect" in p ? p.rect : null;
  });
  expect(yard).not.toBeNull();
  await placeHero(page, { x: yard!.x + yard!.w / 2, y: yard!.y + yard!.h + 12 });
}

const ghost = (page: Page) => find(page, "ghost");

test("nobody's talked about her: the churchyard stays quiet at night", async ({ page }) => {
  await toTheChurchyard(page, 0);
  await waitFor(page, () => window.simplicity.haunting().night === "quiet");
  await page.waitForTimeout(1500);
  expect(await ghost(page)).toBeNull();
});

test("she rises for a hero who's heard the rumour, is fought among the graves, and is laid to rest", async ({ page }) => {
  await toTheChurchyard(page, 5);
  await expectToast(page, GHOST_SAYS.rise);
  expect(await page.evaluate(() => window.simplicity.haunting().night)).toBe("risen");

  // Once she's up out of the ground she can be targeted, by her name.
  await waitFor(page, () => window.simplicity.game.world.query("ghost", "enemy").length > 0);
  const her = (await ghost(page))!;
  await placeHero(page, { x: her.x - 7, y: her.y });
  expect(await aimAt(page, her.id)).toBe(true);
  expect(await page.evaluate(id => window.simplicity.game.world.get(id, "targetable")?.name, her.id)).toBe(GHOST_NAME);

  // Fight: stand by her, aim at her and punch, hard (this is about the fight's course, not the hero's damage).
  await page.evaluate(() => { const g = window.simplicity.game; g.world.need(g.player, "hero").damage = 6; });
  let angry = false;
  for (let i = 0; i < 400; i++) {
    const her = await ghost(page);
    if (!her) break;
    await keepHeroAlive(page);
    await placeHero(page, { x: her.x - 7, y: her.y });
    // She fades out now and then (untargetable): wait for her to come back.
    if (await aimAt(page, her.id, 0.8, 1_000)) { await page.mouse.down(); await page.mouse.up(); }
    await page.waitForTimeout(120);
    angry ||= (await toasts(page)).includes(GHOST_SAYS.angry);
  }
  expect(await ghost(page)).toBeNull();
  expect(angry).toBe(true);                                // she wailed in anger past half her health

  // Laid to rest: the bell falls silent, her grave goods are left behind, and the rumour's forgotten.
  await expectToast(page, GHOST_SAYS.laid);
  const after = await page.evaluate(() => ({ ...window.simplicity.haunting() }));
  expect(after).toEqual({ heard: 0, night: "laid" });
  // (He may already have walked over one and picked it up: on the ground or in the bag, both are there.)
  const goods = await page.evaluate(() => {
    const g = window.simplicity.game, isGood = (r: string) => r === "rare";
    const ground = g.world.query("pickup").filter(([, c]) => c.pickup.kind === "loot" && isGood(c.pickup.item.rarity)).length;
    return ground + g.inventory.grid.filter(e => isGood(e.item.rarity)).length;
  });
  expect(goods).toBeGreaterThanOrEqual(2);
  expect(await page.evaluate(() => window.simplicity.game.kills)).toBeGreaterThanOrEqual(1);

  // And she doesn't rise again tonight.
  await page.waitForTimeout(1500);
  expect(await ghost(page)).toBeNull();
});

test("at first light she fades into the grass", async ({ page }) => {
  await toTheChurchyard(page, 5);
  await expectToast(page, GHOST_SAYS.rise);
  expect(await ghost(page)).not.toBeNull();
  await setHour(page, 6);
  await expectToast(page, GHOST_SAYS.dawn);
  expect(await ghost(page)).toBeNull();
  expect(await page.evaluate(() => window.simplicity.haunting().night)).toBe("waiting");
});

test("the townsfolk run from her", async ({ page }) => {
  await toTheChurchyard(page, 5);
  await expectToast(page, GHOST_SAYS.rise);
  // Someone walking near her when she's out takes to their heels, shouting.
  const screams: readonly string[] = GHOST_SAYS.scream;
  await expect.poll(async () => (await page.evaluate(() => window.simplicity.game.floaters.map(f => f.text))).some(t => screams.includes(t)), { timeout: 30_000 })
    .toBe(true);
});
