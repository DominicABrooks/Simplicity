// The watchword the King's woodwardens ask for at the barricade (src/data/king.ts): always the same, and only the
// player can know it. The hero can't talk, so a warden hands him a scrap of paper and a stub of crayon; the player
// writes it (src/ui/paper.ts) and hands it back. Right, and the wardens let him through for the rest of the run;
// wrong, and they don't. Until then they stand in the barricade's gate (wardenSystem). A new run (the hero waking again) starts at the barricade afresh.
import type { Entity } from "../core/ecs.ts";
import { WARDEN_TALK, WOODWARDEN } from "../data/ashwild.ts";
import { WATCHWORD } from "../data/king.ts";
import { TALK } from "../data/dialogue.ts";
import { HALF, T } from "../data/world.ts";
import { FEET } from "../world/collision.ts";
import type { TileMap } from "../world/map.ts";
import type { Shape } from "../world/shapes.ts";
import { combatText } from "./combat.ts";
import { toast, type Game } from "./game.ts";
import { speak } from "./talk.ts";
import { readWord, type YssaAsks } from "./yssa.ts";

/** At most this many letters fit on the scrap. */
export const PAPER_LENGTH = 24;

/** What the paper's for: the King's watchword for a warden, or for Yssa her name or the river's (src/game/yssa.ts). */
export type Asks = "watchword" | YssaAsks;

interface Barricade { passed: boolean; writing: Entity | null; asks: Asks }
const barricades = new WeakMap<Game, Barricade>();
function barricade(g: Game): Barricade {
  let b = barricades.get(g);
  if (!b) {
    const fresh: Barricade = { passed: false, writing: null, asks: "watchword" };
    barricades.set(g, b = fresh);
    g.events.on("reset", () => { fresh.passed = false; fresh.writing = null; });
  }
  return b;
}

/** Have the wardens read the right watchword from him this run? Then the gate's open to him. */
export const passedBarricade = (g: Game): boolean => barricade(g).passed;

/** The wardens have read it off him already (getting about quickly in development: src/game/zones.ts). */
export function passBarricade(g: Game): void { barricade(g).passed = true; }

/** The warden waiting for the paper back, while he writes; null otherwise (or once they're gone, or he's walked off). */
export function writingFor(g: Game): Entity | null {
  const b = barricade(g), w = b.writing;
  if (w === null) return null;
  const them = g.world.get(w, "transform"), hero = g.world.need(g.player, "transform");
  if (g.state !== "play" || !them || Math.hypot(hero.x - them.x, hero.y - them.y) > TALK.leave) b.writing = null;
  return b.writing;
}

/** What the paper he's writing on is for (whatever it was last, if he isn't). */
export const paperAsks = (g: Game): Asks => barricade(g).asks;

/** A warden (or Yssa) hands him the paper and crayon: the player writes on it now. */
export function handPaper(g: Game, warden: Entity, asks: Asks = "watchword"): void {
  const b = barricade(g);
  b.writing = warden;
  b.asks = asks;
  g.input.keys.clear();                                   // he stands still while he writes
}

/** Letters and spaces only, any case, however spaced: what a warden reads off crayon on a scrap of paper. */
export const read = (text: string) => text.toLowerCase().replace(/[^a-z]+/g, " ").trim();

/** He hands the paper back with `text` on it (null: he kept it, and wrote nothing): the warden (or Yssa) reads it and says so. */
export function handBack(g: Game, text: string | null): void {
  const b = barricade(g), warden = writingFor(g);
  b.writing = null;
  if (warden === null) return;
  const written = (text ?? "").trim().slice(0, PAPER_LENGTH);
  if (b.asks !== "watchword") { readWord(g, warden, text === null ? null : written); return; }
  const right = read(written) === read(WATCHWORD);
  if (right) b.passed = true;
  const lines = text === null ? WARDEN_TALK.kept
    : !written ? WARDEN_TALK.blank
    : right ? WARDEN_TALK.right
    : WARDEN_TALK.wrong.map(l => l.replace("{written}", written));
  speak(g, warden, "warden", lines);
}

/** The barricade's gate here, if this area has one: its span across (game px), and the wardens' place in front of it. */
interface Gate { x0: number; x1: number; y: number; stakes: number }
function gateOf(g: Game): Gate | null {
  const p = g.area.layout.props.find(p => p.kind === "barricade");
  if (!p || p.kind !== "barricade") return null;
  const x0 = p.rect.x + p.gate * T;
  return { x0, x1: x0 + p.gateW * T, y: p.rect.y - HALF, stakes: p.rect.y + p.rect.h / 2 + T / 4 };
}

/** Where a warden stands (centre x, game px): in the gate's west or east half while it's shut, or at its post beside it once it's open. */
const spot = (gate: Gate, west: boolean, open: boolean): number =>
  open ? (west ? gate.x0 - 0.6 * T : gate.x1 + 0.6 * T) : (west ? gate.x0 + T / 2 : gate.x1 - T / 2);

/**
 * The map with the wardens in it: shut, the two of them shoulder to shoulder in the gate, from their feet back to the
 * stakes; open, each by a post, as solid as any guard.
 */
const maps = new WeakMap<TileMap, { shut: TileMap; open: TileMap }>();
function wardensIn(map: TileMap, gate: Gate, open: boolean): TileMap {
  let m = maps.get(map);
  if (!m) {
    const feet = gate.y - HALF + FEET.y;
    const post = (west: boolean): Shape => ({ kind: "circle", x: spot(gate, west, true), y: gate.y, r: 0.3 * T });
    maps.set(map, m = {
      shut: { ...map, solids: [...map.solids, { kind: "box", x: gate.x0, y: feet, w: gate.x1 - gate.x0, h: gate.stakes - feet }] },
      open: { ...map, solids: [...map.solids, post(true), post(false)] },
    });
  }
  return open ? m.open : m.shut;
}

/** How fast the wardens step aside (px/s). */
const STEP_ASIDE = 14;
let stoppedAt = -Infinity;

/**
 * The woodwardens stand in the barricade's gate, side by side, until they've read the watchword off him; then they
 * step aside, one to each post, and the way's open. Pushing at them before then gets a word. (dt Infinity: just be there.)
 */
export function wardenSystem(g: Game, dt: number): void {
  const gate = gateOf(g);
  if (!gate) return;
  const open = passedBarricade(g), mid = (gate.x0 + gate.x1) / 2;
  g.map = wardensIn(g.area.layout.map, gate, open);
  for (const [, { transform: t, targetable }] of g.world.query("transform", "targetable")) {
    if (targetable.name !== WOODWARDEN.name) continue;
    const west = t.x + HALF < mid;
    const want = spot(gate, west, open) - HALF;
    t.x += Math.sign(want - t.x) * Math.min(Math.abs(want - t.x), STEP_ASIDE * dt);
  }
  if (open || dt === Infinity) return;
  // Walking into them: a word from one of them now and then.
  const p = g.world.need(g.player, "transform"), fx = p.x + FEET.x, fy = p.y + FEET.y + FEET.h;
  if (fx + FEET.w > gate.x0 && fx < gate.x1 && Math.abs(fy - (gate.y - HALF + FEET.y)) < 1.5 && g.input.keys.size > 0) wardenStops(g);
}

/** A warden tells him no (once every couple of seconds at most; a new run starts its clock again). */
export function wardenStops(g: Game): void {
  if (g.clock - stoppedAt < 2.5 && g.clock >= stoppedAt) return;
  stoppedAt = g.clock;
  const p = g.world.need(g.player, "transform");
  let near: { x: number; y: number } | null = null, best = Infinity;
  for (const [, { transform: t, targetable }] of g.world.query("transform", "targetable")) {
    if (targetable.name !== WOODWARDEN.name) continue;
    const d = Math.hypot(t.x - p.x, t.y - p.y);
    if (d < best) { best = d; near = t; }
  }
  const lines = WARDEN_TALK.stop, line = lines[Math.floor(g.rng.next() * lines.length)]!;
  if (near && best < 80) combatText(g, near.x, near.y - 4, line, "#e8dcc4", false, 2.4);
  else toast(g, line);
}
