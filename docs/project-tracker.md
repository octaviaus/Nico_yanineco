# 尼古喵喵 · 项目推进板

**用途**：记录开发进度、管理进行中需求、规划后续方案。  
**读者**：人类维护者、Cursor **云端** Agent、Cursor **本地** Agent。  
**真源**：本文档解释「现在到哪、谁在做、下一步做什么」；与代码冲突时以 **已合入 `master` 的实现** 为准，然后回来改本文档。

> 本地 Agent 和云端 Agent **用同一份文件、同一套规则**。不要另开 `TODO.md` / 对话备忘来代替本板。

---

## 0. Agent 协议（每次任务都要走）

### 0.1 开工前

1. 读本文档（至少：§1 快照、§2 进行中、§3 建议下一件）。
2. 读 [AGENTS.md](../AGENTS.md)。若会并行改代码，再读 [agent-split.md](./agent-split.md) 里自己的「可写 / 禁止」。
3. `git fetch` 后确认「当前基线」仍是最新 `origin/master`；过期则先改基线表再开工。

### 0.2 认领（防止两个 Agent 抢同一需求）

1. 在对应 ID 行把状态改为 `in_progress`，填写 **负责人**（`local` / `cloud`）、**分支**、可选 **PR**。
2. **一个 ID 同时只能有一个负责人。** 已有 `in_progress` 且分支还在：不要重做，去帮它收尾或另选 ID。
3. 用户新口头需求：先在本板分配下一个 `REQ-xxx`（见 §1 快照「下一 ID」），再写代码。同一条 PR 里带上本板更新。
4. 代码锁：并行 Wave 派工时仍以 `agent-split.md` 的可写路径为准。  
   **例外：所有 Agent 都可以改本文件**（见 0.5）。Wave 1 已结束后，若推进板上没有别人占用同一文件，单个 Agent 可以改该需求所需的源码（仍禁止 `config.json` / `.env` / 模型权重 / `assets/live2d-layers/`）。

### 0.3 做完 / 阻塞 / 放弃

| 何时 | 本板怎么改 |
|------|------------|
| PR 已合入或用户验收 | 该 ID → `done`；更新 §1 基线；§8 追加一行 |
| 缺密钥 / 缺本机验收 / 等用户拍板 | → `blocked`，写清缺什么 |
| 方案被替代 | → `cancelled`，指向新 ID |
| 明确以后再做 | → `deferred` |
| 自己的 PR 关掉、不再做 | 清掉认领，状态回到 `planned`，不要假装 `done` |

### 0.4 并发改本文件时怎么避免打结

- **只改**：§1 基线表、自己认领的那一行、自己的 REQ 卡片、§8 末尾追加一行。
- **不要**：重排章节、重命名已有 ID、整篇重写、改别人的认领行。
- 冲突时：变更日志 **两行都留**；认领以「有分支/PR 证据」的那行为准。

### 0.5 可写范围（推进板 vs 代码）

| 路径 | 谁可写 |
|------|--------|
| `docs/project-tracker.md`（本文件） | **所有** 本地 / 云端 Agent |
| `AGENTS.md` / `docs/agent-split.md` | 仅当任务就是改 Agent 契约或本板入口时 |
| 其它源码与资源 | 见 `agent-split.md` 各代号；无并行冲突时见 0.2.4 |

---

## 状态词

| 状态 | 含义 |
|------|------|
| `done` | 已合入 `master`，或用户已书面验收 |
| `in_progress` | 有负责人 + 分支（最好还有 PR） |
| `planned` | 已排入，尚未认领 |
| `blocked` | 方案已知，缺前置 |
| `deferred` | 故意延后 |
| `cancelled` | 作废或被新 ID 取代 |

没有分支 / PR / 用户当场指派的工作，**不要**标 `in_progress`。

---

## 1. 当前快照

| 项 | 值 |
|----|-----|
| 默认分支 | `master` |
| 当前 tip | `2a16e25` — Merge PR #14（路 B：关闭 ×、停 22s interval、opaque PTT） |
| 像素资产 | `e7e425a` — 240×336 分层 idle（`assets/pixel/`，见 `gen-log.md`） |
| 视觉主路径 | 像素木偶；`createCharacterRenderer` **固定**走 `PixelRenderer`（Live2D 接管是长期项 BL-02） |
| 舞台 / 角色窗 | 舞台 `240×336`；窗 `240×432`（`geometry.ts`） |
| TTS 默认 | Edge `zh-CN-XiaoyiNeural`，`rate: 0.85` |
| Wave 1 | **完成**（#2 #3 #4 #5 #6 + 文档 #10） |
| 推进板 / Epic | **完成** · PR #12 已合入；重复草稿 #11 已关未合 |
| P0 第一批 | **完成**：#15 A · #16 B · #17 C · #18 D 已在 `master` |
| PetDex 旁路 | **完成** · PR #19 `petdex/`（桌宠运行时不读） |
| Wave 1.5 路 B | **完成** · PR #14 `2a16e25`。W15-02/04 本机过；W15-03 空闲嘴烟用户接受 |
| Wave 2 / P0 第二批 | P0-E **完成** · PR #23（本机打断过）。可派 P0-G；P0-F 仍可并行（只 `packages/voice`）。H 等 G |
| 下一 REQ | `REQ-003` |
| 下一 ISS | `ISS-08` |
| 下一 BL | `BL-08` |
| 下一 W15 | `W15-08` |

### 开放 PR / 远程分支

无开放产品 PR。P0-E 分支 `cursor/pet-phase-wiring-barge-in-1098` 合入后可删远程。

`character.ts` / `main/index.ts` 已释放（P0-E 合入）。不要再派第二套 P0-A～D、第二条路 B、或第二套 P0-E。

---

## 2. 进行中需求

无进行中产品需求。P0-E 已合入。

**现在可派：** P0-G（ST-VIZ-03，占 `character.ts` / `main`）；P0-F（ST-VOICE-03，只 voice，若尚未开工）。
**先别派：** P0-H（等 G）、W2-Stream / Clone / SFX。
不要为 W15-03 去改 `SmokeField`。不要再派 A～D、路 B、或第二套 P0-E。

---

## 3. 开发进度

### Wave 1 — 像素主路径 + 语音烟窗（已完成）

| ID | 内容 | 证据 | 状态 |
|----|------|------|------|
| W1-01 | 像素渲染器默认路径 | PR #4 `fd2e984` | `done` |
| W1-02 | 分层像素资产（初版） | PR #6 | `done` |
| W1-03 | 240×336 官方 idle 资产落地 | `e7e425a` | `done` |
| W1-04 | 默认慢速女声 Edge TTS | PR #3 | `done` |
| W1-05 | 全屏烟窗空闲停 Ticker | PR #2 | `done` |
| W1-06 | 按句 TTS 队列 + RMS 口型 | PR #5 `aa3d52b` | `done` |
| W1-07 | Cloud Agent 环境与拆分文档 | `15fc40a` | `done` |
| W1-08 | 契约文档对齐 240×336 @ scale=1 | PR #10 `5a17d58` | `done` |
| W1-09 | 推进板（本文件） | REQ-001 · PR #12 `ed5f63b` | `done` |

### Wave 1.5 — 体验收尾（建议在 Wave 2 前做带 ★ 的）

| ID | 内容 | 优先级 | 状态 | 建议改哪里 | 备注 |
|----|------|--------|------|------------|------|
| W15-01 ★ | 本机非脸部验收（启动/聊/TTS/口型/拖/PTT/烟） | P0 | `done` | 不改代码 | **用户口头验收**（2026-08-20）；无书面分项报告 |
| W15-02 ★ | 角色窗「关闭桌宠」 | P0 | `done` | PR #14 `2a16e25` | 本机过：× → `niko.quit()` → `app.quit()` |
| W15-03 | 去掉角色窗 22s `setInterval` 自动吐烟 | P1 | `done` | PR #14 `2a16e25` | interval 已删。空闲嘴边细烟用户接受。见 ISS-01 |
| W15-04 | 透明像素不要触发按住说话 | P1 | `done` | PR #14 `2a16e25` | 本机过：opaque-only PTT；不是点击穿透 |
| W15-05 | `mouth-smoke.png` 接入 exhale | P2 | `planned` | `assets/pixel/sheet.json` + `PixelRenderer` | 文件已在 `layers/`，但 `slots.mouth` 只有 `closed`/`open` |
| W15-06 | 像素脸/手继续 polish | P1 | `deferred` | **只** `assets/pixel/**` | 用户确认新像素资产已落地（`e7e425a` / `assets/pixel/`）。未再要求重画 |
| W15-07 | 把设定图拷到 `assets/ref/official-sheet.png` | P1 | `cancelled` | — | **不是**像素资产任务。旧派工约定的别名；真源已在 `尼古喵喵角色图/`，产物已在 `assets/pixel/`。已改正文契约 |

历史尝试（不要当现行任务）：PR #7 手+嘴、#8 只接手、#9 眼嘴嵌入脸 —— 均 `CLOSED`。

### P0 第一批（包级，已合入 `master`）

| Agent | Story | PR | 状态 |
|-------|--------|-----|------|
| P0-A | ST-STATE-01 状态机类型 | #15 `57a69ef` | `done` |
| P0-B | ST-STATE-02 PixelRenderer 切层 | #16 `9dabe5f` | `done` |
| P0-C | ST-VOICE-01 可选 VAD | #17 `99e8607` | `done` |
| P0-D | ST-VIZ-01/02 AgentPhase + CLI 解析 | #18 `9afb386` | `done` |
| 旁路 | PetDex/Codex 包 `petdex/` | #19 `b8a83da` | `done`（非桌宠运行时） |

桌面接线：P0-E **已合入**；P0-F 只 voice 可并行；P0-G 可派；P0-H 等 G。

### P0 第二批（桌面接线，尚未开工）

| Agent | Story | 何时 | 独占 | 状态 |
|-------|--------|------|------|------|
| P0-E | ST-STATE-03 + ST-VOICE-02 | 已合入 | `character.ts`、`main/index.ts` | `done` · PR #23 · 本机过 |
| P0-F | ST-VOICE-03 | **现在** ∥ E | `packages/voice/**` | `planned` |
| P0-G | ST-VIZ-03 | **可派**（E 已合入） | `character.ts`、`main` 转发 | `planned` |
| P0-H | Shell hide + 点击穿透 | 等 G 合入 | `windows.ts`、`smoke.ts`、`main`、`character.ts` | `blocked` |

---

## 4. 后续开发方案

### 4.0 派工图（2026-08-20 更新）

Wave 1 功能已在 `master`。像素运行时资产已落地，**不要再开 P-Gen / 不要做 C 路**。

**你先做（人）：** 派 P0-E 与 P0-F（提示词 `docs/pm-epics-p0-p1.md` §6.2）。不要再派 A～D / 路 B。不要为 W15-03 去改 `SmokeField`。

#### 路况

| 路 | ID | 状态 | 谁 | 说明 |
|----|-----|------|----|------|
| A | W15-01 | **`done`** | 本地 / 用户 | 用户确认本机验收已做完 |
| B | W15-02+03+04 | **`done` · PR #14** | 已合入 `2a16e25` | 02/04 本机过；03 空闲细烟用户接受。`character.ts` / `main` 已释放 |
| C | W15-07 | **`cancelled`** | — | 只是把设定图再拷到 `assets/ref/`。**不是**新像素图。源图已在 `尼古喵喵角色图/`，木偶已在 `assets/pixel/` |
| D | W15-06 | **`deferred`** | — | 用户确认像素资产已处理好。除非再说「脸还要改」，否则不要重画 |

**路 B 审查（2026-08-20，对照 `origin/master` @ `046c8d1`）**

| 项 | 结论 |
|----|------|
| 范围 | 三个 ID 都在 PR #14：`character.html/css/ts`、preload、`env.d.ts`、`main/index.ts` |
| GitHub | OPEN · **draft** · `MERGEABLE` / `CLEAN` · 无 review / 无 CI |
| 构建 | `npx pnpm@9.15.0 --filter @niko/desktop build` 通过（独立 worktree） |
| 未做（正确） | 无 `setIgnoreMouseEvents`；未改 `smoke.ts` / `windows.ts` / 像素资产 |
| 合入卫生 | 已 merge `origin/master`，丢掉过期 tracker 全文，只留认领/验收日志 |
| 本机验收 | **2026-08-20 用户**：W15-02 × **过**；W15-04 透明不 PTT **过**；W15-03 仍有空闲嘴烟，**接受**。残留来自 `SmokeField.tick` idleRate，不是 22s `setInterval` |

剩下和 B 可并行的小文档：ISS-04 README 仍写 Live2D 会接管——可并进 B 或单独一条，别碰 `character.ts`。

#### 两套图不要混

| 路径 | 是什么 | 桌宠读它吗 |
|------|--------|------------|
| `尼古喵喵角色图/` | 官方设定（白底 `50.webp`、去底 `nico_miaomiao_transparent.png`） | 否 |
| `assets/pixel/` | 已经切好的 240×336 分层木偶 | **是**（运行时） |
| `assets/ref/` | 旧云端提示词里的别名，**仓库里没有、也不需要再建** | 否 |
| `petdex/`（PR #19） | 给 PetDex/Codex 的 192×208 精灵表导出 | 否 |

#### 必须本地（云端可以写代码，但不能当验收通过）

| ID | 为什么必须本地 |
|----|----------------|
| W15-02/03/04 的**点一下验收** | 关闭、误触 PTT、自动吐烟只能在真桌面确认 |
| W15-06 若以后重开 | 脸/手是否还像设定图 |
| W2-01 克隆音色 | 要本机 9880 / GPT-SoVITS，权重不进 git |
| Cursor 桥 `dispatch_cursor` | 调的是你电脑上的 Cursor CLI |
| `config.json` / API 密钥 / TTS 权重 | 禁止进 git，只在本机 |

#### 现在不要并行 / 不要开

| ID | 原因 |
|----|------|
| W15-05 与 W15-06 | 都动嘴层 / `sheet.json`。两者目前都不开，除非用户再要求 |
| W2-02 与 W2-03 | 都改 `main/index.ts`，**串行** |
| 整波 Wave 2 壳（Stream/Shell/SFX 接线） | W15-02 已合入。Stream 与 Shell 仍 **串行** |
| P0-E / G / H | `character.ts` / `main` 同时只能一个：先 E，再 G，再 H。P0-F 只动 voice，可与 E 并行 |
| 两个云端同时改 `character.ts` 或同时改 `assets/pixel/**` | 必冲突 |

#### Wave 2 以后怎么拆（先别派）

| ID | 云端能否写 | 并行？ | 本地还要做什么 |
|----|------------|--------|----------------|
| W2-01 Clone | 只能写说明 / `config.example.json` | 可与 W2-04 并行 | **本机**跑 9880 才算完成 |
| W2-02 Stream | 能写 `packages/core` + `main/index.ts` | **不能**与 W2-03 同时 | 本机听「边生成边出声」 |
| W2-03 Shell | 能写 `windows.ts` / 烟窗 / `main` | **不能**与 W2-02 同时 | 本机试 hide、点击穿透 |
| W2-04 SFX | 能加 wav + 小播放逻辑 | 避开 `main/index.ts` 时可与 Clone 并行 | 本机听吸/吐 |

### 4.1 建议下一件（无人指定任务时按此取）

1. 派 **P0-E** + **P0-F**（§6.2）。E 占 `character.ts` / `main`；F 只占 `packages/voice`。
2. 不要现在开 P0-G / P0-H。不要再开路 B 或 P0-A～D。
3. 已合入的功能分支可删。不要改 `assets/pixel/` 去对齐 `petdex/`。不要为 W15-03 去改 `SmokeField`。

路 B 已有 PR，下面提示词仅备查，不要再开第二条路 B。

### 路 B 提示词（整段复制）

```
你是 Cursor 云端 Agent。仓库是尼古喵喵桌宠（github.com/octaviaus/Nico_yanineco）。

基线：origin/master。从该分支新建自己的功能分支，完成后开 Pull Request，不要推 master，不要复用 docs/project-tracker 那条文档分支。

先读 AGENTS.md。若仓库里已有 docs/project-tracker.md，再读它：认领 W15-02、W15-03、W15-04（三个 ID 同一负责人、同一 PR），开工标 in_progress 并写上分支名。

任务（路 B，必须同一个 Agent 做完，禁止拆成三个并行 PR）：

1) W15-02 角色窗关闭桌宠
- 现在只能托盘「退出」。window-all-closed 故意不退出（托盘保活）。
- 在角色窗顶栏加一个小「×」（#drag 那一行右侧）。按钮必须 -webkit-app-region: no-drag，不要让整个顶栏都不能拖。
- 点击 → preload 暴露 niko.quit() → ipc → 主进程 app.quit()。不要只用 BrowserWindow.close()：关窗不会退出进程。
- 托盘「退出」保留，走同一条 quit。
- 样式跟现有米白/石板灰 UI，别做成大号系统标题栏。

2) W15-03 去掉角色窗自动吐烟
- apps/desktop/src/renderer/character.ts 的 boot() 里有 window.setInterval，按 idlePuffSeconds（默认 22s）自动 setPose('exhale') + mouthSmoke.burst。删掉这段 interval。
- 保留：托盘「吐一口」、对话/工具触发的烟、按住说话时的 inhale。
- 不要改 smoke.ts / SmokeField 的全屏烟窗 idle-stop（那是已完成的 R-Smoke）。
- config 里的 idlePuffSeconds 字段可以留着不删；角色窗只要不再用它自动喷。

3) W15-04 透明像素不要开始按住说话
- 现状：#stage 的 canvas 任意左键 pointerdown 都 startHold()（PTT）。
- 改成：只有点到角色不透明像素才 PTT。点到窗口里角色周围的全透明处不要录音。
- 热键 Ctrl+Shift+M、顶栏拖动、输入框、「喷」按钮不受影响。
- 这不是 Wave 2 的点击穿透（不要 setIgnoreMouseEvents 让鼠标点到后面的桌面）。只是不要在透明处启动录音。
- 注意 Pixi resolution / devicePixelRatio，坐标要对准 canvas 像素。嘴边粒子尽量别当成身体；可用 alpha 阈值（例如 <16 当透明）。

可写（尽量只动这些）：
- apps/desktop/src/renderer/character.html
- apps/desktop/src/renderer/character.css
- apps/desktop/src/renderer/character.ts
- apps/desktop/src/preload/index.ts
- apps/desktop/src/env.d.ts
- apps/desktop/src/main/index.ts（只加 quit IPC，不要趁机做 LLM 流式或 hide 烟窗）
- docs/project-tracker.md（仅认领/状态/变更日志，禁止整篇重排）

禁止：
- assets/pixel/**、像素重画、assets/ref、Live2D 切层
- packages/voice/**、packages/core/**（除非类型必须）
- smoke.ts、SmokeField.ts、windows.ts、geometry.ts
- config.json、.env、模型权重
- Wave 2（流式 TTS、hide 烟窗、点击穿透）
- W15-05 mouth-smoke 接入

验证：
- npx pnpm@9.15.0 --filter @niko/desktop build 必须通过
- 无头云 VM 不要 pnpm dev，不要假装点过窗口；在 PR 里写明本机还需验收：关×、等 22s 不再自动吐烟、点透明处不录音、点身体仍可按住说话、托盘退出仍在
- 提交标题：feat(desktop): close button, stop idle puff, opaque-only PTT
- 做完即停
```
3. 不要开 C、不要重做像素资产。W15-05 仅在你想让吐烟切 `mouth-smoke` 层时再做。
P0/P1 细拆与 **可复制提示词** 见 [pm-epics-p0-p1.md](./pm-epics-p0-p1.md) §6。四条 P0 不能同时改桌面：现在并行 P0-A～D；接线/打断/换脸/穿透见第二批。

### 4.2 Wave 2（启动条件满足后再派工）

| ID | 代号 | 内容 | 依赖 | 状态 |
|----|------|------|------|------|
| W2-01 | W2-Clone | 本机 9880 / GPT-SoVITS 克隆说明；**权重不进 git** | 无 | `planned` |
| W2-02 | W2-Stream | LLM **流式** + 按句 TTS（现在 `chatCompletion` 是整段 JSON） | 与 W2-03 **串行** | `planned` |
| W2-03 | W2-Shell | hide 烟窗、点击穿透、隐藏停画 | 与 W2-02 **串行** | `planned` |
| W2-04 | W2-SFX | 吸/吐短 WAV | 无 | `planned` |

**Wave 2 启动条件**

- [x] W15-01 有本机结论（用户口头确认已做完）
- [x] W15-02 关闭入口已合入（PR #14 `2a16e25`）
- [x] 像素资产不再频繁整树重写（用户确认已落地；W15-06 deferred）

派工提示词与文件独占：合入后仍以 [agent-split.md §8–§10](./agent-split.md) 为准，**先在本板认领对应 W2-xx**。P0/P1 Story 级可写路径以 [pm-epics-p0-p1.md](./pm-epics-p0-p1.md) 为准，**不要改冻结契约**。

### 4.3 长期 backlog（未排期）

| ID | 内容 | 状态 |
|----|------|------|
| BL-01 | Cursor 桥从 CLI 升级到 ACP 流式（`agent acp`） | `planned` |
| BL-02 | 真 Live2D `.moc3` 接入；像素仍为默认 | `deferred` |
| BL-03 | 设置 UI（现在改 `config.json`） | `planned` |
| BL-04 | 对话持久化（现在进程内 `HISTORY_LIMIT = 24`） | `planned` |
| BL-05 | 安装包 / 分发 | `planned` |
| BL-06 | CI（至少 `pnpm --filter @niko/desktop build`） | `planned` |
| BL-07 | GitHub Issue / PR 模板 | `planned` |

新的大想法：先加 `BL-xx`，用户说「现在做」再升成 `REQ-xx` 并认领。

---

## 5. 已知问题（有代码证据）

| ID | 问题 | 严重度 | 关联 | 状态 |
|----|------|--------|------|------|
| ISS-01 | 空闲时嘴边 `SmokeField` 仍按 idleRate 慢慢吐粒子（默认 intensity 0.2） | P3 | W15-03 | `deferred`（22s interval 已删；用户 2026-08-20 接受残留细烟） |
| ISS-02 | 点到透明 canvas 也会进 PTT | P1 | W15-04 | `done`（PR #14 opaque-only） |
| ISS-03 | `mouth-smoke.png` 未进入 `sheet.json` 的 mouth slot；渲染只切 open/closed | P2 | W15-05 | `planned` |
| ISS-04 | README 仍写「有 model3 则 Live2D」；实现已固定像素 | P3 | 文档 | `planned` |
| ISS-05 | 无 GitHub Issue、无 PR 模板 | P3 | BL-07 | `planned` |
| ISS-06 | `character.ts` 里 Pixi `antialias: true`（贴图已是 nearest） | P3 | 像素渲染 | `planned` |
| ISS-07 | 契约曾要求 `assets/ref/official-sheet.*` | — | W15-07 | `cancelled`（真源改为 `尼古喵喵角色图/`，见 AGENTS.md） |

已处理、只作备忘：PR #10 把占位几何改到 240×336；无 PNG 时才走色块。

---

## 6. 仓库地图（改功能前先对一下）

| 路径 | 职责 |
|------|------|
| `apps/desktop` | Electron：主进程、角色窗、烟窗、托盘 |
| `packages/core` | 人设、LLM、工具循环 |
| `packages/voice` | STT / TTS |
| `packages/agent` | 本机工具 + Cursor CLI 桥 |
| `尼古喵喵角色图/` | 官方源图（`50.webp`、`nico_miaomiao_transparent.png`），不要删 |
| `assets/pixel/` | 运行时分层木偶（真源产物，已落地） |
| `assets/ref/` | **不使用**。旧 Cloud 提示词别名，已从契约里删掉 |
| `assets/sprites/` | 旧全身精灵；像素路径不再依赖它显示 |
| `assets/live2d-layers/` | **停止继续切**；不是当前桌宠主路径 |
| `petdex/` | **旁路** PetDex/Codex 包（PR #19）；桌宠不读 |
| `docs/agent-split.md` | 并行派工契约（少改） |
| `docs/visual-optimization-brief.md` | 视觉真源与验收（人设长相） |
| `docs/persona.md` | 人设文案 |
| `assets/pixel/gen-log.md` | 像素生成记录 |

当前默认可跑能力（不要当新需求重做）：拖动、按住/热键说话、打字、托盘吐烟/散烟/显隐/退出、按句播放、口型 RMS、空闲全屏烟停转、`dispatch_cursor`。

---

## 7. 文档分工

| 文档 | 改的频率 | 用途 |
|------|----------|------|
| **本文件** | 每个功能 PR | 进度、认领、路线图 |
| [pm-epics-p0-p1.md](./pm-epics-p0-p1.md) | P0/P1 立项时 | Epic/Story、参考仓库、可写路径 |
| [desktop-pet-landscape.md](./desktop-pet-landscape.md) | 竞品调研 | Catalog R01–R19、§6 PM 清单（PR #13） |
| [AGENTS.md](../AGENTS.md) | 很少 | Agent 入口；指向本板 |
| [agent-split.md](./agent-split.md) | 契约变了才改 | 文件独占、云端提示词 |
| [visual-optimization-brief.md](./visual-optimization-brief.md) | 视觉策略变了才改 | 设定图真源 |
| [persona.md](./persona.md) | 人设变了才改 | 语气与禁忌 |
| [live2d-spec.md](./live2d-spec.md) | Cubism 管线 | 非当前默认路径 |
| [gen-log.md](../assets/pixel/gen-log.md) | 每次改像素资产 | 模型/提示词/入选图 |

实现细节写在 PR 和代码里，不要把 diff 贴进本板。

### 用户新需求登记模板（复制到 §2）

```markdown
### REQ-00X · 一句话标题

| 字段 | 内容 |
|------|------|
| 状态 | `in_progress` |
| 来源 | 用户原话或 issue |
| 负责人 | local 或 cloud · 分支名 · PR |
| 可写路径 | … |
| 禁止 | … |
| 完成标准 | 可验收的一句话 |
| 验证 | 命令或本机步骤 |
```

同时：§1「下一 REQ」加一；§3 或 §4 表加一行；§8 追加认领日志。

---

## 8. 变更日志（只追加，新的在上）

| 日期 (UTC) | ID | 变更 | 操作者 |
|------------|-----|------|--------|
| 2026-08-20 | P0-E | **合入 PR #23**。ST-STATE-03 + ST-VOICE-02 → `done`。本机打断过。`character.ts`/`main` 释放；可派 P0-G | 用户指示合入 |
| 2026-08-20 | P0-E | 本机验收通过：连说两句打断，日志 `Speaking→Listening`，嘴不残留。PR #23 尚未合入 | 用户口头 |
| 2026-08-20 | P0-E | 认领 ST-STATE-03 + ST-VOICE-02（接线+打断）；分支 `cursor/pet-phase-wiring-barge-in-1098` | cloud |
| 2026-08-20 | P0 | 第二批提示词对齐当前 master：现在派 E+F；G 等 E；H 等 G。见 pm-epics §6.2 | cloud |
| 2026-08-20 | W15-02 | **合入 PR #14** `2a16e25`。W15-02/03/04 → `done`。`character.ts`/`main` 释放；可派 P0-E/F | 用户指示合入 |
| 2026-08-20 | W15-02 | 本机验收：02/04 **过**；03 空闲嘴边细烟用户**接受**。ISS-01 降为 deferred。#14 已 merge master | 用户口头 + cloud · PR #14 |
| 2026-08-20 | — | 用户指示：关 #11；合入 #12 #15 #16 #17 #18 #19。`master` = `ed5f63b`。仍开：#14 | 用户 + cloud |
| 2026-08-20 | P0 | 第一批已开 PR：#15 A、#16 B、#17 C、#18 D；旁路 #19 petdex。分支处理写入 §1 | cloud · PR #12 |
| 2026-08-20 | W15-02 | 路 B 代码审查通过（build CLEAN）；P0-A～D **可以立刻派**，不必等 #14 合入；E/G/H 仍等 B | cloud · PR #12 |
| 2026-08-20 | — | 景观文档 PR #13 已合入 `046c8d1`；快照 tip 从 `5a17d58` 更新 | cloud · PR #12 |
| 2026-08-20 | P0 | 四条 P0 都做：§6 写入 P0-A～H 提示词；第一批 A–D 可并行 | cloud · PR #12 |
| 2026-08-20 | REQ-002 | 按景观 §6 写出 P0/P1 Epic+Story：`docs/pm-epics-p0-p1.md`（未改 agent-split 契约） | cloud · PR #12 |
| 2026-08-20 | W15-02 | 路 B 已有 PR #14；推进板标 in_progress | cloud · PR #12 |
| 2026-08-20 | W15-01 | 用户确认 A 路本机验收已做完 | 用户口头 |
| 2026-08-20 | W15-07 | **取消 C 路**：不是像素任务；设定图已在 `尼古喵喵角色图/`，木偶已在 `assets/pixel/`。契约不再要求 `assets/ref/` | cloud · PR #12 |
| 2026-08-20 | W15-06 | 像素 polish 延后：用户确认新像素资产已处理 | 用户口头 |
| 2026-08-20 | — | 用户要求梳理下一步；写入 §4.0 派工图（3 路并行 + 本地验收） | cloud · PR #12 |
| 2026-08-19 | ISS-07 | 记下 `assets/ref/` 缺失；设定图仍在 `尼古喵喵角色图/` | cloud · PR #12 |
| 2026-08-19 | REQ-001 | 推进板开 PR #12；相对链接校验通过 | cloud · `cursor/project-tracker-9e59` |
| 2026-08-19 | REQ-001 | 初版推进板：Wave1 完成态、W15/W2/backlog、Agent 认领协议 | cloud · `cursor/project-tracker-9e59` |

---

*维护者：所有在本仓库工作的 Agent。收工前更新本节日期与对应 ID。*
