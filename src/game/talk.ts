// Talking to people. Clicking someone friendly who can talk (a guard, or one of the townsfolk), or pressing E while they're
// your target, starts a conversation instead of an attack: their lines come one at a time in a box at the
// bottom of the screen. A click, Enter, Space or E shows the rest of a line or goes on to the next;
// Escape, or walking away, ends it. It lives on the hero (see Conversation), so it's gone with the area.
import type { Entity } from "../core/ecs.ts";
import { FOLK_TALK, GUARD_TALK, TALK } from "../data/dialogue.ts";
import type { Rng } from "../core/rng.ts";
import { FAMILIES } from "../world/people.ts";
import type { Resident } from "../world/residents.ts";
import { residentById } from "./townsfolk.ts";
import { toast, type Game } from "./game.ts";

/** Can this be talked to? Friendly people only: guards and the townsfolk. */
export function canTalk(g: Game, e: Entity | null): e is Entity {
  return e !== null && (g.world.has(e, "sentry") || g.world.has(e, "walker")) && g.world.get(e, "targetable")?.hostile === false;
}

/** The conversation the hero is in, if any. */
export const talking = (g: Game) => g.world.get(g.player, "conversation") ?? null;

/** Start talking to someone, if they can talk and are close enough. Returns whether they could talk at all. */
export function startTalk(g: Game, e: Entity | null): boolean {
  if (!canTalk(g, e)) return false;
  const hero = g.world.need(g.player, "transform"), them = g.world.need(e, "transform");
  if (Math.hypot(hero.x - them.x, hero.y - them.y) > TALK.reach) { toast(g, "Too far away to talk"); return true; }
  const name = g.world.need(e, "targetable").name;
  const who = g.world.get(e, "walker"), resident = who && residentById(who.id);
  const lines = resident ? folkLines(g.rng, resident) : guardLines(g.rng, g.area.def.id);
  g.world.add(g.player, "conversation", { with: e, name, lines, line: 0, t: 0 });
  return true;
}

/** Show the rest of the line, or go on to the next, or end it after the last. */
export function advanceTalk(g: Game): void {
  const c = talking(g);
  if (!c) return;
  const shown = Math.floor(c.t * TALK.charsPerSecond);
  if (shown < c.lines[c.line]!.length) { c.t = c.lines[c.line]!.length / TALK.charsPerSecond; return; }
  if (++c.line >= c.lines.length) endTalk(g);
  else c.t = 0;
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

/** A guard's conversation: a greeting, a word about their post, a rumour from the city, and goodbye. */
function guardLines(rng: Rng, area: string): string[] {
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rng.next() * list.length)]!;
  const rumours = FAMILIES.flatMap(f => f.rumours);
  return [
    pick(GUARD_TALK.greet),
    pick(GUARD_TALK.post[area] ?? GUARD_TALK.post.any!),
    `${pick(GUARD_TALK.rumour)} "${pick(rumours).says}."`,
    pick(GUARD_TALK.bye),
  ];
}

/**
 * One of the townsfolk's conversation, in their own words: hello, who they are and what they do, what the
 * neighbours say about them (their quirk), where they stand on the Edict (or, if they whisper, a rumour),
 * and goodbye.
 */
function folkLines(rng: Rng, r: Resident): string[] {
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rng.next() * list.length)]!;
  const first = r.name.split(" ")[0]!;
  if (r.age < 12) return [`Hello! I'm ${first}. I'm ${r.age}.`, pick(FOLK_TALK.child), `${pick(FOLK_TALK.quirk)} ${first} ${r.quirk}.`];
  const edict = FOLK_TALK.edict[r.stance] ?? [];
  const rumours = FAMILIES.flatMap(f => f.rumours);
  return [
    `${pick(FOLK_TALK.greet)} I'm ${first}. ${jobLine(r.job)}`,
    `${pick(FOLK_TALK.quirk)} ${first} ${r.quirk}. ${pick(FOLK_TALK.quirkAfter)}`,
    edict.length ? pick(edict) : `${pick(GUARD_TALK.rumour)} "${pick(rumours).says}."`,
    pick(FOLK_TALK.bye),
  ];
}

/** What someone does, as they'd say it: "I keep the accounts.", "I'm a baker.", "I'm almsfolk, once a weaver." */
export function jobLine(job: string): string {
  const verb = /^(keeps|runs|trades|sits|works|spins|brews|sews|takes|sells|carries|mends|scrubs)\b/.exec(job)?.[1];
  if (verb) return `I ${verb.endsWith("ies") ? verb.slice(0, -3) + "y" : verb.slice(0, -1)}${job.slice(verb.length)}.`;
  if (/^(almsfolk|the |a |an )/.test(job)) return `I'm ${job}.`;
  return `I'm ${/^[aeiou]/i.test(job) ? "an" : "a"} ${job}.`;
}
