# P-Gen log — 80×112 layered pixel puppet

Agent: **P-Gen**. Branch: `agent/p-gen`. Writable: `assets/pixel/**` only.

Same character as PR #6; not a new gen, not a shrink/dither of `尼古喵喵角色图/50.webp`.

## Repair pass (after QA: 要修)

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
