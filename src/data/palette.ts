import { SPRITES } from "../assets/generated/sprites.ts";

/** Palette characters from palette/simplicity.txt. */
export type PaletteKey = "K" | "k" | "W" | "w" | "R" | "r" | "O" | "Y" | "G" | "v" | "C" | "B" | "b" | "P" | "N" | "n" | "~";

/** The master palette: character -> "#rrggbb". See ART_STYLE.md for each colour's role. */
export const PAL = SPRITES.palette as Record<PaletteKey, string>;
