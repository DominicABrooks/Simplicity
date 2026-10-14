// The weather turns over time, and fog and rain ease in and out rather than snapping.
import { WEATHER_EASE, nextWeather } from "../data/weather.ts";
import type { Game } from "../game/game.ts";

export function weatherSystem(g: Game, dt: number): void {
  const w = g.weather;
  w.timer -= dt;
  if (w.timer <= 0) nextWeather(w, g.hour);
  const ease = (v: number, to: number) => (v < to ? Math.min(to, v + dt / WEATHER_EASE) : Math.max(to, v - dt / WEATHER_EASE));
  w.fog = ease(w.fog, w.kind === "fog" ? 1 : 0);
  w.rain = ease(w.rain, w.kind === "rain" ? 1 : 0);
}
