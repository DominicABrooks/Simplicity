// What people say: everyone in their own voice, in their own words, about different things, and only
// now and then a rumour. Checked over the whole census, so no two conversations come out the same.
import { describe, expect, it } from "vitest";
import { area as capital } from "../src/areas/capital.ts";
import { area as castle } from "../src/areas/castle.ts";
import { area as kingsroad } from "../src/areas/kingsroad.ts";
import { Rng } from "../src/core/rng.ts";
import { AGAIN, ANNOYED, FOND_BYE, FOND_OPEN, RUMOUR, SOFTENED } from "../src/data/voices.ts";
import { aboutMe, firstPerson, folkLines, guardLines, moodOf, voiceOf, workOf } from "../src/game/conversation.ts";
import { residentsOf, type Resident } from "../src/world/residents.ts";

const people = residentsOf({ capital: capital.build().props, castle: castle.build().props, kingsroad: kingsroad.build().props });
const byId = new Map(people.map(r => [r.id, r]));
const housemates = (r: Resident) => [-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6].flatMap(d => {
  const o = byId.get(r.id + d);
  return o && o.home.place === r.home.place && o.home.area === r.home.area ? [o] : [];
});
const rng = new Rng(7);
// Everyone you could meet out walking (the under-fours stay in, and only babble anyway).
const speakers = people.filter(r => !r.prisoner && r.age >= 4);
const talks = speakers.map(r => folkLines(rng, r, housemates(r)));
/** Every third of them, talked to again and again: their talks on visits 0 to 7. */
const regulars = speakers.filter((_, i) => i % 3 === 0);
const visited = regulars.map(r => Array.from({ length: 8 }, (_, v) => folkLines(rng, r, housemates(r), v)));
const hasRumour = (lines: string[]) => lines.some(l => RUMOUR.some(lead => l.startsWith(lead)));

describe("conversations", () => {
  it("are never the same twice across the city", () => {
    const whole = talks.map(t => t.join(" | "));
    expect(new Set(whole).size).toBe(whole.length);
  });

  it("don't lean on any one line: none is said in more than one conversation in twenty", () => {
    const uses = new Map<string, number>();
    for (const t of talks) for (const l of new Set(t)) uses.set(l, (uses.get(l) ?? 0) + 1);
    const most = Math.max(...uses.values());
    expect(most / talks.length).toBeLessThan(0.05);
  });

  it("only now and then pass on a rumour", () => {
    expect(talks.filter(hasRumour).length / talks.length).toBeLessThan(0.15);
  });

  it("vary in length, from a word to a good long chat", () => {
    const lengths = new Set(talks.map(t => t.length));
    expect(Math.min(...lengths)).toBeLessThanOrEqual(2);
    expect(Math.max(...lengths)).toBeGreaterThanOrEqual(5);
  });

  it("come in every voice", () => {
    expect(new Set(people.map(voiceOf))).toEqual(new Set(["warm", "gruff", "shy", "chatty", "dreamy", "plain"]));
  });

  it("never have anyone talk about themselves by name, except to say who they are", () => {
    const strip = (n: string) => n.replace(/^(Lord|Lady|Master|Mistress|Father|Old Mother|Old|Little|Widow|Gran)\s+/, "").replace(/"/g, "").split(" ")[0]!;
    speakers.forEach((r, i) => {
      const name = strip(r.name), says = new RegExp(`\\b${name}\\b`);
      const introducing = new RegExp(`(I'm|I'm\\.\\.\\.|Name's|name's|Call me|call me) ${name}\\b|^(Um, )?${name}(\\.|,|\\.\\.\\.)`);
      for (const l of talks[i]!) if (says.test(l)) expect(l, r.name).toMatch(introducing);
    });
    regulars.forEach((r, i) => {
      const name = strip(r.name), says = new RegExp(`\\b${name}\\b`);
      for (const l of visited[i]!.slice(1).flat()) expect(says.test(l), `${r.name}: ${l}`).toBe(false);
    });
  });

  it("leave no placeholders unfilled", () => {
    for (const t of [...talks, ...visited.flat()]) for (const l of t) expect(l).not.toMatch(/\{\w+\}/);
  });

  it("from guards, vary too, and rarely carry rumours", () => {
    const g = Array.from({ length: 300 }, () => guardLines(rng, "capital"));
    expect(new Set(g.map(t => t.join(" | "))).size).toBeGreaterThan(200);
    expect(g.filter(hasRumour).length / g.length).toBeLessThan(0.2);
  });
});

describe("talking to someone again and again", () => {
  const find = (test: (r: Resident) => boolean) => speakers.find(r => r.age >= 12 && !r.family && test(r))!;
  const said = (r: Resident, v: number) => folkLines(new Rng(v + 1), r, housemates(r), v);

  it("they know you on the second visit", () => {
    const r = find(r => voiceOf(r) === "warm");
    expect(AGAIN.warm).toContain(said(r, 1)[0]);
  });

  it("the warm thank you for stopping and open up about their lives", () => {
    const r = find(r => voiceOf(r) === "warm");
    const third = said(r, 2);
    expect(FOND_OPEN).toContain(third[0]);
    expect(FOND_BYE).toContain(third[third.length - 1]);
    expect(third.length).toBeGreaterThanOrEqual(3);
  });

  it("the gruff get fed up, worse each time, and soften in the end", () => {
    const r = find(r => voiceOf(r) === "gruff" && !r.traits.some(t => ["kind", "patient", "gentle", "generous", "polite"].includes(t)));
    expect(moodOf(r, 2)).toEqual({ mood: "annoyed", level: 0 });
    expect(ANNOYED[0]).toContain(said(r, 2)[0]);
    expect(ANNOYED[3]).toContain(said(r, 5)[0]);
    expect(SOFTENED).toContain(said(r, 6)[0]);
  });

  it("the kind never get cross, however often you come", () => {
    for (const r of speakers.filter(r => r.age >= 12 && r.traits.some(t => ["kind", "patient", "gentle"].includes(t)))) {
      for (let v = 0; v < 10; v++) expect(moodOf(r, v).mood, r.name).not.toBe("annoyed");
    }
  });

  it("never says the same thing two visits running", () => {
    for (const talks of visited.filter((_, i) => regulars[i]!.age >= 12)) {
      for (let v = 1; v < talks.length; v++) expect(talks[v]!.join(" | ")).not.toBe(talks[v - 1]!.join(" | "));
    }
  });

  it("guards, too: friendly, then personal, then fed up", () => {
    const g = new Rng(3);
    expect(guardLines(g, "castle", 6)).toHaveLength(1);
    expect(guardLines(g, "castle", 3)).toHaveLength(3);
  });
});

describe("rumours about yourself", () => {
  const someone = (name: string, job = "baker") => people.find(r => r.name === name) ?? ({ ...people[0]!, name, job });
  it.each([
    ["Gilbert Pike", "Gilbert Pike is a tattletale", "I'm a tattletale"],
    ["Hal Stott", "Hal Stott is courting someone", "I'm courting someone"],
    ["Cuthbert Pike", "Cuthbert Pike warns people when his father's listening", "I warn people when my father's listening"],
    ["Elinor Hawke", "Elinor Hawke's birds talk back", "my birds talk back"],
    ["Old Ursula Cleave", "Old Ursula started the feud over a sausage", "I started the feud over a sausage"],
    ["Master Simon Quill", "Master Quill wrote the Edict", "I wrote the Edict"],
    ["Roger Stott", "Gilbert Pike is a tattletale", ""],
    ["Tamsin Larke", "Ivy can light a candle without a flint, and Tamsin has seen her do it", null],
  ])("%s on \"%s\": \"%s\"", (name, says, mine) => expect(aboutMe(says, someone(name))).toBe(mine));
});

describe("saying it in your own words", () => {
  it.each([
    ["collects buttons", "I collect buttons"],
    ["is afraid of geese", "I'm afraid of geese"],
    ["has a rival at the fountain race", "I have a rival at the fountain race"],
    ["always has a crust in a pocket", "I always have a crust in a pocket"],
    ["never forgets a face", "I never forget a face"],
    ["can name every king backwards", "I can name every king backwards"],
    ["won't eat anything blue", "I won't eat anything blue"],
    ["can't whistle and keeps trying", "I can't whistle and keep trying"],
    ["carries a little bell to scare off loud weather", "I carry a little bell to scare off loud weather"],
  ])("%s: %s", (quirk, said) => expect(firstPerson(quirk)).toBe(said));

  it.each([
    ["baker", "is a baker"],
    ["keeps the accounts", "keeps the accounts"],
    ["apprentice to the Maddoxes", "is an apprentice to the Maddoxes"],
  ])("someone else's work, %s: %s", (job, said) => expect(workOf(job, 3)).toBe(said));
});
