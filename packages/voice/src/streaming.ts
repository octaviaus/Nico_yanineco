import type { AppConfig, SttProvider } from '@niko/core'
import { transcribeAudio, type Transcript } from './transcribe.js'

export type { Transcript }

/**
 * Optional segmented / streaming ASR (ST-VOICE-03).
 *
 * Desktop PTT wiring is out of scope. This module only exposes a voice-package
 * API that repeatedly POSTs PCM/webm chunks to the same OpenAI-compatible STT
 * used by `transcribeAudio` (whisper-1 or local `http://127.0.0.1:9000/v1`).
 *
 * **faster-whisper HTTP** (`mode: "faster-whisper"`): point `endpoint` at an
 * OpenAI-compatible origin such as `http://127.0.0.1:9000/v1`. Typical local
 * servers (faster-whisper-server, openai-whisper-asr-webservice, whisper.cpp
 * server) accept `POST {endpoint}/audio/transcriptions` with multipart `file`.
 * Proprietary WebSocket protocols are **not** implemented — leave
 * `stt.streaming.enabled` false unless that HTTP endpoint exists.
 *
 * Unconfigured / empty endpoint / POST failure → not ready. Callers must use
 * `transcribeAudio` (see `transcribeAudioMaybeStreaming` and
 * `shouldUseLegacyTranscription`). Do not pretend streaming is live.
 */
export type StreamingMode = 'segmented' | 'faster-whisper'

/** Optional `stt.streaming` block. Kept local so this PR does not touch `@niko/core` types. */
export type SttStreamingConfig = {
  /** Default false: keep full-utterance `transcribeAudio`. */
  enabled?: boolean
  /**
   * `segmented` (default): chunked POSTs to existing local/openai STT.
   * `faster-whisper`: same HTTP contract, documented for a local faster-whisper server.
   */
  mode?: StreamingMode
  /**
   * Origin for chunk POSTs, e.g. `http://127.0.0.1:9000/v1`.
   * Explicit empty string → unavailable (do not pretend streaming works).
   * Omitted → reuse `stt.baseURL` / local `:9000` / openai `llm.baseURL`.
   */
  endpoint?: string
  /** Accumulate PCM until this duration before POSTing. Encoded containers (webm) send per `push`. */
  minChunkMs?: number
  /** PCM overlap kept between segments (ms). Ignored for webm/ogg/mp3. */
  overlapMs?: number
}

export type StreamingReasonCode = 'disabled' | 'unconfigured' | 'endpoint-empty' | 'endpoint-failed'

export type AudioChunk = {
  /** Encoded bytes (webm/wav/…) or raw PCM16LE when `mime` is `audio/pcm`. */
  buffer?: Buffer | Uint8Array
  /** Float32 -1..1 or Int16 PCM. Encoded to WAV before POST. */
  pcm?: Float32Array | Int16Array
  mime: string
  filename?: string
  sampleRate?: number
  channels?: number
}

export type SegmentTranscript = {
  text: string
  isFinal: boolean
  segmentIndex: number
}

export type StreamingDisabled = {
  status: 'disabled'
  reason: string
  code: StreamingReasonCode
}

export type StreamingUnavailable = {
  status: 'unavailable'
  reason: string
  code: StreamingReasonCode
}

export type StreamingTranscriber = {
  status: 'ready'
  mode: StreamingMode
  endpoint: string
  onPartial(listener: (seg: SegmentTranscript) => void): () => void
  /**
   * Push one PCM/webm (or wav) chunk. PCM is buffered until `minChunkMs`.
   * Encoded containers are transcribed immediately. Returns null if still
   * accumulating PCM.
   */
  push(chunk: AudioChunk): Promise<SegmentTranscript | null>
  /** Transcribe remaining PCM and return the joined transcript. */
  flush(): Promise<Transcript>
  close(): Promise<void>
}

export type StreamingHandle = StreamingDisabled | StreamingUnavailable | StreamingTranscriber

export type TranscribePath = 'streaming' | 'fallback'

export type MaybeStreamingTranscript = Transcript & {
  usedStreaming: boolean
  path: TranscribePath
  reason?: string
}

const DEFAULT_MIN_CHUNK_MS = 800
const DEFAULT_OVERLAP_MS = 120
const DEFAULT_PCM_RATE = 16000

type ResolvedStreaming = {
  enabled: boolean
  mode: StreamingMode
  endpoint: string | undefined
  endpointExplicit: boolean
  minChunkMs: number
  overlapMs: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asMode(value: unknown): StreamingMode {
  return value === 'faster-whisper' ? 'faster-whisper' : 'segmented'
}

function pickStreamingBlock(source: unknown): Record<string, unknown> | undefined {
  if (!isRecord(source)) return undefined
  if (isRecord(source.streaming)) return source.streaming
  if (isRecord(source.stt) && isRecord(source.stt.streaming)) return source.stt.streaming
  if ('enabled' in source || 'mode' in source || 'endpoint' in source || 'minChunkMs' in source) {
    return source
  }
  return undefined
}

/** Read optional `stt.streaming` from a config object, `stt` object, or a bare streaming block. */
export function readSttStreamingConfig(source: unknown): SttStreamingConfig {
  const raw = pickStreamingBlock(source)
  if (!raw) return { enabled: false }
  const endpoint = typeof raw.endpoint === 'string' ? raw.endpoint : undefined
  return {
    enabled: raw.enabled === true,
    mode: asMode(raw.mode),
    endpoint,
    minChunkMs: asFiniteNumber(raw.minChunkMs, DEFAULT_MIN_CHUNK_MS),
    overlapMs: asFiniteNumber(raw.overlapMs, DEFAULT_OVERLAP_MS)
  }
}

function resolveStreaming(source: unknown): ResolvedStreaming {
  const raw = readSttStreamingConfig(source)
  const endpointExplicit = typeof raw.endpoint === 'string'
  const trimmed = endpointExplicit ? raw.endpoint!.trim() : undefined
  return {
    enabled: raw.enabled === true,
    mode: raw.mode === 'faster-whisper' ? 'faster-whisper' : 'segmented',
    endpoint: trimmed,
    endpointExplicit,
    minChunkMs: Math.max(0, raw.minChunkMs ?? DEFAULT_MIN_CHUNK_MS),
    overlapMs: Math.max(0, raw.overlapMs ?? DEFAULT_OVERLAP_MS)
  }
}

function asAppConfig(source: unknown): AppConfig | undefined {
  if (!isRecord(source) || !isRecord(source.llm) || !isRecord(source.stt)) return undefined
  if (typeof source.stt.provider !== 'string') return undefined
  if (typeof source.llm.baseURL !== 'string' || typeof source.llm.model !== 'string') return undefined
  return source as unknown as AppConfig
}

function reuseSttEndpoint(source: unknown): string | undefined {
  const app = asAppConfig(source)
  if (!app) {
    if (isRecord(source) && isRecord(source.stt) && typeof source.stt.baseURL === 'string') {
      const ep = source.stt.baseURL.trim()
      if (ep) return ep
    }
    return undefined
  }
  const fromStt = (app.stt.baseURL ?? '').trim()
  if (fromStt) return fromStt
  if (app.stt.provider === 'local') return 'http://127.0.0.1:9000/v1'
  if (app.stt.provider === 'openai') {
    const fromLlm = (app.llm.baseURL ?? '').trim()
    if (fromLlm) return fromLlm
  }
  return undefined
}

function bindConfig(source: unknown, endpoint: string): AppConfig {
  const app = asAppConfig(source)
  const localish = /127\.0\.0\.1|localhost/i.test(endpoint)
  let provider: SttProvider = localish ? 'local' : 'openai'
  if (app?.stt.provider === 'local' || app?.stt.provider === 'openai') {
    provider = localish ? 'local' : app.stt.provider
  }
  return {
    llm: app?.llm ?? { baseURL: endpoint, model: 'whisper-1' },
    stt: {
      provider,
      baseURL: endpoint,
      model: app?.stt.model ?? 'whisper-1',
      apiKey: app?.stt.apiKey,
      apiKeyEnv: app?.stt.apiKeyEnv
    },
    tts: app?.tts ?? { provider: 'edge' },
    cursor: app?.cursor ?? { cli: 'agent' }
  }
}

export function isStreamingReady(handle: StreamingHandle): handle is StreamingTranscriber {
  return handle.status === 'ready'
}

/** True when callers must keep the existing full-buffer `transcribeAudio` path. */
export function shouldUseLegacyTranscription(handle: StreamingHandle): boolean {
  return handle.status !== 'ready'
}

export async function createStreamingTranscriber(source?: unknown): Promise<StreamingHandle> {
  const cfg = resolveStreaming(source)
  if (!cfg.enabled) {
    return {
      status: 'disabled',
      code: 'disabled',
      reason: 'stt.streaming.enabled is false; using the existing transcribeAudio path'
    }
  }

  if (cfg.endpointExplicit && !cfg.endpoint) {
    return {
      status: 'unavailable',
      code: 'endpoint-empty',
      reason:
        'stt.streaming.enabled is true but endpoint is empty. Streaming is not available; use transcribeAudio'
    }
  }

  const endpoint = cfg.endpoint || reuseSttEndpoint(source)
  if (!endpoint) {
    return {
      status: 'unavailable',
      code: 'unconfigured',
      reason:
        'Streaming ASR is enabled but no endpoint / stt.baseURL was set. Do not pretend streaming is on; use transcribeAudio'
    }
  }

  const config = bindConfig(source, endpoint)
  return new ReadyStreaming(cfg.mode, endpoint, config, cfg.minChunkMs, cfg.overlapMs)
}

export async function requireStreamingTranscriber(source?: unknown): Promise<StreamingTranscriber> {
  const handle = await createStreamingTranscriber(source)
  if (!isStreamingReady(handle)) {
    throw new Error(`streaming ASR ${handle.status}: ${handle.reason}`)
  }
  return handle
}

/**
 * Prefer segmented/streaming ASR when it is actually ready. Otherwise, or if a
 * chunk POST fails, fall back to the existing full-buffer `transcribeAudio`.
 * A disabled/empty/fake streaming setup never reports `usedStreaming: true`.
 */
export async function transcribeAudioMaybeStreaming(opts: {
  config: AppConfig
  buffer: Buffer
  mime: string
  filename?: string
}): Promise<MaybeStreamingTranscript> {
  const handle = await createStreamingTranscriber(opts.config)
  if (!isStreamingReady(handle)) {
    const t = await transcribeAudio(opts)
    return { text: t.text, usedStreaming: false, path: 'fallback', reason: handle.reason }
  }
  try {
    await handle.push({
      buffer: opts.buffer,
      mime: opts.mime,
      filename: opts.filename
    })
    const flushed = await handle.flush()
    await handle.close()
    return { text: flushed.text, usedStreaming: true, path: 'streaming' }
  } catch (err) {
    await handle.close().catch(() => undefined)
    const t = await transcribeAudio(opts)
    return {
      text: t.text,
      usedStreaming: false,
      path: 'fallback',
      reason: err instanceof Error ? err.message : String(err)
    }
  }
}

class ReadyStreaming implements StreamingTranscriber {
  readonly status = 'ready' as const
  readonly mode: StreamingMode
  readonly endpoint: string
  private readonly config: AppConfig
  private readonly minChunkMs: number
  private readonly overlapMs: number
  private readonly listeners = new Set<(seg: SegmentTranscript) => void>()
  private pcmPending = new Int16Array(0)
  private pcmRate = DEFAULT_PCM_RATE
  private parts: string[] = []
  private segmentIndex = 0
  private closed = false

  constructor(
    mode: StreamingMode,
    endpoint: string,
    config: AppConfig,
    minChunkMs: number,
    overlapMs: number
  ) {
    this.mode = mode
    this.endpoint = endpoint
    this.config = config
    this.minChunkMs = minChunkMs
    this.overlapMs = overlapMs
  }

  onPartial(listener: (seg: SegmentTranscript) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  async push(chunk: AudioChunk): Promise<SegmentTranscript | null> {
    this.assertOpen()
    if (isPcmChunk(chunk)) {
      const { samples, sampleRate } = toInt16Pcm(chunk)
      this.pcmRate = sampleRate
      this.pcmPending = concatInt16(this.pcmPending, samples)
      const minSamples = Math.round((this.minChunkMs / 1000) * this.pcmRate)
      if (this.pcmPending.length < minSamples) return null
      return this.sendPcmSegment(false)
    }
    const file = encodedFileFromChunk(chunk)
    return this.sendFile(file, false)
  }

  async flush(): Promise<Transcript> {
    this.assertOpen()
    if (this.pcmPending.length > 0) {
      await this.sendPcmSegment(true)
    }
    return { text: joinParts(this.parts) }
  }

  async close(): Promise<void> {
    this.closed = true
    this.listeners.clear()
    this.pcmPending = new Int16Array(0)
    this.parts = []
  }

  private assertOpen(): void {
    if (this.closed) throw new Error('streaming transcriber is closed')
  }

  private async sendPcmSegment(isFinal: boolean): Promise<SegmentTranscript> {
    const wav = encodePcm16leWav(this.pcmPending, this.pcmRate, 1)
    const overlapSamples = isFinal
      ? 0
      : Math.min(this.pcmPending.length, Math.round((this.overlapMs / 1000) * this.pcmRate))
    const result = await this.sendFile(
      { buffer: wav, mime: 'audio/wav', filename: 'segment.wav' },
      isFinal
    )
    this.pcmPending =
      overlapSamples > 0 ? this.pcmPending.slice(-overlapSamples) : new Int16Array(0)
    return result
  }

  private async sendFile(
    file: { buffer: Buffer; mime: string; filename: string },
    isFinal: boolean
  ): Promise<SegmentTranscript> {
    try {
      const { text } = await transcribeAudio({
        config: this.config,
        buffer: file.buffer,
        mime: file.mime,
        filename: file.filename
      })
      const seg: SegmentTranscript = {
        text,
        isFinal,
        segmentIndex: this.segmentIndex++
      }
      if (text) this.parts.push(text)
      for (const listener of this.listeners) listener(seg)
      return seg
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const wrapped = new Error(`streaming ASR failed (${this.endpoint}): ${message}`)
      ;(wrapped as Error & { code?: StreamingReasonCode }).code = 'endpoint-failed'
      throw wrapped
    }
  }
}

function isPcmChunk(chunk: AudioChunk): boolean {
  if (chunk.pcm) return true
  return Boolean(chunk.buffer && /pcm|l16/i.test(chunk.mime))
}

function encodedFileFromChunk(chunk: AudioChunk): { buffer: Buffer; mime: string; filename: string } {
  if (!chunk.buffer) {
    throw new Error('audio chunk has neither buffer nor pcm')
  }
  const mime = chunk.mime || 'audio/webm'
  return {
    buffer: Buffer.from(chunk.buffer),
    mime,
    filename: chunk.filename ?? guessFilename(mime)
  }
}

function guessFilename(mime: string): string {
  if (mime.includes('wav')) return 'segment.wav'
  if (mime.includes('ogg')) return 'segment.ogg'
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'segment.mp3'
  return 'segment.webm'
}

function toInt16Pcm(chunk: AudioChunk): { samples: Int16Array; sampleRate: number } {
  const sampleRate =
    chunk.sampleRate && chunk.sampleRate > 0 ? Math.round(chunk.sampleRate) : DEFAULT_PCM_RATE
  if (chunk.pcm instanceof Int16Array) {
    return { samples: Int16Array.from(chunk.pcm), sampleRate }
  }
  if (chunk.pcm instanceof Float32Array) {
    return { samples: floatToInt16(chunk.pcm), sampleRate }
  }
  const buf = Buffer.from(chunk.buffer ?? [])
  const samples = new Int16Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 2))
  return { samples: Int16Array.from(samples), sampleRate }
}

function floatToInt16(pcm: Float32Array): Int16Array {
  const out = new Int16Array(pcm.length)
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i] ?? 0))
    out[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff)
  }
  return out
}

function concatInt16(a: Int16Array, b: Int16Array): Int16Array {
  if (a.length === 0) return Int16Array.from(b)
  if (b.length === 0) return a
  const out = new Int16Array(a.length + b.length)
  out.set(a, 0)
  out.set(b, a.length)
  return out
}

function joinParts(parts: string[]): string {
  return parts
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' ')
}

/** Wrap PCM16LE samples in a WAV container so OpenAI-compat STT will accept the chunk. */
export function encodePcm16leWav(
  pcm: Int16Array,
  sampleRate: number,
  channels = 1
): Buffer {
  const dataSize = pcm.byteLength
  const buffer = Buffer.alloc(44 + dataSize)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(channels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * channels * 2, 28)
  buffer.writeUInt16LE(channels * 2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)
  Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength).copy(buffer, 44)
  return buffer
}
