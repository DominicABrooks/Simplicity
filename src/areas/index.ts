// The area registry. Every area is a module in this folder named after its id. The home area is
// bundled with the game; every other area is its own chunk, downloaded the first time you travel
// there, so the game's size doesn't grow with the number of areas.
import type { AreaDef } from "../world/area.ts";
import { area as home } from "./witchwood.ts";

interface AreaModule {
  area: AreaDef;
}

/** Where every run starts. */
export const HOME = home;

const lazy = import.meta.glob<AreaModule>(["./*.ts", "!./index.ts", "!./witchwood.ts"]);
const idOf = (path: string) => path.slice("./".length, -".ts".length);

/** Every area's id. Cheap: nothing is loaded to list them. */
export const AREA_IDS: readonly string[] = [home.id, ...Object.keys(lazy).map(idOf)];

/** Areas made while playing (the inside of a house: see src/world/interiors.ts), by id. */
const made = new Map<string, AreaDef>();

/** Add an area made while playing, so travelling there finds it. */
export function registerArea(def: AreaDef): void {
  made.set(def.id, def);
}

/** How long (ms) to wait before trying an area's download again. */
const RETRY_AFTER = 1000;

/** An area's definition, loading its module if needed. */
export async function loadArea(id: string): Promise<AreaDef> {
  if (id === home.id) return home;
  const inside = made.get(id);
  if (inside) return inside;
  const load = lazy[`./${id}.ts`];
  if (!load) throw new Error(`No area "${id}" (expected src/areas/${id}.ts)`);
  // Its download can fail (the connection dropping a moment): once more, after a moment, before giving up.
  return (await load().catch(() => new Promise(r => setTimeout(r, RETRY_AFTER)).then(load))).area;
}

/**
 * Couldn't get an area at all: what to tell him. On the site that's most likely a new version put up since this page was
 * opened (its areas' files have new names), and only reloading gets him the new ones.
 */
export const LOAD_FAILED = "The way ahead won't load. The game may have been updated: reload the page to carry on.";
