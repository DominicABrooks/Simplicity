// The weather turns over time, and fog and rain ease in and out rather than snapping. Not in a boss fight, though, nor
// on the way to the ending or in any cutscene: the sky clears for them, quickly, and stays clear till they're over;
// then the weather goes on turning as before. (The credits clear it outright as they start: src/game/credits.ts.)
import { FIGHT_CLEARS, WEATHER_EASE, nextWeather } from "../data/weather.ts";
import { inBossFight } from "../game/bossbar.ts";
import { processionOn } from "../game/crowd.ts";
import { cutscene } from "../game/cutscene.ts";
import type { Game } from "../game/game.ts";

/** Whether the sky's to be clear now: a boss fight, the walk up with Calder's head to the end, or a cutscene. */
export const clearSky = (g: Game): boolean => inBossFight(g) || processionOn(g) || cutscene(g) !== null;

export function weatherSystem(g: Game, dt: number): void {
  const w = g.weather, clear = clearSky(g);
  if (clear) w.kind = "clear";
  else if ((w.timer -= dt) <= 0) nextWeather(w, g.hour);
  const over = clear ? FIGHT_CLEARS : WEATHER_EASE;
  const ease = (v: number, to: number) => (v < to ? Math.min(to, v + dt / over) : Math.max(to, v - dt / over));
  w.fog = ease(w.fog, w.kind === "fog" ? 1 : 0);
  w.rain = ease(w.rain, w.kind === "rain" ? 1 : 0);
}
