// The end of the story path (STORY.md, "0:55 The head, the King, the credits"). Once Calder has fallen and the great
// crack has groaned shut, the rift stone glows brighter than any stone has before; touching it, the hero wakes at the
// fountain stone in Kingsholm, at dawn. Carrying the head up through the waking city, a crowd gathers behind him
// (src/game/crowd.ts, src/game/townsfolk.ts); in the castle ward the King has come out onto the keep steps to see what
// the noise is, and as the hero comes near, the homecoming scene plays (src/data/cutscenes.ts): he sets the head at
// the King's feet, the King has his say, and the credits roll (src/ui/credits.ts). After, the game goes on.
import type { Entity } from "../core/ecs.ts";
import { AFTER_TALK, HEAD_TALK, HOMECOMING } from "../data/ending.ts";
import { CALDER_FIGHT } from "../data/rift.ts";
import { HALF } from "../data/world.ts";
import type { CurrentArea } from "./game.ts";
import { beaten } from "./bosses.ts";
import { calderGone } from "./calderfight.ts";
import { onCue, onlyIf } from "./cutscene.ts";
import type { Resident } from "../world/residents.ts";
import { disperseCrowd, gatherCrowd, processionOn } from "./crowd.ts";
import { setState, toast, type Game } from "./game.ts";
import { carryingHead, giveUpHead } from "./head.ts";
import { spawnKing } from "./spawn.ts";
import { TOUCH_AT } from "./stones.ts";

interface Ending {
  /** The glow on the rift stone, in the area it was lit in (lit once per visit). */
  glow: { e: Entity; in: CurrentArea } | null;
  /** He's set the head at the King's feet; the credits have rolled. */
  laid: boolean;
  over: boolean;
  /** Who's had their say about it since (by their conversation key). */
  told: Set<string>;
}
const endings = new WeakMap<Game, Ending>();
function endingOf(g: Game): Ending {
  let s = endings.get(g);
  if (!s) {
    const fresh: Ending = { glow: null, laid: false, over: false, told: new Set() };
    endings.set(g, s = fresh);
    g.events.on("reset", () => Object.assign(fresh, { glow: null, laid: false, over: false, told: new Set() }));
  }
  return s;
}

/** Is the way home open: Calder fallen and the great crack shut behind him? */
export const wayHomeOpen = (g: Game): boolean => beaten(g, "calder") && (calderGone(g) ?? 0) >= CALDER_FIGHT.crack.shut;

/** Has he set the head at the King's feet (this run)? */
export const headLaid = (g: Game): boolean => endingOf(g).laid;

/**
 * What someone says to him at the end, instead of their usual (null if it's not the time): on his way up with the head,
 * how they take the sight of it, as they stand on the Edict (or as a child, one of the crowd behind him, or a guard);
 * and once the King's told the city, the first time each speaks to him after, how they take that. `key` is their
 * conversation key; `r` who they are, if they're one of the townsfolk (else a guard).
 */
export function endingTalk(g: Game, key: string, r: Resident | undefined, following: boolean): string[] | null {
  const kid = !!r && r.age < 12, pick = (lines: readonly string[]) => [lines[Math.floor(g.rng.next() * lines.length)]!];
  if (processionOn(g)) return pick(!r ? HEAD_TALK.guard : kid ? HEAD_TALK.child : following ? HEAD_TALK.following : HEAD_TALK[r.stance]);
  const s = endingOf(g);
  if (!s.laid || s.told.has(key)) return null;
  s.told.add(key);
  return pick(!r ? AFTER_TALK.guard : kid ? AFTER_TALK.child : AFTER_TALK[r.stance]);
}

/** The rift stone, if this is the Rift. */
const riftStone = (g: Game) => (g.area.def.id === "rift" ? g.area.layout.props.find(p => p.kind === "oldStone") : undefined);

/**
 * Every frame (with the old stones): in the Rift with the way home open, the rift stone glows; touching it, he goes
 * home, waking at the fountain stone at dawn. True if he's on his way.
 */
export function homeStoneSystem(g: Game): void { goHome(g); }
function goHome(g: Game): boolean {
  const stone = riftStone(g), s = endingOf(g);
  if (!stone || !wayHomeOpen(g) || g.state !== "play") return false;
  if (s.glow?.in !== g.area) {
    s.glow = { e: g.world.create({ transform: { x: stone.x - HALF, y: stone.y - HALF }, renderable: { kind: "homestone" } }), in: g.area };
    toast(g, HOMECOMING.glows, true);
  }
  const p = g.world.need(g.player, "transform");
  if (Math.hypot(p.x + HALF - stone.x, p.y + HALF - stone.y) > TOUCH_AT) return false;
  g.fx.push({ type: "burst", x: stone.x - HALF, y: stone.y - HALF, palette: "spark" });
  g.hour = HOMECOMING.dawn;                                  // the fade hides the sky changing
  g.travel = { area: "capital", entry: "stone" };
  setState(g, "travel");
  return true;
}

/** Set up the ending: the King out on the keep steps when he comes home with the head, and the scene's cues. Call once, at start-up. */
export function watchEnding(g: Game): void {
  endingOf(g);
  onlyIf("homecoming", g => beaten(g, "calder") && carryingHead(g) && !headLaid(g));
  onCue("layHead", layHead);
  onCue("credits", g => { if (!endingOf(g).over) setState(g, "credits"); });
  g.events.on("area", ({ def, layout }) => {
    if (def.id !== "castle" || !beaten(g, "calder") || !carryingHead(g) || headLaid(g)) return;
    // Down at the foot of the keep's stairs, where he'd come out of its door (the way back out of the Throne Room).
    const at = layout.entries.keep;
    if (at) spawnKing(g, at.x, at.y, Math.PI / 2);
  });
}

/** The credits are over: back to the game, the crowd going back to their day. */
export function endCredits(g: Game): void {
  endingOf(g).over = true;
  disperseCrowd(g);
  if (g.state === "credits") setState(g, "play");
}

/** He sets the head down at the King's feet: out of his bag and onto the ground there, and the crowd stops to watch. */
function layHead(g: Game): void {
  const s = endingOf(g);
  if (s.laid) return;
  const king = g.world.query("renderable", "transform").find(([, c]) => c.renderable.kind === "king")?.[1].transform;
  if (!king || !giveUpHead(g)) return;
  s.laid = true;
  const hero = g.world.need(g.player, "transform"), d = Math.hypot(hero.x - king.x, hero.y - king.y) || 1, at = Math.min(7, d / 2);
  g.world.create({ transform: { x: king.x + ((hero.x - king.x) / d) * at, y: king.y + ((hero.y - king.y) / d) * at }, renderable: { kind: "head" } });
  gatherCrowd(g, { x: king.x + HALF, y: king.y + HALF });
}
