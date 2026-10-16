// Yssa of the Frost (src/data/ashwild.ts), on the narrow track west out of the Ashwild, down to the Frozen Hollow. Like
// the woodwardens with the King's watchword, she wants something only the player can know: her name. She stands in the
// track until he's written it on her birch bark (the same scrap of paper: src/ui/paper.ts), then steps aside for the
// rest of the run. Nobody makes him fight for it: Cinder says it as he falls, and it's cut into the woodcutters' hut
// door; and a player who knows it already can go straight to her. A new run (the hero waking again) starts her afresh.
import type { Entity } from "../core/ecs.ts";
import { HUT_CARVING, YSSA, YSSA_TALK, YSSA_TRACK } from "../data/ashwild.ts";
import { HALF, T } from "../data/world.ts";
import { FACING_ANGLE } from "../world/area.ts";
import { FEET } from "../world/collision.ts";
import type { TileMap } from "../world/map.ts";
import { combatText } from "./combat.ts";
import { cutscene } from "./cutscene.ts";
import { toast, type Game } from "./game.ts";
import { speak } from "./talk.ts";
import { read } from "./watchword.ts";

interface Track { passed: boolean; carving: { near: boolean } }
const tracks = new WeakMap<Game, Track>();
function track(g: Game): Track {
  let t = tracks.get(g);
  if (!t) {
    const fresh: Track = { passed: false, carving: { near: false } };
    tracks.set(g, t = fresh);
    g.events.on("reset", () => { fresh.passed = false; fresh.carving.near = false; });
  }
  return t;
}

/** Has she read her name off him this run? Then the track west is open to him. */
export const passedYssa = (g: Game): boolean => track(g).passed;

/** Is this her? */
export const isYssa = (g: Game, e: Entity): boolean => g.world.get(e, "renderable")?.kind === "yssa";

/** She's here, if she is. */
const yssaHere = (g: Game): Entity | null => g.world.query("renderable").find(([, c]) => c.renderable.kind === "yssa")?.[0] ?? null;

/** What she says when he talks to her: asking, or (once she knows he knows her) letting him by. */
export const yssaLines = (g: Game): string[] => [...(passedYssa(g) ? YSSA_TALK.through : YSSA_TALK.ask)];

/** He hands the bark back with `written` on it (null: he kept it): she reads it and says so. */
export function readName(g: Game, her: Entity, written: string | null): void {
  const right = written !== null && read(written) === read(YSSA.word);
  if (right) track(g).passed = true;
  const lines = written === null ? YSSA_TALK.kept
    : !written ? YSSA_TALK.blank
    : right ? YSSA_TALK.right
    : YSSA_TALK.wrong.map(l => l.replace("{written}", written));
  speak(g, her, "yssa", lines);
}

/** Where she stands (her centre, game px): in the track, or in the notch north of it once she's let him by. */
const spot = (aside: boolean) => ({ x: (YSSA_TRACK.post + 0.5) * T, y: (YSSA_TRACK.row + (aside ? -0.5 : 0.5)) * T });

/** The map with her in it: in the track, the whole width of it; aside, as solid as anyone standing in a notch. */
const maps = new WeakMap<TileMap, { shut: TileMap; open: TileMap }>();
function herIn(map: TileMap, open: boolean): TileMap {
  let m = maps.get(map);
  if (!m) {
    const aside = spot(true);
    maps.set(map, m = {
      shut: { ...map, solids: [...map.solids, { kind: "box", x: YSSA_TRACK.post * T, y: YSSA_TRACK.row * T, w: T, h: T }] },
      open: { ...map, solids: [...map.solids, { kind: "circle", x: aside.x, y: aside.y, r: 0.3 * T }] },
    });
  }
  return open ? m.open : m.shut;
}

/** How fast she steps aside (px/s): unhurried. */
const STEP_ASIDE = 10;
let stoppedAt = -Infinity;

/**
 * Every frame in the Ashwild: she's in the track (or aside, once he's through); pushing at her before then gets a word;
 * and walking up to the woodcutters' hut door, he reads what's cut in it.
 */
export function yssaSystem(g: Game, dt: number): void {
  if (g.area.def.id !== "ashwild") return;
  const open = passedYssa(g), want = spot(open);
  const her = yssaHere(g) ?? spawnYssa(g, want.x - HALF, want.y - HALF);
  g.map = herIn(g.area.layout.map, open);
  const t = g.world.need(her, "transform"), dx = want.x - HALF - t.x, dy = want.y - HALF - t.y, d = Math.hypot(dx, dy);
  if (d > 0) { const k = Math.min(1, STEP_ASIDE * dt / d); t.x += dx * k; t.y += dy * k; }
  readCarving(g);
  if (open) return;
  // Walking into her: a word from her now and then.
  const p = g.world.need(g.player, "transform"), fx = p.x + FEET.x, fy = p.y + FEET.y + FEET.h / 2;
  const by = fx < (YSSA_TRACK.post + 2) * T && fx + FEET.w > YSSA_TRACK.post * T && Math.floor(fy / T) === YSSA_TRACK.row;
  if (by && g.input.keys.size > 0) yssaStops(g);
}

/** She tells him no (once every couple of seconds at most). */
export function yssaStops(g: Game): void {
  if (g.clock - stoppedAt < 2.5 && g.clock >= stoppedAt) return;
  stoppedAt = g.clock;
  const lines = YSSA_TALK.stop, line = lines[Math.floor(g.rng.next() * lines.length)]!;
  const her = yssaHere(g), t = her && g.world.get(her, "transform");
  if (t) combatText(g, t.x, t.y - 4, line, "#dff4ff", false, 2.4);
  else toast(g, line);
}

/** How close (px) he comes to the hut door to read it, and how far he goes before he'll read it again. */
const READ_AT = 1.2 * T, AWAY = 2.5 * T;

/** The woodcutters' first hut's door (the area's first hall), where the carving is: its foot, game px. */
function hutDoor(g: Game): { x: number; y: number } | null {
  const hut = g.area.layout.props.find(p => p.kind === "hall");
  if (!hut || hut.kind !== "hall") return null;
  return { x: hut.rect.x + hut.rect.w / 2, y: hut.rect.y + hut.rect.h };
}

function readCarving(g: Game): void {
  const door = hutDoor(g), seen = track(g).carving;
  if (!door) return;
  const p = g.world.need(g.player, "transform"), d = Math.hypot(p.x + HALF - door.x, p.y + HALF - door.y);
  if (d > AWAY) { seen.near = false; return; }
  if (seen.near || d > READ_AT || g.state !== "play" || g.world.has(g.player, "conversation") || cutscene(g)) return;
  seen.near = true;
  g.world.add(g.player, "conversation", { with: g.player, name: HUT_CARVING.name, key: "carving", lines: [...HUT_CARVING.lines], line: 0, t: 0 });
}

function spawnYssa(g: Game, x: number, y: number): Entity {
  const post = FACING_ANGLE.east;                          // looking back up the track, at whoever's coming
  return g.world.create({
    transform: { x, y },
    targetable: { hostile: false, name: YSSA.name, radius: 5, height: 1.7 },
    sentry: { post, look: post, want: post, next: 2 },
    renderable: { kind: "yssa" },
  });
}
