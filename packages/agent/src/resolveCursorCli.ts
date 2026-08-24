import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

/** 编辑器启动器，不能当 Agent CLI 用。 */
export function isEditorCursorLauncher(cmd: string): boolean {
  const base = path.basename(cmd).replace(/\.exe$/i, '').replace(/\.cmd$/i, '').toLowerCase()
  return base === 'cursor' || base === 'cursor-app'
}

export const MISSING_CURSOR_AGENT_CLI =
  '本机没有 Cursor Agent CLI（命令是 agent，不是编辑器里的 cursor.exe）。PowerShell 执行：irm \'https://cursor.com/install?win32=true\' | iex，装完新开终端跑 agent login。'

function whichCmd(cmd: string): string | null {
  const finder = process.platform === 'win32' ? 'where' : 'which'
  const r = spawnSync(finder, [cmd], { windowsHide: true, encoding: 'utf8' })
  if (r.status !== 0) return null
  const line = (r.stdout || '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .find(Boolean)
  return line || null
}

function existingFile(p: string): string | null {
  return p && existsSync(p) ? p : null
}

/** 解析真正的 `agent` CLI。找不到返回 null，不要回退到 IDE 的 cursor.exe。 */
export function resolveCursorAgentCli(preferred?: string): string | null {
  const home = homedir()
  const localApp = process.env.LOCALAPPDATA || ''
  const candidates = [
    preferred?.trim(),
    'agent',
    'agent.exe',
    path.join(home, '.local', 'bin', 'agent'),
    path.join(home, '.local', 'bin', 'agent.exe'),
    localApp ? path.join(localApp, 'cursor-agent', 'agent.exe') : '',
    localApp ? path.join(localApp, 'cursor-agent', 'agent.cmd') : '',
    localApp ? path.join(localApp, 'Programs', 'cursor-agent', 'agent.exe') : ''
  ]

  const seen = new Set<string>()
  for (const raw of candidates) {
    const c = raw?.trim()
    if (!c || seen.has(c)) continue
    seen.add(c)
    if (isEditorCursorLauncher(c)) continue
    if (c.includes('/') || c.includes('\\')) {
      const hit = existingFile(c)
      if (hit) return hit
      continue
    }
    const hit = whichCmd(c)
    if (hit && !isEditorCursorLauncher(hit)) return c
  }
  return null
}

/** 无头派活参数。`--trust` 是 print 模式的硬性要求，否则未信任目录会直接拒。 */
export function buildCursorAgentArgs(prompt: string, workspace: string): string[] {
  return ['-p', '--trust', '--workspace', workspace, prompt]
}
