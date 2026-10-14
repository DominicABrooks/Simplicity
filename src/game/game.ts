// The game context: the ECS world plus the singletons (resources) systems share.
// Nothing here touches the DOM or three.js, so the whole simulation runs in tests.
import { World, type Entity } from "../core/ecs.ts";
import { EventBus } from "../core/events.ts";
import { Rng } from "../core/rng.ts";
import { BASE_HP } from "../data/player.ts";
import { levelBonus } from "../data/progression.ts";
import { Inventory, type InventoryStats } from "../items/inventory.ts";
import type { Point } from "../world/collision.ts";
import { makeMap, type TileMap } from "../world/map.ts";
import type { Components } from "./components.ts";
import type { Fx } from "./fx.ts";

export type GameState = "title" | "play" | "dead";

/** Controls, as gameplay sees them. The input layer fills this in; systems consume the presses. */
export interface Input {
  /** Held keys, lower-case `KeyboardEvent.key` values. */
  keys: Set<string>;
  attackPressed: boolean;
  attackReleased: boolean;
  jumpPressed: boolean;
  /** A double-tapped direction to dash in. */
  dashRequest: [number, number] | null;
  /** The cursor on the ground as a cell top-left, or null without a mouse. */
  pointer: Point | null;
}

/** A floating combat number. t runs 1 -> 0 over its life. */
export interface Floater {
  x: number;
  y: number;
  text: string;
  color: string;
  crit: boolean;
  life: number;
  t: number;
  /** Sideways jitter, in screen pixels, so a flurry of hits doesn't stack. */
  jx: number;
}

export interface GameEvents {
  toast: { text: string; good: boolean };
  state: { state: GameState };
  /** A new run started: the map was rebuilt and the hero is back at the spawn. */
  reset: { map: TileMap };
}

export interface Game {
  world: World<Components>;
  map: TileMap;
  rng: Rng;
  input: Input;
  inventory: Inventory;
  events: EventBus<GameEvents>;
  /** Effects raised this frame, for the renderer to consume. */
  fx: Fx[];
  floaters: Floater[];
  state: GameState;
  player: Entity;
  /** Seconds of play this run (stops during hitstop). */
  clock: number;
  /** While > 0, the world freezes for a few frames so hits land with weight. */
  hitstop: number;
  /** Camera shake strength; decays every frame. */
  shake: number;
  kills: number;
  spawnTimer: number;
  /** Seconds R has been held, and whether R must be released before another reset. */
  resetHold: number;
  resetLatch: boolean;
  /** What the player is targeting (the last thing hovered), if anything. */
  target: Entity | null;
}

export function createGame(): Game {
  const g: Game = {
    world: new World<Components>(),
    map: makeMap(),
    rng: new Rng(),
    input: { keys: new Set(), attackPressed: false, attackReleased: false, jumpPressed: false, dashRequest: null, pointer: null },
    inventory: new Inventory(() => levelBonus(g.world.get(g.player, "hero")?.level ?? 1)),
    events: new EventBus<GameEvents>(),
    fx: [],
    floaters: [],
    state: "title",
    player: 0,
    clock: 0, hitstop: 0, shake: 0, kills: 0, spawnTimer: 0, resetHold: 0, resetLatch: false, target: null,
  };
  g.inventory.subscribe(stats => applyStats(g, stats));
  return g;
}

/** Equipment and level totals feed straight into the hero's numbers. */
function applyStats(g: Game, st: InventoryStats): void {
  const hero = g.world.get(g.player, "hero"), health = g.world.get(g.player, "health");
  if (!hero || !health) return;
  hero.damage = st.damage;
  hero.speedMul = 1 + st.speed / 100;
  hero.dashMul = 1 - st.dash / 100;
  hero.gear = st.gear;
  health.maxHp = BASE_HP + st.life;
  health.hp = Math.min(health.hp, health.maxHp);
}

export function setState(g: Game, state: GameState): void {
  g.state = state;
  g.events.emit("state", { state });
}

export function toast(g: Game, text: string, good = false): void {
  g.events.emit("toast", { text, good });
}
