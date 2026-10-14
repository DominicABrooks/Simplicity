// The game context: the ECS world plus the singletons (resources) systems share.
// Nothing here touches the DOM or three.js, so the whole simulation runs in tests.
import { World, type Entity } from "../core/ecs.ts";
import { EventBus } from "../core/events.ts";
import { Rng } from "../core/rng.ts";
import { emptyJournal, type BestiaryId, type Journal } from "../data/bestiary.ts";
import { BASE_HP } from "../data/player.ts";
import { levelBonus } from "../data/progression.ts";
import { START_HOUR } from "../data/daylight.ts";
import { createWeather, type Weather } from "../data/weather.ts";
import { Inventory, type InventoryStats } from "../items/inventory.ts";
import type { Point } from "../world/collision.ts";
import { HOME } from "../areas/index.ts";
import type { AreaDef, AreaLayout, Destination } from "../world/area.ts";
import { layoutOf } from "../world/layouts.ts";
import type { TileMap } from "../world/map.ts";
import type { Components } from "./components.ts";
import type { Fx } from "./fx.ts";

/** "travel": walking through an exit; the world holds still until the next area is ready. */
export type GameState = "title" | "play" | "dead" | "travel";

/** The area you're in, and its built layout. */
export interface CurrentArea {
  def: AreaDef;
  layout: AreaLayout;
}

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
  /** A new run started: a fresh hero and bag, back home. */
  reset: Record<string, never>;
  /** You arrived in an area (a new run arrives home too): its ground and scenery are ready to build. */
  area: CurrentArea;
  /** An enemy was killed: its journal count went up. `first` when that kind was just discovered. */
  journal: { id: BestiaryId; first: boolean };
}

export interface Game {
  world: World<Components>;
  /** The area you're in. Only this area is built; every other area is just an id until you go there. */
  area: CurrentArea;
  /** The current area's tiles (the same as area.layout.map). */
  map: TileMap;
  /** Set when you walk into an exit; the area is swapped once the next one is loaded. */
  travel: Destination | null;
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
  /** The hour of the day, 0-24 (fractional). Runs on through play and carries across runs. */
  hour: number;
  /** Clear, foggy or rainy. Carries across runs, like the hour. */
  weather: Weather;
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
  /** Kills per kind of enemy, for the journal. Kept across runs (the UI saves it). */
  journal: Journal;
}

export function createGame(): Game {
  const home = { def: HOME, layout: layoutOf(HOME) };
  const g: Game = {
    world: new World<Components>(),
    area: home,
    map: home.layout.map,
    travel: null,
    rng: new Rng(),
    input: { keys: new Set(), attackPressed: false, attackReleased: false, jumpPressed: false, dashRequest: null, pointer: null },
    inventory: new Inventory(() => levelBonus(g.world.get(g.player, "hero")?.level ?? 1)),
    events: new EventBus<GameEvents>(),
    fx: [],
    floaters: [],
    state: "title",
    player: 0,
    clock: 0, hour: START_HOUR, weather: createWeather(), hitstop: 0, shake: 0, kills: 0, spawnTimer: 0, resetHold: 0, resetLatch: false, target: null,
    journal: emptyJournal(),
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
