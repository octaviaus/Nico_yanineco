import { app, clipboard, dialog, globalShortcut, ipcMain, shell } from 'electron'
import { existsSync, readFileSync, readdirSync, statSync, watch } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NikoChat, type AppConfig, type CharacterPose } from '@niko/core'
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
let busy = false
let smokeIntensity = 0.18

function sendAll(channel: string, payload: unknown) {
  windows.character.webContents.send(channel, payload)
  windows.smoke.webContents.send(channel, payload)
}

function setPose(pose: CharacterPose) {
  sendAll('niko:pose', pose)
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

async function speak(text: string) {
  setPose('talk')
  windows.character.webContents.send('niko:subtitle', text)
  try {
    const audio = await synthesizeSpeech({ config, text })
    if (audio.buffer.length) {
      windows.character.webContents.send('niko:audio', {
        base64: audio.buffer.toString('base64'),
        mime: audio.mime
      })
    }
  } catch (err) {
    console.warn('[speak]', err)
  }
}

async function handleUtterance(text: string) {
  if (busy) {
    setStatus('等会儿，这口还没吐完')
    return
  }
  busy = true
  setStatus('……')
  setPose('inhale')
  try {
    const reply = await chat.talk(text)
    applySmoke({ burst: true, intensity: Math.min(1, smokeIntensity + 0.15) })
    setPose('exhale')
    await speak(reply)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await speak(`……聊崩了。${msg.slice(0, 80)}`)
  } finally {
    busy = false
    setTimeout(() => setPose('idle'), 1200)
    setStatus('')
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
    setPose(down ? 'inhale' : 'idle')
    setStatus(down ? '吸——说' : '')
  })

  ipcMain.on('niko:speaking-end', () => {
    if (!busy) setPose('idle')
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
    onQuit: () => app.quit(),
    onPuff: () => {
      setPose('exhale')
      applySmoke({ burst: true, intensity: Math.min(1, smokeIntensity + 0.2) })
      setTimeout(() => setPose('idle'), 1400)
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
})
