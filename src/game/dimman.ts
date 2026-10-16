// The Dim Man in conversation (the story and the lines are in src/data/dimman.ts). Now and then, talking to the
// hero, one of the townsfolk mentions him, more often after dark and more again once the hero's seen him for
// himself (src/game/eerie.ts); and sometimes, instead, they tell the next part of who he was. The city tells his
// story in order, one part a telling, whoever's telling it, so a hero who listens hears all of it in the end; after
// that they tell how it ends, as they'd end it. Those who deny everything deny him too, and the informers only want
// to know where he was. How much is said goes by the teller's voice, as ever. Like the frights, the city keeps
// track across runs.
import type { Rng } from "../core/rng.ts";
import { isDay } from "../data/daylight.ts";
import { DIM_CODA, DIM_ENDINGS, DIM_KID, DIM_LEADS, DIM_MAN, DIM_MENTIONS, DIM_SEEN, DIM_STORY } from "../data/dimman.ts";
import type { Voice } from "../data/voices.ts";
import type { Resident } from "../world/residents.ts";
import { takeOf } from "./frights.ts";
import type { Game } from "./game.ts";

/** How much of his story the hero's been told (parts), and how many times he's seen him. */
export interface DimMan { told: number; seen: number }

const states = new WeakMap<Game, DimMan>();
export function dimManOf(g: Game): DimMan {
  let s = states.get(g);
  if (!s) states.set(g, s = { told: 0, seen: 0 });
  return s;
}

/** The hero's just seen him, at the end of a street or in the trees. */
export function sawDimMan(g: Game): void {
  dimManOf(g).seen++;
}

const pick = <T>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng.next() * list.length)]!;

/** The chance this one brings him up at all, now. */
export function dimManChance(g: Game, r: Resident): number {
  if (r.age < 12) return DIM_MAN.kid;
  const C = DIM_MAN.chance;
  return (isDay(g.hour) ? C.day : C.night) + (dimManOf(g).seen > 0 ? C.seen : 0);
}

/**
 * What they've to say about the Dim Man this time, if anything (most of the time, nothing): a mention, or the next
 * part of his story, in their voice.
 */
export function dimManLines(g: Game, r: Resident, voice: Voice): string[] {
  const rng = g.rng, s = dimManOf(g);
  if (rng.next() >= dimManChance(g, r)) return [];
  if (r.age < 12) return [pick(rng, DIM_KID)];
  const take = takeOf(r.stance), lines: string[] = [];
  if (s.seen > 0 && take !== "deny" && rng.next() < 0.6) lines.push(pick(rng, DIM_SEEN));
  // The deniers and the informers have nothing to tell; everyone else sometimes tells the next of it.
  if (take === "deny" || take === "informer" || rng.next() >= DIM_MAN.story) {
    lines.push(pick(rng, DIM_MENTIONS[take]));
    return lines;
  }
  if (voice !== "gruff") lines.push(pick(rng, DIM_LEADS));
  if (s.told < DIM_STORY.length) lines.push(pick(rng, DIM_STORY[s.told++]!));
  else lines.push(pick(rng, DIM_ENDINGS));
  if (voice !== "gruff" && (voice === "chatty" || rng.next() < 0.5)) lines.push(pick(rng, DIM_CODA));
  return lines;
}
