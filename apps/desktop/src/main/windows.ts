import { BrowserWindow, screen } from 'electron'
import { existsSync } from 'node:fs'
import path from 'node:path'
import {
  CHARACTER_SCREEN_MARGIN_X,
  CHARACTER_SCREEN_MARGIN_Y,
  CHARACTER_WINDOW_HEIGHT,
  CHARACTER_WINDOW_WIDTH
} from '../shared/geometry'

function preloadPath(outDir: string): string {
  const cjs = path.join(outDir, '../preload/index.cjs')
  const mjs = path.join(outDir, '../preload/index.mjs')
  const js = path.join(outDir, '../preload/index.js')
  if (existsSync(cjs)) return cjs
  if (existsSync(mjs)) return mjs
  return js
}

export type OverlayWindows = {
  character: BrowserWindow
  smoke: BrowserWindow
}

function pageUrl(outDir: string, name: 'character' | 'smoke'): string {
  if (process.env.ELECTRON_RENDERER_URL) {
    return `${process.env.ELECTRON_RENDERER_URL}/${name}.html`
  }
  return path.join(outDir, `../renderer/${name}.html`)
}

export function createWindows(outDir: string): OverlayWindows {
  const display = screen.getPrimaryDisplay()
  const { width, height } = display.bounds

  const smoke = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width,
    height,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    skipTaskbar: true,
    focusable: false,
    resizable: false,
    movable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: preloadPath(outDir),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      sandbox: false,
      webSecurity: false
    }
  })
  smoke.setIgnoreMouseEvents(true, { forward: true })
  smoke.setAlwaysOnTop(true, 'screen-saver')
  smoke.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  const character = new BrowserWindow({
    width: CHARACTER_WINDOW_WIDTH,
    height: CHARACTER_WINDOW_HEIGHT,
    x: display.bounds.x + width - CHARACTER_WINDOW_WIDTH - CHARACTER_SCREEN_MARGIN_X,
    y: display.bounds.y + height - CHARACTER_WINDOW_HEIGHT - CHARACTER_SCREEN_MARGIN_Y,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    skipTaskbar: true,
    resizable: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: preloadPath(outDir),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      sandbox: false,
      webSecurity: false
    }
  })
  character.setAlwaysOnTop(true, 'screen-saver')
  character.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  character.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('[character] fail', code, desc, url)
  })
  smoke.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('[smoke] fail', code, desc, url)
  })

  const charUrl = pageUrl(outDir, 'character')
  const smokeUrl = pageUrl(outDir, 'smoke')
  if (charUrl.startsWith('http')) {
    void character.loadURL(charUrl)
    void smoke.loadURL(smokeUrl)
  } else {
    void character.loadFile(charUrl)
    void smoke.loadFile(smokeUrl)
  }

  return { character, smoke }
}
