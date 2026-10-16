// Weather: spells of clear sky, fog and rain that follow one another as you play. Gameplay doesn't
// change with it (yet); the renderer draws it. Like the hour, it carries on across runs.
import { Rng } from "../core/rng.ts";

export type WeatherKind = "clear" | "fog" | "rain";

export interface Weather {
  /** The weather now (or the weather it's turning into). */
  kind: WeatherKind;
  /** Seconds until the next change. */
  timer: number;
  /** How foggy and how rainy it is right now, 0-1: they ease toward `kind` so changes roll in. */
  fog: number;
  rain: number;
  /** Its own dice, so weather never shifts the game's other rolls. */
  rng: Rng;
}

/** Seconds for a change of weather to fully roll in (or clear). */
export const WEATHER_EASE = 10;
/** Seconds for fog or rain to clear when a boss fight starts, the walk up to the ending, or a cutscene (none of them has weather: src/systems/weather.ts). */
export const FIGHT_CLEARS = 1.5;

/** How long a spell of each weather lasts, seconds [min, max]. */
const SPELL: Record<WeatherKind, [number, number]> = { clear: [120, 300], fog: [60, 150], rain: [60, 180] };

/** How likely each weather is to come next. Fog favours the small hours and early morning. */
function chances(hour: number): Record<WeatherKind, number> {
  const misty = hour >= 3 && hour < 9;
  return { clear: 0.55, fog: misty ? 0.35 : 0.12, rain: 0.28 };
}

export function createWeather(): Weather {
  return { kind: "clear", timer: SPELL.clear[0], fog: 0, rain: 0, rng: new Rng(4211) };
}

/** Pick the next spell: never the same weather twice in a row. */
export function nextWeather(w: Weather, hour: number): void {
  const odds = Object.entries(chances(hour)).filter(([k]) => k !== w.kind) as [WeatherKind, number][];
  let roll = w.rng.next() * odds.reduce((sum, [, p]) => sum + p, 0);
  w.kind = odds.find(([, p]) => (roll -= p) < 0)?.[0] ?? odds[0]![0];
  const [lo, hi] = SPELL[w.kind];
  w.timer = lo + w.rng.next() * (hi - lo);
}
