#!/usr/bin/env python3
"""P-Gen repair: keep the same 80×112 puppet, fix masks / tail / extras.

Does NOT shrink the official sheet. Does NOT regenerate a new character.
Starts from the existing preview.png (AI-derived pixel puppet) and recuts layers.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent
LAYERS = OUT / "layers"
OFFICIAL = Path(__file__).resolve().parents[2] / "尼古喵喵角色图" / "50.webp"
W, H = 80, 112

# Locked palette (brief). Shirt/pants/shoes/hair exact hex where it matters.
OUTLINE = (32, 30, 28, 255)
INK = (18, 16, 14, 255)
SKIN = (236, 214, 196, 255)  # #ecd6c4
SKIN_SH = (214, 176, 156, 255)
INNER = (214, 176, 156, 255)
HAIR = (154, 163, 146, 255)  # #9aa392
HAIR_HI = (176, 184, 166, 255)
HAIR_SH = (110, 118, 104, 255)
EAR_TIP = (70, 72, 66, 255)
SHIRT = (239, 230, 216, 255)  # #efe6d8
SHIRT_SH = (214, 204, 186, 255)
PANTS = (74, 85, 96, 255)  # #4a5560
PANTS_SH = (48, 56, 64, 255)
SHOE = (107, 115, 72, 255)  # #6b7348
SHOE_SH = (78, 84, 52, 255)
TAIL_C = (58, 58, 62, 255)
IRIS = (168, 96, 40, 255)
IRIS_DK = (110, 62, 26, 255)
PUPIL = (28, 20, 16, 255)
LID = (42, 34, 30, 255)
MOLE = (92, 64, 52, 255)
SCLERA = (232, 214, 196, 255)  # near-skin, not dead white

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


def load_rgba(path: Path) -> np.ndarray:
    a = np.array(Image.open(path).convert("RGBA"))
    a[:, :, 3] = np.where(a[:, :, 3] >= 128, 255, 0)
    return a


def put(img: np.ndarray, x: int, y: int, rgba: tuple[int, int, int, int]) -> None:
    if 0 <= x < W and 0 <= y < H:
        img[y, x] = rgba


def rgba_eq(p, c) -> bool:
    return bool(p[3] > 0 and p[0] == c[0] and p[1] == c[1] and p[2] == c[2])


def is_hair_color(p) -> bool:
    if np.ndim(p) == 1 or (hasattr(p, "shape") and p.shape == (4,)):
        if int(p[3]) == 0:
            return False
        r, g, b = int(p[0]), int(p[1]), int(p[2])
        return g >= r - 8 and g > b - 4 and 90 < r < 210 and 100 < g < 220 and b < 200
    r = p[:, :, 0].astype(np.int16)
    g = p[:, :, 1].astype(np.int16)
    b = p[:, :, 2].astype(np.int16)
    a = p[:, :, 3]
    return (a > 0) & (g >= r - 8) & (g > b - 4) & (r > 90) & (r < 210) & (g > 100) & (g < 220) & (b < 200)


def is_skin_color(p) -> bool:
    if np.ndim(p) == 1 or (hasattr(p, "shape") and p.shape == (4,)):
        if int(p[3]) == 0:
            return False
        r, g, b = int(p[0]), int(p[1]), int(p[2])
        return r > 190 and g > 150 and b > 130 and (r - b) > 12
    r = p[:, :, 0].astype(np.int16)
    g = p[:, :, 1].astype(np.int16)
    b = p[:, :, 2].astype(np.int16)
    a = p[:, :, 3]
    return (a > 0) & (r > 190) & (g > 150) & (b > 130) & ((r - b) > 12)


def is_metal(p) -> bool:
    """Silver hoop only — must not match cream shirt #efe6d8."""
    if int(p[3]) == 0:
        return False
    r, g, b = int(p[0]), int(p[1]), int(p[2])
    mx, mn = max(r, g, b), min(r, g, b)
    return mn > 170 and (mx - mn) < 16 and abs(r - b) < 10


def is_ink(p) -> bool:
    if p[3] == 0:
        return False
    return int(p[0]) + int(p[1]) + int(p[2]) < 110


def is_eye_paint(p) -> bool:
    if p[3] == 0:
        return False
    r, g, b = int(p[0]), int(p[1]), int(p[2])
    if r > 230 and g > 220 and b > 210:
        return True  # dead white sclera
    if 140 < r < 220 and 50 < g < 150 and b < 90 and r > g + 20:
        return True  # iris
    if r < 45 and g < 35 and b < 30:
        return True  # pupil
    return False


def neighbor_non_eye(img: np.ndarray, x: int, y: int) -> tuple[int, int, int, int]:
    for dy, dx in ((0, -1), (0, 1), (-1, 0), (1, 0), (-1, -1), (-1, 1), (1, -1), (1, 1)):
        xx, yy = x + dx, y + dy
        if 0 <= xx < W and 0 <= yy < H and img[yy, xx, 3] > 0 and not is_eye_paint(img[yy, xx]):
            return tuple(int(v) for v in img[yy, xx])
    return HAIR


def paint_eye_open(img: np.ndarray, x0: int, y0: int) -> list[tuple[int, int]]:
    """Tired 4×3 eye: near-skin sclera + amber iris. Returns owned pixels."""
    owned: list[tuple[int, int]] = []

    def p(x, y, c):
        put(img, x, y, c)
        owned.append((x, y))

    # y0 = lid, y0+1 = iris row, y0+2 = lower lid (half-lidded / 没精神)
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


def draw_tail(img: np.ndarray) -> list[tuple[int, int]]:
    """Continuous thin dark tail, viewer-left / character-right hip, slight curl."""
    # Centerline (x, y), 2px thick (center + 1 toward outside).
    spine = []
    # emerge from hip
    for y, x in [
        (60, 22),
        (61, 21),
        (62, 20),
        (63, 19),
        (64, 18),
        (65, 17),
        (66, 16),
        (67, 16),
        (68, 16),
        (69, 16),
        (70, 16),
        (71, 17),
        (72, 17),
        (73, 17),
        (74, 18),
        (75, 18),
        (76, 19),
        (77, 19),
        (78, 20),
        (79, 20),
        (80, 21),
        (81, 21),
        (82, 22),
        (83, 23),
        (84, 24),
        (85, 24),
        (86, 23),
        (87, 22),
    ]:
        spine.append((x, y))
    owned = []
    for i, (x, y) in enumerate(spine):
        fill = OUTLINE if i == 0 or i == len(spine) - 1 else TAIL_C
        for dx, dy in ((0, 0), (1, 0), (0, 1)):
            xx, yy = x + dx, y + dy
            if 0 <= xx < W and 0 <= yy < H:
                # do not overwrite the main pants block (x>=22 and typical pants blue)
                if xx >= 24 and yy >= 66 and yy <= 100:
                    continue
                put(img, xx, yy, fill if dx == 0 and dy == 0 else OUTLINE)
                owned.append((xx, yy))
        # outline on the outside (left)
        put(img, x - 1, y, OUTLINE)
        owned.append((x - 1, y))
    # unique
    return list(dict.fromkeys(owned))


def color_lock(img: np.ndarray) -> None:
    """Snap clothing/hair masses toward locked hex without touching the official sheet."""
    pants_hi = (106, 120, 132)
    eye_white = (248, 244, 236)
    pierce = (200, 204, 210)
    for y in range(H):
        for x in range(W):
            p = img[y, x]
            if p[3] == 0:
                continue
            r, g, b = int(p[0]), int(p[1]), int(p[2])
            # dead eye-white anywhere → near-skin (will be redrawn on eyes)
            if (r, g, b) == eye_white[:3]:
                img[y, x] = SKIN if y < 50 else SHIRT
            if (r, g, b) == pierce[:3] or is_metal(p):
                img[y, x] = HAIR
            # pants highlight too light → slate
            if y > 55 and abs(r - pants_hi[0]) < 12 and abs(g - pants_hi[1]) < 12 and abs(b - pants_hi[2]) < 12:
                img[y, x] = PANTS
            # olive junk in hip-left is not a clog
            if y < 90 and x < 24 and 90 < r < 130 and 95 < g < 130 and b < 90:
                img[y, x] = TAIL_C if y > 58 else HAIR_SH


def strip_accessories(img: np.ndarray) -> None:
    """No hair clip, no ear hoops (not on 50.webp)."""
    # Known stray / jewelry from last gen.
    clip_pts = [
        (26, 13),
        (27, 13),
        (26, 14),
        (27, 14),
        (25, 15),
        (26, 15),
        (52, 3),
        (52, 4),
        (52, 5),
        (52, 6),
        (52, 7),
        (51, 4),
        (53, 4),
        (52, 17),
        (53, 17),
        (55, 16),
    ]
    for x, y in clip_pts:
        if img[y, x, 3] == 0:
            continue
        img[y, x] = EAR_TIP if y < 12 else HAIR
    # any remaining silver in ear band
    for y in range(0, 14):
        for x in range(20, 58):
            if is_metal(img[y, x]):
                img[y, x] = HAIR if 34 < x < 46 else EAR_TIP
    # dark clip-like 2px blocks in bangs (viewer's left)
    for y in range(10, 22):
        for x in range(24, 34):
            if not is_ink(img[y, x]):
                continue
            # isolated jewelry, not face outline
            n_ink = 0
            n_hair = 0
            for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
                q = img[y + dy, x + dx] if 0 <= y + dy < H and 0 <= x + dx < W else (0, 0, 0, 0)
                n_ink += int(is_ink(q))
                n_hair += int(is_hair_color(q))
            if n_hair >= 2 and n_ink <= 2 and x < 32:
                img[y, x] = HAIR


def clear_old_eyes(img: np.ndarray) -> None:
    """Remove 5×3 dead-white rectangles and stray iris on hair/outline."""
    for y in range(18, 34):
        for x in range(24, 56):
            if is_eye_paint(img[y, x]):
                # keep true outline of the face if it's the cheek edge
                if x <= 26 or x >= 52:
                    img[y, x] = neighbor_non_eye(img, x, y)
                    continue
                img[y, x] = SKIN if is_skin_color(neighbor_non_eye(img, x, y)) or (28 <= x <= 50) else neighbor_non_eye(
                    img, x, y
                )
    # explicit QA dirty points
    for x, y in ((52, 22), (26, 27), (26, 28), (48, 30), (31, 31), (35, 20), (43, 20), (44, 20)):
        if img[y, x, 3] > 0:
            img[y, x] = neighbor_non_eye(img, x, y)


def clean_pants_left(img: np.ndarray) -> None:
    """Drop mis-sliced hair/olive/peach on pants x<22; those become tail or empty."""
    for y in range(55, 90):
        for x in range(0, 22):
            if img[y, x, 3] == 0:
                continue
            r, g, b = int(img[y, x, 0]), int(img[y, x, 1]), int(img[y, x, 2])
            pants_like = abs(r - 74) < 20 and abs(g - 85) < 25 and abs(b - 96) < 25
            dark = r + g + b < 140
            if pants_like:
                continue
            if dark:
                continue  # tail / outline stay for draw_tail to overwrite
            # peach / hair / olive junk
            img[y, x] = (0, 0, 0, 0)


def composite(layers: dict[str, np.ndarray], names: list[str]) -> np.ndarray:
    out = np.zeros((H, W, 4), dtype=np.uint8)
    for name in names:
        lay = layers[name]
        m = lay[:, :, 3] == 255
        out[m] = lay[m]
    return out


def mask_from_pts(pts: list[tuple[int, int]]) -> np.ndarray:
    m = np.zeros((H, W), dtype=bool)
    for x, y in pts:
        if 0 <= x < W and 0 <= y < H:
            m[y, x] = True
    return m


def save_layer(name: str, src: np.ndarray, mask: np.ndarray) -> np.ndarray:
    out = np.zeros_like(src)
    out[mask] = src[mask]
    out[:, :, 3] = np.where(mask, 255, 0)
    Image.fromarray(out).save(LAYERS / name, "PNG")
    ys, xs = np.where(mask)
    box = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())) if mask.any() else None
    print(f"  {name:18s} {int(mask.sum()):5d} px  bbox={box}")
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
        "hair-front.png",
    ]
    k = 3
    cell_w, cell_h = W * k, H * k
    cols = 5
    rows = (len(names) + 2 + cols - 1) // cols
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

    for i, name in enumerate(names):
        blit(layers[name], i, name.replace(".png", ""))
    blit(composite(layers, IDLE_STACK), len(names), "composite-idle")
    blit(preview, len(names) + 1, "preview")
    sheet.save(OUT / "_preview-stack.png", "PNG")


def write_tray(preview: np.ndarray, ears: np.ndarray, hair: np.ndarray, head: np.ndarray, bangs: np.ndarray) -> None:
    headish = (head[:, :, 3] | hair[:, :, 3] | ears[:, :, 3] | bangs[:, :, 3]) > 0
    ys, xs = np.where(headish)
    x0, x1 = max(0, int(xs.min()) - 2), min(W - 1, int(xs.max()) + 2)
    y0, y1 = max(0, int(ys.min()) - 2), min(H - 1, int(ys.max()) + 2)
    crop = Image.fromarray(preview).crop((x0, y0, x1 + 1, y1 + 1))
    side = max(crop.size)
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.paste(crop, ((side - crop.size[0]) // 2, (side - crop.size[1]) // 2), crop)
    sq.resize((32, 32), Image.Resampling.NEAREST).save(OUT / "tray.png", "PNG")


def official_rmse(preview: np.ndarray) -> dict[str, float]:
    src = Image.open(OFFICIAL).convert("RGBA")
    a = np.array(src)
    raw = np.array(src.resize((W, H), Image.Resampling.BOX).convert("RGBA"))
    paper = (a[:, :, 0] >= 245) & (a[:, :, 1] >= 245) & (a[:, :, 2] >= 245)
    a[paper, 3] = 0
    knock = np.array(Image.fromarray(a).resize((W, H), Image.Resampling.BOX))
    near = np.array(src.resize((W, H), Image.Resampling.NEAREST).convert("RGBA"))

    def rmse(p, s, union: bool) -> float:
        m = (p[:, :, 3] > 0) | (s[:, :, 3] > 0) if union else np.ones(p.shape[:2], dtype=bool)
        d = p[:, :, :3].astype(np.float32) - s[:, :, :3].astype(np.float32)
        return float(np.sqrt((d[m] ** 2).mean()))

    return {
        "box_knock_union": round(rmse(preview, knock, True), 2),
        "box_raw_all": round(rmse(preview, raw, False), 2),
        "nearest_raw_all": round(rmse(preview, near, False), 2),
    }


def qa(layers: dict[str, np.ndarray], preview: np.ndarray, sheet: dict) -> dict:
    report: dict = {}
    sizes_ok = preview.shape[:2] == (H, W)
    for name, arr in layers.items():
        sizes_ok = sizes_ok and arr.shape[:2] == (H, W)
        au = np.unique(arr[:, :, 3])
        report[f"alpha_{name}"] = [int(v) for v in au]
        if not set(int(v) for v in au).issubset({0, 255}):
            sizes_ok = False
    au = np.unique(preview[:, :, 3])
    report["alpha_preview"] = [int(v) for v in au]
    report["sizes_80x112"] = bool(sizes_ok)

    idle = composite(layers, IDLE_STACK)
    report["idle_equals_preview"] = bool(np.array_equal(idle, preview))
    report["idle_mismatch_px"] = int(np.any(idle != preview, axis=2).sum())

    head_px = int((layers["head.png"][:, :, 3] > 0).sum())
    report["head_px"] = head_px
    for st in ("eyes-open.png", "eyes-half.png", "eyes-closed.png"):
        m = layers[st][:, :, 3] > 0
        ys, xs = np.where(m)
        report[st] = {
            "px": int(m.sum()),
            "bbox": [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())] if m.any() else None,
        }
    for st in ("mouth-closed.png", "mouth-open.png"):
        m = layers[st][:, :, 3] > 0
        ys, xs = np.where(m)
        report[st] = {
            "px": int(m.sum()),
            "bbox": [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())] if m.any() else None,
        }
    head_m = layers["head.png"][:, :, 3] > 0
    mouth_m = layers["mouth-closed.png"][:, :, 3] > 0
    report["head_cap_mouth_closed"] = int((head_m & mouth_m).sum())

    closed = composite(
        layers,
        [
            "tail.png",
            "clogs.png",
            "pants.png",
            "body-shirt.png",
            "hand.png",
            "head.png",
            "hair.png",
            "ears.png",
            "eyes-closed.png",
            "mouth-closed.png",
            "hair-front.png",
        ],
    )
    diff = np.any(closed != preview, axis=2)
    ys, xs = np.where(diff)
    report["blink_diff_px"] = int(diff.sum())
    report["blink_diff_bbox"] = [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())] if diff.any() else None
    # hair pixels in idle that changed
    hair_m = (layers["hair.png"][:, :, 3] > 0) | (layers["hair-front.png"][:, :, 3] > 0)
    hair_changed = 0
    hair_to_skin = 0
    for y, x in zip(ys, xs):
        if hair_m[y, x] and layers["eyes-open.png"][y, x, 3] == 0:
            hair_changed += 1
            if tuple(closed[y, x, :3]) == SKIN[:3]:
                hair_to_skin += 1
    report["blink_hair_changed_outside_open_eyes"] = hair_changed
    report["blink_hair_to_skin"] = hair_to_skin

    # closed must not paint skin over idle hair
    closed_eye = layers["eyes-closed.png"]
    skin_flash = 0
    for y, x in zip(*np.where(closed_eye[:, :, 3] > 0)):
        if tuple(closed_eye[y, x, :3]) == SKIN[:3] and is_hair_color(preview[y, x]):
            skin_flash += 1
    report["closed_skin_over_idle_hair"] = skin_flash

    tail_m = layers["tail.png"][:, :, 3] > 0
    tys, txs = np.where(tail_m)
    report["tail_px"] = int(tail_m.sum())
    report["tail_bbox_h"] = int(tys.max() - tys.min() + 1) if tail_m.any() else 0
    pants_m = layers["pants.png"][:, :, 3] > 0
    report["pants_xlt22"] = int((pants_m & (np.arange(W)[None, :] < 22)).sum())

    ears_m = layers["ears.png"][:, :, 3] > 0
    report["ears_px"] = int(ears_m.sum())
    report["rmse_official"] = official_rmse(preview)
    report["sheet_wh"] = [sheet["width"], sheet["height"]]
    report["sheet_stage"] = sheet["stage"]
    report["sheet_slots"] = sheet["slots"]
    return report


def opa(arr: np.ndarray) -> np.ndarray:
    return arr[:, :, 3] == 255


def main() -> None:
    """Patch the existing puppet in place. Do not recut the whole body from scratch."""
    LAYERS.mkdir(parents=True, exist_ok=True)
    orig = {p.name: load_rgba(p) for p in sorted(LAYERS.glob("*.png"))}
    img = composite(orig, IDLE_STACK)

    # Gentle lock: pants highlight + jewelry only.
    for y in range(H):
        for x in range(W):
            if img[y, x, 3] == 0:
                continue
            r, g, b = int(img[y, x, 0]), int(img[y, x, 1]), int(img[y, x, 2])
            if is_metal(img[y, x]):
                img[y, x] = HAIR if y > 10 else EAR_TIP
            if (r, g, b) == (248, 244, 236) and 18 <= y <= 34:
                img[y, x] = SKIN
            if y > 56 and abs(r - 106) < 12 and abs(g - 120) < 14 and abs(b - 132) < 14:
                img[y, x] = PANTS

    strip_accessories(img)
    clean_pants_left(img)
    clear_old_eyes(img)
    for y in range(25, 31):
        for x in list(range(31, 36)) + list(range(43, 48)):
            if img[y, x, 3] > 0 and not is_hair_color(img[y, x]):
                img[y, x] = SKIN

    eye_open_pts = paint_eye_open(img, 31, 26) + paint_eye_open(img, 43, 26)
    put(img, 47, 30, MOLE)
    tail_pts = draw_tail(img)
    for x in range(39, 43):
        img[39, x] = OUTLINE

    yy, xx = np.ogrid[:H, :W]
    masks = {name: opa(arr) for name, arr in orig.items()}

    eyes_open = mask_from_pts(eye_open_pts)
    eyes_open &= (yy >= 25) & (yy <= 28) & (xx >= 31) & (xx <= 46)
    half_map = {}
    half_map.update(paint_eye_half(31, 26))
    half_map.update(paint_eye_half(43, 26))
    closed_map = {}
    closed_map.update(paint_eye_closed(31, 26))
    closed_map.update(paint_eye_closed(43, 26))
    eyes_half = mask_from_pts(list(half_map))
    eyes_closed = mask_from_pts(list(closed_map))

    mouth_closed = np.zeros((H, W), dtype=bool)
    mouth_closed[39, 39:43] = True
    mouth_open = np.zeros((H, W), dtype=bool)
    mouth_open[39:42, 39:43] = True
    mouth_open_img = np.zeros_like(img)
    for y in range(39, 42):
        for x in range(39, 43):
            mouth_open_img[y, x] = OUTLINE if y in (39, 41) or x in (39, 42) else INK

    # Ears: keep only the two ear lobes from the original ear mask.
    ears = masks["ears.png"] & (yy <= 13) & (((xx >= 23) & (xx <= 35)) | ((xx >= 43) & (xx <= 55)))
    ears &= ~((xx >= 36) & (xx <= 42))
    dumped = masks["ears.png"] & ~ears
    hair_front = masks["hair-front.png"] | (dumped & (yy >= 10))
    hair = (masks["hair.png"] | (dumped & (yy < 10))) & ~ears
    hair_front &= ~ears
    hair &= ~ears & ~hair_front

    # Strip jewelry pixels still on ears/hair into hair color (already on img).
    for m in (ears, hair, hair_front):
        pass

    hand = masks["hand.png"]
    shirt = masks["body-shirt.png"]
    head = masks["head.png"] | mask_from_pts([(47, 30)])
    for x, y in eye_open_pts:
        head[y, x] = True
    head &= ~mouth_closed
    clogs = masks["clogs.png"] & (yy >= 92)
    pants = masks["pants.png"] & (yy >= 56) & (xx >= 21) & ~clogs
    for y, x in zip(*np.where(pants & (xx < 22))):
        r, g, b = int(img[y, x, 0]), int(img[y, x, 1]), int(img[y, x, 2])
        if not (abs(r - 74) < 22 and abs(g - 85) < 28 and b >= 70):
            pants[y, x] = False

    tail = mask_from_pts(tail_pts)
    tail &= ~clogs
    pants &= ~tail
    shirt &= ~hand
    hair &= ~eyes_open
    hair_front &= ~eyes_open

    layers: dict[str, np.ndarray] = {}
    head_src = img.copy()
    for x, y in eye_open_pts:
        head_src[y, x] = SKIN
    head_src[30, 47] = MOLE

    layers["tail.png"] = save_layer("tail.png", img, tail)
    layers["clogs.png"] = save_layer("clogs.png", img, clogs)
    layers["pants.png"] = save_layer("pants.png", img, pants)
    layers["body-shirt.png"] = save_layer("body-shirt.png", img, shirt)
    layers["hand.png"] = save_layer("hand.png", img, hand)
    layers["head.png"] = save_layer("head.png", head_src, head)
    layers["hair.png"] = save_layer("hair.png", img, hair)
    layers["ears.png"] = save_layer("ears.png", img, ears)
    layers["eyes-open.png"] = save_layer("eyes-open.png", img, eyes_open)

    half_img = np.zeros_like(img)
    for (x, y), c in half_map.items():
        half_img[y, x] = c
    layers["eyes-half.png"] = save_layer("eyes-half.png", half_img, eyes_half)

    closed_img = np.zeros_like(img)
    for (x, y), c in closed_map.items():
        closed_img[y, x] = c
    layers["eyes-closed.png"] = save_layer("eyes-closed.png", closed_img, eyes_closed)

    layers["mouth-closed.png"] = save_layer("mouth-closed.png", img, mouth_closed)
    layers["mouth-open.png"] = save_layer("mouth-open.png", mouth_open_img, mouth_open)
    layers["hair-front.png"] = save_layer("hair-front.png", img, hair_front)

    preview = composite(layers, IDLE_STACK)
    Image.fromarray(preview).save(OUT / "preview.png", "PNG")
    write_stack_sheet(layers, preview)
    write_tray(
        preview,
        layers["ears.png"],
        layers["hair.png"],
        layers["head.png"],
        layers["hair-front.png"],
    )

    my, mx = np.where(mouth_closed)
    mouth = {"x": round(float(np.median(mx) / W), 3), "y": round(float(np.median(my) / H), 3)}
    sheet = {
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
    (OUT / "sheet.json").write_text(json.dumps(sheet, indent=2) + "\n", encoding="utf-8")
    rep = qa(layers, preview, sheet)
    print(json.dumps(rep, indent=2))
    Path("/tmp/p-gen/_qa.json").write_text(json.dumps(rep, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
