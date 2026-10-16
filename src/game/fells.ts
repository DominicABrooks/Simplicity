// The Fells' house in the Wallside (src/data/fells.ts): Meg Fell's own lines, and her husband's grey cloak hung from
// the window, as the Ranger's note says, so whoever has the note can find the house. It hangs there till the King lets
// Wystan out (src/game/ending.ts: the head laid at his feet); then Meg takes it in for good.
import { MEG_TALK } from "../data/fells.ts";
import { HALF, T } from "../data/world.ts";
import type { Prop } from "../world/area.ts";
import { FACING_YAW, houseBody, houseDoor, local } from "../world/plans.ts";
import type { Resident } from "../world/residents.ts";
import { beaten } from "./bosses.ts";
import { headLaid } from "./ending.ts";
import type { Game } from "./game.ts";
import { loadCensus } from "./townsfolk.ts";

/** Is this Meg Fell: the Ranger's wife, the grown woman of the Fells at home? */
export const isMeg = (r: Resident): boolean => r.family === "fell" && !r.prisoner && r.name.startsWith("Meg ");

/** What she says: all of it the first time; after, a line at a time; and once Calder's beaten, the news. */
export function megLines(g: Game, visits: number): string[] {
  if (beaten(g, "calder")) return [...MEG_TALK.quiet];
  if (visits === 0) return [...MEG_TALK.first];
  return [MEG_TALK.again[(visits - 1) % MEG_TALK.again.length]!];
}

/** How high the cloak hangs (world units): from the sill of the window over the door, upstairs; downstairs, if there's no upstairs. */
const UP = 1.85, DOWN = 0.75;

/** Hang the cloak at the Fells' window whenever he comes into the part of the city they live in, till Wystan's home. */
export function watchFells(g: Game): void {
  g.events.on("area", () => {
    if (headLaid(g)) return;
    const area = g.area.def.id;
    void loadCensus().then(people => {
      if (g.area.def.id !== area || headLaid(g)) return;
      const home = people.find(r => r.family === "fell" && !r.prisoner)?.home;
      if (!home || home.area !== area) return;
      const px = (home.x + 0.5) * T, py = (home.y + 0.5) * T;
      const house = g.area.layout.props.find((p): p is Extract<Prop, { kind: "house" }> =>
        p.kind === "house" && px >= p.rect.x && py >= p.rect.y && px <= p.rect.x + p.rect.w && py <= p.rect.y + p.rect.h);
      if (!house) return;
      // On the front, at the window nearest the door: upstairs, out on the jetty; or by the door, on a single storey.
      const body = houseBody(house.rect), sideways = house.doorSide === "east" || house.doorSide === "west";
      const d = sideways ? body.w : body.d, along = houseDoor(house).along, up = house.storeys > 1, yaw = FACING_YAW[house.doorSide];
      const at = local({ x: body.x, z: body.z }, yaw, up ? along : along + 0.85, d / 2 + (up ? 0.12 : 0) + 0.06);
      g.world.create({ transform: { x: at.x * T - HALF, y: at.z * T - HALF }, cloak: { yaw, y: up ? UP : DOWN }, renderable: { kind: "cloak" } });
    });
  });
}
