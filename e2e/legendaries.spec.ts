// The legendaries, each found the way a player finds it, in the browser: set up straight from the address as anyone
// can (?boss=koi, ?curio=eye, ?try=deep, ?area=cutterhut: see src/debug.ts), then played through with the keyboard and
// the mouse till it's in the bag. Ael's Thorn (Old Gil, then the lake bed); Greatwhisker (the Great Koi); Calder's
// Head; the Ring of the Long Reel (the fairy ring's acorn, and the Erl-King); the Warden's Wrap (the nest in the deep
// places); Wystan's Longbow (the Fells' house); and the Ashwalkers (Abel's number, and his strongbox). The Ringer's
// Shroud and the Ringstone Pendant have their own (ghost.spec.ts, undercroft.spec.ts).
import { expect, test, type Page } from "@playwright/test";
import { THORN, THORN_SAYS } from "../src/data/quay.ts";
import { FEY_GIFT } from "../src/data/fey.ts";
import { UNDERHILL } from "../src/data/underhill.ts";
import { GREAT_KOI } from "../src/data/hollow.ts";
import { ASHWALKERS, LOCKBOX, LOCKBOX_SAYS } from "../src/data/lockbox.ts";
import { RANGERS_BOW } from "../src/data/fells.ts";
import { areaId, bag, clearEnemies, clickOn, expectToast, find, keepHeroAlive, placeHero, play, readConversation, startAt, travel, waitFor } from "./game.ts";

/** Is there something by this name lying on the ground here? Where (an entity's top-left, px). */
const lying = (page: Page, name: string) =>
  page.evaluate(name => {
    const hit = window.simplicity.game.world.query("pickup", "transform").find(([, c]) => c.pickup.kind === "loot" && c.pickup.item.name === name);
    return hit ? { x: hit[1].transform.x, y: hit[1].transform.y } : null;
  }, name);

/** The rarity of what's in the bag by this name, if it's there. */
const inBag = (page: Page, name: string) =>
  page.evaluate(name => window.simplicity.game.inventory.grid.find(e => e.item.name === name)?.item.rarity ?? null, name);

/**
 * Walk over to it where it's lying, and wait till it's in the bag: a legendary. (If he's standing where it dropped,
 * it's in the bag already.)
 */
async function pickUp(page: Page, name: string): Promise<void> {
  const somewhere = async () => (await inBag(page, name)) !== null || (await lying(page, name)) !== null;
  await expect.poll(somewhere, { message: `${name} dropped`, timeout: 60_000 }).toBe(true);
  const at = await lying(page, name);
  if (at) await placeHero(page, at);
  await expect.poll(() => inBag(page, name), { message: `${name} in the bag`, timeout: 30_000 }).toBe("legendary");
}

/**
 * This boss goes down: the last blow dealt through the handle (the fight's tried in its own specs; what's tried here
 * is what it leaves), and the game's own systems let it fall and leave what it leaves.
 */
async function finish(page: Page, kind: string): Promise<void> {
  await expect.poll(async () => (await find(page, kind)) !== null, { message: `${kind} out`, timeout: 60_000 }).toBe(true);
  const them = (await find(page, kind))!;
  await page.evaluate(id => { const h = window.simplicity.game.world.get(id, "health"); if (h) h.hp = 0; }, them.id);
}

test("Ael's Thorn: Old Gil takes his glass eye back, and then it's on the lake bed in the Clearing", async ({ page }) => {
  await startAt(page, "curio=eye");
  await keepHeroAlive(page);
  const gil = await find(page, "boatman");
  expect(gil).not.toBeNull();
  await placeHero(page, { x: gil!.x, y: gil!.y + 10 });     // up beside him, near enough to talk
  await play(page, 1);
  await clickOn(page, gil!.id, 1);
  await readConversation(page, "Old Gil");
  expect(await bag(page)).not.toContain("Glass Eye");
  await travel(page, "witchwood");
  await expectToast(page, THORN_SAYS);
  await clearEnemies(page);
  await pickUp(page, THORN.name);
});

test("Greatwhisker: landed, the Great Koi leaves the legendary pole in its whiskers", async ({ page }) => {
  await startAt(page, "boss=koi&god");
  await finish(page, "greatkoi");
  await expectToast(page, GREAT_KOI.say.landed);
  await pickUp(page, "Greatwhisker");
});

test("Calder's Head: when Calder falls, all that's left whole of him", async ({ page }) => {
  await startAt(page, "boss=calder&god");
  await finish(page, "calder");
  await pickUp(page, "Calder's Head");
});

test("the Ring of the Long Reel: the fair folk's acorn, followed under the hill, and the Erl-King's gift", async ({ page }) => {
  await startAt(page, "area=witchwood&hour=23");
  await keepHeroAlive(page);
  await clearEnemies(page);
  // Stand still in the fairy ring after dark till the fair folk speak; then step out, and they leave him an acorn.
  const ring = await page.evaluate(() => {
    const r = window.simplicity.game.area.layout.props.find(p => p.kind === "fairyRing");
    return r ? { x: r.x - 4, y: r.y - 4 } : null;
  });
  expect(ring).not.toBeNull();
  await placeHero(page, ring!);
  await waitFor(page, () => document.getElementById("feySaying")?.textContent !== "", 90_000);
  await page.keyboard.down("s");
  await play(page, 1.5);
  await page.keyboard.up("s");
  await expectToast(page, FEY_GIFT.says);
  await expect.poll(async () => (await lying(page, FEY_GIFT.name)) !== null || (await inBag(page, FEY_GIFT.name)) !== null, { timeout: 30_000 }).toBe(true);
  const acorn = await lying(page, FEY_GIFT.name);
  if (acorn) await placeHero(page, acorn);                   // where it dropped, as he stepped out
  await expect.poll(() => inBag(page, FEY_GIFT.name), { timeout: 30_000 }).not.toBeNull();
  // Plant it: open the bag and right-click it. Down he goes, under the hill.
  await page.keyboard.press("i");
  await page.locator("#inventory .item.rarity-rare").first().click({ button: "right" });
  await waitFor(page, () => window.simplicity.game.area.def.id === "underhill" && window.simplicity.game.state === "play", 60_000);
  await keepHeroAlive(page);
  // The Erl-King has his say: skip past it all (Q), and his gift drops into his hand.
  await waitFor(page, () => !!document.getElementById("erlSpeech")?.textContent, 60_000);
  await page.keyboard.press("q");
  await expectToast(page, UNDERHILL.says.gift);
  await pickUp(page, "Ring of the Long Reel");
});

test("the Warden's Wrap: left by the Vael's empty nest in the deep places", async ({ page }) => {
  await startAt(page, "try=deep");
  await keepHeroAlive(page);
  await waitFor(page, () => window.simplicity.game.world.get(window.simplicity.game.player, "cutscene")?.scene === "eye");
  await page.keyboard.press("q");                            // past the eye's scene
  await waitFor(page, () => !window.simplicity.game.world.has(window.simplicity.game.player, "cutscene"));
  await page.keyboard.down("w");                              // up onto the crack, and on to the nest
  try { await waitFor(page, () => window.toasts.includes("The eggs lay here, right on the crack, to hold it shut."), 60_000); } finally { await page.keyboard.up("w"); }
  await pickUp(page, "Warden's Wrap");
});

test("Wystan's Longbow: the Fells always ask him in, and the Ranger's bow leans by their chest", async ({ page }) => {
  await startAt(page, "area=capital&hour=19");
  await keepHeroAlive(page);
  await play(page, 0.5);                                     // the townsfolk come home of an evening
  // The Fells' door: the one on the front of the house the census puts them in (the Wallside, the grey cloak at its window).
  const door = await page.evaluate(() => {
    const g = window.simplicity.game, px = 31.5 * 8, py = 55.5 * 8;
    const house = g.area.layout.props.find(p => p.kind === "house" && px >= p.rect.x && py >= p.rect.y && px <= p.rect.x + p.rect.w && py <= p.rect.y + p.rect.h);
    if (house?.kind !== "house") return null;
    const front = { x: house.rect.x + house.rect.w / 2, y: house.rect.y + house.rect.h };
    const near = window.simplicity.doors().map(d => ({ ...d, far: Math.hypot(d.x - front.x, d.y - front.y) })).sort((a, b) => a.far - b.far)[0];
    return near ?? null;
  });
  expect(door, "the Fells' door").not.toBeNull();
  // Knock; whoever answers, talk to them: the Fells always ask him in. Knock again, and in.
  await placeHero(page, { x: door!.x, y: door!.y + 9 });
  await play(page, 1);
  await clickOn(page, door!.id, 1);
  await waitFor(page, () => window.simplicity.game.world.query("walker").some(([, c]) => c.walker.plan === "answer"), 60_000);
  const who = await page.evaluate(() => {
    const g = window.simplicity.game, hit = g.world.query("walker", "targetable").find(([, c]) => c.walker.plan === "answer");
    return hit ? { id: hit[0], name: hit[1].targetable.name } : null;
  });
  await clickOn(page, who!.id, 1);
  await readConversation(page, who!.name);
  await expect.poll(async () => (await page.evaluate(id => window.simplicity.doors().find(d => d.id === id)?.name ?? "", door!.id))).toMatch(/\(go in\)$/);
  await clickOn(page, door!.id, 1);
  await waitFor(page, () => window.simplicity.game.area.def.id.startsWith("inside:") && window.simplicity.game.state === "play", 60_000);
  await expectToast(page, "By the chest leans a longbow of grey ash, strung and waiting. The Ranger's own.");
  await pickUp(page, RANGERS_BOW.name);
});

test("the Ashwalkers' number: Abel Coppin, the woodcutter in the Wallside lane, tells it", async ({ page }) => {
  await startAt(page, "area=capital&hour=12");
  await keepHeroAlive(page);
  const abel = await find(page, "woodcutter");
  expect(abel, "Abel out in the lane by day").not.toBeNull();
  await placeHero(page, { x: abel!.x, y: abel!.y + 9 });
  await play(page, 1);
  await clickOn(page, abel!.id, 1);
  const said = await readConversation(page, "Abel Coppin");
  expect(said.join(" ")).toContain(LOCKBOX.code.split("").join("-"));
});

test("the Ashwalkers: Abel's strongbox in the woodcutters' hut, its four wheels set to his number", async ({ page }) => {
  await startAt(page, "area=ashwild");
  await keepHeroAlive(page);
  await clearEnemies(page);
  await travel(page, "cutterhut");                           // in at the hut's door
  await expectToast(page, LOCKBOX_SAYS.seen);
  const box = await find(page, "lockbox");
  expect(box).not.toBeNull();
  await placeHero(page, { x: box!.x, y: box!.y + 10 });
  await play(page, 1);
  await clickOn(page, box!.id, 0.2);
  await expect(page.locator("#pinpad")).toBeVisible();
  // Roll each wheel round to its number with the arrows, as on an old lock: up for the small ones, down for the big ones.
  const wheels = page.locator("#pinpad .wheel");
  for (const [i, n] of [...LOCKBOX.code].map(Number).entries()) {
    const up = n <= 5, turns = up ? n : 10 - n;
    for (let k = 0; k < turns; k++) await wheels.nth(i).locator(up ? ".roll.up" : ".roll.down").click();
    await expect(wheels.nth(i).locator(".face")).toHaveText(String(n));
  }
  await page.locator("#pinpad .try").click();
  await expect(page.locator("#pinpad")).toBeHidden();
  await expectToast(page, LOCKBOX_SAYS.opens);
  await pickUp(page, ASHWALKERS.name);
  expect(await areaId(page)).toBe("cutterhut");
});
