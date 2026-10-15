// The simulation step: every system, in order. Order matters: each system sees the effects of the
// ones before it this frame (a sword consumes the click before a punch can, a dash cancels a swing
// before the sword updates, and so on).
import { SECONDS_PER_HOUR } from "../data/daylight.ts";
import type { Game } from "../game/game.ts";
import { arrowSystem, bowSystem } from "./bow.ts";
import { deathSystem, enemyPhysicsSystem, slimeSystem, spawnerSystem } from "./enemies.ts";
import { fishingSystem, rodSystem } from "./fishing.ts";
import { ghostSystem } from "./ghost.ts";
import { hauntSystem } from "../game/ghost.ts";
import { boltSystem, strikeSystem } from "./hazards.ts";
import { clearPressesSystem, heroMoveSystem, heroStatusSystem, resetHoldSystem } from "./hero.ts";
import { mageSystem } from "./mage.ts";
import { petSystem } from "../game/pets.ts";
import { travelSystem } from "../game/travel.ts";
import { undercroftSystem } from "../game/undercroft.ts";
import { despawnSystem, pickupSystem } from "./pickups.ts";
import { sentrySystem } from "./sentry.ts";
import { swordSystem } from "./sword.ts";
import { thrustSystem } from "./thrust.ts";
import { weatherSystem } from "./weather.ts";

export type System = (g: Game, dt: number) => void;

/** The hero: controls, weapons and pickups. */
export const HERO_SYSTEMS: System[] = [
  resetHoldSystem,
  heroStatusSystem,
  heroMoveSystem,
  fishingSystem,
  rodSystem,
  bowSystem,
  swordSystem,
  thrustSystem,
  clearPressesSystem,
  pickupSystem,
  despawnSystem,
  travelSystem,                                              // walking into an exit holds the world still
];

/** Everything else, in groups. A group is skipped once the hero has fallen. */
export const WORLD_SYSTEMS: System[][] = [
  [arrowSystem, enemyPhysicsSystem, hauntSystem, mageSystem, ghostSystem, slimeSystem, deathSystem, spawnerSystem, sentrySystem, petSystem, undercroftSystem],
  [boltSystem, strikeSystem],
];

/** Combat numbers drift up and fade. */
export function floaterSystem(g: Game, dt: number): void {
  for (const f of g.floaters) f.t -= dt / f.life;
  g.floaters = g.floaters.filter(f => f.t > 0);
}

/**
 * Advance the game by dt seconds. During hitstop the world holds still; the camera shake always decays.
 */
export function step(g: Game, dt: number): void {
  g.shake *= Math.exp(-dt * 10);
  if (g.state !== "play") return;
  if (g.hitstop > 0) { g.hitstop -= dt; return; }
  g.clock += dt;
  g.hour = (g.hour + dt / SECONDS_PER_HOUR) % 24;
  weatherSystem(g, dt);
  for (const system of HERO_SYSTEMS) system(g, dt);
  for (const group of WORLD_SYSTEMS) {
    if (g.state !== "play") break;
    for (const system of group) system(g, dt);
  }
  floaterSystem(g, dt);
}
