// The area registry. Every area is a module in this folder named after its id. The home area is
// bundled with the game; every other area is its own chunk, downloaded the first time you travel
// there, so the game's size doesn't grow with the number of areas.
import type { AreaDef } from "../world/area.ts";
import { area as home } from "./greenhollow.ts";

interface AreaModule {
  area: AreaDef;
}

/** Where every run starts. */
export const HOME = home;

const lazy = import.meta.glob<AreaModule>(["./*.ts", "!./index.ts", "!./greenhollow.ts"]);
const idOf = (path: string) => path.slice("./".length, -".ts".length);

/** Every area's id. Cheap: nothing is loaded to list them. */
export const AREA_IDS: readonly string[] = [home.id, ...Object.keys(lazy).map(idOf)];

/** An area's definition, loading its module if needed. */
export async function loadArea(id: string): Promise<AreaDef> {
  if (id === home.id) return home;
  const load = lazy[`./${id}.ts`];
  if (!load) throw new Error(`No area "${id}" (expected src/areas/${id}.ts)`);
  return (await load()).area;
}
