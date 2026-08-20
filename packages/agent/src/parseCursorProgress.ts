import type { AgentPhase } from './agentPhase.js'

export type AgentPhaseEvent = {
  phase: AgentPhase
  detail?: string
  source?: 'stdout' | 'stderr' | 'process'
}

export type CursorProgressParser = {
  push: (chunk: string, source?: 'stdout' | 'stderr') => AgentPhaseEvent[]
  finish: (opts?: { exitCode?: number; timedOut?: boolean }) => AgentPhaseEvent[]
}

const READING_TOOLS = /read|ls|list|cat|open/i
const WRITING_TOOLS = /write|edit|delete|apply|patch|strreplace/i
const SEARCH_TOOLS = /grep|glob|search|semantic|find/i

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function toolKind(toolCall: unknown): string {
  const obj = asRecord(toolCall)
  if (!obj) return ''
  const fn = asRecord(obj.function)
  if (fn && typeof fn.name === 'string') return fn.name
  if (typeof obj.name === 'string') return obj.name
  for (const key of Object.keys(obj)) {
    if (/toolcall$/i.test(key) || key === 'tool') return key
  }
  return Object.keys(obj)[0] ?? ''
}

function toolPhase(kind: string): AgentPhase {
  if (READING_TOOLS.test(kind)) return 'reading'
  if (WRITING_TOOLS.test(kind)) return 'writing'
  if (SEARCH_TOOLS.test(kind)) return 'searching'
  return 'tool_call'
}

function toolFailed(toolCall: unknown): boolean {
  const obj = asRecord(toolCall)
  if (!obj) return false
  for (const value of Object.values(obj)) {
    const body = asRecord(value)
    const result = asRecord(body?.result) ?? body
    if (!result) continue
    if (result.success === false || result.is_error === true) return true
    if (asRecord(result.error) || asRecord(result.failure)) return true
    const err = asRecord(result.error)
    if (str(result.error) || str(err?.message)) return true
  }
  return false
}

function looksLikePermission(obj: Record<string, unknown>): boolean {
  const type = str(obj.type).toLowerCase()
  const subtype = str(obj.subtype).toLowerCase()
  if (type === 'request' || type === 'permission') return true
  if (/permission|approval|ask.?user/.test(subtype)) return true
  const message = str(obj.message)
  return /permission|approval|allow.?this|needs.?your|ask.?user/i.test(message)
}

function eventFromJson(obj: Record<string, unknown>): AgentPhaseEvent | null {
  const type = str(obj.type).toLowerCase()
  const subtype = str(obj.subtype).toLowerCase()

  if (looksLikePermission(obj) && type !== 'system' && type !== 'result') {
    return { phase: 'permission', detail: subtype || type }
  }

  if (type === 'system' && (subtype === 'init' || subtype === 'session_start' || !subtype)) {
    return { phase: 'session_start', detail: str(obj.model) || subtype || 'init' }
  }
  if (type === 'system' && /notif/i.test(subtype)) {
    return { phase: 'thinking', detail: subtype }
  }

  if (type === 'thinking' || subtype === 'thinking') {
    return { phase: 'thinking' }
  }

  if (type === 'assistant' || type === 'agent') {
    return { phase: 'streaming' }
  }

  if (type === 'tool_call' || type === 'tool') {
    const kind = toolKind(obj.tool_call ?? obj.toolCall ?? obj)
    if (subtype === 'completed' || subtype === 'success' || subtype === 'end') {
      if (toolFailed(obj.tool_call ?? obj.toolCall ?? obj)) {
        return { phase: 'error', detail: kind || 'tool' }
      }
      return { phase: 'tool_result', detail: kind || 'tool' }
    }
    return { phase: toolPhase(kind), detail: kind || 'tool' }
  }

  if (type === 'result' || type === 'completion') {
    const isError =
      obj.is_error === true ||
      subtype === 'error' ||
      subtype === 'failure' ||
      subtype === 'failed'
    if (isError) return { phase: 'error', detail: str(obj.result) || subtype }
    if (subtype === 'cancelled' || subtype === 'canceled') {
      return { phase: 'cancelled' }
    }
    return { phase: 'complete', detail: subtype || 'success' }
  }

  if (type === 'error' || subtype === 'error') {
    return { phase: 'error', detail: str(obj.message) || str(obj.result) || type }
  }

  if (type === 'user' || type === 'prompt') return null

  return null
}

function eventFromText(line: string, source: 'stdout' | 'stderr'): AgentPhaseEvent | null {
  const t = line.trim()
  if (!t) return null

  if (/permission|approval required|waiting for approval|needs approval|allow this|你批/i.test(t)) {
    return { phase: 'permission', detail: t.slice(0, 120), source }
  }
  if (/timed? out|timeout|跑太久/i.test(t)) {
    return { phase: 'timeout', detail: t.slice(0, 120), source }
  }
  if (/\bcancel+ed\b|\baborted\b|用户取消|算了/i.test(t)) {
    return { phase: 'cancelled', detail: t.slice(0, 120), source }
  }
  if (/\berror\b|\bfatal\b|\bexception\b|failed to|\bEACCES\b|\bENOENT\b|没接住/i.test(t)) {
    return { phase: 'error', detail: t.slice(0, 120), source }
  }
  if (/session start|starting session|agent started/i.test(t)) {
    return { phase: 'session_start', source }
  }
  if (/\b(grep|glob|search(ing)?)\b/i.test(t)) {
    return { phase: 'searching', source }
  }
  if (/\b(read(ing)?|open(ed)? file|ls )\b/i.test(t)) {
    return { phase: 'reading', source }
  }
  if (/\b(writ(e|ing)|edit(ed|ing)?|apply(ing)? patch)\b/i.test(t)) {
    return { phase: 'writing', source }
  }
  if (/\b(tool|running|calling)\b/i.test(t)) {
    return { phase: 'tool_call', source }
  }
  if (source === 'stderr') return null
  if (t.length < 2) return null
  return { phase: 'streaming', source }
}

function tryParseJson(text: string): Record<string, unknown> | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  const start = trimmed[0]
  if (start !== '{' && start !== '[') return null
  try {
    const parsed: unknown = JSON.parse(trimmed)
    return asRecord(parsed)
  } catch {
    return null
  }
}

function eventsFromUnknown(raw: unknown, source: 'stdout' | 'stderr'): AgentPhaseEvent[] {
  const obj = asRecord(raw)
  if (!obj) return []
  const one = eventFromJson(obj)
  return one ? [{ ...one, source }] : []
}

/**
 * 增量解析 Cursor CLI `--print` / stream-json NDJSON。
 * 任何坏行都跳过；解析失败不抛。
 */
export function createCursorProgressParser(): CursorProgressParser {
  let stdoutBuf = ''
  let stderrBuf = ''
  let lastPhase: AgentPhase | null = null
  let sawTerminal = false

  const emit = (ev: AgentPhaseEvent | null): AgentPhaseEvent[] => {
    if (!ev) return []
    if (ev.phase === 'complete' || ev.phase === 'error' || ev.phase === 'cancelled' || ev.phase === 'timeout') {
      sawTerminal = true
    }
    lastPhase = ev.phase
    return [ev]
  }

  const takeLines = (buf: string): { lines: string[]; rest: string } => {
    const parts = buf.split(/\r?\n/)
    const rest = parts.pop() ?? ''
    return { lines: parts, rest }
  }

  const handleLine = (line: string, source: 'stdout' | 'stderr'): AgentPhaseEvent[] => {
    const trimmed = line.trim()
    if (!trimmed) return []
    const obj = tryParseJson(trimmed)
    if (obj) return emit(eventsFromUnknown(obj, source)[0] ?? null)
    return emit(eventFromText(trimmed, source))
  }

  return {
    push(chunk: string, source: 'stdout' | 'stderr' = 'stdout'): AgentPhaseEvent[] {
      try {
        const text = typeof chunk === 'string' ? chunk : String(chunk ?? '')
        if (!text) return []
        const out: AgentPhaseEvent[] = []
        if (source === 'stderr') {
          stderrBuf += text
          const { lines, rest } = takeLines(stderrBuf)
          stderrBuf = rest
          for (const line of lines) out.push(...handleLine(line, 'stderr'))
        } else {
          stdoutBuf += text
          const { lines, rest } = takeLines(stdoutBuf)
          stdoutBuf = rest
          for (const line of lines) out.push(...handleLine(line, 'stdout'))
        }
        return out
      } catch {
        return []
      }
    },
    finish(opts: { exitCode?: number; timedOut?: boolean } = {}): AgentPhaseEvent[] {
      try {
        const out: AgentPhaseEvent[] = []
        const leftoverOut = stdoutBuf
        const leftoverErr = stderrBuf
        stdoutBuf = ''
        stderrBuf = ''

        const leftoverJson = tryParseJson(leftoverOut)
        if (leftoverJson) {
          out.push(...emit(eventsFromUnknown(leftoverJson, 'stdout')[0] ?? null))
        } else if (leftoverOut.trim()) {
          out.push(...handleLine(leftoverOut, 'stdout'))
        }
        if (leftoverErr.trim()) {
          const errJson = tryParseJson(leftoverErr)
          if (errJson) out.push(...emit(eventsFromUnknown(errJson, 'stderr')[0] ?? null))
          else out.push(...handleLine(leftoverErr, 'stderr'))
        }

        if (opts.timedOut) {
          if (lastPhase !== 'timeout') out.push(...emit({ phase: 'timeout', source: 'process' }))
          return out.length ? out : [{ phase: 'timeout', source: 'process' }]
        }
        if (typeof opts.exitCode === 'number') {
          if (opts.exitCode !== 0 && !sawTerminal) {
            out.push(...emit({ phase: 'error', detail: `exit ${opts.exitCode}`, source: 'process' }))
          } else if (opts.exitCode === 0 && lastPhase !== null && !sawTerminal) {
            out.push(...emit({ phase: 'complete', source: 'process' }))
          }
        }
        if (out.length === 0 && lastPhase === null) {
          return [{ phase: 'idle', source: 'process' }]
        }
        return out
      } catch {
        return [{ phase: 'idle', source: 'process' }]
      }
    }
  }
}

/** 整段 stdout/stderr → phase 序列。失败则 `[idle]`，不抛。默认当作一次已结束的 --print。 */
export function parseCursorCliOutput(
  stdout: string,
  stderr = '',
  opts?: { exitCode?: number; timedOut?: boolean }
): AgentPhaseEvent[] {
  try {
    const parser = createCursorProgressParser()
    const events = [
      ...parser.push(stdout ?? '', 'stdout'),
      ...parser.push(stderr ?? '', 'stderr'),
      ...parser.finish({ exitCode: opts?.exitCode ?? 0, timedOut: opts?.timedOut })
    ]
    return events.length ? events : [{ phase: 'idle', source: 'process' }]
  } catch {
    return [{ phase: 'idle', source: 'process' }]
  }
}

/** 从 stream-json / 纯文本 `--print` 里抽出给人看的最终回复。 */
export function extractCursorResultText(stdout: string, stderr = ''): string {
  try {
    const chunks = `${stdout ?? ''}\n${stderr ?? ''}`.split(/\r?\n/)
    let result = ''
    for (const line of chunks) {
      const obj = tryParseJson(line)
      if (!obj) continue
      if (str(obj.type) === 'result' && typeof obj.result === 'string' && obj.result.trim()) {
        result = obj.result
      }
    }
    if (result) return result.trim()
    const blob = tryParseJson(stdout ?? '')
    if (blob && typeof blob.result === 'string' && blob.result.trim()) return blob.result.trim()
    const text = (stdout ?? '').trim()
    if (text && !text.startsWith('{')) return text
    return (stderr ?? '').trim()
  } catch {
    return (stdout || stderr || '').trim()
  }
}
