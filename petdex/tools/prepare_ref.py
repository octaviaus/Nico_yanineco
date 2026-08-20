#!/usr/bin/env python3
"""Prepare PetDex reference art from the official 尼古喵喵 sheet.

Reads original-project files and writes ONLY under petdex/ref/.
Does not modify assets/, 尼古喵喵角色图/, scripts/, or any app code.
"""

from __future__ import annotations

import json
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SRC_OFFICIAL = ROOT / "尼古喵喵角色图" / "50.webp"
SRC_PIXEL = ROOT / "尼古喵喵角色图" / "nico_miaomiao_transparent.png"
OUT = ROOT / "petdex" / "ref"
GEN_CHIBI = OUT / "_gen" / "chibi-idle-src.png"

CELL_W, CELL_H = 192, 208
PAD = 8


def is_paper(r: int, g: int, b: int) -> bool:
    mn, mx = min(r, g, b), max(r, g, b)
    return mn >= 245 and (mx - mn) <= 12


def flood_paper(im: Image.Image) -> bytearray:
    w, h = im.size
    px = im.load()
    bg = bytearray(w * h)
    q: deque[tuple[int, int]] = deque()

    def try_push(x: int, y: int) -> None:
        if x < 0 or y < 0 or x >= w or y >= h:
            return
        i = y * w + x
        if bg[i]:
            return
        r, g, b, _a = px[x, y]
        if not is_paper(r, g, b):
            return
        bg[i] = 1
        q.append((x, y))

    for x in range(w):
        try_push(x, 0)
        try_push(x, h - 1)
    for y in range(h):
        try_push(0, y)
        try_push(w - 1, y)

    while q:
        x, y = q.popleft()
        try_push(x - 1, y)
        try_push(x + 1, y)
        try_push(x, y - 1)
        try_push(x, y + 1)
    return bg


def keep_largest(alpha_ok: list[bool], w: int, h: int) -> list[bool]:
    n = w * h
    seen = bytearray(n)
    best: list[int] = []
    for start in range(n):
        if not alpha_ok[start] or seen[start]:
            continue
        stack = [start]
        seen[start] = 1
        comp = [start]
        while stack:
            i = stack.pop()
            x, y = i % w, i // w
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if nx < 0 or ny < 0 or nx >= w or ny >= h:
                    continue
                j = ny * w + nx
                if seen[j] or not alpha_ok[j]:
                    continue
                seen[j] = 1
                stack.append(j)
                comp.append(j)
        if len(comp) > len(best):
            best = comp
    keep = [False] * n
    for i in best:
        keep[i] = True
    return keep


def knockout_white(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    bg = flood_paper(im)
    keep_src = [bg[i] == 0 for i in range(w * h)]
    keep = keep_largest(keep_src, w, h)
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    opx = out.load()
    for y in range(h):
        for x in range(w):
            i = y * w + x
            r, g, b, _a = px[x, y]
            if not keep[i]:
                continue
            mn, mx = min(r, g, b), max(r, g, b)
            chroma = mx - mn
            if chroma <= 18 and mn >= 228:
                t = (mn - 228) / 27.0
                alpha = max(0, min(255, int(255 * (1.0 - t * 0.92))))
            else:
                alpha = 255
            if alpha <= 8:
                continue
            opx[x, y] = (r, g, b, alpha)
    return out


def trim(im: Image.Image, pad: int = PAD) -> Image.Image:
    bbox = im.getbbox()
    if not bbox:
        raise SystemExit("knockout produced an empty image")
    l, t, r, b = bbox
    l = max(0, l - pad)
    t = max(0, t - pad)
    r = min(im.width, r + pad)
    b = min(im.height, b + pad)
    return im.crop((l, t, r, b))


def checkerboard(im: Image.Image, cell: int = 16) -> Image.Image:
    w, h = im.size
    board = Image.new("RGBA", (w, h))
    draw = ImageDraw.Draw(board)
    light, dark = (210, 210, 214, 255), (160, 160, 168, 255)
    for y in range(0, h, cell):
        for x in range(0, w, cell):
            draw.rectangle(
                (x, y, x + cell - 1, y + cell - 1),
                fill=light if ((x // cell) + (y // cell)) % 2 == 0 else dark,
            )
    board.alpha_composite(im)
    return board


def fit_cell(im: Image.Image, cell_w: int = CELL_W, cell_h: int = CELL_H, resample=Image.Resampling.LANCZOS) -> Image.Image:
    """Contain-fit a full-body sprite into one PetDex cell with transparent padding."""
    im = im.convert("RGBA")
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    src_w, src_h = im.size
    margin = 10
    inner_w, inner_h = cell_w - margin * 2, cell_h - margin * 2
    scale = min(inner_w / src_w, inner_h / src_h)
    new_w = max(1, int(round(src_w * scale)))
    new_h = max(1, int(round(src_h * scale)))
    scaled = im.resize((new_w, new_h), resample)
    canvas = Image.new("RGBA", (cell_w, cell_h), (0, 0, 0, 0))
    x = (cell_w - new_w) // 2
    y = cell_h - margin - new_h  # feet toward the bottom of the cell
    canvas.alpha_composite(scaled, (x, y))
    return canvas


def copy_pixel_idle(src: Path) -> Image.Image:
    im = Image.open(src).convert("RGBA")
    return trim(im, pad=4)


def is_magenta_key(r: int, g: int, b: int) -> bool:
    """Chroma-key near #FF00FF without eating pink inner-ear / skin pixels."""
    return g < 52 and r > 150 and b > 140 and r > g + 80 and b > g + 80


def knockout_magenta(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    opx = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if is_magenta_key(r, g, b):
                continue
            # Soft fringe: magenta-tinted pixels near the key lose alpha.
            if g < 90 and r > 160 and b > 140 and r > g + 40:
                t = min(1.0, (90 - g) / 90.0)
                a = int(a * (1.0 - t * 0.85))
                if a <= 8:
                    continue
            opx[x, y] = (r, g, b, a)
    return out


def crop_face(im: Image.Image) -> Image.Image:
    bbox = im.getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    body = im.crop((l, t, r, b))
    fh = max(1, int(body.height * 0.32))
    face = body.crop((0, 0, body.width, fh))
    return trim(face, pad=4)


def scale_to_height(im: Image.Image, height: int) -> Image.Image:
    w, h = im.size
    nw = max(1, int(round(w * height / h)))
    return im.resize((nw, height), Image.Resampling.LANCZOS)


def collage(panels: list[tuple[str, Image.Image]], panel_h: int = 640) -> Image.Image:
    gap = 16
    margin = 20
    label_h = 28
    scaled: list[tuple[str, Image.Image]] = [(name, scale_to_height(im, panel_h)) for name, im in panels]
    total_w = margin * 2 + gap * (len(scaled) - 1) + sum(im.width for _, im in scaled)
    total_h = margin * 2 + label_h + panel_h
    canvas = Image.new("RGBA", (total_w, total_h), (36, 36, 40, 255))
    draw = ImageDraw.Draw(canvas)
    x = margin
    y = margin + label_h
    for name, im in scaled:
        board = checkerboard(im, cell=12)
        canvas.alpha_composite(board, (x, y))
        draw.text((x, margin + 6), name, fill=(230, 230, 230, 255))
        x += im.width + gap
    return canvas


def write_identity(
    out_dir: Path,
    official: Image.Image,
    pixel: Image.Image,
    cell: Image.Image,
    chibi: Image.Image | None,
    chibi_cell: Image.Image | None,
) -> None:
    identity = {
        "id": "niko-miao",
        "displayName": "尼古喵喵",
        "role": "petdex-ref-only",
        "note": "Isolated PetDex export. Original app assets and code are not modified.",
        "sources": {
            "official_white": "尼古喵喵角色图/50.webp",
            "official_pixel": "尼古喵喵角色图/nico_miaomiao_transparent.png",
            "truth": "official-sheet.png is the knockout of 50.webp and is the identity lock. The chibi idle is a PetDex-proportion derivative, not a replacement of the official sheet.",
        },
        "outputs": {
            "official_sheet": "petdex/ref/official-sheet.png",
            "pixel_idle": "petdex/ref/pixel-idle.png",
            "chibi_idle": "petdex/ref/petdex-canonical-idle.png",
            "chibi_cell": "petdex/ref/petdex-canonical-idle-192x208.png",
            "identity_sheet": "petdex/ref/identity-sheet.png",
        },
        "petdex_cell": {"width": CELL_W, "height": CELL_H},
        "sizes": {
            "official_sheet": list(official.size),
            "pixel_idle": list(pixel.size),
            "official_in_cell": list(cell.size),
            "chibi_idle": list(chibi.size) if chibi else None,
            "chibi_in_cell": list(chibi_cell.size) if chibi_cell else None,
        },
        "identity_lock": {
            "hair": "messy sage/grey-green pixie #9aa392, uneven bangs",
            "ears": "cat ears same color as hair, darker tips",
            "eyes": "lazy half-lidded amber/brown",
            "mole": "under the character's left eye (viewer's right)",
            "shirt": "oversized cream/off-white V-neck tee #efe6d8",
            "pants": "baggy slate trousers #4a5560 pooling at ankles",
            "shoes": "olive clogs #6b7348",
            "tail": "thin dark grey, behind the left hip",
            "pose": "front idle, right hand slightly out, left hand in pocket",
            "do_not": [
                "do not substitute a generic cat or wolf",
                "do not draw a cigarette into the body",
                "do not antialias pixel derivatives",
                "do not crop off the feet or ears",
                "do not modify original-project files",
            ],
        },
        "next": "Generate 9 PetDex animation rows from these refs; do not edit original project files.",
    }
    (out_dir / "identity.json").write_text(
        json.dumps(identity, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    if not SRC_OFFICIAL.exists():
        raise SystemExit(f"missing official sheet: {SRC_OFFICIAL}")
    if not SRC_PIXEL.exists():
        raise SystemExit(f"missing pixel idle: {SRC_PIXEL}")

    OUT.mkdir(parents=True, exist_ok=True)

    official = trim(knockout_white(Image.open(SRC_OFFICIAL)))
    official.save(OUT / "official-sheet.png", "PNG", optimize=True)
    checkerboard(official).save(OUT / "official-sheet-preview.png", "PNG", optimize=True)
    face = crop_face(official)
    face.save(OUT / "official-face.png", "PNG", optimize=True)
    checkerboard(face, cell=8).save(OUT / "official-face-preview.png", "PNG", optimize=True)

    pixel = copy_pixel_idle(SRC_PIXEL)
    pixel.save(OUT / "pixel-idle.png", "PNG", optimize=True)
    checkerboard(pixel).save(OUT / "pixel-idle-preview.png", "PNG", optimize=True)

    cell = fit_cell(official)
    cell.save(OUT / "cell-fit-192x208.png", "PNG", optimize=True)
    checkerboard(cell, cell=8).save(OUT / "cell-fit-192x208-preview.png", "PNG", optimize=True)

    cell_px = fit_cell(pixel, resample=Image.Resampling.NEAREST)
    cell_px.save(OUT / "cell-fit-pixel-192x208.png", "PNG")
    checkerboard(cell_px, cell=8).save(OUT / "cell-fit-pixel-192x208-preview.png", "PNG", optimize=True)

    chibi = None
    chibi_cell = None
    if GEN_CHIBI.exists():
        chibi = trim(knockout_magenta(Image.open(GEN_CHIBI)))
        chibi.save(OUT / "petdex-canonical-idle.png", "PNG", optimize=True)
        checkerboard(chibi).save(OUT / "petdex-canonical-idle-preview.png", "PNG", optimize=True)
        chibi_cell = fit_cell(chibi, resample=Image.Resampling.NEAREST)
        chibi_cell.save(OUT / "petdex-canonical-idle-192x208.png", "PNG")
        checkerboard(chibi_cell, cell=8).save(
            OUT / "petdex-canonical-idle-192x208-preview.png", "PNG", optimize=True
        )

    panels: list[tuple[str, Image.Image]] = [
        ("1 official (truth)", official),
        ("2 pixel idle", pixel),
    ]
    if chibi is not None:
        panels.append(("3 petdex chibi", chibi))
    if chibi_cell is not None:
        panels.append(("4 192x208 cell", chibi_cell))
    else:
        panels.append(("3 official in cell", cell))
    sheet = collage(panels)
    sheet.save(OUT / "identity-sheet.png", "PNG", optimize=True)

    write_identity(OUT, official, pixel, cell, chibi, chibi_cell)

    print(f"wrote {OUT}")
    for p in sorted(OUT.rglob("*")):
        if p.is_file():
            size = ""
            if p.suffix.lower() in {".png", ".webp"}:
                size = str(Image.open(p).size)
            print(f"  {p.relative_to(OUT)!s:48s} {p.stat().st_size:8d}  {size}")


if __name__ == "__main__":
    main()
