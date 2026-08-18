import type { CharacterPose } from '@niko/core'

export interface CharacterRenderer {
  readonly kind: 'sprite' | 'live2d'
  setPose(pose: CharacterPose): void
  setMouthOpen(value: number): void
  setSmokeParam(value: number): void
  getMouthWorld(): { x: number; y: number }
  destroy(): void
}

export function assetPath(rel: string): string {
  const base = import.meta.env.BASE_URL || './'
  return `${base}${rel.replace(/^\//, '')}`
}
