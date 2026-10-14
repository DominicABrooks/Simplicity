// Canvas text in the game's pixel font: the same glyphs as the page font (font/pixel.txt).
// Each glyph is 5 rows of "0"/"1" at its own width, with a one-pixel gap between glyphs.
import { PIXEL_FONT } from "../assets/generated/font.ts";
import { PAL } from "../data/palette.ts";

const glyphOf = (ch: string): string[] | undefined => PIXEL_FONT[ch.toUpperCase()];

export const pixelTextWidth = (text: string, scale = 1): number =>
  [...text].reduce((w, ch) => w + ((glyphOf(ch) ?? ["0"])[0]!.length + 1) * scale, -scale);

/** Text with a one-pixel ink drop shadow. */
export function pixelText(g: CanvasRenderingContext2D, text: string, x: number, y: number, color: string): void {
  for (const ch of text) {
    const rows = glyphOf(ch);
    if (!rows) { x += 2; continue; }
    for (const [fill, dy] of [[PAL.K, 1], [color, 0]] as const) {   // drop shadow, then the glyph
      g.fillStyle = fill;
      rows.forEach((r, ry) => { for (let rx = 0; rx < r.length; rx++) if (r[rx] === "1") g.fillRect(x + rx, y + ry + dy, 1, 1); });
    }
    x += rows[0]!.length + 1;
  }
}

/** Text outlined in ink all round, like every other sprite, at an integer scale. */
export function outlinedText(g: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, scale: number): void {
  for (const pass of ["outline", "fill"] as const) {
    g.fillStyle = pass === "outline" ? PAL.K : color;
    let cx = x;
    for (const ch of text) {
      const rows = glyphOf(ch);
      if (!rows) { cx += 2 * scale; continue; }
      rows.forEach((r, ry) => {
        for (let rx = 0; rx < r.length; rx++) {
          if (r[rx] !== "1") continue;
          const px = cx + rx * scale, py = y + ry * scale;
          if (pass === "outline") g.fillRect(px - 1, py - 1, scale + 2, scale + 2);
          else g.fillRect(px, py, scale, scale);
        }
      });
      cx += (rows[0]!.length + 1) * scale;
    }
  }
}

/** A filled pixel circle. */
export function pixelDisc(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  g.fillStyle = color;
  const n = Math.ceil(r);
  for (let y = -n; y <= n; y++) for (let x = -n; x <= n; x++) if (x * x + y * y <= r * r) g.fillRect(cx + x, cy + y, 1, 1);
}
