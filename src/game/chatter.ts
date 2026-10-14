// Townsfolk talking to each other. When two people who know each other (family, friends, workmates,
// neighbours, or two children) pass close in the street, now and then they stop, turn to each other and
// have a word, their lines floating above whoever's speaking, and then they carry on where they were
// going. The same two won't stop again for a while, and only a few chats go on at once.
import type { Entity } from "../core/ecs.ts";
import { Rng } from "../core/rng.ts";
import { CHATTER, EXCHANGES, SMALL_TALK, type Bond } from "../data/chatter.ts";
import { FAMILIES } from "../world/people.ts";
import type { Resident } from "../world/residents.ts";
import { combatText } from "./combat.ts";
import type { Walker } from "./components.ts";
import type { Game } from "./game.ts";
import { residentById } from "./townsfolk.ts";

const firstName = (r: Resident) => r.name.replace(/^(Lord|Lady|Master|Mistress|Father|Old Mother|Old|Little|Widow|Gran)\s+/, "").replace(/"/g, "").split(" ")[0]!;
const surname = (r: Resident) => r.name.split(" ").pop()!;
const TIES = new Map(FAMILIES.map(f => [f.id, new Set(f.ties.map(t => t.to))]));

/**
 * How two people know each other, if they do: family under one roof (or one of the named families), two
 * children, friends (the named families' ties, and a few of everyone else), workmates (the same place by
 * day), or neighbours (homes a few doors apart). Null for strangers.
 */
export function bondOf(a: Resident, b: Resident): Bond | null {
  if (a.id === b.id) return null;
  const sameHome = a.home.area === b.home.area && a.home.place === b.home.place;
  if ((sameHome && surname(a) === surname(b)) || (a.family && a.family === b.family && a.role === "family" && b.role === "family")) return "family";
  const near = a.home.area === b.home.area && Math.abs(a.home.x - b.home.x) + Math.abs(a.home.y - b.home.y) <= 6;
  if (a.age < 14 && b.age < 14) return sameHome || near || friendly(a, b) ? "kids" : null;
  if (a.age < 14 || b.age < 14) return null;
  if (a.family && b.family && (TIES.get(a.family)?.has(b.family) || TIES.get(b.family)?.has(a.family))) return "friends";
  if (a.home.area === b.home.area && Math.abs(a.age - b.age) <= 20 && friendly(a, b)) return "friends";
  if (a.day.area === b.day.area && a.day.place === b.day.place && !/works at home|playing|song school/.test(a.day.place)) return "workmates";
  return near ? "neighbours" : null;
}

/** Whether two people are friends, for those the lore doesn't say: the same few pairs every time. */
function friendly(a: Resident, b: Resident): boolean {
  const lo = Math.min(a.id, b.id), hi = Math.max(a.id, b.id);
  return ((lo * 73856093) ^ (hi * 19349663)) % 100 < CHATTER.friends;
}

/** What two people say to each other: taking turns, first `a`, each naming only the other. */
export function chatLines(rng: Rng, a: Resident, b: Resident, bond: Bond): { by: 0 | 1; text: string }[] {
  const pool = bond === "kids" || rng.next() < 0.7 ? EXCHANGES[bond] : SMALL_TALK;
  const pick = pool[Math.floor(rng.next() * pool.length)]!;
  return pick.map((line, i) => ({ by: (i % 2) as 0 | 1, text: line.replace(/\{a\}/g, firstName(a)).replace(/\{b\}/g, firstName(b)) }));
}

interface Chat { who: [Entity, Entity]; lines: { by: 0 | 1; text: string }[]; said: number; next: number }
interface Chatter { area: string; chats: Chat[]; busy: Set<Entity>; since: Map<string, number>; look: number; clock: number; rng: Rng }
const state = new WeakMap<Game, Chatter>();

/** Every frame: keep the chats going, and now and then two people who know each other stop for one. */
export function updateChatter(g: Game, dt: number): void {
  let s = state.get(g);
  if (!s || s.area !== g.area.def.id) state.set(g, s = { area: g.area.def.id, chats: [], busy: new Set(), since: s?.since ?? new Map(), look: CHATTER.every, clock: s?.clock ?? 0, rng: s?.rng ?? new Rng(4242) });
  if (g.state !== "play") return;
  s.clock += dt;
  const talkingTo = g.world.get(g.player, "conversation")?.with;

  for (const chat of [...s.chats]) {
    const [ea, eb] = chat.who, wa = g.world.get(ea, "walker"), wb = g.world.get(eb, "walker"), ta = g.world.get(ea, "transform"), tb = g.world.get(eb, "transform");
    // Over when either's gone, the hero's started talking to one of them, or they've wandered apart.
    if (!wa || !wb || !ta || !tb || talkingTo === ea || talkingTo === eb || Math.hypot(ta.x - tb.x, ta.y - tb.y) > CHATTER.near * 2 || chat.said >= chat.lines.length && chat.next <= 0) {
      end(s, chat, wa, wb);
      continue;
    }
    for (const [w, t, o] of [[wa, ta, tb], [wb, tb, ta]] as const) {     // stood still, facing each other
      w.moving = false;
      w.wait = Math.max(w.wait, 1);
      w.facing = Math.atan2(o.y - t.y, o.x - t.x);
    }
    if ((chat.next -= dt) <= 0 && chat.said < chat.lines.length) {
      const line = chat.lines[chat.said++]!, t = line.by === 0 ? ta : tb;
      combatText(g, t.x, t.y - 4, line.text, CHATTER.color, false, CHATTER.line);
      chat.next = CHATTER.gap;
    }
  }

  if ((s.look -= dt) > 0 || s.chats.length >= CHATTER.most) return;
  s.look = CHATTER.every;
  const free = g.world.query("walker", "transform").filter(([e, { walker: w }]) =>
    !s.busy.has(e) && e !== talkingTo && !w.follow && w.holdFor === null && w.plan !== "answer" && w.plan !== "play" && !(w.plan === "work" && !w.moving) && w.leaving <= 0 && !w.catchingUp);
  for (let i = 0; i < free.length && s.chats.length < CHATTER.most; i++) for (let j = i + 1; j < free.length; j++) {
    const [ea, { walker: wa, transform: ta }] = free[i]!, [eb, { walker: wb, transform: tb }] = free[j]!;
    if (s.busy.has(ea) || s.busy.has(eb) || Math.hypot(ta.x - tb.x, ta.y - tb.y) > CHATTER.near) continue;
    const a = residentById(wa.id), b = residentById(wb.id), bond = a && b ? bondOf(a, b) : null;
    const pair = `${Math.min(wa.id, wb.id)}-${Math.max(wa.id, wb.id)}`, last = s.since.get(pair);
    if (!a || !b || !bond || (last !== undefined && s.clock - last < CHATTER.again) || s.rng.next() > CHATTER.chance) continue;
    s.since.set(pair, s.clock);
    s.busy.add(ea).add(eb);
    s.chats.push({ who: [ea, eb], lines: chatLines(s.rng, a, b, bond), said: 0, next: 0.3 });
    break;
  }
}

/** Done talking: back on their way, or, if they'd got where they were going, a moment longer there. */
function end(s: Chatter, chat: Chat, ...walkers: (Walker | undefined)[]): void {
  s.chats.splice(s.chats.indexOf(chat), 1);
  for (const e of chat.who) s.busy.delete(e);
  for (const w of walkers) {
    if (!w) continue;
    if (w.path.length) w.moving = true;
    else w.wait = Math.min(w.wait, 0.5);
  }
}

/** The chats going on now (for the tests). */
export const chatsNow = (g: Game): readonly Chat[] => state.get(g)?.chats ?? [];
