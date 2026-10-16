// The fairy ring in the Witchwood (src/render/fey.ts): stand in it after dark and the world starts to swim. It's there
// as long as he's in the ring, and the longer he stands still the deeper it goes, till after a few seconds there's
// nothing left but the fair folk's lights and the ring itself; stand on, and the hearts and bars go too, and the fair folk
// start talking to him (src/data/feysayings.ts). One step and it eases back; out of the ring (or come the dawn) it's
// gone, and if they said anything to him while he was in it, they leave him something to remember it by. All the while
// it sounds (src/data/sfx.ts): a slow run of notes in and out, soft bells and a low wavering hum as it deepens, and far-off
// voices when they speak. Once he's come back up from the hill the third time, with the watchers there and the Erl-King
// gone (src/game/underhill.ts), the ring is broken: nothing happens in it any more, and it looks it (src/render/fey.ts).
import { FAIRY_RING as F, FEY_GIFT } from "../data/fey.ts";
import { FEY_SAYINGS } from "../data/feysayings.ts";
import { isDay } from "../data/daylight.ts";
import { HALF } from "../data/world.ts";
import { makeItem } from "../items/items.ts";
import type { Prop } from "../world/area.ts";
import { toast, type Game } from "./game.ts";
import { visitsUnderhill } from "./underhill.ts";
import { sound } from "./sfx.ts";
import { dropLoot } from "./spawn.ts";

type FairyRing = Extract<Prop, { kind: "fairyRing" }>;

/** Something the fair folk are saying: which line, how long it's been up, how long it holds, and how many they've said before it. */
export interface Saying { text: string; age: number; hold: number; n: number }
/**
 * Where he was last frame, whether he's in a ring at night, and how long he's stood still in it; and what the fair
 * folk are saying to him, how long till the next, and what they've still to say (none twice till all have been said).
 */
interface Trance {
  x: number; y: number; inside: boolean; still: number;
  saying: Saying | null; next: number; unsaid: number[]; said: number;
  /** The last thing they said to him this time in the ring, if they've said anything. */
  last: string | null;
  /** Seconds till the next bell, and the next hum. */
  chime: number; hum: number;
}
const trances = new WeakMap<Game, Trance>();
const trance = (g: Game): Trance => {
  let s = trances.get(g);
  if (!s) trances.set(g, s = { x: NaN, y: NaN, inside: false, still: 0, saying: null, next: 0, unsaid: [], said: 0, last: null, chime: 0, hum: 0 });
  return s;
};
/** How long a line is up, from fading in to gone. */
const lifeOf = (s: Saying) => F.line.in + s.hold + F.line.out;

/** The fairy ring in the area he's in, if there is one (and it isn't broken). */
export const ringHere = (g: Game): FairyRing | undefined =>
  g.area.layout.props.find((p): p is FairyRing => p.kind === "fairyRing" && !p.quiet && !p.broken);

/** Whether the fair folk's rings are broken: once he's been under the hill a third time and found only the watchers there. */
export const ringsBroken = (g: Game): boolean => visitsUnderhill(g) >= 3;

/** Arriving in an area, before it's built: its fairy ring is broken now, or still whole. */
export function breakRings(g: Game): void {
  for (const p of g.area.layout.props) if (p.kind === "fairyRing" && !p.quiet) p.broken = ringsBroken(g);
}

/** Every frame: is he in the ring after dark, and has he moved? */
export function fairyRingSystem(g: Game, dt: number): void {
  const s = trance(g), p = g.world.get(g.player, "transform"), ring = ringHere(g);
  if (!p) return;
  const moved = Math.hypot(p.x - s.x, p.y - s.y) > F.drift;
  s.x = p.x; s.y = p.y;
  const was = s.inside;
  s.inside = !!ring && !isDay(g.hour) && Math.hypot(p.x + HALF - ring.x, p.y + HALF - ring.y) < ring.radius * 2 * HALF;
  s.still = s.inside && !moved ? s.still + dt : 0;
  const spoke = s.said;
  speak(g, s, dt);
  if (s.said > spoke) sound(g, "feyVoice");
  if (!was && s.inside) { sound(g, "feyEnter"); s.chime = 0.6; s.hum = 0; }
  if (s.inside) hear(g, s, dt);
  if (was && !s.inside && ring) { sound(g, "feyLeave"); leave(g, s, p.x, p.y); }
}

/** In the ring: bells now and then, closer together the deeper he's in, and a low hum once he's well in. */
function hear(g: Game, s: Trance, dt: number): void {
  const depth = tranceOf(g), [lo, hi] = F.sound.chime;
  if ((s.chime -= dt) <= 0) {
    sound(g, "feyChime");
    s.chime = (lo + Math.random() * (hi - lo)) * (2 - depth);      // sounds' own dice: not the game's, so play's rolls don't shift
  }
  if (depth < F.sound.humFrom) { s.hum = 0; return; }
  if ((s.hum -= dt) <= 0) { sound(g, "feyHum"); s.hum = F.sound.hum; }
}

/** Out of the ring, or the night's over: if they said anything to him, the fair folk leave him an acorn holding the last of it. */
function leave(g: Game, s: Trance, x: number, y: number): void {
  if (!s.last) return;
  const acorn = makeItem("acorn", "rare", {}, FEY_GIFT.name);
  acorn.note = FEY_GIFT.note(s.last);
  dropLoot(g, x, y, acorn);
  toast(g, FEY_GIFT.says, true);
  s.last = null;
}

/** Stood still long enough, the fair folk talk to him, a line at a time; once he moves, they leave off till he's still again. */
function speak(g: Game, s: Trance, dt: number): void {
  if (s.saying) {
    s.saying.age += dt;
    const life = lifeOf(s.saying);
    if (s.still < F.speakFrom && s.saying.age < life - F.line.out) s.saying.age = life - F.line.out;   // he moved, or left: it fades now
    if (s.saying.age >= life) { s.saying = null; s.next = F.line.gap; }
    return;
  }
  if (s.still < F.speakFrom) { s.next = 0; return; }
  if ((s.next -= dt) > 0) return;
  if (!s.unsaid.length) s.unsaid = FEY_SAYINGS.map((_, i) => i);
  const [i] = s.unsaid.splice(Math.floor(g.rng.next() * s.unsaid.length), 1);
  const text = FEY_SAYINGS[i!]!;
  s.saying = { text, age: 0, hold: Math.max(F.line.hold, text.length * F.line.perChar), n: s.said++ };
  s.last = text;
}

/** What the fair folk are saying to him right now, if anything. */
export const sayingOf = (g: Game): Saying | null => trance(g).saying;

/** How far gone the screen's hearts, bars and buttons are: 0 till he's stood still in the ring long after it's taken him, then to 1. */
export function uiFadeOf(g: Game): number {
  const s = trance(g);
  return s.inside ? Math.min(1, Math.max(0, (s.still - F.uiFrom) / F.uiOver)) : 0;
}

/** How deep in the ring's spell he is: 0 out of it (or by day), from a little the moment he's in, to 1 after standing still long enough. */
export function tranceOf(g: Game): number {
  const s = trance(g);
  return s.inside ? F.base + (1 - F.base) * Math.min(1, s.still / F.full) : 0;
}
