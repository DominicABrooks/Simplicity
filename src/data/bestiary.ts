// The journal's bestiary: every kind of enemy, with a little about each. Numbers come from the
// tuning tables, so the journal can't drift from the game.
import { MAGE, SCHOOLS, SLIME, SPELLS, type School } from "./enemies.ts";
import { GHOST, GHOST_NAME } from "./ghost.ts";
import { XP } from "./progression.ts";

export type BestiaryId = "slime" | School | "ghost";

export interface BestiaryEntry {
  id: BestiaryId;
  name: string;
  /** A sentence or two of flavour. */
  lore: string;
  health: string;
  xp: number;
  /** What it does, one line each. */
  abilities: string[];
  drops: string;
}

const mageHealth = `${MAGE.hp}, +2 per level`;
const mageDrops = "A magic or rare item, sometimes a potion";
const blink = `Blinks away when you close in (every ${MAGE.blinkCooldown} s)`;
const sword = "Draws a sword if you catch it";

export const BESTIARY: readonly BestiaryEntry[] = [
  {
    id: "slime",
    name: "Slime",
    lore: "A wobbling glob of forest goo. Slimes hop at anything that moves. One is harmless; they are never alone.",
    health: String(SLIME.hp),
    xp: XP.slime,
    abilities: ["Hops at you when it sees you", "Hurts to touch", "Won't follow you into water"],
    drops: "Sometimes a potion or an item",
  },
  {
    id: "ember",
    name: SCHOOLS.ember.name,
    lore: "A robed twin of the wanderer, in red. It keeps its distance and throws fire, and its purple orb has turned many a hero into a sheep.",
    health: mageHealth,
    xp: XP.mage,
    abilities: ["Fireball: curves after you", `Polymorph: a sheep for ${SPELLS.poly.sheep} s`, blink, sword],
    drops: mageDrops,
  },
  {
    id: "frost",
    name: SCHOOLS.frost.name,
    lore: "Icy white robes and a cold stare. Its frostbolts slow you to a crawl, and those who crowd it end up frozen solid.",
    health: mageHealth,
    xp: XP.mage,
    abilities: [`Frostbolt: slows you for ${SPELLS.frost.chill} s`, `Frost Nova: freezes you for ${SPELLS.nova.freeze} s`, blink, sword],
    drops: mageDrops,
  },
  {
    id: "storm",
    name: SCHOOLS.storm.name,
    lore: "Indigo and gold, crackling. It fires sparks faster than the eye can follow and calls lightning down where you stand.",
    health: mageHealth,
    xp: XP.mage,
    abilities: ["Spark: a very fast bolt", `Lightning: ${SPELLS.strike.count} strikes, ${SPELLS.strike.delay} s after the circles`, blink, sword],
    drops: mageDrops,
  },
  {
    id: "ghost",
    name: GHOST_NAME,
    lore: "Ismay Tollen rang St Mary's bells for forty years, and the great bell once too often: the night before the Edict, to warn of lights in the Witchwood. Buried by night without a stone, she rises when the city whispers her name.",
    health: `${GHOST.hp}, +${GHOST.hpPerLevel} per level`,
    xp: XP.ghost,
    abilities: [
      "Only in St Mary's churchyard, at night, and likelier the more you've heard of her",
      `Toll: her bell breaks over everything near her for ${GHOST.toll.damage} hearts; dash or jump through it`,
      `Wail: a fan of ${GHOST.wail.count} wisps that drift after you`,
      "Angry below half health: faster, more wisps, and she fades and returns behind you",
      "Drifts through walls; can't be knocked back; mends if you lead her from her grave",
    ],
    drops: `${GHOST.reward.items} rare items and ${GHOST.reward.potions} potions`,
  },
];

/** Kills per kind of enemy. A kind with any kills is discovered. */
export type Journal = Record<BestiaryId, number>;

export const emptyJournal = (): Journal => ({ slime: 0, ember: 0, frost: 0, storm: 0, ghost: 0 });
