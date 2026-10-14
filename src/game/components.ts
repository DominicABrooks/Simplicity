// Components: plain data, no behaviour. Systems in src/systems read and write them.
// Every position is the top-left of an 8x8 cell, in game pixels; add HALF for the cell's centre.
import type { BoltKind, School, SpellName } from "../data/enemies.ts";
import type { Rarity } from "../data/items.ts";
import type { Gear } from "../items/inventory.ts";
import type { Item } from "../items/items.ts";
import type { TrainingKind } from "../data/npcs.ts";

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
}

export interface Fishing {
  phase: "cast" | "wait" | "bite";
  x: number;
  y: number;
  t: number;
  biteAt: number;
}

export interface CatchAnim {
  x: number;
  y: number;
  t0: number;
  rarity: Rarity;
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

export type EnemyKind = "slime" | "mage" | "dummy";

export interface Enemy {
  kind: EnemyKind;
  /** White flash after a hit. */
  flash: number;
  face: number;
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

export type RenderKind = "hero" | "slime" | "mage" | "potion" | "loot" | "arrow" | "bolt" | "strike" | "guard" | "dummy";

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
  mage: MageBrain;
  pickup: Pickup;
  arrow: Arrow;
  bolt: Bolt;
  strike: Strike;
  renderable: Renderable;
  despawn: Despawn;
  targetable: Targetable;
  sentry: Sentry;
  dummy: Dummy;
}
