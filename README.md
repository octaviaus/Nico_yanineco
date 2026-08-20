# 尼古喵喵桌面助手

猫耳少女桌面宠物：语气颓、爱抽烟，能语音闲聊，也能把写代码的活丢给 Cursor。

开发进度、进行中的需求、后续方案（给云端/本地 Agent 共同维护）：[docs/project-tracker.md](docs/project-tracker.md)。

## 跑起来

需要 Node 20+。本机若没有全局 pnpm，用 `npx pnpm`。PowerShell 若禁止运行 `npx.ps1`，改用 `npx.cmd`：

```powershell
npx.cmd pnpm@9.15.0 install
copy config.example.json config.json
npx.cmd pnpm@9.15.0 dev
```

国内若 Electron 下载卡住，安装前设置：

```powershell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
```

把 `config.json` 里的 `llm.baseURL` / `model` 改成你的云端 API 或本地 Ollama（`http://127.0.0.1:11434/v1`）。密钥用环境变量，不要写进 git：

- `NIKO_LLM_API_KEY` 或 `OPENAI_API_KEY`
- STT 若走云端 Whisper，同样用上述 key

没配 LLM 时喵喵仍会待在桌面上吐烟，但对话只会敷衍你去改配置。

## 怎么用

- **拖动**：按住角色空白处拖。
- **说话**：按住角色，或按住 `Ctrl+Shift+M`，松手发送。也可以在底下输入框打字。
- **托盘**：吐一口 / 散烟 / 显示隐藏 / 退出。
- **编码任务**：跟它说「用 Cursor 帮我……」，它会调用本机 Cursor CLI。

## 云端 / 本地

同一套 OpenAI 兼容接口：

| 用途 | 云端示例 | 本地示例 |
|------|----------|----------|
| LLM | DeepSeek / 通义 / OpenAI | Ollama、LM Studio、vLLM |
| STT | `openai` Whisper | `local` 指向 faster-whisper HTTP，或 `webspeech` |
| TTS | `edge`（默认）/ `openai` | `local` HTTP，或 Windows `sapi` |

## Live2D

当前默认是像素木偶（`assets/pixel` 分层，舞台 240×336；缺层时用色块占位）。把 Cubism 导出的 `*.model3.json` 放到 `assets/live2d/`，并放入官方 Cubism Core（`assets/live2d/runtime/live2dcubismcore.min.js`），Live2D 仍保留资产管线，本阶段不自动切换。分层原图和参数表见 [docs/live2d-spec.md](docs/live2d-spec.md)。

设定图在 `尼古喵喵角色图/`。桌宠当前走像素木偶；分层已按方案 A 切好（不画烟，粒子吐烟），没有 Cubism Editor 时不必继续。头/发交界还不干净，有 PSD 再修。

## Cursor 桥

第一版用 CLI：`agent -p "任务" --print`，或 `cursor <路径>`。需要本机已安装并 `agent login`。

下一步可改成 ACP：`agent acp` + JSON-RPC 流式会话，让喵喵一边抽烟一边播报工具调用。

- `apps/desktop` — Electron 覆盖层
- `packages/core` — 人设与 LLM
- `packages/voice` — STT / TTS
- `packages/agent` — 本地工具与 Cursor 桥
