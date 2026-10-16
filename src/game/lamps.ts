// The street lamps of the area the hero is in, and which of them are burning. By day they're dark; from dusk
// the lamplighter goes round and lights them one by one (src/game/townsfolk.ts), and any he hasn't got to by
// nightfall are lit all the same; they burn all night, and go out one by one at dawn. The renderer asks
// lampLit for each lamp it draws (src/render/lamp.ts).
import { CRAFTS } from "../data/crafts.ts";
import { SUNRISE } from "../data/daylight.ts";
import { T } from "../data/world.ts";
import type { Game } from "./game.ts";

export interface Lamp {
  /** Where it stands (px), and its tile. */
  x: number;
  y: number;
  tile: readonly [number, number];
  lit: boolean;
  /** Guttered out for a moment, lit or not (src/game/eerie.ts): dark until it catches again. */
  snuffed?: boolean;
  /** The hour it goes out at dawn (each a little after the last). */
  out: number;
}

let lamps: Lamp[] = [];
let byKey = new Map<string, Lamp>();
let hour = 12;
const keyOf = (x: number, y: number) => `${x},${y}`;

/** The area's lamps, in the order its props list them. */
export const lampsHere = (): readonly Lamp[] => lamps;

/** Whether the lamp standing at (x, y) (px) is burning. */
export const lampLit = (p: { x: number; y: number }): boolean => { const l = byKey.get(keyOf(p.x, p.y)); return !!l && l.lit && !l.snuffed; };

/** Whether the lamplighter should be out on his round: it's dusk, and there are lamps still to light. */
export const lampsDue = (): boolean => hour >= CRAFTS.lamps.from && hour < CRAFTS.lamps.by && lamps.some(l => !l.lit);

/** On arriving somewhere: its lamps, dark or lit by the hour (any due to be lit at dusk are left for the lamplighter). */
export function setLamps(g: Game): void {
  const D = CRAFTS.lamps;
  lamps = g.area.layout.props.flatMap((p, i) => (p.kind === "lamp" ? [{
    x: p.x, y: p.y, tile: [Math.floor(p.x / T), Math.floor(p.y / T)] as const, lit: false, out: SUNRISE + (((i * 0.618) % 1) * D.dawn),
  }] : []));
  byKey = new Map(lamps.map(l => [keyOf(l.x, l.y), l]));
  updateLamps(g);
}

/** By the hour: lit through the night (all of them, once it's dark), out from dawn till the lamplighter's next round. */
export function updateLamps(g: Game): void {
  hour = g.hour;
  for (const l of lamps) {
    if (hour >= CRAFTS.lamps.by || hour < l.out) l.lit = true;
    else if (hour < CRAFTS.lamps.from) l.lit = false;
  }
}

/** A lamp gutters out (`out`), or catches again, by itself. */
export function snuffLamp(l: Lamp, out: boolean): void {
  l.snuffed = out;
}

/** The lamplighter's pole is up to the `i`th lamp: it catches. */
export function lightLamp(i: number): void {
  const l = lamps[i];
  if (l) l.lit = true;
}
