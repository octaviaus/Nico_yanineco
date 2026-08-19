# P-Gen log — 80×112 layered pixel puppet

Agent: **P-Gen**. Branch: `cursor/p-gen-face-embed-c6be`. Writable: `assets/pixel/**` only.

Same character as PR #6; not a new gen, not a shrink/dither of `尼古喵喵角色图/50.webp`.

## This pass — embed face (keep blink/talk slots)

Goal: idle reads as **one face**, not `head` + pasted eye/mouth rectangles. Slots stay so `PixelRenderer` blink / talk / inhale / exhale still swap `eyes` and `mouth`.

Runnable: `python3 assets/pixel/_face_embed.py` (patches current PNGs in place; does not resample `50.webp`).

### Why not “just move the stickers”

Mole is locked at `head (47,30)`, so eyes **cannot** jump to y22–24 (that experiment left the mole floating on the cheek). Official 50.webp (reference only): lids sit just above that mole; mouth is about **one eye-height** under the lids, not on the collar.

The sticker look was competing ink, not only slot coordinates:

1. `hair-front` 5px hair bar at y29 x36–40, plus y28 specks — a second eyelid / fake mouth when eyes+mouth are hidden.
2. `body-shirt` ink at (39,39)/(41,39)/(42,39) and `hair` ink at (39,39) — a third mouth on the collar.
3. Closed mouth lived at y39 (11px below lids). Eye height is 3px.

### What changed (minimal)

- **Eyes** (still mole-relative, bbox `(31,26)–(46,28)`): almond, not a filled 4×3 box. Inner corner +1 on the iris row; bottom outer corners dropped. Open 24 / half 24 / closed **16 dark lids only** (no `#ecd6c4`). 1px bang overlap at `(31,26)` and `(46,26)` so lids sit under hair-front. Closed does not stamp skin on hair (`blink hair→skin = 0`, `closed_skin_over_idle_hair = 0`).
- **Mouth** moved to y33 x39–42 (4px line). Open stays a designed **4×3** cavity at y32–34 — not the rejected 9×5 enlarge. `sheet.json` mouth UV `y` 0.348 → **0.295** (x unchanged 0.506). Cigarette UV follows +0.06 / +0.01.
- **hair-front**: deleted the mid-face **bars only** (16 listed pixels). Did **not** shave x31–47. Side locks untouched. Center bang wisp at (39,24)–(39,25). Face-skin that was living on hair-front (10 px, x31–47) moved onto `head` (same idle colour, correct owner).
- **head**: +32 px vs master (360 → 392). Those are interior transfers / under-eye hole fills, **not** new cheek meat. Idle composite min/max x per row **unchanged** (grew rows = 0). Punch mouth-closed (head ∩ mouth-closed = **0**). Stray mid-face ink `(36,30)`, extra mole-coloured specks recolored. 1px nose shade at existing `(40,31)`. Mole still `(92,64,52)` at (47,30).
- **body-shirt / hair**: recolor/remove the y39 fake mouth. One cream pixel at (40,39) so dropping the old mouth layer does not leave a chin hole.
- **hand**: carry the already-specified opaque-black recolor (25 px `#000000` → skin/outline). `r+g+b==0` = **0**. Not a new design; do not revert.

Untouched vs master: `tail`, `clogs`, `pants`, `ears`. Stack / slots / poses / 80×112 / scale 3 unchanged.

### PIL self-test (this pass)

| Check | Result |
|-------|--------|
| preview + every layer 80×112, alpha ∈ {0,255} | **yes** |
| idle stack == preview, mismatch px | **0** |
| idle composite x-range grew (any row) | **0** |
| head px / delta vs master | **392 / +32** (interior; see outline note) |
| head ∩ mouth-closed | **0** |
| eyes-open / half / closed | **24 / 24 / 16** bbox (31,26)–(46,28) / closed (31,27)–(46,28) |
| mouth-closed / mouth-open | **4** (39,33)–(42,33) / **12** (39,32)–(42,34) |
| mid-face stray dark with eyes+mouth hidden | **[]** |
| blink diff px / bbox | 12 / (32,26)–(45,27) |
| blink hair→skin / closed skin over idle hair | **0 / 0** |
| mole `(47,30)` | `(92,64,52)` on `head` |
| hand opaque / `r+g+b==0` | **62 / 0** |
| shirt cream `#efe6d8` / pants `#4a5560` | 549 / **670** |
| hair-front px (was 241) | **217** |
| official 50.webp BOX raw-all RMSE | **213.83** |
| official NEAREST raw-all RMSE | **215.15** |
| official BOX knock-union RMSE | **94.41** (pre-repair preview was 97.1; not a shrink) |

Head-layer bbox grew on y25/y26/y29/y30/y31 because skin that already showed through hair-front now lives on `head`, plus under-eye fills. **Idle silhouette did not widen.**

### Impact on poses (slots kept)

| Pose | Still works? |
|------|----------------|
| idle | open eyes + closed mouth at the new seat |
| talk | mouth-open 4×3 at y32–34 |
| inhale | eyes-closed lids only; no skin flash on bangs |
| exhale | eyes-half + mouth-open |

Alternative if a later pass kills independent slots: bake idle into `head` and ship `head-blink` / `head-talk` variants. Not done here.

### Explicitly not done

- No shrink/dither of `50.webp`.
- No mass head fill (not 50–100+ cheek pixels).
- No `hair-front` x31–47 strip shave.
- No apps/**, packages/**, sprites, Live2D, config.json, weights.

## Not claimed

This log is evidence for a re-QA. Merge call is the reviewer’s.

---

## Prior: hand-only (PR #8, still draft on master)

Master still had 25 opaque `#000000` on `hand.png`. This branch includes that recolor so preview is not a black glove. Eyes/mouth were deferred there; this pass is that deferred work.

## Prior repair pass (after QA: 要修) — kept for history

### A. 眼睛三态遮罩

- Dropped the shared 41 px mask / 5×3 dead-white rectangles.
- Open/half/closed are two tired eyes; mole `(47,30)` on `head`, not the eyes slot.
- Closed: **only** dark lid pixels. No `#ecd6c4` fill.

### B. 细尾

- Continuous 2 px-ish dark grey tail. `tail.png` 79 px, bbox height 29.

### C. 饰品

- Recolored hoop/clip candidates to hair / ear-tip.

### D. 层卫生

- `ears.png` 382 → 212.
- Shirt mass was 545 px `#efe6d8` + 71 shadow. Pants mass 670 px `#4a5560`.
