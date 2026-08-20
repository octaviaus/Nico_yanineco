# P0/P1 Epic 与 Story（PM 拆解）

来源：[desktop-pet-landscape.md](./desktop-pet-landscape.md) §6（已合入 `master` · PR #13 `046c8d1`）。  
契约：[agent-split.md](./agent-split.md)（**本文件不改冻结项**：层名、240×336、`sheet.json` 字段名）。  
进度：[project-tracker.md](./project-tracker.md)。

调研日 Catalog：R01 OpenPets · R02 WindowPet · R03 DeskCat · R04 deskpet · R05 petto · R06 AI-Desktop-Pet · R07 Clyde · R08 aemeath · R09 mikari · R10 Convai · R11 Desktop-Virtual-buddy · R12 duzexu `.petpack` · R13 Ice-teapop / Furina · R14 YRChat · R15 Hiyori · R16 DesktopFriends · R17 IsmetBuddy · R18 booleamu · R19 saagpatel。

只拆 **P0 / P1**。P2+（规则引擎、置顶策略、向量记忆、Shimeji、插件 SDK）仍留在景观文档，不进本表。

---

## 0. 派工总则（对照 agent-split，不改契约）

### 0.1 已有代号可写路径（摘录，勿改）

| 代号 | 可写 | 禁止（并行时） |
|------|------|----------------|
| **P-Gen** | `assets/pixel/**`、`scripts/gen-pixel-puppet.py`、`docs/pixel-spec.md` | 任何 `.ts/.css/.html`，`assets/sprites/**`，`assets/live2d-layers/**`，`尼古喵喵角色图/**` |
| **P-Puppet** | `PixelRenderer.ts`、`pixelSheet.ts`、`createCharacterRenderer.ts`、`CharacterRenderer.ts`（只加 `'pixel'`）、`geometry.ts`、`character.html`、`character.css`、`tray.ts`、`README.md` 一句 | `character.ts`、`windows.ts`、`smoke.ts`、`SmokeField.ts`、`main/index.ts`、`packages/**`、`assets/pixel/**`（只读） |
| **V-Timbre** | `packages/voice/src/index.ts`、`config.example.json`；`packages/core/src/types.ts` **仅**可选 `tts.rate` | `config.json`、`apps/desktop/**`、`chat.ts`、`persona.ts`；不接 GPT-SoVITS 权重 |
| **R-Smoke** | `smoke.ts`、`SmokeField.ts`、`windows.ts`、`smoke.html` | `character.ts`、`geometry.ts`、`main/index.ts`、`preload/**`、像素文件 |
| **S-Speech** | `main/index.ts`（`speak` / `handleUtterance`）、`character.ts`；`preload/index.ts` 与 `env.d.ts` **只加字段** | `packages/voice/**`、`geometry.ts`、`windows.ts`、`smoke.ts`、PixelRenderer |
| **全体** | `docs/project-tracker.md`（只改认领/状态/日志） | 整篇重排推进板；提交 `config.json` / `.env` / 模型权重 |

Wave 2 已点名、但 **agent-split 尚未写可写清单** 的代号：`W2-Clone`、`W2-Stream`、`W2-Shell`、`W2-SFX`。下面 Story 按「现有代号能盖住的路径」分配；盖不住的标 **提议新代号**（写入本文件即可，**不要**为此改 `agent-split.md` 冻结契约）。

### 0.2 提议新代号（仅本拆解使用，未写入 agent-split）

| 提议代号 | 建议可写 | 对应 Epic |
|----------|----------|-----------|
| **C-Core** | `packages/core/src/{types,chat,llm}.ts`（不改 `persona.ts` 人设核心；不抢 `tts.rate` 以外的 voice 配置） | 状态机类型、LLM fallback、主动发言文案装配 |
| **A-Agent** | `packages/agent/**` | Agent 可视化解析、审计日志 |
| **W2-Stream** | `packages/core` 流式 chat + `main/index.ts` 按句 TTS（与 W2-Shell **串行**） | 景观 §1.3 / 推进板 W2-02 |
| **W2-Shell** | `windows.ts`、`smoke.ts`、`SmokeField.ts`、`smoke.html`、`main/index.ts` 的 hide/穿透 IPC（与 W2-Stream **串行**） | EPIC-W2-SHELL、PASSTHROUGH 的主进程侧 |
| **W2-Clone** | `config.example.json`、说明文档；**权重不进 git** | 推进板 W2-01 |
| **W2-SFX** | 短 WAV 资源 + 播放调用（避开与 Stream/Shell 同时改 `main/index.ts`） | 推进板 W2-04 |

### 0.3 硬锁（文件）

| 锁 | 规则 |
|----|------|
| `main/index.ts` | **同时只能一个** in_progress：S-Speech 增量 / W2-Stream / W2-Shell / 路 B（W15-02） |
| `character.ts` | **同时只能一个**：S-Speech / 路 B / 状态机接线 / 穿透 hitbox / SFX 播放 |
| `windows.ts` | R-Smoke 已合入；之后只给 W2-Shell（含穿透） |
| `packages/voice/**` | 只给 V-Timbre / 语音管线 Story |
| `assets/pixel/**` + 层名 / 画布 / `sheet.json` 字段 | P-Gen；**禁止**为 Epic 改冻结契约 |
| W2-Stream ∥ W2-Shell | **禁止并行**（agent-split §10） |

### 0.4 建议合入顺序（对齐景观 §6.2 + 推进板）

```
已完成：Wave 1、路 B（#14）、P0-A～D（#15–#18）、PetDex 旁路（#19）
   ↓ 现在派（2 个 Agent 并行）
P0-E ST-STATE-03 + ST-VOICE-02  独占 character.ts + main/index.ts
P0-F ST-VOICE-03                 只 packages/voice  （与 E 并行）
   ↓ E 合入后
P0-G ST-VIZ-03 角色窗显示 AgentPhase
   ↓ G 合入后
P0-H ST-SHELL + ST-PASS hide 烟窗 + 真点击穿透
   ↓ 再往后（先别派）
W2-Stream（与 H/Shell 串行）→ W2-SFX / Clone / LLM-FALLBACK
```

---

## 1. Epic 总表（P0 / P1）

| 优先级 | Epic | 标题 | Wave | 参考 | 推进板别名 |
|--------|------|------|------|------|------------|
| P0 | EPIC-W2-SHELL-PASSTHROUGH | 点击穿透 + Hitbox | W2（Shell 之后） | R02, R12, R18 | 扩展 W2-03 |
| P0 | EPIC-W2-VOICE-PIPELINE | VAD / 流式 ASR / 打断 TTS | W2（S-Speech 之后） | R04, R05, R06 | 新；非 W2-02 |
| P0 | EPIC-W1-STATE-MACHINE | 角色对话状态机 | W1.5–W2 | R06, 契约 §2 | 新 |
| P0 | EPIC-W2-AGENT-VISUAL | 编码 Agent 状态可视化 | W2 | R07, R08, R09, R01 | 新；协同 W2-02 |
| P1 | EPIC-W2-SHELL | 烟窗 hide + 隐藏停画 | W2 | R10, R01, agent-split W2-Shell | W2-03 主体 |
| P1 | EPIC-W2-LLM-FALLBACK | 多 Provider 降级 | W2 | R13 | 新 |
| P1 | EPIC-W2-AGENT-AUDIT | 工具审批与审计日志 | W2 | R13 | 新 |
| P1 | EPIC-W2-ASSET-PACK | niko.petpack | W2 | R12 | 新 |
| P1 | EPIC-W3-PROACTIVE | 情境主动发言 | W3 | R05, R11, R06 | 新 |

关联但不在本 P0/P1 拆解里展开（已在推进板）：W2-01 Clone、W2-02 Stream、W2-04 SFX。

---

## 2. P0 Epics 与 Stories

### EPIC-W1-STATE-MACHINE · 角色对话状态机

| 字段 | 内容 |
|------|------|
| 景观 | §4 A3 |
| 参考 | **R06** 状态机；契约 §2 idle/talk/inhale/exhale 层组合 |
| 价值 | 收拢 `busy` / `speaking` / `pose` 隐式 flag |
| Wave | W1.5–W2 |
| 依赖 | Wave 1 P-Puppet、S-Speech 已合入；**ST-STATE-03 等路 B（PR #14）** 释放 `character.ts` |
| 非目标 | 不改层名、不改 240×336、不接 Live2D 主路径 |

#### ST-STATE-01 · 定义 `PetPhase` 与合法转移

- **Epic**: EPIC-W1-STATE-MACHINE
- **参考仓库**: R06 AI-Desktop-Pet
- **Wave**: W1.5（可与路 B **并行**）
- **依赖**: 无代码依赖
- **代号**: **C-Core**（提议）
- **可写**: `packages/core/src/types.ts`（及新建 `packages/core/src/petPhase.ts`）；推进板认领行
- **禁止**: `apps/desktop/**`、`packages/voice/**`、`persona.ts` 大改、`tts.rate` 无关字段大战
- **任务**
  - [ ] 枚举：`Idle` / `Listening` / `Thinking` / `Speaking` / `Inhale` / `Exhale`
  - [ ] 合法转移表；非法转移 throw 或 no-op + 日志
  - [ ] 每种 phase → 契约层组合（眼 open/half/closed，嘴 closed/open/smoke）写在 **TS const**，不要改 `sheet.json` 字段名
- **验收**
  - [ ] 单测或最小脚本：非法转移被拒绝
  - [ ] 映射表与 agent-split §2 表格一致
- **非目标**: 不驱动窗口、不改 PixelRenderer

#### ST-STATE-02 · PixelRenderer 按 phase 切层

- **Epic**: EPIC-W1-STATE-MACHINE
- **参考仓库**: R06；契约 §2
- **Wave**: W1.5
- **依赖**: ST-STATE-01
- **代号**: **P-Puppet**
- **可写**: `PixelRenderer.ts`、`pixelSheet.ts`、`CharacterRenderer.ts`（签名不准改，只消费 phase）、`createCharacterRenderer.ts` 若只需接线
- **禁止**: `character.ts`、`main/index.ts`、`windows.ts`、`assets/pixel/**` 改层名/尺寸
- **任务**
  - [ ] `setPose` / 内部切层走 phase 映射（idle=眼 open/half+嘴 closed；talk=`setMouthOpen`；inhale=眼更眯+嘴 closed；exhale=嘴 smoke 或 open）
  - [ ] 眨眼 4–7s 仍在 Idle 下工作
- **验收**
  - [ ] `pnpm --filter @niko/desktop build` 通过
  - [ ] 无 PNG 时色块占位仍能切眼嘴
- **非目标**: 不实现点击穿透

#### ST-STATE-03 · main / 角色窗发出 phase

- **Epic**: EPIC-W1-STATE-MACHINE
- **参考仓库**: R06
- **Wave**: W2 初（路 B 之后）
- **依赖**: ST-STATE-01、ST-STATE-02、**W15-02/03/04 合入**（PR #14 占 `character.ts` / `main/index.ts`）
- **代号**: **S-Speech**
- **可写**: `character.ts`；`main/index.ts` 仅 pose/phase 广播；`preload/index.ts`、`env.d.ts` **只加字段**
- **禁止**: `packages/voice/**`、`windows.ts`、`smoke.ts`、PixelRenderer、流式 LLM
- **任务**
  - [ ] PTT / 播放 / 工具 busy 写入 `PetPhase`，禁止直改零散 boolean 作为唯一真源
  - [ ] 状态变化可日志追踪
- **验收**
  - [ ] 每种用户可见状态对应固定层组合
  - [ ] build 通过；PR 注明本机看一眼即可
- **非目标**: VAD、Agent 可视化气泡

---

### EPIC-W2-VOICE-PIPELINE · VAD / 流式 ASR / 打断 TTS

| 字段 | 内容 |
|------|------|
| 景观 | §4 A2 |
| 参考 | **R04** deskpet、**R05** petto、**R06** VAD 状态机 |
| Wave | W2 |
| 依赖 | W1-06 S-Speech 已合入；ST-STATE-01；碰 `main`/`character.ts` 的 Story 等路 B 与 ST-STATE-03 |
| 非目标 | 不重做成 WebRTC 电话（景观 B7）；不把 GPT-SoVITS 权重送进 git |

#### ST-VOICE-01 · 本地 VAD 起止（packages/voice）

- **Epic**: EPIC-W2-VOICE-PIPELINE
- **参考仓库**: R04, R06
- **Wave**: W2
- **依赖**: 无桌面文件依赖；可与 ST-STATE-01/02 并行
- **代号**: **V-Timbre**
- **可写**: `packages/voice/src/index.ts`、`config.example.json`（可选 `stt.vad`）；`types.ts` 仅当需要可选配置字段
- **禁止**: `apps/desktop/**`、`chat.ts`、`persona.ts`、`config.json`、模型权重
- **任务**
  - [ ] Silero 或等价 VAD：检测到语音起/止的回调或事件
  - [ ] 无模型时明确失败，不要假装 VAD 可用
- **验收**
  - [ ] 单元/脚本：静音 vs 有声分段
  - [ ] 默认仍可走现有按住说话（feature flag 或未配置则旧路径）
- **非目标**: 不改 PTT UI

#### ST-VOICE-02 · TTS 播放中打断并清队列

- **Epic**: EPIC-W2-VOICE-PIPELINE
- **参考仓库**: R05, R04
- **Wave**: W2
- **依赖**: W1-06；**路 B 合入**；建议 ST-STATE-03
- **代号**: **S-Speech**
- **可写**: `character.ts`、`main/index.ts` 的 `speak` / 队列 / interrupt；preload/env **只加字段**
- **禁止**: `packages/voice/**`、`windows.ts`、PixelRenderer、W2-Stream 的 LLM `stream: true`（本 Story 不做 LLM 流式）
- **任务**
  - [ ] 新 utterance 到达：stop 当前播放、清空句队列、口型回 Idle/Listening
  - [ ] 与现有 `speakGen` / `interrupt` 对齐，不要两套队列
- **验收**
  - [ ] 连说两句不必等第一句播完才能「开始听」（在已开 VAD 或热键二次触发下）
  - [ ] RMS 口型不残留在打断后
- **非目标**: 流式 ASR；点击穿透

#### ST-VOICE-03 · 流式 / 分段 ASR（可选本地 faster-whisper）

- **Epic**: EPIC-W2-VOICE-PIPELINE
- **参考仓库**: R04, R05, R06
- **Wave**: W2
- **依赖**: ST-VOICE-01；ST-VOICE-02；与 **W2-Stream 串行若改 `main/index.ts`**
- **代号**: **V-Timbre**（识别）+ 接线若必须碰桌面则另开 **S-Speech** 第二条 PR，**不要**同一时段两个 PR 改 `character.ts`
- **可写（V-Timbre PR）**: `packages/voice/**`、`config.example.json`
- **可写（S-Speech PR，可选后续）**: `character.ts`、`main/index.ts` 仅 STT 调用
- **禁止**: 权重进 git；改像素契约
- **任务**
  - [ ] 分段 Whisper 或 WebSocket 到本地 faster-whisper
  - [ ] 未配置时回退按住说话 + 现有 STT
- **验收**
  - [ ] 连续两句无需两次按键（VAD 开启时）
  - [ ] 口型 RMS 仍同步
- **非目标**: Convai WebRTC

---

### EPIC-W2-AGENT-VISUAL · 编码 Agent 状态可视化

| 字段 | 内容 |
|------|------|
| 景观 | §4 A4 |
| 参考 | **R07** Clyde、**R08** aemeath、**R09** mikari、**R01** OpenPets MCP |
| Wave | W2 |
| 依赖 | `packages/agent` Cursor 桥已存在；ST-VIZ-03 建议在 W2-Stream 之后或只读 CLI 输出；映射表 Story 可先做 |
| 非目标 | 不重复造 ACP 全双工（推进板 BL-01）；不改像素层名 |

#### ST-VIZ-01 · `AgentPhase` 与 pose/smoke/bubble 映射表

- **Epic**: EPIC-W2-AGENT-VISUAL
- **参考仓库**: R07, R08, R09
- **Wave**: W2 前期（可与路 B、STATE-01 **并行**）
- **依赖**: 无
- **代号**: **A-Agent**（提议）或暂放 `packages/agent` + 只读引用 core 类型
- **可写**: `packages/agent/**`（新建 `agentPhase.ts` / JSON）；**不要**改 `apps/desktop/**`
- **禁止**: 像素资产、`main/index.ts`、`windows.ts`
- **任务**
  - [ ] 8–15 种 phase（session start、tool、permission、complete、error…）
  - [ ] 映射：phase → PetPhase 或 pose + smoke intensity + 气泡短句（符合 `persona.md` 颓系短句）
  - [ ] 同一 phase **最小展示 800ms**（R08 防抖）写进映射配置
- **验收**
  - [ ] 表可单测：每个 phase 都有映射且无未知键
- **非目标**: 不接真 Cursor 事件

#### ST-VIZ-02 · 解析 Cursor CLI 进度（最小可行）

- **Epic**: EPIC-W2-AGENT-VISUAL
- **参考仓库**: R08, R01
- **Wave**: W2
- **依赖**: ST-VIZ-01
- **代号**: **A-Agent**
- **可写**: `packages/agent/src/index.ts` 及解析模块
- **禁止**: `apps/desktop/**`（本 Story 只产出事件流/回调）
- **任务**
  - [ ] 解析现有 `agent -p --print` / spawn stdout-stderr 为 `AgentPhase` 序列
  - [ ] 解析失败时保持 idle，不抛到 UI 崩溃
- **验收**
  - [ ] 用一段假日志 fixture 跑出 phase 序列
- **非目标**: HTTP hook / Cloud Agent webhook（见 ST-VIZ-04）

#### ST-VIZ-03 · 角色窗消费 AgentPhase（忙碌/打字/提醒）

- **Epic**: EPIC-W2-AGENT-VISUAL
- **参考仓库**: R07, R08, R09
- **Wave**: W2（W2-Stream 之后，或与 Stream **串行** 若改 `main/index.ts`）
- **依赖**: ST-VIZ-01、ST-VIZ-02、ST-STATE-03；**不与路 B / Stream / Shell 同时改 `character.ts` 或 `main/index.ts`**
- **代号**: **S-Speech**（桌面接线）
- **可写**: `character.ts`、`main/index.ts` 仅转发 agent 事件；preload/env 只加字段
- **禁止**: `packages/voice/**`、`windows.ts`、PixelRenderer 契约破坏
- **任务**
  - [ ] 任务执行中：忙碌/打字态 + 气泡
  - [ ] 权限等待：角色提醒（短句）
  - [ ] 完成：短暂庆祝或 puff → Idle；遵守 800ms 锁
- **验收**
  - [ ] 本地或 fixture：complete 后回到 idle
  - [ ] 人设：不突然元气偶像
- **非目标**: 烟窗 hide

#### ST-VIZ-04 · 可选 HTTP hook 收 Cloud Agent 事件

- **Epic**: EPIC-W2-AGENT-VISUAL
- **参考仓库**: R08（`:9527/:9528`）、R01 MCP
- **Wave**: W2 后段（可选）
- **依赖**: ST-VIZ-01、ST-VIZ-03
- **代号**: **A-Agent** + 若必须听端口则 **S-Speech** 主进程 **单独 PR**
- **可写**: `packages/agent/**`；主进程只加「可选本地 hook 端口」（默认关）
- **禁止**: 默认对公网暴露；写进 `config.json` 密钥
- **任务**
  - [ ] 可选 localhost hook；文档说明默认关闭
- **验收**
  - [ ] 默认不监听；打开后能把一条测试事件映到 phase
- **非目标**: 完整 MCP Control Center（景观 B3）

---

### EPIC-W2-SHELL-PASSTHROUGH · 点击穿透 + Hitbox

| 字段 | 内容 |
|------|------|
| 景观 | §4 A1 |
| 参考 | **R02** WindowPet、**R12** duzexu、**R18** booleamu |
| Wave | W2，**必须排在 EPIC-W2-SHELL 之后**（景观 §6.2） |
| 依赖 | W2-03 hide/停画；路 B 的「透明不 PTT」（W15-04）只解决录音，**不是**穿透 |
| 冲突 | 与按住说话热区统一；不要和 ST-VOICE-02 同时改 `character.ts` |
| 非目标 | 不做 Shimeji 爬墙（B1）；不改几何契约锚点公式以外的画布尺寸 |

#### ST-PASS-01 · 主进程 `setIgnoreMouseEvents` 开关

- **Epic**: EPIC-W2-SHELL-PASSTHROUGH
- **参考仓库**: R02, R12
- **Wave**: W2
- **依赖**: EPIC-W2-SHELL（ST-SHELL-01/02）；与 **W2-Stream 串行**
- **代号**: **W2-Shell**（路径落在现有 **R-Smoke** 可写集 + `main/index.ts` IPC）
- **可写**: `windows.ts`、`smoke.html` 不改逻辑除非必须；`main/index.ts` 仅穿透 IPC；`preload/index.ts`、`env.d.ts` 只加字段
- **禁止**: `character.ts`（本 Story 不做 hit test）、`geometry.ts`、`packages/**`、像素层
- **任务**
  - [ ] 角色窗支持 `setIgnoreMouseEvents(true, { forward: true })` 与关闭穿透
  - [ ] 烟窗保持现有 ignore（已是穿透）
- **验收**
  - [ ] 主进程可被 IPC 切穿透；build 通过
- **非目标**: 像素 hitbox（ST-PASS-02）

#### ST-PASS-02 · 非透明像素 / UI 热区关闭穿透

- **Epic**: EPIC-W2-SHELL-PASSTHROUGH
- **参考仓库**: R02, R12, R18
- **Wave**: W2
- **依赖**: ST-PASS-01、W15-04（opaque PTT，可复用采样）；ST-STATE-02 更稳
- **代号**: hit 采样若进渲染器 → **P-Puppet**（`PixelRenderer` hitTest）与 **S-Speech**（`character.ts` 鼠标）**必须串行两个 PR 或同一 Agent 连续提交，禁止对开**
- **建议同一 Agent**：可写 `PixelRenderer.ts`（hitTest）+ `character.ts`（鼠标）+ preload 已有字段；**不要**同时改 `windows.ts`（已在 01）
- **禁止**: 改层文件名、画布尺寸、把穿透做成「只有 PTT」回退
- **任务**
  - [ ] 透明区：穿透到下层窗口
  - [ ] 身体 / 气泡 / 输入框 / 关闭按钮：可点
  - [ ] 拖拽与穿透切换无闪烁
  - [ ] 按住说话只在不透明身体（与 W15-04 一致）
- **验收**
  - [ ] 景观 A1 三条 AC；**必须本机测**（云 VM 无桌面）
- **非目标**: 任务栏站立（R02 多宠）

---

## 3. P1 Epics 与 Stories

### EPIC-W2-SHELL · 烟窗 hide + 隐藏停画

| 字段 | 内容 |
|------|------|
| 景观 | §4 A12 |
| 参考 | **R10** 单 overlay、**R01**、agent-split §10 W2-Shell |
| Wave | W2（Stream **之后**，Passthrough **之前**） |
| 依赖 | W1-05 R-Smoke 已合入（idle 无粒子停 Ticker） |

#### ST-SHELL-01 · hide 全屏烟窗

- **Epic**: EPIC-W2-SHELL
- **参考仓库**: R10, R01
- **Wave**: W2
- **依赖**: W1-05；**W2-02 合入或明确尚未开 Stream**（锁 `main/index.ts`）
- **代号**: **W2-Shell** / 路径：**R-Smoke 可写** + `main/index.ts` hide
- **可写**: `windows.ts`、`smoke.ts`、`smoke.html`、`main/index.ts`（hide/show 烟窗）
- **禁止**: `character.ts`、`geometry.ts`、preload 大改、像素
- **任务**
  - [ ] 无烟 / 用户隐藏：`smoke` 窗 hide（不是只停 ticker）
  - [ ] 托盘「吐一口」仍能 show + burst
- **验收**
  - [ ] idle 不再长期占一个全屏 GPU 窗
  - [ ] 吐烟视觉无回归
- **非目标**: 合并为单 WebGL overlay（可另开调研 Story，默认不做）

#### ST-SHELL-02 · 角色隐藏时停画

- **Epic**: EPIC-W2-SHELL
- **参考仓库**: R10
- **Wave**: W2
- **依赖**: ST-SHELL-01（可同一 PR **若同一 Agent**）
- **代号**: hide 角色在 `main/index.ts` + `windows.ts`；角色 Ticker → **S-Speech** 的 `character.ts`
- **可写（推荐同一 PR）**: `windows.ts`、`main/index.ts`、`character.ts`（仅 visibility → stop ticker）
- **禁止**: 与 Stream 对开；改 PixelRenderer 契约签名
- **任务**
  - [ ] 托盘隐藏：角色窗 hide + 停 Pixi Ticker + 烟窗 hide
  - [ ] 显示：恢复
- **验收**
  - [ ] 隐藏后 CPU/GPU 下降（PR 写本机测法）；再显示功能正常
- **非目标**: 点击穿透（PASSTHROUGH）

---

### EPIC-W2-LLM-FALLBACK · 多 Provider 降级

| 字段 | 内容 |
|------|------|
| 景观 | §4 A7 |
| 参考 | **R13** Ice-teapop 6 LLM fallback |
| Wave | W2 后段 |
| 依赖 | 现有 `packages/core` `chatCompletion`；设置 UI（BL-03）**不作为本 Epic 前置** |

#### ST-LLM-01 · 配置链与 502 切备用

- **Epic**: EPIC-W2-LLM-FALLBACK
- **参考仓库**: R13
- **Wave**: W2
- **依赖**: 无桌面锁；可与 AUDIT、VIZ-01 **并行**
- **代号**: **C-Core**
- **可写**: `packages/core/src/llm.ts`、`chat.ts`、`types.ts`（fallback 数组）；`config.example.json`
- **禁止**: `config.json`、`apps/desktop/**`、`persona.ts` 语气大改、`packages/voice/**`
- **任务**
  - [ ] `llm.fallbacks[]`：baseURL + model + apiKeyEnv
  - [ ] 主 endpoint 5xx/网络失败切下一个
- **验收**
  - [ ] 测：主 URL 失败时走到备用（可 mock）
- **非目标**: GUI 设置页（BL-03）

#### ST-LLM-02 · 用户可见当前 provider

- **Epic**: EPIC-W2-LLM-FALLBACK
- **参考仓库**: R13
- **Wave**: W2
- **依赖**: ST-LLM-01；接线桌面时锁 `character.ts` 状态栏
- **代号**: 状态文案 → **S-Speech**（`character.ts` `#status`）或只打主进程 log（可无 UI）
- **可写（无 UI 版）**: 仅 core 返回 `provider` 字段  
  **可写（有 UI 版）**: `character.ts`、preload/env 只加字段
- **禁止**: 与 Shell/Stream 同时改 `main/index.ts`
- **任务**
  - [ ] 至少日志可见当前 provider；可选状态栏淡字
- **验收**
  - [ ] 切换备用后能看出来
- **非目标**: 完整 Settings UI

---

### EPIC-W2-AGENT-AUDIT · 工具审批与审计日志

| 字段 | 内容 |
|------|------|
| 景观 | §4 A8 |
| 参考 | **R13** Furina 工具审批；现有 `confirm` dialog |
| Wave | W2 后段 |
| 依赖 | `packages/agent` `executeTool`；`main/index.ts` 已有 `confirm` |

#### ST-AUDIT-01 · JSONL 审计日志

- **Epic**: EPIC-W2-AGENT-AUDIT
- **参考仓库**: R13
- **Wave**: W2
- **依赖**: 无；可与 ST-LLM-01 **并行**
- **代号**: **A-Agent**
- **可写**: `packages/agent/**`
- **禁止**: `apps/desktop/**`（本 Story 只提供 `logAudit()`）；日志里出现 API key
- **任务**
  - [ ] `~/.niko/audit.log` JSONL：工具名、参数摘要、allow/deny、时间
  - [ ] 红acted：key、token、cookie
- **验收**
  - [ ] 单测：样本不含 `sk-` / env 值
- **非目标**: 远程上报

#### ST-AUDIT-02 · 高危工具逐次确认并写日志

- **Epic**: EPIC-W2-AGENT-AUDIT
- **参考仓库**: R13
- **Wave**: W2
- **依赖**: ST-AUDIT-01；改 `confirm` 接线会碰 **S-Speech** 的 `main/index.ts` → 不与 Stream/Shell 并行
- **代号**: **A-Agent**（哪些工具高危）+ **S-Speech**（`main/index.ts` `confirm` 调用 log）
- **可写**: `packages/agent/**`；`main/index.ts` 仅 confirm 前后打日志
- **禁止**: 扩大工具权限；把 `dispatch_cursor` 改成静默无确认（人设仍要抱怨后调用）
- **任务**
  - [ ] 高危（写文件、跑命令）逐次 confirm
  - [ ] allow/deny 都进 audit
- **验收**
  - [ ] deny 不执行工具；日志有记录
- **非目标**: 手机远程控 PC（B8）

---

### EPIC-W2-ASSET-PACK · niko.petpack

| 字段 | 内容 |
|------|------|
| 景观 | §4 A6 |
| 参考 | **R12** `.petpack` |
| Wave | W2 |
| 依赖 | P-Gen 资产已在 `assets/pixel/`（W1-03）；**层名冻结** |
| 非目标 | 不改 `sheet.json` 字段名；不引入第二套画布尺寸 |

#### ST-PACK-01 · 导出 zip 与校验（层名/尺寸）

- **Epic**: EPIC-W2-ASSET-PACK
- **参考仓库**: R12
- **Wave**: W2
- **依赖**: 无桌面锁；可与多数 W2 **并行**
- **代号**: **P-Gen**
- **可写**: `scripts/`（打包脚本）、`docs/pixel-spec.md`（备注）、**不要**改层 PNG 除非校验失败修复属于 P-Gen
- **禁止**: `.ts` 渲染器、改冻结层名
- **任务**
  - [ ] 打包 `sheet.json` + `layers/` + `preview.png` + `gen-log.md`
  - [ ] 校验 240×336、契约层文件存在
- **验收**
  - [ ] 缺层时报错；现有 `assets/pixel` 能打出包
- **非目标**: 商城/多皮肤 UI

#### ST-PACK-02 · 运行时导入包（缺层占位）

- **Epic**: EPIC-W2-ASSET-PACK
- **参考仓库**: R12
- **Wave**: W2
- **依赖**: ST-PACK-01
- **代号**: **P-Puppet**
- **可写**: `pixelSheet.ts`、`PixelRenderer.ts`、`createCharacterRenderer.ts`；只读资产
- **禁止**: `character.ts`、`main/index.ts`、改 `assets/pixel` 层名
- **任务**
  - [ ] 从 zip/目录加载；缺层 Graphics 占位（已有能力则接线）
- **验收**
  - [ ] 导出再导入渲染与 preview 一致（本机看 `_preview-stack` 或运行时）
- **非目标**: 热切换皮肤商店

---

### EPIC-W3-PROACTIVE · 情境主动发言

| 字段 | 内容 |
|------|------|
| 景观 | §4 A5（可复用 B9 截屏管线，但不做 Vision 选爬墙） |
| 参考 | **R05** petto、**R11** Desktop-Virtual-buddy、**R06** 主动发言 |
| Wave | **W3** |
| 依赖 | ST-STATE-03、ST-VOICE-02（Speaking 时不叠播）；隐私开关 |

#### ST-PROACT-01 · 调度 + 默认关闭

- **Epic**: EPIC-W3-PROACTIVE
- **参考仓库**: R05, R06
- **Wave**: W3
- **依赖**: ST-STATE-01
- **代号**: **C-Core**（策略）+ 定时器若在主进程 → **S-Speech** `main/index.ts`（W3，Stream/Shell 已结束后）
- **可写**: `packages/core` 频率/空闲策略；`config.example.json` `proactive.enabled` 默认 `false`
- **禁止**: 默认开启；截屏（ST-PROACT-02）
- **任务**
  - [ ] 空闲时长触发；Speaking 中禁止
  - [ ] 频率可配
- **验收**
  - [ ] 默认不主动说话
- **非目标**: 看屏幕

#### ST-PROACT-02 · 可选截屏短评（强提示）

- **Epic**: EPIC-W3-PROACTIVE
- **参考仓库**: R11, R05
- **Wave**: W3
- **依赖**: ST-PROACT-01、ST-VOICE-02
- **代号**: 截屏在 **S-Speech** `main/index.ts`（`desktopCapturer`）；文案走 **C-Core** `NikoChat`
- **可写**: `main/index.ts` 截屏+开关；core 组装「看了一眼」短评；符合 `persona.md`
- **禁止**: 把截屏上传到未配置的第三方；默认开；Vision 驱动漫游
- **任务**
  - [ ] 用户显式打开「看看」或设置项后才截屏
  - [ ] 一句颓系短评，不叠播
- **验收**
  - [ ] 关闭时零截屏；开启时有权限/提示
- **非目标**: 技能轮盘（B10）、番茄钟（B4）

---

## 4. 并行矩阵（Cloud 一次最多开谁）

用户决定四条 P0 **都做**。路 B（PR #14）**已合入**，`character.ts` / `main/index.ts` 已释放。P0-A～D 已在 master。第二批可派 P0-E（占桌面壳）与 P0-F（只 voice）。

### 第一批（已合入，不要再派）

| Agent | Story | PR |
|-------|--------|-----|
| P0-A | ST-STATE-01 | #15 |
| P0-B | ST-STATE-02 | #16 |
| P0-C | ST-VOICE-01 | #17 |
| P0-D | ST-VIZ-01 + ST-VIZ-02 | #18 |

### 第二批（现在派 2 个；然后串行 G → H）

| 顺序 | Agent | Story | 并行？ |
|------|--------|--------|--------|
| 现在 | P0-E | ST-STATE-03 + ST-VOICE-02 | 与 P0-F 并行 |
| 现在 | P0-F | ST-VOICE-03（只 `packages/voice`） | 与 P0-E 并行 |
| 等 E | P0-G | ST-VIZ-03 | **等 P0-E 合入** |
| 等 G | P0-H | ST-SHELL-01/02 + ST-PASS-01/02 | **等 P0-G 合入** |

点击穿透依赖 hide 烟窗，所以 P0-H 把 P1 的 Shell 前置做进同一个 Agent，避免再拆一个抢 `windows.ts` 的人。

本机必须验收：P0-E 打断、P0-G 忙碌脸、P0-H 穿透。云端 `build` 不算桌面通过。

---

## 5. 调研日志回写

景观文档 PR #13 合入后，在其「调研日志」追加一行：

`2026-08-20 · PM Agent · 按 §6 P0/P1 生成 Epic/Story，见 docs/pm-epics-p0-p1.md；未改 agent-split 冻结契约`

本拆解不修改 `docs/agent-split.md`。

---

## 6. 给各 Cloud Agent 的提示词（整段复制）

每条开 **一条新的 Cloud 对话**，基线 `origin/master`，自己建分支，不要推 master，不要复用推进板对话，不要复用路 B 对话。

### 6.1 第一批 · 已合入（不要再派）

| Agent | PR | 状态 |
|-------|-----|------|
| P0-A | #15 | **merged** |
| P0-B | #16 | **merged** |
| P0-C | #17 | **merged** |
| P0-D | #18 | **merged** |

下面提示词仅备查。

#### P0-A · 状态机类型（ST-STATE-01）

```
你是 Cursor 云端 Agent。仓库是尼古喵喵桌宠（github.com/octaviaus/Nico_yanineco）。
基线：origin/master。新建分支，完成后开 PR，不要推 master。
不要复用别人的文档分支或路 B 分支（cursor/close-idle-puff-opaque-ptt-5089）。

你是 P0-A。只做 docs/pm-epics-p0-p1.md 的 ST-STATE-01（EPIC-W1-STATE-MACHINE）。参考 R06。

任务：
- 新建 packages/core/src/petPhase.ts：枚举 Idle / Listening / Thinking / Speaking / Inhale / Exhale。
- 合法转移表；非法转移拒绝（throw 或返回错误，不要静默变成乱态）。
- 每种 phase → 眼嘴组合写成 TS const，必须对齐 docs/agent-split.md §2：
  Idle: 眼 open/half，嘴 closed；Listening/Thinking 先映射到 Idle 层组合；
  Speaking: 嘴 open（走现有 setMouthOpen）；Inhale: 眼更眯/closed，嘴 closed；Exhale: 嘴 smoke 或 open。
- 从 packages/core/src/index.ts 导出类型与转移函数。尽量少改 types.ts（不要大重构 AppConfig）。
- 加最小单测或 node 脚本测非法转移。

可写：packages/core/src/petPhase.ts、packages/core/src/index.ts、必要时 packages/core 的测试文件。
禁止：apps/desktop/**、packages/voice/**、packages/agent/**、persona.ts 大改、assets/**、docs/agent-split.md、docs/project-tracker.md、config.json。
不要改 CharacterRenderer 方法签名，不要改层名/240×336/sheet.json 字段名。

验证：仓库能 typecheck/build 到的范围（至少 core 能被 desktop 引用编译）。提交标题：feat(core): pet phase state machine types
做完即停。PR 说明写：ST-STATE-01；桌面接线是别人的 P0-E。
```

#### P0-B · PixelRenderer 按 pose 切层（ST-STATE-02）

```
你是 Cursor 云端 Agent。仓库是尼古喵喵桌宠。
基线：origin/master。新建分支，开 PR，不要推 master。不要复用路 B / 推进板分支。

你是 P0-B。只做 ST-STATE-02（EPIC-W1-STATE-MACHINE）。代号 P-Puppet。参考 R06 与 docs/agent-split.md §2。

任务：
- 在 PixelRenderer / pixelSheet 把 idle/talk/inhale/exhale 的眼嘴切层写死对齐契约：
  idle: 眼 open/half，嘴 closed；talk: setMouthOpen 切嘴；inhale: 眼更眯，嘴 closed；exhale: 嘴 smoke 或 open（sheet 若还没有 smoke slot，用 open，不要改 sheet.json 字段名）。
- 眨眼仍 4–7s，仅 idle。
- CharacterRenderer 方法签名不准改（仍是 setPose/setMouthOpen/setSmokeParam/getMouthWorld）。
- 无 PNG 时色块占位仍能切眼嘴。

可写：apps/desktop/src/renderer/lib/PixelRenderer.ts、pixelSheet.ts、CharacterRenderer.ts（只加注释或 pixel kind，不改方法签名）、createCharacterRenderer.ts 仅当接线必须。
禁止：character.ts、character.html、character.css、main/index.ts、windows.ts、smoke.ts、packages/**、assets/pixel/**、docs/agent-split.md、docs/project-tracker.md。

验证：npx pnpm@9.15.0 --filter @niko/desktop build
提交标题：feat(desktop): pixel renderer pose-to-layer mapping
做完即停。PR 写 ST-STATE-02。不要做 hitTest 点击穿透（那是 P0-H）。
```

#### P0-C · VAD（ST-VOICE-01）

```
你是 Cursor 云端 Agent。仓库是尼古喵喵桌宠。
基线：origin/master。新建分支，开 PR，不要推 master。

你是 P0-C。只做 ST-VOICE-01（EPIC-W2-VOICE-PIPELINE）。代号 V-Timbre。参考 R04/R06。

任务：
- 在 packages/voice 增加可选 VAD：检测语音起/止，导出函数或事件（start/stop）。
- 无模型/未配置时必须明确失败或返回 disabled，走旧路径；禁止把权重提交进 git。
- config.example.json 可加可选 stt.vad 字段（默认关）。不要改用户 config.json。
- 不要接 GPT-SoVITS。不要改桌面 PTT UI。

可写：packages/voice/**、config.example.json。
禁止：apps/desktop/**、packages/core/**（含 types.ts/chat.ts/persona.ts）、packages/agent/**、config.json、.env、模型权重、docs/agent-split.md、docs/project-tracker.md。

验证：给 VAD 一个最小脚本或测试（静音 vs 有声，或 disabled 时的行为）。voice 包能编过。
提交标题：feat(voice): optional VAD start/stop
做完即停。PR 写 ST-VOICE-01；打断播放和流式 ASR 不是你的活。
```

#### P0-D · AgentPhase 映射 + CLI 解析（ST-VIZ-01、ST-VIZ-02）

```
你是 Cursor 云端 Agent。仓库是尼古喵喵桌宠。
基线：origin/master。新建分支，开 PR，不要推 master。

你是 P0-D。做 ST-VIZ-01 + ST-VIZ-02（EPIC-W2-AGENT-VISUAL）。参考 R07 Clyde、R08 aemeath、R09 mikari、R01。

任务：
1) 在 packages/agent 定义 AgentPhase（session start / tool / permission / complete / error 等 8–15 种）。
2) 映射表：phase → 现有 CharacterPose 或 idle + smoke intensity + 一句颓系短气泡（符合 docs/persona.md：短句、不卖萌）。同一 phase 最小展示 800ms 写进配置。
3) 解析现有 Cursor CLI（packages/agent 里 spawn / --print）stdout/stderr 为 AgentPhase 序列；失败则保持 idle，不要抛崩。
4) 用一段假日志 fixture 测解析。

可写：packages/agent/**
禁止：apps/desktop/**、packages/core/**、packages/voice/**、assets/**、docs/agent-split.md、docs/project-tracker.md。
不要做角色窗换脸（ST-VIZ-03）、不要开 HTTP hook（ST-VIZ-04）、不要改 dispatch_cursor 的人设策略。

验证：fixture 测试通过；桌面 build 不被你破坏（你不该改 desktop）。
提交标题：feat(agent): agent phase mapping and CLI progress parse
做完即停。
```

### 6.2 第二批 · 现在并行 P0-E 与 P0-F；G/H 先别开

基线：最新 `origin/master`（已含 #14 路 B、#15 petPhase、#16 PixelRenderer、#17 VAD、#18 AgentPhase）。每条开 **一条新的 Cloud 对话**，自己建 `cursor/…` 分支，不要推 master，不要复用推进板 / 路 B / P0-A～D 对话。

#### P0-E · 状态接线 + 打断 TTS（ST-STATE-03 + ST-VOICE-02）· 现在开

```
你是 Cursor 云端 Agent。仓库是尼古喵喵桌宠（github.com/octaviaus/Nico_yanineco）。
基线：最新 origin/master（必须已能看到 packages/core/src/petPhase.ts、apps/desktop 顶栏 #quit、character.ts 的 isOpaqueAtEvent）。缺一就停，PR 写缺什么，不要自己重做 P0-A/B 或路 B。

你是 P0-E。同一 PR 做 ST-STATE-03 + ST-VOICE-02。代号 S-Speech。参考 R05/R06。

现状（不要拆掉）：
- 主进程已有 speakGen + interruptSpeech() + 按句 synthesizeSpeech；角色窗有 clipQueue / stopSpeechPlayback()。对齐它们，不要第二套队列。
- 路 B：#quit → niko.quit() → app.quit()；透明像素不 startHold；空闲嘴边 SmokeField 细烟用户已接受，不要去改 SmokeField。
- core 已导出：PetPhase、transitionPetPhase / tryTransitionPetPhase、petPhaseToPose、PET_PHASE_FACE。PixelRenderer 已按 pose 切层。

任务：
1) 主进程和/或角色窗维护当前 PetPhase，PTT/播放/工具 busy 走转移表，不要再把 busy/speaking/holding 当唯一真源。非法转移用 tryTransitionPetPhase，不要静默乱跳。
2) 状态变化打一行日志（phase from→to 即可）。
3) 新 utterance 或再次 PTT：调用现有 interruptSpeech / stopSpeechPlayback，清空句队列，口型 setMouthOpen(0)，转到 Listening 或 Idle，不要残留 talk 嘴。
4) handleUtterance 里 LLM 思考用 Thinking，播放用 Speaking，托盘吐一口走 Exhale（已有 applySmoke burst）。
5) preload / env.d.ts 只加字段（例如 onPhase）。保留音频 fileUrl + base64 回退。
6) 热键 Ctrl+Shift+M、× 退出、opaque-only PTT 必须仍在。

可写：apps/desktop/src/renderer/character.ts、apps/desktop/src/main/index.ts、preload/index.ts、env.d.ts（只加字段）。
禁止：packages/voice/**、packages/agent/**、windows.ts、smoke.ts、SmokeField.ts、PixelRenderer.ts、geometry.ts、流式 LLM（chatCompletion stream）、hide 烟窗、setIgnoreMouseEvents、assets/pixel、docs/agent-split.md、config.json。
docs/project-tracker.md 只追加一行 changelog + 认领 P0-E，禁止整篇重写。

验证：npx pnpm@9.15.0 --filter @niko/desktop build
提交标题：feat(desktop): pet phase wiring and barge-in TTS
PR 写：ST-STATE-03 + ST-VOICE-02；本机还需连说两句能打断、phase 日志。不要做 Agent 换脸（P0-G）、不要做穿透（P0-H）。
做完即停。
```

#### P0-F · 流式/分段 ASR（ST-VOICE-03）· 可与 P0-E 同时开

```
你是 Cursor 云端 Agent。仓库是尼古喵喵桌宠（github.com/octaviaus/Nico_yanineco）。
基线：最新 origin/master（必须已有 packages/voice/src/vad.ts 与 createVoiceActivityDetector）。没有就停。

你是 P0-F。只做 ST-VOICE-03 的 packages/voice 部分。代号 V-Timbre。参考 R04/R05。
不要改 apps/desktop（桌面接 VAD/分段 ASR 是 P0-E 合入后的增量，不是你的活）。

现状：
- transcribeAudio() 已按整段 buffer 走 whisper-1 / 本地 http://127.0.0.1:9000/v1。
- VAD：createVoiceActivityDetector、shouldUseLegacyPtt、stt.vad 默认 enabled:false。

任务：
1) 增加可选分段/流式识别 API（例如对 PCM/webm 分片反复调用现有 local/openai STT，或文档化对接 faster-whisper HTTP）。导出函数，写清输入输出类型。
2) 未配置或失败时回退现有 transcribeAudio；不要假装流式可用。
3) config.example.json 可加可选 stt.streaming / 分段字段，默认关。不要改用户 config.json。
4) 不要提交模型权重。packages/voice/.gitignore 已忽略权重则沿用。
5) 给一个最小脚本或测试：disabled 时回退；配置了假/空 endpoint 时明确失败。

可写：packages/voice/**、config.example.json。
禁止：apps/desktop/**、packages/core/**、packages/agent/**、config.json、.env、权重、docs/agent-split.md。
docs/project-tracker.md 只追加一行 changelog + 认领 P0-F。

验证：npx pnpm@9.15.0 --filter @niko/voice typecheck（若有）以及你加的脚本/测试；不要破坏 desktop 引用编译。
提交标题：feat(voice): optional segmented/streaming ASR
PR 写 ST-VOICE-03；桌面接线不是你的。做完即停。
```

#### P0-G · 角色窗消费 AgentPhase（ST-VIZ-03）· 等 P0-E 合入后再开

```
你是 Cursor 云端 Agent。仓库是尼古喵喵桌宠。
基线：最新 origin/master。开工前确认 master 已含 P0-E（character.ts / main 里有 PetPhase 接线）以及 packages/agent 的 AGENT_PHASE_MAP、runCursorAgent({ onPhase })。缺 P0-E 就停，不要自己做状态机接线。

你是 P0-G。只做 ST-VIZ-03。参考 R07 Clyde、R08 aemeath、R09 mikari。

任务：
- 把 runCursorAgent 的 onPhase / AgentPhase 转到角色窗：忙碌/打字、权限提醒、完成短暂 puff 或气泡 → Idle。
- 使用已有 AGENT_PHASE_MAP 与 PHASE_MIN_DISPLAY_MS（800）。不要另写一套映射导致闪烁。
- 气泡短句符合 docs/persona.md：颓、短、不卖萌。映射表里已有文案则沿用。
- PetPhase 仍走 P0-E 的转移表；你只是额外驱动 pose/smoke/bubble。
- 不要做 HTTP hook（ST-VIZ-04）。不要 hide 烟窗、不要 setIgnoreMouseEvents。
- 保留路 B 的 × 和 opaque PTT，保留 P0-E 的打断。

可写：character.ts、main/index.ts 仅转发 agent 事件、preload/env 只加字段。
禁止：packages/voice/**、packages/core/src/petPhase.ts 大改、windows.ts、PixelRenderer 方法签名、assets/pixel、docs/agent-split.md、流式 LLM。
推进板只加 changelog 一行。

验证：npx pnpm@9.15.0 --filter @niko/desktop build；可用 fixture/假 onPhase 事件。
提交标题：feat(desktop): show agent phase on pixel pet
PR 写本机：dispatch_cursor 时能看到忙碌脸。做完即停。
```

#### P0-H · hide 烟窗 + 点击穿透（ST-SHELL + ST-PASS）· 等 P0-G 合入后再开

```
你是 Cursor 云端 Agent。仓库是尼古喵喵桌宠。
基线：最新 origin/master。必须已含路 B、P0-E、P0-G；且没有别人正在改 main/index.ts 或 windows.ts 的未合入 PR。缺一就停。

你是 P0-H。同一 Agent 按顺序做完，禁止再拆：
1) ST-SHELL-01 无烟时 hide 全屏烟窗，托盘「吐一口」再 show + burst
2) ST-SHELL-02 托盘隐藏角色时停 Pixi Ticker + hide 烟窗，显示则恢复
3) ST-PASS-01 角色窗 setIgnoreMouseEvents(true, { forward: true })，可 IPC 开关
4) ST-PASS-02 点到不透明像素/气泡/输入框/#quit 时关闭穿透；透明区点到下层窗口。这不是「只禁止 PTT」（那是已合入的 W15-04）。不要做 Shimeji 爬墙。
注意 Pixi devicePixelRatio。路 B 的 opaque PTT、× 退出、P0-E 打断、P0-G 忙碌脸都要还在。
空闲嘴边细烟不要为了穿透而删掉 SmokeField（用户已接受）。

可写：windows.ts、smoke.ts、SmokeField.ts、smoke.html、main/index.ts（hide/穿透 IPC）、character.ts（hit 采样）、PixelRenderer.ts 仅加 hitTest、preload/env 只加字段。
禁止：packages/**、assets/pixel 层名/尺寸、geometry 画布契约、流式 LLM、docs/agent-split.md。不要和别人对开 W2-Stream。
推进板只加 changelog 一行。

验证：npx pnpm@9.15.0 --filter @niko/desktop build
提交标题：feat(desktop): hide smoke overlay and click-through hitbox
PR 必须写：云 VM 不能测穿透；本机验收透明区点到 IDE、点猫仍可拖/说话/关×、隐藏后 CPU 下降。
做完即停。
```
