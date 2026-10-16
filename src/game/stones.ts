// Ael's old stones (STORY.md, "Checkpoints: the old stones"): grey, flat and faintly warm, set in the ground here and
// there in the wood. Walking over one, the hero touches it and it knows him; if he falls after that, Ael wakes him
// beside the last one he touched, with his gear and level kept, instead of back at the start of a new run. A new run
// (holding R, or rising with no stone touched) forgets them.
import type { Prop } from "../world/area.ts";
import { HALF, T } from "../data/world.ts";
import { setState, toast, type Game } from "./game.ts";
import { sound } from "./sfx.ts";

type OldStone = Extract<Prop, { kind: "oldStone" }>;
/** The stone he last touched, this run: which area it's in, the arrival point beside it, and its name. */
export interface Touched { area: string; entry: string; name: string }

/** How near (px, his centre to the stone's) he comes to touch one. */
export const TOUCH_AT = 0.8 * T;

const touched = new WeakMap<Game, { stone: Touched | null }>();
function state(g: Game): { stone: Touched | null } {
  let s = touched.get(g);
  if (!s) {
    const fresh = { stone: null as Touched | null };
    touched.set(g, s = fresh);
    g.events.on("reset", () => { fresh.stone = null; });
  }
  return s;
}

/** The last stone he touched this run, if any. */
export const lastStone = (g: Game): Touched | null => state(g).stone;

/** Every frame: standing on an old stone he hasn't just touched, he touches it, and it glows for him. */
export function stoneSystem(g: Game): void {
  const p = g.world.get(g.player, "transform");
  if (!p || g.state !== "play") return;
  const s = state(g);
  for (const prop of g.area.layout.props) {
    if (prop.kind !== "oldStone" || Math.hypot(p.x + HALF - prop.x, p.y + HALF - prop.y) > TOUCH_AT) continue;
    if (s.stone?.area === g.area.def.id && s.stone.entry === prop.entry) return;
    touch(g, prop);
    return;
  }
}

function touch(g: Game, stone: OldStone): void {
  touchStone(g, { area: g.area.def.id, entry: stone.entry, name: stone.name }, stone.x - HALF, stone.y - HALF);
}

/** He touches a stone (at x, y: game px), an old stone or one that's become one (the Undercroft's woken ring): it knows him. Quietly, if it's just said so another way. */
export function touchStone(g: Game, stone: Touched, x: number, y: number, quiet = false): void {
  state(g).stone = { ...stone };
  if (quiet) return;
  g.fx.push({ type: "burst", x, y, palette: "spark" });
  sound(g, "pickup");
  toast(g, `${stone.name} glows under your hand`, true);
}

/**
 * He's fallen: if he's touched a stone this run, Ael wakes him there (whole again, gear and level kept), and this
 * says so; otherwise false, and it's a new run.
 */
export function wakeOnStone(g: Game): boolean {
  const stone = state(g).stone;
  if (g.state !== "dead" || !stone) return false;
  const health = g.world.need(g.player, "health"), status = g.world.need(g.player, "status");
  health.hp = health.maxHp;
  Object.assign(status, { hurt: 0, sheep: 0, frozen: 0, chill: 0 });
  g.travel = { area: stone.area, entry: stone.entry };
  setState(g, "travel");                                     // the travel fade loads the stone's area and arrives there
  return true;
}
