import type { CharacterPose } from '@niko/core'

export interface CharacterRenderer {
  readonly kind: 'sprite' | 'live2d' | 'pixel'
  /** Pixel: idle/talk/inhale/exhale → frozen eye/mouth layers (agent-split §2). */
  setPose(pose: CharacterPose): void
  /** Pixel talk: thresholded mouth-open vs mouth-closed. Idle/inhale stay closed. */
  setMouthOpen(value: number): void
  setSmokeParam(value: number): void
  getMouthWorld(): { x: number; y: number }
  destroy(): void
}

export function assetPath(rel: string): string {
  const base = import.meta.env.BASE_URL || './'
  return `${base}${rel.replace(/^\//, '')}`
}
