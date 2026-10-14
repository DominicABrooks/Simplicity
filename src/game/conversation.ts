// What people say when you talk to them, put together from src/data/voices.ts. Everyone talks in their
// own voice (from their personality) about one to four things, picked by weight from what they have to
// talk about: their work, their family, their quirk, where they live, the city, the hero, the Edict, and
// only rarely a rumour. Gruff people say one thing and go; chatty ones go on. The named families talk
// about themselves: their family's saying, and what the city says about them.
import type { Rng } from "../core/rng.ts";
import type { GiftKind } from "../data/items.ts";
import {
  ABOUT_US, AGAIN, ANNOYED, BYE, CITY, DEEP, EDICT, FOND_BYE, FOND_OPEN, GIFT, GREET, GUARD, GUARD_AGAIN, HERO, INTRO, KID, KID_AGAIN, KIN, PLACE, QUIRK,
  RUMOUR, SOFTENED, VOICE_OF, WORK, WORK_ANY, type GiftLine, type Mood, type Voice,
} from "../data/voices.ts";
import { FAMILIES, type Family } from "../world/people.ts";
import type { Resident } from "../world/residents.ts";

const pick = <T>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng.next() * list.length)]!;
const fill = (line: string, vars: Record<string, string | number>) => line.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
const firstName = (r: Resident) => r.name.replace(/^(Lord|Lady|Master|Mistress|Father|Old Mother|Old|Little|Widow|Gran)\s+/, "").replace(/"/g, "").split(" ")[0]!;
const rumours = FAMILIES.flatMap(f => f.rumours);

/** Their voice: from the first of their traits that has one. */
export const voiceOf = (r: Resident): Voice => r.traits.map(t => VOICE_OF[t]).find(v => v !== undefined) ?? "plain";

/** Verbs a job can start with ("keeps the accounts"), and words that make a job a family role ("eldest son"). */
const DOES = /^(keeps|helps|minds|brews|trades|works|goes|sews|sits|spins|runs|takes|scrubs|sells|carries|mends|cleans|cooks|bakes|washes|tends|watches|feeds|fetches|guards|makes|plays)\b/;
const KIN_WORD = /^(son|daughter|wife|husband|mother|father|eldest|youngest|middle|twin|grand)/;
const IRREGULAR: Record<string, string> = { has: "have", goes: "go", does: "do" };
/** A verb as "I" would say it: "collects" to "collect", "carries" to "carry", "washes" to "wash", "has" to "have". */
const base = (verb: string) =>
  IRREGULAR[verb] ?? (verb.endsWith("ies") ? `${verb.slice(0, -3)}y` : /(ch|sh|ss|x)es$/.test(verb) ? verb.slice(0, -2) : verb.endsWith("s") ? verb.slice(0, -1) : verb);

/** What someone does, in their own words: "I keep the accounts.", "I'm a baker.", "I'm the eldest son." */
export function jobLine(job: string): string {
  const verb = DOES.exec(job)?.[1];
  if (verb) return `I ${base(verb)}${job.slice(verb.length)}.`;
  if (/^too /.test(job) || /^[A-Z][a-z]+'s /.test(job)) return `I'm ${job}.`;
  const said = job.replace(/^(Her|His|Their) /, "the "), lower = said.charAt(0).toLowerCase() + said.slice(1);
  if (/^(the |a |an |almsfolk)/.test(lower)) return `I'm ${lower}.`;
  if (KIN_WORD.test(lower)) return `I'm the ${lower}.`;
  return `I'm ${/^[aeiou]/.test(lower) ? "an" : "a"} ${lower}.`;
}

/** What someone does, in their own words without the full stop ("I'm a baker") or someone else's ("is a baker"). */
export function workOf(job: string, person: 1 | 3): string {
  const mine = jobLine(job).slice(0, -1);
  if (person === 1) return mine;
  return mine.startsWith("I'm ") ? `is ${mine.slice(4)}` : job;
}

/** A quirk said by its owner: "collects buttons" to "I collect buttons", "is afraid of geese" to "I'm afraid of geese". */
export function firstPerson(quirk: string): string {
  // A second verb after "and" turns too: "can't whistle and keeps trying" to "...and keep trying".
  const [w, ...rest] = quirk.split(" "), tail = rest.join(" ").replace(/ and (\w+s) /g, (_, v: string) => ` and ${base(v)} `);
  if (w === "is") return `I'm ${tail}`;
  if (w === "has") return `I have ${tail}`;
  if (w === "can" || w === "can't" || w === "won't") return `I ${w} ${tail}`;
  if (w === "never" || w === "always") { const [v, ...more] = rest; return `I ${w} ${base(v!)} ${more.join(" ")}`.trim(); }
  return `I ${base(w!)} ${tail}`.trim();
}

/** What a housemate is to the speaker: wife, son, gran, housemate... */
function relation(me: Resident, them: Resident): string {
  const f = them.sex === "f", parent = (x: Resident) => x.role === "head" || x.role === "spouse";
  if (them.role === "servant" || them.role === "apprentice" || them.role === "lodger" || me.role === "servant" || me.role === "apprentice") return "housemate";
  if (them.name.split(" ").pop() !== me.name.split(" ").pop()) return "neighbour";
  if (parent(me) && parent(them)) return f ? "wife" : "husband";
  if (me.role === "child" && parent(them)) return f ? "mum" : "dad";
  if (parent(me) && them.role === "child") return f ? "daughter" : "son";
  if (me.role === "child" && them.role === "child") return f ? "sister" : "brother";
  if (them.role === "elder") return me.role === "child" ? (f ? "gran" : "grandad") : f ? "mum" : "dad";
  return "housemate";
}

/** A named family's own saying, without its quotes or stage directions. */
const sayingOf = (f: Family) => /"([^"]+)"/.exec(f.mutter)?.[1] ?? f.mutter;

/** Something they might talk about. Personal ones (who they are, their quirk, their housemates) make the conversation theirs. */
/**
 * A rumour as its subject would tell it: "" if it isn't about them, "I'm a tattletale" from "Gilbert Pike is a
 * tattletale" if it starts with them, or null if it names them somewhere awkward to turn round (so it's left out).
 */
export function aboutMe(says: string, r: Resident): string | null {
  const words = r.name.replace(/"/g, "").split(" "), surname = words[words.length - 1]!, first = firstName(r);
  const title = /^(Lord|Lady|Master|Mistress|Father|Old Mother|Old|Widow|Gran)\b/.exec(r.name)?.[1];
  const forms = [r.name, `${first} ${surname}`, title && `${title} ${first}`, title && `${title} ${surname}`, `The ${r.job}`, first]
    .filter((f): f is string => !!f).sort((a, b) => b.length - a.length);
  for (const f of forms) {
    if (says.startsWith(`${f}'s `)) return `my ${says.slice(f.length + 3)}`;
    if (says.startsWith(`${f} `)) return firstPerson(says.slice(f.length + 1)).replace(/\b(his|her)\b/g, "my");
  }
  return forms.some(f => new RegExp(`\\b${f}\\b`).test(says)) ? null : "";
}

type Topic = { weight: number; say: () => string; personal?: true };

/** Pick `count` topics by weight, never the same twice; the first from the personal ones if `personalFirst`. */
function choose(rng: Rng, topics: Topic[], count: number, personalFirst: boolean): string[] {
  const said: string[] = [];
  for (let i = 0; i < count && topics.length; i++) {
    const open = topics.map((t, at) => ({ t, at })).filter(({ t }) => i > 0 || !personalFirst || t.personal);
    if (!open.length) break;
    let roll = rng.next() * open.reduce((s, { t }) => s + t.weight, 0), k = 0;
    while (k < open.length - 1 && roll > open[k]!.t.weight) roll -= open[k++]!.t.weight;
    said.push(topics.splice(open[k]!.at, 1)[0]!.say());
  }
  return said;
}

const NEVER_CROSS = new Set(["kind", "patient", "gentle", "warm-hearted", "kind-hearted", "generous", "polite"]);
const SHORT_FUSE = new Set(["impatient", "grumpy", "sarcastic", "bossy"]);

/**
 * How someone takes being talked to after `visits` talks before (0 is meeting them). Most warm up and
 * open up; the gruff and short-tempered get fed up, and after enough visits soften; the plain warm up and
 * then tire of you; the kind and patient never get cross. `level` is how fed up they are, 0 to 3.
 */
export function moodOf(r: Resident, visits: number): { mood: Mood | "first"; level: number } {
  if (visits === 0) return { mood: "first", level: 0 };
  const voice = voiceOf(r), kind = r.traits.some(t => NEVER_CROSS.has(t)), short = r.traits.some(t => SHORT_FUSE.has(t));
  if (!kind && (voice === "gruff" || short)) {
    if (visits === 1) return { mood: "again", level: 0 };
    return visits >= 6 ? { mood: "softened", level: 0 } : { mood: "annoyed", level: Math.min(3, visits - 2) };
  }
  if (voice === "shy") return visits < 3 ? { mood: "again", level: 0 } : { mood: "fond", level: 0 };
  if (voice === "plain") {
    if (visits === 1) return { mood: "again", level: 0 };
    return visits < 5 || kind ? { mood: "fond", level: 0 } : { mood: "annoyed", level: Math.min(3, visits - 5) };
  }
  return visits === 1 ? { mood: "again", level: 0 } : { mood: "fond", level: 0 };
}

/** One of `list` for this visit: each visit the next one along, so no two visits running open the same way. */
const inTurn = <T>(list: readonly T[], r: Resident, visits: number): T => list[(r.id + visits) % list.length]!;

/** Whether someone may hand the hero this: they haven't given him anything yet, and it fits in his bag. */
export type CanGive = (kind: GiftKind) => boolean;
const NOTHING: CanGive = () => false;
/** The gift lines of `lines` that can be given. */
const giftable = (lines: readonly GiftLine[], gives: CanGive) => lines.filter(l => gives(l.gives));
const GENEROUS = new Set(["generous", "kind", "kind-hearted", "warm-hearted"]);

const AREA_NAME: Record<string, string> = { capital: "the Market Quarter", castle: "the Castleward", kingsroad: "Kingsholm" };

/**
 * One of the townsfolk's conversation. `housemates` are the others under their roof (from the census),
 * so they can talk about their family; `visits` is how many times the hero has talked to them before, so
 * they can warm up, open up, or get fed up (see moodOf). `gives` says whether they may hand the hero
 * something: bakers a loaf, fishers a koi, a child who likes you a shiny stone, the warm-hearted some bread.
 */
export function folkLines(rng: Rng, r: Resident, housemates: readonly Resident[] = [], visits = 0, gives: CanGive = NOTHING): string[] {
  const name = firstName(r), voice = voiceOf(r);
  if (r.age < 4) return [pick(rng, KID.tiny)];
  if (r.age < 12 && visits > 0) {
    const lines = [pick(rng, visits >= 3 ? KID_AGAIN.friend : KID_AGAIN.again), rng.next() < 0.3 ? `${firstPerson(r.quirk)}!` : pick(rng, KID.talk)];
    const stones = visits >= 3 ? giftable(GIFT.kid, gives) : [];
    if (stones.length) lines.splice(1, 0, pick(rng, stones).say);
    if (rng.next() < 0.5) lines.push(pick(rng, KID.bye));
    return lines;
  }
  if (r.age < 12) {
    const lines = [pick(rng, KID.greet), fill(pick(rng, KID.intro), { name, age: r.age, next: r.age + 1 })];
    lines.push(rng.next() < 0.3 ? `${firstPerson(r.quirk)}!` : pick(rng, KID.talk));
    if (rng.next() < 0.5) lines.push(pick(rng, KID.talk.filter(l => !lines.includes(l))));
    if (rng.next() < 0.6) lines.push(pick(rng, KID.bye));
    return rng.next() < 0.4 ? lines.slice(1) : lines;
  }

  // The named families' own members talk about the family; their servants and apprentices are just people.
  const family = r.family && r.role === "family" ? FAMILIES.find(f => f.id === r.family) : undefined;
  const kin = family ? [] : housemates.filter(h => h.id !== r.id && !h.prisoner && h.role !== "family" && firstName(h) !== name);
  const trade = `${r.job} ${family?.trade ?? ""}`.toLowerCase();
  const workLine = () => pick(rng, WORK.find(([test]) => test.test(trade))?.[1] ?? WORK_ANY);
  const workGifts = giftable(GIFT.work.find(([test]) => test.test(trade))?.[1] ?? [], gives);
  const intro = () => (family
    ? `I'm ${name}${family.name.startsWith("The ") ? `, of ${family.name.replace(/^The /, "the ")}` : ""}. ${family.trade}.`
    : fill(pick(rng, INTRO[voice]), { name, work: workOf(r.job, 1) }));
  const topics: Topic[] = [
    { weight: 3, say: intro, personal: true },
    { weight: 2, say: workLine },
    { weight: 2, say: () => fill(pick(rng, QUIRK[voice]), { q: firstPerson(r.quirk) }).replace(/^./, c => c.toUpperCase()), personal: true },
    { weight: 1.5, say: () => pick(rng, PLACE[r.home.area] ?? CITY) },
    { weight: 1.5, say: () => pick(rng, CITY) },
    { weight: 1.5, say: () => pick(rng, HERO) },
    { weight: r.stance === "whispering" ? 0.6 : 1, say: () => pick(rng, EDICT[r.stance] ?? EDICT.quiet!) },
    { weight: voice === "chatty" || r.stance === "whispering" ? 0.6 : 0.15, say: () => `${pick(rng, RUMOUR)} "${pick(rng, rumours).says}."` },
  ];
  if (workGifts.length) topics.push({ weight: 1.5, say: () => pick(rng, workGifts).say });
  if (kin.length) {
    topics.push({ weight: 2, say: () => {
      const k = pick(rng, kin), kn = firstName(k);
      return fill(pick(rng, KIN), { rel: relation(r, k), kin: kn, kwork: workOf(k.job, 3), kq: `${kn} ${k.quirk}` });
    }, personal: true });
  }
  if (family) {
    topics.push({ weight: 3, say: () => sayingOf(family) });
    // What the city says about the family. A rumour about someone else in it is quoted; one about the
    // speaker is turned round, so they say "I", never their own name.
    const told = family.rumours.flatMap(said => {
      const mine = aboutMe(said.says, r);
      return mine === null ? [] : [{ said, mine }];
    });
    if (told.length) topics.push({ weight: 2, say: () => {
      const { said, mine } = pick(rng, told);
      const line = mine ? fill(pick(rng, ABOUT_US.self), { said: mine }) : fill(pick(rng, ABOUT_US.lead), { said: said.says });
      return `${line} ${pick(rng, ABOUT_US[said.truth])}`;
    } });
  }

  // How much they say: gruff and shy folk say little, chatty folk say a lot.
  const many = { gruff: [1, 1], shy: [1, 2], plain: [1, 2], dreamy: [2, 2], warm: [2, 3], chatty: [3, 4] }[voice];
  const count = many[0]! + Math.floor(rng.next() * (many[1]! - many[0]! + 1));
  // Talking again: they know you now, and it shows.
  const { mood, level } = moodOf(r, visits);
  if (mood === "annoyed") {
    const lines = [inTurn(ANNOYED[level]!, r, visits)];
    if (level === 0 && rng.next() < 0.5) lines.push(...choose(rng, topics.filter(t => t.say !== intro), 1, false));
    return lines;
  }
  if (mood === "again") {
    const lines = [pick(rng, AGAIN[voice]), ...choose(rng, topics.filter(t => t.say !== intro), Math.max(1, count - 1), false)];
    if (rng.next() < 0.6) lines.push(pick(rng, BYE[voice]));
    return lines;
  }
  if (mood === "fond" || mood === "softened") {
    const deep = deepLines(r, kin, family);
    const lines = [inTurn(mood === "fond" ? FOND_OPEN : SOFTENED, r, visits)];
    for (let i = 0; i < (mood === "fond" ? (voice === "chatty" ? 3 : 2) : 1) && deep.length; i++) lines.push(deep.splice(Math.floor(rng.next() * deep.length), 1)[0]!(rng));
    const bread = mood === "fond" && (voice === "warm" || r.traits.some(t => GENEROUS.has(t))) ? giftable(GIFT.fond, gives) : [];
    if (bread.length && rng.next() < 0.5) lines.push(pick(rng, bread).say);
    if (mood === "fond") lines.push(pick(rng, FOND_BYE));
    return lines;
  }

  // The first thing they say is always about themselves; after that, anything.
  const said = choose(rng, topics, count, true);
  // Someone who says only one thing still says who they are.
  if (said.length === 1 && !said[0]!.includes(name)) said.unshift(intro());
  const lines = [...(rng.next() < (voice === "gruff" ? 0.6 : 0.85) ? [pick(rng, GREET[voice])] : []), ...said];
  if (rng.next() < (voice === "gruff" ? 0.5 : 0.65)) lines.push(pick(rng, BYE[voice]));
  return lines;
}

/**
 * What someone tells you once they know you: the deeper lines they can fill in (and, for the named
 * families, the family secret, if it isn't about them), each filled in as it's said.
 */
function deepLines(r: Resident, kin: readonly Resident[], family: Family | undefined): ((rng: Rng) => string)[] {
  const trade = jobLine(r.job).startsWith("I'm ") ? jobLine(r.job).slice(4, -1) : "doing this";
  const children = kin.filter(k => ["son", "daughter"].includes(relation(r, k)));
  const needsKin = /\{(kin|rel)\}/;
  const out = DEEP.filter(l => (!needsKin.test(l) || kin.length > 0) && (!l.includes("{child}") || children.length > 0)).map(l => (rng: Rng) => {
    const k = kin.length ? pick(rng, kin) : undefined, c = children.length ? pick(rng, children) : undefined;
    return fill(l, { trade, place: AREA_NAME[r.home.area] ?? "this city", ...(k ? { kin: firstName(k), rel: relation(r, k) } : {}), ...(c ? { child: firstName(c) } : {}) });
  });
  if (family?.secret && aboutMe(family.secret, r) === "") out.push(() => `Can I trust you with something? ${family.secret}`);
  return out;
}

/**
 * A guard's conversation: a greeting, a word about their post, now and then something more, and goodbye.
 * The same guard, talked to again, gets friendly, then personal (and, if `gives` lets them, hands over some
 * bread), then fed up with you.
 */
export function guardLines(rng: Rng, area: string, visits = 0, gives: CanGive = NOTHING): string[] {
  if (visits >= 5) return [pick(rng, GUARD_AGAIN.annoyed)];
  if (visits >= 3) {
    const personal = [...GUARD_AGAIN.personal], first = personal.splice(Math.floor(rng.next() * personal.length), 1)[0]!;
    const bread = giftable(GIFT.guard, gives);
    return [first, bread.length ? pick(rng, bread).say : pick(rng, personal), pick(rng, GUARD.bye)];
  }
  if (visits >= 1) return [pick(rng, GUARD_AGAIN.again), rng.next() < 0.5 ? pick(rng, GUARD_AGAIN.personal) : pick(rng, GUARD.duty)];
  const lines = [pick(rng, GUARD.greet), pick(rng, GUARD.post[area] ?? GUARD.post.any!)];
  const more = rng.next();
  if (more < 0.35) lines.push(pick(rng, GUARD.duty));
  else if (more < 0.55) lines.push(pick(rng, HERO));
  else if (more < 0.65) lines.push(`${pick(rng, RUMOUR)} "${pick(rng, rumours).says}."`);
  if (rng.next() < 0.7) lines.push(pick(rng, GUARD.bye));
  return lines;
}
