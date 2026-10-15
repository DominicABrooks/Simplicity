// Helpers for the end-to-end specs: start the real game in the browser, move about it, and read what it's
// doing through the debug handle (src/debug.ts). Setting a scene up (where the hero stands, the hour) goes
// through the handle; what's being tested goes through the keyboard, the mouse and the page, as a player would.
//
// Waits count game time, not the wall clock: on CI's software-rendered WebGL the game may run at a few frames a
// second, and each frame moves the game on at most 50 ms, so a real second there can be a fraction of one in the game.
import { expect, type Page } from "@playwright/test";
import type { Game } from "../src/game/game.ts";
import type { Haunting } from "../src/game/ghost.ts";
import type { Point } from "../src/world/collision.ts";
import type { Renderer } from "../src/render/renderer.ts";

export interface Handle {
  game: Game;
  view: Renderer;
  hero(): Point;
  haunting(): Haunting;
}

declare global {
  interface Window {
    simplicity: Handle;
    /** Every toast shown since startGame, in order. */
    toasts: string[];
  }
}

/** Load the game, check the title screen, and press a key to begin. */
export async function startGame(page: Page): Promise<void> {
  await page.goto("./");
  await page.waitForFunction(() => !!window.simplicity);
  await page.evaluate(() => {
    window.toasts = [];
    window.simplicity.game.events.on("toast", t => window.toasts.push(t.text));
  });
  await expect(page.locator("#overlay")).toBeVisible();
  await expect(page.locator("#message")).toHaveText("Press any key to begin");
  await page.keyboard.press("Enter");
  await expect(page.locator("#overlay")).toBeHidden();
  await waitFor(page, () => window.simplicity.game.state === "play");
}

/** Let the game play on for this many seconds of its own time (it only counts while playing). */
export async function play(page: Page, seconds: number): Promise<void> {
  const from = await page.evaluate(() => window.simplicity.game.clock);
  await page.waitForFunction(([from, s]) => window.simplicity.game.clock >= from + s, [from, seconds] as const, { timeout: 120_000 });
}

/** Hold a key down for this many seconds of game time. */
export async function hold(page: Page, key: string, seconds: number): Promise<void> {
  await page.keyboard.down(key);
  await play(page, seconds);
  await page.keyboard.up(key);
}

/** Wait until `fn` (run in the page) is true. */
export async function waitFor(page: Page, fn: () => boolean, timeout = 20_000): Promise<void> {
  await page.waitForFunction(fn, undefined, { timeout });
}

/** The area the hero's in. */
export const areaId = (page: Page) => page.evaluate(() => window.simplicity.game.area.def.id);

/** Step into the exit that leads to `to` and wait to arrive there, ready to play. */
export async function travel(page: Page, to: string): Promise<void> {
  await page.evaluate(to => {
    const g = window.simplicity.game, exit = g.area.layout.exits.find(e => e.to.area === to);
    if (!exit) throw new Error(`No way from ${g.area.def.id} to ${to}`);
    const p = g.world.need(g.player, "transform");
    p.x = exit.rect.x + exit.rect.w / 2 - 4;
    p.y = exit.rect.y + exit.rect.h / 2 - 4;
  }, to);
  await page.waitForFunction(to => window.simplicity.game.area.def.id === to && window.simplicity.game.state === "play", to);
}

/** Travel along a route of areas, in order. */
export async function journey(page: Page, ...areas: string[]): Promise<void> {
  for (const area of areas) await travel(page, area);
}

/** Set the time of day (0-24). */
export const setHour = (page: Page, hour: number) => page.evaluate(h => { window.simplicity.game.hour = h; }, hour);

/** Put the hero at a game position (cell top-left, px). */
export const placeHero = (page: Page, at: Point) =>
  page.evaluate(at => { Object.assign(window.simplicity.hero(), { x: at.x, y: at.y }); }, at);

/** The hero can't die: a scene that isn't about his health shouldn't be lost to it. */
export const keepHeroAlive = (page: Page) =>
  page.evaluate(() => {
    const g = window.simplicity.game, h = g.world.need(g.player, "health");
    h.maxHp = Math.max(h.maxHp, 99);
    h.hp = h.maxHp;
  });

/** Every toast shown so far. */
export const toasts = (page: Page) => page.evaluate(() => window.toasts);

/** Wait for a toast with this text. */
export async function expectToast(page: Page, text: string): Promise<void> {
  await expect.poll(() => toasts(page)).toContain(text);
}

/** The names of what's in the bag. */
export const bag = (page: Page) => page.evaluate(() => window.simplicity.game.inventory.grid.map(e => e.item.name));

/** Where, on screen (CSS px), something at this game position appears, `height` world units up. */
export const onScreen = (page: Page, at: Point, height = 0.8) =>
  page.evaluate(([at, h]) => window.simplicity.view.gameToScreen(at.x, at.y, h), [at, height] as const);

/** The first entity of a render kind in the area, and where it is. */
export const find = (page: Page, kind: string) =>
  page.evaluate(kind => {
    const g = window.simplicity.game;
    const hit = g.world.query("renderable", "transform").find(([, c]) => c.renderable.kind === kind);
    return hit ? { id: hit[0], x: hit[1].transform.x, y: hit[1].transform.y } : null;
  }, kind);

/**
 * Read a conversation out as the player would: wait for each line to finish typing in the dialogue box, note
 * it, and press Enter for the next, until the box closes. Returns the lines in order.
 */
export async function readConversation(page: Page, speaker: string): Promise<string[]> {
  const box = page.locator("#dialogue"), lines: string[] = [];
  await expect(box).toBeVisible({ timeout: 120_000 });   // a scene may walk him up first
  await expect(box.locator(".who")).toHaveText(speaker);
  while (await box.isVisible()) {
    await expect(box.locator(".more")).not.toHaveText("", { timeout: 60_000 });
    lines.push((await box.locator(".say").textContent()) ?? "");
    await page.keyboard.press("Enter");
    await expect.poll(async () => !(await box.isVisible()) || (await box.locator(".say").textContent()) !== lines.at(-1)).toBe(true);
  }
  return lines;
}

/**
 * Point at an entity with the mouse until the game has it as the target (the camera may still be gliding
 * there), as a player would. Returns false if it never locked on.
 */
export async function aimAt(page: Page, id: number, height = 0.8, timeout = 5_000): Promise<boolean> {
  for (const end = Date.now() + timeout; Date.now() < end;) {
    const at = await page.evaluate(([id, h]) => {
      const t = window.simplicity.game.world.get(id, "transform");
      return t ? window.simplicity.view.gameToScreen(t.x, t.y, h) : null;
    }, [id, height] as const);
    if (!at) return false;
    await page.mouse.move(at.x, at.y);
    if (await page.evaluate(id => window.simplicity.game.target === id, id)) return true;
    await page.waitForTimeout(100);
  }
  return false;
}

/** Aim at an entity and click it. */
export async function clickOn(page: Page, id: number, height = 0.8): Promise<void> {
  expect(await aimAt(page, id, height), `couldn't target entity ${id}`).toBe(true);
  await page.mouse.down();
  await page.mouse.up();
}
