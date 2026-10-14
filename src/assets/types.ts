// Shapes of the data generated from art/ and font/ by the tools in tools/.

/** One animation: milliseconds per frame, and frames as rows of palette characters ("." is transparent). */
export interface SpriteAnim {
  ms: number;
  frames: string[][];
}

/** A sprite file from art/. Tiles are ground textures and never get an outline. */
export interface SpriteDef {
  kind: "sprite" | "tile";
  anims: Record<string, SpriteAnim>;
}

export interface SpriteData {
  /** Palette character -> "#rrggbb". */
  palette: Record<string, string>;
  /** Palette characters that never get the 1px ink outline (water). */
  noOutline: string[];
  sprites: Record<string, SpriteDef>;
}

/** Pixel font glyphs: 5 rows of "0"/"1", trimmed to the glyph's own width. */
export type PixelFont = Record<string, string[]>;
