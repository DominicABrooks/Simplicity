// Knocking at doors in the Market Quarter, in the browser: nobody answers at an empty house; at an inn,
// whoever answers asks you in, and knocking again takes you inside, among whoever's there.
import { expect, test, type Page } from "@playwright/test";
import { clickOn, expectToast, journey, keepHeroAlive, placeHero, play, readConversation, setHour, startGame, waitFor } from "./game.ts";

interface DoorInfo { id: number; name: string; x: number; y: number; home: number }
const doors = (page: Page): Promise<DoorInfo[]> => page.evaluate(() => window.simplicity.doors());
const door = async (page: Page, id: number) => (await doors(page)).find(d => d.id === id)!;

/** Into the Market Quarter at an hour of the day. */
async function toTheMarket(page: Page, hour: number): Promise<void> {
  await startGame(page);
  await journey(page, "kingsroad", "capital");
  await setHour(page, hour);
  await keepHeroAlive(page);
  await play(page, 0.5);                                     // the townsfolk go home or out by the hour
}

/** Stand on the doorstep (just in front of the door, toward the street) and knock: click the door. */
async function knockAt(page: Page, d: DoorInfo): Promise<void> {
  // Within knocking reach (16 px) whichever way the door faces.
  await placeHero(page, { x: d.x, y: d.y + 9 });
  await play(page, 1);                                       // the camera glides after him
  await clickOn(page, d.id, 1);
}

test("nobody home: knocking gets no answer", async ({ page }) => {
  await toTheMarket(page, 12);
  const empty = (await doors(page)).find(d => d.home === 0 && !/^The (Crown|Bell)/.test(d.name));
  test.skip(!empty, "every house has someone in at noon");
  await knockAt(page, empty!);
  await expectToast(page, `No answer at ${empty!.name}.`);
});

test("at an inn, whoever answers asks you in, and knocking again takes you inside", async ({ page }) => {
  await toTheMarket(page, 19);
  const inns = (await doors(page)).filter(d => /^The (Crown|Bell)/.test(d.name) && d.home > 0);
  expect(inns.length, "an inn with someone in, of an evening").toBeGreaterThan(0);

  // Knock, and speak to whoever comes. A child or one of the Marshal's informers won't ask a stranger in, so
  // knock again (or at the next inn) until someone does.
  let invited: DoorInfo | null = null;
  for (let tries = 0; tries < 6 && !invited; tries++) {
    const inn = inns[tries % inns.length]!;
    await knockAt(page, inn);
    await waitFor(page, () => window.simplicity.game.world.query("walker").some(([, c]) => c.walker.plan === "answer"), 60_000);
    const who = await page.evaluate(() => {
      const g = window.simplicity.game, hit = g.world.query("walker", "targetable").find(([, c]) => c.walker.plan === "answer");
      return hit ? { id: hit[0], name: hit[1].targetable.name } : null;
    });
    expect(who).not.toBeNull();
    await clickOn(page, who!.id, 1);
    await readConversation(page, who!.name);
    if ((await door(page, inn.id)).name.endsWith("(go in)")) invited = inn;
    else await play(page, 2);                                // they shut the door: give it a moment
  }
  expect(invited, "someone at an inn asked him in").not.toBeNull();

  // Knock again: in he goes, to the inn's room, with whoever's in there.
  await clickOn(page, invited!.id, 1);
  await waitFor(page, () => !!window.simplicity.game.area.def.indoors && window.simplicity.game.state === "play");
  const inside = await page.evaluate(() => ({
    room: window.simplicity.game.area.layout.props.some(p => p.kind === "room"),
    people: window.simplicity.game.world.query("walker").length,
  }));
  expect(inside.room).toBe(true);
  expect(inside.people).toBeGreaterThan(0);

  // And back out the door, onto the street.
  await journey(page, "capital");
});
