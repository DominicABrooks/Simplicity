// Talking to people. Clicking someone friendly who can talk (a guard, or one of the townsfolk), or pressing E while they're
// your target, starts a conversation instead of an attack: their lines come one at a time in a box at the
// bottom of the screen. A click, Enter, Space or E shows the rest of a line or goes on to the next;
// Escape, or walking away, ends it. It lives on the hero (see Conversation), so it's gone with the area.
import type { Entity } from "../core/ecs.ts";
import { TALK } from "../data/dialogue.ts";
import type { Resident } from "../world/residents.ts";
import { folkLines, guardLines } from "./conversation.ts";

export { jobLine } from "./conversation.ts";
import { residentById } from "./townsfolk.ts";
import { toast, type Game } from "./game.ts";

/** Can this be talked to? Friendly people only: guards and the townsfolk. */
export function canTalk(g: Game, e: Entity | null): e is Entity {
  return e !== null && (g.world.has(e, "sentry") || g.world.has(e, "walker")) && g.world.get(e, "targetable")?.hostile === false;
}

/** The conversation the hero is in, if any. */
export const talking = (g: Game) => g.world.get(g.player, "conversation") ?? null;

/** Start talking to someone, if they can talk and are close enough. Returns whether they could talk at all. */
export function startTalk(g: Game, e: Entity | null): boolean {
  if (!canTalk(g, e)) return false;
  const hero = g.world.need(g.player, "transform"), them = g.world.need(e, "transform");
  if (Math.hypot(hero.x - them.x, hero.y - them.y) > TALK.reach) { toast(g, "Too far away to talk"); return true; }
  const name = g.world.need(e, "targetable").name;
  const who = g.world.get(e, "walker"), resident = who && residentById(who.id);
  const lines = resident ? folkLines(g.rng, resident, housematesOf(resident)) : guardLines(g.rng, g.area.def.id);
  g.world.add(g.player, "conversation", { with: e, name, lines, line: 0, t: 0 });
  return true;
}

/** Show the rest of the line, or go on to the next, or end it after the last. */
export function advanceTalk(g: Game): void {
  const c = talking(g);
  if (!c) return;
  const shown = Math.floor(c.t * TALK.charsPerSecond);
  if (shown < c.lines[c.line]!.length) { c.t = c.lines[c.line]!.length / TALK.charsPerSecond; return; }
  if (++c.line >= c.lines.length) endTalk(g);
  else c.t = 0;
}

export function endTalk(g: Game): void {
  g.world.remove(g.player, "conversation");
}

/** Every frame: the line types out, and the conversation ends if they're gone or the hero walks off. */
export function updateTalk(g: Game, dt: number): void {
  const c = talking(g);
  if (!c) return;
  const them = g.world.get(c.with, "transform"), hero = g.world.need(g.player, "transform");
  if (g.state !== "play" || !them || Math.hypot(hero.x - them.x, hero.y - them.y) > TALK.leave) { endTalk(g); return; }
  c.t += dt;
}

/** The others under someone's roof: the census lists a household together, so they're the near ids at the same home. */
function housematesOf(r: Resident): Resident[] {
  const out: Resident[] = [];
  for (let d = -12; d <= 12; d++) {
    const o = d === 0 ? undefined : residentById(r.id + d);
    if (o && o.home.area === r.home.area && o.home.place === r.home.place && Math.abs(o.home.x - r.home.x) <= 6 && Math.abs(o.home.y - r.home.y) <= 6) out.push(o);
  }
  return out;
}
