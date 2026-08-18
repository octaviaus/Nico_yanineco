#!/usr/bin/env python3
"""P-Gen: turn the AI pixel-style render into 80×112 aligned layers.

Does NOT shrink the official sheet. Source is the image-model output
(niko-pixel-gen-b.png), chroma-keyed, box-downsampled, palette-snapped,
then split on the same 80×112 canvas.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
LAYERS = OUT / "layers"

# Image-model output (not the official sheet).
SRC_CANDIDATES = [
    Path("/opt/cursor/artifacts/assets/niko-pixel-gen-b.png"),
    Path("/tmp/p-gen/niko-pixel-gen-b.png"),
    OUT / "_source-gen.png",
]

W, H = 80, 112

# Locked to 尼古喵喵设定配色 (docs/visual-optimization-brief.md), not the old grey cat.
PALETTE = np.array(
    [
        [32, 30, 28],  # 0 outline
        [18, 16, 14],  # 1 ink
        [236, 214, 196],  # 2 skin
        [214, 176, 156],  # 3 skin shadow / inner ear
        [232, 196, 176],  # 4 inner ear light
        [154, 163, 146],  # 5 hair #9aa392
        [196, 202, 186],  # 6 hair hi
        [110, 118, 104],  # 7 hair sh
        [70, 72, 66],  # 8 ear tip / clip
        [239, 230, 216],  # 9 shirt #efe6d8
        [214, 204, 186],  # 10 shirt sh
        [74, 85, 96],  # 11 pants #4a5560
        [106, 120, 132],  # 12 pants hi
        [48, 56, 64],  # 13 pants sh
        [107, 115, 72],  # 14 shoe #6b7348
        [78, 84, 52],  # 15 shoe sh
        [58, 58, 62],  # 16 tail
        [196, 122, 48],  # 17 iris
        [120, 68, 28],  # 18 iris dk
        [28, 20, 16],  # 19 pupil
        [248, 244, 236],  # 20 eye white
        [200, 204, 210],  # 21 pierce
        [92, 64, 52],  # 22 mole
        [168, 140, 120],  # 23 brow
    ],
    dtype=np.int16,
)

OUTLINE, INK = 0, 1
SKIN, SKIN_SH, INNER = 2, 3, 4
HAIR, HAIR_HI, HAIR_SH, EAR_TIP = 5, 6, 7, 8
SHIRT, SHIRT_SH = 9, 10
PANTS, PANTS_HI, PANTS_SH = 11, 12, 13
SHOE, SHOE_SH, TAIL = 14, 15, 16
IRIS, IRIS_DK, PUPIL, EYE_WHITE, PIERCE, MOLE, BROW = 17, 18, 19, 20, 21, 22, 23


def find_src() -> Path:
    for p in SRC_CANDIDATES:
        if p.exists():
            return p
    raise SystemExit("missing generated source (niko-pixel-gen-b.png)")


def is_magenta(r: np.ndarray, g: np.ndarray, b: np.ndarray) -> np.ndarray:
    r16, g16, b16 = r.astype(np.int16), g.astype(np.int16), b.astype(np.int16)
    mag = (r16 > 180) & (b16 > 180) & (g16 < 120) & (np.abs(r16 - b16) < 80)
    fringe = (r16 > 150) & (b16 > 130) & (g16 < 170) & ((r16 + b16) - 2 * g16 > 70)
    return mag | fringe


def knockout(path: Path) -> Image.Image:
    im = Image.open(path).convert("RGBA")
    a = np.array(im)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    fg = ~is_magenta(r, g, b)
    a[~fg, 3] = 0
    # despill remaining magenta-ish edge towards neighbour luminance
    edge = fg & is_magenta(np.clip(r + 20, 0, 255), g, np.clip(b + 20, 0, 255))
    a[edge, 0] = np.minimum(a[edge, 0], a[edge, 1])
    a[edge, 2] = np.minimum(a[edge, 2], a[edge, 1])
    return Image.fromarray(a)


def crop_letterbox(im: Image.Image) -> Image.Image:
    a = np.array(im)
    ys, xs = np.where(a[:, :, 3] > 16)
    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())
    pad = 18
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(im.width - 1, x1 + pad), min(im.height - 1, y1 + pad)
    cw, ch = x1 - x0 + 1, y1 - y0 + 1
    target_aspect = W / H
    src_aspect = cw / ch
    if src_aspect < target_aspect:
        nw = int(ch * target_aspect)
        extra = nw - cw
        x0 = max(0, x0 - extra // 2)
        x1 = min(im.width - 1, x0 + nw - 1)
        x0 = max(0, x1 - nw + 1)
    else:
        nh = int(cw / target_aspect)
        extra = nh - ch
        y0 = max(0, y0 - extra // 2)
        y1 = min(im.height - 1, y0 + nh - 1)
        y0 = max(0, y1 - nh + 1)
    return im.crop((x0, y0, x1 + 1, y1 + 1))


def snap_palette(rgb: np.ndarray, alpha: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Map each opaque pixel to nearest palette index. Binary alpha."""
    h, w = alpha.shape
    opaque = alpha > 96
    idx = np.zeros((h, w), dtype=np.int16)
    pal = PALETTE.astype(np.float32)
    pix = rgb.astype(np.float32)
    # slightly weight green so sage hair does not collapse to grey pants
    wgt = np.array([1.0, 1.15, 1.0], dtype=np.float32)
    diffs = pix[:, :, None, :] - pal[None, None, :, :]
    dist = np.sqrt(((diffs * wgt) ** 2).sum(axis=3))
    idx = dist.argmin(axis=2).astype(np.int16)
    idx[~opaque] = -1
    return idx, opaque


def to_rgba(idx: np.ndarray) -> np.ndarray:
    h, w = idx.shape
    out = np.zeros((h, w, 4), dtype=np.uint8)
    ok = idx >= 0
    out[ok, :3] = PALETTE[idx[ok]]
    out[ok, 3] = 255
    return out


def spatial_fix(idx: np.ndarray) -> np.ndarray:
    """Keep palette ids in the body band they belong to (hair-shadow ≈ shoe olive)."""
    idx = idx.copy()
    yy = np.arange(H)[:, None]
    yn = yy / H
    hair_ids = {HAIR, HAIR_HI, HAIR_SH, EAR_TIP, PIERCE, INNER}
    shoe_ids = {SHOE, SHOE_SH}
    pants_ids = {PANTS, PANTS_HI, PANTS_SH}
    # olive in the hair/face band is hair or inner-ear, never a clog
    idx[(yn < 0.42) & np.isin(idx, list(shoe_ids | pants_ids))] = HAIR_SH
    # sage in the shoe band is olive, not bangs
    idx[(yn > 0.84) & np.isin(idx, list(hair_ids))] = SHOE
    # shirt-white in shoe band stays shoe shadow, not a second hem
    idx[(yn > 0.88) & ((idx == SHIRT) | (idx == SHIRT_SH) | (idx == EYE_WHITE))] = SHOE_SH
    return idx


def paint_features(idx: np.ndarray) -> np.ndarray:
    """Crisp eyes / mouth / mole. Official: mole under LEFT eye (viewer's right)."""
    idx = idx.copy()

    def setp(x, y, c):
        if 0 <= x < W and 0 <= y < H and idx[y, x] >= 0:
            idx[y, x] = c

    # Face = skin below the ear tips, above the collar — not the inner-ear peach.
    yn = np.arange(H)[:, None] / H
    xn = np.arange(W)[None, :] / W
    skin = ((idx == SKIN) | (idx == SKIN_SH)) & (yn > 0.16) & (yn < 0.44) & (xn > 0.30) & (xn < 0.70)
    ys, xs = np.where(skin)
    if len(xs) < 8:
        return idx
    fx0, fx1 = int(xs.min()), int(xs.max())
    fy0, fy1 = int(ys.min()), int(ys.max())
    cx = (fx0 + fx1) // 2
    face_h = max(8, fy1 - fy0)
    face_w = max(8, fx1 - fx0)

    ey = fy0 + int(face_h * 0.32)
    eye_w = max(3, min(6, face_w // 6))
    eye_h = max(2, min(4, face_h // 8))
    gap = max(2, face_w // 7)
    lx0 = cx - gap - eye_w
    rx0 = cx + gap
    ly0 = max(fy0 + 1, ey - eye_h // 2)

    for x0 in (lx0, rx0):
        for yy in range(ly0, ly0 + eye_h + 1):
            for xx in range(x0, x0 + eye_w + 1):
                setp(xx, yy, EYE_WHITE)
        ix, iy = x0 + eye_w // 2, ly0 + max(1, eye_h // 2)
        for dx, dy in ((0, 0), (-1, 0), (1, 0), (0, 1)):
            setp(ix + dx, iy + dy, IRIS)
        setp(ix, iy, PUPIL)
        setp(ix - 1, iy - 1, EYE_WHITE)
        for xx in range(x0, x0 + eye_w + 1):
            setp(xx, ly0, OUTLINE)

    my = min(fy1 - 2, fy0 + int(face_h * 0.70))
    mx = cx + 1
    for xx in range(mx - 1, mx + 3):
        setp(xx, my, OUTLINE)

    setp(rx0 + eye_w // 2, ly0 + eye_h + 2, MOLE)
    for yy in range(ly0 + eye_h, ly0 + eye_h + 4):
        for xx in range(lx0 - 1, lx0 + eye_w + 2):
            if 0 <= xx < W and 0 <= yy < H and idx[yy, xx] == MOLE:
                idx[yy, xx] = SKIN
    return idx


def classify(idx: np.ndarray) -> dict[str, np.ndarray]:
    h, w = idx.shape
    yy, xx = np.ogrid[:h, :w]
    yn = yy / h
    xn = xx / w
    opaque = idx >= 0
    is_line = opaque & ((idx == OUTLINE) | (idx == INK))
    is_skin = opaque & ((idx == SKIN) | (idx == SKIN_SH) | (idx == MOLE) | (idx == BROW))
    is_inner = opaque & (idx == INNER)
    is_hair = opaque & ((idx == HAIR) | (idx == HAIR_HI) | (idx == HAIR_SH) | (idx == EAR_TIP) | (idx == PIERCE))
    is_shirt = opaque & ((idx == SHIRT) | (idx == SHIRT_SH))
    is_pants = opaque & ((idx == PANTS) | (idx == PANTS_HI) | (idx == PANTS_SH))
    is_shoe = opaque & ((idx == SHOE) | (idx == SHOE_SH))
    is_tailc = opaque & (idx == TAIL)
    is_eye = opaque & ((idx == IRIS) | (idx == IRIS_DK) | (idx == PUPIL) | (idx == EYE_WHITE))

    def dilate(m: np.ndarray, n: int = 1) -> np.ndarray:
        out = m.copy()
        for _ in range(n):
            p = np.pad(out, 1, mode="constant")
            out = out | p[0:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, 0:-2] | p[1:-1, 2:]
        return out

    def attach(mask: np.ndarray, n: int = 1) -> np.ndarray:
        return (mask | (dilate(mask, n) & is_line)) & opaque

    clogs = attach(is_shoe & (yn > 0.82), 1)
    pants = attach(is_pants & (yn > 0.50) & (yn < 0.93), 1)
    tail = attach(
        (is_tailc | ((idx == EAR_TIP) & (yn > 0.55)))
        & (yn > 0.52)
        & (yn < 0.95)
        & ((xn < 0.32) | (xn > 0.70))
        & ~clogs,
        1,
    )
    hand = attach(is_skin & (xn < 0.34) & (yn > 0.32) & (yn < 0.64), 1)
    ears = attach((is_hair | is_inner) & (yn < 0.19) & (xn > 0.22) & (xn < 0.78), 1)
    hair_front = attach(is_hair & (yn > 0.10) & (yn < 0.32) & (xn > 0.30) & (xn < 0.70), 1)
    hair = attach(is_hair & (yn < 0.48) & ~ears, 1)
    head = attach(is_skin & (yn > 0.14) & (yn < 0.44) & (xn > 0.28) & (xn < 0.74) & ~hand, 1)
    shirt = attach(is_shirt & (yn > 0.24) & (yn < 0.70) & ~hand, 1)
    shirt = shirt | attach(is_skin & (xn > 0.60) & (yn > 0.38) & (yn < 0.64), 1)

    eyes = is_eye & (yn > 0.16) & (yn < 0.40) & (xn > 0.30) & (xn < 0.70)
    mouth = is_line & (yn > 0.30) & (yn < 0.40) & (xn > 0.42) & (xn < 0.58) & ~eyes

    body = {
        "clogs.png": clogs,
        "pants.png": pants,
        "tail.png": tail,
        "body-shirt.png": shirt,
        "hand.png": hand,
        "head.png": head,
        "hair.png": hair,
        "hair-front.png": hair_front,
        "ears.png": ears,
    }
    leftover = opaque.copy()
    for m in list(body.values()) + [eyes, mouth]:
        leftover &= ~m
    # Only dump leftovers onto large body plates, and keep them inside that plate's band.
    cores = ("clogs.png", "pants.png", "body-shirt.png", "head.png")
    bands = {
        "clogs.png": (0.82, 1.01),
        "pants.png": (0.50, 0.94),
        "body-shirt.png": (0.22, 0.72),
        "head.png": (0.12, 0.48),
    }
    remaining = leftover
    grow = {k: body[k].copy() for k in cores}
    while remaining.any():
        progressed = False
        for k in cores:
            y0, y1 = bands[k]
            nxt = dilate(grow[k], 1) & remaining & (yn >= y0) & (yn <= y1)
            if nxt.any():
                body[k] = body[k] | nxt
                grow[k] = grow[k] | nxt
                remaining = remaining & ~nxt
                progressed = True
        if not progressed:
            # Last-resort: band-local dump. Never let the shirt claim ear pixels.
            for k in cores:
                y0, y1 = bands[k]
                hit = remaining & (yn >= y0) & (yn <= y1)
                body[k] = body[k] | hit
                remaining = remaining & ~hit
            body["ears.png"] = body["ears.png"] | (remaining & (yn < 0.20))
            remaining = remaining & ~body["ears.png"]
            body["hair.png"] = body["hair.png"] | (remaining & (yn < 0.48))
            remaining = remaining & ~body["hair.png"]
            body["tail.png"] = body["tail.png"] | (remaining & (yn > 0.50) & ((xn < 0.32) | (xn > 0.70)))
            break

    body["head.png"] = body["head.png"] & ~eyes & ~mouth
    body["hair.png"] = body["hair.png"] & ~ears
    body["body-shirt.png"] = body["body-shirt.png"] & (yn > 0.20) & (yn < 0.72)
    body["clogs.png"] = body["clogs.png"] & (yn > 0.80)
    body["pants.png"] = body["pants.png"] & (yn > 0.48) & (yn < 0.95)
    body["tail.png"] = body["tail.png"] & (yn > 0.48)
    body["ears.png"] = body["ears.png"] & (yn < 0.22)
    body["eyes-open.png"] = eyes
    body["mouth-closed.png"] = mouth
    return body


def save_layer(name: str, rgba: np.ndarray, mask: np.ndarray) -> None:
    out = np.zeros_like(rgba)
    out[mask] = rgba[mask]
    Image.fromarray(out).save(LAYERS / name, "PNG")
    print(f"  {name:18s} {int(mask.sum()):5d} px")


def make_eye_variants(idx: np.ndarray, eyes_open: np.ndarray) -> dict[str, np.ndarray]:
    """Paint half/closed only on the open-eye pixels (exclusive slot, no face plate)."""
    h, w = idx.shape
    half = eyes_open.copy()
    closed = eyes_open.copy()
    rgba_idx_half = idx.copy()
    rgba_idx_closed = idx.copy()
    ys, xs = np.where(eyes_open)
    if len(xs) == 0:
        return {"eyes-half.png": (half, rgba_idx_half), "eyes-closed.png": (closed, rgba_idx_closed)}

    # Two eyes: split at median x of the open-eye mask, then lid each blob.
    mid_x = int(np.median(xs))
    for blob in (xs < mid_x, xs >= mid_x):
        bys, bxs = ys[blob], xs[blob]
        if len(bxs) == 0:
            continue
        y_mid = int(np.median(bys))
        for y, x in zip(bys, bxs):
            if y <= y_mid:
                rgba_idx_half[y, x] = SKIN if y < y_mid else OUTLINE
            if True:
                rgba_idx_closed[y, x] = OUTLINE if y == y_mid or y == y_mid + 1 else SKIN
    return {
        "eyes-half.png": (half, rgba_idx_half),
        "eyes-closed.png": (closed, rgba_idx_closed),
    }


def make_mouth_open(idx: np.ndarray, mouth_closed: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    h, w = idx.shape
    ys, xs = np.where(mouth_closed)
    out_idx = idx.copy()
    mask = mouth_closed.copy()
    if len(xs) == 0:
        return mask, out_idx
    y = int(np.median(ys))
    x0, x1 = int(xs.min()), int(xs.max())
    for yy in range(y, y + 3):
        for xx in range(x0, x1 + 1):
            if 0 <= xx < w and 0 <= yy < h:
                mask[yy, xx] = True
                out_idx[yy, xx] = INK if yy > y else OUTLINE
    # inner
    for xx in range(x0 + 1, x1):
        if 0 <= y + 1 < h:
            out_idx[y + 1, xx] = PUPIL
    return mask, out_idx


def checker(w: int, h: int, cell: int = 8) -> np.ndarray:
    yy, xx = np.ogrid[:h, :w]
    c = ((xx // cell) + (yy // cell)) % 2
    out = np.zeros((h, w, 4), dtype=np.uint8)
    out[c == 0] = (40, 40, 44, 255)
    out[c == 1] = (28, 28, 32, 255)
    return out


def scale_nn(im: Image.Image, k: int) -> Image.Image:
    return im.resize((im.width * k, im.height * k), Image.Resampling.NEAREST)


def main() -> None:
    src = find_src()
    print("source", src)
    LAYERS.mkdir(parents=True, exist_ok=True)

    ko = knockout(src)
    cropped = crop_letterbox(ko)
    # keep a small proof that we used the model output, not the official sheet
    proof = cropped.resize((160, 224), Image.Resampling.BOX).convert("RGBA")
    proof.save(OUT / "_source-gen.png", "PNG", optimize=True)

    small = cropped.resize((W, H), Image.Resampling.BOX).convert("RGBA")
    arr = np.array(small)
    idx, opaque = snap_palette(arr[:, :, :3], arr[:, :, 3])
    # drop isolated specks
    for y in range(H):
        for x in range(W):
            if idx[y, x] < 0:
                continue
            n = 0
            for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                yy, xx = y + dy, x + dx
                if 0 <= yy < H and 0 <= xx < W and idx[yy, xx] >= 0:
                    n += 1
            if n == 0:
                idx[y, x] = -1

    idx = spatial_fix(idx)
    idx = paint_features(idx)
    rgba = to_rgba(idx)
    Image.fromarray(rgba).save(OUT / "preview.png", "PNG")

    masks = classify(idx)
    eye_vars = make_eye_variants(idx, masks["eyes-open.png"])
    mouth_open_mask, mouth_open_idx = make_mouth_open(idx, masks["mouth-closed.png"])

    order = [
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
    print(f"canvas {W}x{H}")
    for name in order:
        save_layer(name, rgba, masks[name])

    # variants use their own index maps
    half_mask, half_idx = eye_vars["eyes-half.png"]
    closed_mask, closed_idx = eye_vars["eyes-closed.png"]
    save_layer("eyes-half.png", to_rgba(half_idx), half_mask)
    save_layer("eyes-closed.png", to_rgba(closed_idx), closed_mask)
    save_layer("mouth-open.png", to_rgba(mouth_open_idx), mouth_open_mask)

    # tray: head+ears crop, 32×32 then usable at 16
    headish = masks["head.png"] | masks["hair.png"] | masks["ears.png"] | masks["hair-front.png"] | masks["eyes-open.png"]
    ys, xs = np.where(headish)
    if len(xs):
        x0, x1 = max(0, xs.min() - 2), min(W - 1, xs.max() + 2)
        y0, y1 = max(0, ys.min() - 2), min(H - 1, ys.max() + 2)
        head = Image.fromarray(rgba).crop((x0, y0, x1 + 1, y1 + 1))
        # pad square
        side = max(head.size)
        sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        sq.paste(head, ((side - head.size[0]) // 2, (side - head.size[1]) // 2), head)
        sq.resize((32, 32), Image.Resampling.NEAREST).save(OUT / "tray.png", "PNG")
    else:
        Image.fromarray(rgba).resize((32, 32), Image.Resampling.NEAREST).save(OUT / "tray.png", "PNG")

    # stacked preview (4× nearest, checker, labeled strip + composite)
    names = [
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
    k = 3
    cell_w, cell_h = W * k, H * k
    cols = 5
    rows = (len(names) + 2 + cols - 1) // cols  # + composite + idle
    sheet = Image.new("RGBA", (cols * (cell_w + 8) + 8, rows * (cell_h + 24) + 8), (18, 18, 20, 255))
    draw = ImageDraw.Draw(sheet)

    def blit(im: Image.Image, i: int, label: str) -> None:
        r, c = divmod(i, cols)
        x = 8 + c * (cell_w + 8)
        y = 8 + r * (cell_h + 24)
        bg = Image.fromarray(checker(cell_w, cell_h, 12))
        spr = scale_nn(im, k)
        bg.paste(spr, (0, 0), spr)
        sheet.paste(bg, (x, y))
        draw.text((x, y + cell_h + 4), label, fill=(220, 220, 220, 255))

    for i, name in enumerate(names):
        blit(Image.open(LAYERS / name), i, name.replace(".png", ""))

    # composite idle
    idle = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for name in (
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
    ):
        layer = Image.open(LAYERS / name)
        idle.alpha_composite(layer)
    blit(idle, len(names), "composite-idle")
    blit(Image.fromarray(rgba), len(names) + 1, "preview")
    sheet.save(OUT / "_preview-stack.png", "PNG")

    # mouth in texture 0–1, origin top-left (same as sprites/anchor.json)
    my, mx = np.where(masks["mouth-closed.png"])
    if len(mx):
        mouth = {"x": round(float(np.median(mx) / W), 3), "y": round(float(np.median(my) / H), 3)}
    else:
        mouth = {"x": 0.52, "y": 0.30}

    sheet_json = {
        "name": "niko-miao",
        "version": 1,
        "width": W,
        "height": H,
        "scale": 3,
        "stage": {"width": W * 3, "height": H * 3},
        "anchor": {"x": 0.5, "y": 1.0},
        "origin": "top-left",
        "mouth": mouth,
        "cigarette": {"x": round(mouth["x"] + 0.06, 3), "y": round(mouth["y"] + 0.01, 3)},
        "preview": "preview.png",
        "tray": "tray.png",
        "stack": [
            "tail",
            "clogs",
            "pants",
            "body-shirt",
            "hand",
            "head",
            "hair",
            "ears",
            "eyes",
            "mouth",
            "hair-front",
        ],
        "layers": [
            {"name": "tail", "file": "layers/tail.png", "z": 0},
            {"name": "clogs", "file": "layers/clogs.png", "z": 1},
            {"name": "pants", "file": "layers/pants.png", "z": 2},
            {"name": "body-shirt", "file": "layers/body-shirt.png", "z": 3},
            {"name": "hand", "file": "layers/hand.png", "z": 4},
            {"name": "head", "file": "layers/head.png", "z": 5},
            {"name": "hair", "file": "layers/hair.png", "z": 6},
            {"name": "ears", "file": "layers/ears.png", "z": 7},
            {"name": "eyes-open", "file": "layers/eyes-open.png", "z": 8, "slot": "eyes", "state": "open"},
            {"name": "eyes-half", "file": "layers/eyes-half.png", "z": 8, "slot": "eyes", "state": "half"},
            {"name": "eyes-closed", "file": "layers/eyes-closed.png", "z": 8, "slot": "eyes", "state": "closed"},
            {"name": "mouth-closed", "file": "layers/mouth-closed.png", "z": 9, "slot": "mouth", "state": "closed"},
            {"name": "mouth-open", "file": "layers/mouth-open.png", "z": 9, "slot": "mouth", "state": "open"},
            {"name": "hair-front", "file": "layers/hair-front.png", "z": 10},
        ],
        "slots": {
            "eyes": {"default": "open", "states": ["open", "half", "closed"]},
            "mouth": {"default": "closed", "states": ["closed", "open"]},
        },
        "poses": {
            "idle": {"eyes": "open", "mouth": "closed"},
            "talk": {"eyes": "open", "mouth": "open"},
            "inhale": {"eyes": "closed", "mouth": "closed"},
            "exhale": {"eyes": "half", "mouth": "open"},
        },
    }
    (OUT / "sheet.json").write_text(json.dumps(sheet_json, indent=2) + "\n", encoding="utf-8")
    print("mouth", mouth)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
