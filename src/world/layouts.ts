// Built layouts for the last few areas visited, so going back and forth through a cave doesn't
// rebuild the same ground every time, while memory stays flat however many areas the world has.
import type { AreaDef, AreaLayout } from "./area.ts";

const KEEP = 8;
const cache = new Map<string, AreaLayout>();

/** An area's layout: built on first use, kept while it's one of the last KEEP areas used. */
export function layoutOf(def: AreaDef): AreaLayout {
  let layout = cache.get(def.id);
  if (layout) cache.delete(def.id);                         // re-inserted below: most recently used last
  else layout = def.build();
  cache.set(def.id, layout);
  if (cache.size > KEEP) cache.delete(cache.keys().next().value!);
  return layout;
}
