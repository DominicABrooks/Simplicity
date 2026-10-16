// Following a Fey Acorn (src/data/underhill.ts): right-click it in the bag and he's held where he stands while the fair
// folk's magic comes up over everything, and then he's Under the Hill (src/areas/underhill.ts), held a little longer
// while it clears, before the Erl-King. The first time, the Erl-King tells him the secret under all the others and
// gives him the Ring of the Long Reel; the second, one thing more and a warning; from the third time on the throne is
// empty, and watchers stand all round the glade, staring at him, until he takes the path back out. How many times he's
// been is the world's, not the run's: it's kept across runs, like the hour.
import { FIRST_VISIT, GLADE_MID, REEL_RING, SECOND_VISIT, UNDERHILL as U } from "../data/underhill.ts";
import { HALF, T } from "../data/world.ts";
import { makeItem, type Item } from "../items/items.ts";
import { setState, toast, type Game } from "./game.ts";
import { dropLoot } from "./spawn.ts";

/** Where it's all happening (the area's id), and where the glade's middle is (game px), for the watchers to stand round. */
export const UNDERHILL_ID = "underhill";
const MIDDLE = { x: GLADE_MID.x * T, y: GLADE_MID.y * T };

/** The Erl-King saying something: the lines, which one he's on, how long it's been up, and how long it holds. */
export interface Speech { lines: readonly string[]; i: number; age: number; hold: number; then: "gift" | null }
/** Going under the hill (the magic coming up), or there and it clearing; how long it's been at it. */
type Journey = { phase: "going" | "clearing"; t: number } | null;

interface State { visits: number; journey: Journey; speech: Speech | null; watchers: number[] }
const states = new WeakMap<Game, State>();
const state = (g: Game): State => {
  let s = states.get(g);
  if (!s) states.set(g, s = { visits: 0, journey: null, speech: null, watchers: [] });
  return s;
};

/** How many times he's been under the hill. */
export const visitsUnderhill = (g: Game): number => state(g).visits;
/** Whether the Erl-King is on his throne for this visit (the first two). */
export const erlKingHere = (g: Game): boolean => g.area.def.id === UNDERHILL_ID && state(g).visits <= 2;
/** What the Erl-King is saying now, if anything. */
export const erlKingSays = (g: Game): Speech | null => state(g).speech;
/** How far the magic is over him, going or arriving (0 to 1). */
export function journeyMagic(g: Game): number {
  const j = state(g).journey;
  return !j ? 0 : j.phase === "going" ? Math.min(1, j.t / U.going) : Math.max(0, 1 - j.t / U.clearing);
}
/** Whether he's being held where he stands: going, or the magic still clearing, or the Erl-King talking. */
export const heldByFey = (g: Game): boolean => !!state(g).journey || !!state(g).speech;

/** Right-clicking a Fey Acorn in the bag: follow it, if he can from here. True if he's going (and it's spent). */
export function followAcorn(g: Game, _item: Item): boolean {
  const s = state(g);
  if (g.state !== "play" || s.journey || g.area.def.indoors) { toast(g, U.says.cannot); return false; }
  s.journey = { phase: "going", t: 0 };
  return true;
}

/** Before the hero moves, every frame: while the fair folk have him, nothing the player does moves him. */
export function holdForFey(g: Game): void {
  if (!heldByFey(g)) return;
  const input = g.input;
  input.keys.clear();
  input.attackPressed = input.attackReleased = input.jumpPressed = false;
  input.dashRequest = null;
}

/** Every frame: the journey down, the Erl-King's words and his gift, and the watchers. */
export function underhillSystem(g: Game, dt: number): void {
  const s = state(g), here = g.area.def.id === UNDERHILL_ID;
  const j = s.journey;
  if (j?.phase === "going" && (j.t += dt) >= U.going) {
    s.journey = { phase: "clearing", t: 0 };
    g.travel = { area: UNDERHILL_ID, entry: "arrive" };
    setState(g, "travel");
    return;
  }
  if (j?.phase === "clearing") {
    if (!here) return;                                       // not there yet
    if (j.t === 0) arrive(g, s);
    if ((j.t += dt) >= U.clearing) s.journey = null;
  }
  if (!here) { s.watchers = []; return; }
  speak(g, s, dt);
  stare(g, s, dt);
}

/** He's there: count the visit, and set it up. */
function arrive(g: Game, s: State): void {
  s.visits++;
  s.speech = null;
  if (s.visits === 1) s.speech = speech(FIRST_VISIT, "gift");
  else if (s.visits === 2) s.speech = speech(SECOND_VISIT, null);
  else summonWatchers(g, s);
}

const holdOf = (line: string) => Math.max(U.line.hold, line.length * U.line.perChar);
const speech = (lines: readonly string[], then: Speech["then"]): Speech => ({ lines, i: 0, age: -U.firstWord, hold: holdOf(lines[0]!), then });

function speak(g: Game, s: State, dt: number): void {
  const sp = s.speech;
  if (!sp) return;
  sp.age += dt;
  const L = U.line;
  if (sp.age < L.in + sp.hold + L.out + L.gap) return;
  if (sp.i + 1 < sp.lines.length) { sp.i++; sp.age = 0; sp.hold = holdOf(sp.lines[sp.i]!); return; }
  s.speech = null;
  if (sp.then === "gift") give(g);
}

/** The Ring of the Long Reel, into his hand. */
function give(g: Game): void {
  const p = g.world.need(g.player, "transform");
  const ring = makeItem(REEL_RING.type, "legendary", { ...REEL_RING.mods }, REEL_RING.name);
  ring.note = REEL_RING.note;
  const e = dropLoot(g, p.x, p.y, ring);
  g.world.remove(e, "despawn");                             // it's waited six hundred years; it can wait for a full bag
  toast(g, U.says.gift, true);
}

/** The third time and after: the watchers, all round the glade, more each time and a little nearer. */
function summonWatchers(g: Game, s: State): void {
  const W = U.watchers, k = s.visits - 3, n = Math.min(W.most, W.first + W.more * k), r = Math.max(W.nearest, W.far - W.nearer * k) * T;
  s.watchers = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.PI / 2 + (g.rng.next() - 0.5) * 0.3, rr = r * (0.9 + g.rng.next() * 0.2);
    s.watchers.push(g.world.create({
      transform: { x: MIDDLE.x + Math.cos(a) * rr - HALF, y: MIDDLE.y + Math.sin(a) * rr * 0.85 - HALF },
      watcher: { shown: 0, going: false },
      renderable: { kind: "watcher" },
    }));
  }
}

/** They come slowly out of the dark, and then they stay, and stare. */
function stare(g: Game, s: State, dt: number): void {
  for (const e of s.watchers) {
    const w = g.world.get(e, "watcher");
    if (w) w.shown = Math.min(1, w.shown + dt / U.watchers.fade);
  }
}
