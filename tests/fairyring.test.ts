// The fairy ring in the Witchwood's north-west glade: it stands on open ground the hero can walk to, and nothing about it
// stands in his way.
import { describe, expect, it } from "vitest";
import { HOME } from "../src/areas/index.ts";
import { T } from "../src/data/world.ts";
import { isOpenGround, reachableFrom } from "../src/world/map.ts";
import { propSolids } from "../src/world/solids.ts";

describe("the fairy ring", () => {
  const layout = HOME.build(), ring = layout.props.find(p => p.kind === "fairyRing");

  it("is in the Witchwood, on ground the hero can reach, mushrooms and all", () => {
    expect(ring).toBeDefined();
    if (ring?.kind !== "fairyRing") return;
    const { map } = layout, start = layout.entries.start!;
    const reached = reachableFrom({ ...map, solids: [] }, start.x / T, start.y / T);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, x = Math.floor(ring.x / T + Math.cos(a) * (ring.radius + 0.2)), y = Math.floor(ring.y / T + Math.sin(a) * (ring.radius + 0.2));
      expect(isOpenGround(map.tiles[y]![x]!)).toBe(true);
      expect(reached.has(y * map.width + x)).toBe(true);
    }
  });

  it("isn't solid", () => {
    if (ring) expect(propSolids(ring)).toEqual([]);
  });
});
