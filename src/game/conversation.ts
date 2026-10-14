// What people say when you talk to them, put together from src/data/voices.ts. Everyone talks in their
// own voice (from their personality) about one to four things, picked by weight from what they have to
// talk about: their work, their family, their quirk, where they live, the city, the hero, the Edict, and
// only rarely a rumour. Gruff people say one thing and go; chatty ones go on. The named families talk
// about themselves: their family's saying, and what the city says about them.
import type { Rng } from "../core/rng.ts";
import { ABOUT_US, BYE, CITY, EDICT, GREET, GUARD, HERO, INTRO, KID, KIN, PLACE, QUIRK, RUMOUR, VOICE_OF, WORK, WORK_ANY, type Voice } from "../data/voices.ts";
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
  const [w, ...rest] = quirk.split(" "), tail = rest.join(" ");
  if (w === "is") return `I'm ${tail}`;
  if (w === "has") return `I have ${tail}`;
  if (w === "can" || w === "can't" || w === "won't") return `I ${quirk}`;
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
  return forms.some(f => new RegExp(`\b${f}\b`).test(says)) ? null : "";
}

type Topic = { weight: number; say: () => string; personal?: true };

/**
 * One of the townsfolk's conversation. `housemates` are the others under their roof (from the census),
 * so they can talk about their family.
 */
export function folkLines(rng: Rng, r: Resident, housemates: readonly Resident[] = []): string[] {
  const name = firstName(r), voice = voiceOf(r);
  if (r.age < 4) return [pick(rng, KID.tiny)];
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
  const workLine = () => pick(rng, WORK.find(([test]) => test.test(`${r.job} ${family?.trade ?? ""}`.toLowerCase()))?.[1] ?? WORK_ANY);
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
  // The first thing they say is always about themselves; after that, anything.
  const said: string[] = [];
  for (let i = 0; i < count && topics.length; i++) {
    const open = topics.map((t, at) => ({ t, at })).filter(({ t }) => i > 0 || t.personal);
    let roll = rng.next() * open.reduce((s, { t }) => s + t.weight, 0), k = 0;
    while (k < open.length - 1 && roll > open[k]!.t.weight) roll -= open[k++]!.t.weight;
    said.push(topics.splice(open[k]!.at, 1)[0]!.say());
  }
  // Someone who says only one thing still says who they are.
  if (said.length === 1 && !said[0]!.includes(name)) said.unshift(intro());
  const lines = [...(rng.next() < (voice === "gruff" ? 0.6 : 0.85) ? [pick(rng, GREET[voice])] : []), ...said];
  if (rng.next() < (voice === "gruff" ? 0.5 : 0.65)) lines.push(pick(rng, BYE[voice]));
  return lines;
}

/** A guard's conversation: a greeting, a word about their post, now and then something more, and goodbye. */
export function guardLines(rng: Rng, area: string): string[] {
  const lines = [pick(rng, GUARD.greet), pick(rng, GUARD.post[area] ?? GUARD.post.any!)];
  const more = rng.next();
  if (more < 0.35) lines.push(pick(rng, GUARD.duty));
  else if (more < 0.55) lines.push(pick(rng, HERO));
  else if (more < 0.65) lines.push(`${pick(rng, RUMOUR)} "${pick(rng, rumours).says}."`);
  if (rng.next() < 0.7) lines.push(pick(rng, GUARD.bye));
  return lines;
}
