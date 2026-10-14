// Simplicity Pixel font builder: font/pixel.txt -> a TrueType file, written table by table.
// Each glyph pixel is a 100x100 square on a 600-unit em, so at font-size 6px one glyph pixel is one
// CSS pixel. Keep sizes multiples of 6 (12, 18, 24, 36) for crisp text.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PixelFont } from "../../src/assets/types.ts";

const PX = 100, EM = 600, ASCENT = 600, DESCENT = 100, SPACE_ADVANCE = 300;

/** Glyphs in file order. (An object would reorder them: JS puts integer-like keys such as "0".."9" first.) */
export type GlyphList = [string, string[]][];

export function loadGlyphs(root: string): GlyphList {
  const glyphs: GlyphList = [];
  for (const raw of readFileSync(join(root, "font", "pixel.txt"), "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const [ch, ...rows] = line.split(/\s+/) as [string, ...string[]];
    if (rows.length !== 5 || new Set(rows.map(r => r.length)).size !== 1 || rows.some(r => /[^01]/.test(r)))
      throw new Error(`Bad glyph line: ${line}`);
    glyphs.push([ch, rows]);
  }
  return glyphs;
}

/** Drop empty columns at the left and right (keeps at least one column). */
export function trim(rows: string[]): string[] {
  const cols = [...Array(rows[0]!.length).keys()].filter(c => rows.some(r => r[c] === "1"));
  if (!cols.length) return rows;
  return rows.map(r => r.slice(cols[0], cols[cols.length - 1]! + 1));
}

/** Big-endian byte writer, mirroring Python's struct.pack. */
class Bytes {
  private parts: number[] = [];
  u8(...v: number[]) { for (const x of v) this.parts.push(x & 0xff); return this; }
  u16(...v: number[]) { for (const x of v) this.parts.push((x >> 8) & 0xff, x & 0xff); return this; }
  i16(...v: number[]) { return this.u16(...v.map(x => x & 0xffff)); }
  u32(...v: number[]) { for (const x of v) this.parts.push((x >>> 24) & 0xff, (x >>> 16) & 0xff, (x >>> 8) & 0xff, x & 0xff); return this; }
  i64zero() { for (let i = 0; i < 8; i++) this.parts.push(0); return this; }
  raw(b: Uint8Array | number[]) { for (const x of b) this.parts.push(x); return this; }
  pad4() { while (this.parts.length % 4) this.parts.push(0); return this; }
  get length() { return this.parts.length; }
  done() { return Uint8Array.from(this.parts); }
}

const padded = (b: Uint8Array) => new Bytes().raw(b).pad4().done();

function checksum(data: Uint8Array): number {
  const p = padded(data);
  let sum = 0;
  for (let i = 0; i < p.length; i += 4) sum = (sum + ((p[i]! << 24) | (p[i + 1]! << 16) | (p[i + 2]! << 8) | p[i + 3]!)) >>> 0;
  return sum >>> 0;
}

type BBox = [number, number, number, number];

/** TrueType simple glyph: one clockwise square contour per lit pixel. */
function glyphRecord(rows: string[]): { rec: Uint8Array; bbox: BBox; points: number; contours: number } {
  const contours: [number, number][][] = [];
  rows.forEach((row, r) => [...row].forEach((bit, c) => {
    if (bit !== "1") return;
    const x0 = c * PX, x1 = (c + 1) * PX, y1 = (5 - r) * PX, y0 = y1 - PX;
    contours.push([[x0, y0], [x0, y1], [x1, y1], [x1, y0]]);
  }));
  if (!contours.length) return { rec: new Uint8Array(), bbox: [0, 0, 0, 0], points: 0, contours: 0 };
  const pts = contours.flat();
  const bbox: BBox = [Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))];
  const out = new Bytes().i16(contours.length, ...bbox);
  let end = -1;
  for (const ct of contours) out.u16((end += ct.length));
  out.u16(0).u8(...pts.map(() => 0x01));
  const xs = new Bytes(), ys = new Bytes();
  let px = 0, py = 0;
  for (const [x, y] of pts) { xs.i16(x - px); px = x; ys.i16(y - py); py = y; }
  out.raw(xs.done()).raw(ys.done()).pad4();
  return { rec: out.done(), bbox, points: pts.length, contours: contours.length };
}

function cmapTable(charToGid: Map<number, number>): Uint8Array {
  const codes = [...charToGid.keys()].sort((a, b) => a - b);
  const segs: [number, number, number][] = [...codes.map(c => [c, c, (charToGid.get(c)! - c + 65536) % 65536] as [number, number, number]), [0xffff, 0xffff, 1]];
  const n = segs.length;
  const search = 2 ** (Math.floor(Math.log2(n))) * 2;
  const entry = Math.floor(Math.log2(search / 2));
  const body = new Bytes().u16(n * 2, search, entry, n * 2 - search);
  body.u16(...segs.map(s => s[1])).u16(0).u16(...segs.map(s => s[0])).u16(...segs.map(s => s[2])).u16(...segs.map(() => 0));
  const b = body.done();
  return new Bytes().u16(0, 1).u16(3, 1).u32(12).u16(4, 6 + b.length, 0).raw(b).done();
}

function nameTable(family: string): Uint8Array {
  const names: [number, string][] = [[1, family], [2, "Regular"], [3, `${family} Regular`], [4, family], [6, family.replace(/ /g, "")]];
  const records = new Bytes(), strings = new Bytes();
  for (const [id, text] of names) {
    const data = new Bytes();
    for (const ch of text) data.u16(ch.charCodeAt(0));
    records.u16(3, 1, 0x409, id, data.length, strings.length);
    strings.raw(data.done());
  }
  return new Bytes().u16(0, names.length, 6 + records.length).raw(records.done()).raw(strings.done()).done();
}

const isCapital = (ch: string) => /\p{L}/u.test(ch) && ch.toUpperCase() === ch && ch.toLowerCase() !== ch;

export function buildTtf(glyphs: GlyphList): Uint8Array {
  const chars = glyphs.map(g => g[0]);
  const byChar = new Map(glyphs);
  const order = [".notdef", " ", ...chars];
  const charToGid = new Map<number, number>([[32, 1]]);
  chars.forEach((ch, i) => {
    charToGid.set(ch.codePointAt(0)!, i + 2);
    if (isCapital(ch)) charToGid.set(ch.toLowerCase().codePointAt(0)!, i + 2);   // lowercase shares the capital
  });
  const glyf = new Bytes(), loca = [0], hmtx = new Bytes();
  let maxPts = 0, maxCt = 0;
  let gb: BBox = [EM, EM, 0, 0];
  for (const name of order) {
    const rows = byChar.has(name) ? trim(byChar.get(name)!) : null;
    const g = rows ? glyphRecord(rows) : { rec: new Uint8Array(), bbox: [0, 0, 0, 0] as BBox, points: 0, contours: 0 };
    glyf.raw(g.rec);
    loca.push(glyf.length);
    const width = rows ? rows[0]!.length : 0;
    const advance = name === " " ? SPACE_ADVANCE : rows ? (width + 1) * PX : 400;
    hmtx.u16(advance).i16(g.bbox[0]);
    maxPts = Math.max(maxPts, g.points); maxCt = Math.max(maxCt, g.contours);
    if (g.rec.length) gb = [Math.min(gb[0], g.bbox[0]), Math.min(gb[1], g.bbox[1]), Math.max(gb[2], g.bbox[2]), Math.max(gb[3], g.bbox[3])];
  }
  const n = order.length;
  const codes = [...charToGid.keys()].sort((a, b) => a - b);

  const tables: Record<string, Uint8Array> = {
    head: new Bytes().u32(0x00010000, 0x00010000, 0, 0x5f0f3cf5).u16(0x000b, EM).i64zero().i64zero()
      .i16(...gb).u16(0, 6).i16(2, 1, 0).done(),
    hhea: new Bytes().u32(0x00010000).i16(ASCENT, -DESCENT, 0).u16(400).i16(0, 0, gb[2], 1, 0, 0, 0, 0, 0, 0, 0).u16(n).done(),
    maxp: new Bytes().u32(0x00010000).u16(n, maxPts, maxCt, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0).done(),
    "OS/2": new Bytes().u16(4).i16(400).u16(400, 5, 0)
      .i16(300, 300, 0, 75, 300, 300, 0, 350, 50, 200, 0)
      .u8(2, 0, 6, 9, 0, 0, 0, 0, 0, 0)                                          // panose
      .u32(1, 0, 0, 0).raw([..."SMPL"].map(c => c.charCodeAt(0)))
      .u16(0x40, codes[0]!, Math.min(codes[codes.length - 1]!, 0xffff))
      .i16(ASCENT, -DESCENT, 0).u16(ASCENT, DESCENT).u32(1, 0).i16(500, 500).u16(0, 32, 0).done(),
    hmtx: hmtx.done(),
    cmap: cmapTable(charToGid),
    loca: new Bytes().u32(...loca).done(),
    glyf: glyf.done(),
    name: nameTable("Simplicity Pixel"),
    post: new Bytes().u32(0x00030000, 0).i16(-100, 50).u32(1, 0, 0, 0, 0).done(),
  };

  const tags = Object.keys(tables).sort();
  const num = tags.length;
  const search = 2 ** Math.floor(Math.log2(num)) * 16;
  const header = new Bytes().u32(0x00010000).u16(num, search, Math.floor(Math.log2(search / 16)), num * 16 - search);
  const offset = 12 + 16 * num;
  const directory = new Bytes(), body = new Bytes();
  let headOffset = 0;
  for (const tag of tags) {
    const data = tables[tag]!;
    if (tag === "head") headOffset = offset + body.length;
    directory.raw([...tag].map(c => c.charCodeAt(0))).u32(checksum(data), offset + body.length, data.length);
    body.raw(data).pad4();
  }
  const font = new Bytes().raw(header.done()).raw(directory.done()).raw(body.done()).done();
  // head.checkSumAdjustment makes the whole file sum to 0xB1B0AFBA.
  const adj = (0xb1b0afba - checksum(font)) >>> 0;
  font.set([(adj >>> 24) & 0xff, (adj >>> 16) & 0xff, (adj >>> 8) & 0xff, adj & 0xff], headOffset + 8);
  return font;
}

/** Glyph table for canvas text: each glyph trimmed to its own width. */
export function fontTable(glyphs: GlyphList): PixelFont {
  return Object.fromEntries(glyphs.map(([ch, rows]) => [ch, trim(rows)]));
}
