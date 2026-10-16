// Yssa of the Frost (src/data/ashwild.ts). Like the woodwardens with the King's watchword, she wants something only the
// player can know, written on her birch bark (the same scrap of paper: src/ui/paper.ts), and keeps two posts. First the
// narrow track west out of the Ashwild, down to the Frozen Hollow, where she wants her name: Cinder says it as he falls,
// and it's cut into the woodcutters' hut door. Then the foot of the climb north out of the Hollow, up to the Thunder
// Rift (src/data/hollow.ts, CLIMB), where she wants the name of the river frozen in it: Rime sings it as she falls, and
// the hunter scratched it on his hut door. At each she stands in the way until it's written, then steps aside for the
// rest of the run; once he's been down to the Hollow, she's gone on ahead of him and the Ashwild's track is empty.
// Nobody makes him fight for either word, and a player who knows one already can go straight to her. A new run (the
// hero waking again) starts her afresh.
import type { Entity } from "../core/ecs.ts";
import { HUT_CARVING, YSSA, YSSA_TALK, YSSA_TRACK } from "../data/ashwild.ts";
import { CLIMB, CLIMB_TALK, HUNTER_NOTE } from "../data/hollow.ts";
import { HALF, T } from "../data/world.ts";
import { FACING_ANGLE } from "../world/area.ts";
import { FEET } from "../world/collision.ts";
import type { TileMap } from "../world/map.ts";
import { combatText } from "./combat.ts";
import { cutscene } from "./cutscene.ts";
import { toast, type Game } from "./game.ts";
import { speak } from "./talk.ts";
import { read } from "./watchword.ts";

/** What she asks for: her name (on the Ashwild's track west), or the river's (at the foot of the Hollow's climb). */
export type YssaAsks = "name" | "river";

/** One of her posts: where she stands in the way, where she steps aside to, what she wants written, and what's cut in the hut door nearby. */
interface Post {
  asks: YssaAsks;
  word: string;
  talk: { ask: readonly string[]; right: readonly string[]; wrong: readonly string[]; blank: readonly string[]; kept: readonly string[]; through: readonly string[]; stop: readonly string[] };
  /** The tile she fills while she's in the way (top-left), and the tiles walking into her from (x, y, w, h). */
  tile: { x: number; y: number };
  stops: { x: number; y: number; w: number; h: number };
  /** Her centre once she's stepped aside (game px). */
  aside: { x: number; y: number };
  /** Which way she looks: back down the way he comes. */
  facing: keyof typeof FACING_ANGLE;
  carving: { name: string; lines: readonly string[] };
}

const POSTS: Record<string, Post> = {
  ashwild: {
    asks: "name", word: YSSA.word, talk: YSSA_TALK,
    tile: { x: YSSA_TRACK.post, y: YSSA_TRACK.row },
    stops: { x: YSSA_TRACK.post, y: YSSA_TRACK.row, w: 2, h: 1 },
    aside: { x: (YSSA_TRACK.post + 0.5) * T, y: (YSSA_TRACK.row - 0.5) * T },   // into the notch north of the track
    facing: "east", carving: HUT_CARVING,
  },
  hollow: {
    asks: "river", word: CLIMB.word, talk: CLIMB_TALK,
    tile: { x: CLIMB.x, y: CLIMB.post },
    stops: { x: CLIMB.x, y: CLIMB.post, w: 1, h: 2 },
    aside: { x: (CLIMB.x - 0.5) * T, y: (CLIMB.post + 0.5) * T },             // into the notch west of the climb
    facing: "south", carving: HUNTER_NOTE,
  },
};

interface Track { passed: Set<YssaAsks>; down: boolean; carving: { near: boolean }; topped: boolean }
const tracks = new WeakMap<Game, Track>();
function track(g: Game): Track {
  let t = tracks.get(g);
  if (!t) {
    const fresh: Track = { passed: new Set(), down: false, carving: { near: false }, topped: false };
    tracks.set(g, t = fresh);
    g.events.on("reset", () => { fresh.passed.clear(); fresh.down = false; fresh.carving.near = false; fresh.topped = false; });
  }
  return t;
}

/** Her post in this area, if she keeps one here. */
const postHere = (g: Game): Post | null => POSTS[g.area.def.id] ?? null;

/** Has she read her name off him this run? Then the track west is open to him. */
export const passedYssa = (g: Game): boolean => track(g).passed.has("name");

/** Has she read the river's name off him this run? Then the climb up out of the Hollow is open to him. */
export const passedClimb = (g: Game): boolean => track(g).passed.has("river");

/** Is this her? */
export const isYssa = (g: Game, e: Entity): boolean => g.world.get(e, "renderable")?.kind === "yssa";

/** What she asks for here. */
export const yssaAsks = (g: Game): YssaAsks => postHere(g)?.asks ?? "name";

/** Is she still waiting for a word from him here? */
export const yssaAsking = (g: Game): boolean => !track(g).passed.has(yssaAsks(g));

/** She's here, if she is. */
const yssaHere = (g: Game): Entity | null => g.world.query("renderable").find(([, c]) => c.renderable.kind === "yssa")?.[0] ?? null;

/** What she says when he talks to her: asking, or (once she's read the word here) letting him by. */
export function yssaLines(g: Game): string[] {
  const talk = (postHere(g) ?? POSTS.ashwild!).talk;
  return [...(yssaAsking(g) ? talk.ask : talk.through)];
}

/** He hands the bark back with `written` on it (null: he kept it): she reads it and says so. */
export function readWord(g: Game, her: Entity, written: string | null): void {
  const post = postHere(g) ?? POSTS.ashwild!, right = written !== null && read(written) === read(post.word);
  if (right) track(g).passed.add(post.asks);
  const lines = written === null ? post.talk.kept
    : !written ? post.talk.blank
    : right ? post.talk.right
    : post.talk.wrong.map(l => l.replace("{written}", written));
  speak(g, her, "yssa", lines);
}

/** Where she stands (her centre, game px): in the way, or aside once she's let him by. */
const spot = (post: Post, aside: boolean) => aside ? post.aside : { x: (post.tile.x + 0.5) * T, y: (post.tile.y + 0.5) * T };

/** The map with her in it: in the way, the whole tile of it; aside, as solid as anyone standing in a notch. */
const maps = new WeakMap<TileMap, { shut: TileMap; open: TileMap }>();
function herIn(map: TileMap, post: Post, open: boolean): TileMap {
  let m = maps.get(map);
  if (!m) {
    const aside = spot(post, true);
    maps.set(map, m = {
      shut: { ...map, solids: [...map.solids, { kind: "box", x: post.tile.x * T, y: post.tile.y * T, w: T, h: T }] },
      open: { ...map, solids: [...map.solids, { kind: "circle", x: aside.x, y: aside.y, r: 0.3 * T }] },
    });
  }
  return open ? m.open : m.shut;
}

/** How fast she steps aside (px/s): unhurried. */
const STEP_ASIDE = 10;
let stoppedAt = -Infinity;

/**
 * Every frame in the Ashwild or the Hollow: she's in the way (or aside, once he's through; or, in the Ashwild, gone on
 * ahead once he's been down to the Hollow); pushing at her before then gets a word; and walking up to the hut door
 * there, he reads what's cut in it.
 */
export function yssaSystem(g: Game, dt: number): void {
  const post = postHere(g);
  if (!post) return;
  const s = track(g);
  readCarving(g, post);
  if (post.asks === "river") { s.down = true; climbTop(g); }
  if (post.asks === "name" && s.down && s.passed.has("name")) { g.map = g.area.layout.map; return; }   // she's gone on down to the Hollow
  const open = s.passed.has(post.asks), want = spot(post, open);
  const her = yssaHere(g) ?? spawnYssa(g, want.x - HALF, want.y - HALF, post.facing);
  g.map = herIn(g.area.layout.map, post, open);
  const t = g.world.need(her, "transform"), dx = want.x - HALF - t.x, dy = want.y - HALF - t.y, d = Math.hypot(dx, dy);
  if (d > 0) { const k = Math.min(1, STEP_ASIDE * dt / d); t.x += dx * k; t.y += dy * k; }
  if (open) return;
  // Walking into her: a word from her now and then.
  const p = g.world.need(g.player, "transform"), fx = p.x + FEET.x, fy = p.y + FEET.y + FEET.h / 2, z = post.stops;
  const by = fx < (z.x + z.w) * T && fx + FEET.w > z.x * T && fy >= z.y * T && fy < (z.y + z.h) * T;
  if (by && g.input.keys.size > 0) yssaStops(g);
}

/** She tells him no (once every couple of seconds at most). */
export function yssaStops(g: Game): void {
  if (g.clock - stoppedAt < 2.5 && g.clock >= stoppedAt) return;
  stoppedAt = g.clock;
  const lines = (postHere(g) ?? POSTS.ashwild!).talk.stop, line = lines[Math.floor(g.rng.next() * lines.length)]!;
  const her = yssaHere(g), t = her && g.world.get(her, "transform");
  if (t) combatText(g, t.x, t.y - 4, line, "#dff4ff", false, 2.4);
  else toast(g, line);
}

/** At the top of the climb, while there's no Thunder Rift to go on up to (no exit there yet): a word, once a run. */
function climbTop(g: Game): void {
  const s = track(g), p = g.world.need(g.player, "transform");
  if (s.topped || p.y + FEET.y > 1.5 * T || g.area.layout.exits.some(x => x.to.area === "rift")) return;
  s.topped = true;
  toast(g, "Thunder rolls somewhere above, out of a clear sky. The way on up isn't open yet.", true);
}

/** How close (px) he comes to the hut door to read it, and how far he goes before he'll read it again. */
const READ_AT = 1.2 * T, AWAY = 2.5 * T;

/** The hut's door (the area's first hall: the woodcutters' first hut, or the hunter's), where the carving is: its foot, game px. */
function hutDoor(g: Game): { x: number; y: number } | null {
  const hut = g.area.layout.props.find(p => p.kind === "hall");
  if (!hut || hut.kind !== "hall") return null;
  return { x: hut.rect.x + hut.rect.w / 2, y: hut.rect.y + hut.rect.h };
}

function readCarving(g: Game, post: Post): void {
  const door = hutDoor(g), seen = track(g).carving;
  if (!door) return;
  const p = g.world.need(g.player, "transform"), d = Math.hypot(p.x + HALF - door.x, p.y + HALF - door.y);
  if (d > AWAY) { seen.near = false; return; }
  if (seen.near || d > READ_AT || g.state !== "play" || g.world.has(g.player, "conversation") || cutscene(g)) return;
  seen.near = true;
  g.world.add(g.player, "conversation", { with: g.player, name: post.carving.name, key: "carving", lines: [...post.carving.lines], line: 0, t: 0 });
}

function spawnYssa(g: Game, x: number, y: number, facing: keyof typeof FACING_ANGLE): Entity {
  const post = FACING_ANGLE[facing];                       // looking back down the way, at whoever's coming
  return g.world.create({
    transform: { x, y },
    targetable: { hostile: false, name: YSSA.name, radius: 5, height: 1.7 },
    sentry: { post, look: post, want: post, next: 2 },
    renderable: { kind: "yssa" },
  });
}
