// Old Gil and his glass eye (the story is in src/data/quay.ts and docs/CURIOSITIES.md). Gil sits by his boat at the
// foot of the King's Bridge. Talk to him with the Glass Eye in the bag and he takes it back, and tells the hero what
// the river showed it: Ael's Thorn, on the bed of the lake in the Clearing, where it lies from then on (until he has it).
import type { Entity } from "../core/ecs.ts";
import { GIL, GIL_TALK, THORN, THORN_SAYS } from "../data/quay.ts";
import { T, Tile } from "../data/world.ts";
import { makeItem, type Item } from "../items/items.ts";
import { FACING_ANGLE } from "../world/area.ts";
import { carryingCurio, spendCurio, spentCurios } from "./curios.ts";
import { toast, type Game } from "./game.ts";
import { dropLoot } from "./spawn.ts";

/** Gil, if he's here. */
export const gilHere = (g: Game): Entity | null =>
  g.world.query("renderable").find(([, c]) => c.renderable.kind === "boatman")?.[0] ?? null;

/** Is this Gil? */
export const isGil = (g: Game, e: Entity): boolean => g.world.get(e, "renderable")?.kind === "boatman";

/** What Gil says, this time: he takes his eye back if the hero has it (and tells him about the Thorn), or not. */
export function gilLines(g: Game): string[] {
  if (spentCurios(g).has("eye")) return [...GIL_TALK.after];
  if (!carryingCurio(g, "eye")) return [...GIL_TALK.without];
  spendCurio(g, "eye");
  return [...GIL_TALK.given];
}

/** Is Ael's Thorn his already: in the bag, in hand or in his hand? */
const hasThorn = (g: Game): boolean => {
  const inv = g.inventory, is = (i: Item | null | undefined) => i?.name === THORN.name;
  return inv.grid.some(e => is(e.item)) || is(inv.held) || Object.values(inv.equip).some(is);
};

/** Ael's Thorn, lying on the lake bed here, if it is. */
const thornHere = (g: Game) => g.world.query("pickup").some(([, c]) => c.pickup.kind === "loot" && c.pickup.item.name === THORN.name);

/** The middle of the deepest water in this area: the water tile furthest from any shore (game px, an entity's top-left). */
export function lakeBed(g: Game): { x: number; y: number } | null {
  const { width: w, height: h, tiles } = g.map, far = new Array<number>(w * h).fill(Infinity), queue: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (tiles[y]![x] !== Tile.Water) { far[y * w + x] = 0; queue.push(y * w + x); }
  for (let i = 0; i < queue.length; i++) {
    const at = queue[i]!, x = at % w, y = (at - x) / w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy, n = ny * w + nx;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || far[n]! <= far[at]! + 1) continue;
      far[n] = far[at]! + 1;
      queue.push(n);
    }
  }
  let best = -1, out: { x: number; y: number } | null = null;
  for (let i = 0; i < far.length; i++) if (far[i]! > best && far[i]! !== Infinity && far[i]! > 0) { best = far[i]!; out = { x: (i % w) * T, y: Math.floor(i / w) * T }; }
  return best >= 2 ? out : null;
}

/** Whether he's been told this run that something glints on the lake bed (once is enough). */
const glints = new WeakMap<Game, { told: boolean }>();
function glinted(g: Game): { told: boolean } {
  let s = glints.get(g);
  if (!s) {
    const fresh = { told: false };
    glints.set(g, s = fresh);
    g.events.on("reset", () => { fresh.told = false; });
  }
  return s;
}

/**
 * Every frame: Gil's at his boat at the foot of the King's Bridge; and once he's told the hero about the Thorn, it's
 * on the lake bed in the Clearing until the hero has it.
 */
export function quaySystem(g: Game): void {
  if (g.area.def.id === "kingsroad" && !gilHere(g)) spawnGil(g);
  if (g.area.def.id === "witchwood" && spentCurios(g).has("eye") && !thornHere(g) && !hasThorn(g)) {
    const bed = lakeBed(g);
    if (bed) {
      const e = dropLoot(g, bed.x, bed.y, makeItem(THORN.type, "rare", { ...THORN.mods }, THORN.name));
      g.world.remove(e, "despawn");                             // it's waited this long
      if (!glinted(g).told) { glinted(g).told = true; toast(g, THORN_SAYS); }
    }
  }
}

function spawnGil(g: Game): Entity {
  const post = FACING_ANGLE.north;
  return g.world.create({
    transform: { x: GIL.x * T - T / 2, y: GIL.y * T - T / 2 },
    targetable: { hostile: false, name: GIL.name, radius: 5, height: 1.4 },
    sentry: { post, look: post, want: post, next: 2 },
    renderable: { kind: "boatman" },
  });
}
