// The weather turns over time, and fog and rain ease in and out rather than snapping. Not in a boss fight, though: the
// sky clears for it, quickly, and stays clear till it's over; then the weather goes on turning as before.
import { FIGHT_CLEARS, WEATHER_EASE, nextWeather } from "../data/weather.ts";
import { inBossFight } from "../game/bossbar.ts";
import type { Game } from "../game/game.ts";

export function weatherSystem(g: Game, dt: number): void {
  const w = g.weather, fight = inBossFight(g);
  if (fight) w.kind = "clear";
  else if ((w.timer -= dt) <= 0) nextWeather(w, g.hour);
  const over = fight ? FIGHT_CLEARS : WEATHER_EASE;
  const ease = (v: number, to: number) => (v < to ? Math.min(to, v + dt / over) : Math.max(to, v - dt / over));
  w.fog = ease(w.fog, w.kind === "fog" ? 1 : 0);
  w.rain = ease(w.rain, w.kind === "rain" ? 1 : 0);
}
