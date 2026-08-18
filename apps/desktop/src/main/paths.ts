import { app } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

export function repoRoot(): string {
  if (app.isPackaged) return process.resourcesPath
  return path.resolve(here, '../../../..')
}

export function assetsDir(): string {
  return path.join(repoRoot(), 'assets')
}
