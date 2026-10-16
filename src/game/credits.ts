// The credits (STORY.md, "0:55"; src/ui/credits.ts draws the caption and The End over them). After the King's had his
// say, they don't play back what he's just been through: they show what came of it, a short shot at a time, in the
// game's own world, building to the dragons. The Greyed losing their grey, the slimes gone still, the King reading the
// true chronicle at the cross; the Vael coming over the bridge for their eggs and the Old Mother flying in over it for
// them, and the eggs hatching beside her under the Greyspines (her and her hatchlings drawn in src/render/dragons.ts);
// and last his own ending, asleep in the Fells' house with a lantern of his own in the window, the Ranger home by the
// fire with Meg. Some of what's said changes with what else he did. Each shot loads its area, clears off anything
// that'd wander in, stands the people in it, and moves the camera itself (in, out, round), the clock running on so
// everything breathes and flickers; a shot with a long line under it holds long enough to read. A little tune plays
// under them all, coming round a little different each time. After, he's put back where he was.
import { loadArea } from "../areas/index.ts";
import type { Entity } from "../core/ecs.ts";
import { CREDITS_TIME, CROWD_OF, RUN_SUMS, SHOT_SAYS, SHOT_SAYS_TOO, type ShotId } from "../data/ending.ts";
import { CURIO_IDS } from "../data/items.ts";
import { CREDITS_AIR } from "../data/sfx.ts";
import { MAGE_TARGET, SCHOOLS, SLIME, SLIME_TARGET, type School } from "../data/enemies.ts";
import { SPAWN } from "../areas/witchwood.ts";
import { HALF, T, Tile } from "../data/world.ts";
import type { AreaDef, Prop } from "../world/area.ts";
import { solidAt } from "../world/collision.ts";
import { forgetLayout, layoutOf } from "../world/layouts.ts";
import { propSolids } from "../world/solids.ts";
import { interiorOf, type Spot } from "../world/interiors.ts";
import type { Resident } from "../world/residents.ts";
import { registerArea } from "../areas/index.ts";
import { Rng } from "../core/rng.ts";
import { Town } from "../world/townkit.ts";
import { beaten, type Who } from "./bosses.ts";
import { crowdOf } from "./crowd.ts";
import { curioFound } from "./curios.ts";
import type { Game } from "./game.ts";
import type { Bed, Dragon, Egg } from "./components.ts";
import { sound } from "./sfx.ts";
import { endCelebration } from "./victory.ts";
import { spawnKing } from "./spawn.ts";
import { loadCensus } from "./townsfolk.ts";
import { standIn as standInside } from "./interiors.ts";
import { endTalk } from "./talk.ts";
import { enterArea } from "./travel.ts";

/** Where the camera looks (px, centres), how far out (1 the usual), and how far round (radians, from the usual). */
export interface Cam { x: number; y: number; zoom: number; yaw: number }

/** How the run went, read at the start of the credits. */
interface Run {
  level: number; kills: number; curios: number; beat: Set<Who>;
  /** How many followed him up the hill with the head. */
  followed: number;
}

/**
 * A shot, staged: where the camera starts and ends (or follows the hero), what's said, what moves as it plays (k: 0 to
 * 1), and, if he's asleep in it, the bed he's lying in.
 */
interface Staged {
  from: Cam; to: Cam; follow?: boolean; says: string; play?(k: number, dt: number): void; asleep?: Bed;
  /** Or the camera's whole way through the shot, if it does more than go from one place to another. */
  camAt?(k: number): Cam;
  /** How long (s) it holds at the least, if there's more to see in it than its line takes to read. */
  hold?: number;
}

/**
 * Each shot: whether this run had it, where it's set (or how to make the place, if it isn't one of the areas: null if
 * it can't be), the hour there, and how to stage it once there.
 */
/**
 * A shot: where (`area`, or a place made for it by `load`), at what hour, whether this run had it, and how it's staged.
 * `alters`: its place is the real area made over for it (the same id, so its townsfolk come out), so the real one's
 * layout is set aside before the shot and again after (see setAside).
 */
interface Shot { id: ShotId; area: string; load?(): Promise<AreaDef | null>; alters?: boolean; hour: number; had(run: Run): boolean; stage(g: Game, run: Run): Staged }

interface Reel {
  shots: Shot[];
  run: Run;
  /** Each shot's area, once loaded (or made); and whether they all are. */
  defs: Map<ShotId, AreaDef>;
  ready: boolean;
  /** The shot playing (-1 while the areas load), how far into it (s), it staged, and how long it holds (s). */
  at: number;
  t: number;
  staged: Staged | null;
  length: number;
  cam: Cam | null;
  /** Where he was before, to be put back after. */
  back: { area: AreaDef; x: number; y: number; hour: number };
  /** The tune: which time round it's on, and how long (s) till it comes round again. */
  turn: number;
  music: number;
}
const reels = new WeakMap<Game, Reel>();

/** The camera, while the credits are rolling a shot (the renderer looks here first). */
export const creditsCamera = (g: Game): Cam | null => reels.get(g)?.cam ?? null;

/** In the credits' last shot he's asleep: the bed he's lying in, for the hero to be drawn lying in it (src/render/hero.ts). */
export const creditsAsleep = (g: Game): Bed | null => reels.get(g)?.staged?.asleep ?? null;

/** What's said under the shot on screen now, and how faded in it is (0 to 1); null between shots or before they start. */
export function creditsShot(g: Game): { says: string; shown: number } | null {
  const r = reels.get(g);
  if (!r?.staged) return null;
  const F = CREDITS_TIME;
  return { says: r.staged.says, shown: Math.max(0, Math.min(1, r.t / F.fade, (r.length - r.t) / F.fade)) };
}

/** How long a shot holds, for its line to be read: its words at the reading pace, and the fades either side; never short. */
export const shotLength = (says: string): number =>
  Math.max(CREDITS_TIME.shot, says.split(/\s+/).filter(Boolean).length / CREDITS_TIME.read + 2 * CREDITS_TIME.fade);

/** Under The End: this run, in a line. */
export function runSum(g: Game): string {
  const run = reels.get(g)?.run ?? readRun(g);
  const n = (s: string, v: number) => s.replace("{n}", `${v}`);
  return [n(RUN_SUMS.level, run.level), n(RUN_SUMS.kills, run.kills), run.curios === 1 ? RUN_SUMS.curio : run.curios ? n(RUN_SUMS.curios, run.curios) : ""]
    .filter(Boolean).join(" · ");
}

function readRun(g: Game): Run {
  const beat = new Set<Who>((["cinder", "rime", "calder"] as const).filter(w => beaten(g, w)));
  return {
    level: g.world.need(g.player, "hero").level, kills: g.kills,
    curios: CURIO_IDS.filter(id => curioFound(g, id)).length, beat, followed: crowdOf(g).following.length,
  };
}

/** Where the next credits start (getting about quickly in development: src/debug.ts), if not at the beginning. */
const startAt = new WeakMap<Game, ShotId>();
export function creditsFrom(g: Game, id: ShotId): void { startAt.set(g, id); }

/** Start the reel: read the run, choose its shots, strike up the tune, and load their areas (dark till then). */
export async function rollCredits(g: Game): Promise<void> {
  const run = readRun(g), had = SHOTS.filter(s => s.had(run)), p = g.world.need(g.player, "transform");
  const from = had.findIndex(s => s.id === startAt.get(g)), shots = from > 0 ? had.slice(from) : had;
  startAt.delete(g);
  Object.assign(g.weather, { kind: "clear", fog: 0, rain: 0 });   // every shot under a clear sky
  endCelebration(g);                                          // and nothing over them
  const reel: Reel = {
    shots, run, defs: new Map(), ready: false, at: -1, t: 0, staged: null, length: CREDITS_TIME.shot, cam: null,
    back: { area: g.area.def, x: p.x, y: p.y, hour: g.hour }, turn: 0, music: CREDITS_AIR.every,
  };
  reels.set(g, reel);
  sound(g, CREDITS_AIR.turns[0]);
  const defs = await Promise.all(shots.map(s => (s.load ? s.load() : loadArea(s.area))));
  shots.forEach((s, i) => { const def = defs[i]; if (def) reel.defs.set(s.id, def); });
  reel.shots = shots.filter(s => reel.defs.has(s.id));    // a place that couldn't be made: that shot's left out
  reel.ready = true;
}

/** Every frame of the credits: the clock runs on, the shot plays, and on to the next. True once the last shot's done. */
export function updateCredits(g: Game, dt: number): boolean {
  const r = reels.get(g);
  if (!r) return true;
  const done = playOn(g, r, dt);
  if ((r.music -= dt) <= 0) {                                // the tune comes round again, a little different each time
    r.music += CREDITS_AIR.every;                            // (after the shot's moved on: a new place hushes what was to be heard)
    sound(g, CREDITS_AIR.turns[++r.turn % CREDITS_AIR.turns.length]!);
  }
  return done;
}

function playOn(g: Game, r: Reel, dt: number): boolean {
  g.clock += dt;                                             // the world breathes and flickers, though nobody's playing
  if (r.at < 0) {
    if (!r.ready || (r.t += dt) < CREDITS_TIME.dark) return false;
    return nextShot(g, r);
  }
  r.t += dt;
  const s = r.staged!, k = Math.min(1, r.t / r.length);
  s.play?.(k, dt);
  aim(g, r, k);
  return r.t >= r.length ? nextShot(g, r) : false;
}

/** Point the camera along the shot, k of the way through. */
function aim(g: Game, r: Reel, k: number): void {
  const s = r.staged!, e = ease(k), hero = g.world.need(g.player, "transform");
  if (s.camAt) { r.cam = s.camAt(k); return; }
  r.cam = {
    x: s.follow ? hero.x + HALF : lerp(s.from.x, s.to.x, e), y: s.follow ? hero.y + HALF : lerp(s.from.y, s.to.y, e),
    zoom: lerp(s.from.zoom, s.to.zoom, e), yaw: lerp(s.from.yaw, s.to.yaw, e),
  };
}

/** Skip the rest: no more shots (the overlay goes to The End). */
export function skipShots(g: Game): void {
  const r = reels.get(g);
  if (r) { r.at = r.shots.length; r.staged = null; }
}

/** The credits are over: put him back where he was, as he was. */
export function endReel(g: Game): void {
  const r = reels.get(g);
  if (!r) return;
  reels.delete(g);
  g.hour = r.back.hour;
  setAside(r);
  enterArea(g, r.back.area, firstEntry(r.back.area));
  Object.assign(g.world.need(g.player, "transform"), { x: r.back.x, y: r.back.y });
}

function nextShot(g: Game, r: Reel): boolean {
  r.at++;
  r.t = 0;
  r.staged = null;
  const shot = r.shots[r.at];
  if (!shot) { r.cam = null; return true; }
  crowdOf(g).following = [];                                 // nobody follows him through the pictures
  crowdOf(g).gathered = null;
  g.hour = shot.hour;
  const def = r.defs.get(shot.id)!;
  setAside(r);
  enterArea(g, def, firstEntry(def));
  // Nothing wanders in, nobody's talking, and he's whole and standing.
  for (const [e] of g.world.query("enemy")) if (!g.world.has(e, "dummy")) g.world.destroy(e);
  for (const [e] of g.world.query("pickup")) g.world.destroy(e);
  if (g.world.has(g.player, "cutscene")) g.world.remove(g.player, "cutscene");
  endTalk(g);
  g.target = null;
  Object.assign(g.world.need(g.player, "status"), { hurt: 0, sheep: 0, frozen: 0, chill: 0 });
  r.staged = shot.stage(g, r.run);
  r.length = Math.max(shotLength(r.staged.says), r.staged.hold ?? 0);
  r.staged.play?.(0, 0);
  aim(g, r, 0);
  return false;
}

/** Set aside the layouts of the places made over for shots (built afresh as the shot, and as themselves again after). */
function setAside(r: Reel): void {
  for (const s of r.shots) if (s.alters) forgetLayout(r.defs.get(s.id)?.id ?? s.area);
}

/** The Market Quarter cleared for the King's reading: its stalls taken down (and nothing standing where they stood). */
async function marketCleared(): Promise<AreaDef> {
  const def = await loadArea("capital");
  return {
    ...def,
    build() {
      const layout = def.build(), stalls = layout.props.filter(p => p.kind === "stall");
      const gone = new Set(stalls.flatMap(propSolids).map(s => JSON.stringify(s)));
      return {
        ...layout,
        props: layout.props.filter(p => p.kind !== "stall"),
        map: { ...layout.map, solids: layout.map.solids.filter(s => !gone.has(JSON.stringify(s))) },
      };
    },
  };
}

/** The King's Bridge kept clear for the Vael: a place of its own for the shot, so none of the townsfolk come out onto it. */
async function bridgeCleared(): Promise<AreaDef> {
  return { ...(await loadArea("kingsroad")), id: "kingsroad:the-vael" };
}

/** Any way into an area: each shot puts him where it wants him after. */
const firstEntry = (def: AreaDef) => Object.keys(layoutOf(def).entries)[0]!;

// ---------- Staging ----------
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const ease = (k: number) => k * k * (3 - 2 * k);
const cam = (x: number, y: number, zoom: number, yaw = 0): Cam => ({ x, y, zoom, yaw });
/** How far k is from a to b, 0 to 1. */
const ramp = (k: number, a: number, b: number) => Math.max(0, Math.min(1, (k - a) / (b - a)));
/** The camera through a shot by keyframes ([k, where]), easing from each to the next. */
const keys = (frames: readonly [number, Cam][]) => (k: number): Cam => {
  const last = frames[frames.length - 1]!, i = frames.findIndex(([at]) => at > k);
  if (i < 0) return last[1];
  if (i === 0) return frames[0]![1];
  const [a, from] = frames[i - 1]!, [b, to] = frames[i]!, e = ease(ramp(k, a, b));
  return { x: lerp(from.x, to.x, e), y: lerp(from.y, to.y, e), zoom: lerp(from.zoom, to.zoom, e), yaw: lerp(from.yaw, to.yaw, e) };
};
const propOf = <K extends Prop["kind"]>(g: Game, kind: K) => g.area.layout.props.find((p): p is Extract<Prop, { kind: K }> => p.kind === kind);

/**
 * The first of these places (px, centres) with nothing solid within `room` px of it (no stall, no wall), and nothing
 * between it and the camera (south of it, `view` px down), so whoever stands there stands clear in the shot, not
 * hidden behind a stall's awning; or the first, if none is.
 */
function clearOf(g: Game, spots: readonly (readonly [number, number])[], room = T, view = 3 * T): [number, number] {
  const around = [[0, 0], [room, 0], [-room, 0], [0, room], [0, -room]];
  for (let down = T; down <= view; down += T) around.push([0, down], [-room, down], [room, down]);
  const clear = ([x, y]: readonly [number, number]) => around.every(([dx, dy]) => !solidAt(g.map, x + dx!, y + dy!));
  const at = spots.find(clear) ?? spots[0]!;
  return [at[0], at[1]];
}

/** Stand him at (x, y) (px, his centre), looking toward (tx, ty); walking, if he's moving. */
function heroAt(g: Game, x: number, y: number, tx: number, ty: number, walking = false): void {
  Object.assign(g.world.need(g.player, "transform"), { x: x - HALF, y: y - HALF });
  const m = g.world.need(g.player, "motion");
  m.moving = walking;
  m.aim = Math.atan2(ty - y, tx - x);
}
/** One of the Greyed loses the grey: a burst where they stood, and they're gone. */
function crumble(g: Game, e: Entity, palette: "fire" | "frost" | "spark"): void {
  const t = g.world.get(e, "transform");
  if (!t) return;
  for (let i = 0; i < 3; i++) g.fx.push({ type: "burst", x: t.x + (i - 1) * 3, y: t.y - i * 2, palette });
  g.fx.push({ type: "burst", x: t.x, y: t.y, palette: "arcane" });
  g.world.destroy(e);
}
/** One of the Greyed, standing (cell top-left): a mage of that school, nobody's fight. */
function greyed(g: Game, school: School, x: number, y: number): Entity {
  return g.world.create({
    transform: { x, y },
    knockback: { vx: 0, vy: 0 },
    health: { hp: 1, maxHp: 1 },
    enemy: { kind: "mage", flash: 0, face: 1 },
    mage: {
      school, timer: 99, casting: false, castT: 0, castK: 0, spell: null, strafe: 1, strafeT: 0, stuckT: 0,
      blinkCD: 99, specialCD: 99, moving: false, melee: false, swing: null, swingCD: 0, swingSide: 0, swingK: 0, swingRel: 0,
    },
    targetable: { name: SCHOOLS[school].name, hostile: true, ...MAGE_TARGET },
    renderable: { kind: "mage" },
  });
}

/** A slime, sitting still (cell top-left). */
function slime(g: Game, x: number, y: number): Entity {
  return g.world.create({
    transform: { x, y },
    knockback: { vx: 0, vy: 0 },
    health: { hp: SLIME.hp, maxHp: SLIME.hp },
    enemy: { kind: "slime", flash: 0, face: 1 },
    slime: { timer: 99, hop: 0, dx: 0, dy: 0 },
    targetable: { hostile: true, ...SLIME_TARGET },
    renderable: { kind: "slime" },
  });
}

/**
 * The townsfolk out in the street, gathered round (x, y) (px) in a crescent on the near side, facing it and staying
 * put; and the dogs and cats about, wherever they are, stood still and looking at it too.
 */
function gatherRound(g: Game, x: number, y: number, r: number): void {
  g.world.query("walker", "transform").forEach(([, c], i, all) => {
    const a = Math.PI * (0.15 + 0.7 * (i / Math.max(1, all.length - 1))), d = r + (i % 3) * 6;
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.8;   // the crescent a little squashed, for the camera
    Object.assign(c.transform, { x: px - HALF, y: py - HALF });
    Object.assign(c.walker, { path: [], moving: false, wait: 999, follow: null, goIn: false, task: null, facing: Math.atan2(y - py, x - px) });   // each looking right at it
  });
  for (const [, { pet, transform: t }] of g.world.query("pet", "transform")) {
    Object.assign(pet, { path: [], moving: false, running: false, greeting: false, wait: 999, facing: Math.atan2(y - t.y - HALF, x - t.x - HALF) });
  }
}

/**
 * A dragon (px, cell top-left; see Dragon): its transform kept at `seen` if given, somewhere the camera's always on, so
 * the renderer doesn't put it away while it's high in the sky and the ground under it is out of the picture.
 */
function dragonAt(g: Game, d: Partial<Dragon> & Pick<Dragon, "x" | "y" | "size" | "hide" | "pose">, seen?: { x: number; y: number }): Entity {
  return g.world.create({
    transform: { x: seen?.x ?? d.x, y: seen?.y ?? d.y },
    dragon: { height: 0, facing: Math.PI / 2, flap: 0, neck: 0, spread: 0, fire: 0, grow: 1, walk: 0, stride: 0, ...d },
    renderable: { kind: "dragon" },
  });
}
/**
 * How high the Old Mother flies over the King's Bridge (world units): low over the bridge itself, so it shakes; and up
 * over what stands across her way, the bridge's gatehouse at its south end (towers and gilded domes, about 13 at the
 * top) and the city wall at Southgate (towers 13 high and their roofs: src/areas/kingsroad.ts), with room for her
 * wings and her legs and tail, which hang some 6 below her, rising smoothly to each and down again; and on up away over
 * the city.
 */
const MOTHER = { low: 9.5, overGate: 19.5, overWall: 21, reach: 7 * T, away: 23 };
/** Her height (world units) at y (px) on her way north, given where the bridge's gatehouse and the city wall stand (px). */
function motherHeight(y: number, gate: number, wall: number): number {
  const hill = (at: number, top: number) => {
    const k = Math.max(0, 1 - Math.abs(y - at) / MOTHER.reach);
    return MOTHER.low + (top - MOTHER.low) * Math.sin((k * Math.PI) / 2) ** 2;
  };
  const past = y < wall ? MOTHER.overWall + (MOTHER.away - MOTHER.overWall) * Math.min(1, (wall - y) / (2 * MOTHER.reach)) : 0;
  return Math.max(hill(gate, MOTHER.overGate), hill(wall, MOTHER.overWall), past);
}
/** One of the three eggs, standing (cell top-left). */
const eggAt = (g: Game, school: Egg["school"], x: number, y: number, gilt: number, glow = 0): Entity =>
  g.world.create({ transform: { x, y }, egg: { school, gilt, glow, crack: 0, open: false, hatch: 0 }, renderable: { kind: "egg" } });
/** The wingbeats of a dragon in flight, run on by dt: a great whump at the bottom of each, and the ground shaking a little. */
function beat(g: Game, d: Dragon, dt: number, pace: number): void {
  const before = Math.floor(d.flap / (2 * Math.PI));
  d.flap += dt * pace;
  if (Math.floor(d.flap / (2 * Math.PI)) > before) { sound(g, "wingbeat"); g.shake = Math.max(g.shake, 0.5); }
}
/**
 * A dragon walking to (x, y) (px) this frame: turning to face the way it's going (or `want`, standing) no faster than it
 * can turn, stepping as it goes, a step for each stride's length, and shuffling its feet round as it turns on the spot.
 */
function stepTo(d: Dragon, x: number, y: number, want: number | null, dt: number): void {
  if (dt <= 0) { d.x = x; d.y = y; return; }
  const far = Math.hypot(x - d.x, y - d.y) / T, goal = far > 0.002 ? Math.atan2(y - d.y, x - d.x) : want ?? d.facing;
  const off = Math.atan2(Math.sin(goal - d.facing), Math.cos(goal - d.facing)), turn = Math.max(-WALK.turn * dt, Math.min(WALK.turn * dt, off));
  d.facing += turn;
  d.x = x; d.y = y;
  const len = WALK.stride * d.size;
  d.walk += (far / len) * Math.PI + Math.abs(turn) * WALK.shuffle;
  const stepping = Math.min(1, far / dt / (len * WALK.pace) + (Math.abs(turn) / dt) * 0.4);
  d.stride += (stepping - d.stride) * Math.min(1, dt * 10);
}
/** How a little dragon walks: its stride's length (world units for each 1 of size), its usual pace (strides a second), how fast it can turn (radians a second), and how much stepping a turn takes. */
const WALK = { stride: 0.55, pace: 2.2, turn: 3.5, shuffle: 2.5 } as const;
/** The ground stops shaking (nobody's playing to settle it, in the credits). */
const settle = (g: Game, dt: number) => { g.shake = Math.max(0, g.shake - dt * 2.5); };
const ORDERS = ["ember", "frost", "storm"] as const;

const SHOTS: readonly Shot[] = [
  // ---------- What it meant ----------
  {
    // The Greyed's camp in the Ashwild: the last of them standing about the old fire ring, and with nobody to follow,
    // the grey goes out of them one by one, a burst of their own school's colour each, till the glade's empty.
    id: "greyed", area: "ashwild", hour: 9, had: () => true,
    stage(g) {
      const lair = propOf(g, "boss")!, x = lair.x, y = lair.y, n = 7, schools: School[] = ["ember", "frost", "storm"];
      const palette = { ember: "fire", frost: "frost", storm: "spark" } as const;
      const them = Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + 0.3, school = schools[i % 3]!;
        return { e: greyed(g, school, x + Math.cos(a) * 4 * T - HALF, y + Math.sin(a) * 3 * T - HALF), school, at: 0.2 + (i / n) * 0.6 };
      });
      heroAt(g, x, y + 5 * T, x, y);
      return {
        from: cam(x, y + 1.5 * T, 1.3, -0.4), to: cam(x, y + 1.5 * T, 1.1, 0.4), says: SHOT_SAYS.greyed,
        play: k => { for (const m of them) if (k >= m.at && g.world.isAlive(m.e)) crumble(g, m.e, palette[m.school]); },
      };
    },
  },
  {
    // Back in the clearing where he woke: the slimes sat about on the trail by the camp, quite still.
    id: "slimes", area: "witchwood", hour: 17.5, had: () => true,
    stage(g) {
      // The trail south of where he woke, the nearest stretch of it: a slime on every other tile.
      const sx = Math.floor(SPAWN.x / T), sy = Math.floor(SPAWN.y / T), trail: [number, number][] = [];
      for (let y = sy + 1; y <= sy + 10; y++) for (let x = sx - 10; x <= sx + 10; x++) if (g.map.tiles[y]?.[x] === Tile.Path) trail.push([x, y]);
      trail.sort((a, b) => Math.hypot(a[0] - sx, a[1] - sy) - Math.hypot(b[0] - sx, b[1] - sy));
      const sat = trail.slice(0, 18).filter((_, i) => i % 2 === 0), n = Math.max(1, sat.length);
      for (const [x, y] of sat) slime(g, x * T + ((x * 7) % 3) - 1, y * T + ((y * 5) % 3) - 1);
      const cx = (sat.reduce((m, [x]) => m + x, 0) / n) * T + HALF, cy = (sat.reduce((m, [, y]) => m + y, 0) / n) * T + HALF;
      heroAt(g, cx - 2 * T, cy - 2 * T, cx, cy);
      return { from: cam(cx, cy, 1.0, 0.5), to: cam(cx, cy, 0.75, -0.25), says: SHOT_SAYS.slimes };
    },
  },
  {
    // The market cross the next morning: the King on its steps reading the true chronicle, the city gathered round.
    id: "chronicle", area: "capital", load: marketCleared, alters: true, hour: 9.5, had: () => true,
    stage(g, run) {
      // On the cross's steps in front of it (the stalls are down for it: see marketCleared), or, if anything's in the
      // way after all, beside it along the aisle, wherever he stands clear in the shot.
      const cross = propOf(g, "cross")!, along = [2.4, -2.4, 4.6, -4.6, 6.6, -6.6].map(k => [cross.x + k * T, cross.y + 0.4 * T] as const);
      const [x, ky] = clearOf(g, [[cross.x, cross.y + 2.2 * T], ...along]);
      spawnKing(g, x - HALF, ky - HALF, Math.PI / 2);
      gatherRound(g, x, ky, 3.2 * T);
      heroAt(g, x + 4 * T, ky + 3 * T, x, ky);
      return {
        from: cam(x, ky, 0.55, 0.3), to: cam(x, ky + 0.5 * T, 0.62, -0.3), says: [SHOT_SAYS.chronicle, followedLine(run.followed)].filter(Boolean).join(" "),
        play: () => gatherRound(g, x, ky, 3.2 * T),
      };
    },
  },
  {
    // The Vael on the King's Bridge, come north for their eggs: one of each order in each row, walking up the deck in
    // their own colours to the King waiting under Southgate, and on the stones before him the three eggs, still in the
    // gold leaf they've worn six hundred years as "altar stones". It flakes off them in showers of sparks, one after
    // another, and each glows its own colour; and then the Old Mother comes up the river behind the Vael, low enough to
    // shake the bridge (but well over Southgate's towers), her shadow going over the whole of it, and roars as she goes
    // over her eggs and on over the city.
    id: "eggs", area: "kingsroad", load: bridgeCleared, hour: 8, had: () => true,
    stage(g) {
      const deck = propOf(g, "stoneBridge")!.rect, x = deck.x + deck.w / 2, top = deck.y + 2 * T, foot = deck.y + deck.h - 4 * T;
      spawnKing(g, x - HALF, top - HALF, Math.PI / 2);
      heroAt(g, x + 1.5 * T, top + HALF, x, foot);
      const ey = top + 1.5 * T, eggs = ORDERS.map((school, i) => eggAt(g, school, x + (i - 1) * 1.1 * T - HALF, ey + (i === 1 ? 0.3 * T : 0) - HALF, 1));
      const them = Array.from({ length: 6 }, (_, i) => ({
        e: greyed(g, ORDERS[i % 3]!, 0, 0), dx: ((i % 3) - 1) * 1.4 * T, back: Math.floor(i / 3) * 2 * T,
      }));
      const near = top + 3.4 * T, from = foot + 24 * T, to = top - 30 * T;
      const barbican = propOf(g, "barbican")?.rect, wall = g.area.layout.props.find(p => p.kind === "curtainWall");
      const gateY = barbican ? barbican.y + barbican.h / 2 : foot + 6 * T, wallY = wall?.kind === "curtainWall" ? wall.points[0]!.y : top - 2 * T;
      const her = dragonAt(g, { x: x - HALF, y: from, height: motherHeight(from, gateY, wallY), facing: -Math.PI / 2, size: 5, hide: "mother", pose: "fly" }, { x: x - HALF, y: ey - HALF });
      const keyed = keys([
        [0, cam(x, foot, 0.8, 0.4)], [0.34, cam(x, ey + T, 0.7, 0.1)], [0.42, cam(x, ey, 0.5, -0.05)],
        [0.55, cam(x, ey, 2.1, -0.15)], [0.85, cam(x, ey, 2.3, -0.3)], [1, cam(x, ey + T, 1.6, -0.35)],
      ]);
      // While she's over, the camera keeps her and the eggs both in the picture.
      const shots = (k: number): Cam => {
        const c = keyed(k), y = g.world.get(her, "dragon")?.y ?? ey, w = ramp(k, 0.42, 0.52) * (1 - ramp(k, 0.8, 0.95));
        return { ...c, y: lerp(c.y, (y + HALF + ey) / 2, w * 0.8) };
      };
      const gilded = [false, false, false];
      let roared = false;
      return {
        from: shots(0), to: shots(1), camAt: shots, says: SHOT_SAYS.eggs, hold: 16,
        play: (k, dt) => {
          const u = ramp(k, 0, 0.34);
          for (const m of them) {
            Object.assign(g.world.need(m.e, "transform"), { x: x + m.dx - HALF, y: lerp(foot, near, u) + m.back - HALF });
            g.world.need(m.e, "mage").moving = u < 1;
          }
          eggs.forEach((e, i) => {                           // the gold comes off, one after another
            const egg = g.world.need(e, "egg"), a = 0.36 + i * 0.035;
            egg.gilt = 1 - ramp(k, a, a + 0.05);
            egg.glow = ramp(k, a + 0.02, a + 0.08);
            if (!gilded[i] && k >= a) { gilded[i] = true; sound(g, "gilding"); }
          });
          const d = g.world.need(her, "dragon"), f = ramp(k, 0.42, 1);
          d.y = lerp(from, to, f);
          d.height = motherHeight(d.y, gateY, wallY);         // low over the bridge, up over the gatehouse and the wall
          if (f > 0 && f < 1) beat(g, d, dt, 2.2);
          if (!roared && d.y <= ey + 3 * T) { roared = true; sound(g, "roar"); g.shake = Math.max(g.shake, 2.5); }
          settle(g, dt);
        },
      };
    },
  },
  {
    // Under the Greyspines, the eggs home beside their mother: she stands at the head of a high meadow, the mountains
    // close behind her, her face right down over the three of them, glowing. One after another they rock in fits and
    // starts and the crack shows; then a snout pushes the top up from inside, a small head in its order's colour (red,
    // white, indigo) pokes out and peers about, the top tips off into the grass, and the hatchling clambers out over the
    // rim, damp and small, unfurls, stretches its wings, and toddles off to a spot of its own. She lifts her head to
    // look at each. Then she rears up, wings wide, and roars fire at the sky; they look up at her and each breathes its
    // first small breath; and their song with hers seals the valley whole.
    id: "hatch", area: "greyspines", load: async () => greyspines(), hour: 17.5, had: () => true,
    stage(g) {
      const mx = (g.map.width * T) / 2, my = 6 * T, ey = my + 3.3 * T;   // right under her face, head down
      const her = dragonAt(g, { x: mx - HALF, y: my - HALF, size: 4, hide: "mother", pose: "sit" });
      const eggs = ORDERS.map((school, i) => eggAt(g, school, mx + (i - 1) * 0.6 * T - HALF, ey + (i === 1 ? 0.3 * T : 0) - HALF, 0, 0.8));   // between her wing-claws
      heroAt(g, mx + 4.5 * T, ey + 3 * T, mx, ey);
      const young: (Entity | null)[] = [null, null, null];
      let roared = false, sang = false;
      const shots = keys([
        [0, cam(mx, ey, 0.42, 0.35)], [0.42, cam(mx, ey + 0.3 * T, 0.55, 0.12)], [0.56, cam(mx, my - T, 2.4, -0.7)],
        [0.78, cam(mx, my - 2 * T, 2.8, -1.05)], [1, cam(mx, my - T, 2.5, -0.55)],   // round her side as she rears, then out
      ]);
      return {
        from: shots(0), to: shots(1), camAt: shots, says: SHOT_SAYS.hatch, hold: 19,
        play: (k, dt) => {
          eggs.forEach((e, i) => {
            const a = 0.05 + i * 0.12, h = a + 0.07, egg = g.world.need(e, "egg"), at = g.world.need(e, "transform");
            egg.crack = ramp(k, a, h);
            egg.hatch = ramp(k, h, h + 0.05);
            egg.glow = 0.8 * (1 - ramp(k, h, h + 0.12));
            if (!egg.open && k >= h) {                       // inside it, curled up, head up, about to push
              egg.open = true;
              sound(g, "hatch");
              young[i] = dragonAt(g, { x: at.x, y: at.y - 0.1 * T, height: -0.12, size: 0.3, hide: egg.school, pose: "sit", neck: 1, facing: Math.PI / 2 + (i - 1) * 0.5 });
            }
          });
          young.forEach((y, i) => {
            if (y === null) return;
            const d = g.world.need(y, "dragon"), h = 0.12 + i * 0.12, look = ramp(k, 0.55, 0.62), puff = 0.8 + i * 0.045;
            const egg = g.world.need(eggs[i]!, "transform");
            const poke = ramp(k, h, h + 0.03), climb = ease(ramp(k, h + 0.05, h + 0.1)), out = ease(ramp(k, h + 0.12, h + 0.24));
            // From inside the shell, over the rim to just in front of it, then a wander off to a spot of its own: out and
            // round in a little curve, walking all the way, turning as it goes.
            const inside = { x: egg.x, y: egg.y - 0.1 * T }, rim = { x: egg.x + (i - 1) * 0.15 * T, y: egg.y + 0.6 * T };
            const spot = { x: egg.x + (i - 1) * 1.1 * T, y: egg.y + 1.6 * T }, bend = Math.sin(Math.PI * out) * (i === 1 ? -0.5 : (i - 1) * 0.6) * T;
            const goX = lerp(lerp(inside.x, rim.x, climb), spot.x, out) + bend, goY = lerp(lerp(inside.y, rim.y, climb), spot.y, out);
            // Peering about from the top of the shell; then facing her, once it's somewhere to stand, to look up at her.
            const peer = Math.PI / 2 + (i - 1) * 0.5 + Math.sin((k - h) * 60) * 0.3 * (1 - ramp(k, h + 0.03, h + 0.06));
            if (poke < 1) { d.x = goX; d.y = goY; d.facing = peer; } else stepTo(d, goX, goY, look > 0 ? -Math.PI / 2 + (i - 1) * 0.5 : null, dt);
            // Head up out of the top; up and over the rim.
            d.height = -0.12 + 0.2 * poke - 0.08 * climb + Math.sin(Math.PI * climb) * 0.16;
            d.size = 0.3 + 0.28 * ease(ramp(k, h + 0.06, h + 0.2));   // damp and small, unfurling as it goes
            d.spread = ramp(k, h + 0.1, h + 0.115) * (1 - ramp(k, h + 0.13, h + 0.15));   // a stretch of its new wings, before it sets off
            const settle = lerp(1, 0.35, ramp(k, h + 0.08, h + 0.12));
            d.neck = lerp(settle, 0.9, look);
            d.fire = k > puff && k < puff + 0.04 ? 1 : 0;
          });
          const d = g.world.need(her, "dragon");
          // Face down over them; as each one opens she lifts her head a little to look, and settles again; then up she rears.
          const looks = Math.max(0, ...eggs.map((_, i) => { const a = 0.12 + i * 0.12; return ramp(k, a, a + 0.025) * (1 - ramp(k, a + 0.07, a + 0.11)); }));
          d.neck = Math.max(looks * 0.22, ramp(k, 0.5, 0.6)) - 0.55 * ramp(k, 0.84, 0.95);
          d.spread = ramp(k, 0.52, 0.6) * (1 - ramp(k, 0.86, 0.96));
          d.fire = ramp(k, 0.6, 0.63) * (1 - ramp(k, 0.75, 0.79));
          if (!roared && k >= 0.58) { roared = true; sound(g, "roar"); g.shake = Math.max(g.shake, 3); }
          if (!sang && k >= 0.84) { sang = true; sound(g, "song"); }
          settle(g, dt);
        },
      };
    },
  },
  // ---------- His own ending ----------
  {
    // The top room of the Fells' house, at night: him asleep in the bed Meg Fell gave him, a lantern of his own lit in
    // the window, the camera coming slowly in.
    id: "fells", area: "fells", load: fellsHouse, hour: 23, had: () => true,
    stage(g) {
      const [bedE, { bed }] = g.world.query("bed", "transform").sort(([, a], [, b]) => a.transform.y - b.transform.y)[0]!;
      const at = g.world.need(bedE, "transform");
      heroAt(g, bed.x + HALF, bed.y + HALF, bed.x + HALF, bed.y + HALF - T);
      // The lantern on the sill by the bed, against the back wall where the window is.
      const lx = at.x + T, ly = Math.max(0.6 * T, at.y - 0.6 * T);
      g.world.create({ transform: { x: lx, y: ly }, renderable: { kind: "lantern" } });
      // And the Ranger home: Wystan and Meg up late by the fire, turned to each other, and no cloak at the window now.
      // (Him at the fire's near side, her a step off toward the beds, so the camera has them both.)
      if (fells) {
        const fire = fells.spots[0]!, by = { x: fire.x - 1.1, y: fire.y + 0.6 }, toHer = Math.atan2(by.y - fire.y, by.x - fire.x);
        if (fells.wystan) standInside(g, fells.wystan, { ...fire, facing: toHer });
        if (fells.meg) standInside(g, fells.meg, { ...by, facing: toHer + Math.PI });
      }
      // Looking between his bed and the middle of the room, so the room's round him, the fire and all.
      const cx = (at.x + HALF + (g.map.width * T) / 2) / 2, cy = (at.y + HALF + (g.map.height * T) / 2) / 2;
      return { from: cam(cx, cy, 1.0, -0.35), to: cam((cx + at.x + HALF) / 2, (cy + at.y + HALF) / 2, 0.6, 0.15), says: SHOT_SAYS.fells, asleep: bed };
    },
  },
];

/** What's said after the chronicle, by how many followed him up the hill: nothing, a few, or a crowd. */
function followedLine(n: number): string {
  const F = SHOT_SAYS_TOO.followed;
  return n <= 0 ? F.none : n < CROWD_OF ? F.few : F.crowd;
}

/** The Fells' house as made for the credits: where people stand in it, and the Ranger and his wife. */
let fells: { spots: Spot[]; wystan?: Resident; meg?: Resident } | null = null;
/**
 * The inside of the Fells' house in Kingsholm (the Ranger's family: src/world/people.ts), made the way any house's is
 * when someone's asked in (src/world/interiors.ts): found from where the census says they live. Null if it can't be.
 */
async function fellsHouse(): Promise<AreaDef | null> {
  const people = await loadCensus(), all = people.filter(r => r.family === "fell"), fellsHome = all.filter(r => !r.prisoner), home = fellsHome[0]?.home;
  if (!home) return null;
  const city = await loadArea(home.area), px = (home.x + 0.5) * T, py = (home.y + 0.5) * T;
  const house = layoutOf(city).props.find((p): p is Extract<Prop, { kind: "house" }> =>
    p.kind === "house" && px >= p.rect.x && py >= p.rect.y && px <= p.rect.x + p.rect.w && py <= p.rect.y + p.rect.h);
  if (!house) return null;
  const { def, spots } = interiorOf(home.area, house, fellsHome, "The Fells' house");
  // Wystan's the one who was in the dungeon; Meg the eldest of those at home.
  fells = { spots, wystan: all.find(r => r.prisoner), meg: [...fellsHome].sort((a, b) => b.age - a.age)[0] };
  registerArea(def);
  return def;
}

/**
 * Under the Greyspines, for the credits: a high meadow of grass and flowers with a few pines down its sides, small
 * enough that the mountains the world always has round it (src/render/terrain.ts) stand up close all round.
 */
function greyspines(): AreaDef {
  const def: AreaDef = {
    id: "greyspines", name: "Under the Greyspines", life: { enemies: false, potions: false, ambient: true },
    build: () => {
      const W = 26, H = 20, town = new Town(W, H, Tile.Grass), rng = new Rng(61);
      town.paint(() => rng.next() < 0.14, Tile.Flower);
      town.paint((x, y) => (x < 3 || x >= W - 3) && y > 3 && rng.next() < 0.35, Tile.Tree);
      return town.layout({ in: { x: (W / 2) * T - HALF, y: (H - 3) * T - HALF } }, []);
    },
  };
  registerArea(def);
  return def;
}
