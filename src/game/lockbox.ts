// The woodcutters' strongbox (src/data/lockbox.ts), in the Coppins' hut in the Ashwild (src/areas/cutterhut.ts). It
// stands shut against the back wall, four brass number wheels in its front. Walk up to it and press E (or click it) and
// the player sets the wheels (src/ui/pinpad.ts); the right number and it opens, and Abel Coppin's good boots are in it,
// legendary, there in front of it till he has them. It stays open the rest of the run. Abel himself tells him the
// number, in the Wallside lanes in Kingsholm, where he stands about by day with nothing to cut (abelLines); so do the fair folk, first of all, in the fairy ring (src/game/fairyring.ts); and so
// may the letter in the bottle (src/game/quay.ts).
import type { Entity } from "../core/ecs.ts";
import { TALK } from "../data/dialogue.ts";
import { ABEL, ABEL_TALK, ASHWALKERS, LOCKBOX, LOCKBOX_SAYS } from "../data/lockbox.ts";
import { HALF, T } from "../data/world.ts";
import { makeItem, type Item } from "../items/items.ts";
import { TOWNSFOLK } from "../data/townsfolk.ts";
import { FACING_ANGLE, type Prop } from "../world/area.ts";
import { doorKey, doorStep } from "../world/townkit.ts";
import { combatText } from "./combat.ts";
import { toast, type CurrentArea, type Game } from "./game.ts";
import { sound } from "./sfx.ts";
import { dropLoot } from "./spawn.ts";

/** The hut it's in. */
export const LOCKBOX_AREA = "cutterhut";

/** This run: whether it's open, whether he's had the boots out of it, whether he's been told it's there, and whether he's at its wheels. */
interface Box { open: boolean; taken: boolean; seen: boolean; setting: Entity | null }
const boxes = new WeakMap<Game, Box>();
function boxOf(g: Game): Box {
  let b = boxes.get(g);
  if (!b) {
    const fresh: Box = { open: false, taken: false, seen: false, setting: null };
    boxes.set(g, b = fresh);
    g.events.on("reset", () => Object.assign(fresh, { open: false, taken: false, seen: false, setting: null }));
  }
  return b;
}

/** Is the strongbox open this run? */
export const lockboxOpen = (g: Game): boolean => boxOf(g).open;

/** Open it without the number (getting about quickly in development, and the tests). */
export function openLockbox(g: Game): void { boxOf(g).open = true; }

/** Is this the strongbox? */
export const isLockbox = (g: Game, e: Entity | null): e is Entity => e !== null && g.world.get(e, "renderable")?.kind === "lockbox";

/** Where the strongbox stands (an entity's top-left, game px). */
const boxAt = () => ({ x: LOCKBOX.at.x * T - HALF, y: LOCKBOX.at.y * T - HALF });
/** Where the boots lie once it's open: on the floor just in front of it. */
const bootsAt = () => ({ x: LOCKBOX.at.x * T - HALF, y: (LOCKBOX.at.y + 1) * T - HALF });

/** Is Abel's pair his already: in the bag, in hand or on his feet? */
const hasBoots = (g: Game): boolean => {
  const inv = g.inventory, is = (i: Item | null | undefined) => i?.name === ASHWALKERS.name;
  return inv.grid.some(e => is(e.item)) || is(inv.held) || Object.values(inv.equip).some(is);
};
/** The boots, lying here, if they are. */
const bootsHere = (g: Game): boolean => g.world.query("pickup").some(([, c]) => c.pickup.kind === "loot" && c.pickup.item.name === ASHWALKERS.name);

/**
 * Walk up to it and try it (E, or a click): the wheels come up for the player to set, or, too far off, he's told so, or,
 * open, it's empty. Whether this was the strongbox at all.
 */
export function tryLockbox(g: Game, e: Entity | null): boolean {
  if (!isLockbox(g, e)) return false;
  g.target = e;
  const hero = g.world.need(g.player, "transform"), it = g.world.need(e, "transform");
  if (Math.hypot(hero.x - it.x, hero.y - it.y) > LOCKBOX.reach) { toast(g, LOCKBOX_SAYS.far); return true; }
  const b = boxOf(g);
  if (b.open) { toast(g, LOCKBOX_SAYS.empty); return true; }
  b.setting = e;
  g.input.keys.clear();                                     // he stands still while the wheels are set
  return true;
}

/** The strongbox he's setting the wheels of, while he is; null otherwise (or once he's walked off, or the play's stopped). */
export function settingWheels(g: Game): Entity | null {
  const b = boxOf(g), e = b.setting;
  if (e === null) return null;
  const it = g.world.get(e, "transform"), hero = g.world.need(g.player, "transform");
  if (g.state !== "play" || !it || Math.hypot(hero.x - it.x, hero.y - it.y) > TALK.leave) b.setting = null;
  return b.setting;
}

/** Only the digits, at most four: what the wheels can show. */
export const wheels = (text: string): string => text.replace(/\D+/g, "").slice(0, LOCKBOX.code.length);

/** He lets go of the wheels set to `code` (null: he stepped back without trying). The right number, and it opens. */
export function setWheels(g: Game, code: string | null): void {
  const b = boxOf(g), e = settingWheels(g);
  b.setting = null;
  if (e === null || code === null) return;
  const set = wheels(code), it = g.world.need(e, "transform");
  if (set !== LOCKBOX.code) {
    sound(g, "shutter");
    combatText(g, it.x, it.y - 4, "Click", "#c9b27a");
    toast(g, LOCKBOX_SAYS.wrong.replace("{code}", set.padEnd(LOCKBOX.code.length, "-")));
    return;
  }
  b.open = true;
  sound(g, "pickup");
  toast(g, LOCKBOX_SAYS.opens, true);
}

/**
 * Every frame, in the hut: the strongbox stands against the back wall, shut or open (said the first time each run); and once
 * it's open, Abel's boots lie in front of it till he has them.
 */
export function lockboxSystem(g: Game, dt = 0): void {
  if (g.area.def.id === ABEL.area) abelsDay(g, dt);
  if (g.area.def.id !== LOCKBOX_AREA) return;
  const b = boxOf(g);
  if (!g.world.query("renderable").some(([, c]) => c.renderable.kind === "lockbox")) {
    g.world.create({
      transform: boxAt(),
      targetable: { hostile: false, name: LOCKBOX.name, radius: 5, height: 0.5 },
      renderable: { kind: "lockbox" },
    });
  }
  if (!b.seen) { b.seen = true; toast(g, LOCKBOX_SAYS.seen); }
  if (!b.open || b.taken) return;
  if (hasBoots(g)) { b.taken = true; return; }
  if (bootsHere(g)) return;
  const boots = makeItem(ASHWALKERS.type, ASHWALKERS.rarity, { ...ASHWALKERS.mods }, ASHWALKERS.name), at = bootsAt();
  boots.note = ASHWALKERS.note;
  g.world.remove(dropLoot(g, at.x, at.y, boots), "despawn");   // they've waited this long
}

/** Is this Abel Coppin: the woodcutter, come up out of the Ashwild? */
export const isAbel = (g: Game, e: Entity): boolean => g.world.get(e, "renderable")?.kind === "woodcutter";

/** Abel, if he's out. */
const abelOf = (g: Game): Entity | undefined => g.world.query("renderable").find(([e]) => isAbel(g, e))?.[0];

/** Is Abel out in the lane at this hour: from when the townsfolk go to their work till their bedtime, as they are? */
export const abelOut = (g: Game): boolean => g.hour >= TOWNSFOLK.hours.workFrom && g.hour < TOWNSFOLK.hours.bedtime;

/** Where Abel stands by day, and the step outside the door he goes home through (entities' top-left, game px). */
const abelPost = () => ({ x: ABEL.x * T - HALF, y: ABEL.y * T - HALF });
function abelDoor(g: Game): { x: number; y: number } {
  const [tx, ty] = ABEL.home;
  const house = g.area.layout.props.find((p): p is Extract<Prop, { kind: "house" }> => p.kind === "house" && Math.round(p.rect.x / T) === tx && Math.round(p.rect.y / T) === ty);
  return (house && doorStep(g.area.layout, doorKey(house))) ?? abelPost();
}

/** In this arrival, whether he's gone home for the night: then come the morning, he comes out of his door, not just there. */
const wentHome = new WeakMap<Game, CurrentArea>();

/**
 * Abel's day in the Wallside lane: out of his door in the morning and over to his place in the lane, where he stands all
 * day; at bedtime, over to his door and in. Arriving by day, he's already at his place; by night, he's indoors.
 */
function abelsDay(g: Game, dt: number): void {
  const e = abelOf(g), out = abelOut(g);
  if (!out) {
    if (e === undefined) { wentHome.set(g, g.area); return; }
    if (walkTo(g, e, abelDoor(g), dt)) { g.world.destroy(e); wentHome.set(g, g.area); }
    return;
  }
  const at = e === undefined ? (wentHome.get(g) === g.area ? abelDoor(g) : abelPost()) : null;
  const abel = e ?? spawnAbel(g, at!);
  walkTo(g, abel, abelPost(), dt);
}

/** Abel walks toward `to` at his own pace; whether he's there. */
function walkTo(g: Game, e: Entity, to: { x: number; y: number }, dt: number): boolean {
  const t = g.world.need(e, "transform"), dx = to.x - t.x, dy = to.y - t.y, d = Math.hypot(dx, dy), step = ABEL.speed * dt;
  if (d <= step || d < 0.01) { t.x = to.x; t.y = to.y; return true; }
  t.x += (dx / d) * step;
  t.y += (dy / d) * step;
  return false;
}

/** Abel, at `at`, looking out over the lane. */
function spawnAbel(g: Game, at: { x: number; y: number }): Entity {
  const post = FACING_ANGLE.south;
  return g.world.create({
    transform: { ...at },
    targetable: { hostile: false, name: ABEL.name, radius: 5, height: 1.6 },
    sentry: { post, look: post, want: post, next: 2 },
    renderable: { kind: "woodcutter" },
  });
}

/** What Abel says: all of it, the number among it, the first time; after, a line at a time; once the box is open, that he's glad. */
export function abelLines(g: Game, visits: number): string[] {
  if (lockboxOpen(g)) return [...ABEL_TALK.opened];
  if (visits === 0) return [...ABEL_TALK.first];
  return [ABEL_TALK.again[(visits - 1) % ABEL_TALK.again.length]!];
}
