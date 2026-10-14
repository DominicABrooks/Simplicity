"""Build the Simplicity Pixel font from font/pixel.txt.

Usage: python tools/build_font.py

Outputs:
  game/fonts/simplicity-pixel.ttf  a TrueType font for all HTML text
  game/font.js                     the same glyphs for text drawn on canvas (window.PIXEL_FONT)

Each glyph pixel is a 100x100 square on a 600-unit em, so at font-size 6px one glyph pixel is
exactly one CSS pixel. Use sizes that are multiples of 6 (12, 18, 24, 36) to keep text crisp.
No dependencies: the TrueType tables are written directly with struct.
"""
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PX = 100            # font units per glyph pixel
EM = 600            # 5 rows of glyph + 1 row of headroom
ASCENT, DESCENT = 600, 100
SPACE_ADVANCE = 300


def load_glyphs():
    glyphs = {}
    for line in (ROOT / "font" / "pixel.txt").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        ch, *rows = line.split()
        if len(rows) != 5 or len({len(r) for r in rows}) != 1 or any(set(r) - {"0", "1"} for r in rows):
            raise ValueError(f"Bad glyph line: {line!r}")
        glyphs[ch] = rows
    return glyphs


def trim(rows):
    """Drop empty columns at the left and right (keeps at least one column)."""
    cols = [c for c in range(len(rows[0])) if any(r[c] == "1" for r in rows)]
    if not cols:
        return rows
    return [r[cols[0]:cols[-1] + 1] for r in rows]


def glyph_record(rows):
    """TrueType simple glyph: one clockwise square contour per lit pixel."""
    contours = []
    for r, row in enumerate(rows):
        for c, bit in enumerate(row):
            if bit == "1":
                x0, x1 = c * PX, (c + 1) * PX
                y1 = (5 - r) * PX
                y0 = y1 - PX
                contours.append([(x0, y0), (x0, y1), (x1, y1), (x1, y0)])   # clockwise = filled
    if not contours:
        return b"", (0, 0, 0, 0), 0, 0
    xs = [x for ct in contours for x, _ in ct]
    ys = [y for ct in contours for _, y in ct]
    bbox = (min(xs), min(ys), max(xs), max(ys))
    out = struct.pack(">hhhhh", len(contours), *bbox)
    end = -1
    for ct in contours:
        end += len(ct)
        out += struct.pack(">H", end)
    out += struct.pack(">H", 0)                               # no instructions
    points = [p for ct in contours for p in ct]
    out += bytes([0x01] * len(points))                        # all on-curve, 16-bit deltas
    px = py = 0
    xd, yd = b"", b""
    for x, y in points:
        xd += struct.pack(">h", x - px); px = x
        yd += struct.pack(">h", y - py); py = y
    out += xd + yd
    out += b"\0" * (-len(out) % 4)
    return out, bbox, len(points), len(contours)


def cmap_table(char_to_gid):
    codes = sorted(char_to_gid)
    segs = [(c, c, (char_to_gid[c] - c) % 65536) for c in codes] + [(0xFFFF, 0xFFFF, 1)]
    n = len(segs)
    search = 2 ** (n.bit_length() - 1) * 2
    entry = (search // 2).bit_length() - 1
    body = struct.pack(">HHH", n * 2, search, entry) + struct.pack(">H", n * 2 - search)
    body += b"".join(struct.pack(">H", e) for _, e, _ in segs) + b"\0\0"
    body += b"".join(struct.pack(">H", s) for s, _, _ in segs)
    body += b"".join(struct.pack(">H", d) for _, _, d in segs)
    body += b"\0\0" * n                                        # idRangeOffset
    sub = struct.pack(">HHH", 4, 6 + len(body), 0) + body
    return struct.pack(">HH", 0, 1) + struct.pack(">HHI", 3, 1, 12) + sub


def name_table(family):
    names = {1: family, 2: "Regular", 3: f"{family} Regular", 4: family, 6: family.replace(" ", "")}
    records, strings = b"", b""
    for nid, text in names.items():
        data = text.encode("utf-16-be")
        records += struct.pack(">HHHHHH", 3, 1, 0x409, nid, len(data), len(strings))
        strings += data
    return struct.pack(">HHH", 0, len(names), 6 + len(records)) + records + strings


def checksum(data):
    data += b"\0" * (-len(data) % 4)
    return sum(struct.unpack(f">{len(data) // 4}I", data)) & 0xFFFFFFFF


def build():
    glyphs = load_glyphs()
    # Glyph order: .notdef, space, then every defined character.
    order = [".notdef", " "] + list(glyphs)
    char_to_gid = {32: 1}
    for i, ch in enumerate(glyphs, start=2):
        char_to_gid[ord(ch)] = i
        if ch.isalpha() and ch.upper() == ch and ch.lower() != ch:
            char_to_gid[ord(ch.lower())] = i                 # lowercase shares the capital
    glyf, loca, hmtx = b"", [0], b""
    max_pts = max_ct = 0
    gb = [EM, EM, 0, 0]
    for name in order:
        rows = trim(glyphs[name]) if name in glyphs else None
        rec, bbox, pts, cts = glyph_record(rows) if rows else (b"", (0, 0, 0, 0), 0, 0)
        glyf += rec
        loca.append(len(glyf))
        width = len(rows[0]) if rows else 0
        advance = SPACE_ADVANCE if name == " " else (width + 1) * PX if rows else 400
        hmtx += struct.pack(">Hh", advance, bbox[0])
        max_pts, max_ct = max(max_pts, pts), max(max_ct, cts)
        if rec:
            gb = [min(gb[0], bbox[0]), min(gb[1], bbox[1]), max(gb[2], bbox[2]), max(gb[3], bbox[3])]
    n = len(order)
    codes = sorted(char_to_gid)

    tables = {
        "head": struct.pack(">IIIIHHqqhhhhHHhhh", 0x00010000, 0x00010000, 0, 0x5F0F3CF5, 0x000B, EM, 0, 0,
                            *gb, 0, 6, 2, 1, 0),
        "hhea": struct.pack(">IhhhHhhhhhhhhhhhH", 0x00010000, ASCENT, -DESCENT, 0, 400, 0, 0, gb[2], 1, 0, 0,
                            0, 0, 0, 0, 0, n),
        "maxp": struct.pack(">IHHHHHHHHHHHHHH", 0x00010000, n, max_pts, max_ct, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0),
        "OS/2": struct.pack(">HhHHH10hh10B4I4sHHHhhhHHIIhhHHH", 4, 400, 400, 5, 0,
                            300, 300, 0, 75, 300, 300, 0, 350, 50, 200, 0,
                            2, 0, 6, 9, 0, 0, 0, 0, 0, 0,                  # panose (10 bytes)
                            1, 0, 0, 0, b"SMPL", 0x40, codes[0], min(codes[-1], 0xFFFF),
                            ASCENT, -DESCENT, 0, ASCENT, DESCENT, 1, 0, 500, 500, 0, 32, 0),
        "hmtx": hmtx,
        "cmap": cmap_table(char_to_gid),
        "loca": b"".join(struct.pack(">I", o) for o in loca),
        "glyf": glyf,
        "name": name_table("Simplicity Pixel"),
        "post": struct.pack(">IIhhIIIII", 0x00030000, 0, -100, 50, 1, 0, 0, 0, 0),
    }

    tags = sorted(tables)
    num = len(tags)
    search = 2 ** (num.bit_length() - 1) * 16
    header = struct.pack(">IHHHH", 0x00010000, num, search, (search // 16).bit_length() - 1, num * 16 - search)
    offset = 12 + 16 * num
    directory, body = b"", b""
    for tag in tags:
        data = tables[tag]
        directory += struct.pack(">4sIII", tag.encode(), checksum(data), offset + len(body), len(data))
        body += data + b"\0" * (-len(data) % 4)
    font = bytearray(header + directory + body)
    # head.checkSumAdjustment makes the whole file sum to 0xB1B0AFBA.
    head_offset = offset + sum(len(tables[t]) + (-len(tables[t]) % 4) for t in tags[:tags.index("head")])
    struct.pack_into(">I", font, head_offset + 8, (0xB1B0AFBA - checksum(bytes(font))) & 0xFFFFFFFF)

    out = ROOT / "game" / "fonts"
    out.mkdir(parents=True, exist_ok=True)
    (out / "simplicity-pixel.ttf").write_bytes(bytes(font))
    js = {ch: trim(rows) for ch, rows in glyphs.items()}
    (ROOT / "game" / "font.js").write_text(
        "// Generated by tools/build_font.py from font/pixel.txt. Do not edit.\n"
        "// Each glyph is 5 rows (top to bottom) of 0/1 strings, trimmed to its own width.\n"
        "window.PIXEL_FONT = " + json.dumps(js, ensure_ascii=False) + ";\n", encoding="utf-8")
    print(f"Built Simplicity Pixel: {len(glyphs)} glyphs, {len(font)} bytes")


if __name__ == "__main__":
    build()
