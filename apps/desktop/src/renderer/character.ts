import { Application, Rectangle, Ticker } from 'pixi.js'
import { createCharacterRenderer } from './lib/createCharacterRenderer'
import { SmokeField, makeCloudTexture } from './lib/SmokeField'
import type { CharacterRenderer } from './lib/CharacterRenderer'
import type { CharacterPose } from '@niko/core'
import { CHARACTER_STAGE_HEIGHT, CHARACTER_STAGE_WIDTH } from '../shared/geometry'

const stageEl = document.getElementById('stage')!
const bubble = document.getElementById('bubble')!
const statusEl = document.getElementById('status')!
const form = document.getElementById('chat') as HTMLFormElement
const input = document.getElementById('text') as HTMLInputElement
const quitBtn = document.getElementById('quit') as HTMLButtonElement

/** Alpha below this is empty space, not a hold-to-talk hit. */
const OPAQUE_ALPHA = 16
const HIT_PIXEL = new Rectangle(0, 0, 1, 1)

const app = new Application({
  width: CHARACTER_STAGE_WIDTH,
  height: CHARACTER_STAGE_HEIGHT,
  backgroundAlpha: 0,
  antialias: true,
  resolution: window.devicePixelRatio || 1,
  autoDensity: true
})
stageEl.appendChild(app.view as HTMLCanvasElement)

type AudioClip = {
  base64: string
  mime: string
  filePath?: string
  fileUrl?: string
  buffer?: ArrayBuffer
  interrupt?: boolean
  final?: boolean
}

let renderer: CharacterRenderer | undefined
let talking = false
let holding = false
let mediaRecorder: MediaRecorder | null = null
let chunks: Blob[] = []
let sttProvider: string = 'webspeech'
let mouthSmoke: SmokeField | undefined
let currentPose: CharacterPose = 'idle'
const clipQueue: AudioClip[] = []
let queuePlaying = false
let expectMore = false
let playToken = 0
let currentBlobUrl: string | null = null
let currentDone: (() => void) | null = null
const playbackEl = new Audio()
playbackEl.preload = 'auto'
let audioCtx: AudioContext | null = null
let analyser: AnalyserNode | null = null
let mediaSource: MediaElementAudioSourceNode | null = null
let mouthRaf = 0
const timeDomain = new Uint8Array(1024)

async function boot() {
  const cfg = await window.niko.getConfig()
  sttProvider = cfg.sttProvider
  const model = await window.niko.getLive2DModel()
  const core = await window.niko.getCubismCore()
  renderer = await createCharacterRenderer(app.stage, CHARACTER_STAGE_WIDTH, CHARACTER_STAGE_HEIGHT, model, core)
  const tex = makeCloudTexture()
  mouthSmoke = new SmokeField(tex, 1)
  app.stage.addChild(mouthSmoke.container)

  Ticker.shared.add(() => {
    const mouth = renderer?.getMouthWorld()
    if (!mouth || !mouthSmoke) return
    mouthSmoke.tick(mouth, talking || currentPose === 'exhale' || currentPose === 'talk')
  })
}

window.niko.onPose((pose) => {
  currentPose = pose
  renderer?.setPose(pose)
  talking = pose === 'talk' || queuePlaying
  if (!queuePlaying) {
    renderer?.setMouthOpen(pose === 'talk' ? 0.7 : pose === 'exhale' ? 0.4 : 0)
  }
  renderer?.setSmokeParam(pose === 'exhale' ? 0.85 : 0.2)
})

window.niko.onSubtitle((text) => {
  bubble.hidden = !text
  bubble.textContent = text
})

window.niko.onStatus((text) => {
  statusEl.textContent = text
})

window.niko.onAudio((payload) => {
  enqueueClip(payload)
})

window.niko.onSmoke((cmd) => {
  if (cmd.clear) mouthSmoke?.clear()
  if (typeof cmd.intensity === 'number') mouthSmoke?.setIntensity(cmd.intensity)
  if (cmd.burst) {
    const m = renderer?.getMouthWorld()
    if (m) mouthSmoke?.burst(m.x, m.y, 16)
  }
})

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  const text = input.value.trim()
  if (!text) return
  input.value = ''
  await window.niko.sendText(text)
})

quitBtn.addEventListener('click', (e) => {
  e.preventDefault()
  e.stopPropagation()
  window.niko.quit()
})

const canvas = app.view as HTMLCanvasElement
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return
  if (!isOpaqueAtEvent(e)) return
  void startHold()
})
window.addEventListener('pointerup', () => {
  if (holding) void stopHold()
})

window.niko.onHotkeyPtt(() => {
  if (holding) void stopHold()
  else void startHold()
})

function stagePixelFromCss(
  cssX: number,
  cssY: number,
  cssW: number,
  cssH: number,
  stageW: number,
  stageH: number
): { x: number; y: number } | null {
  if (cssW <= 0 || cssH <= 0) return null
  if (cssX < 0 || cssY < 0 || cssX >= cssW || cssY >= cssH) return null
  return {
    x: Math.min(stageW - 1, Math.max(0, Math.floor((cssX / cssW) * stageW))),
    y: Math.min(stageH - 1, Math.max(0, Math.floor((cssY / cssH) * stageH)))
  }
}

function pixelsHaveOpaque(
  pixels: Uint8Array | Uint8ClampedArray,
  threshold = OPAQUE_ALPHA
): boolean {
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] >= threshold) return true
  }
  return false
}

function isOpaqueAtEvent(e: PointerEvent): boolean {
  if (!renderer || !mouthSmoke) return false
  const canvas = app.view as HTMLCanvasElement
  const rect = canvas.getBoundingClientRect()
  const pixel = stagePixelFromCss(
    e.clientX - rect.left,
    e.clientY - rect.top,
    rect.width,
    rect.height,
    CHARACTER_STAGE_WIDTH,
    CHARACTER_STAGE_HEIGHT
  )
  if (!pixel) return false

  HIT_PIXEL.x = pixel.x
  HIT_PIXEL.y = pixel.y
  const smoke = mouthSmoke.container
  const prevVisible = smoke.visible
  smoke.visible = false
  try {
    const pixels = app.renderer.extract.pixels(app.stage, HIT_PIXEL)
    return pixelsHaveOpaque(pixels)
  } catch {
    return false
  } finally {
    smoke.visible = prevVisible
  }
}

async function startHold() {
  if (holding) return
  holding = true
  stopSpeechPlayback()
  window.niko.ptt(true)
  if (sttProvider === 'webspeech' && startWebSpeech()) return
  await startRecorder()
}

async function stopHold() {
  if (!holding) return
  holding = false
  window.niko.ptt(false)
  stopWebSpeech()
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop()
  }
}

function startWebSpeech(): boolean {
  const Ctor = (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition }).webkitSpeechRecognition
    || (window as unknown as { SpeechRecognition?: new () => SpeechRecognition }).SpeechRecognition
  if (!Ctor) return false
  const rec = new Ctor()
  rec.lang = 'zh-CN'
  rec.interimResults = false
  rec.continuous = true
  rec.onresult = (ev: SpeechRecognitionEvent) => {
    const last = ev.results[ev.results.length - 1]
    const text = last?.[0]?.transcript?.trim()
    if (text) void window.niko.sendText(text)
  }
  rec.onerror = () => undefined
  rec.start()
  ;(window as unknown as { __rec?: SpeechRecognition }).__rec = rec
  return true
}

function stopWebSpeech() {
  const rec = (window as unknown as { __rec?: SpeechRecognition }).__rec
  rec?.stop()
}

async function startRecorder() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    chunks = []
    mediaRecorder = new MediaRecorder(stream)
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data)
    }
    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop())
      const blob = new Blob(chunks, { type: mediaRecorder?.mimeType || 'audio/webm' })
      const buf = await blob.arrayBuffer()
      if (buf.byteLength > 64) {
        await window.niko.sendAudio(buf, blob.type || 'audio/webm')
      }
    }
    mediaRecorder.start()
  } catch (err) {
    statusEl.textContent = '麦克风不行，打字吧'
    console.warn(err)
  }
}

void boot()

function clipHasAudio(clip: AudioClip): boolean {
  return Boolean(
    (clip.buffer && clip.buffer.byteLength) ||
      clip.filePath ||
      clip.fileUrl ||
      clip.base64
  )
}

function enqueueClip(payload: AudioClip) {
  if (payload.interrupt) {
    clipQueue.length = 0
    stopCurrentClip()
  }
  if (payload.final) expectMore = false
  else if (clipHasAudio(payload) || payload.interrupt) expectMore = true

  if (clipHasAudio(payload)) {
    clipQueue.push(payload)
    void playNext()
    return
  }
  if (!expectMore && !queuePlaying) finishSpeech()
}

function stopSpeechPlayback() {
  expectMore = false
  clipQueue.length = 0
  stopCurrentClip()
  finishSpeech()
}

function stopCurrentClip() {
  playToken += 1
  stopMouthRms()
  playbackEl.onended = null
  playbackEl.onerror = null
  playbackEl.pause()
  try {
    playbackEl.removeAttribute('src')
    playbackEl.load()
  } catch {
    /* ignore */
  }
  revokeBlob()
  const done = currentDone
  currentDone = null
  done?.()
  queuePlaying = false
}

function finishSpeech() {
  talking = false
  queuePlaying = false
  expectMore = false
  stopMouthRms()
  renderer?.setMouthOpen(0)
  window.niko.speakingEnd()
}

function revokeBlob() {
  if (currentBlobUrl?.startsWith('blob:')) URL.revokeObjectURL(currentBlobUrl)
  currentBlobUrl = null
}

function fileUrlFromPath(filePath: string): string {
  const p = filePath.replace(/\\/g, '/')
  return p.startsWith('file:') ? p : `file://${p.startsWith('/') ? '' : '/'}${p}`
}

function blobUrlFromBuffer(buffer: ArrayBuffer, mime: string): string {
  const blob = new Blob([new Uint8Array(buffer)], { type: mime || 'audio/mpeg' })
  currentBlobUrl = URL.createObjectURL(blob)
  return currentBlobUrl
}

function clipSources(clip: AudioClip): string[] {
  const sources: string[] = []
  if (clip.buffer && clip.buffer.byteLength) {
    sources.push(blobUrlFromBuffer(clip.buffer, clip.mime))
  }
  if (clip.base64) sources.push(`data:${clip.mime};base64,${clip.base64}`)
  if (clip.fileUrl) sources.push(clip.fileUrl)
  else if (clip.filePath) sources.push(fileUrlFromPath(clip.filePath))
  return sources
}

async function playNext() {
  if (queuePlaying) return
  const clip = clipQueue.shift()
  if (!clip) {
    if (!expectMore) finishSpeech()
    return
  }
  const sources = clipSources(clip)
  if (!sources.length) {
    void playNext()
    return
  }
  queuePlaying = true
  talking = true
  renderer?.setPose('talk')
  const token = playToken
  try {
    await playClipSources(sources, token)
  } catch {
    /* skip broken clip */
  }
  revokeBlob()
  if (token !== playToken) return
  queuePlaying = false
  void playNext()
}

async function playClipSources(sources: string[], token: number): Promise<void> {
  let lastErr: unknown
  for (const src of sources) {
    if (token !== playToken) return
    try {
      await playClip(src, token)
      return
    } catch (err) {
      lastErr = err
      revokeBlob()
    }
  }
  if (lastErr) throw lastErr
}

function playClip(src: string, token: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (err?: Error) => {
      if (settled) return
      settled = true
      playbackEl.onended = null
      playbackEl.onerror = null
      stopMouthRms()
      currentDone = null
      if (playToken !== token) {
        resolve()
        return
      }
      if (err) reject(err)
      else resolve()
    }
    currentDone = () => finish()
    playbackEl.onended = () => finish()
    playbackEl.onerror = () => finish(new Error('audio error'))
    playbackEl.src = src
    ensureAudioGraph()
    void audioCtx?.resume()
    startMouthRms()
    void playbackEl.play().catch((err) => finish(err instanceof Error ? err : new Error('play failed')))
  })
}

function ensureAudioGraph() {
  if (mediaSource || !playbackEl) return
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return
  try {
    audioCtx = new AC()
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 1024
    analyser.smoothingTimeConstant = 0.35
    mediaSource = audioCtx.createMediaElementSource(playbackEl)
    mediaSource.connect(analyser)
    analyser.connect(audioCtx.destination)
  } catch (err) {
    console.warn('[mouth] analyser unavailable', err)
    analyser = null
    mediaSource = null
  }
}

function startMouthRms() {
  stopMouthRms()
  const tick = () => {
    if (!analyser) return
    const buf =
      timeDomain.length === analyser.fftSize ? timeDomain : new Uint8Array(analyser.fftSize)
    analyser.getByteTimeDomainData(buf)
    let sum = 0
    for (let i = 0; i < buf.length; i++) {
      const n = (buf[i] - 128) / 128
      sum += n * n
    }
    const rms = Math.sqrt(sum / buf.length)
    const open = Math.min(1, Math.max(0, (rms - 0.02) * 7))
    renderer?.setMouthOpen(open)
    mouthRaf = requestAnimationFrame(tick)
  }
  mouthRaf = requestAnimationFrame(tick)
}

function stopMouthRms() {
  if (mouthRaf) cancelAnimationFrame(mouthRaf)
  mouthRaf = 0
}

interface SpeechRecognition extends EventTarget {
  lang: string
  interimResults: boolean
  continuous: boolean
  start(): void
  stop(): void
  onresult: ((ev: SpeechRecognitionEvent) => void) | null
  onerror: ((ev: Event) => void) | null
}

interface SpeechRecognitionEvent extends Event {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}
