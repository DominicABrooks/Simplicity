// The Dim Man, as the townsfolk talk about him: now and then a mention (more after dark, more once the hero's seen
// him), and sometimes the next part of who he was, told in order across the city until the hero's heard all of it.
import { describe, expect, it } from "vitest";
import { area as capitalArea } from "../src/areas/capital.ts";
import { area as castleArea } from "../src/areas/castle.ts";
import { area as kingsroadArea } from "../src/areas/kingsroad.ts";
import { loadArea } from "../src/areas/index.ts";
import { DIM_CODA, DIM_ENDINGS, DIM_KID, DIM_LEADS, DIM_MENTIONS, DIM_SEEN, DIM_STORY } from "../src/data/dimman.ts";
import { voiceOf } from "../src/game/conversation.ts";
import { dimManChance, dimManLines, dimManOf, sawDimMan } from "../src/game/dimman.ts";
import { startEerie } from "../src/game/eerie.ts";
import { createGame, setState, type Game } from "../src/game/game.ts";
import { resetGame } from "../src/game/reset.ts";
import { endTalk, startTalk } from "../src/game/talk.ts";
import { populate, setCensus, updateTownsfolk } from "../src/game/townsfolk.ts";
import { enterArea } from "../src/game/travel.ts";
import { residentsOf } from "../src/world/residents.ts";

const people = setCensus(residentsOf({ capital: capitalArea.build().props, castle: castleArea.build().props, kingsroad: kingsroadArea.build().props }));
const grown = people.filter(r => r.age >= 16 && !r.prisoner);
const tellers = grown.filter(r => !["denies", "loyal", "informer"].includes(r.stance));
const STORY = DIM_STORY.flat(), ANY_MENTION = Object.values(DIM_MENTIONS).flat();

async function inCapital(hour: number): Promise<Game> {
  const g = createGame();
  resetGame(g);
  setState(g, "play");
  enterArea(g, await loadArea("capital"), "southgate");
  g.hour = hour;
  return g;
}
/** Ask them till they bring him up (the chance is small, so many times over). */
function untilSaid(g: Game, r: (typeof grown)[number], tries = 400): string[] {
  for (let i = 0; i < tries; i++) { const lines = dimManLines(g, r, voiceOf(r)); if (lines.length) return lines; }
  return [];
}

describe("the Dim Man in talk", () => {
  it("has his whole story, every part in more than one telling, and plenty else said about him", () => {
    expect(DIM_STORY.length).toBeGreaterThanOrEqual(8);
    for (const part of DIM_STORY) expect(part.length).toBeGreaterThanOrEqual(2);
    expect(ANY_MENTION.length).toBeGreaterThanOrEqual(20);
    for (const line of [...STORY, ...ANY_MENTION, ...DIM_LEADS, ...DIM_ENDINGS, ...DIM_CODA, ...DIM_SEEN, ...DIM_KID]) expect(line).not.toMatch(/[{}]/);
  });

  it("comes up now and then: more after dark, more again once the hero's seen him, never most of the time", async () => {
    const g = await inCapital(12), r = grown[0]!;
    const day = dimManChance(g, r);
    g.hour = 23;
    const night = dimManChance(g, r);
    sawDimMan(g);
    const seen = dimManChance(g, r);
    expect(day).toBeGreaterThan(0);
    expect(night).toBeGreaterThan(day);
    expect(seen).toBeGreaterThan(night);
    expect(seen).toBeLessThan(0.5);
    let said = 0;
    for (let i = 0; i < 2000; i++) if (dimManLines(g, grown[i % grown.length]!, "plain").length) said++;
    expect(said / 2000).toBeGreaterThan(seen * 0.6);
    expect(said / 2000).toBeLessThan(seen * 1.4);
  });

  it("tells his story in order, a part at a time, from all over the city, then how it ends", async () => {
    const g = await inCapital(23);
    const heard: number[] = [];
    for (let i = 0; heard.length < DIM_STORY.length && i < 5000; i++) {
      const r = tellers[i % tellers.length]!;
      for (const line of dimManLines(g, r, voiceOf(r))) {
        const part = DIM_STORY.findIndex(p => p.includes(line));
        if (part >= 0) heard.push(part);
      }
    }
    expect(heard).toEqual(DIM_STORY.map((_, i) => i));        // every part, once each, in order
    expect(dimManOf(g).told).toBe(DIM_STORY.length);
    let ending = false;
    for (let i = 0; i < 2000 && !ending; i++) ending = dimManLines(g, tellers[i % tellers.length]!, "plain").some(l => DIM_ENDINGS.includes(l));
    expect(ending).toBe(true);
  });

  it("isn't told by those who deny everything or inform on everyone: they only mention him, their way", async () => {
    const g = await inCapital(23);
    for (const stance of ["denies", "loyal", "informer"] as const) {
      for (const r of grown.filter(p => p.stance === stance).slice(0, 15)) {
        const lines = untilSaid(g, r);
        expect(lines.length).toBeGreaterThan(0);
        expect(lines.some(l => STORY.includes(l))).toBe(false);
        expect(lines.some(l => DIM_MENTIONS[stance === "informer" ? "informer" : "deny"].includes(l))).toBe(true);
      }
    }
    expect(dimManOf(g).told).toBe(0);
  });

  it("knows when the hero's seen him: some say so first", async () => {
    const g = await inCapital(23);
    for (const r of tellers.slice(0, 100)) expect(DIM_SEEN).not.toContain(untilSaid(g, r)[0]);   // not till he has
    const fountain = g.area.layout.props.find(p => p.kind === "fountain")!;
    Object.assign(g.world.need(g.player, "transform"), { x: fountain.x - 4, y: fountain.y + 36 });
    expect(startEerie(g, "watcher")).toBe(true);
    expect(dimManOf(g).seen).toBe(1);
    let first = 0;
    for (const r of tellers.slice(0, 200)) if (DIM_SEEN.includes(untilSaid(g, r)[0]!)) first++;
    expect(first).toBeGreaterThan(80);
  });

  it("is a child's version, from a child", async () => {
    const g = await inCapital(23);
    for (const r of people.filter(p => p.age >= 4 && p.age < 12).slice(0, 20)) {
      const lines = untilSaid(g, r, 2000);
      expect(lines.length).toBe(1);
      expect(DIM_KID).toContain(lines[0]);
    }
    expect(dimManOf(g).told).toBe(0);
  });

  it("comes up in conversation with the townsfolk, before they go", async () => {
    const g = await inCapital(12);
    populate(g, people);
    for (let i = 0; i < 30; i++) updateTownsfolk(g, 0.2);
    g.hour = 23;
    sawDimMan(g);
    const hero = g.world.need(g.player, "transform");
    let found: string[] | null = null;
    for (let i = 0; i < 300 && !found; i++) {
      for (const [e, { transform: t }] of g.world.query("walker", "transform")) {
        Object.assign(hero, { x: t.x, y: t.y + 4 });
        if (!startTalk(g, e)) continue;
        const lines = g.world.get(g.player, "conversation")?.lines ?? [];
        endTalk(g);
        if (lines.some(l => ANY_MENTION.includes(l) || STORY.includes(l) || DIM_SEEN.includes(l) || DIM_KID.includes(l))) { found = lines; break; }
      }
    }
    expect(found).not.toBeNull();
    expect(found!.length).toBeGreaterThan(1);
  });
});
