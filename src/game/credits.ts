// The credits as this run played them (STORY.md, "0:55"; src/ui/credits.ts draws the caption and The End over them).
// After the King's had his say, the game goes back through the run, a short shot at a time, in the places it happened
// and drawn the way the game draws them: the stone by the Ranger's fire where he woke, the King on his throne, the
// woodwardens stepping aside, Yssa at the foot of the climb, Cinder and Rime falling and their spirits rising, the Grey
// Ringer's churchyard, and Calder at the great crack as it grinds shut (not the walk home or the King's feet: he's just
// played those). Then what it meant: the Greyed losing their grey, the slimes gone still, the King reading the true
// chronicle at the cross, the Vael coming over the bridge for their eggs, Yssa at the fountain; and last his own
// ending, asleep in the Fells' house with a lantern of his own in the window, the Ranger home by the fire with Meg. Only
// what this run got to is shown, and some of what's said changes with what else it did. Each shot loads its area,
// clears off anything that'd wander in, stands the people in it, and moves the camera itself (in, out, round), the
// clock running on so everything breathes and flickers; a shot with a long line under it holds long enough to read. A
// little tune plays under them all, coming round a little different each time. After, he's put back where he was.
import { loadArea } from "../areas/index.ts";
import type { Entity } from "../core/ecs.ts";
import { CREDITS_TIME, CROWD_OF, RUN_SUMS, SHOT_SAYS, SHOT_SAYS_TOO, type ShotId } from "../data/ending.ts";
import { CURIO_IDS } from "../data/items.ts";
import { CREDITS_AIR } from "../data/sfx.ts";
import { MAGE_TARGET, SCHOOLS, SLIME, SLIME_TARGET, type School } from "../data/enemies.ts";
import { SPAWN } from "../areas/witchwood.ts";
import { HALF, T, Tile } from "../data/world.ts";
import type { AreaDef, Prop } from "../world/area.ts";
import { layoutOf } from "../world/layouts.ts";
import { interiorOf, type Spot } from "../world/interiors.ts";
import type { Resident } from "../world/residents.ts";
import { registerArea } from "../areas/index.ts";
import { beaten, standIn, type Who } from "./bosses.ts";
import { calderFightSystem, reopenCrack } from "./calderfight.ts";
import { crowdOf } from "./crowd.ts";
import { curioFound } from "./curios.ts";
import { scenePlayed } from "./cutscene.ts";
import type { Game } from "./game.ts";
import { churchyardOf, hauntingOf } from "./ghost.ts";
import { greatKoiBeaten } from "./greatkoi.ts";
import { tookBow } from "./hunterhut.ts";
import { rimeFightSystem } from "./rimefight.ts";
import type { Bed } from "./components.ts";
import { sound } from "./sfx.ts";
import { spawnKing } from "./spawn.ts";
import { loadCensus } from "./townsfolk.ts";
import { spiritSystem } from "./spirits.ts";
import { standIn as standInside } from "./interiors.ts";
import { endTalk } from "./talk.ts";
import { enterArea } from "./travel.ts";
import { passedBarricade } from "./watchword.ts";
import { passedClimb, passedYssa, yssaSystem } from "./yssa.ts";

/** Where the camera looks (px, centres), how far out (1 the usual), and how far round (radians, from the usual). */
export interface Cam { x: number; y: number; zoom: number; yaw: number }

/** How the run went, read at the start of the credits. */
interface Run {
  audience: boolean; barricade: boolean; yssa: boolean; climb: boolean; ringer: boolean; koi: boolean; bow: boolean;
  level: number; kills: number; curios: number; beat: Set<Who>;
  /** How many followed him up the hill with the head. */
  followed: number;
}

/**
 * A shot, staged: where the camera starts and ends (or follows the hero), what's said, what moves as it plays (k: 0 to
 * 1), and, if he's asleep in it, the bed he's lying in.
 */
interface Staged { from: Cam; to: Cam; follow?: boolean; says: string; play?(k: number, dt: number): void; asleep?: Bed }

/**
 * Each shot: whether this run had it, where it's set (or how to make the place, if it isn't one of the areas: null if
 * it can't be), the hour there, and how to stage it once there.
 */
interface Shot { id: ShotId; area: string; load?(): Promise<AreaDef | null>; hour: number; had(run: Run): boolean; stage(g: Game, run: Run): Staged }

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
    audience: scenePlayed(g, "audience"), barricade: passedBarricade(g), yssa: passedYssa(g), climb: passedClimb(g), ringer: hauntingOf(g).night === "laid",
    koi: greatKoiBeaten(g), bow: tookBow(g), level: g.world.need(g.player, "hero").level, kills: g.kills,
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
  enterArea(g, def, firstEntry(def));
  // Nothing wanders in, nobody's talking, and he's whole and standing.
  for (const [e] of g.world.query("enemy")) if (!g.world.has(e, "dummy")) g.world.destroy(e);
  for (const [e] of g.world.query("pickup")) g.world.destroy(e);
  if (g.world.has(g.player, "cutscene")) g.world.remove(g.player, "cutscene");
  endTalk(g);
  g.target = null;
  Object.assign(g.world.need(g.player, "status"), { hurt: 0, sheep: 0, frozen: 0, chill: 0 });
  r.staged = shot.stage(g, r.run);
  r.length = shotLength(r.staged.says);
  r.staged.play?.(0, 0);
  aim(g, r, 0);
  return false;
}

/** Any way into an area: each shot puts him where it wants him after. */
const firstEntry = (def: AreaDef) => Object.keys(layoutOf(def).entries)[0]!;

// ---------- Staging ----------
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const ease = (k: number) => k * k * (3 - 2 * k);
const cam = (x: number, y: number, zoom: number, yaw = 0): Cam => ({ x, y, zoom, yaw });
const propOf = <K extends Prop["kind"]>(g: Game, kind: K) => g.area.layout.props.find((p): p is Extract<Prop, { kind: K }> => p.kind === kind);

/** Stand him at (x, y) (px, his centre), looking toward (tx, ty); walking, if he's moving. */
function heroAt(g: Game, x: number, y: number, tx: number, ty: number, walking = false): void {
  Object.assign(g.world.need(g.player, "transform"), { x: x - HALF, y: y - HALF });
  const m = g.world.need(g.player, "motion");
  m.moving = walking;
  m.aim = Math.atan2(ty - y, tx - x);
}
/** Walking him from a to b (px, centres) over the part of the shot from k0 to k1. */
function walkAlong(g: Game, a: { x: number; y: number }, b: { x: number; y: number }, k: number, k0 = 0, k1 = 1): void {
  const u = Math.max(0, Math.min(1, (k - k0) / (k1 - k0)));
  heroAt(g, lerp(a.x, b.x, u), lerp(a.y, b.y, u), b.x, b.y, u > 0 && u < 1);
}
/** A boss falls: a burst where they stood, and they're gone. */
function crumble(g: Game, e: Entity, palette: "fire" | "frost" | "spark"): void {
  const t = g.world.get(e, "transform");
  if (!t) return;
  for (let i = 0; i < 3; i++) g.fx.push({ type: "burst", x: t.x + (i - 1) * 3, y: t.y - i * 2, palette });
  g.fx.push({ type: "burst", x: t.x, y: t.y, palette: "arcane" });
  g.world.destroy(e);
}
/** A beaten lieutenant, back in their arena for the camera: standing facing him, falling at `at`, their spirit rising after. */
function lieutenant(g: Game, who: Who, palette: "fire" | "frost" | "spark", at: number, after?: (dt: number) => void): NonNullable<Staged["play"]> {
  const lair = propOf(g, "boss")!, x = lair.x, y = lair.y, me = standIn(g, who, x - HALF, y - HALF);
  heroAt(g, x, y + 3 * T, x, y);
  let fallen = false;
  return (k, dt) => {
    if (!fallen && k >= at) { fallen = true; crumble(g, me, palette); }
    if (fallen) { after?.(dt); spiritSystem(g); }
  };
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

/** The townsfolk out in the street, gathered round (x, y) (px) in a crescent on the near side, facing it and staying put. */
function gatherRound(g: Game, x: number, y: number, r: number): void {
  g.world.query("walker", "transform").forEach(([, c], i, all) => {
    const a = Math.PI * (0.15 + 0.7 * (i / Math.max(1, all.length - 1))), d = r + (i % 3) * 6;
    Object.assign(c.transform, { x: x + Math.cos(a) * d - HALF, y: y + Math.sin(a) * d * 0.8 - HALF });
    Object.assign(c.walker, { path: [], moving: false, wait: 999, follow: null, goIn: false, task: null, facing: Math.atan2(-Math.sin(a), -Math.cos(a)) });
  });
}

const SHOTS: readonly Shot[] = [
  {
    // Where he woke: the stone by the Ranger's fire, early, the camera coming down out of the trees to him.
    id: "woke", area: "witchwood", hour: 7.5, had: () => true,
    stage(g) {
      const stone = propOf(g, "oldStone")!, fire = propOf(g, "camp")!.fire;
      heroAt(g, stone.x, stone.y, fire.x + HALF, fire.y + HALF);
      return { from: cam(stone.x, stone.y, 1.9, 0.7), to: cam(stone.x, stone.y, 0.7, -0.15), says: SHOT_SAYS.woke };
    },
  },
  {
    // The King's audience: up the carpet to the foot of the dais, the camera closing in on the two of them.
    id: "king", area: "throneroom", hour: 10, had: run => run.audience,
    stage(g) {
      const k = g.world.query("renderable", "transform").find(([, c]) => c.renderable.kind === "king")![1].transform;
      const kx = k.x + HALF, ky = k.y + HALF, from = { x: kx, y: ky + 72 }, to = { x: kx, y: ky + 24 };
      return {
        from: cam(kx, ky + 40, 1.4), to: cam(kx, ky + 12, 0.6, 0.25), says: SHOT_SAYS.king,
        play: k => walkAlong(g, from, to, k, 0, 0.6),
      };
    },
  },
  {
    // The barricade: the wardens aside at their posts, and him through the gate and on down the trail.
    id: "barricade", area: "witchwood", hour: 16, had: run => run.barricade,
    stage(g) {
      const b = propOf(g, "barricade")!, gx = b.rect.x + (b.gate + b.gateW / 2) * T, from = { x: gx, y: b.rect.y - 4 * T }, to = { x: gx, y: b.rect.y + 4 * T };
      return {
        from: cam(gx, b.rect.y, 0.85, 0.4), to: cam(gx, b.rect.y, 0.85, -0.4), follow: true, says: SHOT_SAYS.barricade,
        play: k => walkAlong(g, from, to, k, 0.1, 0.9),
      };
    },
  },
  {
    // Yssa at the foot of the climb, aside now, and him past her on up the frozen river.
    id: "yssa", area: "hollow", hour: 12, had: run => run.climb,
    stage(g) {
      yssaSystem(g, 0);
      const her = g.world.query("renderable", "transform").find(([, c]) => c.renderable.kind === "yssa")?.[1].transform;
      const hx = (her?.x ?? 0) + HALF, hy = (her?.y ?? 0) + HALF, x = hx + T, from = { x, y: hy + 3 * T }, to = { x, y: hy - 2 * T };
      return {
        from: cam(hx + HALF, hy, 0.75, -0.35), to: cam(hx + HALF, hy - HALF, 0.6, 0.3), says: SHOT_SAYS.yssa,
        play: k => walkAlong(g, from, to, k, 0.15, 0.95),
      };
    },
  },
  {
    // Cinder in the ashes: he falls, and his spirit rises where he stood. The camera goes round them.
    id: "cinder", area: "ashwild", hour: 15, had: run => run.beat.has("cinder"),
    stage(g) {
      const lair = propOf(g, "boss")!;
      return { from: cam(lair.x, lair.y + T, 0.75, -0.6), to: cam(lair.x, lair.y + T, 0.6, 0.6), says: SHOT_SAYS.cinder, play: lieutenant(g, "cinder", "fire", 0.35) };
    },
  },
  {
    // Rime out on the frozen lake: she falls, the lake thaws round where she stood, and her spirit rises.
    id: "rime", area: "hollow", hour: 10, had: run => run.beat.has("rime"),
    stage(g, run) {
      const lair = propOf(g, "boss")!;
      return {
        from: cam(lair.x, lair.y + T, 1.25, 0.5), to: cam(lair.x, lair.y + T, 0.9, -0.5),
        says: `${run.bow ? SHOT_SAYS_TOO.bow : SHOT_SAYS.rime}${run.koi ? ` ${SHOT_SAYS_TOO.koi}` : ""}`,
        play: lieutenant(g, "rime", "frost", 0.3, dt => rimeFightSystem(g, dt)),
      };
    },
  },
  {
    // The churchyard of St Mary's at night, quiet now: him among the graves.
    id: "ringer", area: "capital", hour: 23, had: run => run.ringer,
    stage(g) {
      const yard = churchyardOf(g)!, x = yard.x + yard.w / 2, y = yard.y + yard.h / 2;
      heroAt(g, x, y + T, x, y - T);
      return { from: cam(x, y, 1.3, -0.3), to: cam(x, y, 0.7, 0.2), says: SHOT_SAYS.ringer };
    },
  },
  {
    // Calder at the edge of the great crack: he falls, his spark goes home, and the crack grinds shut. Round and out.
    id: "calder", area: "rift", hour: 19, had: run => run.beat.has("calder"),
    stage(g) {
      calderFightSystem(g, 0);                               // the crack as he left it, to open again for the camera
      const lair = propOf(g, "boss")!;
      let opened = false;
      const fall = lieutenant(g, "calder", "spark", 0.3, dt => calderFightSystem(g, dt));
      return {
        from: cam(lair.x, lair.y, 1.05, -0.45), to: cam(lair.x, lair.y - T, 1.35, 0.45), says: SHOT_SAYS.calder,
        play: (k, dt) => {
          if (!opened) { opened = true; reopenCrack(g); }
          if (k < 0.3) calderFightSystem(g, 0);              // held open till he falls
          fall(k, dt);
        },
      };
    },
  },
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
    id: "chronicle", area: "capital", hour: 9.5, had: () => true,
    stage(g, run) {
      const cross = propOf(g, "cross")!, x = cross.x, y = cross.y;
      const ky = y + 2.2 * T;                                // on the cross's steps, in front of it
      spawnKing(g, x - HALF, ky - HALF, Math.PI / 2);
      gatherRound(g, x, ky, 3.2 * T);
      heroAt(g, x + 4 * T, ky + 3 * T, x, ky);
      return {
        from: cam(x, ky, 0.55, 0.3), to: cam(x, ky + T, 1.15, -0.3), says: [SHOT_SAYS.chronicle, followedLine(run.followed)].filter(Boolean).join(" "),
        play: () => gatherRound(g, x, ky, 3.2 * T),
      };
    },
  },
  {
    // The Vael on the King's Bridge, coming north for their eggs: one of each order in each row, walking up the deck
    // in their own colours, the grey nowhere in them, to the King waiting under Southgate with him at his side.
    id: "eggs", area: "kingsroad", hour: 8, had: () => true,
    stage(g) {
      const deck = propOf(g, "stoneBridge")!.rect, x = deck.x + deck.w / 2, top = deck.y + 2 * T, foot = deck.y + deck.h - 4 * T;
      spawnKing(g, x - HALF, top - HALF, Math.PI / 2);
      heroAt(g, x + 1.5 * T, top + HALF, x, foot);
      const schools: School[] = ["ember", "frost", "storm"];
      const them = Array.from({ length: 6 }, (_, i) => ({
        e: greyed(g, schools[i % 3]!, 0, 0), dx: ((i % 3) - 1) * 1.4 * T, back: Math.floor(i / 3) * 2 * T,
      }));
      const near = top + 3 * T;
      return {
        from: cam(x, foot, 0.8, 0.4), to: cam(x, top + 2.5 * T, 1.05, -0.2), says: SHOT_SAYS.eggs,
        play: k => {
          const u = Math.min(1, k / 0.8);
          for (const m of them) {
            Object.assign(g.world.need(m.e, "transform"), { x: x + m.dx - HALF, y: lerp(foot, near, u) + m.back - HALF });
            g.world.need(m.e, "mage").moving = u < 1;
          }
        },
      };
    },
  },
  {
    // Yssa, the frost gone out of her, at the foot of the fountain in the square.
    id: "milk", area: "capital", hour: 7, had: run => run.yssa,
    stage(g) {
      const f = propOf(g, "fountain")!, x = f.x, y = f.y + (f.radius + 1) * T;
      g.world.create({
        transform: { x: x - HALF, y: y - HALF },
        targetable: { hostile: false, name: "Yssa", radius: 5, height: 1.7 },
        sentry: { post: -Math.PI / 2, look: -Math.PI / 2, want: -Math.PI / 2, next: 2 },
        renderable: { kind: "yssa" },
      });
      heroAt(g, x + 2 * T, y + 2 * T, x, y);
      return { from: cam(x, y, 0.6, -0.3), to: cam(x, y - HALF, 1.2, 0.35), says: SHOT_SAYS.milk };
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
