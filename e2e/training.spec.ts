// The castle's training dummies and archery targets, in the browser: you can target them and hit them as hard
// as you like, and they take every blow (the numbers fly) but never go down, never move, and drop nothing.
import { expect, test, type Page } from "@playwright/test";
import { TRAINING } from "../src/data/npcs.ts";
import { aimAt, journey, placeHero, play, startGame } from "./game.ts";

/** Every training target in the castle: id, kind and where it stands. */
const targets = (page: Page) =>
  page.evaluate(() => window.simplicity.game.world.query("dummy", "transform").map(([id, c]) => ({ id, kind: c.dummy.kind, x: c.transform.x, y: c.transform.y })));

for (const kind of Object.keys(TRAINING) as (keyof typeof TRAINING)[]) {
  test(`a ${TRAINING[kind].name} takes every hit and never goes down`, async ({ page }) => {
    await startGame(page);
    await journey(page, "kingsroad", "capital", "castle");
    const target = (await targets(page)).find(t => t.kind === kind);
    expect(target, `a ${kind} in the castle`).toBeDefined();
    const before = await page.evaluate(() => ({ kills: window.simplicity.game.kills, pickups: window.simplicity.game.world.count("pickup") }));

    // Hit it far harder than it has health, again and again.
    await page.evaluate(() => { const g = window.simplicity.game; g.world.need(g.player, "hero").damage = 500; });
    let hits = 0;
    for (let i = 0; i < 8; i++) {
      await placeHero(page, { x: target!.x - 7, y: target!.y });
      if (!(await aimAt(page, target!.id))) continue;
      // Mark the numbers already in the air, so a blow counts by a new one (not by how many there are: on a slow
      // frame the last blow's number can fade in the same moment this one appears).
      await page.evaluate(() => { for (const f of window.simplicity.game.floaters) Object.assign(f, { seen: true }); });
      await page.mouse.down();
      await page.mouse.up();
      await play(page, 0.4);
      if (await page.evaluate(() => window.simplicity.game.floaters.some(f => !("seen" in f) && /^\d+!?$/.test(f.text)))) hits++;
    }
    expect(hits, "blows that landed (a number flew off it)").toBeGreaterThanOrEqual(3);

    // Still there, on its post, at full health; nothing killed, nothing dropped.
    const after = await page.evaluate(id => {
      const g = window.simplicity.game, t = g.world.get(id, "transform"), h = g.world.get(id, "health");
      return { alive: g.world.isAlive(id), x: t?.x, y: t?.y, hp: h?.hp, maxHp: h?.maxHp, kills: g.kills, pickups: g.world.count("pickup") };
    }, target!.id);
    expect(after.alive).toBe(true);
    expect({ x: after.x, y: after.y }).toEqual({ x: target!.x, y: target!.y });
    expect(after.hp).toBe(after.maxHp);
    expect(after.kills).toBe(before.kills);
    expect(after.pickups).toBe(before.pickups);
  });
}
