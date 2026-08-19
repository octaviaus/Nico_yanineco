# 尼古喵喵 · 项目推进板

**用途**：记录开发进度、管理进行中需求、规划后续方案。  
**读者**：人类维护者、Cursor 云端 Agent、Cursor 本地 Agent。  
**真源**：本文档 + `master` 分支 git 历史。有冲突时以 **已 merge 的代码** 为准，本文档负责解释「为什么」和「接下来做什么」。

> **维护规则（Agent 必读）**
>
> 1. **开工前**：读本文档 + [AGENTS.md](../AGENTS.md) +（若涉及并行派工）[agent-split.md](./agent-split.md)。
> 2. **开工时**：把对应需求标为 `in_progress`，写上分支名 / PR 号 / 负责人（cloud / local）。
> 3. **完成时**：标为 `done`，补验证方式；若 scope 变了，更新「后续方案」而不是只改一行状态。
> 4. **阻塞时**：标为 `blocked`，写清缺什么（密钥、本机验收、用户决策等）。
> 5. **每次 PR merge 到 `master`**：更新「当前基线」commit 与变更日志。
> 6. **不要**在本文件里堆大段实现细节；细节放 PR / `gen-log.md` / 代码注释。

---

## 状态词

| 状态 | 含义 |
|------|------|
| `done` | 已合入 `master` 或用户已验收 |
| `in_progress` | 正在开发（有分支或 PR） |
| `planned` | 已排期，未开工 |
| `blocked` | 已知方案但缺前置条件 |
| `deferred` | 明确不做或延后 |
| `cancelled` | 需求作废或被新方案取代 |

---

## 当前基线

| 项 | 值 |
|----|-----|
| 默认分支 | `master` |
| 当前 tip | `5a17d58` — Merge PR #10（文档契约 240×336 @ scale=1） |
| 像素资产 tip | `e7e425a` — nanobanana 240×336 idle 分层 |
| 远程分支 | 仅 `origin/master`（历史 stale 分支已清理） |
| 开放 PR | 无 |

---

## 1. 开发进度总览

### Wave 1 — 已完成 ✅

| ID | 内容 | PR / commit | 状态 |
|----|------|-------------|------|
| W1-01 | 像素渲染器默认路径 | #4 `fd2e984` | `done` |
| W1-02 | AI / 脚本生成分层像素资产（初版） | #6 | `done` |
| W1-03 | nanobanana 240×336 官方 idle 资产 | `e7e425a` | `done` |
| W1-04 | 慢速女声 TTS 默认 | #3 | `done` |
| W1-05 | 全屏烟窗 idle 停转 | #2 | `done` |
| W1-06 | 按句播放 + RMS 口型 | #5 | `done` |
| W1-07 | Cloud Agent 基线文档与环境 | `15fc40a` | `done` |
| W1-08 | 文档契约对齐 240×336 @ scale=1 | #10 `5a17d58` | `done` |
| W1-09 | stale 分支清理 | — | `done` |

### Wave 1.5 — 收尾 / 体验（未全部完成）

| ID | 内容 | 优先级 | 状态 | 备注 |
|----|------|--------|------|------|
| W15-01 | 本机非脸部功能验收 | P0 | `in_progress` | 用户本地 agent 进行中 |
| W15-02 | 前端「关闭桌宠」按钮 | P0 | `in_progress` | 分支 `cursor/add-close-pet-button-45ab`（WIP，未 push） |
| W15-03 | 角色窗 idle 自动 puff 去掉 | P1 | `planned` | 改 `character.ts`；代号 R-Smoke 跟进 |
| W15-04 | 透明区误触 PTT | P1 | `planned` | 改 `character.ts`；代号 S-Speech 跟进 |
| W15-05 | `mouth-smoke.png` 接入 exhale pose | P2 | `planned` | 改 `assets/pixel/sheet.json` + 渲染 |
| W15-06 | 像素脸/手视觉 polish | P1 | `in_progress` | 用户本地 agent；只动 `assets/pixel/**` |

> W15-03～05 可后置，不阻塞 Wave 2；但建议在开 Wave 2 前至少完成 W15-01、W15-02。

---

## 2. 进行中需求（详细）

### REQ-001 · 本机验收（非脸部）

| 字段 | 内容 |
|------|------|
| 状态 | `in_progress` |
| 负责人 | 本地 agent / 用户 |
| 基线 | `master` @ `5a17d58` |
| 范围 | 构建、启动、聊天、TTS 队列、RMS 口型、拖拽、PTT 热键、全屏烟 idle |
| 排除 | 脸部像素审美（单独跟踪 REQ-002） |
| 完成标准 | 结构化报告：每项 通过/失败/待确认 + 证据 |
| 阻塞 | 无 |

### REQ-002 · 像素视觉 polish

| 字段 | 内容 |
|------|------|
| 状态 | `in_progress` |
| 负责人 | 本地 agent |
| 可写路径 | `assets/pixel/**`、`scripts/gen-pixel-puppet.py` |
| 禁止 | 与 S-Speech / R-Speech 同时改 `character.ts` |
| 参考 | `assets/pixel/gen-log.md`、`docs/visual-optimization-brief.md` |
| 完成标准 | `_preview-stack.png` 与 idle 一致；层叠无错位 |

### REQ-003 · 前端关闭桌宠

| 字段 | 内容 |
|------|------|
| 状态 | `in_progress` |
| 负责人 | cloud agent（本对话 WIP） |
| 分支 | `cursor/add-close-pet-button-45ab` |
| 方案 | 角色窗顶栏 `×` → preload `niko.quit()` → main `app.quit()` |
| 已改文件 | `character.html/css/ts`、`preload/index.ts`、`main/index.ts`、`env.d.ts` |
| 待做 | build 验证、手工点关闭、开 PR merge |
| 说明 | 托盘「退出」仍保留；本需求补 UI 入口 |

---

## 3. 后续开发方案

### Wave 2（`master` 稳定 + W15-01/02 完成后启动）

| ID | 代号 | 内容 | 依赖 | 状态 |
|----|------|------|------|------|
| W2-01 | W2-Clone | GPT-SoVITS 9880 克隆音色说明；权重不进 git | 无 | `planned` |
| W2-02 | W2-Stream | LLM 流式 + 按句 TTS | 与 W2-03 **串行** | `planned` |
| W2-03 | W2-Shell | hide 烟窗、点击穿透、隐藏停画 | 与 W2-02 **串行** | `planned` |
| W2-04 | W2-SFX | 吸/吐短 WAV | 无 | `planned` |

**Wave 2 启动条件**

- [ ] REQ-001 本机验收通过（或明确列出 P0 阻塞项）
- [ ] REQ-003 关闭按钮已 merge
- [ ] 像素 baseline（`e7e425a`）不再频繁 force-push 重写

**派工参考**：详细文件独占与提示词见 [agent-split.md §10](./agent-split.md)。

### 长期 backlog（未排期）

| ID | 内容 | 状态 |
|----|------|------|
| BL-01 | ACP Cursor 桥完善 | `planned` |
| BL-02 | Live2D 真模型接入（像素仍为默认） | `deferred` |
| BL-03 | 设置 UI | `planned` |
| BL-04 | 对话持久化 | `planned` |
| BL-05 | 安装包 / 分发 | `planned` |
| BL-06 | CI + 自动化测试 | `planned` |
| BL-07 | GitHub Issues 与 PR 模板 | `planned` |

---

## 4. 已知问题与技术债

| ID | 问题 | 严重度 | 关联 REQ | 状态 |
|----|------|--------|----------|------|
| ISS-01 | 角色窗仍按 `idlePuffSeconds` 自动 exhale + burst | P1 | W15-03 | `planned` |
| ISS-02 | canvas 任意左键触发 PTT，透明区误录 | P1 | W15-04 | `planned` |
| ISS-03 | `mouth-smoke.png` 未写入 `sheet.json` slots | P2 | W15-05 | `planned` |
| ISS-04 | `pixelSheet.ts` 内 `DEFAULT_PIXEL_SHEET` 占位色块仍为旧 80×112 比例常量 | P3 | — | `done`（#10 已改常量；占位形状未重做，无 PNG 时才用） |
| ISS-05 | 无 GitHub Issue 跟踪 | P3 | BL-07 | `planned` |

---

## 5. Agent 协作约定

### 分支命名

- 云端 / 通用功能：`cursor/<简述>-45ab`
- 按 agent-split 派工：`agent/<代号>`（Wave 1 已结束，Wave 2 可复用）

### 文档分工

| 文档 | 用途 |
|------|------|
| **本文档** `project-tracker.md` | 进度、需求状态、路线图（**经常更新**） |
| [agent-split.md](./agent-split.md) | Wave 并行派工契约与提示词（**少改**，契约变更时改） |
| [AGENTS.md](../AGENTS.md) | Agent 入口须知 |
| [visual-optimization-brief.md](./visual-optimization-brief.md) | 视觉真源与验收标准 |
| [gen-log.md](../assets/pixel/gen-log.md) | 像素资产生成记录 |

### 更新本文档的最小 checklist

```markdown
- [ ] 「当前基线」commit 是否为最新 master？
- [ ] 进行中需求是否只有真正 in_progress 的项？
- [ ] 新需求是否分配了 ID（REQ-xxx / W2-xx / BL-xx）？
- [ ] merge 后是否写了变更日志一行？
```

---

## 6. 变更日志

| 日期 (UTC) | 变更 | 操作者 |
|------------|------|--------|
| 2026-08-19 | 初版推进板；记录 Wave1 完成、W15/W2/backlog；REQ-001～003 | cloud agent |
| 2026-08-19 | PR #10 merge；文档契约 240×336；stale 分支清理 | 用户 + cloud agent |
| 2026-08-19 | `e7e425a` nanobanana 像素资产 landing | 用户 local push |

---

*最后更新：2026-08-19 · 维护者：项目推进板（请 agent 在每次任务结束时更新本节日期）*
