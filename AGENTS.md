# Agent 须知

桌宠「尼古喵喵」。视觉主路径是 **240×336 分层像素木偶（scale=1）**，不是 Live2D。

**开工前必读**

1. [docs/project-tracker.md](docs/project-tracker.md) — 进度、进行中需求、后续方案（**本地和云端都要读、都要改**）
2. [docs/agent-split.md](docs/agent-split.md) — 并行派工时的文件独占与提示词
3. 做 P0/P1 新功能前再读 [docs/pm-epics-p0-p1.md](docs/pm-epics-p0-p1.md)（Epic/Story）。**不要改** `agent-split.md` 冻结契约（层名、240×336、`sheet.json` 字段名）。

## 所有 Agent（本地 + 云端）

- **维护推进板**：开工把对应 ID 标 `in_progress` 并写上分支；合入或验收后标 `done`，更新「当前快照」和变更日志。新口头需求先登记 `REQ-xxx` 再写代码。
- **推进板例外**：即使下面写「只改可写路径」，**所有人都可以改** `docs/project-tracker.md`（只改自己的认领/状态/快照/日志，禁止整篇重排）。
- 不要和别人抢同一源码文件；并行时以 `agent-split.md` 的可写/禁止为准。
- 不要提交 `config.json`、`.env`、TTS 模型权重。不要继续切 `assets/live2d-layers/`。

## Cursor Cloud specific instructions

- 只改 `docs/agent-split.md` 里你的代号「可写」路径，外加 `docs/project-tracker.md`。禁止列表碰了会和其他 Cloud Agent 的 PR 冲突。
- 从任务指定的基线分支开 `agent/<id>`（或任务指定的 `cursor/…` 分支），做完开 PR，不要直接推默认分支。
- 设定图真源：优先 `尼古喵喵角色图/nico_miaomiao_transparent.png`（去底），否则 `尼古喵喵角色图/50.webp`。运行时读 `assets/pixel/`。若缺失，不要用随便一只猫顶替。不要为了满足旧路径再拷一份到 `assets/ref/`。
- 验证：`npx pnpm@9.15.0 --filter @niko/desktop build`（P-Puppet / S-Speech / R-Smoke）。P-Gen 验证看 `assets/pixel/_preview-stack.png`。
- Electron 桌宠在无头云 VM 里不必 `pnpm dev`；能 build 即可。本机 GUI 验收记在推进板 W15-01，不要假装已经点过窗口。
