import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildTtf, fontTable, loadGlyphs } from "../tools/lib/font.ts";
import { buildSpriteData } from "../tools/lib/sprites.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixture = (name: string) => readFileSync(join(ROOT, "tests", "fixtures", name));

describe("asset builders", () => {
  it("build the same sprite data as the original tools", () => {
    expect(buildSpriteData(ROOT)).toEqual(JSON.parse(fixture("sprites.json").toString("utf8")));
  });

  it("build the same font table", () => {
    expect(fontTable(loadGlyphs(ROOT))).toEqual(JSON.parse(fixture("font.json").toString("utf8")));
  });

  it("build a byte-identical TTF", () => {
    expect(Buffer.from(buildTtf(loadGlyphs(ROOT))).equals(fixture("simplicity-pixel.ttf"))).toBe(true);
  });
});
