// Where to find each boss, for playtesting (src/debug.ts): their area and the way in, the level and gear a
// hero on the straight path has on reaching them, and how to set the fight up once he's there.
import { CINDER_READY } from "../data/ashwild.ts";
import { RINGER_READY } from "../data/ghost.ts";
import { RIME_READY } from "../data/hollow.ts";
import type { KitPiece } from "../data/items.ts";
import { HALF, T } from "../data/world.ts";
import type { Prop } from "../world/area.ts";
import type { Point } from "../world/collision.ts";
import type { Game } from "./game.ts";
import { churchyardOf, ghostOut, hauntingOf, riseGhost } from "./ghost.ts";
import { takeBow } from "./hunterhut.ts";

export interface Lair {
  area: string;
  entry: string;
  /** The level; what he's wearing; and anything else he'd be carrying by then (besides the starter kit). */
  ready: { level: number; kit: readonly KitPiece[]; bag?: readonly KitPiece[] };
  /** In the area, levelled and dressed: bring the boss out if need be; where the hero stands to face them (cell top-left). */
  stage(g: Game): Point;
}

export const LAIRS = {
  /** Cinder, waiting in his arena at the end of the Ashwild (src/game/bosses.ts). */
  cinder: {
    area: "ashwild", entry: "witchwood", ready: CINDER_READY,
    stage(g) {
      const at = g.area.layout.props.find((p): p is Extract<Prop, { kind: "boss" }> => p.kind === "boss" && p.who === "cinder")!;
      return { x: at.x - HALF, y: at.y - HALF + 4 * T };     // in among the stones: the fire shuts, and out he comes
    },
  },
  /** Rime, under the ice in the middle of the Frozen Hollow's lake (src/game/rimefight.ts). */
  rime: {
    area: "hollow", entry: "stone", ready: RIME_READY,
    stage(g) {
      takeBow(g);                                             // he's carrying it: it isn't still lying in the hut
      const at = g.area.layout.props.find((p): p is Extract<Prop, { kind: "boss" }> => p.kind === "boss" && p.who === "rime")!;
      return { x: at.x - HALF, y: at.y - HALF + 3 * T };     // onto her ring of runes: up she comes
    },
  },
  /** The Grey Ringer, in St Mary's churchyard: made night, and up she comes, rumour or none (src/game/ghost.ts). */
  ringer: {
    area: "capital", entry: "southgate", ready: RINGER_READY,
    stage(g) {
      g.hour = 22;                                            // the start of the night: hours of it before dawn sends her back
      const yard = churchyardOf(g)!;
      hauntingOf(g).night = "risen";
      if (ghostOut(g) === null) riseGhost(g, yard);
      return { x: yard.x + yard.w - 16 - 6 * T, y: yard.y + yard.h + T };   // on the street, west of her grave
    },
  },
} satisfies Record<string, Lair>;

export type LairName = keyof typeof LAIRS;
