// Components: plain data, no behaviour. Systems in src/systems read and write them.
// Every position is the top-left of an 8x8 cell, in game pixels; add HALF for the cell's centre.
import type { BoltKind, School, SpellName } from "../data/enemies.ts";
import type { CurioId, Rarity } from "../data/items.ts";
import type { Gear } from "../items/inventory.ts";
import type { Item } from "../items/items.ts";
import type { Entity } from "../core/ecs.ts";
import type { TrainingKind } from "../data/npcs.ts";
import type { Species } from "../data/pets.ts";

export interface Transform {
  x: number;
  y: number;
}

/** Knockback velocity, in px/s, bleeding off with drag. */
export interface Knockback {
  vx: number;
  vy: number;
}

export interface Health {
  hp: number;
  maxHp: number;
}

/** The hero's progression and the stat totals from gear and level. */
export interface Hero {
  level: number;
  xp: number;
  damage: number;
  speedMul: number;
  /** Multiplies the dash cooldown (gear can shorten it). */
  dashMul: number;
  gear: Gear | null;
}

export interface Motion {
  /** Where the hero aims, radians, game space (x right, y down). */
  aim: number;
  /** 1 facing right, -1 facing left. */
  face: number;
  moving: boolean;
  swimming: boolean;
  /** Time left in the current dash. */
  dash: number;
  dashX: number;
  dashY: number;
  dashCooldown: number;
  /** Time left in the current jump. */
  jump: number;
}

/** Timed conditions. Each counts down to 0. */
export interface Status {
  /** Invulnerable and flashing after taking a hit. */
  hurt: number;
  /** Polymorphed: can only walk. */
  sheep: number;
  /** Frozen solid: can't move or act. */
  frozen: number;
  /** Chilled: slowed. */
  chill: number;
}

export interface Swipe {
  t: number;
  queued: boolean;
  hits: Set<number>;
  aim: number;
  side: number;
}

export interface Windup {
  t: number;
  x: number;
  y: number;
  water: boolean;
  /** The water is a fountain's pool, standing up in its basin, rather than a pond or river. */
  basin: boolean;
}

export interface Fishing {
  phase: "cast" | "wait" | "bite";
  x: number;
  y: number;
  t: number;
  biteAt: number;
  /** Cast into a fountain's pool (its surface is up in the basin). */
  basin?: boolean;
}

export interface CatchAnim {
  x: number;
  y: number;
  t0: number;
  rarity: Rarity;
  /** It wasn't a koi but a curiosity: which. */
  curio?: CurioId | null;
  /** Leapt from a fountain's pool. */
  basin?: boolean;
}

/** What the hero is doing with their hands: swings, punches, the bow and the fishing pole. */
export interface Actions {
  /** Time left in the current attack (> 0 means attacking). */
  attack: number;
  cooldown: number;
  /** The current thrust has landed its hit. */
  hit: boolean;
  /** The aim locked in when the attack started. */
  swingAim: number;
  swingSide: number;
  /** Sword swipe progress 0..1, and the blade's angle relative to the aim. */
  swingK: number;
  swingRel: number;
  swipe: Swipe | null;
  draw: { t: number } | null;
  windup: Windup | null;
  fishing: Fishing | null;
  catchAnim: CatchAnim | null;
}

export type EnemyKind = "slime" | "mage" | "dummy" | "ghost" | "koi";

export interface Enemy {
  kind: EnemyKind;
  /** White flash after a hit. */
  flash: number;
  face: number;
  /** Melee damage taken lately, wearing off (Rime watches it: src/game/rimefight.ts). */
  melee?: number;
  /** Nothing hurts it (Rime in her ice block, Calder in his cage of lightning), and what it says when a blow glances off. */
  warded?: boolean;
  wardSay?: string;
  /** One last stand in it (Rime): the first blow that would finish it doesn't ("ready" -> "taken"), and its fight
   *  answers (src/game/rimefight.ts) until it's "spent"; then the next one does. */
  lastStand?: "ready" | "taken" | "spent";
}

/** The Great Koi (src/game/greatkoi.ts): flopping after the hero in leaps, slamming down, spitting freezing water. */
export interface KoiBrain {
  /** Seconds to its next leap; seconds left in this one (and how long it lasts); which way it's going. */
  timer: number; hop: number; hopTime: number; dx: number; dy: number;
  /** Seconds to its next spit, and the wind-up before it (> 0 while it's drawing breath). */
  spit: number; wind: number;
}

export interface SlimeBrain {
  timer: number;
  hop: number;
  dx: number;
  dy: number;
}

export interface MageSwing {
  t: number;
  side: number;
  aim: number;
  hit: boolean;
}

export interface MageBrain {
  school: School;
  timer: number;
  casting: boolean;
  castT: number;
  castK: number;
  spell: SpellName | null;
  strafe: number;
  strafeT: number;
  stuckT: number;
  blinkCD: number;
  specialCD: number;
  moving: boolean;
  melee: boolean;
  swing: MageSwing | null;
  swingCD: number;
  swingSide: number;
  swingK: number;
  swingRel: number;
  /**
   * A lieutenant's (src/game/bosses.ts): how much wider its novas are, and faster its bolts, than its school's; and how
   * much longer its novas take to charge, and to come round again.
   */
  boost?: { nova: number; bolt: number; novaCharge?: number; novaCooldown?: number };
  /** Held still by its fight (Rime winding up a volley, or sealed in ice): it doesn't move, cast or blink. */
  held?: boolean;
}

/** What the Grey Ringer is doing (see src/systems/ghost.ts). */
export type GhostAct = "rise" | "drift" | "toll" | "wail" | "fade" | "return" | "come" | "speak" | "ring";

/** The ghost of St Mary's churchyard. */
export interface GhostBrain {
  /** Where her grave is (px): she won't go further than her leash from it. */
  home: Transform;
  act: GhostAct;
  /** Seconds into what she's doing. */
  t: number;
  /** Seconds to her next attack. */
  next: number;
  /** Below half health she's angry: faster, more wisps, and she fades away and back. */
  angry: boolean;
  /** Faded out: not there to hit (her enemy and target are taken away until she's back). */
  hidden: boolean;
  /** She's heard her own bell in the hero's bag: no fight, she comes for it (see BELL_HOME). */
  calm?: boolean;
}

/** Something on the ground to walk over: a healing potion, or an item. */
export type Pickup =
  | { kind: "potion" }
  | {
      kind: "loot";
      item: Item;
      /** Dropped items wait until you step off them. */
      ignore: boolean;
    };

export interface Arrow {
  vx: number;
  vy: number;
  life: number;
  damage: number;
  power: boolean;
  /** Time in the air, in total (for the drop of a dud's arc). */
  flight: number;
  /** Too weak to hurt: arcs down to the ground instead of flying true, and hits nothing. */
  dud: boolean;
  /** Time left embedded in a tree, or lying on the ground. */
  stuck: number;
  /** It's lying on the ground (a dud that landed), not in a tree. */
  grounded: boolean;
  /** A dud that glanced off an enemy (it tumbles as it falls, and can't bounce again). */
  bounced: boolean;
}

/** A mage's spell bolt in flight. */
export interface Bolt {
  kind: BoltKind;
  vx: number;
  vy: number;
  life: number;
  /** It overshot the hero and flies on straight. */
  lost: boolean;
}

/** A lightning strike marked on the ground; it lands when t reaches 0. */
export interface Strike {
  t: number;
  total: number;
}

/** Removed when the time runs out (items left on the ground). */
export interface Despawn {
  left: number;
}

/** Something the player can target by hovering it. */
export interface Targetable {
  name: string;
  /** Hostile targets get a red ring, neutral ones yellow. */
  hostile: boolean;
  /** Ring radius on the ground, in game pixels. */
  radius: number;
  /** How tall it stands, in world units (hovering anywhere on it counts). */
  height: number;
}

/** A guard at their post (see src/systems/sentry.ts). Angles are game angles (0 east, PI/2 south). */
export interface Sentry {
  /** Which way their post faces. */
  post: number;
  /** Where they're looking now, and where they're turning to look. */
  look: number;
  want: number;
  /** Seconds until they next glance somewhere else. */
  next: number;
}

/** Something to practise on in a castle yard (see TRAINING): it rocks when hit and never goes down. */
export interface Dummy {
  kind: TrainingKind;
  /** Which way it faces (a game angle). */
  facing: number;
}

/** What one of the townsfolk is out to do (see src/game/townsfolk.ts). */
export type Errand = "work" | "shop" | "chat" | "drink" | "church" | "errand" | "play" | "home" | "answer";

/** One of the census's people out in the streets (see src/game/townsfolk.ts). Paths are in tiles. */
/** Work done standing in the open, with something to show for it (see Walker.task). */
export type Task = "anvil" | "lute" | "broom" | "wash" | "crank" | "fish" | "hawk" | "stave" | "fletch" | "stitch" | "grind" | "tinker" | "tell" | "chisel" | "hoop" | "sew" | "saw" | "stir" | "dye" | "spin" | "pewter" | "lamp";

export interface Walker {
  /** Who they are: their id in the census (src/world/residents.ts). */
  id: number;
  /** What they're out to do, and so where they're going and how long they'll stay. */
  plan: Errand;
  /** The tiles still to walk through, the next one first. */
  path: (readonly [number, number])[];
  /** Their own line along a street: a small offset from the middle of each tile, px. */
  lane: [number, number];
  speed: number;
  moving: boolean;
  /** Seconds left at what they're doing there, or waiting for the hero to get out of the way. */
  wait: number;
  blockedFor: number;
  /** Go in on getting there (home, the church, or on out of the area). */
  goIn: boolean;
  /** Which way they face (a game angle), and which way to face once they're there. */
  facing: number;
  face: number | null;
  /** What they do with their hands once they're at work there: hammer at the anvil, or play the lute. */
  task?: Task | null;
  /** A child keeping with someone: their parent, or the oldest of a band of children; the nth of them. */
  follow: { leader: Entity; slot: number } | null;
  /** Where a leader has walked lately (px, centres), for those following to walk in their steps. */
  trail: [number, number][];
  /** Where a band of children plays (tile), once they're there; where each is running to now (px). */
  playAt: readonly [number, number] | null;
  runTo: [number, number] | null;
  /** A leader stopped to wait while the hero talks to one of their party. */
  holdFor: Entity | null;
  /** One of a party who's been left behind: seconds till they run off after them (saying so), then running to catch up, too busy to talk. */
  leaving: number;
  catchingUp: boolean;
  /** Running from the ghost: home, or out of the area, as fast as they can go. */
  fleeing?: boolean;
}

/** How a dog or cat is holding itself: up on its feet, nose down sniffing, sitting, or lying down. */
export type PetPose = "stand" | "sniff" | "sit" | "lie";

/** One of the city's dogs and cats (see src/game/pets.ts). Paths are in tiles. */
export interface Pet {
  species: Species;
  /** Which coat it has (an index into the renderer's coats for its species). */
  coat: number;
  /** The tiles still to go through, the next one first. */
  path: (readonly [number, number])[];
  /** Its own line along a street: a small offset from the middle of each tile, px. */
  lane: [number, number];
  /** Its own easy pace, and how fast it's going now (px per second). */
  pace: number;
  speed: number;
  moving: boolean;
  /** Running: a dog giving chase or bounding up to the hero, a cat bolting. */
  running: boolean;
  pose: PetPose;
  /** Seconds left settled where it is. */
  wait: number;
  /** Which way it faces (a game angle). */
  facing: number;
  /** A dog sitting by the hero, wagging. */
  greeting: boolean;
  /** Seconds before it takes notice of the hero (or a dog) again. */
  calm: number;
}

/** A cutscene playing (see src/game/cutscene.ts): control is taken away until it's over or skipped. */
export interface Cutscene {
  /** Which scene (src/data/cutscenes.ts), the beat it's at, and seconds into the beat (after any walking). */
  scene: string;
  beat: number;
  t: number;
  /** Whether this beat's lines have been started. */
  spoken: boolean;
  /** What the camera's to look at (px, centres) and how close (1 the usual distance, less is closer). */
  cam: { x: number; y: number; zoom: number };
}

/** The hero sitting by a campfire, getting his health back (see src/game/resting.ts). */
export interface Resting {
  fire: Entity;
  /** Seconds to the next heart back, and his health as last seen (a drop means he was hit). */
  heal: number;
  hp: number;
}

/** Somewhere to sleep, a tent or a bed: where the hero lies in it (px, like a transform), feet toward `face`, `ahead` tiles on, `lift` tiles up. */
export interface Bed {
  x: number;
  y: number;
  face: number;
  ahead: number;
  lift: number;
}

/** The hero asleep in a tent or a bed, the clock running fast (see src/game/sleeping.ts). */
export interface Sleeping {
  bed: Entity;
  /** Where he was standing, to get up there again, and in which area. */
  from: { x: number; y: number };
  area: string;
  /** In-game hours slept so far, toward the next heart, and to the next Z; his health as last seen (a drop wakes him). */
  slept: number;
  heal: number;
  snore: number;
  hp: number;
}

/** The hero talking to someone (see src/game/talk.ts). */
export interface Conversation {
  with: Entity;
  /** Who's speaking, as their target name shows. */
  name: string;
  /** Who they are, to remember them by: "folk:<census id>", or "guard:<area>:<post>". */
  key: string;
  lines: string[];
  /** The line being said, and seconds since it started (it types out). */
  line: number;
  t: number;
  /** After the last line: a woodwarden hands him paper to write the watchword on (src/game/watchword.ts). */
  then?: "paper";
}

export type RenderKind = "hero" | "slime" | "mage" | "cinder" | "blaze" | "rime" | "rimefrost" | "calder" | "tempest" | "greatkoi" | "potion" | "loot" | "arrow" | "bolt" | "strike" | "guard" | "king" | "dummy" | "townsfolk" | "pet" | "ghost" | "ringstone" | "boatman" | "yssa" | "spirit" | "watcher";

/** A beaten lieutenant's spirit, in the middle of their arena (src/game/spirits.ts): whose. */
export interface Spirit { who: "cinder" | "rime" }

/** The figure at the end of the street after dark (src/game/eerie.ts): how far it's faded in (0-1), and whether it's going. */
export interface Watcher { shown: number; going: boolean }

/** Drawn by the view registered for this kind. */
export interface Renderable {
  kind: RenderKind;
}

export interface Components {
  transform: Transform;
  knockback: Knockback;
  health: Health;
  hero: Hero;
  motion: Motion;
  status: Status;
  actions: Actions;
  enemy: Enemy;
  slime: SlimeBrain;
  koi: KoiBrain;
  mage: MageBrain;
  ghost: GhostBrain;
  pickup: Pickup;
  arrow: Arrow;
  bolt: Bolt;
  strike: Strike;
  renderable: Renderable;
  despawn: Despawn;
  targetable: Targetable;
  sentry: Sentry;
  dummy: Dummy;
  conversation: Conversation;
  resting: Resting;
  sleeping: Sleeping;
  bed: Bed;
  cutscene: Cutscene;
  walker: Walker;
  pet: Pet;
  spirit: Spirit;
  watcher: Watcher;
}
