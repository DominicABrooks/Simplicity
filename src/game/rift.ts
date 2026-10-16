// The storm over the Thunder Rift (src/areas/rift.ts), that never stops and isn't there: every few seconds lightning
// comes down somewhere round the hero out of a sky that is, if you look closely, perfectly clear, and the thunder rolls.
// It's only weather: it never comes down on him, and hurts no one (the Storm mages' lightning does: src/systems/hazards.ts).
import { T } from "../data/world.ts";
import type { Game } from "./game.ts";
import { sound } from "./sfx.ts";

/** Seconds between strikes (at least, and at most), and how far from the hero they land (tiles: at least, and at most). */
export const RIFT_STORM = { every: [0.8, 2.6], near: 3, far: 7 } as const;

const next = new WeakMap<Game, number>();

/** Every frame in the Thunder Rift: now and then, lightning somewhere round him. */
export function riftSystem(g: Game, dt: number): void {
  if (g.area.def.id !== "rift" || g.state !== "play") return;
  const left = (next.get(g) ?? RIFT_STORM.every[0]) - dt;
  if (left > 0) { next.set(g, left); return; }
  next.set(g, RIFT_STORM.every[0] + g.rng.next() * (RIFT_STORM.every[1] - RIFT_STORM.every[0]));
  const hero = g.world.need(g.player, "transform"), a = g.rng.next() * Math.PI * 2;
  const d = (RIFT_STORM.near + g.rng.next() * (RIFT_STORM.far - RIFT_STORM.near)) * T;
  const at = {
    x: Math.max(0, Math.min(g.map.width * T - T, hero.x + Math.cos(a) * d)),
    y: Math.max(0, Math.min(g.map.height * T - T, hero.y + Math.sin(a) * d)),
  };
  g.fx.push({ type: "bolt", ...at });
  sound(g, "thunder", at);
}
