// Under St Mary's, in the browser, each piece set up straight from the address as anyone can (?curio=stone,
// ?try=seal and the rest: see src/debug.ts): the Mysterious Stone going home to the ring, which leaves the Ringstone
// Pendant; the pendant drinking from the old stones; the little door behind the ring, shut to a part-charged pendant
// and opening to a burning one, into the deep places; the eye's scene there, and the pendant pulling the crack's
// stitches tight; and the path up St Mary's churchyard to the porch door.
import { expect, test, type Page } from "@playwright/test";
import { areaId, expectToast, keepHeroAlive, play, startAt, waitFor } from "./game.ts";

/** How the Undercroft's pieces stand (src/debug.ts). */
const state = (page: Page) => page.evaluate(() => window.simplicity.undercroft());

/** Walk north (holding W) until `done` is true in the page. */
async function northUntil(page: Page, done: () => boolean, timeout = 60_000): Promise<void> {
  await page.keyboard.down("w");
  try { await waitFor(page, done, timeout); } finally { await page.keyboard.up("w"); }
}

test("the Mysterious Stone goes home to the ring, which wakes and leaves the Ringstone Pendant", async ({ page }) => {
  await startAt(page, "curio=stone");
  await keepHeroAlive(page);
  // Stand him a step and a half below the socket (the ring's gap, facing the way in), and walk up into it.
  await page.evaluate(() => {
    const g = window.simplicity.game, ring = g.area.layout.props.find(p => p.kind === "stoneRing");
    if (ring?.kind !== "stoneRing") throw new Error("no ring");
    const a = -Math.PI / 2 + (ring.gap / ring.stones) * Math.PI * 2, x = ring.x / 8 + Math.cos(a) * ring.radius, z = ring.y / 8 + Math.sin(a) * ring.radius;
    Object.assign(window.simplicity.hero(), { x: x * 8 - 4, y: (z + 1.6) * 8 - 4 });
  });
  await northUntil(page, () => window.simplicity.undercroft().ringWoken);
  await expectToast(page, "The ring knows you now: fall, and Ael will wake you here.");
  // Left at the socket's foot, or already picked up (he was still walking).
  const items = await page.evaluate(() => [
    ...window.simplicity.game.world.query("pickup").flatMap(([, c]) => (c.pickup.kind === "loot" ? [c.pickup.item] : [])),
    ...window.simplicity.game.inventory.grid.map(e => e.item),
  ]);
  expect(items.map(i => [i.name, i.rarity])).toContainEqual(["Ringstone Pendant", "legendary"]);
});

test("worn, the pendant drinks from the old stone he stands on", async ({ page }) => {
  await startAt(page, "try=pendant");
  await waitFor(page, () => window.simplicity.undercroft().charge === 1);
  const note = await page.evaluate(() => window.simplicity.game.inventory.equip.amulet?.note);
  expect(note).toContain("drunk from 1 of the five");
});

test("the little door won't move for a part-charged pendant", async ({ page }) => {
  await startAt(page, "try=seal&stones=3");
  await page.keyboard.down("w");
  await play(page, 3);
  await page.keyboard.up("w");
  await expectToast(page, "It won't move.");
  expect(await areaId(page)).toBe("undercroft");
  expect((await state(page)).sealOpen).toBe(false);
});

test("the burning pendant opens the little door; through it, the eye's scene, and the pendant pulls the stitches tight", async ({ page }) => {
  await startAt(page, "try=seal");
  await keepHeroAlive(page);
  // Up into the door: it opens (he's held back while it swings), and on through into the deep places.
  await northUntil(page, () => window.simplicity.game.area.def.id === "sealchamber" && window.simplicity.game.state === "play", 120_000);
  expect((await state(page)).sealOpen).toBe(true);
  // The eye's scene plays as he comes in; Escape skips it.
  await waitFor(page, () => window.simplicity.game.world.get(window.simplicity.game.player, "cutscene")?.scene === "eye");
  await page.keyboard.press("Escape");
  await waitFor(page, () => !window.simplicity.game.world.has(window.simplicity.game.player, "cutscene"));
  expect((await state(page)).mended).toBe(false);
  // On up onto the crack: the stitches pull tight; and on to the nest, which says what it was for.
  await northUntil(page, () => window.simplicity.undercroft().mended);
  await northUntil(page, () => window.toasts.includes("The eggs lay here, right on the crack, to hold it shut."));
});

test("the deep places, set up straight from the address: the eye's scene plays, and ends by itself", async ({ page }) => {
  await startAt(page, "try=deep");
  await waitFor(page, () => window.simplicity.game.world.get(window.simplicity.game.player, "cutscene")?.scene === "eye");
  await waitFor(page, () => !window.simplicity.game.world.has(window.simplicity.game.player, "cutscene"), 120_000);
  expect(await areaId(page)).toBe("sealchamber");
});

test("St Mary's churchyard has a clear path from the street up to the porch door", async ({ page }) => {
  await startAt(page, "try=porch");
  await keepHeroAlive(page);
  await page.keyboard.down("w");
  await play(page, 4);
  await page.keyboard.up("w");
  // He's walked right up to the porch's front (src/world/plans.ts: churchPlan), not stopped short at a grave.
  const { feet, porch } = await page.evaluate(() => {
    const g = window.simplicity.game, yard = g.area.layout.props.find(p => p.kind === "graves" && p.path);
    const church = g.area.layout.props.find(p => p.kind === "church" && yard?.kind === "graves" && p.rect.y + p.rect.h === yard.rect.y);
    if (church?.kind !== "church") throw new Error("no St Mary's");
    const D = church.rect.h / 8;
    return { feet: (window.simplicity.hero().y + 2) / 8, porch: church.rect.y / 8 + D / 2 + (D - 0.6) / 2 + 1.4 };
  });
  expect(Math.abs(feet - porch)).toBeLessThan(0.3);
});
