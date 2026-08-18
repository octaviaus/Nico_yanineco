import { Menu, Tray, nativeImage } from 'electron'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { assetsDir } from './paths'
import type { OverlayWindows } from './windows'

const FALLBACK_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAADUlEQVQYlWNgGAWjgP8/AAAC/AH+XoRjYgAAAABJRU5ErkJggg=='

export function createTray(opts: {
  windows: OverlayWindows
  onQuit: () => void
  onPuff: () => void
  onClear: () => void
  onToggle: () => void
}): Tray {
  const iconPath = path.join(assetsDir(), 'sprites', 'tray.png')
  const fallbackIdle = path.join(assetsDir(), 'sprites', 'idle.png')
  const chosen = existsSync(iconPath) ? iconPath : existsSync(fallbackIdle) ? fallbackIdle : null
  const image = chosen
    ? nativeImage.createFromPath(chosen).resize({ width: 16, height: 16 })
    : nativeImage.createFromDataURL(FALLBACK_PNG)
  const tray = new Tray(image.isEmpty() ? nativeImage.createFromDataURL(FALLBACK_PNG) : image)
  tray.setToolTip('尼古喵喵')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '吐一口', click: opts.onPuff },
      { label: '散烟', click: opts.onClear },
      { type: 'separator' },
      { label: '显示 / 隐藏', click: opts.onToggle },
      { type: 'separator' },
      { label: '退出', click: opts.onQuit }
    ])
  )
  tray.on('click', opts.onToggle)
  return tray
}
