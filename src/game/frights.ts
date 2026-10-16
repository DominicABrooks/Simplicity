// The townsfolk remember being frightened. When the city does something uncanny after dark (src/game/eerie.ts) and
// they run for it, each of them remembers what it was, where, and when; and the next time the hero talks to one of
// them, it's the first thing they want to talk about, put together from src/data/frighttalk.ts: when it was, what
// they saw, what they make of it (by where they stand on the Edict), and what they'll do now, more or less of it by
// their voice. Later on they bring it up again now and then, shorter, until they've told it enough times or a few
// days have gone by. They remember across runs, like the hour: the city doesn't forget.
import type { Rng } from "../core/rng.ts";
import { SECONDS_PER_HOUR, SUNRISE } from "../data/daylight.ts";
import type { EerieId } from "../data/eerie.ts";
import {
  AFTER, FRIGHT_MEMORY, FRIGHT_PLACE_ELSE, FRIGHT_PLACES, FRIGHT_TALK, KID_AFTER, OPENERS, WHEN, type Take, type When,
} from "../data/frighttalk.ts";
import type { Voice } from "../data/voices.ts";
import { T } from "../data/world.ts";
import type { Stance } from "../world/people.ts";
import type { Resident } from "../world/residents.ts";
import type { Game } from "./game.ts";

/** One person's fright: what, where (as they'd say it), when (hours since the game began), and how often they've told it. */
export interface Fright { id: EerieId; where: string; at: number; told: number }

interface Memories { hours: number; who: Map<number, Fright> }
const memories = new WeakMap<Game, Memories>();
function memoriesOf(g: Game): Memories {
  let m = memories.get(g);
  if (!m) memories.set(g, m = { hours: g.hour, who: new Map() });
  return m;
}

/** What this person remembers being frightened by, if anything (for the tests and the debug handle). */
export const frightOf = (g: Game, id: number): Fright | undefined => memories.get(g)?.who.get(id);

/** Every frame of play: the clock they remember by runs on. */
export function tickFrights(g: Game, dt: number): void {
  memoriesOf(g).hours += dt / SECONDS_PER_HOUR;
}

/** Where (x, y) (px) is, as the townsfolk would say it. */
export function placeOf(g: Game, at: { x: number; y: number }): string {
  const here = FRIGHT_PLACES[g.area.def.id];
  if (!here) return FRIGHT_PLACE_ELSE;
  const tx = Math.floor(at.x / T), ty = Math.floor(at.y / T);
  return here.places.find(([x0, y0, x1, y1]) => tx >= x0 && tx <= x1 && ty >= y0 && ty <= y1)?.[4] ?? here.else;
}

/** These townsfolk (census ids) just took fright at this, here: they'll remember it (the latest fright over any older one). */
export function rememberFright(g: Game, ids: readonly number[], id: EerieId, at: { x: number; y: number }): void {
  const m = memoriesOf(g), where = placeOf(g, at);
  for (const who of ids) m.who.set(who, { id, where, at: m.hours, told: 0 });
}

/** Which day it is (from one sunrise to the next, so a night belongs with the day before it), by the remembering clock. */
const dayOf = (hours: number) => Math.floor((hours - SUNRISE) / 24);

/** How long ago it was, as they'd say it, or null if it's long enough ago they've put it behind them. */
export function whenOf(g: Game, f: Fright): When | null {
  const now = memoriesOf(g).hours, days = dayOf(now) - dayOf(f.at);
  if (days >= FRIGHT_MEMORY.days) return null;
  if (now - f.at < 0.6) return "now";                       // a quarter of a minute: they're still running
  return days === 0 ? "tonight" : days === 1 ? "lastNight" : "before";
}

/** How they take it, by where they stand on the Edict (and the Dim Man too: src/game/dimman.ts). */
const TAKE: Record<Stance, Take> = { denies: "deny", loyal: "deny", quiet: "shaken", whispering: "hushed", defiant: "defiant", informer: "informer" };
export const takeOf = (stance: Stance): Take => TAKE[stance];

const pick = <T>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng.next() * list.length)]!;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fill = (line: string, where: string, when: string) =>
  line.replace(/\{where\}/g, where).replace(/\{Where\}/g, cap(where)).replace(/\{when\}/g, when).replace(/\{When\}/g, cap(when));

/**
 * What they've to say about their fright, if they've one on their mind (to go after their greeting), in their voice:
 * the whole story the first time, now and then a word about it after, nothing once they've put it behind them.
 */
export function frightLines(g: Game, r: Resident, voice: Voice): string[] {
  const m = memoriesOf(g), f = m.who.get(r.id);
  if (!f) return [];
  const when = whenOf(g, f);
  if (!when || f.told >= FRIGHT_MEMORY.tellings) { m.who.delete(r.id); return []; }
  const rng = g.rng, talk = FRIGHT_TALK[f.id], say = (line: string) => fill(line, f.where, WHEN[when]);
  const first = f.told === 0;
  f.told++;
  if (!first) return rng.next() < FRIGHT_MEMORY.again ? [say(pick(rng, r.age < 12 ? talk.kid : talk.again))] : [];
  if (r.age < 12) return rng.next() < 0.5 ? [say(pick(rng, talk.kid)), pick(rng, KID_AFTER)] : [say(pick(rng, talk.kid))];

  const take = TAKE[r.stance], lines: string[] = [];
  // How much they say: the gruff say what it was and what they think, the shy just what it was and what they'll do,
  // the chatty everything; the rest most of it. Still running from it, everyone starts with that.
  const opener = when === "now" || voice === "chatty" || (voice !== "gruff" && voice !== "shy" && rng.next() < 0.6);
  const thinks = voice !== "shy";
  const after = take !== "deny" && voice !== "gruff" && (voice === "chatty" || voice === "shy" || rng.next() < 0.5);
  if (opener) lines.push(say(pick(rng, OPENERS[when])));
  lines.push(say(pick(rng, talk.saw)));
  if (thinks) lines.push(say(pick(rng, talk.take[take])));
  if (after) lines.push(say(pick(rng, AFTER)));
  return lines;
}
