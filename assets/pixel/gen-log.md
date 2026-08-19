# P-Gen log — 80×112 layered pixel puppet

Agent: **P-Gen**. Branch: `cursor/p-gen-hand-mouth-d2ba` (same puppet as merged PR #6). Writable: `assets/pixel/**` only.

Same character as PR #6; not a new gen, not a shrink/dither of `尼古喵喵角色图/50.webp`.

## Follow-up (hand / mouth, after PR #6 + PixelRenderer)

Only two leftovers from post-merge QA. Eyes / tail / ears / shirt / pants / clogs / mole were not redrawn.

### A. Hand — drop opaque `#000000`

- `layers/hand.png` had 25 opaque pixels with `r+g+b==0` (read as a black glove/whip).
- Recolored those to nearby skin / outline: fill `#ecd6c4` `(236,214,196)` and `#e8d4c4`-adjacent shade `(214,176,156)`, edge `(32,30,28)`. No cigarette, whip, or jewelry drawn.
- Opaque count still **62**. `hand` opaque `r+g+b==0` count **0**.
- Lower palm `y56–65` is skin + outline only. `tray.png` not touched: the former blacks sit below the head crop (`y≥56`; head crop ends `y53`).

### B. Mouth — enlarge `mouth-open`

- Was 12 px (4×3) at `(39–42, 39–41)`; 3× scale made talking invisible.
- Redrew in place: bbox `(36,38)–(44,42)` = **9×5**, **41 px**. Lip ring `(140,88,80)`, cavity `(28,20,16)` / mid `(48,28,28)`.
- `mouth-closed` still the 4 px line `(39–42, 39)`. `head ∩ mouth-closed = 0`.
- `mouth-open ∩ hair-front = 0` (41 px visible). No new face generated.
- `sheet.json` mouth UV left at `{x: 0.506, y: 0.348}` (closed-mouth center). Open centroid would be ~`(0.500, 0.357)`; closed line did not move.

Idle stack re-exported to `preview.png` and `_preview-stack.png`. Mismatch **0**.

## PIL self-test (this follow-up)

| Check | Result |
|-------|--------|
| preview + every layer 80×112, alpha ∈ {0,255} | **yes** |
| idle stack == preview, mismatch px | **0** |
| hand opaque / `r+g+b==0` | **62 / 0** |
| mouth-closed | 4 px `(39,39)–(42,39)` |
| mouth-open | **41 px**, bbox `(36,38)–(44,42)` = 9×5 |
| head ∩ mouth-closed | **0** |
| mouth-open ∩ hair-front | **0** |
| head / eyes-open / half / closed | 360 / **24** / **24** / **16** |
| eyes bbox (open) | (31,26)–(46,28) |
| blink hair→skin / closed skin over idle hair | unchanged (eyes layers not edited) |
| tail opaque / bbox height | **79 / 29** |
| mole `(47,30)` | `(92,64,52)` on `head` |
| ears px | 212 |
| shirt cream `#efe6d8` / pants slate `#4a5560` | 545 / 670 |
| `sheet.json` width/height/scale/stack/slots/poses | **unchanged** |

`sheet.json` contract unchanged: 80×112, scale 3, stage 240×336, stack order, `slots.eyes` open/half/closed, `slots.mouth` closed/open, poses idle/talk/inhale/exhale.

## Prior repair pass (after QA: 要修) — kept for history

### A. 眼睛三态遮罩

- Dropped the shared 41 px mask / 5×3 dead-white rectangles.
- Open/half/closed are two 4×3 tired eyes at `(31–34, 26–28)` and `(43–46, 26–28)`.
- Open: lid + amber iris + pupil (sclera is near-skin, not `#f8f4ec`).
- Closed: **only** dark lid pixels (16 px). No `#ecd6c4` fill.
- Head stores skin in the sockets underneath; blink reveals head/hair, not a skin stamp on hair.
- Mole `(47, 30)` is on `head.png`, not the eyes slot.
- Stray eye pixels `(52,22)` / `(26,27)` etc. removed from the eyes layers.

### B. 细尾

- Drew a continuous 2 px-ish dark grey tail, hip on viewer-left, slight curl. `tail.png` 79 px, bbox height 29.
- Subtracted that mask from `pants`. Pants `x<22` leftover = 1 px of actual slate at the hip edge `(21,64)`.

### C. 饰品

- Recolored hoop/clip candidates (silver via tight chroma; listed dark clip points) to hair / ear-tip. Official sheet has none.

### D. 层卫生

- `ears.png` 382 → 212; only the two ear lobes (`y≤13`, left/right, gap 36–42 is hair).
- Dumped former ear leftovers into `hair` / `hair-front`.
- Mouth still 4 px closed line / 12 px (4×3) open; `head ∩ mouth-closed = 0`.
- Shirt mass locked: 545 px `#efe6d8` `(239,230,216)` + 71 shadow. Pants mass 670 px `#4a5560`. Clogs unchanged olive.

`preview.png`, `_preview-stack.png`, `tray.png` re-exported from the idle stack.

## PIL self-test (this pass)

| Check | Result |
|-------|--------|
| preview + every layer 80×112, alpha ∈ {0,255} | **yes** |
| idle stack == preview, mismatch px | **0** |
| head px / eyes-open / half / closed | 360 / **24** / **24** / **16** |
| eyes bbox (open) | (31,26)–(46,28) on the face |
| mouth-closed / mouth-open | 4 px (39,39)–(42,39) / 12 px (39,39)–(42,41) |
| head ∩ mouth-closed | **0** |
| blink diff px / bbox | 14 / (31,26)–(46,27) eye band only |
| blink hair→skin / closed skin over idle hair | **0 / 0** |
| per open-eye pixel closed-check fails | **0** |
| tail opaque / bbox height | **79 / 29** (≥60 and ≥20) |
| pants opaque x&lt;22 | 1 (slate hip, not junk) |
| ears px | 212 |
| official 50.webp BOX raw-all RMSE | **214.19** |
| official NEAREST raw-all RMSE | **215.51** |
| official BOX knock-union RMSE | 95.6 (same formula on pre-repair preview was 97.1; not a shrink) |

`sheet.json` contract unchanged: 80×112, scale 3, stage 240×336, stack order, `slots.eyes` open/half/closed, `slots.mouth` closed/open, poses idle/talk/inhale/exhale.

## Not claimed

This log is evidence for a re-QA. Merge call is the reviewer’s.
