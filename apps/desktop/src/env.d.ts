/// <reference types="vite/client" />

interface NikoApi {
  getConfig: () => Promise<{ sttProvider: 'openai' | 'local' | 'webspeech'; idlePuffSeconds: number }>
  getLive2DModel: () => Promise<string | null>
  getCubismCore: () => Promise<string | null>
  sendText: (text: string) => Promise<unknown>
  sendAudio: (buffer: ArrayBuffer, mime: string) => Promise<unknown>
  ptt: (down: boolean) => void
  quit: () => void
  speakingEnd: () => void
  drag: (dx: number, dy: number) => void
  onPose: (cb: (pose: import('@niko/core').CharacterPose) => void) => void
  onSmoke: (cb: (cmd: { intensity: number; burst: boolean; clear: boolean }) => void) => void
  onSubtitle: (cb: (text: string) => void) => void
  onStatus: (cb: (text: string) => void) => void
  onAudio: (cb: (payload: {
    base64: string
    mime: string
    filePath?: string
    fileUrl?: string
    buffer?: ArrayBuffer
    interrupt?: boolean
    final?: boolean
  }) => void) => void
  onHotkeyPtt: (cb: () => void) => void
  onConfigReloaded: (cb: () => void) => void
}

interface Window {
  niko: NikoApi
}

declare module 'pixi-live2d-display/cubism4' {
  import type { Ticker } from 'pixi.js'
  export class Live2DModel {
    static registerTicker(ticker: typeof Ticker): void
    static from(source: string): Promise<Live2DModel>
    anchor: { set: (x: number, y: number) => void }
    scale: { set: (s: number) => void }
    x: number
    y: number
    width: number
    height: number
    motion(group: string): Promise<unknown>
    destroy(opts?: { children?: boolean }): void
    internalModel?: {
      coreModel?: { setParameterValueById?: (id: string, value: number) => void }
    }
  }
}
