import { resolveApiKey, type AppConfig } from '@niko/core'

export type Transcript = { text: string }

export function joinUrl(baseURL: string, pathName: string): string {
  const base = baseURL.replace(/\/+$/, '')
  const suffix = pathName.startsWith('/') ? pathName : `/${pathName}`
  if (base.endsWith('/v1') && suffix.startsWith('/v1/')) return `${base}${suffix.slice(3)}`
  return `${base}${suffix}`
}

export async function transcribeAudio(opts: {
  config: AppConfig
  buffer: Buffer
  mime: string
  filename?: string
}): Promise<Transcript> {
  const stt = opts.config.stt
  const provider = stt.provider
  if (provider === 'webspeech') {
    throw new Error('webspeech 在渲染进程处理')
  }
  const baseURL =
    stt.baseURL ||
    (provider === 'local' ? 'http://127.0.0.1:9000/v1' : opts.config.llm.baseURL)
  const apiKey = resolveApiKey(stt.apiKey ? stt : opts.config.llm)
  const url = joinUrl(baseURL, '/audio/transcriptions')

  const form = new FormData()
  const blob = new Blob([new Uint8Array(opts.buffer)], { type: opts.mime || 'audio/webm' })
  form.append('file', blob, opts.filename ?? 'speech.webm')
  form.append('model', stt.model || 'whisper-1')
  form.append('language', 'zh')

  const headers: Record<string, string> = {}
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`

  const res = await fetch(url, { method: 'POST', headers, body: form })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`STT ${res.status}: ${text.slice(0, 400)}`)
  }
  const data = (await res.json()) as { text?: string }
  return { text: (data.text ?? '').trim() }
}
