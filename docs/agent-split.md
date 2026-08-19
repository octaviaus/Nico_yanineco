# Wave 1 拆分：AI 像素形象 + 云端 Agent

给**云端 Agent**和派工人读。契约已冻结。不要改层名、画布尺寸、JSON 字段名。

## 0. 先过这关，再开云端（本机 / 当前对话）

云端 Agent 从**远程仓库的干净 git**开工，**带不走**你电脑上没提交的文件，也带不走 `尼古喵喵角色图/` 里如果没进 git 的设定图。

本机必须先做完并 **push 到 Cloud Agent 能克隆的远程**（GitHub / GitLab / Azure DevOps / Bitbucket，且已在 [Integrations](https://cursor.com/dashboard/integrations) 连上）：

1. 把官方设定图放进仓库：`assets/ref/official-sheet.webp`（白底原图）以及 `assets/ref/official-sheet.png`（去底、去萌娘百科水印，P-Gen 优先用这张）。
2. 确认已提交：`docs/agent-split.md`、`AGENTS.md`、`.cursor/environment.json`、上述设定图。
3. `git push` 当前默认分支（下称 **基线**；本仓库是 `master`）。
4. 付费 Cursor 方案；在 [Cloud Agents 环境](https://cursor.com/dashboard/cloud-agents#environments) 用「让 Agent 配置环境」或直接吃仓库里的 `environment.json`（会装 pnpm 与 Pillow）。
5. 若要用云端 API 出图：在 Cloud Agents 的 Secrets 里加图像 API 密钥（例如 `OPENAI_API_KEY`）。没有密钥时，P-Gen 仍须走「模型出图 / 图生图」路径，禁止把立绘一键马赛克当成成品。

过关后再按第九节开 **5 个 Cloud Agent**。

---

## 1. Wave 1 全貌

| 代号 | 云端分支 | 干什么 | 可与谁同时开 |
|------|----------|--------|----------------|
| **P-Gen** | `agent/p-gen` | **AI 生成**像素风分层木偶 | 全部（只写 `assets/pixel` 与脚本） |
| **P-Puppet** | `agent/p-puppet` | 渲染器读分层图、窗口改矮 | 不要和别人抢 geometry / PixelRenderer |
| **V-Timbre** | `agent/v-timbre` | 默认女声、语速偏慢 | 全部 |
| **R-Smoke** | `agent/r-smoke` | 全屏烟空闲停转 | 不要和别人抢 `windows.ts` |
| **S-Speech** | `agent/s-speech` | 按句播放 + 口型 RMS | 不要和别人抢 `character.ts` / `main/index.ts` |

P-Gen **不堵**另外四个：P-Puppet 无 PNG 时用色块占位。P-Gen 的 PR 合入后占位会被真层替换。

Wave 2（克隆音色、LLM 流式、hide 烟窗）**现在不要开**。

---

## 2. 冻结契约（P-Gen 与 P-Puppet）

真源：`assets/ref/official-sheet.png`（去底优先）或 `assets/ref/official-sheet.webp`。桌宠主体不是全身立绘。

| 项 | 值 |
|----|----|
| 源画布 | `80×112`，透明底 |
| 放大 | `3×`，Pixi `SCALE_MODES.NEAREST` |
| 舞台 | `240×336` |
| 角色窗 | `240×456` |
| 锚点 | `(0.5, 1)` 脚贴底 |
| 风格 | 限色像素（约 16–22 色），禁止抗锯齿、禁止把立绘直接缩小冒充像素画 |

### 必须锁住的辨识点

灰绿凌乱短发、同色猫耳、左眼下痣、半眯颓眼、过大米白 T、暗蓝垮裤、橄榄绿洞洞鞋、细深灰尾。香烟不要画进身体层。

### 层文件（文件名不得改）

`assets/pixel/layers/`，与画布同尺寸，位置锁定后直接叠。下 → 上：

`clogs.png` · `pants.png` · `tail.png` · `body-shirt.png` · `head.png`（脸+颈，不含眼嘴）· `hair.png` · `ears.png` · `eyes-open.png` / `eyes-half.png` / `eyes-closed.png` · `mouth-closed.png` / `mouth-open.png` / `mouth-smoke.png` · 可选 `cigarette.png`

### `assets/pixel/sheet.json`（P-Gen 写，P-Puppet 只读）

```json
{
  "width": 80,
  "height": 112,
  "scale": 3,
  "scaleMode": "nearest",
  "origin": "top-left",
  "anchor": { "x": 0.5, "y": 1 },
  "mouth": { "x": 0.52, "y": 0.28 },
  "layers": ["clogs", "pants", "tail", "body-shirt", "head", "hair", "ears"],
  "eyes": ["open", "half", "closed"],
  "mouths": ["closed", "open", "smoke"]
}
```

只允许改 `mouth` 的数值。

### 渲染选择

`createCharacterRenderer`：有 `sheet.json` 且至少 `body-shirt`+`head` → PixelRenderer；否则 Live2D；否则全身精灵。`CharacterRenderer.kind` 增加 `'pixel'`。方法签名不准改。

| 调用 | 层 |
|------|----|
| idle | 眼 open/half，嘴 closed |
| talk | `setMouthOpen` 切嘴 |
| inhale | 眼更眯，嘴 closed |
| exhale | 嘴 smoke 或 open |
| 眨眼 | PixelRenderer 每 4–7s 切 closed 一帧 |

---

## 3. P-Gen · AI 生成像素形象（核心）

这不是「手绘 Aseprite」，也不是 `Image.resize(80,112)`。必须用**生成模型**出像素风角色，再切成对齐的层。

### 可写

- `assets/pixel/**`（`preview.png`、`layers/`、`sheet.json`、`_preview-stack.png`、可选 `tray.png`）
- `assets/pixel/gen-log.md`（用了哪个模型、提示词、哪一张入选）
- `scripts/gen-pixel-puppet.py`（切层 / 量化 / 去底；生成步骤也可写在这里）
- `docs/pixel-spec.md`（只记录调色板与生成备注，不改层名）

### 禁止

任何 `.ts` / `.css` / `.html`，`assets/sprites/**`，`assets/live2d-layers/**`，改 `assets/ref/official-sheet.*`。

### 生成流程（必须按此，不要跳成滤镜）

1. **读参考** 优先 `assets/ref/official-sheet.png`，否则 `official-sheet.webp`。按辨识点写死提示词（中英均可，但要写清 mole under left eye、oversized cream tee、baggy slate pants、olive clogs、sage messy pixie hair、cat ears same color as hair、lazy half-lidded eyes、thin dark tail）。明确：`pixel art`、`limited palette`、`no anti-aliasing`、`chibi about 4 heads tall`、`full body T-pose-ish idle`、`transparent background`、`sprite for desktop pet`。
2. **出 2–4 张候选**。优先顺序：
   - 云端/Cursor 可用的图像生成工具，并把设定图当作参考图（img2img / reference）；
   - Secrets 里的图像 API（OpenAI Images、同类）；
   - 本机若有生成工具也可用。
3. **禁止当成品：** 仅 PIL/近邻缩小设定图、仅调色板抖动、用另一只猫/兽形顶替。量化只能作为生成后再收边的**后处理**。
4. **选 1 张** idle 合成图，去底，限色到 16–22 色，最近邻落到 **80×112**，存 `assets/pixel/preview.png`。
5. **表情差分（同一姿势、同一身体）：** 只重绘眼/嘴区域（inpaint 或局部 img2img）得到 blink / mouth-open / mouth-smoke 三张全身对齐图，不要另生成一张脸。
6. **切层：** 用脚本按颜色/区域从 idle 抽出身体层；眼、嘴用「差分图 − idle」得到。叠放后必须能还原 preview。导出 `_preview-stack.png` 给验收。
7. **量嘴坐标** 写入 `sheet.json`。从头+耳裁 `tray.png`（16 或 32px，最近邻）。

### 完成标准

- 必选层都在，透明底，80×112。
- `_preview-stack.png` 和 `preview.png` 对得上，不是四只不同的角色。
- `gen-log.md` 写清模型与提示词。闭眼能认出痣、耳、垮裤、洞洞鞋。
- 提交标题：`assets(pixel): AI-generated layered pixel puppet`

### 失败时

API/工具都不可用：在 PR 说明里写清缺什么密钥，**不要**用马赛克立绘充数合入。可以留脚本骨架，但不要把滤镜图标成完成。

---

## 4. P-Puppet · 像素渲染

- **可写：** `apps/desktop/src/renderer/lib/PixelRenderer.ts`、`pixelSheet.ts`、`createCharacterRenderer.ts`、`CharacterRenderer.ts`（只加 `'pixel'`）、`apps/desktop/src/shared/geometry.ts`、`character.html`、`character.css`、`apps/desktop/src/main/tray.ts`（有 `assets/pixel/tray.png` 则优先）、`README.md` 一句默认像素木偶。
- **禁止：** `character.ts`、`windows.ts`、`smoke.ts`、`SmokeField.ts`、`main/index.ts`、`packages/**`、`assets/pixel/**`（只读）、不要删 `SpriteRenderer.ts`。
- **缺资源：** 用 Graphics 色块按层名占位，证明眨眼和 `setMouthOpen`。
- **完成：** `npx pnpm@9.15.0 --filter @niko/desktop build` 通过；舞台 240×336。
- **提交：** `feat(desktop): pixel puppet renderer`

---

## 5. V-Timbre · 女声

- **可写：** `packages/voice/src/index.ts`、`config.example.json`；`packages/core/src/types.ts` 仅当增加可选 `tts.rate`。
- **禁止：** `config.json`、`apps/desktop/**`、`chat.ts`、`persona.ts`。不要接 GPT-SoVITS 模型。
- **做法：** 默认 `zh-CN-XiaoyiNeural` 或 `zh-CN-XiaoxuanNeural`，语速约 0.85 / SSML `-20%`；SAPI 回退选中文女声。保留 `local` → `9880`。
- **提交：** `fix(voice): default to slow female Edge voice`

---

## 6. R-Smoke · 烟窗降耗

- **可写：** `smoke.ts`、`SmokeField.ts`、`windows.ts`、`smoke.html`。
- **禁止：** `character.ts`、`geometry.ts`、`main/index.ts`、`preload/**`、像素文件。
- **做法：** 烟窗 `resolution: 1`、关 antialias；无粒子停 Ticker；删掉 `smoke.ts` 里按 `idlePuffSeconds` 额外 spawn 的 interval。`backgroundThrottling` 可改回 `true`。不要做「hide 整个烟窗」（那是 Wave 2，要改 main）。
- **提交：** `perf(desktop): idle-stop fullscreen smoke ticker`

---

## 7. S-Speech · 播放链路

- **可写：** `apps/desktop/src/main/index.ts`（`speak` / `handleUtterance`）、`character.ts`；必要时 `preload/index.ts` 与 `env.d.ts` **只加字段**，保留 `base64`。
- **禁止：** `packages/voice/**`、`geometry.ts`、`windows.ts`、`smoke.ts`、PixelRenderer。
- **做法：** 按 `。！？…` 切句先播；尽量走临时文件而不是整段 base64；`AnalyserNode` → `setMouthOpen`；可打断。
- **提交：** `feat(desktop): queued speech playback and mouth rms`

---

## 8. 给每个 Cloud Agent 的提示词

下面整段复制到**一条新的 Cloud 对话**里。把 `<BASE>` 换成已 push 的基线分支名（**本仓库是 `master`**）。

### 公共头（每条都要带）

```
你是 Cursor 云端 Agent。仓库是尼古喵喵桌宠。
基线分支：<BASE>。请从该分支创建并只在 agent/<ID> 上工作，完成后开 Pull Request，不要推默认分支。
先读 AGENTS.md 与 docs/agent-split.md 里你的代号整节 + 第二节契约。
只改「可写」路径。禁止列表碰了会和其他并行 Agent 冲突。
做完即停。不要做 Wave 2，不要切 Live2D 层，不要提交 config.json 或模型权重。
```

### P-Gen（ID = `p-gen`）

公共头 +：

```
你是 P-Gen。按 docs/agent-split.md 第 3 节：用图像生成模型做出像素风猫耳少女，再切成 80×112 对齐分层。
参考图：优先 assets/ref/official-sheet.png，否则 official-sheet.webp。禁止把该图直接缩小/抖动当成成品。
交付 assets/pixel/preview.png、layers/*.png、sheet.json、_preview-stack.png、gen-log.md。
提交标题：assets(pixel): AI-generated layered pixel puppet
```

### P-Puppet（ID = `p-puppet`）

公共头 + 第 4 节原文任务 + 提交标题 `feat(desktop): pixel puppet renderer`

### V-Timbre（ID = `v-timbre`）

公共头 + 第 5 节 + `fix(voice): default to slow female Edge voice`

### R-Smoke（ID = `r-smoke`）

公共头 + 第 6 节 + `perf(desktop): idle-stop fullscreen smoke ticker`

### S-Speech（ID = `s-speech`）

公共头 + 第 7 节 + `feat(desktop): queued speech playback and mouth rms`

---

## 9. 你怎么让云端 Agent 执行

不要在这一条本地对话里塞五个任务。每个 Cloud Agent 必须是**独立运行、独立分支、独立 PR**。

### 做法 A · Cursor 桌面（推荐）

1. 新开 Agent 对话（不要复用正在写方案的这一条）。
2. 输入框下方模式选 **Cloud**（不要选 Local）。
3. 确认仓库是本仓库、基线是已 push 的 `<BASE>`。
4. 粘贴第八节对应提示词，发送。
5. 对其余 4 个代号重复 1–4。最多可同时开多个。
6. 在 [cursor.com/agents](https://cursor.com/agents) 看进度、截图和 PR。

「Move to Cloud」**不会**带上未提交的本地改动。所以必须先做第 0 节 push。

### 做法 B · 网页

打开 [cursor.com/agents](https://cursor.com/agents) → New Agent → 选仓库 + 基线分支 → 贴提示词。同样开 5 次。

### 做法 C · 让「当前这条本地 Agent」代开

第 0 节 push 成功后，在**本对话**说「基线已推，请按 agent-split 开五个云端 Agent」。本地 Agent 会用 Cloud 子 Agent 从远程基线拉起（未 push 的分支会失败）。

### 合 PR 顺序

1. V-Timbre、R-Smoke  
2. P-Puppet  
3. P-Gen（纯资源，随时可进）  
4. S-Speech  
5. 再开 Wave 2（Stream 与 Shell 都改 `main/index.ts`，不能对开）

---

## 10. Wave 2（五支 PR 都进基线之后）

| 代号 | 做什么 |
|------|--------|
| W2-Clone | 本机 9880 克隆说明；模型不进 git |
| W2-Stream | LLM 流式 + 按句 TTS |
| W2-Shell | hide 烟窗、点击穿透、隐藏停画 |
| W2-SFX | 吸吐短 WAV |

W2-Stream 与 W2-Shell 串行。
