// What people say: everyone in their own voice, in their own words, about different things, and only
// now and then a rumour. Checked over the whole census, so no two conversations come out the same.
import { describe, expect, it } from "vitest";
import { area as capital } from "../src/areas/capital.ts";
import { area as castle } from "../src/areas/castle.ts";
import { area as kingsroad } from "../src/areas/kingsroad.ts";
import { Rng } from "../src/core/rng.ts";
import { RUMOUR } from "../src/data/voices.ts";
import { aboutMe, firstPerson, folkLines, guardLines, voiceOf, workOf } from "../src/game/conversation.ts";
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
  });

  it("leave no placeholders unfilled", () => {
    for (const t of talks) for (const l of t) expect(l).not.toMatch(/\{\w+\}/);
  });

  it("from guards, vary too, and rarely carry rumours", () => {
    const g = Array.from({ length: 300 }, () => guardLines(rng, "capital"));
    expect(new Set(g.map(t => t.join(" | "))).size).toBeGreaterThan(200);
    expect(g.filter(hasRumour).length / g.length).toBeLessThan(0.2);
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
    ["carries a little bell to scare off loud weather", "I carry a little bell to scare off loud weather"],
  ])("%s: %s", (quirk, said) => expect(firstPerson(quirk)).toBe(said));

  it.each([
    ["baker", "is a baker"],
    ["keeps the accounts", "keeps the accounts"],
    ["apprentice to the Maddoxes", "is an apprentice to the Maddoxes"],
  ])("someone else's work, %s: %s", (job, said) => expect(workOf(job, 3)).toBe(said));
});
