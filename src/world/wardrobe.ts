// How each of the city's people dresses: worked out once from who they are (their sex, age, job, household
// rank and nature) and kept on them (Resident.dress), so the same baker always wears the same floury apron.
// It draws on its own hash of their name, never the census's random numbers, so it changes nobody else.
import { FAMILIES, type Rank, type Stance } from "./people.ts";

export type Garment = "tunic" | "long tunic" | "smock" | "doublet" | "gown" | "kirtle" | "robe";
export type Over = "none" | "apron" | "cloak" | "surcoat" | "shawl" | "tabard" | "vest";
export type Headwear = "bare" | "coif" | "kerchief" | "wimple" | "veil" | "cap" | "chaperon" | "hood" | "straw" | "felt";
export type Carry = "none" | "basket" | "sack" | "bundle" | "staff" | "bucket" | "tools" | "book" | "flowers";
/** How the garment's cloth is made up: one colour, split down the middle in two (mi-parti), or banded at the hem. */
export type Pattern = "plain" | "parti" | "banded";

export interface Dress {
  garment: Garment;
  pattern: Pattern;
  /** The garment's cloth, a second colour (the other half, the bands, the over-garment), and belt and hem. */
  cloth: string;
  second: string;
  trim: string;
  over: Over;
  head: Headwear;
  /** Hair, where it shows. */
  hair: string;
  /** A feather in the hat, a pouch at the belt, a brooch at the throat. */
  feather: boolean;
  pouch: boolean;
  brooch: boolean;
  shoes: string;
  carry: Carry;
}

/** Cloth by what it cost: undyed and earth colours for most, cheap dyes, rich dyes for merchants, black for clergy. */
export const DYES = {
  undyed: ["#b8a07a", "#a8946e", "#c9b896", "#8f7d5f", "#9a8a72"],
  earth: ["#8a6a4a", "#6b4f3a", "#7a6f62", "#5d4a3a", "#6f7a4a", "#4f5a3a", "#8f6f4f"],
  cheap: ["#5d6a7d", "#4f6b5a", "#9a5a3e", "#7a5a6a", "#6a7a8a", "#8a7a3a", "#5a6a4a", "#a8845a"],
  rich: ["#2f4f8a", "#8a2f3a", "#2f6b4a", "#5a3a7a", "#7a5a2a", "#a83a2a", "#2a5a6a", "#6a2a4a"],
  clergy: ["#2b2830", "#3a3540", "#2f2a26"],
  linen: ["#ece4d0", "#e0d6bc", "#d2c6a8", "#f2ead8"],
  hair: ["#3a2a1e", "#5a3a22", "#7a5030", "#2a221e", "#a8743a", "#c8a050", "#8a3a22", "#4a3a30"],
  grey: ["#9a948a", "#b8b2a8", "#d8d4cc"],
  leather: ["#4f3a2a", "#5d4430", "#3a2e24", "#6b4f3a"],
} as const;

/** What someone needs to be dressed: the census's facts about them. */
export interface Wearer {
  name: string;
  sex: "f" | "m";
  age: number;
  job: string;
  role: string;
  family?: string;
  traits: readonly [string, string];
  stance: Stance;
}

/** A number in [0, 1) for this person and `k`: their own, from their name. */
function chance(name: string, k: number): number {
  let h = 2166136261 ^ k;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/** How someone dresses, from who they are. */
export function dressFor(p: Wearer): Dress {
  const n = (k: number) => chance(p.name, k), pick = <V>(list: readonly V[], k: number): V => list[Math.floor(n(k) * list.length)]!;
  const job = p.job.toLowerCase(), female = p.sex === "f", child = p.age < 14, old = p.age >= 60;
  const rank: Rank | undefined = p.family ? FAMILIES.find(f => f.id === p.family)?.rank : undefined;
  const has = (t: string) => p.traits.includes(t);
  const is = (re: RegExp) => re.test(job);
  // What they can afford, and what they'd choose.
  const clergy = is(/priest|deacon|chaplain|choir|warden|sexton|dean/);
  const wealthy = (rank === "merchant" && p.role === "family") || is(/alderman|lawyer|notary|mercer|goldsmith|vintner/);
  const poor = rank === "poor" || p.role === "almsfolk" || is(/almsfolk|rag|beggar|sweep|scullion|pot-boy/);
  const servant = p.role === "servant" || is(/maid|cook|scullion|nurse|laundress|footman|manservant|kitchen|chambermaid|porter/);
  const smith = is(/smith|armourer|farrier|forge/), mason = is(/mason/), baker = is(/baker|bread|pastry|cook/);
  const market = is(/stall|egg|flower|greengrocer|fish|sells|peddler|produce/), traveller = p.role === "guest";
  const showy = has("vain") || has("proud") || has("romantic"), drab = has("gloomy") || has("stingy") || has("quiet") || has("shy");
  const dyes = clergy ? DYES.clergy : wealthy ? DYES.rich : poor ? DYES.undyed : showy ? DYES.cheap : drab ? DYES.earth : n(1) < 0.5 ? DYES.earth : n(1) < 0.8 ? DYES.cheap : DYES.undyed;

  const garment: Garment = clergy ? "robe" : female ? (child ? "kirtle" : n(2) < 0.55 ? "gown" : "kirtle")
    : child ? "tunic" : wealthy ? (n(2) < 0.6 ? "doublet" : "long tunic") : old ? "long tunic"
    : is(/carter|labour|porter|water|mason|sweep|groom|hand/) ? "smock" : n(2) < 0.7 ? "tunic" : "long tunic";
  const pattern: Pattern = clergy || poor ? "plain" : wealthy && n(3) < 0.4 ? "parti" : showy && n(3) < 0.35 ? "parti" : n(3) < 0.18 ? "banded" : "plain";

  const over: Over = clergy ? (n(4) < 0.5 ? "cloak" : "none")
    : smith || baker || servant || is(/apprentice|journeyman|butcher|cobbler|weaver|dyer|brewer|cook/) ? "apron"
    : wealthy ? (female ? (n(4) < 0.5 ? "surcoat" : "cloak") : n(4) < 0.5 ? "cloak" : "tabard")
    : traveller ? "cloak" : female && old ? "shawl" : female ? (n(4) < 0.3 ? "apron" : n(4) < 0.45 ? "shawl" : "none")
    : n(4) < 0.15 ? "vest" : n(4) < 0.25 ? "cloak" : "none";

  const head: Headwear = clergy ? (is(/choir/) ? "bare" : "hood")
    : female ? (old ? (n(5) < 0.6 ? "wimple" : "coif") : child ? (n(5) < 0.6 ? "bare" : "kerchief") : wealthy ? (n(5) < 0.6 ? "veil" : "wimple")
      : servant || baker ? "coif" : market ? (n(5) < 0.5 ? "straw" : "kerchief") : pick(["coif", "coif", "kerchief", "bare", "straw", "veil"] as const, 5))
    : child ? (n(5) < 0.7 ? "bare" : "cap") : wealthy ? (n(5) < 0.6 ? "chaperon" : "felt") : traveller ? (n(5) < 0.5 ? "hood" : "felt")
    : smith || mason ? (n(5) < 0.6 ? "cap" : "bare") : market || is(/carter|water|field|garden/) ? "straw"
    : pick(["cap", "cap", "hood", "felt", "bare", "bare", "chaperon"] as const, 5);

  const carry: Carry = traveller ? (is(/pilgrim/) ? "staff" : n(6) < 0.5 ? "bundle" : "sack")
    : market ? (is(/flower/) ? "flowers" : "basket") : is(/water/) ? "bucket" : smith || mason || is(/carpenter|cooper|wright/) ? "tools"
    : clergy || is(/clerk|scrivener|notary|lawyer|tutor/) ? (n(6) < 0.5 ? "book" : "none") : is(/carter|porter|miller/) ? "sack"
    : old && n(6) < 0.4 ? "staff" : female && n(6) < 0.25 ? "basket" : n(6) < 0.06 ? "bundle" : "none";

  const second = pattern === "parti" ? pick(wealthy ? DYES.rich : DYES.cheap, 7) : over === "apron" || over === "vest" ? pick(DYES.linen, 7)
    : pick(wealthy ? DYES.rich : clergy ? DYES.clergy : DYES.earth, 7);
  return {
    garment, pattern, over, head, carry,
    cloth: pick(dyes, 8),
    second: second === pick(dyes, 8) ? pick(DYES.undyed, 9) : second,
    trim: wealthy ? (n(10) < 0.6 ? "#d9a83a" : "#c8c0b0") : pick(DYES.leather, 10),
    hair: old ? pick(DYES.grey, 11) : pick(DYES.hair, 11),
    feather: (head === "felt" || head === "cap" || head === "chaperon") && (showy || wealthy) && n(12) < 0.6,
    pouch: !child && !clergy && n(13) < (wealthy ? 0.8 : 0.4),
    brooch: (wealthy || showy) && n(14) < 0.5,
    shoes: pick(DYES.leather, 15),
  };
}
