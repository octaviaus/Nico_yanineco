import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { resolveApiKey, type AppConfig } from '@niko/core'

export type Transcript = { text: string }

function joinUrl(baseURL: string, pathName: string): string {
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

export type SynthResult = { buffer: Buffer; mime: string }

export async function synthesizeSpeech(opts: {
  config: AppConfig
  text: string
}): Promise<SynthResult> {
  const provider = opts.config.tts.provider
  const text = opts.text.trim()
  if (!text) return { buffer: Buffer.alloc(0), mime: 'audio/wav' }

  try {
    if (provider === 'openai') return await openaiTts(opts.config, text)
    if (provider === 'local') return await localTts(opts.config, text)
    if (provider === 'sapi') return await sapiTts(text)
    return await edgeTts(text, opts.config.tts.voice || 'zh-CN-YunxiNeural')
  } catch (err) {
    console.warn('[tts] primary failed, fallback sapi:', err)
    return sapiTts(text)
  }
}

async function openaiTts(config: AppConfig, text: string): Promise<SynthResult> {
  const tts = config.tts
  const baseURL = tts.baseURL || config.llm.baseURL
  const apiKey = resolveApiKey(tts.apiKey ? tts : config.llm)
  const url = joinUrl(baseURL, '/audio/speech')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: tts.model || 'tts-1',
      voice: tts.voice || 'onyx',
      input: text
    })
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`TTS ${res.status}: ${t.slice(0, 300)}`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  const mime = res.headers.get('content-type') || 'audio/mpeg'
  return { buffer: buf, mime }
}

async function localTts(config: AppConfig, text: string): Promise<SynthResult> {
  const baseURL = config.tts.baseURL || 'http://127.0.0.1:9880'
  const url = `${baseURL.replace(/\/+$/, '')}/tts`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice: config.tts.voice })
  })
  if (!res.ok) throw new Error(`local TTS ${res.status}`)
  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    mime: res.headers.get('content-type') || 'audio/wav'
  }
}

async function edgeTts(text: string, voice: string): Promise<SynthResult> {
  const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts')
  const tts = new MsEdgeTTS()
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3)
  const { audioStream } = tts.toStream(text)
  const chunks: Buffer[] = []
  await new Promise<void>((resolve, reject) => {
    audioStream.on('data', (c: Buffer) => chunks.push(Buffer.from(c)))
    audioStream.on('end', () => resolve())
    audioStream.on('error', reject)
  })
  return { buffer: Buffer.concat(chunks), mime: 'audio/mpeg' }
}

function psQuote(s: string): string {
  return `'${s.replace(/'/g, "''")}'`
}

async function sapiTts(text: string): Promise<SynthResult> {
  const dir = path.join(tmpdir(), 'niko-meow')
  await mkdir(dir, { recursive: true })
  const out = path.join(dir, `sapi-${Date.now()}.wav`)
  const script = `
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $zh = $s.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -like 'zh*' } | Select-Object -First 1
  if ($zh) { $s.SelectVoice($zh.VoiceInfo.Name) }
} catch {}
$s.Rate = -2
$s.SetOutputToWaveFile(${psQuote(out)})
$s.Speak(${psQuote(text.slice(0, 800))})
$s.Dispose()
`
  await runPowershell(script)
  const { readFile, unlink } = await import('node:fs/promises')
  const buffer = await readFile(out)
  await unlink(out).catch(() => undefined)
  return { buffer, mime: 'audio/wav' }
}

function runPowershell(script: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { windowsHide: true }
    )
    let err = ''
    child.stderr.on('data', (d) => {
      err += d.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(err || `powershell ${code}`))
    })
  })
}

export async function writeTempAudio(buffer: Buffer, ext: string): Promise<string> {
  const dir = path.join(tmpdir(), 'niko-meow')
  await mkdir(dir, { recursive: true })
  const file = path.join(dir, `in-${Date.now()}.${ext}`)
  await writeFile(file, buffer)
  return file
}
