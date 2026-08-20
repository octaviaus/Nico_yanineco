import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { resolveApiKey, type AppConfig } from '@niko/core'
import { joinUrl } from './streaming.js'

export { transcribeAudio, type Transcript } from './streaming.js'

export type SynthResult = { buffer: Buffer; mime: string }

const DEFAULT_EDGE_VOICE = 'zh-CN-XiaoyiNeural'
const DEFAULT_TTS_RATE = 0.85

function resolveTtsRate(rate?: number): number {
  return typeof rate === 'number' && Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_TTS_RATE
}

function toSsmlRate(rate: number): string {
  if (Math.abs(rate - DEFAULT_TTS_RATE) < 1e-6) return '-20%'
  const pct = -Math.round((1 - rate) * 100)
  if (pct === 0) return '+0%'
  return `${pct > 0 ? '+' : ''}${pct}%`
}

function toSapiRate(rate: number): number {
  const mapped = -Math.round((1 - rate) * 10)
  return Math.min(10, Math.max(-10, mapped))
}

export async function synthesizeSpeech(opts: {
  config: AppConfig
  text: string
}): Promise<SynthResult> {
  const provider = opts.config.tts.provider
  const text = opts.text.trim()
  const rate = resolveTtsRate(opts.config.tts.rate)
  if (!text) return { buffer: Buffer.alloc(0), mime: 'audio/wav' }

  try {
    if (provider === 'openai') return await openaiTts(opts.config, text)
    if (provider === 'local') return await localTts(opts.config, text)
    if (provider === 'sapi') return await sapiTts(text, rate)
    return await edgeTts(text, opts.config.tts.voice || DEFAULT_EDGE_VOICE, rate)
  } catch (err) {
    console.warn('[tts] primary failed, fallback sapi:', err)
    return sapiTts(text, rate)
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

async function edgeTts(text: string, voice: string, rate: number): Promise<SynthResult> {
  const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts')
  const tts = new MsEdgeTTS()
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3)
  const { audioStream } = tts.toStream(text, { rate: toSsmlRate(rate) })
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

async function sapiTts(text: string, rate = DEFAULT_TTS_RATE): Promise<SynthResult> {
  const dir = path.join(tmpdir(), 'niko-meow')
  await mkdir(dir, { recursive: true })
  const out = path.join(dir, `sapi-${Date.now()}.wav`)
  const sapiRate = toSapiRate(rate)
  const script = `
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $voices = @($s.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -like 'zh*' })
  $female = $voices | Where-Object { $_.VoiceInfo.Gender -eq [System.Speech.Synthesis.VoiceGender]::Female } | Select-Object -First 1
  if (-not $female) {
    $female = $voices | Where-Object { $_.VoiceInfo.Name -match 'Female|女|Huihui|HuiHui|Xiaoxiao|Yaoyao' } | Select-Object -First 1
  }
  if ($female) { $s.SelectVoice($female.VoiceInfo.Name) }
  elseif ($voices.Count -gt 0) { $s.SelectVoice($voices[0].VoiceInfo.Name) }
} catch {}
$s.Rate = ${sapiRate}
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

export {
  createVoiceActivityDetector,
  isVadReady,
  readSttVadConfig,
  requireVoiceActivityDetector,
  shouldUseLegacyPtt
} from './vad.js'
export type {
  SttVadConfig,
  VadDisabled,
  VadEngineName,
  VadEvent,
  VadEventType,
  VadHandle,
  VadPushResult,
  VadReasonCode,
  VadUnavailable,
  VoiceActivityDetector
} from './vad.js'

export {
  createStreamingTranscriber,
  encodePcm16leWav,
  isStreamingReady,
  readSttStreamingConfig,
  requireStreamingTranscriber,
  shouldUseLegacyTranscription,
  transcribeAudioMaybeStreaming
} from './streaming.js'
export type {
  AudioChunk,
  MaybeStreamingTranscript,
  SegmentTranscript,
  SttStreamingConfig,
  StreamingDisabled,
  StreamingHandle,
  StreamingMode,
  StreamingReasonCode,
  StreamingTranscriber,
  StreamingUnavailable,
  TranscribePath
} from './streaming.js'
