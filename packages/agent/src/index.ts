import { spawn } from 'node:child_process'
import type { AppConfig, ToolDef } from '@niko/core'
import { createCursorProgressParser, extractCursorResultText } from './parseCursorProgress.js'
import type { AgentPhaseEvent } from './parseCursorProgress.js'

export type { AgentPhase, AgentPhaseVisual } from './agentPhase.js'
export {
  AGENT_PHASES,
  AGENT_PHASE_MAP,
  PHASE_MIN_DISPLAY_MS,
  getAgentPhaseVisual,
  isAgentPhase
} from './agentPhase.js'
export type { AgentPhaseEvent, CursorProgressParser } from './parseCursorProgress.js'
export {
  parseCursorCliOutput,
  createCursorProgressParser,
  extractCursorResultText
} from './parseCursorProgress.js'

export const AGENT_TOOLS: ToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'set_smoke',
      description: '调节屏幕烟雾。用户说抽烟、吐一口、散烟、浓一点时使用。',
      parameters: {
        type: 'object',
        properties: {
          intensity: { type: 'number', description: '0 到 1，整体浓度' },
          burst: { type: 'boolean', description: '是否喷一大口全屏烟' },
          clear: { type: 'boolean', description: '立刻散烟' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'open_path',
      description: '用系统默认程序打开本地文件或文件夹。',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '绝对路径' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_clipboard',
      description: '读取用户当前剪贴板文本。',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'dispatch_cursor',
      description:
        '把编码/改仓库任务交给本机 Cursor CLI 执行。用户要写代码、修 bug、改项目时用这个，不要自己编补丁。',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: '给 Cursor 的任务说明' },
          workspace: { type: 'string', description: '可选，工程目录' }
        },
        required: ['prompt']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'open_in_cursor',
      description: '用 Cursor 打开某个文件或文件夹。',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '绝对路径' }
        },
        required: ['path']
      }
    }
  }
]

export type AgentHost = {
  config: AppConfig
  setSmoke: (cmd: { intensity?: number; burst?: boolean; clear?: boolean }) => void
  openPath: (p: string) => Promise<string>
  readClipboard: () => string
  confirm: (message: string) => Promise<boolean>
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  host: AgentHost
): Promise<string> {
  switch (name) {
    case 'set_smoke': {
      const intensity = num(args.intensity)
      const burst = Boolean(args.burst)
      const clear = Boolean(args.clear)
      host.setSmoke({ intensity, burst, clear })
      if (clear) return '烟散了。'
      if (burst) return '吐了一大口。'
      if (intensity != null) return `烟雾调到 ${intensity.toFixed(2)}。`
      return '烟还在。'
    }
    case 'open_path': {
      const p = str(args.path)
      if (!p) return '没给路径。'
      const ok = await host.confirm(`打开这个？\n${p}`)
      if (!ok) return '用户懒得开。'
      return host.openPath(p)
    }
    case 'read_clipboard': {
      const text = host.readClipboard()
      return text ? text.slice(0, 4000) : '剪贴板是空的。'
    }
    case 'dispatch_cursor': {
      const prompt = str(args.prompt)
      if (!prompt) return '没说要 Cursor 干什么。'
      const workspace = str(args.workspace) || host.config.cursor.workspace || process.cwd()
      const ok = await host.confirm(`把这活扔给 Cursor？\n${prompt.slice(0, 200)}`)
      if (!ok) return '用户取消了，那就算了。'
      return runCursorAgent(host.config.cursor.cli || 'agent', prompt, workspace)
    }
    case 'open_in_cursor': {
      const p = str(args.path)
      if (!p) return '没给路径。'
      return openInCursor(p)
    }
    default:
      return `没有这个工具：${name}`
  }
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

export type RunCursorAgentOptions = {
  onPhase?: (event: AgentPhaseEvent) => void
}

function emitPhase(onPhase: RunCursorAgentOptions['onPhase'], event: AgentPhaseEvent) {
  try {
    onPhase?.(event)
  } catch {
    /* 可视化回调崩了也不能让 Cursor 桥跟着炸 */
  }
}

function runCommand(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs = 1000 * 60 * 8,
  onChunk?: (stream: 'stdout' | 'stderr', chunk: string) => void
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: true,
      windowsHide: true,
      env: process.env
    })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('Cursor 跑太久，我先撤了'))
    }, timeoutMs)
    child.stdout.on('data', (d) => {
      const chunk = d.toString()
      stdout += chunk
      if (stdout.length > 80_000) stdout = stdout.slice(-40_000)
      try {
        onChunk?.('stdout', chunk)
      } catch {
        /* keep idle */
      }
    })
    child.stderr.on('data', (d) => {
      const chunk = d.toString()
      stderr += chunk
      if (stderr.length > 20_000) stderr = stderr.slice(-10_000)
      try {
        onChunk?.('stderr', chunk)
      } catch {
        /* keep idle */
      }
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? 1, stdout, stderr })
    })
  })
}

export async function runCursorAgent(
  cli: string,
  prompt: string,
  workspace: string,
  options?: RunCursorAgentOptions
): Promise<string> {
  const attempts: Array<{ cmd: string; args: string[] }> = [
    { cmd: cli, args: ['-p', prompt, '--print'] },
    { cmd: 'agent', args: ['-p', prompt, '--print'] },
    { cmd: 'cursor', args: ['agent', '-p', prompt, '--print'] }
  ]
  const seen = new Set<string>()
  let lastErr = ''
  let started = false
  for (const a of attempts) {
    const key = `${a.cmd}|${a.args.join(' ')}`
    if (seen.has(key)) continue
    seen.add(key)
    const parser = createCursorProgressParser()
    if (!started) {
      started = true
      emitPhase(options?.onPhase, { phase: 'session_start', source: 'process' })
    }
    try {
      const r = await runCommand(a.cmd, a.args, workspace, 1000 * 60 * 8, (stream, chunk) => {
        for (const ev of parser.push(chunk, stream)) emitPhase(options?.onPhase, ev)
      })
      for (const ev of parser.finish({ exitCode: r.code })) emitPhase(options?.onPhase, ev)
      const spoken = extractCursorResultText(r.stdout, r.stderr)
      const body = spoken || (r.stdout || r.stderr).trim()
      if (r.code === 0) {
        return body ? `Cursor 说：\n${body.slice(0, 6000)}` : 'Cursor 跑完了，没吐字。'
      }
      lastErr = body || `exit ${r.code}`
    } catch (err) {
      const timedOut = err instanceof Error && err.message.includes('跑太久')
      for (const ev of parser.finish({ timedOut, exitCode: 1 })) emitPhase(options?.onPhase, ev)
      lastErr = err instanceof Error ? err.message : String(err)
    }
  }
  emitPhase(options?.onPhase, { phase: 'error', detail: lastErr.slice(0, 120), source: 'process' })
  return `Cursor 没接住：${lastErr}。确认装了 Cursor CLI 并登录过（agent login）。`
}

export async function openInCursor(target: string): Promise<string> {
  try {
    const r = await runCommand('cursor', [target], process.cwd(), 15_000)
    if (r.code === 0) return `已经丢给 Cursor：${target}`
    return r.stderr || r.stdout || `cursor 退出 ${r.code}`
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return `打不开 Cursor：${msg}`
  }
}
