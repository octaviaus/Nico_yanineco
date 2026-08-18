#!/usr/bin/env python3
"""Slice assets/sprites/idle.png into Live2D layer PNGs.

Same canvas as idle (position locked). No cigarette layer (scheme A:
smoke is particle-only). Expression variants that are not on the sheet
are omitted, not invented.

  python scripts/slice-live2d-layers.py
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation, distance_transform_edt

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "sprites" / "idle.png"
OUT = ROOT / "assets" / "live2d-layers"

OLD = (
    "body.png",
    "cigarette.png",
    "eyes-half.png",
    "eyes-open.png",
    "hand.png",
    "head.png",
    "mouth-closed.png",
    "mouth-open.png",
    "mouth-smoke.png",
    "_debug-face.png",
    "_preview-stack.png",
    "_preview-missing.png",
)


def attach_lines(mask: np.ndarray, is_line: np.ndarray, opaque: np.ndarray, n: int = 2) -> np.ndarray:
    grown = binary_dilation(mask, iterations=n)
    return (mask | (grown & is_line)) & opaque


def save(name: str, rgba: np.ndarray, mask: np.ndarray) -> None:
    out = np.zeros_like(rgba)
    out[mask] = rgba[mask]
    Image.fromarray(out).save(OUT / name, "PNG", optimize=True)
    print(f"  {name:18s}  {int(mask.sum()):7d} px")


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"missing {SRC} — run knockout-sprite.py first")
    OUT.mkdir(parents=True, exist_ok=True)
    for name in OLD:
        p = OUT / name
        if p.exists():
            p.unlink()
            print(f"removed old {name}")

    rgba = np.array(Image.open(SRC).convert("RGBA"))
    h, w = rgba.shape[:2]
    r = rgba[:, :, 0].astype(np.int16)
    g = rgba[:, :, 1].astype(np.int16)
    b = rgba[:, :, 2].astype(np.int16)
    a = rgba[:, :, 3]
    opaque = a > 40
    yy, xx = np.ogrid[:h, :w]
    yn = yy / h
    xn = xx / w

    is_line = opaque & ((r + g + b) < 110)
    is_skin = opaque & ~is_line & (r > 215) & (g > 175) & (b > 155) & ((r - b) > 18)
    is_shirt = opaque & ~is_line & (g >= r - 6) & (r > 210) & (g > 220) & (b > 195) & ((g - b) > 8)
    is_pants = (
        opaque
        & ~is_line
        & ~is_shirt
        & (r < 135)
        & (g < 155)
        & (b < 165)
        & (g > 50)
        & (b >= r - 8)
        & (yn > 0.48)
    )
    is_shoe = (
        opaque
        & ~is_line
        & (yn > 0.86)
        & (r > 120)
        & (r < 215)
        & (g > 110)
        & (g < 205)
        & (b < 155)
        & (np.abs(r - g) < 50)
    )
    is_hair = (
        opaque
        & ~is_line
        & ~is_skin
        & ~is_shirt
        & (g >= r - 10)
        & (g > b)
        & (r > 135)
        & (r < 235)
        & (g < 235)
        & (yn < 0.32)
    )

    clogs = attach_lines(is_shoe | ((yn > 0.90) & opaque & (xn > 0.40) & ~is_pants), is_line, opaque, 2)

    pants = attach_lines(is_pants & (yn > 0.50) & (yn < 0.94) & (xn < 0.86), is_line, opaque, 2)
    pants = pants | (binary_dilation(pants, iterations=6) & opaque & (yn > 0.50) & (yn < 0.62) & is_shirt)

    tail = attach_lines(
        opaque & (yn > 0.55) & (yn < 0.94) & (xn > 0.80) & ~clogs,
        is_line,
        opaque,
        2,
    )

    hand = attach_lines(
        is_skin & (xn < 0.34) & (yn > 0.28) & (yn < 0.64),
        is_line,
        opaque,
        3,
    )
    hand = hand | (binary_dilation(hand, iterations=4) & is_line & opaque)

    ears = attach_lines(is_hair & (yn < 0.095) & (xn > 0.35) & (xn < 0.82), is_line, opaque, 2)
    # inner-ear dark
    ears = ears | attach_lines(
        opaque & (yn < 0.10) & (xn > 0.38) & (xn < 0.80) & (r < 90) & (g < 90),
        is_line,
        opaque,
        1,
    )

    hair_front = attach_lines(
        is_hair & (yn > 0.07) & (yn < 0.20) & (xn > 0.38) & (xn < 0.78),
        is_line,
        opaque,
        2,
    )
    hair = attach_lines(is_hair & ~ears, is_line, opaque, 2)

    head = attach_lines(
        (is_skin | is_hair)
        & (yn < 0.30)
        & (xn > 0.32)
        & ~hand,
        is_line,
        opaque,
        2,
    )
    # neck into collar
    head = head | attach_lines(
        is_skin & (yn > 0.22) & (yn < 0.34) & (xn > 0.38) & (xn < 0.72),
        is_line,
        opaque,
        2,
    )

    shirt = attach_lines(
        is_shirt & (yn > 0.22) & (yn < 0.64) & ~hand,
        is_line,
        opaque,
        2,
    )
    shirt = shirt | (binary_dilation(shirt, iterations=8) & is_skin & (yn > 0.24) & (yn < 0.38) & ~hand)

    eye_l = (yn > 0.126) & (yn < 0.162) & (xn > 0.44) & (xn < 0.53)
    eye_r = (yn > 0.126) & (yn < 0.162) & (xn > 0.57) & (xn < 0.67)
    eyes = attach_lines((eye_l | eye_r) & opaque & ~is_hair, is_line, opaque, 1)

    mouth = attach_lines(
        opaque & (yn > 0.176) & (yn < 0.202) & (xn > 0.54) & (xn < 0.63) & ~is_hair,
        is_line,
        opaque,
        1,
    )

    body = {
        "clogs.png": clogs,
        "pants.png": pants,
        "tail.png": tail,
        "body-shirt.png": shirt,
        "head.png": head,
        "hair.png": hair,
        "hair-front.png": hair_front,
        "ears.png": ears,
        "hand.png": hand,
    }
    leftover = opaque.copy()
    for mask in list(body.values()) + [eyes, mouth]:
        leftover &= ~mask
    dist_stack = np.stack([distance_transform_edt(~mask) for mask in body.values()], axis=0)
    nearest = np.argmin(dist_stack, axis=0)
    for i, name in enumerate(body):
        body[name] = body[name] | (leftover & (nearest == i))
    clogs, pants, tail, shirt, head, hair, hair_front, ears, hand = (
        body["clogs.png"],
        body["pants.png"],
        body["tail.png"],
        body["body-shirt.png"],
        body["head.png"],
        body["hair.png"],
        body["hair-front.png"],
        body["ears.png"],
        body["hand.png"],
    )

    print(f"source {SRC.name} {w}x{h}")
    save("clogs.png", rgba, clogs)
    save("pants.png", rgba, pants)
    save("tail.png", rgba, tail)
    save("body-shirt.png", rgba, shirt)
    save("head.png", rgba, head)
    save("hair.png", rgba, hair)
    save("hair-front.png", rgba, hair_front)
    save("ears.png", rgba, ears)
    save("eyes-open.png", rgba, eyes)
    save("mouth-closed.png", rgba, mouth)
    save("hand.png", rgba, hand)
    print("scheme A: no cigarette.png")


if __name__ == "__main__":
    main()
