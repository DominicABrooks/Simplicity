// The debug handle's query parameters (src/debug.ts) work on the site too, not just in development: the handle's
// switched on whenever the address asks for one of them, and only then.
import { describe, expect, it } from "vitest";
import { DEBUG_PARAMS, wantsDebug } from "../src/debug.ts";

describe("the debug handle on the site", () => {
  it("is on when the address asks for a scene, a boss, an hour or a switch", () => {
    for (const q of ["?area=hollow", "?try=deep", "?try=seal&stones=3", "?curio=stone", "?boss=cinder", "?ending=home&full", "?hour=22", "?god", "?area=capital&entry=castle"]) expect(wantsDebug(q), q).toBe(true);
  });

  it("is off for an ordinary visit, or an address with nothing it reads", () => {
    for (const q of ["", "?", "?utm_source=itch", "?ref=home"]) expect(wantsDebug(q), q).toBe(false);
  });

  it("reads every parameter it's switched on by", () => {
    expect([...DEBUG_PARAMS].sort()).toEqual(["area", "boss", "curio", "ending", "entry", "freeze", "god", "hour", "try"]);
  });
});
