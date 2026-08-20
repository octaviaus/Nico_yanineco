#!/usr/bin/env python3
"""Assemble a Codex/PetDex 8x11 v2 spritesheet from generated row strips.

Reads magenta-keyed strips under petdex/ref/_gen/ and writes ONLY:
  petdex/niko-miao/pet.json
  petdex/niko-miao/spritesheet.webp
  petdex/niko-miao/spritesheet.png
  petdex/niko-miao.zip
  petdex/qa/*

Does not modify apps/, packages/, assets/, scripts/, or 尼古喵喵角色图/.
"""

from __future__ import annotations

import json
import sys
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from prepare_ref import CELL_H, CELL_W, checkerboard, knockout_magenta  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
GEN = ROOT / "petdex" / "ref" / "_gen"
PACK = ROOT / "petdex" / "niko-miao"
QA = ROOT / "petdex" / "qa"

COLS = 8
ROWS = 11
ATLAS_W = COLS * CELL_W  # 1536
ATLAS_H = ROWS * CELL_H  # 2288
MARGIN = 10
SPRITE_VERSION = 2

# Row index, state name, expected frames, source file, vertical mode.
ROWS_SPEC: list[tuple[int, str, int, str, str]] = [
    (0, "idle", 6, "petdex-row-idle.png", "feet"),
    (1, "running-right", 8, "petdex-row-running-right.png", "feet"),
    (2, "running-left", 8, "petdex-row-running-left.png", "feet"),
    (3, "waving", 4, "petdex-row-waving.png", "feet"),
    (4, "jumping", 5, "petdex-row-jumping.png", "jump"),
    (5, "failed", 8, "petdex-row-failed.png", "feet"),
    (6, "waiting", 6, "petdex-row-waiting.png", "feet"),
    (7, "running", 6, "petdex-row-running.png", "feet"),
    (8, "review", 6, "petdex-row-review.png", "feet"),
    (9, "look-directions-a", 8, "petdex-row-look-a.png", "feet"),
    (10, "look-directions-b", 8, "petdex-row-look-b.png", "feet"),
]


def _components(im: Image.Image) -> list[list[int]]:
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    comps: list[list[int]] = []
    for start in range(w * h):
        if seen[start]:
            continue
        x0, y0 = start % w, start // w
        if px[x0, y0][3] <= 10:
            seen[start] = 1
            continue
        stack = [start]
        seen[start] = 1
        comp = [start]
        while stack:
            i = stack.pop()
            x, y = i % w, i // w
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, -1), (-1, 1), (1, 1)):
                nx, ny = x + dx, y + dy
                if nx < 0 or ny < 0 or nx >= w or ny >= h:
                    continue
                j = ny * w + nx
                if seen[j]:
                    continue
                if px[nx, ny][3] <= 10:
                    seen[j] = 1
                    continue
                seen[j] = 1
                stack.append(j)
                comp.append(j)
        comps.append(comp)
    return comps


def _crop_from_pixels(im: Image.Image, pixels: list[int]) -> tuple[Image.Image, int, int, int, int]:
    w, h = im.size
    px = im.load()
    xs = [i % w for i in pixels]
    ys = [i // w for i in pixels]
    l, t, r, b = min(xs), min(ys), max(xs) + 1, max(ys) + 1
    keep = set(pixels)
    out = Image.new("RGBA", (r - l, b - t), (0, 0, 0, 0))
    opx = out.load()
    for i in keep:
        x, y = i % w, i // w
        opx[x - l, y - t] = px[x, y]
    return out, l, t, r, b


def split_columns(im: Image.Image, count: int) -> list[tuple[Image.Image, int, int]]:
    """Cut whole characters out of a magenta strip (no mid-body column slice)."""
    keyed = knockout_magenta(im)
    w, h = keyed.size
    comps = _components(keyed)
    if not comps:
        return []
    comps.sort(key=len, reverse=True)
    thresh = max(400, int(len(comps[0]) * 0.18))
    kept = [c for c in comps if len(c) >= thresh]
    # Merge fragments that sit in the same vertical column (ear / tail / puff).
    boxes: list[dict] = []
    for c in kept:
        xs = [i % w for i in c]
        ys = [i // w for i in c]
        boxes.append(
            {
                "pix": c,
                "l": min(xs),
                "r": max(xs) + 1,
                "t": min(ys),
                "b": max(ys) + 1,
                "cx": (min(xs) + max(xs)) / 2,
            }
        )
    boxes.sort(key=lambda b: b["cx"])
    merged: list[dict] = []
    for b in boxes:
        if merged and abs(b["cx"] - merged[-1]["cx"]) < w / (count * 1.6):
            m = merged[-1]
            m["pix"].extend(b["pix"])
            m["l"], m["r"] = min(m["l"], b["l"]), max(m["r"], b["r"])
            m["t"], m["b"] = min(m["t"], b["t"]), max(m["b"], b["b"])
            m["cx"] = (m["l"] + m["r"]) / 2
        else:
            merged.append(b)
    if len(merged) > count:
        merged = sorted(merged, key=lambda b: len(b["pix"]), reverse=True)[:count]
    merged.sort(key=lambda b: b["cx"])
    out: list[tuple[Image.Image, int, int]] = []
    for b in merged:
        sprite, _l, t, _r, bot = _crop_from_pixels(keyed, b["pix"])
        bb = sprite.getbbox()
        if not bb:
            continue
        sprite = sprite.crop(bb)
        out.append((sprite, t, bot))
    return out


def place_feet(sprite: Image.Image) -> Image.Image:
    cell = Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))
    sw, sh = sprite.size
    inner_w, inner_h = CELL_W - MARGIN * 2, CELL_H - MARGIN * 2
    scale = min(inner_w / sw, inner_h / sh)
    nw, nh = max(1, int(round(sw * scale))), max(1, int(round(sh * scale)))
    scaled = sprite.resize((nw, nh), Image.Resampling.NEAREST)
    x = (CELL_W - nw) // 2
    y = CELL_H - MARGIN - nh
    cell.alpha_composite(scaled, (x, y))
    return cell


def place_jump_row(parts: list[tuple[Image.Image, int, int]]) -> list[Image.Image]:
    if not parts:
        return []
    max_h = max(im.size[1] for im, _, _ in parts)
    max_w = max(im.size[0] for im, _, _ in parts)
    ground = max(bot for _, _, bot in parts)
    ceiling = min(top for _, top, _ in parts)
    span = max(ground - ceiling, max_h)
    inner_w, inner_h = CELL_W - MARGIN * 2, CELL_H - MARGIN * 2
    scale = min(inner_w / max_w, inner_h / span, inner_h / max_h)
    cells: list[Image.Image] = []
    for sprite, _top, bot in parts:
        sw, sh = sprite.size
        nw, nh = max(1, int(round(sw * scale))), max(1, int(round(sh * scale)))
        scaled = sprite.resize((nw, nh), Image.Resampling.NEAREST)
        lift = (ground - bot) * scale
        x = (CELL_W - nw) // 2
        y = int(round(CELL_H - MARGIN - nh - lift))
        y = max(2, min(y, CELL_H - nh - 2))
        cell = Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))
        cell.alpha_composite(scaled, (x, y))
        cells.append(cell)
    return cells


def row_cells(src: Path, count: int, mode: str) -> list[Image.Image]:
    im = Image.open(src)
    parts = split_columns(im, count)
    if len(parts) < count:
        print(f"  warn {src.name}: expected {count} sprites, got {len(parts)}")
    if mode == "jump":
        return place_jump_row(parts)
    return [place_feet(sprite) for sprite, _, _ in parts]


def atlas_from_rows(rows: list[list[Image.Image]]) -> Image.Image:
    atlas = Image.new("RGBA", (ATLAS_W, ATLAS_H), (0, 0, 0, 0))
    for r, frames in enumerate(rows):
        for c, frame in enumerate(frames[:COLS]):
            atlas.alpha_composite(frame, (c * CELL_W, r * CELL_H))
    return atlas


def draw_guides(atlas: Image.Image) -> Image.Image:
    preview = checkerboard(atlas, cell=16)
    draw = ImageDraw.Draw(preview)
    for c in range(COLS + 1):
        x = c * CELL_W
        draw.line((x, 0, x, ATLAS_H), fill=(80, 80, 90, 180))
    for r in range(ROWS + 1):
        y = r * CELL_H
        draw.line((0, y, ATLAS_W, y), fill=(80, 80, 90, 180))
    labels = [name for _, name, *_ in ROWS_SPEC]
    for r, name in enumerate(labels):
        draw.text((6, r * CELL_H + 4), f"{r} {name}", fill=(20, 20, 24, 255))
    return preview


def write_pet_json(path: Path) -> None:
    pet = {
        "id": "niko-miao",
        "displayName": "尼古喵喵",
        "description": "A sleepy cat-eared girl in an oversized tee who smokes and watches you code.",
        "spritesheetPath": "spritesheet.webp",
        "spriteVersionNumber": SPRITE_VERSION,
    }
    path.write_text(json.dumps(pet, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_zip(pack: Path) -> Path:
    zpath = pack.parent / "niko-miao.zip"
    with zipfile.ZipFile(zpath, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.write(pack / "pet.json", "pet.json")
        zf.write(pack / "spritesheet.webp", "spritesheet.webp")
    return zpath


def write_preview_gifs(rows: list[list[Image.Image]], qa: Path) -> None:
    previews = {
        "idle": (0, 110),
        "waving": (3, 140),
        "jumping": (4, 120),
        "look-a": (9, 160),
    }
    for name, (idx, ms) in previews.items():
        palettes = [checkerboard(f, cell=8).convert("RGB") for f in rows[idx]]
        if not palettes:
            continue
        palettes[0].save(
            qa / f"preview-{name}.gif",
            save_all=True,
            append_images=palettes[1:],
            duration=ms,
            loop=0,
        )


def validate(atlas: Image.Image, rows: list[list[Image.Image]]) -> None:
    if atlas.size != (ATLAS_W, ATLAS_H):
        raise SystemExit(f"atlas size {atlas.size}, expected {(ATLAS_W, ATLAS_H)}")
    for i, ((_, name, expected, _, _), frames) in enumerate(zip(ROWS_SPEC, rows)):
        if len(frames) < 1:
            raise SystemExit(f"row {i} {name} is empty")
        if len(frames) < expected:
            print(f"  warn row {name}: {len(frames)}/{expected} frames")
        for f in frames:
            if f.size != (CELL_W, CELL_H):
                raise SystemExit(f"frame size {f.size} in {name}")
            if f.getbbox() is None:
                raise SystemExit(f"empty frame in {name}")
    print(f"atlas {atlas.size} rows={[len(r) for r in rows]}")


def main() -> None:
    PACK.mkdir(parents=True, exist_ok=True)
    QA.mkdir(parents=True, exist_ok=True)
    (QA / "frames").mkdir(exist_ok=True)

    assembled: list[list[Image.Image]] = []
    for idx, name, count, filename, mode in ROWS_SPEC:
        src = GEN / filename
        if not src.exists():
            raise SystemExit(f"missing strip: {src}")
        print(f"row {idx} {name} <- {filename}")
        frames = row_cells(src, count, mode)
        assembled.append(frames)
        for i, frame in enumerate(frames):
            frame.save(QA / "frames" / f"{idx:02d}-{name}-{i}.png", "PNG")

    atlas = atlas_from_rows(assembled)
    validate(atlas, assembled)

    png_path = PACK / "spritesheet.png"
    webp_path = PACK / "spritesheet.webp"
    atlas.save(png_path, "PNG", optimize=True)
    atlas.save(webp_path, "WEBP", lossless=True, quality=100)
    draw_guides(atlas).save(QA / "contact-sheet.png", "PNG", optimize=True)
    checkerboard(atlas, cell=16).save(QA / "spritesheet-preview.png", "PNG", optimize=True)
    write_pet_json(PACK / "pet.json")
    write_preview_gifs(assembled, QA)
    zpath = write_zip(PACK)

    print(f"wrote {PACK}")
    for p in sorted(PACK.iterdir()):
        extra = ""
        if p.suffix.lower() in {".png", ".webp"}:
            extra = str(Image.open(p).size)
        print(f"  {p.name:24s} {p.stat().st_size:8d}  {extra}")
    print(f"zip {zpath} ({zpath.stat().st_size} bytes)")
    print(f"qa contact {QA / 'contact-sheet.png'}")


if __name__ == "__main__":
    main()
