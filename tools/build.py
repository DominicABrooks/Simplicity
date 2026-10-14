"""Build Simplicity sprites from art/*.txt.

Usage: python tools/build.py

Outputs to build/:
  <name>.png           raw game sheet, 8px cells, one row per animation, no outline
  <name>_<anim>.gif    outlined preview at 10x
  contact_sheet.png    every frame of every sprite plus the palette, at 6x
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CELL = 8
PREVIEW = 10
SHEET_SCALE = 6
BG = (34, 32, 44, 255)
OUTLINE = (0, 0, 0, 255)


def load_palette():
    pal, no_outline = {}, set()
    for line in (ROOT / "palette" / "simplicity.txt").read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        char, hexcode, name, *flags = line.split()
        h = hexcode.lstrip("#")
        pal[char] = (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)
        if "nooutline" in flags:
            no_outline.add(char)
    return pal, no_outline


def load_sprite(path, pal):
    """Return {anim: (ms, [frame rows])} in file order."""
    anims, current, frame = {}, None, []

    def flush():
        nonlocal frame
        if frame:
            if current is None:
                raise ValueError(f"{path.name}: frame before any @anim line")
            if len(frame) != CELL:
                raise ValueError(f"{path.name} @{current}: frame has {len(frame)} rows, needs {CELL}")
            if len({len(r) for r in frame}) != 1 or len(frame[0]) % CELL:
                raise ValueError(f"{path.name} @{current}: rows must share a width that is a multiple of {CELL}")
            for r in frame:
                bad = set(r) - set(pal) - {"."}
                if bad:
                    raise ValueError(f"{path.name} @{current}: unknown palette chars {sorted(bad)}")
            anims[current][1].append(frame)
            frame = []

    for raw in path.read_text().splitlines():
        line = raw.strip()
        if line.startswith("#"):
            continue
        if line.startswith("@"):
            flush()
            name, ms = line[1:].split()
            current = name
            anims[current] = (int(ms), [])
        elif not line:
            flush()
        else:
            frame.append(line)
    flush()
    return anims


def raw_image(rows, pal):
    img = Image.new("RGBA", (len(rows[0]), len(rows)), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, c in enumerate(row):
            if c != ".":
                img.putpixel((x, y), pal[c])
    return img


def outlined_image(rows, pal, no_outline):
    """Pad 1px and outline solid pixels in black (4-neighbour), as the game renders them."""
    w, h = len(rows[0]), len(rows)
    solid = lambda x, y: 0 <= x < w and 0 <= y < h and rows[y][x] != "." and rows[y][x] not in no_outline
    img = Image.new("RGBA", (w + 2, h + 2), (0, 0, 0, 0))
    for y in range(-1, h + 1):
        for x in range(-1, w + 1):
            c = rows[y][x] if 0 <= x < w and 0 <= y < h else "."
            if c != ".":
                img.putpixel((x + 1, y + 1), pal[c])
            elif any(solid(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                img.putpixel((x + 1, y + 1), OUTLINE)
    return img


def scale(img, k):
    return img.resize((img.width * k, img.height * k), Image.NEAREST)


def build():
    pal, no_outline = load_palette()
    out = ROOT / "build"
    out.mkdir(exist_ok=True)
    sprites = {p.stem: load_sprite(p, pal) for p in sorted((ROOT / "art").glob("*.txt"))}

    for name, anims in sprites.items():
        width = max(sum(len(f[0]) for f in frames) for _, frames in anims.values())
        sheet = Image.new("RGBA", (width, CELL * len(anims)), (0, 0, 0, 0))
        for r, (anim, (ms, frames)) in enumerate(anims.items()):
            x = 0
            for f in frames:
                sheet.paste(raw_image(f, pal), (x, r * CELL))
                x += len(f[0])
            ims = [outlined_image(f, pal, no_outline) for f in frames]
            w = max(i.width for i in ims)
            gif = []
            for im in ims:
                c = Image.new("RGBA", (w, im.height), BG)
                c.alpha_composite(im)
                gif.append(scale(c, PREVIEW).convert("P", palette=Image.ADAPTIVE))
            gif[0].save(out / f"{name}_{anim}.gif", save_all=True, append_images=gif[1:], duration=ms, loop=0)
        sheet.save(out / f"{name}.png")

    # Contact sheet: one row per animation, then the palette.
    rows = [[outlined_image(f, pal, no_outline) for f in frames]
            for anims in sprites.values() for _, frames in anims.values()]
    swatches = [c for c in pal if c not in no_outline]
    width = max(max(sum(i.width + 2 for i in r) for r in rows), len(swatches) * 6) + 2
    height = len(rows) * (CELL + 4) + 8
    sheet = Image.new("RGBA", (width, height), BG)
    for r, ims in enumerate(rows):
        x = 2
        for im in ims:
            sheet.alpha_composite(im, (x, 2 + r * (CELL + 4)))
            x += im.width + 2
    y = len(rows) * (CELL + 4) + 2
    for i, c in enumerate(swatches):
        sheet.paste(Image.new("RGBA", (5, 5), pal[c]), (2 + i * 6, y))
    scale(sheet, SHEET_SCALE).save(out / "contact_sheet.png")
    print(f"Built {len(sprites)} sprites into {out}")


if __name__ == "__main__":
    build()
