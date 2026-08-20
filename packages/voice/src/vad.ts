import { access, readFile } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import path from 'node:path'

/** Optional `stt.vad` block. Kept local so this PR does not touch `@niko/core` types. */
export type VadEngineName = 'silero' | 'rms'

export type SttVadConfig = {
  /** Default false: keep push-to-talk / existing STT. */
  enabled?: boolean
  /** Default `silero` when enabled. `rms` is a no-weight energy gate for tests/dev. */
  engine?: VadEngineName
  /** Local Silero ONNX path. Weights are not shipped in git. */
  modelPath?: string
  sampleRate?: number
  frameSamples?: number
  positiveSpeechThreshold?: number
  negativeSpeechThreshold?: number
  minSpeechMs?: number
  minSilenceMs?: number
}

export type VadReasonCode =
  | 'disabled'
  | 'unconfigured'
  | 'model-missing'
  | 'runtime-missing'
  | 'load-failed'

export type VadEventType = 'start' | 'stop'

export type VadEvent = {
  type: VadEventType
  tMs: number
}

export type VadPushResult = {
  events: VadEvent[]
  speaking: boolean
  probability: number
}

export type VadDisabled = {
  status: 'disabled'
  reason: string
  code: VadReasonCode
}

export type VadUnavailable = {
  status: 'unavailable'
  reason: string
  code: VadReasonCode
}

export type VoiceActivityDetector = {
  status: 'ready'
  engine: VadEngineName
  speaking: boolean
  on(type: VadEventType, listener: (event: VadEvent) => void): () => void
  push(pcm: Float32Array | Int16Array, sampleRate?: number): Promise<VadPushResult>
  flush(): VadEvent[]
  reset(): void
  close(): Promise<void>
}

export type VadHandle = VadDisabled | VadUnavailable | VoiceActivityDetector

const DEFAULT_SAMPLE_RATE = 16000
const DEFAULT_FRAME_SAMPLES = 512
const DEFAULT_POS = 0.5
const DEFAULT_NEG = 0.35
const DEFAULT_MIN_SPEECH_MS = 96
const DEFAULT_MIN_SILENCE_MS = 288

type ResolvedVadConfig = {
  enabled: boolean
  engine: VadEngineName
  modelPath: string
  sampleRate: number
  frameSamples: number
  positiveSpeechThreshold: number
  negativeSpeechThreshold: number
  minSpeechMs: number
  minSilenceMs: number
}

type FrameScorer = {
  score(frame: Float32Array): Promise<number>
  reset(): void
  close(): Promise<void>
}

type OrtTensor = {
  data: Float32Array | BigInt64Array
  dims: number[]
}

type OrtSession = {
  inputNames: string[]
  outputNames: string[]
  run(feeds: Record<string, unknown>): Promise<Record<string, OrtTensor>>
}

type OrtLike = {
  InferenceSession: {
    create(model: string | Uint8Array, options?: unknown): Promise<OrtSession>
  }
  Tensor: new (type: string, data: Float32Array | BigInt64Array, dims: number[]) => unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asEngine(value: unknown): VadEngineName {
  return value === 'rms' ? 'rms' : 'silero'
}

function pickVadBlock(source: unknown): Record<string, unknown> | undefined {
  if (!isRecord(source)) return undefined
  if (isRecord(source.vad)) return source.vad
  if (isRecord(source.stt) && isRecord(source.stt.vad)) return source.stt.vad
  if (
    'enabled' in source ||
    'engine' in source ||
    'modelPath' in source ||
    'positiveSpeechThreshold' in source
  ) {
    return source
  }
  return undefined
}

/** Read optional `stt.vad` from a config object, `stt` object, or a bare vad block. */
export function readSttVadConfig(source: unknown): SttVadConfig {
  const raw = pickVadBlock(source)
  if (!raw) return { enabled: false }
  const modelPath = typeof raw.modelPath === 'string' ? raw.modelPath.trim() : undefined
  return {
    enabled: raw.enabled === true,
    engine: asEngine(raw.engine),
    modelPath: modelPath || undefined,
    sampleRate: asFiniteNumber(raw.sampleRate, DEFAULT_SAMPLE_RATE),
    frameSamples: asFiniteNumber(raw.frameSamples, DEFAULT_FRAME_SAMPLES),
    positiveSpeechThreshold: asFiniteNumber(raw.positiveSpeechThreshold, DEFAULT_POS),
    negativeSpeechThreshold: asFiniteNumber(raw.negativeSpeechThreshold, DEFAULT_NEG),
    minSpeechMs: asFiniteNumber(raw.minSpeechMs, DEFAULT_MIN_SPEECH_MS),
    minSilenceMs: asFiniteNumber(raw.minSilenceMs, DEFAULT_MIN_SILENCE_MS)
  }
}

function resolveVadConfig(source: unknown): ResolvedVadConfig {
  const raw = readSttVadConfig(source)
  const envModel = (process.env.NIKO_VAD_MODEL ?? '').trim()
  const modelPath = raw.modelPath || envModel
  const sampleRate =
    raw.sampleRate && raw.sampleRate > 0 ? Math.round(raw.sampleRate) : DEFAULT_SAMPLE_RATE
  const frameSamples =
    raw.frameSamples && raw.frameSamples > 0 ? Math.round(raw.frameSamples) : DEFAULT_FRAME_SAMPLES
  return {
    enabled: raw.enabled === true,
    engine: raw.engine === 'rms' ? 'rms' : 'silero',
    modelPath,
    sampleRate,
    frameSamples,
    positiveSpeechThreshold: clamp01(raw.positiveSpeechThreshold ?? DEFAULT_POS),
    negativeSpeechThreshold: clamp01(raw.negativeSpeechThreshold ?? DEFAULT_NEG),
    minSpeechMs: Math.max(0, raw.minSpeechMs ?? DEFAULT_MIN_SPEECH_MS),
    minSilenceMs: Math.max(0, raw.minSilenceMs ?? DEFAULT_MIN_SILENCE_MS)
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
}

export function isVadReady(handle: VadHandle): handle is VoiceActivityDetector {
  return handle.status === 'ready'
}

/** True when callers must keep the existing PTT / full-utterance STT path. */
export function shouldUseLegacyPtt(handle: VadHandle): boolean {
  return handle.status !== 'ready'
}

export async function createVoiceActivityDetector(source?: unknown): Promise<VadHandle> {
  const cfg = resolveVadConfig(source)
  if (!cfg.enabled) {
    return {
      status: 'disabled',
      code: 'disabled',
      reason: 'stt.vad.enabled is false; using the existing push-to-talk path'
    }
  }

  if (cfg.engine === 'rms') {
    return new ReadyVad(cfg, createRmsScorer())
  }

  if (!cfg.modelPath) {
    return {
      status: 'unavailable',
      code: 'unconfigured',
      reason:
        'Silero VAD is enabled but no modelPath / NIKO_VAD_MODEL was set. Weights are not bundled; keep the old PTT path'
    }
  }

  const abs = path.isAbsolute(cfg.modelPath)
    ? cfg.modelPath
    : path.resolve(process.cwd(), cfg.modelPath)
  try {
    await access(abs, fsConstants.R_OK)
  } catch {
    return {
      status: 'unavailable',
      code: 'model-missing',
      reason: `Silero ONNX not found at ${abs}. Do not pretend VAD is on; use the old PTT path`
    }
  }

  try {
    const scorer = await createSileroScorer(abs, cfg.sampleRate, cfg.frameSamples)
    return new ReadyVad(cfg, scorer)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const code: VadReasonCode = /onnxruntime/i.test(message) ? 'runtime-missing' : 'load-failed'
    return {
      status: 'unavailable',
      code,
      reason: `Silero VAD failed to start (${message}). Using the old PTT path`
    }
  }
}

export async function requireVoiceActivityDetector(source?: unknown): Promise<VoiceActivityDetector> {
  const handle = await createVoiceActivityDetector(source)
  if (!isVadReady(handle)) {
    throw new Error(`VAD ${handle.status}: ${handle.reason}`)
  }
  return handle
}

class SpeechGate {
  speaking = false
  tMs = 0
  private speechMs = 0
  private silenceMs = 0
  private readonly pos: number
  private readonly neg: number
  private readonly minSpeechMs: number
  private readonly minSilenceMs: number
  private readonly frameMs: number

  constructor(pos: number, neg: number, minSpeechMs: number, minSilenceMs: number, frameMs: number) {
    this.pos = pos
    this.neg = neg
    this.minSpeechMs = minSpeechMs
    this.minSilenceMs = minSilenceMs
    this.frameMs = frameMs
  }

  step(prob: number): VadEvent[] {
    this.tMs += this.frameMs
    if (prob >= this.pos) {
      this.speechMs += this.frameMs
      this.silenceMs = 0
      if (!this.speaking && this.speechMs >= this.minSpeechMs) {
        this.speaking = true
        return [{ type: 'start', tMs: this.tMs }]
      }
      return []
    }
    if (prob <= this.neg) {
      this.silenceMs += this.frameMs
      this.speechMs = 0
      if (this.speaking && this.silenceMs >= this.minSilenceMs) {
        this.speaking = false
        return [{ type: 'stop', tMs: this.tMs }]
      }
      return []
    }
    return []
  }

  flush(): VadEvent[] {
    if (!this.speaking) return []
    this.speaking = false
    this.speechMs = 0
    this.silenceMs = 0
    return [{ type: 'stop', tMs: this.tMs }]
  }

  reset(): void {
    this.speaking = false
    this.speechMs = 0
    this.silenceMs = 0
    this.tMs = 0
  }
}

class ReadyVad implements VoiceActivityDetector {
  readonly status = 'ready' as const
  readonly engine: VadEngineName
  private readonly targetRate: number
  private readonly frameSamples: number
  private readonly gate: SpeechGate
  private readonly scorer: FrameScorer
  private pending: Float32Array = new Float32Array(0)
  private readonly listeners: Record<VadEventType, Set<(event: VadEvent) => void>> = {
    start: new Set(),
    stop: new Set()
  }

  constructor(cfg: ResolvedVadConfig, scorer: FrameScorer) {
    this.engine = cfg.engine
    this.targetRate = cfg.sampleRate
    this.frameSamples = cfg.frameSamples
    this.scorer = scorer
    const frameMs = (cfg.frameSamples / cfg.sampleRate) * 1000
    this.gate = new SpeechGate(
      cfg.positiveSpeechThreshold,
      cfg.negativeSpeechThreshold,
      cfg.minSpeechMs,
      cfg.minSilenceMs,
      frameMs
    )
  }

  get speaking(): boolean {
    return this.gate.speaking
  }

  on(type: VadEventType, listener: (event: VadEvent) => void): () => void {
    this.listeners[type].add(listener)
    return () => {
      this.listeners[type].delete(listener)
    }
  }

  async push(pcm: Float32Array | Int16Array, sampleRate = this.targetRate): Promise<VadPushResult> {
    const events: VadEvent[] = []
    let probability = 0
    let samples = toFloat32(pcm)
    if (sampleRate !== this.targetRate) {
      samples = resampleLinear(samples, sampleRate, this.targetRate)
    }
    this.pending = concatFloat32(this.pending, samples)

    let offset = 0
    while (this.pending.length - offset >= this.frameSamples) {
      const frame = this.pending.subarray(offset, offset + this.frameSamples)
      probability = await this.scorer.score(frame)
      const stepEvents = this.gate.step(probability)
      for (const ev of stepEvents) this.emit(ev)
      events.push(...stepEvents)
      offset += this.frameSamples
    }
    this.pending = new Float32Array(this.pending.subarray(offset))

    return { events, speaking: this.gate.speaking, probability }
  }

  flush(): VadEvent[] {
    const events = this.gate.flush()
    for (const ev of events) this.emit(ev)
    this.pending = new Float32Array(0)
    return events
  }

  reset(): void {
    this.gate.reset()
    this.pending = new Float32Array(0)
    this.scorer.reset()
  }

  async close(): Promise<void> {
    this.listeners.start.clear()
    this.listeners.stop.clear()
    this.pending = new Float32Array(0)
    await this.scorer.close()
  }

  private emit(event: VadEvent): void {
    for (const listener of this.listeners[event.type]) listener(event)
  }
}

function createRmsScorer(): FrameScorer {
  return {
    async score(frame: Float32Array) {
      let sum = 0
      for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i]
      const rms = Math.sqrt(sum / Math.max(1, frame.length))
      return clamp01(rms / 0.05)
    },
    reset() {},
    async close() {}
  }
}

async function createSileroScorer(
  modelPath: string,
  sampleRate: number,
  frameSamples: number
): Promise<FrameScorer> {
  const ort = await loadOrt()
  if (!ort) {
    throw new Error('onnxruntime-node or onnxruntime-web is required for Silero VAD')
  }
  const bytes = await readFile(modelPath)
  const session = await ort.InferenceSession.create(new Uint8Array(bytes))
  const inputNames = session.inputNames
  const hasState = inputNames.includes('state')
  const hName = inputNames.find((n) => n === 'h' || n === 'h0') ?? 'h'
  const cName = inputNames.find((n) => n === 'c' || n === 'c0') ?? 'c'
  const srName = inputNames.find((n) => n === 'sr' || n === 'sample_rate')
  const inputName = inputNames.find((n) => n === 'input' || n === 'x') ?? inputNames[0]
  if (!inputName) throw new Error('Silero ONNX has no input tensor')

  const hidden = hasState ? 128 : 64
  let h = new Float32Array(2 * hidden)
  let c = new Float32Array(2 * hidden)
  let state = new Float32Array(2 * hidden)

  return {
    async score(frame: Float32Array) {
      const sized =
        frame.length === frameSamples ? frame : padOrTrim(frame, frameSamples)
      const feeds: Record<string, unknown> = {
        [inputName]: new ort.Tensor('float32', sized, [1, sized.length])
      }
      if (srName) {
        feeds[srName] = new ort.Tensor('int64', BigInt64Array.from([BigInt(sampleRate)]), [1])
      }
      if (hasState) {
        feeds.state = new ort.Tensor('float32', state, [2, 1, hidden])
      } else {
        feeds[hName] = new ort.Tensor('float32', h, [2, 1, hidden])
        feeds[cName] = new ort.Tensor('float32', c, [2, 1, hidden])
      }
      const out = await session.run(feeds)
      const probTensor =
        out.output ?? out.prob ?? out[session.outputNames[0] ?? '']
      const probability = Number(probTensor?.data[0] ?? 0)
      if (hasState) {
        const next = out.stateN ?? out.onnx_StateN ?? out.state ?? out[session.outputNames[1] ?? '']
        if (next?.data instanceof Float32Array) state = Float32Array.from(next.data)
      } else {
        const hn = out.hn ?? out.onnx_h ?? out.h
        const cn = out.cn ?? out.onnx_c ?? out.c
        if (hn?.data instanceof Float32Array) h = Float32Array.from(hn.data)
        if (cn?.data instanceof Float32Array) c = Float32Array.from(cn.data)
      }
      return clamp01(probability)
    },
    reset() {
      h = new Float32Array(2 * hidden)
      c = new Float32Array(2 * hidden)
      state = new Float32Array(2 * hidden)
    },
    async close() {}
  }
}

async function loadOrt(): Promise<OrtLike | undefined> {
  for (const specifier of ['onnxruntime-node', 'onnxruntime-web']) {
    try {
      const mod = (await import(specifier)) as OrtLike | { default: OrtLike }
      if ('InferenceSession' in mod) return mod
      if ('default' in mod && mod.default && 'InferenceSession' in mod.default) return mod.default
    } catch {
      // optional runtime — missing package is an explicit unavailable, not a crash
    }
  }
  return undefined
}

function toFloat32(pcm: Float32Array | Int16Array): Float32Array {
  const out = new Float32Array(pcm.length)
  if (pcm instanceof Float32Array) {
    out.set(pcm)
    return out
  }
  for (let i = 0; i < pcm.length; i++) out[i] = pcm[i] / 32768
  return out
}

function concatFloat32(a: Float32Array, b: Float32Array): Float32Array {
  if (a.length === 0) {
    const out = new Float32Array(b.length)
    out.set(b)
    return out
  }
  if (b.length === 0) return a
  const out = new Float32Array(a.length + b.length)
  out.set(a, 0)
  out.set(b, a.length)
  return out
}

function resampleLinear(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate || input.length === 0) {
    const out = new Float32Array(input.length)
    out.set(input)
    return out
  }
  const ratio = fromRate / toRate
  const outLen = Math.max(1, Math.round(input.length / ratio))
  const out = new Float32Array(outLen)
  for (let i = 0; i < outLen; i++) {
    const src = i * ratio
    const i0 = Math.floor(src)
    const i1 = Math.min(input.length - 1, i0 + 1)
    const frac = src - i0
    out[i] = input[i0] * (1 - frac) + input[i1] * frac
  }
  return out
}

function padOrTrim(frame: Float32Array, size: number): Float32Array {
  if (frame.length === size) {
    const out = new Float32Array(size)
    out.set(frame)
    return out
  }
  const out = new Float32Array(size)
  out.set(frame.subarray(0, Math.min(frame.length, size)))
  return out
}
