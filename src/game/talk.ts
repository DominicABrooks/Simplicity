// Talking to people. Clicking someone friendly who can talk (a guard, or one of the townsfolk), or pressing E while they're
// your target, starts a conversation instead of an attack: their lines come one at a time in a box at the
// bottom of the screen. A click, Enter, Space or E shows the rest of a line or goes on to the next;
// Escape, or walking away, ends it. It lives on the hero (see Conversation), so it's gone with the area.
// Some lines hand the hero something (the gift lines in src/data/voices.ts): it lands in the bag as the
// line is said. Each person gives at most once a run, and only offers if it'll fit in the bag.
import type { Entity } from "../core/ecs.ts";
import { TALK } from "../data/dialogue.ts";
import { WARDEN_TALK, WOODWARDEN } from "../data/ashwild.ts";
import { KING_AGAIN, KING_AUDIENCE, KING_WATCHWORD_AGAIN, KINGS_TASK } from "../data/king.ts";
import { KING_AFTER, KING_NO_PROOF, KING_STEPS } from "../data/ending.ts";
import { isGhostRumour } from "../data/ghost.ts";
import type { GiftKind } from "../data/items.ts";
import { GIFT_OF } from "../data/voices.ts";
import { T } from "../data/world.ts";
import type { Resident } from "../world/residents.ts";
import { makeGift } from "../items/items.ts";
import { folkLines, guardLines, voiceOf, type CanGive } from "./conversation.ts";
import { frightLines } from "./frights.ts";
import { dimManLines } from "./dimman.ts";

export { jobLine } from "./conversation.ts";
import { residentById } from "./townsfolk.ts";
import { toast, type Game } from "./game.ts";
import { handPaper, passedBarricade } from "./watchword.ts";
import { heardRumour } from "./ghost.ts";
import { curioClue } from "./clues.ts";
import { gilLines, isGil } from "./quay.ts";
import { isYssa, yssaAsking, yssaAsks, yssaLines } from "./yssa.ts";
import { spiritLines } from "./spirits.ts";
import { beaten } from "./bosses.ts";
import { endingTalk, headLaid } from "./ending.ts";
import { carryingHead } from "./head.ts";

/** Can this be talked to? Friendly people only: guards and the townsfolk. */
export function canTalk(g: Game, e: Entity | null): e is Entity {
  return e !== null && (g.world.has(e, "sentry") || g.world.has(e, "walker")) && g.world.get(e, "targetable")?.hostile === false;
}

/** The conversation the hero is in, if any. */
export const talking = (g: Game) => g.world.get(g.player, "conversation") ?? null;

/**
 * Start talking to someone, if they can talk and are close enough. Returns whether they could talk at all.
 * Whoever you talk to (or try to) becomes your target, so the ring is always on the person talking.
 */
export function startTalk(g: Game, e: Entity | null): boolean {
  if (!canTalk(g, e)) return false;
  g.target = e;
  const hero = g.world.need(g.player, "transform"), them = g.world.need(e, "transform");
  if (Math.hypot(hero.x - them.x, hero.y - them.y) > TALK.reach) { toast(g, "Too far away to talk"); return true; }
  const name = g.world.need(e, "targetable").name;
  const who = g.world.get(e, "walker"), resident = who && residentById(who.id);
  // Who this is, to remember them by: the King, a townsperson by their census id, a guard by their post.
  const isKing = g.world.get(e, "renderable")?.kind === "king";
  const key = isKing ? "king" : resident ? `folk:${resident.id}` : `guard:${g.area.def.id}:${Math.round(them.x / T)},${Math.round(them.y / T)}`;
  const visits = chatsWith(g).get(key) ?? 0;
  chatsWith(g).set(key, visits + 1);
  // They only offer something if they haven't given the hero anything yet and it'll fit in the bag.
  const gives: CanGive = kind => !giftsFrom(g).has(key) && g.inventory.freeSpot(makeGift(kind)) !== null;
  // The King gives you your task the first time, and reminds you of it after.
  if (isKing && visits === 0 && !beaten(g, "calder")) toast(g, KINGS_TASK, true);
  // The woodwardens at the barricade ask for the King's watchword, and hand him paper to write it on; once he's through, he's through.
  const warden = name === WOODWARDEN.name, yssa = isYssa(g, e), asking = (warden && !passedBarricade(g)) || (yssa && yssaAsking(g));
  // At the end, the townsfolk and the guards have only one thing to talk about (src/game/ending.ts).
  const ending = !isKing && (resident || g.world.has(e, "sentry")) && !warden && !yssa && !isGil(g, e) && !g.world.has(e, "spirit")
    ? endingTalk(g, key, resident, who?.crowd?.mode === "follow") : null;
  const lines = ending ? ending : isKing ? kingLines(g, visits)
    : warden ? [...(asking ? WARDEN_TALK.ask : WARDEN_TALK.through)]
    : yssa ? yssaLines(g)
    : g.world.has(e, "spirit") ? spiritLines(g, e)
    : isGil(g, e) ? gilLines(g)
    : resident ? folkLines(g.rng, resident, housematesOf(resident), visits, gives) : guardLines(g.rng, g.area.def.id, visits, gives);
  // Now and then they notice a curiosity he's carrying, and have something to say about it, after their greeting.
  const clue = resident && !ending ? curioClue(g) : null;
  if (clue) lines.splice(Math.min(1, lines.length), 0, clue);
  // And if something after dark frightened them lately (src/game/frights.ts), that comes first, after their greeting.
  const fright = resident && !ending ? frightLines(g, resident, voiceOf(resident)) : [];
  if (fright.length) lines.splice(Math.min(1, lines.length), 0, ...fright);
  // Or, now and then, the Dim Man (src/game/dimman.ts): a word about him, or the next of his story, before they go.
  const dim = resident && !ending && !fright.length ? dimManLines(g, resident, voiceOf(resident)) : [];
  if (dim.length) lines.splice(Math.max(1, lines.length - 1), 0, ...dim);
  g.world.add(g.player, "conversation", { with: e, name, key, lines, line: 0, t: 0, ...(asking ? { then: "paper" as const } : {}) });
  said(g);
  return true;
}

/** What the King says: his task the first time, and reminders after; once Calder's gone, he wants the proof, and once he's had it, thanks. */
function kingLines(g: Game, visits: number): string[] {
  if (headLaid(g)) return [KING_AFTER[Math.max(0, visits - 1) % KING_AFTER.length]!];
  if (beaten(g, "calder")) return [...(carryingHead(g) ? KING_STEPS : KING_NO_PROOF)];
  return visits === 0 ? [...KING_AUDIENCE] : [KING_AGAIN[(visits - 1) % KING_AGAIN.length]!, KING_WATCHWORD_AGAIN];
}

/** Everyone who has given the hero something this run, by their key: nobody gives twice. */
const gifts = new WeakMap<Game, Set<string>>();
export function giftsFrom(g: Game): Set<string> {
  let given = gifts.get(g);
  if (!given) {
    const fresh = new Set<string>();
    gifts.set(g, given = fresh);
    g.events.on("reset", () => fresh.clear());
  }
  return given;
}

/**
 * A line has just begun: if it passes on the ghost story, the hero's heard it once more; if it hands something over,
 * into the bag it goes (or, if the bag filled up meanwhile, it doesn't).
 */
function said(g: Game): void {
  const c = talking(g);
  if (c && isGhostRumour(c.lines[c.line]!)) heardRumour(g);
  const kind = c && GIFT_OF.get(c.lines[c.line]!);
  if (c && kind) receive(g, c.key, kind);
}

/**
 * `key` hands the hero a gift, once: into the bag, or if it's full, "Inventory full" and they'll give it
 * another time.
 */
export function receive(g: Game, key: string, kind: GiftKind): void {
  if (giftsFrom(g).has(key)) return;
  const item = makeGift(kind);
  if (!g.inventory.add(item)) { toast(g, "Inventory full"); return; }
  giftsFrom(g).add(key);
  toast(g, `Received ${item.name}`, true);
}

/** Someone says `lines` to the hero, wherever he is (a cutscene's speech): a conversation like any other. */
export function speak(g: Game, e: Entity, key: string, lines: readonly string[]): void {
  g.target = e;
  g.world.add(g.player, "conversation", { with: e, name: g.world.need(e, "targetable").name, key, lines: [...lines], line: 0, t: 0 });
  said(g);
}

/**
 * How many times the hero has talked to each person this run, so they can warm up or get fed up with
 * him. A new run (the hero waking again) starts everyone afresh.
 */
const chats = new WeakMap<Game, Map<string, number>>();
export function chatsWith(g: Game): Map<string, number> {
  let met = chats.get(g);
  if (!met) {
    const fresh = new Map<string, number>();
    chats.set(g, met = fresh);
    g.events.on("reset", () => fresh.clear());
  }
  return met;
}

/** Show the rest of the line, or go on to the next, or end it after the last. */
export function advanceTalk(g: Game): void {
  const c = talking(g);
  if (!c) return;
  const shown = Math.floor(c.t * TALK.charsPerSecond);
  if (shown < c.lines[c.line]!.length) { c.t = c.lines[c.line]!.length / TALK.charsPerSecond; return; }
  if (++c.line < c.lines.length) { c.t = 0; said(g); return; }
  endTalk(g);
  if (c.then === "paper") handPaper(g, c.with, isYssa(g, c.with) ? yssaAsks(g) : "watchword");   // heard out: now he writes
}

export function endTalk(g: Game): void {
  g.world.remove(g.player, "conversation");
}

/** Every frame: the line types out, and the conversation ends if they're gone or the hero walks off. */
export function updateTalk(g: Game, dt: number): void {
  const c = talking(g);
  if (!c) return;
  const them = g.world.get(c.with, "transform"), hero = g.world.need(g.player, "transform");
  if (g.state !== "play" || !them || Math.hypot(hero.x - them.x, hero.y - them.y) > TALK.leave) { endTalk(g); return; }
  c.t += dt;
}

/** The others under someone's roof: the census lists a household together, so they're the near ids at the same home. */
function housematesOf(r: Resident): Resident[] {
  const out: Resident[] = [];
  for (let d = -12; d <= 12; d++) {
    const o = d === 0 ? undefined : residentById(r.id + d);
    if (o && o.home.area === r.home.area && o.home.place === r.home.place && Math.abs(o.home.x - r.home.x) <= 6 && Math.abs(o.home.y - r.home.y) <= 6) out.push(o);
  }
  return out;
}
