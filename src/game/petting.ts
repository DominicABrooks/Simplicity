// Making friends with the city's dogs and cats (src/game/pets.ts). Each one is a friendly target with a
// name of its own ("Biscuit the dog"), so hovering it rings it like anyone else. Click one close by (or
// press E with it targeted) and you pet it: it stops what it's doing, sits facing you while hearts float up,
// and stays put for as long as you keep at it. A cat you've got targeted doesn't bolt as you come near.
// This runs after the pets' own system each frame, so it only ever holds a pet still; it never moves one.
import type { Entity } from "../core/ecs.ts";
import { HALF } from "../data/world.ts";
import { combatText } from "./combat.ts";
import type { Pet, Transform } from "./components.ts";
import { toast, type Game } from "./game.ts";

export const PETTING = {
  /** How close the hero must be to pet one (px, centre to centre). */
  reach: 16,
  /** Seconds a pat lasts (each one more adds to it, up to `most`), and how often a heart floats up. */
  pat: 3,
  most: 8,
  hearts: 0.7,
  /** While targeted and the hero is this near (px), a pet doesn't take fright. */
  trust: 40,
  /** As a target: ring radius (px) and height (world units). */
  dog: { radius: 4, height: 0.7 },
  cat: { radius: 3.5, height: 0.5 },
  heart: "#ff7aa8",
} as const;

const NAMES = {
  dog: ["Biscuit", "Patch", "Bramble", "Rufus", "Pepper", "Bess", "Scamp", "Nutmeg", "Tansy", "Bracken", "Hob", "Sorrel", "Mutton", "Crumb", "Bodger", "Fennel", "Toby", "Moss"],
  cat: ["Smudge", "Mittens", "Sooty", "Ginger", "Whiskers", "Tibbles", "Pudding", "Moth", "Saffron", "Inky", "Marmalade", "Pip", "Thistle", "Dusk", "Clover", "Sixpence", "Velvet", "Mouse"],
} as const;

/** The pets being petted: seconds of it left, and seconds to the next heart. */
const petted = new Map<Entity, { left: number; heart: number }>();

/** Every frame, after the pets have moved: name and ring any new ones, keep targeted ones calm, hold petted ones still. */
export function updatePetting(g: Game, dt: number): void {
  const hero = g.world.need(g.player, "transform");
  for (const [e, { pet, transform: t }] of g.world.query("pet", "transform")) {
    if (!g.world.has(e, "targetable")) {
      const names = NAMES[pet.species], name = names[(e * 7 + pet.coat * 3) % names.length]!;
      g.world.add(e, "targetable", { hostile: false, name: `${name} the ${pet.species}`, ...PETTING[pet.species] });
    }
    const near = Math.hypot(hero.x - t.x, hero.y - t.y);
    if (g.target === e && near < PETTING.trust) pet.calm = Math.max(pet.calm, 0.5);   // it can tell you mean well
    const p = petted.get(e);
    if (!p) continue;
    if (g.state !== "play" || near > PETTING.reach * 1.6 || (p.left -= dt) <= 0) { petted.delete(e); pet.calm = Math.max(pet.calm, 4); continue; }
    holdStill(pet, t, hero, p.left);
    if ((p.heart -= dt) <= 0) {
      p.heart = PETTING.hearts;
      combatText(g, t.x + HALF / 2, t.y - 2, "♥", PETTING.heart);
    }
  }
  for (const e of petted.keys()) if (!g.world.has(e, "pet")) petted.delete(e);
}

/** Is this one of the dogs and cats? */
export const isPet = (g: Game, e: Entity | null): e is Entity => e !== null && g.world.has(e, "pet");

/** Pet it, if it's a pet and close enough (or say it's too far). Returns whether it was a pet at all. */
export function startPetting(g: Game, e: Entity | null): boolean {
  if (!isPet(g, e)) return false;
  g.target = e;
  const hero = g.world.need(g.player, "transform"), t = g.world.need(e, "transform");
  if (Math.hypot(hero.x - t.x, hero.y - t.y) > PETTING.reach) { toast(g, `Too far away to pet ${g.world.get(e, "targetable")?.name.split(" ")[0] ?? "it"}`); return true; }
  const p = petted.get(e);
  if (p) p.left = Math.min(PETTING.most, p.left + PETTING.pat);
  else petted.set(e, { left: PETTING.pat, heart: 0 });
  holdStill(g.world.need(e, "pet"), t, hero, petted.get(e)!.left);   // at once, before the pets' next move
  return true;
}

/** Held still: sat (a cat may stay lying), turned to the hero, going nowhere; a moment to settle after. */
function holdStill(pet: Pet, t: Transform, hero: Transform, left: number): void {
  pet.path = [];
  pet.moving = pet.running = pet.greeting = false;
  if (pet.pose !== "lie") pet.pose = "sit";
  pet.wait = Math.max(pet.wait, left + 1);
  pet.calm = Math.max(pet.calm, left + 2);
  pet.facing = Math.atan2(hero.y - t.y, hero.x - t.x);
}

/** Is the hero petting this one right now? */
export const isPetted = (e: Entity): boolean => petted.has(e);
