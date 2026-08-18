# P-Gen log — 80×112 layered pixel puppet

Agent: **P-Gen**. Branch: `agent/p-gen`. Writable path: `assets/pixel/**` only.

`AGENTS.md` and `docs/agent-split.md` were not on `master` when this run started (repo still at the initial desktop-pet commit). Work followed the user brief (split doc §3) and the §2-style contract implied by sibling P-Puppet: canvas **80×112**, stage **240×336** (3× nearest), exclusive `eyes` / `mouth` slots, `assets/pixel/tray.png` for the tray icon.

## What this is not

- Not a shrink / dither of `尼古喵喵角色图/50.webp` or `assets/sprites/idle.png`.
- No Wave 2, no Live2D layer recut, no `config.json`, no model weights.
- Did not touch `apps/**`, `packages/**`, `assets/sprites/**`, `assets/live2d-layers/**`, or `docs/**`.

## Reference

Preferred `assets/ref/official-sheet.png` (then `.webp`) — **missing** on this tree.

Visual identity only (not the pixel source):

- `尼古喵喵角色图/50.webp` — official standing sheet
- `assets/sprites/idle.png` — knockout of the same character

Locked look: cat-ear girl, messy sage/ash short hair, tired amber eyes, mole under **her left eye** (viewer’s right), oversized cream T, baggy slate pants, olive clogs, thin dark tail. No cigarette drawn on the sprite (smoke stays particles).

## Image model

Cursor image generation (pixel-art prompt, 3:4, magenta `#FF00FF` backdrop, official PNGs as reference images).

Two drafts; **gen-b** kept (deadpan face, hair clip, ear hoops, closer palette). Raw output was 1024×1536 RGB with ~80k colors — “pixel-style” illustration, not a native 80×112 grid. Proof crop (not the official sheet): `_source-gen.png`.

## Slice pipeline (`_slice.py`)

1. Chroma-key magenta + despill.
2. Letterbox crop to 80:112 (full body, no squash).
3. `BOX` downsample to **80×112**, binary alpha.
4. Snap to a 24-color palette taken from the visual brief (`#9aa392` hair, `#efe6d8` shirt, `#4a5560` pants, `#6b7348` clogs) — no ordered dither.
5. Spatial reclass so hair-shadow olive cannot become shoes on the face, and vice versa.
6. Paint readable eyes / closed-mouth line / mole on the grid.
7. Semantic masks on the **same canvas** (position-locked PNG layers).
8. Exclusive eye/mouth variants: `open | half | closed` and `closed | open`.

Idle composite opaque pixel count matches `preview.png` (2962 px).

## Deliverables

| Path | Role |
|------|------|
| `preview.png` | 80×112 idle composite, transparent |
| `layers/*.png` | aligned 80×112 RGBA parts |
| `sheet.json` | canvas, z-stack, slots, poses, mouth UV |
| `_preview-stack.png` | 3× checker strip of every layer + composite |
| `gen-log.md` | this file |
| `tray.png` | 32×32 head crop (P-Puppet prefers this over sprites tray) |
| `_slice.py` | reproducible slice |
| `_source-gen.png` | 160×224 proof of the model crop |

### Layer stack (back → front)

`tail` → `clogs` → `pants` → `body-shirt` → `hand` → `head` → `hair` → `ears` → **eyes slot** → **mouth slot** → `hair-front`

Head has no baked eyes/mouth. P-Puppet should show exactly one eyes state and one mouth state.

### Poses

| pose | eyes | mouth |
|------|------|-------|
| idle | open | closed |
| talk | open | open |
| inhale | closed | closed |
| exhale | half | open |

Mouth UV (texture 0–1, origin top-left): `(0.506, 0.348)`.

## Notes for P-Puppet

- Scale layers with **nearest-neighbor ×3** to fill the 240×336 stage.
- Anchor `(0.5, 1.0)` — feet on the bottom of the stage.
- Blink = swap `eyes-open` → `eyes-closed` (or `half`).
- `setMouthOpen` = swap `mouth-closed` → `mouth-open`.
- Missing files: placeholders keyed by `layers[].name` still work if they match this list.
