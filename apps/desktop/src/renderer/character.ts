import { Application, Ticker } from 'pixi.js'
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

const app = new Application({
  width: CHARACTER_STAGE_WIDTH,
  height: CHARACTER_STAGE_HEIGHT,
  backgroundAlpha: 0,
  antialias: true,
  resolution: window.devicePixelRatio || 1,
  autoDensity: true
})
stageEl.appendChild(app.view as HTMLCanvasElement)

let renderer: CharacterRenderer
let talking = false
let holding = false
let mediaRecorder: MediaRecorder | null = null
let chunks: Blob[] = []
let audioEl: HTMLAudioElement | null = null
let sttProvider: string = 'webspeech'
let idlePuff = 22
let mouthSmoke: SmokeField
let currentPose: CharacterPose = 'idle'

async function boot() {
  const cfg = await window.niko.getConfig()
  sttProvider = cfg.sttProvider
  idlePuff = cfg.idlePuffSeconds
  const model = await window.niko.getLive2DModel()
  const core = await window.niko.getCubismCore()
  renderer = await createCharacterRenderer(app.stage, CHARACTER_STAGE_WIDTH, CHARACTER_STAGE_HEIGHT, model, core)
  const tex = makeCloudTexture()
  mouthSmoke = new SmokeField(tex, 1)
  app.stage.addChild(mouthSmoke.container)

  Ticker.shared.add(() => {
    const mouth = renderer.getMouthWorld()
    mouthSmoke.tick(mouth, talking || currentPose === 'exhale' || currentPose === 'talk')
  })

  window.setInterval(() => {
    if (talking) return
    currentPose = 'exhale'
    renderer.setPose('exhale')
    renderer.setSmokeParam(0.7)
    const m = renderer.getMouthWorld()
    mouthSmoke.burst(m.x, m.y, 10)
    window.setTimeout(() => {
      if (!talking && !holding) {
        currentPose = 'idle'
        renderer.setPose('idle')
      }
    }, 1400)
  }, Math.max(8, idlePuff) * 1000)
}

window.niko.onPose((pose) => {
  currentPose = pose
  renderer?.setPose(pose)
  talking = pose === 'talk'
  renderer?.setMouthOpen(pose === 'talk' ? 0.7 : pose === 'exhale' ? 0.4 : 0)
  renderer?.setSmokeParam(pose === 'exhale' ? 0.85 : 0.2)
})

window.niko.onSubtitle((text) => {
  bubble.hidden = !text
  bubble.textContent = text
})

window.niko.onStatus((text) => {
  statusEl.textContent = text
})

window.niko.onAudio(async ({ base64, mime }) => {
  talking = true
  renderer?.setPose('talk')
  const url = `data:${mime};base64,${base64}`
  audioEl?.pause()
  audioEl = new Audio(url)
  audioEl.onended = () => {
    talking = false
    window.niko.speakingEnd()
  }
  try {
    await audioEl.play()
  } catch {
    talking = false
    window.niko.speakingEnd()
  }
})

window.niko.onSmoke((cmd) => {
  if (cmd.clear) mouthSmoke?.clear()
  if (typeof cmd.intensity === 'number') mouthSmoke?.setIntensity(cmd.intensity)
  if (cmd.burst) {
    const m = renderer?.getMouthWorld()
    if (m) mouthSmoke.burst(m.x, m.y, 16)
  }
})

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  const text = input.value.trim()
  if (!text) return
  input.value = ''
  await window.niko.sendText(text)
})

const canvas = app.view as HTMLCanvasElement
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return
  void startHold()
})
window.addEventListener('pointerup', () => {
  if (holding) void stopHold()
})

window.niko.onHotkeyPtt(() => {
  if (holding) void stopHold()
  else void startHold()
})

async function startHold() {
  if (holding) return
  holding = true
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
