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
| 当前 tip | `5a17d58` — Merge PR #10（契约对齐 240×336 @ scale=1） |
| 像素资产 | `e7e425a` — 240×336 分层 idle（`assets/pixel/`，见 `gen-log.md`） |
| 视觉主路径 | 像素木偶；`createCharacterRenderer` **固定**走 `PixelRenderer`（Live2D 接管是长期项 BL-02） |
| 舞台 / 角色窗 | 舞台 `240×336`；窗 `240×432`（`geometry.ts`） |
| TTS 默认 | Edge `zh-CN-XiaoyiNeural`，`rate: 0.85` |
| Wave 1 | **完成**（#2 #3 #4 #5 #6 + 文档 #10） |
| Wave 2 | **未开**（启动条件见 §4） |
| 下一 REQ | `REQ-002` |
| 下一 ISS | `ISS-08` |
| 下一 BL | `BL-08` |
| 下一 W15 | `W15-08` |

### 开放中的文档/分支（非产品功能）

| 工作 | 分支 / PR | 说明 |
|------|-----------|------|
| 本推进板 | `cursor/project-tracker-9e59` · PR #12 | **认领中** · `REQ-001` |
| 较早的推进板草稿 | PR #11 `cursor/project-tracker-45ab` | 同主题初稿；本文件为后续真源。合入后可关 #11 |

---

## 2. 进行中需求

目前只有建立本板这一件。产品功能不要从对话里「感觉有人在做」就写进来。

### REQ-001 · 建立项目推进板

| 字段 | 内容 |
|------|------|
| 状态 | `in_progress` |
| 来源 | 用户：要一份进度 + 需求 + 后续方案，云端/本地 Agent 共同维护 |
| 负责人 | cloud · `cursor/project-tracker-9e59` · PR #12 |
| 可写 | `docs/project-tracker.md`、`AGENTS.md`、`docs/agent-split.md`、`README.md` |
| 完成标准 | `master` 上能读到本板；`AGENTS.md` 要求开工读/收工写；`agent-split.md` 把本文件列为所有代号可写 |
| 验证 | 文档链接指向的仓库文件存在；不改运行时代码 |

完成合入后：本卡片改为 `done`，从本节删除详细表，只在 §3 Wave 表留一行。

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
| W1-09 | 推进板（本文件） | REQ-001 | `in_progress` |

### Wave 1.5 — 体验收尾（建议在 Wave 2 前做带 ★ 的）

| ID | 内容 | 优先级 | 状态 | 建议改哪里 | 备注 |
|----|------|--------|------|------------|------|
| W15-01 ★ | 本机非脸部验收（启动/聊/TTS/口型/拖/PTT/烟） | P0 | `done` | 不改代码 | **用户口头验收**（2026-08-20）；无书面分项报告 |
| W15-02 ★ | 角色窗「关闭桌宠」 | P0 | `planned` | 与 03/04 **同一云端**，见 §4.0 路 B | 现在只能托盘「退出」；`window-all-closed` 故意不退出 |
| W15-03 | 去掉角色窗按 `idlePuffSeconds` 自动吐烟 | P1 | `planned` | 同上 `character.ts` | 全屏烟窗已停转；角色窗 `setInterval` 仍在 |
| W15-04 | 透明像素不要触发按住说话 | P1 | `planned` | 同上 `character.ts` | `#stage` canvas 任意左键都会 `startHold` |
| W15-05 | `mouth-smoke.png` 接入 exhale | P2 | `planned` | `assets/pixel/sheet.json` + `PixelRenderer` | 文件已在 `layers/`，但 `slots.mouth` 只有 `closed`/`open` |
| W15-06 | 像素脸/手继续 polish | P1 | `deferred` | **只** `assets/pixel/**` | 用户确认新像素资产已落地（`e7e425a` / `assets/pixel/`）。未再要求重画 |
| W15-07 | 把设定图拷到 `assets/ref/official-sheet.png` | P1 | `cancelled` | — | **不是**像素资产任务。旧派工约定的别名；真源已在 `尼古喵喵角色图/`，产物已在 `assets/pixel/`。已改正文契约 |

历史尝试（不要当现行任务）：PR #7 手+嘴、#8 只接手、#9 眼嘴嵌入脸 —— 均 `CLOSED`。

---

## 4. 后续开发方案

### 4.0 派工图（2026-08-20 更新）

Wave 1 功能已在 `master`。像素运行时资产已落地，**不要再开 P-Gen / 不要做 C 路**。

**你先做（人）：** 合入本推进板 PR #12，关掉重复草稿 PR #11。

#### 路况

| 路 | ID | 状态 | 谁 | 说明 |
|----|-----|------|----|------|
| A | W15-01 | **`done`** | 本地 / 用户 | 用户确认本机验收已做完 |
| B | W15-02+03+04 | 下一步 | **一个**云端 Agent | 关闭按钮 + 去掉角色窗自动 puff + 透明区不触发 PTT。独占 `character.ts` 一带 |
| C | W15-07 | **`cancelled`** | — | 只是把设定图再拷到 `assets/ref/`。**不是**新像素图。源图已在 `尼古喵喵角色图/`，木偶已在 `assets/pixel/` |
| D | W15-06 | **`deferred`** | — | 用户确认像素资产已处理好。除非再说「脸还要改」，否则不要重画 |

剩下和 B 可并行的小文档：ISS-04 README 仍写 Live2D 会接管——可并进 B 或单独一条，别碰 `character.ts`。

#### 两套图不要混

| 路径 | 是什么 | 桌宠读它吗 |
|------|--------|------------|
| `尼古喵喵角色图/` | 官方设定（白底 `50.webp`、去底 `nico_miaomiao_transparent.png`） | 否 |
| `assets/pixel/` | 已经切好的 240×336 分层木偶 | **是**（运行时） |
| `assets/ref/` | 旧云端提示词里的别名，**仓库里没有、也不需要再建** | 否 |

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
| 整波 Wave 2 | 等 W15-02 已合入（或你书面说先不做关闭按钮） |
| 两个云端同时改 `character.ts` 或同时改 `assets/pixel/**` | 必冲突 |

#### Wave 2 以后怎么拆（先别派）

| ID | 云端能否写 | 并行？ | 本地还要做什么 |
|----|------------|--------|----------------|
| W2-01 Clone | 只能写说明 / `config.example.json` | 可与 W2-04 并行 | **本机**跑 9880 才算完成 |
| W2-02 Stream | 能写 `packages/core` + `main/index.ts` | **不能**与 W2-03 同时 | 本机听「边生成边出声」 |
| W2-03 Shell | 能写 `windows.ts` / 烟窗 / `main` | **不能**与 W2-02 同时 | 本机试 hide、点击穿透 |
| W2-04 SFX | 能加 wav + 小播放逻辑 | 避开 `main/index.ts` 时可与 Clone 并行 | 本机听吸/吐 |

### 4.1 建议下一件（无人指定任务时按此取）

1. 合入 **REQ-001**（本板 PR #12；关 #11）。
2. 开 **路 B**：一个云端 Agent 做 W15-02+03+04。
3. 不要开 C、不要重做像素资产。W15-05 仅在你想让吐烟切 `mouth-smoke` 层时再做。
4. Wave 2 仍等 W15-02 合入（或你说先不做关闭按钮）。**W2-02 与 W2-03 不得并行**。

### 4.2 Wave 2（启动条件满足后再派工）

| ID | 代号 | 内容 | 依赖 | 状态 |
|----|------|------|------|------|
| W2-01 | W2-Clone | 本机 9880 / GPT-SoVITS 克隆说明；**权重不进 git** | 无 | `planned` |
| W2-02 | W2-Stream | LLM **流式** + 按句 TTS（现在 `chatCompletion` 是整段 JSON） | 与 W2-03 **串行** | `planned` |
| W2-03 | W2-Shell | hide 烟窗、点击穿透、隐藏停画 | 与 W2-02 **串行** | `planned` |
| W2-04 | W2-SFX | 吸/吐短 WAV | 无 | `planned` |

**Wave 2 启动条件**

- [x] W15-01 有本机结论（用户口头确认已做完）
- [ ] W15-02 关闭入口已合入（或用户书面说先不做）
- [x] 像素资产不再频繁整树重写（用户确认已落地；W15-06 deferred）

派工提示词与文件独占：合入后仍以 [agent-split.md §8–§10](./agent-split.md) 为准，**先在本板认领对应 W2-xx**。

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
| ISS-01 | 角色窗仍按 `idlePuffSeconds`（默认 22s）自动 `exhale` + burst | P1 | W15-03 | `planned` |
| ISS-02 | 点到透明 canvas 也会进 PTT | P1 | W15-04 | `planned` |
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
| 2026-08-20 | W15-01 | 用户确认 A 路本机验收已做完 | 用户口头 |
| 2026-08-20 | W15-07 | **取消 C 路**：不是像素任务；设定图已在 `尼古喵喵角色图/`，木偶已在 `assets/pixel/`。契约不再要求 `assets/ref/` | cloud · PR #12 |
| 2026-08-20 | W15-06 | 像素 polish 延后：用户确认新像素资产已处理 | 用户口头 |
| 2026-08-20 | — | 用户要求梳理下一步；写入 §4.0 派工图（3 路并行 + 本地验收） | cloud · PR #12 |
| 2026-08-19 | ISS-07 | 记下 `assets/ref/` 缺失；设定图仍在 `尼古喵喵角色图/` | cloud · PR #12 |
| 2026-08-19 | REQ-001 | 推进板开 PR #12；相对链接校验通过 | cloud · `cursor/project-tracker-9e59` |
| 2026-08-19 | REQ-001 | 初版推进板：Wave1 完成态、W15/W2/backlog、Agent 认领协议 | cloud · `cursor/project-tracker-9e59` |

---

*维护者：所有在本仓库工作的 Agent。收工前更新本节日期与对应 ID。*
