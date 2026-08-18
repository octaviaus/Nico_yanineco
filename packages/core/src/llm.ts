import type { AppConfig, ChatMessage, ChatResult, LlmConfig, ToolDef } from './types.js'

export function resolveApiKey(cfg: { apiKey?: string; apiKeyEnv?: string }): string {
  if (cfg.apiKey?.trim()) return cfg.apiKey.trim()
  const names = [cfg.apiKeyEnv, 'NIKO_LLM_API_KEY', 'OPENAI_API_KEY'].filter(Boolean) as string[]
  for (const name of names) {
    const v = process.env[name]
    if (v?.trim()) return v.trim()
  }
  return ''
}

export function hasLlmCredentials(config: AppConfig): boolean {
  const url = config.llm.baseURL ?? ''
  const local = /localhost|127\.0\.0\.1/i.test(url)
  return local || Boolean(resolveApiKey(config.llm))
}

function joinUrl(baseURL: string, path: string): string {
  const base = baseURL.replace(/\/+$/, '')
  const suffix = path.startsWith('/') ? path : `/${path}`
  if (base.endsWith('/v1') && suffix.startsWith('/v1/')) {
    return `${base}${suffix.slice(3)}`
  }
  return `${base}${suffix}`
}

export async function chatCompletion(opts: {
  llm: LlmConfig
  messages: ChatMessage[]
  tools?: ToolDef[]
  temperature?: number
}): Promise<ChatResult> {
  const apiKey = resolveApiKey(opts.llm)
  const url = joinUrl(opts.llm.baseURL, '/chat/completions')
  const payload: Record<string, unknown> = {
    model: opts.llm.model,
    messages: opts.messages.map(toOpenAiMessage),
    temperature: opts.temperature ?? 0.8
  }
  if (opts.tools?.length) {
    payload.tools = opts.tools
    payload.tool_choice = 'auto'
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`LLM ${res.status}: ${text.slice(0, 400)}`)
  }
  const data = (await res.json()) as {
    choices?: Array<{
      message?: {
        content?: string | null
        tool_calls?: Array<{
          id: string
          function: { name: string; arguments: string }
        }>
      }
    }>
  }
  const msg = data.choices?.[0]?.message
  const toolCalls =
    msg?.tool_calls?.map((c) => ({
      id: c.id,
      name: c.function.name,
      arguments: c.function.arguments ?? '{}'
    })) ?? []
  return { content: (msg?.content ?? '').trim(), toolCalls }
}

function toOpenAiMessage(m: ChatMessage): Record<string, unknown> {
  if (m.role === 'tool') {
    return { role: 'tool', content: m.content, tool_call_id: m.toolCallId }
  }
  if (m.role === 'assistant' && m.toolCalls?.length) {
    return {
      role: 'assistant',
      content: m.content || null,
      tool_calls: m.toolCalls.map((t) => ({
        id: t.id,
        type: 'function',
        function: { name: t.name, arguments: t.arguments }
      }))
    }
  }
  return { role: m.role, content: m.content }
}
