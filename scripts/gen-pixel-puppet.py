#!/usr/bin/env python3
"""Slice nico_miaomiao_transparent.png into a 240×336 layered puppet.

Layering rules (idle composite must still equal the fitted source):
- Flood-fill each body part from seeds, with a bbox so shirt ≠ skin ≠ hair.
- Joints overlap: the same source pixel can sit on two layers; the top one wins.
- Hidden underpaint (pants under the hem, skin under bangs/eyes) is only placed
  where a higher layer already covers it, so preview does not change.
- Outline pixels are copied onto every adjacent part so each layer looks closed.
"""
from __future__ import annotations

import json
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "尼古喵喵角色图" / "nico_miaomiao_transparent.png"
OUT = ROOT / "assets" / "pixel"
LAYERS = OUT / "layers"
W, H = 240, 336

SKIN_FILL = (245, 210, 180, 255)
PANTS_FILL = (80, 92, 104, 255)
LID = (42, 34, 30, 255)
INK = (18, 16, 14, 255)
OUTLINE_C = (32, 30, 28, 255)
SMOKE = (168, 172, 176, 255)

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

EYE_L = (116, 43, 126, 50)
EYE_R = (137, 43, 148, 50)
MOUTH = (126, 66, 136, 73)
CAVITY = (52, 24, 26, 255)
FACE = (108, 32, 164, 96)


def is_outline_rgb(r: int, g: int, b: int) -> bool:
    return r + g + b < 90


def is_skin_rgb(r: int, g: int, b: int) -> bool:
    return r > 185 and g > 140 and b > 110 and (r - b) > 22 and (r - g) > 18


def is_shirt_rgb(r: int, g: int, b: int) -> bool:
    return r > 195 and g > 185 and b > 155 and (r - g) < 24 and (g - b) < 45


def is_pants_rgb(r: int, g: int, b: int) -> bool:
    return 40 < r < 150 and 50 < g < 160 and 65 < b < 180 and b >= g - 8 and b > r + 2


def is_hair_rgb(r: int, g: int, b: int) -> bool:
    return 70 < r < 210 and 80 < g < 210 and 60 < b < 190 and abs(r - g) < 32 and g >= b - 10 and g >= r - 16


def is_olive_rgb(r: int, g: int, b: int) -> bool:
    return 55 < r < 175 and 65 < g < 185 and 25 < b < 140 and g >= r - 10 and g > b + 6


def is_tail_rgb(r: int, g: int, b: int) -> bool:
    s = r + g + b
    return 80 <= s <= 240 and abs(r - g) < 18 and abs(g - b) < 22 and r < 100


def is_inner_ear_rgb(r: int, g: int, b: int) -> bool:
    return r > 150 and g > 130 and b > 110 and (r - b) < 50


def is_eye_paint(r: int, g: int, b: int) -> bool:
    if r > 200 and g > 170:
        return False
    if is_hair_rgb(r, g, b) and r + g + b > 280:
        return False
    if r + g + b < 90:
        return True
    if r < 80 and g < 70:
        return True
    if r > 70 and r > g + 12 and b < 90:
        return True
    return False


def rgb(p: np.ndarray) -> tuple[int, int, int]:
    return int(p[0]), int(p[1]), int(p[2])


def fit_idle(src: Image.Image) -> np.ndarray:
    a = np.array(src.convert("RGBA"))
    ys, xs = np.where(a[:, :, 3] >= 128)
    pad = 8
    x0, y0 = max(0, int(xs.min()) - pad), max(0, int(ys.min()) - pad)
    x1, y1 = min(a.shape[1] - 1, int(xs.max()) + pad), min(a.shape[0] - 1, int(ys.max()) + pad)
    crop = src.crop((x0, y0, x1 + 1, y1 + 1))
    cw, ch = crop.size
    nw = max(1, int(round(cw * H / ch)))
    fitted = crop.resize((nw, H), Image.Resampling.BOX)
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    canvas.paste(fitted, ((W - nw) // 2, 0), fitted)
    arr = np.array(canvas)
    arr[:, :, 3] = np.where(arr[:, :, 3] >= 40, 255, 0)
    arr[arr[:, :, 3] == 0] = 0
    return arr


def flood(
    src: np.ndarray,
    seeds: list[tuple[int, int]],
    ok,
    bbox: tuple[int, int, int, int],
    *,
    also_outline: bool = True,
) -> np.ndarray:
    x0, y0, x1, y1 = bbox
    mask = np.zeros((H, W), dtype=bool)
    q: deque[tuple[int, int]] = deque()
    for x, y in seeds:
        if 0 <= x < W and 0 <= y < H:
            q.append((x, y))
    seen = np.zeros((H, W), dtype=bool)
    while q:
        x, y = q.popleft()
        if seen[y, x]:
            continue
        if not (x0 <= x < x1 and y0 <= y < y1):
            seen[y, x] = True
            continue
        if src[y, x, 3] == 0:
            seen[y, x] = True
            continue
        r, g, b = rgb(src[y, x])
        outline = is_outline_rgb(r, g, b)
        if outline and not also_outline:
            seen[y, x] = True
            continue
        if not outline and not ok(r, g, b):
            seen[y, x] = True
            continue
        if outline:
            touch = False
            for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
                ny, nx = y + dy, x + dx
                if 0 <= nx < W and 0 <= ny < H and mask[ny, nx]:
                    touch = True
                    break
            if not touch:
                continue
        seen[y, x] = True
        mask[y, x] = True
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            q.append((x + dx, y + dy))
    return mask


def attach_outline(src: np.ndarray, masks: dict[str, np.ndarray]) -> None:
    """Copy each outline pixel onto every adjacent part so layers look closed."""
    opa = src[:, :, 3] > 0
    for y in range(H):
        for x in range(W):
            if not opa[y, x]:
                continue
            if not is_outline_rgb(*rgb(src[y, x])):
                continue
            hit: set[str] = set()
            for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (1, -1), (-1, 1), (-1, -1)):
                ny, nx = y + dy, x + dx
                if not (0 <= nx < W and 0 <= ny < H):
                    continue
                for name, m in masks.items():
                    if m[ny, nx]:
                        hit.add(name)
            for name in hit:
                masks[name][y, x] = True


def eye_mask(src: np.ndarray, box: tuple[int, int, int, int]) -> np.ndarray:
    x0, y0, x1, y1 = box
    m = np.zeros((H, W), dtype=bool)
    for y in range(y0, y1):
        for x in range(x0, x1):
            if src[y, x, 3] == 0:
                continue
            if is_eye_paint(*rgb(src[y, x])):
                m[y, x] = True
    return m


def mouth_mask(src: np.ndarray) -> np.ndarray:
    """The idle mouth is a 1px ink line, not the jaw outline around it."""
    x0, y0, x1, y1 = MOUTH
    cx = (x0 + x1) / 2
    best: tuple[float, int, list[int]] | None = None
    for y in range(y0, y1):
        xs: list[int] = []
        for x in range(x0, x1):
            if src[y, x, 3] == 0:
                continue
            r, g, b = rgb(src[y, x])
            if is_skin_rgb(r, g, b) or is_hair_rgb(r, g, b):
                continue
            if r + g + b < 90:
                xs.append(x)
        if len(xs) < 4:
            continue
        mid = float(np.median(xs))
        score = len(xs) - abs(mid - cx) * 0.25
        if best is None or score > best[0]:
            best = (score, y, xs)
    m = np.zeros((H, W), dtype=bool)
    if best is None:
        return m
    _, y, xs = best
    for x in xs:
        m[y, x] = True
    return m


def neighbor_skin(src: np.ndarray, x: int, y: int) -> tuple[int, int, int, int]:
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0), (2, 0), (-2, 0), (1, 1), (-1, -1)):
        nx, ny = x + dx, y + dy
        if 0 <= nx < W and 0 <= ny < H and src[ny, nx, 3] and is_skin_rgb(*rgb(src[ny, nx])):
            return tuple(int(v) for v in src[ny, nx])
    return SKIN_FILL


def build_masks(src: np.ndarray) -> dict[str, np.ndarray]:
    shirt = flood(src, [(130, 140), (120, 120), (150, 130)], is_shirt_rgb, (58, 68, 185, 205))
    pants = flood(src, [(125, 240), (155, 240), (130, 210)], is_pants_rgb, (96, 175, 185, 308))
    clogs = flood(
        src,
        [(125, 328), (160, 320), (120, 320)],
        lambda r, g, b: is_olive_rgb(r, g, b) or is_hair_rgb(r, g, b),
        (100, 304, 185, H),
    )
    head = flood(src, [(132, 52), (128, 60), (132, 78)], is_skin_rgb, (100, 32, 170, 100))
    hair = flood(src, [(130, 18), (120, 22), (140, 24)], is_hair_rgb, (80, 0, 185, 96))
    left_ear = flood(
        src,
        [(110, 12), (108, 18)],
        lambda r, g, b: is_hair_rgb(r, g, b) or is_inner_ear_rgb(r, g, b),
        (100, 0, 126, 32),
    )
    right_ear = flood(
        src,
        [(155, 10), (158, 16)],
        lambda r, g, b: is_hair_rgb(r, g, b) or is_inner_ear_rgb(r, g, b),
        (144, 0, 170, 32),
    )
    ears = left_ear | right_ear
    hand_l = flood(src, [(80, 150), (70, 170)], is_skin_rgb, (54, 118, 100, 200))
    hand_r = flood(src, [(168, 175), (165, 155)], is_skin_rgb, (150, 118, 185, 200))
    hands = hand_l | hand_r
    tail = flood(src, [(88, 220), (86, 228), (90, 212)], is_tail_rgb, (70, 196, 104, 296))

    # Bangs = hair sitting over the face window; keep a copy on hair so the back layer stays whole.
    fx0, fy0, fx1, fy1 = FACE
    bangs = np.zeros((H, W), dtype=bool)
    bangs[fy0:54, fx0:fx1] = hair[fy0:54, fx0:fx1]
    bangs &= ~ears

    hair &= ~ears
    hair |= bangs
    head &= ~hair & ~ears & ~shirt
    shirt &= ~hands
    pants &= ~clogs
    tail &= ~pants & ~hands & ~shirt

    masks = {
        "tail": tail,
        "clogs": clogs,
        "pants": pants,
        "shirt": shirt,
        "hand": hands,
        "head": head,
        "hair": hair,
        "ears": ears,
        "bangs": bangs,
    }
    attach_outline(src, masks)
    masks["head"] &= ~masks["hair"] & ~masks["ears"]
    masks["bangs"] &= masks["hair"] & ~masks["ears"]
    masks["pants"] &= ~masks["clogs"]
    masks["tail"] &= ~masks["pants"] & ~masks["clogs"]
    assign_leftovers(src, masks)
    tidy_masks(src, masks)
    assign_leftovers(src, masks)
    refine_hair(src, masks)
    assign_leftovers(src, masks)
    masks["head"] &= ~masks["hair"] & ~masks["ears"]
    return masks


def assign_leftovers(src: np.ndarray, masks: dict[str, np.ndarray]) -> None:
    """Every opaque source pixel must belong to at least one body layer."""
    claimed = np.zeros((H, W), dtype=bool)
    body = ("tail", "clogs", "pants", "shirt", "hand", "head", "hair", "ears")
    for name in body:
        claimed |= masks[name]
    leftover = (src[:, :, 3] > 0) & ~claimed
    if not leftover.any():
        return
    owned_y, owned_x = np.where(claimed)
    labels_on_owned = np.zeros(owned_y.shape[0], dtype=np.int16)
    index = {name: i for i, name in enumerate(body)}
    for name in body:
        m = masks[name][owned_y, owned_x]
        labels_on_owned[m] = index[name]
    for y, x in zip(*np.where(leftover)):
        d = (owned_y - y) ** 2 + (owned_x - x) ** 2
        name = body[int(labels_on_owned[int(d.argmin())])]
        r, g, b = rgb(src[y, x])
        if y >= 304:
            name = "clogs"
        elif is_pants_rgb(r, g, b) and y >= 180:
            name = "pants"
        elif is_shirt_rgb(r, g, b) and 70 <= y < 210:
            name = "shirt"
        elif is_skin_rgb(r, g, b) and y < 110:
            name = "head"
        elif is_skin_rgb(r, g, b) and y >= 118:
            name = "hand"
        elif (
            (EYE_L[0] <= x < EYE_L[2] and EYE_L[1] <= y < EYE_L[3])
            or (EYE_R[0] <= x < EYE_R[2] and EYE_R[1] <= y < EYE_R[3])
        ) and is_eye_paint(r, g, b):
            name = "head"
        elif is_hair_rgb(r, g, b) and y <= 78:
            name = "hair"
        elif is_hair_ink_rgb(r, g, b) and y <= 78:
            name = "hair"
        elif name == "hair" and y > 78:
            name = "shirt"
        elif name == "hair" and y >= 28 and not is_hair_mass_rgb(r, g, b):
            name = "head" if y < 58 else "shirt"
        masks[name][y, x] = True


def tidy_masks(src: np.ndarray, masks: dict[str, np.ndarray]) -> None:
    """Keep ears as two lobes, bangs on the forehead, head as face+neck."""
    yy, xx = np.indices((H, W))
    gap = masks["ears"] & (xx >= 120) & (xx <= 140) & (yy >= 6)
    masks["hair"] |= gap
    masks["ears"] &= ~gap

    top = masks["head"] & (yy < 32)
    hairish = np.zeros((H, W), dtype=bool)
    for y, x in zip(*np.where(top)):
        if is_hair_rgb(*rgb(src[y, x])) or is_outline_rgb(*rgb(src[y, x])):
            hairish[y, x] = True
    masks["hair"] |= hairish
    masks["ears"] |= top & ~hairish & ((xx < 120) | (xx > 140))
    masks["head"] &= ~top

    masks["bangs"] &= (yy <= 52) & (xx >= 108) & (xx <= 162)
    masks["bangs"] &= masks["hair"]
    refine_hair(src, masks)
    masks["head"] &= ~masks["hair"] & ~masks["ears"]
    masks["pants"] &= ~masks["clogs"]
    masks["tail"] &= ~masks["pants"] & ~masks["clogs"] & (yy < 290)


def is_hair_ink_rgb(r: int, g: int, b: int) -> bool:
    """Hair outline / dark sage that misses the global ink threshold."""
    mx, mn = max(r, g, b), min(r, g, b)
    return mx < 115 and (mx - mn) < 32 and not is_skin_rgb(r, g, b)


def is_face_fringe_rgb(r: int, g: int, b: int) -> bool:
    """Skin / warm beige clinging to the inner hairline — not sage hair."""
    if is_hair_rgb(r, g, b) or is_outline_rgb(r, g, b) or is_hair_ink_rgb(r, g, b):
        return False
    if is_skin_rgb(r, g, b):
        return True
    return r >= 145 and r > g + 8 and r > b + 12


def is_hair_mass_rgb(r: int, g: int, b: int) -> bool:
    return (
        is_hair_rgb(r, g, b)
        or is_outline_rgb(r, g, b)
        or is_hair_ink_rgb(r, g, b)
        or is_inner_ear_rgb(r, g, b)
    )


def refine_hair(src: np.ndarray, masks: dict[str, np.ndarray]) -> None:
    """Complete hair mass, drop shoulder specks and non-hair colors."""
    yy, xx = np.indices((H, W))
    hair = masks["hair"]
    ears = masks["ears"]

    # Shoulder / collar specks are not hair.
    low = hair & (yy > 78)
    masks["shirt"] |= low
    hair &= yy <= 78

    # Duplicate the whole ear onto hair so the crown isn't two rectangular bites.
    # Ears still overlay; idle composite stays identical.
    hair |= ears

    def peel_non_hair(y: int, x: int) -> None:
        if y < 32:
            hair[y, x] = True
        elif y < 58:
            masks["head"][y, x] = True
        else:
            masks["shirt"][y, x] = True

    def keep_on_hair(r: int, g: int, b: int, y: int, x: int) -> bool:
        if y < 32:
            return True
        if ears[y, x]:
            return True
        if is_hair_rgb(r, g, b) or is_outline_rgb(r, g, b) or is_hair_ink_rgb(r, g, b):
            return True
        # Pale sage highlights on the crown / bangs (not warm skin).
        if y < 54 and abs(r - g) < 18 and g >= b and r > 185:
            return True
        return False

    # Cream / skin leftovers — keep sage + ink; peel face-window beige onto head.
    drop = np.zeros((H, W), dtype=bool)
    for y, x in zip(*np.where(hair)):
        r, g, b = rgb(src[y, x])
        if keep_on_hair(r, g, b, y, x):
            continue
        drop[y, x] = True
        peel_non_hair(y, x)
    hair &= ~drop

    # Pull in nearby hair-mass pixels. Do not grow warm skin into the face window.
    for y in range(0, 79):
        for x in range(90, 180):
            if src[y, x, 3] == 0 or hair[y, x]:
                continue
            r, g, b = rgb(src[y, x])
            if is_eye_paint(r, g, b) and (
                (EYE_L[0] <= x < EYE_L[2] and EYE_L[1] <= y < EYE_L[3])
                or (EYE_R[0] <= x < EYE_R[2] and EYE_R[1] <= y < EYE_R[3])
            ):
                continue
            if y >= 28 and not ears[y, x]:
                if not (is_hair_rgb(r, g, b) or is_outline_rgb(r, g, b) or is_hair_ink_rgb(r, g, b)):
                    continue
            elif not is_hair_mass_rgb(r, g, b):
                continue
            n = 0
            for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (1, -1), (-1, 1), (-1, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= nx < W and 0 <= ny < H and hair[ny, nx]:
                    n += 1
            if n >= 2:
                hair[y, x] = True
                masks["head"][y, x] = False
                masks["shirt"][y, x] = False

    # Close 1–3 px gaps inside the hair, but never fill the face window with hair.
    vis = np.zeros((H, W), dtype=bool)
    ys, xs = np.where(hair)
    if ys.size:
        x0, x1 = int(xs.min()), int(xs.max())
        y0, y1 = int(ys.min()), int(ys.max())
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if vis[y, x] or hair[y, x]:
                    continue
                q = deque([(x, y)])
                vis[y, x] = True
                cells: list[tuple[int, int]] = []
                edge = False
                while q:
                    cx, cy = q.popleft()
                    cells.append((cx, cy))
                    if cx == x0 or cx == x1 or cy == y0 or cy == y1:
                        edge = True
                    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
                        nx, ny = cx + dx, cy + dy
                        if not (x0 <= nx <= x1 and y0 <= ny <= y1):
                            edge = True
                            continue
                        if vis[ny, nx] or hair[ny, nx]:
                            continue
                        vis[ny, nx] = True
                        q.append((nx, ny))
                if edge or len(cells) > 8:
                    continue
                for cx, cy in cells:
                    if src[cy, cx, 3] == 0:
                        continue
                    r, g, b = rgb(src[cy, cx])
                    if keep_on_hair(r, g, b, cy, cx):
                        hair[cy, cx] = True

    # Drop specks that aren't attached to the hair mass.
    keep = hair.copy()
    for y, x in zip(*np.where(hair)):
        n = 0
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            ny, nx = y + dy, x + dx
            if 0 <= nx < W and 0 <= ny < H and hair[ny, nx]:
                n += 1
        if n == 0 and not ears[y, x]:
            keep[y, x] = False
            r, g, b = rgb(src[y, x])
            if is_skin_rgb(r, g, b) or is_face_fringe_rgb(r, g, b):
                masks["head"][y, x] = True
            elif y >= 70:
                masks["shirt"][y, x] = True
    hair = keep

    # Shirt salvage on the crown: only keep pixels that are actually hair.
    stray_shirt = masks["shirt"] & (yy < 68)
    for y, x in zip(*np.where(stray_shirt)):
        r, g, b = rgb(src[y, x])
        if keep_on_hair(r, g, b, y, x):
            hair[y, x] = True
        else:
            peel_non_hair(y, x)
    masks["shirt"] &= yy >= 58

    # Final inner-hairline peel so leftover/shirt salvage cannot put beige back.
    drop = np.zeros((H, W), dtype=bool)
    for y, x in zip(*np.where(hair)):
        r, g, b = rgb(src[y, x])
        if keep_on_hair(r, g, b, y, x):
            continue
        drop[y, x] = True
        peel_non_hair(y, x)
    hair &= ~drop

    eyes = eye_mask(src, EYE_L) | eye_mask(src, EYE_R)
    hair &= ~eyes & ~mouth_mask(src)

    masks["hair"] = hair
    masks["bangs"] &= hair & ~ears


def paint_eye_half(src: np.ndarray, opened: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    img = np.zeros_like(src)
    mask = opened.copy()
    ys, xs = np.where(opened)
    if not xs.size:
        return img, mask
    y_cut = int(ys.min()) + 3
    for y, x in zip(ys, xs):
        img[y, x] = LID if y <= y_cut else src[y, x]
    return img, mask


def paint_eye_closed(opened: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    img = np.zeros((H, W, 4), dtype=np.uint8)
    mask = np.zeros((H, W), dtype=bool)
    for box in (EYE_L, EYE_R):
        x0, y0, x1, y1 = box
        band = opened[y0:y1, x0:x1]
        if not band.any():
            continue
        ys, xs = np.where(band)
        y = y0 + int(np.median(ys))
        x_lo, x_hi = x0 + int(xs.min()), x0 + int(xs.max())
        for x in range(x_lo, x_hi + 1):
            for yy in (y, y + 1):
                if 0 <= yy < H:
                    mask[yy, x] = True
                    img[yy, x] = LID
    return img, mask


def paint_mouth_open(src: np.ndarray, closed: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Small 3px opening whose top edge sits on the idle lip line."""
    img = np.zeros_like(src)
    mask = np.zeros((H, W), dtype=bool)
    ys, xs = np.where(closed)
    if not xs.size:
        return img, mask
    x0, x1 = int(xs.min()), int(xs.max())
    y_lip = int(np.median(ys))
    rows = (
        (y_lip - 1, 1, True),
        (y_lip, 0, False),
        (y_lip + 1, 1, True),
    )
    for y, inset, outline_row in rows:
        if not (0 <= y < H):
            continue
        lo, hi = x0 + inset, x1 - inset
        if lo > hi:
            lo, hi = x0, x1
        for x in range(lo, hi + 1):
            mask[y, x] = True
            edge = outline_row or x in (lo, hi)
            img[y, x] = OUTLINE_C if edge else CAVITY
    return img, mask


def layer_from(src: np.ndarray, mask: np.ndarray) -> np.ndarray:
    out = np.zeros_like(src)
    out[mask] = src[mask]
    out[:, :, 3] = np.where(mask, 255, 0)
    return out


def save_layer(name: str, arr: np.ndarray) -> np.ndarray:
    Image.fromarray(arr).save(LAYERS / name, "PNG")
    m = arr[:, :, 3] > 0
    ys, xs = np.where(m)
    box = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())) if m.any() else None
    print(f"  {name:18s} {int(m.sum()):5d} px  bbox={box}")
    return arr


def composite(layers: dict[str, np.ndarray], names: list[str]) -> np.ndarray:
    out = np.zeros((H, W, 4), dtype=np.uint8)
    for name in names:
        lay = layers[name]
        m = lay[:, :, 3] == 255
        out[m] = lay[m]
    return out


def checker(w: int, h: int, cell: int = 8) -> np.ndarray:
    yy, xx = np.ogrid[:h, :w]
    c = ((xx // cell) + (yy // cell)) % 2
    out = np.zeros((h, w, 4), dtype=np.uint8)
    out[c == 0] = (40, 40, 44, 255)
    out[c == 1] = (28, 28, 32, 255)
    return out


def write_stack_sheet(layers: dict[str, np.ndarray], preview: np.ndarray) -> None:
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
        "mouth-smoke.png",
        "hair-front.png",
    ]
    cell_w, cell_h = W, H
    cols = 5
    rows = (len(names) + 2 + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * (cell_w + 8) + 8, rows * (cell_h + 24) + 8), (18, 18, 20, 255))
    draw = ImageDraw.Draw(sheet)

    def blit(arr: np.ndarray, i: int, label: str) -> None:
        r, c = divmod(i, cols)
        x = 8 + c * (cell_w + 8)
        y = 8 + r * (cell_h + 24)
        bg = Image.fromarray(checker(cell_w, cell_h, 12))
        spr = Image.fromarray(arr)
        bg.paste(spr, (0, 0), spr)
        sheet.paste(bg, (x, y))
        draw.text((x, y + cell_h + 4), label, fill=(220, 220, 220, 255))

    for i, name in enumerate(names):
        blit(layers[name], i, name.replace(".png", ""))
    blit(composite(layers, IDLE_STACK), len(names), "composite-idle")
    blit(preview, len(names) + 1, "preview")
    sheet.save(OUT / "_preview-stack.png", "PNG")


def write_tray(preview: np.ndarray, layers: dict[str, np.ndarray]) -> None:
    headish = (
        layers["head.png"][:, :, 3]
        | layers["hair.png"][:, :, 3]
        | layers["ears.png"][:, :, 3]
        | layers["hair-front.png"][:, :, 3]
    ) > 0
    ys, xs = np.where(headish)
    x0, x1 = max(0, int(xs.min()) - 4), min(W - 1, int(xs.max()) + 4)
    y0, y1 = max(0, int(ys.min()) - 4), min(H - 1, int(ys.max()) + 4)
    crop = Image.fromarray(preview).crop((x0, y0, x1 + 1, y1 + 1))
    side = max(crop.size)
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.paste(crop, ((side - crop.size[0]) // 2, (side - crop.size[1]) // 2), crop)
    sq.resize((32, 32), Image.Resampling.NEAREST).save(OUT / "tray.png", "PNG")


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"missing source: {SRC}")
    LAYERS.mkdir(parents=True, exist_ok=True)

    img = fit_idle(Image.open(SRC))
    masks = build_masks(img)
    eyes = eye_mask(img, EYE_L) | eye_mask(img, EYE_R)
    mouth_c = mouth_mask(img)

    head_src = img.copy()
    for y, x in zip(*np.where(eyes)):
        head_src[y, x] = neighbor_skin(img, x, y)
    for y, x in zip(*np.where(masks["bangs"])):
        if FACE[1] <= y < 56 and FACE[0] <= x < FACE[2]:
            head_src[y, x] = neighbor_skin(img, x, y)
    for y, x in zip(*np.where(mouth_c)):
        head_src[y, x] = neighbor_skin(img, x, y)
    head_mask = masks["head"] | eyes | mouth_c

    # Pants under the shirt hem (hidden by body-shirt in the idle stack).
    pants_src = img.copy()
    yy, xx = np.indices((H, W))
    hem = masks["shirt"] & (yy >= 175) & (yy <= 202) & (xx >= 100) & (xx <= 175)
    pants_src[hem] = PANTS_FILL
    pants_mask = masks["pants"] | hem

    half_img, half_mask = paint_eye_half(img, eyes)
    closed_img, closed_mask = paint_eye_closed(eyes)
    mouth_open_img, mouth_open = paint_mouth_open(img, mouth_c)
    mouth_smoke_img = mouth_open_img.copy()
    ys, xs = np.where(mouth_open)
    if xs.size:
        cy = int(ys.min()) + 1
        for x in range(int(xs.min()) + 2, int(xs.max()) - 1):
            mouth_smoke_img[cy, x] = SMOKE

    bangs = masks["bangs"] & ~eyes

    layers: dict[str, np.ndarray] = {}
    layers["tail.png"] = save_layer("tail.png", layer_from(img, masks["tail"]))
    layers["clogs.png"] = save_layer("clogs.png", layer_from(img, masks["clogs"]))
    layers["pants.png"] = save_layer("pants.png", layer_from(pants_src, pants_mask))
    layers["body-shirt.png"] = save_layer("body-shirt.png", layer_from(img, masks["shirt"]))
    layers["hand.png"] = save_layer("hand.png", layer_from(img, masks["hand"]))
    layers["head.png"] = save_layer("head.png", layer_from(head_src, head_mask))
    layers["hair.png"] = save_layer("hair.png", layer_from(img, masks["hair"]))
    layers["ears.png"] = save_layer("ears.png", layer_from(img, masks["ears"]))
    layers["eyes-open.png"] = save_layer("eyes-open.png", layer_from(img, eyes))
    layers["eyes-half.png"] = save_layer("eyes-half.png", layer_from(half_img, half_mask))
    layers["eyes-closed.png"] = save_layer("eyes-closed.png", layer_from(closed_img, closed_mask))
    layers["mouth-closed.png"] = save_layer("mouth-closed.png", layer_from(img, mouth_c))
    layers["mouth-open.png"] = save_layer("mouth-open.png", layer_from(mouth_open_img, mouth_open))
    layers["mouth-smoke.png"] = save_layer("mouth-smoke.png", layer_from(mouth_smoke_img, mouth_open))
    layers["hair-front.png"] = save_layer("hair-front.png", layer_from(img, bangs))

    preview = composite(layers, IDLE_STACK)
    Image.fromarray(preview).save(OUT / "preview.png", "PNG")
    write_stack_sheet(layers, preview)
    write_tray(preview, layers)

    my, mx = np.where(mouth_c)
    mouth = (
        {"x": round(float(np.median(mx) / W), 3), "y": round(float(np.median(my) / H), 3)}
        if mx.size
        else {"x": 0.54, "y": 0.20}
    )
    sheet = {
        "name": "niko-miao",
        "version": 1,
        "width": W,
        "height": H,
        "scale": 1,
        "scaleMode": "nearest",
        "stage": {"width": W, "height": H},
        "anchor": {"x": 0.5, "y": 1.0},
        "origin": "top-left",
        "mouth": mouth,
        "cigarette": {"x": round(mouth["x"] + 0.04, 3), "y": round(mouth["y"] + 0.01, 3)},
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
    (OUT / "sheet.json").write_text(json.dumps(sheet, indent=2) + "\n", encoding="utf-8")

    idle = composite(layers, IDLE_STACK)
    fitted = img
    print(
        json.dumps(
            {
                "idle_mismatch_preview": int(np.any(idle != preview, axis=2).sum()),
                "idle_mismatch_source": int(np.any(idle != fitted, axis=2).sum()),
                "opaque": int((preview[:, :, 3] > 0).sum()),
                "mouth": mouth,
                "eyes_px": int(eyes.sum()),
                "tail_px": int(masks["tail"].sum()),
                "ears_px": int(masks["ears"].sum()),
                "head_px": int(head_mask.sum()),
                "shirt_px": int(masks["shirt"].sum()),
                "hair_px": int(masks["hair"].sum()),
                "bangs_px": int(bangs.sum()),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
