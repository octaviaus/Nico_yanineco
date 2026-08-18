import { contextBridge, ipcRenderer } from 'electron'
import type { CharacterPose } from '@niko/core'

export type RendererConfig = {
  sttProvider: 'openai' | 'local' | 'webspeech'
  idlePuffSeconds: number
}

const niko = {
  getConfig: (): Promise<RendererConfig> => ipcRenderer.invoke('niko:get-config'),
  getLive2DModel: (): Promise<string | null> => ipcRenderer.invoke('niko:live2d-model'),
  getCubismCore: (): Promise<string | null> => ipcRenderer.invoke('niko:cubism-core'),
  sendText: (text: string) => ipcRenderer.invoke('niko:text', text),
  sendAudio: (buffer: ArrayBuffer, mime: string) =>
    ipcRenderer.invoke('niko:audio-utterance', { buffer, mime }),
  ptt: (down: boolean) => ipcRenderer.send('niko:ptt', down),
  speakingEnd: () => ipcRenderer.send('niko:speaking-end'),
  drag: (dx: number, dy: number) => ipcRenderer.send('niko:drag', { dx, dy }),
  onPose: (cb: (pose: CharacterPose) => void) => {
    ipcRenderer.on('niko:pose', (_e, pose: CharacterPose) => cb(pose))
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
  onAudio: (cb: (payload: { base64: string; mime: string }) => void) => {
    ipcRenderer.on('niko:audio', (_e, payload) => cb(payload))
  },
  onHotkeyPtt: (cb: () => void) => {
    ipcRenderer.on('niko:hotkey-ptt', () => cb())
  },
  onConfigReloaded: (cb: () => void) => {
    ipcRenderer.on('niko:config-reloaded', () => cb())
  }
}

contextBridge.exposeInMainWorld('niko', niko)

declare global {
  interface Window {
    niko: typeof niko
  }
}
