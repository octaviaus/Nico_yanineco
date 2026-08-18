#!/usr/bin/env python3
"""Knock out the white paper behind 尼古喵喵角色图/50.webp.

Protects the cream T-shirt (not pure white) and drops the Moegirl watermark
by keeping only the largest opaque component. Writes:

  assets/sprites/idle.png
  assets/sprites/tray.png   (64x64 head + ears)
  assets/sprites/anchor.json  (mouth in texture 0-1, origin top-left)

Re-run after replacing the source sheet:

  python scripts/knockout-sprite.py
"""

from __future__ import annotations

import json
import os
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "尼古喵喵角色图" / "50.webp"
OUT_DIR = ROOT / "assets" / "sprites"
POSES = ("idle", "talk", "inhale", "exhale")


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


def knockout(im: Image.Image) -> Image.Image:
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


def trim(im: Image.Image, pad: int = 8) -> tuple[Image.Image, tuple[int, int, int, int]]:
    bbox = im.getbbox()
    if not bbox:
        raise SystemExit("knockout produced an empty image")
    l, t, r, b = bbox
    l = max(0, l - pad)
    t = max(0, t - pad)
    r = min(im.width, r + pad)
    b = min(im.height, b + pad)
    return im.crop((l, t, r, b)), (l, t, r, b)


def crop_head(im: Image.Image, size: int = 64) -> Image.Image:
    w, h = im.size
    px = im.load()
    band_h = max(8, int(h * 0.36))
    xs: list[int] = []
    ys: list[int] = []
    for y in range(band_h):
        for x in range(w):
            if px[x, y][3] > 40:
                xs.append(x)
                ys.append(y)
    if not xs:
        box = (0, 0, min(w, h), min(w, h))
    else:
        cx = (min(xs) + max(xs)) / 2
        top = max(0, min(ys) - 4)
        side = int(max(max(xs) - min(xs), band_h * 0.9) * 1.08)
        side = max(side, int(h * 0.30))
        left = int(cx - side / 2)
        left = max(0, min(left, w - side))
        if top + side > h:
            top = max(0, h - side)
        if left + side > w:
            left = max(0, w - side)
        box = (left, top, left + side, top + side)
    head = im.crop(box).convert("RGBA")
    return head.resize((size, size), Image.Resampling.LANCZOS)


def estimate_mouth(im: Image.Image) -> dict[str, float]:
    """Mouth sits in the lower face; origin is texture top-left, 0-1."""
    w, h = im.size
    px = im.load()
    face_top = int(h * 0.10)
    face_bot = int(h * 0.32)
    xs: list[int] = []
    for y in range(face_top, face_bot):
        for x in range(w):
            if px[x, y][3] > 80:
                xs.append(x)
    cx = (min(xs) + max(xs)) / 2 / w if xs else 0.50
    # Eyes sit ~0.15 down this sheet; mouth is just below, still on the face.
    mx = round(min(0.70, max(0.45, cx + 0.04)), 3)
    return {
        "mouth": {"x": mx, "y": 0.19},
        "cigarette": {"x": round(min(0.74, mx + 0.06), 3), "y": 0.20},
        "origin": "top-left",
    }


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"missing source: {SRC}")
    print(f"source {SRC} ({SRC.stat().st_size} bytes)")
    keyed, box = trim(knockout(Image.open(SRC)))
    print(f"trimmed {keyed.size} from crop {box}")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    idle = OUT_DIR / "idle.png"
    keyed.save(idle, "PNG", optimize=True)
    print(f"wrote {idle} ({idle.stat().st_size} bytes)")
    for pose in POSES:
        if pose == "idle":
            continue
        dest = OUT_DIR / f"{pose}.png"
        dest.write_bytes(idle.read_bytes())
        print(f"copied idle -> {dest.name}")
    tray = crop_head(keyed)
    tray_path = OUT_DIR / "tray.png"
    tray.save(tray_path, "PNG", optimize=True)
    print(f"wrote {tray_path} {tray.size}")
    anchors = estimate_mouth(keyed)
    anchor_path = OUT_DIR / "anchor.json"
    anchor_path.write_text(json.dumps(anchors, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {anchor_path} {json.dumps(anchors)}")


if __name__ == "__main__":
    os.chdir(ROOT)
    main()
