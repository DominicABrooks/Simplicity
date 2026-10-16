// Gilded oaks (src/data/fey.ts): a Fey Acorn, the fair folk's keepsake (src/game/fairyring.ts), planted in open grass.
// It goes in as a shoot, and at the next nightfall it's a young oak with a gold sheen on its leaves. After dark, come
// near one and it whispers the line its acorn held. They stand where they were planted, run after run (like the hour, the
// world goes on keeping them), so a hero who keeps going back to the ring grows a grove of whispers. They're never in the
// way: you can walk through a young oak as through long grass, so no planting can ever block a path.
import { GILDED_OAK as O, FAIRY_RING as F } from "../data/fey.ts";
import { isDay, SUNSET } from "../data/daylight.ts";
import { HALF, T, Tile } from "../data/world.ts";
import type { Item } from "../items/items.ts";
import { tileOf } from "../world/map.ts";
import { ringHere } from "./fairyring.ts";
import { toast, type Game } from "./game.ts";

/** One planted acorn: where (centre, game px, in which area), the line it holds, whether it's grown, and when it last whispered. */
export interface Oak { id: number; area: string; x: number; y: number; line: string; grown: boolean; whispered: number }
/** An oak whispering: which, what, how long it's been at it, and how long it holds. */
export interface Whisper { oak: Oak; age: number; hold: number }

/** The oaks, the next one's id, the hour last frame (to see dusk come), what's whispering, and the grove's own clock (s). */
interface Grove { oaks: Oak[]; next: number; hour: number; whisper: Whisper | null; time: number }
const groves = new WeakMap<Game, Grove>();
const grove = (g: Game): Grove => {
  let s = groves.get(g);
  if (!s) groves.set(g, s = { oaks: [], next: 1, hour: g.hour, whisper: null, time: 0 });
  return s;
};

/** Every oak planted in the area he's in. */
export const oaksHere = (g: Game): readonly Oak[] => grove(g).oaks.filter(o => o.area === g.area.def.id);
/** The oak whispering to him now, if one is. */
export const whisperOf = (g: Game): Whisper | null => grove(g).whisper;

/** Right-clicking a Fey Acorn in the bag: plant it where he stands, if it'll take. True if it went in (and out of the bag). */
export function plantAcorn(g: Game, item: Item): boolean {
  const p = g.world.need(g.player, "transform"), x = p.x + HALF, y = p.y + HALF, ring = ringHere(g);
  const no = (why: string) => { toast(g, why); return false; };
  if (g.area.def.indoors) return no(O.says.indoors);
  const t = tileOf(g.map, Math.floor(x / T), Math.floor(y / T));
  if (t !== Tile.Grass && t !== Tile.Flower) return no(O.says.notHere);
  if (ring && Math.hypot(x - ring.x, y - ring.y) < (ring.radius + O.ringMargin) * T) return no(O.says.inRing);
  if (oaksHere(g).some(o => Math.hypot(o.x - x, o.y - y) < O.spacing * T)) return no(O.says.tooNear);
  const s = grove(g);
  s.oaks.push({ id: s.next++, area: g.area.def.id, x, y, line: item.heard ?? "", grown: false, whispered: -Infinity });
  toast(g, O.says.planted, true);
  return true;
}

/** Every frame: at nightfall every shoot grows; after dark, a grown oak he's near whispers its line. */
export function oakSystem(g: Game, dt: number): void {
  const s = grove(g), was = s.hour, run = (g.hour - was + 24) % 24, toDusk = (SUNSET - was + 24) % 24;
  s.hour = g.hour;
  s.time += dt;
  if (toDusk > 0 && toDusk <= run && s.oaks.some(o => !o.grown)) {
    for (const o of s.oaks) o.grown = true;
    toast(g, O.says.grown, true);
  }
  whisper(g, s, dt);
}

function whisper(g: Game, s: Grove, dt: number): void {
  if (s.whisper) {
    s.whisper.age += dt;
    const gone = s.whisper.oak.area !== g.area.def.id;      // he's gone on: it stops
    if (gone || s.whisper.age >= F.line.in + s.whisper.hold + F.line.out) s.whisper = null;
    return;
  }
  if (isDay(g.hour)) return;
  const p = g.world.get(g.player, "transform");
  if (!p) return;
  const near = oaksHere(g).find(o => o.grown && o.line && s.time - o.whispered > O.again && Math.hypot(o.x - p.x - HALF, o.y - p.y - HALF) < O.near * T);
  if (!near) return;
  near.whispered = s.time;
  s.whisper = { oak: near, age: 0, hold: Math.max(F.line.hold, near.line.length * F.line.perChar) };
}
