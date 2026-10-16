// The credits as this run played them (STORY.md, "0:55"; src/ui/credits.ts draws the caption and The End over them).
// After the King's had his say, the game goes back through the run, a short shot at a time, in the places it happened
// and drawn the way the game draws them: the stone by the Ranger's fire where he woke, the King on his throne, the
// woodwardens stepping aside, Yssa at the foot of the climb, Cinder and Rime falling and their spirits rising, the Grey
// Ringer's churchyard, Calder at the great crack as it grinds shut, the walk home through the castle gate with the city
// behind him, and the head at the King's feet. Only what this run got to is shown, and some of what's said changes
// with what else it did. Each shot loads its area, clears off anything that'd wander in, stands the people in it, and
// moves the camera itself (in, out, round), the clock running on so everything breathes and flickers. After, he's put
// back in the castle ward as he was.
import { loadArea } from "../areas/index.ts";
import type { Entity } from "../core/ecs.ts";
import { CREDITS_TIME, RUN_SUMS, SHOT_SAYS, SHOT_SAYS_TOO, type ShotId } from "../data/ending.ts";
import { CURIO_IDS } from "../data/items.ts";
import { CALDERS_HEAD } from "../data/rift.ts";
import { HALF, T } from "../data/world.ts";
import type { AreaDef, Prop } from "../world/area.ts";
import { makeItem } from "../items/items.ts";
import { layoutOf } from "../world/layouts.ts";
import { beaten, standIn, type Who } from "./bosses.ts";
import { calderFightSystem, reopenCrack } from "./calderfight.ts";
import { crowdOf, gatherCrowd } from "./crowd.ts";
import { curioFound } from "./curios.ts";
import { scenePlayed } from "./cutscene.ts";
import type { Game } from "./game.ts";
import { churchyardOf, hauntingOf } from "./ghost.ts";
import { greatKoiBeaten } from "./greatkoi.ts";
import { giveUpHead } from "./head.ts";
import { tookBow } from "./hunterhut.ts";
import { rimeFightSystem } from "./rimefight.ts";
import { spawnKing } from "./spawn.ts";
import { spiritSystem } from "./spirits.ts";
import { endTalk } from "./talk.ts";
import { enterArea } from "./travel.ts";
import { passedBarricade } from "./watchword.ts";
import { passedClimb, yssaSystem } from "./yssa.ts";

/** Where the camera looks (px, centres), how far out (1 the usual), and how far round (radians, from the usual). */
export interface Cam { x: number; y: number; zoom: number; yaw: number }

/** How the run went, read at the start of the credits. */
interface Run { audience: boolean; barricade: boolean; climb: boolean; ringer: boolean; koi: boolean; bow: boolean; level: number; kills: number; curios: number; beat: Set<Who> }

/** A shot, staged: where the camera starts and ends (or follows the hero), what's said, and what moves as it plays (k: 0 to 1). */
interface Staged { from: Cam; to: Cam; follow?: boolean; says: string; play?(k: number, dt: number): void }

/** Each shot: whether this run had it, where it's set, the hour there, and how to stage it once there. */
interface Shot { id: ShotId; area: string; hour: number; had(run: Run): boolean; stage(g: Game, run: Run): Staged }

interface Reel {
  shots: Shot[];
  run: Run;
  defs: Map<string, AreaDef>;
  /** The shot playing (-1 while the areas load), how far into it (s), and it staged. */
  at: number;
  t: number;
  staged: Staged | null;
  cam: Cam | null;
  /** Where he was before, to be put back after. */
  back: { area: AreaDef; x: number; y: number; hour: number };
  /** Who followed him up, to follow him again on screen. */
  crowd: number[];
}
const reels = new WeakMap<Game, Reel>();

/** The camera, while the credits are rolling a shot (the renderer looks here first). */
export const creditsCamera = (g: Game): Cam | null => reels.get(g)?.cam ?? null;

/** What's said under the shot on screen now, and how faded in it is (0 to 1); null between shots or before they start. */
export function creditsShot(g: Game): { says: string; shown: number } | null {
  const r = reels.get(g);
  if (!r?.staged) return null;
  const F = CREDITS_TIME;
  return { says: r.staged.says, shown: Math.max(0, Math.min(1, r.t / F.fade, (F.shot - r.t) / F.fade)) };
}

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
    audience: scenePlayed(g, "audience"), barricade: passedBarricade(g), climb: passedClimb(g), ringer: hauntingOf(g).night === "laid",
    koi: greatKoiBeaten(g), bow: tookBow(g), level: g.world.need(g.player, "hero").level, kills: g.kills,
    curios: CURIO_IDS.filter(id => curioFound(g, id)).length, beat,
  };
}

/** Where the next credits start (getting about quickly in development: src/debug.ts), if not at the beginning. */
const startAt = new WeakMap<Game, ShotId>();
export function creditsFrom(g: Game, id: ShotId): void { startAt.set(g, id); }

/** Start the reel: read the run, choose its shots, and load their areas (dark till then). */
export async function rollCredits(g: Game): Promise<void> {
  const run = readRun(g), had = SHOTS.filter(s => s.had(run)), p = g.world.need(g.player, "transform");
  const from = had.findIndex(s => s.id === startAt.get(g)), shots = from > 0 ? had.slice(from) : had;
  startAt.delete(g);
  const reel: Reel = {
    shots, run, defs: new Map(), at: -1, t: 0, staged: null, cam: null,
    back: { area: g.area.def, x: p.x, y: p.y, hour: g.hour }, crowd: [...crowdOf(g).following],
  };
  reels.set(g, reel);
  const defs = await Promise.all([...new Set(shots.map(s => s.area))].map(id => loadArea(id)));
  for (const def of defs) reel.defs.set(def.id, def);
}

/** Every frame of the credits: the clock runs on, the shot plays, and on to the next. True once the last shot's done. */
export function updateCredits(g: Game, dt: number): boolean {
  const r = reels.get(g);
  if (!r) return true;
  g.clock += dt;                                             // the world breathes and flickers, though nobody's playing
  if (r.at < 0) {
    if (r.defs.size < new Set(r.shots.map(s => s.area)).size || (r.t += dt) < CREDITS_TIME.dark) return false;
    return nextShot(g, r);
  }
  r.t += dt;
  const s = r.staged!, k = Math.min(1, r.t / CREDITS_TIME.shot);
  s.play?.(k, dt);
  aim(g, r, k);
  return r.t >= CREDITS_TIME.shot ? nextShot(g, r) : false;
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
  giveUpHead(g);                                             // the head on screen was only ever for the pictures
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
  giveUpHead(g);
  crowdOf(g).following = shot.id === "home" || shot.id === "steps" ? [...r.crowd] : [];
  crowdOf(g).gathered = null;
  g.hour = shot.hour;
  const def = r.defs.get(shot.area)!;
  enterArea(g, def, firstEntry(def));
  // Nothing wanders in, nobody's talking, and he's whole and standing.
  for (const [e] of g.world.query("enemy")) if (!g.world.has(e, "dummy")) g.world.destroy(e);
  for (const [e] of g.world.query("pickup")) g.world.destroy(e);
  if (g.world.has(g.player, "cutscene")) g.world.remove(g.player, "cutscene");
  endTalk(g);
  g.target = null;
  Object.assign(g.world.need(g.player, "status"), { hurt: 0, sheep: 0, frozen: 0, chill: 0 });
  r.staged = shot.stage(g, r.run);
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
  {
    // Home at dawn: up Castle Street with the head held out, over the drawbridge, the city falling in behind him.
    id: "home", area: "castle", hour: 6.2, had: () => true,
    stage(g) {
      g.inventory.add(makeItem(...CALDERS_HEAD));            // for the pictures (taken away again after)
      const p = g.world.need(g.player, "transform"), x = p.x + HALF, y = p.y + HALF, from = { x, y }, to = { x, y: y - 11 * T };
      return {
        from: cam(x, y, 1, 0.3), to: cam(x, y, 1.1, -0.2), follow: true, says: SHOT_SAYS.home,
        play: k => walkAlong(g, from, to, k, 0, 1),
      };
    },
  },
  {
    // On the keep steps: the King, the head set down at his feet, the crowd round, and the camera drawing back.
    id: "steps", area: "castle", hour: 6.8, had: () => true,
    stage(g) {
      const at = g.area.layout.entries.keep!, kx = at.x + HALF, ky = at.y + HALF;
      spawnKing(g, at.x, at.y, Math.PI / 2);
      g.inventory.add(makeItem(...CALDERS_HEAD));
      const from = { x: kx, y: ky + 7 * T }, to = { x: kx, y: ky + 20 };
      heroAt(g, from.x, from.y, kx, ky);
      // The crowd that came up with him, in rows at his back (they're let in at the gate, a long way down).
      g.world.query("walker", "transform").filter(([, c]) => c.walker.crowd?.mode === "follow").forEach(([, c], i) => {
        const row = Math.floor(i / 4), col = (i % 4) - 1.5;
        Object.assign(c.transform, { x: from.x - HALF + col * 8 + (row % 2) * 4, y: from.y - HALF + 14 + row * 8 });
        c.walker.path = [];
        c.walker.catchingUp = false;
      });
      let laid = false;
      return {
        from: cam(kx, ky + 3 * T, 0.6, 0), to: cam(kx, ky + 2 * T, 1.3, 0.55), says: SHOT_SAYS.steps,
        play: k => {
          walkAlong(g, from, to, k, 0, 0.35);
          if (laid || k < 0.42) return;
          laid = true;
          giveUpHead(g);
          g.world.create({ transform: { x: kx - HALF, y: ky - HALF + 7 }, renderable: { kind: "head" } });
          gatherCrowd(g, { x: kx, y: ky });
        },
      };
    },
  },
];
