import { app, clipboard, dialog, globalShortcut, ipcMain, shell } from 'electron'
import { existsSync, readFileSync, readdirSync, statSync, watch } from 'node:fs'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  NikoChat,
  createPetPhaseMachine,
  petPhaseToPose,
  type AppConfig,
  type PetPhase
} from '@niko/core'
import { AGENT_TOOLS, executeTool } from '@niko/agent'
import { synthesizeSpeech, transcribeAudio } from '@niko/voice'
import { loadConfig, resolveConfigPath } from './config'
import { assetsDir, repoRoot } from './paths'
import { createTray } from './tray'
import { createWindows, type OverlayWindows } from './windows'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

app.setName('尼古喵喵')
app.setAppUserModelId('com.niko.meow')
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('enable-transparent-visuals')
}

let windows: OverlayWindows
let config: AppConfig
let chat: NikoChat
let speakGen = 0
let turnGen = 0
let puffGen = 0
let audioSeq = 0
let smokeIntensity = 0.18
const tempAudioFiles: string[] = []
const petPhase = createPetPhaseMachine('Idle')

function sendAll(channel: string, payload: unknown) {
  windows.character.webContents.send(channel, payload)
  windows.smoke.webContents.send(channel, payload)
}

function setPetPhase(to: PetPhase): boolean {
  const from = petPhase.phase
  const result = petPhase.tryTransition(to)
  if (!result.ok) {
    console.warn(`[phase] illegal ${String(result.from)}→${String(result.to)}`)
    return false
  }
  if (from !== to) {
    console.log(`[phase] ${from}→${to}`)
    sendAll('niko:phase', to)
    sendAll('niko:pose', petPhaseToPose(to))
  }
  return true
}

function setStatus(text: string) {
  windows.character.webContents.send('niko:status', text)
}

function applySmoke(cmd: { intensity?: number; burst?: boolean; clear?: boolean }) {
  if (cmd.clear) smokeIntensity = 0
  if (typeof cmd.intensity === 'number') {
    smokeIntensity = Math.min(1, Math.max(0, cmd.intensity))
  }
  sendAll('niko:smoke', {
    intensity: smokeIntensity,
    burst: Boolean(cmd.burst),
    clear: Boolean(cmd.clear)
  })
}

function rebuildChat() {
  chat = new NikoChat(config, AGENT_TOOLS, async (name, args) =>
    executeTool(name, args, {
      config,
      setSmoke: applySmoke,
      openPath: async (p) => {
        const err = await shell.openPath(p)
        return err ? `打不开：${err}` : `打开了 ${p}`
      },
      readClipboard: () => clipboard.readText(),
      confirm: async (message) => {
        const res = await dialog.showMessageBox(windows.character, {
          type: 'question',
          buttons: ['行吧', '算了'],
          defaultId: 0,
          cancelId: 1,
          title: '尼古喵喵',
          message
        })
        return res.response === 0
      }
    })
  )
}

function splitSentences(text: string): string[] {
  const src = text.trim()
  if (!src) return []
  const raw = src.split(/(?<=[。！？…])/)
  const out: string[] = []
  let acc = ''
  for (let i = 0; i < raw.length; i++) {
    acc += raw[i]
    const piece = acc.trim()
    if (!piece) continue
    const onlyPunct = /^[。！？…\s]+$/.test(piece)
    if (onlyPunct && i < raw.length - 1) continue
    out.push(piece)
    acc = ''
  }
  if (acc.trim()) out.push(acc.trim())
  return out.length ? out : [src]
}

function extFromMime(mime: string): string {
  const m = mime.toLowerCase()
  if (m.includes('wav')) return 'wav'
  if (m.includes('ogg')) return 'ogg'
  if (m.includes('webm')) return 'webm'
  if (m.includes('mp4') || m.includes('m4a') || m.includes('aac')) return 'm4a'
  return 'mp3'
}

async function persistAudio(buffer: Buffer, mime: string): Promise<string> {
  const dir = path.join(tmpdir(), 'niko-meow')
  await mkdir(dir, { recursive: true })
  const file = path.join(dir, `tts-${Date.now()}-${++audioSeq}.${extFromMime(mime)}`)
  await writeFile(file, buffer)
  tempAudioFiles.push(file)
  return file
}

function cleanupTempAudio() {
  const files = tempAudioFiles.splice(0)
  const unlinkAll = () => {
    for (const f of files) void unlink(f).catch(() => undefined)
  }
  setTimeout(unlinkAll, 800)
}

function sendAudioControl(opts: { interrupt?: boolean; final?: boolean }) {
  windows.character.webContents.send('niko:audio', {
    base64: '',
    mime: 'audio/wav',
    interrupt: opts.interrupt,
    final: opts.final,
    gen: speakGen
  })
}

function interruptSpeech() {
  speakGen += 1
  sendAudioControl({ interrupt: true, final: true })
  cleanupTempAudio()
}

/** Barge-in: drop in-flight LLM turn and queued TTS. */
function bargeIn() {
  turnGen += 1
  interruptSpeech()
}

async function sendClip(
  audio: { buffer: Buffer; mime: string },
  opts: { interrupt: boolean; gen: number }
) {
  let filePath: string | undefined
  let fileUrl: string | undefined
  let base64 = ''
  try {
    filePath = await persistAudio(audio.buffer, audio.mime)
    fileUrl = pathToFileURL(filePath).href
  } catch (err) {
    console.warn('[speak] temp file failed, falling back to base64', err)
    base64 = audio.buffer.toString('base64')
  }
  if (opts.gen !== speakGen) return
  windows.character.webContents.send('niko:audio', {
    base64,
    mime: audio.mime,
    filePath,
    fileUrl,
    interrupt: opts.interrupt,
    gen: opts.gen
  })
}

async function speak(text: string) {
  const gen = ++speakGen
  sendAudioControl({ interrupt: true })
  if (!setPetPhase('Speaking')) return
  windows.character.webContents.send('niko:subtitle', text)
  const sentences = splitSentences(text)
  let first = true
  for (const sentence of sentences) {
    if (gen !== speakGen) return
    try {
      const audio = await synthesizeSpeech({ config, text: sentence })
      if (gen !== speakGen) return
      if (!audio.buffer.length) continue
      await sendClip(audio, { interrupt: first, gen })
      first = false
    } catch (err) {
      console.warn('[speak]', err)
    }
  }
  if (gen !== speakGen) return
  if (first) {
    sendAudioControl({ interrupt: true, final: true })
    if (petPhase.phase === 'Speaking') setPetPhase('Idle')
    return
  }
  sendAudioControl({ final: true })
}

function quitApp() {
  app.quit()
}

async function handleUtterance(text: string) {
  const turn = ++turnGen
  interruptSpeech()
  setPetPhase('Listening')
  setStatus('……')
  setPetPhase('Thinking')
  try {
    const reply = await chat.talk(text)
    if (turn !== turnGen) return
    applySmoke({ burst: true, intensity: Math.min(1, smokeIntensity + 0.15) })
    await speak(reply)
  } catch (err) {
    if (turn !== turnGen) return
    const msg = err instanceof Error ? err.message : String(err)
    await speak(`……聊崩了。${msg.slice(0, 80)}`)
  } finally {
    if (turn !== turnGen) return
    setStatus('')
    if (petPhase.phase === 'Thinking') {
      setTimeout(() => {
        if (turn === turnGen && petPhase.phase === 'Thinking') setPetPhase('Idle')
      }, 400)
    }
  }
}

function registerIpc() {
  ipcMain.handle('niko:get-config', () => ({
    sttProvider: config.stt.provider,
    idlePuffSeconds: config.smoke?.idlePuffSeconds ?? 22
  }))

  ipcMain.handle('niko:live2d-model', () => findLive2DModel())

  ipcMain.handle('niko:cubism-core', () => {
    const p = path.join(assetsDir(), 'live2d', 'runtime', 'live2dcubismcore.min.js')
    return existsSync(p) ? 'live2d/runtime/live2dcubismcore.min.js' : null
  })

  ipcMain.handle('niko:text', async (_e, text: string) => {
    await handleUtterance(String(text ?? ''))
    return { ok: true }
  })

  ipcMain.handle(
    'niko:audio-utterance',
    async (_e, payload: { buffer: ArrayBuffer; mime: string }) => {
      const buf = Buffer.from(payload.buffer)
      const { text } = await transcribeAudio({
        config,
        buffer: buf,
        mime: payload.mime || 'audio/webm'
      })
      if (!text) return { text: '' }
      await handleUtterance(text)
      return { text }
    }
  )

  ipcMain.on('niko:ptt', (_e, down: boolean) => {
    if (down) {
      bargeIn()
      if (!setPetPhase('Inhale')) setPetPhase('Listening')
      setStatus('吸——说')
      return
    }
    if (petPhase.phase === 'Inhale') setPetPhase('Listening')
    setStatus('')
  })

  ipcMain.on('niko:quit', () => quitApp())

  ipcMain.on('niko:speaking-end', (_e, gen?: number) => {
    if (typeof gen === 'number' && gen !== speakGen) return
    cleanupTempAudio()
    if (petPhase.phase === 'Speaking') setPetPhase('Idle')
  })

  ipcMain.on('niko:drag', (_e, { dx, dy }: { dx: number; dy: number }) => {
    const [x, y] = windows.character.getPosition()
    windows.character.setPosition(x + dx, y + dy)
  })
}

export function findLive2DModel(): string | null {
  const dir = path.join(assetsDir(), 'live2d')
  if (!existsSync(dir)) return null
  const found = walkFor(dir, (f) => f.endsWith('.model3.json'))
  if (!found) return null
  return path.relative(assetsDir(), found).replace(/\\/g, '/')
}

function walkFor(dir: string, pred: (name: string) => boolean): string | null {
  for (const name of readdirSync(dir)) {
    if (name === 'runtime' || name === 'README.md') continue
    const full = path.join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      const inner = walkFor(full, pred)
      if (inner) return inner
    } else if (pred(name)) return full
  }
  return null
}

function loadDotEnv() {
  const envFile = path.join(repoRoot(), '.env')
  if (!existsSync(envFile)) return
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (!m) continue
    const key = m[1]
    let val = m[2].trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

app.whenReady().then(() => {
  loadDotEnv()
  config = loadConfig(repoRoot(), homedir())
  rebuildChat()
  windows = createWindows(__dirname)
  registerIpc()
  createTray({
    windows,
    onQuit: quitApp,
    onPuff: () => {
      const g = ++puffGen
      const from = petPhase.phase
      if (from === 'Speaking' || from === 'Listening') {
        interruptSpeech()
        setPetPhase('Idle')
      }
      setPetPhase('Exhale')
      applySmoke({ burst: true, intensity: Math.min(1, smokeIntensity + 0.2) })
      setTimeout(() => {
        if (g === puffGen && petPhase.phase === 'Exhale') setPetPhase('Idle')
      }, 1400)
    },
    onClear: () => applySmoke({ clear: true, intensity: 0 }),
    onToggle: () => {
      if (windows.character.isVisible()) {
        windows.character.hide()
        windows.smoke.hide()
      } else {
        windows.character.show()
        windows.smoke.show()
      }
    }
  })

  globalShortcut.register('CommandOrControl+Shift+M', () => {
    windows.character.webContents.send('niko:hotkey-ptt')
  })

  const cfgPath = resolveConfigPath(repoRoot(), homedir())
  if (existsSync(cfgPath)) {
    watch(cfgPath, () => {
      try {
        config = loadConfig(repoRoot(), homedir())
        rebuildChat()
        windows.character.webContents.send('niko:config-reloaded')
      } catch (err) {
        console.warn('[config] reload failed', err)
      }
    })
  }
})

app.on('window-all-closed', () => {
  /* tray keeps the process alive */
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  const files = tempAudioFiles.splice(0)
  for (const f of files) void unlink(f).catch(() => undefined)
})
