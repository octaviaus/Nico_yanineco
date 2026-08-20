import { contextBridge, ipcRenderer } from 'electron'
import { readFileSync } from 'node:fs'
import type { CharacterPose, PetPhase } from '@niko/core'

export type RendererConfig = {
  sttProvider: 'openai' | 'local' | 'webspeech'
  idlePuffSeconds: number
}

export type NikoAudioPayload = {
  base64: string
  mime: string
  filePath?: string
  fileUrl?: string
  buffer?: ArrayBuffer
  interrupt?: boolean
  final?: boolean
}

function fileToArrayBuffer(filePath: string): ArrayBuffer | undefined {
  try {
    const buf = readFileSync(filePath)
    const copy = new Uint8Array(buf.byteLength)
    copy.set(buf)
    return copy.buffer
  } catch {
    return undefined
  }
}

const niko = {
  getConfig: (): Promise<RendererConfig> => ipcRenderer.invoke('niko:get-config'),
  getLive2DModel: (): Promise<string | null> => ipcRenderer.invoke('niko:live2d-model'),
  getCubismCore: (): Promise<string | null> => ipcRenderer.invoke('niko:cubism-core'),
  sendText: (text: string) => ipcRenderer.invoke('niko:text', text),
  sendAudio: (buffer: ArrayBuffer, mime: string) =>
    ipcRenderer.invoke('niko:audio-utterance', { buffer, mime }),
  ptt: (down: boolean) => ipcRenderer.send('niko:ptt', down),
  quit: () => ipcRenderer.send('niko:quit'),
  speakingEnd: () => ipcRenderer.send('niko:speaking-end'),
  drag: (dx: number, dy: number) => ipcRenderer.send('niko:drag', { dx, dy }),
  onPose: (cb: (pose: CharacterPose) => void) => {
    ipcRenderer.on('niko:pose', (_e, pose: CharacterPose) => cb(pose))
  },
  onPhase: (cb: (phase: PetPhase) => void) => {
    ipcRenderer.on('niko:phase', (_e, phase: PetPhase) => cb(phase))
  },
  onSmoke: (cb: (cmd: { intensity: number; burst: boolean; clear: boolean }) => void) => {
    ipcRenderer.on('niko:smoke', (_e, cmd) => cb(cmd))
  },
  onSubtitle: (cb: (text: string) => void) => {
    ipcRenderer.on('niko:subtitle', (_e, text: string) => cb(text))
  },
  onStatus: (cb: (text: string) => void) => {
    ipcRenderer.on('niko:status', (_e, text: string) => cb(text))
  },
  onAudio: (cb: (payload: NikoAudioPayload) => void) => {
    ipcRenderer.on('niko:audio', (_e, payload: NikoAudioPayload) => {
      const next: NikoAudioPayload = { ...payload, base64: payload.base64 ?? '' }
      if (!next.buffer && next.filePath) {
        next.buffer = fileToArrayBuffer(next.filePath)
      }
      cb(next)
    })
  },
  onHotkeyPtt: (cb: () => void) => {
    ipcRenderer.on('niko:hotkey-ptt', () => cb())
  },
  onConfigReloaded: (cb: () => void) => {
    ipcRenderer.on('niko:config-reloaded', () => cb())
  }
}

contextBridge.exposeInMainWorld('niko', niko)

