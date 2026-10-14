// Everyone in Kingsholm, one by one: each person in every household (people.ts) and institution, with a
// name, an age, a job, a personality, the tile and floor where they live, and where they spend the day.
// It's all worked out from the areas' own buildings, so it follows the streets as they change. The named
// families' members are themselves; everyone else is made up, deterministically, from where they live.
import { T, type Rect } from "../data/world.ts";
import { Rng } from "../core/rng.ts";
import type { Prop } from "./area.ts";
import { FAMILIES, INSTITUTIONS, SURNAMES, householdsOf, type District, type Family, type Folk, type Household, type Stance, type Where } from "./people.ts";

export interface Spot {
  area: Where;
  /** The tile (x, y) they're on, and the floor (0 the ground) if they're indoors. */
  x: number;
  y: number;
  floor?: number;
  place: string;
}

export interface Resident {
  id: number;
  name: string;
  sex: "f" | "m";
  age: number;
  job: string;
  /** Their place in the household: head, spouse, child, elder, servant, apprentice, lodger, soldier... */
  role: string;
  /** The named family they belong to (FAMILIES id), if any. */
  family?: string;
  traits: readonly [string, string];
  quirk: string;
  /** What they think of the Edict (their household's). */
  stance: Stance;
  home: Spot;
  day: Spot;
  note?: string;
  /** Locked in the dungeon, not at home. */
  prisoner?: true;
}

/** Every area's props, as built: the city's districts and the King's Bridge. */
export type CityProps = Record<Where, readonly Prop[]>;

/** One of `list`, chosen by `rng`. */
const pick = <V>(rng: Rng, list: readonly V[]): V => list[rng.int(0, list.length - 1)]!;

// ---------- Names and natures ----------
const FEMALE = [
  "Ada", "Agnes", "Alice", "Alys", "Amice", "Annis", "Avice", "Beatrix", "Bess", "Blanche", "Bryony", "Cecily", "Clemence", "Constance",
  "Dulcie", "Edith", "Elaine", "Ella", "Elsa", "Emma", "Eva", "Fern", "Florence", "Gilly", "Godiva", "Grete", "Gwen", "Hawise", "Hilde",
  "Ida", "Isabel", "Isolda", "Jenna", "Joan", "Juliana", "Kat", "Lettice", "Lina", "Mabel", "Maud", "Margery", "Marion", "Mildred",
  "Millie", "Mirabel", "Molly", "Nell", "Nesta", "Olive", "Orla", "Petronel", "Pippa", "Primrose", "Rose", "Rowena", "Sabine", "Sybil",
  "Tamsin", "Tilly", "Una", "Wenna", "Winifred", "Wynn", "Yvette",
] as const;
const MALE = [
  "Adam", "Alan", "Aldo", "Ambrose", "Arno", "Bartle", "Benet", "Bertram", "Bram", "Cedric", "Colin", "Cuthbert", "Davey", "Denis",
  "Drogo", "Edwin", "Elias", "Ellis", "Fulk", "Gareth", "Geoff", "Gil", "Godwin", "Hamo", "Hal", "Hob", "Hugo", "Ivo", "Jack", "Jasper",
  "Jory", "Kit", "Lambert", "Lew", "Martin", "Miles", "Ned", "Nob", "Odo", "Osbert", "Perkin", "Piers", "Ralf", "Randal", "Robin",
  "Roger", "Rowan", "Sim", "Tam", "Tobin", "Tom", "Ulric", "Walt", "Warin", "Watkin", "Wilf", "Will", "Wyn",
] as const;
/** Titles and words before a first name that say who's a woman. */
const SHE = /^(Lady|Queen|Princess|Dowager|Mistress|Widow|Old Mother|Gran|Old Ursula)\b/;
const FEMALE_SET = new Set<string>([...FEMALE, "Isolde", "Rosamund", "Hild", "Ysolde", "Elinor", "Moll", "Bethan", "Philippa", "Margery",
  "Kate", "Peg", "Marian", "Ursula", "Sarra", "Aud", "Helewise", "Lucia", "Meg", "Wren", "Ivy", "Hester", "Nan", "Ruth", "Daisy", "Mary",
  "Agatha", "Tibby"]);

const TRAITS = [
  "cheerful", "grumpy", "nosy", "shy", "brave", "lazy", "hard-working", "forgetful", "clever", "gullible", "kind", "stubborn", "chatty",
  "quiet", "vain", "generous", "stingy", "nervous", "jolly", "proud", "curious", "superstitious", "sensible", "dreamy", "bossy",
  "honest", "sly", "patient", "impatient", "clumsy", "tidy", "messy", "romantic", "sarcastic", "loyal", "gloomy", "hopeful", "fussy",
  "easygoing", "competitive", "polite", "loud", "thoughtful", "mischievous", "gentle", "fearless",
] as const;
/** A named family's members lean the way their household stands on the Edict. */
const STANCE_TRAITS: Record<Stance, readonly string[]> = {
  denies: ["proud", "stubborn", "anxious", "grand"],
  loyal: ["dutiful", "rule-following", "proud", "steady"],
  quiet: ["careful", "watchful", "discreet", "worried"],
  whispering: ["chatty", "nosy", "warm-hearted", "jumpy"],
  defiant: ["brave", "stubborn", "kind-hearted", "outspoken"],
  informer: ["sly", "nervous", "ambitious", "eager to please"],
};
const QUIRKS = [
  "collects buttons", "is afraid of geese", "hums when nervous", "names every pigeon on the square", "never wears the same hat twice",
  "can't whistle and keeps trying", "says good morning to the fountain king", "counts steps everywhere", "sleeps with a horseshoe under the pillow",
  "keeps a lucky turnip", "thinks the moon is a wheel of cheese", "won't eat anything blue", "knits scarves for the guards", "talks to the cat",
  "laughs like a goose", "sneezes in threes", "always has a crust in a pocket", "is learning the lute, badly", "has never once been on time",
  "can name every king backwards", "is sure the well is haunted", "keeps a diary nobody may read", "salts the windowsill twice", "is terrified of the dark",
  "falls asleep in church", "loves a good argument", "carries a little bell to scare off loud weather", "gives everyone nicknames",
  "has a rival at the fountain race", "bakes for the neighbours", "won't walk under the bridge", "collects pretty stones", "tells awful jokes",
  "has a secret sweet tooth", "wants to see the sea", "is writing a ballad", "keeps bees in a pot", "never forgets a face", "always loses gloves",
  "wears rowan in a buttonhole", "sings while working", "is secretly brilliant at dice", "keeps a tally of every slime sighting",
  "is convinced the sheep on the square is a spy", "draws dragons in the margins", "won't say the word 'weather'", "dreams of being a knight",
  "feeds the stray cats on the wall", "hides sweets for children", "practises bowing in the mirror", "keeps a tiny garden on the sill",
  "is scared of Old Mother Larke", "is a little in love with the Crown's pies", "whittles little lions", "tries to climb the fountain every year",
] as const;

// ---------- Jobs ----------
const SPOUSE_JOB = {
  merchant: ["keeps the accounts", "runs the household", "trades lace on the side", "sits on the Mercers' ladies' bench"],
  craft: ["works in the shop", "spins wool", "brews ale for the house", "keeps the shop's books", "sews for the neighbours"],
  labouring: ["takes in washing", "spins wool", "sells eggs in the square", "carries water", "mends nets", "scrubs the Bell's floors"],
} as const;
const SERVANT_JOB = ["maid", "cook", "footman", "nurse", "scullion", "manservant", "laundress", "kitchen boy"] as const;
const ROYAL_SERVANT_JOB = [
  "chamberlain", "steward of the keep", "royal cook", "pastry cook", "lady's maid", "valet", "page", "page", "chambermaid", "chambermaid",
  "royal laundress", "scullion", "scullion", "cupbearer", "royal nurse", "candle-keeper", "kitchen boy", "groom of the chamber",
  "seamstress", "royal tutor", "jester", "musician", "doorkeeper", "fire-tender",
] as const;
const COURT_JOB = ["courtier", "lady-in-waiting", "royal clerk", "herald", "falconer's boy", "messenger", "keeper of the wardrobe", "royal physician"] as const;
const CASTLE_SERVANT_JOB = ["castle cook", "kitchen maid", "scullion", "castle laundress", "castle pot-boy", "castle baker", "castle brewer", "chambermaid", "castle porter", "candle-keeper"] as const;
const GUEST_JOB = [
  "pilgrim", "pilgrim", "carter", "carter", "peddler", "petitioner to the King", "wool buyer from the coast", "minstrel", "tinker",
  "travelling cobbler", "fishmonger from Saltmouth", "knife-grinder", "storyteller", "a quiet traveller in a grey hood",
] as const;
const PLACES_FROM = ["Saltmouth", "Brindle", "Hollowford", "the coast", "Cray", "Westmere", "Thornbury", "the northern hills", "Pennyfield", "Applegarth"] as const;

// ---------- Where things are ----------
/** The buildings people live and work in, found in each area's props. */
interface Places {
  keep: Spot; greatHall: Spot; kitchen: Spot; chapel: Spot; lodgings: Spot; barracks: Spot; storehouse: Spot; smithy: Spot; castleGate: Spot;
  stMarys: Spot; stGiles: Spot; almshouse: Spot; guildhall: Spot; square: Spot; southgate: Spot; stalls: Spot[];
  bridgeGate: Spot; bridge: Spot;
}

const spotIn = (area: Where, r: Rect, place: string, floor?: number): Spot =>
  ({ area, x: Math.floor((r.x + r.w / 2) / T), y: Math.floor((r.y + r.h / 2) / T), place, ...(floor === undefined ? {} : { floor }) });
const middle = (area: Where, props: readonly Prop[], place: string): Spot => {
  const xs = props.flatMap(p => ("rect" in p ? [p.rect.x + p.rect.w / 2] : "x" in p ? [p.x] : []));
  const ys = props.flatMap(p => ("rect" in p ? [p.rect.y + p.rect.h / 2] : "y" in p ? [p.y] : []));
  const avg = (v: number[]) => (v.length ? v.reduce((s, n) => s + n, 0) / v.length : 0);
  return { area, x: Math.floor(avg(xs) / T), y: Math.floor(avg(ys) / T), place };
};

function placesOf(props: CityProps): Places {
  const c = props.castle, m = props.capital, k = props.kingsroad;
  type Hall = Extract<Prop, { kind: "hall" }>;
  const halls = (ps: readonly Prop[]) => ps.filter((p): p is Hall => p.kind === "hall");
  const area = (h: Hall) => h.rect.w * h.rect.h;
  const find = <P extends Prop>(ps: readonly Prop[], test: (p: Prop) => p is P) => ps.find(test);
  const cHalls = halls(c), keepProp = c.find(p => p.kind === "keep");
  const fallbackCastle = keepProp && "rect" in keepProp ? spotIn("castle", keepProp.rect, "the keep") : middle("castle", c, "the castle");
  const castleHall = (test: (h: Hall) => boolean, place: string, pickLargest = false) => {
    const found = cHalls.filter(test).sort((a, b) => (pickLargest ? area(b) - area(a) : 0))[0];
    return found ? spotIn("castle", found.rect, place) : { ...fallbackCastle, place };
  };
  const greatHall = cHalls.filter(h => h.stone && (h.chimneys ?? 0) >= 2).sort((a, b) => area(b) - area(a))[0];
  const rectOf = (ps: readonly Prop[], kind: Prop["kind"], test: (p: Prop) => boolean = () => true) => {
    const p = ps.find(q => q.kind === kind && test(q));
    return p && "rect" in p ? p.rect : undefined;
  };
  const at = (area: Where, r: Rect | undefined, place: string, ps: readonly Prop[]) => (r ? spotIn(area, r, place) : middle(area, ps, place));
  const plaza = find(m, (p): p is Extract<Prop, { kind: "plaza" }> => p.kind === "plaza");
  const wall = find(m, (p): p is Extract<Prop, { kind: "curtainWall" }> => p.kind === "curtainWall");
  const gate = wall?.gates[0]?.at;
  return {
    keep: { ...fallbackCastle },
    greatHall: castleHall(h => h === greatHall, "the great hall"),
    kitchen: castleHall(h => !!h.louvre, "the castle kitchen"),
    chapel: at("castle", rectOf(c, "church"), "the castle chapel", c),
    lodgings: castleHall(h => !h.stone && h.storeys >= 3, "the lodgings"),
    barracks: castleHall(h => h.stone && h.storeys === 2 && h !== greatHall, "the barracks", true),
    storehouse: castleHall(h => h.stone && h.storeys === 1 && !h.louvre, "the storehouse"),
    smithy: at("castle", rectOf(c, "smithy"), "the castle smithy", c),
    castleGate: at("castle", rectOf(c, "barbican"), "the castle gate", c),
    stMarys: at("capital", rectOf(m, "church", p => p.kind === "church" && p.tower === "spire"), "St Mary's", m),
    stGiles: at("capital", rectOf(m, "church", p => p.kind === "church" && p.tower !== "spire"), "St Giles' chapel", m),
    almshouse: at("capital", halls(m).find(h => !h.stone && !h.arcade)?.rect, "the almshouse of St Giles", m),
    guildhall: at("capital", halls(m).find(h => h.arcade)?.rect, "the guildhall", m),
    square: plaza ? { area: "capital", x: Math.floor(plaza.centre.x / T), y: Math.floor(plaza.centre.y / T), place: "the market square" } : middle("capital", m, "the market square"),
    southgate: gate ? { area: "capital", x: Math.floor(gate.x / T), y: Math.floor(gate.y / T) - 1, place: "Southgate" } : middle("capital", m, "Southgate"),
    stalls: m.flatMap(p => (p.kind === "stall" ? [spotIn("capital", p.rect, `a ${p.goods} stall on the square`)] : [])),
    bridgeGate: at("kingsroad", rectOf(k, "barbican"), "the gate tower on the King's Bridge", k),
    bridge: at("kingsroad", rectOf(k, "stoneBridge"), "the King's Bridge", k),
  };
}

// ---------- People ----------
const sexOf = (name: string): "f" | "m" => {
  if (SHE.test(name)) return "f";
  const first = name.replace(/^(Lord|Master|Father|Little|Sergeant|Prince|King|Dean|Old)\s+/, "").replace(/"/g, "").split(" ")[0]!;
  return FEMALE_SET.has(first) ? "f" : "m";
};

class Maker {
  readonly out: Resident[] = [];
  constructor(readonly at: Places) {}

  person(rng: Rng, r: Omit<Resident, "id" | "traits" | "quirk"> & { traits?: readonly [string, string] }): Resident {
    const pool = TRAITS;
    const a = pick(rng, pool);
    let b = pick(rng, pool);
    while (b === a) b = pick(rng, pool);
    const res: Resident = { id: this.out.length + 1, ...r, traits: r.traits ?? [a, b], quirk: pick(rng, QUIRKS) };
    this.out.push(res);
    return res;
  }

  /** A named person's traits: one from their household's stance, one of their own. */
  stanceTraits(rng: Rng, stance: Stance): [string, string] {
    const a = pick(rng, STANCE_TRAITS[stance]);
    let b = pick(rng, TRAITS);
    while (b === a) b = pick(rng, TRAITS);
    return [a, b];
  }

  first(rng: Rng, sex: "f" | "m") { return pick(rng, sex === "f" ? FEMALE : MALE); }

  /** Where someone spends the day, from their job and age. */
  dayOf(rng: Rng, job: string, age: number, home: Spot): Spot {
    const at = this.at, j = job.toLowerCase();
    if (age < 6) return home;
    if (age < 14 && !/apprentice|page|errand|boy|bread|scullion|choir/.test(j)) return rng.next() < 0.4 ? { ...at.stMarys, place: "the song school at St Mary's" } : { ...at.square, place: "playing on the market square" };
    if (age >= 75 && !/king|queen|dean|widow/.test(j)) return home;
    const rules: [RegExp, () => Spot][] = [
      [/bridge watch|watchman/, () => at.bridgeGate],
      [/captain|sergeant of the guard|guard|soldier|archer/, () => pick(rng, [at.castleGate, at.keep, at.barracks, at.southgate])],
      [/priest|dean|deacon|choir|sexton|treasurer|librarian|mason|chandler/, () => at.stMarys],
      [/chaplain/, () => at.stGiles],
      [/clerk|alderman|lawyer|notary|proctor|scrivener/, () => at.guildhall],
      [/royal cook|pastry|castle cook|kitchen|scullion|castle pot-boy|castle baker|castle brewer/, () => at.kitchen],
      [/king|queen|prince|princess|courtier|lady-in-waiting|herald|chamberlain|steward of the keep|valet|lady's maid|chambermaid|page|cupbearer|wardrobe|royal physician|tutor|jester|musician|doorkeeper|fire-tender|chamber|marshal|candle-keeper/, () => at.keep],
      [/armourer|blacksmith|(^| )smith|farrier|fletcher|(^| )bowyer|harness/, () => at.smithy],
      [/storekeeper|castle porter|storehouse/, () => at.storehouse],
      [/falcon/, () => at.castleGate],
      [/fisher/, () => at.bridge],
      [/stall|peddler|egg|fishmonger|flower|greengrocer/, () => pick(rng, at.stalls.length ? at.stalls : [at.square])],
      [/carter|water|laundress|washing|wash|sweep|lamplighter|rag|knife|tinker|storyteller|minstrel|pilgrim|wool buyer|petitioner/, () => at.square],
      [/almsfolk|almshouse/, () => at.almshouse],
    ];
    for (const [test, spot] of rules) if (test.test(j)) return spot();
    return { ...home, place: `${home.place} (works at home)` };
  }

  /** Someone's spot inside a building: a tile within it and a floor up to its storeys. */
  inside(rng: Rng, area: Where, r: Rect, place: string, storeys: number, floor: number): Spot {
    const w = Math.max(1, Math.floor(r.w / T) - 1), h = Math.max(1, Math.floor(r.h / T) - 1);
    return { area, x: Math.floor(r.x / T) + rng.int(0, w - 1), y: Math.floor(r.y / T) + rng.int(0, h - 1), floor: Math.min(floor, storeys - 1), place };
  }
}

/** The ordinary folk of a house: a family (or two or three in a tenement), with servants or apprentices. */
function folkPeople(mk: Maker, rng: Rng, h: Household, f: Folk, n: number, homeName: string) {
  const house = h.house, top = house.storeys - 1;
  const place = (floor: number) => mk.inside(rng, h.district, house.rect, homeName, house.storeys, floor);
  const tenementFloor = Math.min(n, top);
  const famFloor = (upper: boolean) => (h.folk.length > 1 ? tenementFloor : upper ? Math.min(1, top) : 0);
  const stance: Stance = f.rank === "merchant" ? pick(rng, ["loyal", "quiet", "whispering"] as const) : pick(rng, ["quiet", "whispering", "whispering", "loyal", "defiant"] as const);
  let left = f.size;
  const add = (sex: "f" | "m", age: number, job: string, role: string, floor: number, surname = f.surname) => {
    const home = place(floor);
    mk.person(rng, { name: `${mk.first(rng, sex)} ${surname}`, sex, age, job, role, stance, home, day: mk.dayOf(rng, job, age, home) });
    left--;
  };
  const headSex: "f" | "m" = rng.next() < 0.75 ? "m" : "f", headAge = rng.int(26, 62);
  add(headSex, headAge, f.trade, "head", famFloor(true));
  if (left > 0 && rng.next() < 0.88) add(headSex === "m" ? "f" : "m", Math.max(18, headAge + rng.int(-6, 4)), pick(rng, SPOUSE_JOB[f.rank as keyof typeof SPOUSE_JOB] ?? SPOUSE_JOB.craft), "spouse", famFloor(true));
  if (left > 1 && headAge < 50 && rng.next() < 0.3) add(rng.next() < 0.6 ? "f" : "m", Math.min(94, headAge + rng.int(22, 32)), `retired ${f.trade}`, "elder", famFloor(false));
  if (f.rank === "merchant") for (let s = Math.min(3, Math.max(1, Math.floor(f.size / 3))); s > 0 && left > 1; s--) {
    const job = pick(rng, SERVANT_JOB), sex: "f" | "m" = /maid|nurse|laundress/.test(job) ? "f" : /footman|manservant|boy/.test(job) ? "m" : pick(rng, ["f", "m"] as const);
    add(sex, rng.int(14, 55), job, "servant", top, pick(rng, SURNAMES));
  }
  if (f.rank === "craft") for (let s = f.size >= 6 ? 2 : 1; s > 0 && left > 1; s--) add(rng.next() < 0.7 ? "m" : "f", rng.int(12, 19), `apprentice ${f.trade}`, "apprentice", 0, pick(rng, SURNAMES));
  for (let age = headAge - rng.int(18, 26); left > 0; age -= rng.int(1, 4)) {
    const a = Math.max(0, age), job = a < 6 ? "too little to work" : a < 12 ? pick(rng, ["runs errands", "minds the little ones", "goes to the song school"]) : `helps with the ${f.trade}'s work`;
    add(pick(rng, ["f", "m"] as const), a, job, "child", famFloor(false) + (house.storeys > 2 && h.folk.length === 1 ? 1 : 0));
  }
}

/** A named family: its members as written, and its household (servants, apprentices, lodgers) made up. */
function familyPeople(mk: Maker, rng: Rng, f: Family, home: (floor: number) => Spot, top: number) {
  for (const m of f.members) {
    const spot = m.gone ? { ...mk.at.keep, place: "the dungeon under the keep", floor: 0 } : home(m.age < 16 ? top : Math.min(1, top));
    mk.person(rng, {
      name: m.name, sex: sexOf(m.name), age: m.age, job: m.role, role: m.gone ? "prisoner" : "family", family: f.id, stance: f.stance,
      traits: mk.stanceTraits(rng, f.stance), home: spot, day: m.gone ? spot : mk.dayOf(rng, `${m.role} ${f.trade}`, m.age, spot),
      ...(m.note ? { note: m.note } : {}), ...(m.gone ? { prisoner: true as const } : {}),
    });
  }
  for (let i = 0; i < f.household; i++) {
    const job = f.rank === "royal" ? ROYAL_SERVANT_JOB[i % ROYAL_SERVANT_JOB.length]!
      : f.rank === "craft" ? `${i % 2 ? "journeyman" : "apprentice"} to ${f.name.replace(/^The /, "the ")}`
      : f.rank === "labouring" ? "lodger, a porter" : pick(rng, SERVANT_JOB);
    const sex: "f" | "m" = /maid|nurse|laundress|seamstress/.test(job) ? "f" : /valet|page|footman|boy|manservant/.test(job) ? "m" : pick(rng, ["f", "m"] as const);
    const age = /apprentice|page|boy/.test(job) ? rng.int(12, 18) : rng.int(17, 60);
    const spot = home(top);
    mk.person(rng, { name: `${mk.first(rng, sex)} ${pick(rng, SURNAMES)}`, sex, age, job, role: f.rank === "craft" ? "apprentice" : f.rank === "labouring" ? "lodger" : "servant", family: f.id, stance: f.stance, home: spot, day: mk.dayOf(rng, f.rank === "craft" ? `${job} ${f.trade}` : job, age, spot) });
  }
}

/**
 * Everyone in the city, each at a tile and floor. `props` are the areas as built (capital, castle and
 * kingsroad). The same props always give the same people.
 */
export function residentsOf(props: CityProps): Resident[] {
  const at = placesOf(props), mk = new Maker(at);

  // The houses of each district.
  for (const district of ["capital", "castle"] as District[]) {
    for (const h of householdsOf(district, props[district])) {
      const rng = new Rng(Math.floor(h.house.rect.x * 7919 + h.house.rect.y * 104729 + (district === "castle" ? 17 : 0)) + 1);
      if (h.family) {
        const f = h.family;
        familyPeople(mk, rng, f, floor => mk.inside(rng, district, h.house.rect, f.home, h.house.storeys, floor), h.house.storeys - 1);
      } else {
        h.folk.forEach((f, n) => folkPeople(mk, rng, h, f, n, `the ${f.surname} house`));
      }
    }
  }

  // The named families who don't live in a house.
  for (const f of FAMILIES.filter(f => !f.seat)) {
    const rng = new Rng(f.id.length * 1009 + f.id.charCodeAt(0));
    const spot = f.rank === "royal" ? at.keep : f.rank === "clergy" ? at.stMarys : at.almshouse;
    familyPeople(mk, rng, f, floor => ({ ...spot, place: f.home, floor }), 2);
  }

  // The institutions.
  const inst = (name: string) => INSTITUTIONS.find(i => i.name.startsWith(name))?.people ?? 0;
  const crew = (seed: number, count: number, make: (rng: Rng, i: number) => { sex?: "f" | "m"; age: number; job: string; role: string; home: Spot; surname?: string; stance?: Stance }) => {
    const rng = new Rng(seed);
    for (let i = 0; i < count; i++) {
      const m = make(rng, i), sex = m.sex ?? (rng.next() < 0.5 ? "f" : "m");
      mk.person(rng, { name: `${mk.first(rng, sex)} ${m.surname ?? pick(rng, SURNAMES)}`, sex, age: m.age, job: m.job, role: m.role, stance: m.stance ?? "quiet", home: m.home, day: mk.dayOf(rng, m.job, m.age, m.home) });
    }
  };
  const room = (s: Spot, floor: number) => ({ ...s, floor });
  crew(101, inst("The Royal Guard"), (rng, i) => ({
    sex: rng.next() < 0.8 ? "m" : "f", age: rng.int(18, 50), role: "soldier", stance: "loyal", home: room(at.barracks, rng.int(0, 1)),
    job: i === 0 ? "captain of the garrison" : i < 9 ? "sergeant of the guard" : pick(rng, ["guard", "guard", "guard", "archer", "gate guard", "keep guard"]),
  }));
  crew(103, inst("The bridge watch"), (rng, i) => ({ sex: rng.next() < 0.8 ? "m" : "f", age: rng.int(17, 45), role: "soldier", stance: "quiet", home: room(at.bridgeGate, rng.int(0, 2)), job: i === 0 ? "corporal of the bridge watch" : "bridge watchman" }));
  crew(107, inst("The court"), (rng, i) => {
    const courtier = i < 14, job = courtier ? COURT_JOB[i % COURT_JOB.length]! : pick(rng, CASTLE_SERVANT_JOB);
    return { age: courtier ? rng.int(20, 66) : rng.int(13, 58), job, role: courtier ? "courtier" : "servant", stance: courtier ? "loyal" : "whispering",
      home: courtier ? room(at.lodgings, rng.int(0, 2)) : /cook|kitchen|scullion|pot-boy|baker|brewer/.test(job) ? room(at.kitchen, 0) : room(at.greatHall, 1) };
  });
  crew(109, inst("The priests"), (rng, i) => {
    const job = i < 6 ? "priest of St Mary's" : i < 8 ? "deacon" : "choirboy";
    return { sex: i < 8 ? pick(rng, ["f", "m"] as const) : "m", age: job === "choirboy" ? rng.int(8, 14) : rng.int(24, 70), job, role: job === "choirboy" ? "choir" : "clergy", stance: "quiet", home: { ...at.stMarys, place: "the clergy house and song school, St Mary's", floor: rng.int(0, 1) } };
  });
  crew(113, inst("The masons"), (rng, i) => ({ sex: rng.next() < 0.75 ? "m" : "f", age: rng.int(15, 58), job: i < 5 ? "journeyman mason" : "mason's labourer", role: "lodger", stance: "defiant", home: { ...at.stMarys, place: "the masons' lodge by St Mary's", floor: 0 } }));
  crew(127, inst("The almshouse"), (rng, i) => ({ age: i === 0 ? rng.int(40, 55) : rng.int(66, 92), job: i === 0 ? "warden and chaplain of St Giles'" : pick(rng, ["almsfolk, once a weaver", "almsfolk, once a carter", "almsfolk, once a cook", "almsfolk, once a sailor", "almsfolk"]), role: i === 0 ? "warden" : "almsfolk", stance: "whispering", home: room(at.almshouse, rng.int(0, 1)) }));
  const inns = mk.out.filter(r => r.family === "maddox" || r.family === "pike").map(r => r.home);
  crew(131, inst("Guests"), (rng, i) => {
    const inn = inns.length ? inns[i % inns.length]! : at.square, job = pick(rng, GUEST_JOB);
    return { age: rng.int(16, 70), job: `${job}${job.startsWith("a quiet") ? "" : `, from ${pick(rng, PLACES_FROM)}`}`, role: "guest", stance: "whispering", home: { ...inn, place: `${inn.place} (a guest)`, floor: 2 } };
  });
  return mk.out;
}
