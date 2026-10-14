// Mage spells in the world: bolts in flight and lightning strikes waiting to land.
import { SPELLS, type BoltKind } from "../data/enemies.ts";
import { Tile } from "../data/world.ts";
import { damagePlayer, polymorph } from "../game/combat.ts";
import type { BurstPalette } from "../game/fx.ts";
import type { Game } from "../game/game.ts";
import { heroParts } from "../game/hero.ts";
import { tileAt } from "../world/collision.ts";

const BOLT_BURST: Record<BoltKind, BurstPalette> = { fire: "fire", poly: "arcane", frost: "frost", spark: "spark" };
/** Bolt hit radius, px between cell positions. */
const BOLT_HIT = 5;

/** Bolts burst on trees; a dash or a jump dodges through them. Frost chills, polymorph turns you into a sheep. */
export function boltSystem(g: Game, dt: number): void {
  const { pos: p, motion, status } = heroParts(g), w = g.world;
  for (const [e, { transform: f, bolt }] of w.query("bolt", "transform")) {
    f.x += bolt.vx * dt; f.y += bolt.vy * dt; bolt.life -= dt;
    if (tileAt(g.map, f.x + 4, f.y + 4) === Tile.Tree) bolt.life = 0;
    else if (status.hurt <= 0 && motion.dash <= 0 && motion.jump <= 0 && Math.hypot(p.x - f.x, p.y - f.y) < BOLT_HIT) {
      if (bolt.kind === "poly") polymorph(g);
      else {
        damagePlayer(g, f.x, f.y);
        if (bolt.kind === "frost") status.chill = SPELLS.frost.chill!;
      }
      bolt.life = 0;
    }
    if (bolt.life <= 0) {
      g.fx.push({ type: "burst", x: f.x, y: f.y, palette: BOLT_BURST[bolt.kind] });
      w.destroy(e);
    }
  }
}

/** Lightning strikes land after their warning circles fill; only a dash's i-frames beat them. */
export function strikeSystem(g: Game, dt: number): void {
  const { pos: p, motion, status } = heroParts(g), w = g.world;
  for (const [e, { transform: s, strike }] of w.query("strike", "transform")) {
    strike.t -= dt;
    if (strike.t > 0) continue;
    g.fx.push({ type: "bolt", x: s.x, y: s.y });
    if (status.hurt <= 0 && motion.dash <= 0 && Math.hypot(p.x - s.x, p.y - s.y) < SPELLS.strike.radius!) damagePlayer(g, s.x, s.y);
    w.destroy(e);
  }
}
