#!/usr/bin/env python3
"""Embed eyes/mouth into the existing 80×112 puppet face.

Does NOT shrink 尼古喵喵角色图/50.webp. Does NOT recut a new character.
Patches layers in place: competing mid-face hair bars, fake mouth ink on
shirt/hair, almond eye slots nested at the mole, mouth raised to ~1 eye-height
below the lids. Hair-front side locks are left alone (no cheek widening).
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

OUTLINE = (32, 30, 28, 255)
INK = (18, 16, 14, 255)
SKIN = (236, 214, 196, 255)  # #ecd6c4
SKIN_SH = (214, 176, 156, 255)
SKIN_DK = (168, 140, 120, 255)
HAIR = (154, 163, 146, 255)  # #9aa392
HAIR_HI = (196, 202, 186, 255)
HAIR_SH = (110, 118, 104, 255)
SHIRT = (239, 230, 216, 255)  # #efe6d8
SHIRT_SH = (214, 204, 186, 255)
IRIS = (168, 96, 40, 255)
IRIS_DK = (110, 62, 26, 255)
PUPIL = (28, 20, 16, 255)
LID = (42, 34, 30, 255)
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

# Mole is locked. Eyes stay on the row above it (y26–28).
MOLE_XY = (47, 30)
# Closed mouth: 4px line, ~1 eye-height under the lids (not the old chin y39).
MOUTH_Y = 33
MOUTH_X0, MOUTH_X1 = 39, 43  # [x0, x1)


def load_rgba(path: Path) -> np.ndarray:
    a = np.array(Image.open(path).convert("RGBA"))
    a[:, :, 3] = np.where(a[:, :, 3] >= 128, 255, 0)
    return a


def put(img: np.ndarray, x: int, y: int, rgba: tuple[int, int, int, int]) -> None:
    if 0 <= x < W and 0 <= y < H:
        img[y, x] = rgba


def clear(img: np.ndarray, x: int, y: int) -> None:
    if 0 <= x < W and 0 <= y < H:
        img[y, x] = (0, 0, 0, 0)


def composite(layers: dict[str, np.ndarray], names: list[str]) -> np.ndarray:
    out = np.zeros((H, W, 4), dtype=np.uint8)
    for name in names:
        lay = layers[name]
        m = lay[:, :, 3] == 255
        out[m] = lay[m]
    return out


def save_arr(name: str, arr: np.ndarray) -> None:
    arr = arr.copy()
    arr[:, :, 3] = np.where(arr[:, :, 3] >= 128, 255, 0)
    Image.fromarray(arr).save(LAYERS / name, "PNG")
    m = arr[:, :, 3] > 0
    ys, xs = np.where(m)
    box = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())) if m.any() else None
    print(f"  {name:18s} {int(m.sum()):5d} px  bbox={box}")


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


def is_hair_color(p) -> bool:
    if int(p[3]) == 0:
        return False
    r, g, b = int(p[0]), int(p[1]), int(p[2])
    return g >= r - 8 and g > b - 4 and 90 < r < 210 and 100 < g < 220 and b < 200


def is_skin_color(p) -> bool:
    if int(p[3]) == 0:
        return False
    r, g, b = int(p[0]), int(p[1]), int(p[2])
    return r > 190 and g > 150 and b > 130 and (r - b) > 12


def bbox_of(arr: np.ndarray) -> list[int] | None:
    m = arr[:, :, 3] > 0
    if not m.any():
        return None
    ys, xs = np.where(m)
    return [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]


def head_outline(head: np.ndarray) -> dict[int, tuple[int, int]]:
    out: dict[int, tuple[int, int]] = {}
    for y in range(H):
        xs = np.where(head[y, :, 3] > 0)[0]
        if len(xs):
            out[y] = (int(xs.min()), int(xs.max()))
    return out


def outline_grew(before: dict[int, tuple[int, int]], after: dict[int, tuple[int, int]]) -> list[str]:
    """True growth = new min-x smaller or new max-x larger on a shared row."""
    notes = []
    for y, (x0, x1) in after.items():
        if y not in before:
            notes.append(f"new-row y{y} x{x0}-{x1}")
            continue
        bx0, bx1 = before[y]
        if x0 < bx0 or x1 > bx1:
            notes.append(f"y{y} {bx0}-{bx1} -> {x0}-{x1}")
    return notes


def paint_eyes() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Tired almond eyes, mole-relative. Not a filled 4×3 sticker box.

    Left  (viewer): x31–35. Right (character left / mole side): x42–46.
    Bottom outer corners dropped so lids read as almonds, not rectangles.
    Closed = dark lids only (no skin). Top lid row stays on open/half so blink
    does not stamp skin; hair-front may cover the outer-top 1px bang overlap.
    """
    open_img = np.zeros((H, W, 4), dtype=np.uint8)
    half_img = np.zeros((H, W, 4), dtype=np.uint8)
    closed_img = np.zeros((H, W, 4), dtype=np.uint8)

    def stamp(dst: np.ndarray, pts: dict[tuple[int, int], tuple[int, int, int, int]]) -> None:
        for (x, y), c in pts.items():
            put(dst, x, y, c)

    # Open: heavy top lid, iris row, tapered bottom.
    open_pts: dict[tuple[int, int], tuple[int, int, int, int]] = {}
    # left
    for x in range(31, 35):
        open_pts[(x, 26)] = LID
    open_pts[(31, 27)] = LID
    open_pts[(32, 27)] = IRIS
    open_pts[(33, 27)] = PUPIL
    open_pts[(34, 27)] = IRIS_DK
    open_pts[(35, 27)] = LID  # inner corner, 5-wide iris row
    for x in range(32, 35):
        open_pts[(x, 28)] = LID
    # right (do not paint x47 — mole column)
    for x in range(43, 47):
        open_pts[(x, 26)] = LID
    open_pts[(42, 27)] = LID
    open_pts[(43, 27)] = IRIS
    open_pts[(44, 27)] = PUPIL
    open_pts[(45, 27)] = IRIS_DK
    open_pts[(46, 27)] = LID
    for x in range(43, 46):
        open_pts[(x, 28)] = LID
    stamp(open_img, open_pts)

    # Half: lids crush the iris; a 2px peek on the bottom inner.
    half_pts: dict[tuple[int, int], tuple[int, int, int, int]] = {}
    for x in range(31, 35):
        half_pts[(x, 26)] = LID
        half_pts[(x, 27)] = LID
    half_pts[(35, 27)] = LID
    half_pts[(32, 28)] = IRIS_DK
    half_pts[(33, 28)] = PUPIL
    half_pts[(34, 28)] = LID
    for x in range(43, 47):
        half_pts[(x, 26)] = LID
        half_pts[(x, 27)] = LID
    half_pts[(42, 27)] = LID
    half_pts[(43, 28)] = LID
    half_pts[(44, 28)] = PUPIL
    half_pts[(45, 28)] = IRIS_DK
    stamp(half_img, half_pts)

    # Closed: only lids on the iris + bottom rows. No #ecd6c4.
    closed_pts: dict[tuple[int, int], tuple[int, int, int, int]] = {}
    for x in range(31, 36):
        closed_pts[(x, 27)] = LID
    for x in range(32, 35):
        closed_pts[(x, 28)] = LID
    for x in range(42, 47):
        closed_pts[(x, 27)] = LID
    for x in range(43, 46):
        closed_pts[(x, 28)] = LID
    stamp(closed_img, closed_pts)

    return open_img, half_img, closed_img


def paint_mouths() -> tuple[np.ndarray, np.ndarray]:
    closed = np.zeros((H, W, 4), dtype=np.uint8)
    opened = np.zeros((H, W, 4), dtype=np.uint8)
    for x in range(MOUTH_X0, MOUTH_X1):
        put(closed, x, MOUTH_Y, OUTLINE)
    # Designed 4×3 cavity at the same origin — not a 9×5 enlarge.
    for x in range(MOUTH_X0, MOUTH_X1):
        put(opened, x, MOUTH_Y - 1, OUTLINE)
        put(opened, x, MOUTH_Y + 1, OUTLINE)
        put(opened, x, MOUTH_Y, OUTLINE if x in (MOUTH_X0, MOUTH_X1 - 1) else INK)
    return closed, opened


def fix_hand(hand: np.ndarray) -> np.ndarray:
    """Carry the already-reviewed opaque-black recolor (PR #8). Do not revert."""
    mapping = {
        (20, 56): OUTLINE,
        (21, 56): OUTLINE,
        (18, 57): OUTLINE,
        (19, 57): OUTLINE,
        (20, 57): SKIN,
        (21, 57): OUTLINE,
        (16, 58): OUTLINE,
        (17, 58): OUTLINE,
        (18, 58): SKIN,
        (19, 58): SKIN,
        (20, 58): SKIN,
        (21, 58): OUTLINE,
        (16, 59): OUTLINE,
        (18, 59): OUTLINE,
        (19, 59): OUTLINE,
        (20, 59): SKIN,
        (21, 59): OUTLINE,
        (15, 60): OUTLINE,
        (16, 60): OUTLINE,
        (18, 60): OUTLINE,
        (20, 60): OUTLINE,
        (18, 61): OUTLINE,
        (19, 61): OUTLINE,
        (17, 62): OUTLINE,
        (18, 62): OUTLINE,
    }
    out = hand.copy()
    for (x, y), c in mapping.items():
        if out[y, x, 3] > 0 and int(out[y, x, 0]) + int(out[y, x, 1]) + int(out[y, x, 2]) == 0:
            out[y, x] = c
    return out


def qa(layers: dict[str, np.ndarray], preview: np.ndarray, sheet: dict, head0: np.ndarray) -> dict:
    report: dict = {}
    sizes_ok = preview.shape[:2] == (H, W)
    for name, arr in layers.items():
        sizes_ok = sizes_ok and arr.shape[:2] == (H, W)
        au = {int(v) for v in np.unique(arr[:, :, 3])}
        report[f"alpha_{name}"] = sorted(au)
        if not au.issubset({0, 255}):
            sizes_ok = False
    au = {int(v) for v in np.unique(preview[:, :, 3])}
    report["alpha_preview"] = sorted(au)
    report["sizes_80x112"] = bool(sizes_ok)

    idle = composite(layers, IDLE_STACK)
    report["idle_equals_preview"] = bool(np.array_equal(idle, preview))
    report["idle_mismatch_px"] = int(np.any(idle != preview, axis=2).sum())

    report["head_px"] = int((layers["head.png"][:, :, 3] > 0).sum())
    report["head_px_delta"] = report["head_px"] - int((head0[:, :, 3] > 0).sum())
    report["head_outline_grew"] = outline_grew(head_outline(head0), head_outline(layers["head.png"]))

    for st in ("eyes-open.png", "eyes-half.png", "eyes-closed.png", "mouth-closed.png", "mouth-open.png"):
        m = layers[st][:, :, 3] > 0
        report[st] = {"px": int(m.sum()), "bbox": bbox_of(layers[st])}

    head_m = layers["head.png"][:, :, 3] > 0
    mouth_m = layers["mouth-closed.png"][:, :, 3] > 0
    report["head_cap_mouth_closed"] = int((head_m & mouth_m).sum())

    mole = layers["head.png"][MOLE_XY[1], MOLE_XY[0]]
    report["mole"] = [int(v) for v in mole]

    hand = layers["hand.png"]
    hm = hand[:, :, 3] > 0
    report["hand_opaque"] = int(hm.sum())
    report["hand_black"] = int((hm & (hand[:, :, :3].sum(2) == 0)).sum())

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

    hair_m = (layers["hair.png"][:, :, 3] > 0) | (layers["hair-front.png"][:, :, 3] > 0)
    hair_to_skin = 0
    closed_eye = layers["eyes-closed.png"]
    for y, x in zip(ys, xs):
        if hair_m[y, x] and layers["eyes-open.png"][y, x, 3] == 0:
            if tuple(closed[y, x, :3]) == SKIN[:3]:
                hair_to_skin += 1
    report["blink_hair_to_skin"] = hair_to_skin

    skin_flash = 0
    for y, x in zip(*np.where(closed_eye[:, :, 3] > 0)):
        if tuple(closed_eye[y, x, :3]) == SKIN[:3] and is_hair_color(preview[y, x]):
            skin_flash += 1
    report["closed_skin_over_idle_hair"] = skin_flash

    # Face-center dark leftovers that are not the real eyes/mouth/mole.
    fake = []
    eye_m = layers["eyes-open.png"][:, :, 3] > 0
    for y in range(26, 42):
        for x in range(32, 47):
            p = preview[y, x]
            if p[3] == 0:
                continue
            if eye_m[y, x] or mouth_m[y, x]:
                continue
            if (x, y) == MOLE_XY:
                continue
            if int(p[0]) + int(p[1]) + int(p[2]) < 140:
                fake.append([x, y, int(p[0]), int(p[1]), int(p[2])])
    report["midface_stray_dark"] = fake

    report["rmse_official"] = official_rmse(preview)
    report["sheet_wh"] = [sheet["width"], sheet["height"]]
    report["sheet_mouth"] = sheet["mouth"]
    report["sheet_slots"] = sheet["slots"]
    return report


def main() -> None:
    LAYERS.mkdir(parents=True, exist_ok=True)
    orig = {p.name: load_rgba(p) for p in sorted(LAYERS.glob("*.png"))}
    head0 = orig["head.png"].copy()

    head = orig["head.png"].copy()
    hf = orig["hair-front.png"].copy()
    hair = orig["hair.png"].copy()
    shirt = orig["body-shirt.png"].copy()
    hand = fix_hand(orig["hand.png"].copy())

    # --- hair-front: drop the mid-face horizontal bars (the 「两根怪线」).
    # Side locks (x<=30 or x>=48) stay. Do not shave x31–47 as a strip.
    hf_drop = [
        (36, 28),
        (41, 28),
        (42, 28),  # hair at lid row, between / inner-right of eyes
        (36, 29),
        (37, 29),
        (38, 29),
        (39, 29),
        (40, 29),  # 5px bar under the eyes
        (31, 30),
        (41, 30),
        (42, 30),
        (46, 30),  # hair sitting on the under-eye / beside the mole
        (32, 31),
        (36, 31),
        (42, 31),
        (46, 31),  # leftover dark/hair specks on the mid face
    ]
    dropped_holes: list[tuple[int, int]] = []
    for x, y in hf_drop:
        if hf[y, x, 3] > 0:
            clear(hf, x, y)
            dropped_holes.append((x, y))

    # Move center-face SKIN that currently lives on hair-front onto head.
    # Same idle colour, correct ownership. Skip side pixels (x<=30 / x>=48).
    transferred = 0
    for y in range(24, 36):
        for x in range(31, 48):
            p = hf[y, x]
            if p[3] == 0:
                continue
            if (x, y) == MOLE_XY:
                continue  # mole stays visible on both; head already has it
            if is_skin_color(p) or tuple(p[:3]) == MOLE[:3]:
                if head[y, x, 3] == 0:
                    head[y, x] = p
                    transferred += 1
                elif tuple(p[:3]) == MOLE[:3]:
                    head[y, x] = p
                clear(hf, x, y)

    # Minimal hole fill: only the exact pixels we just un-covered, and only if
    # head is empty there. Budget is a handful of interior skin dots.
    filled = 0
    for x, y in dropped_holes:
        if head[y, x, 3] == 0:
            put(head, x, y, SKIN)
            filled += 1

    # Center bang wisp BETWEEN the eyes (official has a strand there), not a
    # horizontal bar under them.
    if hf[24, 39, 3] == 0:
        put(hf, 39, 24, HAIR_SH)
    if hf[25, 39, 3] == 0:
        put(hf, 39, 25, HAIR)
    # 1px bang overlap on the outer-top lid so the eye is under hair, not a sticker.
    put(hf, 31, 26, HAIR)
    put(hf, 46, 26, HAIR)

    # --- head: kill stray mid-face ink that reads as extra moles / a fake nose.
    for x, y, c in [
        (36, 30, SKIN_SH),  # was (58,58,62)
        (41, 29, SKIN_DK),  # extra mole-coloured speck
        (43, 31, SKIN),  # extra mole next to the real one
        (45, 31, SKIN_SH),
    ]:
        if head[y, x, 3] > 0:
            put(head, x, y, c)
    put(head, *MOLE_XY, MOLE)
    # Tiny nose on existing skin (no new pixel): shade at the column between the eyes.
    if head[31, 40, 3] > 0:
        put(head, 40, 31, SKIN_DK)

    eyes_open, eyes_half, eyes_closed = paint_eyes()
    mouth_closed, mouth_open = paint_mouths()

    # Sockets under the new eye pixels must be skin (blink reveals head, not a hole).
    for y, x in zip(*np.where(eyes_open[:, :, 3] > 0)):
        if head[y, x, 3] == 0:
            put(head, x, y, SKIN)
            filled += 1

    # Interior under-eye gaps (y28–29) used to be the hair-front bar. Fill only
    # pixels already inside the face (2+ opaque neighbors, x32–46) — not cheeks.
    def n_opaque(img: np.ndarray, x: int, y: int) -> int:
        n = 0
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            xx, yy = x + dx, y + dy
            if 0 <= xx < W and 0 <= yy < H and img[yy, xx, 3] > 0:
                n += 1
        return n

    # Temporary idle without eyes/mouth, to see true face holes.
    tmp = {
        "tail.png": orig["tail.png"],
        "clogs.png": orig["clogs.png"],
        "pants.png": orig["pants.png"],
        "body-shirt.png": shirt,
        "hand.png": hand,
        "head.png": head,
        "hair.png": hair,
        "ears.png": orig["ears.png"],
        "hair-front.png": hf,
    }
    face_now = composite(
        tmp,
        [
            "tail.png",
            "clogs.png",
            "pants.png",
            "body-shirt.png",
            "hand.png",
            "head.png",
            "hair.png",
            "ears.png",
            "hair-front.png",
        ],
    )
    for y in range(27, 32):
        for x in range(32, 47):
            if face_now[y, x, 3] > 0:
                continue
            if n_opaque(face_now, x, y) >= 2 and n_opaque(head, x, y) >= 1:
                put(head, x, y, SKIN_SH if y == 29 else SKIN)
                filled += 1
                face_now[y, x] = head[y, x]

    # Punch closed-mouth pixels out of head (contract: head ∩ mouth-closed = 0).
    for x in range(MOUTH_X0, MOUTH_X1):
        clear(head, x, MOUTH_Y)

    # --- fake mouth on shirt / hair at the OLD y39 line.
    for x, y in [(39, 39), (41, 39), (42, 39)]:
        if shirt[y, x, 3] > 0:
            put(shirt, x, y, SHIRT)
    if shirt[39, 40, 3] == 0:
        put(shirt, 40, 39, SHIRT)  # was only the mouth layer; avoid a chin hole
    if hair[39, 39, 3] > 0:
        clear(hair, 39, 39)

    layers = {
        "tail.png": orig["tail.png"],
        "clogs.png": orig["clogs.png"],
        "pants.png": orig["pants.png"],
        "body-shirt.png": shirt,
        "hand.png": hand,
        "head.png": head,
        "hair.png": hair,
        "ears.png": orig["ears.png"],
        "eyes-open.png": eyes_open,
        "eyes-half.png": eyes_half,
        "eyes-closed.png": eyes_closed,
        "mouth-closed.png": mouth_closed,
        "mouth-open.png": mouth_open,
        "hair-front.png": hf,
    }

    print(f"transferred_hf_skin_to_head={transferred}  hole_fills={filled}")
    for name, arr in layers.items():
        save_arr(name, arr)

    preview = composite(layers, IDLE_STACK)
    Image.fromarray(preview).save(OUT / "preview.png", "PNG")
    write_stack_sheet(layers, preview)
    write_tray(preview, layers["ears.png"], layers["hair.png"], layers["head.png"], layers["hair-front.png"])

    # 5× diagnostics (review only; not a runtime asset).
    Image.fromarray(preview).resize((W * 5, H * 5), Image.Resampling.NEAREST).save("/tmp/preview-5x.png", "PNG")
    no_em = composite(
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
            "hair-front.png",
        ],
    )
    Image.fromarray(no_em).resize((W * 5, H * 5), Image.Resampling.NEAREST).save("/tmp/preview-no-em-5x.png", "PNG")

    my, mx = np.where(mouth_closed[:, :, 3] > 0)
    mouth = {"x": round(float(np.median(mx) / W), 3), "y": round(float(np.median(my) / H), 3)}
    sheet_path = OUT / "sheet.json"
    sheet = json.loads(sheet_path.read_text(encoding="utf-8"))
    sheet["mouth"] = mouth
    sheet["cigarette"] = {"x": round(mouth["x"] + 0.06, 3), "y": round(mouth["y"] + 0.01, 3)}
    sheet_path.write_text(json.dumps(sheet, indent=2) + "\n", encoding="utf-8")

    rep = qa(layers, preview, sheet, head0)
    print(json.dumps(rep, indent=2))
    Path("/tmp/p-gen-face-embed-qa.json").write_text(json.dumps(rep, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
