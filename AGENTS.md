# Agent 须知

桌宠「尼古喵喵」。视觉主路径是 **240×336 分层像素木偶（scale=1）**，不是 Live2D。

**开工前必读**：[docs/project-tracker.md](docs/project-tracker.md)（进度、进行中需求、后续方案）。  
**并行派工契约**：[docs/agent-split.md](docs/agent-split.md)（文件独占、Wave 提示词）。

## 所有 Agent 通用

- **维护推进板**：任务开始 → 把对应 REQ/W15/W2 标 `in_progress`；merge 或验收完成 → 标 `done` 并更新「当前基线」与变更日志。
- 不要与其他 agent 抢同一文件；抢线时以 `agent-split.md` 的「可写/禁止」为准。

## Cursor Cloud specific instructions

- 只改 `docs/agent-split.md` 里你的代号「可写」路径。禁止列表碰了会和其他 Cloud Agent 的 PR 冲突。
- 从任务指定的基线分支开 `agent/<id>`，做完开 PR，不要直接推默认分支。
- 设定图真源：优先 `assets/ref/official-sheet.png`（去底），否则 `official-sheet.webp`。若缺失，不要用随便一只猫顶替。
- 验证：`npx pnpm@9.15.0 --filter @niko/desktop build`（P-Puppet / S-Speech / R-Smoke）。P-Gen 验证看 `assets/pixel/_preview-stack.png`。
- 不要提交 `config.json`、`.env`、TTS 模型权重。
- 不要继续切 `assets/live2d-layers/`。
- Electron 桌宠在无头云 VM 里不必 `pnpm dev`；能 build 即可。
