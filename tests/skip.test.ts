// Skipping (a cutscene, the Erl-King's speech, the credits' reel) and ending a conversation: Q, as the hints say, since
// in fullscreen (on itch.io, say) the browser keeps Escape for itself; and Escape too, where the page gets it.
import { describe, expect, it } from "vitest";
import { SKIP_KEY, isSkip } from "../src/input/input.ts";

describe("the skip key", () => {
  it("is Q, and Escape as well, and nothing else", () => {
    expect(SKIP_KEY).toBe("Q");
    expect(isSkip("q")).toBe(true);
    expect(isSkip("escape")).toBe(true);
    for (const k of ["e", "enter", " ", "j", "w", "r", "tab"]) expect(isSkip(k), k).toBe(false);
  });
});
