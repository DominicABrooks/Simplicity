// A tiny RGBA raster for the asset tools: enough to draw sprite sheets and write PNGs.
import { writeFileSync } from "node:fs";
import { PNG } from "pngjs";

export type RGBA = [number, number, number, number];

export class Raster {
  readonly data: Uint8Array;

  constructor(
    readonly width: number,
    readonly height: number,
    fill: RGBA = [0, 0, 0, 0],
  ) {
    this.data = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) this.data.set(fill, i * 4);
  }

  set(x: number, y: number, c: RGBA): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.data.set(c, (y * this.width + x) * 4);
  }

  get(x: number, y: number): RGBA {
    const i = (y * this.width + x) * 4;
    return [this.data[i]!, this.data[i + 1]!, this.data[i + 2]!, this.data[i + 3]!];
  }

  /** Copy another raster on top, replacing pixels (like PIL's paste). */
  paste(src: Raster, ox: number, oy: number): void {
    for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) this.set(ox + x, oy + y, src.get(x, y));
  }

  /** Draw another raster on top with alpha blending (sprite art is fully opaque or fully clear). */
  composite(src: Raster, ox: number, oy: number): void {
    for (let y = 0; y < src.height; y++)
      for (let x = 0; x < src.width; x++) {
        const c = src.get(x, y);
        if (c[3] > 0) this.set(ox + x, oy + y, c);
      }
  }

  /** Nearest-neighbour upscale by an integer factor. */
  scale(k: number): Raster {
    const out = new Raster(this.width * k, this.height * k);
    for (let y = 0; y < out.height; y++)
      for (let x = 0; x < out.width; x++) out.set(x, y, this.get(Math.floor(x / k), Math.floor(y / k)));
    return out;
  }

  savePng(path: string): void {
    const png = new PNG({ width: this.width, height: this.height });
    png.data = Buffer.from(this.data);
    writeFileSync(path, PNG.sync.write(png));
  }
}
