#!/usr/bin/env python3
"""Reposition eyes/mouth on the existing 80×112 puppet (same character, assets/pixel only)."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent
LAYERS = OUT / "layers"
W, H = 80, 112

EYE_Y = 22  # 4×3 tired eyes at y22–24 (was y26–28)
MOUTH_Y = 34  # closed line (was y39)

OUTLINE = (32, 30, 28, 255)
INK = (18, 16, 14, 255)
SKIN = (236, 214, 196, 255)
LID = (42, 34, 30, 255)
IRIS = (168, 96, 40, 255)
IRIS_DK = (110, 62, 26, 255)
PUPIL = (28, 20, 16, 255)
LIP = (140, 88, 80, 255)
CAVITY = (28, 20, 16, 255)
CAVITY_MID = (48, 28, 28, 255)
MOLE = (92, 64, 52, 255)

IDLE_STACK = [
    "tail.png",
    "clogs.png",
    "pants.png",
    "body-shirt.png",
    "hand.png",
    "head.png",
    "hair.png",
    "ears.png",
    "eyes-open.png",
    "mouth-closed.png",
    "hair-front.png",
]

STACK_SHEET = [
    "tail.png",
    "clogs.png",
    "pants.png",
    "body-shirt.png",
    "hand.png",
    "head.png",
    "hair.png",
    "ears.png",
    "eyes-open.png",
    "eyes-half.png",
    "eyes-closed.png",
    "mouth-closed.png",
    "mouth-open.png",
    "hair-front.png",
]


def load_rgba(path: Path) -> np.ndarray:
    a = np.array(Image.open(path).convert("RGBA"))
    a[:, :, 3] = np.where(a[:, :, 3] >= 128, 255, 0)
    return a


def save_rgba(path: Path, arr: np.ndarray) -> None:
    out = arr.copy()
    out[:, :, 3] = np.where(out[:, :, 3] >= 128, 255, 0)
    Image.fromarray(out).save(path, "PNG")


def put(img: np.ndarray, x: int, y: int, rgba: tuple[int, int, int, int]) -> None:
    if 0 <= x < W and 0 <= y < H:
        img[y, x] = rgba


def paint_eye_open(img: np.ndarray, x0: int, y0: int) -> list[tuple[int, int]]:
    owned: list[tuple[int, int]] = []

    def p(x: int, y: int, c: tuple[int, int, int, int]) -> None:
        put(img, x, y, c)
        owned.append((x, y))

    for x in range(x0, x0 + 4):
        p(x, y0, LID)
        p(x, y0 + 2, LID)
    p(x0, y0 + 1, LID)
    p(x0 + 1, y0 + 1, IRIS)
    p(x0 + 2, y0 + 1, PUPIL)
    p(x0 + 3, y0 + 1, IRIS_DK)
    return owned


def paint_eye_half(x0: int, y0: int) -> dict[tuple[int, int], tuple[int, int, int, int]]:
    pix: dict[tuple[int, int], tuple[int, int, int, int]] = {}
    for x in range(x0, x0 + 4):
        pix[(x, y0)] = LID
        pix[(x, y0 + 1)] = LID
        pix[(x, y0 + 2)] = IRIS_DK if x in (x0 + 1, x0 + 2) else LID
    pix[(x0 + 2, y0 + 2)] = PUPIL
    return pix


def paint_eye_closed(x0: int, y0: int) -> dict[tuple[int, int], tuple[int, int, int, int]]:
    pix: dict[tuple[int, int], tuple[int, int, int, int]] = {}
    for x in range(x0, x0 + 4):
        pix[(x, y0 + 1)] = LID
        pix[(x, y0 + 2)] = LID
    return pix


def paint_mouth_open() -> np.ndarray:
    """7×4 open mouth centered on the face (was oversized 9×5 at the chin)."""
    img = np.zeros((H, W, 4), dtype=np.uint8)
    # x38–44, y33–36
    top = [
        (38, 33, LIP),
        (39, 33, LIP),
        (40, 33, LIP),
        (41, 33, LIP),
        (42, 33, LIP),
        (43, 33, LIP),
        (44, 33, LIP),
    ]
    mid_top = [
        (38, 34, LIP),
        (39, 34, CAVITY),
        (40, 34, CAVITY),
        (41, 34, CAVITY_MID),
        (42, 34, CAVITY),
        (43, 34, CAVITY),
        (44, 34, LIP),
    ]
    mid_bot = [
        (38, 35, LIP),
        (39, 35, CAVITY),
        (40, 35, CAVITY),
        (41, 35, CAVITY),
        (42, 35, CAVITY),
        (43, 35, CAVITY),
        (44, 35, LIP),
    ]
    bot = [
        (39, 36, LIP),
        (40, 36, LIP),
        (41, 36, LIP),
        (42, 36, LIP),
        (43, 36, LIP),
    ]
    for x, y, c in top + mid_top + mid_bot + bot:
        put(img, x, y, c)
    return img


def mouth_open_mask() -> np.ndarray:
    m = np.zeros((H, W), dtype=bool)
    mo = paint_mouth_open()
    m[mo[:, :, 3] == 255] = True
    return m


def mouth_closed_mask() -> np.ndarray:
    m = np.zeros((H, W), dtype=bool)
    m[MOUTH_Y, 39:43] = True
    return m


def composite(names: list[str], layers: dict[str, np.ndarray]) -> np.ndarray:
    out = np.zeros((H, W, 4), dtype=np.uint8)
    for name in names:
        lay = layers[name]
        mask = lay[:, :, 3] == 255
        out[mask] = lay[mask]
    return out


def checker(w: int, h: int, cell: int = 8) -> np.ndarray:
    yy, xx = np.ogrid[:h, :w]
    c = ((xx // cell) + (yy // cell)) % 2
    out = np.zeros((h, w, 4), dtype=np.uint8)
    out[c == 0] = (40, 40, 44, 255)
    out[c == 1] = (28, 28, 32, 255)
    return out


def write_stack_sheet(layers: dict[str, np.ndarray], preview: np.ndarray) -> None:
    k = 3
    cell_w, cell_h = W * k, H * k
    cols = 5
    rows = (len(STACK_SHEET) + 2 + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * (cell_w + 8) + 8, rows * (cell_h + 24) + 8), (18, 18, 20, 255))
    draw = ImageDraw.Draw(sheet)

    def blit(arr: np.ndarray, i: int, label: str) -> None:
        r, c = divmod(i, cols)
        x = 8 + c * (cell_w + 8)
        y = 8 + r * (cell_h + 24)
        bg = Image.fromarray(checker(cell_w, cell_h, 12))
        spr = Image.fromarray(arr).resize((cell_w, cell_h), Image.Resampling.NEAREST)
        bg.paste(spr, (0, 0), spr)
        sheet.paste(bg, (x, y))
        draw.text((x, y + cell_h + 4), label, fill=(220, 220, 220, 255))

    for i, name in enumerate(STACK_SHEET):
        blit(layers[name], i, name.replace(".png", ""))
    blit(composite(IDLE_STACK, layers), len(STACK_SHEET), "composite-idle")
    blit(preview, len(STACK_SHEET) + 1, "preview")
    sheet.save(OUT / "_preview-stack.png", "PNG")


def bbox_px(arr: np.ndarray) -> tuple[int, int, int, int, int]:
    m = arr[:, :, 3] == 255
    ys, xs = np.where(m)
    if len(xs) == 0:
        return 0, 0, 0, 0, 0
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()), int(m.sum())


def main() -> None:
    layers = {p.name: load_rgba(p) for p in sorted(LAYERS.glob("*.png"))}
    head = layers["head.png"].copy()
    hair = layers["hair.png"].copy()
    hair_front = layers["hair-front.png"].copy()

    # Restore skin where the old low mouth sat (y39).
    for x in range(39, 43):
        if head[39, x, 3] == 0:
            put(head, x, 39, OUTLINE if x in (39, 42) else SKIN)

    m_closed = mouth_closed_mask()
    m_open = mouth_open_mask()

    # Head socket: transparent where mouth draws; skin under eyes.
    for y in range(H):
        for x in range(W):
            if m_closed[y, x] or m_open[y, x]:
                head[y, x] = (0, 0, 0, 0)

    for x0 in (31, 43):
        for y in (EYE_Y, EYE_Y + 1, EYE_Y + 2):
            for x in range(x0, x0 + 4):
                put(head, x, y, SKIN)
    put(head, 47, 30, MOLE)

    # Eyes
    eyes_open = np.zeros((H, W, 4), dtype=np.uint8)
    paint_eye_open(eyes_open, 31, EYE_Y)
    paint_eye_open(eyes_open, 43, EYE_Y)

    half_map: dict[tuple[int, int], tuple[int, int, int, int]] = {}
    half_map.update(paint_eye_half(31, EYE_Y))
    half_map.update(paint_eye_half(43, EYE_Y))
    eyes_half = np.zeros((H, W, 4), dtype=np.uint8)
    for (x, y), c in half_map.items():
        eyes_half[y, x] = c

    closed_map: dict[tuple[int, int], tuple[int, int, int, int]] = {}
    closed_map.update(paint_eye_closed(31, EYE_Y))
    closed_map.update(paint_eye_closed(43, EYE_Y))
    eyes_closed = np.zeros((H, W, 4), dtype=np.uint8)
    for (x, y), c in closed_map.items():
        eyes_closed[y, x] = c

    mouth_closed = np.zeros((H, W, 4), dtype=np.uint8)
    for x in range(39, 43):
        put(mouth_closed, x, MOUTH_Y, INK)

    mouth_open = paint_mouth_open()

    # Keep bangs out of the eye band.
    yy, xx = np.ogrid[:H, :W]
    eye_band = (xx >= 30) & (xx <= 46) & (yy >= EYE_Y) & (yy <= EYE_Y + 2)
    for img in (hair, hair_front):
        m = img[:, :, 3] == 255
        img[m & eye_band] = (0, 0, 0, 0)

    layers["head.png"] = head
    layers["hair.png"] = hair
    layers["hair-front.png"] = hair_front
    layers["eyes-open.png"] = eyes_open
    layers["eyes-half.png"] = eyes_half
    layers["eyes-closed.png"] = eyes_closed
    layers["mouth-closed.png"] = mouth_closed
    layers["mouth-open.png"] = mouth_open

    for name, arr in layers.items():
        save_rgba(LAYERS / name, arr)

    preview = composite(IDLE_STACK, layers)
    save_rgba(OUT / "preview.png", preview)
    write_stack_sheet(layers, preview)

    talk_stack = IDLE_STACK.copy()
    talk_stack[talk_stack.index("mouth-closed.png")] = "mouth-open.png"
    talk = composite(talk_stack, layers)

    # QA printout
    hand = layers["hand.png"]
    hm = hand[:, :, 3] == 255
    black = hm & (hand[:, :, 0].astype(int) + hand[:, :, 1] + hand[:, :, 2] == 0)
    hc = (head[:, :, 3] > 0) & (mouth_closed[:, :, 3] > 0)
    hf_cov = (mouth_open[:, :, 3] > 0) & (hair_front[:, :, 3] > 0)
    print("hand rgb0", int(black.sum()))
    print("idle mismatch", int(np.any(composite(IDLE_STACK, layers) != preview, axis=2).sum()))
    print("head cap mouth", int(hc.sum()))
    print("eyes-open", bbox_px(eyes_open))
    print("mouth-closed", bbox_px(mouth_closed))
    print("mouth-open", bbox_px(mouth_open), "visible", int((mouth_open[:, :, 3] > 0).sum() - hf_cov.sum()))
    print("mole", tuple(head[30, 47]))

    # 5× previews for PR
    art = Path("/opt/cursor/artifacts")
    art.mkdir(parents=True, exist_ok=True)
    tmp = Path("/tmp/p-gen")
    tmp.mkdir(exist_ok=True)
    for src, name in ((preview, "preview-5x.png"), (talk, "talk-5x.png")):
        img = Image.fromarray(src).resize((W * 5, H * 5), Image.Resampling.NEAREST)
        img.save(tmp / name)
        img.save(art / name)


if __name__ == "__main__":
    main()
